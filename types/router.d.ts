/**
 * SPA Router — history and hash-based client-side routing.
 *
 * @module router
 */

/** A single route definition. */
export interface RouteDefinition {
  /**
   * URL pattern. Supports `:param` segments and `*` wildcard.
   * @example '/user/:id'
   */
  path: string;

  /** Registered component name (auto-mounted), or a render function. */
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
export interface NavigationContext {
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
export interface RouterConfig {
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
export interface RouterInstance {
  /**
   * Push a new state and resolve the route.
   * Supports `:param` interpolation when `options.params` is provided.
   * @example
   * router.navigate('/user/:id', { params: { id: 42 } }); // navigates to /user/42
   * router.navigate('/dashboard', { state: { from: 'login' } });
   */
  navigate(path: string, options?: { params?: Record<string, string | number>; state?: any }): RouterInstance;
  /**
   * Replace the current state (no new history entry).
   * Supports `:param` interpolation when `options.params` is provided.
   * @example
   * router.replace('/user/:id', { params: { id: 42 } }); // replaces with /user/42
   */
  replace(path: string, options?: { params?: Record<string, string | number>; state?: any }): RouterInstance;
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
    fn: (
      to: NavigationContext,
      from: NavigationContext | null,
    ) => boolean | string | void | Promise<boolean | string | void>,
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

  // -- Properties ----------------------------------------------------------

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
