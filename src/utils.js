/**
 * zQuery Utils — Common utility functions
 * 
 * Quality-of-life helpers that every frontend project needs.
 * Attached to $ namespace for convenience.
 */

// ---------------------------------------------------------------------------
// Function utilities
// ---------------------------------------------------------------------------

/**
 * Debounce — delays execution until after `ms` of inactivity
 */
export function debounce(fn, ms = 250) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

/**
 * Throttle — limits execution to once per `ms`
 */
export function throttle(fn, ms = 250) {
  let last = 0;
  let timer;
  return (...args) => {
    const now = Date.now();
    const remaining = ms - (now - last);
    clearTimeout(timer);
    if (remaining <= 0) {
      last = now;
      fn(...args);
    } else {
      timer = setTimeout(() => { last = Date.now(); fn(...args); }, remaining);
    }
  };
}

/**
 * Pipe — compose functions left-to-right
 */
export function pipe(...fns) {
  return (input) => fns.reduce((val, fn) => fn(val), input);
}

/**
 * Once — function that only runs once
 */
export function once(fn) {
  let called = false, result;
  return (...args) => {
    if (!called) { called = true; result = fn(...args); }
    return result;
  };
}

/**
 * Sleep — promise-based delay
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// ---------------------------------------------------------------------------
// String utilities
// ---------------------------------------------------------------------------

/**
 * Escape HTML entities
 */
export function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(str).replace(/[&<>"']/g, c => map[c]);
}

export function stripHtml(str) {
  return String(str).replace(/<[^>]*>/g, '');
}

/**
 * Template tag for auto-escaping interpolated values
 * Usage: $.html`<div>${userInput}</div>`
 */
export function html(strings, ...values) {
  return strings.reduce((result, str, i) => {
    const val = values[i - 1];
    const escaped = (val instanceof TrustedHTML) ? val.toString() : escapeHtml(val ?? '');
    return result + escaped + str;
  });
}

/**
 * Mark HTML as trusted (skip escaping in $.html template)
 */
export class TrustedHTML {
  constructor(html) { this._html = html; }
  toString() { return this._html; }
}

export function trust(htmlStr) {
  return new TrustedHTML(htmlStr);
}

/**
 * Generate UUID v4
 */
export function uuid() {
  return crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/**
 * Kebab-case to camelCase
 */
export function camelCase(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * CamelCase to kebab-case
 */
export function kebabCase(str) {
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .toLowerCase();
}


// ---------------------------------------------------------------------------
// Object utilities
// ---------------------------------------------------------------------------

/**
 * Deep clone
 */
export function deepClone(obj) {
  if (typeof structuredClone === 'function') return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Deep merge objects
 */
export function deepMerge(target, ...sources) {
  const seen = new WeakSet();
  function merge(tgt, src) {
    if (seen.has(src)) return tgt;
    seen.add(src);
    for (const key of Object.keys(src)) {
      if (src[key] && typeof src[key] === 'object' && !Array.isArray(src[key])) {
        if (!tgt[key] || typeof tgt[key] !== 'object') tgt[key] = {};
        merge(tgt[key], src[key]);
      } else {
        tgt[key] = src[key];
      }
    }
    return tgt;
  }
  for (const source of sources) merge(target, source);
  return target;
}

/**
 * Simple object equality check
 */
export function isEqual(a, b, _seen) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  // Guard against circular references
  if (!_seen) _seen = new Set();
  if (_seen.has(a)) return true;
  _seen.add(a);
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(k => isEqual(a[k], b[k], _seen));
}


// ---------------------------------------------------------------------------
// URL utilities
// ---------------------------------------------------------------------------

/**
 * Serialize object to URL query string
 */
export function param(obj) {
  return new URLSearchParams(obj).toString();
}

/**
 * Parse URL query string to object
 */
export function parseQuery(str) {
  return Object.fromEntries(new URLSearchParams(str));
}


// ---------------------------------------------------------------------------
// Storage helpers (localStorage wrapper with JSON support)
// ---------------------------------------------------------------------------
export const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  remove(key) {
    localStorage.removeItem(key);
  },

  clear() {
    localStorage.clear();
  },
};

export const session = {
  get(key, fallback = null) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    sessionStorage.setItem(key, JSON.stringify(value));
  },

  remove(key) {
    sessionStorage.removeItem(key);
  },

  clear() {
    sessionStorage.clear();
  },
};


// ---------------------------------------------------------------------------
// Event bus (pub/sub)
// ---------------------------------------------------------------------------
export class EventBus {
  constructor() { this._handlers = new Map(); }

  on(event, fn) {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    this._handlers.get(event)?.delete(fn);
  }

  emit(event, ...args) {
    this._handlers.get(event)?.forEach(fn => fn(...args));
  }

  once(event, fn) {
    const wrapper = (...args) => { fn(...args); this.off(event, wrapper); };
    return this.on(event, wrapper);
  }

  clear() { this._handlers.clear(); }
}

export const bus = new EventBus();


// ---------------------------------------------------------------------------
// Array utilities
// ---------------------------------------------------------------------------

export function range(startOrEnd, end, step) {
  let s, e, st;
  if (end === undefined) { s = 0; e = startOrEnd; st = 1; }
  else { s = startOrEnd; e = end; st = step !== undefined ? step : 1; }
  if (st === 0) return [];
  const result = [];
  if (st > 0) { for (let i = s; i < e; i += st) result.push(i); }
  else        { for (let i = s; i > e; i += st) result.push(i); }
  return result;
}

export function unique(arr, keyFn) {
  if (!keyFn) return [...new Set(arr)];
  const seen = new Set();
  return arr.filter(item => {
    const k = keyFn(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function chunk(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

export function groupBy(arr, keyFn) {
  const result = {};
  for (const item of arr) {
    const k = keyFn(item);
    (result[k] ??= []).push(item);
  }
  return result;
}


// ---------------------------------------------------------------------------
// Object utilities
// ---------------------------------------------------------------------------

export function pick(obj, keys) {
  const result = {};
  for (const k of keys) { if (k in obj) result[k] = obj[k]; }
  return result;
}

export function omit(obj, keys) {
  const exclude = new Set(keys);
  const result = {};
  for (const k of Object.keys(obj)) { if (!exclude.has(k)) result[k] = obj[k]; }
  return result;
}

export function getPath(obj, path, fallback) {
  const keys = path.split('.');
  let cur = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return fallback;
    cur = cur[k];
  }
  return cur === undefined ? fallback : cur;
}

export function setPath(obj, path, value) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
  return obj;
}

export function isEmpty(val) {
  if (val == null) return true;
  if (typeof val === 'string' || Array.isArray(val)) return val.length === 0;
  if (val instanceof Map || val instanceof Set) return val.size === 0;
  if (typeof val === 'object') return Object.keys(val).length === 0;
  return false;
}


// ---------------------------------------------------------------------------
// String utilities
// ---------------------------------------------------------------------------

export function capitalize(str) {
  if (!str) return '';
  return str[0].toUpperCase() + str.slice(1).toLowerCase();
}

export function truncate(str, maxLen, suffix = '…') {
  if (str.length <= maxLen) return str;
  const end = Math.max(0, maxLen - suffix.length);
  return str.slice(0, end) + suffix;
}


// ---------------------------------------------------------------------------
// Number utilities
// ---------------------------------------------------------------------------

export function clamp(val, min, max) {
  return val < min ? min : val > max ? max : val;
}


// ---------------------------------------------------------------------------
// Function utilities
// ---------------------------------------------------------------------------

export function memoize(fn, keyFnOrOpts) {
  let keyFn, maxSize = 0;
  if (typeof keyFnOrOpts === 'function') keyFn = keyFnOrOpts;
  else if (keyFnOrOpts && typeof keyFnOrOpts === 'object') maxSize = keyFnOrOpts.maxSize || 0;

  const cache = new Map();

  const memoized = (...args) => {
    const key = keyFn ? keyFn(...args) : args[0];
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    if (maxSize > 0 && cache.size > maxSize) {
      cache.delete(cache.keys().next().value);
    }
    return result;
  };

  memoized.clear = () => cache.clear();
  return memoized;
}


// ---------------------------------------------------------------------------
// Async utilities
// ---------------------------------------------------------------------------

export function retry(fn, opts = {}) {
  const { attempts = 3, delay = 1000, backoff = 1 } = opts;
  return new Promise((resolve, reject) => {
    let attempt = 0, currentDelay = delay;
    const tryOnce = () => {
      attempt++;
      fn(attempt).then(resolve, (err) => {
        if (attempt >= attempts) return reject(err);
        const d = currentDelay;
        currentDelay *= backoff;
        setTimeout(tryOnce, d);
      });
    };
    tryOnce();
  });
}

export function timeout(promise, ms, message) {
  let timer;
  const race = Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message || `Timed out after ${ms}ms`)), ms);
    })
  ]);
  return race.finally(() => clearTimeout(timer));
}
