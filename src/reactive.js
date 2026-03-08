/**
 * zQuery Reactive — Proxy-based deep reactivity system
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
// Signal — lightweight reactive primitive (inspired by Solid/Preact signals)
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
    this._subscribers.forEach(fn => {
      try { fn(); }
      catch (err) {
        reportError(ErrorCode.SIGNAL_CALLBACK, 'Signal subscriber threw', { signal: this }, err);
      }
    });
  }

  subscribe(fn) {
    this._subscribers.add(fn);
    return () => this._subscribers.delete(fn);
  }

  toString() { return String(this._value); }
}

// Active effect tracking
Signal._activeEffect = null;

/**
 * Create a signal
 * @param {*} initial — initial value
 * @returns {Signal}
 */
export function signal(initial) {
  return new Signal(initial);
}

/**
 * Create a computed signal (derived from other signals)
 * @param {Function} fn — computation function
 * @returns {Signal}
 */
export function computed(fn) {
  const s = new Signal(undefined);
  effect(() => { s._value = fn(); s._notify(); });
  return s;
}

/**
 * Create a side-effect that auto-tracks signal dependencies
 * @param {Function} fn — effect function
 * @returns {Function} — dispose function
 */
export function effect(fn) {
  const execute = () => {
    Signal._activeEffect = execute;
    try { fn(); }
    catch (err) {
      reportError(ErrorCode.EFFECT_EXEC, 'Effect function threw', {}, err);
    }
    finally { Signal._activeEffect = null; }
  };
  execute();
  return () => {
    // Remove this effect from all signals that track it
    Signal._activeEffect = null;
  };
}
