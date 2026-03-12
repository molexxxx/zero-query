/**
 * zQuery Store — Global reactive state management
 * 
 * A lightweight Redux/Vuex-inspired store with:
 *   - Reactive state via Proxy
 *   - Named actions for mutations
 *   - Key-specific subscriptions
 *   - Computed getters
 *   - Middleware support
 *   - DevTools-friendly (logs actions in dev mode)
 * 
 * Usage:
 *   const store = $.store({
 *     state: { count: 0, user: null },
 *     actions: {
 *       increment(state) { state.count++; },
 *       setUser(state, user) { state.user = user; }
 *     },
 *     getters: {
 *       doubleCount: (state) => state.count * 2
 *     }
 *   });
 * 
 *   store.dispatch('increment');
 *   store.subscribe('count', (val, old) => console.log(val));
 */

import { reactive } from './reactive.js';
import { reportError, ErrorCode, ZQueryError } from './errors.js';

class Store {
  constructor(config = {}) {
    this._subscribers = new Map();   // key → Set<fn>
    this._wildcards = new Set();     // subscribe to all changes
    this._actions = config.actions || {};
    this._getters = config.getters || {};
    this._middleware = [];
    this._history = [];              // action log
    this._maxHistory = config.maxHistory || 1000;
    this._debug = config.debug || false;

    // Create reactive state
    const initial = typeof config.state === 'function' ? config.state() : { ...(config.state || {}) };

    this.state = reactive(initial, (key, value, old) => {
      // Notify key-specific subscribers
      const subs = this._subscribers.get(key);
      if (subs) subs.forEach(fn => {
        try { fn(value, old, key); }
        catch (err) { reportError(ErrorCode.STORE_SUBSCRIBE, `Subscriber for "${key}" threw`, { key }, err); }
      });
      // Notify wildcard subscribers
      this._wildcards.forEach(fn => {
        try { fn(key, value, old); }
        catch (err) { reportError(ErrorCode.STORE_SUBSCRIBE, 'Wildcard subscriber threw', { key }, err); }
      });
    });

    // Build getters as computed properties
    this.getters = {};
    for (const [name, fn] of Object.entries(this._getters)) {
      Object.defineProperty(this.getters, name, {
        get: () => fn(this.state.__raw || this.state),
        enumerable: true
      });
    }
  }

  /**
   * Dispatch a named action
   * @param {string} name — action name
   * @param  {...any} args — payload
   */
  dispatch(name, ...args) {
    const action = this._actions[name];
    if (!action) {
      reportError(ErrorCode.STORE_ACTION, `Unknown action "${name}"`, { action: name, args });
      return;
    }

    // Run middleware
    for (const mw of this._middleware) {
      try {
        const result = mw(name, args, this.state);
        if (result === false) return; // blocked by middleware
      } catch (err) {
        reportError(ErrorCode.STORE_MIDDLEWARE, `Middleware threw during "${name}"`, { action: name }, err);
        return;
      }
    }

    if (this._debug) {
      console.log(`%c[Store] ${name}`, 'color: #4CAF50; font-weight: bold;', ...args);
    }

    try {
      const result = action(this.state, ...args);
      this._history.push({ action: name, args, timestamp: Date.now() });
      // Cap history to prevent unbounded memory growth
      if (this._history.length > this._maxHistory) {
        this._history.splice(0, this._history.length - this._maxHistory);
      }
      return result;
    } catch (err) {
      reportError(ErrorCode.STORE_ACTION, `Action "${name}" threw`, { action: name, args }, err);
    }
  }

  /**
   * Subscribe to changes on a specific state key
   * @param {string|Function} keyOrFn — state key, or function for all changes
   * @param {Function} [fn] — callback (value, oldValue, key)
   * @returns {Function} — unsubscribe
   */
  subscribe(keyOrFn, fn) {
    if (typeof keyOrFn === 'function') {
      // Wildcard — listen to all changes
      this._wildcards.add(keyOrFn);
      return () => this._wildcards.delete(keyOrFn);
    }

    if (!this._subscribers.has(keyOrFn)) {
      this._subscribers.set(keyOrFn, new Set());
    }
    this._subscribers.get(keyOrFn).add(fn);
    return () => this._subscribers.get(keyOrFn)?.delete(fn);
  }

  /**
   * Get current state snapshot (plain object)
   */
  snapshot() {
    return JSON.parse(JSON.stringify(this.state.__raw || this.state));
  }

  /**
   * Replace entire state
   */
  replaceState(newState) {
    const raw = this.state.__raw || this.state;
    for (const key of Object.keys(raw)) {
      delete this.state[key];
    }
    Object.assign(this.state, newState);
  }

  /**
   * Add middleware: fn(actionName, args, state) → false to block
   */
  use(fn) {
    this._middleware.push(fn);
    return this;
  }

  /**
   * Get action history
   */
  get history() {
    return [...this._history];
  }

  /**
   * Reset state to initial values
   */
  reset(initialState) {
    this.replaceState(initialState);
    this._history = [];
  }
}


// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
let _stores = new Map();

export function createStore(name, config) {
  // If called with just config (no name), use 'default'
  if (typeof name === 'object') {
    config = name;
    name = 'default';
  }
  const store = new Store(config);
  _stores.set(name, store);
  return store;
}

export function getStore(name = 'default') {
  return _stores.get(name) || null;
}
