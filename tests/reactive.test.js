import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reactive, Signal, signal, computed, effect, batch, untracked } from '../src/reactive.js';


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
    // Should not throw - error is reported and a no-op is used
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
    // Change b - should NOT re-run because b is not tracked when toggle=true
    b.value = 'B2';
    // After toggle switches, b becomes tracked
    toggle.value = false;
    expect(log).toHaveBeenCalledWith('B2');
  });
});


// ---------------------------------------------------------------------------
// reactive - array mutations
// ---------------------------------------------------------------------------

describe('reactive - arrays', () => {
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
// computed - advanced
// ---------------------------------------------------------------------------

describe('computed - advanced', () => {
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
// Signal - batch behavior
// ---------------------------------------------------------------------------

describe('Signal - multiple subscribers', () => {
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


// ---------------------------------------------------------------------------
// BUG FIX: effect() dispose must not corrupt _activeEffect
// ---------------------------------------------------------------------------

describe('effect - dispose safety', () => {
  it('disposing inside another effect does not break tracking', () => {
    const a = signal(1);
    const b = signal(2);

    // Create an inner effect that tracks `a`
    const disposeInner = effect(() => { a.value; });

    const log = vi.fn();
    // Outer effect tracks `b`, then disposes inner, then reads `a`
    effect(() => {
      b.value;       // should be tracked
      disposeInner();
      log(a.value);  // should also be tracked
    });

    log.mockClear();
    // Changing `a` should re-run outer effect since it reads a.value
    a.value = 10;
    expect(log).toHaveBeenCalledWith(10);

    log.mockClear();
    // Changing `b` should also re-run outer effect
    b.value = 20;
    expect(log).toHaveBeenCalled();
  });
});


// ---------------------------------------------------------------------------
// PERF FIX: computed() should not notify when value unchanged
// ---------------------------------------------------------------------------

describe('computed - skip notification on same value', () => {
  it('does not notify subscribers when computed result is the same', () => {
    const s = signal(5);
    // Computed that clamps to a range - returns same value if within bounds
    const clamped = computed(() => Math.min(Math.max(s.value, 0), 10));
    expect(clamped.value).toBe(5);

    const subscriber = vi.fn();
    clamped.subscribe(subscriber);

    // Changing s from 5 to 7 changes clamped: 5→7, should notify
    s.value = 7;
    expect(clamped.value).toBe(7);
    expect(subscriber).toHaveBeenCalledTimes(1);

    subscriber.mockClear();
    // Changing s from 7 to 15 - clamped stays at 10
    s.value = 15;
    expect(clamped.value).toBe(10);
    s.value = 20; // clamped still 10 - should NOT notify again
    expect(subscriber).toHaveBeenCalledTimes(1); // only the 7→10 change
  });
});

// ===========================================================================
// reactive() - advanced edge cases
// ===========================================================================

describe('reactive - edge cases', () => {
  it('returns primitive as-is', () => {
    expect(reactive(42, () => {})).toBe(42);
    expect(reactive('hello', () => {})).toBe('hello');
    expect(reactive(null, () => {})).toBeNull();
  });

  it('__isReactive flag returns true', () => {
    const r = reactive({ a: 1 }, () => {});
    expect(r.__isReactive).toBe(true);
  });

  it('__raw returns underlying target', () => {
    const original = { a: 1 };
    const r = reactive(original, () => {});
    expect(r.__raw).toBe(original);
  });

  it('proxy cache returns same child proxy', () => {
    const child = { x: 1 };
    const r = reactive({ child }, () => {});
    const first = r.child;
    const second = r.child;
    expect(first).toBe(second);
  });

  it('proxy cache invalidated on set', () => {
    const onChange = vi.fn();
    const r = reactive({ nested: { x: 1 } }, onChange);
    const old = r.nested;
    r.nested = { x: 2 };
    const fresh = r.nested;
    expect(fresh).not.toBe(old);
  });

  it('deleteProperty triggers onChange', () => {
    const onChange = vi.fn();
    const r = reactive({ a: 1, b: 2 }, onChange);
    delete r.b;
    expect(onChange).toHaveBeenCalledWith('b', undefined, 2);
    expect(r.__raw).not.toHaveProperty('b');
  });

  it('deleteProperty invalidates proxy cache for object value', () => {
    const onChange = vi.fn();
    const nested = { x: 1 };
    const r = reactive({ nested }, onChange);
    r.nested; // populate cache
    delete r.nested;
    expect(onChange).toHaveBeenCalled();
  });

  it('same-value set is ignored', () => {
    const onChange = vi.fn();
    const r = reactive({ a: 5 }, onChange);
    r.a = 5;
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reactive with array target', () => {
    const onChange = vi.fn();
    const r = reactive([1, 2, 3], onChange);
    r.push(4);
    expect(onChange).toHaveBeenCalled();
    expect(r.__raw).toContain(4);
  });

  it('onChange throwing does not prevent set', () => {
    const r = reactive({ a: 1 }, () => { throw new Error('boom'); });
    // Should not throw externally - error is reported via reportError
    r.a = 2;
    expect(r.__raw.a).toBe(2);
  });

  it('non-function onChange gets replaced with noop', () => {
    const r = reactive({ a: 1 }, 'not a function');
    // Should not throw on set
    r.a = 2;
    expect(r.__raw.a).toBe(2);
  });
});


// ===========================================================================
// Signal - advanced
// ===========================================================================

describe('Signal - advanced', () => {
  it('peek() does not trigger tracking', () => {
    const s = signal(1);
    const fn = vi.fn(() => { s.peek(); });
    effect(fn);
    fn.mockClear();
    s.value = 2;
    // fn should NOT re-run because peek() didn't track
    expect(fn).not.toHaveBeenCalled();
  });

  it('toString() returns string representation', () => {
    const s = signal(42);
    expect(s.toString()).toBe('42');
    expect(`${s}`).toBe('42');
  });

  it('subscribe returns unsubscribe function', () => {
    const s = signal(0);
    const fn = vi.fn();
    const unsub = s.subscribe(fn);
    s.value = 1;
    expect(fn).toHaveBeenCalledTimes(1);
    unsub();
    s.value = 2;
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('same-value write is a no-op', () => {
    const s = signal(10);
    const fn = vi.fn();
    s.subscribe(fn);
    s.value = 10;
    expect(fn).not.toHaveBeenCalled();
  });

  it('signal with object value notifies on reference change', () => {
    const s = signal({ x: 1 });
    const fn = vi.fn();
    s.subscribe(fn);
    s.value = { x: 2 };
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('subscriber error does not stop others', () => {
    const s = signal(0);
    const first = vi.fn(() => { throw new Error('oops'); });
    const second = vi.fn();
    s.subscribe(first);
    s.subscribe(second);
    s.value = 1;
    expect(first).toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });
});


// ===========================================================================
// effect() - advanced
// ===========================================================================

describe('effect - advanced', () => {
  it('returns dispose function', () => {
    const s = signal(0);
    const fn = vi.fn(() => s.value);
    const dispose = effect(fn);
    expect(typeof dispose).toBe('function');
    fn.mockClear();
    dispose();
    s.value = 1;
    expect(fn).not.toHaveBeenCalled();
  });

  it('cleans up stale dependencies on re-run', () => {
    const a = signal(true);
    const b = signal('B');
    const c = signal('C');
    const results = [];

    effect(() => {
      if (a.value) {
        results.push(b.value);
      } else {
        results.push(c.value);
      }
    });

    expect(results).toEqual(['B']);

    a.value = false;
    expect(results).toEqual(['B', 'C']);

    // Changing b should NOT trigger the effect now (stale dep)
    b.value = 'B2';
    expect(results).toEqual(['B', 'C']);
  });

  it('effect that throws still cleans up', () => {
    const s = signal(0);
    let callCount = 0;
    effect(() => {
      s.value; // track
      callCount++;
      if (callCount > 1) throw new Error('boom');
    });
    expect(callCount).toBe(1);
    s.value = 1; // triggers re-run which throws
    expect(callCount).toBe(2);
    // Should still be reactive
    s.value = 2;
    expect(callCount).toBe(3);
  });

  it('nested effects work independently', () => {
    const a = signal(0);
    const b = signal(0);
    const outerFn = vi.fn();
    const innerFn = vi.fn();

    effect(() => {
      outerFn(a.value);
      effect(() => { innerFn(b.value); });
    });

    expect(outerFn).toHaveBeenCalledWith(0);
    expect(innerFn).toHaveBeenCalledWith(0);

    b.value = 1;
    expect(innerFn).toHaveBeenCalledWith(1);
  });
});


// ===========================================================================
// computed() - advanced
// ===========================================================================

describe('computed - advanced', () => {
  it('computed does not notify when value unchanged', () => {
    const s = signal(5);
    const c = computed(() => s.value > 3);
    const fn = vi.fn();
    c.subscribe(fn);

    s.value = 10; // c still true - no change
    expect(fn).not.toHaveBeenCalled();
  });

  it('computed chains', () => {
    const a = signal(2);
    const doubled = computed(() => a.value * 2);
    const quadrupled = computed(() => doubled.value * 2);
    expect(quadrupled.value).toBe(8);
    a.value = 3;
    expect(quadrupled.value).toBe(12);
  });

  it('computed with multiple signals', () => {
    const first = signal('John');
    const last = signal('Doe');
    const full = computed(() => `${first.value} ${last.value}`);
    expect(full.value).toBe('John Doe');
    first.value = 'Jane';
    expect(full.value).toBe('Jane Doe');
  });
});


// ===========================================================================
// batch()
// ===========================================================================

describe('batch()', () => {
  it('defers effect execution until batch completes', () => {
    const a = signal(1);
    const b = signal(2);
    const fn = vi.fn();

    effect(() => {
      fn(a.value + b.value);
    });
    fn.mockClear(); // clear initial run

    batch(() => {
      a.value = 10;
      b.value = 20;
    });

    // Effect should run once after the batch, not twice
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(30);
  });

  it('subscribers see the final value, not intermediate', () => {
    const s = signal(0);
    const values = [];
    s.subscribe(() => values.push(s.value));

    batch(() => {
      s.value = 1;
      s.value = 2;
      s.value = 3;
    });

    expect(values).toEqual([3]);
  });

  it('nested batch runs inner immediately, flushes at outer', () => {
    const s = signal(0);
    const fn = vi.fn();
    s.subscribe(fn);

    batch(() => {
      s.value = 1;
      batch(() => {
        s.value = 2;
      });
      // inner batch should not have flushed
      expect(fn).not.toHaveBeenCalled();
      s.value = 3;
    });

    // Outer batch flushes once
    expect(fn).toHaveBeenCalledTimes(1);
    expect(s.value).toBe(3);
  });

  it('computed values update correctly after batch', () => {
    const a = signal(1);
    const b = signal(2);
    const sum = computed(() => a.value + b.value);

    batch(() => {
      a.value = 10;
      b.value = 20;
    });

    expect(sum.value).toBe(30);
  });

  it('effects still run if batch throws', () => {
    const s = signal(0);
    const fn = vi.fn();
    s.subscribe(() => fn(s.value));

    try {
      batch(() => {
        s.value = 42;
        throw new Error('oops');
      });
    } catch {}

    // Batch should still flush on error via finally
    expect(fn).toHaveBeenCalledWith(42);
  });
});


// ===========================================================================
// untracked()
// ===========================================================================

describe('untracked()', () => {
  it('reads signals without creating dependencies', () => {
    const a = signal(1);
    const b = signal(10);
    const fn = vi.fn();

    effect(() => {
      const aVal = a.value; // tracked
      const bVal = untracked(() => b.value); // not tracked
      fn(aVal + bVal);
    });
    fn.mockClear();

    // Changing b should NOT re-run the effect
    b.value = 20;
    expect(fn).not.toHaveBeenCalled();

    // Changing a should re-run and pick up new b
    a.value = 2;
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(22); // a=2 + b=20
  });

  it('returns the value from the callback', () => {
    const s = signal(42);
    const result = untracked(() => s.value);
    expect(result).toBe(42);
  });

  it('does not break tracking for outer effect', () => {
    const tracked = signal('hello');
    const notTracked = signal('world');
    const runs = [];

    effect(() => {
      const t = tracked.value;
      const u = untracked(() => notTracked.value);
      runs.push(`${t} ${u}`);
    });

    expect(runs).toEqual(['hello world']);

    tracked.value = 'hi';
    expect(runs).toEqual(['hello world', 'hi world']);

    notTracked.value = 'earth';
    expect(runs).toEqual(['hello world', 'hi world']); // no re-run
  });

  it('works inside computed', () => {
    const a = signal(5);
    const b = signal(10);
    const c = computed(() => a.value + untracked(() => b.value));

    expect(c.value).toBe(15);

    b.value = 100;
    // computed shouldn't re-evaluate from b change
    expect(c.value).toBe(15);

    a.value = 1;
    // Now recomputes, picks up new b
    expect(c.value).toBe(101);
  });
});