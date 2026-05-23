/**
 * src/webrtc/turn.js - TURN credential client
 *
 * Tiny HTTP helper for the `@zero-server/webrtc` TURN-credential endpoint
 * (`issueTurnCredentials`). Fetches `{ username, credential, urls, ttl }`
 * and exposes an `RTCIceServer[]` for direct injection into
 * `RTCPeerConnection({ iceServers })`. A `createTurnRefresher` factory
 * schedules an automatic refresh before the credentials expire.
 */

import { TurnError } from './errors.js';


/**
 * Fetch a TURN credential bundle from `url`.
 *
 * @param {string} url
 * @param {RequestInit} [opts]
 * @returns {Promise<{username: string, credential: string, urls: string[], ttl: number}>}
 */
export async function fetchTurnCredentials(url, opts) {
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
export function mergeIceServers(base, turn) {
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
export function createTurnRefresher(opts) {
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
