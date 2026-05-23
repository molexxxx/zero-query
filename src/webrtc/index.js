/**
 * src/webrtc/index.js - WebRTC public barrel
 *
 * Re-exports the WebRTC-related error classes and the low-level
 * `SignalingClient`, plus a stub `webrtc` namespace whose high-level
 * `join()` helper currently throws - the room/peer/track surface lands
 * in subsequent passes.
 *
 * Keeping the namespace shape stable from day one means consumers can
 * already import `$.webrtc` and reach for `SignalingClient`,
 * `WebRtcError`, etc., without having to rewire imports when the rest
 * of the surface ships.
 */

import { SignalingClient } from './signaling.js';
import { Peer } from './peer.js';
import {
    parseSdp, validateSdp, SDP_DIRECTIONS,
} from './sdp.js';
import {
    parseCandidate, stringifyCandidate, filterCandidates,
    isPrivateIp, isLoopbackIp, isLinkLocalIp, isMdnsHostname,
    CANDIDATE_TYPES, TCP_TYPES,
} from './ice.js';
import {
    WebRtcError, SignalingError, IceError, SdpError, TurnError, E2eeError,
} from './errors.js';


export { SignalingClient } from './signaling.js';
export { Peer } from './peer.js';
export {
    parseSdp, validateSdp, SDP_DIRECTIONS,
} from './sdp.js';
export {
    parseCandidate, stringifyCandidate, filterCandidates,
    isPrivateIp, isLoopbackIp, isLinkLocalIp, isMdnsHostname,
    CANDIDATE_TYPES, TCP_TYPES,
} from './ice.js';
export {
    WebRtcError, SignalingError, IceError, SdpError, TurnError, E2eeError,
} from './errors.js';


/**
 * High-level WebRTC namespace. Most members are stubs in this release -
 * only `SignalingClient` is wired through. Calling `webrtc.join()` will
 * throw a `WebRtcError` with code `ZQ_WEBRTC_NOT_IMPLEMENTED`.
 *
 * @type {{
 *   SignalingClient: typeof SignalingClient,
 *   Peer: typeof Peer,
 *   WebRtcError: typeof WebRtcError,
 *   SignalingError: typeof SignalingError,
 *   IceError: typeof IceError,
 *   SdpError: typeof SdpError,
 *   TurnError: typeof TurnError,
 *   E2eeError: typeof E2eeError,
 *   join: (url: string, opts: object) => Promise<never>,
 * }}
 */
export const webrtc = {
    SignalingClient,
    Peer,
    parseSdp,
    validateSdp,
    parseCandidate,
    stringifyCandidate,
    filterCandidates,
    isPrivateIp,
    isLoopbackIp,
    isLinkLocalIp,
    isMdnsHostname,
    WebRtcError,
    SignalingError,
    IceError,
    SdpError,
    TurnError,
    E2eeError,

    /**
     * Join a room. Not yet implemented - only the low-level `SignalingClient`
     * is wired in this release. Use `new SignalingClient(url)` directly until
     * the high-level `Room` API lands.
     *
     * @returns {Promise<never>}
     */
    async join() {
        throw new WebRtcError(
            'webrtc.join() is not implemented yet - use SignalingClient directly',
            { code: 'ZQ_WEBRTC_NOT_IMPLEMENTED' }
        );
    },
};
