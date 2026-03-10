/**
 * zQuery Router — Client-side SPA router
 * 
 * Supports hash mode (#/path) and history mode (/path).
 * Route params, query strings, navigation guards, and lazy loading.
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

import { mount, destroy } from './component.js';
import { reportError, ErrorCode } from './errors.js';

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

    // Set outlet element
    if (config.el) {
      this._el = typeof config.el === 'string' ? document.querySelector(config.el) : config.el;
    }

    // Register routes
    if (config.routes) {
      config.routes.forEach(r => this.add(r));
    }

    // Listen for navigation
    if (this._mode === 'hash') {
      window.addEventListener('hashchange', () => this._resolve());
    } else {
      window.addEventListener('popstate', () => this._resolve());
    }

    // Intercept link clicks for SPA navigation
    document.addEventListener('click', (e) => {
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
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    });

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
    // When matched via fallback, missing params are undefined → pages `default` kicks in.
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
      window.location.hash = '#' + normalized;
    } else {
      window.history.pushState(options.state || {}, '', this._base + normalized + hash);
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
      window.history.replaceState(options.state || {}, '', this._base + normalized + hash);
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
            window.history.replaceState({}, '', this._base + rNorm + rHash);
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
      // Destroy previous
      if (this._instance) {
        this._instance.destroy();
        this._instance = null;
      }

      // Create container
      this._el.innerHTML = '';

      // Pass route params and query as props
      const props = { ...params, $route: to, $query: query, $params: params };

      // If component is a string (registered name), mount it
      if (typeof matched.component === 'string') {
        const container = document.createElement(matched.component);
        this._el.appendChild(container);
        this._instance = mount(container, matched.component, props);
      }
      // If component is a render function
      else if (typeof matched.component === 'function') {
        this._el.innerHTML = matched.component(to);
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
    if (this._instance) this._instance.destroy();
    this._listeners.clear();
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
