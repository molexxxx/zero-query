/**
 * src/webrtc/signaling.js - WebSocket signaling client
 *
 * Speaks the wire protocol of `@zero-server/webrtc` over a WebSocket
 * transport. Handles connect / reconnect with exponential backoff,
 * stores the `peerId` assigned by the server's initial `hello` frame,
 * provides a tiny `on`/`off`/`send` event surface, and coalesces
 * outbound trickle `ice` frames so we don't trip the hub's per-peer
 * rate limit (default 30 msg/sec, 10/200ms here gives plenty of headroom).
 *
 * SSR-safe: nothing touches `WebSocket` at module load - the connection
 * (and any timers) only spin up when `.connect()` is called.
 */

import { SignalingError } from './errors.js';


// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default base backoff between reconnect attempts (ms). */
const DEFAULT_BACKOFF_BASE_MS = 250;

/** Default cap on the per-attempt backoff (ms). */
const DEFAULT_BACKOFF_CAP_MS = 8000;

/** Default maximum number of reconnect attempts before giving up. */
const DEFAULT_MAX_RETRIES = 10;

/** Default ICE-coalescing window length (ms). */
const DEFAULT_ICE_FLUSH_MS = 200;

/** Default max ICE frames flushed per coalesce window. */
const DEFAULT_ICE_BATCH = 10;

/** WebSocket close codes treated as "do not reconnect" (client-initiated bye). */
const CLOSE_CODE_NORMAL = 1000;


/**
 * Tiny WebSocket signaling client for the zQuery WebRTC stack.
 *
 *   const client = new SignalingClient('wss://api.example.com/rtc');
 *   client.on('hello', ({ peerId }) => console.log('I am', peerId));
 *   client.on('joined', ({ room, peers }) => ...);
 *   await client.connect();
 *   client.send('join', { room: 'lobby' });
 *
 * Lifecycle events (in addition to server frame types):
 *   - `open`        fired on every successful socket open (incl. reconnects).
 *   - `close`       fired on every socket close, payload `{ code, reason, wasClean }`.
 *   - `reconnect`   fired before each reconnect attempt, payload `{ attempt, delayMs }`.
 *   - `error`       fired on protocol errors with a `SignalingError` payload.
 */
export class SignalingClient {
    /**
     * @param {string} url - WebSocket URL (`ws://` or `wss://`).
     * @param {object} [options]
     * @param {object} [options.reconnect]                  - reconnect tuning (set `false` to disable).
     * @param {number} [options.reconnect.baseMs=250]       - base backoff per attempt.
     * @param {number} [options.reconnect.capMs=8000]       - cap on per-attempt backoff.
     * @param {number} [options.reconnect.maxRetries=10]    - hard cap on reconnect attempts.
     * @param {number} [options.iceFlushMs=200]             - ICE coalesce window length (ms).
     * @param {number} [options.iceBatch=10]                - max ICE frames flushed per window.
     * @param {Function} [options.WebSocket]                - WebSocket constructor (defaults to global; useful for tests).
     */
    constructor(url, options = {}) {
        if (typeof url !== 'string' || url.length === 0) {
            throw new SignalingError('SignalingClient requires a non-empty url', { code: 'ZQ_WEBRTC_SIGNALING_BAD_URL' });
        }

        const reconnect = options.reconnect === false
            ? null
            : Object.assign(
                {
                    baseMs:     DEFAULT_BACKOFF_BASE_MS,
                    capMs:      DEFAULT_BACKOFF_CAP_MS,
                    maxRetries: DEFAULT_MAX_RETRIES,
                },
                options.reconnect || {}
            );

        this.url        = url;
        this.options    = {
            reconnect,
            iceFlushMs: options.iceFlushMs || DEFAULT_ICE_FLUSH_MS,
            iceBatch:   options.iceBatch   || DEFAULT_ICE_BATCH,
            WebSocket:  options.WebSocket  || null,
        };
        this.peerId     = null;
        this.ws         = null;
        this.connected  = false;
        this.closed     = false;
        this._attempts  = 0;
        this._listeners = new Map();
        this._iceQueue  = [];
        this._iceTimer  = null;
        this._reconnectTimer = null;
        this._helloReceived  = false;
    }

    // -----------------------------------------------------------------------
    // Event surface
    // -----------------------------------------------------------------------

    /**
     * Register a listener for a server frame type or lifecycle event.
     *
     * @param {string}   type
     * @param {Function} cb
     * @returns {Function} unsubscribe function.
     */
    on(type, cb) {
        if (typeof cb !== 'function') return () => {};
        let set = this._listeners.get(type);
        if (!set) { set = new Set(); this._listeners.set(type, set); }
        set.add(cb);
        return () => this.off(type, cb);
    }

    /**
     * Remove a previously registered listener.
     *
     * @param {string}   type
     * @param {Function} cb
     */
    off(type, cb) {
        const set = this._listeners.get(type);
        if (set) set.delete(cb);
    }

    /**
     * Internal: emit to every registered listener for `type`.
     *
     * @param {string} type
     * @param {*}      payload
     * @private
     */
    _emit(type, payload) {
        const set = this._listeners.get(type);
        if (!set || set.size === 0) return;
        for (const cb of [...set]) {
            try { cb(payload); }
            catch (_) { /* listener errors must not break the socket loop */ }
        }
    }

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    /**
     * Open the socket. Resolves on first successful `open` event; rejects with
     * a `SignalingError` if the very first connection attempt fails.
     * Subsequent reconnects happen transparently and do not reject this promise.
     *
     * @returns {Promise<void>}
     */
    connect() {
        if (this.connected) return Promise.resolve();
        this.closed = false;
        return new Promise((resolve, reject) => {
            const onceOpen = () => {
                this.off('open',  onceOpen);
                this.off('error', onceErr);
                resolve();
            };
            const onceErr = (err) => {
                if (this._attempts === 0) {
                    this.off('open',  onceOpen);
                    this.off('error', onceErr);
                    reject(err);
                }
            };
            this.on('open',  onceOpen);
            this.on('error', onceErr);
            this._open();
        });
    }

    /**
     * Send a frame `{ type, ...payload }` to the server. `ice` frames are
     * coalesced and flushed in batches of `iceBatch` per `iceFlushMs`.
     *
     * @param {string} type
     * @param {object} [payload]
     */
    send(type, payload = {}) {
        if (typeof type !== 'string' || type.length === 0) {
            throw new SignalingError('SignalingClient.send requires a frame type', { code: 'ZQ_WEBRTC_SIGNALING_BAD_FRAME' });
        }
        const frame = Object.assign({ type }, payload);
        if (type === 'ice') {
            this._iceQueue.push(frame);
            this._scheduleIceFlush();
            return;
        }
        this._sendRaw(frame);
    }

    /**
     * Gracefully close the socket. Sends a `bye` frame (best-effort), cancels
     * any pending reconnect, and never reconnects again until `.connect()` is
     * called explicitly.
     */
    close() {
        this.closed = true;
        if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
        if (this._iceTimer)       { clearTimeout(this._iceTimer);       this._iceTimer       = null; }
        this._iceQueue.length = 0;
        if (this.ws) {
            try { this._sendRaw({ type: 'bye' }); } catch (_) { /* socket may be dead */ }
            try { this.ws.close(CLOSE_CODE_NORMAL, 'client-bye'); } catch (_) { /* */ }
        }
    }

    // -----------------------------------------------------------------------
    // Internals
    // -----------------------------------------------------------------------

    /**
     * Open the underlying WebSocket and wire its event handlers. Defers all
     * access to the global `WebSocket` so SSR consumers can import this
     * module without a polyfill.
     *
     * @private
     */
    _open() {
        const WS = this.options.WebSocket
            || (typeof WebSocket !== 'undefined' ? WebSocket : null);
        if (!WS) {
            const err = new SignalingError('No WebSocket implementation available (SSR? pass options.WebSocket)', { code: 'ZQ_WEBRTC_SIGNALING_NO_WS' });
            this._emit('error', err);
            return;
        }

        this._helloReceived = false;
        let ws;
        try { ws = new WS(this.url); }
        catch (cause) {
            const err = new SignalingError('Failed to construct WebSocket', { code: 'ZQ_WEBRTC_SIGNALING_OPEN', cause });
            this._emit('error', err);
            this._scheduleReconnect();
            return;
        }
        this.ws = ws;

        ws.onopen = () => {
            this.connected = true;
            this._attempts = 0;
            this._emit('open', { url: this.url });
        };

        ws.onmessage = (event) => this._onMessage(event);

        ws.onerror = (event) => {
            const err = new SignalingError('WebSocket error', { code: 'ZQ_WEBRTC_SIGNALING_WS_ERROR', context: { event } });
            this._emit('error', err);
        };

        ws.onclose = (event) => {
            this.connected = false;
            this.ws        = null;
            const payload = { code: event && event.code, reason: event && event.reason, wasClean: event && event.wasClean };
            this._emit('close', payload);
            if (this.closed) return;
            if (payload.code === CLOSE_CODE_NORMAL) return;
            this._scheduleReconnect();
        };
    }

    /**
     * Parse + validate an incoming frame and dispatch to listeners. The first
     * message after `open` must be `{ type: 'hello', peerId }`; anything else
     * (or a malformed JSON payload) raises a `SignalingError`.
     *
     * @param {MessageEvent} event
     * @private
     */
    _onMessage(event) {
        let frame;
        try { frame = JSON.parse(event.data); }
        catch (cause) {
            this._emit('error', new SignalingError('Malformed JSON from server', { code: 'ZQ_WEBRTC_SIGNALING_BAD_JSON', cause }));
            return;
        }
        if (!frame || typeof frame !== 'object' || typeof frame.type !== 'string') {
            this._emit('error', new SignalingError('Frame missing required "type" field', { code: 'ZQ_WEBRTC_SIGNALING_BAD_FRAME', context: { frame } }));
            return;
        }

        if (!this._helloReceived) {
            if (frame.type !== 'hello' || typeof frame.peerId !== 'string') {
                this._emit('error', new SignalingError('First frame must be a hello with peerId', { code: 'ZQ_WEBRTC_SIGNALING_NO_HELLO', context: { frame } }));
                return;
            }
            this._helloReceived = true;
            this.peerId = frame.peerId;
        }

        this._emit(frame.type, frame);
    }

    /**
     * Send a frame immediately (no coalescing). Buffers a `SignalingError`
     * to listeners if the socket is not currently open.
     *
     * @param {object} frame
     * @private
     */
    _sendRaw(frame) {
        if (!this.ws || !this.connected) {
            this._emit('error', new SignalingError('Cannot send frame: socket not open', { code: 'ZQ_WEBRTC_SIGNALING_NOT_OPEN', context: { type: frame && frame.type } }));
            return;
        }
        try { this.ws.send(JSON.stringify(frame)); }
        catch (cause) {
            this._emit('error', new SignalingError('socket.send threw', { code: 'ZQ_WEBRTC_SIGNALING_SEND_FAIL', cause }));
        }
    }

    /**
     * Schedule a coalesced ICE flush. Multiple `send('ice', ...)` calls within
     * `iceFlushMs` of each other are drained together (up to `iceBatch` per
     * window), keeping us well under the server's per-peer message-rate cap.
     *
     * @private
     */
    _scheduleIceFlush() {
        if (this._iceTimer) return;
        this._iceTimer = setTimeout(() => {
            this._iceTimer = null;
            this._flushIce();
            if (this._iceQueue.length > 0) this._scheduleIceFlush();
        }, this.options.iceFlushMs);
    }

    /**
     * Drain up to `iceBatch` ICE frames from the queue, sending each
     * individually. We intentionally do not concatenate them into a single
     * wire frame - the server's protocol expects one `ice` frame per candidate.
     *
     * @private
     */
    _flushIce() {
        const batch = this._iceQueue.splice(0, this.options.iceBatch);
        for (const frame of batch) this._sendRaw(frame);
    }

    /**
     * Schedule the next reconnect attempt using exponential backoff with the
     * configured cap, bailing out once `maxRetries` is reached.
     *
     * @private
     */
    _scheduleReconnect() {
        const cfg = this.options.reconnect;
        if (!cfg) return;
        if (this._attempts >= cfg.maxRetries) {
            this._emit('error', new SignalingError('Max reconnect attempts exceeded', { code: 'ZQ_WEBRTC_SIGNALING_GIVEUP', context: { attempts: this._attempts } }));
            this.closed = true;
            return;
        }
        const attempt = this._attempts++;
        const delayMs = Math.min(cfg.capMs, cfg.baseMs * Math.pow(2, attempt));
        this._emit('reconnect', { attempt: attempt + 1, delayMs });
        this._reconnectTimer = setTimeout(() => {
            this._reconnectTimer = null;
            if (!this.closed) this._open();
        }, delayMs);
    }
}
