/**
 * zQuery Core — Selector engine & chainable DOM collection
 * 
 * Extends the quick-ref pattern (Id, Class, Classes, Children)
 * into a full jQuery-like chainable wrapper with modern APIs.
 */

// ---------------------------------------------------------------------------
// ZQueryCollection — wraps an array of elements with chainable methods
// ---------------------------------------------------------------------------
export class ZQueryCollection {
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
export function query(selector, context) {
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
export function queryAll(selector, context) {
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
query.name     = (name) => Array.from(document.getElementsByName(name));
query.attr     = (attr, value) => Array.from(
  document.querySelectorAll(value !== undefined ? `[${attr}="${value}"]` : `[${attr}]`)
);
query.data     = (key, value) => Array.from(
  document.querySelectorAll(value !== undefined ? `[data-${key}="${value}"]` : `[data-${key}]`)
);
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

// Global event listeners — supports direct and delegated forms
//   $.on('keydown', handler)           → direct listener on document
//   $.on('click', '.btn', handler)     → delegated via closest()
query.on = (event, selectorOrHandler, handler) => {
  if (typeof selectorOrHandler === 'function') {
    // 2-arg: direct document listener (keydown, resize, etc.)
    document.addEventListener(event, selectorOrHandler);
    return;
  }
  // 3-arg: delegated
  document.addEventListener(event, (e) => {
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
