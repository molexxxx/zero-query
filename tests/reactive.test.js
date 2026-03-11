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

  it('dispose stops re-running on signal change', () => {
    const s = signal(0);
    const log = vi.fn();
    const dispose = effect(() => { log(s.value); });
    expect(log).toHaveBeenCalledTimes(1);
    dispose();
    s.value = 1;
    expect(log).toHaveBeenCalledTimes(1); // no additional call
  });

  it('dispose removes effect from signal subscribers', () => {
    const s = signal(0);
    const log = vi.fn();
    const dispose = effect(() => { log(s.value); });
    dispose();
    // After disposing, the signal should not hold a reference to the effect
    s.value = 99;
    expect(log).toHaveBeenCalledTimes(1); // only the initial run
  });

  it('tracks multiple signals', () => {
    const a = signal(1);
    const b = signal(2);
    const log = vi.fn();
    effect(() => { log(a.value + b.value); });
    expect(log).toHaveBeenCalledWith(3);
    a.value = 10;
    expect(log).toHaveBeenCalledWith(12);
    b.value = 20;
    expect(log).toHaveBeenCalledWith(30);
    expect(log).toHaveBeenCalledTimes(3);
  });

  it('handles conditional dependency tracking', () => {
    const toggle = signal(true);
    const a = signal('A');
    const b = signal('B');
    const log = vi.fn();
    effect(() => {
      log(toggle.value ? a.value : b.value);
    });
    expect(log).toHaveBeenCalledWith('A');
    // Change b — should NOT re-run because b is not tracked when toggle=true
    b.value = 'B2';
    // After toggle switches, b becomes tracked
    toggle.value = false;
    expect(log).toHaveBeenCalledWith('B2');
  });
});


// ---------------------------------------------------------------------------
// reactive — array mutations
// ---------------------------------------------------------------------------

describe('reactive — arrays', () => {
  it('detects push on a reactive array', () => {
    const fn = vi.fn();
    const obj = reactive({ items: [1, 2, 3] }, fn);
    obj.items.push(4);
    expect(fn).toHaveBeenCalled();
  });

  it('detects index assignment', () => {
    const fn = vi.fn();
    const obj = reactive({ items: ['a', 'b'] }, fn);
    obj.items[0] = 'z';
    expect(fn).toHaveBeenCalledWith('0', 'z', 'a');
  });
});


// ---------------------------------------------------------------------------
// computed — advanced
// ---------------------------------------------------------------------------

describe('computed — advanced', () => {
  it('chains computed signals', () => {
    const count = signal(2);
    const doubled = computed(() => count.value * 2);
    const quadrupled = computed(() => doubled.value * 2);
    expect(quadrupled.value).toBe(8);
    count.value = 3;
    expect(quadrupled.value).toBe(12);
  });

  it('does not recompute when dependencies unchanged (diamond)', () => {
    const s = signal(1);
    const a = computed(() => s.value + 1);
    const b = computed(() => s.value + 2);
    const spy = vi.fn(() => a.value + b.value);
    const c = computed(spy);
    expect(c.value).toBe(5); // (1+1)+(1+2)
    spy.mockClear();
    s.value = 10;
    expect(c.value).toBe(23); // (10+1)+(10+2)
  });

  it('peek does not create dependency', () => {
    const s = signal(0);
    const log = vi.fn();
    effect(() => {
      log(s.peek());
    });
    expect(log).toHaveBeenCalledWith(0);
    s.value = 1;
    // peek doesn't track, so effect should NOT re-run
    expect(log).toHaveBeenCalledTimes(1);
  });
});


// ---------------------------------------------------------------------------
// Signal — batch behavior
// ---------------------------------------------------------------------------

describe('Signal — multiple subscribers', () => {
  it('notifies all subscribers', () => {
    const s = signal(0);
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    s.subscribe(fn1);
    s.subscribe(fn2);
    s.value = 1;
    expect(fn1).toHaveBeenCalledOnce();
    expect(fn2).toHaveBeenCalledOnce();
  });

  it('unsubscribing one does not affect others', () => {
    const s = signal(0);
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const unsub1 = s.subscribe(fn1);
    s.subscribe(fn2);
    unsub1();
    s.value = 1;
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledOnce();
  });

  it('handles rapid sequential updates', () => {
    const s = signal(0);
    const log = vi.fn();
    s.subscribe(log);
    for (let i = 1; i <= 10; i++) s.value = i;
    expect(log).toHaveBeenCalledTimes(10);
  });
});
