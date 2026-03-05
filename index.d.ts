/**
 * zQuery (zeroQuery) — TypeScript Declarations
 *
 * Lightweight modern frontend library — jQuery-like selectors, reactive
 * components, SPA router, state management, HTTP client & utilities.
 *
 * @version 0.3.4
 * @license MIT
 * @see https://z-query.com/docs
 */

// ───────────────────────────────────────────────────────────────────────────
// ZQueryCollection
// ───────────────────────────────────────────────────────────────────────────

/**
 * Chainable wrapper around an array of DOM elements, similar to a jQuery object.
 * Returned by `$.all()` and many traversal / filtering methods.
 */
export class ZQueryCollection {
  /** Number of elements in the collection. */
  readonly length: number;

  /** Access element by numeric index. */
  readonly [index: number]: Element;

  constructor(elements: Element | Element[]);

  // ── Iteration ───────────────────────────────────────────────────────────
  /**
   * Iterate over each element. `this` inside the callback is the element.
   * @returns The collection (for chaining).
   */
  each(fn: (this: Element, index: number, element: Element) => void): this;

  /**
   * Map over elements and return a plain array.
   */
  map<T>(fn: (this: Element, index: number, element: Element) => T): T[];

  /** First raw element, or `null`. */
  first(): Element | null;

  /** Last raw element, or `null`. */
  last(): Element | null;

  /** New collection containing only the element at `index`. */
  eq(index: number): ZQueryCollection;

  /** Convert to a plain `Element[]`. */
  toArray(): Element[];

  /** Iterable protocol — works with `for...of` and spread. */
  [Symbol.iterator](): IterableIterator<Element>;

  // ── Traversal ───────────────────────────────────────────────────────────
  /** Descendants matching `selector`. */
  find(selector: string): ZQueryCollection;

  /** Unique parent elements. */
  parent(): ZQueryCollection;

  /** Nearest ancestor matching `selector`. */
  closest(selector: string): ZQueryCollection;

  /** Direct children, optionally filtered by `selector`. */
  children(selector?: string): ZQueryCollection;

  /** All sibling elements. */
  siblings(): ZQueryCollection;

  /** Next sibling of each element. */
  next(): ZQueryCollection;

  /** Previous sibling of each element. */
  prev(): ZQueryCollection;

  // ── Filtering ───────────────────────────────────────────────────────────
  /** Keep elements matching a CSS selector or predicate. */
  filter(selector: string): ZQueryCollection;
  filter(fn: (element: Element, index: number) => boolean): ZQueryCollection;

  /** Remove elements matching a CSS selector or predicate. */
  not(selector: string): ZQueryCollection;
  not(fn: (this: Element, index: number, element: Element) => boolean): ZQueryCollection;

  /** Keep elements that have a descendant matching `selector`. */
  has(selector: string): ZQueryCollection;

  // ── Classes ─────────────────────────────────────────────────────────────
  /** Add one or more classes (space-separated strings accepted). */
  addClass(...names: string[]): this;

  /** Remove one or more classes. */
  removeClass(...names: string[]): this;

  /** Toggle a class. Optional `force` boolean. */
  toggleClass(name: string, force?: boolean): this;

  /** Check whether the first element has the given class. */
  hasClass(name: string): boolean;

  // ── Attributes & Properties ─────────────────────────────────────────────
  /** Get attribute value of the first element. */
  attr(name: string): string | null;
  /** Set attribute on all elements. */
  attr(name: string, value: string): this;

  /** Remove attribute from all elements. */
  removeAttr(name: string): this;

  /** Get JS property of the first element. */
  prop(name: string): any;
  /** Set JS property on all elements. */
  prop(name: string, value: any): this;

  /** Get data attribute value (JSON auto-parsed). No key → full dataset. */
  data(): DOMStringMap;
  data(key: string): any;
  /** Set data attribute on all elements. Objects are JSON-stringified. */
  data(key: string, value: any): this;

  // ── CSS & Dimensions ────────────────────────────────────────────────────
  /** Get computed style property of the first element. */
  css(property: string): string;
  /** Set inline styles on all elements. */
  css(props: Partial<CSSStyleDeclaration>): this;

  /** First element's width (from `getBoundingClientRect`). */
  width(): number | undefined;

  /** First element's height. */
  height(): number | undefined;

  /** Position relative to the document. */
  offset(): { top: number; left: number; width: number; height: number } | null;

  /** Position relative to the offset parent. */
  position(): { top: number; left: number } | null;

  // ── Content ─────────────────────────────────────────────────────────────
  /** Get `innerHTML` of the first element. */
  html(): string;
  /** Set `innerHTML` on all elements. */
  html(content: string): this;

  /** Get `textContent` of the first element. */
  text(): string;
  /** Set `textContent` on all elements. */
  text(content: string): this;

  /** Get value of the first input/select/textarea. */
  val(): string;
  /** Set value on all inputs. */
  val(value: string): this;

  // ── DOM Manipulation ────────────────────────────────────────────────────
  /** Insert content at the end of each element. */
  append(content: string | Node | ZQueryCollection): this;

  /** Insert content at the beginning of each element. */
  prepend(content: string | Node): this;

  /** Insert content after each element. */
  after(content: string | Node): this;

  /** Insert content before each element. */
  before(content: string | Node): this;

  /** Wrap each element with the given HTML string or Node. */
  wrap(wrapper: string | Node): this;

  /** Remove all elements from the DOM. */
  remove(): this;

  /** Clear `innerHTML` of all elements. */
  empty(): this;

  /** Clone elements (default: deep clone). */
  clone(deep?: boolean): ZQueryCollection;

  /** Replace elements with new content. */
  replaceWith(content: string | Node): this;

  // ── Visibility ──────────────────────────────────────────────────────────
  /** Show elements. Optional display value (default: `''`). */
  show(display?: string): this;

  /** Set `display: none` on all elements. */
  hide(): this;

  /** Toggle visibility. */
  toggle(display?: string): this;

  // ── Events ──────────────────────────────────────────────────────────────
  /** Attach event handler. Space-separated events accepted. */
  on(events: string, handler: (event: Event) => void): this;
  /** Delegated event handler. */
  on(events: string, selector: string, handler: (this: Element, event: Event) => void): this;

  /** Remove event handler. */
  off(events: string, handler: (event: Event) => void): this;

  /** One-time event handler. */
  one(event: string, handler: (event: Event) => void): this;

  /**
   * Dispatch a `CustomEvent` with optional detail payload.
   * Bubbles by default.
   */
  trigger(event: string, detail?: any): this;

  /** Attach click handler, or trigger a click when called with no arguments. */
  click(fn?: (event: Event) => void): this;

  /** Attach submit handler, or trigger submit when called with no arguments. */
  submit(fn?: (event: Event) => void): this;

  /** Focus the first element. */
  focus(): this;

  /** Blur the first element. */
  blur(): this;

  // ── Animation ───────────────────────────────────────────────────────────
  /**
   * CSS transition animation.
   * @param props   CSS properties to animate to.
   * @param duration Duration in ms (default 300).
   * @param easing  CSS easing function (default `'ease'`).
   */
  animate(
    props: Partial<CSSStyleDeclaration>,
    duration?: number,
    easing?: string,
  ): Promise<ZQueryCollection>;

  /** Fade in (opacity 0→1). Default 300 ms. */
  fadeIn(duration?: number): Promise<ZQueryCollection>;

  /** Fade out (opacity 1→0) then hide. Default 300 ms. */
  fadeOut(duration?: number): Promise<ZQueryCollection>;

  /** Toggle height with a slide animation. Default 300 ms. */
  slideToggle(duration?: number): this;

  // ── Form Helpers ────────────────────────────────────────────────────────
  /** URL-encoded form data string. */
  serialize(): string;

  /** Form data as key/value object. Duplicate keys become arrays. */
  serializeObject(): Record<string, string | string[]>;
}


// ───────────────────────────────────────────────────────────────────────────
// Reactive
// ───────────────────────────────────────────────────────────────────────────

/** Marker properties added to every reactive proxy. */
interface ReactiveProxy<T extends object = object> {
  /** Always `true` — indicates this object is wrapped in a reactive Proxy. */
  readonly __isReactive: true;
  /** The original un-proxied object. */
  readonly __raw: T;
}

/**
 * Wrap an object in a deep Proxy that fires `onChange` on every set / delete.
 */
export function reactive<T extends object>(
  target: T,
  onChange: (key: string, value: any, oldValue: any) => void,
): T & ReactiveProxy<T>;

/** A lightweight reactive primitive (inspired by Solid / Preact signals). */
export class Signal<T = any> {
  constructor(value: T);

  /** Get/set the current value. The getter auto-tracks inside `effect()`. */
  value: T;

  /** Read the value without creating a subscription. */
  peek(): T;

  /**
   * Manually subscribe to changes.
   * @returns An unsubscribe function.
   */
  subscribe(fn: () => void): () => void;

  toString(): string;
}

/** Create a new `Signal`. */
export function signal<T>(initial: T): Signal<T>;

/**
 * Create a derived signal that recomputes when its dependencies change.
 * The returned signal is effectively read-only.
 */
export function computed<T>(fn: () => T): Signal<T>;

/**
 * Run a side-effect that auto-subscribes to signals read during execution.
 * @returns A dispose function that stops tracking.
 */
export function effect(fn: () => void): () => void;


// ───────────────────────────────────────────────────────────────────────────
// Component System
// ───────────────────────────────────────────────────────────────────────────

/** Item in a `pages` config — either a string id or an `{ id, label }` object. */
type PageItem = string | { id: string; label?: string };

/**
 * Declarative multi-page configuration for a component.
 *
 * Pages are **lazy-loaded**: only the active page is fetched on first render.
 * Remaining pages are prefetched in the background for instant navigation.
 */
interface PagesConfig {
  /** Directory containing the page HTML files (resolved relative to `base`). */
  dir?: string;
  /** Route parameter name to read (e.g. `'section'` for `/docs/:section`). */
  param?: string;
  /** Default page id when the param is absent. */
  default?: string;
  /** File extension appended to each page id (default `'.html'`). */
  ext?: string;
  /** List of page ids and/or `{ id, label }` objects. */
  items?: PageItem[];
}

/** The object passed to `$.component()` to define a component. */
interface ComponentDefinition {
  /**
   * Initial reactive state.
   * A function form is recommended so each instance gets its own copy.
   */
  state?: Record<string, any> | (() => Record<string, any>);

  /**
   * Returns an HTML string. Called on every state change.
   * `this` is the component instance.
   */
  render?(this: ComponentInstance): string;

  /** CSS string — scoped to the component root on first render. */
  styles?: string;

  /**
   * URL (or array / object map of URLs) to external HTML template file(s).
   * If `render()` is also defined, `render()` takes priority.
   */
  templateUrl?: string | string[] | Record<string, string>;

  /**
   * URL (or array of URLs) to external CSS file(s).
   * Fetched and auto-scoped on first mount; merged with `styles` if both present.
   */
  styleUrl?: string | string[];

  /** High-level multi-page configuration shorthand. */
  pages?: PagesConfig;

  /**
   * Override the base path for resolving relative `templateUrl`, `styleUrl`,
   * and `pages.dir` paths. Normally auto-detected from the calling file.
   */
  base?: string;

  /** Called before first render (during construction). */
  init?(this: ComponentInstance): void;

  /** Called once after first render and DOM insertion. */
  mounted?(this: ComponentInstance): void;

  /** Called after every subsequent re-render. */
  updated?(this: ComponentInstance): void;

  /** Called when the component is destroyed. Clean up subscriptions here. */
  destroyed?(this: ComponentInstance): void;

  /** Additional keys become instance methods (bound to the instance). */
  [method: string]: any;
}

/** The runtime instance of a mounted component. */
interface ComponentInstance {
  /** Reactive state proxy. Mutating triggers re-render. */
  state: Record<string, any> & ReactiveProxy;

  /** Frozen props passed from parent / router. */
  readonly props: Readonly<Record<string, any>>;

  /** Map of `z-ref` name → DOM element. Populated after each render. */
  refs: Record<string, Element>;

  /** Keyed template map (when using multi-`templateUrl` or `pages`). */
  templates: Record<string, string>;

  /** Normalized page metadata (when using `pages` config). */
  pages: Array<{ id: string; label: string }>;

  /** Active page id derived from route param (when using `pages` config). */
  activePage: string;

  /** Merge partial state (triggers re-render). */
  setState(partial: Record<string, any>): void;

  /** Dispatch a bubbling `CustomEvent` from the component root. */
  emit(name: string, detail?: any): void;

  /** Teardown: removes listeners, scoped styles, clears DOM. */
  destroy(): void;

  /** Manually queue a re-render (microtask-batched). */
  _scheduleUpdate(): void;

  /** Any user-defined methods from the component definition. */
  [method: string]: any;
}

/**
 * Register a new component.
 * @param name Must contain a hyphen (Web Component convention).
 * @param definition Component definition object.
 */
export function component(name: string, definition: ComponentDefinition): void;

/**
 * Mount a registered component into a target element.
 * @returns The component instance.
 */
export function mount(
  target: string | Element,
  componentName: string,
  props?: Record<string, any>,
): ComponentInstance;

/**
 * Scan `root` for elements whose tag matches a registered component and mount them.
 * @param root Defaults to `document.body`.
 */
export function mountAll(root?: Element): void;

/**
 * Get the component instance mounted on `target`.
 */
export function getInstance(target: string | Element): ComponentInstance | null;

/**
 * Destroy the component at the given target.
 */
export function destroy(target: string | Element): void;

/**
 * Returns an object of all registered component definitions (for debugging).
 */
export function getRegistry(): Record<string, ComponentDefinition>;

/** Handle returned by `$.style()`. */
interface StyleHandle {
  /** Remove all injected `<link>` elements. */
  remove(): void;
  /** Resolves when all stylesheets have loaded. */
  ready: Promise<void>;
}

/** Options for `$.style()`. */
interface StyleOptions {
  /** Hide page until loaded to prevent FOUC (default `true`). */
  critical?: boolean;
  /** Background color while hidden during critical load (default `'#0d1117'`). */
  bg?: string;
}

/**
 * Dynamically load global (unscoped) stylesheet file(s) into `<head>`.
 * Relative paths resolve relative to the calling file.
 */
export function style(urls: string | string[], opts?: StyleOptions): StyleHandle;


// ───────────────────────────────────────────────────────────────────────────
// Router
// ───────────────────────────────────────────────────────────────────────────

/** A single route definition. */
interface RouteDefinition {
  /**
   * URL pattern. Supports `:param` segments and `*` wildcard.
   * @example '/user/:id'
   */
  path: string;

  /**
   * Registered component name (auto-mounted), or a render function.
   */
  component: string | ((route: NavigationContext) => string);

  /** Async function called before mounting (for lazy-loading modules). */
  load?: () => Promise<any>;

  /**
   * An additional path that also matches this route.
   * Missing `:param` values will be `undefined`.
   */
  fallback?: string;
}

/** Navigation context passed to guards and `onChange` listeners. */
interface NavigationContext {
  /** The matched route definition. */
  route: RouteDefinition;
  /** Parsed `:param` values. */
  params: Record<string, string>;
  /** Parsed query-string values. */
  query: Record<string, string>;
  /** Matched path (base-stripped in history mode). */
  path: string;
}

/** Router configuration. */
interface RouterConfig {
  /** Outlet element where route components are rendered. */
  el?: string | Element;
  /** Routing mode (default: `'history'`; `'hash'` for file:// or hash routing). */
  mode?: 'history' | 'hash';
  /**
   * Base path prefix (e.g. `'/my-app'`).
   * Auto-detected from `<base href>` or `window.__ZQ_BASE` if not set.
   */
  base?: string;
  /** Route definitions. */
  routes?: RouteDefinition[];
  /** Component name to render when no route matches (404). */
  fallback?: string;
}

/** The SPA router instance. */
interface RouterInstance {
  /** Push a new state and resolve the route. */
  navigate(path: string, options?: { state?: any }): RouterInstance;
  /** Replace the current state (no new history entry). */
  replace(path: string, options?: { state?: any }): RouterInstance;
  /** `history.back()` */
  back(): RouterInstance;
  /** `history.forward()` */
  forward(): RouterInstance;
  /** `history.go(n)` */
  go(n: number): RouterInstance;

  /** Add a route dynamically. Chainable. */
  add(route: RouteDefinition): RouterInstance;
  /** Remove a route by path. */
  remove(path: string): RouterInstance;

  /**
   * Navigation guard — runs before each route change.
   * Return `false` to cancel, or a `string` to redirect.
   */
  beforeEach(
    fn: (to: NavigationContext, from: NavigationContext | null) => boolean | string | void | Promise<boolean | string | void>,
  ): RouterInstance;

  /** Post-navigation hook. */
  afterEach(
    fn: (to: NavigationContext, from: NavigationContext | null) => void | Promise<void>,
  ): RouterInstance;

  /**
   * Subscribe to route changes.
   * @returns An unsubscribe function.
   */
  onChange(
    fn: (to: NavigationContext, from: NavigationContext | null) => void,
  ): () => void;

  /** Teardown the router and mounted component. */
  destroy(): void;

  /** Resolve a path applying the base prefix. */
  resolve(path: string): string;

  // ── Properties ──────────────────────────────────────────────────────────
  /** Current navigation context. */
  readonly current: NavigationContext | null;
  /** Current path (base-stripped in history mode). */
  readonly path: string;
  /** Parsed query-string object. */
  readonly query: Record<string, string>;
  /** Configured base path. */
  readonly base: string;
}

/** Create and activate a client-side SPA router. */
export function createRouter(config: RouterConfig): RouterInstance;

/** Get the currently active router instance. */
export function getRouter(): RouterInstance | null;


// ───────────────────────────────────────────────────────────────────────────
// Store
// ───────────────────────────────────────────────────────────────────────────

/** Store configuration. */
interface StoreConfig<
  S extends Record<string, any> = Record<string, any>,
  A extends Record<string, (state: S, ...args: any[]) => any> = Record<string, (state: S, ...args: any[]) => any>,
  G extends Record<string, (state: S) => any> = Record<string, (state: S) => any>,
> {
  /** Initial state. Function form creates a fresh copy. */
  state?: S | (() => S);

  /**
   * Named action functions. The first argument is always the reactive `state`.
   */
  actions?: A;

  /** Computed getters derived from state (lazily evaluated). */
  getters?: G;

  /** Log dispatched actions to the console. */
  debug?: boolean;
}

/** A store action history entry. */
interface StoreHistoryEntry {
  action: string;
  args: any[];
  timestamp: number;
}

/** The reactive store instance. */
interface StoreInstance<
  S extends Record<string, any> = Record<string, any>,
  A extends Record<string, (state: S, ...args: any[]) => any> = Record<string, (state: S, ...args: any[]) => any>,
  G extends Record<string, (state: S) => any> = Record<string, (state: S) => any>,
> {
  /** Reactive state proxy. Read / write triggers subscriptions. */
  state: S & ReactiveProxy<S>;

  /** Computed getters object. */
  readonly getters: { readonly [K in keyof G]: ReturnType<G[K]> };

  /** Log of all dispatched actions. */
  readonly history: ReadonlyArray<StoreHistoryEntry>;

  /**
   * Execute a named action.
   * @returns The action's return value.
   */
  dispatch<K extends keyof A>(
    name: K,
    ...args: A[K] extends (state: any, ...rest: infer P) => any ? P : any[]
  ): ReturnType<A[K]>;
  dispatch(name: string, ...args: any[]): any;

  /**
   * Subscribe to changes on a specific state key.
   * @returns An unsubscribe function.
   */
  subscribe(key: string, fn: (value: any, oldValue: any, key: string) => void): () => void;
  /** Subscribe to all state changes (wildcard). */
  subscribe(fn: (key: string, value: any, oldValue: any) => void): () => void;

  /** Deep clone of the current state. */
  snapshot(): S;

  /** Replace the entire state. */
  replaceState(newState: Partial<S>): void;

  /**
   * Add middleware. Return `false` from `fn` to block the action.
   * Chainable.
   */
  use(fn: (actionName: string, args: any[], state: S) => boolean | void): StoreInstance<S, A, G>;

  /** Replace state and clear action history. */
  reset(initialState: Partial<S>): void;
}

/** Create a new global reactive store. */
export function createStore<
  S extends Record<string, any>,
  A extends Record<string, (state: S, ...args: any[]) => any>,
  G extends Record<string, (state: S) => any>,
>(config: StoreConfig<S, A, G>): StoreInstance<S, A, G>;
export function createStore<
  S extends Record<string, any>,
  A extends Record<string, (state: S, ...args: any[]) => any>,
  G extends Record<string, (state: S) => any>,
>(name: string, config: StoreConfig<S, A, G>): StoreInstance<S, A, G>;

/** Retrieve a previously created store by name (default: `'default'`). */
export function getStore<
  S extends Record<string, any> = Record<string, any>,
  A extends Record<string, (state: S, ...args: any[]) => any> = Record<string, (state: S, ...args: any[]) => any>,
  G extends Record<string, (state: S) => any> = Record<string, (state: S) => any>,
>(name?: string): StoreInstance<S, A, G> | null;


// ───────────────────────────────────────────────────────────────────────────
// HTTP Client
// ───────────────────────────────────────────────────────────────────────────

/** The response object resolved by all HTTP request methods (except `raw`). */
interface HttpResponse<T = any> {
  /** `true` if status 200-299. */
  ok: boolean;
  /** HTTP status code. */
  status: number;
  /** HTTP status text. */
  statusText: string;
  /** Response headers as a plain object. */
  headers: Record<string, string>;
  /** Auto-parsed body (JSON, text, or Blob depending on content type). */
  data: T;
  /** Raw `fetch` Response object. */
  response: Response;
}

/** Per-request options passed to HTTP methods. */
interface HttpRequestOptions extends Omit<RequestInit, 'body' | 'method'> {
  /** Additional headers (merged with defaults). */
  headers?: Record<string, string>;
  /** Override default timeout (ms). */
  timeout?: number;
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
}

/** Global HTTP configuration options. */
interface HttpConfigureOptions {
  /** Prepended to non-absolute URLs. */
  baseURL?: string;
  /** Default headers (merged, not replaced). */
  headers?: Record<string, string>;
  /** Default timeout in ms (default 30 000). Set `0` to disable. */
  timeout?: number;
}

/** Request interceptor function. */
type HttpRequestInterceptor = (
  fetchOpts: RequestInit & { headers: Record<string, string> },
  url: string,
) => void | false | { url?: string; options?: RequestInit } | Promise<void | false | { url?: string; options?: RequestInit }>;

/** Response interceptor function. */
type HttpResponseInterceptor = (result: HttpResponse) => void | Promise<void>;

/** The `$.http` namespace. */
interface HttpClient {
  /** GET request. `params` appended as query string. */
  get<T = any>(url: string, params?: Record<string, any> | null, opts?: HttpRequestOptions): Promise<HttpResponse<T>>;
  /** POST request. `data` sent as JSON body (or FormData). */
  post<T = any>(url: string, data?: any, opts?: HttpRequestOptions): Promise<HttpResponse<T>>;
  /** PUT request. */
  put<T = any>(url: string, data?: any, opts?: HttpRequestOptions): Promise<HttpResponse<T>>;
  /** PATCH request. */
  patch<T = any>(url: string, data?: any, opts?: HttpRequestOptions): Promise<HttpResponse<T>>;
  /** DELETE request. */
  delete<T = any>(url: string, data?: any, opts?: HttpRequestOptions): Promise<HttpResponse<T>>;

  /** Update default configuration for all subsequent requests. */
  configure(options: HttpConfigureOptions): void;

  /** Add a request interceptor (called before every request). */
  onRequest(fn: HttpRequestInterceptor): void;

  /** Add a response interceptor (called after every response, before error check). */
  onResponse(fn: HttpResponseInterceptor): void;

  /** Create a new `AbortController` for manual request cancellation. */
  createAbort(): AbortController;

  /** Direct passthrough to native `fetch()` — no JSON handling, no interceptors. */
  raw(url: string, opts?: RequestInit): Promise<Response>;
}

export const http: HttpClient;


// ───────────────────────────────────────────────────────────────────────────
// Utilities — Functions
// ───────────────────────────────────────────────────────────────────────────

/** Debounced function with a `.cancel()` helper. */
interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  /** Cancel the pending invocation. */
  cancel(): void;
}

/**
 * Returns a debounced function that delays execution until `ms` ms of inactivity.
 * @param ms Default `250`.
 */
export function debounce<T extends (...args: any[]) => any>(fn: T, ms?: number): DebouncedFunction<T>;

/**
 * Returns a throttled function that executes at most once per `ms` ms.
 * @param ms Default `250`.
 */
export function throttle<T extends (...args: any[]) => any>(fn: T, ms?: number): (...args: Parameters<T>) => void;

/** Left-to-right function composition. */
export function pipe<T>(...fns: Array<(value: T) => T>): (input: T) => T;

/**
 * Returns a function that only executes once, caching the result.
 */
export function once<T extends (...args: any[]) => any>(fn: T): (...args: Parameters<T>) => ReturnType<T>;

/** Returns a `Promise` that resolves after `ms` milliseconds. */
export function sleep(ms: number): Promise<void>;


// ───────────────────────────────────────────────────────────────────────────
// Utilities — Strings
// ───────────────────────────────────────────────────────────────────────────

/** Escape HTML entities: `&`, `<`, `>`, `"`, `'`. */
export function escapeHtml(str: string): string;

/**
 * Tagged template literal that auto-escapes interpolated values.
 * Use `$.trust()` to mark values as safe.
 */
export function html(strings: TemplateStringsArray, ...values: any[]): string;

/** Wrapper that marks an HTML string as trusted (not escaped by `$.html`). */
interface TrustedHTML {
  toString(): string;
}

/** Mark an HTML string as trusted so it won't be escaped in `$.html`. */
export function trust(htmlStr: string): TrustedHTML;

/** Generate a UUID v4 string. */
export function uuid(): string;

/** Convert kebab-case to camelCase. */
export function camelCase(str: string): string;

/** Convert camelCase to kebab-case. */
export function kebabCase(str: string): string;


// ───────────────────────────────────────────────────────────────────────────
// Utilities — Objects
// ───────────────────────────────────────────────────────────────────────────

/** Deep clone using `structuredClone` (JSON fallback). */
export function deepClone<T>(obj: T): T;

/** Recursively merge objects. Arrays are replaced, not merged. */
export function deepMerge<T extends object>(target: T, ...sources: Partial<T>[]): T;

/** Deep equality comparison. */
export function isEqual(a: any, b: any): boolean;


// ───────────────────────────────────────────────────────────────────────────
// Utilities — URL
// ───────────────────────────────────────────────────────────────────────────

/** Serialize an object to a URL query string. */
export function param(obj: Record<string, any>): string;

/** Parse a URL query string into an object. */
export function parseQuery(str: string): Record<string, string>;


// ───────────────────────────────────────────────────────────────────────────
// Utilities — Storage
// ───────────────────────────────────────────────────────────────────────────

/** JSON-aware `localStorage` wrapper. */
interface StorageWrapper {
  /** Get and JSON-parse a value. Returns `fallback` on missing / error. */
  get<T = any>(key: string, fallback?: T): T;
  /** JSON-stringify and store. */
  set(key: string, value: any): void;
  /** Remove a key. */
  remove(key: string): void;
  /** Clear all entries. */
  clear(): void;
}

/** `localStorage` wrapper. */
export const storage: StorageWrapper;

/** `sessionStorage` wrapper (same API as `storage`). */
export const session: StorageWrapper;


// ───────────────────────────────────────────────────────────────────────────
// Utilities — Event Bus
// ───────────────────────────────────────────────────────────────────────────

/** Singleton pub/sub event bus for cross-component communication. */
interface EventBus {
  /** Subscribe. Returns an unsubscribe function. */
  on(event: string, fn: (...args: any[]) => void): () => void;
  /** Unsubscribe a specific handler. */
  off(event: string, fn: (...args: any[]) => void): void;
  /** Emit an event with arguments. */
  emit(event: string, ...args: any[]): void;
  /** Subscribe for a single invocation. Returns an unsubscribe function. */
  once(event: string, fn: (...args: any[]) => void): () => void;
  /** Remove all listeners. */
  clear(): void;
}

export const bus: EventBus;


// ───────────────────────────────────────────────────────────────────────────
// $ — Main function & namespace
// ───────────────────────────────────────────────────────────────────────────

/**
 * Main selector / DOM-ready function.
 *
 * - `$('selector')` → single Element via `querySelector`
 * - `$('<div>…</div>')` → create element from HTML
 * - `$(element)` → return as-is
 * - `$(fn)` → DOMContentLoaded shorthand
 */
interface ZQueryStatic {
  (selector: string, context?: string | Element): Element | null;
  (element: Element): Element;
  (nodeList: NodeList | HTMLCollection | Element[]): Element | null;
  (fn: () => void): void;

  // ── Collection selector ─────────────────────────────────────────────────
  /**
   * Collection selector — returns a `ZQueryCollection`.
   *
   * - `$.all('.card')` → all matching elements
   * - `$.all('<div>…</div>')` → create elements as collection
   * - `$.all(element)` → wrap single element
   * - `$.all(nodeList)` → wrap NodeList
   */
  all(selector: string, context?: string | Element): ZQueryCollection;
  all(element: Element): ZQueryCollection;
  all(nodeList: NodeList | HTMLCollection | Element[]): ZQueryCollection;

  // ── Quick-ref shortcuts ─────────────────────────────────────────────────
  /** `document.getElementById(id)` */
  id(id: string): Element | null;
  /** `document.querySelector('.name')` */
  class(name: string): Element | null;
  /** `document.getElementsByClassName(name)` as array. */
  classes(name: string): Element[];
  /** `document.getElementsByTagName(name)` as array. */
  tag(name: string): Element[];
  /** Children of `#parentId` as array. */
  children(parentId: string): Element[];

  // ── Static helpers ──────────────────────────────────────────────────────
  /**
   * Create a DOM element.
   * Special `attrs` keys: `class`, `style` (object), `on*` (handler), `data` (object).
   */
  create(
    tag: string,
    attrs?: Record<string, any>,
    ...children: Array<string | Node>
  ): HTMLElement;

  /** Register a DOMContentLoaded callback (fires immediately if already loaded). */
  ready(fn: () => void): void;

  /** Global event delegation on `document`. */
  on(event: string, selector: string, handler: (this: Element, e: Event) => void): void;

  /** Direct event listener on `document` (for keydown, resize, etc.). */
  on(event: string, handler: (e: Event) => void): void;

  /** Remove a direct global event listener previously attached with `$.on(event, handler)`. */
  off(event: string, handler: (e: Event) => void): void;

  /** Alias for `ZQueryCollection.prototype` — extend to add custom collection methods. */
  fn: typeof ZQueryCollection.prototype;

  // ── Reactive ────────────────────────────────────────────────────────────
  reactive: typeof reactive;
  signal: typeof signal;
  computed: typeof computed;
  effect: typeof effect;

  // ── Components ──────────────────────────────────────────────────────────
  component: typeof component;
  mount: typeof mount;
  mountAll: typeof mountAll;
  getInstance: typeof getInstance;
  destroy: typeof destroy;
  /** Returns all registered component definitions. */
  components: typeof getRegistry;
  style: typeof style;

  // ── Router ──────────────────────────────────────────────────────────────
  router: typeof createRouter;
  getRouter: typeof getRouter;

  // ── Store ───────────────────────────────────────────────────────────────
  store: typeof createStore;
  getStore: typeof getStore;

  // ── HTTP ────────────────────────────────────────────────────────────────
  http: HttpClient;
  get: HttpClient['get'];
  post: HttpClient['post'];
  put: HttpClient['put'];
  patch: HttpClient['patch'];
  delete: HttpClient['delete'];

  // ── Utilities ───────────────────────────────────────────────────────────
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

  // ── Meta ────────────────────────────────────────────────────────────────
  /** Library version string. */
  version: string;
  /** Populated at build time by the CLI bundler. */
  meta: Record<string, any>;
  /** Remove `$` from `window` and return the library object. */
  noConflict(): ZQueryStatic;
}

/** The main `$` / `zQuery` function + namespace. */
export const $: ZQueryStatic;
export { $ as zQuery };
export const queryAll: typeof ZQueryCollection;

export default $;


// ───────────────────────────────────────────────────────────────────────────
// Global augmentation (browser)
// ───────────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    /** zQuery main function & namespace. */
    $: ZQueryStatic;
    /** Alias for `$`. */
    zQuery: ZQueryStatic;
    /** Optional base path override read by the router. */
    __ZQ_BASE?: string;
    /** Inline template / style cache populated by the CLI bundler. */
    __zqInline?: Record<string, string>;
  }

  /** Global `$` — available when loaded via `<script>` tag. */
  const $: ZQueryStatic;
  /** Global alias for `$`. */
  const zQuery: ZQueryStatic;
}
