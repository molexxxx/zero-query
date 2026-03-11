/**
 * zQuery Core — Selector engine & chainable DOM collection
 * 
 * Extends the quick-ref pattern (Id, Class, Classes, Children)
 * into a full jQuery-like chainable wrapper with modern APIs.
 */

import { morph as _morph, morphElement as _morphElement } from './diff.js';

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
export function query(selector, context) {
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
