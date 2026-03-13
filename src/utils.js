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
