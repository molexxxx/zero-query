/**
 * src/webrtc/room.js - high-level Room handle and `join()` orchestrator
 *
 * A `Room` owns a mesh of `Peer` instances around a single `SignalingClient`,
 * exposing reactive `peers` / `localTracks` `Signal`s, plus an imperative
 * `publish` / `unpublish` / `dataChannel` / `leave` surface and a small
 * `peer-joined` / `peer-left` / `error` event bus.
 *
 * Created by `webrtc.join(url, opts)` (see `index.js`). Direct construction
 * is private API - callers should always go through `join()` so the
 * connect / hello / join handshake completes before they get the handle.
 *
 * SSR-safe by reflection: `webrtc.join` defers all browser globals
 * (`WebSocket`, `RTCPeerConnection`, `navigator.mediaDevices`) until called.
 */

import { signal } from '../reactive.js';
import { SignalingClient } from './signaling.js';
import { Peer } from './peer.js';
import { WebRtcError, SignalingError } from './errors.js';


// ---------------------------------------------------------------------------
// Room
// ---------------------------------------------------------------------------

/**
 * High-level handle around a joined room.
 *
 * Do not call `new Room(...)` directly - use `webrtc.join()`. The
 * constructor is exported for type-checking and testing only.
 */
export class Room {
    /**
     * @param {object} args
     * @param {string} args.id - Room id (the `room` argument passed to `webrtc.join`).
     * @param {string} args.self - Server-assigned local peer id (from the `hello` frame).
     * @param {SignalingClient} args.signaling - Live signaling client.
     * @param {object} [args.peerOptions] - Forwarded to each `new Peer(id, sig, opts)`.
     */
    constructor({ id, self, signaling, peerOptions = {} }) {
        if (typeof id !== 'string' || id.length === 0) {
            throw new WebRtcError('Room: id must be a non-empty string', { code: 'ZQ_WEBRTC_ROOM_BAD_ID' });
        }
        if (typeof self !== 'string' || self.length === 0) {
            throw new WebRtcError('Room: self must be a non-empty string', { code: 'ZQ_WEBRTC_ROOM_BAD_SELF' });
        }
        if (!signaling || typeof signaling.send !== 'function') {
            throw new WebRtcError('Room: signaling must be a SignalingClient', { code: 'ZQ_WEBRTC_ROOM_BAD_SIGNALING' });
        }

        this.id          = id;
        this.self        = self;
        this.signaling   = signaling;
        this.peerOptions = peerOptions;
        this.closed      = false;

        /** Reactive map of remote peers, keyed by peer id. */
        this.peers       = signal(new Map());
        /** Reactive list of local tracks currently being published. */
        this.localTracks = signal([]);

        // Event bus (peer-joined, peer-left, mute, unmute, error)
        /** @type {Map<string, Set<Function>>} */
        this._listeners  = new Map();

        // Track every (stream, track) pair we're publishing so a peer that
        // joins later automatically receives the same set of tracks.
        /** @type {Array<{ track: MediaStreamTrack, stream: MediaStream }>} */
        this._publishedTracks = [];

        // Per-peer sender bookkeeping so unpublish() can remove cleanly.
        // _peerSenders : Map<peerId, Map<track, sender>>
        /** @type {Map<string, Map<MediaStreamTrack, any>>} */
        this._peerSenders = new Map();

        // Multiplexed data channels, keyed by label. Each entry owns the
        // per-peer underlying RTCDataChannel map plus the broadcast wrapper.
        /** @type {Map<string, _RoomDataChannel>} */
        this._channels    = new Map();

        this._signalingUnsubs = [];
        this._attachSignaling();
    }


    // ---- Mesh management ---------------------------------------------------

    /**
     * Add a remote peer to the mesh. Idempotent.
     * @param {string} peerId
     */
    _addPeer(peerId) {
        if (this.closed) return;
        if (peerId === this.self) return;
        const map = this.peers.peek();
        if (map.has(peerId)) return;

        // Perfect-negotiation polite flag - both ends agree deterministically.
        const polite = this.self > peerId;
        const peer = new Peer(peerId, this.signaling, Object.assign({ polite }, this.peerOptions));

        /** @type {{ id: string, peer: Peer, pc: RTCPeerConnection, stream: MediaStream, audio: boolean, video: boolean, connection: string }} */
        const info = {
            id:         peerId,
            peer,
            pc:         peer.pc,
            stream:     _newMediaStream(),
            audio:      false,
            video:      false,
            connection: 'new',
        };

        peer.on('track', (evt) => {
            // Prefer the first event-supplied stream so MediaStream identity is
            // shared with what the remote sent; fall back to our local synthetic.
            const incoming = evt && evt.streams && evt.streams[0];
            if (incoming && incoming !== info.stream) {
                info.stream = incoming;
            } else if (evt && evt.track && typeof info.stream.addTrack === 'function') {
                info.stream.addTrack(evt.track);
            }
            if (evt && evt.track) {
                if (evt.track.kind === 'audio') info.audio = true;
                if (evt.track.kind === 'video') info.video = true;
            }
            this._touchPeer(peerId);
        });

        peer.on('connectionstatechange', (state) => {
            info.connection = state;
            this._touchPeer(peerId);
            if (state === 'failed') this._emit('error', new WebRtcError(
                `Room: peer "${peerId}" connection failed`,
                { code: 'ZQ_WEBRTC_PEER_FAILED', context: { peerId } }
            ));
        });

        peer.on('datachannel', (evt) => {
            const dc = evt && evt.channel;
            if (!dc) return;
            // Surface the incoming channel through the matching multiplex
            // wrapper so callers see remote-opened channels alongside their own.
            const wrap = this._channels.get(dc.label);
            if (wrap) wrap._adoptIncoming(peerId, dc);
        });

        peer.on('error', (err) => this._emit('error', err));

        // Mirror the new peer into the reactive Map.
        const next = new Map(map);
        next.set(peerId, info);
        this.peers.value = next;

        // Pre-existing local tracks: republish to the fresh peer.
        if (this._publishedTracks.length > 0) {
            const senders = new Map();
            for (const { track, stream } of this._publishedTracks) {
                try {
                    const sender = peer.addTrack(track, stream);
                    senders.set(track, sender);
                } catch (err) {
                    this._emit('error', err);
                }
            }
            this._peerSenders.set(peerId, senders);
        }

        // Pre-existing data channels: open the same label on the new peer.
        for (const wrap of this._channels.values()) {
            try { wrap._openOnPeer(peerId, peer); }
            catch (err) { this._emit('error', err); }
        }

        this._emit('peer-joined', info);
    }

    /**
     * Drop a peer from the mesh.
     * @param {string} peerId
     */
    _removePeer(peerId) {
        const map = this.peers.peek();
        const info = map.get(peerId);
        if (!info) return;

        try { info.peer.close(); }
        catch (_) { /* idempotent */ }

        for (const wrap of this._channels.values()) wrap._dropPeer(peerId);
        this._peerSenders.delete(peerId);

        const next = new Map(map);
        next.delete(peerId);
        this.peers.value = next;

        this._emit('peer-left', info);
    }

    /** Re-emit a `peers` notification (used when PeerInfo internals mutate in place). */
    _touchPeer(peerId) {
        const map = this.peers.peek();
        if (!map.has(peerId)) return;
        // Replace with a fresh Map so the signal notifies subscribers.
        this.peers.value = new Map(map);
    }


    // ---- Imperative surface ------------------------------------------------

    /**
     * Add every track in `stream` to every existing peer (and remember the
     * pair so peers that join later also receive them).
     *
     * @param {MediaStream} stream
     * @returns {Promise<void>}
     */
    async publish(stream) {
        if (this.closed) throw new WebRtcError('Room.publish: room is closed', { code: 'ZQ_WEBRTC_ROOM_CLOSED' });
        if (!stream || typeof stream.getTracks !== 'function') {
            throw new WebRtcError('Room.publish: stream must be a MediaStream', { code: 'ZQ_WEBRTC_ROOM_BAD_STREAM' });
        }
        const tracks = stream.getTracks();
        for (const track of tracks) {
            // Skip duplicates.
            if (this._publishedTracks.some((p) => p.track === track)) continue;
            this._publishedTracks.push({ track, stream });

            for (const [peerId, info] of this.peers.peek()) {
                const senders = this._peerSenders.get(peerId) || new Map();
                try {
                    const sender = info.peer.addTrack(track, stream);
                    senders.set(track, sender);
                } catch (err) {
                    this._emit('error', err);
                }
                this._peerSenders.set(peerId, senders);
            }
        }
        // Notify localTracks subscribers.
        this.localTracks.value = this._publishedTracks.map((p) => p.track);
    }

    /**
     * Remove every track in `stream` from every peer.
     *
     * @param {MediaStream} stream
     * @returns {Promise<void>}
     */
    async unpublish(stream) {
        if (this.closed) return;
        if (!stream || typeof stream.getTracks !== 'function') {
            throw new WebRtcError('Room.unpublish: stream must be a MediaStream', { code: 'ZQ_WEBRTC_ROOM_BAD_STREAM' });
        }
        const tracks = stream.getTracks();
        for (const track of tracks) {
            const idx = this._publishedTracks.findIndex((p) => p.track === track);
            if (idx === -1) continue;
            this._publishedTracks.splice(idx, 1);
            for (const [peerId, info] of this.peers.peek()) {
                const senders = this._peerSenders.get(peerId);
                if (!senders) continue;
                const sender = senders.get(track);
                if (!sender) continue;
                try { info.peer.removeTrack(sender); }
                catch (err) { this._emit('error', err); }
                senders.delete(track);
            }
        }
        this.localTracks.value = this._publishedTracks.map((p) => p.track);
    }

    /**
     * Open (or look up) a multiplexed data channel on this room. The same
     * `label` returns the same wrapper across calls. `send()` broadcasts to
     * every peer; `on('message', cb)` fires once per inbound frame from any
     * peer with `(data, peerId)` as the arguments.
     *
     * @param {string} label
     * @param {RTCDataChannelInit} [opts]
     */
    dataChannel(label, opts) {
        if (this.closed) throw new WebRtcError('Room.dataChannel: room is closed', { code: 'ZQ_WEBRTC_ROOM_CLOSED' });
        if (typeof label !== 'string' || label.length === 0) {
            throw new WebRtcError('Room.dataChannel: label must be a non-empty string', { code: 'ZQ_WEBRTC_ROOM_BAD_LABEL' });
        }
        const existing = this._channels.get(label);
        if (existing) return existing;

        const wrap = new _RoomDataChannel(label, opts || {});
        this._channels.set(label, wrap);

        for (const [peerId, info] of this.peers.peek()) {
            try { wrap._openOnPeer(peerId, info.peer); }
            catch (err) { this._emit('error', err); }
        }
        return wrap;
    }

    /**
     * Leave the room - closes every peer, tells the server, and disposes
     * the signaling subscriptions. The underlying `SignalingClient` is left
     * open so the caller can join another room without reconnecting.
     */
    async leave() {
        if (this.closed) return;
        this.closed = true;

        for (const unsub of this._signalingUnsubs) {
            try { unsub(); } catch (_) { /* idempotent */ }
        }
        this._signalingUnsubs = [];

        for (const wrap of this._channels.values()) wrap._closeAll();
        this._channels.clear();

        for (const [, info] of this.peers.peek()) {
            try { info.peer.close(); } catch (_) { /* idempotent */ }
        }
        this.peers.value = new Map();

        try { this.signaling.send('leave', {}); }
        catch (_) { /* socket may already be closed */ }

        this._listeners.clear();
    }


    // ---- Tiny event bus ---------------------------------------------------

    /**
     * Subscribe to a room-level event.
     * @param {'peer-joined'|'peer-left'|'mute'|'unmute'|'error'} event
     * @param {Function} cb
     * @returns {() => void}
     */
    on(event, cb) {
        if (typeof cb !== 'function') return () => {};
        let set = this._listeners.get(event);
        if (!set) { set = new Set(); this._listeners.set(event, set); }
        set.add(cb);
        return () => this.off(event, cb);
    }

    /** Remove a previously registered listener. */
    off(event, cb) {
        const set = this._listeners.get(event);
        if (set) set.delete(cb);
    }

    /** @private */
    _emit(event, payload) {
        const set = this._listeners.get(event);
        if (!set) return;
        for (const cb of [...set]) {
            try { cb(payload); }
            catch (_) { /* listeners must not break the room */ }
        }
    }


    // ---- Signaling glue ---------------------------------------------------

    /** @private */
    _attachSignaling() {
        this._signalingUnsubs.push(this.signaling.on('peer-joined', (msg) => {
            if (msg && typeof msg.id === 'string') this._addPeer(msg.id);
        }));
        this._signalingUnsubs.push(this.signaling.on('peer-left', (msg) => {
            if (msg && typeof msg.id === 'string') this._removePeer(msg.id);
        }));
        this._signalingUnsubs.push(this.signaling.on('mute', (msg) => {
            this._emit('mute', msg);
        }));
        this._signalingUnsubs.push(this.signaling.on('unmute', (msg) => {
            this._emit('unmute', msg);
        }));
    }
}


// ---------------------------------------------------------------------------
// _RoomDataChannel - multiplex wrapper around per-peer RTCDataChannels
// ---------------------------------------------------------------------------

class _RoomDataChannel {
    constructor(label, opts) {
        this.label    = label;
        this.opts     = opts;
        this.closed   = false;
        /** @type {Map<string, RTCDataChannel>} */
        this._byPeer  = new Map();
        /** @type {Set<Function>} */
        this._onMessage = new Set();
        /** @type {Set<Function>} */
        this._onOpen    = new Set();
    }

    /** Open the channel on a freshly-joined peer. */
    _openOnPeer(peerId, peer) {
        if (this.closed) return;
        if (this._byPeer.has(peerId)) return;
        const dc = peer.createDataChannel(this.label, this.opts);
        this._attach(peerId, dc);
    }

    /** Adopt an incoming channel that the remote opened first. */
    _adoptIncoming(peerId, dc) {
        if (this.closed) return;
        // If we already created one for this peer, prefer the existing.
        if (this._byPeer.has(peerId)) return;
        this._attach(peerId, dc);
    }

    _attach(peerId, dc) {
        this._byPeer.set(peerId, dc);
        const fanOpen = () => {
            for (const cb of [...this._onOpen]) {
                try { cb(peerId); } catch (_) { /* swallow */ }
            }
        };
        const fanMsg = (evt) => {
            const data = evt && 'data' in evt ? evt.data : evt;
            for (const cb of [...this._onMessage]) {
                try { cb(data, peerId); } catch (_) { /* swallow */ }
            }
        };
        if (typeof dc.addEventListener === 'function') {
            dc.addEventListener('open',    fanOpen);
            dc.addEventListener('message', fanMsg);
        } else {
            dc.onopen    = fanOpen;
            dc.onmessage = fanMsg;
        }
    }

    /** Drop a peer's underlying channel (peer-left). */
    _dropPeer(peerId) {
        const dc = this._byPeer.get(peerId);
        if (dc) { try { dc.close(); } catch (_) {} }
        this._byPeer.delete(peerId);
    }

    /** Close every underlying channel. */
    _closeAll() {
        this.closed = true;
        for (const dc of this._byPeer.values()) {
            try { dc.close(); } catch (_) {}
        }
        this._byPeer.clear();
        this._onMessage.clear();
        this._onOpen.clear();
    }


    // -- Public surface ------------------------------------------------------

    /** Broadcast a payload to every peer's underlying channel. */
    send(data) {
        if (this.closed) return;
        for (const dc of this._byPeer.values()) {
            try { dc.send(data); }
            catch (_) { /* skip dead channels */ }
        }
    }

    /**
     * Subscribe to one of two events:
     *   - `'message'` (data, peerId) - fires per inbound frame from any peer
     *   - `'open'`    (peerId)       - fires when a per-peer channel reaches `'open'`
     *
     * @param {'message'|'open'} event
     * @param {Function} cb
     * @returns {() => void}
     */
    on(event, cb) {
        if (typeof cb !== 'function') return () => {};
        const set = event === 'open' ? this._onOpen : this._onMessage;
        set.add(cb);
        return () => set.delete(cb);
    }

    /** Close every underlying channel (alias for `_closeAll`). */
    close() { this._closeAll(); }
}


// ---------------------------------------------------------------------------
// join()
// ---------------------------------------------------------------------------

/**
 * Connect to the signaling URL, join a room, and resolve with a `Room`.
 *
 * Browser globals are looked up at call time (never at module load) so the
 * library stays SSR-safe. Tests can inject a fake `WebSocket` and
 * `RTCPeerConnection` via the options bag.
 *
 * @param {string} url - WebSocket URL of a `@zero-server/webrtc` hub.
 * @param {object} opts
 * @param {string} opts.room
 * @param {string} [opts.token]
 * @param {RTCIceServer[]} [opts.iceServers]
 * @param {boolean|MediaStreamConstraints} [opts.media] - If truthy, calls `getUserMedia` and `publish()` the result.
 * @param {boolean|'auto'} [opts.polite] - Forced polite flag override (rarely useful - the default lexicographic rule is correct for symmetric meshes).
 * @param {number} [opts.signalingTimeoutMs] - Max time to wait for `hello` + `joined` frames. Default `15000`.
 * @param {false|object} [opts.reconnect] - Forwarded to `SignalingClient`.
 * @param {typeof WebSocket} [opts.WebSocket] - Override (tests / SSR).
 * @param {typeof RTCPeerConnection} [opts.RTCPeerConnection] - Override (tests / SSR).
 * @param {{ mediaDevices: { getUserMedia(c): Promise<MediaStream> } }} [opts.navigator] - Override `navigator.mediaDevices` for tests.
 * @returns {Promise<Room>}
 */
export async function join(url, opts) {
    if (typeof url !== 'string' || url.length === 0) {
        throw new WebRtcError('webrtc.join: url must be a non-empty string', { code: 'ZQ_WEBRTC_JOIN_BAD_URL' });
    }
    if (!opts || typeof opts.room !== 'string' || opts.room.length === 0) {
        throw new WebRtcError('webrtc.join: opts.room must be a non-empty string', { code: 'ZQ_WEBRTC_JOIN_BAD_ROOM' });
    }

    const sigOpts = {};
    if (opts.reconnect !== undefined) sigOpts.reconnect = opts.reconnect;
    if (opts.WebSocket)               sigOpts.WebSocket = opts.WebSocket;

    const signaling = new SignalingClient(url, sigOpts);

    const peerOptions = {};
    if (opts.iceServers)        peerOptions.iceServers = opts.iceServers;
    if (opts.RTCPeerConnection) peerOptions.RTCPeerConnection = opts.RTCPeerConnection;
    if (opts.polite !== undefined && opts.polite !== 'auto') peerOptions.polite = !!opts.polite;

    const timeoutMs = typeof opts.signalingTimeoutMs === 'number' ? opts.signalingTimeoutMs : 15_000;

    const helloPromise  = _waitFor(signaling, 'hello',  timeoutMs);
    const joinedPromise = _waitFor(signaling, 'joined', timeoutMs);
    // Avoid an unhandled rejection if `hello` fails first and we never
    // reach the `await joinedPromise` site.
    joinedPromise.catch(() => {});

    try {
        await signaling.connect();
        const hello = await helloPromise;
        const selfId = hello && hello.peerId;
        if (typeof selfId !== 'string' || selfId.length === 0) {
            throw new SignalingError('webrtc.join: hello frame missing peerId', { code: 'ZQ_WEBRTC_JOIN_NO_PEER_ID' });
        }

        signaling.send('join', { room: opts.room, token: opts.token });
        const joined = await joinedPromise;
        const initialPeers = (joined && Array.isArray(joined.peers)) ? joined.peers : [];

        const room = new Room({ id: opts.room, self: selfId, signaling, peerOptions });
        for (const peerId of initialPeers) room._addPeer(peerId);

        if (opts.media) {
            const constraints = opts.media === true ? { audio: true, video: true } : opts.media;
            const nav = opts.navigator
                || (typeof navigator !== 'undefined' ? navigator : null);
            const md = nav && nav.mediaDevices;
            if (!md || typeof md.getUserMedia !== 'function') {
                throw new WebRtcError(
                    'webrtc.join: navigator.mediaDevices.getUserMedia is unavailable',
                    { code: 'ZQ_WEBRTC_JOIN_NO_MEDIA_DEVICES' }
                );
            }
            const stream = await md.getUserMedia(constraints);
            await room.publish(stream);
        }

        return room;
    } catch (err) {
        try { signaling.close(); } catch (_) {}
        if (err instanceof WebRtcError) throw err;
        throw new WebRtcError(
            `webrtc.join: ${err && err.message ? err.message : 'failed'}`,
            { code: 'ZQ_WEBRTC_JOIN_FAILED', cause: err }
        );
    }
}


// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Resolve on the first matching frame, reject after `timeoutMs`. */
function _waitFor(signaling, type, timeoutMs) {
    return new Promise((resolve, reject) => {
        let done = false;
        const off = signaling.on(type, (msg) => {
            if (done) return;
            done = true;
            try { off(); } catch (_) {}
            clearTimeout(timer);
            resolve(msg);
        });
        const timer = setTimeout(() => {
            if (done) return;
            done = true;
            try { off(); } catch (_) {}
            reject(new SignalingError(
                `webrtc.join: timed out waiting for "${type}" after ${timeoutMs}ms`,
                { code: 'ZQ_WEBRTC_JOIN_TIMEOUT', context: { type, timeoutMs } }
            ));
        }, timeoutMs);
    });
}

/** Try to instantiate a real MediaStream; fall back to a tiny stub for environments that lack it. */
function _newMediaStream() {
    if (typeof MediaStream === 'function') {
        try { return new MediaStream(); }
        catch (_) { /* fall through */ }
    }
    const tracks = [];
    return {
        id: `stream_${Math.random().toString(36).slice(2, 10)}`,
        getTracks: () => tracks.slice(),
        addTrack:  (t) => { tracks.push(t); },
        removeTrack: (t) => {
            const i = tracks.indexOf(t);
            if (i >= 0) tracks.splice(i, 1);
        },
    };
}
