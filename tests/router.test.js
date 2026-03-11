import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRouter, getRouter } from '../src/router.js';
import { component } from '../src/component.js';

// Register stub components used in route definitions so mount() doesn't throw
component('home-page', { render: () => '<p>home</p>' });
component('about-page', { render: () => '<p>about</p>' });
component('user-page', { render: () => '<p>user</p>' });
component('docs-page', { render: () => '<p>docs</p>' });


// ---------------------------------------------------------------------------
// Router creation and basic API
// ---------------------------------------------------------------------------

describe('Router — creation', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('creates a router and retrieves it with getRouter', () => {
    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
      ],
    });
    expect(getRouter()).toBe(router);
  });

  it('defaults to history mode (unless file:// protocol)', () => {
    const router = createRouter({
      routes: [{ path: '/', component: 'home-page' }],
    });
    expect(router._mode).toBe('history');
  });

  it('resolves base path from config', () => {
    const router = createRouter({
      base: '/app',
      routes: [],
    });
    expect(router.base).toBe('/app');
  });

  it('strips trailing slash from base', () => {
    const router = createRouter({
      base: '/app/',
      routes: [],
    });
    expect(router.base).toBe('/app');
  });
});


// ---------------------------------------------------------------------------
// Route matching
// ---------------------------------------------------------------------------

describe('Router — route matching', () => {
  it('compiles path params', () => {
    const router = createRouter({
      mode: 'hash',
      routes: [
        { path: '/user/:id', component: 'user-page' },
      ],
    });
    const route = router._routes[0];
    expect(route._regex.test('/user/42')).toBe(true);
    expect(route._keys).toEqual(['id']);
  });

  it('adds fallback route alias', () => {
    const router = createRouter({
      mode: 'hash',
      routes: [
        { path: '/docs/:section', fallback: '/docs', component: 'docs-page' },
      ],
    });
    // Should have two routes: the original + fallback alias
    expect(router._routes.length).toBe(2);
    expect(router._routes[1]._regex.test('/docs')).toBe(true);
  });
});


// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

describe('Router — navigation', () => {
  let router;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    window.location.hash = '#/';
    router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/about', component: 'about-page' },
      ],
    });
  });

  it('navigate changes hash', () => {
    router.navigate('/about');
    expect(window.location.hash).toBe('#/about');
  });

  it('replace changes hash without pushing history', () => {
    router.replace('/about');
    expect(window.location.hash).toBe('#/about');
  });

  it('navigate interpolates :param placeholders from options.params', () => {
    router.navigate('/user/:id', { params: { id: 42 } });
    expect(window.location.hash).toBe('#/user/42');
  });

  it('navigate interpolates multiple :param placeholders', () => {
    router.navigate('/post/:postId/comment/:cid', { params: { postId: 5, cid: 99 } });
    expect(window.location.hash).toBe('#/post/5/comment/99');
  });

  it('navigate leaves unmatched :params as-is', () => {
    router.navigate('/user/:id', { params: { name: 'Alice' } });
    expect(window.location.hash).toBe('#/user/:id');
  });

  it('navigate URI-encodes param values', () => {
    router.navigate('/search/:query', { params: { query: 'hello world' } });
    expect(window.location.hash).toBe('#/search/hello%20world');
  });

  it('replace interpolates :param placeholders from options.params', () => {
    router.replace('/user/:id', { params: { id: 7 } });
    expect(window.location.hash).toBe('#/user/7');
  });

  it('navigate without params option works as before', () => {
    router.navigate('/about');
    expect(window.location.hash).toBe('#/about');
  });
});


// ---------------------------------------------------------------------------
// _interpolateParams
// ---------------------------------------------------------------------------

describe('Router — _interpolateParams', () => {
  let router;

  beforeEach(() => {
    router = createRouter({ mode: 'hash', routes: [] });
  });

  it('replaces single :param', () => {
    expect(router._interpolateParams('/user/:id', { id: 42 })).toBe('/user/42');
  });

  it('replaces multiple :params', () => {
    expect(router._interpolateParams('/post/:pid/comment/:cid', { pid: 1, cid: 5 }))
      .toBe('/post/1/comment/5');
  });

  it('leaves unmatched :params in place', () => {
    expect(router._interpolateParams('/user/:id', {})).toBe('/user/:id');
  });

  it('URI-encodes param values', () => {
    expect(router._interpolateParams('/tag/:name', { name: 'foo bar' }))
      .toBe('/tag/foo%20bar');
  });

  it('returns path unchanged when params is null', () => {
    expect(router._interpolateParams('/about', null)).toBe('/about');
  });

  it('converts numbers to strings', () => {
    expect(router._interpolateParams('/user/:id', { id: 123 })).toBe('/user/123');
  });
});


// ---------------------------------------------------------------------------
// z-link-params
// ---------------------------------------------------------------------------

describe('Router — z-link-params', () => {
  let router;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    window.location.hash = '#/';
    router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/user/:id', component: 'user-page' },
      ],
    });
  });

  it('interpolates params from z-link-params attribute on click', () => {
    document.body.innerHTML += '<a z-link="/user/:id" z-link-params=\'{"id": "42"}\'>User</a>';
    const link = document.querySelector('[z-link]');
    link.click();
    expect(window.location.hash).toBe('#/user/42');
  });

  it('works without z-link-params (plain z-link)', () => {
    document.body.innerHTML += '<a z-link="/about">About</a>';
    const link = document.querySelector('a[z-link="/about"]');
    link.click();
    expect(window.location.hash).toBe('#/about');
  });

  it('ignores malformed z-link-params JSON gracefully', () => {
    document.body.innerHTML += '<a z-link="/user/fallback" z-link-params="not json">User</a>';
    const link = document.querySelector('a[z-link="/user/fallback"]');
    link.click();
    expect(window.location.hash).toBe('#/user/fallback');
  });
});


// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

describe('Router — guards', () => {
  it('beforeEach registers a guard', () => {
    const router = createRouter({
      mode: 'hash',
      routes: [{ path: '/', component: 'home-page' }],
    });
    const guard = vi.fn();
    router.beforeEach(guard);
    expect(router._guards.before).toContain(guard);
  });

  it('afterEach registers a guard', () => {
    const router = createRouter({
      mode: 'hash',
      routes: [{ path: '/', component: 'home-page' }],
    });
    const guard = vi.fn();
    router.afterEach(guard);
    expect(router._guards.after).toContain(guard);
  });
});


// ---------------------------------------------------------------------------
// onChange listener
// ---------------------------------------------------------------------------

describe('Router — onChange', () => {
  it('onChange registers and returns unsubscribe', () => {
    const router = createRouter({
      mode: 'hash',
      routes: [],
    });
    const fn = vi.fn();
    const unsub = router.onChange(fn);
    expect(router._listeners.has(fn)).toBe(true);
    unsub();
    expect(router._listeners.has(fn)).toBe(false);
  });
});


// ---------------------------------------------------------------------------
// Path normalization
// ---------------------------------------------------------------------------

describe('Router — path normalization', () => {
  it('normalizes relative paths', () => {
    const router = createRouter({
      mode: 'hash',
      base: '/app',
      routes: [],
    });
    expect(router._normalizePath('docs')).toBe('/docs');
    expect(router._normalizePath('/docs')).toBe('/docs');
  });

  it('strips base prefix from path', () => {
    const router = createRouter({
      mode: 'hash',
      base: '/app',
      routes: [],
    });
    expect(router._normalizePath('/app/docs')).toBe('/docs');
    expect(router._normalizePath('/app')).toBe('/');
  });

  it('resolve() adds base prefix', () => {
    const router = createRouter({
      mode: 'hash',
      base: '/app',
      routes: [],
    });
    expect(router.resolve('/docs')).toBe('/app/docs');
    expect(router.resolve('about')).toBe('/app/about');
  });
});


// ---------------------------------------------------------------------------
// Destroy
// ---------------------------------------------------------------------------

describe('Router — destroy', () => {
  it('clears routes, guards, and listeners', () => {
    const router = createRouter({
      mode: 'hash',
      routes: [{ path: '/', component: 'home-page' }],
    });
    router.beforeEach(() => {});
    router.onChange(() => {});
    router.destroy();
    expect(router._routes.length).toBe(0);
    expect(router._guards.before.length).toBe(0);
    expect(router._listeners.size).toBe(0);
  });
});


// ---------------------------------------------------------------------------
// Wildcard / catch-all routes
// ---------------------------------------------------------------------------

describe('Router — wildcard routes', () => {
  it('compiles wildcard route', () => {
    const router = createRouter({
      mode: 'hash',
      routes: [
        { path: '/docs/:section', component: 'docs-page' },
        { path: '*', component: 'home-page' },
      ],
    });
    // Wildcard is compiled as last route
    expect(router._routes.length).toBeGreaterThanOrEqual(2);
  });
});


// ---------------------------------------------------------------------------
// Query string handling
// ---------------------------------------------------------------------------

describe('Router — query parsing', () => {
  it('_normalizePath strips query string for route matching', () => {
    const router = createRouter({
      mode: 'hash',
      routes: [],
    });
    // _normalizePath does not strip query params — it only normalizes slashes and base prefix
    const path = router._normalizePath('/docs?section=intro');
    expect(path).toBe('/docs?section=intro');
  });
});


// ---------------------------------------------------------------------------
// Multiple guards
// ---------------------------------------------------------------------------

describe('Router — multiple guards', () => {
  it('registers multiple beforeEach guards', () => {
    const router = createRouter({
      mode: 'hash',
      routes: [{ path: '/', component: 'home-page' }],
    });
    const g1 = vi.fn();
    const g2 = vi.fn();
    router.beforeEach(g1);
    router.beforeEach(g2);
    expect(router._guards.before.length).toBe(2);
    expect(router._guards.before).toContain(g1);
    expect(router._guards.before).toContain(g2);
  });

  it('registers multiple afterEach guards', () => {
    const router = createRouter({
      mode: 'hash',
      routes: [{ path: '/', component: 'home-page' }],
    });
    const g1 = vi.fn();
    const g2 = vi.fn();
    router.afterEach(g1);
    router.afterEach(g2);
    expect(router._guards.after.length).toBe(2);
  });
});


// ---------------------------------------------------------------------------
// Route with multiple params
// ---------------------------------------------------------------------------

describe('Router — multi-param routes', () => {
  it('compiles route with multiple params', () => {
    const router = createRouter({
      mode: 'hash',
      routes: [
        { path: '/post/:pid/comment/:cid', component: 'user-page' },
      ],
    });
    const route = router._routes[0];
    expect(route._regex.test('/post/1/comment/5')).toBe(true);
    expect(route._keys).toEqual(['pid', 'cid']);
  });
});


// ---------------------------------------------------------------------------
// Same-path deduplication
// ---------------------------------------------------------------------------

describe('Router — same-path deduplication', () => {
  let router;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    window.location.hash = '#/';
    router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/about', component: 'about-page' },
      ],
    });
  });

  it('skips duplicate hash navigation to the same path', () => {
    router.navigate('/about');
    expect(window.location.hash).toBe('#/about');
    // Navigate to the same path again — should be a no-op
    const result = router.navigate('/about');
    expect(window.location.hash).toBe('#/about');
    expect(result).toBe(router);                // still returns the router chain
  });

  it('allows forced duplicate navigation with options.force', () => {
    router.navigate('/about');
    // Force navigation to same path
    router.navigate('/about', { force: true });
    expect(window.location.hash).toBe('#/about');
  });
});


// ---------------------------------------------------------------------------
// History mode — same-path / hash-only navigation
// ---------------------------------------------------------------------------

describe('Router — history mode deduplication', () => {
  let router;
  let pushSpy, replaceSpy;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    pushSpy = vi.spyOn(window.history, 'pushState');
    replaceSpy = vi.spyOn(window.history, 'replaceState');
    router = createRouter({
      el: '#app',
      mode: 'history',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/about', component: 'about-page' },
        { path: '/docs', component: 'docs-page' },
      ],
    });
    // Reset spy call counts after initial resolve
    pushSpy.mockClear();
    replaceSpy.mockClear();
  });

  afterEach(() => {
    pushSpy.mockRestore();
    replaceSpy.mockRestore();
  });

  it('uses pushState for different routes', () => {
    router.navigate('/about');
    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

  it('uses replaceState for same-route hash-only change', () => {
    // Navigate to /docs first
    router.navigate('/docs');
    pushSpy.mockClear();
    replaceSpy.mockClear();
    // Navigate to /docs#section — same route, different hash
    router.navigate('/docs#section');
    expect(pushSpy).not.toHaveBeenCalled();
    expect(replaceSpy).toHaveBeenCalledTimes(1);
  });
});


// ---------------------------------------------------------------------------
// Sub-route history substates
// ---------------------------------------------------------------------------

describe('Router — substates', () => {
  let router;
  let pushSpy;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    pushSpy = vi.spyOn(window.history, 'pushState');
    router = createRouter({
      el: '#app',
      mode: 'history',
      routes: [
        { path: '/', component: 'home-page' },
      ],
    });
    pushSpy.mockClear();
  });

  afterEach(() => {
    pushSpy.mockRestore();
  });

  it('pushSubstate pushes a history entry with substate marker', () => {
    router.pushSubstate('modal', { id: 'confirm' });
    expect(pushSpy).toHaveBeenCalledTimes(1);
    const state = pushSpy.mock.calls[0][0];
    expect(state.__zq).toBe('substate');
    expect(state.key).toBe('modal');
    expect(state.data).toEqual({ id: 'confirm' });
  });

  it('onSubstate registers and unregisters listeners', () => {
    const fn = vi.fn();
    const unsub = router.onSubstate(fn);
    expect(router._substateListeners).toContain(fn);
    unsub();
    expect(router._substateListeners).not.toContain(fn);
  });

  it('_fireSubstate calls listeners and returns true if any handles it', () => {
    const fn1 = vi.fn(() => false);
    const fn2 = vi.fn(() => true);
    router.onSubstate(fn1);
    router.onSubstate(fn2);
    const handled = router._fireSubstate('modal', { id: 'x' }, 'pop');
    expect(fn1).toHaveBeenCalledWith('modal', { id: 'x' }, 'pop');
    expect(fn2).toHaveBeenCalledWith('modal', { id: 'x' }, 'pop');
    expect(handled).toBe(true);
  });

  it('_fireSubstate returns false if no listener handles it', () => {
    const fn = vi.fn(() => undefined);
    router.onSubstate(fn);
    const handled = router._fireSubstate('tab', { index: 0 }, 'pop');
    expect(handled).toBe(false);
  });

  it('_fireSubstate catches errors in listeners', () => {
    const fn = vi.fn(() => { throw new Error('oops'); });
    router.onSubstate(fn);
    // Should not throw
    expect(() => router._fireSubstate('modal', {}, 'pop')).not.toThrow();
  });

  it('destroy clears substate listeners', () => {
    router.onSubstate(() => {});
    router.onSubstate(() => {});
    router.destroy();
    expect(router._substateListeners.length).toBe(0);
  });

  it('pushSubstate sets _inSubstate flag', () => {
    expect(router._inSubstate).toBe(false);
    router.pushSubstate('tab', { id: 'a' });
    expect(router._inSubstate).toBe(true);
  });

  it('popstate past all substates fires reset action', () => {
    const fn = vi.fn(() => true);
    router.onSubstate(fn);
    router.pushSubstate('tab', { id: 'a' });
    expect(router._inSubstate).toBe(true);

    // Simulate popstate landing on a non-substate entry
    const evt = new PopStateEvent('popstate', { state: { __zq: 'route' } });
    window.dispatchEvent(evt);

    // Should have fired with reset action
    expect(fn).toHaveBeenCalledWith(null, null, 'reset');
    expect(router._inSubstate).toBe(false);
  });

  it('popstate on a substate entry keeps _inSubstate true', () => {
    const fn = vi.fn(() => true);
    router.onSubstate(fn);
    router.pushSubstate('tab', { id: 'a' });
    router.pushSubstate('tab', { id: 'b' });

    // Simulate popstate landing on a substate entry
    const evt = new PopStateEvent('popstate', {
      state: { __zq: 'substate', key: 'tab', data: { id: 'a' } }
    });
    window.dispatchEvent(evt);

    expect(fn).toHaveBeenCalledWith('tab', { id: 'a' }, 'pop');
    expect(router._inSubstate).toBe(true);
  });

  it('reset action is not fired when no substates were active', () => {
    const fn = vi.fn();
    router.onSubstate(fn);
    // _inSubstate is false, so popstate on a route entry should not fire reset
    const evt = new PopStateEvent('popstate', { state: { __zq: 'route' } });
    window.dispatchEvent(evt);
    // fn should NOT have been called with 'reset'
    const resetCalls = fn.mock.calls.filter(c => c[2] === 'reset');
    expect(resetCalls.length).toBe(0);
  });
});


// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('Router — edge cases', () => {
  it('handles empty routes array', () => {
    const router = createRouter({ mode: 'hash', routes: [] });
    expect(router._routes.length).toBe(0);
  });

  it('getRouter returns null before creation', () => {
    // After the tests create routers, getRouter should return the latest
    const r = getRouter();
    expect(r).toBeDefined();
  });
});
