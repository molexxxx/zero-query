/**
 * src/webrtc/errors.js - WebRTC error family
 *
 * All WebRTC-specific errors derive from `WebRtcError`, which itself
 * derives from `ZQueryError` so they participate in the same
 * `$.onError(handler)` reporting pipeline as the rest of the library.
 *
 * Each subclass has a sensible default `code` string; callers may override
 * via the constructor's options bag (`{ code, context, cause }`). The codes
 * intentionally mirror the families used by the matching `@zero-server/webrtc`
 * package so cross-stack error reporting stays consistent.
 */

import { ZQueryError } from '../errors.js';


/**
 * Base class for every WebRTC client error. Extends `ZQueryError` so it
 * shows up in `$.onError(handler)` like any other library error.
 *
 *   throw new WebRtcError('peer connection failed');
 *   throw new WebRtcError('peer connection failed', { code: 'PC_FAILED', context: { peerId } });
 */
export class WebRtcError extends ZQueryError {
    /**
     * @param {string} message  - human-readable description.
     * @param {object} [options]
     * @param {string} [options.code]    - stable error code (defaults per subclass).
     * @param {object} [options.context] - extra structured context.
     * @param {Error}  [options.cause]   - original error, if any.
     */
    constructor(message, options = {}) {
        const code    = options.code    || 'ZQ_WEBRTC';
        const context = options.context || {};
        super(code, message, context, options.cause);
        this.name = 'WebRtcError';
    }
}


/** Signaling-channel error (WebSocket transport, protocol framing, etc.). */
export class SignalingError extends WebRtcError {
    /**
     * @param {string} message
     * @param {object} [options] - same shape as `WebRtcError`.
     */
    constructor(message, options = {}) {
        super(message, { code: options.code || 'ZQ_WEBRTC_SIGNALING', context: options.context, cause: options.cause });
        this.name = 'SignalingError';
    }
}


/** ICE candidate / gathering / connectivity error. */
export class IceError extends WebRtcError {
    /**
     * @param {string} message
     * @param {object} [options]
     */
    constructor(message, options = {}) {
        super(message, { code: options.code || 'ZQ_WEBRTC_ICE', context: options.context, cause: options.cause });
        this.name = 'IceError';
    }
}


/** SDP parse / validate / mangle error. */
export class SdpError extends WebRtcError {
    /**
     * @param {string} message
     * @param {object} [options]
     */
    constructor(message, options = {}) {
        super(message, { code: options.code || 'ZQ_WEBRTC_SDP', context: options.context, cause: options.cause });
        this.name = 'SdpError';
    }
}


/** TURN credential fetch / refresh error. */
export class TurnError extends WebRtcError {
    /**
     * @param {string} message
     * @param {object} [options]
     */
    constructor(message, options = {}) {
        super(message, { code: options.code || 'ZQ_WEBRTC_TURN', context: options.context, cause: options.cause });
        this.name = 'TurnError';
    }
}


/** End-to-end encryption (SFrame / key exchange) error. */
export class E2eeError extends WebRtcError {
    /**
     * @param {string} message
     * @param {object} [options]
     */
    constructor(message, options = {}) {
        super(message, { code: options.code || 'ZQ_WEBRTC_E2EE', context: options.context, cause: options.cause });
        this.name = 'E2eeError';
    }
}


/** SFU adapter (mediasoup / LiveKit) error. */
export class SfuError extends WebRtcError {
    /**
     * @param {string} message
     * @param {object} [options]
     */
    constructor(message, options = {}) {
        super(message, { code: options.code || 'ZQ_WEBRTC_SFU', context: options.context, cause: options.cause });
        this.name = 'SfuError';
    }
}
