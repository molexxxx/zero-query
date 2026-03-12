/**
 * zQuery Router — Client-side SPA router
 * 
 * Supports hash mode (#/path) and history mode (/path).
 * Route params, query strings, navigation guards, and lazy loading.
 * Sub-route history substates for in-page UI changes (modals, tabs, etc.).
 * 
 * Usage:
 *   $.router({
 *     el: '#app',
 *     mode: 'hash',
 *     routes: [
 *       { path: '/', component: 'home-page' },
 *       { path: '/user/:id', component: 'user-profile' },
 *       { path: '/lazy', load: () => import('./pages/lazy.js'), component: 'lazy-page' },
 *     ],
 *     fallback: 'not-found'
 *   });
 */

import { mount, destroy, prefetch } from './component.js';
import { reportError, ErrorCode } from './errors.js';

// Unique marker on history.state to identify zQuery-managed entries
const _ZQ_STATE_KEY = '__zq';

/**
 * Shallow-compare two flat objects (for params / query comparison).
 * Avoids JSON.stringify overhead on every navigation.
 */
function _shallowEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    const k = keysA[i];
    if (a[k] !== b[k]) return false;
  }
  return true;
}

class Router {
  constructor(config = {}) {
    this._el = null;
    // file:// protocol can't use pushState — always force hash mode
    const isFile = typeof location !== 'undefined' && location.protocol === 'file:';
    this._mode = isFile ? 'hash' : (config.mode || 'history');

    // Base path for sub-path deployments
    // Priority: explicit config.base → window.__ZQ_BASE → <base href> tag
    let rawBase = config.base;
    if (rawBase == null) {
      rawBase = (typeof window !== 'undefined' && window.__ZQ_BASE) || '';
      if (!rawBase && typeof document !== 'undefined') {
        const baseEl = document.querySelector('base');
        if (baseEl) {
          try { rawBase = new URL(baseEl.href).pathname; }
          catch { rawBase = baseEl.getAttribute('href') || ''; }
          if (rawBase === '/') rawBase = '';    // root = no sub-path
        }
      }
    }
    // Normalize: ensure leading /, strip trailing /
    this._base = String(rawBase).replace(/\/+$/, '');
    if (this._base && !this._base.startsWith('/')) this._base = '/' + this._base;

    this._routes = [];
    this._fallback = config.fallback || null;
    this._current = null;                         // { route, params, query, path }
    this._guards = { before: [], after: [] };
    this._listeners = new Set();
    this._instance = null;                        // current mounted component
    this._resolving = false;                      // re-entrancy guard

    // Sub-route history substates
    this._substateListeners = [];                 // [(key, data) => bool|void]
    this._inSubstate = false;                       // true while substate entries are in the history stack

    // Set outlet element
    if (config.el) {
      this._el = typeof config.el === 'string' ? document.querySelector(config.el) : config.el;
    }

    // Register routes
    if (config.routes) {
      config.routes.forEach(r => this.add(r));
    }

    // Listen for navigation — store handler references for cleanup in destroy()
    if (this._mode === 'hash') {
      this._onNavEvent = () => this._resolve();
      window.addEventListener('hashchange', this._onNavEvent);
    } else {
      this._onNavEvent = (e) => {
        // Check for substate pop first — if a listener handles it, don't route
        const st = e.state;
        if (st && st[_ZQ_STATE_KEY] === 'substate') {
          const handled = this._fireSubstate(st.key, st.data, 'pop');
          if (handled) return;
          // Unhandled substate — fall through to route resolve
          // _inSubstate stays true so the next non-substate pop triggers reset
        } else if (this._inSubstate) {
          // Popped past all substates — notify listeners to reset to defaults
          this._inSubstate = false;
          this._fireSubstate(null, null, 'reset');
        }
        this._resolve();
      };
      window.addEventListener('popstate', this._onNavEvent);
    }

    // Intercept link clicks for SPA navigation
    this._onLinkClick = (e) => {
      // Don't intercept modified clicks (Ctrl/Cmd+click = new tab)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target.closest('[z-link]');
      if (!link) return;
      if (link.getAttribute('target') === '_blank') return;
      e.preventDefault();
      let href = link.getAttribute('z-link');
      // Support z-link-params for dynamic :param interpolation
      const paramsAttr = link.getAttribute('z-link-params');
      if (paramsAttr) {
        try {
          const params = JSON.parse(paramsAttr);
          href = this._interpolateParams(href, params);
        } catch { /* ignore malformed JSON */ }
      }
      this.navigate(href);
      // z-to-top modifier: scroll to top after navigation
      if (link.hasAttribute('z-to-top')) {
        const scrollBehavior = link.getAttribute('z-to-top') || 'instant';
        window.scrollTo({ top: 0, behavior: scrollBehavior });
      }
    };
    document.addEventListener('click', this._onLinkClick);

    // Initial resolve
    if (this._el) {
      // Defer to allow all components to register
      queueMicrotask(() => this._resolve());
    }
  }

  // --- Route management ----------------------------------------------------

  add(route) {
    // Compile path pattern into regex
    const keys = [];
    const pattern = route.path
      .replace(/:(\w+)/g, (_, key) => { keys.push(key); return '([^/]+)'; })
      .replace(/\*/g, '(.*)');
    const regex = new RegExp(`^${pattern}$`);

    this._routes.push({ ...route, _regex: regex, _keys: keys });

    // Per-route fallback: register an alias path for the same component.
    // e.g. { path: '/docs/:section', fallback: '/docs', component: 'docs-page' }
    // When matched via fallback, missing params are undefined.
    if (route.fallback) {
      const fbKeys = [];
      const fbPattern = route.fallback
        .replace(/:(\w+)/g, (_, key) => { fbKeys.push(key); return '([^/]+)'; })
        .replace(/\*/g, '(.*)');
      const fbRegex = new RegExp(`^${fbPattern}$`);
      this._routes.push({ ...route, path: route.fallback, _regex: fbRegex, _keys: fbKeys });
    }

    return this;
  }

  remove(path) {
    this._routes = this._routes.filter(r => r.path !== path);
    return this;
  }

  // --- Navigation ----------------------------------------------------------

  /**
   * Interpolate :param placeholders in a path with the given values.
   * @param {string} path — e.g. '/user/:id/posts/:pid'
   * @param {Object} params — e.g. { id: 42, pid: 7 }
   * @returns {string}
   */
  _interpolateParams(path, params) {
    if (!params || typeof params !== 'object') return path;
    return path.replace(/:([\w]+)/g, (_, key) => {
      const val = params[key];
      return val != null ? encodeURIComponent(String(val)) : ':' + key;
    });
  }

  /**
   * Get the full current URL (path + hash) for same-URL detection.
   * @returns {string}
   */
  _currentURL() {
    if (this._mode === 'hash') {
      return window.location.hash.slice(1) || '/';
    }
    const pathname = window.location.pathname || '/';
    const hash = window.location.hash || '';
    return pathname + hash;
  }

  navigate(path, options = {}) {
    // Interpolate :param placeholders if options.params is provided
    if (options.params) path = this._interpolateParams(path, options.params);
    // Separate hash fragment (e.g. /docs/getting-started#cli-bundler)
    const [cleanPath, fragment] = (path || '').split('#');
    let normalized = this._normalizePath(cleanPath);
    const hash = fragment ? '#' + fragment : '';
    if (this._mode === 'hash') {
      // Hash mode uses the URL hash for routing, so a #fragment can't live
      // in the URL. Store it as a scroll target for the destination component.
      if (fragment) window.__zqScrollTarget = fragment;
      const targetHash = '#' + normalized;
      // Skip if already at this exact hash (prevents duplicate entries)
      if (window.location.hash === targetHash && !options.force) return this;
      window.location.hash = targetHash;
    } else {
      const targetURL = this._base + normalized + hash;
      const currentURL = (window.location.pathname || '/') + (window.location.hash || '');

      if (targetURL === currentURL && !options.force) {
        // Same full URL (path + hash) — don't push duplicate entry.
        // If only the hash changed to a fragment target, scroll to it.
        if (fragment) {
          const el = document.getElementById(fragment);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return this;
      }

      // Same route path but different hash fragment — use replaceState
      // so back goes to the previous *route*, not the previous scroll position.
      const targetPathOnly = this._base + normalized;
      const currentPathOnly = window.location.pathname || '/';
      if (targetPathOnly === currentPathOnly && hash && !options.force) {
        window.history.replaceState(
          { ...options.state, [_ZQ_STATE_KEY]: 'route' },
          '',
          targetURL
        );
        // Scroll to the fragment target
        if (fragment) {
          const el = document.getElementById(fragment);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // Don't re-resolve — same route, just a hash change
        return this;
      }

      window.history.pushState(
        { ...options.state, [_ZQ_STATE_KEY]: 'route' },
        '',
        targetURL
      );
      this._resolve();
    }
    return this;
  }

  replace(path, options = {}) {
    // Interpolate :param placeholders if options.params is provided
    if (options.params) path = this._interpolateParams(path, options.params);
    const [cleanPath, fragment] = (path || '').split('#');
    let normalized = this._normalizePath(cleanPath);
    const hash = fragment ? '#' + fragment : '';
    if (this._mode === 'hash') {
      if (fragment) window.__zqScrollTarget = fragment;
      window.location.replace('#' + normalized);
    } else {
      window.history.replaceState(
        { ...options.state, [_ZQ_STATE_KEY]: 'route' },
        '',
        this._base + normalized + hash
      );
      this._resolve();
    }
    return this;
  }

  /**
   * Normalize an app-relative path and guard against double base-prefixing.
   * @param {string} path — e.g. '/docs', 'docs', or '/app/docs' when base is '/app'
   * @returns {string} — always starts with '/'
   */
  _normalizePath(path) {
    let p = path && path.startsWith('/') ? path : (path ? `/${path}` : '/');
    // Strip base prefix if caller accidentally included it
    if (this._base) {
      if (p === this._base) return '/';
      if (p.startsWith(this._base + '/')) p = p.slice(this._base.length) || '/';
    }
    return p;
  }

  /**
   * Resolve an app-relative path to a full URL path (including base).
   * Useful for programmatic link generation.
   * @param {string} path
   * @returns {string}
   */
  resolve(path) {
    const normalized = path && path.startsWith('/') ? path : (path ? `/${path}` : '/');
    return this._base + normalized;
  }

  back() { window.history.back(); return this; }
  forward() { window.history.forward(); return this; }
  go(n) { window.history.go(n); return this; }

  // --- Guards --------------------------------------------------------------

  beforeEach(fn) {
    this._guards.before.push(fn);
    return this;
  }

  afterEach(fn) {
    this._guards.after.push(fn);
    return this;
  }

  // --- Events --------------------------------------------------------------

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  // --- Sub-route history substates -----------------------------------------

  /**
   * Push a lightweight history entry for in-component UI state.
   * The URL path does NOT change — only a history entry is added so the
   * back button can undo the UI change (close modal, revert tab, etc.)
   * before navigating away.
   *
   * @param {string} key   — identifier (e.g. 'modal', 'tab', 'panel')
   * @param {*}      data  — arbitrary state (serializable)
   * @returns {Router}
   *
   * @example
   * // Open a modal and push a substate
   * router.pushSubstate('modal', { id: 'confirm-delete' });
   * // User hits back → onSubstate fires → close the modal
   */
  pushSubstate(key, data) {
    this._inSubstate = true;
    if (this._mode === 'hash') {
      // Hash mode: stash the substate in a global — hashchange will check.
      // We still push a history entry via a sentinel hash suffix.
      const current = window.location.hash || '#/';
      window.history.pushState(
        { [_ZQ_STATE_KEY]: 'substate', key, data },
        '',
        window.location.href
      );
    } else {
      window.history.pushState(
        { [_ZQ_STATE_KEY]: 'substate', key, data },
        '',
        window.location.href      // keep same URL
      );
    }
    return this;
  }

  /**
   * Register a listener for substate pops (back button on a substate entry).
   * The callback receives `(key, data)` and should return `true` if it
   * handled the pop (prevents route resolution). If no listener returns
   * `true`, normal route resolution proceeds.
   *
   * @param {(key: string, data: any, action: string) => boolean|void} fn
   * @returns {() => void} unsubscribe function
   *
   * @example
   * const unsub = router.onSubstate((key, data) => {
   *   if (key === 'modal') { closeModal(); return true; }
   * });
   */
  onSubstate(fn) {
    this._substateListeners.push(fn);
    return () => {
      this._substateListeners = this._substateListeners.filter(f => f !== fn);
    };
  }

  /**
   * Fire substate listeners. Returns true if any listener handled it.
   * @private
   */
  _fireSubstate(key, data, action) {
    for (const fn of this._substateListeners) {
      try {
        if (fn(key, data, action) === true) return true;
      } catch (err) {
        reportError(ErrorCode.ROUTER_GUARD, 'onSubstate listener threw', { key, data }, err);
      }
    }
    return false;
  }

  // --- Current state -------------------------------------------------------

  get current() { return this._current; }

  /** The detected or configured base path (read-only) */
  get base() { return this._base; }

  get path() {
    if (this._mode === 'hash') {
      const raw = window.location.hash.slice(1) || '/';
      // If the hash doesn't start with '/', it's an in-page anchor
      // (e.g. #some-heading), not a route.  Treat it as a scroll target
      // and resolve to the last known route (or '/').
      if (raw && !raw.startsWith('/')) {
        window.__zqScrollTarget = raw;
        // Restore the route hash silently so the URL stays valid
        const fallbackPath = (this._current && this._current.path) || '/';
        window.location.replace('#' + fallbackPath);
        return fallbackPath;
      }
      return raw;
    }
    let pathname = window.location.pathname || '/';
    // Strip trailing slash for consistency (except root '/')
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    if (this._base) {
      // Exact match: /app
      if (pathname === this._base) return '/';
      // Prefix match with boundary: /app/page (but NOT /application)
      if (pathname.startsWith(this._base + '/')) {
        return pathname.slice(this._base.length) || '/';
      }
    }
    return pathname;
  }

  get query() {
    const search = this._mode === 'hash'
      ? (window.location.hash.split('?')[1] || '')
      : window.location.search.slice(1);
    return Object.fromEntries(new URLSearchParams(search));
  }

  // --- Internal resolve ----------------------------------------------------

  async _resolve() {
    // Prevent re-entrant calls (e.g. listener triggering navigation)
    if (this._resolving) return;
    this._resolving = true;
    this._redirectCount = 0;
    try {
      await this.__resolve();
    } finally {
      this._resolving = false;
    }
  }

  async __resolve() {
    // Check if we're landing on a substate entry (e.g. page refresh on a
    // substate bookmark, or hash-mode popstate). Fire listeners and bail
    // if handled — the URL hasn't changed so there's no route to resolve.
    const histState = window.history.state;
    if (histState && histState[_ZQ_STATE_KEY] === 'substate') {
      const handled = this._fireSubstate(histState.key, histState.data, 'resolve');
      if (handled) return;
      // No listener handled it — fall through to normal routing
    }

    const fullPath = this.path;
    const [pathPart, queryString] = fullPath.split('?');
    const path = pathPart || '/';
    const query = Object.fromEntries(new URLSearchParams(queryString || ''));

    // Match route
    let matched = null;
    let params = {};
    for (const route of this._routes) {
      const m = path.match(route._regex);
      if (m) {
        matched = route;
        route._keys.forEach((key, i) => { params[key] = m[i + 1]; });
        break;
      }
    }

    // Fallback
    if (!matched && this._fallback) {
      matched = { component: this._fallback, path: '*', _keys: [], _regex: /.*/ };
    }

    if (!matched) return;

    const to = { route: matched, params, query, path };
    const from = this._current;

    // Same-route optimization: if the resolved route is the same component
    // with the same params, skip the full destroy/mount cycle and just
    // update props. This prevents flashing and unnecessary DOM churn.
    if (from && this._instance && matched.component === from.route.component) {
      const sameParams = _shallowEqual(params, from.params);
      const sameQuery = _shallowEqual(query, from.query);
      if (sameParams && sameQuery) {
        // Identical navigation — nothing to do
        return;
      }
    }

    // Run before guards
    for (const guard of this._guards.before) {
      try {
        const result = await guard(to, from);
        if (result === false) return;                    // Cancel
        if (typeof result === 'string') {                // Redirect
          if (++this._redirectCount > 10) {
            reportError(ErrorCode.ROUTER_GUARD, 'Too many guard redirects (possible loop)', { to }, null);
            return;
          }
          // Update URL directly and re-resolve (avoids re-entrancy block)
          const [rPath, rFrag] = result.split('#');
          const rNorm = this._normalizePath(rPath || '/');
          const rHash = rFrag ? '#' + rFrag : '';
          if (this._mode === 'hash') {
            if (rFrag) window.__zqScrollTarget = rFrag;
            window.location.replace('#' + rNorm);
          } else {
            window.history.replaceState(
              { [_ZQ_STATE_KEY]: 'route' },
              '',
              this._base + rNorm + rHash
            );
          }
          return this.__resolve();
        }
      } catch (err) {
        reportError(ErrorCode.ROUTER_GUARD, 'Before-guard threw', { to, from }, err);
        return;
      }
    }

    // Lazy load module if needed
    if (matched.load) {
      try { await matched.load(); }
      catch (err) {
        reportError(ErrorCode.ROUTER_LOAD, `Failed to load module for route "${matched.path}"`, { path: matched.path }, err);
        return;
      }
    }

    this._current = to;

    // Mount component into outlet
    if (this._el && matched.component) {
      // Pre-load external templates/styles so the mount renders synchronously
      // (keeps old content visible during the fetch instead of showing blank)
      if (typeof matched.component === 'string') {
        await prefetch(matched.component);
      }

      // Destroy previous
      if (this._instance) {
        this._instance.destroy();
        this._instance = null;
      }

      // Create container
      const _routeStart = typeof window !== 'undefined' && window.__zqRenderHook ? performance.now() : 0;
      this._el.innerHTML = '';

      // Pass route params and query as props
      const props = { ...params, $route: to, $query: query, $params: params };

      // If component is a string (registered name), mount it
      if (typeof matched.component === 'string') {
        const container = document.createElement(matched.component);
        this._el.appendChild(container);
        this._instance = mount(container, matched.component, props);
        if (_routeStart) window.__zqRenderHook(this._el, performance.now() - _routeStart, 'route', matched.component);
      }
      // If component is a render function
      else if (typeof matched.component === 'function') {
        this._el.innerHTML = matched.component(to);
        if (_routeStart) window.__zqRenderHook(this._el, performance.now() - _routeStart, 'route', to);
      }
    }

    // Run after guards
    for (const guard of this._guards.after) {
      await guard(to, from);
    }

    // Notify listeners
    this._listeners.forEach(fn => fn(to, from));
  }

  // --- Destroy -------------------------------------------------------------

  destroy() {
    // Remove window/document event listeners to prevent memory leaks
    if (this._onNavEvent) {
      window.removeEventListener(this._mode === 'hash' ? 'hashchange' : 'popstate', this._onNavEvent);
      this._onNavEvent = null;
    }
    if (this._onLinkClick) {
      document.removeEventListener('click', this._onLinkClick);
      this._onLinkClick = null;
    }
    if (this._instance) this._instance.destroy();
    this._listeners.clear();
    this._substateListeners = [];
    this._inSubstate = false;
    this._routes = [];
    this._guards = { before: [], after: [] };
  }
}


// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
let _activeRouter = null;

export function createRouter(config) {
  _activeRouter = new Router(config);
  return _activeRouter;
}

export function getRouter() {
  return _activeRouter;
}
