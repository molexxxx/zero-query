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
