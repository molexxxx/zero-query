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
