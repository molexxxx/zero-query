/**
 * types/webrtc.d.ts - WebRTC client type surface
 *
 * Mirrors the full target shape from `.myshit/webrtc-client-roadmap.md` §4
 * so subsequent passes only ever ADD members. The implementation only
 * wires `SignalingClient` and the error family in this release - higher
 * level helpers are declared here but throw at runtime until they land.
 */

import type { Signal } from './reactive';
import { ZQueryError } from './errors';


// ---------------------------------------------------------------------------
// Error family
// ---------------------------------------------------------------------------

/** Options accepted by every WebRTC error constructor. */
export interface WebRtcErrorOptions {
    /** Stable, programmatic error code. */
    code?: string;
    /** Extra structured context (peer id, room id, etc.). */
    context?: Record<string, any>;
    /** Original error, if any. */
    cause?: Error;
}

/** Base WebRTC error - all other classes derive from this. */
export class WebRtcError extends ZQueryError {
    constructor(message: string, options?: WebRtcErrorOptions);
}

/** Signaling-channel (WebSocket / protocol) error. */
export class SignalingError extends WebRtcError {
    constructor(message: string, options?: WebRtcErrorOptions);
}

/** ICE candidate / connectivity error. */
export class IceError extends WebRtcError {
    constructor(message: string, options?: WebRtcErrorOptions);
}

/** SDP parse / validate error. */
export class SdpError extends WebRtcError {
    constructor(message: string, options?: WebRtcErrorOptions);
}

/** TURN credential fetch / refresh error. */
export class TurnError extends WebRtcError {
    constructor(message: string, options?: WebRtcErrorOptions);
}

/** End-to-end encryption error. */
export class E2eeError extends WebRtcError {
    constructor(message: string, options?: WebRtcErrorOptions);
}


// ---------------------------------------------------------------------------
// SignalingClient
// ---------------------------------------------------------------------------

/** Reconnect tuning passed to `new SignalingClient(url, { reconnect })`. */
export interface SignalingReconnectOptions {
    /** Base backoff between attempts, in milliseconds. Default `250`. */
    baseMs?: number;
    /** Hard cap on per-attempt backoff. Default `8000`. */
    capMs?: number;
    /** Max reconnect attempts before giving up. Default `10`. */
    maxRetries?: number;
}

/** All options accepted by the `SignalingClient` constructor. */
export interface SignalingClientOptions {
    /** Reconnect tuning. Pass `false` to disable auto-reconnect entirely. */
    reconnect?: false | SignalingReconnectOptions;
    /** ICE coalesce window length, in milliseconds. Default `200`. */
    iceFlushMs?: number;
    /** Max ICE frames flushed per coalesce window. Default `10`. */
    iceBatch?: number;
    /** WebSocket constructor (defaults to the global, useful for tests / SSR). */
    WebSocket?: typeof WebSocket;
}

/** Low-level WebSocket signaling client (speaks `@zero-server/webrtc` wire). */
export class SignalingClient {
    /** Server URL passed to the constructor. */
    readonly url: string;
    /** Server-assigned peer id - populated when the first `hello` frame arrives. */
    readonly peerId: string | null;
    /** `true` while the underlying WebSocket is open. */
    readonly connected: boolean;
    /** `true` once `.close()` has been called - no further reconnects. */
    readonly closed: boolean;

    constructor(url: string, options?: SignalingClientOptions);

    /** Open the socket. Resolves on first `open`. */
    connect(): Promise<void>;

    /** Send a frame `{ type, ...payload }`. `ice` frames are auto-coalesced. */
    send(type: string, payload?: Record<string, any>): void;

    /** Register a listener for a server frame type or lifecycle event. */
    on(type: string, cb: (payload: any) => void): () => void;

    /** Remove a previously registered listener. */
    off(type: string, cb: (payload: any) => void): void;

    /** Gracefully close the socket (sends `bye`, cancels reconnects). */
    close(): void;
}


// ---------------------------------------------------------------------------
// Peer (RTCPeerConnection wrapper + perfect negotiation)
// ---------------------------------------------------------------------------

/** Options accepted by the `Peer` constructor. */
export interface PeerOptions {
    /** Perfect-negotiation polite flag (defaults to `false`). */
    polite?: boolean;
    /** STUN/TURN servers forwarded to the underlying `RTCPeerConnection`. */
    iceServers?: RTCIceServer[];
    /** RTCPeerConnection constructor override (tests / non-browser shims). */
    RTCPeerConnection?: typeof RTCPeerConnection;
    /** Hard cap on trickled ICE candidates per peer. Default `30`. */
    maxIceCandidates?: number;
    /** Extra `RTCConfiguration` fields merged into the PC config. */
    rtcConfig?: RTCConfiguration;
}

/** Lifecycle event names emitted by a `Peer`. */
export type PeerEvent =
    | 'track'
    | 'datachannel'
    | 'connectionstatechange'
    | 'close'
    | 'error';

/** Per-remote-peer wrapper around `RTCPeerConnection` with perfect negotiation. */
export class Peer {
    /** Remote peer id (matches `from`/`to` on the wire). */
    readonly id: string;
    /** Shared signaling client. */
    readonly signaling: SignalingClient;
    /** Perfect-negotiation polite flag (set at construction). */
    readonly polite: boolean;
    /** Underlying `RTCPeerConnection`. */
    readonly pc: RTCPeerConnection;
    /** `true` once `.close()` has been called. */
    readonly closed: boolean;

    constructor(peerId: string, signaling: SignalingClient, options?: PeerOptions);

    /** Add a local track. Returns the underlying `RTCRtpSender`. */
    addTrack(track: MediaStreamTrack, ...streams: MediaStream[]): RTCRtpSender;
    /** Remove a previously-added sender. */
    removeTrack(sender: RTCRtpSender): void;
    /** Create a data channel on this peer. */
    createDataChannel(label: string, init?: RTCDataChannelInit): RTCDataChannel;
    /** Force an ICE restart - negotiation kicks off via `negotiationneeded`. */
    restartIce(): void;

    /** Subscribe to a Peer-level event. */
    on(event: PeerEvent, cb: (payload: any) => void): () => void;
    /** Remove a previously registered listener. */
    off(event: PeerEvent, cb: (payload: any) => void): void;

    /** Close the underlying connection and detach signaling listeners. */
    close(): void;
}


// ---------------------------------------------------------------------------
// High-level surface (declared for forward compatibility - implementation
// lands in subsequent passes; most members throw at runtime today)
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// SDP + ICE helpers (read-only port of the server-side parsers)
// ---------------------------------------------------------------------------

/** Frozen list of valid SDP direction attributes. */
export const SDP_DIRECTIONS: ReadonlyArray<'sendrecv' | 'sendonly' | 'recvonly' | 'inactive'>;

/** Single `a=` line preserved verbatim. */
export interface SdpAttribute {
    key: string;
    value: string;
}

/** `a=fingerprint:<alg> <value>`. */
export interface SdpFingerprint {
    algorithm: string;
    value: string;
}

/** Single `a=rtpmap:<pt> <codec>/<rate>[/<channels>]` entry. */
export interface SdpRtpMap {
    payload: number;
    codec: string;
    clockRate: number;
    channels?: number;
}

/** Parsed SDP `m=` section with the WebRTC-relevant keys lifted to named fields. */
export interface SdpMedia {
    kind: string;
    port: number;
    proto: string;
    fmts: string[];
    mid?: string;
    iceUfrag?: string;
    icePwd?: string;
    fingerprint?: SdpFingerprint;
    setup?: string;
    direction?: 'sendrecv' | 'sendonly' | 'recvonly' | 'inactive';
    rtcpMux: boolean;
    candidates: string[];
    rtpmaps: SdpRtpMap[];
    attributes: SdpAttribute[];
}

/** Parsed top-level SDP document. */
export interface ParsedSdp {
    version: number;
    origin: {
        username: string;
        sessionId: string;
        sessionVersion: number;
        netType: string;
        addrType: string;
        address: string;
    } | null;
    sessionName: string;
    attributes: SdpAttribute[];
    media: SdpMedia[];
}

/** Options accepted by `parseSdp`. */
export interface ParseSdpOptions {
    /** Reject payloads larger than this many bytes. Default `65536`. */
    maxBytes?: number;
}

/** Parse an SDP document into a structured `ParsedSdp`. Throws `SdpError` on bad input. */
export function parseSdp(text: string, opts?: ParseSdpOptions): ParsedSdp;

/** Parse + enforce the constraints the server-side hub validates. Throws `SdpError`. */
export function validateSdp(text: string): ParsedSdp;


/** Recognized ICE candidate types (RFC 5245). */
export const CANDIDATE_TYPES: ReadonlyArray<'host' | 'srflx' | 'prflx' | 'relay'>;

/** Recognized TCP candidate types (RFC 6544 §4.5). */
export const TCP_TYPES: ReadonlyArray<'active' | 'passive' | 'so'>;

/** Parsed ICE candidate line. */
export interface IceCandidate {
    foundation: string;
    component: number;
    transport: string;
    priority: number;
    address: string;
    port: number;
    type: 'host' | 'srflx' | 'prflx' | 'relay';
    relatedAddress?: string;
    relatedPort?: number;
    tcpType?: string;
    extensions: Record<string, string>;
}

/** Parse a single `candidate:` line (with or without `a=` prefix). Throws `IceError`. */
export function parseCandidate(line: string): IceCandidate;

/** Serialize a parsed candidate back to its canonical `candidate:...` line. */
export function stringifyCandidate(c: IceCandidate): string;

/** Address classifiers. */
export function isPrivateIp(addr: string): boolean;
export function isLoopbackIp(addr: string): boolean;
export function isLinkLocalIp(addr: string): boolean;
export function isMdnsHostname(host: string): boolean;

/** Policy accepted by `filterCandidates`. */
export interface CandidateFilterPolicy {
    blockPrivate?: boolean;
    blockLoopback?: boolean;
    blockLinkLocal?: boolean;
    blockMdns?: boolean;
    blockTcp?: boolean;
    allowedTypes?: ReadonlyArray<'host' | 'srflx' | 'prflx' | 'relay'>;
    maxCandidates?: number;
    predicate?: (c: IceCandidate) => boolean;
}

/** Filter a list of candidate lines / parsed objects against a policy. */
export function filterCandidates<T extends string | IceCandidate>(
    candidates: T[],
    policy?: CandidateFilterPolicy,
): T[];

/** Options accepted by `webrtc.join()` once it lands. */
export interface JoinOptions {
    room: string;
    token?: string;
    iceServers?: RTCIceServer[];
    media?: boolean | MediaStreamConstraints;
    e2ee?: { passphrase: string } | { key: CryptoKey };
    polite?: 'auto' | boolean;
    signalingTimeoutMs?: number;
    reconnect?: false | SignalingReconnectOptions;
}

/** Live view of a remote peer in a `Room`. */
export interface PeerInfo {
    id: string;
    pc: RTCPeerConnection;
    stream: MediaStream;
    audio: boolean;
    video: boolean;
    connection: 'new' | 'checking' | 'connected' | 'disconnected' | 'failed' | 'closed';
}

/** High-level room handle returned by `webrtc.join()` / `useRoom()`. */
export class Room {
    readonly id: string;
    readonly self: string;
    readonly closed: boolean;
    readonly peers: Signal<Map<string, PeerInfo>>;
    readonly localTracks: Signal<MediaStreamTrack[]>;
    constructor(opts: { id: string; self: string; signaling: SignalingClient; peerOptions?: PeerOptions });
    publish(stream: MediaStream): Promise<void>;
    unpublish(stream: MediaStream): Promise<void>;
    dataChannel(label: string, opts?: RTCDataChannelInit): RoomDataChannel;
    leave(): Promise<void>;
    on(event: 'peer-joined' | 'peer-left' | 'mute' | 'unmute' | 'error', cb: (...args: any[]) => void): () => void;
    off(event: string, cb: (...args: any[]) => void): void;
}

/** Join a room over the given signaling URL. */
export function join(url: string, opts: JoinOptions): Promise<Room>;

/** Resolve a `Room` from either a URL (calls `join`) or an existing `Room`. */
export function useRoom(urlOrRoom: string | Room, opts?: JoinOptions): Promise<Room>;

/** Reactive handle that tracks a remote peer by id. */
export function usePeer(room: Room, peerId: string): ReactiveHandle<PeerInfo | null>;

/** Reactive handle exposing the live track list for a peer. */
export function useTracks(peer: PeerInfo): ReactiveHandle<MediaStreamTrack[]> & { refresh(): void };

/** Reactive multiplexed data channel keyed by `label`. */
export function useDataChannel(room: Room, label: string, opts?: { history?: number }): {
    messages: ReactiveHandle<DataChannelMessage[]>;
    send(data: any): void;
    close(): void;
    dispose(): void;
};

/** Reactive connection-quality bucket from periodic `getStats()`. */
export function useConnectionQuality(peer: PeerInfo, opts?: { intervalMs?: number; getStats?: (pc: RTCPeerConnection) => Promise<any> }): ReactiveHandle<'good' | 'fair' | 'poor'>;

/** Multiplexed data channel returned by `Room.dataChannel(label)`. */
export interface RoomDataChannel {
    readonly label: string;
    readonly closed: boolean;
    send(data: any): void;
    on(event: 'message', cb: (data: any, fromPeerId: string) => void): () => void;
    on(event: 'open',    cb: (peerId: string) => void): () => void;
    close(): void;
}

/** Disposable reactive handle returned by composables. */
export interface ReactiveHandle<T> {
    readonly value: T;
    peek(): T;
    subscribe(cb: (value: T) => void): () => void;
    dispose(): void;
}

/** Buffered message yielded by `useDataChannel`. */
export interface DataChannelMessage {
    data: any;
    from: string;
    at: number;
}

/** TURN credential bundle returned by `webrtc.fetchTurnCredentials()`. */
export interface TurnCredentials {
    username: string;
    credential: string;
    urls: string[];
    ttl: number;
}

/** Options accepted by `fetchTurnCredentials()` (extends `RequestInit`). */
export interface FetchTurnOptions extends RequestInit {
    /** Optional `fetch` implementation override (defaults to global `fetch`). */
    fetch?: typeof fetch;
}

/** Fetch a TURN credential bundle from the app's HTTP endpoint. */
export function fetchTurnCredentials(url: string, opts?: FetchTurnOptions): Promise<TurnCredentials>;

/** Merge TURN credentials with an optional base `iceServers` list, deduping URLs. */
export function mergeIceServers(base?: RTCIceServer[], turn?: { username: string; credential: string; urls: string[] }): RTCIceServer[];

/** Options accepted by `createTurnRefresher()`. */
export interface TurnRefresherOptions {
    /** TURN credential endpoint. */
    url: string;
    /** Optional `fetch` override. */
    fetch?: typeof fetch;
    /** Refresh `leadMs` milliseconds before the credential TTL expires. Default `30000`. */
    leadMs?: number;
    /** Floor on the scheduled refresh interval in ms. Default `5000`. */
    minIntervalMs?: number;
    /** Called after each successful refresh. */
    onRefresh?: (creds: TurnCredentials) => void;
    /** Called when a refresh fails (next refresh is auto-retried). */
    onError?: (err: Error) => void;
    /** Extra `RequestInit` forwarded to `fetch`. */
    requestInit?: RequestInit;
}

/** Handle returned by `createTurnRefresher()`. */
export interface TurnRefresher {
    /** Last successfully fetched credentials, or `null` until the first refresh. */
    readonly value: TurnCredentials | null;
    peek(): TurnCredentials | null;
    start(): Promise<TurnCredentials | null>;
    refresh(): Promise<TurnCredentials | null>;
    stop(): void;
}

/** Schedule automatic TURN-credential refresh ahead of expiry. */
export function createTurnRefresher(opts: TurnRefresherOptions): TurnRefresher;

/** Opaque adapter interface for `loadSfuAdapter()`. */
export interface SfuAdapter {
    name: 'mediasoup' | 'livekit';
    join(opts: JoinOptions): Promise<Room>;
}

/** The `$.webrtc` namespace. */
export interface WebRtcNamespace {
    SignalingClient: typeof SignalingClient;
    Peer:            typeof Peer;
    parseSdp:        typeof parseSdp;
    validateSdp:     typeof validateSdp;
    parseCandidate:  typeof parseCandidate;
    stringifyCandidate: typeof stringifyCandidate;
    filterCandidates: typeof filterCandidates;
    isPrivateIp:     typeof isPrivateIp;
    isLoopbackIp:    typeof isLoopbackIp;
    isLinkLocalIp:   typeof isLinkLocalIp;
    isMdnsHostname:  typeof isMdnsHostname;
    WebRtcError:     typeof WebRtcError;
    SignalingError:  typeof SignalingError;
    IceError:        typeof IceError;
    SdpError:        typeof SdpError;
    TurnError:       typeof TurnError;
    E2eeError:       typeof E2eeError;

    /** Join a room over the given signaling URL. */
    join(url: string, opts: JoinOptions): Promise<Room>;
    /** Fetch TURN credentials from the app's HTTP endpoint. */
    fetchTurnCredentials: typeof fetchTurnCredentials;
    /** Merge TURN credentials with a base `iceServers[]`. */
    mergeIceServers: typeof mergeIceServers;
    /** Schedule automatic TURN-credential refresh ahead of expiry. */
    createTurnRefresher: typeof createTurnRefresher;
    /** UX-only decode of a `signJoinToken(...)` payload (server validates). */
    decodeJoinToken?(token: string): { user: { id: string }; room: string; exp: number };
    /** Load an optional SFU adapter (peer-dep). */
    loadSfuAdapter?(name: 'mediasoup' | 'livekit'): Promise<SfuAdapter>;
    /** Resolve a `Room` from either a URL (calls `join`) or an existing `Room`. */
    useRoom(urlOrRoom: string | Room, opts?: JoinOptions): Promise<Room>;
    /** Reactive handle that tracks a remote peer by id. */
    usePeer(room: Room, peerId: string): ReactiveHandle<PeerInfo | null>;
    /** Reactive handle exposing the live track list for a peer. */
    useTracks(peer: PeerInfo): ReactiveHandle<MediaStreamTrack[]> & { refresh(): void };
    /** Reactive multiplexed data channel keyed by `label`. */
    useDataChannel(room: Room, label: string, opts?: { history?: number }): {
        messages: ReactiveHandle<DataChannelMessage[]>;
        send(data: any): void;
        close(): void;
        dispose(): void;
    };
    /** Reactive connection-quality bucket from periodic `getStats()`. */
    useConnectionQuality(peer: PeerInfo, opts?: { intervalMs?: number; getStats?: (pc: RTCPeerConnection) => Promise<any> }): ReactiveHandle<'good' | 'fair' | 'poor'>;
}

/** Live binding for the `webrtc` named export. */
export const webrtc: WebRtcNamespace;
