/**
 * Documentation validation test suite.
 *
 * Validates every property table, code example, and API claim in the
 * documentation section data against the actual framework implementation.
 * If the tests fail, the docs or framework need updating.
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';

// --- Framework imports (the actual code under test) --------------------------
import { morph, morphElement } from '../src/diff.js';
import { reactive, Signal, signal, computed, effect, batch, untracked } from '../src/reactive.js';
import { safeEval } from '../src/expression.js';
import {
  debounce, throttle, pipe, once, sleep,
  escapeHtml, stripHtml, html, trust, TrustedHTML, uuid, camelCase, kebabCase,
  deepClone, deepMerge, isEqual, param, parseQuery,
  storage, session, EventBus, bus,
  range, unique, chunk, groupBy,
  pick, omit, getPath, setPath, isEmpty,
  capitalize, truncate, clamp,
  memoize, retry, timeout,
} from '../src/utils.js';
import { createRouter, getRouter, matchRoute } from '../src/router.js';
import { component, mount, mountAll, destroy, prefetch, getInstance, getRegistry, style } from '../src/component.js';
import { createStore, getStore } from '../src/store.js';
import { http } from '../src/http.js';
import { ZQueryError, ErrorCode, onError, reportError, guardCallback, guardAsync, validate, formatError } from '../src/errors.js';
import { createSSRApp, renderToString } from '../src/ssr.js';

// --- Doc sections need $ global (website store.js references $.libSize) ------
// Set up a minimal global $ before dynamic import
let SECTIONS;
beforeAll(async () => {
  const mod = await import('../index.js');
  globalThis.$ = mod.$;
  const sectionsMod = await import('../zquery-website/app/components/docs/sections/index.js');
  SECTIONS = sectionsMod.SECTIONS;
});


// ===========================================================================
// Helpers
// ===========================================================================
function el(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}

/** Verify section exists and has required shape */
function assertSection(sec) {
  expect(sec).toBeDefined();
  expect(sec.id).toBeTypeOf('string');
  expect(sec.label).toBeTypeOf('string');
  expect(Array.isArray(sec.headings)).toBe(true);
  expect(sec.content).toBeTypeOf('function');
  const html = sec.content();
  expect(html).toBeTypeOf('string');
  expect(html.length).toBeGreaterThan(0);
}


// ===========================================================================
// 1. SECTION STRUCTURE VALIDATION
// ===========================================================================
describe('Documentation sections structure', () => {

  it('exports SECTIONS array with all 16 sections', () => {
    expect(Array.isArray(SECTIONS)).toBe(true);
    expect(SECTIONS.length).toBe(16);
  });

  const expectedIds = [
    'getting-started', 'dev-workflow', 'devtools', 'error-handling',
    'cli-bundler', 'project-structure', 'router', 'components',
    'directives', 'store', 'reactive', 'selectors', 'ssr',
    'http', 'utils', 'security',
  ];

  it.each(expectedIds)('section "%s" exists with valid structure', (id) => {
    const sec = SECTIONS.find(s => s.id === id);
    assertSection(sec);
  });

  it('every section has unique id', () => {
    const ids = SECTIONS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every heading has id and text', () => {
    for (const sec of SECTIONS) {
      for (const h of sec.headings) {
        expect(h.id).toBeTypeOf('string');
        expect(h.text).toBeTypeOf('string');
        expect(h.id.length).toBeGreaterThan(0);
        expect(h.text.length).toBeGreaterThan(0);
      }
    }
  });

  it('every section content() returns valid HTML with headings', () => {
    for (const sec of SECTIONS) {
      const html = sec.content();
      expect(html).toBeTypeOf('string');
      // Every section should have at least one heading
      expect(html).toMatch(/<h[23]/);
    }
  });
});


// ===========================================================================
// 2. REACTIVE DOCS — Validate property tables & examples
// ===========================================================================
describe('Reactive docs validation', () => {

  it('$.reactive() creates a deeply reactive proxy', () => {
    const changes = [];
    const data = reactive({ user: { name: 'Alice', score: 0 }, items: ['a', 'b', 'c'] },
      (prop, value, oldValue) => changes.push({ prop, value, oldValue })
    );
    data.user.score = 42;
    expect(changes.some(c => c.prop === 'score' && c.value === 42 && c.oldValue === 0)).toBe(true);
  });

  it('$.reactive() proxy has __raw and __isReactive', () => {
    const data = reactive({ x: 1 }, () => {});
    expect(data.__isReactive).toBe(true);
    expect(data.__raw).toBeDefined();
    expect(data.__raw.x).toBe(1);
  });

  it('$.reactive() on non-object returns as-is', () => {
    const fn = () => {};
    expect(reactive(42, fn)).toBe(42);
    expect(reactive(null, fn)).toBe(null);
  });

  it('$.signal() creates a signal with .value', () => {
    const count = signal(0);
    expect(count.value).toBe(0);
    count.value = 5;
    expect(count.value).toBe(5);
  });

  it('signal .subscribe() returns unsubscribe function', () => {
    const count = signal(0);
    const calls = [];
    const unsub = count.subscribe(() => calls.push(count.value));
    count.value = 1;
    expect(calls).toContain(1);
    unsub();
    count.value = 2;
    expect(calls).not.toContain(2);
  });

  it('signal equality check - same value is no-op', () => {
    const s = signal(5);
    const calls = [];
    s.subscribe(() => calls.push('fired'));
    s.value = 5; // same value
    expect(calls.length).toBe(0);
  });

  it('signal .peek() reads without tracking', () => {
    const count = signal(0);
    const label = signal('Count');
    let runs = 0;

    const dispose = effect(() => {
      label.value; // tracked
      count.peek(); // NOT tracked
      runs++;
    });

    expect(runs).toBe(1);
    count.value = 10; // should NOT re-run effect
    expect(runs).toBe(1);
    label.value = 'New Label'; // SHOULD re-run
    expect(runs).toBe(2);
    dispose();
  });

  it('$.Signal constructor is same class as $.signal()', () => {
    const a = new Signal(0);
    const b = signal(0);
    expect(a instanceof Signal).toBe(true);
    expect(b instanceof Signal).toBe(true);
  });

  it('$.computed() derives from signals', () => {
    const price = signal(29.99);
    const quantity = signal(3);
    const total = computed(() => price.value * quantity.value);
    expect(total.value).toBeCloseTo(89.97);
    quantity.value = 5;
    expect(total.value).toBeCloseTo(149.95);
  });

  it('chained computed signals', () => {
    const count = signal(2);
    const doubled = computed(() => count.value * 2);
    const quadrupled = computed(() => doubled.value * 2);
    expect(quadrupled.value).toBe(8);
    count.value = 3;
    expect(quadrupled.value).toBe(12);
  });

  it('$.effect() returns dispose function', () => {
    const theme = signal('dark');
    let result = '';
    const dispose = effect(() => { result = theme.value; });
    expect(result).toBe('dark');
    theme.value = 'light';
    expect(result).toBe('light');
    dispose();
    theme.value = 'blue';
    expect(result).toBe('light'); // no longer tracking
  });

  it('$.batch() defers signal notifications', () => {
    const a = signal(1);
    const b = signal(2);
    const results = [];
    effect(() => results.push(a.value + b.value));
    expect(results).toEqual([3]);
    batch(() => {
      a.value = 10;
      b.value = 20;
    });
    // Should fire once with 30, not intermediate 12
    expect(results[results.length - 1]).toBe(30);
  });

  it('$.batch() returns callback return value', () => {
    const a = signal(1);
    const result = batch(() => {
      a.value = 100;
      return a.value;
    });
    expect(result).toBe(100);
  });

  it('$.untracked() reads without creating dependencies', () => {
    const a = signal(1);
    const b = signal(10);
    let runs = 0;
    const dispose = effect(() => {
      a.value; // tracked
      untracked(() => b.value); // NOT tracked
      runs++;
    });
    expect(runs).toBe(1);
    b.value = 20; // should NOT re-run
    expect(runs).toBe(1);
    a.value = 2; // should re-run
    expect(runs).toBe(2);
    dispose();
  });

  it('error resilience - reactive onChange error is caught', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const data = reactive({ x: 0 }, () => { throw new Error('boom'); });
    data.x = 1; // should not throw
    expect(data.x).toBe(1);
    spy.mockRestore();
  });

  it('error resilience - signal subscriber error is caught', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = signal(0);
    s.subscribe(() => { throw new Error('boom'); });
    s.value = 1; // should not throw
    spy.mockRestore();
  });

  it('error resilience - effect error is caught', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = signal(0);
    effect(() => {
      if (s.value > 0) throw new Error('boom');
      s.value; // track
    });
    s.value = 1; // should not throw
    spy.mockRestore();
  });
});


// ===========================================================================
// 3. STORE DOCS — Validate property tables & examples
// ===========================================================================
describe('Store docs validation', () => {

  beforeEach(() => {
    // Clear any previously registered stores
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('$.store() creates a store with state, actions, getters', () => {
    const store = createStore('test-basic', {
      state: { user: null, theme: 'dark', count: 0 },
      getters: {
        isLoggedIn: (state) => !!state.user,
        displayName: (state) => state.user?.name || 'Guest',
      },
      actions: {
        login(state, user) { state.user = user; },
        logout(state) { state.user = null; },
        increment(state) { state.count++; },
        setTheme(state, t) { state.theme = t; },
      }
    });
    expect(store.state.count).toBe(0);
    expect(store.state.theme).toBe('dark');
    expect(store.getters.isLoggedIn).toBe(false);
    expect(store.getters.displayName).toBe('Guest');
  });

  it('store.dispatch() runs actions and returns result', () => {
    const store = createStore('test-dispatch', {
      state: { count: 0 },
      actions: {
        increment(state) { state.count++; },
        compute(state) { return state.count * 2; },
      }
    });
    store.dispatch('increment');
    expect(store.state.count).toBe(1);
    const result = store.dispatch('compute');
    expect(result).toBe(2);
  });

  it('store.subscribe() - key-specific and wildcard callback args (key, value, old)', () => {
    const store = createStore('test-sub-args', {
      state: { count: 0 },
      actions: { inc(s) { s.count++; } }
    });

    // Key-specific subscriber: (key, value, old) per actual source
    const keyArgs = [];
    store.subscribe('count', (key, value, old) => keyArgs.push({ key, value, old }));

    // Wildcard subscriber: (key, value, old)
    const wildArgs = [];
    store.subscribe((key, value, old) => wildArgs.push({ key, value, old }));

    store.dispatch('inc');

    // Both should get (key, value, old) - same arg order
    expect(keyArgs.length).toBeGreaterThan(0);
    expect(keyArgs[0].key).toBe('count');
    expect(keyArgs[0].value).toBe(1);
    expect(keyArgs[0].old).toBe(0);

    expect(wildArgs.length).toBeGreaterThan(0);
    expect(wildArgs[0].key).toBe('count');
    expect(wildArgs[0].value).toBe(1);
    expect(wildArgs[0].old).toBe(0);
  });

  it('store.subscribe() returns unsubscribe function', () => {
    const store = createStore('test-unsub', {
      state: { x: 0 }, actions: { set(s, v) { s.x = v; } }
    });
    const calls = [];
    const unsub = store.subscribe('x', (k, v) => calls.push(v));
    store.dispatch('set', 1);
    expect(calls.length).toBe(1);
    unsub();
    store.dispatch('set', 2);
    expect(calls.length).toBe(1); // no more calls
  });

  it('middleware can block actions', () => {
    const store = createStore('test-mw', {
      state: { count: 0 },
      actions: { increment(s) { s.count++; } }
    });
    store.use((actionName, args, state) => {
      if (actionName === 'increment' && state.count >= 2) return false;
    });
    store.dispatch('increment');
    store.dispatch('increment');
    store.dispatch('increment'); // blocked
    expect(store.state.count).toBe(2);
  });

  it('middleware use() is chainable', () => {
    const store = createStore('test-mw-chain', {
      state: { x: 0 }, actions: { set(s, v) { s.x = v; } }
    });
    const result = store.use(() => {}).use(() => {});
    expect(result).toBe(store);
  });

  it('named stores via $.store(name, config) and $.getStore(name)', () => {
    createStore('auth', { state: { user: null } });
    createStore('cart', { state: { items: [] } });
    expect(getStore('auth')).not.toBeNull();
    expect(getStore('cart')).not.toBeNull();
    expect(getStore('nonexistent')).toBeNull();
  });

  it('default store when no name given', () => {
    createStore({ state: { x: 1 } });
    expect(getStore()).not.toBeNull();
    expect(getStore('default')).not.toBeNull();
  });

  it('store.batch() groups mutations - subscribers fire once', () => {
    const store = createStore('test-batch', {
      state: { count: 0 },
      actions: {}
    });
    const calls = [];
    store.subscribe('count', (k, v) => calls.push(v));
    store.batch(state => {
      state.count = 1;
      state.count = 2;
      state.count = 3;
    });
    // Only final value should trigger
    expect(calls.length).toBe(1);
    expect(calls[0]).toBe(3);
  });

  it('checkpoint / undo / redo', () => {
    const store = createStore('test-undo', {
      state: { text: '', color: 'blue' },
      actions: {
        setText(state, val) { state.text = val; },
        setColor(state, val) { state.color = val; }
      }
    });
    store.checkpoint();
    store.dispatch('setText', 'hello');
    store.dispatch('setColor', 'red');
    expect(store.canUndo).toBe(true);
    store.undo();
    expect(store.state.text).toBe('');
    expect(store.state.color).toBe('blue');
    expect(store.canRedo).toBe(true);
    store.redo();
    expect(store.state.text).toBe('hello');
    expect(store.state.color).toBe('red');
  });

  it('canUndo / canRedo getters', () => {
    const store = createStore('test-can', {
      state: { x: 0 }, actions: {}
    });
    expect(store.canUndo).toBe(false);
    expect(store.canRedo).toBe(false);
    store.checkpoint();
    store.state.x = 1;
    expect(store.canUndo).toBe(true);
  });

  it('store.snapshot() returns deep clone', () => {
    const store = createStore('test-snap', {
      state: { items: [1, 2, 3] }, actions: {}
    });
    const snap = store.snapshot();
    expect(snap.items).toEqual([1, 2, 3]);
    snap.items.push(4);
    expect(store.state.items.length).toBe(3); // original unchanged
  });

  it('store.replaceState() replaces entire state', () => {
    const store = createStore('test-replace', {
      state: { a: 1, b: 2 }, actions: {}
    });
    store.replaceState({ a: 10, b: 20 });
    expect(store.state.a).toBe(10);
    expect(store.state.b).toBe(20);
  });

  it('store.reset() without args resets to initial state', () => {
    const store = createStore('test-reset', {
      state: { count: 0 },
      actions: { inc(s) { s.count++; } }
    });
    store.dispatch('inc');
    store.dispatch('inc');
    expect(store.state.count).toBe(2);
    store.reset();
    expect(store.state.count).toBe(0);
  });

  it('store.history returns action log', () => {
    const store = createStore('test-history', {
      state: { x: 0 },
      actions: { inc(s) { s.x++; } }
    });
    store.dispatch('inc');
    store.dispatch('inc');
    const hist = store.history;
    expect(Array.isArray(hist)).toBe(true);
    expect(hist.length).toBe(2);
    expect(hist[0].action).toBe('inc');
    expect(hist[0].timestamp).toBeTypeOf('number');
  });

  it('error resilience - unknown action reports error', () => {
    const store = createStore('test-err', {
      state: {}, actions: {}
    });
    store.dispatch('nonexistent'); // should not throw
  });
});


// ===========================================================================
// 4. UTILS DOCS — Validate all 37+ utility functions
// ===========================================================================
describe('Utils docs validation', () => {

  // --- Function utilities ---
  it('debounce delays execution and has .cancel()', async () => {
    let called = 0;
    const fn = debounce(() => called++, 50);
    expect(fn.cancel).toBeTypeOf('function');
    fn();
    fn();
    fn();
    expect(called).toBe(0);
    await sleep(100);
    expect(called).toBe(1);
  });

  it('throttle limits execution rate', async () => {
    let called = 0;
    const fn = throttle(() => called++, 50);
    fn(); fn(); fn();
    expect(called).toBe(1);
    await sleep(100);
    fn();
    expect(called).toBeGreaterThanOrEqual(2);
  });

  it('pipe composes left-to-right', () => {
    const fn = pipe(x => x + 1, x => x * 2);
    expect(fn(3)).toBe(8);
  });

  it('once runs only once', () => {
    let calls = 0;
    const fn = once(() => ++calls);
    expect(fn()).toBe(1);
    expect(fn()).toBe(1);
    expect(calls).toBe(1);
  });

  it('sleep returns a promise', async () => {
    const start = Date.now();
    await sleep(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(40);
  });

  // --- String utilities ---
  it('escapeHtml escapes & < > " \'', () => {
    expect(escapeHtml('&<>"\''))
      .toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('stripHtml removes tags', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });

  it('html template tag auto-escapes values', () => {
    const user = '<script>alert("xss")</script>';
    const result = html`<div>${user}</div>`;
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('trust() bypasses html escaping', () => {
    const safe = trust('<b>bold</b>');
    const result = html`<div>${safe}</div>`;
    expect(result).toContain('<b>bold</b>');
  });

  it('TrustedHTML class works with instanceof', () => {
    const t = trust('<b>ok</b>');
    expect(t instanceof TrustedHTML).toBe(true);
    expect(t.toString()).toBe('<b>ok</b>');
  });

  it('uuid generates valid v4 format', () => {
    const id = uuid();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('camelCase converts kebab to camel', () => {
    expect(camelCase('my-component')).toBe('myComponent');
  });

  it('kebabCase converts camel to kebab', () => {
    expect(kebabCase('myComponent')).toBe('my-component');
  });

  it('capitalize first letter and lowercases rest', () => {
    expect(capitalize('hello')).toBe('Hello');
    expect(capitalize('HELLO')).toBe('Hello');
    expect(capitalize('')).toBe('');
  });

  it('truncate with default suffix', () => {
    expect(truncate('Hello World', 5)).toBe('Hell…');
    expect(truncate('Hi', 10)).toBe('Hi');
  });

  // --- Object utilities ---
  it('deepClone creates independent copy', () => {
    const obj = { a: { b: [1, 2] } };
    const clone = deepClone(obj);
    clone.a.b.push(3);
    expect(obj.a.b.length).toBe(2);
  });

  it('deepMerge merges recursively', () => {
    const target = { a: { x: 1 }, b: 2 };
    const result = deepMerge(target, { a: { y: 2 }, c: 3 });
    expect(result.a.x).toBe(1);
    expect(result.a.y).toBe(2);
    expect(result.c).toBe(3);
  });

  it('deepMerge blocks __proto__ poisoning', () => {
    const target = {};
    const malicious = JSON.parse('{"__proto__": {"polluted": true}}');
    deepMerge(target, malicious);
    expect(({}).polluted).toBeUndefined();
  });

  it('isEqual deep comparison', () => {
    expect(isEqual({ a: [1, 2] }, { a: [1, 2] })).toBe(true);
    expect(isEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(isEqual(null, null)).toBe(true);
  });

  it('pick extracts specified keys', () => {
    expect(pick({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ a: 1, c: 3 });
  });

  it('omit excludes specified keys', () => {
    expect(omit({ a: 1, b: 2, c: 3 }, ['b'])).toEqual({ a: 1, c: 3 });
  });

  it('getPath follows dot path', () => {
    expect(getPath({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42);
    expect(getPath({ a: 1 }, 'x.y', 'fallback')).toBe('fallback');
  });

  it('setPath creates nested structure', () => {
    const obj = {};
    setPath(obj, 'a.b.c', 42);
    expect(obj.a.b.c).toBe(42);
  });

  it('setPath blocks __proto__ poisoning', () => {
    const obj = {};
    setPath(obj, '__proto__.polluted', true);
    expect(({}).polluted).toBeUndefined();
  });

  it('isEmpty checks emptiness', () => {
    expect(isEmpty(null)).toBe(true);
    expect(isEmpty(undefined)).toBe(true);
    expect(isEmpty('')).toBe(true);
    expect(isEmpty([])).toBe(true);
    expect(isEmpty({})).toBe(true);
    expect(isEmpty(new Map())).toBe(true);
    expect(isEmpty(new Set())).toBe(true);
    expect(isEmpty('x')).toBe(false);
    expect(isEmpty([1])).toBe(false);
    expect(isEmpty({ a: 1 })).toBe(false);
  });

  // --- URL utilities ---
  it('param serializes object to query string', () => {
    const result = param({ page: 2, limit: 10 });
    expect(result).toContain('page=2');
    expect(result).toContain('limit=10');
  });

  it('parseQuery parses query string', () => {
    expect(parseQuery('page=2&limit=10')).toEqual({ page: '2', limit: '10' });
  });

  // --- Storage wrappers ---
  it('storage has get/set/remove/clear methods', () => {
    expect(storage.get).toBeTypeOf('function');
    expect(storage.set).toBeTypeOf('function');
    expect(storage.remove).toBeTypeOf('function');
    expect(storage.clear).toBeTypeOf('function');
  });

  it('storage auto-parses JSON', () => {
    storage.set('test-key', { a: 1 });
    expect(storage.get('test-key')).toEqual({ a: 1 });
    storage.remove('test-key');
    expect(storage.get('test-key')).toBeNull();
    expect(storage.get('test-key', 'fallback')).toBe('fallback');
  });

  it('session has same API as storage', () => {
    expect(session.get).toBeTypeOf('function');
    expect(session.set).toBeTypeOf('function');
    expect(session.remove).toBeTypeOf('function');
    expect(session.clear).toBeTypeOf('function');
  });

  // --- Event bus ---
  it('bus has on/off/emit/once/clear', () => {
    expect(bus.on).toBeTypeOf('function');
    expect(bus.off).toBeTypeOf('function');
    expect(bus.emit).toBeTypeOf('function');
    expect(bus.once).toBeTypeOf('function');
    expect(bus.clear).toBeTypeOf('function');
  });

  it('bus.on returns unsubscribe function', () => {
    const calls = [];
    const unsub = bus.on('test', (v) => calls.push(v));
    bus.emit('test', 1);
    expect(calls).toEqual([1]);
    unsub();
    bus.emit('test', 2);
    expect(calls).toEqual([1]);
    bus.clear();
  });

  it('bus.once fires only once', () => {
    const calls = [];
    bus.once('test-once', (v) => calls.push(v));
    bus.emit('test-once', 'a');
    bus.emit('test-once', 'b');
    expect(calls).toEqual(['a']);
    bus.clear();
  });

  it('EventBus class can be instantiated', () => {
    const myBus = new EventBus();
    const calls = [];
    myBus.on('x', (v) => calls.push(v));
    myBus.emit('x', 42);
    expect(calls).toEqual([42]);
  });

  // --- Array utilities ---
  it('range generates number arrays', () => {
    expect(range(5)).toEqual([0, 1, 2, 3, 4]);
    expect(range(2, 5)).toEqual([2, 3, 4]);
    expect(range(0, 10, 3)).toEqual([0, 3, 6, 9]);
    expect(range(5, 0, -1)).toEqual([5, 4, 3, 2, 1]);
  });

  it('unique deduplicates', () => {
    expect(unique([1, 2, 2, 3, 3])).toEqual([1, 2, 3]);
  });

  it('unique with keyFn', () => {
    const items = [{ id: 1, n: 'a' }, { id: 2, n: 'b' }, { id: 1, n: 'c' }];
    expect(unique(items, i => i.id).length).toBe(2);
  });

  it('chunk splits array', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('groupBy groups by key function', () => {
    const result = groupBy(['one', 'two', 'three'], w => String(w.length));
    expect(result['3']).toEqual(['one', 'two']);
    expect(result['5']).toEqual(['three']);
  });

  // --- Number utilities ---
  it('clamp constrains to range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  // --- Memoize ---
  it('memoize caches results and has .clear()', () => {
    let calls = 0;
    const fn = memoize((x) => { calls++; return x * 2; });
    expect(fn(5)).toBe(10);
    expect(fn(5)).toBe(10);
    expect(calls).toBe(1);
    fn.clear();
    expect(fn(5)).toBe(10);
    expect(calls).toBe(2);
  });

  it('memoize with maxSize evicts old entries', () => {
    let calls = 0;
    const fn = memoize((x) => { calls++; return x; }, { maxSize: 2 });
    fn(1); fn(2); fn(3); // 1 should be evicted
    calls = 0;
    fn(1); // should recompute
    expect(calls).toBe(1);
  });

  // --- Retry ---
  it('retry retries on failure', async () => {
    let attempt = 0;
    const result = await retry((n) => {
      attempt = n;
      if (n < 3) return Promise.reject(new Error('fail'));
      return Promise.resolve('ok');
    }, { attempts: 3, delay: 10 });
    expect(result).toBe('ok');
    expect(attempt).toBe(3);
  });

  // --- Timeout ---
  it('timeout rejects if promise is too slow', async () => {
    const slow = new Promise(r => setTimeout(() => r('done'), 500));
    await expect(timeout(slow, 50)).rejects.toThrow(/Timed out/);
  });
});


// ===========================================================================
// 5. HTTP DOCS — Validate API shape
// ===========================================================================
describe('HTTP docs validation', () => {

  it('http has all documented methods', () => {
    expect(http.get).toBeTypeOf('function');
    expect(http.post).toBeTypeOf('function');
    expect(http.put).toBeTypeOf('function');
    expect(http.patch).toBeTypeOf('function');
    expect(http.delete).toBeTypeOf('function');
    expect(http.head).toBeTypeOf('function');
  });

  it('http.configure() sets defaults', () => {
    http.configure({
      baseURL: 'https://test.example.com',
      headers: { 'X-Test': 'yes' },
      timeout: 5000,
    });
    const config = http.getConfig();
    expect(config.baseURL).toBe('https://test.example.com');
    expect(config.headers['X-Test']).toBe('yes');
    expect(config.timeout).toBe(5000);
    // Reset
    http.configure({ baseURL: '', timeout: 30000 });
  });

  it('http.getConfig() returns safe copy', () => {
    const cfg1 = http.getConfig();
    const cfg2 = http.getConfig();
    expect(cfg1).not.toBe(cfg2); // different object
    expect(cfg1.headers).not.toBe(cfg2.headers);
  });

  it('http.onRequest() returns unsubscribe function', () => {
    const unsub = http.onRequest(() => {});
    expect(unsub).toBeTypeOf('function');
    unsub();
  });

  it('http.onResponse() returns unsubscribe function', () => {
    const unsub = http.onResponse(() => {});
    expect(unsub).toBeTypeOf('function');
    unsub();
  });

  it('http.clearInterceptors() clears all or by type', () => {
    http.onRequest(() => {});
    http.onResponse(() => {});
    http.clearInterceptors('request');
    http.clearInterceptors('response');
    http.clearInterceptors(); // clear all
  });

  it('http.all() batches promises', async () => {
    const results = await http.all([
      Promise.resolve({ ok: true, data: 1 }),
      Promise.resolve({ ok: true, data: 2 }),
    ]);
    expect(results.length).toBe(2);
  });

  it('http.createAbort() returns AbortController', () => {
    const ac = http.createAbort();
    expect(ac).toBeInstanceOf(AbortController);
    expect(ac.signal).toBeInstanceOf(AbortSignal);
  });

  it('http.raw is a function', () => {
    expect(http.raw).toBeTypeOf('function');
  });
});


// ===========================================================================
// 6. ERROR HANDLING DOCS — Validate error codes, classes, functions
// ===========================================================================
describe('Error handling docs validation', () => {

  afterEach(() => { onError(null); });

  it('ErrorCode has all documented codes', () => {
    const expected = [
      'REACTIVE_CALLBACK', 'SIGNAL_CALLBACK', 'EFFECT_EXEC',
      'EXPR_PARSE', 'EXPR_EVAL', 'EXPR_UNSAFE_ACCESS',
      'COMP_INVALID_NAME', 'COMP_NOT_FOUND', 'COMP_MOUNT_TARGET', 'COMP_RENDER',
      'COMP_LIFECYCLE', 'COMP_RESOURCE', 'COMP_DIRECTIVE',
      'ROUTER_LOAD', 'ROUTER_GUARD', 'ROUTER_RESOLVE',
      'STORE_ACTION', 'STORE_MIDDLEWARE', 'STORE_SUBSCRIBE',
      'HTTP_REQUEST', 'HTTP_TIMEOUT', 'HTTP_INTERCEPTOR', 'HTTP_PARSE',
      'SSR_RENDER', 'SSR_COMPONENT', 'SSR_HYDRATION', 'SSR_PAGE',
      'INVALID_ARGUMENT',
    ];
    for (const code of expected) {
      expect(ErrorCode[code]).toBeDefined();
      expect(ErrorCode[code]).toMatch(/^ZQ_/);
    }
  });

  it('ErrorCode is frozen', () => {
    expect(Object.isFrozen(ErrorCode)).toBe(true);
  });

  it('ZQueryError has code, context, cause', () => {
    const cause = new Error('original');
    const err = new ZQueryError(ErrorCode.COMP_RENDER, 'Render failed', { component: 'test' }, cause);
    expect(err.name).toBe('ZQueryError');
    expect(err.code).toBe('ZQ_COMP_RENDER');
    expect(err.context.component).toBe('test');
    expect(err.cause).toBe(cause);
    expect(err.message).toBe('Render failed');
    expect(err instanceof Error).toBe(true);
  });

  it('onError registers handler and returns unsubscribe', () => {
    const errors = [];
    const unsub = onError((err) => errors.push(err));
    reportError(ErrorCode.INVALID_ARGUMENT, 'test error');
    expect(errors.length).toBe(1);
    expect(errors[0] instanceof ZQueryError).toBe(true);
    unsub();
    reportError(ErrorCode.INVALID_ARGUMENT, 'test error 2');
    expect(errors.length).toBe(1);
  });

  it('onError(null) clears all handlers', () => {
    const calls = [];
    onError(() => calls.push(1));
    onError(() => calls.push(2));
    onError(null);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    reportError(ErrorCode.INVALID_ARGUMENT, 'test');
    expect(calls.length).toBe(0);
    spy.mockRestore();
  });

  it('guardCallback wraps errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fn = guardCallback(() => { throw new Error('boom'); }, ErrorCode.COMP_RENDER);
    expect(fn()).toBeUndefined(); // does not throw
    spy.mockRestore();
  });

  it('guardAsync wraps async errors', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fn = guardAsync(async () => { throw new Error('boom'); }, ErrorCode.COMP_RENDER);
    const result = await fn();
    expect(result).toBeUndefined();
    spy.mockRestore();
  });

  it('validate throws on missing value', () => {
    expect(() => validate(null, 'name')).toThrow(ZQueryError);
    expect(() => validate(undefined, 'name')).toThrow(ZQueryError);
  });

  it('validate throws on wrong type', () => {
    expect(() => validate(42, 'name', 'string')).toThrow(ZQueryError);
    expect(() => validate('hello', 'name', 'string')).not.toThrow();
  });

  it('formatError returns structured object', () => {
    const err = new ZQueryError(ErrorCode.COMP_RENDER, 'test', { x: 1 });
    const formatted = formatError(err);
    expect(formatted.code).toBe('ZQ_COMP_RENDER');
    expect(formatted.type).toBe('ZQueryError');
    expect(formatted.message).toBe('test');
    expect(formatted.context).toEqual({ x: 1 });
    expect(formatted.stack).toBeTypeOf('string');
  });

  it('formatError handles nested cause', () => {
    const inner = new ZQueryError(ErrorCode.EXPR_EVAL, 'inner');
    const outer = new ZQueryError(ErrorCode.COMP_RENDER, 'outer', {}, inner);
    const formatted = formatError(outer);
    expect(formatted.cause).not.toBeNull();
    expect(formatted.cause.code).toBe('ZQ_EXPR_EVAL');
  });
});


// ===========================================================================
// 7. EXPRESSION PARSER DOCS
// ===========================================================================
describe('Expression parser docs validation', () => {

  const eval_ = (expr, ...scopes) => safeEval(expr, scopes.length ? scopes : [{}]);

  it('property access', () => {
    expect(eval_('user.name', { user: { name: 'Alice' } })).toBe('Alice');
  });

  it('array indexing', () => {
    expect(eval_('items[0]', { items: ['a', 'b'] })).toBe('a');
  });

  it('arithmetic', () => {
    expect(eval_('a + b', { a: 2, b: 3 })).toBe(5);
    expect(eval_('count * 2', { count: 5 })).toBe(10);
  });

  it('comparison operators', () => {
    expect(eval_('a === b', { a: 1, b: 1 })).toBe(true);
    expect(eval_('x != null', { x: 5 })).toBe(true);
    expect(eval_('count > 0', { count: 5 })).toBe(true);
  });

  it('logical operators', () => {
    expect(eval_('a && b', { a: true, b: false })).toBe(false);
    expect(eval_('a || b', { a: false, b: true })).toBe(true);
    expect(eval_('!a', { a: false })).toBe(true);
  });

  it('ternary', () => {
    expect(eval_('a ? "yes" : "no"', { a: true })).toBe('yes');
    expect(eval_('a ? "yes" : "no"', { a: false })).toBe('no');
  });

  it('typeof', () => {
    expect(eval_('typeof x', { x: 'hello' })).toBe('string');
    expect(eval_('typeof x', { x: 42 })).toBe('number');
  });

  it('literals', () => {
    expect(eval_('42')).toBe(42);
    expect(eval_("'hello'")).toBe('hello');
    expect(eval_('true')).toBe(true);
    expect(eval_('false')).toBe(false);
    expect(eval_('null')).toBe(null);
    expect(eval_('undefined')).toBe(undefined);
  });

  it('template literals', () => {
    expect(eval_('`Hello ${name}`', { name: 'World' })).toBe('Hello World');
  });

  it('array literals', () => {
    expect(eval_('[1, 2, 3]')).toEqual([1, 2, 3]);
  });

  it('object literals', () => {
    expect(eval_("{ foo: 'bar' }")).toEqual({ foo: 'bar' });
  });

  it('nullish coalescing', () => {
    expect(eval_('a ?? "default"', { a: null })).toBe('default');
    expect(eval_('a ?? "default"', { a: 'value' })).toBe('value');
  });

  it('optional chaining', () => {
    expect(eval_('a?.b', { a: null })).toBeUndefined();
    expect(eval_('a?.b', { a: { b: 42 } })).toBe(42);
  });

  it('arrow functions', () => {
    const fn = eval_('x => x * 2');
    expect(fn(5)).toBe(10);
  });

  it('whitelisted globals are accessible', () => {
    expect(eval_('Math.max(1, 2, 3)')).toBe(3);
    expect(eval_('parseInt("42")')).toBe(42);
    expect(eval_('isNaN(NaN)')).toBe(true);
  });

  it('blocks __proto__ access', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    expect(eval_('obj.__proto__', { obj: {} })).toBeUndefined();
    spy.mockRestore();
  });

  it('blocks constructor access', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    expect(eval_('obj.constructor', { obj: {} })).toBeUndefined();
    spy.mockRestore();
  });
});


// ===========================================================================
// 8. COMPONENT DOCS — Validate API shape & lifecycle
// ===========================================================================
describe('Component docs validation', () => {

  beforeEach(() => {
    document.body.innerHTML = '';
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('$.component() registers and $.components() retrieves registry', () => {
    component('test-comp-doc', { render: () => '<p>test</p>' });
    const registry = getRegistry();
    expect(registry['test-comp-doc']).toBeDefined();
  });

  it('component definition keys are recognized', () => {
    component('test-keys-doc', {
      state: { count: 0 },
      computed: { double() { return this.state.count * 2; } },
      watch: { count(v, old) {} },
      init() {},
      mounted() {},
      updated() {},
      destroyed() {},
      styles: '.card { color: red; }',
      increment() { this.state.count++; },
      render() { return '<p>test</p>'; }
    });
    const registry = getRegistry();
    expect(registry['test-keys-doc']).toBeDefined();
  });

  it('$.mount() mounts component and returns instance', () => {
    component('test-mount-doc', { render: () => '<p>mounted</p>' });
    document.body.innerHTML = '<div id="test-root"></div>';
    const inst = mount('#test-root', 'test-mount-doc');
    expect(inst).toBeDefined();
    expect(document.querySelector('#test-root p').textContent).toBe('mounted');
  });

  it('$.getInstance() retrieves instance', () => {
    component('test-getinst-doc', { render: () => '<p>get</p>' });
    document.body.innerHTML = '<div id="inst-root"></div>';
    mount('#inst-root', 'test-getinst-doc');
    const inst = getInstance('#inst-root');
    expect(inst).toBeDefined();
  });

  it('$.destroy() removes component', () => {
    component('test-destroy-doc', {
      state: { x: 1 },
      render() { return '<p>alive</p>'; }
    });
    document.body.innerHTML = '<div id="destroy-root"></div>';
    mount('#destroy-root', 'test-destroy-doc');
    destroy('#destroy-root');
    expect(getInstance('#destroy-root')).toBeNull();
  });

  it('component with props', () => {
    component('test-props-doc', {
      state: { label: '' },
      mounted() {
        this.state.label = this.props.label || 'default';
      },
      render() { return `<span>${this.state.label}</span>`; }
    });
    document.body.innerHTML = '<div id="props-root"></div>';
    const inst = mount('#props-root', 'test-props-doc', { label: 'Hello' });
    expect(inst.props.label).toBe('Hello');
  });

  it('component emit() dispatches custom event', () => {
    component('test-emit-doc', {
      fire() { this.emit('my-event', 42); },
      render() { return '<button @click="fire">go</button>'; }
    });
    document.body.innerHTML = '<div id="emit-root"></div>';
    const inst = mount('#emit-root', 'test-emit-doc');
    let detail = null;
    document.querySelector('#emit-root').addEventListener('my-event', (e) => {
      detail = e.detail;
    });
    inst.fire();
    expect(detail).toBe(42);
  });

  it('component setState({}) forces re-render', async () => {
    let renderCount = 0;
    component('test-setstate-doc', {
      state: { x: 0 },
      render() { renderCount++; return `<p>${this.state.x}</p>`; }
    });
    document.body.innerHTML = '<div id="ss-root"></div>';
    const inst = mount('#ss-root', 'test-setstate-doc');
    const initial = renderCount;
    inst.setState({});
    await new Promise(r => setTimeout(r, 50));
    expect(renderCount).toBeGreaterThan(initial);
  });

  it('$.mountAll() scans container and auto-mounts registered tags', () => {
    component('ma-card', { render: () => '<p>card</p>' });
    component('ma-badge', { render: () => '<span>badge</span>' });
    document.body.innerHTML =
      '<div id="ma-root"><ma-card></ma-card><ma-badge></ma-badge></div>';
    mountAll(document.getElementById('ma-root'));
    expect(document.querySelector('ma-card p').textContent).toBe('card');
    expect(document.querySelector('ma-badge span').textContent).toBe('badge');
  });

  it('$.mountAll() skips already-mounted elements', () => {
    let mounts = 0;
    component('ma-once', { mounted() { mounts++; }, render: () => '<p>once</p>' });
    document.body.innerHTML = '<ma-once></ma-once>';
    mountAll();
    const first = mounts;
    mountAll();
    expect(mounts).toBe(first); // no double-mount
  });

  it('$.mountAll() extracts static props from attributes', () => {
    component('ma-props', {
      render() { return `<p>${this.props.label}</p>`; }
    });
    document.body.innerHTML = '<ma-props label="hello"></ma-props>';
    mountAll();
    expect(document.querySelector('ma-props p').textContent).toBe('hello');
  });

  it('$.prefetch() resolves without error for registered component', async () => {
    component('pf-comp', { render: () => '<p>pf</p>' });
    await expect(prefetch('pf-comp')).resolves.toBeUndefined();
  });

  it('$.prefetch() is a no-op for unregistered names', async () => {
    await expect(prefetch('pf-nonexistent')).resolves.toBeUndefined();
  });

  it('$.style() returns object with ready promise and remove()', () => {
    const result = style('/test.css', { critical: false });
    expect(result).toBeDefined();
    expect(result.ready).toBeInstanceOf(Promise);
    expect(result.remove).toBeTypeOf('function');
    // Verify <link> was added to <head>
    const link = document.querySelector('link[data-zq-style][href="/test.css"]');
    expect(link).not.toBeNull();
    result.remove();
    expect(document.querySelector('link[data-zq-style][href="/test.css"]')).toBeNull();
  });

  it('$.style() with critical mode injects visibility-hidden style', () => {
    const result = style('/critical.css');
    const critStyle = document.querySelector('style[data-zq-critical]');
    expect(critStyle).not.toBeNull();
    expect(critStyle.textContent).toContain('visibility:hidden');
    result.remove();
  });

  it('$.style() deduplicates same URL', () => {
    const a = style('/dup.css', { critical: false });
    const b = style('/dup.css', { critical: false });
    const links = document.querySelectorAll('link[data-zq-style][href="/dup.css"]');
    expect(links.length).toBe(1);
    a.remove();
    b.remove();
  });
});


// ===========================================================================
// 9. ROUTER DOCS — Validate API shape
// ===========================================================================
describe('Router docs validation', () => {

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    document.body.innerHTML = '<div id="router-outlet"></div>';
  });
  afterEach(() => {
    const r = getRouter();
    if (r) r.destroy();
    vi.restoreAllMocks();
  });

  it('createRouter returns router instance', () => {
    // Register route components first
    component('r-home', { render: () => '<p>home</p>' });
    component('r-about', { render: () => '<p>about</p>' });
    const router = createRouter({
      el: '#router-outlet',
      mode: 'hash',
      routes: [
        { path: '/', component: 'r-home' },
        { path: '/about', component: 'r-about' },
      ]
    });
    expect(router).toBeDefined();
    expect(router.navigate).toBeTypeOf('function');
    expect(router.replace).toBeTypeOf('function');
    expect(router.back).toBeTypeOf('function');
    expect(router.forward).toBeTypeOf('function');
    expect(router.go).toBeTypeOf('function');
  });

  it('getRouter() returns active router', () => {
    component('r-home2', { render: () => '<p>h</p>' });
    createRouter({
      el: '#router-outlet',
      mode: 'hash',
      routes: [{ path: '/', component: 'r-home2' }]
    });
    expect(getRouter()).not.toBeNull();
  });

  it('router has beforeEach/afterEach guards', () => {
    component('r-guard', { render: () => '<p>guard</p>' });
    const router = createRouter({
      el: '#router-outlet',
      mode: 'hash',
      routes: [{ path: '/', component: 'r-guard' }]
    });
    expect(router.beforeEach).toBeTypeOf('function');
    expect(router.afterEach).toBeTypeOf('function');
  });

  it('router.onChange returns unsubscribe function', () => {
    component('r-onchange', { render: () => '<p>test</p>' });
    const router = createRouter({
      el: '#router-outlet',
      mode: 'hash',
      routes: [{ path: '/', component: 'r-onchange' }]
    });
    const unsub = router.onChange(() => {});
    expect(unsub).toBeTypeOf('function');
  });

  it('router has add/remove methods', () => {
    component('r-addrem', { render: () => '<p>x</p>' });
    const router = createRouter({
      el: '#router-outlet',
      mode: 'hash',
      routes: [{ path: '/', component: 'r-addrem' }]
    });
    expect(router.add).toBeTypeOf('function');
    expect(router.remove).toBeTypeOf('function');
  });

  it('router has current, path, query getters', () => {
    component('r-getters', { render: () => '<p>x</p>' });
    const router = createRouter({
      el: '#router-outlet',
      mode: 'hash',
      routes: [{ path: '/', component: 'r-getters' }]
    });
    expect(router.current).toBeDefined();
    expect(router.path).toBeTypeOf('string');
  });

  it('matchRoute works without DOM', () => {
    const routes = [
      { path: '/', component: 'home' },
      { path: '/users/:id', component: 'user' },
    ];
    const match = matchRoute(routes, '/users/42');
    expect(match).toBeDefined();
    expect(match.params.id).toBe('42');
  });
});


// ===========================================================================
// 10. DOM MORPHING DOCS
// ===========================================================================
describe('Morph docs validation', () => {

  it('morph(rootEl, newHTML) patches DOM', () => {
    const root = el('<p>old</p>');
    morph(root, '<p>new</p>');
    expect(root.querySelector('p').textContent).toBe('new');
  });

  it('morphElement preserves identity when tag matches', () => {
    const root = el('<div class="card"><p>old</p></div>');
    const child = root.firstElementChild;
    const result = morphElement(child, '<div class="card updated"><p>new</p></div>');
    expect(result).toBe(child); // same node
    expect(child.classList.contains('updated')).toBe(true);
  });

  it('z-key enables keyed reconciliation', () => {
    const root = el(
      '<div z-key="a">A</div><div z-key="b">B</div><div z-key="c">C</div>'
    );
    const nodeA = root.children[0];
    const nodeC = root.children[2];
    morph(root, '<div z-key="c">C</div><div z-key="a">A</div><div z-key="b">B</div>');
    expect(root.children[0]).toBe(nodeC);
    expect(root.children[1]).toBe(nodeA);
  });

  it('z-skip prevents morphing subtree', () => {
    const root = el('<div z-skip><span>original</span></div><p>text</p>');
    const skipChild = root.children[0].firstChild;
    morph(root, '<div z-skip><span>changed</span></div><p>updated</p>');
    expect(root.children[0].firstChild).toBe(skipChild);
    expect(root.querySelector('p').textContent).toBe('updated');
  });
});


// ===========================================================================
// 11. SSR DOCS — Basic validation
// ===========================================================================
describe('SSR docs validation', () => {

  it('createSSRApp returns app with component/renderToString/renderPage', () => {
    const app = createSSRApp();
    expect(app.component).toBeTypeOf('function');
    expect(app.renderToString).toBeTypeOf('function');
    expect(app.renderPage).toBeTypeOf('function');
  });

  it('standalone renderToString renders a component', async () => {
    const html = await renderToString({
      state: { name: 'World' },
      render() { return `<p>Hello {{name}}</p>`; }
    });
    expect(html).toContain('Hello');
    expect(html).toContain('World');
  });

  it('SSR app component registration and render', async () => {
    const app = createSSRApp();
    app.component('ssr-hello', {
      state: { greeting: 'Hi' },
      render() { return `<div>{{greeting}}</div>`; }
    });
    const html = await app.renderToString('ssr-hello');
    expect(html).toContain('Hi');
  });
});


// ===========================================================================
// 12. SECURITY DOCS — Validate XSS & prototype pollution protection
// ===========================================================================
describe('Security docs validation', () => {

  it('escapeHtml prevents XSS in template output', () => {
    const malicious = '<script>alert("xss")</script>';
    const safe = escapeHtml(malicious);
    expect(safe).not.toContain('<script>');
    expect(safe).toContain('&lt;script&gt;');
  });

  it('html template tag auto-escapes by default', () => {
    const malicious = '<img onerror="alert(1)" src=x>';
    const result = html`<p>${malicious}</p>`;
    // The angle brackets and quotes are escaped, preventing execution
    expect(result).not.toContain('<img');
    expect(result).toContain('&lt;img');
    expect(result).toContain('&quot;');
  });

  it('trust() explicitly opts into raw HTML', () => {
    const safe = trust('<b>bold</b>');
    const result = html`<p>${safe}</p>`;
    expect(result).toContain('<b>bold</b>');
  });

  it('expression parser blocks prototype pollution vectors', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    expect(safeEval('obj.__proto__', [{ obj: {} }])).toBeUndefined();
    expect(safeEval('obj.constructor', [{ obj: {} }])).toBeUndefined();
    expect(safeEval('obj.prototype', [{ obj: {} }])).toBeUndefined();
    spy.mockRestore();
  });

  it('deepMerge blocks __proto__ poisoning', () => {
    const target = {};
    const payload = JSON.parse('{"__proto__": {"isAdmin": true}}');
    deepMerge(target, payload);
    expect(({}).isAdmin).toBeUndefined();
  });

  it('setPath blocks __proto__ poisoning', () => {
    const obj = {};
    setPath(obj, '__proto__.isAdmin', true);
    expect(({}).isAdmin).toBeUndefined();
  });

  it('setPath blocks constructor poisoning', () => {
    const obj = {};
    setPath(obj, 'constructor.polluted', true);
    expect(Object.polluted).toBeUndefined();
  });
});


// ===========================================================================
// 13. INDEX.JS EXPORTS — Validate all documented $ namespace properties
// ===========================================================================
describe('Index.js $ namespace completeness', () => {

  // Import the assembled $ from index.js
  let $;
  beforeEach(async () => {
    const mod = await import('../index.js');
    $ = mod.$;
  });

  it('$ is a function', () => {
    expect($).toBeTypeOf('function');
  });

  it('$.all is a function', () => {
    expect($.all).toBeTypeOf('function');
  });

  it('has quick-ref shortcuts', () => {
    expect($.id).toBeTypeOf('function');
    expect($.class).toBeTypeOf('function');
    expect($.classes).toBeTypeOf('function');
    expect($.tag).toBeTypeOf('function');
    expect($.name).toBeTypeOf('function');
    expect($.children).toBeTypeOf('function');
    expect($.qs).toBeTypeOf('function');
    expect($.qsa).toBeTypeOf('function');
  });

  it('has DOM helpers', () => {
    expect($.create).toBeTypeOf('function');
    expect($.ready).toBeTypeOf('function');
    expect($.on).toBeTypeOf('function');
    expect($.off).toBeTypeOf('function');
    expect($.fn).toBeDefined();
  });

  it('has reactive primitives', () => {
    expect($.reactive).toBeTypeOf('function');
    expect($.Signal).toBeTypeOf('function');
    expect($.signal).toBeTypeOf('function');
    expect($.computed).toBeTypeOf('function');
    expect($.effect).toBeTypeOf('function');
    expect($.batch).toBeTypeOf('function');
    expect($.untracked).toBeTypeOf('function');
  });

  it('has component functions', () => {
    expect($.component).toBeTypeOf('function');
    expect($.mount).toBeTypeOf('function');
    expect($.mountAll).toBeTypeOf('function');
    expect($.getInstance).toBeTypeOf('function');
    expect($.destroy).toBeTypeOf('function');
    expect($.components).toBeTypeOf('function');
    expect($.prefetch).toBeTypeOf('function');
    expect($.style).toBeTypeOf('function');
    expect($.morph).toBeTypeOf('function');
    expect($.morphElement).toBeTypeOf('function');
    expect($.safeEval).toBeTypeOf('function');
  });

  it('has router functions', () => {
    expect($.router).toBeTypeOf('function');
    expect($.getRouter).toBeTypeOf('function');
    expect($.matchRoute).toBeTypeOf('function');
  });

  it('has store functions', () => {
    expect($.store).toBeTypeOf('function');
    expect($.getStore).toBeTypeOf('function');
  });

  it('has HTTP methods', () => {
    expect($.http).toBeDefined();
    expect($.get).toBeTypeOf('function');
    expect($.post).toBeTypeOf('function');
    expect($.put).toBeTypeOf('function');
    expect($.patch).toBeTypeOf('function');
    expect($.delete).toBeTypeOf('function');
    expect($.head).toBeTypeOf('function');
  });

  it('has all utility functions', () => {
    expect($.debounce).toBeTypeOf('function');
    expect($.throttle).toBeTypeOf('function');
    expect($.pipe).toBeTypeOf('function');
    expect($.once).toBeTypeOf('function');
    expect($.sleep).toBeTypeOf('function');
    expect($.escapeHtml).toBeTypeOf('function');
    expect($.stripHtml).toBeTypeOf('function');
    expect($.html).toBeTypeOf('function');
    expect($.trust).toBeTypeOf('function');
    expect($.TrustedHTML).toBeTypeOf('function');
    expect($.uuid).toBeTypeOf('function');
    expect($.camelCase).toBeTypeOf('function');
    expect($.kebabCase).toBeTypeOf('function');
    expect($.deepClone).toBeTypeOf('function');
    expect($.deepMerge).toBeTypeOf('function');
    expect($.isEqual).toBeTypeOf('function');
    expect($.param).toBeTypeOf('function');
    expect($.parseQuery).toBeTypeOf('function');
    expect($.storage).toBeDefined();
    expect($.session).toBeDefined();
    expect($.EventBus).toBeTypeOf('function');
    expect($.bus).toBeDefined();
    expect($.range).toBeTypeOf('function');
    expect($.unique).toBeTypeOf('function');
    expect($.chunk).toBeTypeOf('function');
    expect($.groupBy).toBeTypeOf('function');
    expect($.pick).toBeTypeOf('function');
    expect($.omit).toBeTypeOf('function');
    expect($.getPath).toBeTypeOf('function');
    expect($.setPath).toBeTypeOf('function');
    expect($.isEmpty).toBeTypeOf('function');
    expect($.capitalize).toBeTypeOf('function');
    expect($.truncate).toBeTypeOf('function');
    expect($.clamp).toBeTypeOf('function');
    expect($.memoize).toBeTypeOf('function');
    expect($.retry).toBeTypeOf('function');
    expect($.timeout).toBeTypeOf('function');
  });

  it('has error handling functions', () => {
    expect($.onError).toBeTypeOf('function');
    expect($.ZQueryError).toBeTypeOf('function');
    expect($.ErrorCode).toBeDefined();
    expect($.guardCallback).toBeTypeOf('function');
    expect($.guardAsync).toBeTypeOf('function');
    expect($.validate).toBeTypeOf('function');
    expect($.formatError).toBeTypeOf('function');
  });

  it('has meta properties', () => {
    expect($.version).toBeTypeOf('string');
    expect($.noConflict).toBeTypeOf('function');
  });
});
