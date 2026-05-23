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

/* eslint-disable no-unused-vars */

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
