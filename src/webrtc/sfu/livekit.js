/**
 * src/webrtc/sfu/livekit.js
 *
 * Thin wrapper around the optional `livekit-client` peer dependency.
 *
 *   - `livekit-client` is intentionally NOT bundled. Apps that want it
 *     must `npm install livekit-client` themselves.
 *   - If it isn't installed, `createLivekitAdapter()` throws
 *     `ZQ_WEBRTC_SFU_PEER_MISSING` with an actionable message.
 *   - The adapter exposes a LiveKit `Room` instance plus `connect()` /
 *     `disconnect()` helpers. The higher-level zQuery `Room` mapping
 *     lives in the consuming app for now; calling `.join()` throws
 *     `ZQ_WEBRTC_SFU_JOIN_UNAVAILABLE`.
 */

import { SfuError } from '../errors.js';


/**
 * Dynamically import `livekit-client`. Returns the module's exports.
 * Throws `SfuError(ZQ_WEBRTC_SFU_PEER_MISSING)` if the package is absent.
 *
 * @returns {Promise<any>}
 */
async function _importLivekitClient() {
    try {
        // Compose the package name at runtime so static bundlers (Vite,
        // Rollup, esbuild) don't try to resolve the optional peer dep.
        const pkg = ['livekit', 'client'].join('-');
        return await import(/* @vite-ignore */ pkg);
    } catch (cause) {
        throw new SfuError(
            'livekit-client peer dependency is not installed; run `npm install livekit-client`',
            { code: 'ZQ_WEBRTC_SFU_PEER_MISSING', cause },
        );
    }
}


/**
 * Build a LiveKit-client adapter.
 *
 * @param {object} [opts]
 * @param {any}    [opts.client]       Pre-imported livekit-client module (test hook).
 * @param {object} [opts.roomOptions]  Forwarded to `new Room(...)`.
 * @returns {Promise<import('./index.js').SfuAdapter>}
 */
export async function createLivekitAdapter(opts = {}) {
    const mod    = opts.client || await _importLivekitClient();
    const RoomCtor = mod.Room || (mod.default && mod.default.Room);
    if (typeof RoomCtor !== 'function') {
        throw new SfuError('livekit-client module did not expose a Room constructor', {
            code: 'ZQ_WEBRTC_SFU_BAD_MODULE',
        });
    }

    let room;
    try {
        room = new RoomCtor(opts.roomOptions || {});
    } catch (cause) {
        throw new SfuError('failed to construct livekit-client Room', {
            code: 'ZQ_WEBRTC_SFU_ROOM_FAILED',
            cause,
        });
    }

    let connected = false;

    return {
        name: 'livekit',
        room,

        /** Has `connect()` resolved at least once and not been undone by disconnect? */
        get connected() {
            return connected;
        },

        /**
         * Connect to a LiveKit server.
         * @param {string} url            LiveKit signaling URL (`wss://...`).
         * @param {string} token          Room access token (JWT) minted server-side.
         * @param {object} [connectOpts]  Forwarded to `room.connect(...)`.
         * @returns {Promise<void>}
         */
        async connect(url, token, connectOpts) {
            if (typeof url !== 'string' || !url) {
                throw new SfuError('connect(url, token): url required', {
                    code: 'ZQ_WEBRTC_SFU_BAD_URL',
                });
            }
            if (typeof token !== 'string' || !token) {
                throw new SfuError('connect(url, token): token required', {
                    code: 'ZQ_WEBRTC_SFU_BAD_TOKEN',
                });
            }
            try {
                await room.connect(url, token, connectOpts);
                connected = true;
            } catch (cause) {
                throw new SfuError('livekit-client Room.connect() failed', {
                    code: 'ZQ_WEBRTC_SFU_CONNECT_FAILED',
                    cause,
                });
            }
        },

        /** Disconnect from the LiveKit server (best effort). */
        async disconnect() {
            if (!connected) return;
            try {
                await room.disconnect();
            } finally {
                connected = false;
            }
        },

        /**
         * Reserved for the higher-level join flow that maps a LiveKit `Room`
         * to a zQuery `Room`. Not implemented yet.
         *
         * @param {any} _joinOpts
         * @returns {Promise<never>}
         */
        async join(_joinOpts) {
            throw new SfuError(
                'livekit adapter.join() not implemented; use connect(url, token) and the underlying livekit-client Room directly',
                { code: 'ZQ_WEBRTC_SFU_JOIN_UNAVAILABLE' },
            );
        },
    };
}
