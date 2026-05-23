/**
 * src/webrtc/sfu/index.js
 *
 * SFU adapter registry. Adapters are dynamic-imported so the (optional)
 * peer dependencies (`mediasoup-client`, `livekit-client`) only load
 * when actually used.
 *
 * Public surface:
 *   - `loadSfuAdapter(name, opts?)` → `Promise<SfuAdapter>`
 */

import { SfuError } from '../errors.js';
import { createMediasoupAdapter } from './mediasoup.js';
import { createLivekitAdapter } from './livekit.js';


/**
 * @typedef {object} SfuAdapter
 * @property {'mediasoup'|'livekit'} name
 * @property {(joinOpts: any) => Promise<any>} join
 */


/**
 * Load an SFU adapter by name. The adapter's peer dependency must be
 * installed by the consuming app.
 *
 * @param {'mediasoup'|'livekit'} name
 * @param {object} [opts]
 * @returns {Promise<SfuAdapter>}
 */
export async function loadSfuAdapter(name, opts = {}) {
    if (name === 'mediasoup') {
        return createMediasoupAdapter(opts);
    }
    if (name === 'livekit') {
        return createLivekitAdapter(opts);
    }
    throw new SfuError(`unknown SFU adapter: ${name}`, {
        code: 'ZQ_WEBRTC_SFU_UNKNOWN',
        context: { name },
    });
}
