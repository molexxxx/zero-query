/**
 * tests/_helpers/webrtcFakes.js - shared fakes for WebRTC tests
 *
 * No external deps. Designed to be drop-in compatible with the global
 * `WebSocket` API where it matters for the signaling client:
 *   - `onopen`, `onmessage`, `onerror`, `onclose`
 *   - `send(data)`
 *   - `close(code, reason)`
 *
 * Instances expose helpers for tests to drive the fake's state:
 *   `fakeOpen()`, `fakeMessage(payload)`, `fakeClose(code, reason)`, etc.
 * All `send()` calls are buffered into `sendCalls` for assertion.
 */

 

/** Active fake-socket instances, in construction order. Cleared per-test by callers. */
export const fakeSockets = [];


/**
 * Reset the shared fake-socket registry between tests.
 */
export function resetFakeSockets() {
    fakeSockets.length = 0;
}


/**
 * Minimal stand-in for the global `WebSocket` API. Pass the class itself
 * (not an instance) to `new SignalingClient(url, { WebSocket: FakeWebSocket })`.
 */
export class FakeWebSocket {
    /**
     * @param {string} url
     */
    constructor(url) {
        this.url       = url;
        this.readyState = 0; // CONNECTING
        this.onopen    = null;
        this.onmessage = null;
        this.onerror   = null;
        this.onclose   = null;
        this.sendCalls = [];
        this.closeCalls = [];
        fakeSockets.push(this);
    }

    /** Capture an outbound frame. */
    send(data) {
        this.sendCalls.push(data);
    }

    /** Mimic `WebSocket.close()` and immediately fire `onclose`. */
    close(code = 1000, reason = '') {
        this.closeCalls.push({ code, reason });
        this.readyState = 3; // CLOSED
        if (typeof this.onclose === 'function') {
            this.onclose({ code, reason, wasClean: code === 1000 });
        }
    }

    // ----- Test-side drivers -----------------------------------------------

    /** Mark the socket open and fire `onopen`. */
    fakeOpen() {
        this.readyState = 1; // OPEN
        if (typeof this.onopen === 'function') this.onopen({});
    }

    /**
     * Deliver a message. Accepts an object (auto-JSON-stringified) or a string.
     * @param {*} payload
     */
    fakeMessage(payload) {
        const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
        if (typeof this.onmessage === 'function') this.onmessage({ data });
    }

    /** Fire `onerror`. */
    fakeError(event = {}) {
        if (typeof this.onerror === 'function') this.onerror(event);
    }

    /** Fire `onclose` without sending a server close - simulates abrupt disconnect. */
    fakeClose(code = 1006, reason = 'abnormal') {
        this.readyState = 3;
        if (typeof this.onclose === 'function') {
            this.onclose({ code, reason, wasClean: code === 1000 });
        }
    }

    /** Convenience: return parsed JSON frames sent by the client. */
    get sentFrames() {
        return this.sendCalls.map((d) => {
            try { return JSON.parse(d); }
            catch (_) { return d; }
        });
    }
}


// ---------------------------------------------------------------------------
// RTCPeerConnection fake (for tests/webrtc/peer.test.js etc.)
// ---------------------------------------------------------------------------

/**
 * Minimum-valid SDP that satisfies the server's strict validator
 * (UDP/TLS/RTP/SAVPF + ice-ufrag + ice-pwd + sha-256 fingerprint).
 * Verbatim copy of `test/webrtc/bot.test.js` MIN_SDP in zero-http-npm.
 */
export const MIN_SDP = [
    'v=0', 'o=- 1 2 IN IP4 127.0.0.1', 's=-', 't=0 0',
    'm=audio 9 UDP/TLS/RTP/SAVPF 111',
    'a=ice-ufrag:abcd', 'a=ice-pwd:0123456789abcdef0123456789',
    'a=fingerprint:sha-256 AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99',
    'a=setup:actpass', 'a=mid:0', 'a=sendrecv', 'a=rtpmap:111 opus/48000/2',
].join('\r\n') + '\r\n';


/** Active fake RTCPeerConnections, in construction order. */
export const fakePeerConnections = [];


/** Reset the shared fake-PC registry between tests. */
export function resetFakePeerConnections() {
    fakePeerConnections.length = 0;
}


/**
 * Scriptable stand-in for the browser `RTCPeerConnection`. Records every
 * operation and exposes `_fire*()` helpers so tests can drive the
 * negotiation state machine deterministically.
 *
 * Pass the class itself to `new Peer(id, signaling, { RTCPeerConnection: FakeRTCPeerConnection })`.
 */
export class FakeRTCPeerConnection {
    /**
     * @param {RTCConfiguration} [config]
     */
    constructor(config = {}) {
        this.config         = config;
        this.signalingState = 'stable';
        this.connectionState = 'new';
        this.iceConnectionState = 'new';
        this.localDescription  = null;
        this.remoteDescription = null;

        this.onnegotiationneeded     = null;
        this.onicecandidate          = null;
        this.ontrack                 = null;
        this.ondatachannel           = null;
        this.onconnectionstatechange = null;

        // Spies / counters
        this.addTrackCalls       = [];
        this.removeTrackCalls    = [];
        this.dataChannelCalls    = [];
        this.addIceCandidateCalls = [];
        this.restartIceCount     = 0;
        this.setLocalCalls       = 0;
        this.setRemoteCalls      = [];
        this.closeCalls          = 0;

        // Test hooks
        this.failNextSetLocal  = null; // Error|null
        this.failNextSetRemote = null;
        this.failNextAddIce    = null;

        fakePeerConnections.push(this);
    }

    // --- Spec surface ------------------------------------------------------

    addTrack(track, ...streams) {
        const sender = { track, streams, replaceTrack: () => {}, getStats: async () => new Map() };
        this.addTrackCalls.push(sender);
        return sender;
    }

    removeTrack(sender) {
        this.removeTrackCalls.push(sender);
    }

    createDataChannel(label, init) {
        const dc = { label, init: init || {}, readyState: 'connecting', send: () => {}, close: () => {} };
        this.dataChannelCalls.push(dc);
        return dc;
    }

    async setLocalDescription(desc) {
        this.setLocalCalls++;
        if (this.failNextSetLocal) {
            const err = this.failNextSetLocal; this.failNextSetLocal = null; throw err;
        }
        // Auto-generate a local description when called without args (modern API).
        const next = desc || {
            type: this.signalingState === 'have-remote-offer' ? 'answer' : 'offer',
            sdp: MIN_SDP,
        };
        this.localDescription = next;
        if (next.type === 'offer') this.signalingState = 'have-local-offer';
        else if (next.type === 'answer') this.signalingState = 'stable';
    }

    async setRemoteDescription(desc) {
        this.setRemoteCalls.push(desc);
        if (this.failNextSetRemote) {
            const err = this.failNextSetRemote; this.failNextSetRemote = null; throw err;
        }
        this.remoteDescription = desc;
        if (desc.type === 'offer') this.signalingState = 'have-remote-offer';
        else if (desc.type === 'answer') this.signalingState = 'stable';
    }

    async addIceCandidate(cand) {
        this.addIceCandidateCalls.push(cand);
        if (this.failNextAddIce) {
            const err = this.failNextAddIce; this.failNextAddIce = null; throw err;
        }
    }

    restartIce() {
        this.restartIceCount++;
    }

    close() {
        this.closeCalls++;
        this.connectionState = 'closed';
        this.signalingState  = 'closed';
    }

    // --- Test-side drivers -------------------------------------------------

    /** Fire `onnegotiationneeded`. */
    async fakeNegotiationNeeded() {
        if (typeof this.onnegotiationneeded === 'function') {
            await this.onnegotiationneeded({});
        }
    }

    /**
     * Fire `onicecandidate` with a synthetic `RTCPeerConnectionIceEvent`.
     * Pass `null` to fire the end-of-candidates marker.
     * @param {string|null} candidate - raw `a=candidate:` line
     */
    fakeIceCandidate(candidate) {
        if (typeof this.onicecandidate === 'function') {
            this.onicecandidate({
                candidate: candidate
                    ? { candidate, sdpMid: '0', sdpMLineIndex: 0, usernameFragment: 'ufrag' }
                    : null,
            });
        }
    }

    /**
     * Fire `ontrack` with a synthetic `RTCTrackEvent`.
     * @param {object} [overrides]
     */
    fakeTrack(overrides = {}) {
        if (typeof this.ontrack === 'function') {
            this.ontrack(Object.assign({
                track: { kind: 'audio', id: 'track_fake' },
                streams: [{ id: 'stream_fake' }],
                receiver: {},
                transceiver: {},
            }, overrides));
        }
    }

    /**
     * Fire `ondatachannel`.
     * @param {object} [dc]
     */
    fakeDataChannel(dc) {
        if (typeof this.ondatachannel === 'function') {
            this.ondatachannel({ channel: dc || { label: 'fake', send: () => {}, close: () => {} } });
        }
    }

    /**
     * Move connectionState and fire `onconnectionstatechange`.
     * @param {string} state
     */
    fakeConnectionStateChange(state) {
        this.connectionState = state;
        if (typeof this.onconnectionstatechange === 'function') {
            this.onconnectionstatechange({});
        }
    }
}
