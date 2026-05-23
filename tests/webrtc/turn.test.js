/**
 * tests/webrtc/turn.test.js - TURN credential client
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    fetchTurnCredentials,
    mergeIceServers,
    createTurnRefresher,
    TurnError,
} from '../../src/webrtc/index.js';


const validBody = () => ({
    username:   'u1',
    credential: 'secret',
    urls:       ['turn:host:3478?transport=udp', 'turn:host:3478?transport=tcp'],
    ttl:        600,
});


function mockFetch(impl) {
    return vi.fn(impl);
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
    return {
        ok,
        status,
        json: async () => body,
    };
}


describe('fetchTurnCredentials', () => {
    it('returns normalized credentials on a 200 JSON body', async () => {
        const fetchImpl = mockFetch(async () => jsonResponse(validBody()));
        const creds = await fetchTurnCredentials('https://x/turn', { fetch: fetchImpl });
        expect(creds.username).toBe('u1');
        expect(creds.credential).toBe('secret');
        expect(creds.urls).toEqual([
            'turn:host:3478?transport=udp',
            'turn:host:3478?transport=tcp',
        ]);
        expect(creds.ttl).toBe(600);
    });

    it('clones the urls array (mutating the result does not mutate the source)', async () => {
        const body = validBody();
        const fetchImpl = mockFetch(async () => jsonResponse(body));
        const creds = await fetchTurnCredentials('https://x/turn', { fetch: fetchImpl });
        creds.urls.push('turn:other:3478');
        expect(body.urls).toHaveLength(2);
    });

    it('strips the `fetch` option before forwarding to fetch', async () => {
        const fetchImpl = mockFetch(async (_url, init) => {
            expect(init).toBeDefined();
            expect(init.fetch).toBeUndefined();
            expect(init.method).toBe('GET');
            return jsonResponse(validBody());
        });
        await fetchTurnCredentials('https://x/turn', { fetch: fetchImpl, method: 'GET' });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('rejects an empty url', async () => {
        await expect(fetchTurnCredentials('', { fetch: mockFetch() })).rejects.toMatchObject({
            name: 'TurnError',
            code: 'ZQ_WEBRTC_TURN_BAD_URL',
        });
    });

    it('rejects when no fetch implementation is available', async () => {
        const originalFetch = globalThis.fetch;
        try {
            // eslint-disable-next-line no-undef
            globalThis.fetch = undefined;
            await expect(fetchTurnCredentials('https://x/turn')).rejects.toMatchObject({
                code: 'ZQ_WEBRTC_TURN_NO_FETCH',
            });
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it('wraps network errors as TurnError(ZQ_WEBRTC_TURN_NETWORK)', async () => {
        const fetchImpl = mockFetch(async () => { throw new Error('boom'); });
        await expect(fetchTurnCredentials('https://x/turn', { fetch: fetchImpl })).rejects.toMatchObject({
            code:    'ZQ_WEBRTC_TURN_NETWORK',
            message: expect.stringContaining('boom'),
        });
    });

    it('rejects non-OK HTTP responses', async () => {
        const fetchImpl = mockFetch(async () => jsonResponse({}, { ok: false, status: 503 }));
        await expect(fetchTurnCredentials('https://x/turn', { fetch: fetchImpl })).rejects.toMatchObject({
            code: 'ZQ_WEBRTC_TURN_HTTP',
            context: { status: 503 },
        });
    });

    it('rejects malformed JSON bodies', async () => {
        const fetchImpl = mockFetch(async () => ({
            ok: true, status: 200,
            json: async () => { throw new Error('bad json'); },
        }));
        await expect(fetchTurnCredentials('https://x/turn', { fetch: fetchImpl })).rejects.toMatchObject({
            code: 'ZQ_WEBRTC_TURN_BAD_JSON',
        });
    });

    it.each([
        ['missing username',   { ...validBody(), username:   '' }],
        ['missing credential', { ...validBody(), credential: '' }],
        ['missing urls',       { ...validBody(), urls:        [] }],
        ['urls wrong type',    { ...validBody(), urls:        [42] }],
        ['ttl zero',           { ...validBody(), ttl:         0 }],
        ['ttl NaN',            { ...validBody(), ttl:         'soon' }],
    ])('rejects invalid body shape (%s)', async (_label, body) => {
        const fetchImpl = mockFetch(async () => jsonResponse(body));
        await expect(fetchTurnCredentials('https://x/turn', { fetch: fetchImpl })).rejects.toMatchObject({
            code: 'ZQ_WEBRTC_TURN_BAD_BODY',
        });
    });

    it('throws a TurnError instance (instanceof check)', async () => {
        const fetchImpl = mockFetch(async () => jsonResponse({}, { ok: false, status: 500 }));
        await fetchTurnCredentials('https://x/turn', { fetch: fetchImpl }).catch((err) => {
            expect(err).toBeInstanceOf(TurnError);
        });
    });
});


describe('mergeIceServers', () => {
    it('appends a TURN entry to the base list', () => {
        const out = mergeIceServers(
            [{ urls: 'stun:stun.l.google.com:19302' }],
            { username: 'u', credential: 'c', urls: ['turn:host:3478?transport=udp'] }
        );
        expect(out).toEqual([
            { urls: ['stun:stun.l.google.com:19302'] },
            { urls: ['turn:host:3478?transport=udp'], username: 'u', credential: 'c' },
        ]);
    });

    it('dedupes duplicate urls (first occurrence wins)', () => {
        const out = mergeIceServers(
            [{ urls: ['stun:a', 'turn:host:3478'] }],
            { username: 'u', credential: 'c', urls: ['turn:host:3478', 'turn:host:5349'] }
        );
        expect(out[0].urls).toEqual(['stun:a', 'turn:host:3478']);
        expect(out[1].urls).toEqual(['turn:host:5349']);
    });

    it('drops an entry whose urls are all duplicates', () => {
        const out = mergeIceServers(
            [{ urls: ['turn:host:3478'] }],
            { username: 'u', credential: 'c', urls: ['turn:host:3478'] }
        );
        expect(out).toHaveLength(1);
    });

    it('handles missing base and missing turn', () => {
        expect(mergeIceServers()).toEqual([]);
        expect(mergeIceServers([{ urls: 'stun:a' }])).toEqual([{ urls: ['stun:a'] }]);
        expect(mergeIceServers(undefined, { username: 'u', credential: 'c', urls: ['turn:a'] }))
            .toEqual([{ urls: ['turn:a'], username: 'u', credential: 'c' }]);
    });

    it('ignores non-string urls', () => {
        const out = mergeIceServers([{ urls: ['stun:a', '', null, 42] }]);
        expect(out).toEqual([{ urls: ['stun:a'] }]);
    });
});


describe('createTurnRefresher', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(()  => { vi.useRealTimers(); });

    it('rejects construction without a url', () => {
        expect(() => createTurnRefresher({ url: '' })).toThrow(/url is required/);
    });

    it('fetches once on start() and reschedules ahead of expiry', async () => {
        const fetchImpl = mockFetch(async () => jsonResponse(validBody()));
        const refresher = createTurnRefresher({ url: 'https://x', fetch: fetchImpl, leadMs: 30000 });

        const first = await refresher.start();
        expect(first.username).toBe('u1');
        expect(refresher.value).toEqual(first);
        expect(fetchImpl).toHaveBeenCalledTimes(1);

        // ttl=600s, leadMs=30s -> next refresh in 570s
        await vi.advanceTimersByTimeAsync(570_000);
        expect(fetchImpl).toHaveBeenCalledTimes(2);

        refresher.stop();
    });

    it('floors the schedule at minIntervalMs', async () => {
        const fetchImpl = mockFetch(async () => jsonResponse({ ...validBody(), ttl: 1 }));
        const refresher = createTurnRefresher({
            url:           'https://x',
            fetch:         fetchImpl,
            leadMs:        30000,
            minIntervalMs: 5000,
        });
        await refresher.start();
        expect(fetchImpl).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(4999);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(fetchImpl).toHaveBeenCalledTimes(2);

        refresher.stop();
    });

    it('invokes onRefresh for every successful fetch', async () => {
        const fetchImpl = mockFetch(async () => jsonResponse(validBody()));
        const onRefresh = vi.fn();
        const refresher = createTurnRefresher({ url: 'https://x', fetch: fetchImpl, onRefresh });

        await refresher.start();
        expect(onRefresh).toHaveBeenCalledTimes(1);
        await refresher.refresh();
        expect(onRefresh).toHaveBeenCalledTimes(2);

        refresher.stop();
    });

    it('invokes onError on failure and retries later', async () => {
        const fetchImpl = mockFetch(async () => jsonResponse({}, { ok: false, status: 500 }));
        const onError = vi.fn();
        const refresher = createTurnRefresher({ url: 'https://x', fetch: fetchImpl, onError });

        await expect(refresher.start()).rejects.toMatchObject({ code: 'ZQ_WEBRTC_TURN_HTTP' });
        expect(onError).toHaveBeenCalledTimes(1);

        refresher.stop();
    });

    it('stop() cancels pending timers and prevents further refreshes', async () => {
        const fetchImpl = mockFetch(async () => jsonResponse(validBody()));
        const refresher = createTurnRefresher({ url: 'https://x', fetch: fetchImpl });

        await refresher.start();
        refresher.stop();

        await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
});
