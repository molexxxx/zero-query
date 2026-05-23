/**
 * zQuery (zeroQuery) - TypeScript Declarations
 *
 * Lightweight modern frontend library - jQuery-like selectors, reactive
 * components, SPA router, state management, HTTP client & utilities.
 *
 * @version 1.1.0
 * @license MIT
 * @see https://z-query.com/docs
 */

// ---------------------------------------------------------------------------
// Re-export every public type from the modular type files
// ---------------------------------------------------------------------------

export { ZQueryCollection } from './types/collection';

export {
  ReactiveProxy,
  reactive,
  Signal,
  signal,
  computed,
  effect,
  batch,
  untracked,
} from './types/reactive';

export {
  ComponentDefinition,
  ComponentInstance,
  component,
  mount,
  mountAll,
  getInstance,
  destroy,
  getRegistry,
  prefetch,
  StyleHandle,
  StyleOptions,
  style,
} from './types/component';

export {
  RouteDefinition,
  NavigationContext,
  RouterConfig,
  RouterInstance,
  RouteMatch,
  createRouter,
  getRouter,
  matchRoute,
} from './types/router';

export {
  StoreConfig,
  StoreHistoryEntry,
  StoreInstance,
  createStore,
  getStore,
} from './types/store';

export {
  HttpResponse,
  HttpRequestOptions,
  HttpConfigureOptions,
  HttpRequestInterceptor,
  HttpResponseInterceptor,
  HttpClient,
  http,
} from './types/http';

export {
  DebouncedFunction,
  debounce,
  throttle,
  pipe,
  once,
  sleep,
  escapeHtml,
  stripHtml,
  html,
  TrustedHTML,
  trust,
  uuid,
  camelCase,
  kebabCase,
  deepClone,
  deepMerge,
  isEqual,
  param,
  parseQuery,
  StorageWrapper,
  storage,
  session,
  EventBus,
  bus,
  range,
  unique,
  chunk,
  groupBy,
  pick,
  omit,
  getPath,
  setPath,
  isEmpty,
  capitalize,
  truncate,
  clamp,
  MemoizedFunction,
  memoize,
  RetryOptions,
  retry,
  timeout,
} from './types/utils';

export {
  ErrorCode,
  ErrorCodeValue,
  ZQueryError,
  ZQueryErrorHandler,
  FormattedError,
  onError,
  reportError,
  guardCallback,
  guardAsync,
  validate,
  formatError,
} from './types/errors';

export {
  morph,
  morphElement,
  safeEval,
  EventModifier,
} from './types/misc';

export {
  SSRApp,
  createSSRApp,
  renderToString,
} from './types/ssr';

export {
  WebRtcError,
  SignalingError,
  IceError,
  SdpError,
  TurnError,
  E2eeError,
  SfuError,
  WebRtcErrorOptions,
  SignalingClient,
  SignalingClientOptions,
  SignalingReconnectOptions,
  Peer,
  PeerOptions,
  PeerEvent,
  JoinOptions,
  PeerInfo,
  Room,
  RoomDataChannel,
  ReactiveHandle,
  DataChannelMessage,
  join,
  useRoom,
  usePeer,
  useTracks,
  useDataChannel,
  useConnectionQuality,
  fetchTurnCredentials,
  mergeIceServers,
  createTurnRefresher,
  deriveSFrameKey,
  generateSFrameKey,
  SFrameContext,
  encryptFrame,
  decryptFrame,
  attachE2ee,
  loadSfuAdapter,
  decodeJoinToken,
  isJoinTokenExpired,
  DecodedJoinToken,
  samplePeerStats,
  createStatsSampler,
  classifyStats,
  PeerStatsSample,
  FetchTurnOptions,
  TurnRefresher,
  TurnRefresherOptions,
  TurnCredentials,
  SfuAdapter,
  WebRtcNamespace,
  webrtc,
  parseSdp,
  validateSdp,
  SDP_DIRECTIONS,
  ParsedSdp,
  SdpMedia,
  SdpAttribute,
  SdpFingerprint,
  SdpRtpMap,
  ParseSdpOptions,
  parseCandidate,
  stringifyCandidate,
  filterCandidates,
  isPrivateIp,
  isLoopbackIp,
  isLinkLocalIp,
  isMdnsHostname,
  IceCandidate,
  CandidateFilterPolicy,
  CANDIDATE_TYPES,
  TCP_TYPES,
} from './types/webrtc';

// ---------------------------------------------------------------------------
// $ - Main function & namespace
// ---------------------------------------------------------------------------

import type { ZQueryCollection } from './types/collection';
import type { reactive, Signal, signal, computed, effect, batch, untracked } from './types/reactive';
import type { component, mount, mountAll, getInstance, destroy, getRegistry, prefetch, style } from './types/component';
import type { createRouter, getRouter, matchRoute } from './types/router';
import type { createStore, getStore } from './types/store';
import type { HttpClient } from './types/http';
import type {
  debounce, throttle, pipe, once, sleep,
  escapeHtml, stripHtml, html, trust, TrustedHTML, uuid, camelCase, kebabCase,
  deepClone, deepMerge, isEqual, param, parseQuery,
  StorageWrapper, EventBus,
  range, unique, chunk, groupBy,
  pick, omit, getPath, setPath, isEmpty,
  capitalize, truncate, clamp,
  MemoizedFunction, memoize, RetryOptions, retry, timeout,
} from './types/utils';
import type { onError, ZQueryError, ErrorCode, guardCallback, guardAsync, validate, formatError } from './types/errors';
import type { morph, morphElement, safeEval } from './types/misc';
import type {
  WebRtcNamespace,
  SignalingClient,
  Peer,
  Room,
  join as webrtcJoin,
  useRoom,
  usePeer,
  useTracks,
  useDataChannel,
  useConnectionQuality,
  fetchTurnCredentials,
  mergeIceServers,
  createTurnRefresher,
  deriveSFrameKey,
  generateSFrameKey,
  SFrameContext,
  encryptFrame,
  decryptFrame,
  attachE2ee,
  loadSfuAdapter,
  decodeJoinToken,
  isJoinTokenExpired,
  samplePeerStats,
  createStatsSampler,
  classifyStats,
  WebRtcError,
  SignalingError,
  IceError,
  SdpError,
  TurnError,
  E2eeError,
  SfuError,
  parseSdp,
  validateSdp,
  parseCandidate,
  stringifyCandidate,
  filterCandidates,
  isPrivateIp,
  isLoopbackIp,
  isLinkLocalIp,
  isMdnsHostname,
} from './types/webrtc';

/**
 * Main selector / DOM-ready function - always returns a `ZQueryCollection` (like jQuery).
 *
 * - `$('selector')` → ZQueryCollection via `querySelectorAll`
 * - `$('<div>…</div>')` → ZQueryCollection from created elements
 * - `$(element)` → ZQueryCollection wrapping the element
 * - `$(fn)` → DOMContentLoaded shorthand
 */
interface ZQueryStatic {
  (selector: string, context?: string | Element): ZQueryCollection;
  (element: Element | Window): ZQueryCollection;
  (nodeList: NodeList | HTMLCollection | Element[]): ZQueryCollection;
  (fn: () => void): void;

  // -- Collection selector -------------------------------------------------
  /**
   * Collection selector - returns a `ZQueryCollection`.
   *
   * - `$.all('.card')` → all matching elements
   * - `$.all('<div>…</div>')` → create elements as collection
   * - `$.all(element)` → wrap single element
   * - `$.all(nodeList)` → wrap NodeList
   */
  all(selector: string, context?: string | Element): ZQueryCollection;
  all(element: Element | Window): ZQueryCollection;
  all(nodeList: NodeList | HTMLCollection | Element[]): ZQueryCollection;

  // -- Quick-ref shortcuts -------------------------------------------------
  /** `document.getElementById(id)` */
  id(id: string): Element | null;
  /** `document.querySelector('.name')` */
  class(name: string): Element | null;
  /** `document.getElementsByClassName(name)` as `ZQueryCollection`. */
  classes(name: string): ZQueryCollection;
  /** `document.getElementsByTagName(name)` as `ZQueryCollection`. */
  tag(name: string): ZQueryCollection;
  /** `document.getElementsByName(name)` as `ZQueryCollection`. */
  name(name: string): ZQueryCollection;
  /** Children of `#parentId` as `ZQueryCollection`. */
  children(parentId: string): ZQueryCollection;
  /** `document.querySelector(selector)` - raw Element or null. */
  qs(selector: string, context?: Element | Document): Element | null;
  /** `document.querySelectorAll(selector)` - as a real `Array<Element>`. */
  qsa(selector: string, context?: Element | Document): Element[];

  // -- Static helpers ------------------------------------------------------
  /**
   * Create a DOM element.
   * Special `attrs` keys: `class`, `style` (object), `on*` (handler), `data` (object).
   */
  create(
    tag: string,
    attrs?: Record<string, any>,
    ...children: Array<string | Node>
  ): ZQueryCollection;

  /** Register a DOMContentLoaded callback (fires immediately if already loaded). */
  ready(fn: () => void): void;

  /** Global event delegation on `document`. */
  on(event: string, selector: string, handler: (this: Element, e: Event) => void): void;

  /** Direct event listener on a specific target (e.g. `window`). */
  on(event: string, target: EventTarget, handler: (e: Event) => void): void;

  /** Direct event listener on `document` (for keydown, resize, etc.). */
  on(event: string, handler: (e: Event) => void): void;

  /** Remove a direct global event listener previously attached with `$.on(event, handler)`. */
  off(event: string, handler: (e: Event) => void): void;

  /** Alias for `ZQueryCollection.prototype` - extend to add custom collection methods. */
  fn: typeof ZQueryCollection.prototype;

  // -- Reactive ------------------------------------------------------------
  reactive: typeof reactive;
  Signal: typeof Signal;
  signal: typeof signal;
  computed: typeof computed;
  effect: typeof effect;
  batch: typeof batch;
  untracked: typeof untracked;

  // -- Components ----------------------------------------------------------
  component: typeof component;
  mount: typeof mount;
  mountAll: typeof mountAll;
  getInstance: typeof getInstance;
  destroy: typeof destroy;
  /** Returns all registered component definitions. */
  components: typeof getRegistry;
  /** Pre-load external templates and styles for a component. */
  prefetch: typeof prefetch;
  style: typeof style;
  morph: typeof morph;
  /** Morph a single element in place - preserves identity when tag name matches. */
  morphElement: typeof morphElement;
  safeEval: typeof safeEval;

  // -- Router --------------------------------------------------------------
  router: typeof createRouter;
  getRouter: typeof getRouter;
  matchRoute: typeof matchRoute;

  // -- Store ---------------------------------------------------------------
  store: typeof createStore;
  getStore: typeof getStore;

  // -- HTTP ----------------------------------------------------------------
  http: HttpClient;
  get: HttpClient['get'];
  post: HttpClient['post'];
  put: HttpClient['put'];
  patch: HttpClient['patch'];
  delete: HttpClient['delete'];
  head: HttpClient['head'];

  // -- Error Handling ------------------------------------------------------
  /** Register a global error handler (or pass `null` to remove). */
  onError: typeof onError;
  /** Structured error class. */
  ZQueryError: typeof ZQueryError;
  /** Frozen map of all error code constants. */
  ErrorCode: typeof ErrorCode;
  /** Wrap a callback so thrown errors are caught and reported via the global handler. */
  guardCallback: typeof guardCallback;
  /** Wrap an async function so thrown errors are caught and reported via the global handler. */
  guardAsync: typeof guardAsync;
  /** Validate a required value is defined and of the expected type. */
  validate: typeof validate;
  /** Format a ZQueryError into a structured plain object. */
  formatError: typeof formatError;

  // -- Utilities -----------------------------------------------------------
  debounce: typeof debounce;
  throttle: typeof throttle;
  pipe: typeof pipe;
  once: typeof once;
  sleep: typeof sleep;

  escapeHtml: typeof escapeHtml;
  stripHtml: typeof stripHtml;
  html: typeof html;
  trust: typeof trust;
  TrustedHTML: typeof TrustedHTML;
  uuid: typeof uuid;
  camelCase: typeof camelCase;
  kebabCase: typeof kebabCase;

  deepClone: typeof deepClone;
  deepMerge: typeof deepMerge;
  isEqual: typeof isEqual;

  param: typeof param;
  parseQuery: typeof parseQuery;

  storage: StorageWrapper;
  session: StorageWrapper;
  EventBus: typeof EventBus;
  bus: EventBus;

  range: typeof range;
  unique: typeof unique;
  chunk: typeof chunk;
  groupBy: typeof groupBy;
  pick: typeof pick;
  omit: typeof omit;
  getPath: typeof getPath;
  setPath: typeof setPath;
  isEmpty: typeof isEmpty;
  capitalize: typeof capitalize;
  truncate: typeof truncate;
  clamp: typeof clamp;
  memoize: typeof memoize;
  retry: typeof retry;
  timeout: typeof timeout;

  // -- WebRTC --------------------------------------------------------------
  /** WebRTC namespace - low-level `SignalingClient`, error family, and (future) high-level helpers. */
  webrtc: WebRtcNamespace;
  /** Low-level WebSocket signaling client (speaks `@zero-server/webrtc` wire). */
  SignalingClient: typeof SignalingClient;
  /** Per-remote-peer `RTCPeerConnection` wrapper with perfect negotiation. */
  Peer: typeof Peer;
  /** High-level multi-peer room handle. */
  Room: typeof Room;
  /** Join a room over the given signaling URL. */
  webrtcJoin: typeof webrtcJoin;
  /** Resolve a `Room` from a URL or pass-through an existing one. */
  useRoom: typeof useRoom;
  /** Reactive handle that tracks a remote peer by id. */
  usePeer: typeof usePeer;
  /** Reactive handle exposing the live track list for a peer. */
  useTracks: typeof useTracks;
  /** Reactive multiplexed data channel keyed by `label`. */
  useDataChannel: typeof useDataChannel;
  /** Reactive connection-quality bucket from periodic `getStats()`. */
  useConnectionQuality: typeof useConnectionQuality;
  /** Fetch TURN credentials from the app's HTTP endpoint. */
  fetchTurnCredentials: typeof fetchTurnCredentials;
  /** Merge TURN credentials with a base `iceServers[]`. */
  mergeIceServers: typeof mergeIceServers;
  /** Schedule automatic TURN-credential refresh ahead of expiry. */
  createTurnRefresher: typeof createTurnRefresher;
  /** Derive an AES-GCM-128 SFrame key from a shared passphrase + salt. */
  deriveSFrameKey: typeof deriveSFrameKey;
  /** Generate a random AES-GCM-128 SFrame key. */
  generateSFrameKey: typeof generateSFrameKey;
  /** SFrame epoch / key holder. */
  SFrameContext: typeof SFrameContext;
  /** Encrypt a single frame with the current SFrame epoch's key. */
  encryptFrame: typeof encryptFrame;
  /** Decrypt a frame previously produced by `encryptFrame()`. */
  decryptFrame: typeof decryptFrame;
  /** Install SFrame encrypt/decrypt transforms on a peer connection. */
  attachE2ee: typeof attachE2ee;
  /** Load an optional SFU adapter (peer-dep). */
  loadSfuAdapter: typeof loadSfuAdapter;
  /** UX-only decode of a server-issued join token. */
  decodeJoinToken: typeof decodeJoinToken;
  /** Returns `true` if a decoded token's `exp` is in the past. */
  isJoinTokenExpired: typeof isJoinTokenExpired;
  /** One-shot reduced `getStats()` snapshot. */
  samplePeerStats: typeof samplePeerStats;
  /** Periodic `getStats()` sampler. */
  createStatsSampler: typeof createStatsSampler;
  /** Bucket a reduced sample into a connection-quality label. */
  classifyStats: typeof classifyStats;
  /** Parse an SDP document into a structured `ParsedSdp`. */
  parseSdp: typeof parseSdp;
  /** Parse + enforce server-side SDP constraints. */
  validateSdp: typeof validateSdp;
  /** Parse a single `candidate:` line. */
  parseCandidate: typeof parseCandidate;
  /** Serialize a parsed candidate back to canonical line form. */
  stringifyCandidate: typeof stringifyCandidate;
  /** Filter candidates against a privacy / policy filter. */
  filterCandidates: typeof filterCandidates;
  /** True for RFC 1918 / 6598 / IPv6 ULA addresses. */
  isPrivateIp: typeof isPrivateIp;
  /** True for `127.0.0.0/8` and `::1`. */
  isLoopbackIp: typeof isLoopbackIp;
  /** True for `169.254/16` and `fe80::/10`. */
  isLinkLocalIp: typeof isLinkLocalIp;
  /** True for `.local` mDNS hostnames. */
  isMdnsHostname: typeof isMdnsHostname;
  /** Base WebRTC error. */
  WebRtcError: typeof WebRtcError;
  /** Signaling-channel error. */
  SignalingError: typeof SignalingError;
  /** ICE candidate / connectivity error. */
  IceError: typeof IceError;
  /** SDP parse / validate error. */
  SdpError: typeof SdpError;
  /** TURN credential error. */
  TurnError: typeof TurnError;
  /** End-to-end encryption error. */
  E2eeError: typeof E2eeError;
  SfuError: typeof SfuError;

  // -- Meta ----------------------------------------------------------------
  /** Library version string. */
  version: string;
  /** Minified library size string (e.g. `"~85.5 KB"`), injected at build time. */
  libSize: string;
  /** Unit test results captured at build time. */
  unitTests: {
    passed: number;
    failed: number;
    total: number;
    suites: number;
    duration: number;
    ok: boolean;
  };
  /** Populated at build time by the CLI bundler. */
  meta: Record<string, any>;
  /** Remove `$` from `window` and return the library object. */
  noConflict(): ZQueryStatic;
}

/** The main `$` / `zQuery` function + namespace. */
export const $: ZQueryStatic;
export { $ as zQuery };

/** Collection selector function - same as `$.all()`. */
export function queryAll(selector: string, context?: string | Element): ZQueryCollection;
export function queryAll(element: Element): ZQueryCollection;
export function queryAll(nodeList: NodeList | HTMLCollection | Element[]): ZQueryCollection;
