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

import { WebRtcError } from './errors.js';


/**
 * Decode a join token issued by the server.
 *
 * @param {string} token
 * @returns {{ user: { id: string } | null, room: string | null, exp: number | null, raw: any }}
 */
export function decodeJoinToken(token) {
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
export function isJoinTokenExpired(decoded, opts = {}) {
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
