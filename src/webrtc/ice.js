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

import { IceError } from './errors.js';


// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Recognized ICE candidate types (RFC 5245). */
export const CANDIDATE_TYPES = Object.freeze(['host', 'srflx', 'prflx', 'relay']);

/** Recognized TCP candidate types (RFC 6544 §4.5). */
export const TCP_TYPES = Object.freeze(['active', 'passive', 'so']);


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
export function parseCandidate(line) {
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
export function stringifyCandidate(c) {
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
export function isPrivateIp(addr) {
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
export function isLoopbackIp(addr) {
    if (_isIPv4(addr)) return addr.indexOf('127.') === 0;
    if (_isIPv6(addr)) return addr === '::1' || /^0*:0*:0*:0*:0*:0*:0*:0*1$/.test(addr);
    return false;
}

/** IPv4 169.254/16 and IPv6 fe80::/10. */
export function isLinkLocalIp(addr) {
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
export function isMdnsHostname(host) {
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
export function filterCandidates(candidates, policy = {}) {
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
