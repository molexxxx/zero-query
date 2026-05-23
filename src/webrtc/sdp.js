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

import { SdpError } from './errors.js';


/** Max SDP size accepted by the server. */
const DEFAULT_MAX_BYTES = 65_536;

/** Required transport protocol per server validator. */
const REQUIRED_PROTO = 'UDP/TLS/RTP/SAVPF';

/** Valid SDP direction attributes (RFC 8866 §6.7). */
export const SDP_DIRECTIONS = Object.freeze(['sendrecv', 'sendonly', 'recvonly', 'inactive']);


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
export function parseSdp(text, opts = {}) {
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
export function validateSdp(text) {
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
