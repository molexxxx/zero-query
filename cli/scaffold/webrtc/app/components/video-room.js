// video-room.js - One-page WebRTC room demo using $.webrtc.
//
// Defaults assume a local zero-server WebRTC hub at ws://localhost:3000/rtc.
// Override via the input field at the top of the page.

$.component('video-room', {
    state: () => ({
        url: 'ws://localhost:3000/rtc',
        room: 'demo',
        user: 'user-' + Math.floor(Math.random() * 10_000),
        status: 'Idle. Enter a signaling URL + room and click Join.',
        error: '',
        peers: [],
        connected: false,
    }),

    async mounted() {
        // Pre-populate the room handle so we can clean up on destroy.
        this._room        = null;
        this._localStream = null;
        this._unsubPeers  = null;
    },

    async destroyed() {
        await this._leave();
    },

    async join() {
        if (this.state.connected) return;
        this.setState({ status: 'Requesting camera + microphone...', error: '' });
        try {
            this._localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        } catch (err) {
            this.setState({ status: 'getUserMedia failed', error: String(err && err.message || err) });
            return;
        }

        this.setState({ status: 'Connecting to ' + this.state.url + ' ...' });
        try {
            this._room = await $.webrtc.join(this.state.url, {
                room:   this.state.room,
                user:   { id: this.state.user },
                tracks: this._localStream.getTracks(),
            });
        } catch (err) {
            await this._stopLocal();
            this.setState({ status: 'join() failed', error: err.code ? `${err.code}: ${err.message}` : String(err) });
            return;
        }

        // Track peer roster — re-render every time it changes.
        const peers = this._room.peers;
        const refresh = () => this.setState({ peers: peers.value, status: 'Connected as ' + this.state.user });
        this._unsubPeers = peers.subscribe(refresh);
        refresh();

        this.setState({ connected: true });
    },

    async leave() {
        await this._leave();
        this.setState({ connected: false, peers: [], status: 'Left the room.' });
    },

    async _leave() {
        if (this._unsubPeers) { try { this._unsubPeers(); } catch (_) {} this._unsubPeers = null; }
        if (this._room)       { try { await this._room.leave(); } catch (_) {} this._room = null; }
        await this._stopLocal();
    },

    async _stopLocal() {
        if (!this._localStream) return;
        for (const t of this._localStream.getTracks()) { try { t.stop(); } catch (_) {} }
        this._localStream = null;
    },

    setUrl(e)  { this.setState({ url:  e.target.value }); },
    setRoom(e) { this.setState({ room: e.target.value }); },
    setUser(e) { this.setState({ user: e.target.value }); },

    render() {
        const { url, room, user, status, error, peers, connected } = this.state;

        const peerTiles = peers.map((p) => `
            <div class="tile">
                <video z-stream="${p.id}" autoplay playsinline></video>
                <div class="label">${$.escapeHtml(p.id)}</div>
            </div>
        `).join('');

        return `
            <div class="controls">
                <input type="text"  value="${$.escapeHtml(url)}"  @input="setUrl"  placeholder="ws://localhost:3000/rtc" />
                <input type="text"  value="${$.escapeHtml(room)}" @input="setRoom" placeholder="room" />
                <input type="text"  value="${$.escapeHtml(user)}" @input="setUser" placeholder="user id" />
                ${connected
                    ? '<button class="leave" @click="leave">Leave</button>'
                    : '<button @click="join">Join</button>'}
            </div>

            <div class="status ${error ? 'error' : ''}">
                ${error ? $.escapeHtml(error) : $.escapeHtml(status)}
            </div>

            <div class="tiles">
                <div class="tile">
                    <video id="local-video" autoplay playsinline muted></video>
                    <div class="label">You (${$.escapeHtml(user)})</div>
                </div>
                ${peerTiles}
            </div>
        `;
    },

    updated() {
        // Bind the local stream to the local <video> tile after each render.
        if (this._localStream) {
            const el = this.$el && this.$el.querySelector ? this.$el.querySelector('#local-video') : null;
            if (el && el.srcObject !== this._localStream) {
                el.srcObject = this._localStream;
            }
        }
    },
});
