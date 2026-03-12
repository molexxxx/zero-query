/**
 * zQuery (zeroQuery) — TypeScript Declarations
 *
 * Lightweight modern frontend library — jQuery-like selectors, reactive
 * components, SPA router, state management, HTTP client & utilities.
 *
 * @version 0.8.8
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
  createRouter,
  getRouter,
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
} from './types/utils';

export {
  ErrorCode,
  ErrorCodeValue,
  ZQueryError,
  ZQueryErrorHandler,
  onError,
  reportError,
  guardCallback,
  validate,
} from './types/errors';

export {
  morph,
  morphElement,
  safeEval,
  EventModifier,
} from './types/misc';

// ---------------------------------------------------------------------------
// $ — Main function & namespace
// ---------------------------------------------------------------------------

import type { ZQueryCollection } from './types/collection';
import type { reactive, Signal, signal, computed, effect } from './types/reactive';
import type { component, mount, mountAll, getInstance, destroy, getRegistry, prefetch, style } from './types/component';
import type { createRouter, getRouter } from './types/router';
import type { createStore, getStore } from './types/store';
import type { HttpClient } from './types/http';
import type {
  debounce, throttle, pipe, once, sleep,
  escapeHtml, html, trust, uuid, camelCase, kebabCase,
  deepClone, deepMerge, isEqual, param, parseQuery,
  StorageWrapper, EventBus,
} from './types/utils';
import type { onError, ZQueryError, ErrorCode } from './types/errors';
import type { morph, morphElement, safeEval } from './types/misc';

/**
 * Main selector / DOM-ready function — always returns a `ZQueryCollection` (like jQuery).
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
   * Collection selector — returns a `ZQueryCollection`.
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

  /** Alias for `ZQueryCollection.prototype` — extend to add custom collection methods. */
  fn: typeof ZQueryCollection.prototype;

  // -- Reactive ------------------------------------------------------------
  reactive: typeof reactive;
  Signal: typeof Signal;
  signal: typeof signal;
  computed: typeof computed;
  effect: typeof effect;

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
  /** Morph a single element in place — preserves identity when tag name matches. */
  morphElement: typeof morphElement;
  safeEval: typeof safeEval;

  // -- Router --------------------------------------------------------------
  router: typeof createRouter;
  getRouter: typeof getRouter;

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

  // -- Error Handling ------------------------------------------------------
  /** Register a global error handler (or pass `null` to remove). */
  onError: typeof onError;
  /** Structured error class. */
  ZQueryError: typeof ZQueryError;
  /** Frozen map of all error code constants. */
  ErrorCode: typeof ErrorCode;

  // -- Utilities -----------------------------------------------------------
  debounce: typeof debounce;
  throttle: typeof throttle;
  pipe: typeof pipe;
  once: typeof once;
  sleep: typeof sleep;

  escapeHtml: typeof escapeHtml;
  html: typeof html;
  trust: typeof trust;
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
  bus: EventBus;

  // -- Meta ----------------------------------------------------------------
  /** Library version string. */
  version: string;
  /** Minified library size string (e.g. `"~85.5 KB"`), injected at build time. */
  libSize: string;
  /** Populated at build time by the CLI bundler. */
  meta: Record<string, any>;
  /** Remove `$` from `window` and return the library object. */
  noConflict(): ZQueryStatic;
}

/** The main `$` / `zQuery` function + namespace. */
export const $: ZQueryStatic;
export { $ as zQuery };

/** Collection selector function — same as `$.all()`. */
export function queryAll(selector: string, context?: string | Element): ZQueryCollection;
export function queryAll(element: Element): ZQueryCollection;
export function queryAll(nodeList: NodeList | HTMLCollection | Element[]): ZQueryCollection;
