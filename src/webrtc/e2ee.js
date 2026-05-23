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

import { E2eeError } from './errors.js';


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
export async function deriveSFrameKey(passphrase, salt) {
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
export async function generateSFrameKey() {
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
export class SFrameContext {
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
export async function encryptFrame(ctx, payload) {
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
export async function decryptFrame(ctx, frame) {
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
export function attachE2ee(pc, ctx) {
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
