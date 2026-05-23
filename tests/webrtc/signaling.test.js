/**
 * tests/webrtc/signaling.test.js
 *
 * Covers the low-level `SignalingClient`:
 *   - connect + hello → peerId
 *   - reconnect on abrupt close with exponential backoff
 *   - protocol error on missing `type` field
 *   - ICE coalescing batches outbound `ice` frames
 *   - SSR-safe import (no globals required at module load)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { SignalingClient, SignalingError } from '../../src/webrtc/index.js';
import { FakeWebSocket, fakeSockets, resetFakeSockets } from '../_helpers/webrtcFakes.js';


function makeClient(overrides = {}) {
    return new SignalingClient('wss://example.test/rtc', Object.assign({
        WebSocket: FakeWebSocket,
        reconnect: { baseMs: 10, capMs: 80, maxRetries: 3 },
        iceFlushMs: 20,
        iceBatch:   3,
    }, overrides));
}


describe('SignalingClient', () => {
    beforeEach(() => {
        resetFakeSockets();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('connect → hello → peerId', async () => {
        const client = makeClient();
        const p = client.connect();

        // First (and only) socket created so far
        expect(fakeSockets.length).toBe(1);
        const ws = fakeSockets[0];
        ws.fakeOpen();
        await p;

        expect(client.connected).toBe(true);
        expect(client.peerId).toBe(null);

        ws.fakeMessage({ type: 'hello', peerId: 'peer-abc' });
        expect(client.peerId).toBe('peer-abc');
    });

    it('dispatches server frames to typed listeners', async () => {
        const client = makeClient();
        const p = client.connect();
        fakeSockets[0].fakeOpen();
        await p;
        fakeSockets[0].fakeMessage({ type: 'hello', peerId: 'me' });

        const seen = [];
        client.on('joined', (frame) => seen.push(frame));
        fakeSockets[0].fakeMessage({ type: 'joined', room: 'lobby', peerId: 'me', peers: ['x', 'y'] });

        expect(seen.length).toBe(1);
        expect(seen[0].room).toBe('lobby');
        expect(seen[0].peers).toEqual(['x', 'y']);
    });

    it('emits a SignalingError when first frame is not a hello', async () => {
        const client = makeClient();
        const errors = [];
        client.on('error', (e) => errors.push(e));
        const p = client.connect();
        fakeSockets[0].fakeOpen();
        await p;

        fakeSockets[0].fakeMessage({ type: 'joined', room: 'x' });
        expect(errors.length).toBeGreaterThanOrEqual(1);
        const err = errors[errors.length - 1];
        expect(err).toBeInstanceOf(SignalingError);
        expect(err.code).toBe('ZQ_WEBRTC_SIGNALING_NO_HELLO');
    });

    it('emits a SignalingError on a frame missing a `type`', async () => {
        const client = makeClient();
        const errors = [];
        client.on('error', (e) => errors.push(e));
        const p = client.connect();
        fakeSockets[0].fakeOpen();
        await p;
        fakeSockets[0].fakeMessage({ type: 'hello', peerId: 'me' });

        fakeSockets[0].fakeMessage({ room: 'lobby' });
        const err = errors[errors.length - 1];
        expect(err).toBeInstanceOf(SignalingError);
        expect(err.code).toBe('ZQ_WEBRTC_SIGNALING_BAD_FRAME');
    });

    it('emits a SignalingError on malformed JSON', async () => {
        const client = makeClient();
        const errors = [];
        client.on('error', (e) => errors.push(e));
        const p = client.connect();
        fakeSockets[0].fakeOpen();
        await p;

        fakeSockets[0].fakeMessage('not-json-at-all');
        const err = errors[errors.length - 1];
        expect(err).toBeInstanceOf(SignalingError);
        expect(err.code).toBe('ZQ_WEBRTC_SIGNALING_BAD_JSON');
    });

    it('throws SignalingError when send() is called without a type', async () => {
        const client = makeClient();
        const p = client.connect();
        fakeSockets[0].fakeOpen();
        await p;
        fakeSockets[0].fakeMessage({ type: 'hello', peerId: 'me' });

        expect(() => client.send('')).toThrow(SignalingError);
    });

    it('reconnects with exponential backoff on abrupt close', async () => {
        const client = makeClient();
        const reconnects = [];
        client.on('reconnect', (e) => reconnects.push(e));

        const p = client.connect();
        fakeSockets[0].fakeOpen();
        await p;

        // First abrupt close → schedules attempt 1 at baseMs * 2^0 = 10
        fakeSockets[0].fakeClose(1006);
        expect(reconnects.length).toBe(1);
        expect(reconnects[0]).toEqual({ attempt: 1, delayMs: 10 });

        // Drive the reconnect WITHOUT firing onopen so backoff continues to grow
        vi.advanceTimersByTime(10);
        expect(fakeSockets.length).toBe(2);

        // Second close (still no successful open) → attempt 2 at 20ms
        fakeSockets[1].fakeClose(1006);
        expect(reconnects[1]).toEqual({ attempt: 2, delayMs: 20 });

        vi.advanceTimersByTime(20);
        expect(fakeSockets.length).toBe(3);

        // Third close → attempt 3 at 40ms
        fakeSockets[2].fakeClose(1006);
        expect(reconnects[2]).toEqual({ attempt: 3, delayMs: 40 });
    });

    it('does not reconnect after .close()', async () => {
        const client = makeClient();
        const p = client.connect();
        fakeSockets[0].fakeOpen();
        await p;
        fakeSockets[0].fakeMessage({ type: 'hello', peerId: 'me' });

        client.close();
        // close() called close(1000) synchronously - no reconnect should be scheduled
        vi.advanceTimersByTime(500);
        expect(fakeSockets.length).toBe(1);
        expect(client.closed).toBe(true);
    });

    it('coalesces outbound ICE frames into batches', async () => {
        const client = makeClient({ iceFlushMs: 50, iceBatch: 3 });
        const p = client.connect();
        const ws = fakeSockets[0];
        ws.fakeOpen();
        await p;
        ws.fakeMessage({ type: 'hello', peerId: 'me' });

        // Send 5 ice frames in quick succession
        for (let i = 0; i < 5; i++) {
            client.send('ice', { to: 'peer-x', candidate: `cand-${i}` });
        }

        // Nothing flushed yet
        const iceSentBefore = ws.sentFrames.filter(f => f.type === 'ice');
        expect(iceSentBefore.length).toBe(0);

        // First window → first 3 flushed
        vi.advanceTimersByTime(50);
        const after1 = ws.sentFrames.filter(f => f.type === 'ice');
        expect(after1.length).toBe(3);
        expect(after1.map(f => f.candidate)).toEqual(['cand-0', 'cand-1', 'cand-2']);

        // Second window → remaining 2 flushed
        vi.advanceTimersByTime(50);
        const after2 = ws.sentFrames.filter(f => f.type === 'ice');
        expect(after2.length).toBe(5);
        expect(after2.map(f => f.candidate)).toEqual(['cand-0', 'cand-1', 'cand-2', 'cand-3', 'cand-4']);
    });

    it('sends non-ICE frames immediately (no coalescing)', async () => {
        const client = makeClient();
        const p = client.connect();
        fakeSockets[0].fakeOpen();
        await p;
        fakeSockets[0].fakeMessage({ type: 'hello', peerId: 'me' });

        client.send('join', { room: 'lobby' });
        const sent = fakeSockets[0].sentFrames;
        expect(sent.length).toBe(1);
        expect(sent[0]).toEqual({ type: 'join', room: 'lobby' });
    });

    it('gives up after maxRetries reconnect attempts', async () => {
        const client = makeClient({ reconnect: { baseMs: 5, capMs: 100, maxRetries: 2 } });
        const errors = [];
        client.on('error', (e) => errors.push(e));
        const p = client.connect();
        fakeSockets[0].fakeOpen();
        await p;

        // Three consecutive failed connects (no fakeOpen on the reconnect sockets)
        fakeSockets[0].fakeClose(1006);
        vi.advanceTimersByTime(5);
        fakeSockets[1].fakeClose(1006);
        vi.advanceTimersByTime(10);
        fakeSockets[2].fakeClose(1006);

        // No more reconnects scheduled - giveup error emitted instead
        const giveup = errors.find(e => e.code === 'ZQ_WEBRTC_SIGNALING_GIVEUP');
        expect(giveup).toBeDefined();
        expect(giveup).toBeInstanceOf(SignalingError);
    });

    it('is SSR-safe: importing the module does not require WebSocket on globalThis', async () => {
        // Snapshot + delete the global WebSocket binding (jsdom provides one)
        const hadWs = 'WebSocket' in globalThis;
        const prev  = hadWs ? globalThis.WebSocket : undefined;
        try {
            // eslint-disable-next-line no-global-assign
            delete globalThis.WebSocket;
            // Re-import via dynamic import to prove module init doesn't read it
            const mod = await import('../../src/webrtc/signaling.js?ssrSafe=1');
            expect(typeof mod.SignalingClient).toBe('function');
            // Constructing also must not touch the global
            const c = new mod.SignalingClient('wss://x/', { WebSocket: FakeWebSocket });
            expect(c.connected).toBe(false);
            expect(c.peerId).toBe(null);
        } finally {
            if (hadWs) globalThis.WebSocket = prev;
        }
    });
});
