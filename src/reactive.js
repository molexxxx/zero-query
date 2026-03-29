/**
 * zQuery Reactive - Proxy-based deep reactivity system
 * 
 * Creates observable objects that trigger callbacks on mutation.
 * Used internally by components and store for auto-updates.
 */

import { reportError, ErrorCode } from './errors.js';

// ---------------------------------------------------------------------------
// Deep reactive proxy
// ---------------------------------------------------------------------------
export function reactive(target, onChange, _path = '') {
  if (typeof target !== 'object' || target === null) return target;
  if (typeof onChange !== 'function') {
    reportError(ErrorCode.REACTIVE_CALLBACK, 'reactive() onChange must be a function', { received: typeof onChange });
    onChange = () => {};
  }

  const proxyCache = new WeakMap();

  const handler = {
    get(obj, key) {
      if (key === '__isReactive') return true;
      if (key === '__raw') return obj;

      const value = obj[key];
      if (typeof value === 'object' && value !== null) {
        // Return cached proxy or create new one
        if (proxyCache.has(value)) return proxyCache.get(value);
        const childProxy = new Proxy(value, handler);
        proxyCache.set(value, childProxy);
        return childProxy;
      }
      return value;
    },

    set(obj, key, value) {
      const old = obj[key];
      if (old === value) return true;
      obj[key] = value;
      // Invalidate proxy cache for the old value (it may have been replaced)
      if (old && typeof old === 'object') proxyCache.delete(old);
      try {
        onChange(key, value, old);
      } catch (err) {
        reportError(ErrorCode.REACTIVE_CALLBACK, `Reactive onChange threw for key "${String(key)}"`, { key, value, old }, err);
      }
      return true;
    },

    deleteProperty(obj, key) {
      const old = obj[key];
      delete obj[key];
      if (old && typeof old === 'object') proxyCache.delete(old);
      try {
        onChange(key, undefined, old);
      } catch (err) {
        reportError(ErrorCode.REACTIVE_CALLBACK, `Reactive onChange threw for key "${String(key)}"`, { key, old }, err);
      }
      return true;
    }
  };

  return new Proxy(target, handler);
}


// ---------------------------------------------------------------------------
// Signal - lightweight reactive primitive (inspired by Solid/Preact signals)
// ---------------------------------------------------------------------------
export class Signal {
  constructor(value) {
    this._value = value;
    this._subscribers = new Set();
  }

  get value() {
    // Track dependency if there's an active effect
    if (Signal._activeEffect) {
      this._subscribers.add(Signal._activeEffect);
      // Record this signal in the effect's dependency set for proper cleanup
      if (Signal._activeEffect._deps) {
        Signal._activeEffect._deps.add(this);
      }
    }
    return this._value;
  }

  set value(newVal) {
    if (this._value === newVal) return;
    this._value = newVal;
    this._notify();
  }

  peek() { return this._value; }

  _notify() {
    if (Signal._batching) {
      Signal._batchQueue.add(this);
      return;
    }
    // Snapshot subscribers before iterating - a subscriber might modify
    // the set (e.g., an effect re-running, adding itself back)
    const subs = [...this._subscribers];
    for (let i = 0; i < subs.length; i++) {
      try { subs[i](); }
      catch (err) {
        reportError(ErrorCode.SIGNAL_CALLBACK, 'Signal subscriber threw', { signal: this }, err);
      }
    }
  }

  subscribe(fn) {
    this._subscribers.add(fn);
    return () => this._subscribers.delete(fn);
  }

  toString() { return String(this._value); }
}

// Active effect tracking
Signal._activeEffect = null;
// Batch state
Signal._batching = false;
Signal._batchQueue = new Set();

/**
 * Create a signal
 * @param {*} initial - initial value
 * @returns {Signal}
 */
export function signal(initial) {
  return new Signal(initial);
}

/**
 * Create a computed signal (derived from other signals)
 * @param {Function} fn - computation function
 * @returns {Signal}
 */
export function computed(fn) {
  const s = new Signal(undefined);
  effect(() => {
    const v = fn();
    if (v !== s._value) {
      s._value = v;
      s._notify();
    }
  });
  return s;
}

/**
 * Create a side-effect that auto-tracks signal dependencies.
 * Returns a dispose function that removes the effect from all
 * signals it subscribed to - prevents memory leaks.
 *
 * @param {Function} fn - effect function
 * @returns {Function} - dispose function
 */
export function effect(fn) {
  const execute = () => {
    // Clean up old subscriptions before re-running so stale
    // dependencies from a previous run are properly removed
    if (execute._deps) {
      for (const sig of execute._deps) {
        sig._subscribers.delete(execute);
      }
      execute._deps.clear();
    }

    Signal._activeEffect = execute;
    try { fn(); }
    catch (err) {
      reportError(ErrorCode.EFFECT_EXEC, 'Effect function threw', {}, err);
    }
    finally { Signal._activeEffect = null; }
  };

  // Track which signals this effect reads from
  execute._deps = new Set();

  execute();
  return () => {
    // Dispose: remove this effect from every signal it subscribed to
    if (execute._deps) {
      for (const sig of execute._deps) {
        sig._subscribers.delete(execute);
      }
      execute._deps.clear();
    }
    // Don't clobber _activeEffect - another effect may be running
  };
}


// ---------------------------------------------------------------------------
// batch() - defer signal notifications until the batch completes
// ---------------------------------------------------------------------------

/**
 * Batch multiple signal writes - subscribers and effects fire once at the end.
 * @param {Function} fn - function that performs signal writes
 */
export function batch(fn) {
  if (Signal._batching) {
    // Already inside a batch, just run
    return fn();
  }
  Signal._batching = true;
  Signal._batchQueue.clear();
  let result;
  try {
    result = fn();
  } finally {
    Signal._batching = false;
    // Collect all unique subscribers across all queued signals
    // so each subscriber/effect runs exactly once
    const subs = new Set();
    for (const sig of Signal._batchQueue) {
      for (const sub of sig._subscribers) {
        subs.add(sub);
      }
    }
    Signal._batchQueue.clear();
    for (const sub of subs) {
      try { sub(); }
      catch (err) {
        reportError(ErrorCode.SIGNAL_CALLBACK, 'Signal subscriber threw', {}, err);
      }
    }
  }
  return result;
}


// ---------------------------------------------------------------------------
// untracked() - read signals without creating dependencies
// ---------------------------------------------------------------------------

/**
 * Execute a function without tracking signal reads as dependencies.
 * @param {Function} fn - function to run
 * @returns {*} the return value of fn
 */
export function untracked(fn) {
  const prev = Signal._activeEffect;
  Signal._activeEffect = null;
  try {
    return fn();
  } finally {
    Signal._activeEffect = prev;
  }
}
