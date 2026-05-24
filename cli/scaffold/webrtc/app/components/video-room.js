// video-room.js - Mini-Discord style room over zero-server signaling.
//
// Joins a real WebRTC mesh room via `$.webrtc.join()` against the
// SignalingHub running in server/index.js. The user picks a room name and
// joins as a viewer first - no camera, no microphone, no screen capture
// runs until they explicitly click a Start button. Each control acquires
// (or releases) exactly the media it owns, so granting "Start mic" never
// turns on the camera and vice-versa.

$.component('video-room', {
    state: () => ({
        // Pre-join form
        roomName:    'lobby',
        displayName: 'User-' + Math.random().toString(36).slice(2, 6),
        // Live state
        joined:      false,
        connecting:  false,
        status:      'Pick a room name and join. The camera and mic stay off until you turn them on.',
        error:       '',
        // Local publishing flags
        micOn:       false,
        camOn:       false,
        micMuted:    false,
        camMuted:    false,
        sharing:     false,
        // Live MediaStream refs (passed through reactive() unchanged because
        // the proxy only wraps plain objects / arrays).
        micStream:    null,
        camStream:    null,
        screenStream: null,
        // Roster (each entry also holds the remote MediaStream for z-stream)
        peers:       [],
        // Chat history
        messages:    [],
        draft:       '',
    }),

    mounted() {
        // Room/data-channel handles live on the instance; MediaStreams live
        // in state so z-stream bindings can resolve them by name.
        this._room        = null;
        this._chat        = null;
        this._cameraTrack = null;
        this._unsubs      = [];
    },

    async destroyed() {
        await this._teardown();
    },

    // ---- Form bindings ---------------------------------------------------

    setRoom(e) { this.setState({ roomName:    e.target.value }); },
    setName(e) { this.setState({ displayName: e.target.value }); },
    setDraft(e) { this.setState({ draft:      e.target.value }); },

    // ---- Join / leave ----------------------------------------------------

    async join(e) {
        if (e && e.preventDefault) e.preventDefault();
        if (this.state.joined || this.state.connecting) return;
        if (!$.webrtc || typeof $.webrtc.join !== 'function') {
            this.setState({ error: '$.webrtc.join is unavailable - build zquery.min.js with the webrtc bundle.' });
            return;
        }

        this.setState({ connecting: true, error: '', status: 'Connecting to signaling server...' });

        try {
            // Pull a fresh join token + the server's preferred ws url.
            const meta = await this._fetchJSON('/rtc/token/' + encodeURIComponent(this.state.roomName));
            const ice  = await this._fetchJSON('/rtc/turn');

            this._room = await $.webrtc.join(meta.wsUrl || this._defaultWsUrl(), {
                room:       this.state.roomName,
                token:      meta.token || undefined,
                iceServers: (ice && ice.iceServers) || undefined,
            });

            this._wireRoom(this._room);

            this.setState({
                joined:     true,
                connecting: false,
                status:     'Joined "' + this.state.roomName + '" as a viewer. Start your mic or camera when ready.',
            });
        } catch (err) {
            this.setState({
                connecting: false,
                error:      'Could not join: ' + (err && err.message ? err.message : String(err)),
            });
        }
    },

    async leave() {
        await this._teardown();
        this.setState({
            joined:       false,
            connecting:   false,
            micOn:        false,
            camOn:        false,
            micMuted:     false,
            camMuted:     false,
            sharing:      false,
            micStream:    null,
            camStream:    null,
            screenStream: null,
            peers:        [],
            messages:     [],
            status:       'Left the room. Click Join to reconnect.',
        });
    },

    async _teardown() {
        for (const off of this._unsubs) { try { off(); } catch (_) {} }
        this._unsubs = [];

        if (this._room) {
            try { await this._room.leave(); } catch (_) {}
            this._room = null;
        }
        // Read raw values to avoid touching the reactive proxy while we
        // shut things down.
        const raw = this.state.__raw || this.state;
        this._stopStream(raw.screenStream);
        this._stopStream(raw.camStream);
        this._stopStream(raw.micStream);
        this._cameraTrack = null;
        this._chat        = null;
    },

    _stopStream(stream) {
        if (!stream) return;
        for (const t of stream.getTracks()) { try { t.stop(); } catch (_) {} }
    },

    // ---- Room wiring ----------------------------------------------------

    _wireRoom(room) {
        // Initial roster snapshot.
        this._refreshPeers(room);

        // Re-render whenever the room's peer map changes.
        this._unsubs.push(room.peers.subscribe(() => this._refreshPeers(room)));

        this._unsubs.push(room.on('peer-joined', ({ peerId }) => {
            this.setState({ status: 'Peer joined: ' + peerId });
            this._refreshPeers(room);
        }));
        this._unsubs.push(room.on('peer-left', ({ peerId }) => {
            this.setState({ status: 'Peer left: ' + peerId });
            this._refreshPeers(room);
        }));
        this._unsubs.push(room.on('error', (err) => {
            this.setState({ error: String(err && err.message || err) });
        }));

        // Multiplexed text-chat data channel - opens on every peer.
        this._chat = room.dataChannel('chat');
        this._unsubs.push(this._chat.on('message', (raw, peerId) => {
            try {
                const msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
                this._appendChat({ from: peerId, name: msg.name || peerId, text: String(msg.text || ''), mine: false });
            } catch (_) { /* ignore malformed */ }
        }));
    },

    _refreshPeers(room) {
        const list = [];
        const map = room.peers.peek();
        for (const info of map.values()) {
            list.push({ id: info.id, name: info.id, stream: info.stream });
        }
        this.setState({ peers: list });
    },

    // ---- Mic ------------------------------------------------------------

    async startMic() {
        if (this.state.micStream || !this._room) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            await this._room.publish(stream);
            this.setState({ micStream: stream, micOn: true, micMuted: false, error: '', status: 'Microphone is live.' });
        } catch (err) {
            this.setState({ error: 'Microphone denied or unavailable.' });
        }
    },

    async stopMic() {
        const stream = this.state.micStream;
        if (!stream || !this._room) return;
        try { await this._room.unpublish(stream); } catch (_) {}
        this._stopStream(stream);
        this.setState({ micStream: null, micOn: false, micMuted: false, status: 'Microphone stopped.' });
    },

    toggleMute() {
        const stream = this.state.micStream;
        if (!stream) return;
        const next = !this.state.micMuted;
        for (const t of stream.getAudioTracks()) t.enabled = !next;
        this.setState({ micMuted: next });
    },

    // ---- Camera ---------------------------------------------------------

    async startCam() {
        if (this.state.camStream || !this._room) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            this._cameraTrack = stream.getVideoTracks()[0] || null;
            await this._room.publish(stream);
            this.setState({ camStream: stream, camOn: true, camMuted: false, error: '', status: 'Camera is live.' });
        } catch (err) {
            this.setState({ error: 'Camera denied or unavailable.' });
        }
    },

    async stopCam() {
        const stream = this.state.camStream;
        if (!stream || !this._room) return;
        if (this.state.sharing) await this.stopShare();
        try { await this._room.unpublish(stream); } catch (_) {}
        this._stopStream(stream);
        this._cameraTrack = null;
        this.setState({ camStream: null, camOn: false, camMuted: false, status: 'Camera stopped.' });
    },

    toggleCamMute() {
        const stream = this.state.camStream;
        if (!stream) return;
        const next = !this.state.camMuted;
        for (const t of stream.getVideoTracks()) t.enabled = !next;
        this.setState({ camMuted: next });
    },

    // ---- Screen share ---------------------------------------------------

    async startShare() {
        if (this.state.sharing || !this._room) return;
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
            this.setState({ error: 'Screen capture is not supported in this browser.' });
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            const track  = stream.getVideoTracks()[0];
            if (!track) throw new Error('No video track from getDisplayMedia');
            // Native browser "Stop sharing" button.
            track.onended = () => { if (this.state.sharing) this.stopShare(); };
            await this._room.publish(stream);
            this.setState({ screenStream: stream, sharing: true, error: '', status: 'Sharing your screen.' });
        } catch (err) {
            this.setState({ error: 'Screen share denied or unavailable.' });
        }
    },

    async stopShare() {
        const stream = this.state.screenStream;
        if (!stream) return;
        try { await this._room.unpublish(stream); } catch (_) {}
        this._stopStream(stream);
        this.setState({ screenStream: null, sharing: false, status: 'Stopped sharing screen.' });
    },

    // ---- Chat -----------------------------------------------------------

    sendChat(e) {
        if (e && e.preventDefault) e.preventDefault();
        const text = (this.state.draft || '').trim();
        if (!text || !this._chat) return;
        const payload = JSON.stringify({ name: this.state.displayName, text });
        try { this._chat.send(payload); } catch (_) {}
        this._appendChat({ from: 'me', name: this.state.displayName, text, mine: true });
        this.setState({ draft: '' });
    },

    _appendChat(msg) {
        const next = this.state.messages.concat([msg]);
        if (next.length > 200) next.splice(0, next.length - 200);
        this.setState({ messages: next });
    },

    // ---- Helpers --------------------------------------------------------

    async _fetchJSON(url) {
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(url + ' → HTTP ' + res.status);
        return res.json();
    },

    _defaultWsUrl() {
        if (typeof location === 'undefined') return 'ws://localhost:3000/rtc';
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        return proto + '//' + location.host + '/rtc';
    },

    // ---- Render ---------------------------------------------------------

    render() {
        if (!this.state.joined) return this._renderLobby();
        return this._renderRoom();
    },

    _renderLobby() {
        const { roomName, displayName, status, error, connecting } = this.state;
        return `
            <div class="lobby">
                <h1>zQuery WebRTC Demo</h1>
                <p class="lead">
                    Mesh video call powered by
                    <code>$.webrtc.join()</code> against a
                    <a href="https://github.com/tonywied17/zero-server" target="_blank" rel="noopener">zero-server</a>
                    <code>SignalingHub</code>. Open this page on a second device
                    (or in another browser) and join the same room to see a peer
                    appear.
                </p>
                <p class="lead">
                    <strong>Camera and microphone are off by default.</strong>
                    Join the room first; then turn on the devices you actually
                    want to share.
                </p>
                <form class="join-form" @submit="join">
                    <label>
                        Room
                        <input type="text" value="${$.escapeHtml(roomName)}" @input="setRoom" placeholder="lobby" ${connecting ? 'disabled' : ''} />
                    </label>
                    <label>
                        Your name
                        <input type="text" value="${$.escapeHtml(displayName)}" @input="setName" placeholder="display name" ${connecting ? 'disabled' : ''} />
                    </label>
                    <button type="submit" class="primary" ${connecting ? 'disabled' : ''}>
                        ${connecting ? 'Joining...' : 'Join room'}
                    </button>
                </form>
                <p class="status ${error ? 'error' : ''}">
                    ${error ? $.escapeHtml(error) : $.escapeHtml(status)}
                </p>
            </div>
        `;
    },

    _renderRoom() {
        const {
            peers, status, error, displayName, roomName,
            micOn, camOn, micMuted, camMuted, sharing, messages, draft,
        } = this.state;

        const peerCount = peers.length + 1;
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

        // Self-tile prefers the screen stream when sharing, else the camera.
        const selfBinding = sharing ? 'screenStream' : 'camStream';

        return `
            <div class="room">
                <aside class="sidebar">
                    <div class="room-meta">
                        <div class="room-name">#${$.escapeHtml(roomName)}</div>
                        <div class="room-sub">${peerCount} ${peerCount === 1 ? 'person' : 'people'}</div>
                    </div>
                    <div class="roster">
                        <div class="roster-row me">
                            <span class="dot ${micOn && !micMuted ? 'on' : 'off'}"></span>
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
                            ${camOn || sharing
                                ? `<video z-stream="${selfBinding}" autoplay playsinline muted></video>`
                                : '<div class="camoff">Camera off</div>'}
                            <div class="label">You${sharing ? ' · sharing' : ''}${camMuted ? ' · paused' : ''}</div>
                        </div>
                        ${peerTiles}
                    </div>

                    <div class="controls">
                        ${micOn
                            ? `<button class="${micMuted ? 'off' : ''}" @click="toggleMute">${micMuted ? '🔇 Unmute' : '🎤 Mute'}</button>
                               <button class="off" @click="stopMic">⏹ Stop mic</button>`
                            : `<button class="primary" @click="startMic">🎤 Start mic</button>`}

                        ${camOn
                            ? `<button class="${camMuted ? 'off' : ''}" @click="toggleCamMute">${camMuted ? '🚫 Resume' : '📷 Pause'}</button>
                               <button class="off" @click="stopCam">⏹ Stop camera</button>`
                            : `<button class="primary" @click="startCam">📷 Start camera</button>`}

                        ${sharing
                            ? `<button class="active" @click="stopShare">🛑 Stop sharing</button>`
                            : `<button @click="startShare">🖥️ Share screen</button>`}

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
                        <button type="submit" class="primary">Send</button>
                    </form>
                </aside>
            </div>
        `;
    },

    updated() {
        // Auto-scroll chat to the latest message after each render.
        const log = this._el && this._el.querySelector ? this._el.querySelector('#chat-log') : null;
        if (log) log.scrollTop = log.scrollHeight;
    },
});
