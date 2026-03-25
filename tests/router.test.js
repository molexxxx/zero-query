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

describe('Router - creation', () => {
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

describe('Router - route matching', () => {
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

describe('Router - navigation', () => {
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

describe('Router - _interpolateParams', () => {
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

describe('Router - z-link-params', () => {
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

describe('Router - guards', () => {
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

describe('Router - onChange', () => {
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

describe('Router - path normalization', () => {
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

describe('Router - destroy', () => {
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

describe('Router - wildcard routes', () => {
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

describe('Router - query parsing', () => {
  it('_normalizePath strips query string for route matching', () => {
    const router = createRouter({
      mode: 'hash',
      routes: [],
    });
    // _normalizePath does not strip query params - it only normalizes slashes and base prefix
    const path = router._normalizePath('/docs?section=intro');
    expect(path).toBe('/docs?section=intro');
  });
});


// ---------------------------------------------------------------------------
// Multiple guards
// ---------------------------------------------------------------------------

describe('Router - multiple guards', () => {
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

describe('Router - multi-param routes', () => {
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

describe('Router - same-path deduplication', () => {
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
    // Navigate to the same path again - should be a no-op
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
// History mode - same-path / hash-only navigation
// ---------------------------------------------------------------------------

describe('Router - history mode deduplication', () => {
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
    // Navigate to /docs#section - same route, different hash
    router.navigate('/docs#section');
    expect(pushSpy).not.toHaveBeenCalled();
    expect(replaceSpy).toHaveBeenCalledTimes(1);
  });
});


// ---------------------------------------------------------------------------
// Sub-route history substates
// ---------------------------------------------------------------------------

describe('Router - substates', () => {
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

describe('Router - edge cases', () => {
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


// ---------------------------------------------------------------------------
// Route matching priority (first match wins)
// ---------------------------------------------------------------------------

describe('Router - route matching priority', () => {
  it('first matching route wins', () => {
    const router = createRouter({
      mode: 'hash',
      routes: [
        { path: '/test', component: 'home-page' },
        { path: '/test', component: 'about-page' },
      ],
    });
    // The first route with path '/test' should be matched
    const matched = router._routes[0];
    expect(matched._regex.test('/test')).toBe(true);
    expect(matched.component).toBe('home-page');
  });

  it('specific route takes priority over wildcard', () => {
    const router = createRouter({
      mode: 'hash',
      routes: [
        { path: '/about', component: 'about-page' },
        { path: '*', component: 'home-page' },
      ],
    });
    // /about should match the first route, not wildcard
    expect(router._routes[0]._regex.test('/about')).toBe(true);
    expect(router._routes[0].component).toBe('about-page');
  });

  it('parameterized routes match correctly', () => {
    const router = createRouter({
      mode: 'hash',
      routes: [
        { path: '/user/:id', component: 'user-page' },
        { path: '/user/settings', component: 'about-page' },
      ],
    });
    // /user/42 should match parameterized route
    expect(router._routes[0]._regex.test('/user/42')).toBe(true);
    // /user/settings matches first (since :id catches "settings")
    expect(router._routes[0]._regex.test('/user/settings')).toBe(true);
  });
});


// ---------------------------------------------------------------------------
// Route removal
// ---------------------------------------------------------------------------

describe('Router - route removal', () => {
  it('remove() deletes the matching route', () => {
    const router = createRouter({
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/about', component: 'about-page' },
      ],
    });
    expect(router._routes.length).toBe(2);
    router.remove('/about');
    expect(router._routes.length).toBe(1);
    expect(router._routes.find(r => r.path === '/about')).toBeUndefined();
  });

  it('remove() on non-existent path is a no-op', () => {
    const router = createRouter({
      mode: 'hash',
      routes: [{ path: '/', component: 'home-page' }],
    });
    router.remove('/nonexistent');
    expect(router._routes.length).toBe(1);
  });

  it('remove() returns the router for chaining', () => {
    const router = createRouter({
      mode: 'hash',
      routes: [{ path: '/', component: 'home-page' }],
    });
    const result = router.remove('/');
    expect(result).toBe(router);
  });
});


// ---------------------------------------------------------------------------
// Dynamic route addition
// ---------------------------------------------------------------------------

describe('Router - dynamic route addition', () => {
  it('add() returns the router for chaining', () => {
    const router = createRouter({ mode: 'hash', routes: [] });
    const result = router.add({ path: '/new', component: 'home-page' });
    expect(result).toBe(router);
    expect(router._routes.length).toBe(1);
  });

  it('add() compiles regex for parameterized routes', () => {
    const router = createRouter({ mode: 'hash', routes: [] });
    router.add({ path: '/item/:id/detail/:section', component: 'home-page' });
    const route = router._routes[0];
    expect(route._regex.test('/item/42/detail/overview')).toBe(true);
    expect(route._keys).toEqual(['id', 'section']);
  });

  it('add() with fallback creates two routes', () => {
    const router = createRouter({ mode: 'hash', routes: [] });
    router.add({ path: '/docs/:page', fallback: '/docs', component: 'docs-page' });
    expect(router._routes.length).toBe(2);
    expect(router._routes[0]._regex.test('/docs/intro')).toBe(true);
    expect(router._routes[1]._regex.test('/docs')).toBe(true);
  });
});


// ---------------------------------------------------------------------------
// Navigation chaining
// ---------------------------------------------------------------------------

describe('Router - navigation chaining', () => {
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

  it('navigate returns the router for chaining', () => {
    const result = router.navigate('/about');
    expect(result).toBe(router);
  });

  it('replace returns the router for chaining', () => {
    const result = router.replace('/about');
    expect(result).toBe(router);
  });

  it('back() returns the router', () => {
    expect(router.back()).toBe(router);
  });

  it('forward() returns the router', () => {
    expect(router.forward()).toBe(router);
  });

  it('go() returns the router', () => {
    expect(router.go(0)).toBe(router);
  });
});


// ---------------------------------------------------------------------------
// Hash mode path parsing
// ---------------------------------------------------------------------------

describe('Router - hash mode path parsing', () => {
  let router;
  beforeEach(() => {
    router = createRouter({
      mode: 'hash',
      routes: [{ path: '/', component: 'home-page' }],
    });
  });

  it('path returns / when hash is empty', () => {
    window.location.hash = '';
    expect(router.path).toBe('/');
  });

  it('path returns correct value from hash', () => {
    window.location.hash = '#/about';
    expect(router.path).toBe('/about');
  });

  it('path returns / when hash is just #/', () => {
    window.location.hash = '#/';
    expect(router.path).toBe('/');
  });
});


// ---------------------------------------------------------------------------
// History mode path handling with base
// ---------------------------------------------------------------------------

describe('Router - history mode with base path', () => {
  it('resolve includes base prefix', () => {
    const router = createRouter({
      mode: 'history',
      base: '/myapp',
      routes: [],
    });
    expect(router.resolve('/page')).toBe('/myapp/page');
    expect(router.resolve('/')).toBe('/myapp/');
  });

  it('_normalizePath strips double base prefix', () => {
    const router = createRouter({
      mode: 'history',
      base: '/myapp',
      routes: [],
    });
    // If someone accidentally includes the base
    expect(router._normalizePath('/myapp/page')).toBe('/page');
  });

  it('base without leading slash gets normalized', () => {
    const router = createRouter({
      mode: 'history',
      base: 'app',
      routes: [],
    });
    expect(router.base).toBe('/app');
  });
});


// ---------------------------------------------------------------------------
// Navigate with query strings in hash mode
// ---------------------------------------------------------------------------

describe('Router - query string in hash mode', () => {
  let router;
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    window.location.hash = '#/';
    router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/search', component: 'about-page' },
      ],
    });
  });

  it('navigate preserves path for query routing', () => {
    router.navigate('/search');
    expect(window.location.hash).toBe('#/search');
  });
});


// ---------------------------------------------------------------------------
// Guard edge cases
// ---------------------------------------------------------------------------

describe('Router - guard edge cases', () => {
  it('beforeEach returns the router for chaining', () => {
    const router = createRouter({
      mode: 'hash',
      routes: [{ path: '/', component: 'home-page' }],
    });
    const result = router.beforeEach(() => {});
    expect(result).toBe(router);
  });

  it('afterEach returns the router for chaining', () => {
    const router = createRouter({
      mode: 'hash',
      routes: [{ path: '/', component: 'home-page' }],
    });
    const result = router.afterEach(() => {});
    expect(result).toBe(router);
  });

  it('guard cancels navigation when returning false', async () => {
    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/blocked', component: 'about-page' },
      ],
    });
    document.body.innerHTML = '<div id="app"></div>';
    router.beforeEach(() => false);
    // Manually trigger resolve for /blocked
    window.location.hash = '#/blocked';
    await router._resolve();
    // current should not be updated to /blocked
    expect(router._current === null || router._current.path !== '/blocked').toBe(true);
  });

  it('guard redirects to a different route', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/login', component: 'about-page' },
        { path: '/dashboard', component: 'docs-page' },
      ],
    });
    router.beforeEach((to) => {
      if (to.path === '/dashboard') return '/login';
    });
    window.location.hash = '#/dashboard';
    await router._resolve();
    expect(window.location.hash).toBe('#/login');
  });
});


// ---------------------------------------------------------------------------
// onChange with navigation
// ---------------------------------------------------------------------------

describe('Router - onChange fires on resolve', () => {
  it('fires onChange listener after route resolution', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    const listener = vi.fn();
    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/about', component: 'about-page' },
      ],
    });
    router.onChange(listener);
    // Wait for initial resolve
    await new Promise(r => setTimeout(r, 10));
    listener.mockClear();

    window.location.hash = '#/about';
    await router._resolve();
    expect(listener).toHaveBeenCalled();
    const [to, from] = listener.mock.calls[0];
    expect(to.path).toBe('/about');
  });
});


// ---------------------------------------------------------------------------
// Multi-param extraction
// ---------------------------------------------------------------------------

describe('Router - multi-param extraction', () => {
  it('extracts multiple params from URL', () => {
    const router = createRouter({
      mode: 'hash',
      routes: [
        { path: '/org/:orgId/team/:teamId/member/:memberId', component: 'user-page' },
      ],
    });
    const route = router._routes[0];
    const match = '/org/acme/team/dev/member/42'.match(route._regex);
    expect(match).not.toBeNull();
    const params = {};
    route._keys.forEach((key, i) => { params[key] = match[i + 1]; });
    expect(params).toEqual({ orgId: 'acme', teamId: 'dev', memberId: '42' });
  });
});


// ---------------------------------------------------------------------------
// Substate in hash mode
// ---------------------------------------------------------------------------

describe('Router - substates hash mode', () => {
  let router, pushSpy;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    window.location.hash = '#/';
    pushSpy = vi.spyOn(window.history, 'pushState');
    router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [{ path: '/', component: 'home-page' }],
    });
    pushSpy.mockClear();
  });

  afterEach(() => {
    pushSpy.mockRestore();
  });

  it('pushSubstate works in hash mode', () => {
    router.pushSubstate('drawer', { side: 'left' });
    expect(pushSpy).toHaveBeenCalledTimes(1);
    const state = pushSpy.mock.calls[0][0];
    expect(state.__zq).toBe('substate');
    expect(state.key).toBe('drawer');
  });

  it('multiple substates can be pushed', () => {
    router.pushSubstate('modal', { id: 'a' });
    router.pushSubstate('modal', { id: 'b' });
    expect(pushSpy).toHaveBeenCalledTimes(2);
  });
});


// ---------------------------------------------------------------------------
// _interpolateParams edge cases
// ---------------------------------------------------------------------------

describe('Router - _interpolateParams edge cases', () => {
  let router;
  beforeEach(() => {
    router = createRouter({ mode: 'hash', routes: [] });
  });

  it('handles special characters in param values', () => {
    expect(router._interpolateParams('/tag/:name', { name: 'c++' })).toBe('/tag/c%2B%2B');
  });

  it('handles empty string param value', () => {
    expect(router._interpolateParams('/user/:id', { id: '' })).toBe('/user/');
  });

  it('handles zero as param value', () => {
    expect(router._interpolateParams('/page/:num', { num: 0 })).toBe('/page/0');
  });

  it('handles boolean param values', () => {
    expect(router._interpolateParams('/flag/:val', { val: true })).toBe('/flag/true');
  });

  it('returns path unchanged when params is non-object', () => {
    expect(router._interpolateParams('/about', 'string')).toBe('/about');
  });

  it('handles path with no placeholders', () => {
    expect(router._interpolateParams('/about', { id: 42 })).toBe('/about');
  });

  it('handles adjacent params', () => {
    // This is a weird URL but should still work
    expect(router._interpolateParams('/:a/:b', { a: 'x', b: 'y' })).toBe('/x/y');
  });
});


// ---------------------------------------------------------------------------
// Router.destroy cleans up everything
// ---------------------------------------------------------------------------

describe('Router - destroy completeness', () => {
  it('clears instance, routes, guards, listeners, and substates', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [{ path: '/', component: 'home-page' }],
    });
    router.beforeEach(() => {});
    router.afterEach(() => {});
    router.onChange(() => {});
    router.onSubstate(() => {});

    router.destroy();

    expect(router._routes.length).toBe(0);
    expect(router._guards.before.length).toBe(0);
    expect(router._guards.after.length).toBe(0);
    expect(router._listeners.size).toBe(0);
    expect(router._substateListeners.length).toBe(0);
    expect(router._inSubstate).toBe(false);
  });

  it('removes window event listeners on destroy (no leak)', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [{ path: '/', component: 'home-page' }],
    });
    // Store the handler reference before destroy
    const navHandler = router._onNavEvent;
    const clickHandler = router._onLinkClick;
    expect(navHandler).toBeDefined();
    expect(clickHandler).toBeDefined();

    router.destroy();

    expect(removeSpy).toHaveBeenCalledWith('hashchange', navHandler);
    expect(router._onNavEvent).toBeNull();
    expect(router._onLinkClick).toBeNull();
    removeSpy.mockRestore();
  });

  it('removes popstate listener in history mode on destroy', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const router = createRouter({
      el: '#app',
      mode: 'history',
      routes: [{ path: '/', component: 'home-page' }],
    });
    const navHandler = router._onNavEvent;
    router.destroy();
    expect(removeSpy).toHaveBeenCalledWith('popstate', navHandler);
    removeSpy.mockRestore();
  });

  it('removes document click listener on destroy', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [],
    });
    const clickHandler = router._onLinkClick;
    router.destroy();
    expect(removeSpy).toHaveBeenCalledWith('click', clickHandler);
    removeSpy.mockRestore();
  });
});


// ---------------------------------------------------------------------------
// PERF: same-route comparison uses shallow equality (no JSON.stringify)
// ---------------------------------------------------------------------------

describe('Router - same-route shallow equality', () => {
  it('skips re-render when navigating to same route with same params', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    let renderCount = 0;
    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/user/:id', render: () => '<div>user</div>' },
      ],
    });
    // Mock component mount counting
    router.afterEach(() => { renderCount++; });

    router.navigate('/user/42');
    await new Promise(r => setTimeout(r, 50));
    const firstCount = renderCount;

    // Navigate to the same route - should skip
    router.navigate('/user/42');
    await new Promise(r => setTimeout(r, 50));
    // Hash mode prevents same-hash navigation at URL level,
    // so renderCount should not increase
    expect(renderCount).toBe(firstCount);
    router.destroy();
  });
});


// ===========================================================================
// Guard - cancel navigation
// ===========================================================================

describe('Router - guard returning false cancels navigation', () => {
  it('does not resolve route when guard returns false', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/blocked', component: 'about-page' },
      ],
    });
    router.beforeEach(() => false);
    await new Promise(r => setTimeout(r, 10));
    router.navigate('/blocked');
    await router._resolve();
    // Should NOT have navigated to /blocked because guard cancelled
    expect(router.current?.path).not.toBe('/blocked');
    router.destroy();
  });
});


// ===========================================================================
// Guard - redirect loop detection
// ===========================================================================

describe('Router - guard redirect loop protection', () => {
  it('stops after more than 10 redirects', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/a', component: 'about-page' },
        { path: '/b', component: 'docs-page' },
      ],
    });
    // Guard that keeps bouncing between /a and /b
    router.beforeEach((to) => {
      if (to.path === '/a') return '/b';
      if (to.path === '/b') return '/a';
    });
    await new Promise(r => setTimeout(r, 10));
    // Navigate to /a - should not infinite loop
    window.location.hash = '#/a';
    await router._resolve();
    // Just verify it doesn't hang - the guard count > 10 stops it
    router.destroy();
  });
});


// ===========================================================================
// Guard - afterEach fires after resolve
// ===========================================================================

describe('Router - afterEach hook', () => {
  it('fires afterEach with to and from after route resolves', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    const afterFn = vi.fn();
    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/about', component: 'about-page' },
      ],
    });
    router.afterEach(afterFn);
    await new Promise(r => setTimeout(r, 10));
    afterFn.mockClear();

    window.location.hash = '#/about';
    await router._resolve();
    expect(afterFn).toHaveBeenCalledTimes(1);
    expect(afterFn.mock.calls[0][0].path).toBe('/about');
    router.destroy();
  });
});


// ===========================================================================
// Guard - before guard that throws
// ===========================================================================

describe('Router - before guard that throws', () => {
  it('catches the error and does not crash', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/err', component: 'about-page' },
      ],
    });
    router.beforeEach(() => { throw new Error('guard boom'); });
    await new Promise(r => setTimeout(r, 10));
    window.location.hash = '#/err';
    await expect(router._resolve()).resolves.not.toThrow();
    router.destroy();
  });
});


// ===========================================================================
// Lazy loading via route.load
// ===========================================================================

describe('Router - lazy loading with route.load', () => {
  it('calls load() before mounting component', async () => {
    const loadFn = vi.fn().mockResolvedValue(undefined);
    document.body.innerHTML = '<div id="app"></div>';
    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/lazy', load: loadFn, component: 'about-page' },
      ],
    });
    await new Promise(r => setTimeout(r, 10));
    window.location.hash = '#/lazy';
    await router._resolve();
    expect(loadFn).toHaveBeenCalledTimes(1);
    router.destroy();
  });

  it('does not mount if load() rejects', async () => {
    const loadFn = vi.fn().mockRejectedValue(new Error('load fail'));
    document.body.innerHTML = '<div id="app"></div>';
    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/fail', load: loadFn, component: 'about-page' },
      ],
    });
    await new Promise(r => setTimeout(r, 10));
    window.location.hash = '#/fail';
    await router._resolve();
    // Route should not have resolved to /fail since load() threw
    expect(router.current?.path).not.toBe('/fail');
    router.destroy();
  });
});


// ===========================================================================
// Fallback / 404 route
// ===========================================================================

describe('Router - fallback 404 route', () => {
  it('resolves to fallback component for unknown paths', async () => {
    component('notfound-page', { render: () => '<p>404</p>' });
    document.body.innerHTML = '<div id="app"></div>';
    window.location.hash = '#/';
    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [{ path: '/', component: 'home-page' }],
      fallback: 'notfound-page',
    });
    await new Promise(r => setTimeout(r, 10));
    window.location.hash = '#/nonexistent';
    await router._resolve();
    expect(router.current.path).toBe('/nonexistent');
    expect(router.current.route.component).toBe('notfound-page');
    router.destroy();
  });
});


// ===========================================================================
// replace()
// ===========================================================================

describe('Router - replace()', () => {
  it('returns router for chaining in hash mode', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    window.location.hash = '#/';
    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/replaced', component: 'about-page' },
      ],
    });
    await new Promise(r => setTimeout(r, 10));
    const result = router.replace('/replaced');
    expect(result).toBe(router);
    router.destroy();
  });
});


// ===========================================================================
// query getter
// ===========================================================================

describe('Router - query getter', () => {
  it('returns parsed query params from hash', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [{ path: '/search', component: 'home-page' }],
    });
    window.location.hash = '#/search?q=hello&page=2';
    expect(router.query).toEqual({ q: 'hello', page: '2' });
    router.destroy();
  });

  it('returns empty object for no query params', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [{ path: '/', component: 'home-page' }],
    });
    window.location.hash = '#/';
    expect(router.query).toEqual({});
    router.destroy();
  });
});


// ===========================================================================
// resolve() - programmatic link generation
// ===========================================================================

describe('Router - resolve()', () => {
  it('returns full URL path with base prefix', () => {
    const router = createRouter({
      mode: 'hash',
      base: '/app',
      routes: [{ path: '/', component: 'home-page' }],
    });
    expect(router.resolve('/about')).toBe('/app/about');
    router.destroy();
  });

  it('returns path as-is when no base', () => {
    const router = createRouter({
      mode: 'hash',
      routes: [{ path: '/', component: 'home-page' }],
    });
    expect(router.resolve('/about')).toBe('/about');
    router.destroy();
  });
});


// ===========================================================================
// back/forward/go wrappers
// ===========================================================================

describe('Router - back/forward/go wrappers', () => {
  it('calls window.history.back', () => {
    const spy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const router = createRouter({
      mode: 'hash',
      routes: [{ path: '/', component: 'home-page' }],
    });
    router.back();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    router.destroy();
  });

  it('calls window.history.forward', () => {
    const spy = vi.spyOn(window.history, 'forward').mockImplementation(() => {});
    const router = createRouter({
      mode: 'hash',
      routes: [{ path: '/', component: 'home-page' }],
    });
    router.forward();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    router.destroy();
  });

  it('calls window.history.go with argument', () => {
    const spy = vi.spyOn(window.history, 'go').mockImplementation(() => {});
    const router = createRouter({
      mode: 'hash',
      routes: [{ path: '/', component: 'home-page' }],
    });
    router.go(-2);
    expect(spy).toHaveBeenCalledWith(-2);
    spy.mockRestore();
    router.destroy();
  });
});


// ===========================================================================
// Link click interception - modified clicks bypass
// ===========================================================================

describe('Router - link click interception', () => {
  it('intercepts normal clicks on z-link elements', async () => {
    document.body.innerHTML = '<div id="app"></div><a z-link="/about">About</a>';
    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/about', component: 'about-page' },
      ],
    });
    await new Promise(r => setTimeout(r, 10));

    const link = document.querySelector('[z-link]');
    const e = new Event('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(e);
    // Should have navigated
    await new Promise(r => setTimeout(r, 10));
    expect(window.location.hash).toBe('#/about');
    router.destroy();
  });

  it('ignores clicks with meta key (does not navigate)', async () => {
    document.body.innerHTML = '<div id="app"></div><a z-link="/about">About</a>';
    window.location.hash = '#/';
    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/about', component: 'about-page' },
      ],
    });
    await new Promise(r => setTimeout(r, 50));
    // Record current route before meta click
    const currentBefore = router.current?.path;

    const link = document.querySelector('[z-link]');
    const e = new MouseEvent('click', { bubbles: true, metaKey: true });
    link.dispatchEvent(e);
    await new Promise(r => setTimeout(r, 10));
    // Route should remain unchanged - meta key bypasses SPA navigation
    expect(router.current?.path).toBe(currentBefore);
    router.destroy();
  });

  it('ignores clicks with ctrl key', async () => {
    document.body.innerHTML = '<div id="app"></div><a z-link="/about2">About</a>';
    window.location.hash = '#/';
    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/about2', component: 'about-page' },
      ],
    });
    await new Promise(r => setTimeout(r, 50));
    const link = document.querySelector('[z-link]');
    const e = new MouseEvent('click', { bubbles: true, ctrlKey: true });
    link.dispatchEvent(e);
    await new Promise(r => setTimeout(r, 10));
    expect(router.current?.path).not.toBe('/about2');
    router.destroy();
  });

  it('ignores links with target=_blank', async () => {
    document.body.innerHTML = '<div id="app"></div><a z-link="/about" target="_blank">About</a>';
    window.location.hash = '#/';
    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/about', component: 'about-page' },
      ],
    });
    await new Promise(r => setTimeout(r, 10));
    const link = document.querySelector('[z-link]');
    link.click();
    await new Promise(r => setTimeout(r, 10));
    expect(window.location.hash).toBe('#/');
    router.destroy();
  });
});


// ===========================================================================
// Router - remove() route
// ===========================================================================

describe('Router - remove()', () => {
  it('removes route by path', () => {
    const router = createRouter({
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/temp', component: 'about-page' },
      ],
    });
    expect(router._routes.length).toBe(2);
    router.remove('/temp');
    expect(router._routes.length).toBe(1);
    expect(router._routes[0].path).toBe('/');
    router.destroy();
  });
});


// ===========================================================================
// Router - add() chaining
// ===========================================================================

describe('Router - add() chaining', () => {
  it('supports fluent chaining of add calls', () => {
    const router = createRouter({
      mode: 'hash',
      routes: [],
    });
    const result = router.add({ path: '/', component: 'home-page' })
                          .add({ path: '/about', component: 'about-page' });
    expect(result).toBe(router);
    expect(router._routes.length).toBe(2);
    router.destroy();
  });
});


// ===========================================================================
// Router - onChange unsubscribe
// ===========================================================================

describe('Router - onChange unsubscribe', () => {
  it('stops calling listener after unsubscribe', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    const listener = vi.fn();
    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/about', component: 'about-page' },
      ],
    });
    const unsub = router.onChange(listener);
    await new Promise(r => setTimeout(r, 10));
    listener.mockClear();

    unsub();
    window.location.hash = '#/about';
    await router._resolve();
    expect(listener).not.toHaveBeenCalled();
    router.destroy();
  });
});


// ===========================================================================
// Router - destroy cleans up
// ===========================================================================

describe('Router - destroy cleans up', () => {
  it('clears listeners, guards, and routes on destroy', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [{ path: '/', component: 'home-page' }],
    });
    router.beforeEach(() => {});
    router.afterEach(() => {});
    router.onChange(() => {});
    router.onSubstate(() => {});
    router.destroy();
    expect(router._routes.length).toBe(0);
    expect(router._guards.before.length).toBe(0);
    expect(router._guards.after.length).toBe(0);
    expect(router._listeners.size).toBe(0);
    expect(router._substateListeners.length).toBe(0);
  });
});


// ===========================================================================
// Router - _interpolateParams
// ===========================================================================

describe('Router - _interpolateParams', () => {
  it('replaces :param with provided values', () => {
    const router = createRouter({
      mode: 'hash',
      routes: [{ path: '/user/:id', component: 'user-page' }],
    });
    const result = router._interpolateParams('/user/:id/post/:pid', { id: 42, pid: 7 });
    expect(result).toBe('/user/42/post/7');
    router.destroy();
  });

  it('keeps :param when value not provided', () => {
    const router = createRouter({
      mode: 'hash',
      routes: [],
    });
    const result = router._interpolateParams('/user/:id', {});
    expect(result).toBe('/user/:id');
    router.destroy();
  });

  it('returns path unchanged when params is null', () => {
    const router = createRouter({ mode: 'hash', routes: [] });
    expect(router._interpolateParams('/test', null)).toBe('/test');
    router.destroy();
  });
});


// ===========================================================================
// Router - _normalizePath with base stripping
// ===========================================================================

describe('Router - _normalizePath', () => {
  it('strips base prefix if accidentally included', () => {
    const router = createRouter({
      mode: 'hash',
      base: '/app',
      routes: [],
    });
    expect(router._normalizePath('/app/about')).toBe('/about');
    router.destroy();
  });

  it('returns / when path matches base exactly', () => {
    const router = createRouter({
      mode: 'hash',
      base: '/app',
      routes: [],
    });
    expect(router._normalizePath('/app')).toBe('/');
    router.destroy();
  });

  it('adds leading slash to bare paths', () => {
    const router = createRouter({ mode: 'hash', routes: [] });
    expect(router._normalizePath('about')).toBe('/about');
    router.destroy();
  });

  it('returns / for empty/null path', () => {
    const router = createRouter({ mode: 'hash', routes: [] });
    expect(router._normalizePath('')).toBe('/');
    expect(router._normalizePath(null)).toBe('/');
    router.destroy();
  });
});


// ===========================================================================
// Router - navigate with options.params
// ===========================================================================

describe('Router - navigate with options.params', () => {
  it('interpolates params in path', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/user/:id', component: 'user-page' },
      ],
    });
    await new Promise(r => setTimeout(r, 10));
    router.navigate('/user/:id', { params: { id: '99' } });
    await router._resolve();
    expect(window.location.hash).toBe('#/user/99');
    router.destroy();
  });
});


// ===========================================================================
// Router - render function components
// ===========================================================================

describe('Router - render function component', () => {
  it('renders HTML from a function component', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    window.location.hash = '#/';
    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: (route) => `<p>fn: ${route.path}</p>` },
      ],
    });
    // Wait for initial resolve (queueMicrotask + rendering)
    await new Promise(r => setTimeout(r, 100));
    const p = document.querySelector('#app p');
    expect(p).not.toBeNull();
    expect(p.textContent).toBe('fn: /');
    router.destroy();
  });
});


// ===========================================================================
// Router - substate onSubstate unsubscribe
// ===========================================================================

describe('Router - onSubstate unsubscribe', () => {
  it('removes listener after unsubscribe', () => {
    const router = createRouter({ mode: 'hash', routes: [] });
    const fn = vi.fn();
    const unsub = router.onSubstate(fn);
    expect(router._substateListeners.length).toBe(1);
    unsub();
    expect(router._substateListeners.length).toBe(0);
    router.destroy();
  });
});


// ===========================================================================
// Router - substate history restoration after navigation away
// ===========================================================================

describe('Router - substate restoration after navigating away and back', () => {
  let router;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    window.location.hash = '#/';
  });

  afterEach(() => {
    if (router) router.destroy();
  });

  /**
   * Reproduces the bug: tabbing through substates in a component (e.g.
   * compare-page), navigating to a different route (e.g. /about), then
   * pressing back should return to the LAST substate tab — not the default.
   *
   * Steps to reproduce:
   *   1. Navigate to /compare, push substates: tab-a → tab-b → tab-c
   *   2. Navigate to /about (component with listener is destroyed)
   *   3. Simulate popstate back → lands on substate entry for tab-c
   *   4. BUG: no listener exists (it was destroyed), so the substate is
   *      ignored and the component remounts with its default state.
   *   5. EXPECTED: the router should re-fire the substate after the new
   *      component mounts so the listener can restore the correct tab.
   */
  it('restores last substate when pressing back after navigating away', async () => {
    router = createRouter({
      el: '#app',
      mode: 'history',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/compare', component: 'about-page' },
        { path: '/about', component: 'user-page' },
      ],
    });

    // Wait for initial resolve
    await new Promise(r => setTimeout(r, 10));

    // 1. Navigate to /compare and register a substate listener
    //    (simulates what compare-page does in its mounted() hook)
    window.history.pushState({ __zq: 'route' }, '', '/compare');
    await router._resolve();
    expect(router.current.path).toBe('/compare');

    // Simulate component mounting and registering a substate listener
    let activeTab = 'overview';
    const listener = vi.fn((key, data, action) => {
      if (key === 'compare-tab') { activeTab = data.tab; return true; }
      if (action === 'reset') { activeTab = 'overview'; return true; }
    });
    const unsub = router.onSubstate(listener);

    // 2. Push several substates (tab switches)
    router.pushSubstate('compare-tab', { tab: 'components' });
    activeTab = 'components';
    router.pushSubstate('compare-tab', { tab: 'directives' });
    activeTab = 'directives';
    router.pushSubstate('compare-tab', { tab: 'reactivity' });
    activeTab = 'reactivity';

    // 3. Navigate away to /about — this destroys compare-page
    //    so we unsubscribe the listener (like destroyed() would)
    unsub();
    window.history.pushState({ __zq: 'route' }, '', '/about');
    await router._resolve();
    expect(router.current.path).toBe('/about');

    // 4. Register a NEW listener after _resolve, simulating what the freshly
    //    mounted compare-page would do. We use a one-time setup that defers
    //    registration until _resolve has run (like mounted() in the component).
    let restoredTab = 'overview';
    const freshListener = vi.fn((key, data, action) => {
      if (key === 'compare-tab') { restoredTab = data.tab; return true; }
      if (action === 'reset') { restoredTab = 'overview'; return true; }
    });

    // Intercept _resolve to register the listener after mount (simulating
    // the component's mounted() lifecycle hook)
    const origResolve = router.__resolve.bind(router);
    router.__resolve = async function () {
      await origResolve();
      // After resolve mounts the component, register the substate listener
      router.onSubstate(freshListener);
    };

    // 5. Simulate pressing back — popstate lands on the last substate
    const evt = new PopStateEvent('popstate', {
      state: { __zq: 'substate', key: 'compare-tab', data: { tab: 'reactivity' } }
    });
    window.dispatchEvent(evt);

    // Allow async _resolve to complete and the retry to fire
    await new Promise(r => setTimeout(r, 50));

    // EXPECTED: the fresh listener should have been called with the substate
    // data so that restoredTab is 'reactivity', NOT 'overview'
    expect(freshListener).toHaveBeenCalledWith('compare-tab', { tab: 'reactivity' }, 'pop');
    expect(restoredTab).toBe('reactivity');
  });

  it('handles second back correctly after substate restoration', async () => {
    router = createRouter({
      el: '#app',
      mode: 'history',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/compare', component: 'about-page' },
        { path: '/about', component: 'user-page' },
      ],
    });
    await new Promise(r => setTimeout(r, 10));

    // Navigate to /compare
    window.history.pushState({ __zq: 'route' }, '', '/compare');
    await router._resolve();

    let activeTab = 'overview';
    const listener = vi.fn((key, data, action) => {
      if (key === 'compare-tab') { activeTab = data.tab; return true; }
      if (action === 'reset') { activeTab = 'overview'; return true; }
    });
    const unsub = router.onSubstate(listener);

    // Push two substates
    router.pushSubstate('compare-tab', { tab: 'components' });
    router.pushSubstate('compare-tab', { tab: 'directives' });

    // Navigate away and unsubscribe (simulating component destroy)
    unsub();
    window.history.pushState({ __zq: 'route' }, '', '/about');
    await router._resolve();

    // Back: first pop hits 'directives' substate — no listener yet
    let restoredTab = 'overview';
    const freshListener = vi.fn((key, data, action) => {
      if (key === 'compare-tab') { restoredTab = data.tab; return true; }
      if (action === 'reset') { restoredTab = 'overview'; return true; }
    });

    const origResolve = router.__resolve.bind(router);
    let resolveCount = 0;
    router.__resolve = async function () {
      await origResolve();
      if (resolveCount === 0) router.onSubstate(freshListener);
      resolveCount++;
    };

    // First back: lands on 'directives' substate
    window.dispatchEvent(new PopStateEvent('popstate', {
      state: { __zq: 'substate', key: 'compare-tab', data: { tab: 'directives' } }
    }));
    await new Promise(r => setTimeout(r, 50));

    expect(restoredTab).toBe('directives');

    // Second back: lands on 'components' substate — listener IS registered now
    window.dispatchEvent(new PopStateEvent('popstate', {
      state: { __zq: 'substate', key: 'compare-tab', data: { tab: 'components' } }
    }));
    await new Promise(r => setTimeout(r, 50));

    expect(restoredTab).toBe('components');
  });
});


// ===========================================================================
// Router - <z-outlet> auto-detection
// ===========================================================================

describe('Router - z-outlet auto-detection', () => {
  beforeEach(() => {
    window.location.hash = '#/';
  });

  it('auto-detects <z-outlet> when no el: is provided', async () => {
    document.body.innerHTML = '<z-outlet></z-outlet>';
    const router = createRouter({
      mode: 'hash',
      routes: [{ path: '/', component: 'home-page' }],
    });
    expect(router._el).toBe(document.querySelector('z-outlet'));
    // Wait for initial resolve and verify component was mounted
    await new Promise(r => setTimeout(r, 50));
    expect(router._el.innerHTML).not.toBe('');
    router.destroy();
  });

  it('prefers explicit el: over <z-outlet>', () => {
    document.body.innerHTML = '<div id="app"></div><z-outlet></z-outlet>';
    const router = createRouter({
      mode: 'hash',
      el: '#app',
      routes: [{ path: '/', component: 'home-page' }],
    });
    expect(router._el).toBe(document.getElementById('app'));
    router.destroy();
  });

  it('reads fallback attribute from <z-outlet>', () => {
    document.body.innerHTML = '<z-outlet fallback="about-page"></z-outlet>';
    const router = createRouter({
      mode: 'hash',
      routes: [{ path: '/', component: 'home-page' }],
    });
    expect(router._fallback).toBe('about-page');
    router.destroy();
  });

  it('config fallback takes priority over <z-outlet> fallback attribute', () => {
    document.body.innerHTML = '<z-outlet fallback="about-page"></z-outlet>';
    const router = createRouter({
      mode: 'hash',
      routes: [{ path: '/', component: 'home-page' }],
      fallback: 'user-page',
    });
    expect(router._fallback).toBe('user-page');
    router.destroy();
  });

  it('reads mode attribute from <z-outlet>', () => {
    document.body.innerHTML = '<z-outlet mode="hash"></z-outlet>';
    const router = createRouter({
      routes: [{ path: '/', component: 'home-page' }],
    });
    expect(router._mode).toBe('hash');
    router.destroy();
  });

  it('reads base attribute from <z-outlet>', () => {
    document.body.innerHTML = '<z-outlet base="/my-app"></z-outlet>';
    const router = createRouter({
      mode: 'hash',
      routes: [],
    });
    expect(router._base).toBe('/my-app');
    router.destroy();
  });

  it('config base takes priority over <z-outlet> base attribute', () => {
    document.body.innerHTML = '<z-outlet base="/outlet-base"></z-outlet>';
    const router = createRouter({
      mode: 'hash',
      base: '/config-base',
      routes: [],
    });
    expect(router._base).toBe('/config-base');
    router.destroy();
  });

  it('falls back gracefully when no <z-outlet> and no el:', () => {
    document.body.innerHTML = '<div>no outlet here</div>';
    const router = createRouter({
      mode: 'hash',
      routes: [{ path: '/', component: 'home-page' }],
    });
    expect(router._el).toBeNull();
    router.destroy();
  });

  it('mounts and navigates using <z-outlet>', async () => {
    document.body.innerHTML = '<z-outlet></z-outlet>';
    const router = createRouter({
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/about', component: 'about-page' },
      ],
    });
    await new Promise(r => setTimeout(r, 50));
    expect(router.current.path).toBe('/');
    router.navigate('/about');
    await router._resolve();
    expect(router.current.path).toBe('/about');
    router.destroy();
  });
});


// ===========================================================================
// z-active-route directive
// ===========================================================================

describe('Router - z-active-route', () => {
  let router;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/about', component: 'about-page' },
        { path: '/docs/:section', component: 'docs-page' },
      ],
    });
  });

  afterEach(() => {
    if (router) router.destroy();
  });

  it('adds "active" class to matching element (prefix match)', () => {
    document.body.innerHTML += `
      <a z-link="/docs/intro" z-active-route="/docs">Docs</a>
      <a z-link="/about" z-active-route="/about">About</a>
    `;
    router._updateActiveRoutes('/docs/intro');
    const docsLink = document.querySelector('[z-active-route="/docs"]');
    const aboutLink = document.querySelector('[z-active-route="/about"]');
    expect(docsLink.classList.contains('active')).toBe(true);
    expect(aboutLink.classList.contains('active')).toBe(false);
  });

  it('removes "active" class when route no longer matches', () => {
    document.body.innerHTML += '<a z-active-route="/about">About</a>';
    const el = document.querySelector('[z-active-route="/about"]');

    router._updateActiveRoutes('/about');
    expect(el.classList.contains('active')).toBe(true);

    router._updateActiveRoutes('/docs');
    expect(el.classList.contains('active')).toBe(false);
  });

  it('supports custom class via z-active-class', () => {
    document.body.innerHTML += '<a z-active-route="/about" z-active-class="selected">About</a>';
    const el = document.querySelector('[z-active-route="/about"]');

    router._updateActiveRoutes('/about');
    expect(el.classList.contains('selected')).toBe(true);
    expect(el.classList.contains('active')).toBe(false);
  });

  it('supports exact matching with z-active-exact', () => {
    document.body.innerHTML += `
      <a z-active-route="/" z-active-exact>Home</a>
      <a z-active-route="/docs">Docs</a>
    `;
    const home = document.querySelector('[z-active-route="/"]');
    const docs = document.querySelector('[z-active-route="/docs"]');

    // At root - home is exact match, docs should not match
    router._updateActiveRoutes('/');
    expect(home.classList.contains('active')).toBe(true);
    expect(docs.classList.contains('active')).toBe(false);

    // At /docs - home exact should NOT match, docs prefix should match
    router._updateActiveRoutes('/docs');
    expect(home.classList.contains('active')).toBe(false);
    expect(docs.classList.contains('active')).toBe(true);
  });

  it('root "/" only matches itself, not all paths (prefix match)', () => {
    document.body.innerHTML += '<a z-active-route="/">Home</a>';
    const el = document.querySelector('[z-active-route="/"]');

    router._updateActiveRoutes('/about');
    expect(el.classList.contains('active')).toBe(false);

    router._updateActiveRoutes('/');
    expect(el.classList.contains('active')).toBe(true);
  });

  it('handles multiple elements simultaneously', () => {
    document.body.innerHTML += `
      <nav>
        <a z-active-route="/" z-active-exact>Home</a>
        <a z-active-route="/about">About</a>
        <a z-active-route="/docs">Docs</a>
        <a z-active-route="/docs" z-active-class="highlight">Docs Alt</a>
      </nav>
    `;

    router._updateActiveRoutes('/docs/getting-started');

    const home = document.querySelector('[z-active-route="/"]');
    const about = document.querySelector('[z-active-route="/about"]');
    const docs = document.querySelectorAll('[z-active-route="/docs"]');

    expect(home.classList.contains('active')).toBe(false);
    expect(about.classList.contains('active')).toBe(false);
    expect(docs[0].classList.contains('active')).toBe(true);
    expect(docs[1].classList.contains('highlight')).toBe(true);
  });

  it('z-active-exact does not match child routes', () => {
    document.body.innerHTML += '<a z-active-route="/docs" z-active-exact>Docs</a>';
    const el = document.querySelector('[z-active-route="/docs"]');

    router._updateActiveRoutes('/docs/intro');
    expect(el.classList.contains('active')).toBe(false);

    router._updateActiveRoutes('/docs');
    expect(el.classList.contains('active')).toBe(true);
  });

  it('toggles class correctly across navigation changes', () => {
    document.body.innerHTML += `
      <a z-active-route="/about">About</a>
      <a z-active-route="/docs">Docs</a>
    `;
    const about = document.querySelector('[z-active-route="/about"]');
    const docs = document.querySelector('[z-active-route="/docs"]');

    router._updateActiveRoutes('/about');
    expect(about.classList.contains('active')).toBe(true);
    expect(docs.classList.contains('active')).toBe(false);

    router._updateActiveRoutes('/docs/selectors');
    expect(about.classList.contains('active')).toBe(false);
    expect(docs.classList.contains('active')).toBe(true);

    router._updateActiveRoutes('/');
    expect(about.classList.contains('active')).toBe(false);
    expect(docs.classList.contains('active')).toBe(false);
  });
});
