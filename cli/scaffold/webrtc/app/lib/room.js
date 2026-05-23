// lib/room.js - Backend-less WebRTC room built on BroadcastChannel.
//
// Why no backend?
//   WebRTC needs a signaling channel to swap SDP + ICE between peers. We use
//   BroadcastChannel, which lets every same-origin tab on the same browser
//   talk to every other tab for free. Open the demo in 2+ tabs (or windows)
//   and you have a working mesh room with audio, video, screen share, and
//   text chat - zero servers required.
//
// Caveats:
//   - BroadcastChannel is same-origin / same-browser only. To connect across
//     machines, plug in any real signaling transport (WebSocket, SSE, etc.)
//     in place of BroadcastChannel and the rest of this file keeps working.
//   - Mesh topology: every peer has an RTCPeerConnection with every other
//     peer. Works great up to ~6 peers; beyond that, use an SFU.

const SIGNAL_VERSION = 1;

/**
 * Wrap a BroadcastChannel as a "SignalingClient" that $.Peer can consume.
 * The Peer class expects `.send(type, payload)` and `.on(type, cb)`.
 */
function makeSignaling(channel, myId) {
    return {
        send(type, payload) {
            channel.postMessage({ v: SIGNAL_VERSION, type, from: myId, ...payload });
        },
        on(type, cb) {
            const handler = (ev) => {
                const msg = ev.data;
                if (!msg || msg.v !== SIGNAL_VERSION) return;
                if (msg.type !== type) return;
                if (msg.from === myId) return;                       // ignore self
                if (msg.to !== undefined && msg.to !== myId) return; // not addressed to us
                cb(msg);
            };
            channel.addEventListener('message', handler);
            return () => channel.removeEventListener('message', handler);
        },
    };
}

/**
 * Backend-less mesh room.
 *
 * Events (subscribe via `.on(type, cb)`):
 *   - 'peers'     payload: Map<id, PeerInfo>     - roster changed
 *   - 'chat'      payload: { from, name, text, t }
 *   - 'status'    payload: string                - human-readable status line
 *   - 'error'     payload: Error
 *
 * PeerInfo: { id, name, stream: MediaStream|null, peer: $.Peer, chat: RTCDataChannel|null }
 */
export class LocalRoom {
    constructor(name, { id, displayName, iceServers = [] } = {}) {
        this.name        = name;
        this.id          = id          || ('p-' + Math.random().toString(36).slice(2, 10));
        this.displayName = displayName || ('User-' + this.id.slice(-4));
        this.iceServers  = iceServers;

        this._channel    = null;
        this._signaling  = null;
        this._peers      = new Map();          // id -> PeerInfo
        this._localStream = null;
        this._videoSenders = new Map();        // peerId -> RTCRtpSender (current video sender)
        this._listeners  = new Map();
        this._heartbeat  = null;
        this._unsubHello = null;
        this._unsubBye   = null;
        this.closed      = false;
    }

    // ---- Pub/sub ---------------------------------------------------------

    on(type, cb) {
        if (typeof cb !== 'function') return () => {};
        let set = this._listeners.get(type);
        if (!set) { set = new Set(); this._listeners.set(type, set); }
        set.add(cb);
        return () => set.delete(cb);
    }

    _emit(type, payload) {
        const set = this._listeners.get(type);
        if (!set) return;
        for (const cb of [...set]) { try { cb(payload); } catch (_) {} }
    }

    get peers() { return this._peers; }

    // ---- Lifecycle -------------------------------------------------------

    /**
     * Open the BroadcastChannel, announce presence, and start accepting peers.
     * `localStream` is optional - join as a viewer if you have no camera/mic.
     */
    join(localStream = null) {
        if (this.closed) throw new Error('LocalRoom already closed');
        this._localStream = localStream;

        this._channel   = new BroadcastChannel('zquery-room::' + this.name);
        this._signaling = makeSignaling(this._channel, this.id);

        // Listen for newcomers' hellos and respond with our own hello so the
        // newcomer learns about us too. Net effect: every pair exchanges
        // hellos exactly once and both sides bring up a peer connection.
        this._unsubHello = this._signaling.on('hello', (m) => {
            // Ignore if we already track this peer.
            if (this._peers.has(m.from)) return;
            this._addPeer(m.from, m.name || 'User');
            // Reply directly so the newcomer adds us.
            this._signaling.send('hello', { to: m.from, name: this.displayName });
        });

        this._unsubBye = this._signaling.on('bye', (m) => {
            this._removePeer(m.from);
        });

        // Broadcast hello to the whole room (no `to` field = everyone).
        this._signaling.send('hello', { name: this.displayName });
        this._emit('status', 'Looking for peers in room "' + this.name + '"...');

        // Periodic hello so late-comers refresh the roster even if they miss
        // the first broadcast (e.g. tab woken from background).
        this._heartbeat = setInterval(() => {
            if (this.closed) return;
            this._signaling.send('hello', { name: this.displayName });
        }, 5000);

        return this;
    }

    leave() {
        if (this.closed) return;
        this.closed = true;

        if (this._heartbeat)  { clearInterval(this._heartbeat); this._heartbeat = null; }
        if (this._unsubHello) { this._unsubHello(); this._unsubHello = null; }
        if (this._unsubBye)   { this._unsubBye();   this._unsubBye   = null; }

        try { this._signaling && this._signaling.send('bye', {}); } catch (_) {}

        for (const info of this._peers.values()) {
            try { info.peer.close(); } catch (_) {}
        }
        this._peers.clear();
        this._videoSenders.clear();
        this._emit('peers', this._peers);

        if (this._channel) {
            try { this._channel.close(); } catch (_) {}
            this._channel = null;
        }
    }

    // ---- Media control ---------------------------------------------------

    /**
     * Replace our outgoing video track on every peer (used for screen share).
     * Pass `null` to remove video entirely (camera-off).
     */
    async replaceVideoTrack(newTrack) {
        for (const [id, sender] of this._videoSenders) {
            try { await sender.replaceTrack(newTrack); }
            catch (err) { this._emit('error', err); }
        }
    }

    /** Broadcast a chat message over every peer's data channel. */
    sendChat(text) {
        const msg = { from: this.id, name: this.displayName, text, t: Date.now() };
        const payload = JSON.stringify(msg);
        for (const info of this._peers.values()) {
            const dc = info.chat;
            if (dc && dc.readyState === 'open') {
                try { dc.send(payload); } catch (_) {}
            }
        }
        // Echo locally so the sender sees their own message.
        this._emit('chat', msg);
    }

    // ---- Peer plumbing ---------------------------------------------------

    _addPeer(remoteId, remoteName) {
        // Perfect-negotiation politeness: the peer with the larger id is polite.
        const polite = this.id > remoteId;
        const peer = new window.$.Peer(remoteId, this._signaling, {
            polite,
            iceServers: this.iceServers,
        });

        /** @type {PeerInfo} */
        const info = { id: remoteId, name: remoteName, stream: null, peer, chat: null };
        this._peers.set(remoteId, info);

        // Collect remote tracks into a single MediaStream per peer.
        peer.on('track', (ev) => {
            const stream = ev.streams && ev.streams[0]
                ? ev.streams[0]
                : (info.stream || new MediaStream([ev.track]));
            info.stream = stream;
            this._emit('peers', this._peers);
        });

        // The peer with the smaller id opens the chat channel so we only get
        // one per pair. The other side picks it up via 'datachannel'.
        if (this.id < remoteId) {
            const dc = peer.createDataChannel('chat');
            this._wireChat(info, dc);
        } else {
            peer.on('datachannel', (ev) => this._wireChat(info, ev.channel));
        }

        peer.on('connectionstatechange', (state) => {
            if (state === 'failed' || state === 'closed') this._removePeer(remoteId);
        });

        peer.on('error', (err) => this._emit('error', err));

        // Publish local tracks (camera + mic) so the negotiation fires.
        if (this._localStream) {
            for (const track of this._localStream.getTracks()) {
                const sender = peer.addTrack(track, this._localStream);
                if (track.kind === 'video') this._videoSenders.set(remoteId, sender);
            }
        }

        this._emit('peers', this._peers);
        this._emit('status', 'Peer joined: ' + remoteName);
    }

    _wireChat(info, dc) {
        info.chat = dc;
        dc.onmessage = (ev) => {
            try { this._emit('chat', JSON.parse(ev.data)); }
            catch (_) { /* ignore malformed */ }
        };
        dc.onopen  = () => this._emit('status', info.name + ' is now connected.');
        dc.onclose = () => { if (info.chat === dc) info.chat = null; };
    }

    _removePeer(remoteId) {
        const info = this._peers.get(remoteId);
        if (!info) return;
        try { info.peer.close(); } catch (_) {}
        this._peers.delete(remoteId);
        this._videoSenders.delete(remoteId);
        this._emit('peers', this._peers);
        this._emit('status', 'Peer left: ' + info.name);
    }
}
