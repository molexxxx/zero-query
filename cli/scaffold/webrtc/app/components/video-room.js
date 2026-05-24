// video-room.js - Polished WebRTC room over zero-server signaling.
//
// Joins a real mesh room via `$.webrtc.join()` against the SignalingHub in
// server/index.js. Camera, microphone, and screen capture each stay off
// until the user explicitly turns them on. Presence metadata is broadcast
// over a dedicated data channel so the UI can split each peer's combined
// MediaStream into separate camera and screen streams - that's what lets
// us promote a screen share to the full stage while keeping cameras as
// thumbnails alongside it.

$.component('video-room', {
    state: () => ({
        // Pre-join form
        roomName:    'lobby',
        displayName: 'User-' + Math.random().toString(36).slice(2, 6),

        // Lifecycle
        joined:      false,
        connecting:  false,
        status:      'Pick a room name and join. Your camera and mic stay off until you turn them on.',
        error:       '',

        // Local publishing flags
        micOn:       false,
        camOn:       false,
        micMuted:    false,
        camMuted:    false,
        sharing:     false,
        shareAudio:  false, // true when getDisplayMedia delivered an audio track

        // Live MediaStream refs (kept on state so z-stream can bind them).
        micStream:    null,
        camStream:    null,
        screenStream: null,

        // Peer roster - each entry exposes derived `camStream` / `screenStream`
        // MediaStream objects that the UI binds with z-stream.
        peers:       [],

        // Pinning: when set, that tile takes the full stage regardless of
        // how many screens / cams are active. id is 'me' or a peerId, kind
        // is 'screen' or 'cam'.
        pinned:      null, // { id, kind } | null

        // Chat
        messages:    [],
        draft:       '',

        // Pre-join device availability hints
        hasMic:      true,
        hasCam:      true,
        hasShare:    true,
    }),

    mounted() {
        this._room        = null;
        this._chat        = null;
        this._presence    = null;
        this._unsubs      = [];

        // peerId -> { name, micOn, micMuted, camOn, camMuted, sharing,
        //             camTrackId, screenTrackIds:[], screenAudioTrackIds:[] }
        this._presenceMap = new Map();

        // peerId -> { camStream, screenStream } (cached so MediaStream
        // identity is stable across re-renders).
        this._peerStreams = new Map();

        this._probeDevices();
    },

    async destroyed() {
        await this._teardown();
    },

    // ---- Form bindings ---------------------------------------------------

    setRoom(e)  { this.setState({ roomName:    e.target.value }); },
    setName(e)  { this.setState({ displayName: e.target.value }); },
    setDraft(e) { this.setState({ draft:       e.target.value }); },

    // ---- Pre-join device probe ------------------------------------------

    async _probeDevices() {
        try {
            if (!navigator.mediaDevices || typeof navigator.mediaDevices.enumerateDevices !== 'function') return;
            const devs = await navigator.mediaDevices.enumerateDevices();
            const hasMic = devs.some((d) => d.kind === 'audioinput');
            const hasCam = devs.some((d) => d.kind === 'videoinput');
            const hasShare = typeof navigator.mediaDevices.getDisplayMedia === 'function';
            this.setState({ hasMic, hasCam, hasShare });
        } catch (_) { /* non-fatal */ }
    },

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
            const meta = await this._fetchJSON('/rtc/token/' + encodeURIComponent(this.state.roomName));
            const ice  = await this._fetchJSON('/rtc/turn').catch(() => null);

            this._room = await $.webrtc.join(meta.wsUrl || this._defaultWsUrl(), {
                room:       this.state.roomName,
                token:      meta.token || undefined,
                iceServers: (ice && ice.iceServers) || undefined,
            });

            this._wireRoom(this._room);

            this.setState({
                joined:     true,
                connecting: false,
                status:     'Joined "' + this.state.roomName + '" as a viewer. Turn on the devices you actually want to share.',
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
            shareAudio:   false,
            micStream:    null,
            camStream:    null,
            screenStream: null,
            peers:        [],
            messages:     [],
            pinned:       null,
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
        const raw = this.state.__raw || this.state;
        this._stopStream(raw.screenStream);
        this._stopStream(raw.camStream);
        this._stopStream(raw.micStream);
        this._presenceMap.clear();
        this._peerStreams.clear();
        this._chat     = null;
        this._presence = null;
    },

    _stopStream(stream) {
        if (!stream) return;
        for (const t of stream.getTracks()) { try { t.stop(); } catch (_) {} }
    },

    // ---- Room wiring ----------------------------------------------------

    _wireRoom(room) {
        this._unsubs.push(room.peers.subscribe(() => this._refreshPeers(room)));

        this._unsubs.push(room.on('peer-joined', ({ peerId }) => {
            this.setState({ status: 'Peer joined: ' + peerId });
            this._refreshPeers(room);
            // Catch the new peer up on our current state.
            this._publishPresence();
        }));
        this._unsubs.push(room.on('peer-left', ({ peerId }) => {
            this._presenceMap.delete(peerId);
            this._peerStreams.delete(peerId);
            if (this.state.pinned && this.state.pinned.id === peerId) {
                this.setState({ pinned: null });
            }
            this.setState({ status: 'Peer left: ' + peerId });
            this._refreshPeers(room);
        }));
        this._unsubs.push(room.on('error', (err) => {
            this.setState({ error: String(err && err.message || err) });
        }));

        // Text chat channel.
        this._chat = room.dataChannel('chat');
        this._unsubs.push(this._chat.on('message', (raw, peerId) => {
            try {
                const msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
                this._appendChat({
                    from: peerId,
                    name: msg.name || this._displayNameOf(peerId),
                    text: String(msg.text || ''),
                    mine: false,
                });
            } catch (_) { /* ignore malformed */ }
        }));

        // Presence channel - lets every peer announce which tracks belong
        // to its camera vs. its screen share, plus mic/cam mute state.
        this._presence = room.dataChannel('presence');
        this._unsubs.push(this._presence.on('message', (raw, peerId) => {
            try {
                const msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
                if (!msg || msg.type !== 'presence') return;
                this._presenceMap.set(peerId, {
                    name:                String(msg.name || peerId),
                    micOn:               !!msg.micOn,
                    micMuted:            !!msg.micMuted,
                    camOn:               !!msg.camOn,
                    camMuted:            !!msg.camMuted,
                    sharing:             !!msg.sharing,
                    shareAudio:          !!msg.shareAudio,
                    camTrackId:          msg.camTrackId || null,
                    screenTrackIds:      Array.isArray(msg.screenTrackIds) ? msg.screenTrackIds.slice() : [],
                    screenAudioTrackIds: Array.isArray(msg.screenAudioTrackIds) ? msg.screenAudioTrackIds.slice() : [],
                });
                this._refreshPeers(this._room);
            } catch (_) { /* ignore malformed */ }
        }));

        this._refreshPeers(room);
    },

    _displayNameOf(peerId) {
        const p = this._presenceMap.get(peerId);
        return (p && p.name) || peerId;
    },

    _publishPresence() {
        if (!this._presence) return;
        const raw          = this.state.__raw || this.state;
        const camTrack     = raw.camStream    ? (raw.camStream.getVideoTracks()[0]    || null) : null;
        const screenTracks = raw.screenStream ? raw.screenStream.getVideoTracks() : [];
        const screenAudio  = raw.screenStream ? raw.screenStream.getAudioTracks() : [];
        const payload = {
            type:                'presence',
            name:                raw.displayName,
            micOn:               raw.micOn,
            micMuted:            raw.micMuted,
            camOn:               raw.camOn,
            camMuted:            raw.camMuted,
            sharing:             raw.sharing,
            shareAudio:          raw.shareAudio,
            camTrackId:          camTrack ? camTrack.id : null,
            screenTrackIds:      screenTracks.map((t) => t.id),
            screenAudioTrackIds: screenAudio.map((t) => t.id),
        };
        try { this._presence.send(JSON.stringify(payload)); } catch (_) {}
    },

    // ---- Peer reconciliation --------------------------------------------

    _refreshPeers(room) {
        if (!room) { this.setState({ peers: [] }); return; }
        const list = [];
        for (const info of room.peers.peek().values()) {
            list.push(this._derivePeerView(info));
        }
        // Drop cached entries for peers that vanished.
        for (const id of Array.from(this._peerStreams.keys())) {
            if (!list.some((p) => p.id === id)) this._peerStreams.delete(id);
        }
        this.setState({ peers: list });
    },

    _derivePeerView(info) {
        const presence = this._presenceMap.get(info.id) || null;
        const cache    = this._peerStreams.get(info.id) || { camStream: this._newStream(), screenStream: this._newStream() };
        this._peerStreams.set(info.id, cache);

        const tracks   = (info.stream && typeof info.stream.getTracks === 'function')
            ? info.stream.getTracks()
            : [];

        // Classify each remote track using the latest presence hints. When
        // presence hasn't arrived yet we fall back to "first video = cam".
        const want = { cam: new Set(), screen: new Set() };
        let fallbackCamSeen = false;
        for (const t of tracks) {
            if (presence) {
                if (presence.screenTrackIds.indexOf(t.id) !== -1)        want.screen.add(t);
                else if (presence.screenAudioTrackIds.indexOf(t.id) !== -1) want.screen.add(t);
                else if (t.id === presence.camTrackId)                   want.cam.add(t);
                else if (t.kind === 'audio')                             want.cam.add(t); // mic
                else                                                     want.cam.add(t);
            } else {
                if (t.kind === 'video' && !fallbackCamSeen)  { want.cam.add(t); fallbackCamSeen = true; }
                else if (t.kind === 'video')                 { want.screen.add(t); }
                else                                         { want.cam.add(t); }
            }
        }

        this._syncStreamTracks(cache.camStream,    want.cam);
        this._syncStreamTracks(cache.screenStream, want.screen);

        const hasCamVideo    = cache.camStream.getVideoTracks().length    > 0;
        const hasScreenVideo = cache.screenStream.getVideoTracks().length > 0;

        return {
            id:           info.id,
            name:         presence ? presence.name : info.id,
            micOn:        presence ? presence.micOn        : cache.camStream.getAudioTracks().length > 0,
            micMuted:     presence ? presence.micMuted     : false,
            camOn:        presence ? presence.camOn        : hasCamVideo,
            camMuted:     presence ? presence.camMuted     : false,
            sharing:      presence ? presence.sharing      : hasScreenVideo,
            shareAudio:   presence ? presence.shareAudio   : false,
            connection:   info.connection || 'connected',
            camStream:    hasCamVideo    ? cache.camStream    : null,
            screenStream: hasScreenVideo ? cache.screenStream : null,
            hasAudio:     cache.camStream.getAudioTracks().length > 0,
        };
    },

    _syncStreamTracks(stream, wanted) {
        const current = new Set(stream.getTracks());
        for (const t of current) {
            if (!wanted.has(t)) { try { stream.removeTrack(t); } catch (_) {} }
        }
        for (const t of wanted) {
            if (!current.has(t)) { try { stream.addTrack(t); } catch (_) {} }
        }
    },

    _newStream() {
        try { return new MediaStream(); }
        catch (_) { return { _tracks: [], getTracks() { return this._tracks.slice(); }, getVideoTracks() { return this._tracks.filter(t => t.kind==='video'); }, getAudioTracks() { return this._tracks.filter(t => t.kind==='audio'); }, addTrack(t){ this._tracks.push(t); }, removeTrack(t){ const i=this._tracks.indexOf(t); if(i>=0) this._tracks.splice(i,1); } }; }
    },

    // ---- Mic ------------------------------------------------------------

    async startMic() {
        if (this.state.micStream || !this._room) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            await this._room.publish(stream);
            this.setState({ micStream: stream, micOn: true, micMuted: false, error: '', status: 'Microphone is live.' });
            this._publishPresence();
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
        this._publishPresence();
    },

    toggleMute() {
        const stream = this.state.micStream;
        if (!stream) return;
        const next = !this.state.micMuted;
        for (const t of stream.getAudioTracks()) t.enabled = !next;
        this.setState({ micMuted: next });
        this._publishPresence();
    },

    // ---- Camera ---------------------------------------------------------

    async startCam() {
        if (this.state.camStream || !this._room) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            });
            await this._room.publish(stream);
            this.setState({ camStream: stream, camOn: true, camMuted: false, error: '', status: 'Camera is live.' });
            this._publishPresence();
        } catch (err) {
            this.setState({ error: 'Camera denied or unavailable.' });
        }
    },

    async stopCam() {
        const stream = this.state.camStream;
        if (!stream || !this._room) return;
        try { await this._room.unpublish(stream); } catch (_) {}
        this._stopStream(stream);
        if (this.state.pinned && this.state.pinned.id === 'me' && this.state.pinned.kind === 'cam') {
            this.setState({ pinned: null });
        }
        this.setState({ camStream: null, camOn: false, camMuted: false, status: 'Camera stopped.' });
        this._publishPresence();
    },

    toggleCamMute() {
        const stream = this.state.camStream;
        if (!stream) return;
        const next = !this.state.camMuted;
        for (const t of stream.getVideoTracks()) t.enabled = !next;
        this.setState({ camMuted: next });
        this._publishPresence();
    },

    // ---- Screen share ---------------------------------------------------

    async startShare() {
        if (this.state.sharing || !this._room) return;
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
            this.setState({ error: 'Screen capture is not supported in this browser.' });
            return;
        }
        try {
            // Browsers that honour these hints will present an audio-capture
            // checkbox in the picker (Chromium asks "Share tab audio" / "Share
            // system audio"). Firefox + Safari silently ignore the audio flag
            // for full-screen captures and return video only - that's fine.
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video:        { frameRate: { ideal: 30 }, displaySurface: 'monitor' },
                audio:        true,
                systemAudio:  'include',
                selfBrowserSurface: 'exclude',
                surfaceSwitching:   'include',
            });
            const videoTrack = stream.getVideoTracks()[0];
            if (!videoTrack) throw new Error('No video track from getDisplayMedia');

            // Native browser "Stop sharing" hand-off.
            videoTrack.onended = () => { if (this.state.sharing) this.stopShare(); };

            await this._room.publish(stream);
            const shareAudio = stream.getAudioTracks().length > 0;
            this.setState({
                screenStream: stream,
                sharing:      true,
                shareAudio,
                error:        '',
                status:       shareAudio ? 'Sharing screen with audio.' : 'Sharing screen (video only).',
                // Auto-pin our own share to the main stage for the host;
                // viewers will still see whatever sharer is pinned for them.
                pinned:       { id: 'me', kind: 'screen' },
            });
            this._publishPresence();
        } catch (err) {
            // User cancelling the picker throws NotAllowedError - keep quiet.
            const benign = err && (err.name === 'NotAllowedError' || err.name === 'AbortError');
            if (!benign) this.setState({ error: 'Screen share denied or unavailable.' });
        }
    },

    async stopShare() {
        const stream = this.state.screenStream;
        if (!stream) return;
        try { await this._room.unpublish(stream); } catch (_) {}
        this._stopStream(stream);
        if (this.state.pinned && this.state.pinned.id === 'me' && this.state.pinned.kind === 'screen') {
            this.setState({ pinned: null });
        }
        this.setState({
            screenStream: null,
            sharing:      false,
            shareAudio:   false,
            status:       'Stopped sharing screen.',
        });
        this._publishPresence();
    },

    // ---- Pinning --------------------------------------------------------

    pinTile(id, kind) {
        const cur = this.state.pinned;
        if (cur && cur.id === id && cur.kind === kind) {
            this.setState({ pinned: null });
        } else {
            this.setState({ pinned: { id, kind } });
        }
    },

    unpin() { this.setState({ pinned: null }); },

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
        const next = this.state.messages.concat([Object.assign({ at: Date.now() }, msg)]);
        if (next.length > 200) next.splice(0, next.length - 200);
        this.setState({ messages: next });
    },

    // ---- Helpers --------------------------------------------------------

    async _fetchJSON(url) {
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(url + ' HTTP ' + res.status);
        return res.json();
    },

    _defaultWsUrl() {
        if (typeof location === 'undefined') return 'ws://localhost:3000/rtc';
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        return proto + '//' + location.host + '/rtc';
    },

    _formatTime(ts) {
        try {
            const d = new Date(ts);
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            return hh + ':' + mm;
        } catch (_) { return ''; }
    },

    // ---- Tile assembly --------------------------------------------------

    _collectTiles() {
        const { peers, sharing, camOn, camMuted, micOn, micMuted, shareAudio } = this.state;
        const screens = [];
        const cams    = [];

        if (sharing) {
            screens.push({
                id: 'me', kind: 'screen', name: 'You', isSelf: true,
                streamBinding: 'screenStream',
                badges: shareAudio ? ['with audio'] : [],
            });
        }
        if (camOn) {
            cams.push({
                id: 'me', kind: 'cam', name: 'You', isSelf: true,
                streamBinding: 'camStream',
                muted: camMuted, micOn, micMuted,
            });
        }

        peers.forEach((p, i) => {
            if (p.screenStream) {
                screens.push({
                    id: p.id, kind: 'screen', name: p.name, isSelf: false,
                    streamBinding: 'peers[' + i + '].screenStream',
                    badges: p.shareAudio ? ['with audio'] : [],
                });
            }
            if (p.camStream) {
                cams.push({
                    id: p.id, kind: 'cam', name: p.name, isSelf: false,
                    streamBinding: 'peers[' + i + '].camStream',
                    muted: p.camMuted, micOn: p.micOn, micMuted: p.micMuted,
                    connection: p.connection,
                });
            }
        });

        return { screens, cams };
    },

    // ---- Render ---------------------------------------------------------

    render() {
        if (!this.state.joined) return this._renderLobby();
        return this._renderRoom();
    },

    _renderLobby() {
        const { roomName, displayName, status, error, connecting, hasMic, hasCam, hasShare } = this.state;
        const hint = [];
        if (!hasMic)   hint.push('no microphone detected');
        if (!hasCam)   hint.push('no camera detected');
        if (!hasShare) hint.push('screen sharing unavailable in this browser');
        const hintLine = hint.length ? `<div class="device-hint">⚠ ${$.escapeHtml(hint.join(' · '))}</div>` : '';

        return `
            <div class="lobby">
                <h1>zQuery WebRTC Demo</h1>
                <p class="lead">
                    Mesh video call powered by <code>$.webrtc.join()</code> against a
                    <a href="https://github.com/tonywied17/zero-server" target="_blank" rel="noopener">zero-server</a>
                    <code>SignalingHub</code>. Open this page on a second device (or in another
                    browser window) and join the same room to see a peer appear. Each call
                    supports up to a handful of peers in a full mesh; for larger meetings
                    swap in an SFU.
                </p>
                <p class="lead">
                    <strong>Mic, camera, and screen share are off by default.</strong>
                    Join first - then enable the devices you actually want to share.
                    Screen share will prompt you to choose a screen / window / tab and,
                    on Chromium-based browsers, also lets you include tab or system audio.
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
                ${hintLine}
                <p class="status ${error ? 'error' : ''}">
                    ${error ? $.escapeHtml(error) : $.escapeHtml(status)}
                </p>
            </div>
        `;
    },

    _renderRoom() {
        const {
            peers, status, error, displayName, roomName,
            micOn, camOn, micMuted, camMuted, sharing, shareAudio,
            messages, draft, pinned, hasShare,
        } = this.state;

        const peerCount = peers.length + 1;
        const { screens, cams } = this._collectTiles();

        // Decide the layout:
        //   - pinned tile (if any) wins and occupies the main stage solo.
        //   - else if there are screen shares, screens fill the main stage
        //     and cameras drop to a thumbnail strip alongside.
        //   - else cameras tile across the stage.
        let stageMode  = 'cams';     // 'cams' | 'screens' | 'pinned'
        let mainTiles  = [];
        let stripTiles = [];

        const pinTile = pinned
            ? [].concat(screens, cams).find((t) => t.id === pinned.id && t.kind === pinned.kind)
            : null;

        if (pinTile) {
            stageMode  = 'pinned';
            mainTiles  = [pinTile];
            stripTiles = [].concat(screens, cams).filter((t) => t !== pinTile);
        } else if (screens.length > 0) {
            stageMode  = 'screens';
            mainTiles  = screens;
            stripTiles = cams;
        } else {
            stageMode  = 'cams';
            mainTiles  = cams;
            stripTiles = [];
        }

        const mainGrid = mainTiles.length > 0
            ? `<div class="stage-main stage-main-${this._gridClass(mainTiles.length)}">
                  ${mainTiles.map((t) => this._tileHtml(t, 'main')).join('')}
               </div>`
            : `<div class="stage-empty">
                  <div class="empty-title">Nobody is sharing yet</div>
                  <div class="empty-sub">Start your camera or screen share from the controls below.</div>
               </div>`;

        const strip = stripTiles.length > 0
            ? `<div class="stage-strip">
                  ${stripTiles.map((t) => this._tileHtml(t, 'strip')).join('')}
               </div>`
            : '';

        const chatLines = messages.map((m) => `
            <div class="msg ${m.mine ? 'mine' : ''}">
                <div class="msg-head">
                    <span class="who">${$.escapeHtml(m.name)}</span>
                    <span class="when">${$.escapeHtml(this._formatTime(m.at))}</span>
                </div>
                <div class="text">${$.escapeHtml(m.text)}</div>
            </div>
        `).join('');

        return `
            <div class="room ${stageMode === 'screens' || stageMode === 'pinned' ? 'has-focus' : ''}">
                <aside class="sidebar">
                    <div class="room-meta">
                        <div class="room-name">#${$.escapeHtml(roomName)}</div>
                        <div class="room-sub">${peerCount} ${peerCount === 1 ? 'person' : 'people'} · ${screens.length} sharing</div>
                    </div>
                    <div class="roster">
                        <div class="roster-row me">
                            <span class="dot ${micOn && !micMuted ? 'on' : 'off'}"></span>
                            <span class="who">${$.escapeHtml(displayName)} <small>(you)</small></span>
                            <span class="roster-icons">
                                ${micOn ? (micMuted ? '🔇' : '🎤') : ''}
                                ${camOn ? (camMuted ? '🚫' : '📷') : ''}
                                ${sharing ? '🖥️' : ''}
                            </span>
                        </div>
                        ${peers.map((p) => `
                            <div class="roster-row ${p.connection === 'failed' ? 'broken' : ''}">
                                <span class="dot ${p.micOn && !p.micMuted ? 'on' : 'off'}"></span>
                                <span class="who">${$.escapeHtml(p.name || p.id)}</span>
                                <span class="roster-icons">
                                    ${p.micOn ? (p.micMuted ? '🔇' : '🎤') : ''}
                                    ${p.camOn ? (p.camMuted ? '🚫' : '📷') : ''}
                                    ${p.sharing ? '🖥️' : ''}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                    <button class="leave" @click="leave">Leave room</button>
                </aside>

                <section class="stage">
                    <div class="stage-area">
                        ${mainGrid}
                        ${strip}
                    </div>

                    <div class="controls">
                        <div class="ctl-group">
                            ${micOn
                                ? `<button class="${micMuted ? 'off' : ''}" @click="toggleMute" title="${micMuted ? 'Unmute mic' : 'Mute mic'}">${micMuted ? '🔇 Unmute' : '🎤 Mute'}</button>
                                   <button class="off ghost" @click="stopMic" title="Stop microphone">⏹ Mic</button>`
                                : `<button class="primary" @click="startMic">🎤 Start mic</button>`}
                        </div>

                        <div class="ctl-group">
                            ${camOn
                                ? `<button class="${camMuted ? 'off' : ''}" @click="toggleCamMute" title="${camMuted ? 'Resume camera' : 'Pause camera'}">${camMuted ? '🚫 Resume' : '📷 Pause'}</button>
                                   <button class="off ghost" @click="stopCam" title="Stop camera">⏹ Cam</button>`
                                : `<button class="primary" @click="startCam">📷 Start camera</button>`}
                        </div>

                        <div class="ctl-group">
                            ${sharing
                                ? `<button class="active" @click="stopShare" title="Stop screen share">🛑 Stop sharing${shareAudio ? ' (with audio)' : ''}</button>`
                                : `<button @click="startShare" ${hasShare ? '' : 'disabled'} title="${hasShare ? 'Share a screen, window or tab (audio capture optional)' : 'Screen share unsupported here'}">🖥️ Share screen</button>`}
                        </div>

                        ${pinned ? `<button class="ghost" @click="unpin" title="Unpin focused tile">📌 Unpin</button>` : ''}

                        <div class="status-inline ${error ? 'error' : ''}">
                            ${error ? $.escapeHtml(error) : $.escapeHtml(status)}
                        </div>
                    </div>
                </section>

                <aside class="chat">
                    <div class="chat-header">Chat · ${messages.length}</div>
                    <div class="chat-log" id="chat-log">
                        ${chatLines || '<div class="empty">No messages yet. Say hi 👋</div>'}
                    </div>
                    <form class="chat-form" @submit="sendChat">
                        <input type="text" value="${$.escapeHtml(draft)}" @input="setDraft" placeholder="Message #${$.escapeHtml(roomName)}" maxlength="500" />
                        <button type="submit" class="primary">Send</button>
                    </form>
                </aside>
            </div>
        `;
    },

    _gridClass(n) {
        if (n <= 1) return '1';
        if (n === 2) return '2';
        if (n <= 4) return '4';
        if (n <= 6) return '6';
        return '9';
    },

    _tileHtml(t, slot) {
        const isScreen = t.kind === 'screen';
        const audioAttr = t.isSelf ? 'muted' : '';
        const cls = [
            'tile',
            'tile-' + slot,
            'tile-' + t.kind,
            t.isSelf ? 'self' : '',
            t.muted ? 'muted-video' : '',
            slot === 'strip' ? 'thumb' : '',
        ].filter(Boolean).join(' ');

        const overlay = t.muted && !isScreen
            ? `<div class="camoff">Camera paused</div>`
            : '';

        const micChip = (!isScreen && t.micOn !== undefined)
            ? `<span class="chip ${t.micMuted ? 'chip-off' : 'chip-on'}">${t.micMuted ? '🔇' : '🎤'}</span>`
            : '';

        const audioChip = (isScreen && t.badges && t.badges.length)
            ? `<span class="chip chip-on">🔊</span>`
            : '';

        const label = `<div class="label">
            <span class="label-name">${$.escapeHtml(t.name)}${t.isSelf ? '' : ''}</span>
            ${micChip}${audioChip}
            ${isScreen ? '<span class="chip chip-screen">🖥️</span>' : ''}
        </div>`;

        const pinBtn = `<button class="pin-btn" @click="pinTile('${t.id}', '${t.kind}')" title="Pin to focus">📌</button>`;

        return `
            <div class="${cls}">
                <video z-stream="${t.streamBinding}" autoplay playsinline ${audioAttr}></video>
                ${overlay}
                ${label}
                ${pinBtn}
            </div>
        `;
    },

    updated() {
        const log = this._el && this._el.querySelector ? this._el.querySelector('#chat-log') : null;
        if (log) log.scrollTop = log.scrollHeight;
    },
});
