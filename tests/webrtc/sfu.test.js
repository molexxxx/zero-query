/**
 * tests/webrtc/sfu.test.js
 */

import { describe, it, expect, vi } from 'vitest';
import { loadSfuAdapter, createMediasoupAdapter, SfuError } from '../../src/webrtc/index.js';


function makeFakeMediasoupClient({ loaded = false, canProduce = true } = {}) {
    const transports = [];
    class FakeDevice {
        constructor(opts) {
            this.opts   = opts;
            this.loaded = loaded;
            this.loadCalls = [];
        }
        async load({ routerRtpCapabilities }) {
            this.loadCalls.push(routerRtpCapabilities);
            this.loaded = true;
        }
        canProduce(kind) { return canProduce && (kind === 'audio' || kind === 'video'); }
        createSendTransport(params) {
            const t = { kind: 'send', params };
            transports.push(t);
            return t;
        }
        createRecvTransport(params) {
            const t = { kind: 'recv', params };
            transports.push(t);
            return t;
        }
    }
    return { mod: { Device: FakeDevice }, transports };
}


describe('loadSfuAdapter', () => {
    it('rejects unknown adapter names', async () => {
        await expect(loadSfuAdapter('nope')).rejects.toMatchObject({
            code: 'ZQ_WEBRTC_SFU_UNKNOWN',
        });
    });

    it('rejects livekit when livekit-client is not installed (peer-dep missing)', async () => {
        await expect(loadSfuAdapter('livekit')).rejects.toMatchObject({
            code: 'ZQ_WEBRTC_SFU_PEER_MISSING',
        });
    });

    it('throws ZQ_WEBRTC_SFU_PEER_MISSING when mediasoup-client is not installed', async () => {
        // mediasoup-client is genuinely not in this project's deps, so the
        // dynamic import will fail.
        await expect(loadSfuAdapter('mediasoup')).rejects.toMatchObject({
            code: 'ZQ_WEBRTC_SFU_PEER_MISSING',
        });
    });

    it('builds a mediasoup adapter with an injected client mock', async () => {
        const { mod } = makeFakeMediasoupClient();
        const adapter = await loadSfuAdapter('mediasoup', { client: mod, deviceOptions: { handlerName: 'TestHandler' } });
        expect(adapter.name).toBe('mediasoup');
        expect(adapter.device).toBeDefined();
        expect(adapter.device.opts).toEqual({ handlerName: 'TestHandler' });
        expect(adapter.loaded).toBe(false);
    });
});


describe('createMediasoupAdapter (with mock)', () => {
    it('throws ZQ_WEBRTC_SFU_BAD_MODULE when Device is missing', async () => {
        await expect(createMediasoupAdapter({ client: {} })).rejects.toMatchObject({
            code: 'ZQ_WEBRTC_SFU_BAD_MODULE',
        });
    });

    it('also accepts a `default` export wrapper', async () => {
        const { mod } = makeFakeMediasoupClient();
        const adapter = await createMediasoupAdapter({ client: { default: mod } });
        expect(adapter.name).toBe('mediasoup');
    });

    it('wraps Device-constructor exceptions in SfuError', async () => {
        class BoomDevice { constructor() { throw new Error('boom'); } }
        await expect(createMediasoupAdapter({ client: { Device: BoomDevice } })).rejects.toMatchObject({
            code: 'ZQ_WEBRTC_SFU_DEVICE_FAILED',
        });
    });

    it('load() requires routerRtpCapabilities', async () => {
        const { mod } = makeFakeMediasoupClient();
        const a = await createMediasoupAdapter({ client: mod });
        await expect(a.load()).rejects.toMatchObject({ code: 'ZQ_WEBRTC_SFU_BAD_RTP_CAPS' });
        await expect(a.load(null)).rejects.toMatchObject({ code: 'ZQ_WEBRTC_SFU_BAD_RTP_CAPS' });
    });

    it('load() forwards routerRtpCapabilities to the Device once', async () => {
        const { mod } = makeFakeMediasoupClient();
        const a = await createMediasoupAdapter({ client: mod });
        const caps = { codecs: [], headerExtensions: [] };
        await a.load(caps);
        expect(a.loaded).toBe(true);
        expect(a.device.loadCalls).toEqual([caps]);
        // Calling again is a no-op (device.loaded short-circuits).
        await a.load(caps);
        expect(a.device.loadCalls).toEqual([caps]);
    });

    it('wraps device.load() failures', async () => {
        class FailingDevice {
            constructor() { this.loaded = false; }
            async load() { throw new Error('rtp parse failed'); }
        }
        const a = await createMediasoupAdapter({ client: { Device: FailingDevice } });
        await expect(a.load({ codecs: [] })).rejects.toMatchObject({
            code: 'ZQ_WEBRTC_SFU_LOAD_FAILED',
        });
    });

    it('canProduce / createSendTransport / createRecvTransport require load()', async () => {
        const { mod } = makeFakeMediasoupClient();
        const a = await createMediasoupAdapter({ client: mod });
        expect(() => a.canProduce('audio')).toThrow(/not loaded/);
        expect(() => a.createSendTransport({})).toThrow(/not loaded/);
        expect(() => a.createRecvTransport({})).toThrow(/not loaded/);
    });

    it('after load(), forwards transport creation to the device', async () => {
        const { mod, transports } = makeFakeMediasoupClient();
        const a = await createMediasoupAdapter({ client: mod });
        await a.load({ codecs: [] });

        expect(a.canProduce('audio')).toBe(true);
        expect(a.canProduce('video')).toBe(true);

        const send = a.createSendTransport({ id: 'send-1' });
        const recv = a.createRecvTransport({ id: 'recv-1' });
        expect(send).toEqual({ kind: 'send', params: { id: 'send-1' } });
        expect(recv).toEqual({ kind: 'recv', params: { id: 'recv-1' } });
        expect(transports).toHaveLength(2);
    });

    it('join() throws ZQ_WEBRTC_SFU_JOIN_UNAVAILABLE (not yet wired)', async () => {
        const { mod } = makeFakeMediasoupClient();
        const a = await createMediasoupAdapter({ client: mod });
        await expect(a.join({})).rejects.toMatchObject({
            code: 'ZQ_WEBRTC_SFU_JOIN_UNAVAILABLE',
        });
    });

    it('SfuError is exported and instanceof WebRtcError', async () => {
        const { mod } = makeFakeMediasoupClient();
        const a = await createMediasoupAdapter({ client: mod });
        try {
            await a.join({});
        } catch (err) {
            expect(err).toBeInstanceOf(SfuError);
            expect(err.code).toBe('ZQ_WEBRTC_SFU_JOIN_UNAVAILABLE');
        }
    });
});
