import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStore, getStore } from '../src/store.js';


// ---------------------------------------------------------------------------
// Store creation
// ---------------------------------------------------------------------------

describe('Store — creation', () => {
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

describe('Store — dispatch', () => {
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

describe('Store — subscribe', () => {
  it('notifies key-specific subscribers', () => {
    const store = createStore('sub-1', {
      state: { count: 0 },
      actions: { inc(state) { state.count++; } },
    });
    const fn = vi.fn();
    store.subscribe('count', fn);
    store.dispatch('inc');
    expect(fn).toHaveBeenCalledWith(1, 0, 'count');
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

describe('Store — getters', () => {
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

describe('Store — middleware', () => {
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

describe('Store — snapshot & replaceState', () => {
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
