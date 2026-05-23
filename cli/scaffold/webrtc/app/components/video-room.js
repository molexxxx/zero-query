// video-room.js - Mini-Discord style room: video tiles + screen share + chat.
//
// Backed by app/lib/room.js (BroadcastChannel signaling) so multiple tabs
// on the same browser form a working mesh room with no server at all.

import { LocalRoom } from '../lib/room.js';

$.component('video-room', {
    state: () => ({
        // Pre-join form ----------------------------------------------------
        roomName:    'lobby',
        displayName: 'User-' + Math.random().toString(36).slice(2, 6),
        // Live state -------------------------------------------------------
        joined:      false,
        status:      'Pick a room + name and click Join. Open this URL in a second tab to see a peer appear.',
        error:       '',
        // Local media ------------------------------------------------------
        localStream: null,
        micOn:       true,
        camOn:       true,
        sharing:     false,
        // Roster + chat ----------------------------------------------------
        peers:       [],            // [{ id, name, stream }]
        messages:    [],            // [{ from, name, text, t, mine }]
        draft:       '',
    }),

    mounted() {
        this._room        = null;
        this._cameraTrack = null;   // original camera video track (kept while screen sharing)
        this._screenStream = null;  // current display-media stream (cleared on stop)
    },

    async destroyed() {
        await this._teardown();
    },

    // ---- Pre-join form bindings -----------------------------------------

    setRoom(e) { this.setState({ roomName:    e.target.value }); },
    setName(e) { this.setState({ displayName: e.target.value }); },

    // ---- Join / leave ----------------------------------------------------

    async join() {
        if (this.state.joined) return;
        this.setState({ status: 'Requesting camera + microphone...', error: '' });

        let stream = null;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        } catch (err) {
            // Joining without media is still useful (viewer + chat only).
            this.setState({ status: 'No camera/mic - joining as viewer.', error: '' });
        }

        const cam = stream && stream.getVideoTracks()[0];
        if (cam) this._cameraTrack = cam;

        this._room = new LocalRoom(this.state.roomName, { displayName: this.state.displayName });
        this._room.on('peers',  (peers)  => this._onPeers(peers));
        this._room.on('chat',   (msg)    => this._onChat(msg));
        this._room.on('status', (status) => this.setState({ status }));
        this._room.on('error',  (err)    => this.setState({ error: String(err && err.message || err) }));
        this._room.join(stream);

        this.setState({
            joined:      true,
            localStream: stream,
            micOn:       !!(stream && stream.getAudioTracks()[0]),
            camOn:       !!cam,
            sharing:     false,
        });
    },

    async leave() {
        await this._teardown();
        this.setState({
            joined:      false,
            localStream: null,
            peers:       [],
            messages:    [],
            sharing:     false,
            status:      'Left the room. Click Join to reconnect.',
        });
    },

    async _teardown() {
        if (this._room) { try { this._room.leave(); } catch (_) {} this._room = null; }
        if (this._screenStream) {
            for (const t of this._screenStream.getTracks()) { try { t.stop(); } catch (_) {} }
            this._screenStream = null;
        }
        if (this.state.localStream) {
            for (const t of this.state.localStream.getTracks()) { try { t.stop(); } catch (_) {} }
        }
        this._cameraTrack = null;
    },

    // ---- Mic / cam toggles ----------------------------------------------

    toggleMic() {
        const stream = this.state.localStream;
        if (!stream) return;
        const next = !this.state.micOn;
        for (const t of stream.getAudioTracks()) t.enabled = next;
        this.setState({ micOn: next });
    },

    toggleCam() {
        const stream = this.state.localStream;
        if (!stream) return;
        const next = !this.state.camOn;
        for (const t of stream.getVideoTracks()) t.enabled = next;
        this.setState({ camOn: next });
    },

    // ---- Screen share ----------------------------------------------------

    async toggleShare() {
        if (!this._room) return;
        if (this.state.sharing) {
            // Stop sharing: revert every peer to the camera track.
            if (this._screenStream) {
                for (const t of this._screenStream.getTracks()) { try { t.stop(); } catch (_) {} }
                this._screenStream = null;
            }
            await this._room.replaceVideoTrack(this._cameraTrack || null);
            this.setState({ sharing: false, status: 'Stopped sharing screen.' });
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            this._screenStream = stream;
            const shareTrack = stream.getVideoTracks()[0];
            // When the user clicks the browser's native "Stop sharing", flip back.
            shareTrack.onended = () => { if (this.state.sharing) this.toggleShare(); };
            await this._room.replaceVideoTrack(shareTrack);
            this.setState({ sharing: true, status: 'Sharing your screen.' });
        } catch (err) {
            this.setState({ error: 'Screen share denied or unavailable.' });
        }
    },

    // ---- Roster + chat ---------------------------------------------------

    _onPeers(peersMap) {
        const list = Array.from(peersMap.values()).map((p) => ({
            id: p.id, name: p.name, stream: p.stream,
        }));
        this.setState({ peers: list });
    },

    _onChat(msg) {
        const mine = this._room && msg.from === this._room.id;
        const next = this.state.messages.concat([{ ...msg, mine }]);
        // Cap history so a long-running room doesn't grow forever.
        if (next.length > 200) next.splice(0, next.length - 200);
        this.setState({ messages: next });
    },

    setDraft(e) { this.setState({ draft: e.target.value }); },

    sendChat(e) {
        if (e && e.preventDefault) e.preventDefault();
        const text = (this.state.draft || '').trim();
        if (!text || !this._room) return;
        this._room.sendChat(text);
        this.setState({ draft: '' });
    },

    // ---- Render ----------------------------------------------------------

    render() {
        if (!this.state.joined) return this._renderLobby();
        return this._renderRoom();
    },

    _renderLobby() {
        const { roomName, displayName, status, error } = this.state;
        return `
            <div class="lobby">
                <h1>zQuery WebRTC Demo</h1>
                <p class="lead">
                    A mini, no-backend room. Signaling runs over
                    <code>BroadcastChannel</code>, so opening this page in
                    multiple tabs / windows gives you a working mesh call
                    with audio, video, screen share, and chat &mdash; no
                    server required.
                </p>
                <form class="join-form" @submit="join">
                    <label>
                        Room
                        <input type="text" value="${$.escapeHtml(roomName)}" @input="setRoom" placeholder="lobby" />
                    </label>
                    <label>
                        Your name
                        <input type="text" value="${$.escapeHtml(displayName)}" @input="setName" placeholder="display name" />
                    </label>
                    <button type="button" class="primary" @click="join">Join room</button>
                </form>
                <p class="status ${error ? 'error' : ''}">
                    ${error ? $.escapeHtml(error) : $.escapeHtml(status)}
                </p>
            </div>
        `;
    },

    _renderRoom() {
        const { localStream, peers, status, error, micOn, camOn, sharing, messages, draft, displayName, roomName } = this.state;

        const peerCount = peers.length + 1; // include self
        const peerTiles = peers.map((p, i) => `
            <div class="tile">
                <video z-stream="peers[${i}].stream" autoplay playsinline></video>
                <div class="label">${$.escapeHtml(p.name || p.id)}</div>
            </div>
        `).join('');

        const chatLines = messages.map((m) => `
            <div class="msg ${m.mine ? 'mine' : ''}">
                <span class="who">${$.escapeHtml(m.name)}</span>
                <span class="text">${$.escapeHtml(m.text)}</span>
            </div>
        `).join('');

        return `
            <div class="room">
                <aside class="sidebar">
                    <div class="room-meta">
                        <div class="room-name">#${$.escapeHtml(roomName)}</div>
                        <div class="room-sub">${peerCount} ${peerCount === 1 ? 'person' : 'people'}</div>
                    </div>
                    <div class="roster">
                        <div class="roster-row me">
                            <span class="dot ${micOn ? 'on' : 'off'}"></span>
                            ${$.escapeHtml(displayName)} <small>(you)</small>
                        </div>
                        ${peers.map((p) => `
                            <div class="roster-row">
                                <span class="dot on"></span>
                                ${$.escapeHtml(p.name || p.id)}
                            </div>
                        `).join('')}
                    </div>
                    <button class="leave" @click="leave">Leave room</button>
                </aside>

                <section class="stage">
                    <div class="tiles">
                        <div class="tile self">
                            <video z-stream="localStream" autoplay playsinline muted></video>
                            <div class="label">You${sharing ? ' &middot; sharing' : ''}</div>
                            ${!camOn && !sharing ? '<div class="camoff">Camera off</div>' : ''}
                        </div>
                        ${peerTiles}
                    </div>

                    <div class="controls">
                        <button class="${micOn ? '' : 'off'}" @click="toggleMic">
                            ${micOn ? '🎤 Mute' : '🔇 Unmute'}
                        </button>
                        <button class="${camOn ? '' : 'off'}" @click="toggleCam">
                            ${camOn ? '📷 Stop video' : '🚫 Start video'}
                        </button>
                        <button class="${sharing ? 'active' : ''}" @click="toggleShare">
                            ${sharing ? '🛑 Stop share' : '🖥️ Share screen'}
                        </button>
                        <div class="status-inline ${error ? 'error' : ''}">
                            ${error ? $.escapeHtml(error) : $.escapeHtml(status)}
                        </div>
                    </div>
                </section>

                <aside class="chat">
                    <div class="chat-header">Chat</div>
                    <div class="chat-log" id="chat-log">
                        ${chatLines || '<div class="empty">No messages yet. Say hi 👋</div>'}
                    </div>
                    <form class="chat-form" @submit="sendChat">
                        <input type="text" value="${$.escapeHtml(draft)}" @input="setDraft" placeholder="Message #${$.escapeHtml(roomName)}" />
                        <button type="button" class="primary" @click="sendChat">Send</button>
                    </form>
                </aside>
            </div>
        `;
    },

    updated() {
        // Auto-scroll chat to the latest message after each render.
        const log = this.$el && this.$el.querySelector ? this.$el.querySelector('#chat-log') : null;
        if (log) log.scrollTop = log.scrollHeight;
    },
});
