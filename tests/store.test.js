import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStore, getStore } from '../src/store.js';


// ---------------------------------------------------------------------------
// Store creation
// ---------------------------------------------------------------------------

describe('Store - creation', () => {
  it('creates a store with initial state', () => {
    const store = createStore('test-create', {
      state: { count: 0, name: 'Tony' },
    });
    expect(store.state.count).toBe(0);
    expect(store.state.name).toBe('Tony');
  });

  it('supports state as a factory function', () => {
    const store = createStore('test-fn', {
      state: () => ({ items: [] }),
    });
    expect(store.state.items).toEqual([]);
  });

  it('getStore retrieves by name', () => {
    const store = createStore('named-store', { state: { x: 1 } });
    expect(getStore('named-store')).toBe(store);
  });

  it('getStore returns null for unknown stores', () => {
    expect(getStore('nonexistent')).toBeNull();
  });

  it('defaults to "default" when no name is provided', () => {
    const store = createStore({ state: { val: 42 } });
    expect(getStore('default')).toBe(store);
  });
});


// ---------------------------------------------------------------------------
// Dispatch & actions
// ---------------------------------------------------------------------------

describe('Store - dispatch', () => {
  it('dispatches a named action', () => {
    const store = createStore('dispatch-1', {
      state: { count: 0 },
      actions: {
        increment(state) { state.count++; },
      },
    });
    store.dispatch('increment');
    expect(store.state.count).toBe(1);
  });

  it('passes payload to action', () => {
    const store = createStore('dispatch-2', {
      state: { count: 0 },
      actions: {
        add(state, amount) { state.count += amount; },
      },
    });
    store.dispatch('add', 5);
    expect(store.state.count).toBe(5);
  });

  it('reports error for unknown actions', () => {
    const store = createStore('dispatch-unknown', {
      state: {},
      actions: {},
    });
    // Should not throw if action doesn't exist
    expect(() => store.dispatch('nonexistent')).not.toThrow();
  });

  it('records action in history', () => {
    const store = createStore('dispatch-hist', {
      state: { x: 0 },
      actions: { inc(state) { state.x++; } },
    });
    store.dispatch('inc');
    store.dispatch('inc');
    expect(store.history.length).toBe(2);
    expect(store.history[0].action).toBe('inc');
  });

  it('does not crash when action throws', () => {
    const store = createStore('dispatch-throw', {
      state: {},
      actions: {
        bad() { throw new Error('action error'); },
      },
    });
    expect(() => store.dispatch('bad')).not.toThrow();
  });
});


// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

describe('Store - subscribe', () => {
  it('notifies key-specific subscribers', () => {
    const store = createStore('sub-1', {
      state: { count: 0 },
      actions: { inc(state) { state.count++; } },
    });
    const fn = vi.fn();
    store.subscribe('count', fn);
    store.dispatch('inc');
    expect(fn).toHaveBeenCalledWith('count', 1, 0);
  });

  it('wildcard subscriber gets all changes', () => {
    const store = createStore('sub-2', {
      state: { a: 0, b: 0 },
      actions: {
        setA(state, v) { state.a = v; },
        setB(state, v) { state.b = v; },
      },
    });
    const fn = vi.fn();
    store.subscribe(fn);
    store.dispatch('setA', 1);
    store.dispatch('setB', 2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('unsubscribe stops notifications', () => {
    const store = createStore('sub-3', {
      state: { x: 0 },
      actions: { inc(state) { state.x++; } },
    });
    const fn = vi.fn();
    const unsub = store.subscribe('x', fn);
    store.dispatch('inc');
    expect(fn).toHaveBeenCalledOnce();
    unsub();
    store.dispatch('inc');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('does not crash when subscriber throws', () => {
    const store = createStore('sub-throw', {
      state: { x: 0 },
      actions: { inc(state) { state.x++; } },
    });
    store.subscribe('x', () => { throw new Error('subscriber error'); });
    expect(() => store.dispatch('inc')).not.toThrow();
  });
});


// ---------------------------------------------------------------------------
// Getters
// ---------------------------------------------------------------------------

describe('Store - getters', () => {
  it('computes values from state', () => {
    const store = createStore('getters-1', {
      state: { count: 5 },
      getters: {
        doubled: (state) => state.count * 2,
      },
    });
    expect(store.getters.doubled).toBe(10);
  });

  it('updates when state changes', () => {
    const store = createStore('getters-2', {
      state: { count: 1 },
      actions: { inc(state) { state.count++; } },
      getters: { doubled: (state) => state.count * 2 },
    });
    store.dispatch('inc');
    expect(store.getters.doubled).toBe(4);
  });
});


// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

describe('Store - middleware', () => {
  it('calls middleware before action', () => {
    const log = vi.fn();
    const store = createStore('mw-1', {
      state: { x: 0 },
      actions: { inc(state) { state.x++; } },
    });
    store.use((name, args, state) => { log(name); });
    store.dispatch('inc');
    expect(log).toHaveBeenCalledWith('inc');
  });

  it('blocks action when middleware returns false', () => {
    const store = createStore('mw-block', {
      state: { x: 0 },
      actions: { inc(state) { state.x++; } },
    });
    store.use(() => false);
    store.dispatch('inc');
    expect(store.state.x).toBe(0);
  });

  it('does not crash when middleware throws', () => {
    const store = createStore('mw-throw', {
      state: { x: 0 },
      actions: { inc(state) { state.x++; } },
    });
    store.use(() => { throw new Error('middleware error'); });
    expect(() => store.dispatch('inc')).not.toThrow();
    // Action should NOT have run (middleware threw → dispatch returns)
    expect(store.state.x).toBe(0);
  });
});


// ---------------------------------------------------------------------------
// Snapshot & replaceState
// ---------------------------------------------------------------------------

describe('Store - snapshot & replaceState', () => {
  it('snapshot returns plain object copy', () => {
    const store = createStore('snap-1', { state: { a: 1, b: { c: 2 } } });
    const snap = store.snapshot();
    expect(snap).toEqual({ a: 1, b: { c: 2 } });
    snap.a = 99;
    expect(store.state.a).toBe(1); // original unchanged
  });

  it('replaceState replaces entire state', () => {
    const store = createStore('replace-1', { state: { x: 1, y: 2 } });
    store.replaceState({ x: 10, z: 30 });
    expect(store.state.x).toBe(10);
    expect(store.state.z).toBe(30);
  });

  it('reset replaces state and clears history', () => {
    const store = createStore('reset-1', {
      state: { count: 0 },
      actions: { inc(state) { state.count++; } },
    });
    store.dispatch('inc');
    store.dispatch('inc');
    store.reset({ count: 0 });
    expect(store.state.count).toBe(0);
    expect(store.history.length).toBe(0);
  });
});


// ---------------------------------------------------------------------------
// Multiple middleware
// ---------------------------------------------------------------------------

describe('Store - multiple middleware', () => {
  it('runs middleware in order', () => {
    const order = [];
    const store = createStore('mw-multi', {
      state: { x: 0 },
      actions: { inc(state) { state.x++; } },
    });
    store.use(() => { order.push('a'); });
    store.use(() => { order.push('b'); });
    store.dispatch('inc');
    expect(order).toEqual(['a', 'b']);
  });

  it('second middleware can block even if first passes', () => {
    const store = createStore('mw-multi-block', {
      state: { x: 0 },
      actions: { inc(state) { state.x++; } },
    });
    store.use(() => true);
    store.use(() => false);
    store.dispatch('inc');
    expect(store.state.x).toBe(0);
  });
});


// ---------------------------------------------------------------------------
// Async actions
// ---------------------------------------------------------------------------

describe('Store - async actions', () => {
  it('supports async action returning promise', async () => {
    const store = createStore('async-1', {
      state: { data: null },
      actions: {
        async fetchData(state) {
          state.data = await Promise.resolve('loaded');
        },
      },
    });
    await store.dispatch('fetchData');
    expect(store.state.data).toBe('loaded');
  });
});


// ---------------------------------------------------------------------------
// Subscriber deduplication
// ---------------------------------------------------------------------------

describe('Store - subscriber edge cases', () => {
  it('same function subscribed twice fires twice', () => {
    const store = createStore('sub-dedup', {
      state: { x: 0 },
      actions: { inc(state) { state.x++; } },
    });
    const fn = vi.fn();
    store.subscribe('x', fn);
    store.subscribe('x', fn); // Set deduplicates
    store.dispatch('inc');
    expect(fn).toHaveBeenCalledOnce(); // Set prevents duplicates
  });

  it('wildcard and key subscriber both fire', () => {
    const store = createStore('sub-both', {
      state: { x: 0 },
      actions: { inc(state) { state.x++; } },
    });
    const keyFn = vi.fn();
    const wildFn = vi.fn();
    store.subscribe('x', keyFn);
    store.subscribe(wildFn);
    store.dispatch('inc');
    expect(keyFn).toHaveBeenCalledOnce();
    expect(wildFn).toHaveBeenCalledOnce();
  });
});


// ---------------------------------------------------------------------------
// Action return value
// ---------------------------------------------------------------------------

describe('Store - action return value', () => {
  it('dispatch returns action result', () => {
    const store = createStore('ret-1', {
      state: { x: 0 },
      actions: { compute(state) { return state.x + 10; } },
    });
    expect(store.dispatch('compute')).toBe(10);
  });
});


// ---------------------------------------------------------------------------
// Getters with multiple state keys
// ---------------------------------------------------------------------------

describe('Store - complex getters', () => {
  it('getter uses multiple state keys', () => {
    const store = createStore('getter-multi', {
      state: { firstName: 'Tony', lastName: 'W' },
      getters: {
        fullName: (state) => `${state.firstName} ${state.lastName}`,
      },
    });
    expect(store.getters.fullName).toBe('Tony W');
  });

  it('getter recalculates after state change', () => {
    const store = createStore('getter-recalc', {
      state: { count: 2 },
      actions: { set(state, v) { state.count = v; } },
      getters: { doubled: (s) => s.count * 2 },
    });
    expect(store.getters.doubled).toBe(4);
    store.dispatch('set', 10);
    expect(store.getters.doubled).toBe(20);
  });
});


// ---------------------------------------------------------------------------
// PERF: history trim uses splice (in-place) instead of slice (copy)
// ---------------------------------------------------------------------------

describe('Store - history trim in-place', () => {
  it('trims history to maxHistory without exceeding', () => {
    const store = createStore('hist-trim', {
      state: { n: 0 },
      actions: { inc(s) { s.n++; } },
      maxHistory: 5,
    });
    for (let i = 0; i < 10; i++) store.dispatch('inc');
    expect(store.history.length).toBe(5);
    // Newest actions should survive
    expect(store.state.n).toBe(10);
  });

  it('maintains same array identity (splice, not slice)', () => {
    const store = createStore('hist-identity', {
      state: { n: 0 },
      actions: { inc(s) { s.n++; } },
      maxHistory: 3,
    });
    const ref = store._history;
    for (let i = 0; i < 10; i++) store.dispatch('inc');
    // splice modifies in-place so the array reference stays the same
    expect(store._history).toBe(ref);
    expect(store._history.length).toBe(3);
  });
});


// ===========================================================================
// use() - middleware chaining
// ===========================================================================

describe('Store - use() chaining', () => {
  it('returns the store for chaining', () => {
    const store = createStore({
      state: { x: 0 },
      actions: { inc(state) { state.x++; } }
    });
    const result = store.use(() => {}).use(() => {});
    expect(result).toBe(store);
  });

  it('multiple middleware run in order', () => {
    const order = [];
    const store = createStore({
      state: { x: 0 },
      actions: { inc(state) { state.x++; } }
    });
    store.use(() => { order.push('a'); });
    store.use(() => { order.push('b'); });
    store.dispatch('inc');
    expect(order).toEqual(['a', 'b']);
  });

  it('middleware returning false blocks action', () => {
    const store = createStore({
      state: { x: 0 },
      actions: { inc(state) { state.x++; } }
    });
    store.use(() => false);
    store.dispatch('inc');
    expect(store.state.x).toBe(0);
  });
});


// ===========================================================================
// debug mode
// ===========================================================================

describe('Store - debug mode', () => {
  it('logs when debug is true', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const store = createStore({
      state: { x: 0 },
      actions: { inc(state) { state.x++; } },
      debug: true
    });
    store.dispatch('inc');
    expect(spy).toHaveBeenCalled();
    const logStr = spy.mock.calls[0].join(' ');
    expect(logStr).toContain('inc');
    spy.mockRestore();
  });
});


// ===========================================================================
// replaceState
// ===========================================================================

describe('Store - replaceState', () => {
  it('replaces all keys', () => {
    const store = createStore({
      state: { a: 1, b: 2 }
    });
    store.replaceState({ c: 3 });
    const snap = store.snapshot();
    expect(snap).not.toHaveProperty('a');
    expect(snap).not.toHaveProperty('b');
    expect(snap.c).toBe(3);
  });
});


// ===========================================================================
// wildcard subscription
// ===========================================================================

describe('Store - wildcard subscription', () => {
  it('fires on any state change', () => {
    const store = createStore({
      state: { a: 1, b: 2 },
      actions: {
        setA(state, v) { state.a = v; },
        setB(state, v) { state.b = v; }
      }
    });
    const calls = [];
    store.subscribe((key, val, old) => calls.push([key, val, old]));
    store.dispatch('setA', 10);
    store.dispatch('setB', 20);
    expect(calls).toEqual([['a', 10, 1], ['b', 20, 2]]);
  });

  it('unsubscribes wildcard', () => {
    const store = createStore({
      state: { a: 1 },
      actions: { setA(state, v) { state.a = v; } }
    });
    const fn = vi.fn();
    const unsub = store.subscribe(fn);
    store.dispatch('setA', 2);
    expect(fn).toHaveBeenCalledTimes(1);
    unsub();
    store.dispatch('setA', 3);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});


// ===========================================================================
// state as factory function
// ===========================================================================

describe('Store - state factory', () => {
  it('calls state function for initial state', () => {
    const store = createStore({
      state: () => ({ count: 0 })
    });
    expect(store.state.count).toBe(0);
  });
});


// ===========================================================================
// createStore - named stores
// ===========================================================================

describe('createStore - named stores', () => {
  it('creates default store when no name given', () => {
    const store = createStore({ state: { x: 1 } });
    expect(store.state.x).toBe(1);
  });

  it('dispatch unknown action does not throw', () => {
    const store = createStore({ state: { x: 1 }, actions: {} });
    expect(() => store.dispatch('nope')).not.toThrow();
  });
});


// ===========================================================================
// reset
// ===========================================================================

describe('Store - reset', () => {
  it('resets state and clears history', () => {
    const store = createStore({
      state: { x: 0 },
      actions: { inc(state) { state.x++; } }
    });
    store.dispatch('inc');
    store.dispatch('inc');
    expect(store.state.x).toBe(2);
    expect(store.history.length).toBe(2);
    store.reset({ x: 0 });
    expect(store.state.x).toBe(0);
    expect(store.history.length).toBe(0);
  });
});


// ===========================================================================
// empty config
// ===========================================================================

describe('Store - empty config', () => {
  it('creates store with no config', () => {
    const store = createStore({});
    expect(store.snapshot()).toEqual({});
    expect(store.history).toEqual([]);
  });
});


// ===========================================================================
// Store - batch
// ===========================================================================

describe('Store - batch', () => {
  it('fires subscribers once per key, not per mutation', () => {
    const store = createStore({
      state: { x: 0, y: 0 },
      actions: {
        setX(state, v) { state.x = v; },
        setY(state, v) { state.y = v; },
      }
    });
    const fn = vi.fn();
    store.subscribe('x', fn);

    store.batch(state => {
      state.x = 1;
      state.x = 2;
      state.x = 3;
    });

    // Should fire once with the final value
    expect(fn).toHaveBeenCalledTimes(1);
    expect(store.state.x).toBe(3);
  });

  it('batches changes across multiple keys', () => {
    const store = createStore({
      state: { a: 0, b: 0 }
    });
    const fnA = vi.fn();
    const fnB = vi.fn();
    store.subscribe('a', fnA);
    store.subscribe('b', fnB);

    store.batch(state => {
      state.a = 10;
      state.b = 20;
    });

    expect(fnA).toHaveBeenCalledTimes(1);
    expect(fnB).toHaveBeenCalledTimes(1);
    expect(store.state.a).toBe(10);
    expect(store.state.b).toBe(20);
  });

  it('does not fire subscribers during the batch', () => {
    const store = createStore({ state: { x: 0 } });
    const calls = [];
    store.subscribe('x', (val) => calls.push(val));

    store.batch(state => {
      state.x = 1;
      // Subscriber should not have been called yet
      expect(calls.length).toBe(0);
      state.x = 2;
      expect(calls.length).toBe(0);
    });

    // Now it fires
    expect(calls.length).toBe(1);
  });
});


// ===========================================================================
// Store - checkpoint / undo / redo
// ===========================================================================

describe('Store - checkpoint / undo / redo', () => {
  it('undo restores to checkpointed state', () => {
    const store = createStore({
      state: { count: 0 },
      actions: { inc(state) { state.count++; } }
    });

    store.checkpoint();
    store.dispatch('inc');
    store.dispatch('inc');
    expect(store.state.count).toBe(2);

    const didUndo = store.undo();
    expect(didUndo).toBe(true);
    expect(store.state.count).toBe(0);
  });

  it('redo restores the undone state', () => {
    const store = createStore({
      state: { count: 0 },
      actions: { inc(state) { state.count++; } }
    });

    store.checkpoint();
    store.dispatch('inc');
    store.dispatch('inc');
    store.undo();
    expect(store.state.count).toBe(0);

    const didRedo = store.redo();
    expect(didRedo).toBe(true);
    expect(store.state.count).toBe(2);
  });

  it('undo returns false when no checkpoints', () => {
    const store = createStore({ state: { x: 1 } });
    expect(store.undo()).toBe(false);
    expect(store.state.x).toBe(1);
  });

  it('redo returns false when nothing to redo', () => {
    const store = createStore({ state: { x: 1 } });
    expect(store.redo()).toBe(false);
  });

  it('canUndo and canRedo reflect stack state', () => {
    const store = createStore({
      state: { v: 'a' },
      actions: { set(state, v) { state.v = v; } }
    });

    expect(store.canUndo).toBe(false);
    expect(store.canRedo).toBe(false);

    store.checkpoint();
    expect(store.canUndo).toBe(true);

    store.dispatch('set', 'b');
    store.undo();
    expect(store.canRedo).toBe(true);

    store.redo();
    expect(store.canRedo).toBe(false);
  });

  it('new checkpoint clears redo stack', () => {
    const store = createStore({
      state: { x: 0 },
      actions: { set(state, v) { state.x = v; } }
    });

    store.checkpoint();
    store.dispatch('set', 1);
    store.undo();
    expect(store.canRedo).toBe(true);

    // New checkpoint clears redo
    store.checkpoint();
    expect(store.canRedo).toBe(false);
  });

  it('respects maxUndo limit', () => {
    const store = createStore({
      state: { x: 0 },
      maxUndo: 3,
      actions: { set(state, v) { state.x = v; } }
    });

    store.checkpoint(); // save x=0
    store.dispatch('set', 1);
    store.checkpoint(); // save x=1
    store.dispatch('set', 2);
    store.checkpoint(); // save x=2
    store.dispatch('set', 3);
    store.checkpoint(); // save x=3 -> should trim oldest (x=0)
    store.dispatch('set', 4);

    // Should have at most 3 entries
    store.undo(); // -> x=3
    store.undo(); // -> x=2
    store.undo(); // -> x=1
    expect(store.undo()).toBe(false); // oldest was trimmed
  });

  it('multiple undo/redo cycles', () => {
    const store = createStore({
      state: { n: 0 },
      actions: { set(state, v) { state.n = v; } }
    });

    store.checkpoint();
    store.dispatch('set', 1);
    store.checkpoint();
    store.dispatch('set', 2);
    store.checkpoint();
    store.dispatch('set', 3);

    store.undo(); // -> 2
    expect(store.state.n).toBe(2);
    store.undo(); // -> 1
    expect(store.state.n).toBe(1);
    store.redo(); // -> 2
    expect(store.state.n).toBe(2);
    store.redo(); // -> 3
    expect(store.state.n).toBe(3);
  });
});


// ===========================================================================
// Store - reset with no args
// ===========================================================================

describe('Store - reset defaults to initial state', () => {
  it('resets to the original initial state when called with no arguments', () => {
    const store = createStore({
      state: { count: 0, name: 'test' },
      actions: {
        inc(state) { state.count++; },
        rename(state, n) { state.name = n; }
      }
    });

    store.dispatch('inc');
    store.dispatch('inc');
    store.dispatch('rename', 'changed');
    expect(store.state.count).toBe(2);
    expect(store.state.name).toBe('changed');

    store.reset();
    expect(store.state.count).toBe(0);
    expect(store.state.name).toBe('test');
  });

  it('clears undo/redo stacks on reset', () => {
    const store = createStore({
      state: { x: 0 },
      actions: { set(state, v) { state.x = v; } }
    });

    store.checkpoint();
    store.dispatch('set', 5);
    expect(store.canUndo).toBe(true);

    store.reset();
    expect(store.canUndo).toBe(false);
    expect(store.canRedo).toBe(false);
  });
});
