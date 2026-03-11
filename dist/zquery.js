/**
 * zQuery (zeroQuery) v0.8.7
 * Lightweight Frontend Library
 * https://github.com/tonywied17/zero-query
 * (c) 2026 Anthony Wiedman - MIT License
 */
(function(global) {
  'use strict';

// --- src/errors.js -----------------------------------------------
/**
 * zQuery Errors — Structured error handling system
 *
 * Provides typed error classes and a configurable error handler so that
 * errors surface consistently across all modules (reactive, component,
 * router, store, expression parser, HTTP, etc.).
 *
 * Default behaviour: errors are logged via console.warn/error.
 * Users can override with $.onError(handler) to integrate with their
 * own logging, crash-reporting, or UI notification system.
 */

// ---------------------------------------------------------------------------
// Error codes — every zQuery error has a unique code for programmatic use
// ---------------------------------------------------------------------------
const ErrorCode = Object.freeze({
  // Reactive
  REACTIVE_CALLBACK:   'ZQ_REACTIVE_CALLBACK',
  SIGNAL_CALLBACK:     'ZQ_SIGNAL_CALLBACK',
  EFFECT_EXEC:         'ZQ_EFFECT_EXEC',

  // Expression parser
  EXPR_PARSE:          'ZQ_EXPR_PARSE',
  EXPR_EVAL:           'ZQ_EXPR_EVAL',
  EXPR_UNSAFE_ACCESS:  'ZQ_EXPR_UNSAFE_ACCESS',

  // Component
  COMP_INVALID_NAME:   'ZQ_COMP_INVALID_NAME',
  COMP_NOT_FOUND:      'ZQ_COMP_NOT_FOUND',
  COMP_MOUNT_TARGET:   'ZQ_COMP_MOUNT_TARGET',
  COMP_RENDER:         'ZQ_COMP_RENDER',
  COMP_LIFECYCLE:      'ZQ_COMP_LIFECYCLE',
  COMP_RESOURCE:       'ZQ_COMP_RESOURCE',
  COMP_DIRECTIVE:      'ZQ_COMP_DIRECTIVE',

  // Router
  ROUTER_LOAD:         'ZQ_ROUTER_LOAD',
  ROUTER_GUARD:        'ZQ_ROUTER_GUARD',
  ROUTER_RESOLVE:      'ZQ_ROUTER_RESOLVE',

  // Store
  STORE_ACTION:        'ZQ_STORE_ACTION',
  STORE_MIDDLEWARE:     'ZQ_STORE_MIDDLEWARE',
  STORE_SUBSCRIBE:     'ZQ_STORE_SUBSCRIBE',

  // HTTP
  HTTP_REQUEST:        'ZQ_HTTP_REQUEST',
  HTTP_TIMEOUT:        'ZQ_HTTP_TIMEOUT',
  HTTP_INTERCEPTOR:    'ZQ_HTTP_INTERCEPTOR',
  HTTP_PARSE:          'ZQ_HTTP_PARSE',

  // General
  INVALID_ARGUMENT:    'ZQ_INVALID_ARGUMENT',
});


// ---------------------------------------------------------------------------
// ZQueryError — custom error class
// ---------------------------------------------------------------------------
class ZQueryError extends Error {
  /**
   * @param {string} code    — one of ErrorCode values
   * @param {string} message — human-readable description
   * @param {object} [context] — extra data (component name, expression, etc.)
   * @param {Error}  [cause]   — original error
   */
  constructor(code, message, context = {}, cause) {
    super(message);
    this.name = 'ZQueryError';
    this.code = code;
    this.context = context;
    if (cause) this.cause = cause;
  }
}


// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
let _errorHandler = null;

/**
 * Register a global error handler.
 * Called whenever zQuery catches an error internally.
 *
 * @param {Function|null} handler — (error: ZQueryError) => void
 */
function onError(handler) {
  _errorHandler = typeof handler === 'function' ? handler : null;
}

/**
 * Report an error through the global handler and console.
 * Non-throwing — used for recoverable errors in callbacks, lifecycle hooks, etc.
 *
 * @param {string} code — ErrorCode
 * @param {string} message
 * @param {object} [context]
 * @param {Error} [cause]
 */
function reportError(code, message, context = {}, cause) {
  const err = cause instanceof ZQueryError
    ? cause
    : new ZQueryError(code, message, context, cause);

  // User handler gets first crack
  if (_errorHandler) {
    try { _errorHandler(err); } catch { /* prevent handler from crashing framework */ }
  }

  // Always log for developer visibility
  console.error(`[zQuery ${code}] ${message}`, context, cause || '');
}

/**
 * Wrap a callback so that thrown errors are caught, reported, and don't crash
 * the current execution context.
 *
 * @param {Function} fn
 * @param {string} code — ErrorCode to use if the callback throws
 * @param {object} [context]
 * @returns {Function}
 */
function guardCallback(fn, code, context = {}) {
  return (...args) => {
    try {
      return fn(...args);
    } catch (err) {
      reportError(code, err.message || 'Callback error', context, err);
    }
  };
}

/**
 * Validate a required value is defined and of the expected type.
 * Throws ZQueryError on failure (for fast-fail at API boundaries).
 *
 * @param {*} value
 * @param {string} name — parameter name for error message
 * @param {string} expectedType — 'string', 'function', 'object', etc.
 */
function validate(value, name, expectedType) {
  if (value === undefined || value === null) {
    throw new ZQueryError(
      ErrorCode.INVALID_ARGUMENT,
      `"${name}" is required but got ${value}`
    );
  }
  if (expectedType && typeof value !== expectedType) {
    throw new ZQueryError(
      ErrorCode.INVALID_ARGUMENT,
      `"${name}" must be a ${expectedType}, got ${typeof value}`
    );
  }
}

// --- src/reactive.js ---------------------------------------------
/**
 * zQuery Reactive — Proxy-based deep reactivity system
 * 
 * Creates observable objects that trigger callbacks on mutation.
 * Used internally by components and store for auto-updates.
 */


// ---------------------------------------------------------------------------
// Deep reactive proxy
// ---------------------------------------------------------------------------
function reactive(target, onChange, _path = '') {
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
// Signal — lightweight reactive primitive (inspired by Solid/Preact signals)
// ---------------------------------------------------------------------------
class Signal {
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
    // Snapshot subscribers before iterating — a subscriber might modify
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

/**
 * Create a signal
 * @param {*} initial — initial value
 * @returns {Signal}
 */
function signal(initial) {
  return new Signal(initial);
}

/**
 * Create a computed signal (derived from other signals)
 * @param {Function} fn — computation function
 * @returns {Signal}
 */
function computed(fn) {
  const s = new Signal(undefined);
  effect(() => { s._value = fn(); s._notify(); });
  return s;
}

/**
 * Create a side-effect that auto-tracks signal dependencies.
 * Returns a dispose function that removes the effect from all
 * signals it subscribed to — prevents memory leaks.
 *
 * @param {Function} fn — effect function
 * @returns {Function} — dispose function
 */
function effect(fn) {
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
    Signal._activeEffect = null;
  };
}

// --- src/core.js -------------------------------------------------
/**
 * zQuery Core — Selector engine & chainable DOM collection
 * 
 * Extends the quick-ref pattern (Id, Class, Classes, Children)
 * into a full jQuery-like chainable wrapper with modern APIs.
 */


// ---------------------------------------------------------------------------
// ZQueryCollection — wraps an array of elements with chainable methods
// ---------------------------------------------------------------------------
class ZQueryCollection {
  constructor(elements) {
    this.elements = Array.isArray(elements) ? elements : [elements];
    this.length = this.elements.length;
    this.elements.forEach((el, i) => { this[i] = el; });
  }

  // --- Iteration -----------------------------------------------------------

  each(fn) {
    this.elements.forEach((el, i) => fn.call(el, i, el));
    return this;
  }

  map(fn) {
    return this.elements.map((el, i) => fn.call(el, i, el));
  }

  forEach(fn) {
    this.elements.forEach((el, i) => fn(el, i, this.elements));
    return this;
  }

  first() { return this.elements[0] || null; }
  last()  { return this.elements[this.length - 1] || null; }
  eq(i)   { return new ZQueryCollection(this.elements[i] ? [this.elements[i]] : []); }
  toArray(){ return [...this.elements]; }

  [Symbol.iterator]() { return this.elements[Symbol.iterator](); }

  // --- Traversal -----------------------------------------------------------

  find(selector) {
    const found = [];
    this.elements.forEach(el => found.push(...el.querySelectorAll(selector)));
    return new ZQueryCollection(found);
  }

  parent() {
    const parents = [...new Set(this.elements.map(el => el.parentElement).filter(Boolean))];
    return new ZQueryCollection(parents);
  }

  closest(selector) {
    return new ZQueryCollection(
      this.elements.map(el => el.closest(selector)).filter(Boolean)
    );
  }

  children(selector) {
    const kids = [];
    this.elements.forEach(el => {
      kids.push(...(selector
        ? el.querySelectorAll(`:scope > ${selector}`)
        : el.children));
    });
    return new ZQueryCollection([...kids]);
  }

  siblings() {
    const sibs = [];
    this.elements.forEach(el => {
      sibs.push(...[...el.parentElement.children].filter(c => c !== el));
    });
    return new ZQueryCollection(sibs);
  }

  next(selector)  {
    const els = this.elements.map(el => el.nextElementSibling).filter(Boolean);
    return new ZQueryCollection(selector ? els.filter(el => el.matches(selector)) : els);
  }

  prev(selector)  {
    const els = this.elements.map(el => el.previousElementSibling).filter(Boolean);
    return new ZQueryCollection(selector ? els.filter(el => el.matches(selector)) : els);
  }

  nextAll(selector) {
    const result = [];
    this.elements.forEach(el => {
      let sib = el.nextElementSibling;
      while (sib) {
        if (!selector || sib.matches(selector)) result.push(sib);
        sib = sib.nextElementSibling;
      }
    });
    return new ZQueryCollection(result);
  }

  nextUntil(selector, filter) {
    const result = [];
    this.elements.forEach(el => {
      let sib = el.nextElementSibling;
      while (sib) {
        if (selector && sib.matches(selector)) break;
        if (!filter || sib.matches(filter)) result.push(sib);
        sib = sib.nextElementSibling;
      }
    });
    return new ZQueryCollection(result);
  }

  prevAll(selector) {
    const result = [];
    this.elements.forEach(el => {
      let sib = el.previousElementSibling;
      while (sib) {
        if (!selector || sib.matches(selector)) result.push(sib);
        sib = sib.previousElementSibling;
      }
    });
    return new ZQueryCollection(result);
  }

  prevUntil(selector, filter) {
    const result = [];
    this.elements.forEach(el => {
      let sib = el.previousElementSibling;
      while (sib) {
        if (selector && sib.matches(selector)) break;
        if (!filter || sib.matches(filter)) result.push(sib);
        sib = sib.previousElementSibling;
      }
    });
    return new ZQueryCollection(result);
  }

  parents(selector) {
    const result = [];
    this.elements.forEach(el => {
      let parent = el.parentElement;
      while (parent) {
        if (!selector || parent.matches(selector)) result.push(parent);
        parent = parent.parentElement;
      }
    });
    return new ZQueryCollection([...new Set(result)]);
  }

  parentsUntil(selector, filter) {
    const result = [];
    this.elements.forEach(el => {
      let parent = el.parentElement;
      while (parent) {
        if (selector && parent.matches(selector)) break;
        if (!filter || parent.matches(filter)) result.push(parent);
        parent = parent.parentElement;
      }
    });
    return new ZQueryCollection([...new Set(result)]);
  }

  contents() {
    const result = [];
    this.elements.forEach(el => result.push(...el.childNodes));
    return new ZQueryCollection(result);
  }

  filter(selector) {
    if (typeof selector === 'function') {
      return new ZQueryCollection(this.elements.filter(selector));
    }
    return new ZQueryCollection(this.elements.filter(el => el.matches(selector)));
  }

  not(selector) {
    if (typeof selector === 'function') {
      return new ZQueryCollection(this.elements.filter((el, i) => !selector.call(el, i, el)));
    }
    return new ZQueryCollection(this.elements.filter(el => !el.matches(selector)));
  }

  has(selector) {
    return new ZQueryCollection(this.elements.filter(el => el.querySelector(selector)));
  }

  is(selector) {
    if (typeof selector === 'function') {
      return this.elements.some((el, i) => selector.call(el, i, el));
    }
    return this.elements.some(el => el.matches(selector));
  }

  slice(start, end) {
    return new ZQueryCollection(this.elements.slice(start, end));
  }

  add(selector, context) {
    const toAdd = (selector instanceof ZQueryCollection)
      ? selector.elements
      : (selector instanceof Node)
        ? [selector]
        : Array.from((context || document).querySelectorAll(selector));
    return new ZQueryCollection([...this.elements, ...toAdd]);
  }

  get(index) {
    if (index === undefined) return [...this.elements];
    return index < 0 ? this.elements[this.length + index] : this.elements[index];
  }

  index(selector) {
    if (selector === undefined) {
      const el = this.first();
      return el ? Array.from(el.parentElement.children).indexOf(el) : -1;
    }
    const target = (typeof selector === 'string')
      ? document.querySelector(selector)
      : selector;
    return this.elements.indexOf(target);
  }

  // --- Classes -------------------------------------------------------------

  addClass(...names) {
    // Fast path: single class, no spaces — avoids flatMap + regex split allocation
    if (names.length === 1 && names[0].indexOf(' ') === -1) {
      const c = names[0];
      for (let i = 0; i < this.elements.length; i++) this.elements[i].classList.add(c);
      return this;
    }
    const classes = names.flatMap(n => n.split(/\s+/));
    for (let i = 0; i < this.elements.length; i++) this.elements[i].classList.add(...classes);
    return this;
  }

  removeClass(...names) {
    if (names.length === 1 && names[0].indexOf(' ') === -1) {
      const c = names[0];
      for (let i = 0; i < this.elements.length; i++) this.elements[i].classList.remove(c);
      return this;
    }
    const classes = names.flatMap(n => n.split(/\s+/));
    for (let i = 0; i < this.elements.length; i++) this.elements[i].classList.remove(...classes);
    return this;
  }

  toggleClass(...args) {
    const force = typeof args[args.length - 1] === 'boolean' ? args.pop() : undefined;
    // Fast path: single class, no spaces
    if (args.length === 1 && args[0].indexOf(' ') === -1) {
      const c = args[0];
      for (let i = 0; i < this.elements.length; i++) {
        force !== undefined ? this.elements[i].classList.toggle(c, force) : this.elements[i].classList.toggle(c);
      }
      return this;
    }
    const classes = args.flatMap(n => n.split(/\s+/));
    for (let i = 0; i < this.elements.length; i++) {
      const el = this.elements[i];
      for (let j = 0; j < classes.length; j++) {
        force !== undefined ? el.classList.toggle(classes[j], force) : el.classList.toggle(classes[j]);
      }
    }
    return this;
  }

  hasClass(name) {
    return this.first()?.classList.contains(name) || false;
  }

  // --- Attributes ----------------------------------------------------------

  attr(name, value) {
    if (value === undefined) return this.first()?.getAttribute(name);
    return this.each((_, el) => el.setAttribute(name, value));
  }

  removeAttr(name) {
    return this.each((_, el) => el.removeAttribute(name));
  }

  prop(name, value) {
    if (value === undefined) return this.first()?.[name];
    return this.each((_, el) => { el[name] = value; });
  }

  data(key, value) {
    if (value === undefined) {
      if (key === undefined) return this.first()?.dataset;
      const raw = this.first()?.dataset[key];
      try { return JSON.parse(raw); } catch { return raw; }
    }
    return this.each((_, el) => { el.dataset[key] = typeof value === 'object' ? JSON.stringify(value) : value; });
  }

  // --- CSS / Dimensions ----------------------------------------------------

  css(props) {
    if (typeof props === 'string') {
      const el = this.first();
      return el ? getComputedStyle(el)[props] : undefined;
    }
    return this.each((_, el) => Object.assign(el.style, props));
  }

  width()  { return this.first()?.getBoundingClientRect().width; }
  height() { return this.first()?.getBoundingClientRect().height; }

  offset() {
    const r = this.first()?.getBoundingClientRect();
    return r ? { top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height } : null;
  }

  position() {
    const el = this.first();
    return el ? { top: el.offsetTop, left: el.offsetLeft } : null;
  }

  scrollTop(value) {
    if (value === undefined) {
      const el = this.first();
      return el === window ? window.scrollY : el?.scrollTop;
    }
    return this.each((_, el) => {
      if (el === window) window.scrollTo(window.scrollX, value);
      else el.scrollTop = value;
    });
  }

  scrollLeft(value) {
    if (value === undefined) {
      const el = this.first();
      return el === window ? window.scrollX : el?.scrollLeft;
    }
    return this.each((_, el) => {
      if (el === window) window.scrollTo(value, window.scrollY);
      else el.scrollLeft = value;
    });
  }

  innerWidth() {
    const el = this.first();
    return el?.clientWidth;
  }

  innerHeight() {
    const el = this.first();
    return el?.clientHeight;
  }

  outerWidth(includeMargin = false) {
    const el = this.first();
    if (!el) return undefined;
    let w = el.offsetWidth;
    if (includeMargin) {
      const style = getComputedStyle(el);
      w += parseFloat(style.marginLeft) + parseFloat(style.marginRight);
    }
    return w;
  }

  outerHeight(includeMargin = false) {
    const el = this.first();
    if (!el) return undefined;
    let h = el.offsetHeight;
    if (includeMargin) {
      const style = getComputedStyle(el);
      h += parseFloat(style.marginTop) + parseFloat(style.marginBottom);
    }
    return h;
  }

  // --- Content -------------------------------------------------------------

  html(content) {
    if (content === undefined) return this.first()?.innerHTML;
    // Auto-morph: if the element already has children, use the diff engine
    // to patch the DOM (preserves focus, scroll, state, keyed reorder via LIS).
    // Empty elements get raw innerHTML for fast first-paint — same strategy
    // the component system uses (first render = innerHTML, updates = morph).
    return this.each((_, el) => {
      if (el.childNodes.length > 0) {
        _morph(el, content);
      } else {
        el.innerHTML = content;
      }
    });
  }

  morph(content) {
    return this.each((_, el) => { _morph(el, content); });
  }

  text(content) {
    if (content === undefined) return this.first()?.textContent;
    return this.each((_, el) => { el.textContent = content; });
  }

  val(value) {
    if (value === undefined) return this.first()?.value;
    return this.each((_, el) => { el.value = value; });
  }

  // --- DOM Manipulation ----------------------------------------------------

  append(content) {
    return this.each((_, el) => {
      if (typeof content === 'string') el.insertAdjacentHTML('beforeend', content);
      else if (content instanceof ZQueryCollection) content.each((__, c) => el.appendChild(c));
      else if (content instanceof Node) el.appendChild(content);
    });
  }

  prepend(content) {
    return this.each((_, el) => {
      if (typeof content === 'string') el.insertAdjacentHTML('afterbegin', content);
      else if (content instanceof Node) el.insertBefore(content, el.firstChild);
    });
  }

  after(content) {
    return this.each((_, el) => {
      if (typeof content === 'string') el.insertAdjacentHTML('afterend', content);
      else if (content instanceof Node) el.parentNode.insertBefore(content, el.nextSibling);
    });
  }

  before(content) {
    return this.each((_, el) => {
      if (typeof content === 'string') el.insertAdjacentHTML('beforebegin', content);
      else if (content instanceof Node) el.parentNode.insertBefore(content, el);
    });
  }

  wrap(wrapper) {
    return this.each((_, el) => {
      const w = typeof wrapper === 'string' ? createFragment(wrapper).firstElementChild : wrapper.cloneNode(true);
      el.parentNode.insertBefore(w, el);
      w.appendChild(el);
    });
  }

  remove() {
    return this.each((_, el) => el.remove());
  }

  empty() {
    // textContent = '' clears all children without invoking the HTML parser
    return this.each((_, el) => { el.textContent = ''; });
  }

  clone(deep = true) {
    return new ZQueryCollection(this.elements.map(el => el.cloneNode(deep)));
  }

  replaceWith(content) {
    return this.each((_, el) => {
      if (typeof content === 'string') {
        // Auto-morph: diff attributes + children when the tag name matches
        // instead of destroying and re-creating the element.
        _morphElement(el, content);
      } else if (content instanceof Node) {
        el.parentNode.replaceChild(content, el);
      }
    });
  }

  appendTo(target) {
    const dest = typeof target === 'string' ? document.querySelector(target) : target instanceof ZQueryCollection ? target.first() : target;
    if (dest) this.each((_, el) => dest.appendChild(el));
    return this;
  }

  prependTo(target) {
    const dest = typeof target === 'string' ? document.querySelector(target) : target instanceof ZQueryCollection ? target.first() : target;
    if (dest) this.each((_, el) => dest.insertBefore(el, dest.firstChild));
    return this;
  }

  insertAfter(target) {
    const ref = typeof target === 'string' ? document.querySelector(target) : target instanceof ZQueryCollection ? target.first() : target;
    if (ref && ref.parentNode) this.each((_, el) => ref.parentNode.insertBefore(el, ref.nextSibling));
    return this;
  }

  insertBefore(target) {
    const ref = typeof target === 'string' ? document.querySelector(target) : target instanceof ZQueryCollection ? target.first() : target;
    if (ref && ref.parentNode) this.each((_, el) => ref.parentNode.insertBefore(el, ref));
    return this;
  }

  replaceAll(target) {
    const targets = typeof target === 'string'
      ? Array.from(document.querySelectorAll(target))
      : target instanceof ZQueryCollection ? target.elements : [target];
    targets.forEach((t, i) => {
      const nodes = i === 0 ? this.elements : this.elements.map(el => el.cloneNode(true));
      nodes.forEach(el => t.parentNode.insertBefore(el, t));
      t.remove();
    });
    return this;
  }

  unwrap(selector) {
    this.elements.forEach(el => {
      const parent = el.parentElement;
      if (!parent || parent === document.body) return;
      if (selector && !parent.matches(selector)) return;
      parent.replaceWith(...parent.childNodes);
    });
    return this;
  }

  wrapAll(wrapper) {
    const w = typeof wrapper === 'string' ? createFragment(wrapper).firstElementChild : wrapper.cloneNode(true);
    const first = this.first();
    if (!first) return this;
    first.parentNode.insertBefore(w, first);
    this.each((_, el) => w.appendChild(el));
    return this;
  }

  wrapInner(wrapper) {
    return this.each((_, el) => {
      const w = typeof wrapper === 'string' ? createFragment(wrapper).firstElementChild : wrapper.cloneNode(true);
      while (el.firstChild) w.appendChild(el.firstChild);
      el.appendChild(w);
    });
  }

  detach() {
    return this.each((_, el) => el.remove());
  }

  // --- Visibility ----------------------------------------------------------

  show(display = '') {
    return this.each((_, el) => { el.style.display = display; });
  }

  hide() {
    return this.each((_, el) => { el.style.display = 'none'; });
  }

  toggle(display = '') {
    return this.each((_, el) => {
      // Check inline style first (cheap) before forcing layout via getComputedStyle
      const hidden = el.style.display === 'none' || (el.style.display !== '' ? false : getComputedStyle(el).display === 'none');
      el.style.display = hidden ? display : 'none';
    });
  }

  // --- Events --------------------------------------------------------------

  on(event, selectorOrHandler, handler) {
    // Support multiple events: "click mouseenter"
    const events = event.split(/\s+/);
    return this.each((_, el) => {
      events.forEach(evt => {
        if (typeof selectorOrHandler === 'function') {
          el.addEventListener(evt, selectorOrHandler);
        } else if (typeof selectorOrHandler === 'string') {
          // Delegated event — only works on elements that support closest()
          el.addEventListener(evt, (e) => {
            if (!e.target || typeof e.target.closest !== 'function') return;
            const target = e.target.closest(selectorOrHandler);
            if (target && el.contains(target)) handler.call(target, e);
          });
        }
      });
    });
  }

  off(event, handler) {
    const events = event.split(/\s+/);
    return this.each((_, el) => {
      events.forEach(evt => el.removeEventListener(evt, handler));
    });
  }

  one(event, handler) {
    return this.each((_, el) => {
      el.addEventListener(event, handler, { once: true });
    });
  }

  trigger(event, detail) {
    return this.each((_, el) => {
      el.dispatchEvent(new CustomEvent(event, { detail, bubbles: true, cancelable: true }));
    });
  }

  // Convenience event shorthands
  click(fn)   { return fn ? this.on('click', fn) : this.trigger('click'); }
  submit(fn)  { return fn ? this.on('submit', fn) : this.trigger('submit'); }
  focus()     { this.first()?.focus(); return this; }
  blur()      { this.first()?.blur(); return this; }
  hover(enterFn, leaveFn) {
    this.on('mouseenter', enterFn);
    return this.on('mouseleave', leaveFn || enterFn);
  }

  // --- Animation -----------------------------------------------------------

  animate(props, duration = 300, easing = 'ease') {
    return new Promise(resolve => {
      const count = { done: 0 };
      this.each((_, el) => {
        el.style.transition = `all ${duration}ms ${easing}`;
        requestAnimationFrame(() => {
          Object.assign(el.style, props);
          const onEnd = () => {
            el.removeEventListener('transitionend', onEnd);
            el.style.transition = '';
            if (++count.done >= this.length) resolve(this);
          };
          el.addEventListener('transitionend', onEnd);
        });
      });
      // Fallback in case transitionend doesn't fire
      setTimeout(() => resolve(this), duration + 50);
    });
  }

  fadeIn(duration = 300) {
    return this.css({ opacity: '0', display: '' }).animate({ opacity: '1' }, duration);
  }

  fadeOut(duration = 300) {
    return this.animate({ opacity: '0' }, duration).then(col => col.hide());
  }

  fadeToggle(duration = 300) {
    return Promise.all(this.elements.map(el => {
      const visible = getComputedStyle(el).opacity !== '0' && getComputedStyle(el).display !== 'none';
      const col = new ZQueryCollection([el]);
      return visible ? col.fadeOut(duration) : col.fadeIn(duration);
    })).then(() => this);
  }

  fadeTo(duration, opacity) {
    return this.animate({ opacity: String(opacity) }, duration);
  }

  slideDown(duration = 300) {
    return this.each((_, el) => {
      el.style.display = '';
      el.style.overflow = 'hidden';
      const h = el.scrollHeight + 'px';
      el.style.maxHeight = '0';
      el.style.transition = `max-height ${duration}ms ease`;
      requestAnimationFrame(() => { el.style.maxHeight = h; });
      setTimeout(() => { el.style.maxHeight = ''; el.style.overflow = ''; el.style.transition = ''; }, duration);
    });
  }

  slideUp(duration = 300) {
    return this.each((_, el) => {
      el.style.overflow = 'hidden';
      el.style.maxHeight = el.scrollHeight + 'px';
      el.style.transition = `max-height ${duration}ms ease`;
      requestAnimationFrame(() => { el.style.maxHeight = '0'; });
      setTimeout(() => { el.style.display = 'none'; el.style.maxHeight = ''; el.style.overflow = ''; el.style.transition = ''; }, duration);
    });
  }

  slideToggle(duration = 300) {
    return this.each((_, el) => {
      if (el.style.display === 'none' || getComputedStyle(el).display === 'none') {
        el.style.display = '';
        el.style.overflow = 'hidden';
        const h = el.scrollHeight + 'px';
        el.style.maxHeight = '0';
        el.style.transition = `max-height ${duration}ms ease`;
        requestAnimationFrame(() => { el.style.maxHeight = h; });
        setTimeout(() => { el.style.maxHeight = ''; el.style.overflow = ''; el.style.transition = ''; }, duration);
      } else {
        el.style.overflow = 'hidden';
        el.style.maxHeight = el.scrollHeight + 'px';
        el.style.transition = `max-height ${duration}ms ease`;
        requestAnimationFrame(() => { el.style.maxHeight = '0'; });
        setTimeout(() => { el.style.display = 'none'; el.style.maxHeight = ''; el.style.overflow = ''; el.style.transition = ''; }, duration);
      }
    });
  }

  // --- Form helpers --------------------------------------------------------

  serialize() {
    const form = this.first();
    if (!form || form.tagName !== 'FORM') return '';
    return new URLSearchParams(new FormData(form)).toString();
  }

  serializeObject() {
    const form = this.first();
    if (!form || form.tagName !== 'FORM') return {};
    const obj = {};
    new FormData(form).forEach((v, k) => {
      if (obj[k] !== undefined) {
        if (!Array.isArray(obj[k])) obj[k] = [obj[k]];
        obj[k].push(v);
      } else {
        obj[k] = v;
      }
    });
    return obj;
  }
}


// ---------------------------------------------------------------------------
// Helper — create document fragment from HTML string
// ---------------------------------------------------------------------------
function createFragment(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content;
}


// ---------------------------------------------------------------------------
// $() — main selector / creator (returns ZQueryCollection, like jQuery)
// ---------------------------------------------------------------------------
function query(selector, context) {
  // null / undefined
  if (!selector) return new ZQueryCollection([]);

  // Already a collection — return as-is
  if (selector instanceof ZQueryCollection) return selector;

  // DOM element or Window — wrap in collection
  if (selector instanceof Node || selector === window) {
    return new ZQueryCollection([selector]);
  }

  // NodeList / HTMLCollection / Array — wrap in collection
  if (selector instanceof NodeList || selector instanceof HTMLCollection || Array.isArray(selector)) {
    return new ZQueryCollection(Array.from(selector));
  }

  // HTML string → create elements, wrap in collection
  if (typeof selector === 'string' && selector.trim().startsWith('<')) {
    const fragment = createFragment(selector);
    return new ZQueryCollection([...fragment.childNodes].filter(n => n.nodeType === 1));
  }

  // CSS selector string → querySelectorAll (collection)
  if (typeof selector === 'string') {
    const root = context
      ? (typeof context === 'string' ? document.querySelector(context) : context)
      : document;
    return new ZQueryCollection([...root.querySelectorAll(selector)]);
  }

  return new ZQueryCollection([]);
}


// ---------------------------------------------------------------------------
// $.all() — collection selector (returns ZQueryCollection for CSS selectors)
// ---------------------------------------------------------------------------
function queryAll(selector, context) {
  // null / undefined
  if (!selector) return new ZQueryCollection([]);

  // Already a collection
  if (selector instanceof ZQueryCollection) return selector;

  // DOM element or Window
  if (selector instanceof Node || selector === window) {
    return new ZQueryCollection([selector]);
  }

  // NodeList / HTMLCollection / Array
  if (selector instanceof NodeList || selector instanceof HTMLCollection || Array.isArray(selector)) {
    return new ZQueryCollection(Array.from(selector));
  }

  // HTML string → create elements
  if (typeof selector === 'string' && selector.trim().startsWith('<')) {
    const fragment = createFragment(selector);
    return new ZQueryCollection([...fragment.childNodes].filter(n => n.nodeType === 1));
  }

  // CSS selector string → querySelectorAll (collection)
  if (typeof selector === 'string') {
    const root = context
      ? (typeof context === 'string' ? document.querySelector(context) : context)
      : document;
    return new ZQueryCollection([...root.querySelectorAll(selector)]);
  }

  return new ZQueryCollection([]);
}


// ---------------------------------------------------------------------------
// Quick-ref shortcuts, on $ namespace)
// ---------------------------------------------------------------------------
query.id       = (id) => document.getElementById(id);
query.class    = (name) => document.querySelector(`.${name}`);
query.classes  = (name) => new ZQueryCollection(Array.from(document.getElementsByClassName(name)));
query.tag      = (name) => new ZQueryCollection(Array.from(document.getElementsByTagName(name)));
Object.defineProperty(query, 'name', {
  value: (name) => new ZQueryCollection(Array.from(document.getElementsByName(name))),
  writable: true, configurable: true
});
query.children = (parentId) => {
  const p = document.getElementById(parentId);
  return new ZQueryCollection(p ? Array.from(p.children) : []);
};

// Create element shorthand — returns ZQueryCollection for chaining
query.create = (tag, attrs = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'data' && typeof v === 'object') Object.entries(v).forEach(([dk, dv]) => { el.dataset[dk] = dv; });
    else el.setAttribute(k, v);
  }
  children.flat().forEach(child => {
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else if (child instanceof Node) el.appendChild(child);
  });
  return new ZQueryCollection(el);
};

// DOM ready
query.ready = (fn) => {
  if (document.readyState !== 'loading') fn();
  else document.addEventListener('DOMContentLoaded', fn);
};

// Global event listeners — supports direct, delegated, and target-bound forms
//   $.on('keydown', handler)           → direct listener on document
//   $.on('click', '.btn', handler)     → delegated via closest()
//   $.on('scroll', window, handler)    → direct listener on target
query.on = (event, selectorOrHandler, handler) => {
  if (typeof selectorOrHandler === 'function') {
    // 2-arg: direct document listener (keydown, resize, etc.)
    document.addEventListener(event, selectorOrHandler);
    return;
  }
  // EventTarget (window, element, etc.) — direct listener on target
  if (typeof selectorOrHandler === 'object' && typeof selectorOrHandler.addEventListener === 'function') {
    selectorOrHandler.addEventListener(event, handler);
    return;
  }
  // 3-arg string: delegated
  document.addEventListener(event, (e) => {
    if (!e.target || typeof e.target.closest !== 'function') return;
    const target = e.target.closest(selectorOrHandler);
    if (target) handler.call(target, e);
  });
};

// Remove a direct global listener
query.off = (event, handler) => {
  document.removeEventListener(event, handler);
};

// Extend collection prototype (like $.fn in jQuery)
query.fn = ZQueryCollection.prototype;

// --- src/expression.js -------------------------------------------
/**
 * zQuery Expression Parser — CSP-safe expression evaluator
 *
 * Replaces `new Function()` / `eval()` with a hand-written parser that
 * evaluates expressions safely without violating Content Security Policy.
 *
 * Supports:
 *   - Property access:       user.name, items[0], items[i]
 *   - Method calls:          items.length, str.toUpperCase()
 *   - Arithmetic:            a + b, count * 2, i % 2
 *   - Comparison:            a === b, count > 0, x != null
 *   - Logical:               a && b, a || b, !a
 *   - Ternary:               a ? b : c
 *   - Typeof:                typeof x
 *   - Unary:                 -a, +a, !a
 *   - Literals:              42, 'hello', "world", true, false, null, undefined
 *   - Template literals:     `Hello ${name}`
 *   - Array literals:        [1, 2, 3]
 *   - Object literals:       { foo: 'bar', baz: 1 }
 *   - Grouping:              (a + b) * c
 *   - Nullish coalescing:    a ?? b
 *   - Optional chaining:     a?.b, a?.[b], a?.()
 *   - Arrow functions:       x => x.id, (a, b) => a + b
 */

// Token types
const T = {
  NUM: 1, STR: 2, IDENT: 3, OP: 4, PUNC: 5, TMPL: 6, EOF: 7
};

// Operator precedence (higher = binds tighter)
const PREC = {
  '??': 2,
  '||': 3,
  '&&': 4,
  '==': 8, '!=': 8, '===': 8, '!==': 8,
  '<': 9, '>': 9, '<=': 9, '>=': 9, 'instanceof': 9, 'in': 9,
  '+': 11, '-': 11,
  '*': 12, '/': 12, '%': 12,
};

const KEYWORDS = new Set([
  'true', 'false', 'null', 'undefined', 'typeof', 'instanceof', 'in',
  'new', 'void'
]);

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------
function tokenize(expr) {
  const tokens = [];
  let i = 0;
  const len = expr.length;

  while (i < len) {
    const ch = expr[i];

    // Whitespace
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { i++; continue; }

    // Numbers
    if ((ch >= '0' && ch <= '9') || (ch === '.' && i + 1 < len && expr[i + 1] >= '0' && expr[i + 1] <= '9')) {
      let num = '';
      if (ch === '0' && i + 1 < len && (expr[i + 1] === 'x' || expr[i + 1] === 'X')) {
        num = '0x'; i += 2;
        while (i < len && /[0-9a-fA-F]/.test(expr[i])) num += expr[i++];
      } else {
        while (i < len && ((expr[i] >= '0' && expr[i] <= '9') || expr[i] === '.')) num += expr[i++];
        if (i < len && (expr[i] === 'e' || expr[i] === 'E')) {
          num += expr[i++];
          if (i < len && (expr[i] === '+' || expr[i] === '-')) num += expr[i++];
          while (i < len && expr[i] >= '0' && expr[i] <= '9') num += expr[i++];
        }
      }
      tokens.push({ t: T.NUM, v: Number(num) });
      continue;
    }

    // Strings
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let str = '';
      i++;
      while (i < len && expr[i] !== quote) {
        if (expr[i] === '\\' && i + 1 < len) {
          const esc = expr[++i];
          if (esc === 'n') str += '\n';
          else if (esc === 't') str += '\t';
          else if (esc === 'r') str += '\r';
          else if (esc === '\\') str += '\\';
          else if (esc === quote) str += quote;
          else str += esc;
        } else {
          str += expr[i];
        }
        i++;
      }
      i++; // closing quote
      tokens.push({ t: T.STR, v: str });
      continue;
    }

    // Template literals
    if (ch === '`') {
      const parts = []; // alternating: string, expr, string, expr, ...
      let str = '';
      i++;
      while (i < len && expr[i] !== '`') {
        if (expr[i] === '$' && i + 1 < len && expr[i + 1] === '{') {
          parts.push(str);
          str = '';
          i += 2;
          let depth = 1;
          let inner = '';
          while (i < len && depth > 0) {
            if (expr[i] === '{') depth++;
            else if (expr[i] === '}') { depth--; if (depth === 0) break; }
            inner += expr[i++];
          }
          i++; // closing }
          parts.push({ expr: inner });
        } else {
          if (expr[i] === '\\' && i + 1 < len) { str += expr[++i]; }
          else str += expr[i];
          i++;
        }
      }
      i++; // closing backtick
      parts.push(str);
      tokens.push({ t: T.TMPL, v: parts });
      continue;
    }

    // Identifiers & keywords
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$') {
      let ident = '';
      while (i < len && /[\w$]/.test(expr[i])) ident += expr[i++];
      tokens.push({ t: T.IDENT, v: ident });
      continue;
    }

    // Multi-char operators
    const two = expr.slice(i, i + 3);
    if (two === '===' || two === '!==' || two === '?.') {
      if (two === '?.') {
        tokens.push({ t: T.OP, v: '?.' });
        i += 2;
      } else {
        tokens.push({ t: T.OP, v: two });
        i += 3;
      }
      continue;
    }
    const pair = expr.slice(i, i + 2);
    if (pair === '==' || pair === '!=' || pair === '<=' || pair === '>=' ||
        pair === '&&' || pair === '||' || pair === '??' || pair === '?.' ||
        pair === '=>') {
      tokens.push({ t: T.OP, v: pair });
      i += 2;
      continue;
    }

    // Single char operators and punctuation
    if ('+-*/%'.includes(ch)) {
      tokens.push({ t: T.OP, v: ch });
      i++; continue;
    }
    if ('<>=!'.includes(ch)) {
      tokens.push({ t: T.OP, v: ch });
      i++; continue;
    }
    if ('()[]{},.?:'.includes(ch)) {
      tokens.push({ t: T.PUNC, v: ch });
      i++; continue;
    }

    // Unknown — skip
    i++;
  }

  tokens.push({ t: T.EOF, v: null });
  return tokens;
}

// ---------------------------------------------------------------------------
// Parser — Pratt (precedence climbing)
// ---------------------------------------------------------------------------
class Parser {
  constructor(tokens, scope) {
    this.tokens = tokens;
    this.pos = 0;
    this.scope = scope;
  }

  peek() { return this.tokens[this.pos]; }
  next() { return this.tokens[this.pos++]; }

  expect(type, val) {
    const t = this.next();
    if (t.t !== type || (val !== undefined && t.v !== val)) {
      throw new Error(`Expected ${val || type} but got ${t.v}`);
    }
    return t;
  }

  match(type, val) {
    const t = this.peek();
    if (t.t === type && (val === undefined || t.v === val)) {
      return this.next();
    }
    return null;
  }

  // Main entry
  parse() {
    const result = this.parseExpression(0);
    return result;
  }

  // Precedence climbing
  parseExpression(minPrec) {
    let left = this.parseUnary();

    while (true) {
      const tok = this.peek();

      // Ternary
      if (tok.t === T.PUNC && tok.v === '?') {
        // Distinguish ternary ? from optional chaining ?.
        if (this.tokens[this.pos + 1]?.v !== '.') {
          if (1 <= minPrec) break; // ternary has very low precedence
          this.next(); // consume ?
          const truthy = this.parseExpression(0);
          this.expect(T.PUNC, ':');
          const falsy = this.parseExpression(1);
          left = { type: 'ternary', cond: left, truthy, falsy };
          continue;
        }
      }

      // Binary operators
      if (tok.t === T.OP && tok.v in PREC) {
        const prec = PREC[tok.v];
        if (prec <= minPrec) break;
        this.next();
        const right = this.parseExpression(prec);
        left = { type: 'binary', op: tok.v, left, right };
        continue;
      }

      // instanceof and in as binary operators
      if (tok.t === T.IDENT && (tok.v === 'instanceof' || tok.v === 'in') && PREC[tok.v] > minPrec) {
        const prec = PREC[tok.v];
        this.next();
        const right = this.parseExpression(prec);
        left = { type: 'binary', op: tok.v, left, right };
        continue;
      }

      break;
    }

    return left;
  }

  parseUnary() {
    const tok = this.peek();

    // typeof
    if (tok.t === T.IDENT && tok.v === 'typeof') {
      this.next();
      const arg = this.parseUnary();
      return { type: 'typeof', arg };
    }

    // void
    if (tok.t === T.IDENT && tok.v === 'void') {
      this.next();
      this.parseUnary(); // evaluate but discard
      return { type: 'literal', value: undefined };
    }

    // !expr
    if (tok.t === T.OP && tok.v === '!') {
      this.next();
      const arg = this.parseUnary();
      return { type: 'not', arg };
    }

    // -expr, +expr
    if (tok.t === T.OP && (tok.v === '-' || tok.v === '+')) {
      this.next();
      const arg = this.parseUnary();
      return { type: 'unary', op: tok.v, arg };
    }

    return this.parsePostfix();
  }

  parsePostfix() {
    let left = this.parsePrimary();

    while (true) {
      const tok = this.peek();

      // Property access: a.b
      if (tok.t === T.PUNC && tok.v === '.') {
        this.next();
        const prop = this.next();
        left = { type: 'member', obj: left, prop: prop.v, computed: false };
        // Check for method call: a.b()
        if (this.peek().t === T.PUNC && this.peek().v === '(') {
          left = this._parseCall(left);
        }
        continue;
      }

      // Optional chaining: a?.b, a?.[b], a?.()
      if (tok.t === T.OP && tok.v === '?.') {
        this.next();
        const next = this.peek();
        if (next.t === T.PUNC && next.v === '[') {
          // a?.[expr]
          this.next();
          const prop = this.parseExpression(0);
          this.expect(T.PUNC, ']');
          left = { type: 'optional_member', obj: left, prop, computed: true };
        } else if (next.t === T.PUNC && next.v === '(') {
          // a?.()
          left = { type: 'optional_call', callee: left, args: this._parseArgs() };
        } else {
          // a?.b
          const prop = this.next();
          left = { type: 'optional_member', obj: left, prop: prop.v, computed: false };
          if (this.peek().t === T.PUNC && this.peek().v === '(') {
            left = this._parseCall(left);
          }
        }
        continue;
      }

      // Computed access: a[b]
      if (tok.t === T.PUNC && tok.v === '[') {
        this.next();
        const prop = this.parseExpression(0);
        this.expect(T.PUNC, ']');
        left = { type: 'member', obj: left, prop, computed: true };
        // Check for method call: a[b]()
        if (this.peek().t === T.PUNC && this.peek().v === '(') {
          left = this._parseCall(left);
        }
        continue;
      }

      // Function call: fn()
      if (tok.t === T.PUNC && tok.v === '(') {
        left = this._parseCall(left);
        continue;
      }

      break;
    }

    return left;
  }

  _parseCall(callee) {
    const args = this._parseArgs();
    return { type: 'call', callee, args };
  }

  _parseArgs() {
    this.expect(T.PUNC, '(');
    const args = [];
    while (!(this.peek().t === T.PUNC && this.peek().v === ')') && this.peek().t !== T.EOF) {
      args.push(this.parseExpression(0));
      if (this.peek().t === T.PUNC && this.peek().v === ',') this.next();
    }
    this.expect(T.PUNC, ')');
    return args;
  }

  parsePrimary() {
    const tok = this.peek();

    // Number literal
    if (tok.t === T.NUM) {
      this.next();
      return { type: 'literal', value: tok.v };
    }

    // String literal
    if (tok.t === T.STR) {
      this.next();
      return { type: 'literal', value: tok.v };
    }

    // Template literal
    if (tok.t === T.TMPL) {
      this.next();
      return { type: 'template', parts: tok.v };
    }

    // Arrow function with parens: () =>, (a) =>, (a, b) =>
    // or regular grouping: (expr)
    if (tok.t === T.PUNC && tok.v === '(') {
      const savedPos = this.pos;
      this.next(); // consume (
      const params = [];
      let couldBeArrow = true;

      if (this.peek().t === T.PUNC && this.peek().v === ')') {
        // () => ... — no params
      } else {
        while (couldBeArrow) {
          const p = this.peek();
          if (p.t === T.IDENT && !KEYWORDS.has(p.v)) {
            params.push(this.next().v);
            if (this.peek().t === T.PUNC && this.peek().v === ',') {
              this.next();
            } else {
              break;
            }
          } else {
            couldBeArrow = false;
          }
        }
      }

      if (couldBeArrow && this.peek().t === T.PUNC && this.peek().v === ')') {
        this.next(); // consume )
        if (this.peek().t === T.OP && this.peek().v === '=>') {
          this.next(); // consume =>
          const body = this.parseExpression(0);
          return { type: 'arrow', params, body };
        }
      }

      // Not an arrow — restore and parse as grouping
      this.pos = savedPos;
      this.next(); // consume (
      const expr = this.parseExpression(0);
      this.expect(T.PUNC, ')');
      return expr;
    }

    // Array literal
    if (tok.t === T.PUNC && tok.v === '[') {
      this.next();
      const elements = [];
      while (!(this.peek().t === T.PUNC && this.peek().v === ']') && this.peek().t !== T.EOF) {
        elements.push(this.parseExpression(0));
        if (this.peek().t === T.PUNC && this.peek().v === ',') this.next();
      }
      this.expect(T.PUNC, ']');
      return { type: 'array', elements };
    }

    // Object literal
    if (tok.t === T.PUNC && tok.v === '{') {
      this.next();
      const properties = [];
      while (!(this.peek().t === T.PUNC && this.peek().v === '}') && this.peek().t !== T.EOF) {
        const keyTok = this.next();
        let key;
        if (keyTok.t === T.IDENT || keyTok.t === T.STR) key = keyTok.v;
        else if (keyTok.t === T.NUM) key = String(keyTok.v);
        else throw new Error('Invalid object key: ' + keyTok.v);

        // Shorthand property: { foo } means { foo: foo }
        if (this.peek().t === T.PUNC && (this.peek().v === ',' || this.peek().v === '}')) {
          properties.push({ key, value: { type: 'ident', name: key } });
        } else {
          this.expect(T.PUNC, ':');
          properties.push({ key, value: this.parseExpression(0) });
        }
        if (this.peek().t === T.PUNC && this.peek().v === ',') this.next();
      }
      this.expect(T.PUNC, '}');
      return { type: 'object', properties };
    }

    // Identifiers & keywords
    if (tok.t === T.IDENT) {
      this.next();

      // Keywords
      if (tok.v === 'true') return { type: 'literal', value: true };
      if (tok.v === 'false') return { type: 'literal', value: false };
      if (tok.v === 'null') return { type: 'literal', value: null };
      if (tok.v === 'undefined') return { type: 'literal', value: undefined };

      // new keyword
      if (tok.v === 'new') {
        const classExpr = this.parsePostfix();
        let args = [];
        if (this.peek().t === T.PUNC && this.peek().v === '(') {
          args = this._parseArgs();
        }
        return { type: 'new', callee: classExpr, args };
      }

      // Arrow function: x => expr
      if (this.peek().t === T.OP && this.peek().v === '=>') {
        this.next(); // consume =>
        const body = this.parseExpression(0);
        return { type: 'arrow', params: [tok.v], body };
      }

      return { type: 'ident', name: tok.v };
    }

    // Fallback — return undefined for unparseable
    this.next();
    return { type: 'literal', value: undefined };
  }
}

// ---------------------------------------------------------------------------
// Evaluator — walks the AST, resolves against scope
// ---------------------------------------------------------------------------

/** Safe property access whitelist for built-in prototypes */
const SAFE_ARRAY_METHODS = new Set([
  'length', 'map', 'filter', 'find', 'findIndex', 'some', 'every',
  'reduce', 'reduceRight', 'forEach', 'includes', 'indexOf', 'lastIndexOf',
  'join', 'slice', 'concat', 'flat', 'flatMap', 'reverse', 'sort',
  'fill', 'keys', 'values', 'entries', 'at', 'toString',
]);

const SAFE_STRING_METHODS = new Set([
  'length', 'charAt', 'charCodeAt', 'includes', 'indexOf', 'lastIndexOf',
  'slice', 'substring', 'trim', 'trimStart', 'trimEnd', 'toLowerCase',
  'toUpperCase', 'split', 'replace', 'replaceAll', 'match', 'search',
  'startsWith', 'endsWith', 'padStart', 'padEnd', 'repeat', 'at',
  'toString', 'valueOf',
]);

const SAFE_NUMBER_METHODS = new Set([
  'toFixed', 'toPrecision', 'toString', 'valueOf',
]);

const SAFE_OBJECT_METHODS = new Set([
  'hasOwnProperty', 'toString', 'valueOf',
]);

const SAFE_MATH_PROPS = new Set([
  'PI', 'E', 'LN2', 'LN10', 'LOG2E', 'LOG10E', 'SQRT2', 'SQRT1_2',
  'abs', 'ceil', 'floor', 'round', 'trunc', 'max', 'min', 'pow',
  'sqrt', 'sign', 'random', 'log', 'log2', 'log10',
]);

const SAFE_JSON_PROPS = new Set(['parse', 'stringify']);

/**
 * Check if property access is safe
 */
function _isSafeAccess(obj, prop) {
  // Never allow access to dangerous properties
  const BLOCKED = new Set([
    'constructor', '__proto__', 'prototype', '__defineGetter__',
    '__defineSetter__', '__lookupGetter__', '__lookupSetter__',
  ]);
  if (typeof prop === 'string' && BLOCKED.has(prop)) return false;

  // Always allow plain object/function property access and array index access
  if (obj !== null && obj !== undefined && (typeof obj === 'object' || typeof obj === 'function')) return true;
  if (typeof obj === 'string') return SAFE_STRING_METHODS.has(prop);
  if (typeof obj === 'number') return SAFE_NUMBER_METHODS.has(prop);
  return false;
}

function evaluate(node, scope) {
  if (!node) return undefined;

  switch (node.type) {
    case 'literal':
      return node.value;

    case 'ident': {
      const name = node.name;
      // Check scope layers in order
      for (const layer of scope) {
        if (layer && typeof layer === 'object' && name in layer) {
          return layer[name];
        }
      }
      // Built-in globals (safe ones only)
      if (name === 'Math') return Math;
      if (name === 'JSON') return JSON;
      if (name === 'Date') return Date;
      if (name === 'Array') return Array;
      if (name === 'Object') return Object;
      if (name === 'String') return String;
      if (name === 'Number') return Number;
      if (name === 'Boolean') return Boolean;
      if (name === 'parseInt') return parseInt;
      if (name === 'parseFloat') return parseFloat;
      if (name === 'isNaN') return isNaN;
      if (name === 'isFinite') return isFinite;
      if (name === 'Infinity') return Infinity;
      if (name === 'NaN') return NaN;
      if (name === 'encodeURIComponent') return encodeURIComponent;
      if (name === 'decodeURIComponent') return decodeURIComponent;
      if (name === 'console') return console;
      return undefined;
    }

    case 'template': {
      // Template literal with interpolation
      let result = '';
      for (const part of node.parts) {
        if (typeof part === 'string') {
          result += part;
        } else if (part && part.expr) {
          result += String(safeEval(part.expr, scope) ?? '');
        }
      }
      return result;
    }

    case 'member': {
      const obj = evaluate(node.obj, scope);
      if (obj == null) return undefined;
      const prop = node.computed ? evaluate(node.prop, scope) : node.prop;
      if (!_isSafeAccess(obj, prop)) return undefined;
      return obj[prop];
    }

    case 'optional_member': {
      const obj = evaluate(node.obj, scope);
      if (obj == null) return undefined;
      const prop = node.computed ? evaluate(node.prop, scope) : node.prop;
      if (!_isSafeAccess(obj, prop)) return undefined;
      return obj[prop];
    }

    case 'call': {
      const result = _resolveCall(node, scope, false);
      return result;
    }

    case 'optional_call': {
      const callee = evaluate(node.callee, scope);
      if (callee == null) return undefined;
      if (typeof callee !== 'function') return undefined;
      const args = node.args.map(a => evaluate(a, scope));
      return callee(...args);
    }

    case 'new': {
      const Ctor = evaluate(node.callee, scope);
      if (typeof Ctor !== 'function') return undefined;
      // Only allow safe constructors
      if (Ctor === Date || Ctor === Array || Ctor === Map || Ctor === Set ||
          Ctor === RegExp || Ctor === Error || Ctor === URL || Ctor === URLSearchParams) {
        const args = node.args.map(a => evaluate(a, scope));
        return new Ctor(...args);
      }
      return undefined;
    }

    case 'binary':
      return _evalBinary(node, scope);

    case 'unary': {
      const val = evaluate(node.arg, scope);
      return node.op === '-' ? -val : +val;
    }

    case 'not':
      return !evaluate(node.arg, scope);

    case 'typeof': {
      try {
        return typeof evaluate(node.arg, scope);
      } catch {
        return 'undefined';
      }
    }

    case 'ternary': {
      const cond = evaluate(node.cond, scope);
      return cond ? evaluate(node.truthy, scope) : evaluate(node.falsy, scope);
    }

    case 'array':
      return node.elements.map(e => evaluate(e, scope));

    case 'object': {
      const obj = {};
      for (const { key, value } of node.properties) {
        obj[key] = evaluate(value, scope);
      }
      return obj;
    }

    case 'arrow': {
      const paramNames = node.params;
      const bodyNode = node.body;
      const closedScope = scope;
      return function(...args) {
        const arrowScope = {};
        paramNames.forEach((name, i) => { arrowScope[name] = args[i]; });
        return evaluate(bodyNode, [arrowScope, ...closedScope]);
      };
    }

    default:
      return undefined;
  }
}

/**
 * Resolve and execute a function call safely.
 */
function _resolveCall(node, scope) {
  const callee = node.callee;
  const args = node.args.map(a => evaluate(a, scope));

  // Method call: obj.method() — bind `this` to obj
  if (callee.type === 'member' || callee.type === 'optional_member') {
    const obj = evaluate(callee.obj, scope);
    if (obj == null) return undefined;
    const prop = callee.computed ? evaluate(callee.prop, scope) : callee.prop;
    if (!_isSafeAccess(obj, prop)) return undefined;
    const fn = obj[prop];
    if (typeof fn !== 'function') return undefined;
    return fn.apply(obj, args);
  }

  // Direct call: fn(args)
  const fn = evaluate(callee, scope);
  if (typeof fn !== 'function') return undefined;
  return fn(...args);
}

/**
 * Evaluate binary expression.
 */
function _evalBinary(node, scope) {
  // Short-circuit for logical ops
  if (node.op === '&&') {
    const left = evaluate(node.left, scope);
    return left ? evaluate(node.right, scope) : left;
  }
  if (node.op === '||') {
    const left = evaluate(node.left, scope);
    return left ? left : evaluate(node.right, scope);
  }
  if (node.op === '??') {
    const left = evaluate(node.left, scope);
    return left != null ? left : evaluate(node.right, scope);
  }

  const left = evaluate(node.left, scope);
  const right = evaluate(node.right, scope);

  switch (node.op) {
    case '+': return left + right;
    case '-': return left - right;
    case '*': return left * right;
    case '/': return left / right;
    case '%': return left % right;
    case '==': return left == right;
    case '!=': return left != right;
    case '===': return left === right;
    case '!==': return left !== right;
    case '<': return left < right;
    case '>': return left > right;
    case '<=': return left <= right;
    case '>=': return left >= right;
    case 'instanceof': return left instanceof right;
    case 'in': return left in right;
    default: return undefined;
  }
}


// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Safely evaluate a JS expression string against scope layers.
 *
 * @param {string} expr — expression string
 * @param {object[]} scope — array of scope objects, checked in order
 *   Typical: [loopVars, state, { props, refs, $ }]
 * @returns {*} — evaluation result, or undefined on error
 */

// AST cache — avoids re-tokenizing and re-parsing the same expression string.
// Bounded to prevent unbounded memory growth in long-lived apps.
const _astCache = new Map();
const _AST_CACHE_MAX = 512;

function safeEval(expr, scope) {
  try {
    const trimmed = expr.trim();
    if (!trimmed) return undefined;

    // Fast path for simple identifiers: "count", "name", "visible"
    // Avoids full tokenize→parse→evaluate overhead for the most common case.
    if (/^[a-zA-Z_$][\w$]*$/.test(trimmed)) {
      for (const layer of scope) {
        if (layer && typeof layer === 'object' && trimmed in layer) {
          return layer[trimmed];
        }
      }
      // Fall through to full parser for built-in globals (Math, JSON, etc.)
    }

    // Check AST cache
    let ast = _astCache.get(trimmed);
    if (!ast) {
      const tokens = tokenize(trimmed);
      const parser = new Parser(tokens, scope);
      ast = parser.parse();

      // Evict oldest entries when cache is full
      if (_astCache.size >= _AST_CACHE_MAX) {
        const first = _astCache.keys().next().value;
        _astCache.delete(first);
      }
      _astCache.set(trimmed, ast);
    }

    return evaluate(ast, scope);
  } catch (err) {
    if (typeof console !== 'undefined' && console.debug) {
      console.debug(`[zQuery EXPR_EVAL] Failed to evaluate: "${expr}"`, err.message);
    }
    return undefined;
  }
}

// --- src/diff.js -------------------------------------------------
/**
 * zQuery Diff — Lightweight DOM morphing engine
 *
 * Patches an existing DOM tree to match new HTML without destroying nodes
 * that haven't changed. Preserves focus, scroll positions, third-party
 * widget state, video playback, and other live DOM state.
 *
 * Approach: walk old and new trees in parallel, reconcile node by node.
 * Keyed elements (via `z-key`) get matched across position changes.
 *
 * Performance advantages over virtual DOM (React/Angular):
 *   - No virtual tree allocation or diffing — works directly on real DOM
 *   - Skips unchanged subtrees via fast isEqualNode() check
 *   - z-skip attribute to opt out of diffing entire subtrees
 *   - Reuses a single template element for HTML parsing (zero GC pressure)
 *   - Keyed reconciliation uses LIS (Longest Increasing Subsequence) to
 *     minimize DOM moves — same algorithm as Vue 3 / ivi
 *   - Minimal attribute diffing with early bail-out
 */

// ---------------------------------------------------------------------------
// Reusable template element — avoids per-call allocation
// ---------------------------------------------------------------------------
let _tpl = null;

function _getTemplate() {
  if (!_tpl) _tpl = document.createElement('template');
  return _tpl;
}

// ---------------------------------------------------------------------------
// morph(existingRoot, newHTML) — patch existing DOM to match newHTML
// ---------------------------------------------------------------------------

/**
 * Morph an existing DOM element's children to match new HTML.
 * Only touches nodes that actually differ.
 *
 * @param {Element} rootEl — The live DOM container to patch
 * @param {string} newHTML — The desired HTML string
 */
function morph(rootEl, newHTML) {
  const start = typeof window !== 'undefined' && window.__zqMorphHook ? performance.now() : 0;
  const tpl = _getTemplate();
  tpl.innerHTML = newHTML;
  const newRoot = tpl.content;

  // Move children into a wrapper for consistent handling.
  // We move (not clone) from the template — cheaper than cloning.
  const tempDiv = document.createElement('div');
  while (newRoot.firstChild) tempDiv.appendChild(newRoot.firstChild);

  _morphChildren(rootEl, tempDiv);

  if (start) window.__zqMorphHook(rootEl, performance.now() - start);
}

/**
 * Morph a single element in place — diffs attributes and children
 * without replacing the node reference. Useful for replaceWith-style
 * updates where you want to keep the element identity when the tag
 * name matches.
 *
 * If the new HTML produces a different tag, falls back to native replace.
 *
 * @param {Element} oldEl — The live DOM element to patch
 * @param {string} newHTML — HTML string for the replacement element
 * @returns {Element} — The resulting element (same ref if morphed, new if replaced)
 */
function morphElement(oldEl, newHTML) {
  const start = typeof window !== 'undefined' && window.__zqMorphHook ? performance.now() : 0;
  const tpl = _getTemplate();
  tpl.innerHTML = newHTML;
  const newEl = tpl.content.firstElementChild;
  if (!newEl) return oldEl;

  // Same tag — morph in place (preserves identity, event listeners, refs)
  if (oldEl.nodeName === newEl.nodeName) {
    _morphAttributes(oldEl, newEl);
    _morphChildren(oldEl, newEl);
    if (start) window.__zqMorphHook(oldEl, performance.now() - start);
    return oldEl;
  }

  // Different tag — must replace (can't morph <div> into <span>)
  const clone = newEl.cloneNode(true);
  oldEl.parentNode.replaceChild(clone, oldEl);
  if (start) window.__zqMorphHook(clone, performance.now() - start);
  return clone;
}

/**
 * Reconcile children of `oldParent` to match `newParent`.
 *
 * @param {Element} oldParent — live DOM parent
 * @param {Element} newParent — desired state parent
 */
function _morphChildren(oldParent, newParent) {
  // Snapshot live NodeLists into arrays — childNodes is live and
  // mutates during insertBefore/removeChild. Using a for loop to push
  // avoids spread operator overhead for large child lists.
  const oldCN = oldParent.childNodes;
  const newCN = newParent.childNodes;
  const oldLen = oldCN.length;
  const newLen = newCN.length;
  const oldChildren = new Array(oldLen);
  const newChildren = new Array(newLen);
  for (let i = 0; i < oldLen; i++) oldChildren[i] = oldCN[i];
  for (let i = 0; i < newLen; i++) newChildren[i] = newCN[i];

  // Scan for keyed elements — only build maps if keys exist
  let hasKeys = false;
  let oldKeyMap, newKeyMap;

  for (let i = 0; i < oldLen; i++) {
    if (_getKey(oldChildren[i]) != null) { hasKeys = true; break; }
  }
  if (!hasKeys) {
    for (let i = 0; i < newLen; i++) {
      if (_getKey(newChildren[i]) != null) { hasKeys = true; break; }
    }
  }

  if (hasKeys) {
    oldKeyMap = new Map();
    newKeyMap = new Map();
    for (let i = 0; i < oldLen; i++) {
      const key = _getKey(oldChildren[i]);
      if (key != null) oldKeyMap.set(key, i);
    }
    for (let i = 0; i < newLen; i++) {
      const key = _getKey(newChildren[i]);
      if (key != null) newKeyMap.set(key, i);
    }
    _morphChildrenKeyed(oldParent, oldChildren, newChildren, oldKeyMap, newKeyMap);
  } else {
    _morphChildrenUnkeyed(oldParent, oldChildren, newChildren);
  }
}

/**
 * Unkeyed reconciliation — positional matching.
 */
function _morphChildrenUnkeyed(oldParent, oldChildren, newChildren) {
  const oldLen = oldChildren.length;
  const newLen = newChildren.length;
  const minLen = oldLen < newLen ? oldLen : newLen;

  // Morph overlapping range
  for (let i = 0; i < minLen; i++) {
    _morphNode(oldParent, oldChildren[i], newChildren[i]);
  }

  // Append new nodes
  if (newLen > oldLen) {
    for (let i = oldLen; i < newLen; i++) {
      oldParent.appendChild(newChildren[i].cloneNode(true));
    }
  }

  // Remove excess old nodes (iterate backwards to avoid index shifting)
  if (oldLen > newLen) {
    for (let i = oldLen - 1; i >= newLen; i--) {
      oldParent.removeChild(oldChildren[i]);
    }
  }
}

/**
 * Keyed reconciliation — match by z-key, reorder with minimal moves
 * using Longest Increasing Subsequence (LIS) to find the maximum set
 * of nodes that are already in the correct relative order, then only
 * move the remaining nodes.
 */
function _morphChildrenKeyed(oldParent, oldChildren, newChildren, oldKeyMap, newKeyMap) {
  const consumed = new Set();
  const newLen = newChildren.length;
  const matched = new Array(newLen);

  // Step 1: Match new children to old children by key
  for (let i = 0; i < newLen; i++) {
    const key = _getKey(newChildren[i]);
    if (key != null && oldKeyMap.has(key)) {
      const oldIdx = oldKeyMap.get(key);
      matched[i] = oldChildren[oldIdx];
      consumed.add(oldIdx);
    } else {
      matched[i] = null;
    }
  }

  // Step 2: Remove old keyed nodes not in the new tree
  for (let i = oldChildren.length - 1; i >= 0; i--) {
    if (!consumed.has(i)) {
      const key = _getKey(oldChildren[i]);
      if (key != null && !newKeyMap.has(key)) {
        oldParent.removeChild(oldChildren[i]);
      }
    }
  }

  // Step 3: Build index array for LIS of matched old indices.
  // This finds the largest set of keyed nodes already in order,
  // so we only need to move the rest — O(n log n) instead of O(n²).
  const oldIndices = [];      // Maps new-position → old-position (or -1)
  for (let i = 0; i < newLen; i++) {
    if (matched[i]) {
      const key = _getKey(newChildren[i]);
      oldIndices.push(oldKeyMap.get(key));
    } else {
      oldIndices.push(-1);
    }
  }

  const lisSet = _lis(oldIndices);

  // Step 4: Insert / reorder / morph — walk new children forward,
  // using LIS to decide which nodes stay in place.
  let cursor = oldParent.firstChild;
  const unkeyedOld = [];
  for (let i = 0; i < oldChildren.length; i++) {
    if (!consumed.has(i) && _getKey(oldChildren[i]) == null) {
      unkeyedOld.push(oldChildren[i]);
    }
  }
  let unkeyedIdx = 0;

  for (let i = 0; i < newLen; i++) {
    const newNode = newChildren[i];
    const newKey = _getKey(newNode);
    let oldNode = matched[i];

    if (!oldNode && newKey == null) {
      oldNode = unkeyedOld[unkeyedIdx++] || null;
    }

    if (oldNode) {
      // If this node is NOT part of the LIS, it needs to be moved
      if (!lisSet.has(i)) {
        oldParent.insertBefore(oldNode, cursor);
      }
      _morphNode(oldParent, oldNode, newNode);
      cursor = oldNode.nextSibling;
    } else {
      // Insert new node
      const clone = newNode.cloneNode(true);
      if (cursor) {
        oldParent.insertBefore(clone, cursor);
      } else {
        oldParent.appendChild(clone);
      }
    }
  }

  // Remove remaining unkeyed old nodes
  while (unkeyedIdx < unkeyedOld.length) {
    const leftover = unkeyedOld[unkeyedIdx++];
    if (leftover.parentNode === oldParent) {
      oldParent.removeChild(leftover);
    }
  }

  // Remove any remaining keyed old nodes that weren't consumed
  for (let i = 0; i < oldChildren.length; i++) {
    if (!consumed.has(i)) {
      const node = oldChildren[i];
      if (node.parentNode === oldParent && _getKey(node) != null && !newKeyMap.has(_getKey(node))) {
        oldParent.removeChild(node);
      }
    }
  }
}

/**
 * Compute the Longest Increasing Subsequence of an index array.
 * Returns a Set of positions (in the input) that form the LIS.
 * Entries with value -1 (unmatched) are excluded.
 *
 * O(n log n) — same algorithm used by Vue 3 and ivi.
 *
 * @param {number[]} arr — array of old-tree indices (-1 = unmatched)
 * @returns {Set<number>} — positions in arr belonging to the LIS
 */
function _lis(arr) {
  const len = arr.length;
  const result = new Set();
  if (len === 0) return result;

  // tails[i] = index in arr of the smallest tail element for LIS of length i+1
  const tails = [];
  // prev[i] = predecessor index in arr for the LIS ending at arr[i]
  const prev = new Array(len).fill(-1);
  const tailIndices = []; // parallel to tails: actual positions

  for (let i = 0; i < len; i++) {
    if (arr[i] === -1) continue;
    const val = arr[i];

    // Binary search for insertion point in tails
    let lo = 0, hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid] < val) lo = mid + 1;
      else hi = mid;
    }

    tails[lo] = val;
    tailIndices[lo] = i;
    prev[i] = lo > 0 ? tailIndices[lo - 1] : -1;
  }

  // Reconstruct: walk backwards from the last element of LIS
  let k = tailIndices[tails.length - 1];
  for (let i = tails.length - 1; i >= 0; i--) {
    result.add(k);
    k = prev[k];
  }

  return result;
}

/**
 * Morph a single node in place.
 */
function _morphNode(parent, oldNode, newNode) {
  // Text / comment nodes — just update content
  if (oldNode.nodeType === 3 || oldNode.nodeType === 8) {
    if (newNode.nodeType === oldNode.nodeType) {
      if (oldNode.nodeValue !== newNode.nodeValue) {
        oldNode.nodeValue = newNode.nodeValue;
      }
      return;
    }
    // Different node types — replace
    parent.replaceChild(newNode.cloneNode(true), oldNode);
    return;
  }

  // Different node types or tag names — replace entirely
  if (oldNode.nodeType !== newNode.nodeType ||
      oldNode.nodeName !== newNode.nodeName) {
    parent.replaceChild(newNode.cloneNode(true), oldNode);
    return;
  }

  // Both are elements — diff attributes then recurse children
  if (oldNode.nodeType === 1) {
    // z-skip: developer opt-out — skip diffing this subtree entirely.
    // Useful for third-party widgets, canvas, video, or large static content.
    if (oldNode.hasAttribute('z-skip')) return;

    // Fast bail-out: if the elements are identical, skip everything.
    // isEqualNode() is a native C++ comparison — much faster than walking
    // attributes + children in JS when trees haven't changed.
    if (oldNode.isEqualNode(newNode)) return;

    _morphAttributes(oldNode, newNode);

    // Special elements: don't recurse into their children
    const tag = oldNode.nodeName;
    if (tag === 'INPUT') {
      _syncInputValue(oldNode, newNode);
      return;
    }
    if (tag === 'TEXTAREA') {
      if (oldNode.value !== newNode.textContent) {
        oldNode.value = newNode.textContent || '';
      }
      return;
    }
    if (tag === 'SELECT') {
      _morphChildren(oldNode, newNode);
      if (oldNode.value !== newNode.value) {
        oldNode.value = newNode.value;
      }
      return;
    }

    // Generic element — recurse children
    _morphChildren(oldNode, newNode);
  }
}

/**
 * Sync attributes from newEl onto oldEl.
 * Uses a single pass: build a set of new attribute names, iterate
 * old attrs for removals, then apply new attrs.
 */
function _morphAttributes(oldEl, newEl) {
  const newAttrs = newEl.attributes;
  const oldAttrs = oldEl.attributes;
  const newLen = newAttrs.length;
  const oldLen = oldAttrs.length;

  // Fast path: if both have same number of attributes, check if they're identical
  if (newLen === oldLen) {
    let same = true;
    for (let i = 0; i < newLen; i++) {
      const na = newAttrs[i];
      if (oldEl.getAttribute(na.name) !== na.value) { same = false; break; }
    }
    if (same) {
      // Also verify no extra old attrs (names mismatch)
      for (let i = 0; i < oldLen; i++) {
        if (!newEl.hasAttribute(oldAttrs[i].name)) { same = false; break; }
      }
    }
    if (same) return;
  }

  // Build set of new attr names for O(1) lookup during removal pass
  const newNames = new Set();
  for (let i = 0; i < newLen; i++) {
    const attr = newAttrs[i];
    newNames.add(attr.name);
    if (oldEl.getAttribute(attr.name) !== attr.value) {
      oldEl.setAttribute(attr.name, attr.value);
    }
  }

  // Remove stale attributes
  for (let i = oldLen - 1; i >= 0; i--) {
    if (!newNames.has(oldAttrs[i].name)) {
      oldEl.removeAttribute(oldAttrs[i].name);
    }
  }
}

/**
 * Sync input element value, checked, disabled states.
 */
function _syncInputValue(oldEl, newEl) {
  const type = (oldEl.type || '').toLowerCase();

  if (type === 'checkbox' || type === 'radio') {
    if (oldEl.checked !== newEl.checked) oldEl.checked = newEl.checked;
  } else {
    if (oldEl.value !== (newEl.getAttribute('value') || '')) {
      oldEl.value = newEl.getAttribute('value') || '';
    }
  }

  // Sync disabled
  if (oldEl.disabled !== newEl.disabled) oldEl.disabled = newEl.disabled;
}

/**
 * Get the reconciliation key from a node.
 *
 * Priority: z-key attribute → id attribute → data-id / data-key.
 * Auto-detected keys use a `\0` prefix to avoid collisions with
 * explicit z-key values.
 *
 * This means the LIS-optimised keyed path activates automatically
 * whenever elements carry `id` or `data-id` / `data-key` attributes
 * — no extra markup required.
 *
 * @returns {string|null}
 */
function _getKey(node) {
  if (node.nodeType !== 1) return null;

  // Explicit z-key — highest priority
  const zk = node.getAttribute('z-key');
  if (zk) return zk;

  // Auto-key: id attribute (unique by spec)
  if (node.id) return '\0id:' + node.id;

  // Auto-key: data-id or data-key attributes
  const ds = node.dataset;
  if (ds) {
    if (ds.id)  return '\0data-id:'  + ds.id;
    if (ds.key) return '\0data-key:' + ds.key;
  }

  return null;
}

// --- src/component.js --------------------------------------------
/**
 * zQuery Component — Lightweight reactive component system
 * 
 * Declarative components using template literals with directive support.
 * Proxy-based state triggers targeted re-renders via event delegation.
 * 
 * Features:
 *   - Reactive state (auto re-render on mutation)
 *   - Template literals with full JS expression power
 *   - @event="method" syntax for event binding (delegated)
 *   - z-ref="name" for element references
 *   - z-model="stateKey" for two-way binding
 *   - Lifecycle hooks: init, mounted, updated, destroyed
 *   - Props passed via attributes
 *   - Scoped styles (inline or via styleUrl)
 *   - External templates via templateUrl (with {{expression}} interpolation)
 *   - External styles via styleUrl (fetched & scoped automatically)
 *   - Relative path resolution — templateUrl and styleUrl
 *     resolve relative to the component file automatically
 */





// ---------------------------------------------------------------------------
// Component registry & external resource cache
// ---------------------------------------------------------------------------
const _registry = new Map();     // name → definition
const _instances = new Map();    // element → instance
const _resourceCache = new Map(); // url → Promise<string>

// Unique ID counter
let _uid = 0;

// Inject z-cloak base style and mobile tap-highlight reset (once, globally)
if (typeof document !== 'undefined' && !document.querySelector('[data-zq-cloak]')) {
  const _s = document.createElement('style');
  _s.textContent = '[z-cloak]{display:none!important}*,*::before,*::after{-webkit-tap-highlight-color:transparent}';
  _s.setAttribute('data-zq-cloak', '');
  document.head.appendChild(_s);
}

// Debounce / throttle helpers for event modifiers
const _debounceTimers = new WeakMap();
const _throttleTimers = new WeakMap();

/**
 * Fetch and cache a text resource (HTML template or CSS file).
 * @param {string} url — URL to fetch
 * @returns {Promise<string>}
 */
function _fetchResource(url) {
  if (_resourceCache.has(url)) return _resourceCache.get(url);

  // Check inline resource map (populated by CLI bundler for file:// support).
  // Keys are relative paths; match against the URL suffix.
  if (typeof window !== 'undefined' && window.__zqInline) {
    for (const [path, content] of Object.entries(window.__zqInline)) {
      if (url === path || url.endsWith('/' + path) || url.endsWith('\\' + path)) {
        const resolved = Promise.resolve(content);
        _resourceCache.set(url, resolved);
        return resolved;
      }
    }
  }

  // Resolve relative URLs against <base href> or origin root.
  // This prevents SPA route paths (e.g. /docs/advanced) from
  // breaking relative resource URLs like 'scripts/components/foo.css'.
  let resolvedUrl = url;
  if (typeof url === 'string' && !url.startsWith('/') && !url.includes(':') && !url.startsWith('//')) {
    try {
      const baseEl = document.querySelector('base');
      const root = baseEl ? baseEl.href : (window.location.origin + '/');
      resolvedUrl = new URL(url, root).href;
    } catch { /* keep original */ }
  }

  const promise = fetch(resolvedUrl).then(res => {
    if (!res.ok) throw new Error(`zQuery: Failed to load resource "${url}" (${res.status})`);
    return res.text();
  });
  _resourceCache.set(url, promise);
  return promise;
}

/**
 * Resolve a relative URL against a base.
 *
 * - If `base` is an absolute URL (http/https/file), resolve directly.
 * - If `base` is a relative path string, resolve it against the page root
 *   (or <base href>) first, then resolve `url` against that.
 * - If `base` is falsy, return `url` unchanged — _fetchResource's own
 *   fallback (page root / <base href>) handles it.
 *
 * @param {string} url   — URL or relative path to resolve
 * @param {string} [base] — auto-detected caller URL or explicit base path
 * @returns {string}
 */
function _resolveUrl(url, base) {
  if (!base || !url || typeof url !== 'string') return url;
  // Already absolute — nothing to do
  if (url.startsWith('/') || url.includes('://') || url.startsWith('//')) return url;
  try {
    if (base.includes('://')) {
      // Absolute base (auto-detected module URL)
      return new URL(url, base).href;
    }
    // Relative base string — resolve against page root first
    const baseEl = document.querySelector('base');
    const root = baseEl ? baseEl.href : (window.location.origin + '/');
    const absBase = new URL(base.endsWith('/') ? base : base + '/', root).href;
    return new URL(url, absBase).href;
  } catch {
    return url;
  }
}

// Capture the library's own script URL at load time for reliable filtering.
// This handles cases where the bundle is renamed (e.g., 'vendor.js').
let _ownScriptUrl;
try {
  if (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) {
    _ownScriptUrl = document.currentScript.src.replace(/[?#].*$/, '');
  }
} catch { /* ignored */ }

/**
 * Detect the URL of the module that called $.component().
 * Parses Error().stack to find the first frame outside the zQuery bundle.
 * Returns the directory URL (with trailing slash) or undefined.
 * @returns {string|undefined}
 */
function _detectCallerBase() {
  try {
    const stack = new Error().stack || '';
    const urls = stack.match(/(?:https?|file):\/\/[^\s\)]+/g) || [];
    for (const raw of urls) {
      // Strip line:col suffixes  e.g. ":3:5" or ":12:1"
      const url = raw.replace(/:\d+:\d+$/, '').replace(/:\d+$/, '');
      // Skip the zQuery library itself — by filename pattern and captured URL
      if (/zquery(\.min)?\.js$/i.test(url)) continue;
      if (_ownScriptUrl && url.replace(/[?#].*$/, '') === _ownScriptUrl) continue;
      // Return directory (strip filename, keep trailing slash)
      return url.replace(/\/[^/]*$/, '/');
    }
  } catch { /* stack parsing unsupported — fall back silently */ }
  return undefined;
}

/**
 * Get a value from a nested object by dot-path.
 * _getPath(obj, 'user.name')  →  obj.user.name
 * @param {object} obj
 * @param {string} path
 * @returns {*}
 */
function _getPath(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

/**
 * Set a value on a nested object by dot-path, walking through proxy layers.
 * _setPath(proxy, 'user.name', 'Tony')  →  proxy.user.name = 'Tony'
 * @param {object} obj
 * @param {string} path
 * @param {*} value
 */
function _setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o && typeof o === 'object') ? o[k] : undefined, obj);
  if (target && typeof target === 'object') target[last] = value;
}


// ---------------------------------------------------------------------------
// Component class
// ---------------------------------------------------------------------------
class Component {
  constructor(el, definition, props = {}) {
    this._uid = ++_uid;
    this._el = el;
    this._def = definition;
    this._mounted = false;
    this._destroyed = false;
    this._updateQueued = false;
    this._listeners = [];
    this._watchCleanups = [];

    // Refs map
    this.refs = {};

    // Capture slot content before first render replaces it
    this._slotContent = {};
    const defaultSlotNodes = [];
    [...el.childNodes].forEach(node => {
      if (node.nodeType === 1 && node.hasAttribute('slot')) {
        const slotName = node.getAttribute('slot');
        if (!this._slotContent[slotName]) this._slotContent[slotName] = '';
        this._slotContent[slotName] += node.outerHTML;
      } else if (node.nodeType === 1 || (node.nodeType === 3 && node.textContent.trim())) {
        defaultSlotNodes.push(node.nodeType === 1 ? node.outerHTML : node.textContent);
      }
    });
    if (defaultSlotNodes.length) {
      this._slotContent['default'] = defaultSlotNodes.join('');
    }

    // Props (read-only from parent)
    this.props = Object.freeze({ ...props });

    // Reactive state
    const initialState = typeof definition.state === 'function'
      ? definition.state()
      : { ...(definition.state || {}) };

    this.state = reactive(initialState, (key, value, old) => {
      if (!this._destroyed) {
        // Run watchers for the changed key
        this._runWatchers(key, value, old);
        this._scheduleUpdate();
      }
    });

    // Computed properties — lazy getters derived from state
    this.computed = {};
    if (definition.computed) {
      for (const [name, fn] of Object.entries(definition.computed)) {
        Object.defineProperty(this.computed, name, {
          get: () => fn.call(this, this.state.__raw || this.state),
          enumerable: true
        });
      }
    }

    // Bind all user methods to this instance
    for (const [key, val] of Object.entries(definition)) {
      if (typeof val === 'function' && !_reservedKeys.has(key)) {
        this[key] = val.bind(this);
      }
    }

    // Init lifecycle
    if (definition.init) {
      try { definition.init.call(this); }
      catch (err) { reportError(ErrorCode.COMP_LIFECYCLE, `Component "${definition._name}" init() threw`, { component: definition._name }, err); }
    }

    // Set up watchers after init so initial state is ready
    if (definition.watch) {
      this._prevWatchValues = {};
      for (const key of Object.keys(definition.watch)) {
        this._prevWatchValues[key] = _getPath(this.state.__raw || this.state, key);
      }
    }
  }

  // Run registered watchers for a changed key
  _runWatchers(changedKey, value, old) {
    const watchers = this._def.watch;
    if (!watchers) return;
    for (const [key, handler] of Object.entries(watchers)) {
      // Match exact key or parent key (e.g. watcher on 'user' fires when 'user.name' changes)
      if (changedKey === key || key.startsWith(changedKey + '.') || changedKey.startsWith(key + '.') || changedKey === key) {
        const currentVal = _getPath(this.state.__raw || this.state, key);
        const prevVal = this._prevWatchValues?.[key];
        if (currentVal !== prevVal) {
          const fn = typeof handler === 'function' ? handler : handler.handler;
          if (typeof fn === 'function') fn.call(this, currentVal, prevVal);
          if (this._prevWatchValues) this._prevWatchValues[key] = currentVal;
        }
      }
    }
  }

  // Schedule a batched DOM update (microtask)
  _scheduleUpdate() {
    if (this._updateQueued) return;
    this._updateQueued = true;
    queueMicrotask(() => {
      try {
        if (!this._destroyed) this._render();
      } finally {
        this._updateQueued = false;
      }
    });
  }

  // Load external templateUrl / styleUrl if specified (once per definition)
  //
  // Relative paths are resolved automatically against the component file's
  // own directory (auto-detected at registration time). You can override
  // this with `base: 'some/path/'` on the definition.
  //
  // templateUrl accepts:
  //   - string              → single template (used with {{expr}} interpolation)
  //   - string[]            → array of URLs → indexed map via this.templates[0], …
  //   - { key: url, … }    → named map → this.templates.key
  //
  // styleUrl accepts:
  //   - string              → single stylesheet
  //   - string[]            → array of URLs → all fetched & concatenated
  //
  async _loadExternals() {
    const def = this._def;
    const base = def._base; // auto-detected or explicit

    // -- External templates --------------------------------------
    if (def.templateUrl && !def._templateLoaded) {
      const tu = def.templateUrl;
      if (typeof tu === 'string') {
        def._externalTemplate = await _fetchResource(_resolveUrl(tu, base));
      } else if (Array.isArray(tu)) {
        const urls = tu.map(u => _resolveUrl(u, base));
        const results = await Promise.all(urls.map(u => _fetchResource(u)));
        def._externalTemplates = {};
        results.forEach((html, i) => { def._externalTemplates[i] = html; });
      } else if (typeof tu === 'object') {
        const entries = Object.entries(tu);
        const results = await Promise.all(
          entries.map(([, url]) => _fetchResource(_resolveUrl(url, base)))
        );
        def._externalTemplates = {};
        entries.forEach(([key], i) => { def._externalTemplates[key] = results[i]; });
      }
      def._templateLoaded = true;
    }

    // -- External styles -----------------------------------------
    if (def.styleUrl && !def._styleLoaded) {
      const su = def.styleUrl;
      if (typeof su === 'string') {
        const resolved = _resolveUrl(su, base);
        def._externalStyles = await _fetchResource(resolved);
        def._resolvedStyleUrls = [resolved];
      } else if (Array.isArray(su)) {
        const urls = su.map(u => _resolveUrl(u, base));
        const results = await Promise.all(urls.map(u => _fetchResource(u)));
        def._externalStyles = results.join('\n');
        def._resolvedStyleUrls = urls;
      }
      def._styleLoaded = true;
    }
  }

  // Render the component
  _render() {
    // If externals haven't loaded yet, trigger async load then re-render
    if ((this._def.templateUrl && !this._def._templateLoaded) ||
        (this._def.styleUrl && !this._def._styleLoaded)) {
      this._loadExternals().then(() => {
        if (!this._destroyed) this._render();
      });
      return; // Skip this render — will re-render after load
    }

    // Expose multi-template map on instance (if available)
    if (this._def._externalTemplates) {
      this.templates = this._def._externalTemplates;
    }

    // Determine HTML content
    let html;
    if (this._def.render) {
      // Inline render function takes priority
      html = this._def.render.call(this);
      // Expand z-for in render templates ({{}} expressions for iteration items)
      html = this._expandZFor(html);
    } else if (this._def._externalTemplate) {
      // Expand z-for FIRST (before global {{}} interpolation)
      html = this._expandZFor(this._def._externalTemplate);
      // Then do global {{expression}} interpolation on the remaining content
      html = html.replace(/\{\{(.+?)\}\}/g, (_, expr) => {
        try {
          const result = safeEval(expr.trim(), [
            this.state.__raw || this.state,
            { props: this.props, computed: this.computed, $: typeof window !== 'undefined' ? window.$ : undefined }
          ]);
          return result != null ? result : '';
        } catch { return ''; }
      });
    } else {
      html = '';
    }

    // Pre-expand z-html and z-text at string level so the morph engine
    // can diff their content properly (instead of clearing + re-injecting
    // on every re-render). Same pattern as z-for: parse → evaluate → serialize.
    html = this._expandContentDirectives(html);

    // -- Slot distribution ----------------------------------------
    // Replace <slot> elements with captured slot content from parent.
    // <slot> → default slot content
    // <slot name="header"> → named slot content
    // Fallback content between <slot>...</slot> used when no content provided.
    if (html.includes('<slot')) {
      html = html.replace(/<slot(?:\s+name="([^"]*)")?\s*(?:\/>|>([\s\S]*?)<\/slot>)/g, (_, name, fallback) => {
        const slotName = name || 'default';
        return this._slotContent[slotName] || fallback || '';
      });
    }

    // Combine inline styles + external styles
    const combinedStyles = [
      this._def.styles || '',
      this._def._externalStyles || ''
    ].filter(Boolean).join('\n');

    // Apply scoped styles on first render
    if (!this._mounted && combinedStyles) {
      const scopeAttr = `z-s${this._uid}`;
      this._el.setAttribute(scopeAttr, '');
      let inAtBlock = 0;
      const scoped = combinedStyles.replace(/([^{}]+)\{|\}/g, (match, selector) => {
        if (match === '}') {
          if (inAtBlock > 0) inAtBlock--;
          return match;
        }
        const trimmed = selector.trim();
        // Don't scope @-rules (@media, @keyframes, @supports, @container, @layer, @font-face, etc.)
        if (trimmed.startsWith('@')) {
          inAtBlock++;
          return match;
        }
        // Don't scope keyframe stops (from, to, 0%, 50%, etc.)
        if (inAtBlock > 0 && /^[\d%\s,fromto]+$/.test(trimmed.replace(/\s/g, ''))) {
          return match;
        }
        return selector.split(',').map(s => `[${scopeAttr}] ${s.trim()}`).join(', ') + ' {';
      });
      const styleEl = document.createElement('style');
      styleEl.textContent = scoped;
      styleEl.setAttribute('data-zq-component', this._def._name || '');
      styleEl.setAttribute('data-zq-scope', scopeAttr);
      if (this._def._resolvedStyleUrls) {
        styleEl.setAttribute('data-zq-style-urls', this._def._resolvedStyleUrls.join(' '));
        if (this._def.styles) {
          styleEl.setAttribute('data-zq-inline', this._def.styles);
        }
      }
      document.head.appendChild(styleEl);
      this._styleEl = styleEl;
    }

    // -- Focus preservation ----------------------------------------
    // DOM morphing preserves unchanged nodes naturally, but we still
    // track focus for cases where the focused element's subtree changes.
    let _focusInfo = null;
    const _active = document.activeElement;
    if (_active && this._el.contains(_active)) {
      const modelKey = _active.getAttribute?.('z-model');
      const refKey = _active.getAttribute?.('z-ref');
      let selector = null;
      if (modelKey) {
        selector = `[z-model="${modelKey}"]`;
      } else if (refKey) {
        selector = `[z-ref="${refKey}"]`;
      } else {
        const tag = _active.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') {
          let s = tag;
          if (_active.type) s += `[type="${_active.type}"]`;
          if (_active.name) s += `[name="${_active.name}"]`;
          if (_active.placeholder) s += `[placeholder="${CSS.escape(_active.placeholder)}"]`;
          selector = s;
        }
      }
      if (selector) {
        _focusInfo = {
          selector,
          start: _active.selectionStart,
          end: _active.selectionEnd,
          dir: _active.selectionDirection,
        };
      }
    }

    // Update DOM via morphing (diffing) — preserves unchanged nodes
    // First render uses innerHTML for speed; subsequent renders morph.
    const _renderStart = typeof window !== 'undefined' && (window.__zqMorphHook || window.__zqRenderHook) ? performance.now() : 0;
    if (!this._mounted) {
      this._el.innerHTML = html;
      if (_renderStart && window.__zqRenderHook) window.__zqRenderHook(this._el, performance.now() - _renderStart, 'mount', this._def._name);
    } else {
      morph(this._el, html);
    }

    // Process structural & attribute directives
    this._processDirectives();

    // Process event, ref, and model bindings
    this._bindEvents();
    this._bindRefs();
    this._bindModels();

    // Restore focus if the morph replaced the focused element
    if (_focusInfo) {
      const el = this._el.querySelector(_focusInfo.selector);
      if (el && el !== document.activeElement) {
        el.focus();
        try {
          if (_focusInfo.start !== null && _focusInfo.start !== undefined) {
            el.setSelectionRange(_focusInfo.start, _focusInfo.end, _focusInfo.dir);
          }
        } catch (_) { /* some input types don't support setSelectionRange */ }
      }
    }

    // Mount nested components
    mountAll(this._el);

    if (!this._mounted) {
      this._mounted = true;
      if (this._def.mounted) {
        try { this._def.mounted.call(this); }
        catch (err) { reportError(ErrorCode.COMP_LIFECYCLE, `Component "${this._def._name}" mounted() threw`, { component: this._def._name }, err); }
      }
    } else {
      if (this._def.updated) {
        try { this._def.updated.call(this); }
        catch (err) { reportError(ErrorCode.COMP_LIFECYCLE, `Component "${this._def._name}" updated() threw`, { component: this._def._name }, err); }
      }
    }
  }

  // Bind @event="method" and z-on:event="method" handlers via delegation.
  //
  // Optimization: on the FIRST render, we scan for event attributes, build
  // a delegated handler map, and attach one listener per event type to the
  // component root. On subsequent renders (re-bind), we only rebuild the
  // internal binding map — existing DOM listeners are reused since they
  // delegate to event.target.closest(selector) at fire time.
  _bindEvents() {
    // Always rebuild the binding map from current DOM
    const eventMap = new Map(); // event → [{ selector, methodExpr, modifiers, el }]

    const allEls = this._el.querySelectorAll('*');
    allEls.forEach(child => {
      if (child.closest('[z-pre]')) return;

      const attrs = child.attributes;
      for (let a = 0; a < attrs.length; a++) {
        const attr = attrs[a];
        let raw;
        if (attr.name.charCodeAt(0) === 64) { // '@'
          raw = attr.name.slice(1);
        } else if (attr.name.startsWith('z-on:')) {
          raw = attr.name.slice(5);
        } else {
          continue;
        }

        const parts = raw.split('.');
        const event = parts[0];
        const modifiers = parts.slice(1);
        const methodExpr = attr.value;

        // Give element a unique selector for delegation
        if (!child.dataset.zqEid) {
          child.dataset.zqEid = String(++_uid);
        }
        const selector = `[data-zq-eid="${child.dataset.zqEid}"]`;

        if (!eventMap.has(event)) eventMap.set(event, []);
        eventMap.get(event).push({ selector, methodExpr, modifiers, el: child });
      }
    });

    // Store binding map for the delegated handlers to reference
    this._eventBindings = eventMap;

    // Only attach DOM listeners once — reuse on subsequent renders.
    // The handlers close over `this` and read `this._eventBindings`
    // at fire time, so they always use the latest binding map.
    if (this._delegatedEvents) {
      // Already attached — just make sure new event types are covered
      for (const event of eventMap.keys()) {
        if (!this._delegatedEvents.has(event)) {
          this._attachDelegatedEvent(event, eventMap.get(event));
        }
      }
      // Remove listeners for event types no longer in the template
      for (const event of this._delegatedEvents.keys()) {
        if (!eventMap.has(event)) {
          const { handler, opts } = this._delegatedEvents.get(event);
          this._el.removeEventListener(event, handler, opts);
          this._delegatedEvents.delete(event);
          // Also remove from _listeners array
          this._listeners = this._listeners.filter(l => l.event !== event);
        }
      }
      return;
    }

    this._delegatedEvents = new Map();

    // Register delegated listeners on the component root
    for (const [event, bindings] of eventMap) {
      this._attachDelegatedEvent(event, bindings);
    }
  }

  // Attach a single delegated listener for an event type
  _attachDelegatedEvent(event, bindings) {
      const needsCapture = bindings.some(b => b.modifiers.includes('capture'));
      const needsPassive = bindings.some(b => b.modifiers.includes('passive'));
      const listenerOpts = (needsCapture || needsPassive)
        ? { capture: needsCapture, passive: needsPassive }
        : false;

      const handler = (e) => {
        // Read bindings from live map — always up to date after re-renders
        const currentBindings = this._eventBindings?.get(event) || [];
        for (const { selector, methodExpr, modifiers, el } of currentBindings) {
          if (!e.target.closest(selector)) continue;

          // .self — only fire if target is the element itself
          if (modifiers.includes('self') && e.target !== el) continue;

          // Handle modifiers
          if (modifiers.includes('prevent')) e.preventDefault();
          if (modifiers.includes('stop')) e.stopPropagation();

          // Build the invocation function
          const invoke = (evt) => {
            const match = methodExpr.match(/^(\w+)(?:\(([^)]*)\))?$/);
            if (!match) return;
            const methodName = match[1];
            const fn = this[methodName];
            if (typeof fn !== 'function') return;
            if (match[2] !== undefined) {
              const args = match[2].split(',').map(a => {
                a = a.trim();
                if (a === '') return undefined;
                if (a === '$event') return evt;
                if (a === 'true') return true;
                if (a === 'false') return false;
                if (a === 'null') return null;
                if (/^-?\d+(\.\d+)?$/.test(a)) return Number(a);
                if ((a.startsWith("'") && a.endsWith("'")) || (a.startsWith('"') && a.endsWith('"'))) return a.slice(1, -1);
                if (a.startsWith('state.')) return _getPath(this.state, a.slice(6));
                return a;
              }).filter(a => a !== undefined);
              fn(...args);
            } else {
              fn(evt);
            }
          };

          // .debounce.{ms} — delay invocation until idle
          const debounceIdx = modifiers.indexOf('debounce');
          if (debounceIdx !== -1) {
            const ms = parseInt(modifiers[debounceIdx + 1], 10) || 250;
            const timers = _debounceTimers.get(el) || {};
            clearTimeout(timers[event]);
            timers[event] = setTimeout(() => invoke(e), ms);
            _debounceTimers.set(el, timers);
            continue;
          }

          // .throttle.{ms} — fire at most once per interval
          const throttleIdx = modifiers.indexOf('throttle');
          if (throttleIdx !== -1) {
            const ms = parseInt(modifiers[throttleIdx + 1], 10) || 250;
            const timers = _throttleTimers.get(el) || {};
            if (timers[event]) continue;
            invoke(e);
            timers[event] = setTimeout(() => { timers[event] = null; }, ms);
            _throttleTimers.set(el, timers);
            continue;
          }

          // .once — fire once then ignore
          if (modifiers.includes('once')) {
            if (el.dataset.zqOnce === event) continue;
            el.dataset.zqOnce = event;
          }

          invoke(e);
        }
      };
      this._el.addEventListener(event, handler, listenerOpts);
      this._listeners.push({ event, handler });
      this._delegatedEvents.set(event, { handler, opts: listenerOpts });
  }

  // Bind z-ref="name" → this.refs.name
  _bindRefs() {
    this.refs = {};
    this._el.querySelectorAll('[z-ref]').forEach(el => {
      this.refs[el.getAttribute('z-ref')] = el;
    });
  }

  // Bind z-model="stateKey" for two-way binding
  //
  //  Supported elements:  input (text, number, range, checkbox, radio, date, color, …),
  //                       textarea, select (single & multiple), contenteditable
  //  Nested state keys:   z-model="user.name"  →  this.state.user.name
  //  Modifiers (boolean attributes on the same element):
  //    z-lazy    — listen on 'change' instead of 'input' (update on blur / commit)
  //    z-trim    — trim whitespace before writing to state
  //    z-number  — force Number() conversion regardless of input type
  //
  //  Writes to reactive state so the rest of the UI stays in sync.
  //  Focus and cursor position are preserved in _render() via focusInfo.
  //
  _bindModels() {
    this._el.querySelectorAll('[z-model]').forEach(el => {
      const key = el.getAttribute('z-model');
      const tag = el.tagName.toLowerCase();
      const type = (el.type || '').toLowerCase();
      const isEditable = el.hasAttribute('contenteditable');

      // Modifiers
      const isLazy   = el.hasAttribute('z-lazy');
      const isTrim   = el.hasAttribute('z-trim');
      const isNum    = el.hasAttribute('z-number');

      // Read current state value (supports dot-path keys)
      const currentVal = _getPath(this.state, key);

      // -- Set initial DOM value from state (always sync) ----------
      if (tag === 'input' && type === 'checkbox') {
        el.checked = !!currentVal;
      } else if (tag === 'input' && type === 'radio') {
        el.checked = el.value === String(currentVal);
      } else if (tag === 'select' && el.multiple) {
        const vals = Array.isArray(currentVal) ? currentVal.map(String) : [];
        [...el.options].forEach(opt => { opt.selected = vals.includes(opt.value); });
      } else if (isEditable) {
        if (el.textContent !== String(currentVal ?? '')) {
          el.textContent = currentVal ?? '';
        }
      } else {
        el.value = currentVal ?? '';
      }

      // -- Determine event type ------------------------------------
      const event = isLazy || tag === 'select' || type === 'checkbox' || type === 'radio'
        ? 'change'
        : isEditable ? 'input' : 'input';

      // -- Handler: read DOM → write to reactive state -------------
      // Skip if already bound (morph preserves existing elements,
      // so re-binding would stack duplicate listeners)
      if (el._zqModelBound) return;
      el._zqModelBound = true;

      const handler = () => {
        let val;
        if (type === 'checkbox')           val = el.checked;
        else if (tag === 'select' && el.multiple) val = [...el.selectedOptions].map(o => o.value);
        else if (isEditable)                val = el.textContent;
        else                                val = el.value;

        // Apply modifiers
        if (isTrim && typeof val === 'string') val = val.trim();
        if (isNum || type === 'number' || type === 'range') val = Number(val);

        // Write through the reactive proxy (triggers re-render).
        // Focus + cursor are preserved automatically by _render().
        _setPath(this.state, key, val);
      };

      el.addEventListener(event, handler);
    });
  }

  // ---------------------------------------------------------------------------
  // Expression evaluator — CSP-safe parser (no eval / new Function)
  // ---------------------------------------------------------------------------
  _evalExpr(expr) {
    return safeEval(expr, [
      this.state.__raw || this.state,
      { props: this.props, refs: this.refs, computed: this.computed, $: typeof window !== 'undefined' ? window.$ : undefined }
    ]);
  }

  // ---------------------------------------------------------------------------
  // z-for — Expand list-rendering directives (pre-innerHTML, string level)
  //
  //   <li z-for="item in items">{{item.name}}</li>
  //   <li z-for="(item, i) in items">{{i}}: {{item.name}}</li>
  //   <div z-for="n in 5">{{n}}</div>                     (range)
  //   <div z-for="(val, key) in obj">{{key}}: {{val}}</div> (object)
  //
  // Uses a temporary DOM to parse, clone elements per item, and evaluate
  // {{}} expressions with the iteration variable in scope.
  // ---------------------------------------------------------------------------
  _expandZFor(html) {
    if (!html.includes('z-for')) return html;

    const temp = document.createElement('div');
    temp.innerHTML = html;

    const _recurse = (root) => {
      // Process innermost z-for elements first (no nested z-for inside)
      let forEls = [...root.querySelectorAll('[z-for]')]
        .filter(el => !el.querySelector('[z-for]'));
      if (!forEls.length) return;

      for (const el of forEls) {
        if (!el.parentNode) continue; // already removed
        const expr = el.getAttribute('z-for');
        const m = expr.match(
          /^\s*(?:\(\s*(\w+)(?:\s*,\s*(\w+))?\s*\)|(\w+))\s+in\s+(.+)\s*$/
        );
        if (!m) { el.removeAttribute('z-for'); continue; }

        const itemVar  = m[1] || m[3];
        const indexVar = m[2] || '$index';
        const listExpr = m[4].trim();

        let list = this._evalExpr(listExpr);
        if (list == null) { el.remove(); continue; }
        // Number range: z-for="n in 5" → [1, 2, 3, 4, 5]
        if (typeof list === 'number') {
          list = Array.from({ length: list }, (_, i) => i + 1);
        }
        // Object iteration: z-for="(val, key) in obj" → entries
        if (!Array.isArray(list) && typeof list === 'object' && typeof list[Symbol.iterator] !== 'function') {
          list = Object.entries(list).map(([k, v]) => ({ key: k, value: v }));
        }
        if (!Array.isArray(list) && typeof list[Symbol.iterator] === 'function') {
          list = [...list];
        }
        if (!Array.isArray(list)) { el.remove(); continue; }

        const parent = el.parentNode;
        const tplEl = el.cloneNode(true);
        tplEl.removeAttribute('z-for');
        const tplOuter = tplEl.outerHTML;

        const fragment = document.createDocumentFragment();
        const evalReplace = (str, item, index) =>
          str.replace(/\{\{(.+?)\}\}/g, (_, inner) => {
            try {
              const loopScope = {};
              loopScope[itemVar] = item;
              loopScope[indexVar] = index;
              const result = safeEval(inner.trim(), [
                loopScope,
                this.state.__raw || this.state,
                { props: this.props, computed: this.computed, $: typeof window !== 'undefined' ? window.$ : undefined }
              ]);
              return result != null ? result : '';
            } catch { return ''; }
          });

        for (let i = 0; i < list.length; i++) {
          const processed = evalReplace(tplOuter, list[i], i);
          const wrapper = document.createElement('div');
          wrapper.innerHTML = processed;
          while (wrapper.firstChild) fragment.appendChild(wrapper.firstChild);
        }

        parent.replaceChild(fragment, el);
      }

      // Handle remaining nested z-for (now exposed)
      if (root.querySelector('[z-for]')) _recurse(root);
    };

    _recurse(temp);
    return temp.innerHTML;
  }

  // ---------------------------------------------------------------------------
  // _expandContentDirectives — Pre-morph z-html & z-text expansion
  //
  // Evaluates z-html and z-text directives at the string level so the morph
  // engine receives HTML with the actual content inline. This lets the diff
  // algorithm properly compare old vs new content (text nodes, child elements)
  // instead of clearing + re-injecting on every re-render.
  //
  // Same parse → evaluate → serialize pattern as _expandZFor.
  // ---------------------------------------------------------------------------
  _expandContentDirectives(html) {
    if (!html.includes('z-html') && !html.includes('z-text')) return html;

    const temp = document.createElement('div');
    temp.innerHTML = html;

    // z-html: evaluate expression → inject as innerHTML
    temp.querySelectorAll('[z-html]').forEach(el => {
      if (el.closest('[z-pre]')) return;
      const val = this._evalExpr(el.getAttribute('z-html'));
      el.innerHTML = val != null ? String(val) : '';
      el.removeAttribute('z-html');
    });

    // z-text: evaluate expression → inject as textContent (HTML-safe)
    temp.querySelectorAll('[z-text]').forEach(el => {
      if (el.closest('[z-pre]')) return;
      const val = this._evalExpr(el.getAttribute('z-text'));
      el.textContent = val != null ? String(val) : '';
      el.removeAttribute('z-text');
    });

    return temp.innerHTML;
  }

  // ---------------------------------------------------------------------------
  // _processDirectives — Post-innerHTML DOM-level directive processing
  // ---------------------------------------------------------------------------
  _processDirectives() {
    // z-pre: skip all directive processing on subtrees
    // (we leave z-pre elements in the DOM, but skip their descendants)

    // -- z-if / z-else-if / z-else (conditional rendering) --------
    const ifEls = [...this._el.querySelectorAll('[z-if]')];
    for (const el of ifEls) {
      if (!el.parentNode || el.closest('[z-pre]')) continue;

      const show = !!this._evalExpr(el.getAttribute('z-if'));

      // Collect chain: adjacent z-else-if / z-else siblings
      const chain = [{ el, show }];
      let sib = el.nextElementSibling;
      while (sib) {
        if (sib.hasAttribute('z-else-if')) {
          chain.push({ el: sib, show: !!this._evalExpr(sib.getAttribute('z-else-if')) });
          sib = sib.nextElementSibling;
        } else if (sib.hasAttribute('z-else')) {
          chain.push({ el: sib, show: true });
          break;
        } else {
          break;
        }
      }

      // Keep the first truthy branch, remove the rest
      let found = false;
      for (const item of chain) {
        if (!found && item.show) {
          found = true;
          item.el.removeAttribute('z-if');
          item.el.removeAttribute('z-else-if');
          item.el.removeAttribute('z-else');
        } else {
          item.el.remove();
        }
      }
    }

    // -- z-show (toggle display) -----------------------------------
    this._el.querySelectorAll('[z-show]').forEach(el => {
      if (el.closest('[z-pre]')) return;
      const show = !!this._evalExpr(el.getAttribute('z-show'));
      el.style.display = show ? '' : 'none';
      el.removeAttribute('z-show');
    });

    // -- z-bind:attr / :attr (dynamic attribute binding) -----------
    // Use TreeWalker instead of querySelectorAll('*') — avoids
    // creating a flat array of every single descendant element.
    // TreeWalker visits nodes lazily; FILTER_REJECT skips z-pre subtrees
    // at the walker level (faster than per-node closest('[z-pre]') checks).
    const walker = document.createTreeWalker(this._el, NodeFilter.SHOW_ELEMENT, {
      acceptNode(n) {
        return n.hasAttribute('z-pre') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    let node;
    while ((node = walker.nextNode())) {
      const attrs = node.attributes;
      for (let i = attrs.length - 1; i >= 0; i--) {
        const attr = attrs[i];
        let attrName;
        if (attr.name.startsWith('z-bind:')) attrName = attr.name.slice(7);
        else if (attr.name.charCodeAt(0) === 58 && attr.name.charCodeAt(1) !== 58) attrName = attr.name.slice(1); // ':' but not '::'
        else continue;

        const val = this._evalExpr(attr.value);
        node.removeAttribute(attr.name);
        if (val === false || val === null || val === undefined) {
          node.removeAttribute(attrName);
        } else if (val === true) {
          node.setAttribute(attrName, '');
        } else {
          node.setAttribute(attrName, String(val));
        }
      }
    }

    // -- z-class (dynamic class binding) ---------------------------
    this._el.querySelectorAll('[z-class]').forEach(el => {
      if (el.closest('[z-pre]')) return;
      const val = this._evalExpr(el.getAttribute('z-class'));
      if (typeof val === 'string') {
        val.split(/\s+/).filter(Boolean).forEach(c => el.classList.add(c));
      } else if (Array.isArray(val)) {
        val.filter(Boolean).forEach(c => el.classList.add(String(c)));
      } else if (val && typeof val === 'object') {
        for (const [cls, active] of Object.entries(val)) {
          el.classList.toggle(cls, !!active);
        }
      }
      el.removeAttribute('z-class');
    });

    // -- z-style (dynamic inline styles) ---------------------------
    this._el.querySelectorAll('[z-style]').forEach(el => {
      if (el.closest('[z-pre]')) return;
      const val = this._evalExpr(el.getAttribute('z-style'));
      if (typeof val === 'string') {
        el.style.cssText += ';' + val;
      } else if (val && typeof val === 'object') {
        for (const [prop, v] of Object.entries(val)) {
          el.style[prop] = v;
        }
      }
      el.removeAttribute('z-style');
    });

    // z-html and z-text are now pre-expanded at string level (before
    // morph) via _expandContentDirectives(), so the diff engine can
    // properly diff their content instead of clearing + re-injecting.

    // -- z-cloak (remove after render) -----------------------------
    this._el.querySelectorAll('[z-cloak]').forEach(el => {
      el.removeAttribute('z-cloak');
    });
  }

  // Programmatic state update (batch-friendly)
  // Passing an empty object forces a re-render (useful for external state changes).
  setState(partial) {
    if (partial && Object.keys(partial).length > 0) {
      Object.assign(this.state, partial);
    } else {
      this._scheduleUpdate();
    }
  }

  // Emit custom event up the DOM
  emit(name, detail) {
    this._el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, cancelable: true }));
  }

  // Destroy this component
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this._def.destroyed) {
      try { this._def.destroyed.call(this); }
      catch (err) { reportError(ErrorCode.COMP_LIFECYCLE, `Component "${this._def._name}" destroyed() threw`, { component: this._def._name }, err); }
    }
    this._listeners.forEach(({ event, handler }) => this._el.removeEventListener(event, handler));
    this._listeners = [];
    this._delegatedEvents = null;
    this._eventBindings = null;
    if (this._styleEl) this._styleEl.remove();
    _instances.delete(this._el);
    this._el.innerHTML = '';
  }
}


// Reserved definition keys (not user methods)
const _reservedKeys = new Set([
  'state', 'render', 'styles', 'init', 'mounted', 'updated', 'destroyed', 'props',
  'templateUrl', 'styleUrl', 'templates', 'base',
  'computed', 'watch'
]);


// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register a component
 * @param {string} name — tag name (must contain a hyphen, e.g. 'app-counter')
 * @param {object} definition — component definition
 */
function component(name, definition) {
  if (!name || typeof name !== 'string') {
    throw new ZQueryError(ErrorCode.COMP_INVALID_NAME, 'Component name must be a non-empty string');
  }
  if (!name.includes('-')) {
    throw new ZQueryError(ErrorCode.COMP_INVALID_NAME, `Component name "${name}" must contain a hyphen (Web Component convention)`);
  }
  definition._name = name;

  // Auto-detect the calling module's URL so that relative templateUrl
  // and styleUrl paths resolve relative to the component file.
  // An explicit `base` string on the definition overrides auto-detection.
  if (definition.base !== undefined) {
    definition._base = definition.base;   // explicit override
  } else {
    definition._base = _detectCallerBase();
  }

  _registry.set(name, definition);
}

/**
 * Mount a component into a target element
 * @param {string|Element} target — selector or element to mount into
 * @param {string} componentName — registered component name
 * @param {object} props — props to pass
 * @returns {Component}
 */
function mount(target, componentName, props = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) throw new ZQueryError(ErrorCode.COMP_MOUNT_TARGET, `Mount target "${target}" not found`, { target });

  const def = _registry.get(componentName);
  if (!def) throw new ZQueryError(ErrorCode.COMP_NOT_FOUND, `Component "${componentName}" not registered`, { component: componentName });

  // Destroy existing instance
  if (_instances.has(el)) _instances.get(el).destroy();

  const instance = new Component(el, def, props);
  _instances.set(el, instance);
  instance._render();
  return instance;
}

/**
 * Scan a container for custom component tags and auto-mount them
 * @param {Element} root — root element to scan (default: document.body)
 */
function mountAll(root = document.body) {
  for (const [name, def] of _registry) {
    const tags = root.querySelectorAll(name);
    tags.forEach(tag => {
      if (_instances.has(tag)) return; // Already mounted

      // Extract props from attributes
      const props = {};

      // Find parent component instance for evaluating dynamic prop expressions
      let parentInstance = null;
      let ancestor = tag.parentElement;
      while (ancestor) {
        if (_instances.has(ancestor)) {
          parentInstance = _instances.get(ancestor);
          break;
        }
        ancestor = ancestor.parentElement;
      }

      [...tag.attributes].forEach(attr => {
        if (attr.name.startsWith('@') || attr.name.startsWith('z-')) return;

        // Dynamic prop: :propName="expression" — evaluate in parent context
        if (attr.name.startsWith(':')) {
          const propName = attr.name.slice(1);
          if (parentInstance) {
            props[propName] = safeEval(attr.value, [
              parentInstance.state.__raw || parentInstance.state,
              { props: parentInstance.props, refs: parentInstance.refs, computed: parentInstance.computed, $: typeof window !== 'undefined' ? window.$ : undefined }
            ]);
          } else {
            // No parent — try JSON parse
            try { props[propName] = JSON.parse(attr.value); }
            catch { props[propName] = attr.value; }
          }
          return;
        }

        // Static prop
        try { props[attr.name] = JSON.parse(attr.value); }
        catch { props[attr.name] = attr.value; }
      });

      const instance = new Component(tag, def, props);
      _instances.set(tag, instance);
      instance._render();
    });
  }
}

/**
 * Get the component instance for an element
 * @param {string|Element} target
 * @returns {Component|null}
 */
function getInstance(target) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  return _instances.get(el) || null;
}

/**
 * Destroy a component at the given target
 * @param {string|Element} target
 */
function destroy(target) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  const inst = _instances.get(el);
  if (inst) inst.destroy();
}

/**
 * Get the registry (for debugging)
 */
function getRegistry() {
  return Object.fromEntries(_registry);
}

/**
 * Pre-load a component's external templates and styles so the next mount
 * renders synchronously (no blank flash while fetching).
 * Safe to call multiple times — skips if already loaded.
 * @param {string} name — registered component name
 * @returns {Promise<void>}
 */
async function prefetch(name) {
  const def = _registry.get(name);
  if (!def) return;

  // Load templateUrl and styleUrl if not already loaded.
  if ((def.templateUrl && !def._templateLoaded) ||
      (def.styleUrl && !def._styleLoaded)) {
    await Component.prototype._loadExternals.call({ _def: def });
  }
}


// ---------------------------------------------------------------------------
// Global stylesheet loader
// ---------------------------------------------------------------------------
const _globalStyles = new Map(); // url → <link> element

/**
 * Load one or more global stylesheets into <head>.
 * Relative URLs resolve against the calling module's directory (auto-detected
 * from the stack trace), just like component styleUrl paths.
 * Returns a remove() handle so the caller can unload if needed.
 *
 *   $.style('app.css')                          // critical by default
 *   $.style(['app.css', 'theme.css'])            // multiple files
 *   $.style('/assets/global.css')                // absolute — used as-is
 *   $.style('app.css', { critical: false })       // opt out of FOUC prevention
 *
 * Options:
 *   critical  — (boolean, default true) When true, zQuery injects a tiny
 *               inline style that hides the page (`visibility: hidden`) and
 *               removes it once the stylesheet has loaded. This prevents
 *               FOUC (Flash of Unstyled Content) entirely — no special
 *               markup needed in the HTML file. Set to false to load
 *               the stylesheet without blocking paint.
 *   bg        — (string, default '#0d1117') Background color applied while
 *               the page is hidden during critical load. Prevents a white
 *               flash on dark-themed apps. Only used when critical is true.
 *
 * Duplicate URLs are ignored (idempotent).
 *
 * @param {string|string[]} urls — stylesheet URL(s) to load
 * @param {object} [opts] — options
 * @param {boolean} [opts.critical=true] — hide page until loaded (prevents FOUC)
 * @param {string} [opts.bg] — background color while hidden (default '#0d1117')
 * @returns {{ remove: Function, ready: Promise }} — .remove() to unload, .ready resolves when loaded
 */
function style(urls, opts = {}) {
  const callerBase = _detectCallerBase();
  const list = Array.isArray(urls) ? urls : [urls];
  const elements = [];
  const loadPromises = [];

  // Critical mode (default: true): inject a tiny inline <style> that hides the
  // page and sets a background color. Fully self-contained — no markup needed
  // in the HTML file. The style is removed once the sheet loads.
  let _criticalStyle = null;
  if (opts.critical !== false) {
    _criticalStyle = document.createElement('style');
    _criticalStyle.setAttribute('data-zq-critical', '');
    _criticalStyle.textContent = `html{visibility:hidden!important;background:${opts.bg || '#0d1117'}}`;
    document.head.insertBefore(_criticalStyle, document.head.firstChild);
  }

  for (let url of list) {
    // Resolve relative paths against the caller's directory first,
    // falling back to <base href> or origin root.
    if (typeof url === 'string' && !url.startsWith('/') && !url.includes(':') && !url.startsWith('//')) {
      url = _resolveUrl(url, callerBase);
    }

    if (_globalStyles.has(url)) {
      elements.push(_globalStyles.get(url));
      continue;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.setAttribute('data-zq-style', '');

    const p = new Promise(resolve => {
      link.onload = resolve;
      link.onerror = resolve; // don't block forever on error
    });
    loadPromises.push(p);

    document.head.appendChild(link);
    _globalStyles.set(url, link);
    elements.push(link);
  }

  // When all sheets are loaded, reveal the page if critical mode was used
  const ready = Promise.all(loadPromises).then(() => {
    if (_criticalStyle) {
      _criticalStyle.remove();
    }
  });

  return {
    ready,
    remove() {
      for (const el of elements) {
        el.remove();
        for (const [k, v] of _globalStyles) {
          if (v === el) { _globalStyles.delete(k); break; }
        }
      }
    }
  };
}

// --- src/router.js -----------------------------------------------
/**
 * zQuery Router — Client-side SPA router
 * 
 * Supports hash mode (#/path) and history mode (/path).
 * Route params, query strings, navigation guards, and lazy loading.
 * Sub-route history substates for in-page UI changes (modals, tabs, etc.).
 * 
 * Usage:
 *   $.router({
 *     el: '#app',
 *     mode: 'hash',
 *     routes: [
 *       { path: '/', component: 'home-page' },
 *       { path: '/user/:id', component: 'user-profile' },
 *       { path: '/lazy', load: () => import('./pages/lazy.js'), component: 'lazy-page' },
 *     ],
 *     fallback: 'not-found'
 *   });
 */



// Unique marker on history.state to identify zQuery-managed entries
const _ZQ_STATE_KEY = '__zq';

class Router {
  constructor(config = {}) {
    this._el = null;
    // file:// protocol can't use pushState — always force hash mode
    const isFile = typeof location !== 'undefined' && location.protocol === 'file:';
    this._mode = isFile ? 'hash' : (config.mode || 'history');

    // Base path for sub-path deployments
    // Priority: explicit config.base → window.__ZQ_BASE → <base href> tag
    let rawBase = config.base;
    if (rawBase == null) {
      rawBase = (typeof window !== 'undefined' && window.__ZQ_BASE) || '';
      if (!rawBase && typeof document !== 'undefined') {
        const baseEl = document.querySelector('base');
        if (baseEl) {
          try { rawBase = new URL(baseEl.href).pathname; }
          catch { rawBase = baseEl.getAttribute('href') || ''; }
          if (rawBase === '/') rawBase = '';    // root = no sub-path
        }
      }
    }
    // Normalize: ensure leading /, strip trailing /
    this._base = String(rawBase).replace(/\/+$/, '');
    if (this._base && !this._base.startsWith('/')) this._base = '/' + this._base;

    this._routes = [];
    this._fallback = config.fallback || null;
    this._current = null;                         // { route, params, query, path }
    this._guards = { before: [], after: [] };
    this._listeners = new Set();
    this._instance = null;                        // current mounted component
    this._resolving = false;                      // re-entrancy guard

    // Sub-route history substates
    this._substateListeners = [];                 // [(key, data) => bool|void]
    this._inSubstate = false;                       // true while substate entries are in the history stack

    // Set outlet element
    if (config.el) {
      this._el = typeof config.el === 'string' ? document.querySelector(config.el) : config.el;
    }

    // Register routes
    if (config.routes) {
      config.routes.forEach(r => this.add(r));
    }

    // Listen for navigation
    if (this._mode === 'hash') {
      window.addEventListener('hashchange', () => this._resolve());
    } else {
      window.addEventListener('popstate', (e) => {
        // Check for substate pop first — if a listener handles it, don't route
        const st = e.state;
        if (st && st[_ZQ_STATE_KEY] === 'substate') {
          const handled = this._fireSubstate(st.key, st.data, 'pop');
          if (handled) return;
          // Unhandled substate — fall through to route resolve
          // _inSubstate stays true so the next non-substate pop triggers reset
        } else if (this._inSubstate) {
          // Popped past all substates — notify listeners to reset to defaults
          this._inSubstate = false;
          this._fireSubstate(null, null, 'reset');
        }
        this._resolve();
      });
    }

    // Intercept link clicks for SPA navigation
    document.addEventListener('click', (e) => {
      // Don't intercept modified clicks (Ctrl/Cmd+click = new tab)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target.closest('[z-link]');
      if (!link) return;
      if (link.getAttribute('target') === '_blank') return;
      e.preventDefault();
      let href = link.getAttribute('z-link');
      // Support z-link-params for dynamic :param interpolation
      const paramsAttr = link.getAttribute('z-link-params');
      if (paramsAttr) {
        try {
          const params = JSON.parse(paramsAttr);
          href = this._interpolateParams(href, params);
        } catch { /* ignore malformed JSON */ }
      }
      this.navigate(href);
      // z-to-top modifier: scroll to top after navigation
      if (link.hasAttribute('z-to-top')) {
        const scrollBehavior = link.getAttribute('z-to-top') || 'instant';
        window.scrollTo({ top: 0, behavior: scrollBehavior });
      }
    });

    // Initial resolve
    if (this._el) {
      // Defer to allow all components to register
      queueMicrotask(() => this._resolve());
    }
  }

  // --- Route management ----------------------------------------------------

  add(route) {
    // Compile path pattern into regex
    const keys = [];
    const pattern = route.path
      .replace(/:(\w+)/g, (_, key) => { keys.push(key); return '([^/]+)'; })
      .replace(/\*/g, '(.*)');
    const regex = new RegExp(`^${pattern}$`);

    this._routes.push({ ...route, _regex: regex, _keys: keys });

    // Per-route fallback: register an alias path for the same component.
    // e.g. { path: '/docs/:section', fallback: '/docs', component: 'docs-page' }
    // When matched via fallback, missing params are undefined.
    if (route.fallback) {
      const fbKeys = [];
      const fbPattern = route.fallback
        .replace(/:(\w+)/g, (_, key) => { fbKeys.push(key); return '([^/]+)'; })
        .replace(/\*/g, '(.*)');
      const fbRegex = new RegExp(`^${fbPattern}$`);
      this._routes.push({ ...route, path: route.fallback, _regex: fbRegex, _keys: fbKeys });
    }

    return this;
  }

  remove(path) {
    this._routes = this._routes.filter(r => r.path !== path);
    return this;
  }

  // --- Navigation ----------------------------------------------------------

  /**
   * Interpolate :param placeholders in a path with the given values.
   * @param {string} path — e.g. '/user/:id/posts/:pid'
   * @param {Object} params — e.g. { id: 42, pid: 7 }
   * @returns {string}
   */
  _interpolateParams(path, params) {
    if (!params || typeof params !== 'object') return path;
    return path.replace(/:([\w]+)/g, (_, key) => {
      const val = params[key];
      return val != null ? encodeURIComponent(String(val)) : ':' + key;
    });
  }

  /**
   * Get the full current URL (path + hash) for same-URL detection.
   * @returns {string}
   */
  _currentURL() {
    if (this._mode === 'hash') {
      return window.location.hash.slice(1) || '/';
    }
    const pathname = window.location.pathname || '/';
    const hash = window.location.hash || '';
    return pathname + hash;
  }

  navigate(path, options = {}) {
    // Interpolate :param placeholders if options.params is provided
    if (options.params) path = this._interpolateParams(path, options.params);
    // Separate hash fragment (e.g. /docs/getting-started#cli-bundler)
    const [cleanPath, fragment] = (path || '').split('#');
    let normalized = this._normalizePath(cleanPath);
    const hash = fragment ? '#' + fragment : '';
    if (this._mode === 'hash') {
      // Hash mode uses the URL hash for routing, so a #fragment can't live
      // in the URL. Store it as a scroll target for the destination component.
      if (fragment) window.__zqScrollTarget = fragment;
      const targetHash = '#' + normalized;
      // Skip if already at this exact hash (prevents duplicate entries)
      if (window.location.hash === targetHash && !options.force) return this;
      window.location.hash = targetHash;
    } else {
      const targetURL = this._base + normalized + hash;
      const currentURL = (window.location.pathname || '/') + (window.location.hash || '');

      if (targetURL === currentURL && !options.force) {
        // Same full URL (path + hash) — don't push duplicate entry.
        // If only the hash changed to a fragment target, scroll to it.
        if (fragment) {
          const el = document.getElementById(fragment);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return this;
      }

      // Same route path but different hash fragment — use replaceState
      // so back goes to the previous *route*, not the previous scroll position.
      const targetPathOnly = this._base + normalized;
      const currentPathOnly = window.location.pathname || '/';
      if (targetPathOnly === currentPathOnly && hash && !options.force) {
        window.history.replaceState(
          { ...options.state, [_ZQ_STATE_KEY]: 'route' },
          '',
          targetURL
        );
        // Scroll to the fragment target
        if (fragment) {
          const el = document.getElementById(fragment);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // Don't re-resolve — same route, just a hash change
        return this;
      }

      window.history.pushState(
        { ...options.state, [_ZQ_STATE_KEY]: 'route' },
        '',
        targetURL
      );
      this._resolve();
    }
    return this;
  }

  replace(path, options = {}) {
    // Interpolate :param placeholders if options.params is provided
    if (options.params) path = this._interpolateParams(path, options.params);
    const [cleanPath, fragment] = (path || '').split('#');
    let normalized = this._normalizePath(cleanPath);
    const hash = fragment ? '#' + fragment : '';
    if (this._mode === 'hash') {
      if (fragment) window.__zqScrollTarget = fragment;
      window.location.replace('#' + normalized);
    } else {
      window.history.replaceState(
        { ...options.state, [_ZQ_STATE_KEY]: 'route' },
        '',
        this._base + normalized + hash
      );
      this._resolve();
    }
    return this;
  }

  /**
   * Normalize an app-relative path and guard against double base-prefixing.
   * @param {string} path — e.g. '/docs', 'docs', or '/app/docs' when base is '/app'
   * @returns {string} — always starts with '/'
   */
  _normalizePath(path) {
    let p = path && path.startsWith('/') ? path : (path ? `/${path}` : '/');
    // Strip base prefix if caller accidentally included it
    if (this._base) {
      if (p === this._base) return '/';
      if (p.startsWith(this._base + '/')) p = p.slice(this._base.length) || '/';
    }
    return p;
  }

  /**
   * Resolve an app-relative path to a full URL path (including base).
   * Useful for programmatic link generation.
   * @param {string} path
   * @returns {string}
   */
  resolve(path) {
    const normalized = path && path.startsWith('/') ? path : (path ? `/${path}` : '/');
    return this._base + normalized;
  }

  back() { window.history.back(); return this; }
  forward() { window.history.forward(); return this; }
  go(n) { window.history.go(n); return this; }

  // --- Guards --------------------------------------------------------------

  beforeEach(fn) {
    this._guards.before.push(fn);
    return this;
  }

  afterEach(fn) {
    this._guards.after.push(fn);
    return this;
  }

  // --- Events --------------------------------------------------------------

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  // --- Sub-route history substates -----------------------------------------

  /**
   * Push a lightweight history entry for in-component UI state.
   * The URL path does NOT change — only a history entry is added so the
   * back button can undo the UI change (close modal, revert tab, etc.)
   * before navigating away.
   *
   * @param {string} key   — identifier (e.g. 'modal', 'tab', 'panel')
   * @param {*}      data  — arbitrary state (serializable)
   * @returns {Router}
   *
   * @example
   * // Open a modal and push a substate
   * router.pushSubstate('modal', { id: 'confirm-delete' });
   * // User hits back → onSubstate fires → close the modal
   */
  pushSubstate(key, data) {
    this._inSubstate = true;
    if (this._mode === 'hash') {
      // Hash mode: stash the substate in a global — hashchange will check.
      // We still push a history entry via a sentinel hash suffix.
      const current = window.location.hash || '#/';
      window.history.pushState(
        { [_ZQ_STATE_KEY]: 'substate', key, data },
        '',
        window.location.href
      );
    } else {
      window.history.pushState(
        { [_ZQ_STATE_KEY]: 'substate', key, data },
        '',
        window.location.href      // keep same URL
      );
    }
    return this;
  }

  /**
   * Register a listener for substate pops (back button on a substate entry).
   * The callback receives `(key, data)` and should return `true` if it
   * handled the pop (prevents route resolution). If no listener returns
   * `true`, normal route resolution proceeds.
   *
   * @param {(key: string, data: any, action: string) => boolean|void} fn
   * @returns {() => void} unsubscribe function
   *
   * @example
   * const unsub = router.onSubstate((key, data) => {
   *   if (key === 'modal') { closeModal(); return true; }
   * });
   */
  onSubstate(fn) {
    this._substateListeners.push(fn);
    return () => {
      this._substateListeners = this._substateListeners.filter(f => f !== fn);
    };
  }

  /**
   * Fire substate listeners. Returns true if any listener handled it.
   * @private
   */
  _fireSubstate(key, data, action) {
    for (const fn of this._substateListeners) {
      try {
        if (fn(key, data, action) === true) return true;
      } catch (err) {
        reportError(ErrorCode.ROUTER_GUARD, 'onSubstate listener threw', { key, data }, err);
      }
    }
    return false;
  }

  // --- Current state -------------------------------------------------------

  get current() { return this._current; }

  /** The detected or configured base path (read-only) */
  get base() { return this._base; }

  get path() {
    if (this._mode === 'hash') {
      const raw = window.location.hash.slice(1) || '/';
      // If the hash doesn't start with '/', it's an in-page anchor
      // (e.g. #some-heading), not a route.  Treat it as a scroll target
      // and resolve to the last known route (or '/').
      if (raw && !raw.startsWith('/')) {
        window.__zqScrollTarget = raw;
        // Restore the route hash silently so the URL stays valid
        const fallbackPath = (this._current && this._current.path) || '/';
        window.location.replace('#' + fallbackPath);
        return fallbackPath;
      }
      return raw;
    }
    let pathname = window.location.pathname || '/';
    // Strip trailing slash for consistency (except root '/')
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    if (this._base) {
      // Exact match: /app
      if (pathname === this._base) return '/';
      // Prefix match with boundary: /app/page (but NOT /application)
      if (pathname.startsWith(this._base + '/')) {
        return pathname.slice(this._base.length) || '/';
      }
    }
    return pathname;
  }

  get query() {
    const search = this._mode === 'hash'
      ? (window.location.hash.split('?')[1] || '')
      : window.location.search.slice(1);
    return Object.fromEntries(new URLSearchParams(search));
  }

  // --- Internal resolve ----------------------------------------------------

  async _resolve() {
    // Prevent re-entrant calls (e.g. listener triggering navigation)
    if (this._resolving) return;
    this._resolving = true;
    this._redirectCount = 0;
    try {
      await this.__resolve();
    } finally {
      this._resolving = false;
    }
  }

  async __resolve() {
    // Check if we're landing on a substate entry (e.g. page refresh on a
    // substate bookmark, or hash-mode popstate). Fire listeners and bail
    // if handled — the URL hasn't changed so there's no route to resolve.
    const histState = window.history.state;
    if (histState && histState[_ZQ_STATE_KEY] === 'substate') {
      const handled = this._fireSubstate(histState.key, histState.data, 'resolve');
      if (handled) return;
      // No listener handled it — fall through to normal routing
    }

    const fullPath = this.path;
    const [pathPart, queryString] = fullPath.split('?');
    const path = pathPart || '/';
    const query = Object.fromEntries(new URLSearchParams(queryString || ''));

    // Match route
    let matched = null;
    let params = {};
    for (const route of this._routes) {
      const m = path.match(route._regex);
      if (m) {
        matched = route;
        route._keys.forEach((key, i) => { params[key] = m[i + 1]; });
        break;
      }
    }

    // Fallback
    if (!matched && this._fallback) {
      matched = { component: this._fallback, path: '*', _keys: [], _regex: /.*/ };
    }

    if (!matched) return;

    const to = { route: matched, params, query, path };
    const from = this._current;

    // Same-route optimization: if the resolved route is the same component
    // with the same params, skip the full destroy/mount cycle and just
    // update props. This prevents flashing and unnecessary DOM churn.
    if (from && this._instance && matched.component === from.route.component) {
      const sameParams = JSON.stringify(params) === JSON.stringify(from.params);
      const sameQuery = JSON.stringify(query) === JSON.stringify(from.query);
      if (sameParams && sameQuery) {
        // Identical navigation — nothing to do
        return;
      }
    }

    // Run before guards
    for (const guard of this._guards.before) {
      try {
        const result = await guard(to, from);
        if (result === false) return;                    // Cancel
        if (typeof result === 'string') {                // Redirect
          if (++this._redirectCount > 10) {
            reportError(ErrorCode.ROUTER_GUARD, 'Too many guard redirects (possible loop)', { to }, null);
            return;
          }
          // Update URL directly and re-resolve (avoids re-entrancy block)
          const [rPath, rFrag] = result.split('#');
          const rNorm = this._normalizePath(rPath || '/');
          const rHash = rFrag ? '#' + rFrag : '';
          if (this._mode === 'hash') {
            if (rFrag) window.__zqScrollTarget = rFrag;
            window.location.replace('#' + rNorm);
          } else {
            window.history.replaceState(
              { [_ZQ_STATE_KEY]: 'route' },
              '',
              this._base + rNorm + rHash
            );
          }
          return this.__resolve();
        }
      } catch (err) {
        reportError(ErrorCode.ROUTER_GUARD, 'Before-guard threw', { to, from }, err);
        return;
      }
    }

    // Lazy load module if needed
    if (matched.load) {
      try { await matched.load(); }
      catch (err) {
        reportError(ErrorCode.ROUTER_LOAD, `Failed to load module for route "${matched.path}"`, { path: matched.path }, err);
        return;
      }
    }

    this._current = to;

    // Mount component into outlet
    if (this._el && matched.component) {
      // Pre-load external templates/styles so the mount renders synchronously
      // (keeps old content visible during the fetch instead of showing blank)
      if (typeof matched.component === 'string') {
        await prefetch(matched.component);
      }

      // Destroy previous
      if (this._instance) {
        this._instance.destroy();
        this._instance = null;
      }

      // Create container
      const _routeStart = typeof window !== 'undefined' && window.__zqRenderHook ? performance.now() : 0;
      this._el.innerHTML = '';

      // Pass route params and query as props
      const props = { ...params, $route: to, $query: query, $params: params };

      // If component is a string (registered name), mount it
      if (typeof matched.component === 'string') {
        const container = document.createElement(matched.component);
        this._el.appendChild(container);
        this._instance = mount(container, matched.component, props);
        if (_routeStart) window.__zqRenderHook(this._el, performance.now() - _routeStart, 'route', matched.component);
      }
      // If component is a render function
      else if (typeof matched.component === 'function') {
        this._el.innerHTML = matched.component(to);
        if (_routeStart) window.__zqRenderHook(this._el, performance.now() - _routeStart, 'route', to);
      }
    }

    // Run after guards
    for (const guard of this._guards.after) {
      await guard(to, from);
    }

    // Notify listeners
    this._listeners.forEach(fn => fn(to, from));
  }

  // --- Destroy -------------------------------------------------------------

  destroy() {
    if (this._instance) this._instance.destroy();
    this._listeners.clear();
    this._substateListeners = [];
    this._inSubstate = false;
    this._routes = [];
    this._guards = { before: [], after: [] };
  }
}


// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
let _activeRouter = null;

function createRouter(config) {
  _activeRouter = new Router(config);
  return _activeRouter;
}

function getRouter() {
  return _activeRouter;
}

// --- src/store.js ------------------------------------------------
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



class Store {
  constructor(config = {}) {
    this._subscribers = new Map();   // key → Set<fn>
    this._wildcards = new Set();     // subscribe to all changes
    this._actions = config.actions || {};
    this._getters = config.getters || {};
    this._middleware = [];
    this._history = [];              // action log
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

function createStore(name, config) {
  // If called with just config (no name), use 'default'
  if (typeof name === 'object') {
    config = name;
    name = 'default';
  }
  const store = new Store(config);
  _stores.set(name, store);
  return store;
}

function getStore(name = 'default') {
  return _stores.get(name) || null;
}

// --- src/http.js -------------------------------------------------
/**
 * zQuery HTTP — Lightweight fetch wrapper
 * 
 * Clean API for GET/POST/PUT/PATCH/DELETE with:
 *   - Auto JSON serialization/deserialization
 *   - Request/response interceptors
 *   - Timeout support
 *   - Base URL configuration
 *   - Abort controller integration
 * 
 * Usage:
 *   $.http.get('/api/users');
 *   $.http.post('/api/users', { name: 'Tony' });
 *   $.http.configure({ baseURL: 'https://api.example.com', headers: { Authorization: 'Bearer ...' } });
 */

const _config = {
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
};

const _interceptors = {
  request: [],
  response: [],
};


/**
 * Core request function
 */
async function request(method, url, data, options = {}) {
  if (!url || typeof url !== 'string') {
    throw new Error(`HTTP request requires a URL string, got ${typeof url}`);
  }
  let fullURL = url.startsWith('http') ? url : _config.baseURL + url;
  let headers = { ..._config.headers, ...options.headers };
  let body = undefined;

  // Build fetch options
  const fetchOpts = {
    method: method.toUpperCase(),
    headers,
    ...options,
  };

  // Handle body
  if (data !== undefined && method !== 'GET' && method !== 'HEAD') {
    if (data instanceof FormData) {
      body = data;
      delete fetchOpts.headers['Content-Type']; // Let browser set multipart boundary
    } else if (typeof data === 'object') {
      body = JSON.stringify(data);
    } else {
      body = data;
    }
    fetchOpts.body = body;
  }

  // Query params for GET
  if (data && (method === 'GET' || method === 'HEAD') && typeof data === 'object') {
    const params = new URLSearchParams(data).toString();
    fullURL += (fullURL.includes('?') ? '&' : '?') + params;
  }

  // Timeout via AbortController
  const controller = new AbortController();
  fetchOpts.signal = options.signal || controller.signal;
  const timeout = options.timeout ?? _config.timeout;
  let timer;
  if (timeout > 0) {
    timer = setTimeout(() => controller.abort(), timeout);
  }

  // Run request interceptors
  for (const interceptor of _interceptors.request) {
    const result = await interceptor(fetchOpts, fullURL);
    if (result === false) throw new Error('Request blocked by interceptor');
    if (result?.url) fullURL = result.url;
    if (result?.options) Object.assign(fetchOpts, result.options);
  }

  try {
    const response = await fetch(fullURL, fetchOpts);
    if (timer) clearTimeout(timer);

    // Parse response
    const contentType = response.headers.get('Content-Type') || '';
    let responseData;

    try {
      if (contentType.includes('application/json')) {
        responseData = await response.json();
      } else if (contentType.includes('text/')) {
        responseData = await response.text();
      } else if (contentType.includes('application/octet-stream') || contentType.includes('image/')) {
        responseData = await response.blob();
      } else {
        // Try JSON first, fall back to text
        const text = await response.text();
        try { responseData = JSON.parse(text); } catch { responseData = text; }
      }
    } catch (parseErr) {
      responseData = null;
      console.warn(`[zQuery HTTP] Failed to parse response body from ${method} ${fullURL}:`, parseErr.message);
    }

    const result = {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData,
      response,
    };

    // Run response interceptors
    for (const interceptor of _interceptors.response) {
      await interceptor(result);
    }

    if (!response.ok) {
      const err = new Error(`HTTP ${response.status}: ${response.statusText}`);
      err.response = result;
      throw err;
    }

    return result;
  } catch (err) {
    if (timer) clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms: ${method} ${fullURL}`);
    }
    throw err;
  }
}


// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
const http = {
  get:     (url, params, opts)  => request('GET', url, params, opts),
  post:    (url, data, opts)    => request('POST', url, data, opts),
  put:     (url, data, opts)    => request('PUT', url, data, opts),
  patch:   (url, data, opts)    => request('PATCH', url, data, opts),
  delete:  (url, data, opts)    => request('DELETE', url, data, opts),

  /**
   * Configure defaults
   */
  configure(opts) {
    if (opts.baseURL !== undefined) _config.baseURL = opts.baseURL;
    if (opts.headers) Object.assign(_config.headers, opts.headers);
    if (opts.timeout !== undefined) _config.timeout = opts.timeout;
  },

  /**
   * Add request interceptor
   * @param {Function} fn — (fetchOpts, url) → void | false | { url, options }
   */
  onRequest(fn) {
    _interceptors.request.push(fn);
  },

  /**
   * Add response interceptor
   * @param {Function} fn — (result) → void
   */
  onResponse(fn) {
    _interceptors.response.push(fn);
  },

  /**
   * Create a standalone AbortController for manual cancellation
   */
  createAbort() {
    return new AbortController();
  },

  /**
   * Raw fetch pass-through (for edge cases)
   */
  raw: (url, opts) => fetch(url, opts),
};

// --- src/utils.js ------------------------------------------------
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
function debounce(fn, ms = 250) {
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
function throttle(fn, ms = 250) {
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
function pipe(...fns) {
  return (input) => fns.reduce((val, fn) => fn(val), input);
}

/**
 * Once — function that only runs once
 */
function once(fn) {
  let called = false, result;
  return (...args) => {
    if (!called) { called = true; result = fn(...args); }
    return result;
  };
}

/**
 * Sleep — promise-based delay
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// ---------------------------------------------------------------------------
// String utilities
// ---------------------------------------------------------------------------

/**
 * Escape HTML entities
 */
function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(str).replace(/[&<>"']/g, c => map[c]);
}

/**
 * Template tag for auto-escaping interpolated values
 * Usage: $.html`<div>${userInput}</div>`
 */
function html(strings, ...values) {
  return strings.reduce((result, str, i) => {
    const val = values[i - 1];
    const escaped = (val instanceof TrustedHTML) ? val.toString() : escapeHtml(val ?? '');
    return result + escaped + str;
  });
}

/**
 * Mark HTML as trusted (skip escaping in $.html template)
 */
class TrustedHTML {
  constructor(html) { this._html = html; }
  toString() { return this._html; }
}

function trust(htmlStr) {
  return new TrustedHTML(htmlStr);
}

/**
 * Generate UUID v4
 */
function uuid() {
  return crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/**
 * Kebab-case to camelCase
 */
function camelCase(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * CamelCase to kebab-case
 */
function kebabCase(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}


// ---------------------------------------------------------------------------
// Object utilities
// ---------------------------------------------------------------------------

/**
 * Deep clone
 */
function deepClone(obj) {
  if (typeof structuredClone === 'function') return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Deep merge objects
 */
function deepMerge(target, ...sources) {
  for (const source of sources) {
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key] || typeof target[key] !== 'object') target[key] = {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }
  return target;
}

/**
 * Simple object equality check
 */
function isEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null || b === null) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(k => isEqual(a[k], b[k]));
}


// ---------------------------------------------------------------------------
// URL utilities
// ---------------------------------------------------------------------------

/**
 * Serialize object to URL query string
 */
function param(obj) {
  return new URLSearchParams(obj).toString();
}

/**
 * Parse URL query string to object
 */
function parseQuery(str) {
  return Object.fromEntries(new URLSearchParams(str));
}


// ---------------------------------------------------------------------------
// Storage helpers (localStorage wrapper with JSON support)
// ---------------------------------------------------------------------------
const storage = {
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

const session = {
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
class EventBus {
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

const bus = new EventBus();

// --- index.js (assembly) ------------------------------------------
/**
 * ┌---------------------------------------------------------┐
 * │  zQuery (zeroQuery) — Lightweight Frontend Library     │
 * │                                                         │
 * │  jQuery-like selectors · Reactive components            │
 * │  SPA router · State management · Zero dependencies      │
 * │                                                         │
 * │  https://github.com/tonywied17/zero-query              │
 * └---------------------------------------------------------┘
 */











// ---------------------------------------------------------------------------
// $ — The main function & namespace
// ---------------------------------------------------------------------------

/**
 * Main selector function — always returns a ZQueryCollection (like jQuery).
 * 
 *   $('selector')         → ZQueryCollection (querySelectorAll)
 *   $('<div>hello</div>') → ZQueryCollection from created elements
 *   $(element)            → ZQueryCollection wrapping the element
 *   $(fn)                 → DOMContentLoaded shorthand
 * 
 * @param {string|Element|NodeList|Function} selector
 * @param {string|Element} [context]
 * @returns {ZQueryCollection}
 */
function $(selector, context) {
  // $(fn) → DOM ready shorthand
  if (typeof selector === 'function') {
    query.ready(selector);
    return;
  }
  return query(selector, context);
}


// --- Quick refs (DOM selectors) --------------------------------------------
$.id       = query.id;
$.class    = query.class;
$.classes  = query.classes;
$.tag      = query.tag;
Object.defineProperty($, 'name', {
  value: query.name, writable: true, configurable: true
});
$.children = query.children;

// --- Collection selector ---------------------------------------------------
/**
 * Collection selector (like jQuery's $)
 * 
 *   $.all('selector')         → ZQueryCollection (querySelectorAll)
 *   $.all('<div>hello</div>') → create elements as collection
 *   $.all(element)            → wrap element in collection
 *   $.all(nodeList)           → wrap NodeList in collection
 * 
 * @param {string|Element|NodeList|Array} selector
 * @param {string|Element} [context]
 * @returns {ZQueryCollection}
 */
$.all = function(selector, context) {
  return queryAll(selector, context);
};

// --- DOM helpers -----------------------------------------------------------
$.create   = query.create;
$.ready    = query.ready;
$.on       = query.on;
$.off      = query.off;
$.fn       = query.fn;

// --- Reactive primitives ---------------------------------------------------
$.reactive = reactive;
$.Signal   = Signal;
$.signal   = signal;
$.computed = computed;
$.effect   = effect;

// --- Components ------------------------------------------------------------
$.component   = component;
$.mount       = mount;
$.mountAll    = mountAll;
$.getInstance = getInstance;
$.destroy     = destroy;
$.components  = getRegistry;
$.prefetch    = prefetch;
$.style       = style;
$.morph        = morph;
$.morphElement = morphElement;
$.safeEval    = safeEval;

// --- Router ----------------------------------------------------------------
$.router    = createRouter;
$.getRouter = getRouter;

// --- Store -----------------------------------------------------------------
$.store    = createStore;
$.getStore = getStore;

// --- HTTP ------------------------------------------------------------------
$.http   = http;
$.get    = http.get;
$.post   = http.post;
$.put    = http.put;
$.patch  = http.patch;
$.delete = http.delete;

// --- Utilities -------------------------------------------------------------
$.debounce   = debounce;
$.throttle   = throttle;
$.pipe       = pipe;
$.once       = once;
$.sleep      = sleep;
$.escapeHtml = escapeHtml;
$.html       = html;
$.trust      = trust;
$.uuid       = uuid;
$.camelCase  = camelCase;
$.kebabCase  = kebabCase;
$.deepClone  = deepClone;
$.deepMerge  = deepMerge;
$.isEqual    = isEqual;
$.param      = param;
$.parseQuery = parseQuery;
$.storage    = storage;
$.session    = session;
$.bus        = bus;

// --- Error handling --------------------------------------------------------
$.onError        = onError;
$.ZQueryError    = ZQueryError;
$.ErrorCode      = ErrorCode;
$.guardCallback  = guardCallback;
$.validate       = validate;

// --- Meta ------------------------------------------------------------------
$.version = '0.8.7';
$.libSize = '~89 KB';
$.meta    = {};                // populated at build time by CLI bundler

$.noConflict = () => {
  if (typeof window !== 'undefined' && window.$ === $) {
    delete window.$;
  }
  return $;
};


// ---------------------------------------------------------------------------
// Global exposure (browser)
// ---------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  window.$ = $;
  window.zQuery = $;
}


// ---------------------------------------------------------------------------
// Named exports (ES modules)
// ---------------------------------------------------------------------------

$;

})(typeof window !== 'undefined' ? window : globalThis);
