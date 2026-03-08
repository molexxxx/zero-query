import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reactive, Signal, signal, computed, effect } from '../src/reactive.js';


// ---------------------------------------------------------------------------
// reactive()
// ---------------------------------------------------------------------------

describe('reactive', () => {
  it('triggers onChange when a property is set', () => {
    const fn = vi.fn();
    const obj = reactive({ count: 0 }, fn);
    obj.count = 5;
    expect(fn).toHaveBeenCalledWith('count', 5, 0);
  });

  it('does not trigger onChange when value is the same', () => {
    const fn = vi.fn();
    const obj = reactive({ count: 0 }, fn);
    obj.count = 0;
    expect(fn).not.toHaveBeenCalled();
  });

  it('returns non-objects as-is', () => {
    expect(reactive(42, vi.fn())).toBe(42);
    expect(reactive('hello', vi.fn())).toBe('hello');
    expect(reactive(null, vi.fn())).toBe(null);
  });

  it('supports deep nested property access', () => {
    const fn = vi.fn();
    const obj = reactive({ user: { name: 'Tony' } }, fn);
    obj.user.name = 'Sam';
    expect(fn).toHaveBeenCalledWith('name', 'Sam', 'Tony');
  });

  it('tracks __isReactive and __raw', () => {
    const fn = vi.fn();
    const raw = { x: 1 };
    const obj = reactive(raw, fn);
    expect(obj.__isReactive).toBe(true);
    expect(obj.__raw).toBe(raw);
  });

  it('triggers onChange on deleteProperty', () => {
    const fn = vi.fn();
    const obj = reactive({ x: 1 }, fn);
    delete obj.x;
    expect(fn).toHaveBeenCalledWith('x', undefined, 1);
  });

  it('caches child proxies (same reference on repeated access)', () => {
    const fn = vi.fn();
    const obj = reactive({ nested: { a: 1 } }, fn);
    const first = obj.nested;
    const second = obj.nested;
    expect(first).toBe(second);
  });

  it('handles onChange gracefully when onChange is not a function', () => {
    // Should not throw — error is reported and a no-op is used
    expect(() => {
      const obj = reactive({ x: 1 }, 'not a function');
      obj.x = 2;
    }).not.toThrow();
  });

  it('does not crash when onChange callback throws', () => {
    const bad = vi.fn(() => { throw new Error('boom'); });
    const obj = reactive({ x: 1 }, bad);
    expect(() => { obj.x = 2; }).not.toThrow();
    expect(bad).toHaveBeenCalled();
  });
});


// ---------------------------------------------------------------------------
// Signal
// ---------------------------------------------------------------------------

describe('Signal', () => {
  it('stores and retrieves a value', () => {
    const s = new Signal(10);
    expect(s.value).toBe(10);
  });

  it('notifies subscribers on value change', () => {
    const s = new Signal(0);
    const fn = vi.fn();
    s.subscribe(fn);
    s.value = 1;
    expect(fn).toHaveBeenCalledOnce();
  });

  it('does not notify when value is the same', () => {
    const s = new Signal(5);
    const fn = vi.fn();
    s.subscribe(fn);
    s.value = 5;
    expect(fn).not.toHaveBeenCalled();
  });

  it('subscribe returns an unsubscribe function', () => {
    const s = new Signal(0);
    const fn = vi.fn();
    const unsub = s.subscribe(fn);
    unsub();
    s.value = 1;
    expect(fn).not.toHaveBeenCalled();
  });

  it('peek() returns value without tracking', () => {
    const s = new Signal(42);
    expect(s.peek()).toBe(42);
  });

  it('toString() returns string representation of value', () => {
    const s = new Signal(123);
    expect(s.toString()).toBe('123');
  });

  it('does not crash when a subscriber throws', () => {
    const s = new Signal(0);
    s.subscribe(() => { throw new Error('oops'); });
    expect(() => { s.value = 1; }).not.toThrow();
  });
});


// ---------------------------------------------------------------------------
// signal() factory
// ---------------------------------------------------------------------------

describe('signal()', () => {
  it('returns a Signal instance', () => {
    const s = signal(0);
    expect(s).toBeInstanceOf(Signal);
    expect(s.value).toBe(0);
  });
});


// ---------------------------------------------------------------------------
// computed()
// ---------------------------------------------------------------------------

describe('computed()', () => {
  it('derives value from other signals', () => {
    const count = signal(2);
    const doubled = computed(() => count.value * 2);
    expect(doubled.value).toBe(4);
  });

  it('updates when dependency changes', () => {
    const a = signal(1);
    const b = signal(2);
    const sum = computed(() => a.value + b.value);
    expect(sum.value).toBe(3);
    a.value = 10;
    expect(sum.value).toBe(12);
  });
});


// ---------------------------------------------------------------------------
// effect()
// ---------------------------------------------------------------------------

describe('effect()', () => {
  it('runs the effect function immediately', () => {
    const fn = vi.fn();
    effect(fn);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('re-runs when a tracked signal changes', () => {
    const s = signal(0);
    const log = vi.fn();
    effect(() => { log(s.value); });
    expect(log).toHaveBeenCalledWith(0);
    s.value = 1;
    expect(log).toHaveBeenCalledWith(1);
    expect(log).toHaveBeenCalledTimes(2);
  });

  it('does not crash when effect function throws', () => {
    expect(() => {
      effect(() => { throw new Error('fail'); });
    }).not.toThrow();
  });
});
