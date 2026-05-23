/**
 * src/webrtc/sfu/mediasoup.js
 *
 * Thin wrapper around the optional `mediasoup-client` peer dependency.
 *
 *   - `mediasoup-client` is intentionally NOT bundled. Apps that want it
 *     must `npm install mediasoup-client` themselves.
 *   - If it isn't installed, `createMediasoupAdapter()` throws
 *     `ZQ_WEBRTC_SFU_PEER_MISSING` with an actionable message.
 *   - The adapter exposes the lower-level mediasoup `Device` plus
 *     helpers for `load(routerRtpCapabilities)`, `canProduce(kind)`,
 *     `createSendTransport(params)`, `createRecvTransport(params)`.
 *   - The higher-level `adapter.join(joinOpts)` requires SFU-specific
 *     signaling (request → response over a data channel or HTTP). That
 *     glue lives in the consuming app for now; calling `.join()` throws
 *     `ZQ_WEBRTC_SFU_JOIN_UNAVAILABLE` so the limitation is explicit.
 */

import { SfuError } from '../errors.js';


/**
 * Dynamically import `mediasoup-client`. Returns the module's exports.
 * Throws `SfuError(ZQ_WEBRTC_SFU_PEER_MISSING)` if the package is absent.
 *
 * @returns {Promise<any>}
 */
async function _importMediasoupClient() {
    try {
        // The package name is computed at runtime so static bundlers (Vite,
        // Rollup, esbuild) don't try to resolve the optional peer dep at
        // build time and fail the build when it isn't installed.
        const pkg = ['mediasoup', 'client'].join('-');
        return await import(/* @vite-ignore */ pkg);
    } catch (cause) {
        throw new SfuError(
            'mediasoup-client peer dependency is not installed; run `npm install mediasoup-client`',
            { code: 'ZQ_WEBRTC_SFU_PEER_MISSING', cause },
        );
    }
}


/**
 * Build a mediasoup-client adapter.
 *
 * @param {object} [opts]
 * @param {any}    [opts.client]         Pre-imported mediasoup-client module (test hook).
 * @param {object} [opts.deviceOptions]  Forwarded to `new Device(...)`.
 * @returns {Promise<import('./index.js').SfuAdapter>}
 */
export async function createMediasoupAdapter(opts = {}) {
    const mod    = opts.client || await _importMediasoupClient();
    const Device = mod.Device || (mod.default && mod.default.Device);
    if (typeof Device !== 'function') {
        throw new SfuError('mediasoup-client module did not expose a Device constructor', {
            code: 'ZQ_WEBRTC_SFU_BAD_MODULE',
        });
    }

    let device;
    try {
        device = new Device(opts.deviceOptions || {});
    } catch (cause) {
        throw new SfuError('failed to construct mediasoup-client Device', {
            code: 'ZQ_WEBRTC_SFU_DEVICE_FAILED',
            cause,
        });
    }

    return {
        name: 'mediasoup',
        device,

        /** Has `device.load({ routerRtpCapabilities })` been called yet? */
        get loaded() {
            return !!device.loaded;
        },

        /**
         * Load the device with the SFU router's RTP capabilities.
         * @param {any} routerRtpCapabilities
         * @returns {Promise<void>}
         */
        async load(routerRtpCapabilities) {
            if (!routerRtpCapabilities || typeof routerRtpCapabilities !== 'object') {
                throw new SfuError('load(routerRtpCapabilities): routerRtpCapabilities required', {
                    code: 'ZQ_WEBRTC_SFU_BAD_RTP_CAPS',
                });
            }
            if (device.loaded) return;
            try {
                await device.load({ routerRtpCapabilities });
            } catch (cause) {
                throw new SfuError('device.load() failed', {
                    code: 'ZQ_WEBRTC_SFU_LOAD_FAILED',
                    cause,
                });
            }
        },

        /**
         * @param {'audio'|'video'} kind
         * @returns {boolean}
         */
        canProduce(kind) {
            if (!device.loaded) {
                throw new SfuError('canProduce(): device not loaded yet', {
                    code: 'ZQ_WEBRTC_SFU_NOT_LOADED',
                });
            }
            return !!device.canProduce(kind);
        },

        /** @param {any} params */
        createSendTransport(params) {
            if (!device.loaded) {
                throw new SfuError('createSendTransport(): device not loaded yet', {
                    code: 'ZQ_WEBRTC_SFU_NOT_LOADED',
                });
            }
            return device.createSendTransport(params);
        },

        /** @param {any} params */
        createRecvTransport(params) {
            if (!device.loaded) {
                throw new SfuError('createRecvTransport(): device not loaded yet', {
                    code: 'ZQ_WEBRTC_SFU_NOT_LOADED',
                });
            }
            return device.createRecvTransport(params);
        },

        /**
         * Reserved for the higher-level join flow once SFU-specific signaling
         * is wired through `Room`. Today, callers should use the device and
         * transport helpers above directly.
         *
         * @param {any} _joinOpts
         * @returns {Promise<never>}
         */
        async join(_joinOpts) {
            throw new SfuError(
                'mediasoup adapter.join() not implemented; use device + createSendTransport/createRecvTransport with your SFU signaling layer',
                { code: 'ZQ_WEBRTC_SFU_JOIN_UNAVAILABLE' },
            );
        },
    };
}
