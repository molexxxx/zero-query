import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  debounce, throttle, pipe, once, sleep,
  escapeHtml, trust, uuid, camelCase, kebabCase,
  deepClone, deepMerge, isEqual, param, parseQuery,
  bus,
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
// Event bus
// ---------------------------------------------------------------------------

describe('bus (EventBus)', () => {
  beforeEach(() => { bus.clear(); });

  it('on/emit — fires handler for matching events', () => {
    const fn = vi.fn();
    bus.on('test', fn);
    bus.emit('test', 42);
    expect(fn).toHaveBeenCalledWith(42);
  });

  it('off — removes handler', () => {
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

  it('once — fires handler only once', () => {
    const fn = vi.fn();
    bus.once('test', fn);
    bus.emit('test', 'a');
    bus.emit('test', 'b');
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('clear — removes all handlers', () => {
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
