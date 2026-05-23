/**
 * src/webrtc/index.js - WebRTC public barrel
 *
 * Re-exports the WebRTC error family, low-level building blocks
 * (`SignalingClient`, `Peer`, SDP/ICE helpers), and the high-level
 * `Room` + reactive composables on the `webrtc` namespace.
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
import { Room, join } from './room.js';
import {
    useRoom, usePeer, useTracks, useDataChannel, useConnectionQuality,
} from './reactive.js';
import {
    fetchTurnCredentials, mergeIceServers, createTurnRefresher,
} from './turn.js';
import {
    deriveSFrameKey, generateSFrameKey, SFrameContext,
    encryptFrame, decryptFrame, attachE2ee,
} from './e2ee.js';
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
export { Room, join } from './room.js';
export {
    useRoom, usePeer, useTracks, useDataChannel, useConnectionQuality,
} from './reactive.js';
export {
    fetchTurnCredentials, mergeIceServers, createTurnRefresher,
} from './turn.js';
export {
    deriveSFrameKey, generateSFrameKey, SFrameContext,
    encryptFrame, decryptFrame, attachE2ee,
} from './e2ee.js';
export {
    WebRtcError, SignalingError, IceError, SdpError, TurnError, E2eeError,
} from './errors.js';


/**
 * High-level WebRTC namespace exposed as `$.webrtc`. Bundles every public
 * member from this module so consumers can reach the full surface through
 * a single import.
 */
export const webrtc = {
    SignalingClient,
    Peer,
    Room,
    join,

    // Composables
    useRoom,
    usePeer,
    useTracks,
    useDataChannel,
    useConnectionQuality,

    // TURN client
    fetchTurnCredentials,
    mergeIceServers,
    createTurnRefresher,

    // E2EE
    deriveSFrameKey,
    generateSFrameKey,
    SFrameContext,
    encryptFrame,
    decryptFrame,
    attachE2ee,

    // SDP / ICE helpers
    parseSdp,
    validateSdp,
    parseCandidate,
    stringifyCandidate,
    filterCandidates,
    isPrivateIp,
    isLoopbackIp,
    isLinkLocalIp,
    isMdnsHostname,

    // Errors
    WebRtcError,
    SignalingError,
    IceError,
    SdpError,
    TurnError,
    E2eeError,
};
