/**
 * tests/webrtc/sfu-livekit.test.js
 */

import { describe, it, expect } from 'vitest';
import { loadSfuAdapter, createLivekitAdapter, SfuError } from '../../src/webrtc/index.js';


function makeFakeLivekitClient({ failConnect = false } = {}) {
    const events = { connect: [], disconnect: [] };
    class FakeRoom {
        constructor(opts) {
            this.opts = opts;
            events.connect.push([]);
            events.disconnect.push([]);
        }
        async connect(url, token, connectOpts) {
            this.lastConnect = { url, token, connectOpts };
            if (failConnect) throw new Error('connect rejected');
        }
        async disconnect() {
            this.disconnected = true;
        }
    }
    return { mod: { Room: FakeRoom }, events };
}


describe('createLivekitAdapter (with mock)', () => {
    it('loadSfuAdapter(\'livekit\') without livekit-client throws ZQ_WEBRTC_SFU_PEER_MISSING', async () => {
        await expect(loadSfuAdapter('livekit')).rejects.toMatchObject({
            code: 'ZQ_WEBRTC_SFU_PEER_MISSING',
        });
    });

    it('throws ZQ_WEBRTC_SFU_BAD_MODULE when Room is missing', async () => {
        await expect(createLivekitAdapter({ client: {} })).rejects.toMatchObject({
            code: 'ZQ_WEBRTC_SFU_BAD_MODULE',
        });
    });

    it('accepts a `default` export wrapper', async () => {
        const { mod } = makeFakeLivekitClient();
        const a = await createLivekitAdapter({ client: { default: mod } });
        expect(a.name).toBe('livekit');
    });

    it('wraps Room-constructor exceptions in SfuError', async () => {
        class BoomRoom { constructor() { throw new Error('boom'); } }
        await expect(createLivekitAdapter({ client: { Room: BoomRoom } })).rejects.toMatchObject({
            code: 'ZQ_WEBRTC_SFU_ROOM_FAILED',
        });
    });

    it('builds an adapter with name=livekit, room, connected=false', async () => {
        const { mod } = makeFakeLivekitClient();
        const a = await loadSfuAdapter('livekit', { client: mod, roomOptions: { adaptiveStream: true } });
        expect(a.name).toBe('livekit');
        expect(a.room).toBeDefined();
        expect(a.room.opts).toEqual({ adaptiveStream: true });
        expect(a.connected).toBe(false);
    });

    it('connect() validates url and token', async () => {
        const { mod } = makeFakeLivekitClient();
        const a = await createLivekitAdapter({ client: mod });
        await expect(a.connect('', 'tok')).rejects.toMatchObject({ code: 'ZQ_WEBRTC_SFU_BAD_URL' });
        await expect(a.connect('wss://x', '')).rejects.toMatchObject({ code: 'ZQ_WEBRTC_SFU_BAD_TOKEN' });
    });

    it('connect() forwards url + token + opts and flips connected=true', async () => {
        const { mod } = makeFakeLivekitClient();
        const a = await createLivekitAdapter({ client: mod });
        await a.connect('wss://lk.example', 'tok-123', { autoSubscribe: true });
        expect(a.connected).toBe(true);
        expect(a.room.lastConnect).toEqual({
            url: 'wss://lk.example',
            token: 'tok-123',
            connectOpts: { autoSubscribe: true },
        });
    });

    it('connect() wraps underlying failures', async () => {
        const { mod } = makeFakeLivekitClient({ failConnect: true });
        const a = await createLivekitAdapter({ client: mod });
        await expect(a.connect('wss://lk.example', 'tok')).rejects.toMatchObject({
            code: 'ZQ_WEBRTC_SFU_CONNECT_FAILED',
        });
        expect(a.connected).toBe(false);
    });

    it('disconnect() is a no-op when not connected', async () => {
        const { mod } = makeFakeLivekitClient();
        const a = await createLivekitAdapter({ client: mod });
        await a.disconnect();
        expect(a.room.disconnected).toBeUndefined();
    });

    it('disconnect() calls underlying disconnect and resets connected', async () => {
        const { mod } = makeFakeLivekitClient();
        const a = await createLivekitAdapter({ client: mod });
        await a.connect('wss://lk.example', 'tok');
        await a.disconnect();
        expect(a.room.disconnected).toBe(true);
        expect(a.connected).toBe(false);
    });

    it('join() throws ZQ_WEBRTC_SFU_JOIN_UNAVAILABLE (not yet wired)', async () => {
        const { mod } = makeFakeLivekitClient();
        const a = await createLivekitAdapter({ client: mod });
        try {
            await a.join({});
            throw new Error('expected throw');
        } catch (err) {
            expect(err).toBeInstanceOf(SfuError);
            expect(err.code).toBe('ZQ_WEBRTC_SFU_JOIN_UNAVAILABLE');
        }
    });
});
