/**
 * zQuery (zeroQuery) v1.1.1
 * Lightweight Frontend Library
 * https://github.com/tonywied17/zero-query
 * (c) 2026 Anthony Wiedman - MIT License
 */
(function(global) {
  'use strict';

// --- src/errors.js -----------------------------------------------
/**
 * zQuery Errors - Structured error handling system
 *
 * Provides typed error classes and a configurable error handler so that
 * errors surface consistently across all modules (reactive, component,
 * router, store, expression parser, HTTP, etc.).
 *
 * Default behaviour: errors are logged via console.warn/error.
 * Users can override with $.onError(handler) to integrate with their
 * own logging, crash-reporting, or UI notification system.
 */

// ---------------------------------------------------------------------------
// Error codes - every zQuery error has a unique code for programmatic use
// ---------------------------------------------------------------------------
const ErrorCode = Object.freeze({
  // Reactive
  REACTIVE_CALLBACK:   'ZQ_REACTIVE_CALLBACK',
  SIGNAL_CALLBACK:     'ZQ_SIGNAL_CALLBACK',
  EFFECT_EXEC:         'ZQ_EFFECT_EXEC',

  // Expression parser
  EXPR_PARSE:          'ZQ_EXPR_PARSE',
  EXPR_EVAL:           'ZQ_EXPR_EVAL',
  EXPR_UNSAFE_ACCESS:  'ZQ_EXPR_UNSAFE_ACCESS',

  // Component
  COMP_INVALID_NAME:   'ZQ_COMP_INVALID_NAME',
  COMP_NOT_FOUND:      'ZQ_COMP_NOT_FOUND',
  COMP_MOUNT_TARGET:   'ZQ_COMP_MOUNT_TARGET',
  COMP_RENDER:         'ZQ_COMP_RENDER',
  COMP_LIFECYCLE:      'ZQ_COMP_LIFECYCLE',
  COMP_RESOURCE:       'ZQ_COMP_RESOURCE',
  COMP_DIRECTIVE:      'ZQ_COMP_DIRECTIVE',

  // Router
  ROUTER_LOAD:         'ZQ_ROUTER_LOAD',
  ROUTER_GUARD:        'ZQ_ROUTER_GUARD',
  ROUTER_RESOLVE:      'ZQ_ROUTER_RESOLVE',

  // Store
  STORE_ACTION:        'ZQ_STORE_ACTION',
  STORE_MIDDLEWARE:     'ZQ_STORE_MIDDLEWARE',
  STORE_SUBSCRIBE:     'ZQ_STORE_SUBSCRIBE',

  // HTTP
  HTTP_REQUEST:        'ZQ_HTTP_REQUEST',
  HTTP_TIMEOUT:        'ZQ_HTTP_TIMEOUT',
  HTTP_INTERCEPTOR:    'ZQ_HTTP_INTERCEPTOR',
  HTTP_PARSE:          'ZQ_HTTP_PARSE',

  // SSR
  SSR_RENDER:          'ZQ_SSR_RENDER',
  SSR_COMPONENT:       'ZQ_SSR_COMPONENT',
  SSR_HYDRATION:       'ZQ_SSR_HYDRATION',
  SSR_PAGE:            'ZQ_SSR_PAGE',

  // General
  INVALID_ARGUMENT:    'ZQ_INVALID_ARGUMENT',
});


// ---------------------------------------------------------------------------
// ZQueryError - custom error class
// ---------------------------------------------------------------------------
class ZQueryError extends Error {
  /**
   * @param {string} code    - one of ErrorCode values
   * @param {string} message - human-readable description
   * @param {object} [context] - extra data (component name, expression, etc.)
   * @param {Error}  [cause]   - original error
   */
  constructor(code, message, context = {}, cause) {
    super(message);
    this.name = 'ZQueryError';
    this.code = code;
    this.context = context;
    if (cause) this.cause = cause;
  }
}


// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
let _errorHandlers = [];

/**
 * Register a global error handler.
 * Called whenever zQuery catches an error internally.
 * Multiple handlers are supported - each receives the error.
 * Pass `null` to clear all handlers.
 *
 * @param {Function|null} handler - (error: ZQueryError) => void
 * @returns {Function} unsubscribe function to remove this handler
 */
function onError(handler) {
  if (handler === null) {
    _errorHandlers = [];
    return () => {};
  }
  if (typeof handler !== 'function') return () => {};
  _errorHandlers.push(handler);
  return () => {
    const idx = _errorHandlers.indexOf(handler);
    if (idx !== -1) _errorHandlers.splice(idx, 1);
  };
}

/**
 * Report an error through the global handler and console.
 * Non-throwing - used for recoverable errors in callbacks, lifecycle hooks, etc.
 *
 * @param {string} code - ErrorCode
 * @param {string} message
 * @param {object} [context]
 * @param {Error} [cause]
 */
function reportError(code, message, context = {}, cause) {
  const err = cause instanceof ZQueryError
    ? cause
    : new ZQueryError(code, message, context, cause);

  // Notify all registered handlers
  for (const handler of _errorHandlers) {
    try { handler(err); } catch { /* prevent handler from crashing framework */ }
  }

  // Always log for developer visibility
  console.error(`[zQuery ${code}] ${message}`, context, cause || '');
}

/**
 * Wrap a callback so that thrown errors are caught, reported, and don't crash
 * the current execution context.
 *
 * @param {Function} fn
 * @param {string} code - ErrorCode to use if the callback throws
 * @param {object} [context]
 * @returns {Function}
 */
function guardCallback(fn, code, context = {}) {
  return (...args) => {
    try {
      return fn(...args);
    } catch (err) {
      reportError(code, err.message || 'Callback error', context, err);
    }
  };
}

/**
 * Validate a required value is defined and of the expected type.
 * Throws ZQueryError on failure (for fast-fail at API boundaries).
 *
 * @param {*} value
 * @param {string} name - parameter name for error message
 * @param {string} expectedType - 'string', 'function', 'object', etc.
 */
function validate(value, name, expectedType) {
  if (value === undefined || value === null) {
    throw new ZQueryError(
      ErrorCode.INVALID_ARGUMENT,
      `"${name}" is required but got ${value}`
    );
  }
  if (expectedType && typeof value !== expectedType) {
    throw new ZQueryError(
      ErrorCode.INVALID_ARGUMENT,
      `"${name}" must be a ${expectedType}, got ${typeof value}`
    );
  }
}

/**
 * Format a ZQueryError into a structured object suitable for overlays/logging.
 * @param {ZQueryError|Error} err
 * @returns {{ code: string, type: string, message: string, context: object, stack: string }}
 */
function formatError(err) {
  const isZQ = err instanceof ZQueryError;
  return {
    code: isZQ ? err.code : '',
    type: isZQ ? 'ZQueryError' : (err.name || 'Error'),
    message: err.message || 'Unknown error',
    context: isZQ ? err.context : {},
    stack: err.stack || '',
    cause: err.cause ? formatError(err.cause) : null,
  };
}

/**
 * Async version of guardCallback - wraps an async function so that
 * rejections are caught, reported, and don't crash execution.
 *
 * @param {Function} fn - async function
 * @param {string} code - ErrorCode to use
 * @param {object} [context]
 * @returns {Function}
 */
function guardAsync(fn, code, context = {}) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      reportError(code, err.message || 'Async callback error', context, err);
    }
  };
}

// --- src/webrtc/errors.js ----------------------------------------
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


/**
 * Base class for every WebRTC client error. Extends `ZQueryError` so it
 * shows up in `$.onError(handler)` like any other library error.
 *
 *   throw new WebRtcError('peer connection failed');
 *   throw new WebRtcError('peer connection failed', { code: 'PC_FAILED', context: { peerId } });
 */
class WebRtcError extends ZQueryError {
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
class SignalingError extends WebRtcError {
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
class IceError extends WebRtcError {
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
class SdpError extends WebRtcError {
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
class TurnError extends WebRtcError {
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
class E2eeError extends WebRtcError {
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
class SfuError extends WebRtcError {
    /**
     * @param {string} message
     * @param {object} [options]
     */
    constructor(message, options = {}) {
        super(message, { code: options.code || 'ZQ_WEBRTC_SFU', context: options.context, cause: options.cause });
        this.name = 'SfuError';
    }
}

// --- src/webrtc/sdp.js -------------------------------------------
/**
 * src/webrtc/sdp.js - minimal read-only SDP helpers
 *
 * A trimmed port of the server-side `@zero-server/webrtc` SDP module.
 * The client only needs to read a few keys out of an SDP (for stats,
 * ICE bookkeeping, and a sanity check before sending it through
 * signaling); full RFC 8866 conformance lives on the server.
 *
 * Surface:
 *   - `parseSdp(text)`     -> structured `{ version, origin, sessionName, media: [...] }`
 *   - `validateSdp(text)`  -> throws `SdpError` if the SDP would be rejected by the hub
 *                            (missing `UDP/TLS/RTP/SAVPF` proto, `ice-ufrag`, `ice-pwd`,
 *                            or `fingerprint` on any non-rejected m-section).
 *
 * Pure functions, no globals, SSR-safe.
 */


/** Max SDP size accepted by the server. */
const DEFAULT_MAX_BYTES = 65_536;

/** Required transport protocol per server validator. */
const REQUIRED_PROTO = 'UDP/TLS/RTP/SAVPF';

/** Valid SDP direction attributes (RFC 8866 §6.7). */
const SDP_DIRECTIONS = Object.freeze(['sendrecv', 'sendonly', 'recvonly', 'inactive']);


/**
 * Parse an SDP document into a minimal, structured form.
 *
 * Only the fields the client needs are lifted onto named keys; everything
 * else is preserved verbatim on `attributes`/`media[i].attributes` so the
 * caller can still inspect unusual lines without losing information.
 *
 * @param {string} text
 * @param {object} [opts]
 * @param {number} [opts.maxBytes=65536]
 * @returns {{
 *   version: number,
 *   origin: ?object,
 *   sessionName: string,
 *   attributes: Array<{key:string,value:string}>,
 *   media: Array<{
 *     kind: string,
 *     port: number,
 *     proto: string,
 *     fmts: string[],
 *     mid?: string,
 *     iceUfrag?: string,
 *     icePwd?: string,
 *     fingerprint?: { algorithm: string, value: string },
 *     setup?: string,
 *     direction?: string,
 *     rtcpMux: boolean,
 *     candidates: string[],
 *     rtpmaps: Array<{ payload: number, codec: string, clockRate: number, channels?: number }>,
 *     attributes: Array<{key:string,value:string}>,
 *   }>,
 * }}
 */
function parseSdp(text, opts = {}) {
    if (typeof text !== 'string') {
        throw new SdpError('parseSdp: input must be a string', { code: 'ZQ_WEBRTC_SDP_PARSE' });
    }
    const maxBytes = typeof opts.maxBytes === 'number' ? opts.maxBytes : DEFAULT_MAX_BYTES;
    if (text.length > maxBytes) {
        throw new SdpError(`parseSdp: payload exceeds ${maxBytes} bytes`, { code: 'ZQ_WEBRTC_SDP_TOO_LARGE' });
    }
    if (text.length === 0) {
        throw new SdpError('parseSdp: empty input', { code: 'ZQ_WEBRTC_SDP_PARSE' });
    }

    const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.length > 0);
    if (lines.length === 0) {
        throw new SdpError('parseSdp: no non-empty lines', { code: 'ZQ_WEBRTC_SDP_PARSE' });
    }

    const session = {
        version:     0,
        origin:      null,
        sessionName: '',
        attributes:  [],
        media:       [],
    };

    let current = session;
    let currentMedia = null;

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const eq  = raw.indexOf('=');
        if (eq < 1) {
            throw new SdpError(`parseSdp: malformed line ${i + 1}`, {
                code: 'ZQ_WEBRTC_SDP_PARSE',
                context: { line: i + 1 },
            });
        }
        const type = raw.slice(0, eq);
        const val  = raw.slice(eq + 1);

        if (i === 0 && type !== 'v') {
            throw new SdpError('parseSdp: SDP must start with v=', {
                code: 'ZQ_WEBRTC_SDP_PARSE',
                context: { line: 1 },
            });
        }

        switch (type) {
            case 'v':
                session.version = Number(val);
                break;
            case 'o':
                session.origin = _parseOrigin(val);
                break;
            case 's':
                session.sessionName = val;
                break;
            case 'm': {
                currentMedia = _newMedia(val);
                session.media.push(currentMedia);
                current = currentMedia;
                break;
            }
            case 'a':
                _applyAttribute(current, val);
                break;
            default:
                // ignore the lines we don't need for the client subset
                break;
        }
    }

    return session;
}


/**
 * Validate that the SDP would survive the server-side hub's strict checks.
 * Throws `SdpError` on missing required attributes; returns the parsed
 * structure on success so callers can chain.
 *
 * Required, per `@zero-server/webrtc` signaling validator:
 *   - at least one m-line
 *   - non-rejected m-lines (port != 0) must use `UDP/TLS/RTP/SAVPF`
 *   - each non-rejected m-line must carry `ice-ufrag`, `ice-pwd`, and
 *     a `fingerprint` attribute (session-level fallback is honored).
 *
 * @param {string} text
 * @returns {ReturnType<typeof parseSdp>}
 */
function validateSdp(text) {
    const parsed = parseSdp(text);
    if (parsed.media.length === 0) {
        throw new SdpError('validateSdp: SDP has no m-lines', { code: 'ZQ_WEBRTC_SDP_NO_MEDIA' });
    }

    // Session-level fallbacks: ice-ufrag / ice-pwd / fingerprint can appear
    // once at the session level and apply to every m-section.
    const sessIceUfrag    = _findAttr(parsed.attributes, 'ice-ufrag');
    const sessIcePwd      = _findAttr(parsed.attributes, 'ice-pwd');
    const sessFingerprint = _findAttr(parsed.attributes, 'fingerprint');

    for (let i = 0; i < parsed.media.length; i++) {
        const m = parsed.media[i];
        if (m.port === 0) continue;
        if (m.proto !== REQUIRED_PROTO) {
            throw new SdpError(
                `validateSdp: m-line ${i} proto "${m.proto}" must be "${REQUIRED_PROTO}"`,
                { code: 'ZQ_WEBRTC_SDP_BAD_PROTO', context: { index: i, proto: m.proto } }
            );
        }
        const ufrag = m.iceUfrag || sessIceUfrag;
        const pwd   = m.icePwd   || sessIcePwd;
        const fp    = m.fingerprint || sessFingerprint;
        if (!ufrag) {
            throw new SdpError(`validateSdp: m-line ${i} missing ice-ufrag`, {
                code: 'ZQ_WEBRTC_SDP_NO_ICE_UFRAG', context: { index: i },
            });
        }
        if (!pwd) {
            throw new SdpError(`validateSdp: m-line ${i} missing ice-pwd`, {
                code: 'ZQ_WEBRTC_SDP_NO_ICE_PWD', context: { index: i },
            });
        }
        if (!fp) {
            throw new SdpError(`validateSdp: m-line ${i} missing fingerprint`, {
                code: 'ZQ_WEBRTC_SDP_NO_FINGERPRINT', context: { index: i },
            });
        }
    }

    return parsed;
}


// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** @param {string} val */
function _parseOrigin(val) {
    const t = val.split(/\s+/);
    if (t.length < 6) return null;
    return {
        username:       t[0],
        sessionId:      t[1],
        sessionVersion: Number(t[2]),
        netType:        t[3],
        addrType:       t[4],
        address:        t[5],
    };
}

/** @param {string} val - the part after `m=` */
function _newMedia(val) {
    const t = val.split(/\s+/);
    return {
        kind:        t[0] || '',
        port:        Number(t[1]) || 0,
        proto:       t[2] || '',
        fmts:        t.slice(3),
        mid:         undefined,
        iceUfrag:    undefined,
        icePwd:      undefined,
        fingerprint: undefined,
        setup:       undefined,
        direction:   undefined,
        rtcpMux:     false,
        candidates:  [],
        rtpmaps:     [],
        attributes:  [],
    };
}

/**
 * Apply a single `a=...` line to the current section (session or media).
 * @param {object} section
 * @param {string} val
 */
function _applyAttribute(section, val) {
    const colon = val.indexOf(':');
    const key = colon === -1 ? val : val.slice(0, colon);
    const value = colon === -1 ? '' : val.slice(colon + 1);
    section.attributes.push({ key, value });

    switch (key) {
        case 'mid':         if ('mid'         in section) section.mid = value; break;
        case 'ice-ufrag':   if ('iceUfrag'    in section) section.iceUfrag = value; break;
        case 'ice-pwd':     if ('icePwd'      in section) section.icePwd = value; break;
        case 'setup':       if ('setup'       in section) section.setup = value; break;
        case 'rtcp-mux':    if ('rtcpMux'     in section) section.rtcpMux = true; break;
        case 'fingerprint': {
            const sp = value.indexOf(' ');
            const fp = sp === -1
                ? { algorithm: value, value: '' }
                : { algorithm: value.slice(0, sp), value: value.slice(sp + 1) };
            if ('fingerprint' in section) section.fingerprint = fp;
            break;
        }
        case 'candidate':
            if ('candidates' in section) section.candidates.push(`candidate:${value}`);
            break;
        case 'rtpmap': {
            if (!('rtpmaps' in section)) break;
            const sp = value.indexOf(' ');
            if (sp === -1) break;
            const payload = Number(value.slice(0, sp));
            const desc    = value.slice(sp + 1).split('/');
            section.rtpmaps.push({
                payload,
                codec:     desc[0] || '',
                clockRate: Number(desc[1]) || 0,
                channels:  desc[2] ? Number(desc[2]) : undefined,
            });
            break;
        }
        case 'sendrecv':
        case 'sendonly':
        case 'recvonly':
        case 'inactive':
            if ('direction' in section) section.direction = key;
            break;
        default:
            // unknown attribute - already preserved on attributes[]
            break;
    }
}

/**
 * Find the first attribute value for `key` in an attribute list, or `undefined`.
 * @param {Array<{key:string,value:string}>} list
 * @param {string} key
 */
function _findAttr(list, key) {
    for (let i = 0; i < list.length; i++) {
        if (list[i].key === key) return list[i].value || true;
    }
    return undefined;
}

// --- src/webrtc/ice.js -------------------------------------------
/**
 * src/webrtc/ice.js - read-only ICE candidate helpers
 *
 * Mirrors the parsing / classification surface of the server-side
 * `@zero-server/webrtc` ice module, trimmed to the subset the client
 * actually needs (no policy enforcement - the server is the
 * source of truth for cross-peer filtering).
 *
 * Exposes:
 *   - `parseCandidate(line)` -> structured object
 *   - `stringifyCandidate(obj)` -> canonical `candidate:...` line
 *   - address classifiers: `isPrivateIp`, `isLoopbackIp`, `isLinkLocalIp`, `isMdnsHostname`
 *   - `filterCandidates(list, policy)` for local-side trimming.
 *
 * SSR-safe: pure functions, no globals touched at module load.
 */


// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Recognized ICE candidate types (RFC 5245). */
const CANDIDATE_TYPES = Object.freeze(['host', 'srflx', 'prflx', 'relay']);

/** Recognized TCP candidate types (RFC 6544 §4.5). */
const TCP_TYPES = Object.freeze(['active', 'passive', 'so']);


// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse a single ICE candidate line. Accepts inputs with or without the
 * `a=` SDP-attribute prefix. Throws `IceError` on any structural problem.
 *
 * @param {string} line
 * @returns {{
 *   foundation: string,
 *   component: number,
 *   transport: string,
 *   priority: number,
 *   address: string,
 *   port: number,
 *   type: string,
 *   relatedAddress?: string,
 *   relatedPort?: number,
 *   tcpType?: string,
 *   extensions: Object<string,string>,
 * }}
 */
function parseCandidate(line) {
    if (typeof line !== 'string') {
        throw new IceError('parseCandidate: input must be a string', { code: 'ZQ_WEBRTC_ICE_PARSE' });
    }

    let s = line.trim();
    if (s.indexOf('a=') === 0) s = s.slice(2);
    if (s.indexOf('candidate:') !== 0) {
        throw new IceError('parseCandidate: missing "candidate:" prefix', {
            code: 'ZQ_WEBRTC_ICE_PARSE',
            context: { candidate: line },
        });
    }
    s = s.slice('candidate:'.length);

    const tok = s.split(/\s+/);
    if (tok.length < 8) {
        throw new IceError('parseCandidate: too few tokens', {
            code: 'ZQ_WEBRTC_ICE_PARSE',
            context: { candidate: line },
        });
    }

    const foundation   = tok[0];
    const componentStr = tok[1];
    const transportRaw = tok[2];
    const priorityStr  = tok[3];
    const address      = tok[4];
    const portStr      = tok[5];
    const typKw        = tok[6];
    const type         = tok[7];
    const rest         = tok.slice(8);

    if (typKw !== 'typ') {
        throw new IceError('parseCandidate: expected "typ" keyword', {
            code: 'ZQ_WEBRTC_ICE_PARSE',
            context: { candidate: line },
        });
    }
    if (CANDIDATE_TYPES.indexOf(type) === -1) {
        throw new IceError(`parseCandidate: unknown type "${type}"`, {
            code: 'ZQ_WEBRTC_ICE_PARSE',
            context: { candidate: line },
        });
    }

    const component = Number(componentStr);
    const priority  = Number(priorityStr);
    const port      = Number(portStr);
    if (!Number.isInteger(component) || component < 0) {
        throw new IceError('parseCandidate: invalid component', {
            code: 'ZQ_WEBRTC_ICE_PARSE',
            context: { candidate: line },
        });
    }
    if (!Number.isFinite(priority)) {
        throw new IceError('parseCandidate: invalid priority', {
            code: 'ZQ_WEBRTC_ICE_PARSE',
            context: { candidate: line },
        });
    }
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new IceError('parseCandidate: invalid port', {
            code: 'ZQ_WEBRTC_ICE_PARSE',
            context: { candidate: line },
        });
    }

    const out = {
        foundation,
        component,
        transport: transportRaw.toLowerCase(),
        priority,
        address,
        port,
        type,
        extensions: {},
    };

    for (let i = 0; i < rest.length - 1; i += 2) {
        const k = rest[i];
        const v = rest[i + 1];
        if      (k === 'raddr')   out.relatedAddress = v;
        else if (k === 'rport')   out.relatedPort    = Number(v);
        else if (k === 'tcptype') out.tcpType        = v;
        else                      out.extensions[k]  = v;
    }

    return out;
}


// ---------------------------------------------------------------------------
// Serializer
// ---------------------------------------------------------------------------

/**
 * Serialize a parsed candidate back to its canonical line format (no `a=` prefix).
 * Round-trips outputs of `parseCandidate` exactly.
 *
 * @param {object} c - Output of `parseCandidate`.
 * @returns {string}
 */
function stringifyCandidate(c) {
    if (!c || typeof c !== 'object') {
        throw new IceError('stringifyCandidate: input must be an object', { code: 'ZQ_WEBRTC_ICE_SERIALIZE' });
    }
    const required = ['foundation', 'component', 'transport', 'priority', 'address', 'port', 'type'];
    for (const k of required) {
        if (c[k] === undefined || c[k] === null) {
            throw new IceError(`stringifyCandidate: missing "${k}"`, { code: 'ZQ_WEBRTC_ICE_SERIALIZE' });
        }
    }

    let s = `candidate:${c.foundation} ${c.component} ${c.transport} ${c.priority} ${c.address} ${c.port} typ ${c.type}`;
    if (c.relatedAddress !== undefined) s += ` raddr ${c.relatedAddress}`;
    if (c.relatedPort !== undefined)    s += ` rport ${c.relatedPort}`;
    if (c.tcpType !== undefined)        s += ` tcptype ${c.tcpType}`;
    if (c.extensions) {
        for (const k of Object.keys(c.extensions)) {
            s += ` ${k} ${c.extensions[k]}`;
        }
    }
    return s;
}


// ---------------------------------------------------------------------------
// Address classifiers
// ---------------------------------------------------------------------------

function _isIPv4(addr) {
    if (typeof addr !== 'string') return false;
    const m = addr.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return false;
    for (let i = 1; i <= 4; i++) if (Number(m[i]) > 255) return false;
    return true;
}

function _isIPv6(addr) {
    if (typeof addr !== 'string') return false;
    return addr.indexOf(':') !== -1 && /^[0-9a-fA-F:]+$/.test(addr);
}

/** RFC 1918, RFC 6598 CGNAT, and IPv6 ULA (fc00::/7). */
function isPrivateIp(addr) {
    if (_isIPv4(addr)) {
        const parts = addr.split('.').map(Number);
        const a = parts[0]; const b = parts[1];
        if (a === 10) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
        if (a === 100 && b >= 64 && b <= 127) return true;
        return false;
    }
    if (_isIPv6(addr)) {
        const head = addr.toLowerCase().split(':')[0];
        if (head.length === 0) return false;
        const n = parseInt(head, 16);
        return (n & 0xfe00) === 0xfc00;
    }
    return false;
}

/** IPv4 127.0.0.0/8 and IPv6 ::1. */
function isLoopbackIp(addr) {
    if (_isIPv4(addr)) return addr.indexOf('127.') === 0;
    if (_isIPv6(addr)) return addr === '::1' || /^0*:0*:0*:0*:0*:0*:0*:0*1$/.test(addr);
    return false;
}

/** IPv4 169.254/16 and IPv6 fe80::/10. */
function isLinkLocalIp(addr) {
    if (_isIPv4(addr)) return addr.indexOf('169.254.') === 0;
    if (_isIPv6(addr)) {
        const head = addr.toLowerCase().split(':')[0];
        if (head.length === 0) return false;
        const n = parseInt(head, 16);
        return (n & 0xffc0) === 0xfe80;
    }
    return false;
}

/** mDNS `.local` hostname (Chrome's IP-hiding ICE candidates). */
function isMdnsHostname(host) {
    if (typeof host !== 'string') return false;
    if (_isIPv4(host) || _isIPv6(host)) return false;
    return host.toLowerCase().endsWith('.local');
}


// ---------------------------------------------------------------------------
// Policy filter
// ---------------------------------------------------------------------------

/**
 * Filter a list of candidate lines (or parsed objects) against a policy.
 * Returns the same shape it was given. Unparseable lines are silently
 * dropped so a single bad candidate never poisons the whole batch.
 *
 * @param {Array<string|object>} candidates
 * @param {object} [policy]
 * @param {boolean} [policy.blockPrivate]
 * @param {boolean} [policy.blockLoopback]
 * @param {boolean} [policy.blockLinkLocal]
 * @param {boolean} [policy.blockMdns]
 * @param {boolean} [policy.blockTcp]
 * @param {ReadonlyArray<string>} [policy.allowedTypes]
 * @param {number} [policy.maxCandidates]
 * @param {(c: object) => boolean} [policy.predicate]
 * @returns {Array<string|object>}
 */
function filterCandidates(candidates, policy = {}) {
    if (!Array.isArray(candidates)) return [];

    const blockPrivate   = !!policy.blockPrivate;
    const blockLoopback  = !!policy.blockLoopback;
    const blockLinkLocal = !!policy.blockLinkLocal;
    const blockMdns      = !!policy.blockMdns;
    const blockTcp       = !!policy.blockTcp;
    const allowedTypes   = policy.allowedTypes || null;
    const maxCandidates  = typeof policy.maxCandidates === 'number' ? policy.maxCandidates : Infinity;
    const predicate      = typeof policy.predicate === 'function' ? policy.predicate : null;

    const out = [];
    for (const item of candidates) {
        if (out.length >= maxCandidates) break;
        const isString = typeof item === 'string';
        let parsed;
        if (isString) {
            try { parsed = parseCandidate(item); }
            catch (_) { continue; }
        } else {
            parsed = item;
        }
        if (!parsed) continue;
        if (allowedTypes && allowedTypes.indexOf(parsed.type) === -1) continue;
        if (blockTcp && parsed.transport === 'tcp') continue;
        if (blockMdns && isMdnsHostname(parsed.address)) continue;
        if (blockPrivate && isPrivateIp(parsed.address)) continue;
        if (blockLoopback && isLoopbackIp(parsed.address)) continue;
        if (blockLinkLocal && isLinkLocalIp(parsed.address)) continue;
        if (predicate && !predicate(parsed)) continue;
        out.push(item);
    }
    return out;
}

// --- src/webrtc/signaling.js -------------------------------------
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
class SignalingClient {
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

// --- src/webrtc/peer.js ------------------------------------------
/**
 * src/webrtc/peer.js - RTCPeerConnection wrapper with perfect negotiation
 *
 * Wraps a browser `RTCPeerConnection` and routes JSEP messages through a
 * `SignalingClient` instance for a single remote peer. Implements the W3C
 * "perfect negotiation" pattern (Jan-Ivar Bruaroey) so that simultaneous
 * `negotiationneeded` events on both ends resolve deterministically based
 * on the locally-assigned `polite` flag - no glare, no manual rollback.
 *
 * Wire-protocol mapping (mirrors @zero-server/webrtc):
 *   - outgoing `offer`  -> `{ type: 'offer',  to, sdp }`   (sdp is the string)
 *   - outgoing `answer` -> `{ type: 'answer', to, sdp }`
 *   - outgoing `ice`    -> `{ type: 'ice',    to, candidate }`  (raw a=candidate: line or null)
 *   - incoming filtered by `msg.from === this.id`.
 *
 * Server-side constraints honored here:
 *   - at most `maxIceCandidates` trickled candidates per peer (default 30 -
 *     the hub's hard cap on `a=candidate:` lines per SDP)
 *   - `mDNS` (`.local`) candidates dropped before send
 *   - failed `connectionState` automatically calls `pc.restartIce()`.
 *
 * SSR-safe: nothing touches `RTCPeerConnection` at module load - it's only
 * resolved when a `Peer` is constructed. Tests can inject a fake constructor
 * via `options.RTCPeerConnection`.
 */


// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default cap on trickled ICE candidates per peer (matches server SDP cap). */
const DEFAULT_MAX_ICE_CANDIDATES = 30;


/**
 * One remote peer over a shared `SignalingClient`. Caller owns the lifetime
 * (construct, attach tracks, eventually call `.close()`).
 *
 *   const peer = new Peer('peer_42', signaling, { polite: true });
 *   peer.addTrack(localAudio, localStream);
 *   peer.on('track', ({ track, streams }) => attachToVideoEl(streams[0]));
 *
 * Lifecycle events:
 *   - `track`                   forwards the underlying `RTCTrackEvent`.
 *   - `connectionstatechange`   payload is the new `pc.connectionState` string.
 *   - `datachannel`             forwards `RTCDataChannelEvent`.
 *   - `close`                   fired exactly once when `.close()` runs.
 *   - `error`                   `SdpError` / `IceError` from negotiation.
 */
class Peer {
    /**
     * @param {string} peerId                       - remote peer id (the `from`/`to` value on the wire).
     * @param {import('./signaling.js').SignalingClient} signaling - shared signaling client.
     * @param {object} [options]
     * @param {boolean} [options.polite=false]      - perfect-negotiation polite flag.
     * @param {RTCIceServer[]} [options.iceServers] - STUN/TURN servers.
     * @param {Function} [options.RTCPeerConnection] - constructor override (tests).
     * @param {number}  [options.maxIceCandidates=30] - trickled-candidate hard cap.
     * @param {object}  [options.rtcConfig]          - extra fields merged into `RTCConfiguration`.
     */
    constructor(peerId, signaling, options = {}) {
        if (typeof peerId !== 'string' || peerId.length === 0) {
            throw new WebRtcError('Peer requires a non-empty peerId', { code: 'ZQ_WEBRTC_PEER_BAD_ID' });
        }
        if (!signaling || typeof signaling.send !== 'function' || typeof signaling.on !== 'function') {
            throw new WebRtcError('Peer requires a SignalingClient-like object', { code: 'ZQ_WEBRTC_PEER_BAD_SIGNALING' });
        }

        const PCCtor = options.RTCPeerConnection
            || (typeof globalThis !== 'undefined' && globalThis.RTCPeerConnection)
            || null;
        if (!PCCtor) {
            throw new WebRtcError(
                'RTCPeerConnection is not available in this environment',
                { code: 'ZQ_WEBRTC_NO_RTC' }
            );
        }

        const rtcConfig = Object.assign(
            { iceServers: options.iceServers || [] },
            options.rtcConfig || {}
        );

        this.id            = peerId;
        this.signaling     = signaling;
        this.polite        = !!options.polite;
        this.pc            = new PCCtor(rtcConfig);
        this.closed        = false;
        this.makingOffer   = false;
        this.ignoreOffer   = false;
        this.srdAnswerPending = false;

        this._listeners        = new Map();
        this._maxIceCandidates = options.maxIceCandidates || DEFAULT_MAX_ICE_CANDIDATES;
        this._sentCandidates   = 0;
        this._sigUnsub         = [];

        this._attachPc();
        this._attachSignaling();
    }

    // -----------------------------------------------------------------------
    // Event surface
    // -----------------------------------------------------------------------

    /**
     * Subscribe to a Peer-level event.
     *
     * @param {string}   type
     * @param {Function} cb
     * @returns {Function} unsubscribe
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
     * @param {string} type
     * @param {*}      payload
     * @private
     */
    _emit(type, payload) {
        const set = this._listeners.get(type);
        if (!set || set.size === 0) return;
        for (const cb of [...set]) {
            try { cb(payload); }
            catch (_) { /* listener errors must not break negotiation */ }
        }
    }

    // -----------------------------------------------------------------------
    // Track / datachannel passthrough
    // -----------------------------------------------------------------------

    /**
     * Add a local track to this peer. Returns the `RTCRtpSender` so the caller
     * can later `replaceTrack()` or `removeTrack()` it directly.
     *
     * @param {MediaStreamTrack} track
     * @param {...MediaStream}   streams
     * @returns {*}
     */
    addTrack(track, ...streams) {
        return this.pc.addTrack(track, ...streams);
    }

    /**
     * Remove a previously-added sender from the peer.
     *
     * @param {*} sender
     */
    removeTrack(sender) {
        return this.pc.removeTrack(sender);
    }

    /**
     * Create a data channel on this peer. The remote side observes a
     * `datachannel` event on its own `Peer`.
     *
     * @param {string} label
     * @param {RTCDataChannelInit} [init]
     * @returns {RTCDataChannel}
     */
    createDataChannel(label, init) {
        return this.pc.createDataChannel(label, init);
    }

    /**
     * Force ICE restart - useful from app code after detecting a long
     * `disconnected` window. Negotiation kicks off automatically via
     * `negotiationneeded`.
     */
    restartIce() {
        if (this.closed) return;
        try { this.pc.restartIce(); }
        catch (err) {
            this._emit('error', new IceError(err.message || 'restartIce failed', {
                code: 'ZQ_WEBRTC_ICE_RESTART_FAILED',
                cause: err,
            }));
        }
    }

    /**
     * Close the underlying `RTCPeerConnection` and detach signaling listeners.
     * Idempotent.
     */
    close() {
        if (this.closed) return;
        this.closed = true;

        for (const off of this._sigUnsub) { try { off(); } catch (_) {} }
        this._sigUnsub.length = 0;

        try { this.pc.close(); } catch (_) {}
        this._emit('close');
    }

    // -----------------------------------------------------------------------
    // Internal: RTCPeerConnection wiring
    // -----------------------------------------------------------------------

    /** @private */
    _attachPc() {
        this.pc.onnegotiationneeded = async () => {
            if (this.closed) return;
            try {
                this.makingOffer = true;
                await this.pc.setLocalDescription();
                const desc = this.pc.localDescription;
                if (!desc || !desc.sdp) return;
                this.signaling.send('offer', { to: this.id, sdp: desc.sdp });
            } catch (err) {
                this._emit('error', new SdpError(err.message || 'offer failed', {
                    code: 'ZQ_WEBRTC_SDP_OFFER_FAILED',
                    cause: err,
                }));
            } finally {
                this.makingOffer = false;
            }
        };

        this.pc.onicecandidate = (event) => {
            if (this.closed) return;
            const candidate = event && event.candidate;
            // End-of-candidates marker (null) -> always forward.
            if (!candidate) {
                this.signaling.send('ice', { to: this.id, candidate: null });
                return;
            }
            const cand = typeof candidate === 'string' ? candidate : candidate.candidate;
            if (!cand) return;
            // Drop mDNS candidates - servers / non-mDNS peers can't resolve them.
            if (cand.indexOf('.local') !== -1) return;
            if (this._sentCandidates >= this._maxIceCandidates) return;
            this._sentCandidates++;
            this.signaling.send('ice', { to: this.id, candidate: cand });
        };

        this.pc.ontrack = (event) => {
            if (this.closed) return;
            this._emit('track', event);
        };

        this.pc.ondatachannel = (event) => {
            if (this.closed) return;
            this._emit('datachannel', event);
        };

        this.pc.onconnectionstatechange = () => {
            if (this.closed) return;
            const state = this.pc.connectionState;
            this._emit('connectionstatechange', state);
            if (state === 'failed') {
                try { this.pc.restartIce(); } catch (_) { /* swallow */ }
            }
        };
    }

    /** @private */
    _attachSignaling() {
        const guard = (cb) => (msg) => {
            if (this.closed) return;
            if (!msg || msg.from !== this.id) return;
            cb(msg);
        };
        this._sigUnsub.push(
            this.signaling.on('offer',  guard((m) => this._onRemoteDescription('offer',  m.sdp))),
            this.signaling.on('answer', guard((m) => this._onRemoteDescription('answer', m.sdp))),
            this.signaling.on('ice',    guard((m) => this._onRemoteCandidate(m.candidate))),
        );
    }

    /**
     * @param {'offer'|'answer'} kind
     * @param {string|object} sdp
     * @private
     */
    async _onRemoteDescription(kind, sdp) {
        // Accept either a full description object (some servers relay it that
        // way) or a bare SDP string; normalize to { type, sdp }.
        const description = typeof sdp === 'string'
            ? { type: kind, sdp }
            : sdp;

        try {
            const ready = !this.makingOffer
                && (this.pc.signalingState === 'stable' || this.srdAnswerPending);
            const offerCollision = description.type === 'offer' && !ready;
            this.ignoreOffer = !this.polite && offerCollision;
            if (this.ignoreOffer) return;

            this.srdAnswerPending = description.type === 'answer';
            await this.pc.setRemoteDescription(description);
            this.srdAnswerPending = false;

            if (description.type === 'offer') {
                await this.pc.setLocalDescription();
                const local = this.pc.localDescription;
                if (local && local.sdp) {
                    this.signaling.send('answer', { to: this.id, sdp: local.sdp });
                }
            }
        } catch (err) {
            this._emit('error', new SdpError(err.message || 'setRemoteDescription failed', {
                code: 'ZQ_WEBRTC_SDP_APPLY_FAILED',
                cause: err,
            }));
        }
    }

    /**
     * @param {string|null} candidate - raw `a=candidate:` line or `null` for EOC.
     * @private
     */
    async _onRemoteCandidate(candidate) {
        try {
            if (candidate == null) {
                // End-of-candidates: addIceCandidate(null) is the spec-compliant signal.
                await this.pc.addIceCandidate(null);
                return;
            }
            await this.pc.addIceCandidate({ candidate });
        } catch (err) {
            // The W3C pattern: suppress errors while we're explicitly ignoring an offer.
            if (this.ignoreOffer) return;
            this._emit('error', new IceError(err.message || 'addIceCandidate failed', {
                code: 'ZQ_WEBRTC_ICE_ADD_FAILED',
                cause: err,
            }));
        }
    }
}

// --- src/webrtc/room.js ------------------------------------------
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





// ---------------------------------------------------------------------------
// Room
// ---------------------------------------------------------------------------

/**
 * High-level handle around a joined room.
 *
 * Do not call `new Room(...)` directly - use `webrtc.join()`. The
 * constructor is exported for type-checking and testing only.
 */
class Room {
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
async function join(url, opts) {
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

// --- src/webrtc/reactive.js --------------------------------------
/**
 * src/webrtc/reactive.js - reactive composables on top of `Room`
 *
 * Thin wrappers that adapt the Room / Peer surface into the project's
 * `signal()`/`effect()` primitives. They mirror the surface described in
 * the roadmap: `useRoom`, `usePeer`, `useTracks`, `useDataChannel`, and
 * `useConnectionQuality`. Each returns either a `Signal` (cleanup via the
 * room's `leave()`) or a small object with a `.close()` / `.dispose()`
 * method - callers manage lifetime explicitly since the component runtime
 * does not currently expose `onCleanup`.
 */




/**
 * Join a room and return a Promise that resolves to a `Room` whose
 * `peers` / `localTracks` signals can be consumed directly. The returned
 * Promise also exposes a `.dispose()` shortcut (`room.leave()`); when the
 * room is closed, signals stop updating.
 *
 * Two call shapes:
 *   useRoom(url, opts)                  → join via signaling
 *   useRoom(roomInstance)               → wrap an existing Room (composability)
 *
 * @param {string|Room} urlOrRoom
 * @param {object} [opts]
 * @returns {Promise<Room>}
 */
function useRoom(urlOrRoom, opts) {
    if (urlOrRoom instanceof Room) {
        return Promise.resolve(urlOrRoom);
    }
    if (typeof urlOrRoom !== 'string') {
        return Promise.reject(new WebRtcError(
            'useRoom: first argument must be a signaling URL or a Room',
            { code: 'ZQ_WEBRTC_USE_ROOM_BAD_ARG' }
        ));
    }
    return join(urlOrRoom, opts || {});
}


/**
 * Reactive view of a single remote peer.
 *
 * @param {Room} room
 * @param {string} peerId
 * @returns {{ readonly value: object | null, dispose: () => void }}
 *   A getter-only signal-like with `.value` (the PeerInfo or `null` if absent)
 *   and `.dispose()` to stop listening.
 */
function usePeer(room, peerId) {
    if (!(room instanceof Room)) {
        throw new WebRtcError('usePeer: room must be a Room instance', { code: 'ZQ_WEBRTC_USE_PEER_BAD_ROOM' });
    }
    if (typeof peerId !== 'string' || peerId.length === 0) {
        throw new WebRtcError('usePeer: peerId must be a non-empty string', { code: 'ZQ_WEBRTC_USE_PEER_BAD_ID' });
    }

    const out = signal(null);
    const refresh = () => {
        const map = room.peers.peek();
        const info = map.get(peerId) || null;
        if (info !== out.peek()) out.value = info;
    };
    refresh();
    const unsub = room.peers.subscribe(refresh);
    return {
        get value() { return out.value; },
        peek() { return out.peek(); },
        subscribe(cb) { return out.subscribe(cb); },
        dispose() { try { unsub(); } catch (_) {} },
    };
}


/**
 * Reactive list of a peer's currently-attached `MediaStreamTrack`s.
 *
 * @param {object} peerInfo - The PeerInfo object yielded by `room.peers`.
 * @returns {{ readonly value: MediaStreamTrack[], dispose: () => void }}
 */
function useTracks(peerInfo) {
    if (!peerInfo || !peerInfo.stream) {
        throw new WebRtcError('useTracks: peerInfo.stream is required', { code: 'ZQ_WEBRTC_USE_TRACKS_BAD_PEER' });
    }
    const sig = signal(_safeGetTracks(peerInfo.stream));

    const refresh = () => {
        const next = _safeGetTracks(peerInfo.stream);
        // Replace the array reference so subscribers always notify.
        sig.value = next;
    };

    let unsub = null;
    const stream = peerInfo.stream;
    if (typeof stream.addEventListener === 'function') {
        stream.addEventListener('addtrack', refresh);
        stream.addEventListener('removetrack', refresh);
        unsub = () => {
            try { stream.removeEventListener('addtrack', refresh); } catch (_) {}
            try { stream.removeEventListener('removetrack', refresh); } catch (_) {}
        };
    }

    return {
        get value() { return sig.value; },
        peek() { return sig.peek(); },
        subscribe(cb) { return sig.subscribe(cb); },
        /** Manually re-sample (useful in tests / environments without addtrack events). */
        refresh,
        dispose() { if (unsub) unsub(); },
    };
}


/**
 * Reactive data-channel wrapper backed by `room.dataChannel(label)`.
 *
 * @param {Room} room
 * @param {string} label
 * @param {{ history?: number, opts?: RTCDataChannelInit }} [opts]
 * @returns {{
 *   messages: { readonly value: Array<{ data: any, from: string, at: number }>, peek: () => any[], subscribe: (cb: Function) => () => void },
 *   send: (data: any) => void,
 *   close: () => void,
 *   dispose: () => void,
 * }}
 */
function useDataChannel(room, label, opts) {
    if (!(room instanceof Room)) {
        throw new WebRtcError('useDataChannel: room must be a Room instance', { code: 'ZQ_WEBRTC_USE_DC_BAD_ROOM' });
    }
    if (typeof label !== 'string' || label.length === 0) {
        throw new WebRtcError('useDataChannel: label must be a non-empty string', { code: 'ZQ_WEBRTC_USE_DC_BAD_LABEL' });
    }
    const history = opts && typeof opts.history === 'number' ? opts.history : 100;
    const wrap = room.dataChannel(label, opts && opts.opts);

    const messages = signal([]);
    const off = wrap.on('message', (data, from) => {
        const entry = { data, from, at: Date.now() };
        const next = messages.peek().slice();
        next.push(entry);
        if (next.length > history) next.splice(0, next.length - history);
        messages.value = next;
    });

    return {
        messages: {
            get value() { return messages.value; },
            peek() { return messages.peek(); },
            subscribe(cb) { return messages.subscribe(cb); },
        },
        send(data) { wrap.send(data); },
        close() {
            try { off(); } catch (_) {}
            try { wrap.close(); } catch (_) {}
        },
        dispose() {
            try { off(); } catch (_) {}
        },
    };
}


/**
 * Periodically sample `peer.pc.getStats()` and map the result to a
 * three-bucket connection quality classifier. Returns a signal-like with
 * `.value` and `.dispose()` for cleanup.
 *
 * Heuristic (intentionally simple - more nuance lands with the
 * observability pass):
 *   - 'good' if packetLossPct < 2 AND rtt < 200
 *   - 'fair' if packetLossPct < 10 AND rtt < 500
 *   - else 'poor'
 *
 * @param {object} peerInfo - PeerInfo from `room.peers`.
 * @param {{ intervalMs?: number, getStats?: () => Promise<any> }} [opts]
 * @returns {{ readonly value: 'good'|'fair'|'poor', dispose: () => void }}
 */
function useConnectionQuality(peerInfo, opts) {
    if (!peerInfo || !peerInfo.pc) {
        throw new WebRtcError('useConnectionQuality: peerInfo.pc is required', { code: 'ZQ_WEBRTC_USE_CQ_BAD_PEER' });
    }
    const intervalMs = opts && typeof opts.intervalMs === 'number' ? opts.intervalMs : 2000;
    const sampler = opts && typeof opts.getStats === 'function'
        ? opts.getStats
        : () => peerInfo.pc.getStats();

    const sig = signal('good');
    let stopped = false;

    const sample = async () => {
        if (stopped) return;
        try {
            const report = await sampler();
            const q = _classifyStats(report);
            if (q !== sig.peek()) sig.value = q;
        } catch (_) {
            // sampling failures don't change the bucket
        }
    };

    sample();
    const timer = setInterval(sample, intervalMs);

    return {
        get value() { return sig.value; },
        peek() { return sig.peek(); },
        subscribe(cb) { return sig.subscribe(cb); },
        dispose() {
            stopped = true;
            clearInterval(timer);
        },
    };
}


// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function _safeGetTracks(stream) {
    if (stream && typeof stream.getTracks === 'function') {
        try { return stream.getTracks(); }
        catch (_) { return []; }
    }
    return [];
}

/**
 * Convert a `getStats()` report to a `'good' | 'fair' | 'poor'` bucket.
 * The report can be a `RTCStatsReport`-like (Map / iterable of stat objects)
 * or a plain object map.
 */
function _classifyStats(report) {
    const stats = [];
    if (report && typeof report.forEach === 'function') {
        report.forEach((v) => stats.push(v));
    } else if (report && typeof report === 'object') {
        for (const k of Object.keys(report)) stats.push(report[k]);
    }

    let inbound = null;
    let pair = null;
    for (const s of stats) {
        if (!s || typeof s !== 'object') continue;
        if (s.type === 'inbound-rtp' && !inbound) inbound = s;
        if (s.type === 'candidate-pair' && (s.state === 'succeeded' || s.nominated)) pair = s;
    }

    let lossPct = 0;
    if (inbound && typeof inbound.packetsLost === 'number' && typeof inbound.packetsReceived === 'number') {
        const total = inbound.packetsLost + inbound.packetsReceived;
        lossPct = total > 0 ? (inbound.packetsLost / total) * 100 : 0;
    }
    const rttMs = pair && typeof pair.currentRoundTripTime === 'number'
        ? pair.currentRoundTripTime * 1000
        : 0;

    if (lossPct < 2 && rttMs < 200) return 'good';
    if (lossPct < 10 && rttMs < 500) return 'fair';
    return 'poor';
}

// --- src/webrtc/turn.js ------------------------------------------
/**
 * src/webrtc/turn.js - TURN credential client
 *
 * Tiny HTTP helper for the `@zero-server/webrtc` TURN-credential endpoint
 * (`issueTurnCredentials`). Fetches `{ username, credential, urls, ttl }`
 * and exposes an `RTCIceServer[]` for direct injection into
 * `RTCPeerConnection({ iceServers })`. A `createTurnRefresher` factory
 * schedules an automatic refresh before the credentials expire.
 */


/**
 * Fetch a TURN credential bundle from `url`.
 *
 * @param {string} url
 * @param {RequestInit} [opts]
 * @returns {Promise<{username: string, credential: string, urls: string[], ttl: number}>}
 */
async function fetchTurnCredentials(url, opts) {
    if (typeof url !== 'string' || !url) {
        throw new TurnError('fetchTurnCredentials: url must be a non-empty string', {
            code: 'ZQ_WEBRTC_TURN_BAD_URL',
        });
    }
    const fetchImpl = (opts && opts.fetch) || (typeof fetch !== 'undefined' ? fetch : null);
    if (!fetchImpl) {
        throw new TurnError('fetchTurnCredentials: no fetch implementation available', {
            code: 'ZQ_WEBRTC_TURN_NO_FETCH',
        });
    }

    const init = { ...(opts || {}) };
    delete init.fetch;

    let res;
    try {
        res = await fetchImpl(url, init);
    } catch (err) {
        throw new TurnError(`fetchTurnCredentials: network error - ${err && err.message ? err.message : err}`, {
            code: 'ZQ_WEBRTC_TURN_NETWORK',
            cause: err instanceof Error ? err : undefined,
            context: { url },
        });
    }

    if (!res || !res.ok) {
        const status = res ? res.status : 0;
        throw new TurnError(`fetchTurnCredentials: HTTP ${status}`, {
            code: 'ZQ_WEBRTC_TURN_HTTP',
            context: { url, status },
        });
    }

    let body;
    try {
        body = await res.json();
    } catch (err) {
        throw new TurnError('fetchTurnCredentials: response is not valid JSON', {
            code: 'ZQ_WEBRTC_TURN_BAD_JSON',
            cause: err instanceof Error ? err : undefined,
            context: { url },
        });
    }

    return _validateCredentials(body, url);
}


/**
 * Merge TURN credentials with an optional base `iceServers` array, producing
 * the final list to pass to `RTCPeerConnection`. The base list is preserved
 * unchanged; the TURN bundle is appended as a single entry. Duplicate URL
 * entries are dropped (first occurrence wins).
 *
 * @param {RTCIceServer[]} [base]
 * @param {{username: string, credential: string, urls: string[]}} [turn]
 * @returns {RTCIceServer[]}
 */
function mergeIceServers(base, turn) {
    const list = [];
    const seen = new Set();
    const pushServer = (server) => {
        if (!server || !server.urls) return;
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        const fresh = urls.filter((u) => {
            if (typeof u !== 'string' || !u) return false;
            if (seen.has(u)) return false;
            seen.add(u);
            return true;
        });
        if (fresh.length === 0) return;
        const next = { ...server, urls: fresh };
        list.push(next);
    };

    if (Array.isArray(base)) {
        for (const s of base) pushServer(s);
    }
    if (turn && Array.isArray(turn.urls) && turn.urls.length > 0) {
        pushServer({
            urls: turn.urls,
            username: turn.username,
            credential: turn.credential,
        });
    }
    return list;
}


/**
 * Schedule automatic TURN-credential refresh ahead of expiry.
 *
 * Returns a handle:
 * - `start()` — fetch once immediately, then auto-refresh.
 * - `refresh()` — force an immediate refresh.
 * - `stop()` — cancel any pending timer.
 * - `peek()` / `value` — last successfully fetched credentials (or `null`).
 *
 * @param {{
 *     url: string,
 *     fetch?: typeof fetch,
 *     leadMs?: number,
 *     minIntervalMs?: number,
 *     onRefresh?: (creds: {username: string, credential: string, urls: string[], ttl: number}) => void,
 *     onError?: (err: Error) => void,
 *     requestInit?: RequestInit,
 * }} opts
 */
function createTurnRefresher(opts) {
    if (!opts || typeof opts.url !== 'string' || !opts.url) {
        throw new TurnError('createTurnRefresher: opts.url is required', {
            code: 'ZQ_WEBRTC_TURN_REFRESHER_BAD_URL',
        });
    }
    const url           = opts.url;
    const fetchImpl     = opts.fetch || null;
    const leadMs        = Number.isFinite(opts.leadMs) ? opts.leadMs : 30000;
    const minIntervalMs = Number.isFinite(opts.minIntervalMs) ? opts.minIntervalMs : 5000;
    const onRefresh     = typeof opts.onRefresh === 'function' ? opts.onRefresh : null;
    const onError       = typeof opts.onError   === 'function' ? opts.onError   : null;
    const requestInit   = opts.requestInit || undefined;

    let timer   = null;
    let stopped = false;
    let current = null;

    const handle = {
        get value() { return current; },
        peek()      { return current; },
        async refresh() {
            if (stopped) return null;
            try {
                const init = fetchImpl ? { ...(requestInit || {}), fetch: fetchImpl } : requestInit;
                const creds = await fetchTurnCredentials(url, init);
                if (stopped) return creds;
                current = creds;
                _schedule(creds.ttl);
                if (onRefresh) onRefresh(creds);
                return creds;
            } catch (err) {
                if (!stopped && onError) onError(err);
                if (!stopped) _schedule(60);   // retry in 60s on failure
                throw err;
            }
        },
        async start() {
            if (stopped) return null;
            return handle.refresh();
        },
        stop() {
            stopped = true;
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        },
    };

    function _schedule(ttlSeconds) {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        const ms = Math.max(minIntervalMs, ttlSeconds * 1000 - leadMs);
        timer = setTimeout(() => {
            timer = null;
            handle.refresh().catch(() => {});
        }, ms);
        if (timer && typeof timer.unref === 'function') timer.unref();
    }

    return handle;
}


function _validateCredentials(body, url) {
    if (!body || typeof body !== 'object') {
        throw new TurnError('fetchTurnCredentials: response is not an object', {
            code: 'ZQ_WEBRTC_TURN_BAD_BODY',
            context: { url },
        });
    }
    const { username, credential, urls, ttl } = body;
    if (typeof username !== 'string' || !username) {
        throw new TurnError('fetchTurnCredentials: response.username missing', {
            code: 'ZQ_WEBRTC_TURN_BAD_BODY',
            context: { url, field: 'username' },
        });
    }
    if (typeof credential !== 'string' || !credential) {
        throw new TurnError('fetchTurnCredentials: response.credential missing', {
            code: 'ZQ_WEBRTC_TURN_BAD_BODY',
            context: { url, field: 'credential' },
        });
    }
    if (!Array.isArray(urls) || urls.length === 0 || !urls.every((u) => typeof u === 'string' && u)) {
        throw new TurnError('fetchTurnCredentials: response.urls must be a non-empty string array', {
            code: 'ZQ_WEBRTC_TURN_BAD_BODY',
            context: { url, field: 'urls' },
        });
    }
    const ttlNum = Number(ttl);
    if (!Number.isFinite(ttlNum) || ttlNum <= 0) {
        throw new TurnError('fetchTurnCredentials: response.ttl must be a positive number', {
            code: 'ZQ_WEBRTC_TURN_BAD_BODY',
            context: { url, field: 'ttl' },
        });
    }
    return {
        username,
        credential,
        urls: urls.slice(),
        ttl: ttlNum,
    };
}

// --- src/webrtc/e2ee.js ------------------------------------------
/**
 * src/webrtc/e2ee.js - SFrame-style end-to-end encryption
 *
 * Provides a small AES-GCM SFrame implementation suitable for
 * `RTCRtpScriptTransform` / Encoded Transforms wiring. Frames are wrapped
 * as `[1-byte epoch][12-byte IV][N-byte ciphertext+tag]` so receivers can
 * route a frame to the correct key without an out-of-band signal.
 *
 * Key derivation: PBKDF2(passphrase, salt) -> HKDF -> AES-GCM-128. The
 * salt is intended to be a room id so two clients of the same room with
 * the same passphrase derive the same key.
 *
 * The actual `RTCRtpScriptTransform` wiring lives in `attachE2ee()`; the
 * core encryptFrame / decryptFrame helpers are pure and run anywhere
 * WebCrypto is available (browsers, jsdom, Node 18+).
 */


const AES_GCM_KEY_BITS  = 128;
const IV_BYTES          = 12;
const HEADER_BYTES      = 1 + IV_BYTES;  // 1-byte epoch + 12-byte IV
const PBKDF2_ITERATIONS = 100_000;
const HKDF_INFO         = new TextEncoder().encode('zquery-sframe-v1');


/**
 * @returns {SubtleCrypto}
 */
function _subtle() {
    const subtle = typeof crypto !== 'undefined' && crypto.subtle ? crypto.subtle : null;
    if (!subtle) {
        throw new E2eeError('WebCrypto SubtleCrypto is not available in this environment', {
            code: 'ZQ_WEBRTC_E2EE_NO_WEBCRYPTO',
        });
    }
    return subtle;
}

function _randomBytes(n) {
    const buf = new Uint8Array(n);
    if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
        throw new E2eeError('crypto.getRandomValues is not available in this environment', {
            code: 'ZQ_WEBRTC_E2EE_NO_RANDOM',
        });
    }
    crypto.getRandomValues(buf);
    return buf;
}

function _asUint8(input) {
    if (input instanceof Uint8Array)             return input;
    if (input instanceof ArrayBuffer)            return new Uint8Array(input);
    if (ArrayBuffer.isView(input))               return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    // Handle cross-realm ArrayBuffer (jsdom / VM contexts).
    if (input && typeof input === 'object' && typeof input.byteLength === 'number'
        && Object.prototype.toString.call(input) === '[object ArrayBuffer]') {
        return new Uint8Array(input);
    }
    throw new E2eeError('expected a BufferSource (Uint8Array | ArrayBuffer | typed array)', {
        code: 'ZQ_WEBRTC_E2EE_BAD_INPUT',
    });
}


/**
 * Derive an AES-GCM-128 SFrame key from a passphrase + salt (typically
 * the room id). Two clients calling this with the same inputs produce
 * the same key.
 *
 * @param {string} passphrase
 * @param {string} salt
 * @returns {Promise<CryptoKey>}
 */
async function deriveSFrameKey(passphrase, salt) {
    if (typeof passphrase !== 'string' || !passphrase) {
        throw new E2eeError('deriveSFrameKey: passphrase must be a non-empty string', {
            code: 'ZQ_WEBRTC_E2EE_BAD_PASSPHRASE',
        });
    }
    if (typeof salt !== 'string' || !salt) {
        throw new E2eeError('deriveSFrameKey: salt must be a non-empty string', {
            code: 'ZQ_WEBRTC_E2EE_BAD_SALT',
        });
    }
    const subtle = _subtle();
    const enc    = new TextEncoder();
    const baseKey = await subtle.importKey(
        'raw', enc.encode(passphrase), { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const pbkdfBits = await subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: PBKDF2_ITERATIONS },
        baseKey,
        256
    );
    const hkdfKey = await subtle.importKey(
        'raw', pbkdfBits, { name: 'HKDF' }, false, ['deriveKey']
    );
    return subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: enc.encode(salt), info: HKDF_INFO },
        hkdfKey,
        { name: 'AES-GCM', length: AES_GCM_KEY_BITS },
        false,
        ['encrypt', 'decrypt']
    );
}


/**
 * Generate a fresh random AES-GCM-128 SFrame key.
 *
 * @returns {Promise<CryptoKey>}
 */
async function generateSFrameKey() {
    return _subtle().generateKey(
        { name: 'AES-GCM', length: AES_GCM_KEY_BITS },
        true,
        ['encrypt', 'decrypt']
    );
}


/**
 * Holds the current key + epoch for an SFrame transform pair. Receivers
 * keep a sliding window of accepted epochs (old keys retained briefly so
 * in-flight frames decode after a rotation; oldest evicted on each
 * `setKey`).
 */
class SFrameContext {
    /**
     * @param {{maxEpochs?: number}} [opts]
     */
    constructor(opts) {
        const max = opts && Number.isFinite(opts.maxEpochs) ? opts.maxEpochs : 4;
        /** @private */ this._keys       = new Map();   // epoch -> CryptoKey
        /** @private */ this._maxEpochs  = Math.max(1, max);
        /** @public  */ this.currentEpoch = 0;
    }

    /**
     * Install `key` for `epoch` and mark it as the encrypt key. Evicts the
     * oldest epoch when more than `maxEpochs` are tracked.
     *
     * @param {number} epoch
     * @param {CryptoKey} key
     */
    setKey(epoch, key) {
        if (!Number.isInteger(epoch) || epoch < 0 || epoch > 255) {
            throw new E2eeError('SFrameContext.setKey: epoch must be an integer in [0, 255]', {
                code: 'ZQ_WEBRTC_E2EE_BAD_EPOCH',
            });
        }
        if (!key) {
            throw new E2eeError('SFrameContext.setKey: key required', {
                code: 'ZQ_WEBRTC_E2EE_BAD_KEY',
            });
        }
        this._keys.set(epoch, key);
        this.currentEpoch = epoch;
        while (this._keys.size > this._maxEpochs) {
            const oldest = this._keys.keys().next().value;
            this._keys.delete(oldest);
        }
    }

    /** Drop a previously installed epoch (e.g. forward-secret evict on peer-leave). */
    removeEpoch(epoch) {
        this._keys.delete(epoch);
    }

    /** Return the key for `epoch`, or `null` if unknown / evicted. */
    getKey(epoch) {
        return this._keys.get(epoch) || null;
    }

    /** Number of epochs currently tracked. */
    get epochCount() {
        return this._keys.size;
    }
}


/**
 * Encrypt one frame using the context's current epoch key.
 *
 * Output layout: `[1-byte epoch][12-byte IV][ciphertext + 16-byte tag]`.
 *
 * @param {SFrameContext} ctx
 * @param {BufferSource} payload
 * @returns {Promise<Uint8Array>}
 */
async function encryptFrame(ctx, payload) {
    if (!(ctx instanceof SFrameContext)) {
        throw new E2eeError('encryptFrame: ctx must be an SFrameContext', {
            code: 'ZQ_WEBRTC_E2EE_BAD_CTX',
        });
    }
    const key = ctx.getKey(ctx.currentEpoch);
    if (!key) {
        throw new E2eeError(`encryptFrame: no key installed for epoch ${ctx.currentEpoch}`, {
            code: 'ZQ_WEBRTC_E2EE_NO_KEY',
            context: { epoch: ctx.currentEpoch },
        });
    }
    const plain   = _asUint8(payload);
    const iv      = _randomBytes(IV_BYTES);
    const cipher  = new Uint8Array(await _subtle().encrypt({ name: 'AES-GCM', iv }, key, plain));
    const out     = new Uint8Array(HEADER_BYTES + cipher.byteLength);
    out[0]        = ctx.currentEpoch & 0xff;
    out.set(iv, 1);
    out.set(cipher, HEADER_BYTES);
    return out;
}


/**
 * Decrypt one frame produced by `encryptFrame`. Returns the plaintext as a
 * `Uint8Array`. Throws `E2eeError` if the epoch is unknown or AES-GCM
 * authentication fails.
 *
 * @param {SFrameContext} ctx
 * @param {BufferSource} frame
 * @returns {Promise<Uint8Array>}
 */
async function decryptFrame(ctx, frame) {
    if (!(ctx instanceof SFrameContext)) {
        throw new E2eeError('decryptFrame: ctx must be an SFrameContext', {
            code: 'ZQ_WEBRTC_E2EE_BAD_CTX',
        });
    }
    const bytes = _asUint8(frame);
    if (bytes.byteLength <= HEADER_BYTES) {
        throw new E2eeError('decryptFrame: frame too short for SFrame header', {
            code: 'ZQ_WEBRTC_E2EE_SHORT_FRAME',
        });
    }
    const epoch = bytes[0];
    const key   = ctx.getKey(epoch);
    if (!key) {
        throw new E2eeError(`decryptFrame: no key for epoch ${epoch}`, {
            code: 'ZQ_WEBRTC_E2EE_UNKNOWN_EPOCH',
            context: { epoch },
        });
    }
    const iv     = bytes.subarray(1, HEADER_BYTES);
    const cipher = bytes.subarray(HEADER_BYTES);
    let   plain;
    try {
        plain = new Uint8Array(await _subtle().decrypt({ name: 'AES-GCM', iv }, key, cipher));
    } catch (err) {
        throw new E2eeError('decryptFrame: AES-GCM authentication failed', {
            code: 'ZQ_WEBRTC_E2EE_AUTH_FAILED',
            cause: err instanceof Error ? err : undefined,
            context: { epoch },
        });
    }
    return plain;
}


/**
 * Attach SFrame encrypt/decrypt transforms to every existing and future
 * RTP sender/receiver on `pc`. Uses `RTCRtpScriptTransform` where
 * available, falls back to the legacy `createEncodedStreams()` API on
 * older engines.
 *
 * @param {RTCPeerConnection} pc
 * @param {SFrameContext} ctx
 * @returns {{refresh(): void, detach(): void}}
 */
function attachE2ee(pc, ctx) {
    if (!pc || typeof pc.getSenders !== 'function' || typeof pc.getReceivers !== 'function') {
        throw new E2eeError('attachE2ee: pc must look like an RTCPeerConnection', {
            code: 'ZQ_WEBRTC_E2EE_BAD_PC',
        });
    }
    if (!(ctx instanceof SFrameContext)) {
        throw new E2eeError('attachE2ee: ctx must be an SFrameContext', {
            code: 'ZQ_WEBRTC_E2EE_BAD_CTX',
        });
    }

    const wired = new WeakSet();
    let detached = false;

    function wireSender(sender) {
        if (detached || wired.has(sender)) return;
        wired.add(sender);
        const stream = _maybeEncodedStreams(sender);
        if (!stream) return;
        const transformer = new TransformStream({
            async transform(chunk, controller) {
                try {
                    const payload = _asUint8(chunk.data);
                    const out     = await encryptFrame(ctx, payload);
                    chunk.data    = out.buffer;
                    controller.enqueue(chunk);
                } catch (_) {
                    // drop frame on encrypt failure (no key yet, etc.)
                }
            },
        });
        stream.readable.pipeThrough(transformer).pipeTo(stream.writable).catch(() => {});
    }

    function wireReceiver(receiver) {
        if (detached || wired.has(receiver)) return;
        wired.add(receiver);
        const stream = _maybeEncodedStreams(receiver);
        if (!stream) return;
        const transformer = new TransformStream({
            async transform(chunk, controller) {
                try {
                    const payload = _asUint8(chunk.data);
                    const out     = await decryptFrame(ctx, payload);
                    chunk.data    = out.buffer;
                    controller.enqueue(chunk);
                } catch (_) {
                    // drop undecryptable frame
                }
            },
        });
        stream.readable.pipeThrough(transformer).pipeTo(stream.writable).catch(() => {});
    }

    function refresh() {
        if (detached) return;
        for (const s of pc.getSenders())   wireSender(s);
        for (const r of pc.getReceivers()) wireReceiver(r);
    }

    refresh();

    return {
        refresh,
        detach() { detached = true; },
    };
}


function _maybeEncodedStreams(senderOrReceiver) {
    if (typeof senderOrReceiver.createEncodedStreams === 'function') {
        try {
            return senderOrReceiver.createEncodedStreams();
        } catch (_) {
            return null;
        }
    }
    return null;
}

// --- src/webrtc/joinToken.js -------------------------------------
/**
 * src/webrtc/joinToken.js
 *
 * UX-only decoder for the opaque join tokens minted server-side by
 * `signJoinToken({ secret, user, room, exp, ... })` in
 * `@zero-server/webrtc`. The client never trusts the payload — the
 * server re-validates the signature on every `join` — but it's useful to
 * surface things like "expires in 5 minutes" or "room name preview" in
 * the UI before sending the token.
 *
 * Supported formats (all base64url-encoded segments separated by `.`):
 *   - 1 segment : `<payload>`
 *   - 2 segments: `<payload>.<sig>`
 *   - 3 segments: `<header>.<payload>.<sig>` (JWT-like)
 */


/**
 * Decode a join token issued by the server.
 *
 * @param {string} token
 * @returns {{ user: { id: string } | null, room: string | null, exp: number | null, raw: any }}
 */
function decodeJoinToken(token) {
    if (typeof token !== 'string' || !token) {
        throw new WebRtcError('decodeJoinToken(token): token must be a non-empty string', {
            code: 'ZQ_WEBRTC_TOKEN_BAD_INPUT',
        });
    }

    const segments = token.split('.');
    if (segments.length < 1 || segments.length > 3) {
        throw new WebRtcError(`decodeJoinToken(token): expected 1-3 base64url segments, got ${segments.length}`, {
            code: 'ZQ_WEBRTC_TOKEN_BAD_SHAPE',
            context: { segments: segments.length },
        });
    }

    const payloadSegment = segments.length === 3 ? segments[1] : segments[0];
    let payload;
    try {
        const json = _base64UrlDecode(payloadSegment);
        payload = JSON.parse(json);
    } catch (cause) {
        throw new WebRtcError('decodeJoinToken(token): payload is not valid base64url-encoded JSON', {
            code: 'ZQ_WEBRTC_TOKEN_BAD_PAYLOAD',
            cause,
        });
    }

    if (!payload || typeof payload !== 'object') {
        throw new WebRtcError('decodeJoinToken(token): payload must be a JSON object', {
            code: 'ZQ_WEBRTC_TOKEN_BAD_PAYLOAD',
        });
    }

    return {
        user: _readUser(payload),
        room: typeof payload.room === 'string' ? payload.room : null,
        exp:  typeof payload.exp  === 'number' ? payload.exp  : null,
        raw:  payload,
    };
}


/**
 * `true` if the token's `exp` (seconds since epoch) is in the past.
 * Tokens without an `exp` are reported as not expired. Clock skew defaults to 0.
 *
 * @param {{ exp: number | null }} decoded   Output of `decodeJoinToken()`.
 * @param {{ nowMs?: number, skewMs?: number }} [opts]
 * @returns {boolean}
 */
function isJoinTokenExpired(decoded, opts = {}) {
    if (!decoded || typeof decoded !== 'object') return false;
    if (typeof decoded.exp !== 'number') return false;
    const nowMs  = typeof opts.nowMs  === 'number' ? opts.nowMs  : Date.now();
    const skewMs = typeof opts.skewMs === 'number' ? opts.skewMs : 0;
    return (decoded.exp * 1000) <= (nowMs - skewMs);
}


// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function _readUser(payload) {
    const u = payload.user;
    if (u && typeof u === 'object' && typeof u.id === 'string') {
        return { id: u.id, ...u };
    }
    if (typeof payload.sub === 'string') {
        return { id: payload.sub };
    }
    return null;
}


function _base64UrlDecode(segment) {
    // Restore standard base64 alphabet + padding.
    let b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad === 2)      b64 += '==';
    else if (pad === 3) b64 += '=';
    else if (pad === 1) throw new Error('invalid base64url length');

    if (typeof atob === 'function') {
        const bin = atob(b64);
        // Decode as UTF-8.
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new TextDecoder().decode(bytes);
    }
    // Node fallback.
    // eslint-disable-next-line no-undef
    return Buffer.from(b64, 'base64').toString('utf8');
}

// --- src/webrtc/observe.js ---------------------------------------
/**
 * src/webrtc/observe.js
 *
 * Low-level WebRTC observability helpers built on top of
 * `RTCPeerConnection.getStats()`. The reactive layer
 * (`useConnectionQuality`) is built on top of these — keeping the raw
 * sampler separate makes it easy to plug stats into logging, dev tools,
 * or telemetry without spinning up the reactive runtime.
 */


/**
 * Take a one-shot getStats() snapshot and reduce it to a flat summary
 * suitable for logging, dashboards, or feeding into `classifyStats()`.
 *
 * @param {RTCPeerConnection} pc
 * @returns {Promise<{
 *   report: any,
 *   inboundRtp: any[],
 *   outboundRtp: any[],
 *   candidatePair: any | null,
 *   summary: { rttMs: number | null, lossPct: number, bytesSent: number, bytesReceived: number }
 * }>}
 */
async function samplePeerStats(pc) {
    if (!pc || typeof pc.getStats !== 'function') {
        throw new WebRtcError('samplePeerStats(pc): RTCPeerConnection required', {
            code: 'ZQ_WEBRTC_OBSERVE_BAD_PC',
        });
    }
    let report;
    try {
        report = await pc.getStats();
    } catch (cause) {
        throw new WebRtcError('samplePeerStats(pc): getStats() failed', {
            code: 'ZQ_WEBRTC_OBSERVE_GETSTATS_FAILED',
            cause,
        });
    }
    return _reduce(report);
}


/**
 * Start a periodic getStats() sampler.
 *
 * @param {RTCPeerConnection} pc
 * @param {{
 *   intervalMs?: number,
 *   onSample?:  (sample: Awaited<ReturnType<typeof samplePeerStats>>) => void,
 *   onError?:   (err: Error) => void,
 *   immediate?: boolean,
 * }} [opts]
 * @returns {{
 *   stop: () => void,
 *   getLatest: () => Awaited<ReturnType<typeof samplePeerStats>> | null,
 * }}
 */
function createStatsSampler(pc, opts = {}) {
    if (!pc || typeof pc.getStats !== 'function') {
        throw new WebRtcError('createStatsSampler(pc): RTCPeerConnection required', {
            code: 'ZQ_WEBRTC_OBSERVE_BAD_PC',
        });
    }
    const intervalMs = typeof opts.intervalMs === 'number' && opts.intervalMs > 0 ? opts.intervalMs : 2000;
    const immediate  = opts.immediate !== false;
    const onSample   = typeof opts.onSample === 'function' ? opts.onSample : null;
    const onError    = typeof opts.onError  === 'function' ? opts.onError  : null;

    let latest  = null;
    let stopped = false;

    const tick = async () => {
        if (stopped) return;
        try {
            const s = await samplePeerStats(pc);
            if (stopped) return;
            latest = s;
            if (onSample) {
                try { onSample(s); } catch (_) { /* user callback errors are swallowed */ }
            }
        } catch (err) {
            if (onError) {
                try { onError(err); } catch (_) { /* user callback errors are swallowed */ }
            }
        }
    };

    if (immediate) tick();
    const timer = setInterval(tick, intervalMs);

    return {
        stop() {
            if (stopped) return;
            stopped = true;
            clearInterval(timer);
        },
        getLatest() { return latest; },
    };
}


/**
 * Bucket a reduced sample into a coarse quality label.
 *
 * @param {{ summary: { rttMs: number | null, lossPct: number } } | null} sample
 * @returns {'good' | 'fair' | 'poor' | 'unknown'}
 */
function classifyStats(sample) {
    if (!sample || !sample.summary) return 'unknown';
    const { rttMs, lossPct } = sample.summary;
    if (rttMs == null && lossPct === 0) return 'unknown';
    if (lossPct > 5 || (rttMs != null && rttMs > 400)) return 'poor';
    if (lossPct > 1 || (rttMs != null && rttMs > 200)) return 'fair';
    return 'good';
}


// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function _reduce(report) {
    const inboundRtp  = [];
    const outboundRtp = [];
    let candidatePair = null;

    const visit = (s) => {
        if (!s || typeof s !== 'object') return;
        if (s.type === 'inbound-rtp')  inboundRtp.push(s);
        if (s.type === 'outbound-rtp') outboundRtp.push(s);
        if (s.type === 'candidate-pair' && (s.nominated || s.state === 'succeeded')) {
            if (!candidatePair) candidatePair = s;
        }
    };

    if (report && typeof report.forEach === 'function') {
        report.forEach(visit);
    } else if (report && typeof report === 'object') {
        for (const k of Object.keys(report)) visit(report[k]);
    }

    let bytesSent = 0;
    let bytesReceived = 0;
    let lostTotal = 0;
    let recvTotal = 0;
    for (const s of outboundRtp) {
        if (typeof s.bytesSent === 'number') bytesSent += s.bytesSent;
    }
    for (const s of inboundRtp) {
        if (typeof s.bytesReceived === 'number') bytesReceived += s.bytesReceived;
        if (typeof s.packetsLost     === 'number') lostTotal += s.packetsLost;
        if (typeof s.packetsReceived === 'number') recvTotal += s.packetsReceived;
    }
    const total = lostTotal + recvTotal;
    const lossPct = total > 0 ? (lostTotal / total) * 100 : 0;

    let rttMs = null;
    if (candidatePair && typeof candidatePair.currentRoundTripTime === 'number') {
        rttMs = candidatePair.currentRoundTripTime * 1000;
    }

    return {
        report,
        inboundRtp,
        outboundRtp,
        candidatePair,
        summary: { rttMs, lossPct, bytesSent, bytesReceived },
    };
}

// --- src/webrtc/sfu/mediasoup.js ---------------------------------
/**
 * src/webrtc/sfu/mediasoup.js
 *
 * Thin wrapper around the optional `mediasoup-client` peer dependency.
 *
 *   - `mediasoup-client` is intentionally NOT bundled. Apps that want it
 *     must `npm install mediasoup-client` themselves.
 *   - If it isn't installed, `createMediasoupAdapter()` throws
 *     `ZQ_WEBRTC_SFU_PEER_MISSING` with an actionable message.
 *   - The adapter exposes the lower-level mediasoup `Device` plus
 *     helpers for `load(routerRtpCapabilities)`, `canProduce(kind)`,
 *     `createSendTransport(params)`, `createRecvTransport(params)`.
 *   - The higher-level `adapter.join(joinOpts)` requires SFU-specific
 *     signaling (request → response over a data channel or HTTP). That
 *     glue lives in the consuming app for now; calling `.join()` throws
 *     `ZQ_WEBRTC_SFU_JOIN_UNAVAILABLE` so the limitation is explicit.
 */


/**
 * Dynamically import `mediasoup-client`. Returns the module's exports.
 * Throws `SfuError(ZQ_WEBRTC_SFU_PEER_MISSING)` if the package is absent.
 *
 * @returns {Promise<any>}
 */
async function _importMediasoupClient() {
    try {
        // The package name is computed at runtime so static bundlers (Vite,
        // Rollup, esbuild) don't try to resolve the optional peer dep at
        // build time and fail the build when it isn't installed.
        const pkg = ['mediasoup', 'client'].join('-');
        return await import(/* @vite-ignore */ pkg);
    } catch (cause) {
        throw new SfuError(
            'mediasoup-client peer dependency is not installed; run `npm install mediasoup-client`',
            { code: 'ZQ_WEBRTC_SFU_PEER_MISSING', cause },
        );
    }
}


/**
 * Build a mediasoup-client adapter.
 *
 * @param {object} [opts]
 * @param {any}    [opts.client]         Pre-imported mediasoup-client module (test hook).
 * @param {object} [opts.deviceOptions]  Forwarded to `new Device(...)`.
 * @returns {Promise<import('./index.js').SfuAdapter>}
 */
async function createMediasoupAdapter(opts = {}) {
    const mod    = opts.client || await _importMediasoupClient();
    const Device = mod.Device || (mod.default && mod.default.Device);
    if (typeof Device !== 'function') {
        throw new SfuError('mediasoup-client module did not expose a Device constructor', {
            code: 'ZQ_WEBRTC_SFU_BAD_MODULE',
        });
    }

    let device;
    try {
        device = new Device(opts.deviceOptions || {});
    } catch (cause) {
        throw new SfuError('failed to construct mediasoup-client Device', {
            code: 'ZQ_WEBRTC_SFU_DEVICE_FAILED',
            cause,
        });
    }

    return {
        name: 'mediasoup',
        device,

        /** Has `device.load({ routerRtpCapabilities })` been called yet? */
        get loaded() {
            return !!device.loaded;
        },

        /**
         * Load the device with the SFU router's RTP capabilities.
         * @param {any} routerRtpCapabilities
         * @returns {Promise<void>}
         */
        async load(routerRtpCapabilities) {
            if (!routerRtpCapabilities || typeof routerRtpCapabilities !== 'object') {
                throw new SfuError('load(routerRtpCapabilities): routerRtpCapabilities required', {
                    code: 'ZQ_WEBRTC_SFU_BAD_RTP_CAPS',
                });
            }
            if (device.loaded) return;
            try {
                await device.load({ routerRtpCapabilities });
            } catch (cause) {
                throw new SfuError('device.load() failed', {
                    code: 'ZQ_WEBRTC_SFU_LOAD_FAILED',
                    cause,
                });
            }
        },

        /**
         * @param {'audio'|'video'} kind
         * @returns {boolean}
         */
        canProduce(kind) {
            if (!device.loaded) {
                throw new SfuError('canProduce(): device not loaded yet', {
                    code: 'ZQ_WEBRTC_SFU_NOT_LOADED',
                });
            }
            return !!device.canProduce(kind);
        },

        /** @param {any} params */
        createSendTransport(params) {
            if (!device.loaded) {
                throw new SfuError('createSendTransport(): device not loaded yet', {
                    code: 'ZQ_WEBRTC_SFU_NOT_LOADED',
                });
            }
            return device.createSendTransport(params);
        },

        /** @param {any} params */
        createRecvTransport(params) {
            if (!device.loaded) {
                throw new SfuError('createRecvTransport(): device not loaded yet', {
                    code: 'ZQ_WEBRTC_SFU_NOT_LOADED',
                });
            }
            return device.createRecvTransport(params);
        },

        /**
         * Reserved for the higher-level join flow once SFU-specific signaling
         * is wired through `Room`. Today, callers should use the device and
         * transport helpers above directly.
         *
         * @param {any} _joinOpts
         * @returns {Promise<never>}
         */
        async join(_joinOpts) {
            throw new SfuError(
                'mediasoup adapter.join() not implemented; use device + createSendTransport/createRecvTransport with your SFU signaling layer',
                { code: 'ZQ_WEBRTC_SFU_JOIN_UNAVAILABLE' },
            );
        },
    };
}

// --- src/webrtc/sfu/livekit.js -----------------------------------
/**
 * src/webrtc/sfu/livekit.js
 *
 * Thin wrapper around the optional `livekit-client` peer dependency.
 *
 *   - `livekit-client` is intentionally NOT bundled. Apps that want it
 *     must `npm install livekit-client` themselves.
 *   - If it isn't installed, `createLivekitAdapter()` throws
 *     `ZQ_WEBRTC_SFU_PEER_MISSING` with an actionable message.
 *   - The adapter exposes a LiveKit `Room` instance plus `connect()` /
 *     `disconnect()` helpers. The higher-level zQuery `Room` mapping
 *     lives in the consuming app for now; calling `.join()` throws
 *     `ZQ_WEBRTC_SFU_JOIN_UNAVAILABLE`.
 */


/**
 * Dynamically import `livekit-client`. Returns the module's exports.
 * Throws `SfuError(ZQ_WEBRTC_SFU_PEER_MISSING)` if the package is absent.
 *
 * @returns {Promise<any>}
 */
async function _importLivekitClient() {
    try {
        // Compose the package name at runtime so static bundlers (Vite,
        // Rollup, esbuild) don't try to resolve the optional peer dep.
        const pkg = ['livekit', 'client'].join('-');
        return await import(/* @vite-ignore */ pkg);
    } catch (cause) {
        throw new SfuError(
            'livekit-client peer dependency is not installed; run `npm install livekit-client`',
            { code: 'ZQ_WEBRTC_SFU_PEER_MISSING', cause },
        );
    }
}


/**
 * Build a LiveKit-client adapter.
 *
 * @param {object} [opts]
 * @param {any}    [opts.client]       Pre-imported livekit-client module (test hook).
 * @param {object} [opts.roomOptions]  Forwarded to `new Room(...)`.
 * @returns {Promise<import('./index.js').SfuAdapter>}
 */
async function createLivekitAdapter(opts = {}) {
    const mod    = opts.client || await _importLivekitClient();
    const RoomCtor = mod.Room || (mod.default && mod.default.Room);
    if (typeof RoomCtor !== 'function') {
        throw new SfuError('livekit-client module did not expose a Room constructor', {
            code: 'ZQ_WEBRTC_SFU_BAD_MODULE',
        });
    }

    let room;
    try {
        room = new RoomCtor(opts.roomOptions || {});
    } catch (cause) {
        throw new SfuError('failed to construct livekit-client Room', {
            code: 'ZQ_WEBRTC_SFU_ROOM_FAILED',
            cause,
        });
    }

    let connected = false;

    return {
        name: 'livekit',
        room,

        /** Has `connect()` resolved at least once and not been undone by disconnect? */
        get connected() {
            return connected;
        },

        /**
         * Connect to a LiveKit server.
         * @param {string} url            LiveKit signaling URL (`wss://...`).
         * @param {string} token          Room access token (JWT) minted server-side.
         * @param {object} [connectOpts]  Forwarded to `room.connect(...)`.
         * @returns {Promise<void>}
         */
        async connect(url, token, connectOpts) {
            if (typeof url !== 'string' || !url) {
                throw new SfuError('connect(url, token): url required', {
                    code: 'ZQ_WEBRTC_SFU_BAD_URL',
                });
            }
            if (typeof token !== 'string' || !token) {
                throw new SfuError('connect(url, token): token required', {
                    code: 'ZQ_WEBRTC_SFU_BAD_TOKEN',
                });
            }
            try {
                await room.connect(url, token, connectOpts);
                connected = true;
            } catch (cause) {
                throw new SfuError('livekit-client Room.connect() failed', {
                    code: 'ZQ_WEBRTC_SFU_CONNECT_FAILED',
                    cause,
                });
            }
        },

        /** Disconnect from the LiveKit server (best effort). */
        async disconnect() {
            if (!connected) return;
            try {
                await room.disconnect();
            } finally {
                connected = false;
            }
        },

        /**
         * Reserved for the higher-level join flow that maps a LiveKit `Room`
         * to a zQuery `Room`. Not implemented yet.
         *
         * @param {any} _joinOpts
         * @returns {Promise<never>}
         */
        async join(_joinOpts) {
            throw new SfuError(
                'livekit adapter.join() not implemented; use connect(url, token) and the underlying livekit-client Room directly',
                { code: 'ZQ_WEBRTC_SFU_JOIN_UNAVAILABLE' },
            );
        },
    };
}

// --- src/webrtc/sfu/index.js -------------------------------------
/**
 * src/webrtc/sfu/index.js
 *
 * SFU adapter registry. Adapters are dynamic-imported so the (optional)
 * peer dependencies (`mediasoup-client`, `livekit-client`) only load
 * when actually used.
 *
 * Public surface:
 *   - `loadSfuAdapter(name, opts?)` → `Promise<SfuAdapter>`
 */




/**
 * @typedef {object} SfuAdapter
 * @property {'mediasoup'|'livekit'} name
 * @property {(joinOpts: any) => Promise<any>} join
 */


/**
 * Load an SFU adapter by name. The adapter's peer dependency must be
 * installed by the consuming app.
 *
 * @param {'mediasoup'|'livekit'} name
 * @param {object} [opts]
 * @returns {Promise<SfuAdapter>}
 */
async function loadSfuAdapter(name, opts = {}) {
    if (name === 'mediasoup') {
        return createMediasoupAdapter(opts);
    }
    if (name === 'livekit') {
        return createLivekitAdapter(opts);
    }
    throw new SfuError(`unknown SFU adapter: ${name}`, {
        code: 'ZQ_WEBRTC_SFU_UNKNOWN',
        context: { name },
    });
}

// --- src/webrtc/index.js -----------------------------------------
/**
 * src/webrtc/index.js - WebRTC public barrel
 *
 * Re-exports the WebRTC error family, low-level building blocks
 * (`SignalingClient`, `Peer`, SDP/ICE helpers), and the high-level
 * `Room` + reactive composables on the `webrtc` namespace.
 */













{ SignalingClient } from './signaling.js';
{ Peer } from './peer.js';
{
    parseSdp, validateSdp, SDP_DIRECTIONS,
} from './sdp.js';
{
    parseCandidate, stringifyCandidate, filterCandidates,
    isPrivateIp, isLoopbackIp, isLinkLocalIp, isMdnsHostname,
    CANDIDATE_TYPES, TCP_TYPES,
} from './ice.js';
{ Room, join } from './room.js';
{
    useRoom, usePeer, useTracks, useDataChannel, useConnectionQuality,
} from './reactive.js';
{
    fetchTurnCredentials, mergeIceServers, createTurnRefresher,
} from './turn.js';
{
    deriveSFrameKey, generateSFrameKey, SFrameContext,
    encryptFrame, decryptFrame, attachE2ee,
} from './e2ee.js';
{ loadSfuAdapter } from './sfu/index.js';
{ createMediasoupAdapter } from './sfu/mediasoup.js';
{ createLivekitAdapter } from './sfu/livekit.js';
{ decodeJoinToken, isJoinTokenExpired } from './joinToken.js';
{ samplePeerStats, createStatsSampler, classifyStats } from './observe.js';
{
    WebRtcError, SignalingError, IceError, SdpError, TurnError, E2eeError, SfuError,
} from './errors.js';


/**
 * High-level WebRTC namespace exposed as `$.webrtc`. Bundles every public
 * member from this module so consumers can reach the full surface through
 * a single import.
 */
const webrtc = {
    SignalingClient,
    Peer,
    Room,
    join,

    // Composables
    useRoom,
    usePeer,
    useTracks,
    useDataChannel,
    useConnectionQuality,

    // TURN client
    fetchTurnCredentials,
    mergeIceServers,
    createTurnRefresher,

    // E2EE
    deriveSFrameKey,
    generateSFrameKey,
    SFrameContext,
    encryptFrame,
    decryptFrame,
    attachE2ee,

    // SFU adapters
    loadSfuAdapter,

    // Join tokens
    decodeJoinToken,
    isJoinTokenExpired,

    // Observability
    samplePeerStats,
    createStatsSampler,
    classifyStats,

    // SDP / ICE helpers
    parseSdp,
    validateSdp,
    parseCandidate,
    stringifyCandidate,
    filterCandidates,
    isPrivateIp,
    isLoopbackIp,
    isLinkLocalIp,
    isMdnsHostname,

    // Errors
    WebRtcError,
    SignalingError,
    IceError,
    SdpError,
    TurnError,
    E2eeError,
    SfuError,
};

// --- src/reactive.js ---------------------------------------------
/**
 * zQuery Reactive - Proxy-based deep reactivity system
 * 
 * Creates observable objects that trigger callbacks on mutation.
 * Used internally by components and store for auto-updates.
 */


// ---------------------------------------------------------------------------
// Deep reactive proxy
// ---------------------------------------------------------------------------
function reactive(target, onChange, _path = '') {
  if (typeof target !== 'object' || target === null) return target;
  if (typeof onChange !== 'function') {
    reportError(ErrorCode.REACTIVE_CALLBACK, 'reactive() onChange must be a function', { received: typeof onChange });
    onChange = () => {};
  }

  const proxyCache = new WeakMap();

  const handler = {
    get(obj, key) {
      if (key === '__isReactive') return true;
      if (key === '__raw') return obj;

      const value = obj[key];
      if (typeof value === 'object' && value !== null) {
        // Return cached proxy or create new one
        if (proxyCache.has(value)) return proxyCache.get(value);
        const childProxy = new Proxy(value, handler);
        proxyCache.set(value, childProxy);
        return childProxy;
      }
      return value;
    },

    set(obj, key, value) {
      const old = obj[key];
      if (old === value) return true;
      obj[key] = value;
      // Invalidate proxy cache for the old value (it may have been replaced)
      if (old && typeof old === 'object') proxyCache.delete(old);
      try {
        onChange(key, value, old);
      } catch (err) {
        reportError(ErrorCode.REACTIVE_CALLBACK, `Reactive onChange threw for key "${String(key)}"`, { key, value, old }, err);
      }
      return true;
    },

    deleteProperty(obj, key) {
      const old = obj[key];
      delete obj[key];
      if (old && typeof old === 'object') proxyCache.delete(old);
      try {
        onChange(key, undefined, old);
      } catch (err) {
        reportError(ErrorCode.REACTIVE_CALLBACK, `Reactive onChange threw for key "${String(key)}"`, { key, old }, err);
      }
      return true;
    }
  };

  return new Proxy(target, handler);
}


// ---------------------------------------------------------------------------
// Signal - lightweight reactive primitive (inspired by Solid/Preact signals)
// ---------------------------------------------------------------------------
class Signal {
  constructor(value) {
    this._value = value;
    this._subscribers = new Set();
  }

  get value() {
    // Track dependency if there's an active effect
    if (Signal._activeEffect) {
      this._subscribers.add(Signal._activeEffect);
      // Record this signal in the effect's dependency set for proper cleanup
      if (Signal._activeEffect._deps) {
        Signal._activeEffect._deps.add(this);
      }
    }
    return this._value;
  }

  set value(newVal) {
    if (this._value === newVal) return;
    this._value = newVal;
    this._notify();
  }

  peek() { return this._value; }

  _notify() {
    if (Signal._batching) {
      Signal._batchQueue.add(this);
      return;
    }
    // Snapshot subscribers before iterating - a subscriber might modify
    // the set (e.g., an effect re-running, adding itself back)
    const subs = [...this._subscribers];
    for (let i = 0; i < subs.length; i++) {
      try { subs[i](); }
      catch (err) {
        reportError(ErrorCode.SIGNAL_CALLBACK, 'Signal subscriber threw', { signal: this }, err);
      }
    }
  }

  subscribe(fn) {
    this._subscribers.add(fn);
    return () => this._subscribers.delete(fn);
  }

  toString() { return String(this._value); }
}

// Active effect tracking
Signal._activeEffect = null;
// Batch state
Signal._batching = false;
Signal._batchQueue = new Set();

/**
 * Create a signal
 * @param {*} initial - initial value
 * @returns {Signal}
 */
function signal(initial) {
  return new Signal(initial);
}

/**
 * Create a computed signal (derived from other signals)
 * @param {Function} fn - computation function
 * @returns {Signal}
 */
function computed(fn) {
  const s = new Signal(undefined);
  effect(() => {
    const v = fn();
    if (v !== s._value) {
      s._value = v;
      s._notify();
    }
  });
  return s;
}

/**
 * Create a side-effect that auto-tracks signal dependencies.
 * Returns a dispose function that removes the effect from all
 * signals it subscribed to - prevents memory leaks.
 *
 * @param {Function} fn - effect function
 * @returns {Function} - dispose function
 */
function effect(fn) {
  const execute = () => {
    // Clean up old subscriptions before re-running so stale
    // dependencies from a previous run are properly removed
    if (execute._deps) {
      for (const sig of execute._deps) {
        sig._subscribers.delete(execute);
      }
      execute._deps.clear();
    }

    Signal._activeEffect = execute;
    try { fn(); }
    catch (err) {
      reportError(ErrorCode.EFFECT_EXEC, 'Effect function threw', {}, err);
    }
    finally { Signal._activeEffect = null; }
  };

  // Track which signals this effect reads from
  execute._deps = new Set();

  execute();
  return () => {
    // Dispose: remove this effect from every signal it subscribed to
    if (execute._deps) {
      for (const sig of execute._deps) {
        sig._subscribers.delete(execute);
      }
      execute._deps.clear();
    }
    // Don't clobber _activeEffect - another effect may be running
  };
}


// ---------------------------------------------------------------------------
// batch() - defer signal notifications until the batch completes
// ---------------------------------------------------------------------------

/**
 * Batch multiple signal writes - subscribers and effects fire once at the end.
 * @param {Function} fn - function that performs signal writes
 */
function batch(fn) {
  if (Signal._batching) {
    // Already inside a batch, just run
    return fn();
  }
  Signal._batching = true;
  Signal._batchQueue.clear();
  let result;
  try {
    result = fn();
  } finally {
    Signal._batching = false;
    // Collect all unique subscribers across all queued signals
    // so each subscriber/effect runs exactly once
    const subs = new Set();
    for (const sig of Signal._batchQueue) {
      for (const sub of sig._subscribers) {
        subs.add(sub);
      }
    }
    Signal._batchQueue.clear();
    for (const sub of subs) {
      try { sub(); }
      catch (err) {
        reportError(ErrorCode.SIGNAL_CALLBACK, 'Signal subscriber threw', {}, err);
      }
    }
  }
  return result;
}


// ---------------------------------------------------------------------------
// untracked() - read signals without creating dependencies
// ---------------------------------------------------------------------------

/**
 * Execute a function without tracking signal reads as dependencies.
 * @param {Function} fn - function to run
 * @returns {*} the return value of fn
 */
function untracked(fn) {
  const prev = Signal._activeEffect;
  Signal._activeEffect = null;
  try {
    return fn();
  } finally {
    Signal._activeEffect = prev;
  }
}

// --- src/diff.js -------------------------------------------------
/**
 * zQuery Diff - Lightweight DOM morphing engine
 *
 * Patches an existing DOM tree to match new HTML without destroying nodes
 * that haven't changed. Preserves focus, scroll positions, third-party
 * widget state, video playback, and other live DOM state.
 *
 * Approach: walk old and new trees in parallel, reconcile node by node.
 * Keyed elements (via `z-key`) get matched across position changes.
 *
 * Performance advantages over virtual DOM (React/Angular):
 *   - No virtual tree allocation or diffing - works directly on real DOM
 *   - Skips unchanged subtrees via fast isEqualNode() check
 *   - z-skip attribute to opt out of diffing entire subtrees
 *   - Reuses a single template element for HTML parsing (zero GC pressure)
 *   - Keyed reconciliation uses LIS (Longest Increasing Subsequence) to
 *     minimize DOM moves - same algorithm as Vue 3 / ivi
 *   - Minimal attribute diffing with early bail-out
 */

// ---------------------------------------------------------------------------
// Reusable template element - avoids per-call allocation
// ---------------------------------------------------------------------------
let _tpl = null;

function _getTemplate() {
  if (!_tpl) _tpl = document.createElement('template');
  return _tpl;
}

// ---------------------------------------------------------------------------
// morph(existingRoot, newHTML) - patch existing DOM to match newHTML
// ---------------------------------------------------------------------------

/**
 * Morph an existing DOM element's children to match new HTML.
 * Only touches nodes that actually differ.
 *
 * @param {Element} rootEl - The live DOM container to patch
 * @param {string} newHTML - The desired HTML string
 */
function morph(rootEl, newHTML) {
  const start = typeof window !== 'undefined' && window.__zqMorphHook ? performance.now() : 0;
  const tpl = _getTemplate();
  tpl.innerHTML = newHTML;
  const newRoot = tpl.content;

  // Move children into a wrapper for consistent handling.
  // We move (not clone) from the template - cheaper than cloning.
  const tempDiv = document.createElement('div');
  while (newRoot.firstChild) tempDiv.appendChild(newRoot.firstChild);

  _morphChildren(rootEl, tempDiv);

  if (start) window.__zqMorphHook(rootEl, performance.now() - start);
}

/**
 * Morph a single element in place - diffs attributes and children
 * without replacing the node reference. Useful for replaceWith-style
 * updates where you want to keep the element identity when the tag
 * name matches.
 *
 * If the new HTML produces a different tag, falls back to native replace.
 *
 * @param {Element} oldEl - The live DOM element to patch
 * @param {string} newHTML - HTML string for the replacement element
 * @returns {Element} - The resulting element (same ref if morphed, new if replaced)
 */
function morphElement(oldEl, newHTML) {
  const start = typeof window !== 'undefined' && window.__zqMorphHook ? performance.now() : 0;
  const tpl = _getTemplate();
  tpl.innerHTML = newHTML;
  const newEl = tpl.content.firstElementChild;
  if (!newEl) return oldEl;

  // Same tag - morph in place (preserves identity, event listeners, refs)
  if (oldEl.nodeName === newEl.nodeName) {
    _morphAttributes(oldEl, newEl);
    _morphChildren(oldEl, newEl);
    if (start) window.__zqMorphHook(oldEl, performance.now() - start);
    return oldEl;
  }

  // Different tag - must replace (can't morph <div> into <span>)
  const clone = newEl.cloneNode(true);
  oldEl.parentNode.replaceChild(clone, oldEl);
  if (start) window.__zqMorphHook(clone, performance.now() - start);
  return clone;
}

// Aliases for the concat build - core.js imports these as _morph / _morphElement,
// but the build strips `import … as` lines, so the aliases must exist at runtime.
const _morph = morph;
const _morphElement = morphElement;

/**
 * Reconcile children of `oldParent` to match `newParent`.
 *
 * @param {Element} oldParent - live DOM parent
 * @param {Element} newParent - desired state parent
 */
function _morphChildren(oldParent, newParent) {
  // Snapshot live NodeLists into arrays - childNodes is live and
  // mutates during insertBefore/removeChild. Using a for loop to push
  // avoids spread operator overhead for large child lists.
  const oldCN = oldParent.childNodes;
  const newCN = newParent.childNodes;
  const oldLen = oldCN.length;
  const newLen = newCN.length;
  const oldChildren = new Array(oldLen);
  const newChildren = new Array(newLen);
  for (let i = 0; i < oldLen; i++) oldChildren[i] = oldCN[i];
  for (let i = 0; i < newLen; i++) newChildren[i] = newCN[i];

  // Scan for keyed elements - only build maps if keys exist
  let hasKeys = false;
  let oldKeyMap, newKeyMap;

  for (let i = 0; i < oldLen; i++) {
    if (_getKey(oldChildren[i]) != null) { hasKeys = true; break; }
  }
  if (!hasKeys) {
    for (let i = 0; i < newLen; i++) {
      if (_getKey(newChildren[i]) != null) { hasKeys = true; break; }
    }
  }

  if (hasKeys) {
    oldKeyMap = new Map();
    newKeyMap = new Map();
    for (let i = 0; i < oldLen; i++) {
      const key = _getKey(oldChildren[i]);
      if (key != null) oldKeyMap.set(key, i);
    }
    for (let i = 0; i < newLen; i++) {
      const key = _getKey(newChildren[i]);
      if (key != null) newKeyMap.set(key, i);
    }
    _morphChildrenKeyed(oldParent, oldChildren, newChildren, oldKeyMap, newKeyMap);
  } else {
    _morphChildrenUnkeyed(oldParent, oldChildren, newChildren);
  }
}

/**
 * Unkeyed reconciliation - positional matching.
 */
function _morphChildrenUnkeyed(oldParent, oldChildren, newChildren) {
  const oldLen = oldChildren.length;
  const newLen = newChildren.length;
  const minLen = oldLen < newLen ? oldLen : newLen;

  // Morph overlapping range
  for (let i = 0; i < minLen; i++) {
    _morphNode(oldParent, oldChildren[i], newChildren[i]);
  }

  // Append new nodes
  if (newLen > oldLen) {
    for (let i = oldLen; i < newLen; i++) {
      oldParent.appendChild(newChildren[i].cloneNode(true));
    }
  }

  // Remove excess old nodes (iterate backwards to avoid index shifting)
  if (oldLen > newLen) {
    for (let i = oldLen - 1; i >= newLen; i--) {
      oldParent.removeChild(oldChildren[i]);
    }
  }
}

/**
 * Keyed reconciliation - match by z-key, reorder with minimal moves
 * using Longest Increasing Subsequence (LIS) to find the maximum set
 * of nodes that are already in the correct relative order, then only
 * move the remaining nodes.
 */
function _morphChildrenKeyed(oldParent, oldChildren, newChildren, oldKeyMap, newKeyMap) {
  const consumed = new Set();
  const newLen = newChildren.length;
  const matched = new Array(newLen);

  // Step 1: Match new children to old children by key
  for (let i = 0; i < newLen; i++) {
    const key = _getKey(newChildren[i]);
    if (key != null && oldKeyMap.has(key)) {
      const oldIdx = oldKeyMap.get(key);
      matched[i] = oldChildren[oldIdx];
      consumed.add(oldIdx);
    } else {
      matched[i] = null;
    }
  }

  // Step 2: Remove old keyed nodes not in the new tree
  for (let i = oldChildren.length - 1; i >= 0; i--) {
    if (!consumed.has(i)) {
      const key = _getKey(oldChildren[i]);
      if (key != null && !newKeyMap.has(key)) {
        oldParent.removeChild(oldChildren[i]);
      }
    }
  }

  // Step 3: Build index array for LIS of matched old indices.
  // This finds the largest set of keyed nodes already in order,
  // so we only need to move the rest - O(n log n) instead of O(n²).
  const oldIndices = [];      // Maps new-position → old-position (or -1)
  for (let i = 0; i < newLen; i++) {
    if (matched[i]) {
      const key = _getKey(newChildren[i]);
      oldIndices.push(oldKeyMap.get(key));
    } else {
      oldIndices.push(-1);
    }
  }

  const lisSet = _lis(oldIndices);

  // Step 4: Insert / reorder / morph - walk new children forward,
  // using LIS to decide which nodes stay in place.
  let cursor = oldParent.firstChild;
  const unkeyedOld = [];
  for (let i = 0; i < oldChildren.length; i++) {
    if (!consumed.has(i) && _getKey(oldChildren[i]) == null) {
      unkeyedOld.push(oldChildren[i]);
    }
  }
  let unkeyedIdx = 0;

  for (let i = 0; i < newLen; i++) {
    const newNode = newChildren[i];
    const newKey = _getKey(newNode);
    let oldNode = matched[i];

    if (!oldNode && newKey == null) {
      oldNode = unkeyedOld[unkeyedIdx++] || null;
    }

    if (oldNode) {
      // If this node is NOT part of the LIS, it needs to be moved
      if (!lisSet.has(i)) {
        oldParent.insertBefore(oldNode, cursor);
      }
      // Capture next sibling BEFORE _morphNode - if _morphNode calls
      // replaceChild, oldNode is removed and nextSibling becomes stale.
      const nextSib = oldNode.nextSibling;
      _morphNode(oldParent, oldNode, newNode);
      cursor = nextSib;
    } else {
      // Insert new node
      const clone = newNode.cloneNode(true);
      if (cursor) {
        oldParent.insertBefore(clone, cursor);
      } else {
        oldParent.appendChild(clone);
      }
    }
  }

  // Remove remaining unkeyed old nodes
  while (unkeyedIdx < unkeyedOld.length) {
    const leftover = unkeyedOld[unkeyedIdx++];
    if (leftover.parentNode === oldParent) {
      oldParent.removeChild(leftover);
    }
  }

  // Remove any remaining keyed old nodes that weren't consumed
  for (let i = 0; i < oldChildren.length; i++) {
    if (!consumed.has(i)) {
      const node = oldChildren[i];
      if (node.parentNode === oldParent && _getKey(node) != null && !newKeyMap.has(_getKey(node))) {
        oldParent.removeChild(node);
      }
    }
  }
}

/**
 * Compute the Longest Increasing Subsequence of an index array.
 * Returns a Set of positions (in the input) that form the LIS.
 * Entries with value -1 (unmatched) are excluded.
 *
 * O(n log n) - same algorithm used by Vue 3 and ivi.
 *
 * @param {number[]} arr - array of old-tree indices (-1 = unmatched)
 * @returns {Set<number>} - positions in arr belonging to the LIS
 */
function _lis(arr) {
  const len = arr.length;
  const result = new Set();
  if (len === 0) return result;

  // tails[i] = index in arr of the smallest tail element for LIS of length i+1
  const tails = [];
  // prev[i] = predecessor index in arr for the LIS ending at arr[i]
  const prev = new Array(len).fill(-1);
  const tailIndices = []; // parallel to tails: actual positions

  for (let i = 0; i < len; i++) {
    if (arr[i] === -1) continue;
    const val = arr[i];

    // Binary search for insertion point in tails
    let lo = 0, hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid] < val) lo = mid + 1;
      else hi = mid;
    }

    tails[lo] = val;
    tailIndices[lo] = i;
    prev[i] = lo > 0 ? tailIndices[lo - 1] : -1;
  }

  // Reconstruct: walk backwards from the last element of LIS
  let k = tailIndices[tails.length - 1];
  for (let i = tails.length - 1; i >= 0; i--) {
    result.add(k);
    k = prev[k];
  }

  return result;
}

/**
 * Morph a single node in place.
 */
function _morphNode(parent, oldNode, newNode) {
  // Text / comment nodes - just update content
  if (oldNode.nodeType === 3 || oldNode.nodeType === 8) {
    if (newNode.nodeType === oldNode.nodeType) {
      if (oldNode.nodeValue !== newNode.nodeValue) {
        oldNode.nodeValue = newNode.nodeValue;
      }
      return;
    }
    // Different node types - replace
    parent.replaceChild(newNode.cloneNode(true), oldNode);
    return;
  }

  // Different node types or tag names - replace entirely
  if (oldNode.nodeType !== newNode.nodeType ||
      oldNode.nodeName !== newNode.nodeName) {
    parent.replaceChild(newNode.cloneNode(true), oldNode);
    return;
  }

  // Both are elements - diff attributes then recurse children
  if (oldNode.nodeType === 1) {
    // z-skip: developer opt-out - skip diffing this subtree entirely.
    // Useful for third-party widgets, canvas, video, or large static content.
    if (oldNode.hasAttribute('z-skip')) return;

    // Fast bail-out: if the elements are identical, skip everything.
    // isEqualNode() is a native C++ comparison - much faster than walking
    // attributes + children in JS when trees haven't changed.
    if (oldNode.isEqualNode(newNode)) return;

    _morphAttributes(oldNode, newNode);

    // Special elements: don't recurse into their children
    const tag = oldNode.nodeName;
    if (tag === 'INPUT') {
      _syncInputValue(oldNode, newNode);
      return;
    }
    if (tag === 'TEXTAREA') {
      if (oldNode.value !== newNode.textContent) {
        oldNode.value = newNode.textContent || '';
      }
      return;
    }
    if (tag === 'SELECT') {
      _morphChildren(oldNode, newNode);
      if (oldNode.value !== newNode.value) {
        oldNode.value = newNode.value;
      }
      return;
    }

    // Generic element - recurse children
    _morphChildren(oldNode, newNode);
  }
}

/**
 * Sync attributes from newEl onto oldEl.
 * Uses a single pass: build a set of new attribute names, iterate
 * old attrs for removals, then apply new attrs.
 */
function _morphAttributes(oldEl, newEl) {
  const newAttrs = newEl.attributes;
  const oldAttrs = oldEl.attributes;
  const newLen = newAttrs.length;
  const oldLen = oldAttrs.length;

  // Fast path: if both have same number of attributes, check if they're identical
  if (newLen === oldLen) {
    let same = true;
    for (let i = 0; i < newLen; i++) {
      const na = newAttrs[i];
      if (oldEl.getAttribute(na.name) !== na.value) { same = false; break; }
    }
    if (same) {
      // Also verify no extra old attrs (names mismatch)
      for (let i = 0; i < oldLen; i++) {
        if (!newEl.hasAttribute(oldAttrs[i].name)) { same = false; break; }
      }
    }
    if (same) return;
  }

  // Build set of new attr names for O(1) lookup during removal pass
  const newNames = new Set();
  for (let i = 0; i < newLen; i++) {
    const attr = newAttrs[i];
    newNames.add(attr.name);
    if (oldEl.getAttribute(attr.name) !== attr.value) {
      oldEl.setAttribute(attr.name, attr.value);
    }
  }

  // Remove stale attributes - snapshot names first because oldAttrs
  // is a live NamedNodeMap that mutates on removeAttribute().
  const oldNames = new Array(oldLen);
  for (let i = 0; i < oldLen; i++) oldNames[i] = oldAttrs[i].name;
  for (let i = oldNames.length - 1; i >= 0; i--) {
    if (!newNames.has(oldNames[i])) {
      oldEl.removeAttribute(oldNames[i]);
    }
  }
}

/**
 * Sync input element value, checked, disabled states.
 *
 * Only updates the value when the new HTML explicitly carries a `value`
 * attribute.  Templates that use z-model manage values through reactive
 * state + _bindModels - the morph engine should not interfere by wiping
 * a live input's content to '' just because the template has no `value`
 * attr.  This prevents the wipe-then-restore cycle that resets cursor
 * position on every keystroke.
 */
function _syncInputValue(oldEl, newEl) {
  const type = (oldEl.type || '').toLowerCase();

  if (type === 'checkbox' || type === 'radio') {
    if (oldEl.checked !== newEl.checked) oldEl.checked = newEl.checked;
  } else {
    const newVal = newEl.getAttribute('value');
    if (newVal !== null && oldEl.value !== newVal) {
      oldEl.value = newVal;
    }
  }

  // Sync disabled
  if (oldEl.disabled !== newEl.disabled) oldEl.disabled = newEl.disabled;
}

/**
 * Get the reconciliation key from a node.
 *
 * Priority: z-key attribute → id attribute → data-id / data-key.
 * Auto-detected keys use a `\0` prefix to avoid collisions with
 * explicit z-key values.
 *
 * This means the LIS-optimised keyed path activates automatically
 * whenever elements carry `id` or `data-id` / `data-key` attributes
 * - no extra markup required.
 *
 * @returns {string|null}
 */
function _getKey(node) {
  if (node.nodeType !== 1) return null;

  // Explicit z-key - highest priority
  const zk = node.getAttribute('z-key');
  if (zk) return zk;

  // Auto-key: id attribute (unique by spec)
  if (node.id) return '\0id:' + node.id;

  // Auto-key: data-id or data-key attributes
  const ds = node.dataset;
  if (ds) {
    if (ds.id)  return '\0data-id:'  + ds.id;
    if (ds.key) return '\0data-key:' + ds.key;
  }

  return null;
}

// --- src/core.js -------------------------------------------------
/**
 * zQuery Core - Selector engine & chainable DOM collection
 * 
 * Extends the quick-ref pattern (Id, Class, Classes, Children)
 * into a full jQuery-like chainable wrapper with modern APIs.
 */


// ---------------------------------------------------------------------------
// ZQueryCollection - wraps an array of elements with chainable methods
// ---------------------------------------------------------------------------
class ZQueryCollection {
  constructor(elements) {
    this.elements = Array.isArray(elements) ? elements : (elements ? [elements] : []);
    this.length = this.elements.length;
    this.elements.forEach((el, i) => { this[i] = el; });
  }

  // --- Iteration -----------------------------------------------------------

  each(fn) {
    this.elements.forEach((el, i) => fn.call(el, i, el));
    return this;
  }

  map(fn) {
    return this.elements.map((el, i) => fn.call(el, i, el));
  }

  forEach(fn) {
    this.elements.forEach((el, i) => fn(el, i, this.elements));
    return this;
  }

  first() { return this.elements[0] || null; }
  last()  { return this.elements[this.length - 1] || null; }
  eq(i)   { return new ZQueryCollection(this.elements[i] ? [this.elements[i]] : []); }
  toArray(){ return [...this.elements]; }

  [Symbol.iterator]() { return this.elements[Symbol.iterator](); }

  // --- Traversal -----------------------------------------------------------

  find(selector) {
    const found = [];
    this.elements.forEach(el => found.push(...el.querySelectorAll(selector)));
    return new ZQueryCollection(found);
  }

  parent() {
    const parents = [...new Set(this.elements.map(el => el.parentElement).filter(Boolean))];
    return new ZQueryCollection(parents);
  }

  closest(selector) {
    return new ZQueryCollection(
      this.elements.map(el => el.closest(selector)).filter(Boolean)
    );
  }

  children(selector) {
    const kids = [];
    this.elements.forEach(el => {
      kids.push(...(selector
        ? el.querySelectorAll(`:scope > ${selector}`)
        : el.children));
    });
    return new ZQueryCollection([...kids]);
  }

  siblings(selector) {
    const sibs = [];
    this.elements.forEach(el => {
      if (!el.parentElement) return;
      const all = [...el.parentElement.children].filter(c => c !== el);
      sibs.push(...(selector ? all.filter(c => c.matches(selector)) : all));
    });
    return new ZQueryCollection(sibs);
  }

  next(selector)  {
    const els = this.elements.map(el => el.nextElementSibling).filter(Boolean);
    return new ZQueryCollection(selector ? els.filter(el => el.matches(selector)) : els);
  }

  prev(selector)  {
    const els = this.elements.map(el => el.previousElementSibling).filter(Boolean);
    return new ZQueryCollection(selector ? els.filter(el => el.matches(selector)) : els);
  }

  nextAll(selector) {
    const result = [];
    this.elements.forEach(el => {
      let sib = el.nextElementSibling;
      while (sib) {
        if (!selector || sib.matches(selector)) result.push(sib);
        sib = sib.nextElementSibling;
      }
    });
    return new ZQueryCollection(result);
  }

  nextUntil(selector, filter) {
    const result = [];
    this.elements.forEach(el => {
      let sib = el.nextElementSibling;
      while (sib) {
        if (selector && sib.matches(selector)) break;
        if (!filter || sib.matches(filter)) result.push(sib);
        sib = sib.nextElementSibling;
      }
    });
    return new ZQueryCollection(result);
  }

  prevAll(selector) {
    const result = [];
    this.elements.forEach(el => {
      let sib = el.previousElementSibling;
      while (sib) {
        if (!selector || sib.matches(selector)) result.push(sib);
        sib = sib.previousElementSibling;
      }
    });
    return new ZQueryCollection(result);
  }

  prevUntil(selector, filter) {
    const result = [];
    this.elements.forEach(el => {
      let sib = el.previousElementSibling;
      while (sib) {
        if (selector && sib.matches(selector)) break;
        if (!filter || sib.matches(filter)) result.push(sib);
        sib = sib.previousElementSibling;
      }
    });
    return new ZQueryCollection(result);
  }

  parents(selector) {
    const result = [];
    this.elements.forEach(el => {
      let parent = el.parentElement;
      while (parent) {
        if (!selector || parent.matches(selector)) result.push(parent);
        parent = parent.parentElement;
      }
    });
    return new ZQueryCollection([...new Set(result)]);
  }

  parentsUntil(selector, filter) {
    const result = [];
    this.elements.forEach(el => {
      let parent = el.parentElement;
      while (parent) {
        if (selector && parent.matches(selector)) break;
        if (!filter || parent.matches(filter)) result.push(parent);
        parent = parent.parentElement;
      }
    });
    return new ZQueryCollection([...new Set(result)]);
  }

  contents() {
    const result = [];
    this.elements.forEach(el => result.push(...el.childNodes));
    return new ZQueryCollection(result);
  }

  filter(selector) {
    if (typeof selector === 'function') {
      return new ZQueryCollection(this.elements.filter(selector));
    }
    return new ZQueryCollection(this.elements.filter(el => el.matches(selector)));
  }

  not(selector) {
    if (typeof selector === 'function') {
      return new ZQueryCollection(this.elements.filter((el, i) => !selector.call(el, i, el)));
    }
    return new ZQueryCollection(this.elements.filter(el => !el.matches(selector)));
  }

  has(selector) {
    return new ZQueryCollection(this.elements.filter(el => el.querySelector(selector)));
  }

  is(selector) {
    if (typeof selector === 'function') {
      return this.elements.some((el, i) => selector.call(el, i, el));
    }
    return this.elements.some(el => el.matches(selector));
  }

  slice(start, end) {
    return new ZQueryCollection(this.elements.slice(start, end));
  }

  add(selector, context) {
    const toAdd = (selector instanceof ZQueryCollection)
      ? selector.elements
      : (selector instanceof Node)
        ? [selector]
        : Array.from((context || document).querySelectorAll(selector));
    return new ZQueryCollection([...this.elements, ...toAdd]);
  }

  get(index) {
    if (index === undefined) return [...this.elements];
    return index < 0 ? this.elements[this.length + index] : this.elements[index];
  }

  index(selector) {
    if (selector === undefined) {
      const el = this.first();
      if (!el || !el.parentElement) return -1;
      return Array.from(el.parentElement.children).indexOf(el);
    }
    const target = (typeof selector === 'string')
      ? document.querySelector(selector)
      : selector;
    return this.elements.indexOf(target);
  }

  // --- Classes -------------------------------------------------------------

  addClass(...names) {
    // Fast path: single class, no spaces - avoids flatMap + regex split allocation
    if (names.length === 1 && names[0].indexOf(' ') === -1) {
      const c = names[0];
      for (let i = 0; i < this.elements.length; i++) this.elements[i].classList.add(c);
      return this;
    }
    const classes = names.flatMap(n => n.split(/\s+/));
    for (let i = 0; i < this.elements.length; i++) this.elements[i].classList.add(...classes);
    return this;
  }

  removeClass(...names) {
    if (names.length === 1 && names[0].indexOf(' ') === -1) {
      const c = names[0];
      for (let i = 0; i < this.elements.length; i++) this.elements[i].classList.remove(c);
      return this;
    }
    const classes = names.flatMap(n => n.split(/\s+/));
    for (let i = 0; i < this.elements.length; i++) this.elements[i].classList.remove(...classes);
    return this;
  }

  toggleClass(...args) {
    const force = typeof args[args.length - 1] === 'boolean' ? args.pop() : undefined;
    // Fast path: single class, no spaces
    if (args.length === 1 && args[0].indexOf(' ') === -1) {
      const c = args[0];
      for (let i = 0; i < this.elements.length; i++) {
        force !== undefined ? this.elements[i].classList.toggle(c, force) : this.elements[i].classList.toggle(c);
      }
      return this;
    }
    const classes = args.flatMap(n => n.split(/\s+/));
    for (let i = 0; i < this.elements.length; i++) {
      const el = this.elements[i];
      for (let j = 0; j < classes.length; j++) {
        force !== undefined ? el.classList.toggle(classes[j], force) : el.classList.toggle(classes[j]);
      }
    }
    return this;
  }

  hasClass(name) {
    return this.first()?.classList.contains(name) || false;
  }

  // --- Attributes ----------------------------------------------------------

  attr(name, value) {
    if (typeof name === 'object' && name !== null) {
      return this.each((_, el) => {
        for (const [k, v] of Object.entries(name)) el.setAttribute(k, v);
      });
    }
    if (value === undefined) return this.first()?.getAttribute(name);
    return this.each((_, el) => el.setAttribute(name, value));
  }

  removeAttr(name) {
    return this.each((_, el) => el.removeAttribute(name));
  }

  prop(name, value) {
    if (value === undefined) return this.first()?.[name];
    return this.each((_, el) => { el[name] = value; });
  }

  data(key, value) {
    if (value === undefined) {
      if (key === undefined) return this.first()?.dataset;
      const raw = this.first()?.dataset[key];
      try { return JSON.parse(raw); } catch { return raw; }
    }
    return this.each((_, el) => { el.dataset[key] = typeof value === 'object' ? JSON.stringify(value) : value; });
  }

  // --- CSS / Dimensions ----------------------------------------------------

  css(props, value) {
    if (typeof props === 'string' && value !== undefined) {
      return this.each((_, el) => { el.style[props] = value; });
    }
    if (typeof props === 'string') {
      const el = this.first();
      return el ? getComputedStyle(el)[props] : undefined;
    }
    return this.each((_, el) => Object.assign(el.style, props));
  }

  width()  { return this.first()?.getBoundingClientRect().width; }
  height() { return this.first()?.getBoundingClientRect().height; }

  offset() {
    const r = this.first()?.getBoundingClientRect();
    return r ? { top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height } : null;
  }

  position() {
    const el = this.first();
    return el ? { top: el.offsetTop, left: el.offsetLeft } : null;
  }

  scrollTop(value) {
    if (value === undefined) {
      const el = this.first();
      return el === window ? window.scrollY : el?.scrollTop;
    }
    return this.each((_, el) => {
      if (el === window) window.scrollTo(window.scrollX, value);
      else el.scrollTop = value;
    });
  }

  scrollLeft(value) {
    if (value === undefined) {
      const el = this.first();
      return el === window ? window.scrollX : el?.scrollLeft;
    }
    return this.each((_, el) => {
      if (el === window) window.scrollTo(value, window.scrollY);
      else el.scrollLeft = value;
    });
  }

  innerWidth() {
    const el = this.first();
    return el?.clientWidth;
  }

  innerHeight() {
    const el = this.first();
    return el?.clientHeight;
  }

  outerWidth(includeMargin = false) {
    const el = this.first();
    if (!el) return undefined;
    let w = el.offsetWidth;
    if (includeMargin) {
      const style = getComputedStyle(el);
      w += parseFloat(style.marginLeft) + parseFloat(style.marginRight);
    }
    return w;
  }

  outerHeight(includeMargin = false) {
    const el = this.first();
    if (!el) return undefined;
    let h = el.offsetHeight;
    if (includeMargin) {
      const style = getComputedStyle(el);
      h += parseFloat(style.marginTop) + parseFloat(style.marginBottom);
    }
    return h;
  }

  // --- Content -------------------------------------------------------------

  html(content) {
    if (content === undefined) return this.first()?.innerHTML;
    // Auto-morph: if the element already has children, use the diff engine
    // to patch the DOM (preserves focus, scroll, state, keyed reorder via LIS).
    // Empty elements get raw innerHTML for fast first-paint - same strategy
    // the component system uses (first render = innerHTML, updates = morph).
    return this.each((_, el) => {
      if (el.childNodes.length > 0) {
        _morph(el, content);
      } else {
        el.innerHTML = content;
      }
    });
  }

  morph(content) {
    return this.each((_, el) => { _morph(el, content); });
  }

  text(content) {
    if (content === undefined) return this.first()?.textContent;
    return this.each((_, el) => { el.textContent = content; });
  }

  val(value) {
    if (value === undefined) return this.first()?.value;
    return this.each((_, el) => { el.value = value; });
  }

  // --- DOM Manipulation ----------------------------------------------------

  append(content) {
    return this.each((_, el) => {
      if (typeof content === 'string') el.insertAdjacentHTML('beforeend', content);
      else if (content instanceof ZQueryCollection) content.each((__, c) => el.appendChild(c));
      else if (content instanceof Node) el.appendChild(content);
    });
  }

  prepend(content) {
    return this.each((_, el) => {
      if (typeof content === 'string') el.insertAdjacentHTML('afterbegin', content);
      else if (content instanceof Node) el.insertBefore(content, el.firstChild);
    });
  }

  after(content) {
    return this.each((_, el) => {
      if (typeof content === 'string') el.insertAdjacentHTML('afterend', content);
      else if (content instanceof Node) el.parentNode.insertBefore(content, el.nextSibling);
    });
  }

  before(content) {
    return this.each((_, el) => {
      if (typeof content === 'string') el.insertAdjacentHTML('beforebegin', content);
      else if (content instanceof Node) el.parentNode.insertBefore(content, el);
    });
  }

  wrap(wrapper) {
    return this.each((_, el) => {
      const w = typeof wrapper === 'string' ? createFragment(wrapper).firstElementChild : wrapper.cloneNode(true);
      if (!w || !el.parentNode) return;
      el.parentNode.insertBefore(w, el);
      w.appendChild(el);
    });
  }

  remove() {
    return this.each((_, el) => el.remove());
  }

  empty() {
    // textContent = '' clears all children without invoking the HTML parser
    return this.each((_, el) => { el.textContent = ''; });
  }

  clone(deep = true) {
    return new ZQueryCollection(this.elements.map(el => el.cloneNode(deep)));
  }

  replaceWith(content) {
    return this.each((_, el) => {
      if (typeof content === 'string') {
        // Auto-morph: diff attributes + children when the tag name matches
        // instead of destroying and re-creating the element.
        _morphElement(el, content);
      } else if (content instanceof Node) {
        el.parentNode.replaceChild(content, el);
      }
    });
  }

  appendTo(target) {
    const dest = typeof target === 'string' ? document.querySelector(target) : target instanceof ZQueryCollection ? target.first() : target;
    if (dest) this.each((_, el) => dest.appendChild(el));
    return this;
  }

  prependTo(target) {
    const dest = typeof target === 'string' ? document.querySelector(target) : target instanceof ZQueryCollection ? target.first() : target;
    if (dest) this.each((_, el) => dest.insertBefore(el, dest.firstChild));
    return this;
  }

  insertAfter(target) {
    const ref = typeof target === 'string' ? document.querySelector(target) : target instanceof ZQueryCollection ? target.first() : target;
    if (ref && ref.parentNode) this.each((_, el) => ref.parentNode.insertBefore(el, ref.nextSibling));
    return this;
  }

  insertBefore(target) {
    const ref = typeof target === 'string' ? document.querySelector(target) : target instanceof ZQueryCollection ? target.first() : target;
    if (ref && ref.parentNode) this.each((_, el) => ref.parentNode.insertBefore(el, ref));
    return this;
  }

  replaceAll(target) {
    const targets = typeof target === 'string'
      ? Array.from(document.querySelectorAll(target))
      : target instanceof ZQueryCollection ? target.elements : [target];
    targets.forEach((t, i) => {
      const nodes = i === 0 ? this.elements : this.elements.map(el => el.cloneNode(true));
      nodes.forEach(el => t.parentNode.insertBefore(el, t));
      t.remove();
    });
    return this;
  }

  unwrap(selector) {
    this.elements.forEach(el => {
      const parent = el.parentElement;
      if (!parent || parent === document.body) return;
      if (selector && !parent.matches(selector)) return;
      parent.replaceWith(...parent.childNodes);
    });
    return this;
  }

  wrapAll(wrapper) {
    const w = typeof wrapper === 'string' ? createFragment(wrapper).firstElementChild : wrapper.cloneNode(true);
    const first = this.first();
    if (!first) return this;
    first.parentNode.insertBefore(w, first);
    this.each((_, el) => w.appendChild(el));
    return this;
  }

  wrapInner(wrapper) {
    return this.each((_, el) => {
      const w = typeof wrapper === 'string' ? createFragment(wrapper).firstElementChild : wrapper.cloneNode(true);
      while (el.firstChild) w.appendChild(el.firstChild);
      el.appendChild(w);
    });
  }

  detach() {
    return this.each((_, el) => el.remove());
  }

  // --- Visibility ----------------------------------------------------------

  show(display = '') {
    return this.each((_, el) => { el.style.display = display; });
  }

  hide() {
    return this.each((_, el) => { el.style.display = 'none'; });
  }

  toggle(display = '') {
    return this.each((_, el) => {
      // Check inline style first (cheap) before forcing layout via getComputedStyle
      const hidden = el.style.display === 'none' || (el.style.display !== '' ? false : getComputedStyle(el).display === 'none');
      el.style.display = hidden ? display : 'none';
    });
  }

  // --- Events --------------------------------------------------------------

  on(event, selectorOrHandler, handler) {
    // Support multiple events: "click mouseenter"
    const events = event.split(/\s+/);
    return this.each((_, el) => {
      events.forEach(evt => {
        if (typeof selectorOrHandler === 'function') {
          el.addEventListener(evt, selectorOrHandler);
        } else if (typeof selectorOrHandler === 'string') {
          // Delegated event - store wrapper so off() can remove it
          const wrapper = (e) => {
            if (!e.target || typeof e.target.closest !== 'function') return;
            const target = e.target.closest(selectorOrHandler);
            if (target && el.contains(target)) handler.call(target, e);
          };
          wrapper._zqOriginal = handler;
          wrapper._zqSelector = selectorOrHandler;
          el.addEventListener(evt, wrapper);
          // Track delegated handlers for removal
          if (!el._zqDelegated) el._zqDelegated = [];
          el._zqDelegated.push({ evt, wrapper });
        }
      });
    });
  }

  off(event, handler) {
    const events = event.split(/\s+/);
    return this.each((_, el) => {
      events.forEach(evt => {
        // Try direct removal first
        el.removeEventListener(evt, handler);
        // Also check delegated handlers
        if (el._zqDelegated) {
          el._zqDelegated = el._zqDelegated.filter(d => {
            if (d.evt === evt && d.wrapper._zqOriginal === handler) {
              el.removeEventListener(evt, d.wrapper);
              return false;
            }
            return true;
          });
        }
      });
    });
  }

  one(event, handler) {
    return this.each((_, el) => {
      el.addEventListener(event, handler, { once: true });
    });
  }

  trigger(event, detail) {
    return this.each((_, el) => {
      el.dispatchEvent(new CustomEvent(event, { detail, bubbles: true, cancelable: true }));
    });
  }

  // Convenience event shorthands
  click(fn)   { return fn ? this.on('click', fn) : this.trigger('click'); }
  submit(fn)  { return fn ? this.on('submit', fn) : this.trigger('submit'); }
  focus()     { this.first()?.focus(); return this; }
  blur()      { this.first()?.blur(); return this; }
  hover(enterFn, leaveFn) {
    this.on('mouseenter', enterFn);
    return this.on('mouseleave', leaveFn || enterFn);
  }

  // --- Animation -----------------------------------------------------------

  animate(props, duration = 300, easing = 'ease') {
    // Empty collection - resolve immediately
    if (this.length === 0) return Promise.resolve(this);
    return new Promise(resolve => {
      let resolved = false;
      const count = { done: 0 };
      const listeners = [];
      this.each((_, el) => {
        el.style.transition = `all ${duration}ms ${easing}`;
        requestAnimationFrame(() => {
          Object.assign(el.style, props);
          const onEnd = () => {
            el.removeEventListener('transitionend', onEnd);
            el.style.transition = '';
            if (!resolved && ++count.done >= this.length) {
              resolved = true;
              resolve(this);
            }
          };
          el.addEventListener('transitionend', onEnd);
          listeners.push({ el, onEnd });
        });
      });
      // Fallback in case transitionend doesn't fire
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          // Clean up any remaining transitionend listeners
          for (const { el, onEnd } of listeners) {
            el.removeEventListener('transitionend', onEnd);
            el.style.transition = '';
          }
          resolve(this);
        }
      }, duration + 50);
    });
  }

  fadeIn(duration = 300) {
    return this.css({ opacity: '0', display: '' }).animate({ opacity: '1' }, duration);
  }

  fadeOut(duration = 300) {
    return this.animate({ opacity: '0' }, duration).then(col => col.hide());
  }

  fadeToggle(duration = 300) {
    return Promise.all(this.elements.map(el => {
      const cs = getComputedStyle(el);
      const visible = cs.opacity !== '0' && cs.display !== 'none';
      const col = new ZQueryCollection([el]);
      return visible ? col.fadeOut(duration) : col.fadeIn(duration);
    })).then(() => this);
  }

  fadeTo(duration, opacity) {
    return this.animate({ opacity: String(opacity) }, duration);
  }

  slideDown(duration = 300) {
    return this.each((_, el) => {
      el.style.display = '';
      el.style.overflow = 'hidden';
      const h = el.scrollHeight + 'px';
      el.style.maxHeight = '0';
      el.style.transition = `max-height ${duration}ms ease`;
      requestAnimationFrame(() => { el.style.maxHeight = h; });
      setTimeout(() => { el.style.maxHeight = ''; el.style.overflow = ''; el.style.transition = ''; }, duration);
    });
  }

  slideUp(duration = 300) {
    return this.each((_, el) => {
      el.style.overflow = 'hidden';
      el.style.maxHeight = el.scrollHeight + 'px';
      el.style.transition = `max-height ${duration}ms ease`;
      requestAnimationFrame(() => { el.style.maxHeight = '0'; });
      setTimeout(() => { el.style.display = 'none'; el.style.maxHeight = ''; el.style.overflow = ''; el.style.transition = ''; }, duration);
    });
  }

  slideToggle(duration = 300) {
    return this.each((_, el) => {
      if (el.style.display === 'none' || getComputedStyle(el).display === 'none') {
        el.style.display = '';
        el.style.overflow = 'hidden';
        const h = el.scrollHeight + 'px';
        el.style.maxHeight = '0';
        el.style.transition = `max-height ${duration}ms ease`;
        requestAnimationFrame(() => { el.style.maxHeight = h; });
        setTimeout(() => { el.style.maxHeight = ''; el.style.overflow = ''; el.style.transition = ''; }, duration);
      } else {
        el.style.overflow = 'hidden';
        el.style.maxHeight = el.scrollHeight + 'px';
        el.style.transition = `max-height ${duration}ms ease`;
        requestAnimationFrame(() => { el.style.maxHeight = '0'; });
        setTimeout(() => { el.style.display = 'none'; el.style.maxHeight = ''; el.style.overflow = ''; el.style.transition = ''; }, duration);
      }
    });
  }

  // --- Form helpers --------------------------------------------------------

  serialize() {
    const form = this.first();
    if (!form || form.tagName !== 'FORM') return '';
    return new URLSearchParams(new FormData(form)).toString();
  }

  serializeObject() {
    const form = this.first();
    if (!form || form.tagName !== 'FORM') return {};
    const obj = {};
    new FormData(form).forEach((v, k) => {
      if (obj[k] !== undefined) {
        if (!Array.isArray(obj[k])) obj[k] = [obj[k]];
        obj[k].push(v);
      } else {
        obj[k] = v;
      }
    });
    return obj;
  }
}


// ---------------------------------------------------------------------------
// Helper - create document fragment from HTML string
// ---------------------------------------------------------------------------
function createFragment(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content;
}


// ---------------------------------------------------------------------------
// $() - main selector / creator (returns ZQueryCollection, like jQuery)
// ---------------------------------------------------------------------------
function query(selector, context) {
  // null / undefined
  if (!selector) return new ZQueryCollection([]);

  // Already a collection - return as-is
  if (selector instanceof ZQueryCollection) return selector;

  // DOM element or Window - wrap in collection
  if (selector instanceof Node || selector === window) {
    return new ZQueryCollection([selector]);
  }

  // NodeList / HTMLCollection / Array - wrap in collection
  if (selector instanceof NodeList || selector instanceof HTMLCollection || Array.isArray(selector)) {
    return new ZQueryCollection(Array.from(selector));
  }

  // HTML string → create elements, wrap in collection
  if (typeof selector === 'string' && selector.trim().startsWith('<')) {
    const fragment = createFragment(selector);
    return new ZQueryCollection([...fragment.childNodes].filter(n => n.nodeType === 1));
  }

  // CSS selector string → querySelectorAll (collection)
  if (typeof selector === 'string') {
    const root = context
      ? (typeof context === 'string' ? document.querySelector(context) : context)
      : document;
    return new ZQueryCollection([...root.querySelectorAll(selector)]);
  }

  return new ZQueryCollection([]);
}


// ---------------------------------------------------------------------------
// $.all() - collection selector (returns ZQueryCollection for CSS selectors)
// ---------------------------------------------------------------------------
function queryAll(selector, context) {
  // null / undefined
  if (!selector) return new ZQueryCollection([]);

  // Already a collection
  if (selector instanceof ZQueryCollection) return selector;

  // DOM element or Window
  if (selector instanceof Node || selector === window) {
    return new ZQueryCollection([selector]);
  }

  // NodeList / HTMLCollection / Array
  if (selector instanceof NodeList || selector instanceof HTMLCollection || Array.isArray(selector)) {
    return new ZQueryCollection(Array.from(selector));
  }

  // HTML string → create elements
  if (typeof selector === 'string' && selector.trim().startsWith('<')) {
    const fragment = createFragment(selector);
    return new ZQueryCollection([...fragment.childNodes].filter(n => n.nodeType === 1));
  }

  // CSS selector string → querySelectorAll (collection)
  if (typeof selector === 'string') {
    const root = context
      ? (typeof context === 'string' ? document.querySelector(context) : context)
      : document;
    return new ZQueryCollection([...root.querySelectorAll(selector)]);
  }

  return new ZQueryCollection([]);
}


// ---------------------------------------------------------------------------
// Quick-ref shortcuts, on $ namespace)
// ---------------------------------------------------------------------------
query.id       = (id) => document.getElementById(id);
query.class    = (name) => document.querySelector(`.${name}`);
query.classes  = (name) => new ZQueryCollection(Array.from(document.getElementsByClassName(name)));
query.tag      = (name) => new ZQueryCollection(Array.from(document.getElementsByTagName(name)));
Object.defineProperty(query, 'name', {
  value: (name) => new ZQueryCollection(Array.from(document.getElementsByName(name))),
  writable: true, configurable: true
});
query.children = (parentId) => {
  const p = document.getElementById(parentId);
  return new ZQueryCollection(p ? Array.from(p.children) : []);
};
query.qs  = (sel, ctx = document) => ctx.querySelector(sel);
query.qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

// Create element shorthand - returns ZQueryCollection for chaining
query.create = (tag, attrs = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'data' && typeof v === 'object') Object.entries(v).forEach(([dk, dv]) => { el.dataset[dk] = dv; });
    else el.setAttribute(k, v);
  }
  children.flat().forEach(child => {
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else if (child instanceof Node) el.appendChild(child);
  });
  return new ZQueryCollection(el);
};

// DOM ready
query.ready = (fn) => {
  if (document.readyState !== 'loading') fn();
  else document.addEventListener('DOMContentLoaded', fn);
};

// Global event listeners - supports direct, delegated, and target-bound forms
//   $.on('keydown', handler)           → direct listener on document
//   $.on('click', '.btn', handler)     → delegated via closest()
//   $.on('scroll', window, handler)    → direct listener on target
query.on = (event, selectorOrHandler, handler) => {
  if (typeof selectorOrHandler === 'function') {
    // 2-arg: direct document listener (keydown, resize, etc.)
    document.addEventListener(event, selectorOrHandler);
    return;
  }
  // EventTarget (window, element, etc.) - direct listener on target
  if (typeof selectorOrHandler === 'object' && typeof selectorOrHandler.addEventListener === 'function') {
    selectorOrHandler.addEventListener(event, handler);
    return;
  }
  // 3-arg string: delegated
  document.addEventListener(event, (e) => {
    if (!e.target || typeof e.target.closest !== 'function') return;
    const target = e.target.closest(selectorOrHandler);
    if (target) handler.call(target, e);
  });
};

// Remove a direct global listener
query.off = (event, handler) => {
  document.removeEventListener(event, handler);
};

// Extend collection prototype (like $.fn in jQuery)
query.fn = ZQueryCollection.prototype;

// --- src/expression.js -------------------------------------------
/**
 * zQuery Expression Parser - CSP-safe expression evaluator
 *
 * Replaces `new Function()` / `eval()` with a hand-written parser that
 * evaluates expressions safely without violating Content Security Policy.
 *
 * Supports:
 *   - Property access:       user.name, items[0], items[i]
 *   - Method calls:          items.length, str.toUpperCase()
 *   - Arithmetic:            a + b, count * 2, i % 2
 *   - Comparison:            a === b, count > 0, x != null
 *   - Logical:               a && b, a || b, !a
 *   - Ternary:               a ? b : c
 *   - Typeof:                typeof x
 *   - Unary:                 -a, +a, !a
 *   - Literals:              42, 'hello', "world", true, false, null, undefined
 *   - Template literals:     `Hello ${name}`
 *   - Array literals:        [1, 2, 3]
 *   - Object literals:       { foo: 'bar', baz: 1 }
 *   - Grouping:              (a + b) * c
 *   - Nullish coalescing:    a ?? b
 *   - Optional chaining:     a?.b, a?.[b], a?.()
 *   - Arrow functions:       x => x.id, (a, b) => a + b
 */

// Token types
const T = {
  NUM: 1, STR: 2, IDENT: 3, OP: 4, PUNC: 5, TMPL: 6, EOF: 7
};

// Operator precedence (higher = binds tighter)
const PREC = {
  '??': 2,
  '||': 3,
  '&&': 4,
  '==': 8, '!=': 8, '===': 8, '!==': 8,
  '<': 9, '>': 9, '<=': 9, '>=': 9, 'instanceof': 9, 'in': 9,
  '+': 11, '-': 11,
  '*': 12, '/': 12, '%': 12,
};

const KEYWORDS = new Set([
  'true', 'false', 'null', 'undefined', 'typeof', 'instanceof', 'in',
  'new', 'void'
]);

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------
function tokenize(expr) {
  const tokens = [];
  let i = 0;
  const len = expr.length;

  while (i < len) {
    const ch = expr[i];

    // Whitespace
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { i++; continue; }

    // Numbers
    if ((ch >= '0' && ch <= '9') || (ch === '.' && i + 1 < len && expr[i + 1] >= '0' && expr[i + 1] <= '9')) {
      let num = '';
      if (ch === '0' && i + 1 < len && (expr[i + 1] === 'x' || expr[i + 1] === 'X')) {
        num = '0x'; i += 2;
        while (i < len && /[0-9a-fA-F]/.test(expr[i])) num += expr[i++];
      } else {
        while (i < len && ((expr[i] >= '0' && expr[i] <= '9') || expr[i] === '.')) num += expr[i++];
        if (i < len && (expr[i] === 'e' || expr[i] === 'E')) {
          num += expr[i++];
          if (i < len && (expr[i] === '+' || expr[i] === '-')) num += expr[i++];
          while (i < len && expr[i] >= '0' && expr[i] <= '9') num += expr[i++];
        }
      }
      tokens.push({ t: T.NUM, v: Number(num) });
      continue;
    }

    // Strings
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let str = '';
      i++;
      while (i < len && expr[i] !== quote) {
        if (expr[i] === '\\' && i + 1 < len) {
          const esc = expr[++i];
          if (esc === 'n') str += '\n';
          else if (esc === 't') str += '\t';
          else if (esc === 'r') str += '\r';
          else if (esc === '\\') str += '\\';
          else if (esc === quote) str += quote;
          else str += esc;
        } else {
          str += expr[i];
        }
        i++;
      }
      i++; // closing quote
      tokens.push({ t: T.STR, v: str });
      continue;
    }

    // Template literals
    if (ch === '`') {
      const parts = []; // alternating: string, expr, string, expr, ...
      let str = '';
      i++;
      while (i < len && expr[i] !== '`') {
        if (expr[i] === '$' && i + 1 < len && expr[i + 1] === '{') {
          parts.push(str);
          str = '';
          i += 2;
          let depth = 1;
          let inner = '';
          while (i < len && depth > 0) {
            if (expr[i] === '{') depth++;
            else if (expr[i] === '}') { depth--; if (depth === 0) break; }
            inner += expr[i++];
          }
          i++; // closing }
          parts.push({ expr: inner });
        } else {
          if (expr[i] === '\\' && i + 1 < len) { str += expr[++i]; }
          else str += expr[i];
          i++;
        }
      }
      i++; // closing backtick
      parts.push(str);
      tokens.push({ t: T.TMPL, v: parts });
      continue;
    }

    // Identifiers & keywords
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$') {
      let ident = '';
      while (i < len && /[\w$]/.test(expr[i])) ident += expr[i++];
      tokens.push({ t: T.IDENT, v: ident });
      continue;
    }

    // Multi-char operators
    const two = expr.slice(i, i + 3);
    if (two === '===' || two === '!==' || two === '?.') {
      if (two === '?.') {
        tokens.push({ t: T.OP, v: '?.' });
        i += 2;
      } else {
        tokens.push({ t: T.OP, v: two });
        i += 3;
      }
      continue;
    }
    const pair = expr.slice(i, i + 2);
    if (pair === '==' || pair === '!=' || pair === '<=' || pair === '>=' ||
        pair === '&&' || pair === '||' || pair === '??' || pair === '?.' ||
        pair === '=>') {
      tokens.push({ t: T.OP, v: pair });
      i += 2;
      continue;
    }

    // Single char operators and punctuation
    if ('+-*/%'.includes(ch)) {
      tokens.push({ t: T.OP, v: ch });
      i++; continue;
    }
    if ('<>=!'.includes(ch)) {
      tokens.push({ t: T.OP, v: ch });
      i++; continue;
    }
    // Spread operator: ...
    if (ch === '.' && i + 2 < len && expr[i + 1] === '.' && expr[i + 2] === '.') {
      tokens.push({ t: T.OP, v: '...' });
      i += 3; continue;
    }
    if ('()[]{},.?:'.includes(ch)) {
      tokens.push({ t: T.PUNC, v: ch });
      i++; continue;
    }

    // Unknown - skip
    i++;
  }

  tokens.push({ t: T.EOF, v: null });
  return tokens;
}

// ---------------------------------------------------------------------------
// Parser - Pratt (precedence climbing)
// ---------------------------------------------------------------------------
class Parser {
  constructor(tokens, scope) {
    this.tokens = tokens;
    this.pos = 0;
    this.scope = scope;
  }

  peek() { return this.tokens[this.pos]; }
  next() { return this.tokens[this.pos++]; }

  expect(type, val) {
    const t = this.next();
    if (t.t !== type || (val !== undefined && t.v !== val)) {
      throw new Error(`Expected ${val || type} but got ${t.v}`);
    }
    return t;
  }

  match(type, val) {
    const t = this.peek();
    if (t.t === type && (val === undefined || t.v === val)) {
      return this.next();
    }
    return null;
  }

  // Main entry
  parse() {
    const result = this.parseExpression(0);
    return result;
  }

  // Precedence climbing
  parseExpression(minPrec) {
    let left = this.parseUnary();

    while (true) {
      const tok = this.peek();

      // Ternary
      if (tok.t === T.PUNC && tok.v === '?') {
        // Distinguish ternary ? from optional chaining ?.
        if (this.tokens[this.pos + 1]?.v !== '.') {
          if (1 <= minPrec) break; // ternary has very low precedence
          this.next(); // consume ?
          const truthy = this.parseExpression(0);
          this.expect(T.PUNC, ':');
          const falsy = this.parseExpression(0);
          left = { type: 'ternary', cond: left, truthy, falsy };
          continue;
        }
      }

      // Binary operators
      if (tok.t === T.OP && tok.v in PREC) {
        const prec = PREC[tok.v];
        if (prec <= minPrec) break;
        this.next();
        const right = this.parseExpression(prec);
        left = { type: 'binary', op: tok.v, left, right };
        continue;
      }

      // instanceof and in as binary operators
      if (tok.t === T.IDENT && (tok.v === 'instanceof' || tok.v === 'in') && PREC[tok.v] > minPrec) {
        const prec = PREC[tok.v];
        this.next();
        const right = this.parseExpression(prec);
        left = { type: 'binary', op: tok.v, left, right };
        continue;
      }

      break;
    }

    return left;
  }

  parseUnary() {
    const tok = this.peek();

    // typeof
    if (tok.t === T.IDENT && tok.v === 'typeof') {
      this.next();
      const arg = this.parseUnary();
      return { type: 'typeof', arg };
    }

    // void
    if (tok.t === T.IDENT && tok.v === 'void') {
      this.next();
      this.parseUnary(); // evaluate but discard
      return { type: 'literal', value: undefined };
    }

    // !expr
    if (tok.t === T.OP && tok.v === '!') {
      this.next();
      const arg = this.parseUnary();
      return { type: 'not', arg };
    }

    // -expr, +expr
    if (tok.t === T.OP && (tok.v === '-' || tok.v === '+')) {
      this.next();
      const arg = this.parseUnary();
      return { type: 'unary', op: tok.v, arg };
    }

    return this.parsePostfix();
  }

  parsePostfix() {
    let left = this.parsePrimary();

    while (true) {
      const tok = this.peek();

      // Property access: a.b
      if (tok.t === T.PUNC && tok.v === '.') {
        this.next();
        const prop = this.next();
        left = { type: 'member', obj: left, prop: prop.v, computed: false };
        // Check for method call: a.b()
        if (this.peek().t === T.PUNC && this.peek().v === '(') {
          left = this._parseCall(left);
        }
        continue;
      }

      // Optional chaining: a?.b, a?.[b], a?.()
      if (tok.t === T.OP && tok.v === '?.') {
        this.next();
        const next = this.peek();
        if (next.t === T.PUNC && next.v === '[') {
          // a?.[expr]
          this.next();
          const prop = this.parseExpression(0);
          this.expect(T.PUNC, ']');
          left = { type: 'optional_member', obj: left, prop, computed: true };
        } else if (next.t === T.PUNC && next.v === '(') {
          // a?.()
          left = { type: 'optional_call', callee: left, args: this._parseArgs() };
        } else {
          // a?.b
          const prop = this.next();
          left = { type: 'optional_member', obj: left, prop: prop.v, computed: false };
          if (this.peek().t === T.PUNC && this.peek().v === '(') {
            left = this._parseCall(left);
          }
        }
        continue;
      }

      // Computed access: a[b]
      if (tok.t === T.PUNC && tok.v === '[') {
        this.next();
        const prop = this.parseExpression(0);
        this.expect(T.PUNC, ']');
        left = { type: 'member', obj: left, prop, computed: true };
        // Check for method call: a[b]()
        if (this.peek().t === T.PUNC && this.peek().v === '(') {
          left = this._parseCall(left);
        }
        continue;
      }

      // Function call: fn()
      if (tok.t === T.PUNC && tok.v === '(') {
        left = this._parseCall(left);
        continue;
      }

      break;
    }

    return left;
  }

  _parseCall(callee) {
    const args = this._parseArgs();
    return { type: 'call', callee, args };
  }

  _parseArgs() {
    this.expect(T.PUNC, '(');
    const args = [];
    while (!(this.peek().t === T.PUNC && this.peek().v === ')') && this.peek().t !== T.EOF) {
      if (this.peek().t === T.OP && this.peek().v === '...') {
        this.next();
        args.push({ type: 'spread', arg: this.parseExpression(0) });
      } else {
        args.push(this.parseExpression(0));
      }
      if (this.peek().t === T.PUNC && this.peek().v === ',') this.next();
    }
    this.expect(T.PUNC, ')');
    return args;
  }

  parsePrimary() {
    const tok = this.peek();

    // Number literal
    if (tok.t === T.NUM) {
      this.next();
      return { type: 'literal', value: tok.v };
    }

    // String literal
    if (tok.t === T.STR) {
      this.next();
      return { type: 'literal', value: tok.v };
    }

    // Template literal
    if (tok.t === T.TMPL) {
      this.next();
      return { type: 'template', parts: tok.v };
    }

    // Arrow function with parens: () =>, (a) =>, (a, b) =>
    // or regular grouping: (expr)
    if (tok.t === T.PUNC && tok.v === '(') {
      const savedPos = this.pos;
      this.next(); // consume (
      const params = [];
      let couldBeArrow = true;

      if (this.peek().t === T.PUNC && this.peek().v === ')') {
        // () => ... - no params
      } else {
        while (couldBeArrow) {
          const p = this.peek();
          if (p.t === T.IDENT && !KEYWORDS.has(p.v)) {
            params.push(this.next().v);
            if (this.peek().t === T.PUNC && this.peek().v === ',') {
              this.next();
            } else {
              break;
            }
          } else {
            couldBeArrow = false;
          }
        }
      }

      if (couldBeArrow && this.peek().t === T.PUNC && this.peek().v === ')') {
        this.next(); // consume )
        if (this.peek().t === T.OP && this.peek().v === '=>') {
          this.next(); // consume =>
          const body = this.parseExpression(0);
          return { type: 'arrow', params, body };
        }
      }

      // Not an arrow - restore and parse as grouping
      this.pos = savedPos;
      this.next(); // consume (
      const expr = this.parseExpression(0);
      this.expect(T.PUNC, ')');
      return expr;
    }

    // Array literal
    if (tok.t === T.PUNC && tok.v === '[') {
      this.next();
      const elements = [];
      while (!(this.peek().t === T.PUNC && this.peek().v === ']') && this.peek().t !== T.EOF) {
        if (this.peek().t === T.OP && this.peek().v === '...') {
          this.next();
          elements.push({ type: 'spread', arg: this.parseExpression(0) });
        } else {
          elements.push(this.parseExpression(0));
        }
        if (this.peek().t === T.PUNC && this.peek().v === ',') this.next();
      }
      this.expect(T.PUNC, ']');
      return { type: 'array', elements };
    }

    // Object literal
    if (tok.t === T.PUNC && tok.v === '{') {
      this.next();
      const properties = [];
      while (!(this.peek().t === T.PUNC && this.peek().v === '}') && this.peek().t !== T.EOF) {
        // Spread in object: { ...obj }
        if (this.peek().t === T.OP && this.peek().v === '...') {
          this.next();
          properties.push({ spread: true, value: this.parseExpression(0) });
          if (this.peek().t === T.PUNC && this.peek().v === ',') this.next();
          continue;
        }

        const keyTok = this.next();
        let key;
        if (keyTok.t === T.IDENT || keyTok.t === T.STR) key = keyTok.v;
        else if (keyTok.t === T.NUM) key = String(keyTok.v);
        else throw new Error('Invalid object key: ' + keyTok.v);

        // Shorthand property: { foo } means { foo: foo }
        if (this.peek().t === T.PUNC && (this.peek().v === ',' || this.peek().v === '}')) {
          properties.push({ key, value: { type: 'ident', name: key } });
        } else {
          this.expect(T.PUNC, ':');
          properties.push({ key, value: this.parseExpression(0) });
        }
        if (this.peek().t === T.PUNC && this.peek().v === ',') this.next();
      }
      this.expect(T.PUNC, '}');
      return { type: 'object', properties };
    }

    // Identifiers & keywords
    if (tok.t === T.IDENT) {
      this.next();

      // Keywords
      if (tok.v === 'true') return { type: 'literal', value: true };
      if (tok.v === 'false') return { type: 'literal', value: false };
      if (tok.v === 'null') return { type: 'literal', value: null };
      if (tok.v === 'undefined') return { type: 'literal', value: undefined };

      // new keyword
      if (tok.v === 'new') {
        let classExpr = this.parsePrimary();
        // Handle member access (e.g. ns.MyClass) without consuming call args
        while (this.peek().t === T.PUNC && this.peek().v === '.') {
          this.next();
          const prop = this.next();
          classExpr = { type: 'member', obj: classExpr, prop: prop.v, computed: false };
        }
        let args = [];
        if (this.peek().t === T.PUNC && this.peek().v === '(') {
          args = this._parseArgs();
        }
        return { type: 'new', callee: classExpr, args };
      }

      // Arrow function: x => expr
      if (this.peek().t === T.OP && this.peek().v === '=>') {
        this.next(); // consume =>
        const body = this.parseExpression(0);
        return { type: 'arrow', params: [tok.v], body };
      }

      return { type: 'ident', name: tok.v };
    }

    // Fallback - return undefined for unparseable
    this.next();
    return { type: 'literal', value: undefined };
  }
}

// ---------------------------------------------------------------------------
// Evaluator - walks the AST, resolves against scope
// ---------------------------------------------------------------------------

/** Safe property access whitelist for built-in prototypes */
const SAFE_ARRAY_METHODS = new Set([
  'length', 'map', 'filter', 'find', 'findIndex', 'some', 'every',
  'reduce', 'reduceRight', 'forEach', 'includes', 'indexOf', 'lastIndexOf',
  'join', 'slice', 'concat', 'flat', 'flatMap', 'reverse', 'sort',
  'fill', 'keys', 'values', 'entries', 'at', 'toString',
]);

const SAFE_STRING_METHODS = new Set([
  'length', 'charAt', 'charCodeAt', 'includes', 'indexOf', 'lastIndexOf',
  'slice', 'substring', 'trim', 'trimStart', 'trimEnd', 'toLowerCase',
  'toUpperCase', 'split', 'replace', 'replaceAll', 'match', 'search',
  'startsWith', 'endsWith', 'padStart', 'padEnd', 'repeat', 'at',
  'toString', 'valueOf',
]);

const SAFE_NUMBER_METHODS = new Set([
  'toFixed', 'toPrecision', 'toString', 'valueOf',
]);

const SAFE_OBJECT_METHODS = new Set([
  'hasOwnProperty', 'toString', 'valueOf',
]);

const SAFE_MATH_PROPS = new Set([
  'PI', 'E', 'LN2', 'LN10', 'LOG2E', 'LOG10E', 'SQRT2', 'SQRT1_2',
  'abs', 'ceil', 'floor', 'round', 'trunc', 'max', 'min', 'pow',
  'sqrt', 'sign', 'random', 'log', 'log2', 'log10',
]);

const SAFE_JSON_PROPS = new Set(['parse', 'stringify']);

/**
 * Check if property access is safe
 */
function _isSafeAccess(obj, prop) {
  // Never allow access to dangerous properties
  const BLOCKED = new Set([
    'constructor', '__proto__', 'prototype', '__defineGetter__',
    '__defineSetter__', '__lookupGetter__', '__lookupSetter__',
    'call', 'apply', 'bind',
  ]);
  if (typeof prop === 'string' && BLOCKED.has(prop)) return false;

  // Always allow plain object/function property access and array index access
  if (obj !== null && obj !== undefined && (typeof obj === 'object' || typeof obj === 'function')) return true;
  if (typeof obj === 'string') return SAFE_STRING_METHODS.has(prop);
  if (typeof obj === 'number') return SAFE_NUMBER_METHODS.has(prop);
  return false;
}

function evaluate(node, scope) {
  if (!node) return undefined;

  switch (node.type) {
    case 'literal':
      return node.value;

    case 'ident': {
      const name = node.name;
      // Check scope layers in order
      for (const layer of scope) {
        if (layer && typeof layer === 'object' && name in layer) {
          return layer[name];
        }
      }
      // Built-in globals (safe ones only)
      if (name === 'Math') return Math;
      if (name === 'JSON') return JSON;
      if (name === 'Date') return Date;
      if (name === 'Array') return Array;
      if (name === 'Object') return Object;
      if (name === 'String') return String;
      if (name === 'Number') return Number;
      if (name === 'Boolean') return Boolean;
      if (name === 'parseInt') return parseInt;
      if (name === 'parseFloat') return parseFloat;
      if (name === 'isNaN') return isNaN;
      if (name === 'isFinite') return isFinite;
      if (name === 'Infinity') return Infinity;
      if (name === 'NaN') return NaN;
      if (name === 'encodeURIComponent') return encodeURIComponent;
      if (name === 'decodeURIComponent') return decodeURIComponent;
      if (name === 'console') return console;
      if (name === 'Map') return Map;
      if (name === 'Set') return Set;
      if (name === 'URL') return URL;
      if (name === 'URLSearchParams') return URLSearchParams;
      return undefined;
    }

    case 'template': {
      // Template literal with interpolation
      let result = '';
      for (const part of node.parts) {
        if (typeof part === 'string') {
          result += part;
        } else if (part && part.expr) {
          result += String(safeEval(part.expr, scope) ?? '');
        }
      }
      return result;
    }

    case 'member': {
      const obj = evaluate(node.obj, scope);
      if (obj == null) return undefined;
      const prop = node.computed ? evaluate(node.prop, scope) : node.prop;
      if (!_isSafeAccess(obj, prop)) return undefined;
      return obj[prop];
    }

    case 'optional_member': {
      const obj = evaluate(node.obj, scope);
      if (obj == null) return undefined;
      const prop = node.computed ? evaluate(node.prop, scope) : node.prop;
      if (!_isSafeAccess(obj, prop)) return undefined;
      return obj[prop];
    }

    case 'call': {
      const result = _resolveCall(node, scope, false);
      return result;
    }

    case 'optional_call': {
      const calleeNode = node.callee;
      const args = _evalArgs(node.args, scope);
      // Method call: obj?.method() - bind `this` to obj
      if (calleeNode.type === 'member' || calleeNode.type === 'optional_member') {
        const obj = evaluate(calleeNode.obj, scope);
        if (obj == null) return undefined;
        const prop = calleeNode.computed ? evaluate(calleeNode.prop, scope) : calleeNode.prop;
        if (!_isSafeAccess(obj, prop)) return undefined;
        const fn = obj[prop];
        if (typeof fn !== 'function') return undefined;
        return fn.apply(obj, args);
      }
      const callee = evaluate(calleeNode, scope);
      if (callee == null) return undefined;
      if (typeof callee !== 'function') return undefined;
      return callee(...args);
    }

    case 'new': {
      const Ctor = evaluate(node.callee, scope);
      if (typeof Ctor !== 'function') return undefined;
      // Only allow safe constructors (no RegExp - ReDoS risk, no Error - info leak)
      if (Ctor === Date || Ctor === Array || Ctor === Map || Ctor === Set ||
          Ctor === URL || Ctor === URLSearchParams) {
        const args = _evalArgs(node.args, scope);
        return new Ctor(...args);
      }
      return undefined;
    }

    case 'binary':
      return _evalBinary(node, scope);

    case 'unary': {
      const val = evaluate(node.arg, scope);
      return node.op === '-' ? -val : +val;
    }

    case 'not':
      return !evaluate(node.arg, scope);

    case 'typeof': {
      try {
        return typeof evaluate(node.arg, scope);
      } catch {
        return 'undefined';
      }
    }

    case 'ternary': {
      const cond = evaluate(node.cond, scope);
      return cond ? evaluate(node.truthy, scope) : evaluate(node.falsy, scope);
    }

    case 'array': {
      const arr = [];
      for (const e of node.elements) {
        if (e.type === 'spread') {
          const iterable = evaluate(e.arg, scope);
          if (iterable != null && typeof iterable[Symbol.iterator] === 'function') {
            for (const v of iterable) arr.push(v);
          }
        } else {
          arr.push(evaluate(e, scope));
        }
      }
      return arr;
    }

    case 'object': {
      const obj = {};
      for (const prop of node.properties) {
        if (prop.spread) {
          const source = evaluate(prop.value, scope);
          if (source != null && typeof source === 'object') {
            Object.assign(obj, source);
          }
        } else {
          obj[prop.key] = evaluate(prop.value, scope);
        }
      }
      return obj;
    }

    case 'arrow': {
      const paramNames = node.params;
      const bodyNode = node.body;
      const closedScope = scope;
      return function(...args) {
        const arrowScope = {};
        paramNames.forEach((name, i) => { arrowScope[name] = args[i]; });
        return evaluate(bodyNode, [arrowScope, ...closedScope]);
      };
    }

    default:
      return undefined;
  }
}

/**
 * Evaluate a list of argument AST nodes, flattening any spread elements.
 */
function _evalArgs(argNodes, scope) {
  const result = [];
  for (const a of argNodes) {
    if (a.type === 'spread') {
      const iterable = evaluate(a.arg, scope);
      if (iterable != null && typeof iterable[Symbol.iterator] === 'function') {
        for (const v of iterable) result.push(v);
      }
    } else {
      result.push(evaluate(a, scope));
    }
  }
  return result;
}

/**
 * Resolve and execute a function call safely.
 */
function _resolveCall(node, scope) {
  const callee = node.callee;
  const args = _evalArgs(node.args, scope);

  // Method call: obj.method() - bind `this` to obj
  if (callee.type === 'member' || callee.type === 'optional_member') {
    const obj = evaluate(callee.obj, scope);
    if (obj == null) return undefined;
    const prop = callee.computed ? evaluate(callee.prop, scope) : callee.prop;
    if (!_isSafeAccess(obj, prop)) return undefined;
    const fn = obj[prop];
    if (typeof fn !== 'function') return undefined;
    return fn.apply(obj, args);
  }

  // Direct call: fn(args)
  const fn = evaluate(callee, scope);
  if (typeof fn !== 'function') return undefined;
  return fn(...args);
}

/**
 * Evaluate binary expression.
 */
function _evalBinary(node, scope) {
  // Short-circuit for logical ops
  if (node.op === '&&') {
    const left = evaluate(node.left, scope);
    return left ? evaluate(node.right, scope) : left;
  }
  if (node.op === '||') {
    const left = evaluate(node.left, scope);
    return left ? left : evaluate(node.right, scope);
  }
  if (node.op === '??') {
    const left = evaluate(node.left, scope);
    return left != null ? left : evaluate(node.right, scope);
  }

  const left = evaluate(node.left, scope);
  const right = evaluate(node.right, scope);

  switch (node.op) {
    case '+': return left + right;
    case '-': return left - right;
    case '*': return left * right;
    case '/': return left / right;
    case '%': return left % right;
    case '==': return left == right;
    case '!=': return left != right;
    case '===': return left === right;
    case '!==': return left !== right;
    case '<': return left < right;
    case '>': return left > right;
    case '<=': return left <= right;
    case '>=': return left >= right;
    case 'instanceof': return left instanceof right;
    case 'in': return left in right;
    default: return undefined;
  }
}


// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Safely evaluate a JS expression string against scope layers.
 *
 * @param {string} expr - expression string
 * @param {object[]} scope - array of scope objects, checked in order
 *   Typical: [loopVars, state, { props, refs, $ }]
 * @returns {*} - evaluation result, or undefined on error
 */

// AST cache (LRU) - avoids re-tokenizing and re-parsing the same expression.
// Uses Map insertion-order: on hit, delete + re-set moves entry to the end.
// Eviction removes the least-recently-used (first) entry when at capacity.
const _astCache = new Map();
const _AST_CACHE_MAX = 512;

function safeEval(expr, scope) {
  try {
    const trimmed = expr.trim();
    if (!trimmed) return undefined;

    // Fast path for simple identifiers: "count", "name", "visible"
    // Avoids full tokenize→parse→evaluate overhead for the most common case.
    if (/^[a-zA-Z_$][\w$]*$/.test(trimmed)) {
      for (const layer of scope) {
        if (layer && typeof layer === 'object' && trimmed in layer) {
          return layer[trimmed];
        }
      }
      // Fall through to full parser for built-in globals (Math, JSON, etc.)
    }

    // Check AST cache (LRU: move to end on hit)
    let ast = _astCache.get(trimmed);
    if (ast) {
      _astCache.delete(trimmed);
      _astCache.set(trimmed, ast);
    } else {
      const tokens = tokenize(trimmed);
      const parser = new Parser(tokens, scope);
      ast = parser.parse();

      // Evict oldest entries when cache is full
      if (_astCache.size >= _AST_CACHE_MAX) {
        const first = _astCache.keys().next().value;
        _astCache.delete(first);
      }
      _astCache.set(trimmed, ast);
    }

    return evaluate(ast, scope);
  } catch (err) {
    if (typeof console !== 'undefined' && console.debug) {
      console.debug(`[zQuery EXPR_EVAL] Failed to evaluate: "${expr}"`, err.message);
    }
    return undefined;
  }
}

// --- src/component.js --------------------------------------------
/**
 * zQuery Component - Lightweight reactive component system
 * 
 * Declarative components using template literals with directive support.
 * Proxy-based state triggers targeted re-renders via event delegation.
 * 
 * Features:
 *   - Reactive state (auto re-render on mutation)
 *   - Template literals with full JS expression power
 *   - @event="method" syntax for event binding (delegated)
 *   - z-ref="name" for element references
 *   - z-model="stateKey" for two-way binding
 *   - Lifecycle hooks: init, mounted, updated, destroyed
 *   - Props passed via attributes
 *   - Scoped styles (inline or via styleUrl)
 *   - External templates via templateUrl (with {{expression}} interpolation)
 *   - External styles via styleUrl (fetched & scoped automatically)
 *   - Relative path resolution - templateUrl and styleUrl
 *     resolve relative to the component file automatically
 */






// ---------------------------------------------------------------------------
// Component registry & external resource cache
// ---------------------------------------------------------------------------
const _registry = new Map();     // name → definition
const _instances = new Map();    // element → instance
const _resourceCache = new Map(); // url → Promise<string>

// Unique ID counter
let _uid = 0;

// Inject z-cloak base style and mobile tap-highlight reset (once, globally)
if (typeof document !== 'undefined' && !document.querySelector('[data-zq-cloak]')) {
  const _s = document.createElement('style');
  _s.textContent = '[z-cloak]{display:none!important}*,*::before,*::after{-webkit-tap-highlight-color:transparent}';
  _s.setAttribute('data-zq-cloak', '');
  document.head.appendChild(_s);
}

// Debounce / throttle helpers for event modifiers
const _debounceTimers = new WeakMap();
const _throttleTimers = new WeakMap();

/**
 * Fetch and cache a text resource (HTML template or CSS file).
 * @param {string} url - URL to fetch
 * @returns {Promise<string>}
 */
function _fetchResource(url) {
  if (_resourceCache.has(url)) return _resourceCache.get(url);

  // Check inline resource map (populated by CLI bundler for file:// support).
  // Keys are relative paths; match against the URL suffix.
  if (typeof window !== 'undefined' && window.__zqInline) {
    for (const [path, content] of Object.entries(window.__zqInline)) {
      if (url === path || url.endsWith('/' + path) || url.endsWith('\\' + path)) {
        const resolved = Promise.resolve(content);
        _resourceCache.set(url, resolved);
        return resolved;
      }
    }
  }

  // Resolve relative URLs against <base href> or origin root.
  // This prevents SPA route paths (e.g. /docs/advanced) from
  // breaking relative resource URLs like 'scripts/components/foo.css'.
  let resolvedUrl = url;
  if (typeof url === 'string' && !url.startsWith('/') && !url.includes(':') && !url.startsWith('//')) {
    try {
      const baseEl = document.querySelector('base');
      const root = baseEl ? baseEl.href : (window.location.origin + '/');
      resolvedUrl = new URL(url, root).href;
    } catch { /* keep original */ }
  }

  const promise = fetch(resolvedUrl).then(res => {
    if (!res.ok) throw new Error(`zQuery: Failed to load resource "${url}" (${res.status})`);
    return res.text();
  });
  _resourceCache.set(url, promise);
  return promise;
}

/**
 * Resolve a relative URL against a base.
 *
 * - If `base` is an absolute URL (http/https/file), resolve directly.
 * - If `base` is a relative path string, resolve it against the page root
 *   (or <base href>) first, then resolve `url` against that.
 * - If `base` is falsy, return `url` unchanged - _fetchResource's own
 *   fallback (page root / <base href>) handles it.
 *
 * @param {string} url   - URL or relative path to resolve
 * @param {string} [base] - auto-detected caller URL or explicit base path
 * @returns {string}
 */
function _resolveUrl(url, base) {
  if (!base || !url || typeof url !== 'string') return url;
  // Already absolute - nothing to do
  if (url.startsWith('/') || url.includes('://') || url.startsWith('//')) return url;
  try {
    if (base.includes('://')) {
      // Absolute base (auto-detected module URL)
      return new URL(url, base).href;
    }
    // Relative base string - resolve against page root first
    const baseEl = document.querySelector('base');
    const root = baseEl ? baseEl.href : (window.location.origin + '/');
    const absBase = new URL(base.endsWith('/') ? base : base + '/', root).href;
    return new URL(url, absBase).href;
  } catch {
    return url;
  }
}

// Capture the library's own script URL at load time for reliable filtering.
// This handles cases where the bundle is renamed (e.g., 'vendor.js').
let _ownScriptUrl;
try {
  if (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) {
    _ownScriptUrl = document.currentScript.src.replace(/[?#].*$/, '');
  }
} catch { /* ignored */ }

/**
 * Detect the URL of the module that called $.component().
 * Parses Error().stack to find the first frame outside the zQuery bundle.
 * Returns the directory URL (with trailing slash) or undefined.
 * @returns {string|undefined}
 */
function _detectCallerBase() {
  try {
    const stack = new Error().stack || '';
    const urls = stack.match(/(?:https?|file):\/\/[^\s\)]+/g) || [];
    for (const raw of urls) {
      // Strip line:col suffixes  e.g. ":3:5" or ":12:1"
      const url = raw.replace(/:\d+:\d+$/, '').replace(/:\d+$/, '');
      // Skip the zQuery library itself - by filename pattern and captured URL
      if (/zquery(\.min)?\.js$/i.test(url)) continue;
      if (_ownScriptUrl && url.replace(/[?#].*$/, '') === _ownScriptUrl) continue;
      // Return directory (strip filename, keep trailing slash)
      return url.replace(/\/[^/]*$/, '/');
    }
  } catch { /* stack parsing unsupported - fall back silently */ }
  return undefined;
}

/**
 * Get a value from a nested object by dot-path.
 * _getPath(obj, 'user.name')  →  obj.user.name
 * @param {object} obj
 * @param {string} path
 * @returns {*}
 */
function _getPath(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

/**
 * Set a value on a nested object by dot-path, walking through proxy layers.
 * _setPath(proxy, 'user.name', 'Tony')  →  proxy.user.name = 'Tony'
 * @param {object} obj
 * @param {string} path
 * @param {*} value
 */
function _setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o && typeof o === 'object') ? o[k] : undefined, obj);
  if (target && typeof target === 'object') target[last] = value;
}


// ---------------------------------------------------------------------------
// Component class
// ---------------------------------------------------------------------------
class Component {
  constructor(el, definition, props = {}) {
    this._uid = ++_uid;
    this._el = el;
    this._def = definition;
    this._mounted = false;
    this._destroyed = false;
    this._updateQueued = false;
    this._listeners = [];
    this._watchCleanups = [];

    // Refs map
    this.refs = {};

    // Capture slot content before first render replaces it
    this._slotContent = {};
    const defaultSlotNodes = [];
    [...el.childNodes].forEach(node => {
      if (node.nodeType === 1 && node.hasAttribute('slot')) {
        const slotName = node.getAttribute('slot') || 'default';
        if (!this._slotContent[slotName]) this._slotContent[slotName] = '';
        this._slotContent[slotName] += node.outerHTML;
      } else if (node.nodeType === 1 || (node.nodeType === 3 && node.textContent.trim())) {
        defaultSlotNodes.push(node.nodeType === 1 ? node.outerHTML : node.textContent);
      }
    });
    if (defaultSlotNodes.length) {
      this._slotContent['default'] = defaultSlotNodes.join('');
    }

    // Props - reactive when definition.props is defined, frozen otherwise
    if (definition.props && typeof definition.props === 'object' && !Array.isArray(definition.props)) {
      // Reactive props with type coercion and defaults
      this.props = this._resolveReactiveProps(definition.props, props);
      // MutationObserver to re-read props when parent re-renders and changes attributes
      this._propObserver = new MutationObserver((mutations) => {
        if (this._destroyed) return;
        let changed = false;
        for (const mut of mutations) {
          if (mut.type === 'attributes') {
            const attrName = mut.attributeName;
            // Skip internal attributes
            if (attrName.startsWith('z-') || attrName.startsWith('@') || attrName.startsWith(':') || attrName.startsWith('data-zq')) continue;
            // Check if this is a defined prop (attribute names are lowercase)
            const propName = attrName.startsWith(':') ? attrName.slice(1) : attrName;
            if (propName in definition.props) {
              changed = true;
            }
          }
        }
        if (changed) {
          this.props = this._resolveReactiveProps(definition.props, {});
          this._scheduleUpdate();
        }
      });
      this._propObserver.observe(el, { attributes: true });
    } else {
      // Legacy: frozen props from parent
      this.props = Object.freeze({ ...props });
    }

    // Store connectors - auto-subscribe to store keys
    this._storeCleanups = [];
    this.stores = {};
    if (definition.stores && typeof definition.stores === 'object') {
      for (const [alias, connector] of Object.entries(definition.stores)) {
        if (!connector || !connector._zqConnector) continue;
        const { store, keys } = connector;
        // Initialize snapshot
        const snap = {};
        for (const key of keys) {
          snap[key] = store.state[key];
        }
        this.stores[alias] = snap;
        // Subscribe to changes
        const unsub = store.subscribe(keys, (key, value) => {
          this.stores[alias][key] = value;
          if (!this._destroyed) this._scheduleUpdate();
        });
        this._storeCleanups.push(unsub);
      }
    }

    // Reactive state
    const initialState = typeof definition.state === 'function'
      ? definition.state()
      : { ...(definition.state || {}) };

    this.state = reactive(initialState, (key, value, old) => {
      if (!this._destroyed) {
        // Run watchers for the changed key
        this._runWatchers(key, value, old);
        this._scheduleUpdate();
      }
    });

    // Computed properties - lazy getters derived from state
    this.computed = {};
    if (definition.computed) {
      for (const [name, fn] of Object.entries(definition.computed)) {
        Object.defineProperty(this.computed, name, {
          get: () => fn.call(this, this.state.__raw || this.state),
          enumerable: true
        });
      }
    }

    // Bind all user methods to this instance
    for (const [key, val] of Object.entries(definition)) {
      if (typeof val === 'function' && !_reservedKeys.has(key)) {
        this[key] = val.bind(this);
      }
    }

    // Init lifecycle
    if (definition.init) {
      try { definition.init.call(this); }
      catch (err) { reportError(ErrorCode.COMP_LIFECYCLE, `Component "${definition._name}" init() threw`, { component: definition._name }, err); }
    }

    // Set up watchers after init so initial state is ready
    if (definition.watch) {
      this._prevWatchValues = {};
      for (const key of Object.keys(definition.watch)) {
        this._prevWatchValues[key] = _getPath(this.state.__raw || this.state, key);
      }
    }
  }

  // Run registered watchers for a changed key
  _runWatchers(changedKey, value, old) {
    const watchers = this._def.watch;
    if (!watchers) return;
    for (const [key, handler] of Object.entries(watchers)) {
      // Match exact key or parent key (e.g. watcher on 'user' fires when 'user.name' changes)
      if (changedKey === key || key.startsWith(changedKey + '.') || changedKey.startsWith(key + '.')) {
        const currentVal = _getPath(this.state.__raw || this.state, key);
        const prevVal = this._prevWatchValues?.[key];
        if (currentVal !== prevVal) {
          const fn = typeof handler === 'function' ? handler : handler.handler;
          if (typeof fn === 'function') fn.call(this, currentVal, prevVal);
          if (this._prevWatchValues) this._prevWatchValues[key] = currentVal;
        }
      }
    }
  }

  // Schedule a batched DOM update (microtask)
  _scheduleUpdate() {
    if (this._updateQueued) return;
    this._updateQueued = true;
    queueMicrotask(() => {
      try {
        if (!this._destroyed) this._render();
      } finally {
        this._updateQueued = false;
      }
    });
  }

  /**
   * Resolve reactive props from the definition's prop schema.
   * Reads from element attributes, applies type coercion and defaults.
   * Passed props (from mount) override attributes.
   * @param {object} propDefs - { propName: { type, default } }
   * @param {object} passedProps - props passed programmatically from mount()
   * @returns {object} resolved props (frozen)
   */
  _resolveReactiveProps(propDefs, passedProps) {
    const resolved = {};
    for (const [name, schema] of Object.entries(propDefs)) {
      const def = typeof schema === 'object' && schema !== null ? schema : { type: schema };
      const type = def.type;
      const defaultVal = def.default;

      // Priority: passed props > dynamic :prop attribute > static attribute > default
      if (name in passedProps) {
        resolved[name] = passedProps[name];
        continue;
      }

      // Check for dynamic :prop attribute (already evaluated by parent mount)
      let rawAttr = this._el.getAttribute(':' + name);
      let hasAttr = rawAttr !== null;
      if (!hasAttr) {
        rawAttr = this._el.getAttribute(name);
        hasAttr = rawAttr !== null;
      }

      if (hasAttr && rawAttr !== null) {
        resolved[name] = this._coercePropValue(rawAttr, type);
      } else if (defaultVal !== undefined) {
        resolved[name] = typeof defaultVal === 'function' ? defaultVal() : defaultVal;
      } else {
        resolved[name] = undefined;
      }
    }
    return Object.freeze(resolved);
  }

  /**
   * Coerce a raw attribute string to the specified type.
   * @param {string} raw - attribute value string
   * @param {Function} type - String, Number, Boolean, Object, or Array
   * @returns {*}
   */
  _coercePropValue(raw, type) {
    if (type === Number) return Number(raw);
    if (type === Boolean) return raw !== 'false' && raw !== '0' && raw !== '';
    if (type === Object || type === Array) {
      try { return JSON.parse(raw); } catch { return raw; }
    }
    return raw; // String or unspecified
  }

  // Load external templateUrl / styleUrl if specified (once per definition)
  //
  // Relative paths are resolved automatically against the component file's
  // own directory (auto-detected at registration time). You can override
  // this with `base: 'some/path/'` on the definition.
  //
  // templateUrl accepts:
  //   - string              → single template (used with {{expr}} interpolation)
  //   - string[]            → array of URLs → indexed map via this.templates[0], …
  //   - { key: url, … }    → named map → this.templates.key
  //
  // styleUrl accepts:
  //   - string              → single stylesheet
  //   - string[]            → array of URLs → all fetched & concatenated
  //
  async _loadExternals() {
    const def = this._def;
    const base = def._base; // auto-detected or explicit

    // -- External templates --------------------------------------
    if (def.templateUrl && !def._templateLoaded) {
      const tu = def.templateUrl;
      if (typeof tu === 'string') {
        def._externalTemplate = await _fetchResource(_resolveUrl(tu, base));
      } else if (Array.isArray(tu)) {
        const urls = tu.map(u => _resolveUrl(u, base));
        const results = await Promise.all(urls.map(u => _fetchResource(u)));
        def._externalTemplates = {};
        results.forEach((html, i) => { def._externalTemplates[i] = html; });
      } else if (typeof tu === 'object') {
        const entries = Object.entries(tu);
        const results = await Promise.all(
          entries.map(([, url]) => _fetchResource(_resolveUrl(url, base)))
        );
        def._externalTemplates = {};
        entries.forEach(([key], i) => { def._externalTemplates[key] = results[i]; });
      }
      def._templateLoaded = true;
    }

    // -- External styles -----------------------------------------
    if (def.styleUrl && !def._styleLoaded) {
      const su = def.styleUrl;
      if (typeof su === 'string') {
        const resolved = _resolveUrl(su, base);
        def._externalStyles = await _fetchResource(resolved);
        def._resolvedStyleUrls = [resolved];
      } else if (Array.isArray(su)) {
        const urls = su.map(u => _resolveUrl(u, base));
        const results = await Promise.all(urls.map(u => _fetchResource(u)));
        def._externalStyles = results.join('\n');
        def._resolvedStyleUrls = urls;
      }
      def._styleLoaded = true;
    }
  }

  // Render the component
  _render() {
    // If externals haven't loaded yet, trigger async load then re-render
    if ((this._def.templateUrl && !this._def._templateLoaded) ||
        (this._def.styleUrl && !this._def._styleLoaded)) {
      this._loadExternals().then(() => {
        if (!this._destroyed) this._render();
      });
      return; // Skip this render - will re-render after load
    }

    // Expose multi-template map on instance (if available)
    if (this._def._externalTemplates) {
      this.templates = this._def._externalTemplates;
    }

    // Determine HTML content
    let html;
    if (this._def.render) {
      // Inline render function takes priority
      html = this._def.render.call(this);
      // Expand z-for in render templates ({{}} expressions for iteration items)
      html = this._expandZFor(html);
    } else if (this._def._externalTemplate) {
      // Expand z-for FIRST (before global {{}} interpolation)
      html = this._expandZFor(this._def._externalTemplate);
      // Then do global {{expression}} interpolation on the remaining content
      html = html.replace(/\{\{(.+?)\}\}/g, (_, expr) => {
        try {
          const result = safeEval(expr.trim(), [
            this.state.__raw || this.state,
            { props: this.props, computed: this.computed, $: typeof window !== 'undefined' ? window.$ : undefined }
          ]);
          return result != null ? escapeHtml(String(result)) : '';
        } catch { return ''; }
      });
    } else {
      html = '';
    }

    // Pre-expand z-html and z-text at string level so the morph engine
    // can diff their content properly (instead of clearing + re-injecting
    // on every re-render). Same pattern as z-for: parse → evaluate → serialize.
    html = this._expandContentDirectives(html);

    // -- Slot distribution ----------------------------------------
    // Replace <slot> elements with captured slot content from parent.
    // <slot> → default slot content
    // <slot name="header"> → named slot content
    // Fallback content between <slot>...</slot> used when no content provided.
    if (html.includes('<slot')) {
      html = html.replace(/<slot(?:\s+name="([^"]*)")?\s*(?:\/>|>([\s\S]*?)<\/slot>)/g, (_, name, fallback) => {
        const slotName = name || 'default';
        return this._slotContent[slotName] || fallback || '';
      });
    }

    // Combine inline styles + external styles
    const combinedStyles = [
      this._def.styles || '',
      this._def._externalStyles || ''
    ].filter(Boolean).join('\n');

    // Apply scoped styles on first render
    if (!this._mounted && combinedStyles) {
      const scopeAttr = `z-s${this._uid}`;
      this._el.setAttribute(scopeAttr, '');
      let noScopeDepth = 0;   // brace depth at which a no-scope @-rule started (0 = none active)
      let braceDepth = 0;     // overall brace depth
      const scoped = combinedStyles.replace(/([^{}]+)\{|\}/g, (match, selector) => {
        if (match === '}') {
          if (noScopeDepth > 0 && braceDepth <= noScopeDepth) noScopeDepth = 0;
          braceDepth--;
          return match;
        }
        braceDepth++;
        const trimmed = selector.trim();
        // Don't scope @-rules themselves
        if (trimmed.startsWith('@')) {
          // @keyframes and @font-face contain non-selector content - skip scoping inside them
          if (/^@(keyframes|font-face)\b/.test(trimmed)) {
            noScopeDepth = braceDepth;
          }
          return match;
        }
        // Inside @keyframes or @font-face - don't scope inner rules
        if (noScopeDepth > 0 && braceDepth > noScopeDepth) {
          return match;
        }
        return selector.split(',').map(s => `[${scopeAttr}] ${s.trim()}`).join(', ') + ' {';
      });
      const styleEl = document.createElement('style');
      styleEl.textContent = scoped;
      styleEl.setAttribute('data-zq-component', this._def._name || '');
      styleEl.setAttribute('data-zq-scope', scopeAttr);
      if (this._def._resolvedStyleUrls) {
        styleEl.setAttribute('data-zq-style-urls', this._def._resolvedStyleUrls.join(' '));
        if (this._def.styles) {
          styleEl.setAttribute('data-zq-inline', this._def.styles);
        }
      }
      document.head.appendChild(styleEl);
      this._styleEl = styleEl;
    }

    // -- Focus preservation ----------------------------------------
    // DOM morphing preserves unchanged nodes naturally, but we still
    // track focus for cases where the focused element's subtree changes.
    let _focusInfo = null;
    const _active = document.activeElement;
    if (_active && this._el.contains(_active)) {
      const modelKey = _active.getAttribute?.('z-model');
      const refKey = _active.getAttribute?.('z-ref');
      let selector = null;
      if (modelKey) {
        selector = `[z-model="${modelKey}"]`;
      } else if (refKey) {
        selector = `[z-ref="${refKey}"]`;
      } else {
        const tag = _active.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') {
          let s = tag;
          if (_active.type) s += `[type="${_active.type}"]`;
          if (_active.name) s += `[name="${_active.name}"]`;
          if (_active.placeholder) s += `[placeholder="${CSS.escape(_active.placeholder)}"]`;
          selector = s;
        }
      }
      if (selector) {
        _focusInfo = {
          selector,
          start: _active.selectionStart,
          end: _active.selectionEnd,
          dir: _active.selectionDirection,
        };
      }
    }

    // Update DOM via morphing (diffing) - preserves unchanged nodes
    // First render uses innerHTML for speed; subsequent renders morph.
    const _renderStart = typeof window !== 'undefined' && (window.__zqMorphHook || window.__zqRenderHook) ? performance.now() : 0;
    if (!this._mounted) {
      this._el.innerHTML = html;
      if (_renderStart && window.__zqRenderHook) window.__zqRenderHook(this._el, performance.now() - _renderStart, 'mount', this._def._name);
    } else {
      morph(this._el, html);
    }

    // Process structural & attribute directives
    this._processDirectives();

    // Process event, ref, and model bindings
    this._bindEvents();
    this._bindRefs();
    this._bindModels();

    // Restore focus if the morph replaced the focused element.
    // Always restore selectionRange - even when the element is still
    // the activeElement - because _bindModels or morph attribute syncing
    // can alter the value and move the cursor.
    if (_focusInfo) {
      const el = this._el.querySelector(_focusInfo.selector);
      if (el) {
        if (el !== document.activeElement) el.focus();
        try {
          if (_focusInfo.start !== null && _focusInfo.start !== undefined) {
            el.setSelectionRange(_focusInfo.start, _focusInfo.end, _focusInfo.dir);
          }
        } catch (_) { /* some input types don't support setSelectionRange */ }
      }
    }

    // Mount nested components
    mountAll(this._el);

    if (!this._mounted) {
      this._mounted = true;
      if (this._def.mounted) {
        try { this._def.mounted.call(this); }
        catch (err) { reportError(ErrorCode.COMP_LIFECYCLE, `Component "${this._def._name}" mounted() threw`, { component: this._def._name }, err); }
      }
    } else {
      if (this._def.updated) {
        try { this._def.updated.call(this); }
        catch (err) { reportError(ErrorCode.COMP_LIFECYCLE, `Component "${this._def._name}" updated() threw`, { component: this._def._name }, err); }
      }
    }
  }

  // Bind @event="method" and z-on:event="method" handlers via delegation.
  //
  // Optimization: on the FIRST render, we scan for event attributes, build
  // a delegated handler map, and attach one listener per event type to the
  // component root. On subsequent renders (re-bind), we only rebuild the
  // internal binding map - existing DOM listeners are reused since they
  // delegate to event.target.closest(selector) at fire time.
  _bindEvents() {
    // Always rebuild the binding map from current DOM
    const eventMap = new Map(); // event → [{ selector, methodExpr, modifiers, el }]

    const allEls = this._el.querySelectorAll('*');
    allEls.forEach(child => {
      if (child.closest('[z-pre]')) return;

      const attrs = child.attributes;
      for (let a = 0; a < attrs.length; a++) {
        const attr = attrs[a];
        let raw;
        if (attr.name.charCodeAt(0) === 64) { // '@'
          raw = attr.name.slice(1);
        } else if (attr.name.startsWith('z-on:')) {
          raw = attr.name.slice(5);
        } else {
          continue;
        }

        const parts = raw.split('.');
        const event = parts[0];
        const modifiers = parts.slice(1);
        const methodExpr = attr.value;

        // Give element a unique selector for delegation
        if (!child.dataset.zqEid) {
          child.dataset.zqEid = String(++_uid);
        }
        const selector = `[data-zq-eid="${child.dataset.zqEid}"]`;

        if (!eventMap.has(event)) eventMap.set(event, []);
        eventMap.get(event).push({ selector, methodExpr, modifiers, el: child });
      }
    });

    // Store binding map for the delegated handlers to reference
    this._eventBindings = eventMap;

    // Only attach DOM listeners once - reuse on subsequent renders.
    // The handlers close over `this` and read `this._eventBindings`
    // at fire time, so they always use the latest binding map.
    if (this._delegatedEvents) {
      // Already attached - just make sure new event types are covered
      for (const event of eventMap.keys()) {
        if (!this._delegatedEvents.has(event)) {
          this._attachDelegatedEvent(event, eventMap.get(event));
        }
      }
      // Remove listeners for event types no longer in the template
      for (const event of this._delegatedEvents.keys()) {
        if (!eventMap.has(event)) {
          const { handler, opts } = this._delegatedEvents.get(event);
          this._el.removeEventListener(event, handler, opts);
          this._delegatedEvents.delete(event);
          // Also remove from _listeners array
          this._listeners = this._listeners.filter(l => l.event !== event);
        }
      }
      return;
    }

    this._delegatedEvents = new Map();

    // Register delegated listeners on the component root
    for (const [event, bindings] of eventMap) {
      this._attachDelegatedEvent(event, bindings);
    }

    // .outside - attach a document-level listener for bindings that need
    // to detect clicks/events outside their element.
    this._outsideListeners = this._outsideListeners || [];
    for (const [event, bindings] of eventMap) {
      for (const binding of bindings) {
        if (!binding.modifiers.includes('outside')) continue;
        const outsideHandler = (e) => {
          if (binding.el.contains(e.target)) return;
          const match = binding.methodExpr.match(/^(\w+)(?:\(([^)]*)\))?$/);
          if (!match) return;
          const fn = this[match[1]];
          if (typeof fn === 'function') fn.call(this, e);
        };
        document.addEventListener(event, outsideHandler, true);
        this._outsideListeners.push({ event, handler: outsideHandler });
      }
    }
  }

  // Attach a single delegated listener for an event type
  _attachDelegatedEvent(event, bindings) {
      const needsCapture = bindings.some(b => b.modifiers.includes('capture'));
      const needsPassive = bindings.some(b => b.modifiers.includes('passive'));
      const listenerOpts = (needsCapture || needsPassive)
        ? { capture: needsCapture, passive: needsPassive }
        : false;

      const handler = (e) => {
        // Read bindings from live map - always up to date after re-renders
        const currentBindings = this._eventBindings?.get(event) || [];

        // Collect matching bindings with their matched elements, then sort
        // deepest-first so .stop correctly prevents ancestor handlers
        // (mimics real DOM bubbling order within delegated events).
        const hits = [];
        for (const binding of currentBindings) {
          const matched = e.target.closest(binding.selector);
          if (!matched) continue;
          hits.push({ ...binding, matched });
        }
        hits.sort((a, b) => {
          if (a.matched === b.matched) return 0;
          return a.matched.contains(b.matched) ? 1 : -1;
        });

        let stoppedAt = null; // Track elements that called .stop
        for (const { selector, methodExpr, modifiers, el, matched } of hits) {

          // In delegated events, .stop should prevent ancestor bindings from
          // firing - stopPropagation alone only stops real DOM bubbling.
          if (stoppedAt) {
            let blocked = false;
            for (const stopped of stoppedAt) {
              if (matched.contains(stopped) && matched !== stopped) { blocked = true; break; }
            }
            if (blocked) continue;
          }

          // .self - only fire if target is the element itself
          if (modifiers.includes('self') && e.target !== el) continue;

          // .outside - only fire if event target is OUTSIDE the element
          if (modifiers.includes('outside')) {
            if (el.contains(e.target)) continue;
          }

          // Key modifiers - filter keyboard events by key.
          // Named shortcuts map common names to their e.key values.
          // Any modifier not recognised as a built-in behaviour, timing,
          // or system modifier is matched against e.key (case-insensitive)
          // so that arbitrary keys work: .a, .f1, .+, .0, .arrowup, etc.
          const _keyMap = { enter: 'Enter', escape: 'Escape', tab: 'Tab', space: ' ', delete: 'Delete|Backspace', up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
          const _nonKeyMods = new Set(['prevent','stop','self','once','outside','capture','passive','debounce','throttle','ctrl','shift','alt','meta']);
          let keyFiltered = false;
          for (let mi = 0; mi < modifiers.length; mi++) {
            const mod = modifiers[mi];
            if (_keyMap[mod]) {
              const keys = _keyMap[mod].split('|');
              if (!e.key || !keys.includes(e.key)) { keyFiltered = true; break; }
            } else if (_nonKeyMods.has(mod)) {
              continue;
            } else if (/^\d+$/.test(mod) && mi > 0 && (modifiers[mi - 1] === 'debounce' || modifiers[mi - 1] === 'throttle')) {
              // Numeric value following debounce/throttle — skip (it's a ms parameter)
              continue;
            } else {
              // Dynamic key match — compare modifier against e.key
              // Case-insensitive: .a matches 'a' and 'A', .f1 matches 'F1'
              if (!e.key || e.key.toLowerCase() !== mod.toLowerCase()) { keyFiltered = true; break; }
            }
          }
          if (keyFiltered) continue;

          // System key modifiers - require modifier keys to be held
          if (modifiers.includes('ctrl') && !e.ctrlKey) continue;
          if (modifiers.includes('shift') && !e.shiftKey) continue;
          if (modifiers.includes('alt') && !e.altKey) continue;
          if (modifiers.includes('meta') && !e.metaKey) continue;

          // Handle modifiers
          if (modifiers.includes('prevent')) e.preventDefault();
          if (modifiers.includes('stop')) {
            e.stopPropagation();
            if (!stoppedAt) stoppedAt = [];
            stoppedAt.push(matched);
          }

          // Build the invocation function
          const invoke = (evt) => {
            const match = methodExpr.match(/^(\w+)(?:\(([^)]*)\))?$/);
            if (!match) return;
            const methodName = match[1];
            const fn = this[methodName];
            if (typeof fn !== 'function') return;
            if (match[2] !== undefined) {
              const args = match[2].split(',').map(a => {
                a = a.trim();
                if (a === '') return undefined;
                if (a === '$event') return evt;
                if (a === 'true') return true;
                if (a === 'false') return false;
                if (a === 'null') return null;
                if (/^-?\d+(\.\d+)?$/.test(a)) return Number(a);
                if ((a.startsWith("'") && a.endsWith("'")) || (a.startsWith('"') && a.endsWith('"'))) return a.slice(1, -1);
                if (a.startsWith('state.')) return _getPath(this.state, a.slice(6));
                return a;
              }).filter(a => a !== undefined);
              fn(...args);
            } else {
              fn(evt);
            }
          };

          // .debounce.{ms} - delay invocation until idle
          const debounceIdx = modifiers.indexOf('debounce');
          if (debounceIdx !== -1) {
            const ms = parseInt(modifiers[debounceIdx + 1], 10) || 250;
            const timers = _debounceTimers.get(el) || {};
            clearTimeout(timers[event]);
            timers[event] = setTimeout(() => invoke(e), ms);
            _debounceTimers.set(el, timers);
            continue;
          }

          // .throttle.{ms} - fire at most once per interval
          const throttleIdx = modifiers.indexOf('throttle');
          if (throttleIdx !== -1) {
            const ms = parseInt(modifiers[throttleIdx + 1], 10) || 250;
            const timers = _throttleTimers.get(el) || {};
            if (timers[event]) continue;
            invoke(e);
            timers[event] = setTimeout(() => { timers[event] = null; }, ms);
            _throttleTimers.set(el, timers);
            continue;
          }

          // .once - fire once then ignore
          if (modifiers.includes('once')) {
            if (el.dataset.zqOnce === event) continue;
            el.dataset.zqOnce = event;
          }

          invoke(e);
        }
      };
      this._el.addEventListener(event, handler, listenerOpts);
      this._listeners.push({ event, handler });
      this._delegatedEvents.set(event, { handler, opts: listenerOpts });
  }

  // Bind z-ref="name" → this.refs.name
  _bindRefs() {
    this.refs = {};
    this._el.querySelectorAll('[z-ref]').forEach(el => {
      this.refs[el.getAttribute('z-ref')] = el;
    });
  }

  // Bind z-model="stateKey" for two-way binding
  //
  //  Supported elements:  input (text, number, range, checkbox, radio, date, color, …),
  //                       textarea, select (single & multiple), contenteditable
  //  Nested state keys:   z-model="user.name"  →  this.state.user.name
  //  Modifiers (boolean attributes on the same element):
  //    z-lazy      - listen on 'change' instead of 'input' (update on blur / commit)
  //    z-trim      - trim whitespace before writing to state
  //    z-number    - force Number() conversion regardless of input type
  //    z-debounce  - debounce state writes (default 250ms, or z-debounce="300")
  //    z-uppercase - convert string to uppercase before writing to state
  //    z-lowercase - convert string to lowercase before writing to state
  //
  //  Writes to reactive state so the rest of the UI stays in sync.
  //  Focus and cursor position are preserved in _render() via focusInfo.
  //
  _bindModels() {
    this._el.querySelectorAll('[z-model]').forEach(el => {
      const key = el.getAttribute('z-model');
      const tag = el.tagName.toLowerCase();
      const type = (el.type || '').toLowerCase();
      const isEditable = el.hasAttribute('contenteditable');

      // Modifiers
      const isLazy   = el.hasAttribute('z-lazy');
      const isTrim   = el.hasAttribute('z-trim');
      const isNum    = el.hasAttribute('z-number');
      const isUpper  = el.hasAttribute('z-uppercase');
      const isLower  = el.hasAttribute('z-lowercase');
      const hasDebounce = el.hasAttribute('z-debounce');
      const debounceMs  = hasDebounce ? (parseInt(el.getAttribute('z-debounce'), 10) || 250) : 0;

      // Read current state value (supports dot-path keys)
      const currentVal = _getPath(this.state, key);

      // -- Set initial DOM value from state (always sync) ----------
      if (tag === 'input' && type === 'checkbox') {
        el.checked = !!currentVal;
      } else if (tag === 'input' && type === 'radio') {
        el.checked = el.value === String(currentVal);
      } else if (tag === 'select' && el.multiple) {
        const vals = Array.isArray(currentVal) ? currentVal.map(String) : [];
        [...el.options].forEach(opt => { opt.selected = vals.includes(opt.value); });
      } else if (isEditable) {
        if (el.textContent !== String(currentVal ?? '')) {
          el.textContent = currentVal ?? '';
        }
      } else {
        el.value = currentVal ?? '';
      }

      // -- Determine event type ------------------------------------
      const event = isLazy || tag === 'select' || type === 'checkbox' || type === 'radio'
        ? 'change'
        : isEditable ? 'input' : 'input';

      // -- Handler: read DOM → write to reactive state -------------
      // Skip if already bound (morph preserves existing elements,
      // so re-binding would stack duplicate listeners)
      if (el._zqModelBound) return;
      el._zqModelBound = true;

      const handler = () => {
        let val;
        if (type === 'checkbox')           val = el.checked;
        else if (tag === 'select' && el.multiple) val = [...el.selectedOptions].map(o => o.value);
        else if (isEditable)                val = el.textContent;
        else                                val = el.value;

        // Apply modifiers
        if (isTrim && typeof val === 'string') val = val.trim();
        if (isUpper && typeof val === 'string') val = val.toUpperCase();
        if (isLower && typeof val === 'string') val = val.toLowerCase();
        if (isNum || type === 'number' || type === 'range') val = Number(val);

        // Write through the reactive proxy (triggers re-render).
        // Focus + cursor are preserved automatically by _render().
        _setPath(this.state, key, val);
      };

      if (hasDebounce) {
        let timer = null;
        el.addEventListener(event, () => {
          clearTimeout(timer);
          timer = setTimeout(handler, debounceMs);
        });
      } else {
        el.addEventListener(event, handler);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Expression evaluator - CSP-safe parser (no eval / new Function)
  // ---------------------------------------------------------------------------
  _evalExpr(expr) {
    return safeEval(expr, [
      this.state.__raw || this.state,
      { props: this.props, refs: this.refs, computed: this.computed, $: typeof window !== 'undefined' ? window.$ : undefined }
    ]);
  }

  // ---------------------------------------------------------------------------
  // z-for - Expand list-rendering directives (pre-innerHTML, string level)
  //
  //   <li z-for="item in items">{{item.name}}</li>
  //   <li z-for="(item, i) in items">{{i}}: {{item.name}}</li>
  //   <div z-for="n in 5">{{n}}</div>                     (range)
  //   <div z-for="(val, key) in obj">{{key}}: {{val}}</div> (object)
  //
  // Uses a temporary DOM to parse, clone elements per item, and evaluate
  // {{}} expressions with the iteration variable in scope.
  // ---------------------------------------------------------------------------
  _expandZFor(html) {
    if (!html.includes('z-for')) return html;

    const temp = document.createElement('div');
    temp.innerHTML = html;

    const _recurse = (root) => {
      // Process innermost z-for elements first (no nested z-for inside)
      let forEls = [...root.querySelectorAll('[z-for]')]
        .filter(el => !el.querySelector('[z-for]'));
      if (!forEls.length) return;

      for (const el of forEls) {
        if (!el.parentNode) continue; // already removed
        const expr = el.getAttribute('z-for');
        const m = expr.match(
          /^\s*(?:\(\s*(\w+)(?:\s*,\s*(\w+))?\s*\)|(\w+))\s+in\s+(.+)\s*$/
        );
        if (!m) { el.removeAttribute('z-for'); continue; }

        const itemVar  = m[1] || m[3];
        const indexVar = m[2] || '$index';
        const listExpr = m[4].trim();

        let list = this._evalExpr(listExpr);
        if (list == null) { el.remove(); continue; }
        // Number range: z-for="n in 5" → [1, 2, 3, 4, 5]
        if (typeof list === 'number') {
          list = Array.from({ length: list }, (_, i) => i + 1);
        }
        // Object iteration: z-for="(val, key) in obj" → entries
        if (!Array.isArray(list) && typeof list === 'object' && typeof list[Symbol.iterator] !== 'function') {
          list = Object.entries(list).map(([k, v]) => ({ key: k, value: v }));
        }
        if (!Array.isArray(list) && typeof list[Symbol.iterator] === 'function') {
          list = [...list];
        }
        if (!Array.isArray(list)) { el.remove(); continue; }

        const parent = el.parentNode;
        const tplEl = el.cloneNode(true);
        tplEl.removeAttribute('z-for');
        const tplOuter = tplEl.outerHTML;

        const fragment = document.createDocumentFragment();
        const evalReplace = (str, item, index) =>
          str.replace(/\{\{(.+?)\}\}/g, (_, inner) => {
            try {
              const loopScope = {};
              loopScope[itemVar] = item;
              loopScope[indexVar] = index;
              const result = safeEval(inner.trim(), [
                loopScope,
                this.state.__raw || this.state,
                { props: this.props, computed: this.computed, $: typeof window !== 'undefined' ? window.$ : undefined }
              ]);
              return result != null ? escapeHtml(String(result)) : '';
            } catch { return ''; }
          });

        for (let i = 0; i < list.length; i++) {
          const processed = evalReplace(tplOuter, list[i], i);
          const wrapper = document.createElement('div');
          wrapper.innerHTML = processed;
          while (wrapper.firstChild) fragment.appendChild(wrapper.firstChild);
        }

        parent.replaceChild(fragment, el);
      }

      // Handle remaining nested z-for (now exposed)
      if (root.querySelector('[z-for]')) _recurse(root);
    };

    _recurse(temp);
    return temp.innerHTML;
  }

  // ---------------------------------------------------------------------------
  // _expandContentDirectives - Pre-morph z-html & z-text expansion
  //
  // Evaluates z-html and z-text directives at the string level so the morph
  // engine receives HTML with the actual content inline. This lets the diff
  // algorithm properly compare old vs new content (text nodes, child elements)
  // instead of clearing + re-injecting on every re-render.
  //
  // Same parse → evaluate → serialize pattern as _expandZFor.
  // ---------------------------------------------------------------------------
  _expandContentDirectives(html) {
    if (!html.includes('z-html') && !html.includes('z-text')) return html;

    const temp = document.createElement('div');
    temp.innerHTML = html;

    // z-html: evaluate expression → inject as innerHTML
    temp.querySelectorAll('[z-html]').forEach(el => {
      if (el.closest('[z-pre]')) return;
      const val = this._evalExpr(el.getAttribute('z-html'));
      el.innerHTML = val != null ? String(val) : '';
      el.removeAttribute('z-html');
    });

    // z-text: evaluate expression → inject as textContent (HTML-safe)
    temp.querySelectorAll('[z-text]').forEach(el => {
      if (el.closest('[z-pre]')) return;
      const val = this._evalExpr(el.getAttribute('z-text'));
      el.textContent = val != null ? String(val) : '';
      el.removeAttribute('z-text');
    });

    return temp.innerHTML;
  }

  // ---------------------------------------------------------------------------
  // _processDirectives - Post-innerHTML DOM-level directive processing
  // ---------------------------------------------------------------------------
  _processDirectives() {
    // z-pre: skip all directive processing on subtrees
    // (we leave z-pre elements in the DOM, but skip their descendants)

    // -- z-if / z-else-if / z-else (conditional rendering) --------
    const ifEls = [...this._el.querySelectorAll('[z-if]')];
    for (const el of ifEls) {
      if (!el.parentNode || el.closest('[z-pre]')) continue;

      const show = !!this._evalExpr(el.getAttribute('z-if'));

      // Collect chain: adjacent z-else-if / z-else siblings
      const chain = [{ el, show }];
      let sib = el.nextElementSibling;
      while (sib) {
        if (sib.hasAttribute('z-else-if')) {
          chain.push({ el: sib, show: !!this._evalExpr(sib.getAttribute('z-else-if')) });
          sib = sib.nextElementSibling;
        } else if (sib.hasAttribute('z-else')) {
          chain.push({ el: sib, show: true });
          break;
        } else {
          break;
        }
      }

      // Keep the first truthy branch, remove the rest
      let found = false;
      for (const item of chain) {
        if (!found && item.show) {
          found = true;
          item.el.removeAttribute('z-if');
          item.el.removeAttribute('z-else-if');
          item.el.removeAttribute('z-else');
          // Transition enter for z-if elements becoming visible
          const transName = item.el.getAttribute('z-transition');
          if (transName) {
            item.el.removeAttribute('z-transition');
            this._transitionEnter(item.el, transName);
          }
        } else {
          // Transition leave for z-if elements being removed
          const transName = item.el.getAttribute('z-transition');
          if (transName) {
            this._transitionLeave(item.el, transName, () => item.el.remove());
          } else {
            item.el.remove();
          }
        }
      }
    }

    // -- z-show (toggle display) -----------------------------------
    this._el.querySelectorAll('[z-show]').forEach(el => {
      if (el.closest('[z-pre]')) return;
      const show = !!this._evalExpr(el.getAttribute('z-show'));
      const transName = el.getAttribute('z-transition');
      const wasHidden = el.style.display === 'none' || el.hasAttribute('data-zq-hidden');

      if (transName) {
        el.removeAttribute('z-show');
        if (show && wasHidden) {
          // Entering: was hidden, now showing
          el.style.display = '';
          el.removeAttribute('data-zq-hidden');
          this._transitionEnter(el, transName);
        } else if (!show && !wasHidden) {
          // Leaving: was visible, now hiding
          el.setAttribute('data-zq-hidden', '');
          this._transitionLeave(el, transName, () => {
            el.style.display = 'none';
          });
        } else {
          el.style.display = show ? '' : 'none';
          if (!show) el.setAttribute('data-zq-hidden', '');
          else el.removeAttribute('data-zq-hidden');
        }
      } else {
        el.style.display = show ? '' : 'none';
        el.removeAttribute('z-show');
      }
    });

    // -- z-bind:attr / :attr (dynamic attribute binding) -----------
    // Use TreeWalker instead of querySelectorAll('*') - avoids
    // creating a flat array of every single descendant element.
    // TreeWalker visits nodes lazily; FILTER_REJECT skips z-pre subtrees
    // at the walker level (faster than per-node closest('[z-pre]') checks).
    const walker = document.createTreeWalker(this._el, NodeFilter.SHOW_ELEMENT, {
      acceptNode(n) {
        return n.hasAttribute('z-pre') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    let node;
    while ((node = walker.nextNode())) {
      const attrs = node.attributes;
      for (let i = attrs.length - 1; i >= 0; i--) {
        const attr = attrs[i];
        let attrName;
        if (attr.name.startsWith('z-bind:')) attrName = attr.name.slice(7);
        else if (attr.name.charCodeAt(0) === 58 && attr.name.charCodeAt(1) !== 58) attrName = attr.name.slice(1); // ':' but not '::'
        else continue;

        const val = this._evalExpr(attr.value);
        node.removeAttribute(attr.name);
        if (val === false || val === null || val === undefined) {
          node.removeAttribute(attrName);
        } else if (val === true) {
          node.setAttribute(attrName, '');
        } else {
          node.setAttribute(attrName, String(val));
        }
      }
    }

    // -- z-class (dynamic class binding) ---------------------------
    this._el.querySelectorAll('[z-class]').forEach(el => {
      if (el.closest('[z-pre]')) return;
      const val = this._evalExpr(el.getAttribute('z-class'));
      if (typeof val === 'string') {
        val.split(/\s+/).filter(Boolean).forEach(c => el.classList.add(c));
      } else if (Array.isArray(val)) {
        val.filter(Boolean).forEach(c => el.classList.add(String(c)));
      } else if (val && typeof val === 'object') {
        for (const [cls, active] of Object.entries(val)) {
          el.classList.toggle(cls, !!active);
        }
      }
      el.removeAttribute('z-class');
    });

    // -- z-style (dynamic inline styles) ---------------------------
    this._el.querySelectorAll('[z-style]').forEach(el => {
      if (el.closest('[z-pre]')) return;
      const val = this._evalExpr(el.getAttribute('z-style'));
      if (typeof val === 'string') {
        el.style.cssText += ';' + val;
      } else if (val && typeof val === 'object') {
        for (const [prop, v] of Object.entries(val)) {
          el.style[prop] = v;
        }
      }
      el.removeAttribute('z-style');
    });

    // -- z-stream (assign MediaStream to <video>/<audio>.srcObject) -
    this._el.querySelectorAll('[z-stream]').forEach(el => {
      if (el.closest('[z-pre]')) return;
      const val = this._evalExpr(el.getAttribute('z-stream'));
      const hasMediaStream = typeof MediaStream !== 'undefined';
      if (val == null) {
        el.srcObject = null;
      } else if (hasMediaStream && val instanceof MediaStream) {
        el.srcObject = val;
      } else if (val && typeof val.getTracks === 'function') {
        // Accept duck-typed stream objects (test fakes, polyfills).
        el.srcObject = val;
      } else {
        el.srcObject = null;
      }
      el.removeAttribute('z-stream');
    });

    // z-html and z-text are now pre-expanded at string level (before
    // morph) via _expandContentDirectives(), so the diff engine can
    // properly diff their content instead of clearing + re-injecting.

    // -- z-cloak (remove after render) -----------------------------
    this._el.querySelectorAll('[z-cloak]').forEach(el => {
      el.removeAttribute('z-cloak');
    });
  }

  // ---------------------------------------------------------------------------
  // Transition helpers - CSS class-based enter/leave animations
  //
  //   z-transition="fade" generates:
  //     Enter: .fade-enter-from → .fade-enter-active + .fade-enter-to
  //     Leave: .fade-leave-from → .fade-leave-active + .fade-leave-to
  //
  //   Or component-level transition config:
  //     transition: { enter: 'animate-in', leave: 'animate-out', duration: 200 }
  // ---------------------------------------------------------------------------

  /**
   * Run an enter transition on an element.
   * @param {Element} el - target element
   * @param {string} name - transition name (e.g. 'fade')
   */
  _transitionEnter(el, name) {
    // Check for component-level transition config
    const cfg = this._def.transition;
    if (cfg && cfg.enter) {
      el.classList.add(cfg.enter);
      const duration = cfg.duration || 0;
      const cleanup = () => el.classList.remove(cfg.enter);
      if (duration > 0) {
        setTimeout(cleanup, duration);
      } else {
        el.addEventListener('transitionend', cleanup, { once: true });
        el.addEventListener('animationend', cleanup, { once: true });
      }
      return;
    }

    // CSS class-based transition pattern
    el.classList.add(`${name}-enter-from`, `${name}-enter-active`);
    // Force reflow so the browser registers the initial state
    void el.offsetHeight;
    requestAnimationFrame(() => {
      el.classList.remove(`${name}-enter-from`);
      el.classList.add(`${name}-enter-to`);
      const onEnd = () => {
        el.classList.remove(`${name}-enter-active`, `${name}-enter-to`);
      };
      el.addEventListener('transitionend', onEnd, { once: true });
      el.addEventListener('animationend', onEnd, { once: true });
    });
  }

  /**
   * Run a leave transition on an element, then call done().
   * @param {Element} el - target element
   * @param {string} name - transition name (e.g. 'fade')
   * @param {Function} done - callback when transition completes
   */
  _transitionLeave(el, name, done) {
    // Check for component-level transition config
    const cfg = this._def.transition;
    if (cfg && cfg.leave) {
      el.classList.add(cfg.leave);
      const duration = cfg.duration || 0;
      const cleanup = () => {
        el.classList.remove(cfg.leave);
        done();
      };
      if (duration > 0) {
        setTimeout(cleanup, duration);
      } else {
        el.addEventListener('transitionend', cleanup, { once: true });
        el.addEventListener('animationend', cleanup, { once: true });
      }
      return;
    }

    // CSS class-based transition pattern
    el.classList.add(`${name}-leave-from`, `${name}-leave-active`);
    void el.offsetHeight;
    requestAnimationFrame(() => {
      el.classList.remove(`${name}-leave-from`);
      el.classList.add(`${name}-leave-to`);
      const onEnd = () => {
        el.classList.remove(`${name}-leave-active`, `${name}-leave-to`);
        done();
      };
      el.addEventListener('transitionend', onEnd, { once: true });
      el.addEventListener('animationend', onEnd, { once: true });
    });
  }

  // Programmatic state update (batch-friendly)
  // Passing an empty object forces a re-render (useful for external state changes).
  setState(partial) {
    if (partial && Object.keys(partial).length > 0) {
      Object.assign(this.state, partial);
    } else {
      this._scheduleUpdate();
    }
  }

  // Emit custom event up the DOM
  emit(name, detail) {
    this._el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, cancelable: true }));
  }

  // Destroy this component
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this._def.destroyed) {
      try { this._def.destroyed.call(this); }
      catch (err) { reportError(ErrorCode.COMP_LIFECYCLE, `Component "${this._def._name}" destroyed() threw`, { component: this._def._name }, err); }
    }
    // Clean up prop observer
    if (this._propObserver) {
      this._propObserver.disconnect();
      this._propObserver = null;
    }
    // Clean up store connectors
    if (this._storeCleanups) {
      this._storeCleanups.forEach(fn => fn());
      this._storeCleanups = [];
    }
    this._listeners.forEach(({ event, handler }) => this._el.removeEventListener(event, handler));
    this._listeners = [];
    if (this._outsideListeners) {
      this._outsideListeners.forEach(({ event, handler }) => document.removeEventListener(event, handler, true));
      this._outsideListeners = [];
    }
    this._delegatedEvents = null;
    this._eventBindings = null;
    // Clear any pending debounce/throttle timers to prevent stale closures.
    // Timers are keyed by individual child elements, so iterate all descendants.
    const allEls = this._el.querySelectorAll('*');
    allEls.forEach(child => {
      const dTimers = _debounceTimers.get(child);
      if (dTimers) {
        for (const key in dTimers) clearTimeout(dTimers[key]);
        _debounceTimers.delete(child);
      }
      const tTimers = _throttleTimers.get(child);
      if (tTimers) {
        for (const key in tTimers) clearTimeout(tTimers[key]);
        _throttleTimers.delete(child);
      }
    });
    if (this._styleEl) this._styleEl.remove();
    _instances.delete(this._el);
    this._el.innerHTML = '';
  }
}


// Reserved definition keys (not user methods)
const _reservedKeys = new Set([
  'state', 'render', 'styles', 'init', 'mounted', 'updated', 'destroyed', 'props',
  'templateUrl', 'styleUrl', 'templates', 'base',
  'computed', 'watch', 'stores', 'transition', 'activated', 'deactivated'
]);


// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register a component
 * @param {string} name - tag name (must contain a hyphen, e.g. 'app-counter')
 * @param {object} definition - component definition
 */
function component(name, definition) {
  if (!name || typeof name !== 'string') {
    throw new ZQueryError(ErrorCode.COMP_INVALID_NAME, 'Component name must be a non-empty string');
  }
  if (!name.includes('-')) {
    throw new ZQueryError(ErrorCode.COMP_INVALID_NAME, `Component name "${name}" must contain a hyphen (Web Component convention)`);
  }
  definition._name = name;

  // Auto-detect the calling module's URL so that relative templateUrl
  // and styleUrl paths resolve relative to the component file.
  // An explicit `base` string on the definition overrides auto-detection.
  if (definition.base !== undefined) {
    definition._base = definition.base;   // explicit override
  } else {
    definition._base = _detectCallerBase();
  }

  _registry.set(name, definition);
}

/**
 * Mount a component into a target element
 * @param {string|Element} target - selector or element to mount into
 * @param {string} componentName - registered component name
 * @param {object} props - props to pass
 * @returns {Component}
 */
function mount(target, componentName, props = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) throw new ZQueryError(ErrorCode.COMP_MOUNT_TARGET, `Mount target "${target}" not found`, { target });

  const def = _registry.get(componentName);
  if (!def) throw new ZQueryError(ErrorCode.COMP_NOT_FOUND, `Component "${componentName}" not registered`, { component: componentName });

  // Destroy existing instance
  if (_instances.has(el)) _instances.get(el).destroy();

  const instance = new Component(el, def, props);
  _instances.set(el, instance);
  instance._render();
  return instance;
}

/**
 * Scan a container for custom component tags and auto-mount them
 * @param {Element} root - root element to scan (default: document.body)
 */
function mountAll(root = document.body) {
  for (const [name, def] of _registry) {
    const tags = root.querySelectorAll(name);
    tags.forEach(tag => {
      if (_instances.has(tag)) return; // Already mounted

      // Extract props from attributes
      const props = {};

      // Find parent component instance for evaluating dynamic prop expressions
      let parentInstance = null;
      let ancestor = tag.parentElement;
      while (ancestor) {
        if (_instances.has(ancestor)) {
          parentInstance = _instances.get(ancestor);
          break;
        }
        ancestor = ancestor.parentElement;
      }

      [...tag.attributes].forEach(attr => {
        if (attr.name.startsWith('@') || attr.name.startsWith('z-')) return;

        // Dynamic prop: :propName="expression" - evaluate in parent context
        if (attr.name.startsWith(':')) {
          const propName = attr.name.slice(1);
          if (parentInstance) {
            props[propName] = safeEval(attr.value, [
              parentInstance.state.__raw || parentInstance.state,
              { props: parentInstance.props, refs: parentInstance.refs, computed: parentInstance.computed, $: typeof window !== 'undefined' ? window.$ : undefined }
            ]);
          } else {
            // No parent - try JSON parse
            try { props[propName] = JSON.parse(attr.value); }
            catch { props[propName] = attr.value; }
          }
          return;
        }

        // Static prop
        try { props[attr.name] = JSON.parse(attr.value); }
        catch { props[attr.name] = attr.value; }
      });

      const instance = new Component(tag, def, props);
      _instances.set(tag, instance);
      instance._render();
    });
  }
}

/**
 * Get the component instance for an element
 * @param {string|Element} target
 * @returns {Component|null}
 */
function getInstance(target) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  return _instances.get(el) || null;
}

/**
 * Destroy a component at the given target
 * @param {string|Element} target
 */
function destroy(target) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  const inst = _instances.get(el);
  if (inst) inst.destroy();
}

/**
 * Get the registry (for debugging)
 */
function getRegistry() {
  return Object.fromEntries(_registry);
}

/**
 * Pre-load a component's external templates and styles so the next mount
 * renders synchronously (no blank flash while fetching).
 * Safe to call multiple times - skips if already loaded.
 * @param {string} name - registered component name
 * @returns {Promise<void>}
 */
async function prefetch(name) {
  const def = _registry.get(name);
  if (!def) return;

  // Load templateUrl and styleUrl if not already loaded.
  if ((def.templateUrl && !def._templateLoaded) ||
      (def.styleUrl && !def._styleLoaded)) {
    await Component.prototype._loadExternals.call({ _def: def });
  }
}


// ---------------------------------------------------------------------------
// Global stylesheet loader
// ---------------------------------------------------------------------------
const _globalStyles = new Map(); // url → <link> element

/**
 * Load one or more global stylesheets into <head>.
 * Relative URLs resolve against the calling module's directory (auto-detected
 * from the stack trace), just like component styleUrl paths.
 * Returns a remove() handle so the caller can unload if needed.
 *
 *   $.style('app.css')                          // critical by default
 *   $.style(['app.css', 'theme.css'])            // multiple files
 *   $.style('/assets/global.css')                // absolute - used as-is
 *   $.style('app.css', { critical: false })       // opt out of FOUC prevention
 *
 * Options:
 *   critical  - (boolean, default true) When true, zQuery injects a tiny
 *               inline style that hides the page (`visibility: hidden`) and
 *               removes it once the stylesheet has loaded. This prevents
 *               FOUC (Flash of Unstyled Content) entirely - no special
 *               markup needed in the HTML file. Set to false to load
 *               the stylesheet without blocking paint.
 *   bg        - (string, default '#0d1117') Background color applied while
 *               the page is hidden during critical load. Prevents a white
 *               flash on dark-themed apps. Only used when critical is true.
 *
 * Duplicate URLs are ignored (idempotent).
 *
 * @param {string|string[]} urls - stylesheet URL(s) to load
 * @param {object} [opts] - options
 * @param {boolean} [opts.critical=true] - hide page until loaded (prevents FOUC)
 * @param {string} [opts.bg] - background color while hidden (default '#0d1117')
 * @returns {{ remove: Function, ready: Promise }} - .remove() to unload, .ready resolves when loaded
 */
function style(urls, opts = {}) {
  const callerBase = _detectCallerBase();
  const list = Array.isArray(urls) ? urls : [urls];
  const elements = [];
  const loadPromises = [];

  // Critical mode (default: true): inject a tiny inline <style> that hides the
  // page and sets a background color. Fully self-contained - no markup needed
  // in the HTML file. The style is removed once the sheet loads.
  let _criticalStyle = null;
  if (opts.critical !== false) {
    _criticalStyle = document.createElement('style');
    _criticalStyle.setAttribute('data-zq-critical', '');
    _criticalStyle.textContent = `html{visibility:hidden!important;background:${opts.bg || '#0d1117'}}`;
    document.head.insertBefore(_criticalStyle, document.head.firstChild);
  }

  for (let url of list) {
    // Resolve relative paths against the caller's directory first,
    // falling back to <base href> or origin root.
    if (typeof url === 'string' && !url.startsWith('/') && !url.includes(':') && !url.startsWith('//')) {
      url = _resolveUrl(url, callerBase);
    }

    if (_globalStyles.has(url)) {
      elements.push(_globalStyles.get(url));
      continue;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.setAttribute('data-zq-style', '');

    const p = new Promise(resolve => {
      link.onload = resolve;
      link.onerror = resolve; // don't block forever on error
    });
    loadPromises.push(p);

    document.head.appendChild(link);
    _globalStyles.set(url, link);
    elements.push(link);
  }

  // When all sheets are loaded, reveal the page if critical mode was used
  const ready = Promise.all(loadPromises).then(() => {
    if (_criticalStyle) {
      _criticalStyle.remove();
    }
  });

  return {
    ready,
    remove() {
      for (const el of elements) {
        el.remove();
        for (const [k, v] of _globalStyles) {
          if (v === el) { _globalStyles.delete(k); break; }
        }
      }
    }
  };
}

// --- src/router.js -----------------------------------------------
/**
 * zQuery Router - Client-side SPA router
 * 
 * Supports hash mode (#/path) and history mode (/path).
 * Route params, query strings, navigation guards, and lazy loading.
 * Sub-route history substates for in-page UI changes (modals, tabs, etc.).
 * 
 * Usage:
 *   // HTML: <z-outlet></z-outlet>
 *   $.router({
 *     routes: [
 *       { path: '/', component: 'home-page' },
 *       { path: '/user/:id', component: 'user-profile' },
 *       { path: '/lazy', load: () => import('./pages/lazy.js'), component: 'lazy-page' },
 *     ],
 *     fallback: 'not-found'
 *   });
 */



// Unique marker on history.state to identify zQuery-managed entries
const _ZQ_STATE_KEY = '__zq';

/**
 * Shallow-compare two flat objects (for params / query comparison).
 * Avoids JSON.stringify overhead on every navigation.
 */
function _shallowEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    const k = keysA[i];
    if (a[k] !== b[k]) return false;
  }
  return true;
}

class Router {
  constructor(config = {}) {
    this._el = null;
    // file:// protocol can't use pushState - always force hash mode
    const isFile = typeof location !== 'undefined' && location.protocol === 'file:';
    this._mode = isFile ? 'hash' : (config.mode || 'history');

    // Keep-alive cache: component name → { container, instance }
    this._keepAliveCache = new Map();

    // Base path for sub-path deployments
    // Priority: explicit config.base → window.__ZQ_BASE → <base href> tag
    let rawBase = config.base;
    if (rawBase == null) {
      rawBase = (typeof window !== 'undefined' && window.__ZQ_BASE) || '';
      if (!rawBase && typeof document !== 'undefined') {
        const baseEl = document.querySelector('base');
        if (baseEl) {
          try { rawBase = new URL(baseEl.href).pathname; }
          catch { rawBase = baseEl.getAttribute('href') || ''; }
          if (rawBase === '/') rawBase = '';    // root = no sub-path
        }
      }
    }
    // Normalize: ensure leading /, strip trailing /
    this._base = String(rawBase).replace(/\/+$/, '');
    if (this._base && !this._base.startsWith('/')) this._base = '/' + this._base;

    this._routes = [];
    this._fallback = config.fallback || null;
    this._current = null;                         // { route, params, query, path }
    this._guards = { before: [], after: [] };
    this._listeners = new Set();
    this._instance = null;                        // current mounted component
    this._resolving = false;                      // re-entrancy guard

    // Sub-route history substates
    this._substateListeners = [];                 // [(key, data) => bool|void]
    this._inSubstate = false;                       // true while substate entries are in the history stack

    // Set outlet element
    // Priority: explicit config.el → <z-outlet> tag in the DOM
    if (config.el) {
      this._el = typeof config.el === 'string' ? document.querySelector(config.el) : config.el;
    } else if (typeof document !== 'undefined') {
      const outlet = document.querySelector('z-outlet');
      if (outlet) {
        this._el = outlet;
        // Read inline attribute overrides from <z-outlet> (config takes priority)
        if (!config.fallback && outlet.getAttribute('fallback')) {
          this._fallback = outlet.getAttribute('fallback');
        }
        if (!config.mode && outlet.getAttribute('mode')) {
          const attrMode = outlet.getAttribute('mode');
          if (attrMode === 'hash' || attrMode === 'history') {
            this._mode = isFile ? 'hash' : attrMode;
          }
        }
        if (config.base == null && outlet.getAttribute('base')) {
          let ob = outlet.getAttribute('base');
          ob = String(ob).replace(/\/+$/, '');
          if (ob && !ob.startsWith('/')) ob = '/' + ob;
          this._base = ob;
        }
      }
    }

    // Register routes
    if (config.routes) {
      config.routes.forEach(r => this.add(r));
    }

    // Listen for navigation - store handler references for cleanup in destroy()
    if (this._mode === 'hash') {
      this._onNavEvent = () => this._resolve();
      window.addEventListener('hashchange', this._onNavEvent);
      // Hash mode also needs popstate for substates (pushSubstate uses pushState)
      this._onPopState = (e) => {
        const st = e.state;
        if (st && st[_ZQ_STATE_KEY] === 'substate') {
          const handled = this._fireSubstate(st.key, st.data, 'pop');
          if (handled) return;
          this._resolve().then(() => {
            this._fireSubstate(st.key, st.data, 'pop');
          });
          return;
        } else if (this._inSubstate) {
          this._inSubstate = false;
          this._fireSubstate(null, null, 'reset');
        }
      };
      window.addEventListener('popstate', this._onPopState);
    } else {
      this._onNavEvent = (e) => {
        // Check for substate pop first - if a listener handles it, don't route
        const st = e.state;
        if (st && st[_ZQ_STATE_KEY] === 'substate') {
          const handled = this._fireSubstate(st.key, st.data, 'pop');
          if (handled) return;
          // Unhandled substate — the owning component was likely destroyed
          // (e.g. user navigated away then pressed back).  Resolve the route
          // first (which may mount a fresh component that registers a listener),
          // then retry the substate so the new listener can restore the UI.
          this._resolve().then(() => {
            this._fireSubstate(st.key, st.data, 'pop');
          });
          return;
        } else if (this._inSubstate) {
          // Popped past all substates - notify listeners to reset to defaults
          this._inSubstate = false;
          this._fireSubstate(null, null, 'reset');
        }
        this._resolve();
      };
      window.addEventListener('popstate', this._onNavEvent);
    }

    // Intercept link clicks for SPA navigation
    this._onLinkClick = (e) => {
      // Don't intercept modified clicks (Ctrl/Cmd+click = new tab)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target.closest('[z-link]');
      if (!link) return;
      if (link.getAttribute('target') === '_blank') return;
      e.preventDefault();
      let href = link.getAttribute('z-link');
      // Reject absolute URLs and dangerous protocols — z-link is for internal routes only
      if (href && /^[a-z][a-z0-9+.-]*:/i.test(href)) return;
      // Support z-link-params for dynamic :param interpolation
      const paramsAttr = link.getAttribute('z-link-params');
      if (paramsAttr) {
        try {
          const params = JSON.parse(paramsAttr);
          href = this._interpolateParams(href, params);
        } catch (err) {
          reportError(ErrorCode.ROUTER_RESOLVE, 'Malformed JSON in z-link-params', { href, paramsAttr }, err);
        }
      }
      this.navigate(href);
      // z-to-top modifier: scroll to top after navigation
      if (link.hasAttribute('z-to-top')) {
        const scrollBehavior = link.getAttribute('z-to-top') || 'instant';
        window.scrollTo({ top: 0, behavior: scrollBehavior });
      }
    };
    document.addEventListener('click', this._onLinkClick);

    // Initial resolve
    if (this._el) {
      // Defer to allow all components to register
      queueMicrotask(() => this._resolve());
    }
  }

  // --- Route management ----------------------------------------------------

  add(route) {
    // Compile path pattern into regex
    const { regex, keys } = compilePath(route.path);
    this._routes.push({ ...route, _regex: regex, _keys: keys });

    // Per-route fallback: register an alias path for the same component.
    // e.g. { path: '/docs/:section', fallback: '/docs', component: 'docs-page' }
    // When matched via fallback, missing params are undefined.
    if (route.fallback) {
      const fb = compilePath(route.fallback);
      this._routes.push({ ...route, path: route.fallback, _regex: fb.regex, _keys: fb.keys });
    }

    return this;
  }

  remove(path) {
    this._routes = this._routes.filter(r => r.path !== path);
    return this;
  }

  // --- Navigation ----------------------------------------------------------

  /**
   * Interpolate :param placeholders in a path with the given values.
   * @param {string} path - e.g. '/user/:id/posts/:pid'
   * @param {Object} params - e.g. { id: 42, pid: 7 }
   * @returns {string}
   */
  _interpolateParams(path, params) {
    if (!params || typeof params !== 'object') return path;
    return path.replace(/:([\w]+)/g, (_, key) => {
      const val = params[key];
      return val != null ? encodeURIComponent(String(val)) : ':' + key;
    });
  }

  /**
   * Get the full current URL (path + hash) for same-URL detection.
   * @returns {string}
   */
  _currentURL() {
    if (this._mode === 'hash') {
      return window.location.hash.slice(1) || '/';
    }
    const pathname = window.location.pathname || '/';
    const hash = window.location.hash || '';
    return pathname + hash;
  }

  navigate(path, options = {}) {
    // Interpolate :param placeholders if options.params is provided
    if (options.params) path = this._interpolateParams(path, options.params);
    // Separate hash fragment (e.g. /docs/getting-started#cli-bundler)
    const [cleanPath, fragment] = (path || '').split('#');
    let normalized = this._normalizePath(cleanPath);
    const hash = fragment ? '#' + fragment : '';
    if (this._mode === 'hash') {
      // Hash mode uses the URL hash for routing, so a #fragment can't live
      // in the URL. Store it as a scroll target for the destination component.
      if (fragment) window.__zqScrollTarget = fragment;
      const targetHash = '#' + normalized;
      // Skip if already at this exact hash (prevents duplicate entries)
      if (window.location.hash === targetHash && !options.force) return this;
      window.location.hash = targetHash;
    } else {
      const targetURL = this._base + normalized + hash;
      const currentURL = (window.location.pathname || '/') + (window.location.hash || '');

      if (targetURL === currentURL && !options.force) {
        // Same full URL (path + hash) - don't push duplicate entry.
        // If only the hash changed to a fragment target, scroll to it.
        if (fragment) {
          const el = document.getElementById(fragment);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return this;
      }

      // Same route path but different hash fragment - use replaceState
      // so back goes to the previous *route*, not the previous scroll position.
      const targetPathOnly = this._base + normalized;
      const currentPathOnly = window.location.pathname || '/';
      if (targetPathOnly === currentPathOnly && hash && !options.force) {
        window.history.replaceState(
          { ...options.state, [_ZQ_STATE_KEY]: 'route' },
          '',
          targetURL
        );
        // Scroll to the fragment target
        if (fragment) {
          const el = document.getElementById(fragment);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // Don't re-resolve - same route, just a hash change
        return this;
      }

      window.history.pushState(
        { ...options.state, [_ZQ_STATE_KEY]: 'route' },
        '',
        targetURL
      );
      this._resolve();
    }
    return this;
  }

  replace(path, options = {}) {
    // Interpolate :param placeholders if options.params is provided
    if (options.params) path = this._interpolateParams(path, options.params);
    const [cleanPath, fragment] = (path || '').split('#');
    let normalized = this._normalizePath(cleanPath);
    const hash = fragment ? '#' + fragment : '';
    if (this._mode === 'hash') {
      if (fragment) window.__zqScrollTarget = fragment;
      window.location.replace('#' + normalized);
    } else {
      window.history.replaceState(
        { ...options.state, [_ZQ_STATE_KEY]: 'route' },
        '',
        this._base + normalized + hash
      );
      this._resolve();
    }
    return this;
  }

  /**
   * Normalize an app-relative path and guard against double base-prefixing.
   * @param {string} path - e.g. '/docs', 'docs', or '/app/docs' when base is '/app'
   * @returns {string} - always starts with '/'
   */
  _normalizePath(path) {
    let p = path && path.startsWith('/') ? path : (path ? `/${path}` : '/');
    // Strip base prefix if caller accidentally included it
    if (this._base) {
      if (p === this._base) return '/';
      if (p.startsWith(this._base + '/')) p = p.slice(this._base.length) || '/';
    }
    return p;
  }

  /**
   * Resolve an app-relative path to a full URL path (including base).
   * Useful for programmatic link generation.
   * @param {string} path
   * @returns {string}
   */
  resolve(path) {
    const normalized = path && path.startsWith('/') ? path : (path ? `/${path}` : '/');
    return this._base + normalized;
  }

  back() { window.history.back(); return this; }
  forward() { window.history.forward(); return this; }
  go(n) { window.history.go(n); return this; }

  // --- Guards --------------------------------------------------------------

  beforeEach(fn) {
    this._guards.before.push(fn);
    return this;
  }

  afterEach(fn) {
    this._guards.after.push(fn);
    return this;
  }

  // --- Events --------------------------------------------------------------

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  // --- Sub-route history substates -----------------------------------------

  /**
   * Push a lightweight history entry for in-component UI state.
   * The URL path does NOT change - only a history entry is added so the
   * back button can undo the UI change (close modal, revert tab, etc.)
   * before navigating away.
   *
   * @param {string} key   - identifier (e.g. 'modal', 'tab', 'panel')
   * @param {*}      data  - arbitrary state (serializable)
   * @returns {Router}
   *
   * @example
   * // Open a modal and push a substate
   * router.pushSubstate('modal', { id: 'confirm-delete' });
   * // User hits back → onSubstate fires → close the modal
   */
  pushSubstate(key, data) {
    this._inSubstate = true;
    if (this._mode === 'hash') {
      // Hash mode: stash the substate in a global - hashchange will check.
      // We still push a history entry via a sentinel hash suffix.
      const current = window.location.hash || '#/';
      window.history.pushState(
        { [_ZQ_STATE_KEY]: 'substate', key, data },
        '',
        window.location.href
      );
    } else {
      window.history.pushState(
        { [_ZQ_STATE_KEY]: 'substate', key, data },
        '',
        window.location.href      // keep same URL
      );
    }
    return this;
  }

  /**
   * Register a listener for substate pops (back button on a substate entry).
   * The callback receives `(key, data)` and should return `true` if it
   * handled the pop (prevents route resolution). If no listener returns
   * `true`, normal route resolution proceeds.
   *
   * @param {(key: string, data: any, action: string) => boolean|void} fn
   * @returns {() => void} unsubscribe function
   *
   * @example
   * const unsub = router.onSubstate((key, data) => {
   *   if (key === 'modal') { closeModal(); return true; }
   * });
   */
  onSubstate(fn) {
    this._substateListeners.push(fn);
    return () => {
      this._substateListeners = this._substateListeners.filter(f => f !== fn);
    };
  }

  /**
   * Fire substate listeners. Returns true if any listener handled it.
   * @private
   */
  _fireSubstate(key, data, action) {
    for (const fn of this._substateListeners) {
      try {
        if (fn(key, data, action) === true) return true;
      } catch (err) {
        reportError(ErrorCode.ROUTER_GUARD, 'onSubstate listener threw', { key, data }, err);
      }
    }
    return false;
  }

  // --- Current state -------------------------------------------------------

  get current() { return this._current; }

  /** The detected or configured base path (read-only) */
  get base() { return this._base; }

  get path() {
    if (this._mode === 'hash') {
      const raw = window.location.hash.slice(1) || '/';
      // If the hash doesn't start with '/', it's an in-page anchor
      // (e.g. #some-heading), not a route.  Treat it as a scroll target
      // and resolve to the last known route (or '/').
      if (raw && !raw.startsWith('/')) {
        window.__zqScrollTarget = raw;
        // Restore the route hash silently so the URL stays valid
        const fallbackPath = (this._current && this._current.path) || '/';
        window.location.replace('#' + fallbackPath);
        return fallbackPath;
      }
      return raw;
    }
    let pathname = window.location.pathname || '/';
    // Strip trailing slash for consistency (except root '/')
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    if (this._base) {
      // Exact match: /app
      if (pathname === this._base) return '/';
      // Prefix match with boundary: /app/page (but NOT /application)
      if (pathname.startsWith(this._base + '/')) {
        return pathname.slice(this._base.length) || '/';
      }
    }
    return pathname;
  }

  get query() {
    const search = this._mode === 'hash'
      ? (window.location.hash.split('?')[1] || '')
      : window.location.search.slice(1);
    return Object.fromEntries(new URLSearchParams(search));
  }

  // --- Internal resolve ----------------------------------------------------

  async _resolve() {
    // Prevent re-entrant calls (e.g. listener triggering navigation)
    if (this._resolving) return;
    this._resolving = true;
    this._redirectCount = 0;
    try {
      await this.__resolve();
    } finally {
      this._resolving = false;
    }
  }

  async __resolve() {
    // Check if we're landing on a substate entry (e.g. page refresh on a
    // substate bookmark, or hash-mode popstate). Fire listeners and bail
    // if handled - the URL hasn't changed so there's no route to resolve.
    const histState = window.history.state;
    if (histState && histState[_ZQ_STATE_KEY] === 'substate') {
      const handled = this._fireSubstate(histState.key, histState.data, 'resolve');
      if (handled) return;
      // No listener handled it - fall through to normal routing
    }

    const fullPath = this.path;
    const [pathPart, queryString] = fullPath.split('?');
    const path = pathPart || '/';
    const query = Object.fromEntries(new URLSearchParams(queryString || ''));

    // Match route
    let matched = null;
    let params = {};
    for (const route of this._routes) {
      const m = path.match(route._regex);
      if (m) {
        matched = route;
        route._keys.forEach((key, i) => { params[key] = m[i + 1]; });
        break;
      }
    }

    // Fallback
    if (!matched && this._fallback) {
      matched = { component: this._fallback, path: '*', _keys: [], _regex: /.*/ };
    }

    if (!matched) return;

    const to = { route: matched, params, query, path };
    const from = this._current;

    // Same-route optimization: if the resolved route is the same component
    // with the same params, skip the full destroy/mount cycle and just
    // update props. This prevents flashing and unnecessary DOM churn.
    if (from && this._instance && matched.component === from.route.component) {
      const sameParams = _shallowEqual(params, from.params);
      const sameQuery = _shallowEqual(query, from.query);
      if (sameParams && sameQuery) {
        // Identical navigation - nothing to do
        return;
      }
    }

    // Run before guards
    for (const guard of this._guards.before) {
      try {
        const result = await guard(to, from);
        if (result === false) return;                    // Cancel
        if (typeof result === 'string') {                // Redirect
          if (++this._redirectCount > 10) {
            reportError(ErrorCode.ROUTER_GUARD, 'Too many guard redirects (possible loop)', { to }, null);
            return;
          }
          // Update URL directly and re-resolve (avoids re-entrancy block)
          const [rPath, rFrag] = result.split('#');
          const rNorm = this._normalizePath(rPath || '/');
          const rHash = rFrag ? '#' + rFrag : '';
          if (this._mode === 'hash') {
            if (rFrag) window.__zqScrollTarget = rFrag;
            window.location.replace('#' + rNorm);
          } else {
            window.history.replaceState(
              { [_ZQ_STATE_KEY]: 'route' },
              '',
              this._base + rNorm + rHash
            );
          }
          return this.__resolve();
        }
      } catch (err) {
        reportError(ErrorCode.ROUTER_GUARD, 'Before-guard threw', { to, from }, err);
        return;
      }
    }

    // Lazy load module if needed
    if (matched.load) {
      try { await matched.load(); }
      catch (err) {
        reportError(ErrorCode.ROUTER_LOAD, `Failed to load module for route "${matched.path}"`, { path: matched.path }, err);
        return;
      }
    }

    this._current = to;

    // Mount component into outlet
    if (this._el && matched.component) {
      // Pre-load external templates/styles so the mount renders synchronously
      // (keeps old content visible during the fetch instead of showing blank)
      if (typeof matched.component === 'string') {
        await prefetch(matched.component);
      }

      const isKeepAlive = !!matched.keepAlive;
      const componentName = typeof matched.component === 'string' ? matched.component : null;

      // Deactivate previous keep-alive instance (hide instead of destroy)
      if (this._instance && this._currentKeepAlive && this._currentComponentName) {
        const cached = this._keepAliveCache.get(this._currentComponentName);
        if (cached) {
          cached.container.style.display = 'none';
          // Call deactivated() lifecycle hook
          if (cached.instance._def.deactivated) {
            try { cached.instance._def.deactivated.call(cached.instance); }
            catch (err) { reportError(ErrorCode.COMP_LIFECYCLE, `Component "${this._currentComponentName}" deactivated() threw`, { component: this._currentComponentName }, err); }
          }
        }
        this._instance = null;
      } else if (this._instance) {
        // Destroy previous non-keepAlive instance
        this._instance.destroy();
        this._instance = null;
      }

      const _routeStart = typeof window !== 'undefined' && window.__zqRenderHook ? performance.now() : 0;

      // Pass route params and query as props
      const props = { ...params, $route: to, $query: query, $params: params };

      // Keep-alive: reuse cached instance
      if (isKeepAlive && componentName && this._keepAliveCache.has(componentName)) {
        const cached = this._keepAliveCache.get(componentName);
        // Hide all children, show the cached one
        [...this._el.children].forEach(c => { c.style.display = 'none'; });
        cached.container.style.display = '';
        this._instance = cached.instance;
        this._currentKeepAlive = true;
        this._currentComponentName = componentName;
        // Call activated() lifecycle hook
        if (cached.instance._def.activated) {
          try { cached.instance._def.activated.call(cached.instance); }
          catch (err) { reportError(ErrorCode.COMP_LIFECYCLE, `Component "${componentName}" activated() threw`, { component: componentName }, err); }
        }
        if (_routeStart) window.__zqRenderHook(this._el, performance.now() - _routeStart, 'route', componentName);
      }
      // If component is a string (registered name), mount it
      else if (componentName) {
        // Hide all keep-alive cached children (don't destroy)
        [...this._el.children].forEach(c => {
          if (c.dataset.zqKeepAlive) {
            c.style.display = 'none';
          }
        });
        // Remove non-keep-alive children
        [...this._el.children].forEach(c => {
          if (!c.dataset.zqKeepAlive) c.remove();
        });

        const container = document.createElement(componentName);
        if (isKeepAlive) container.dataset.zqKeepAlive = componentName;
        this._el.appendChild(container);
        try {
          this._instance = mount(container, componentName, props);
        } catch (err) {
          reportError(ErrorCode.COMP_NOT_FOUND, `Failed to mount component for route "${matched.path}"`, { component: matched.component, path: matched.path }, err);
          return;
        }

        if (isKeepAlive) {
          this._keepAliveCache.set(componentName, { container, instance: this._instance });
          // Call activated() on first mount
          if (this._instance._def.activated) {
            try { this._instance._def.activated.call(this._instance); }
            catch (err) { reportError(ErrorCode.COMP_LIFECYCLE, `Component "${componentName}" activated() threw`, { component: componentName }, err); }
          }
        }

        this._currentKeepAlive = isKeepAlive;
        this._currentComponentName = componentName;
        if (_routeStart) window.__zqRenderHook(this._el, performance.now() - _routeStart, 'route', componentName);
      }
      // If component is a render function
      else if (typeof matched.component === 'function') {
        // Clear non-keepAlive content
        [...this._el.children].forEach(c => {
          if (c.dataset.zqKeepAlive) c.style.display = 'none';
          else c.remove();
        });
        const wrapper = document.createElement('div');
        wrapper.innerHTML = matched.component(to);
        while (wrapper.firstChild) this._el.appendChild(wrapper.firstChild);
        this._currentKeepAlive = false;
        this._currentComponentName = null;
        if (_routeStart) window.__zqRenderHook(this._el, performance.now() - _routeStart, 'route', to);
      }
    }

    // Update z-active-route elements
    this._updateActiveRoutes(path);

    // Run after guards
    for (const guard of this._guards.after) {
      await guard(to, from);
    }

    // Notify listeners
    this._listeners.forEach(fn => fn(to, from));
  }

  // --- Active route class management ----------------------------------------

  /**
   * Update all elements with z-active-route to toggle their active class
   * based on the current path.
   *
   * Usage:
   *   <a z-link="/docs" z-active-route="/docs">Docs</a>
   *   <a z-link="/about" z-active-route="/about" z-active-class="selected">About</a>
   *   <a z-link="/" z-active-route="/" z-active-exact>Home</a>
   */
  _updateActiveRoutes(currentPath) {
    if (typeof document === 'undefined') return;
    const els = document.querySelectorAll('[z-active-route]');
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      const route = el.getAttribute('z-active-route');
      const cls = el.getAttribute('z-active-class') || 'active';
      const exact = el.hasAttribute('z-active-exact');
      const isActive = exact
        ? currentPath === route
        : (route === '/' ? currentPath === '/' : currentPath.startsWith(route));
      el.classList.toggle(cls, isActive);
    }
  }

  // --- Destroy -------------------------------------------------------------

  destroy() {
    // Remove window/document event listeners to prevent memory leaks
    if (this._onNavEvent) {
      window.removeEventListener(this._mode === 'hash' ? 'hashchange' : 'popstate', this._onNavEvent);
      this._onNavEvent = null;
    }
    if (this._onPopState) {
      window.removeEventListener('popstate', this._onPopState);
      this._onPopState = null;
    }
    if (this._onLinkClick) {
      document.removeEventListener('click', this._onLinkClick);
      this._onLinkClick = null;
    }
    // Destroy all keep-alive cached instances
    for (const [, cached] of this._keepAliveCache) {
      cached.instance.destroy();
    }
    this._keepAliveCache.clear();
    if (this._instance) this._instance.destroy();
    this._listeners.clear();
    this._substateListeners = [];
    this._inSubstate = false;
    this._routes = [];
    this._guards = { before: [], after: [] };
  }
}


// ---------------------------------------------------------------------------
// Path compilation (shared by Router.add and matchRoute)
// ---------------------------------------------------------------------------

/**
 * Compile a route path pattern into a RegExp and param key list.
 * Supports `:param` segments and `*` wildcard.
 * @param {string} path - e.g. '/user/:id' or '/files/*'
 * @returns {{ regex: RegExp, keys: string[] }}
 */
function compilePath(path) {
  const keys = [];
  const pattern = path
    .replace(/:(\w+)/g, (_, key) => { keys.push(key); return '([^/]+)'; })
    .replace(/\*/g, '(.*)');
  return { regex: new RegExp(`^${pattern}$`), keys };
}

// ---------------------------------------------------------------------------
// Standalone route matcher (DOM-free — usable on server and client)
// ---------------------------------------------------------------------------

/**
 * Match a pathname against an array of route definitions.
 * Returns `{ component, params }`.  If no route matches, falls back to the
 * `fallback` component name (default `'not-found'`).
 *
 * This is the same matching logic the client-side router uses internally,
 * extracted so SSR servers can resolve URLs without the DOM.
 *
 * @param {Array<{ path: string, component: string, fallback?: string }>} routes
 * @param {string} pathname - URL path to match, e.g. '/blog/my-post'
 * @param {string} [fallback='not-found'] - Component name when nothing matches
 * @returns {{ component: string, params: Record<string, string> }}
 */
function matchRoute(routes, pathname, fallback = 'not-found') {
  for (const route of routes) {
    const { regex, keys } = compilePath(route.path);
    const m = pathname.match(regex);
    if (m) {
      const params = {};
      keys.forEach((key, i) => { params[key] = m[i + 1]; });
      return { component: route.component, params };
    }
    // Per-route fallback alias (same as Router.add)
    if (route.fallback) {
      const fb = compilePath(route.fallback);
      const fbm = pathname.match(fb.regex);
      if (fbm) {
        const params = {};
        fb.keys.forEach((key, i) => { params[key] = fbm[i + 1]; });
        return { component: route.component, params };
      }
    }
  }
  return { component: fallback, params: {} };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
let _activeRouter = null;

function createRouter(config) {
  _activeRouter = new Router(config);
  return _activeRouter;
}

function getRouter() {
  return _activeRouter;
}

// --- src/store.js ------------------------------------------------
/**
 * zQuery Store - Global reactive state management
 * 
 * A lightweight Redux/Vuex-inspired store with:
 *   - Reactive state via Proxy
 *   - Named actions for mutations
 *   - Key-specific subscriptions
 *   - Computed getters
 *   - Middleware support
 *   - DevTools-friendly (logs actions in dev mode)
 * 
 * Usage:
 *   const store = $.store({
 *     state: { count: 0, user: null },
 *     actions: {
 *       increment(state) { state.count++; },
 *       setUser(state, user) { state.user = user; }
 *     },
 *     getters: {
 *       doubleCount: (state) => state.count * 2
 *     }
 *   });
 * 
 *   store.dispatch('increment');
 *   store.subscribe('count', (val, old) => console.log(val));
 */



class Store {
  constructor(config = {}) {
    this._subscribers = new Map();   // key → Set<fn>
    this._wildcards = new Set();     // subscribe to all changes
    this._actions = config.actions || {};
    this._getters = config.getters || {};
    this._middleware = [];
    this._history = [];              // action log
    this._maxHistory = config.maxHistory || 1000;
    this._debug = config.debug || false;
    this._batching = false;
    this._batchQueue = [];           // pending notifications during batch
    this._undoStack = [];
    this._redoStack = [];
    this._maxUndo = config.maxUndo || 50;

    // Store initial state for reset
    const initial = typeof config.state === 'function' ? config.state() : { ...(config.state || {}) };
    this._initialState = JSON.parse(JSON.stringify(initial));

    this.state = reactive(initial, (key, value, old) => {
      if (this._batching) {
        this._batchQueue.push({ key, value, old });
        return;
      }
      this._notifySubscribers(key, value, old);
    });

    // Build getters as computed properties
    this.getters = {};
    for (const [name, fn] of Object.entries(this._getters)) {
      Object.defineProperty(this.getters, name, {
        get: () => fn(this.state.__raw || this.state),
        enumerable: true
      });
    }
  }

  /** @private Notify key-specific and wildcard subscribers */
  _notifySubscribers(key, value, old) {
    const subs = this._subscribers.get(key);
    if (subs) subs.forEach(fn => {
      try { fn(key, value, old); }
      catch (err) { reportError(ErrorCode.STORE_SUBSCRIBE, `Subscriber for "${key}" threw`, { key }, err); }
    });
    this._wildcards.forEach(fn => {
      try { fn(key, value, old); }
      catch (err) { reportError(ErrorCode.STORE_SUBSCRIBE, 'Wildcard subscriber threw', { key }, err); }
    });
  }

  /**
   * Batch multiple state changes - subscribers fire once at the end
   * with only the latest value per key.
   */
  batch(fn) {
    this._batching = true;
    this._batchQueue = [];
    let result;
    try {
      result = fn(this.state);
    } finally {
      this._batching = false;
      // Deduplicate: keep only the last change per key
      const last = new Map();
      for (const entry of this._batchQueue) {
        last.set(entry.key, entry);
      }
      this._batchQueue = [];
      for (const { key, value, old } of last.values()) {
        this._notifySubscribers(key, value, old);
      }
    }
    return result;
  }

  /**
   * Save a snapshot for undo. Call before making changes you want to be undoable.
   */
  checkpoint() {
    const snap = JSON.parse(JSON.stringify(this.state.__raw || this.state));
    this._undoStack.push(snap);
    if (this._undoStack.length > this._maxUndo) {
      this._undoStack.splice(0, this._undoStack.length - this._maxUndo);
    }
    this._redoStack = [];
  }

  /**
   * Undo to the last checkpoint
   * @returns {boolean} true if undo was performed
   */
  undo() {
    if (this._undoStack.length === 0) return false;
    const current = JSON.parse(JSON.stringify(this.state.__raw || this.state));
    this._redoStack.push(current);
    const prev = this._undoStack.pop();
    this.replaceState(prev);
    return true;
  }

  /**
   * Redo the last undone state change
   * @returns {boolean} true if redo was performed
   */
  redo() {
    if (this._redoStack.length === 0) return false;
    const current = JSON.parse(JSON.stringify(this.state.__raw || this.state));
    this._undoStack.push(current);
    const next = this._redoStack.pop();
    this.replaceState(next);
    return true;
  }

  /** Check if undo is available */
  get canUndo() { return this._undoStack.length > 0; }

  /** Check if redo is available */
  get canRedo() { return this._redoStack.length > 0; }

  /**
   * Dispatch a named action
   * @param {string} name - action name
   * @param  {...any} args - payload
   */
  dispatch(name, ...args) {
    const action = this._actions[name];
    if (!action) {
      reportError(ErrorCode.STORE_ACTION, `Unknown action "${name}"`, { action: name, args });
      return;
    }

    // Run middleware
    for (const mw of this._middleware) {
      try {
        const result = mw(name, args, this.state);
        if (result === false) return; // blocked by middleware
      } catch (err) {
        reportError(ErrorCode.STORE_MIDDLEWARE, `Middleware threw during "${name}"`, { action: name }, err);
        return;
      }
    }

    if (this._debug) {
      console.log(`%c[Store] ${name}`, 'color: #4CAF50; font-weight: bold;', ...args);
    }

    try {
      const result = action(this.state, ...args);
      this._history.push({ action: name, args, timestamp: Date.now() });
      // Cap history to prevent unbounded memory growth
      if (this._history.length > this._maxHistory) {
        this._history.splice(0, this._history.length - this._maxHistory);
      }
      return result;
    } catch (err) {
      reportError(ErrorCode.STORE_ACTION, `Action "${name}" threw`, { action: name, args }, err);
    }
  }

  /**
   * Subscribe to changes on a specific state key, multiple keys, or all changes.
   *
   * Signatures:
   *   subscribe(callback)             → wildcard, fires on every change
   *   subscribe('key', callback)      → fires when 'key' changes
   *   subscribe(['a','b'], callback)  → fires when any listed key changes
   *
   * @param {string|string[]|Function} keyOrFn - state key, array of keys, or function for all changes
   * @param {Function} [fn] - callback (key, value, oldValue)
   * @returns {Function} - unsubscribe
   */
  subscribe(keyOrFn, fn) {
    if (typeof keyOrFn === 'function') {
      // Wildcard - listen to all changes
      this._wildcards.add(keyOrFn);
      return () => this._wildcards.delete(keyOrFn);
    }

    // Multi-key subscription: subscribe(['files', 'isProcessing'], callback)
    if (Array.isArray(keyOrFn)) {
      const keys = keyOrFn;
      const handler = (key, value, old) => {
        if (keys.includes(key)) fn(key, value, old);
      };
      this._wildcards.add(handler);
      return () => this._wildcards.delete(handler);
    }

    if (!this._subscribers.has(keyOrFn)) {
      this._subscribers.set(keyOrFn, new Set());
    }
    this._subscribers.get(keyOrFn).add(fn);
    return () => this._subscribers.get(keyOrFn)?.delete(fn);
  }

  /**
   * Get current state snapshot (plain object)
   */
  snapshot() {
    return JSON.parse(JSON.stringify(this.state.__raw || this.state));
  }

  /**
   * Replace entire state
   */
  replaceState(newState) {
    const raw = this.state.__raw || this.state;
    for (const key of Object.keys(raw)) {
      delete this.state[key];
    }
    Object.assign(this.state, newState);
  }

  /**
   * Add middleware: fn(actionName, args, state) → false to block
   */
  use(fn) {
    this._middleware.push(fn);
    return this;
  }

  /**
   * Get action history
   */
  get history() {
    return [...this._history];
  }

  /**
   * Reset state to initial values. If no argument, resets to the original state.
   */
  reset(initialState) {
    this.replaceState(initialState || JSON.parse(JSON.stringify(this._initialState)));
    this._history = [];
    this._undoStack = [];
    this._redoStack = [];
  }
}


// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
let _stores = new Map();

function createStore(name, config) {
  // If called with just config (no name), use 'default'
  if (typeof name === 'object') {
    config = name;
    name = 'default';
  }
  const store = new Store(config);
  _stores.set(name, store);
  return store;
}

function getStore(name = 'default') {
  return _stores.get(name) || null;
}


// ---------------------------------------------------------------------------
// Store-Component Connector
// ---------------------------------------------------------------------------

/**
 * Create a store connector descriptor for use in component definitions.
 * When used in a component's `stores` config, auto-subscribes to the
 * listed keys on mount and cleans up on destroy.
 *
 * Usage:
 *   $.component('my-comp', {
 *     stores: {
 *       app: connectStore(appStore, ['files', 'isProcessing']),
 *     },
 *     render() {
 *       return `<div>${this.stores.app.files.length} files</div>`;
 *     }
 *   });
 *
 * @param {Store} store - the store instance to connect
 * @param {string[]} keys - state keys to sync
 * @returns {{ _zqConnector: true, store: Store, keys: string[] }}
 */
function connectStore(store, keys) {
  return { _zqConnector: true, store, keys };
}

// --- src/http.js -------------------------------------------------
/**
 * zQuery HTTP - Lightweight fetch wrapper
 * 
 * Clean API for GET/POST/PUT/PATCH/DELETE with:
 *   - Auto JSON serialization/deserialization
 *   - Request/response interceptors
 *   - Timeout support
 *   - Base URL configuration
 *   - Abort controller integration
 * 
 * Usage:
 *   $.http.get('/api/users');
 *   $.http.post('/api/users', { name: 'Tony' });
 *   $.http.configure({ baseURL: 'https://api.example.com', headers: { Authorization: 'Bearer ...' } });
 */

const _config = {
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
};

const _interceptors = {
  request: [],
  response: [],
};


/**
 * Core request function
 */
async function request(method, url, data, options = {}) {
  if (!url || typeof url !== 'string') {
    throw new Error(`HTTP request requires a URL string, got ${typeof url}`);
  }
  let fullURL = url.startsWith('http') ? url : _config.baseURL + url;
  let headers = { ..._config.headers, ...options.headers };
  let body = undefined;

  // Build fetch options
  const fetchOpts = {
    method: method.toUpperCase(),
    headers,
    ...options,
  };

  // Handle body
  if (data !== undefined && method !== 'GET' && method !== 'HEAD') {
    if (data instanceof FormData) {
      body = data;
      delete fetchOpts.headers['Content-Type']; // Let browser set multipart boundary
    } else if (typeof data === 'object') {
      body = JSON.stringify(data);
    } else {
      body = data;
    }
    fetchOpts.body = body;
  }

  // Query params for GET
  if (data && (method === 'GET' || method === 'HEAD') && typeof data === 'object') {
    const params = new URLSearchParams(data).toString();
    fullURL += (fullURL.includes('?') ? '&' : '?') + params;
  }

  // Timeout via AbortController
  const controller = new AbortController();
  const timeout = options.timeout ?? _config.timeout;
  let timer;
  // Combine user signal with internal controller for proper timeout support
  if (options.signal) {
    // If AbortSignal.any is available, combine both signals
    if (typeof AbortSignal.any === 'function') {
      fetchOpts.signal = AbortSignal.any([options.signal, controller.signal]);
    } else {
      // Fallback: forward user signal's abort to our controller
      fetchOpts.signal = controller.signal;
      if (options.signal.aborted) {
        controller.abort(options.signal.reason);
      } else {
        options.signal.addEventListener('abort', () => controller.abort(options.signal.reason), { once: true });
      }
    }
  } else {
    fetchOpts.signal = controller.signal;
  }
  let _timedOut = false;
  if (timeout > 0) {
    timer = setTimeout(() => { _timedOut = true; controller.abort(); }, timeout);
  }

  // Run request interceptors
  for (const interceptor of _interceptors.request) {
    const result = await interceptor(fetchOpts, fullURL);
    if (result === false) throw new Error('Request blocked by interceptor');
    if (result?.url) fullURL = result.url;
    if (result?.options) Object.assign(fetchOpts, result.options);
  }

  try {
    const response = await fetch(fullURL, fetchOpts);
    if (timer) clearTimeout(timer);

    // Parse response
    const contentType = response.headers.get('Content-Type') || '';
    let responseData;

    try {
      if (contentType.includes('application/json')) {
        responseData = await response.json();
      } else if (contentType.includes('text/')) {
        responseData = await response.text();
      } else if (contentType.includes('application/octet-stream') || contentType.includes('image/')) {
        responseData = await response.blob();
      } else {
        // Try JSON first, fall back to text
        const text = await response.text();
        try { responseData = JSON.parse(text); } catch { responseData = text; }
      }
    } catch (parseErr) {
      responseData = null;
      console.warn(`[zQuery HTTP] Failed to parse response body from ${method} ${fullURL}:`, parseErr.message);
    }

    const result = {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData,
      response,
    };

    // Run response interceptors
    for (const interceptor of _interceptors.response) {
      await interceptor(result);
    }

    if (!response.ok) {
      const err = new Error(`HTTP ${response.status}: ${response.statusText}`);
      err.response = result;
      throw err;
    }

    return result;
  } catch (err) {
    if (timer) clearTimeout(timer);
    if (err.name === 'AbortError') {
      if (_timedOut) {
        throw new Error(`Request timeout after ${timeout}ms: ${method} ${fullURL}`);
      }
      throw new Error(`Request aborted: ${method} ${fullURL}`);
    }
    throw err;
  }
}


// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
const http = {
  get:     (url, params, opts)  => request('GET', url, params, opts),
  post:    (url, data, opts)    => request('POST', url, data, opts),
  put:     (url, data, opts)    => request('PUT', url, data, opts),
  patch:   (url, data, opts)    => request('PATCH', url, data, opts),
  delete:  (url, data, opts)    => request('DELETE', url, data, opts),
  head:    (url, opts)          => request('HEAD', url, undefined, opts),

  /**
   * Configure defaults
   */
  configure(opts) {
    if (opts.baseURL !== undefined) _config.baseURL = opts.baseURL;
    if (opts.headers) Object.assign(_config.headers, opts.headers);
    if (opts.timeout !== undefined) _config.timeout = opts.timeout;
  },

  /**
   * Read-only snapshot of current configuration
   */
  getConfig() {
    return {
      baseURL: _config.baseURL,
      headers: { ..._config.headers },
      timeout: _config.timeout,
    };
  },

  /**
   * Add request interceptor
   * @param {Function} fn - (fetchOpts, url) → void | false | { url, options }
   * @returns {Function} unsubscribe function
   */
  onRequest(fn) {
    _interceptors.request.push(fn);
    return () => {
      const idx = _interceptors.request.indexOf(fn);
      if (idx !== -1) _interceptors.request.splice(idx, 1);
    };
  },

  /**
   * Add response interceptor
   * @param {Function} fn - (result) → void
   * @returns {Function} unsubscribe function
   */
  onResponse(fn) {
    _interceptors.response.push(fn);
    return () => {
      const idx = _interceptors.response.indexOf(fn);
      if (idx !== -1) _interceptors.response.splice(idx, 1);
    };
  },

  /**
   * Clear interceptors - all, or just 'request' / 'response'
   */
  clearInterceptors(type) {
    if (!type || type === 'request') _interceptors.request.length = 0;
    if (!type || type === 'response') _interceptors.response.length = 0;
  },

  /**
   * Run multiple requests in parallel
   */
  all(requests) {
    return Promise.all(requests);
  },

  /**
   * Create a standalone AbortController for manual cancellation
   */
  createAbort() {
    return new AbortController();
  },

  /**
   * Raw fetch pass-through (for edge cases)
   */
  raw: (url, opts) => fetch(url, opts),
};

// --- src/utils.js ------------------------------------------------
/**
 * zQuery Utils - Common utility functions
 * 
 * Quality-of-life helpers that every frontend project needs.
 * Attached to $ namespace for convenience.
 */

// ---------------------------------------------------------------------------
// Function utilities
// ---------------------------------------------------------------------------

/**
 * Debounce - delays execution until after `ms` of inactivity
 */
function debounce(fn, ms = 250) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

/**
 * Throttle - limits execution to once per `ms`
 */
function throttle(fn, ms = 250) {
  let last = 0;
  let timer;
  return (...args) => {
    const now = Date.now();
    const remaining = ms - (now - last);
    clearTimeout(timer);
    if (remaining <= 0) {
      last = now;
      fn(...args);
    } else {
      timer = setTimeout(() => { last = Date.now(); fn(...args); }, remaining);
    }
  };
}

/**
 * Pipe - compose functions left-to-right
 */
function pipe(...fns) {
  return (input) => fns.reduce((val, fn) => fn(val), input);
}

/**
 * Once - function that only runs once
 */
function once(fn) {
  let called = false, result;
  return (...args) => {
    if (!called) { called = true; result = fn(...args); }
    return result;
  };
}

/**
 * Sleep - promise-based delay
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// ---------------------------------------------------------------------------
// String utilities
// ---------------------------------------------------------------------------

/**
 * Escape HTML entities
 */
function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(str).replace(/[&<>"']/g, c => map[c]);
}

function stripHtml(str) {
  return String(str).replace(/<[^>]*>/g, '');
}

/**
 * Template tag for auto-escaping interpolated values
 * Usage: $.html`<div>${userInput}</div>`
 */
function html(strings, ...values) {
  return strings.reduce((result, str, i) => {
    const val = values[i - 1];
    const escaped = (val instanceof TrustedHTML) ? val.toString() : escapeHtml(val ?? '');
    return result + escaped + str;
  });
}

/**
 * Mark HTML as trusted (skip escaping in $.html template)
 */
class TrustedHTML {
  constructor(html) { this._html = html; }
  toString() { return this._html; }
}

function trust(htmlStr) {
  return new TrustedHTML(htmlStr);
}

/**
 * Generate UUID v4
 */
function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  // Fallback using crypto.getRandomValues (wider support than randomUUID)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const buf = new Uint8Array(1);
    crypto.getRandomValues(buf);
    const r = buf[0] & 15;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/**
 * Kebab-case to camelCase
 */
function camelCase(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * CamelCase to kebab-case
 */
function kebabCase(str) {
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .toLowerCase();
}


// ---------------------------------------------------------------------------
// Object utilities
// ---------------------------------------------------------------------------

/**
 * Deep clone via structuredClone (handles circular refs, Dates, etc.).
 * Falls back to a manual deep clone that preserves Date, RegExp, Map, Set,
 * ArrayBuffer, TypedArrays, undefined values, and circular references.
 */
function deepClone(obj) {
  if (typeof structuredClone === 'function') return structuredClone(obj);

  const seen = new Map();
  function clone(val) {
    if (val === null || typeof val !== 'object') return val;
    if (seen.has(val)) return seen.get(val);
    if (val instanceof Date) return new Date(val.getTime());
    if (val instanceof RegExp) return new RegExp(val.source, val.flags);
    if (val instanceof Map) {
      const m = new Map();
      seen.set(val, m);
      val.forEach((v, k) => m.set(clone(k), clone(v)));
      return m;
    }
    if (val instanceof Set) {
      const s = new Set();
      seen.set(val, s);
      val.forEach(v => s.add(clone(v)));
      return s;
    }
    if (ArrayBuffer.isView(val)) return new val.constructor(val.buffer.slice(0));
    if (val instanceof ArrayBuffer) return val.slice(0);
    if (Array.isArray(val)) {
      const arr = [];
      seen.set(val, arr);
      for (let i = 0; i < val.length; i++) arr[i] = clone(val[i]);
      return arr;
    }
    const result = Object.create(Object.getPrototypeOf(val));
    seen.set(val, result);
    for (const key of Object.keys(val)) result[key] = clone(val[key]);
    return result;
  }
  return clone(obj);
}

// Keys that must never be written through data-merge or path-set operations
const _UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Deep merge objects
 */
function deepMerge(target, ...sources) {
  const seen = new WeakSet();
  function merge(tgt, src) {
    if (seen.has(src)) return tgt;
    seen.add(src);
    for (const key of Object.keys(src)) {
      if (_UNSAFE_KEYS.has(key)) continue;
      if (src[key] && typeof src[key] === 'object' && !Array.isArray(src[key])) {
        if (!tgt[key] || typeof tgt[key] !== 'object') tgt[key] = {};
        merge(tgt[key], src[key]);
      } else {
        tgt[key] = src[key];
      }
    }
    return tgt;
  }
  for (const source of sources) merge(target, source);
  return target;
}

/**
 * Simple object equality check
 */
function isEqual(a, b, _seen) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  // Guard against circular references
  if (!_seen) _seen = new Set();
  if (_seen.has(a)) return true;
  _seen.add(a);
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(k => isEqual(a[k], b[k], _seen));
}


// ---------------------------------------------------------------------------
// URL utilities
// ---------------------------------------------------------------------------

/**
 * Serialize object to URL query string
 */
function param(obj) {
  return new URLSearchParams(obj).toString();
}

/**
 * Parse URL query string to object
 */
function parseQuery(str) {
  return Object.fromEntries(new URLSearchParams(str));
}


// ---------------------------------------------------------------------------
// Storage helpers (localStorage wrapper with JSON support)
// ---------------------------------------------------------------------------
const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  remove(key) {
    localStorage.removeItem(key);
  },

  clear() {
    localStorage.clear();
  },
};

const session = {
  get(key, fallback = null) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    sessionStorage.setItem(key, JSON.stringify(value));
  },

  remove(key) {
    sessionStorage.removeItem(key);
  },

  clear() {
    sessionStorage.clear();
  },
};


// ---------------------------------------------------------------------------
// Event bus (pub/sub)
// ---------------------------------------------------------------------------
class EventBus {
  constructor() { this._handlers = new Map(); }

  on(event, fn) {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    this._handlers.get(event)?.delete(fn);
  }

  emit(event, ...args) {
    this._handlers.get(event)?.forEach(fn => fn(...args));
  }

  once(event, fn) {
    const wrapper = (...args) => { fn(...args); this.off(event, wrapper); };
    return this.on(event, wrapper);
  }

  clear() { this._handlers.clear(); }
}

const bus = new EventBus();


// ---------------------------------------------------------------------------
// Array utilities
// ---------------------------------------------------------------------------

function range(startOrEnd, end, step) {
  let s, e, st;
  if (end === undefined) { s = 0; e = startOrEnd; st = 1; }
  else { s = startOrEnd; e = end; st = step !== undefined ? step : 1; }
  if (st === 0) return [];
  const result = [];
  if (st > 0) { for (let i = s; i < e; i += st) result.push(i); }
  else        { for (let i = s; i > e; i += st) result.push(i); }
  return result;
}

function unique(arr, keyFn) {
  if (!keyFn) return [...new Set(arr)];
  const seen = new Set();
  return arr.filter(item => {
    const k = keyFn(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function chunk(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

function groupBy(arr, keyFn) {
  const result = {};
  for (const item of arr) {
    const k = keyFn(item);
    (result[k] ??= []).push(item);
  }
  return result;
}


// ---------------------------------------------------------------------------
// Object utilities
// ---------------------------------------------------------------------------

function pick(obj, keys) {
  const result = {};
  for (const k of keys) { if (k in obj) result[k] = obj[k]; }
  return result;
}

function omit(obj, keys) {
  const exclude = new Set(keys);
  const result = {};
  for (const k of Object.keys(obj)) { if (!exclude.has(k)) result[k] = obj[k]; }
  return result;
}

function getPath(obj, path, fallback) {
  const keys = path.split('.');
  let cur = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return fallback;
    cur = cur[k];
  }
  return cur === undefined ? fallback : cur;
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (_UNSAFE_KEYS.has(k)) return obj;
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  const lastKey = keys[keys.length - 1];
  if (_UNSAFE_KEYS.has(lastKey)) return obj;
  cur[lastKey] = value;
  return obj;
}

function isEmpty(val) {
  if (val == null) return true;
  if (typeof val === 'string' || Array.isArray(val)) return val.length === 0;
  if (val instanceof Map || val instanceof Set) return val.size === 0;
  if (typeof val === 'object') return Object.keys(val).length === 0;
  return false;
}


// ---------------------------------------------------------------------------
// String utilities
// ---------------------------------------------------------------------------

function capitalize(str) {
  if (!str) return '';
  return str[0].toUpperCase() + str.slice(1).toLowerCase();
}

function truncate(str, maxLen, suffix = '…') {
  if (str.length <= maxLen) return str;
  const end = Math.max(0, maxLen - suffix.length);
  return str.slice(0, end) + suffix;
}


// ---------------------------------------------------------------------------
// Number utilities
// ---------------------------------------------------------------------------

function clamp(val, min, max) {
  return val < min ? min : val > max ? max : val;
}


// ---------------------------------------------------------------------------
// Function utilities
// ---------------------------------------------------------------------------

function memoize(fn, keyFnOrOpts) {
  let keyFn, maxSize = 0;
  if (typeof keyFnOrOpts === 'function') keyFn = keyFnOrOpts;
  else if (keyFnOrOpts && typeof keyFnOrOpts === 'object') maxSize = keyFnOrOpts.maxSize || 0;

  const cache = new Map();

  const memoized = (...args) => {
    const key = keyFn ? keyFn(...args) : args[0];
    if (cache.has(key)) {
      // LRU: promote to newest by re-inserting
      const value = cache.get(key);
      cache.delete(key);
      cache.set(key, value);
      return value;
    }
    const result = fn(...args);
    cache.set(key, result);
    // LRU eviction: drop the least-recently-used entry
    if (maxSize > 0 && cache.size > maxSize) {
      cache.delete(cache.keys().next().value);
    }
    return result;
  };

  memoized.clear = () => cache.clear();
  return memoized;
}


// ---------------------------------------------------------------------------
// Async utilities
// ---------------------------------------------------------------------------

function retry(fn, opts = {}) {
  const { attempts = 3, delay = 1000, backoff = 1 } = opts;
  return new Promise((resolve, reject) => {
    let attempt = 0, currentDelay = delay;
    const tryOnce = () => {
      attempt++;
      fn(attempt).then(resolve, (err) => {
        if (attempt >= attempts) return reject(err);
        const d = currentDelay;
        currentDelay *= backoff;
        setTimeout(tryOnce, d);
      });
    };
    tryOnce();
  });
}

function timeout(promise, ms, message) {
  let timer;
  const race = Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message || `Timed out after ${ms}ms`)), ms);
    })
  ]);
  return race.finally(() => clearTimeout(timer));
}

// --- index.js (assembly) ------------------------------------------
/**
 * ┌---------------------------------------------------------┐
 * │  zQuery (zeroQuery) - Lightweight Frontend Library     │
 * │                                                         │
 * │  jQuery-like selectors · Reactive components            │
 * │  SPA router · State management · Zero dependencies      │
 * │                                                         │
 * │  https://github.com/tonywied17/zero-query              │
 * └---------------------------------------------------------┘
 */












// ---------------------------------------------------------------------------
// $ - The main function & namespace
// ---------------------------------------------------------------------------

/**
 * Main selector function - always returns a ZQueryCollection (like jQuery).
 * 
 *   $('selector')         → ZQueryCollection (querySelectorAll)
 *   $('<div>hello</div>') → ZQueryCollection from created elements
 *   $(element)            → ZQueryCollection wrapping the element
 *   $(fn)                 → DOMContentLoaded shorthand
 * 
 * @param {string|Element|NodeList|Function} selector
 * @param {string|Element} [context]
 * @returns {ZQueryCollection}
 */
function $(selector, context) {
  // $(fn) → DOM ready shorthand
  if (typeof selector === 'function') {
    query.ready(selector);
    return;
  }
  return query(selector, context);
}


// --- Quick refs (DOM selectors) --------------------------------------------
$.id       = query.id;
$.class    = query.class;
$.classes  = query.classes;
$.tag      = query.tag;
Object.defineProperty($, 'name', {
  value: query.name, writable: true, configurable: true
});
$.children = query.children;
$.qs       = query.qs;
$.qsa      = query.qsa;

// --- Collection selector ---------------------------------------------------
/**
 * Collection selector (like jQuery's $)
 * 
 *   $.all('selector')         → ZQueryCollection (querySelectorAll)
 *   $.all('<div>hello</div>') → create elements as collection
 *   $.all(element)            → wrap element in collection
 *   $.all(nodeList)           → wrap NodeList in collection
 * 
 * @param {string|Element|NodeList|Array} selector
 * @param {string|Element} [context]
 * @returns {ZQueryCollection}
 */
$.all = function(selector, context) {
  return queryAll(selector, context);
};

// --- DOM helpers -----------------------------------------------------------
$.create   = query.create;
$.ready    = query.ready;
$.on       = query.on;
$.off      = query.off;
$.fn       = query.fn;

// --- Reactive primitives ---------------------------------------------------
$.reactive = reactive;
$.Signal   = Signal;
$.signal   = signal;
$.computed = computed;
$.effect   = effect;
$.batch    = batch;
$.untracked = untracked;

// --- Components ------------------------------------------------------------
$.component   = component;
$.mount       = mount;
$.mountAll    = mountAll;
$.getInstance = getInstance;
$.destroy     = destroy;
$.components  = getRegistry;
$.prefetch    = prefetch;
$.style       = style;
$.morph        = morph;
$.morphElement = morphElement;
$.safeEval    = safeEval;

// --- Router ----------------------------------------------------------------
$.router     = createRouter;
$.getRouter  = getRouter;
$.matchRoute = matchRoute;

// --- Store -----------------------------------------------------------------
$.store    = createStore;
$.getStore = getStore;
$.connectStore = connectStore;

// --- HTTP ------------------------------------------------------------------
$.http   = http;
$.get    = http.get;
$.post   = http.post;
$.put    = http.put;
$.patch  = http.patch;
$.delete = http.delete;
$.head   = http.head;

// --- Utilities -------------------------------------------------------------
$.debounce   = debounce;
$.throttle   = throttle;
$.pipe       = pipe;
$.once       = once;
$.sleep      = sleep;
$.escapeHtml = escapeHtml;
$.stripHtml  = stripHtml;
$.html       = html;
$.trust      = trust;
$.TrustedHTML = TrustedHTML;
$.uuid       = uuid;
$.camelCase  = camelCase;
$.kebabCase  = kebabCase;
$.deepClone  = deepClone;
$.deepMerge  = deepMerge;
$.isEqual    = isEqual;
$.param      = param;
$.parseQuery = parseQuery;
$.storage    = storage;
$.session    = session;
$.EventBus   = EventBus;
$.bus        = bus;
$.range      = range;
$.unique     = unique;
$.chunk      = chunk;
$.groupBy    = groupBy;
$.pick       = pick;
$.omit       = omit;
$.getPath    = getPath;
$.setPath    = setPath;
$.isEmpty    = isEmpty;
$.capitalize = capitalize;
$.truncate   = truncate;
$.clamp      = clamp;
$.memoize    = memoize;
$.retry      = retry;
$.timeout    = timeout;

// --- Error handling --------------------------------------------------------
$.onError        = onError;
$.ZQueryError    = ZQueryError;
$.ErrorCode      = ErrorCode;
$.guardCallback  = guardCallback;
$.guardAsync     = guardAsync;
$.validate       = validate;
$.formatError    = formatError;

// --- WebRTC ----------------------------------------------------------------
$.webrtc             = webrtc;
$.SignalingClient    = SignalingClient;
$.Peer               = Peer;
$.Room               = Room;
$.useRoom            = useRoom;
$.usePeer            = usePeer;
$.useTracks          = useTracks;
$.useDataChannel     = useDataChannel;
$.useConnectionQuality = useConnectionQuality;
$.fetchTurnCredentials = fetchTurnCredentials;
$.mergeIceServers    = mergeIceServers;
$.createTurnRefresher = createTurnRefresher;
$.deriveSFrameKey    = deriveSFrameKey;
$.generateSFrameKey  = generateSFrameKey;
$.SFrameContext      = SFrameContext;
$.encryptFrame       = encryptFrame;
$.decryptFrame       = decryptFrame;
$.attachE2ee         = attachE2ee;
$.loadSfuAdapter     = loadSfuAdapter;
$.SfuError           = SfuError;
$.decodeJoinToken    = decodeJoinToken;
$.isJoinTokenExpired = isJoinTokenExpired;
$.samplePeerStats    = samplePeerStats;
$.createStatsSampler = createStatsSampler;
$.classifyStats      = classifyStats;
$.parseSdp           = parseSdp;
$.validateSdp        = validateSdp;
$.parseCandidate     = parseCandidate;
$.stringifyCandidate = stringifyCandidate;
$.filterCandidates   = filterCandidates;
$.isPrivateIp        = isPrivateIp;
$.isLoopbackIp       = isLoopbackIp;
$.isLinkLocalIp      = isLinkLocalIp;
$.isMdnsHostname     = isMdnsHostname;
$.WebRtcError        = WebRtcError;
$.SignalingError     = SignalingError;
$.IceError           = IceError;
$.SdpError           = SdpError;
$.TurnError          = TurnError;
$.E2eeError          = E2eeError;

// --- Meta ------------------------------------------------------------------
$.version   = '1.1.1';
$.libSize   = '~172 KB';
$.unitTests = {"passed":2504,"failed":0,"total":2504,"suites":617,"duration":5969,"ok":true};
$.meta      = {};              // populated at build time by CLI bundler

// --- Environment detection -------------------------------------------------
$.isElectron = typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent)
  || typeof process !== 'undefined' && process.versions != null && !!process.versions.electron;
$.platform = $.isElectron ? 'electron'
  : typeof window !== 'undefined' ? 'browser'
  : 'node';

$.noConflict = () => {
  if (typeof window !== 'undefined' && window.$ === $) {
    delete window.$;
  }
  return $;
};


// ---------------------------------------------------------------------------
// Global exposure (browser)
// ---------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  window.$ = $;
  window.zQuery = $;
}


// ---------------------------------------------------------------------------
// Named exports (ES modules)
// ---------------------------------------------------------------------------

$;

})(typeof window !== 'undefined' ? window : globalThis);
