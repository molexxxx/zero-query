import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  debounce, throttle, pipe, once, sleep,
  escapeHtml, stripHtml, html, trust, uuid, camelCase, kebabCase,
  deepClone, deepMerge, isEqual, param, parseQuery,
  storage, session, bus,
  // New utilities
  range, unique, chunk, groupBy,
  pick, omit, getPath, setPath, isEmpty,
  capitalize, truncate,
  clamp,
  memoize,
  retry, timeout,
} from '../src/utils.js';


// ---------------------------------------------------------------------------
// Function utilities
// ---------------------------------------------------------------------------

describe('debounce', () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it('delays execution until after ms of inactivity', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced('a');
    debounced('b');
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith('b');
  });

  it('uses default 250ms delay', () => {
    const fn = vi.fn();
    const debounced = debounce(fn);
    debounced();
    vi.advanceTimersByTime(249);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('cancel() stops pending execution', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced();
    debounced.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });

  it('resets timer on subsequent calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced();
    vi.advanceTimersByTime(80);
    debounced();
    vi.advanceTimersByTime(80);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(20);
    expect(fn).toHaveBeenCalledOnce();
  });
});


describe('throttle', () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it('fires immediately on first call', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled('a');
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('delays subsequent calls within the window', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled('a');
    throttled('b');
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('b');
  });
});


describe('pipe', () => {
  it('composes functions left-to-right', () => {
    const add1 = x => x + 1;
    const double = x => x * 2;
    expect(pipe(add1, double)(3)).toBe(8);
  });

  it('handles a single function', () => {
    const identity = x => x;
    expect(pipe(identity)(42)).toBe(42);
  });

  it('handles no functions', () => {
    expect(pipe()(10)).toBe(10);
  });
});


describe('once', () => {
  it('only calls function once', () => {
    const fn = vi.fn(() => 42);
    const onceFn = once(fn);
    expect(onceFn()).toBe(42);
    expect(onceFn()).toBe(42);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('passes arguments to the first call', () => {
    const fn = vi.fn((a, b) => a + b);
    const onceFn = once(fn);
    expect(onceFn(1, 2)).toBe(3);
    expect(onceFn(10, 20)).toBe(3);
  });
});


describe('sleep', () => {
  it('returns a promise that resolves after ms', async () => {
    vi.useFakeTimers();
    const p = sleep(100);
    vi.advanceTimersByTime(100);
    await expect(p).resolves.toBeUndefined();
  });
});


// ---------------------------------------------------------------------------
// String utilities
// ---------------------------------------------------------------------------

describe('escapeHtml', () => {
  it('escapes &, <, >, ", \'', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('converts non-strings to string', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(null)).toBe('null');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});


describe('stripHtml', () => {
  it('removes HTML tags from a string', () => {
    expect(stripHtml('<p>Hello <b>World</b></p>')).toBe('Hello World');
  });

  it('handles self-closing tags', () => {
    expect(stripHtml('Line one<br/>Line two')).toBe('Line oneLine two');
  });

  it('handles attributes inside tags', () => {
    expect(stripHtml('<a href="https://example.com" class="link">click</a>')).toBe('click');
  });

  it('strips nested tags', () => {
    expect(stripHtml('<div><p><span>deep</span></p></div>')).toBe('deep');
  });

  it('handles string with no tags', () => {
    expect(stripHtml('no tags here')).toBe('no tags here');
  });

  it('handles empty string', () => {
    expect(stripHtml('')).toBe('');
  });

  it('converts non-strings to string first', () => {
    expect(stripHtml(42)).toBe('42');
    expect(stripHtml(null)).toBe('null');
  });

  it('preserves text content between multiple tags', () => {
    expect(stripHtml('<li>one</li><li>two</li><li>three</li>')).toBe('onetwothree');
  });

  it('strips angle-bracket patterns that look like tags', () => {
    expect(stripHtml('a < b > c')).toBe('a  c');
    expect(stripHtml('5 > 3 and 2 < 4')).toBe('5 > 3 and 2 < 4');
  });
});


describe('trust', () => {
  it('returns a TrustedHTML instance', () => {
    const t = trust('<b>bold</b>');
    expect(t.toString()).toBe('<b>bold</b>');
  });
});


describe('uuid', () => {
  it('returns a string', () => {
    expect(typeof uuid()).toBe('string');
  });

  it('returns different values on successive calls', () => {
    const a = uuid();
    const b = uuid();
    expect(a).not.toBe(b);
  });

  it('has valid UUID v4 format', () => {
    expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});


describe('camelCase', () => {
  it('converts kebab-case to camelCase', () => {
    expect(camelCase('my-component')).toBe('myComponent');
    expect(camelCase('a-b-c')).toBe('aBC');
  });

  it('handles no hyphens', () => {
    expect(camelCase('hello')).toBe('hello');
  });
});


describe('kebabCase', () => {
  it('converts camelCase to kebab-case', () => {
    expect(kebabCase('myComponent')).toBe('my-component');
    expect(kebabCase('fooBarBaz')).toBe('foo-bar-baz');
  });

  it('handles already kebab-case', () => {
    expect(kebabCase('hello')).toBe('hello');
  });
});


// ---------------------------------------------------------------------------
// Object utilities
// ---------------------------------------------------------------------------

describe('deepClone', () => {
  it('creates an independent copy', () => {
    const obj = { a: 1, b: { c: 2 } };
    const clone = deepClone(obj);
    clone.b.c = 99;
    expect(obj.b.c).toBe(2);
  });

  it('handles arrays', () => {
    const arr = [1, [2, 3]];
    const clone = deepClone(arr);
    clone[1][0] = 99;
    expect(arr[1][0]).toBe(2);
  });
});


describe('deepMerge', () => {
  it('deeply merges objects', () => {
    const a = { x: 1, nested: { y: 2 } };
    const b = { nested: { z: 3 }, w: 4 };
    const result = deepMerge(a, b);
    expect(result).toEqual({ x: 1, nested: { y: 2, z: 3 }, w: 4 });
  });

  it('overwrites non-object values', () => {
    const result = deepMerge({ a: 1 }, { a: 2 });
    expect(result.a).toBe(2);
  });

  it('handles arrays by replacing them', () => {
    const result = deepMerge({ a: [1, 2] }, { a: [3, 4] });
    expect(result.a).toEqual([3, 4]);
  });
});


describe('isEqual', () => {
  it('returns true for equal primitives', () => {
    expect(isEqual(1, 1)).toBe(true);
    expect(isEqual('a', 'a')).toBe(true);
    expect(isEqual(null, null)).toBe(true);
  });

  it('returns false for different primitives', () => {
    expect(isEqual(1, 2)).toBe(false);
    expect(isEqual('a', 'b')).toBe(false);
  });

  it('returns true for deeply equal objects', () => {
    expect(isEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
  });

  it('returns false for objects with different keys', () => {
    expect(isEqual({ a: 1 }, { b: 1 })).toBe(false);
  });

  it('returns false for objects with different lengths', () => {
    expect(isEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('handles null comparisons', () => {
    expect(isEqual(null, {})).toBe(false);
    expect(isEqual({}, null)).toBe(false);
  });

  it('distinguishes arrays from plain objects with same indices', () => {
    expect(isEqual([1, 2], { 0: 1, 1: 2 })).toBe(false);
    expect(isEqual({ 0: 'a' }, ['a'])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deepMerge - circular reference safety
// ---------------------------------------------------------------------------

describe('deepMerge - circular reference safety', () => {
  it('does not infinite-loop on circular source', () => {
    const a = { x: 1 };
    const b = { y: 2 };
    b.self = b; // circular
    const result = deepMerge(a, b);
    expect(result.x).toBe(1);
    expect(result.y).toBe(2);
    // circular ref is simply not followed again
  });

  it('does not infinite-loop on circular target', () => {
    const a = { x: 1 };
    a.self = a;
    const b = { y: 2 };
    const result = deepMerge(a, b);
    expect(result.y).toBe(2);
  });
});


// ---------------------------------------------------------------------------
// URL utilities
// ---------------------------------------------------------------------------

describe('param', () => {
  it('serializes object to query string', () => {
    expect(param({ a: '1', b: '2' })).toBe('a=1&b=2');
  });

  it('handles empty object', () => {
    expect(param({})).toBe('');
  });
});


describe('parseQuery', () => {
  it('parses query string to object', () => {
    expect(parseQuery('a=1&b=2')).toEqual({ a: '1', b: '2' });
  });

  it('handles leading ?', () => {
    expect(parseQuery('?foo=bar')).toEqual({ foo: 'bar' });
  });

  it('handles empty string', () => {
    expect(parseQuery('')).toEqual({});
  });
});


// ---------------------------------------------------------------------------
// html template tag
// ---------------------------------------------------------------------------

describe('html template tag', () => {
  it('auto-escapes interpolated values', () => {
    const userInput = '<script>alert("xss")</script>';
    const result = html`<div>${userInput}</div>`;
    expect(result).toContain('&lt;script&gt;');
    expect(result).not.toContain('<script>');
  });

  it('does not escape trusted HTML', () => {
    const safe = trust('<b>bold</b>');
    const result = html`<div>${safe}</div>`;
    expect(result).toContain('<b>bold</b>');
  });

  it('handles null/undefined values', () => {
    const result = html`<span>${null}</span>`;
    expect(result).toBe('<span></span>');
  });
});


// ---------------------------------------------------------------------------
// storage helpers
// ---------------------------------------------------------------------------

describe('storage (localStorage wrapper)', () => {
  beforeEach(() => { localStorage.clear(); });

  it('set and get a value', () => {
    storage.set('key', { a: 1 });
    expect(storage.get('key')).toEqual({ a: 1 });
  });

  it('returns fallback for missing key', () => {
    expect(storage.get('missing', 'default')).toBe('default');
  });

  it('returns null as default fallback', () => {
    expect(storage.get('missing')).toBeNull();
  });

  it('remove deletes a key', () => {
    storage.set('key', 42);
    storage.remove('key');
    expect(storage.get('key')).toBeNull();
  });

  it('clear removes all keys', () => {
    storage.set('a', 1);
    storage.set('b', 2);
    storage.clear();
    expect(storage.get('a')).toBeNull();
    expect(storage.get('b')).toBeNull();
  });

  it('handles non-JSON values gracefully', () => {
    localStorage.setItem('bad', '{not json}');
    expect(storage.get('bad', 'fallback')).toBe('fallback');
  });
});


describe('session (sessionStorage wrapper)', () => {
  beforeEach(() => { sessionStorage.clear(); });

  it('set and get a value', () => {
    session.set('key', [1, 2, 3]);
    expect(session.get('key')).toEqual([1, 2, 3]);
  });

  it('returns fallback for missing key', () => {
    expect(session.get('missing', 'default')).toBe('default');
  });

  it('remove deletes a key', () => {
    session.set('key', 'val');
    session.remove('key');
    expect(session.get('key')).toBeNull();
  });

  it('clear removes all keys', () => {
    session.set('a', 1);
    session.clear();
    expect(session.get('a')).toBeNull();
  });
});


// ---------------------------------------------------------------------------
// Event bus
// ---------------------------------------------------------------------------

describe('bus (event bus)', () => {
  beforeEach(() => { bus.clear(); });

  it('on() and emit()', () => {
    const fn = vi.fn();
    bus.on('test', fn);
    bus.emit('test', 'data');
    expect(fn).toHaveBeenCalledWith('data');
  });

  it('off() removes handler', () => {
    const fn = vi.fn();
    bus.on('test', fn);
    bus.off('test', fn);
    bus.emit('test');
    expect(fn).not.toHaveBeenCalled();
  });

  it('on() returns unsubscribe function', () => {
    const fn = vi.fn();
    const unsub = bus.on('test', fn);
    unsub();
    bus.emit('test');
    expect(fn).not.toHaveBeenCalled();
  });

  it('once() fires handler only once', () => {
    const fn = vi.fn();
    bus.once('test', fn);
    bus.emit('test', 'first');
    bus.emit('test', 'second');
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith('first');
  });

  it('emit with multiple args', () => {
    const fn = vi.fn();
    bus.on('test', fn);
    bus.emit('test', 1, 2, 3);
    expect(fn).toHaveBeenCalledWith(1, 2, 3);
  });

  it('multiple handlers on same event', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    bus.on('test', fn1);
    bus.on('test', fn2);
    bus.emit('test');
    expect(fn1).toHaveBeenCalledOnce();
    expect(fn2).toHaveBeenCalledOnce();
  });

  it('clear() removes all handlers', () => {
    const fn = vi.fn();
    bus.on('a', fn);
    bus.on('b', fn);
    bus.clear();
    bus.emit('a');
    bus.emit('b');
    expect(fn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Event bus
// ---------------------------------------------------------------------------

describe('bus (EventBus)', () => {
  beforeEach(() => { bus.clear(); });

  it('on/emit - fires handler for matching events', () => {
    const fn = vi.fn();
    bus.on('test', fn);
    bus.emit('test', 42);
    expect(fn).toHaveBeenCalledWith(42);
  });

  it('off - removes handler', () => {
    const fn = vi.fn();
    bus.on('test', fn);
    bus.off('test', fn);
    bus.emit('test');
    expect(fn).not.toHaveBeenCalled();
  });

  it('on() returns unsubscribe function', () => {
    const fn = vi.fn();
    const unsub = bus.on('test', fn);
    unsub();
    bus.emit('test');
    expect(fn).not.toHaveBeenCalled();
  });

  it('once - fires handler only once', () => {
    const fn = vi.fn();
    bus.once('test', fn);
    bus.emit('test', 'a');
    bus.emit('test', 'b');
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('clear - removes all handlers', () => {
    const fn = vi.fn();
    bus.on('a', fn);
    bus.on('b', fn);
    bus.clear();
    bus.emit('a');
    bus.emit('b');
    expect(fn).not.toHaveBeenCalled();
  });

  it('emit with no handlers does not throw', () => {
    expect(() => bus.emit('nonexistent')).not.toThrow();
  });
});


// ===========================================================================
// throttle - window reset
// ===========================================================================

describe('throttle - edge cases', () => {
  it('fires trailing call after wait period', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled('a');             // immediate
    throttled('b');             // queued
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('b');
    vi.useRealTimers();
  });
});


// ===========================================================================
// deepClone - edge cases
// ===========================================================================

describe('deepClone - edge cases', () => {
  it('clones nested arrays', () => {
    const arr = [[1, 2], [3, 4]];
    const clone = deepClone(arr);
    expect(clone).toEqual(arr);
    clone[0][0] = 99;
    expect(arr[0][0]).toBe(1);
  });

  it('handles null values', () => {
    expect(deepClone({ a: null })).toEqual({ a: null });
  });
});


// ===========================================================================
// deepMerge - multiple sources
// ===========================================================================

describe('deepMerge - edge cases', () => {
  it('merges from multiple sources', () => {
    const result = deepMerge({}, { a: 1 }, { b: 2 }, { c: 3 });
    expect(result).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('later sources override earlier', () => {
    const result = deepMerge({}, { a: 1 }, { a: 2 });
    expect(result).toEqual({ a: 2 });
  });

  it('handles arrays (replaces, not merges)', () => {
    const result = deepMerge({}, { arr: [1, 2] }, { arr: [3] });
    expect(result.arr).toEqual([3]);
  });
});


// ===========================================================================
// isEqual - deeply nested
// ===========================================================================

describe('isEqual - edge cases', () => {
  it('deeply nested equal objects', () => {
    expect(isEqual({ a: { b: { c: 1 } } }, { a: { b: { c: 1 } } })).toBe(true);
  });

  it('arrays of objects', () => {
    expect(isEqual([{ a: 1 }], [{ a: 1 }])).toBe(true);
    expect(isEqual([{ a: 1 }], [{ a: 2 }])).toBe(false);
  });

  it('empty arrays equal', () => {
    expect(isEqual([], [])).toBe(true);
  });

  it('null vs object', () => {
    expect(isEqual(null, { a: 1 })).toBe(false);
    expect(isEqual({ a: 1 }, null)).toBe(false);
  });

  it('different types', () => {
    expect(isEqual('1', 1)).toBe(false);
  });

  it('array vs object', () => {
    expect(isEqual([], {})).toBe(false);
  });
});


// ===========================================================================
// camelCase / kebabCase - edge cases
// ===========================================================================

describe('camelCase / kebabCase - edge cases', () => {
  it('camelCase single word', () => {
    expect(camelCase('hello')).toBe('hello');
  });

  it('camelCase already camel', () => {
    expect(camelCase('helloWorld')).toBe('helloWorld');
  });

  it('kebabCase single word lowercase', () => {
    expect(kebabCase('hello')).toBe('hello');
  });

  it('kebabCase multiple humps', () => {
    expect(kebabCase('myComponentName')).toBe('my-component-name');
  });
});


// ===========================================================================
// html tag - escaping
// ===========================================================================

describe('html tag - edge cases', () => {
  it('handles null interp value', () => {
    const result = html`<div>${null}</div>`;
    expect(result).toBe('<div></div>');
  });

  it('handles undefined interp value', () => {
    const result = html`<div>${undefined}</div>`;
    expect(result).toBe('<div></div>');
  });

  it('escapes multiple interpolations', () => {
    const a = '<b>';
    const b = '&';
    const result = html`${a} and ${b}`;
    expect(result).toContain('&lt;b&gt;');
    expect(result).toContain('&amp;');
  });
});


// ===========================================================================
// storage - error handling
// ===========================================================================

describe('storage - parse error fallback', () => {
  it('returns fallback when JSON.parse fails', () => {
    localStorage.setItem('bad', '{invalid json');
    expect(storage.get('bad', 'default')).toBe('default');
    localStorage.removeItem('bad');
  });
});


// ===========================================================================
// NEW UTILITIES - Array
// ===========================================================================

describe('range', () => {
  it('generates range from 0 to n-1 with single arg', () => {
    expect(range(5)).toEqual([0, 1, 2, 3, 4]);
  });

  it('generates range from start to end-1', () => {
    expect(range(2, 6)).toEqual([2, 3, 4, 5]);
  });

  it('generates range with custom step', () => {
    expect(range(0, 10, 3)).toEqual([0, 3, 6, 9]);
  });

  it('handles negative step (descending)', () => {
    expect(range(5, 0, -1)).toEqual([5, 4, 3, 2, 1]);
  });

  it('returns empty array for zero or negative count', () => {
    expect(range(0)).toEqual([]);
    expect(range(-3)).toEqual([]);
  });

  it('returns empty array when step goes wrong direction', () => {
    expect(range(0, 5, -1)).toEqual([]);
    expect(range(5, 0, 1)).toEqual([]);
  });

  it('handles step of 1 as default', () => {
    expect(range(1, 4)).toEqual([1, 2, 3]);
  });

  it('handles float steps', () => {
    const r = range(0, 1, 0.25);
    expect(r.length).toBe(4);
    expect(r[0]).toBeCloseTo(0);
    expect(r[3]).toBeCloseTo(0.75);
  });
});


describe('unique', () => {
  it('deduplicates primitive arrays', () => {
    expect(unique([1, 2, 2, 3, 1, 3])).toEqual([1, 2, 3]);
  });

  it('preserves order (first occurrence)', () => {
    expect(unique([3, 1, 2, 1, 3])).toEqual([3, 1, 2]);
  });

  it('handles strings', () => {
    expect(unique(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('deduplicates by key function', () => {
    const items = [{ id: 1, n: 'a' }, { id: 2, n: 'b' }, { id: 1, n: 'c' }];
    const result = unique(items, item => item.id);
    expect(result).toEqual([{ id: 1, n: 'a' }, { id: 2, n: 'b' }]);
  });

  it('handles empty array', () => {
    expect(unique([])).toEqual([]);
  });
});


describe('chunk', () => {
  it('splits array into chunks of given size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns single chunk when size >= length', () => {
    expect(chunk([1, 2, 3], 5)).toEqual([[1, 2, 3]]);
  });

  it('handles exact division', () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });

  it('handles chunk size of 1', () => {
    expect(chunk([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
  });

  it('returns empty array for empty input', () => {
    expect(chunk([], 3)).toEqual([]);
  });
});


describe('groupBy', () => {
  it('groups by string key function', () => {
    const items = [
      { type: 'fruit', name: 'apple' },
      { type: 'veg', name: 'carrot' },
      { type: 'fruit', name: 'banana' },
    ];
    const result = groupBy(items, item => item.type);
    expect(result).toEqual({
      fruit: [{ type: 'fruit', name: 'apple' }, { type: 'fruit', name: 'banana' }],
      veg: [{ type: 'veg', name: 'carrot' }],
    });
  });

  it('groups by computed value', () => {
    const nums = [1, 2, 3, 4, 5, 6];
    const result = groupBy(nums, n => n % 2 === 0 ? 'even' : 'odd');
    expect(result.even).toEqual([2, 4, 6]);
    expect(result.odd).toEqual([1, 3, 5]);
  });

  it('handles empty array', () => {
    expect(groupBy([], () => 'key')).toEqual({});
  });
});


// ===========================================================================
// NEW UTILITIES - Object
// ===========================================================================

describe('pick', () => {
  it('picks specified keys from object', () => {
    const obj = { a: 1, b: 2, c: 3, d: 4 };
    expect(pick(obj, ['a', 'c'])).toEqual({ a: 1, c: 3 });
  });

  it('ignores keys that do not exist', () => {
    expect(pick({ a: 1 }, ['a', 'z'])).toEqual({ a: 1 });
  });

  it('returns empty object for empty keys', () => {
    expect(pick({ a: 1 }, [])).toEqual({});
  });

  it('handles undefined/null values in picked keys', () => {
    expect(pick({ a: null, b: undefined, c: 0 }, ['a', 'b', 'c'])).toEqual({ a: null, b: undefined, c: 0 });
  });
});


describe('omit', () => {
  it('omits specified keys from object', () => {
    const obj = { a: 1, b: 2, c: 3, d: 4 };
    expect(omit(obj, ['b', 'd'])).toEqual({ a: 1, c: 3 });
  });

  it('returns full object when no keys match', () => {
    expect(omit({ a: 1, b: 2 }, ['z'])).toEqual({ a: 1, b: 2 });
  });

  it('returns empty object when all keys omitted', () => {
    expect(omit({ a: 1, b: 2 }, ['a', 'b'])).toEqual({});
  });
});


describe('getPath', () => {
  it('gets nested value by dot path', () => {
    const obj = { a: { b: { c: 42 } } };
    expect(getPath(obj, 'a.b.c')).toBe(42);
  });

  it('gets top-level value', () => {
    expect(getPath({ x: 10 }, 'x')).toBe(10);
  });

  it('returns fallback for missing path', () => {
    expect(getPath({ a: 1 }, 'b.c', 'default')).toBe('default');
  });

  it('returns undefined by default for missing path', () => {
    expect(getPath({}, 'a.b')).toBeUndefined();
  });

  it('handles null intermediate values', () => {
    expect(getPath({ a: null }, 'a.b', 'nope')).toBe('nope');
  });

  it('works with array indices', () => {
    const obj = { items: ['zero', 'one', 'two'] };
    expect(getPath(obj, 'items.1')).toBe('one');
  });
});


describe('setPath', () => {
  it('sets nested value by dot path', () => {
    const obj = { a: { b: { c: 1 } } };
    setPath(obj, 'a.b.c', 99);
    expect(obj.a.b.c).toBe(99);
  });

  it('creates intermediate objects when missing', () => {
    const obj = {};
    setPath(obj, 'a.b.c', 42);
    expect(obj.a.b.c).toBe(42);
  });

  it('sets top-level value', () => {
    const obj = {};
    setPath(obj, 'x', 10);
    expect(obj.x).toBe(10);
  });

  it('overwrites existing intermediate non-object', () => {
    const obj = { a: 5 };
    setPath(obj, 'a.b', 10);
    expect(obj.a.b).toBe(10);
  });
});


describe('isEmpty', () => {
  it('returns true for null and undefined', () => {
    expect(isEmpty(null)).toBe(true);
    expect(isEmpty(undefined)).toBe(true);
  });

  it('returns true for empty string', () => {
    expect(isEmpty('')).toBe(true);
  });

  it('returns true for empty array', () => {
    expect(isEmpty([])).toBe(true);
  });

  it('returns true for empty object', () => {
    expect(isEmpty({})).toBe(true);
  });

  it('returns false for non-empty string', () => {
    expect(isEmpty('hello')).toBe(false);
  });

  it('returns false for non-empty array', () => {
    expect(isEmpty([1])).toBe(false);
  });

  it('returns false for non-empty object', () => {
    expect(isEmpty({ a: 1 })).toBe(false);
  });

  it('returns false for number zero', () => {
    expect(isEmpty(0)).toBe(false);
  });

  it('returns false for boolean false', () => {
    expect(isEmpty(false)).toBe(false);
  });

  it('returns true for empty Map and Set', () => {
    expect(isEmpty(new Map())).toBe(true);
    expect(isEmpty(new Set())).toBe(true);
  });

  it('returns false for non-empty Map and Set', () => {
    expect(isEmpty(new Map([['a', 1]]))).toBe(false);
    expect(isEmpty(new Set([1]))).toBe(false);
  });
});


// ===========================================================================
// NEW UTILITIES - String
// ===========================================================================

describe('capitalize', () => {
  it('capitalizes first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
  });

  it('handles single character', () => {
    expect(capitalize('a')).toBe('A');
  });

  it('handles empty string', () => {
    expect(capitalize('')).toBe('');
  });

  it('lowercases the rest', () => {
    expect(capitalize('hELLO')).toBe('Hello');
  });

  it('handles already capitalized', () => {
    expect(capitalize('Hello')).toBe('Hello');
  });
});


describe('truncate', () => {
  it('truncates long strings with ellipsis', () => {
    expect(truncate('Hello, World!', 8)).toBe('Hello, \u2026');
  });

  it('does not truncate short strings', () => {
    expect(truncate('Hi', 10)).toBe('Hi');
  });

  it('uses custom suffix', () => {
    expect(truncate('Hello, World!', 8, '---')).toBe('Hello---');
  });

  it('handles exact length (no truncation needed)', () => {
    expect(truncate('Hello', 5)).toBe('Hello');
  });

  it('handles empty string', () => {
    expect(truncate('', 5)).toBe('');
  });

  it('handles suffix longer than maxLen gracefully', () => {
    expect(truncate('Hello, World!', 2)).toBe('H\u2026');
  });
});


// ===========================================================================
// NEW UTILITIES - Number
// ===========================================================================

describe('clamp', () => {
  it('clamps value below min to min', () => {
    expect(clamp(-5, 0, 100)).toBe(0);
  });

  it('clamps value above max to max', () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });

  it('returns value when within range', () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });

  it('handles min === max', () => {
    expect(clamp(50, 10, 10)).toBe(10);
  });

  it('handles negative ranges', () => {
    expect(clamp(-50, -100, -10)).toBe(-50);
    expect(clamp(-200, -100, -10)).toBe(-100);
  });

  it('clamps at boundaries', () => {
    expect(clamp(0, 0, 100)).toBe(0);
    expect(clamp(100, 0, 100)).toBe(100);
  });
});


// ===========================================================================
// NEW UTILITIES - Function
// ===========================================================================

describe('memoize', () => {
  it('caches results for same arguments', () => {
    const fn = vi.fn(x => x * 2);
    const memoized = memoize(fn);
    expect(memoized(5)).toBe(10);
    expect(memoized(5)).toBe(10);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('recomputes for different arguments', () => {
    const fn = vi.fn(x => x * 2);
    const memoized = memoize(fn);
    expect(memoized(5)).toBe(10);
    expect(memoized(3)).toBe(6);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('uses custom key function', () => {
    const fn = vi.fn((a, b) => a + b);
    const memoized = memoize(fn, (a, b) => `${a}:${b}`);
    expect(memoized(1, 2)).toBe(3);
    expect(memoized(1, 2)).toBe(3);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(memoized(2, 1)).toBe(3);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('has .clear() to reset cache', () => {
    const fn = vi.fn(x => x * 2);
    const memoized = memoize(fn);
    memoized(5);
    memoized.clear();
    memoized(5);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('respects maxSize option', () => {
    const fn = vi.fn(x => x * 2);
    const memoized = memoize(fn, { maxSize: 2 });
    memoized(1);
    memoized(2);
    memoized(3); // evicts 1
    expect(fn).toHaveBeenCalledTimes(3);
    memoized(2); // still cached
    expect(fn).toHaveBeenCalledTimes(3);
    memoized(1); // evicted, recomputes
    expect(fn).toHaveBeenCalledTimes(4);
  });
});


// ===========================================================================
// NEW UTILITIES - Async
// ===========================================================================

describe('retry', () => {
  it('resolves on first success', async () => {
    const fn = vi.fn(async () => 42);
    const result = await retry(fn);
    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 3) throw new Error('fail');
      return 'ok';
    };
    const result = await retry(fn, { attempts: 3, delay: 0 });
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('throws after exhausting all attempts', async () => {
    const fn = async () => { throw new Error('always fails'); };
    await expect(retry(fn, { attempts: 3, delay: 0 })).rejects.toThrow('always fails');
  });

  it('passes attempt number to function', async () => {
    const fn = vi.fn(async (attempt) => attempt);
    await retry(fn, { attempts: 1, delay: 0 });
    expect(fn).toHaveBeenCalledWith(1);
  });

  it('uses exponential backoff when configured', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const fn = async () => { calls++; if (calls < 3) throw new Error('fail'); return 'done'; };
    const p = retry(fn, { attempts: 3, delay: 100, backoff: 2 });
    // First call happens immediately, fails
    await vi.advanceTimersByTimeAsync(0);
    // Second call after 100ms delay, fails
    await vi.advanceTimersByTimeAsync(100);
    // Third call after 200ms delay (100 * 2), succeeds
    await vi.advanceTimersByTimeAsync(200);
    const result = await p;
    expect(result).toBe('done');
    vi.useRealTimers();
  });
});


describe('timeout', () => {
  it('resolves if promise completes before timeout', async () => {
    const p = Promise.resolve(42);
    const result = await timeout(p, 1000);
    expect(result).toBe(42);
  });

  it('rejects if promise exceeds timeout', async () => {
    vi.useFakeTimers();
    const p = new Promise(() => {}); // never resolves
    const tp = timeout(p, 100);
    vi.advanceTimersByTime(100);
    await expect(tp).rejects.toThrow('Timed out');
    vi.useRealTimers();
  });

  it('uses custom error message', async () => {
    vi.useFakeTimers();
    const p = new Promise(() => {});
    const tp = timeout(p, 100, 'Custom timeout');
    vi.advanceTimersByTime(100);
    await expect(tp).rejects.toThrow('Custom timeout');
    vi.useRealTimers();
  });

  it('clears timer on successful resolution', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    await timeout(Promise.resolve('ok'), 5000);
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});


// ===========================================================================
// memoize - LRU behaviour
// ===========================================================================

describe('memoize - LRU eviction', () => {
  it('promotes recently-read entries so they survive eviction', () => {
    const fn = vi.fn(x => x * 2);
    const mem = memoize(fn, { maxSize: 3 });

    mem(1); // cache: [1]
    mem(2); // cache: [1, 2]
    mem(3); // cache: [1, 2, 3]

    // Access 1 to promote it (LRU moves it to newest)
    mem(1); // cache: [2, 3, 1]
    expect(fn).toHaveBeenCalledTimes(3); // still cached, no recompute

    // Insert 4 -> should evict 2 (least recently used), NOT 1
    mem(4); // cache: [3, 1, 4]
    expect(fn).toHaveBeenCalledTimes(4);

    // 1 should still be cached (was promoted)
    mem(1);
    expect(fn).toHaveBeenCalledTimes(4); // no recompute

    // 2 should be evicted
    mem(2);
    expect(fn).toHaveBeenCalledTimes(5); // recomputation
  });

  it('evicts in LRU order, not insertion order', () => {
    const fn = vi.fn(x => x);
    const mem = memoize(fn, { maxSize: 2 });

    mem('a'); // [a]
    mem('b'); // [a, b]

    // Read 'a' - makes 'b' the LRU
    mem('a'); // [b, a]

    // Insert 'c' - should evict 'b', not 'a'
    mem('c'); // [a, c]

    // 'a' still cached
    mem('a');
    expect(fn).toHaveBeenCalledTimes(3); // a, b, c

    // 'b' was evicted
    mem('b');
    expect(fn).toHaveBeenCalledTimes(4);
  });
});


// ===========================================================================
// deepClone - enhanced types
// ===========================================================================

describe('deepClone - enhanced types', () => {
  it('clones Date objects', () => {
    const date = new Date('2024-01-15T12:00:00Z');
    const clone = deepClone(date);
    expect(clone).toEqual(date);
    expect(clone).not.toBe(date);
    expect(clone instanceof Date).toBe(true);
    expect(clone.getTime()).toBe(date.getTime());
  });

  it('clones nested Dates', () => {
    const obj = { created: new Date('2024-01-15T12:00:00Z'), meta: { updated: new Date('2024-06-15T12:00:00Z') } };
    const clone = deepClone(obj);
    clone.created.setFullYear(2000);
    expect(obj.created.getFullYear()).toBe(2024);
  });

  it('clones RegExp', () => {
    const re = /hello/gi;
    const clone = deepClone(re);
    expect(clone).toEqual(re);
    expect(clone).not.toBe(re);
    expect(clone.source).toBe('hello');
    expect(clone.flags).toBe('gi');
  });

  it('clones Map', () => {
    const map = new Map([['a', 1], ['b', { deep: true }]]);
    const clone = deepClone(map);
    expect(clone).not.toBe(map);
    expect(clone.get('a')).toBe(1);
    clone.get('b').deep = false;
    expect(map.get('b').deep).toBe(true);
  });

  it('clones Set', () => {
    const set = new Set([1, 2, { x: 3 }]);
    const clone = deepClone(set);
    expect(clone).not.toBe(set);
    expect(clone.size).toBe(3);
    expect(clone.has(1)).toBe(true);
    expect(clone.has(2)).toBe(true);
  });

  it('handles undefined values in objects', () => {
    const obj = { a: 1, b: undefined, c: 'hello' };
    const clone = deepClone(obj);
    expect(clone.b).toBeUndefined();
    expect('b' in clone).toBe(true);
  });

  it('handles null values', () => {
    const obj = { a: null, b: { c: null } };
    const clone = deepClone(obj);
    expect(clone.a).toBeNull();
    expect(clone.b.c).toBeNull();
  });

  it('handles circular references', () => {
    const obj = { a: 1 };
    obj.self = obj;
    const clone = deepClone(obj);
    expect(clone.a).toBe(1);
    expect(clone.self).toBe(clone);
    expect(clone.self).not.toBe(obj);
  });

  it('handles nested circular references', () => {
    const a = { name: 'a' };
    const b = { name: 'b', ref: a };
    a.ref = b;
    const clone = deepClone(a);
    expect(clone.name).toBe('a');
    expect(clone.ref.name).toBe('b');
    expect(clone.ref.ref).toBe(clone);
  });
});
