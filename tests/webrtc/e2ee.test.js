/**
 * tests/webrtc/e2ee.test.js
 */

import { describe, it, expect } from 'vitest';
import {
    deriveSFrameKey,
    generateSFrameKey,
    SFrameContext,
    encryptFrame,
    decryptFrame,
    attachE2ee,
    E2eeError,
} from '../../src/webrtc/index.js';


const enc = new TextEncoder();
const dec = new TextDecoder();


describe('deriveSFrameKey', () => {
    it('derives a deterministic key from the same passphrase + salt', async () => {
        const k1 = await deriveSFrameKey('correct horse battery', 'room-a');
        const k2 = await deriveSFrameKey('correct horse battery', 'room-a');
        // CryptoKey identity differs but encrypt/decrypt with one should
        // decrypt with the other (same underlying material).
        const ctx1 = new SFrameContext(); ctx1.setKey(0, k1);
        const ctx2 = new SFrameContext(); ctx2.setKey(0, k2);
        const enc1 = await encryptFrame(ctx1, enc.encode('hello'));
        const out  = await decryptFrame(ctx2, enc1);
        expect(dec.decode(out)).toBe('hello');
    });

    it('different passphrases produce non-interoperable keys', async () => {
        const k1 = await deriveSFrameKey('one', 'room-a');
        const k2 = await deriveSFrameKey('two', 'room-a');
        const ctx1 = new SFrameContext(); ctx1.setKey(0, k1);
        const ctx2 = new SFrameContext(); ctx2.setKey(0, k2);
        const frame = await encryptFrame(ctx1, enc.encode('x'));
        await expect(decryptFrame(ctx2, frame)).rejects.toMatchObject({
            code: 'ZQ_WEBRTC_E2EE_AUTH_FAILED',
        });
    });

    it('different salts produce non-interoperable keys', async () => {
        const k1 = await deriveSFrameKey('pw', 'room-a');
        const k2 = await deriveSFrameKey('pw', 'room-b');
        const ctx1 = new SFrameContext(); ctx1.setKey(0, k1);
        const ctx2 = new SFrameContext(); ctx2.setKey(0, k2);
        const frame = await encryptFrame(ctx1, enc.encode('x'));
        await expect(decryptFrame(ctx2, frame)).rejects.toMatchObject({
            code: 'ZQ_WEBRTC_E2EE_AUTH_FAILED',
        });
    });

    it('rejects empty passphrase / salt', async () => {
        await expect(deriveSFrameKey('', 's')).rejects.toMatchObject({ code: 'ZQ_WEBRTC_E2EE_BAD_PASSPHRASE' });
        await expect(deriveSFrameKey('p', '')).rejects.toMatchObject({ code: 'ZQ_WEBRTC_E2EE_BAD_SALT' });
    });
});


describe('SFrameContext', () => {
    it('rejects invalid epochs', async () => {
        const ctx = new SFrameContext();
        const key = await generateSFrameKey();
        expect(() => ctx.setKey(-1, key)).toThrow(/epoch/);
        expect(() => ctx.setKey(256, key)).toThrow(/epoch/);
        expect(() => ctx.setKey(1.5, key)).toThrow(/epoch/);
    });

    it('rejects setKey without a key', async () => {
        const ctx = new SFrameContext();
        expect(() => ctx.setKey(0, null)).toThrow(/key required/);
    });

    it('tracks current epoch on every setKey', async () => {
        const ctx = new SFrameContext();
        ctx.setKey(0, await generateSFrameKey());
        expect(ctx.currentEpoch).toBe(0);
        ctx.setKey(7, await generateSFrameKey());
        expect(ctx.currentEpoch).toBe(7);
    });

    it('evicts oldest epoch beyond maxEpochs', async () => {
        const ctx = new SFrameContext({ maxEpochs: 2 });
        ctx.setKey(0, await generateSFrameKey());
        ctx.setKey(1, await generateSFrameKey());
        ctx.setKey(2, await generateSFrameKey());
        expect(ctx.epochCount).toBe(2);
        expect(ctx.getKey(0)).toBeNull();
        expect(ctx.getKey(1)).not.toBeNull();
        expect(ctx.getKey(2)).not.toBeNull();
    });

    it('removeEpoch drops a tracked key', async () => {
        const ctx = new SFrameContext();
        ctx.setKey(3, await generateSFrameKey());
        expect(ctx.getKey(3)).not.toBeNull();
        ctx.removeEpoch(3);
        expect(ctx.getKey(3)).toBeNull();
    });
});


describe('encryptFrame / decryptFrame', () => {
    it('round-trips an arbitrary payload', async () => {
        const ctx = new SFrameContext();
        ctx.setKey(0, await generateSFrameKey());
        const payload = enc.encode('the quick brown fox');
        const frame   = await encryptFrame(ctx, payload);

        // Header layout: 1-byte epoch + 12-byte IV
        expect(frame[0]).toBe(0);
        expect(frame.byteLength).toBe(13 + payload.byteLength + 16);

        const plain = await decryptFrame(ctx, frame);
        expect(dec.decode(plain)).toBe('the quick brown fox');
    });

    it('accepts ArrayBuffer payloads', async () => {
        const ctx = new SFrameContext();
        ctx.setKey(0, await generateSFrameKey());
        const ab    = enc.encode('hi').buffer;
        const frame = await encryptFrame(ctx, ab);
        const out   = await decryptFrame(ctx, frame.buffer);
        expect(dec.decode(out)).toBe('hi');
    });

    it('writes the current epoch into the frame header', async () => {
        const ctx = new SFrameContext();
        ctx.setKey(0, await generateSFrameKey());
        ctx.setKey(5, await generateSFrameKey());
        const frame = await encryptFrame(ctx, enc.encode('x'));
        expect(frame[0]).toBe(5);
    });

    it('encryptFrame fails without a key for the current epoch', async () => {
        const ctx = new SFrameContext();
        await expect(encryptFrame(ctx, enc.encode('x'))).rejects.toMatchObject({
            code: 'ZQ_WEBRTC_E2EE_NO_KEY',
        });
    });

    it('decryptFrame fails on a too-short frame', async () => {
        const ctx = new SFrameContext();
        ctx.setKey(0, await generateSFrameKey());
        await expect(decryptFrame(ctx, new Uint8Array(5))).rejects.toMatchObject({
            code: 'ZQ_WEBRTC_E2EE_SHORT_FRAME',
        });
    });

    it('decryptFrame fails when the epoch is unknown', async () => {
        const enc1 = new SFrameContext();
        enc1.setKey(2, await generateSFrameKey());
        const frame = await encryptFrame(enc1, enc.encode('x'));

        const dec1 = new SFrameContext();
        dec1.setKey(7, await generateSFrameKey());
        await expect(decryptFrame(dec1, frame)).rejects.toMatchObject({
            code: 'ZQ_WEBRTC_E2EE_UNKNOWN_EPOCH',
            context: { epoch: 2 },
        });
    });

    it('decryptFrame fails when the key is wrong (AES-GCM auth fails)', async () => {
        const ctx1 = new SFrameContext(); ctx1.setKey(0, await generateSFrameKey());
        const ctx2 = new SFrameContext(); ctx2.setKey(0, await generateSFrameKey());
        const frame = await encryptFrame(ctx1, enc.encode('x'));
        await expect(decryptFrame(ctx2, frame)).rejects.toMatchObject({
            code: 'ZQ_WEBRTC_E2EE_AUTH_FAILED',
        });
    });

    it('decryptFrame fails when the ciphertext is tampered with', async () => {
        const ctx = new SFrameContext();
        ctx.setKey(0, await generateSFrameKey());
        const frame = await encryptFrame(ctx, enc.encode('original'));
        frame[frame.byteLength - 1] ^= 0x01;
        await expect(decryptFrame(ctx, frame)).rejects.toMatchObject({
            code: 'ZQ_WEBRTC_E2EE_AUTH_FAILED',
        });
    });

    it('throws on non-BufferSource payloads', async () => {
        const ctx = new SFrameContext();
        ctx.setKey(0, await generateSFrameKey());
        await expect(encryptFrame(ctx, 'not bytes')).rejects.toMatchObject({
            code: 'ZQ_WEBRTC_E2EE_BAD_INPUT',
        });
    });

    it('encrypt/decrypt require an SFrameContext instance', async () => {
        await expect(encryptFrame({}, new Uint8Array(1))).rejects.toMatchObject({ code: 'ZQ_WEBRTC_E2EE_BAD_CTX' });
        await expect(decryptFrame({}, new Uint8Array(20))).rejects.toMatchObject({ code: 'ZQ_WEBRTC_E2EE_BAD_CTX' });
    });
});


describe('epoch rotation', () => {
    it('decryptor with both epochs decodes frames from either', async () => {
        const k0 = await generateSFrameKey();
        const k1 = await generateSFrameKey();

        const enc0 = new SFrameContext(); enc0.setKey(0, k0);
        const enc1 = new SFrameContext(); enc1.setKey(1, k1);

        const decoder = new SFrameContext();
        decoder.setKey(0, k0);
        decoder.setKey(1, k1);

        const f0 = await encryptFrame(enc0, enc.encode('old'));
        const f1 = await encryptFrame(enc1, enc.encode('new'));

        expect(dec.decode(await decryptFrame(decoder, f0))).toBe('old');
        expect(dec.decode(await decryptFrame(decoder, f1))).toBe('new');
    });

    it('after rotation, frames from the evicted epoch fail to decrypt', async () => {
        const k0 = await generateSFrameKey();
        const k1 = await generateSFrameKey();

        const sender = new SFrameContext();
        sender.setKey(0, k0);
        const stale = await encryptFrame(sender, enc.encode('stale'));

        const receiver = new SFrameContext({ maxEpochs: 1 });
        receiver.setKey(0, k0);
        receiver.setKey(1, k1);   // evicts epoch 0

        await expect(decryptFrame(receiver, stale)).rejects.toMatchObject({
            code: 'ZQ_WEBRTC_E2EE_UNKNOWN_EPOCH',
        });
    });
});


describe('attachE2ee', () => {
    it('rejects something that is not an RTCPeerConnection', () => {
        const ctx = new SFrameContext();
        expect(() => attachE2ee({}, ctx)).toThrow(/RTCPeerConnection/);
    });

    it('rejects a non-SFrameContext', () => {
        const fakePc = { getSenders: () => [], getReceivers: () => [] };
        expect(() => attachE2ee(fakePc, {})).toThrow(/SFrameContext/);
    });

    it('returns a refresh/detach handle and walks senders + receivers', async () => {
        const ctx = new SFrameContext();
        ctx.setKey(0, await generateSFrameKey());

        const senderCalls   = [];
        const receiverCalls = [];
        const fakeSender    = { createEncodedStreams: () => { senderCalls.push(1);   return null; } };
        const fakeReceiver  = { createEncodedStreams: () => { receiverCalls.push(1); return null; } };
        const fakePc = {
            getSenders:   () => [fakeSender],
            getReceivers: () => [fakeReceiver],
        };

        const handle = attachE2ee(fakePc, ctx);
        expect(typeof handle.refresh).toBe('function');
        expect(typeof handle.detach).toBe('function');
        expect(senderCalls).toHaveLength(1);
        expect(receiverCalls).toHaveLength(1);

        // refresh() is idempotent per sender / receiver (WeakSet dedupe).
        handle.refresh();
        expect(senderCalls).toHaveLength(1);

        handle.detach();
    });

    it('survives a sender without createEncodedStreams', () => {
        const ctx = new SFrameContext();
        const fakePc = {
            getSenders:   () => [{}],
            getReceivers: () => [{}],
        };
        expect(() => attachE2ee(fakePc, ctx)).not.toThrow();
    });
});
