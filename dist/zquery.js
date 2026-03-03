/**
 * zQuery (zeroQuery) v0.2.0
 * Lightweight Frontend Library
 * https://github.com/tonywied17/zero-query
 * (c) 2026 Anthony Wiedman — MIT License
 */
(function(global) {
  'use strict';

// --- src/reactive.js —————————————————————————————————————————————
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
      onChange(key, value, old);
      return true;
    },

    deleteProperty(obj, key) {
      const old = obj[key];
      delete obj[key];
      onChange(key, undefined, old);
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
    this._subscribers.forEach(fn => fn());
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
 * Create a side-effect that auto-tracks signal dependencies
 * @param {Function} fn — effect function
 * @returns {Function} — dispose function
 */
function effect(fn) {
  const execute = () => {
    Signal._activeEffect = execute;
    try { fn(); }
    finally { Signal._activeEffect = null; }
  };
  execute();
  return () => { /* Signals will hold weak refs if needed */ };
}

// --- src/core.js —————————————————————————————————————————————————
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

  next()  { return new ZQueryCollection(this.elements.map(el => el.nextElementSibling).filter(Boolean)); }
  prev()  { return new ZQueryCollection(this.elements.map(el => el.previousElementSibling).filter(Boolean)); }

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

  // --- Classes -------------------------------------------------------------

  addClass(...names) {
    const classes = names.flatMap(n => n.split(/\s+/));
    return this.each((_, el) => el.classList.add(...classes));
  }

  removeClass(...names) {
    const classes = names.flatMap(n => n.split(/\s+/));
    return this.each((_, el) => el.classList.remove(...classes));
  }

  toggleClass(name, force) {
    return this.each((_, el) => el.classList.toggle(name, force));
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
      return getComputedStyle(this.first())[props];
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

  // --- Content -------------------------------------------------------------

  html(content) {
    if (content === undefined) return this.first()?.innerHTML;
    return this.each((_, el) => { el.innerHTML = content; });
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
    return this.each((_, el) => { el.innerHTML = ''; });
  }

  clone(deep = true) {
    return new ZQueryCollection(this.elements.map(el => el.cloneNode(deep)));
  }

  replaceWith(content) {
    return this.each((_, el) => {
      if (typeof content === 'string') {
        el.insertAdjacentHTML('afterend', content);
        el.remove();
      } else if (content instanceof Node) {
        el.parentNode.replaceChild(content, el);
      }
    });
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
      el.style.display = (el.style.display === 'none' || getComputedStyle(el).display === 'none') ? display : 'none';
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
        } else {
          // Delegated event
          el.addEventListener(evt, (e) => {
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
// $() — main selector / creator function (returns single element for CSS selectors)
// ---------------------------------------------------------------------------
function query(selector, context) {
  // null / undefined
  if (!selector) return null;

  // Already a collection — return first element
  if (selector instanceof ZQueryCollection) return selector.first();

  // DOM element or Window — return as-is
  if (selector instanceof Node || selector === window) {
    return selector;
  }

  // NodeList / HTMLCollection / Array — return first element
  if (selector instanceof NodeList || selector instanceof HTMLCollection || Array.isArray(selector)) {
    const arr = Array.from(selector);
    return arr[0] || null;
  }

  // HTML string → create elements, return first
  if (typeof selector === 'string' && selector.trim().startsWith('<')) {
    const fragment = createFragment(selector);
    const els = [...fragment.childNodes].filter(n => n.nodeType === 1);
    return els[0] || null;
  }

  // CSS selector string → querySelector (single element)
  if (typeof selector === 'string') {
    const root = context
      ? (typeof context === 'string' ? document.querySelector(context) : context)
      : document;
    return root.querySelector(selector);
  }

  return null;
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
query.classes  = (name) => Array.from(document.getElementsByClassName(name));
query.tag      = (name) => Array.from(document.getElementsByTagName(name));
query.children = (parentId) => {
  const p = document.getElementById(parentId);
  return p ? Array.from(p.children) : [];
};

// Create element shorthand
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
  return el;
};

// DOM ready
query.ready = (fn) => {
  if (document.readyState !== 'loading') fn();
  else document.addEventListener('DOMContentLoaded', fn);
};

// Global event delegation
query.on = (event, selector, handler) => {
  document.addEventListener(event, (e) => {
    const target = e.target.closest(selector);
    if (target) handler.call(target, e);
  });
};

// Extend collection prototype (like $.fn in jQuery)
query.fn = ZQueryCollection.prototype;

// --- src/component.js ————————————————————————————————————————————
/**
 * zQuery Component — Lightweight reactive component system
 * 
 * Declarative components using template literals (no JSX, no build step).
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
 *   - Relative path resolution — templateUrl, styleUrl, and pages.dir
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
 * Convert a kebab-case id to Title Case.
 * 'getting-started' → 'Getting Started'
 * @param {string} id
 * @returns {string}
 */
function _titleCase(id) {
  return id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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

    // Refs map
    this.refs = {};

    // Props (read-only from parent)
    this.props = Object.freeze({ ...props });

    // Reactive state
    const initialState = typeof definition.state === 'function'
      ? definition.state()
      : { ...(definition.state || {}) };

    this.state = reactive(initialState, () => {
      if (!this._destroyed) this._scheduleUpdate();
    });

    // Bind all user methods to this instance
    for (const [key, val] of Object.entries(definition)) {
      if (typeof val === 'function' && !_reservedKeys.has(key)) {
        this[key] = val.bind(this);
      }
    }

    // Init lifecycle
    if (definition.init) definition.init.call(this);
  }

  // Schedule a batched DOM update (microtask)
  _scheduleUpdate() {
    if (this._updateQueued) return;
    this._updateQueued = true;
    queueMicrotask(() => {
      this._updateQueued = false;
      if (!this._destroyed) this._render();
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
  // pages config (shorthand for multi-template + route-param page switching):
  //   pages: {
  //     dir:     'pages',             // relative to component file (or base)
  //     param:   'section',           // route param name → this.activePage
  //     default: 'getting-started',   // fallback when param is absent
  //     ext:     '.html',             // file extension (default '.html')
  //     items:   ['page-a', { id: 'page-b', label: 'Page B' }, ...]
  //   }
  //   Exposes this.pages (array of {id,label}), this.activePage (current id)
  //
  async _loadExternals() {
    const def = this._def;
    const base = def._base; // auto-detected or explicit

    // ── Pages config ─────────────────────────────────────────────
    if (def.pages && !def._pagesNormalized) {
      const p = def.pages;
      const ext = p.ext || '.html';
      const dir = _resolveUrl((p.dir || '').replace(/\/+$/, ''), base);

      // Normalize items → [{id, label}, …]
      def._pages = (p.items || []).map(item => {
        if (typeof item === 'string') return { id: item, label: _titleCase(item) };
        return { id: item.id, label: item.label || _titleCase(item.id) };
      });

      // Auto-generate templateUrl object map
      if (!def.templateUrl) {
        def.templateUrl = {};
        for (const { id } of def._pages) {
          def.templateUrl[id] = `${dir}/${id}${ext}`;
        }
      }

      def._pagesNormalized = true;
    }

    // ── External templates ──────────────────────────────────────
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
        // Pages config already resolved; plain objects still need resolving
        const results = await Promise.all(
          entries.map(([, url]) => _fetchResource(def._pagesNormalized ? url : _resolveUrl(url, base)))
        );
        def._externalTemplates = {};
        entries.forEach(([key], i) => { def._externalTemplates[key] = results[i]; });
      }
      def._templateLoaded = true;
    }

    // ── External styles ─────────────────────────────────────────
    if (def.styleUrl && !def._styleLoaded) {
      const su = def.styleUrl;
      if (typeof su === 'string') {
        def._externalStyles = await _fetchResource(_resolveUrl(su, base));
      } else if (Array.isArray(su)) {
        const urls = su.map(u => _resolveUrl(u, base));
        const results = await Promise.all(urls.map(u => _fetchResource(u)));
        def._externalStyles = results.join('\n');
      }
      def._styleLoaded = true;
    }
  }

  // Render the component
  _render() {
    // If externals haven't loaded yet, trigger async load then re-render
    if ((this._def.templateUrl && !this._def._templateLoaded) ||
        (this._def.styleUrl && !this._def._styleLoaded) ||
        (this._def.pages && !this._def._pagesNormalized)) {
      this._loadExternals().then(() => {
        if (!this._destroyed) this._render();
      });
      return; // Skip this render — will re-render after load
    }

    // Expose multi-template map on instance (if available)
    if (this._def._externalTemplates) {
      this.templates = this._def._externalTemplates;
    }

    // Expose pages metadata and active page (derived from route param)
    if (this._def._pages) {
      this.pages = this._def._pages;
      const pc = this._def.pages;
      this.activePage = (pc.param && this.props.$params?.[pc.param]) || pc.default || this._def._pages[0]?.id || '';
    }

    // Determine HTML content
    let html;
    if (this._def.render) {
      // Inline render function takes priority
      html = this._def.render.call(this);
    } else if (this._def._externalTemplate) {
      // External template with {{expression}} interpolation
      html = this._def._externalTemplate.replace(/\{\{(.+?)\}\}/g, (_, expr) => {
        try {
          return new Function('state', 'props', '$', `with(state){return ${expr.trim()}}`)(
            this.state.__raw || this.state,
            this.props,
            typeof window !== 'undefined' ? window.$ : undefined
          );
        } catch { return ''; }
      });
    } else {
      html = '';
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
      const scoped = combinedStyles.replace(/([^{}]+)\{/g, (match, selector) => {
        return selector.split(',').map(s => `[${scopeAttr}] ${s.trim()}`).join(', ') + ' {';
      });
      const styleEl = document.createElement('style');
      styleEl.textContent = scoped;
      styleEl.setAttribute('data-zq-component', this._def._name || '');
      document.head.appendChild(styleEl);
      this._styleEl = styleEl;
    }

    // ── Focus preservation for z-model ────────────────────────────
    // Before replacing innerHTML, save focus state so we can restore
    // cursor position after the DOM is rebuilt.
    let _focusInfo = null;
    const _active = document.activeElement;
    if (_active && this._el.contains(_active)) {
      const modelKey = _active.getAttribute?.('z-model');
      if (modelKey) {
        _focusInfo = {
          key: modelKey,
          start: _active.selectionStart,
          end: _active.selectionEnd,
          dir: _active.selectionDirection,
        };
      }
    }

    // Update DOM
    this._el.innerHTML = html;

    // Process directives
    this._bindEvents();
    this._bindRefs();
    this._bindModels();

    // Restore focus to z-model element after re-render
    if (_focusInfo) {
      const el = this._el.querySelector(`[z-model="${_focusInfo.key}"]`);
      if (el) {
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
      if (this._def.mounted) this._def.mounted.call(this);
    } else {
      if (this._def.updated) this._def.updated.call(this);
    }
  }

  // Bind @event="method" handlers via delegation
  _bindEvents() {
    // Clean up old delegated listeners
    this._listeners.forEach(({ event, handler }) => {
      this._el.removeEventListener(event, handler);
    });
    this._listeners = [];

    // Find all elements with @event attributes
    const allEls = this._el.querySelectorAll('*');
    const eventMap = new Map(); // event → [{ selector, method, modifiers }]

    allEls.forEach(child => {
      [...child.attributes].forEach(attr => {
        if (!attr.name.startsWith('@')) return;

        const raw = attr.name.slice(1); // e.g. "click.prevent"
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
      });
    });

    // Register delegated listeners on the component root
    for (const [event, bindings] of eventMap) {
      const handler = (e) => {
        for (const { selector, methodExpr, modifiers, el } of bindings) {
          if (!e.target.closest(selector)) continue;

          // Handle modifiers
          if (modifiers.includes('prevent')) e.preventDefault();
          if (modifiers.includes('stop')) e.stopPropagation();

          // Parse method expression:  "method"  or  "method(arg1, arg2)"
          const match = methodExpr.match(/^(\w+)(?:\(([^)]*)\))?$/);
          if (match) {
            const methodName = match[1];
            const fn = this[methodName];
            if (typeof fn === 'function') {
              if (match[2] !== undefined) {
                // Parse arguments (supports strings, numbers, state refs)
                const args = match[2].split(',').map(a => {
                  a = a.trim();
                  if (a === '') return undefined;
                  if (a === 'true') return true;
                  if (a === 'false') return false;
                  if (a === 'null') return null;
                  if (/^-?\d+(\.\d+)?$/.test(a)) return Number(a);
                  if ((a.startsWith("'") && a.endsWith("'")) || (a.startsWith('"') && a.endsWith('"'))) return a.slice(1, -1);
                  // State reference
                  if (a.startsWith('state.')) return this.state[a.slice(6)];
                  return a;
                }).filter(a => a !== undefined);
                fn(e, ...args);
              } else {
                fn(e);
              }
            }
          }
        }
      };
      this._el.addEventListener(event, handler);
      this._listeners.push({ event, handler });
    }
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

      // ── Set initial DOM value from state ────────────────────────
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

      // ── Determine event type ────────────────────────────────────
      const event = isLazy || tag === 'select' || type === 'checkbox' || type === 'radio'
        ? 'change'
        : isEditable ? 'input' : 'input';

      // ── Handler: read DOM → write to reactive state ─────────────
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

  // Programmatic state update (batch-friendly)
  setState(partial) {
    Object.assign(this.state, partial);
  }

  // Emit custom event up the DOM
  emit(name, detail) {
    this._el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, cancelable: true }));
  }

  // Destroy this component
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this._def.destroyed) this._def.destroyed.call(this);
    this._listeners.forEach(({ event, handler }) => this._el.removeEventListener(event, handler));
    this._listeners = [];
    if (this._styleEl) this._styleEl.remove();
    _instances.delete(this._el);
    this._el.innerHTML = '';
  }
}


// Reserved definition keys (not user methods)
const _reservedKeys = new Set([
  'state', 'render', 'styles', 'init', 'mounted', 'updated', 'destroyed', 'props',
  'templateUrl', 'styleUrl', 'templates', 'pages', 'activePage', 'base'
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
  if (!name.includes('-')) {
    throw new Error(`zQuery: Component name "${name}" must contain a hyphen (Web Component convention)`);
  }
  definition._name = name;

  // Auto-detect the calling module's URL so that relative templateUrl,
  // styleUrl, and pages.dir paths resolve relative to the component file.
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
  if (!el) throw new Error(`zQuery: Mount target "${target}" not found`);

  const def = _registry.get(componentName);
  if (!def) throw new Error(`zQuery: Component "${componentName}" not registered`);

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
      [...tag.attributes].forEach(attr => {
        if (!attr.name.startsWith('@') && !attr.name.startsWith('z-')) {
          // Try JSON parse for objects/arrays
          try { props[attr.name] = JSON.parse(attr.value); }
          catch { props[attr.name] = attr.value; }
        }
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

// --- src/router.js ———————————————————————————————————————————————
/**
 * zQuery Router — Client-side SPA router
 * 
 * Supports hash mode (#/path) and history mode (/path).
 * Route params, query strings, navigation guards, and lazy loading.
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


class Router {
  constructor(config = {}) {
    this._el = null;
    // Auto-detect: file:// protocol can't use pushState, fall back to hash
    const isFile = typeof location !== 'undefined' && location.protocol === 'file:';
    this._mode = config.mode || (isFile ? 'hash' : 'history');

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
      window.addEventListener('popstate', () => this._resolve());
    }

    // Intercept link clicks for SPA navigation
    document.addEventListener('click', (e) => {
      // Don't intercept modified clicks (Ctrl/Cmd+click = new tab)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target.closest('[z-link]');
      if (!link) return;
      if (link.getAttribute('target') === '_blank') return;
      e.preventDefault();
      this.navigate(link.getAttribute('z-link'));
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
    // When matched via fallback, missing params are undefined → pages `default` kicks in.
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

  navigate(path, options = {}) {
    // Separate hash fragment (e.g. /docs/getting-started#cli-bundler)
    const [cleanPath, fragment] = (path || '').split('#');
    let normalized = this._normalizePath(cleanPath);
    const hash = fragment ? '#' + fragment : '';
    if (this._mode === 'hash') {
      // Hash mode uses the URL hash for routing, so a #fragment can't live
      // in the URL. Store it as a scroll target for the destination component.
      if (fragment) window.__zqScrollTarget = fragment;
      window.location.hash = '#' + normalized;
    } else {
      window.history.pushState(options.state || {}, '', this._base + normalized + hash);
      this._resolve();
    }
    return this;
  }

  replace(path, options = {}) {
    const [cleanPath, fragment] = (path || '').split('#');
    let normalized = this._normalizePath(cleanPath);
    const hash = fragment ? '#' + fragment : '';
    if (this._mode === 'hash') {
      if (fragment) window.__zqScrollTarget = fragment;
      window.location.replace('#' + normalized);
    } else {
      window.history.replaceState(options.state || {}, '', this._base + normalized + hash);
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

    // Run before guards
    for (const guard of this._guards.before) {
      const result = await guard(to, from);
      if (result === false) return;                    // Cancel
      if (typeof result === 'string') {                // Redirect
        return this.navigate(result);
      }
    }

    // Lazy load module if needed
    if (matched.load) {
      try { await matched.load(); }
      catch (err) {
        console.error(`zQuery Router: Failed to load module for "${matched.path}"`, err);
        return;
      }
    }

    this._current = to;

    // Mount component into outlet
    if (this._el && matched.component) {
      // Destroy previous
      if (this._instance) {
        this._instance.destroy();
        this._instance = null;
      }

      // Create container
      this._el.innerHTML = '';

      // Pass route params and query as props
      const props = { ...params, $route: to, $query: query, $params: params };

      // If component is a string (registered name), mount it
      if (typeof matched.component === 'string') {
        const container = document.createElement(matched.component);
        this._el.appendChild(container);
        this._instance = mount(container, matched.component, props);
      }
      // If component is a render function
      else if (typeof matched.component === 'function') {
        this._el.innerHTML = matched.component(to);
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

// --- src/store.js ————————————————————————————————————————————————
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
      if (subs) subs.forEach(fn => fn(value, old, key));
      // Notify wildcard subscribers
      this._wildcards.forEach(fn => fn(key, value, old));
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
      console.warn(`zQuery Store: Unknown action "${name}"`);
      return;
    }

    // Run middleware
    for (const mw of this._middleware) {
      const result = mw(name, args, this.state);
      if (result === false) return; // blocked by middleware
    }

    if (this._debug) {
      console.log(`%c[Store] ${name}`, 'color: #4CAF50; font-weight: bold;', ...args);
    }

    const result = action(this.state, ...args);
    this._history.push({ action: name, args, timestamp: Date.now() });
    return result;
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

// --- src/http.js —————————————————————————————————————————————————
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

// --- src/utils.js ————————————————————————————————————————————————
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

// --- index.js (assembly) ——————————————————————————————————————————
/**
 * ┌─────────────────────────────────────────────────────────┐
 * │  zQuery (zeroQuery) — Lightweight Frontend Library     │
 * │                                                         │
 * │  jQuery-like selectors · Reactive components            │
 * │  SPA router · State management · Zero dependencies      │
 * │                                                         │
 * │  https://github.com/tonywied17/zero-query              │
 * └─────────────────────────────────────────────────────────┘
 */








// ---------------------------------------------------------------------------
// $ — The main function & namespace
// ---------------------------------------------------------------------------

/**
 * Main selector function
 * 
 *   $('selector')         → single Element (querySelector)
 *   $('<div>hello</div>') → create element (first created node)
 *   $(element)            → return element as-is
 *   $(fn)                 → DOMContentLoaded shorthand
 * 
 * @param {string|Element|NodeList|Function} selector
 * @param {string|Element} [context]
 * @returns {Element|null}
 */
function $(selector, context) {
  // $(fn) → DOM ready shorthand
  if (typeof selector === 'function') {
    query.ready(selector);
    return;
  }
  return query(selector, context);
}


// --- Quick refs ------------------------------------------------------------
$.id       = query.id;
$.class    = query.class;
$.classes  = query.classes;
$.tag      = query.tag;
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
$.fn       = query.fn;

// --- Reactive primitives ---------------------------------------------------
$.reactive = reactive;
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
$.style       = style;

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

// --- Meta ------------------------------------------------------------------
$.version = '0.2.0';

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
