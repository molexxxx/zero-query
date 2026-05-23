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
// High-level surface (declared for forward compatibility - implementation
// lands in subsequent passes; most members throw at runtime today)
// ---------------------------------------------------------------------------

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
export interface Room {
    readonly id: string;
    readonly self: string;
    readonly peers: Signal<Map<string, PeerInfo>>;
    readonly localTracks: Signal<MediaStreamTrack[]>;
    publish(stream: MediaStream): Promise<void>;
    unpublish(stream: MediaStream): Promise<void>;
    dataChannel(label: string, opts?: RTCDataChannelInit): RTCDataChannel;
    leave(): Promise<void>;
    on(event: 'peer-joined' | 'peer-left' | 'mute' | 'unmute' | 'error', cb: (...args: any[]) => void): () => void;
}

/** TURN credential bundle returned by `webrtc.fetchTurnCredentials()`. */
export interface TurnCredentials {
    username: string;
    credential: string;
    urls: string[];
    ttl: number;
}

/** Opaque adapter interface for `loadSfuAdapter()`. */
export interface SfuAdapter {
    name: 'mediasoup' | 'livekit';
    join(opts: JoinOptions): Promise<Room>;
}

/** The `$.webrtc` namespace. */
export interface WebRtcNamespace {
    SignalingClient: typeof SignalingClient;
    WebRtcError:     typeof WebRtcError;
    SignalingError:  typeof SignalingError;
    IceError:        typeof IceError;
    SdpError:        typeof SdpError;
    TurnError:       typeof TurnError;
    E2eeError:       typeof E2eeError;

    /** Join a room. Currently throws `WebRtcError(ZQ_WEBRTC_NOT_IMPLEMENTED)`. */
    join(url: string, opts: JoinOptions): Promise<Room>;
    /** Fetch TURN credentials from the app's HTTP endpoint. */
    fetchTurnCredentials?(url: string, opts?: RequestInit): Promise<TurnCredentials>;
    /** UX-only decode of a `signJoinToken(...)` payload (server validates). */
    decodeJoinToken?(token: string): { user: { id: string }; room: string; exp: number };
    /** Load an optional SFU adapter (peer-dep). */
    loadSfuAdapter?(name: 'mediasoup' | 'livekit'): Promise<SfuAdapter>;
    /** Reactive composable: join on mount, leave on unmount. */
    useRoom?(name: string, opts?: Partial<JoinOptions>): Room;
    /** Reactive composable: track a remote peer by id. */
    usePeer?(room: Room | string, peerId: string): Signal<PeerInfo | null>;
    /** Reactive composable: live track list for a peer. */
    useTracks?(peer: PeerInfo): Signal<MediaStreamTrack[]>;
    /** Reactive composable: typed data channel handle. */
    useDataChannel?(room: Room, label: string, opts?: { history?: number }): {
        messages: Signal<any[]>;
        send(data: any): void;
        close(): void;
    };
    /** Reactive composable: connection-quality bucket from periodic `getStats()`. */
    useConnectionQuality?(peer: PeerInfo): Signal<'good' | 'fair' | 'poor'>;
}

/** Live binding for the `webrtc` named export. */
export const webrtc: WebRtcNamespace;
