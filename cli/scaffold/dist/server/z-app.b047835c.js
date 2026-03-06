/**
 * App bundle — built by zQuery CLI
 * Entry: cli\scaffold\scripts\app.js
 * 2026-03-06T02:56:52.945Z
 */
(function() {
  'use strict';

// --- zquery.min.js (library) ——————————————————————————————————
/**
 * zQuery (zeroQuery) v0.4.8
 * Lightweight Frontend Library
 * https://github.com/tonywied17/zero-query
 * (c) 2026 Anthony Wiedman — MIT License
 */
(function(global) {
'use strict';
function reactive(target, onChange, _path = '') { if (typeof target !== 'object' || target === null) return target; const proxyCache = new WeakMap(); const handler = { get(obj, key) { if (key === '__isReactive') return true; if (key === '__raw') return obj; const value = obj[key]; if (typeof value === 'object' && value !== null) { if (proxyCache.has(value)) return proxyCache.get(value); const childProxy = new Proxy(value, handler); proxyCache.set(value, childProxy); return childProxy; } return value; }, set(obj, key, value) { const old = obj[key]; if (old === value) return true; obj[key] = value; onChange(key, value, old); return true; }, deleteProperty(obj, key) { const old = obj[key]; delete obj[key]; onChange(key, undefined, old); return true; } }; return new Proxy(target, handler);
}
class Signal { constructor(value) { this._value = value; this._subscribers = new Set(); } get value() { if (Signal._activeEffect) { this._subscribers.add(Signal._activeEffect); } return this._value; } set value(newVal) { if (this._value === newVal) return; this._value = newVal; this._notify(); } peek() { return this._value; } _notify() { this._subscribers.forEach(fn => fn()); } subscribe(fn) { this._subscribers.add(fn); return () => this._subscribers.delete(fn); } toString() { return String(this._value); }
}
Signal._activeEffect = null;
function signal(initial) { return new Signal(initial);
}
function computed(fn) { const s = new Signal(undefined); effect(() => { s._value = fn(); s._notify(); }); return s;0.4.8
}
function effect(fn) { const execute = () => { Signal._activeEffect = execute; try { fn(); } finally { Signal._activeEffect = null; } }; execute(); return () => { };
}
class ZQueryCollection { constructor(elements) { this.elements = Array.isArray(elements) ? elements : [elements]; this.length = this.elements.length; this.elements.forEach((el, i) => { this[i] = el; }); } each(fn) { this.elements.forEach((el, i) => fn.call(el, i, el)); return this; } map(fn) { return this.elements.map((el, i) => fn.call(el, i, el)); } first() { return this.elements[0] || null; } last() { return this.elements[this.length - 1] || null; } eq(i) { return new ZQueryCollection(this.elements[i] ? [this.elements[i]] : []); } toArray(){ return [...this.elements]; } [Symbol.iterator]() { return this.elements[Symbol.iterator](); } find(selector) { const found = []; this.elements.forEach(el => found.push(...el.querySelectorAll(selector))); return new ZQueryCollection(found); } parent() { const parents = [...new Set(this.elements.map(el => el.parentElement).filter(Boolean))]; return new ZQueryCollection(parents); } closest(selector) { return new ZQueryCollection( this.elements.map(el => el.closest(selector)).filter(Boolean) ); } children(selector) { const kids = []; this.elements.forEach(el => { kids.push(...(selector ? el.querySelectorAll(`:scope > ${selector}`) : el.children)); }); return new ZQueryCollection([...kids]); } siblings() { const sibs = []; this.elements.forEach(el => { sibs.push(...[...el.parentElement.children].filter(c => c !== el)); }); return new ZQueryCollection(sibs); } next() { return new ZQueryCollection(this.elements.map(el => el.nextElementSibling).filter(Boolean)); } prev() { return new ZQueryCollection(this.elements.map(el => el.previousElementSibling).filter(Boolean)); } filter(selector) { if (typeof selector === 'function') { return new ZQueryCollection(this.elements.filter(selector)); } return new ZQueryCollection(this.elements.filter(el => el.matches(selector))); } not(selector) { if (typeof selector === 'function') { return new ZQueryCollection(this.elements.filter((el, i) => !selector.call(el, i, el))); } return new ZQueryCollection(this.elements.filter(el => !el.matches(selector))); } has(selector) { return new ZQueryCollection(this.elements.filter(el => el.querySelector(selector))); } addClass(...names) { const classes = names.flatMap(n => n.split(/\s+/)); return this.each((_, el) => el.classList.add(...classes)); } removeClass(...names) { const classes = names.flatMap(n => n.split(/\s+/)); return this.each((_, el) => el.classList.remove(...classes)); } toggleClass(name, force) { return this.each((_, el) => el.classList.toggle(name, force)); } hasClass(name) { return this.first()?.classList.contains(name) || false; } attr(name, value) { if (value === undefined) return this.first()?.getAttribute(name); return this.each((_, el) => el.setAttribute(name, value)); } removeAttr(name) { return this.each((_, el) => el.removeAttribute(name)); } prop(name, value) { if (value === undefined) return this.first()?.[name]; return this.each((_, el) => { el[name] = value; }); } data(key, value) { if (value === undefined) { if (key === undefined) return this.first()?.dataset; const raw = this.first()?.dataset[key]; try { return JSON.parse(raw); } catch { return raw; } } return this.each((_, el) => { el.dataset[key] = typeof value === 'object' ? JSON.stringify(value) : value; }); } css(props) { if (typeof props === 'string') { return getComputedStyle(this.first())[props]; } return this.each((_, el) => Object.assign(el.style, props)); } width() { return this.first()?.getBoundingClientRect().width; } height() { return this.first()?.getBoundingClientRect().height; } offset() { const r = this.first()?.getBoundingClientRect(); return r ? { top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height } : null; } position() { const el = this.first(); return el ? { top: el.offsetTop, left: el.offsetLeft } : null; } html(content) { if (content === undefined) return this.first()?.innerHTML; return this.each((_, el) => { el.innerHTML = content; }); } text(content) { if (content === undefined) return this.first()?.textContent; return this.each((_, el) => { el.textContent = content; }); } val(value) { if (value === undefined) return this.first()?.value; return this.each((_, el) => { el.value = value; }); } append(content) { return this.each((_, el) => { if (typeof content === 'string') el.insertAdjacentHTML('beforeend', content); else if (content instanceof ZQueryCollection) content.each((__, c) => el.appendChild(c)); else if (content instanceof Node) el.appendChild(content); }); } prepend(content) { return this.each((_, el) => { if (typeof content === 'string') el.insertAdjacentHTML('afterbegin', content); else if (content instanceof Node) el.insertBefore(content, el.firstChild); }); } after(content) { return this.each((_, el) => { if (typeof content === 'string') el.insertAdjacentHTML('afterend', content); else if (content instanceof Node) el.parentNode.insertBefore(content, el.nextSibling); }); } before(content) { return this.each((_, el) => { if (typeof content === 'string') el.insertAdjacentHTML('beforebegin', content); else if (content instanceof Node) el.parentNode.insertBefore(content, el); }); } wrap(wrapper) { return this.each((_, el) => { const w = typeof wrapper === 'string' ? createFragment(wrapper).firstElementChild : wrapper.cloneNode(true); el.parentNode.insertBefore(w, el); w.appendChild(el); }); } remove() { return this.each((_, el) => el.remove()); } empty() { return this.each((_, el) => { el.innerHTML = ''; }); } clone(deep = true) { return new ZQueryCollection(this.elements.map(el => el.cloneNode(deep))); } replaceWith(content) { return this.each((_, el) => { if (typeof content === 'string') { el.insertAdjacentHTML('afterend', content); el.remove(); } else if (content instanceof Node) { el.parentNode.replaceChild(content, el); } }); } show(display = '') { return this.each((_, el) => { el.style.display = display; }); } hide() { return this.each((_, el) => { el.style.display = 'none'; }); } toggle(display = '') { return this.each((_, el) => { el.style.display = (el.style.display === 'none' || getComputedStyle(el).display === 'none') ? display : 'none'; }); } on(event, selectorOrHandler, handler) { const events = event.split(/\s+/); return this.each((_, el) => { events.forEach(evt => { if (typeof selectorOrHandler === 'function') { el.addEventListener(evt, selectorOrHandler); } else { el.addEventListener(evt, (e) => { const target = e.target.closest(selectorOrHandler); if (target && el.contains(target)) handler.call(target, e); }); } }); }); } off(event, handler) { const events = event.split(/\s+/); return this.each((_, el) => { events.forEach(evt => el.removeEventListener(evt, handler)); }); } one(event, handler) { return this.each((_, el) => { el.addEventListener(event, handler, { once: true }); }); } trigger(event, detail) { return this.each((_, el) => { el.dispatchEvent(new CustomEvent(event, { detail, bubbles: true, cancelable: true })); }); } click(fn) { return fn ? this.on('click', fn) : this.trigger('click'); } submit(fn) { return fn ? this.on('submit', fn) : this.trigger('submit'); } focus() { this.first()?.focus(); return this; } blur() { this.first()?.blur(); return this; } animate(props, duration = 300, easing = 'ease') { return new Promise(resolve => { const count = { done: 0 }; this.each((_, el) => { el.style.transition = `all ${duration}ms ${easing}`; requestAnimationFrame(() => { Object.assign(el.style, props); const onEnd = () => { el.removeEventListener('transitionend', onEnd); el.style.transition = ''; if (++count.done >= this.length) resolve(this); }; el.addEventListener('transitionend', onEnd); }); }); setTimeout(() => resolve(this), duration + 50); }); } fadeIn(duration = 300) { return this.css({ opacity: '0', display: '' }).animate({ opacity: '1' }, duration); } fadeOut(duration = 300) { return this.animate({ opacity: '0' }, duration).then(col => col.hide()); } slideToggle(duration = 300) { return this.each((_, el) => { if (el.style.display === 'none' || getComputedStyle(el).display === 'none') { el.style.display = ''; el.style.overflow = 'hidden'; const h = el.scrollHeight + 'px'; el.style.maxHeight = '0'; el.style.transition = `max-height ${duration}ms ease`; requestAnimationFrame(() => { el.style.maxHeight = h; }); setTimeout(() => { el.style.maxHeight = ''; el.style.overflow = ''; el.style.transition = ''; }, duration); } else { el.style.overflow = 'hidden'; el.style.maxHeight = el.scrollHeight + 'px'; el.style.transition = `max-height ${duration}ms ease`; requestAnimationFrame(() => { el.style.maxHeight = '0'; }); setTimeout(() => { el.style.display = 'none'; el.style.maxHeight = ''; el.style.overflow = ''; el.style.transition = ''; }, duration); } }); } serialize() { const form = this.first(); if (!form || form.tagName !== 'FORM') return ''; return new URLSearchParams(new FormData(form)).toString(); } serializeObject() { const form = this.first(); if (!form || form.tagName !== 'FORM') return {}; const obj = {}; new FormData(form).forEach((v, k) => { if (obj[k] !== undefined) { if (!Array.isArray(obj[k])) obj[k] = [obj[k]]; obj[k].push(v); } else { obj[k] = v; } }); return obj; }
}
function createFragment(html) { const tpl = document.createElement('template'); tpl.innerHTML = html.trim(); return tpl.content;
}
function query(selector, context) { if (!selector) return null; if (selector instanceof ZQueryCollection) return selector.first(); if (selector instanceof Node || selector === window) { return selector; } if (selector instanceof NodeList || selector instanceof HTMLCollection || Array.isArray(selector)) { const arr = Array.from(selector); return arr[0] || null; } if (typeof selector === 'string' && selector.trim().startsWith('<')) { const fragment = createFragment(selector); const els = [...fragment.childNodes].filter(n => n.nodeType === 1); return els[0] || null; } if (typeof selector === 'string') { const root = context ? (typeof context === 'string' ? document.querySelector(context) : context) : document; return root.querySelector(selector); } return null;
}
function queryAll(selector, context) { if (!selector) return new ZQueryCollection([]); if (selector instanceof ZQueryCollection) return selector; if (selector instanceof Node || selector === window) { return new ZQueryCollection([selector]); } if (selector instanceof NodeList || selector instanceof HTMLCollection || Array.isArray(selector)) { return new ZQueryCollection(Array.from(selector)); } if (typeof selector === 'string' && selector.trim().startsWith('<')) { const fragment = createFragment(selector); return new ZQueryCollection([...fragment.childNodes].filter(n => n.nodeType === 1)); } if (typeof selector === 'string') { const root = context ? (typeof context === 'string' ? document.querySelector(context) : context) : document; return new ZQueryCollection([...root.querySelectorAll(selector)]); } return new ZQueryCollection([]);
}
query.id = (id) => document.getElementById(id);
query.class = (name) => document.querySelector(`.${name}`);
query.classes = (name) => Array.from(document.getElementsByClassName(name));
query.tag = (name) => Array.from(document.getElementsByTagName(name));
query.children = (parentId) => { const p = document.getElementById(parentId); return p ? Array.from(p.children) : [];
};
query.create = (tag, attrs = {}, ...children) => { const el = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'class') el.className = v; else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v); else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v); else if (k === 'data' && typeof v === 'object') Object.entries(v).forEach(([dk, dv]) => { el.dataset[dk] = dv; }); else el.setAttribute(k, v); } children.flat().forEach(child => { if (typeof child === 'string') el.appendChild(document.createTextNode(child)); else if (child instanceof Node) el.appendChild(child); }); return el;
};
query.ready = (fn) => { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn);
};
query.on = (event, selectorOrHandler, handler) => { if (typeof selectorOrHandler === 'function') { document.addEventListener(event, selectorOrHandler); return; } document.addEventListener(event, (e) => { const target = e.target.closest(selectorOrHandler); if (target) handler.call(target, e); });
};
query.off = (event, handler) => { document.removeEventListener(event, handler);
};
query.fn = ZQueryCollection.prototype;
const _registry = new Map(); const _instances = new Map(); const _resourceCache = new Map(); let _uid = 0;
if (typeof document !== 'undefined' && !document.querySelector('[data-zq-cloak]')) { const _s = document.createElement('style'); _s.textContent = '[z-cloak]{display:none!important}*,*::before,*::after{-webkit-tap-highlight-color:transparent}'; _s.setAttribute('data-zq-cloak', ''); document.head.appendChild(_s);
}
const _debounceTimers = new WeakMap();
const _throttleTimers = new WeakMap();
function _fetchResource(url) { if (_resourceCache.has(url)) return _resourceCache.get(url); if (typeof window !== 'undefined' && window.__zqInline) { for (const [path, content] of Object.entries(window.__zqInline)) { if (url === path || url.endsWith('/' + path) || url.endsWith('\\' + path)) { const resolved = Promise.resolve(content); _resourceCache.set(url, resolved); return resolved; } } } let resolvedUrl = url; if (typeof url === 'string' && !url.startsWith('/') && !url.includes(':') && !url.startsWith('//')) { try { const baseEl = document.querySelector('base'); const root = baseEl ? baseEl.href : (window.location.origin + '/'); resolvedUrl = new URL(url, root).href; } catch { } } const promise = fetch(resolvedUrl).then(res => { if (!res.ok) throw new Error(`zQuery: Failed to load resource "${url}" (${res.status})`); return res.text(); }); _resourceCache.set(url, promise); return promise;
}
function _titleCase(id) { return id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function _resolveUrl(url, base) { if (!base || !url || typeof url !== 'string') return url; if (url.startsWith('/') || url.includes('://') || url.startsWith('//')) return url; try { if (base.includes('://')) { return new URL(url, base).href; } const baseEl = document.querySelector('base'); const root = baseEl ? baseEl.href : (window.location.origin + '/'); const absBase = new URL(base.endsWith('/') ? base : base + '/', root).href; return new URL(url, absBase).href; } catch { return url; }
}
let _ownScriptUrl;
try { if (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) { _ownScriptUrl = document.currentScript.src.replace(/[?#].*$/, ''); }
} catch { }
function _detectCallerBase() { try { const stack = new Error().stack || ''; const urls = stack.match(/(?:https?|file):\/\/[^\s\)]+/g) || []; for (const raw of urls) { const url = raw.replace(/:\d+:\d+$/, '').replace(/:\d+$/, ''); if (/zquery(\.min)?\.js$/i.test(url)) continue; if (_ownScriptUrl && url.replace(/[?#].*$/, '') === _ownScriptUrl) continue; return url.replace(/\/[^/]*$/, '/'); } } catch { } return undefined;
}
function _getPath(obj, path) { return path.split('.').reduce((o, k) => o?.[k], obj);
}
function _setPath(obj, path, value) { const keys = path.split('.'); const last = keys.pop(); const target = keys.reduce((o, k) => (o && typeof o === 'object') ? o[k] : undefined, obj); if (target && typeof target === 'object') target[last] = value;
}
class Component { constructor(el, definition, props = {}) { this._uid = ++_uid; this._el = el; this._def = definition; this._mounted = false; this._destroyed = false; this._updateQueued = false; this._listeners = []; this.refs = {}; this.props = Object.freeze({ ...props }); const initialState = typeof definition.state === 'function' ? definition.state() : { ...(definition.state || {}) }; this.state = reactive(initialState, () => { if (!this._destroyed) this._scheduleUpdate(); }); for (const [key, val] of Object.entries(definition)) { if (typeof val === 'function' && !_reservedKeys.has(key)) { this[key] = val.bind(this); } } if (definition.init) definition.init.call(this); } _scheduleUpdate() { if (this._updateQueued) return; this._updateQueued = true; queueMicrotask(() => { try { if (!this._destroyed) this._render(); } finally { this._updateQueued = false; } }); } async _loadExternals() { const def = this._def; const base = def._base; if (def.pages && !def._pagesNormalized) { const p = def.pages; const ext = p.ext || '.html'; const dir = _resolveUrl((p.dir || '').replace(/\/+$/, ''), base); def._pages = (p.items || []).map(item => { if (typeof item === 'string') return { id: item, label: _titleCase(item) }; return { id: item.id, label: item.label || _titleCase(item.id) }; }); def._pageUrls = {}; for (const { id } of def._pages) { def._pageUrls[id] = `${dir}/${id}${ext}`; } if (!def._externalTemplates) def._externalTemplates = {}; def._pagesNormalized = true; } if (def.templateUrl && !def._templateLoaded) { const tu = def.templateUrl; if (typeof tu === 'string') { def._externalTemplate = await _fetchResource(_resolveUrl(tu, base)); } else if (Array.isArray(tu)) { const urls = tu.map(u => _resolveUrl(u, base)); const results = await Promise.all(urls.map(u => _fetchResource(u))); def._externalTemplates = {}; results.forEach((html, i) => { def._externalTemplates[i] = html; }); } else if (typeof tu === 'object') { const entries = Object.entries(tu); const results = await Promise.all( entries.map(([, url]) => _fetchResource(def._pagesNormalized ? url : _resolveUrl(url, base))) ); def._externalTemplates = {}; entries.forEach(([key], i) => { def._externalTemplates[key] = results[i]; }); } def._templateLoaded = true; } if (def.styleUrl && !def._styleLoaded) { const su = def.styleUrl; if (typeof su === 'string') { def._externalStyles = await _fetchResource(_resolveUrl(su, base)); } else if (Array.isArray(su)) { const urls = su.map(u => _resolveUrl(u, base)); const results = await Promise.all(urls.map(u => _fetchResource(u))); def._externalStyles = results.join('\n'); } def._styleLoaded = true; } } _render() { if ((this._def.templateUrl && !this._def._templateLoaded) || (this._def.styleUrl && !this._def._styleLoaded) || (this._def.pages && !this._def._pagesNormalized)) { this._loadExternals().then(() => { if (!this._destroyed) this._render(); }); return; } if (this._def._externalTemplates) { this.templates = this._def._externalTemplates; } if (this._def._pages) { this.pages = this._def._pages; const pc = this._def.pages; let active = (pc.param && this.props.$params?.[pc.param]) || pc.default || this._def._pages[0]?.id || ''; if (this._def._pageUrls && !(active in this._def._pageUrls)) { active = pc.default || this._def._pages[0]?.id || ''; } this.activePage = active; if (this._def._pageUrls && !(active in this._def._externalTemplates)) { const url = this._def._pageUrls[active]; if (url) { _fetchResource(url).then(html => { this._def._externalTemplates[active] = html; if (!this._destroyed) this._render(); }); return; } } if (this._def._pageUrls && !this._def._pagesPrefetched) { this._def._pagesPrefetched = true; for (const [id, url] of Object.entries(this._def._pageUrls)) { if (!(id in this._def._externalTemplates)) { _fetchResource(url).then(html => { this._def._externalTemplates[id] = html; }); } } } } let html; if (this._def.render) { html = this._def.render.call(this); html = this._expandZFor(html); } else if (this._def._externalTemplate) { html = this._expandZFor(this._def._externalTemplate); html = html.replace(/\{\{(.+?)\}\}/g, (_, expr) => { try { return new Function('state', 'props', '$', `with(state){return ${expr.trim()}}`)( this.state.__raw || this.state, this.props, typeof window !== 'undefined' ? window.$ : undefined ); } catch { return ''; } }); } else { html = ''; } const combinedStyles = [ this._def.styles || '', this._def._externalStyles || '' ].filter(Boolean).join('\n'); if (!this._mounted && combinedStyles) { const scopeAttr = `z-s${this._uid}`; this._el.setAttribute(scopeAttr, ''); const scoped = combinedStyles.replace(/([^{}]+)\{/g, (match, selector) => { return selector.split(',').map(s => `[${scopeAttr}] ${s.trim()}`).join(', ') + ' {'; }); const styleEl = document.createElement('style'); styleEl.textContent = scoped; styleEl.setAttribute('data-zq-component', this._def._name || ''); document.head.appendChild(styleEl); this._styleEl = styleEl; } let _focusInfo = null; const _active = document.activeElement; if (_active && this._el.contains(_active)) { const modelKey = _active.getAttribute?.('z-model'); const refKey = _active.getAttribute?.('z-ref'); let selector = null; if (modelKey) { selector = `[z-model="${modelKey}"]`; } else if (refKey) { selector = `[z-ref="${refKey}"]`; } else { const tag = _active.tagName.toLowerCase(); if (tag === 'input' || tag === 'textarea' || tag === 'select') { let s = tag; if (_active.type) s += `[type="${_active.type}"]`; if (_active.name) s += `[name="${_active.name}"]`; if (_active.placeholder) s += `[placeholder="${CSS.escape(_active.placeholder)}"]`; selector = s; } } if (selector) { _focusInfo = { selector, start: _active.selectionStart, end: _active.selectionEnd, dir: _active.selectionDirection, }; } } this._el.innerHTML = html; this._processDirectives(); this._bindEvents(); this._bindRefs(); this._bindModels(); if (_focusInfo) { const el = this._el.querySelector(_focusInfo.selector); if (el) { el.focus(); try { if (_focusInfo.start !== null && _focusInfo.start !== undefined) { el.setSelectionRange(_focusInfo.start, _focusInfo.end, _focusInfo.dir); } } catch (_) { } } } mountAll(this._el); if (!this._mounted) { this._mounted = true; if (this._def.mounted) this._def.mounted.call(this); } else { if (this._def.updated) this._def.updated.call(this); } } _bindEvents() { this._listeners.forEach(({ event, handler }) => { this._el.removeEventListener(event, handler); }); this._listeners = []; const allEls = this._el.querySelectorAll('*'); const eventMap = new Map(); allEls.forEach(child => { if (child.closest('[z-pre]')) return; [...child.attributes].forEach(attr => { let raw; if (attr.name.startsWith('@')) { raw = attr.name.slice(1); } else if (attr.name.startsWith('z-on:')) { raw = attr.name.slice(5); } else { return; } const parts = raw.split('.'); const event = parts[0]; const modifiers = parts.slice(1); const methodExpr = attr.value; if (!child.dataset.zqEid) { child.dataset.zqEid = String(++_uid); } const selector = `[data-zq-eid="${child.dataset.zqEid}"]`; if (!eventMap.has(event)) eventMap.set(event, []); eventMap.get(event).push({ selector, methodExpr, modifiers, el: child }); }); }); for (const [event, bindings] of eventMap) { const needsCapture = bindings.some(b => b.modifiers.includes('capture')); const needsPassive = bindings.some(b => b.modifiers.includes('passive')); const listenerOpts = (needsCapture || needsPassive) ? { capture: needsCapture, passive: needsPassive } : false; const handler = (e) => { for (const { selector, methodExpr, modifiers, el } of bindings) { if (!e.target.closest(selector)) continue; if (modifiers.includes('self') && e.target !== el) continue; if (modifiers.includes('prevent')) e.preventDefault(); if (modifiers.includes('stop')) e.stopPropagation(); const invoke = (evt) => { const match = methodExpr.match(/^(\w+)(?:\(([^)]*)\))?$/); if (!match) return; const methodName = match[1]; const fn = this[methodName]; if (typeof fn !== 'function') return; if (match[2] !== undefined) { const args = match[2].split(',').map(a => { a = a.trim(); if (a === '') return undefined; if (a === '$event') return evt; if (a === 'true') return true; if (a === 'false') return false; if (a === 'null') return null; if (/^-?\d+(\.\d+)?$/.test(a)) return Number(a); if ((a.startsWith("'") && a.endsWith("'")) || (a.startsWith('"') && a.endsWith('"'))) return a.slice(1, -1); if (a.startsWith('state.')) return _getPath(this.state, a.slice(6)); return a; }).filter(a => a !== undefined); fn(...args); } else { fn(evt); } }; const debounceIdx = modifiers.indexOf('debounce'); if (debounceIdx !== -1) { const ms = parseInt(modifiers[debounceIdx + 1], 10) || 250; const timers = _debounceTimers.get(el) || {}; clearTimeout(timers[event]); timers[event] = setTimeout(() => invoke(e), ms); _debounceTimers.set(el, timers); continue; } const throttleIdx = modifiers.indexOf('throttle'); if (throttleIdx !== -1) { const ms = parseInt(modifiers[throttleIdx + 1], 10) || 250; const timers = _throttleTimers.get(el) || {}; if (timers[event]) continue; invoke(e); timers[event] = setTimeout(() => { timers[event] = null; }, ms); _throttleTimers.set(el, timers); continue; } if (modifiers.includes('once')) { if (el.dataset.zqOnce === event) continue; el.dataset.zqOnce = event; } invoke(e); } }; this._el.addEventListener(event, handler, listenerOpts); this._listeners.push({ event, handler }); } } _bindRefs() { this.refs = {}; this._el.querySelectorAll('[z-ref]').forEach(el => { this.refs[el.getAttribute('z-ref')] = el; }); } _bindModels() { this._el.querySelectorAll('[z-model]').forEach(el => { const key = el.getAttribute('z-model'); const tag = el.tagName.toLowerCase(); const type = (el.type || '').toLowerCase(); const isEditable = el.hasAttribute('contenteditable'); const isLazy = el.hasAttribute('z-lazy'); const isTrim = el.hasAttribute('z-trim'); const isNum = el.hasAttribute('z-number'); const currentVal = _getPath(this.state, key); if (tag === 'input' && type === 'checkbox') { el.checked = !!currentVal; } else if (tag === 'input' && type === 'radio') { el.checked = el.value === String(currentVal); } else if (tag === 'select' && el.multiple) { const vals = Array.isArray(currentVal) ? currentVal.map(String) : []; [...el.options].forEach(opt => { opt.selected = vals.includes(opt.value); }); } else if (isEditable) { if (el.textContent !== String(currentVal ?? '')) { el.textContent = currentVal ?? ''; } } else { el.value = currentVal ?? ''; } const event = isLazy || tag === 'select' || type === 'checkbox' || type === 'radio' ? 'change' : isEditable ? 'input' : 'input'; const handler = () => { let val; if (type === 'checkbox') val = el.checked; else if (tag === 'select' && el.multiple) val = [...el.selectedOptions].map(o => o.value); else if (isEditable) val = el.textContent; else val = el.value; if (isTrim && typeof val === 'string') val = val.trim(); if (isNum || type === 'number' || type === 'range') val = Number(val); _setPath(this.state, key, val); }; el.addEventListener(event, handler); }); } _evalExpr(expr) { try { return new Function('state', 'props', 'refs', '$', `with(state){return (${expr})}`)( this.state.__raw || this.state, this.props, this.refs, typeof window !== 'undefined' ? window.$ : undefined ); } catch { return undefined; } } _expandZFor(html) { if (!html.includes('z-for')) return html; const temp = document.createElement('div'); temp.innerHTML = html; const _recurse = (root) => { let forEls = [...root.querySelectorAll('[z-for]')] .filter(el => !el.querySelector('[z-for]')); if (!forEls.length) return; for (const el of forEls) { if (!el.parentNode) continue; const expr = el.getAttribute('z-for'); const m = expr.match( /^\s*(?:\(\s*(\w+)(?:\s*,\s*(\w+))?\s*\)|(\w+))\s+in\s+(.+)\s*$/ ); if (!m) { el.removeAttribute('z-for'); continue; } const itemVar = m[1] || m[3]; const indexVar = m[2] || '$index'; const listExpr = m[4].trim(); let list = this._evalExpr(listExpr); if (list == null) { el.remove(); continue; } if (typeof list === 'number') { list = Array.from({ length: list }, (_, i) => i + 1); } if (!Array.isArray(list) && typeof list === 'object' && typeof list[Symbol.iterator] !== 'function') { list = Object.entries(list).map(([k, v]) => ({ key: k, value: v })); } if (!Array.isArray(list) && typeof list[Symbol.iterator] === 'function') { list = [...list]; } if (!Array.isArray(list)) { el.remove(); continue; } const parent = el.parentNode; const tplEl = el.cloneNode(true); tplEl.removeAttribute('z-for'); const tplOuter = tplEl.outerHTML; const fragment = document.createDocumentFragment(); const evalReplace = (str, item, index) => str.replace(/\{\{(.+?)\}\}/g, (_, inner) => { try { return new Function(itemVar, indexVar, 'state', 'props', '$', `with(state){return (${inner.trim()})}`)( item, index, this.state.__raw || this.state, this.props, typeof window !== 'undefined' ? window.$ : undefined ); } catch { return ''; } }); for (let i = 0; i < list.length; i++) { const processed = evalReplace(tplOuter, list[i], i); const wrapper = document.createElement('div'); wrapper.innerHTML = processed; while (wrapper.firstChild) fragment.appendChild(wrapper.firstChild); } parent.replaceChild(fragment, el); } if (root.querySelector('[z-for]')) _recurse(root); }; _recurse(temp); return temp.innerHTML; } _processDirectives() { const ifEls = [...this._el.querySelectorAll('[z-if]')]; for (const el of ifEls) { if (!el.parentNode || el.closest('[z-pre]')) continue; const show = !!this._evalExpr(el.getAttribute('z-if')); const chain = [{ el, show }]; let sib = el.nextElementSibling; while (sib) { if (sib.hasAttribute('z-else-if')) { chain.push({ el: sib, show: !!this._evalExpr(sib.getAttribute('z-else-if')) }); sib = sib.nextElementSibling; } else if (sib.hasAttribute('z-else')) { chain.push({ el: sib, show: true }); break; } else { break; } } let found = false; for (const item of chain) { if (!found && item.show) { found = true; item.el.removeAttribute('z-if'); item.el.removeAttribute('z-else-if'); item.el.removeAttribute('z-else'); } else { item.el.remove(); } } } this._el.querySelectorAll('[z-show]').forEach(el => { if (el.closest('[z-pre]')) return; const show = !!this._evalExpr(el.getAttribute('z-show')); el.style.display = show ? '' : 'none'; el.removeAttribute('z-show'); }); this._el.querySelectorAll('*').forEach(el => { if (el.closest('[z-pre]')) return; [...el.attributes].forEach(attr => { let attrName; if (attr.name.startsWith('z-bind:')) attrName = attr.name.slice(7); else if (attr.name.startsWith(':') && !attr.name.startsWith('::')) attrName = attr.name.slice(1); else return; const val = this._evalExpr(attr.value); el.removeAttribute(attr.name); if (val === false || val === null || val === undefined) { el.removeAttribute(attrName); } else if (val === true) { el.setAttribute(attrName, ''); } else { el.setAttribute(attrName, String(val)); } }); }); this._el.querySelectorAll('[z-class]').forEach(el => { if (el.closest('[z-pre]')) return; const val = this._evalExpr(el.getAttribute('z-class')); if (typeof val === 'string') { val.split(/\s+/).filter(Boolean).forEach(c => el.classList.add(c)); } else if (Array.isArray(val)) { val.filter(Boolean).forEach(c => el.classList.add(String(c))); } else if (val && typeof val === 'object') { for (const [cls, active] of Object.entries(val)) { el.classList.toggle(cls, !!active); } } el.removeAttribute('z-class'); }); this._el.querySelectorAll('[z-style]').forEach(el => { if (el.closest('[z-pre]')) return; const val = this._evalExpr(el.getAttribute('z-style')); if (typeof val === 'string') { el.style.cssText += ';' + val; } else if (val && typeof val === 'object') { for (const [prop, v] of Object.entries(val)) { el.style[prop] = v; } } el.removeAttribute('z-style'); }); this._el.querySelectorAll('[z-html]').forEach(el => { if (el.closest('[z-pre]')) return; const val = this._evalExpr(el.getAttribute('z-html')); el.innerHTML = val != null ? String(val) : ''; el.removeAttribute('z-html'); }); this._el.querySelectorAll('[z-text]').forEach(el => { if (el.closest('[z-pre]')) return; const val = this._evalExpr(el.getAttribute('z-text')); el.textContent = val != null ? String(val) : ''; el.removeAttribute('z-text'); }); this._el.querySelectorAll('[z-cloak]').forEach(el => { el.removeAttribute('z-cloak'); }); } setState(partial) { if (partial && Object.keys(partial).length > 0) { Object.assign(this.state, partial); } else { this._scheduleUpdate(); } } emit(name, detail) { this._el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, cancelable: true })); } destroy() { if (this._destroyed) return; this._destroyed = true; if (this._def.destroyed) this._def.destroyed.call(this); this._listeners.forEach(({ event, handler }) => this._el.removeEventListener(event, handler)); this._listeners = []; if (this._styleEl) this._styleEl.remove(); _instances.delete(this._el); this._el.innerHTML = ''; }
}
const _reservedKeys = new Set([ 'state', 'render', 'styles', 'init', 'mounted', 'updated', 'destroyed', 'props', 'templateUrl', 'styleUrl', 'templates', 'pages', 'activePage', 'base'
]);
function component(name, definition) { if (!name.includes('-')) { throw new Error(`zQuery: Component name "${name}" must contain a hyphen (Web Component convention)`); } definition._name = name; if (definition.base !== undefined) { definition._base = definition.base; } else { definition._base = _detectCallerBase(); } _registry.set(name, definition);
}
function mount(target, componentName, props = {}) { const el = typeof target === 'string' ? document.querySelector(target) : target; if (!el) throw new Error(`zQuery: Mount target "${target}" not found`); const def = _registry.get(componentName); if (!def) throw new Error(`zQuery: Component "${componentName}" not registered`); if (_instances.has(el)) _instances.get(el).destroy(); const instance = new Component(el, def, props); _instances.set(el, instance); instance._render(); return instance;
}
function mountAll(root = document.body) { for (const [name, def] of _registry) { const tags = root.querySelectorAll(name); tags.forEach(tag => { if (_instances.has(tag)) return; const props = {}; [...tag.attributes].forEach(attr => { if (!attr.name.startsWith('@') && !attr.name.startsWith('z-')) { try { props[attr.name] = JSON.parse(attr.value); } catch { props[attr.name] = attr.value; } } }); const instance = new Component(tag, def, props); _instances.set(tag, instance); instance._render(); }); }
}
function getInstance(target) { const el = typeof target === 'string' ? document.querySelector(target) : target; return _instances.get(el) || null;
}
function destroy(target) { const el = typeof target === 'string' ? document.querySelector(target) : target; const inst = _instances.get(el); if (inst) inst.destroy();
}
function getRegistry() { return Object.fromEntries(_registry);
}
const _globalStyles = new Map(); function style(urls, opts = {}) { const callerBase = _detectCallerBase(); const list = Array.isArray(urls) ? urls : [urls]; const elements = []; const loadPromises = []; let _criticalStyle = null; if (opts.critical !== false) { _criticalStyle = document.createElement('style'); _criticalStyle.setAttribute('data-zq-critical', ''); _criticalStyle.textContent = `html{visibility:hidden!important;background:${opts.bg || '#0d1117'}}`; document.head.insertBefore(_criticalStyle, document.head.firstChild); } for (let url of list) { if (typeof url === 'string' && !url.startsWith('/') && !url.includes(':') && !url.startsWith('//')) { url = _resolveUrl(url, callerBase); } if (_globalStyles.has(url)) { elements.push(_globalStyles.get(url)); continue; } const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = url; link.setAttribute('data-zq-style', ''); const p = new Promise(resolve => { link.onload = resolve; link.onerror = resolve; }); loadPromises.push(p); document.head.appendChild(link); _globalStyles.set(url, link); elements.push(link); } const ready = Promise.all(loadPromises).then(() => { if (_criticalStyle) { _criticalStyle.remove(); } }); return { ready, remove() { for (const el of elements) { el.remove(); for (const [k, v] of _globalStyles) { if (v === el) { _globalStyles.delete(k); break; } } } } };
}
class Router { constructor(config = {}) { this._el = null; const isFile = typeof location !== 'undefined' && location.protocol === 'file:'; this._mode = isFile ? 'hash' : (config.mode || 'history'); let rawBase = config.base; if (rawBase == null) { rawBase = (typeof window !== 'undefined' && window.__ZQ_BASE) || ''; if (!rawBase && typeof document !== 'undefined') { const baseEl = document.querySelector('base'); if (baseEl) { try { rawBase = new URL(baseEl.href).pathname; } catch { rawBase = baseEl.getAttribute('href') || ''; } if (rawBase === '/') rawBase = ''; } } } this._base = String(rawBase).replace(/\/+$/, ''); if (this._base && !this._base.startsWith('/')) this._base = '/' + this._base; this._routes = []; this._fallback = config.fallback || null; this._current = null; this._guards = { before: [], after: [] }; this._listeners = new Set(); this._instance = null; this._resolving = false; if (config.el) { this._el = typeof config.el === 'string' ? document.querySelector(config.el) : config.el; } if (config.routes) { config.routes.forEach(r => this.add(r)); } if (this._mode === 'hash') { window.addEventListener('hashchange', () => this._resolve()); } else { window.addEventListener('popstate', () => this._resolve()); } document.addEventListener('click', (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; const link = e.target.closest('[z-link]'); if (!link) return; if (link.getAttribute('target') === '_blank') return; e.preventDefault(); this.navigate(link.getAttribute('z-link')); }); if (this._el) { queueMicrotask(() => this._resolve()); } } add(route) { const keys = []; const pattern = route.path .replace(/:(\w+)/g, (_, key) => { keys.push(key); return '([^/]+)'; }) .replace(/\*/g, '(.*)'); const regex = new RegExp(`^${pattern}$`); this._routes.push({ ...route, _regex: regex, _keys: keys }); if (route.fallback) { const fbKeys = []; const fbPattern = route.fallback .replace(/:(\w+)/g, (_, key) => { fbKeys.push(key); return '([^/]+)'; }) .replace(/\*/g, '(.*)'); const fbRegex = new RegExp(`^${fbPattern}$`); this._routes.push({ ...route, path: route.fallback, _regex: fbRegex, _keys: fbKeys }); } return this; } remove(path) { this._routes = this._routes.filter(r => r.path !== path); return this; } navigate(path, options = {}) { const [cleanPath, fragment] = (path || '').split('#'); let normalized = this._normalizePath(cleanPath); const hash = fragment ? '#' + fragment : ''; if (this._mode === 'hash') { if (fragment) window.__zqScrollTarget = fragment; window.location.hash = '#' + normalized; } else { window.history.pushState(options.state || {}, '', this._base + normalized + hash); this._resolve(); } return this; } replace(path, options = {}) { const [cleanPath, fragment] = (path || '').split('#'); let normalized = this._normalizePath(cleanPath); const hash = fragment ? '#' + fragment : ''; if (this._mode === 'hash') { if (fragment) window.__zqScrollTarget = fragment; window.location.replace('#' + normalized); } else { window.history.replaceState(options.state || {}, '', this._base + normalized + hash); this._resolve(); } return this; } _normalizePath(path) { let p = path && path.startsWith('/') ? path : (path ? `/${path}` : '/'); if (this._base) { if (p === this._base) return '/'; if (p.startsWith(this._base + '/')) p = p.slice(this._base.length) || '/'; } return p; } resolve(path) { const normalized = path && path.startsWith('/') ? path : (path ? `/${path}` : '/'); return this._base + normalized; } back() { window.history.back(); return this; } forward() { window.history.forward(); return this; } go(n) { window.history.go(n); return this; } beforeEach(fn) { this._guards.before.push(fn); return this; } afterEach(fn) { this._guards.after.push(fn); return this; } onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); } get current() { return this._current; } get base() { return this._base; } get path() { if (this._mode === 'hash') { const raw = window.location.hash.slice(1) || '/'; if (raw && !raw.startsWith('/')) { window.__zqScrollTarget = raw; const fallbackPath = (this._current && this._current.path) || '/'; window.location.replace('#' + fallbackPath); return fallbackPath; } return raw; } let pathname = window.location.pathname || '/'; if (pathname.length > 1 && pathname.endsWith('/')) { pathname = pathname.slice(0, -1); } if (this._base) { if (pathname === this._base) return '/'; if (pathname.startsWith(this._base + '/')) { return pathname.slice(this._base.length) || '/'; } } return pathname; } get query() { const search = this._mode === 'hash' ? (window.location.hash.split('?')[1] || '') : window.location.search.slice(1); return Object.fromEntries(new URLSearchParams(search)); } async _resolve() { if (this._resolving) return; this._resolving = true; try { await this.__resolve(); } finally { this._resolving = false; } } async __resolve() { const fullPath = this.path; const [pathPart, queryString] = fullPath.split('?'); const path = pathPart || '/'; const query = Object.fromEntries(new URLSearchParams(queryString || '')); let matched = null; let params = {}; for (const route of this._routes) { const m = path.match(route._regex); if (m) { matched = route; route._keys.forEach((key, i) => { params[key] = m[i + 1]; }); break; } } if (!matched && this._fallback) { matched = { component: this._fallback, path: '*', _keys: [], _regex: /.*/ }; } if (!matched) return; const to = { route: matched, params, query, path }; const from = this._current; for (const guard of this._guards.before) { const result = await guard(to, from); if (result === false) return; if (typeof result === 'string') { return this.navigate(result); } } if (matched.load) { try { await matched.load(); } catch (err) { console.error(`zQuery Router: Failed to load module for "${matched.path}"`, err); return; } } this._current = to; if (this._el && matched.component) { if (this._instance) { this._instance.destroy(); this._instance = null; } this._el.innerHTML = ''; const props = { ...params, $route: to, $query: query, $params: params }; if (typeof matched.component === 'string') { const container = document.createElement(matched.component); this._el.appendChild(container); this._instance = mount(container, matched.component, props); } else if (typeof matched.component === 'function') { this._el.innerHTML = matched.component(to); } } for (const guard of this._guards.after) { await guard(to, from); } this._listeners.forEach(fn => fn(to, from)); } destroy() { if (this._instance) this._instance.destroy(); this._listeners.clear(); this._routes = []; this._guards = { before: [], after: [] }; }
}
let _activeRouter = null;
function createRouter(config) { _activeRouter = new Router(config); return _activeRouter;
}
function getRouter() { return _activeRouter;
}
class Store { constructor(config = {}) { this._subscribers = new Map(); this._wildcards = new Set(); this._actions = config.actions || {}; this._getters = config.getters || {}; this._middleware = []; this._history = []; this._debug = config.debug || false; const initial = typeof config.state === 'function' ? config.state() : { ...(config.state || {}) }; this.state = reactive(initial, (key, value, old) => { const subs = this._subscribers.get(key); if (subs) subs.forEach(fn => fn(value, old, key)); this._wildcards.forEach(fn => fn(key, value, old)); }); this.getters = {}; for (const [name, fn] of Object.entries(this._getters)) { Object.defineProperty(this.getters, name, { get: () => fn(this.state.__raw || this.state), enumerable: true }); } } dispatch(name, ...args) { const action = this._actions[name]; if (!action) { console.warn(`zQuery Store: Unknown action "${name}"`); return; } for (const mw of this._middleware) { const result = mw(name, args, this.state); if (result === false) return; } if (this._debug) { console.log(`%c[Store] ${name}`, 'color: #4CAF50; font-weight: bold;', ...args); } const result = action(this.state, ...args); this._history.push({ action: name, args, timestamp: Date.now() }); return result; } subscribe(keyOrFn, fn) { if (typeof keyOrFn === 'function') { this._wildcards.add(keyOrFn); return () => this._wildcards.delete(keyOrFn); } if (!this._subscribers.has(keyOrFn)) { this._subscribers.set(keyOrFn, new Set()); } this._subscribers.get(keyOrFn).add(fn); return () => this._subscribers.get(keyOrFn)?.delete(fn); } snapshot() { return JSON.parse(JSON.stringify(this.state.__raw || this.state)); } replaceState(newState) { const raw = this.state.__raw || this.state; for (const key of Object.keys(raw)) { delete this.state[key]; } Object.assign(this.state, newState); } use(fn) { this._middleware.push(fn); return this; } get history() { return [...this._history]; } reset(initialState) { this.replaceState(initialState); this._history = []; }
}
let _stores = new Map();
function createStore(name, config) { if (typeof name === 'object') { config = name; name = 'default'; } const store = new Store(config); _stores.set(name, store); return store;
}
function getStore(name = 'default') { return _stores.get(name) || null;
}
const _config = { baseURL: '', headers: { 'Content-Type': 'application/json' }, timeout: 30000,
};
const _interceptors = { request: [], response: [],
};
async function request(method, url, data, options = {}) { let fullURL = url.startsWith('http') ? url : _config.baseURL + url; let headers = { ..._config.headers, ...options.headers }; let body = undefined; const fetchOpts = { method: method.toUpperCase(), headers, ...options, }; if (data !== undefined && method !== 'GET' && method !== 'HEAD') { if (data instanceof FormData) { body = data; delete fetchOpts.headers['Content-Type']; } else if (typeof data === 'object') { body = JSON.stringify(data); } else { body = data; } fetchOpts.body = body; } if (data && (method === 'GET' || method === 'HEAD') && typeof data === 'object') { const params = new URLSearchParams(data).toString(); fullURL += (fullURL.includes('?') ? '&' : '?') + params; } const controller = new AbortController(); fetchOpts.signal = options.signal || controller.signal; const timeout = options.timeout ?? _config.timeout; let timer; if (timeout > 0) { timer = setTimeout(() => controller.abort(), timeout); } for (const interceptor of _interceptors.request) { const result = await interceptor(fetchOpts, fullURL); if (result === false) throw new Error('Request blocked by interceptor'); if (result?.url) fullURL = result.url; if (result?.options) Object.assign(fetchOpts, result.options); } try { const response = await fetch(fullURL, fetchOpts); if (timer) clearTimeout(timer); const contentType = response.headers.get('Content-Type') || ''; let responseData; if (contentType.includes('application/json')) { responseData = await response.json(); } else if (contentType.includes('text/')) { responseData = await response.text(); } else if (contentType.includes('application/octet-stream') || contentType.includes('image/')) { responseData = await response.blob(); } else { const text = await response.text(); try { responseData = JSON.parse(text); } catch { responseData = text; } } const result = { ok: response.ok, status: response.status, statusText: response.statusText, headers: Object.fromEntries(response.headers.entries()), data: responseData, response, }; for (const interceptor of _interceptors.response) { await interceptor(result); } if (!response.ok) { const err = new Error(`HTTP ${response.status}: ${response.statusText}`); err.response = result; throw err; } return result; } catch (err) { if (timer) clearTimeout(timer); if (err.name === 'AbortError') { throw new Error(`Request timeout after ${timeout}ms: ${method} ${fullURL}`); } throw err; }
}
const http = { get: (url, params, opts) => request('GET', url, params, opts), post: (url, data, opts) => request('POST', url, data, opts), put: (url, data, opts) => request('PUT', url, data, opts), patch: (url, data, opts) => request('PATCH', url, data, opts), delete: (url, data, opts) => request('DELETE', url, data, opts), configure(opts) { if (opts.baseURL !== undefined) _config.baseURL = opts.baseURL; if (opts.headers) Object.assign(_config.headers, opts.headers); if (opts.timeout !== undefined) _config.timeout = opts.timeout; }, onRequest(fn) { _interceptors.request.push(fn); }, onResponse(fn) { _interceptors.response.push(fn); }, createAbort() { return new AbortController(); }, raw: (url, opts) => fetch(url, opts),
};
function debounce(fn, ms = 250) { let timer; const debounced = (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); }; debounced.cancel = () => clearTimeout(timer); return debounced;
}
function throttle(fn, ms = 250) { let last = 0; let timer; return (...args) => { const now = Date.now(); const remaining = ms - (now - last); clearTimeout(timer); if (remaining <= 0) { last = now; fn(...args); } else { timer = setTimeout(() => { last = Date.now(); fn(...args); }, remaining); } };
}
function pipe(...fns) { return (input) => fns.reduce((val, fn) => fn(val), input);
}
function once(fn) { let called = false, result; return (...args) => { if (!called) { called = true; result = fn(...args); } return result; };
}
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms));
}
function escapeHtml(str) { const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }; return String(str).replace(/[&<>"']/g, c => map[c]);
}
function html(strings, ...values) { return strings.reduce((result, str, i) => { const val = values[i - 1]; const escaped = (val instanceof TrustedHTML) ? val.toString() : escapeHtml(val ?? ''); return result + escaped + str; });
}
class TrustedHTML { constructor(html) { this._html = html; } toString() { return this._html; }
}
function trust(htmlStr) { return new TrustedHTML(htmlStr);
}
function uuid() { return crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
}
function camelCase(str) { return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
function kebabCase(str) { return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}
function deepClone(obj) { if (typeof structuredClone === 'function') return structuredClone(obj); return JSON.parse(JSON.stringify(obj));
}
function deepMerge(target, ...sources) { for (const source of sources) { for (const key of Object.keys(source)) { if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) { if (!target[key] || typeof target[key] !== 'object') target[key] = {}; deepMerge(target[key], source[key]); } else { target[key] = source[key]; } } } return target;
}
function isEqual(a, b) { if (a === b) return true; if (typeof a !== typeof b) return false; if (typeof a !== 'object' || a === null || b === null) return false; const keysA = Object.keys(a); const keysB = Object.keys(b); if (keysA.length !== keysB.length) return false; return keysA.every(k => isEqual(a[k], b[k]));
}
function param(obj) { return new URLSearchParams(obj).toString();
}
function parseQuery(str) { return Object.fromEntries(new URLSearchParams(str));
}
const storage = { get(key, fallback = null) { try { const raw = localStorage.getItem(key); return raw !== null ? JSON.parse(raw) : fallback; } catch { return fallback; } }, set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }, remove(key) { localStorage.removeItem(key); }, clear() { localStorage.clear(); },
};
const session = { get(key, fallback = null) { try { const raw = sessionStorage.getItem(key); return raw !== null ? JSON.parse(raw) : fallback; } catch { return fallback; } }, set(key, value) { sessionStorage.setItem(key, JSON.stringify(value)); }, remove(key) { sessionStorage.removeItem(key); }, clear() { sessionStorage.clear(); },
};
class EventBus { constructor() { this._handlers = new Map(); } on(event, fn) { if (!this._handlers.has(event)) this._handlers.set(event, new Set()); this._handlers.get(event).add(fn); return () => this.off(event, fn); } off(event, fn) { this._handlers.get(event)?.delete(fn); } emit(event, ...args) { this._handlers.get(event)?.forEach(fn => fn(...args)); } once(event, fn) { const wrapper = (...args) => { fn(...args); this.off(event, wrapper); }; return this.on(event, wrapper); } clear() { this._handlers.clear(); }
}
const bus = new EventBus();
function $(selector, context) { if (typeof selector === 'function') { query.ready(selector); return; } return query(selector, context);
}
$.id = query.id;
$.class = query.class;
$.classes = query.classes;
$.tag = query.tag;
$.children = query.children;
$.all = function(selector, context) { return queryAll(selector, context);
};
$.create = query.create;
$.ready = query.ready;
$.on = query.on;
$.off = query.off;
$.fn = query.fn;
$.reactive = reactive;
$.signal = signal;
$.computed = computed;
$.effect = effect;
$.component = component;
$.mount = mount;
$.mountAll = mountAll;
$.getInstance = getInstance;
$.destroy = destroy;
$.components = getRegistry;
$.style = style;
$.router = createRouter;
$.getRouter = getRouter;
$.store = createStore;
$.getStore = getStore;
$.http = http;
$.get = http.get;
$.post = http.post;
$.put = http.put;
$.patch = http.patch;
$.delete = http.delete;
$.debounce = debounce;
$.throttle = throttle;
$.pipe = pipe;
$.once = once;
$.sleep = sleep;
$.escapeHtml = escapeHtml;
$.html = html;
$.trust = trust;
$.uuid = uuid;
$.camelCase = camelCase;
$.kebabCase = kebabCase;
$.deepClone = deepClone;
$.deepMerge = deepMerge;
$.isEqual = isEqual;
$.param = param;
$.parseQuery = parseQuery;
$.storage = storage;
$.session = session;
$.bus = bus;
$.version = '0.4.6';
$.meta = {}; $.noConflict = () => { if (typeof window !== 'undefined' && window.$ === $) { delete window.$; } return $;
};
if (typeof window !== 'undefined') { window.$ = $; window.zQuery = $;
}
$;
})(typeof window !== 'undefined' ? window : globalThis);

// --- Build-time metadata ————————————————————————————
if(typeof $!=="undefined"){$.meta=Object.assign($.meta||{},{libSize:55390});}

// --- Inlined resources (file:// support) ————————————————————
window.__zqInline = {
  'cli/scaffold/scripts/components/contacts/contacts.css': '/* contacts.css — scoped styles for contacts-page component\n *\n * Loaded via styleUrl — these styles are automatically scoped\n * to the contacts-page component by zQuery.\n */\n\n/* -- Toolbar -- */\n.contacts-toolbar-row {\n  display: flex;\n  gap: 0.75rem;\n  align-items: center;\n  justify-content: space-between;\n}\n\n/* -- Add Form -- */\n.contacts-form {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 0.75rem;\n  margin-top: 1rem;\n  padding-top: 1rem;\n  border-top: 1px solid var(--border);\n}\n\n.form-field {\n  display: flex;\n  flex-direction: column;\n  gap: 0.25rem;\n}\n\n.form-field-full {\n  grid-column: 1 / -1;\n}\n\n.form-field .input {\n  width: 100%;\n}\n\n.field-error {\n  color: var(--danger);\n  font-size: 0.78rem;\n  min-height: 0;\n}\n\n.contacts-form .btn {\n  grid-column: 1 / -1;\n  justify-self: start;\n}\n\n/* -- Count -- */\n.contacts-count {\n  font-size: 0.85rem;\n  color: var(--text-muted);\n}\n\n/* -- List -- */\n.contacts-list {\n  list-style: none;\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n}\n\n.contacts-item {\n  display: flex;\n  align-items: center;\n  gap: 0.75rem;\n  padding: 0.7rem 0.85rem;\n  border-radius: var(--radius);\n  cursor: pointer;\n  transition: all 0.15s ease;\n  border: 1px solid transparent;\n}\n\n.contacts-item:hover {\n  background: var(--bg-hover);\n}\n\n.contacts-item.selected {\n  background: var(--accent-soft);\n  border-color: var(--accent);\n}\n\n.contacts-item.is-favorite {\n  border-left: 3px solid var(--accent);\n}\n\n/* -- Status dot -- */\n.status-dot {\n  width: 10px;\n  height: 10px;\n  border-radius: 50%;\n  flex-shrink: 0;\n  background: var(--text-muted);\n}\n\n.status-online  { background: var(--success); }\n.status-away    { background: var(--info); }\n.status-offline { background: var(--text-muted); }\n\n/* -- Contact info -- */\n.contacts-info {\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n  min-width: 0;\n}\n\n.contacts-info strong {\n  font-size: 0.9rem;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.contacts-info small {\n  font-size: 0.8rem;\n  color: var(--text-muted);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n/* -- Role badge -- */\n.role-badge {\n  font-size: 0.75rem;\n  font-weight: 600;\n  padding: 0.2rem 0.55rem;\n  border-radius: 99px;\n  text-transform: uppercase;\n  letter-spacing: 0.03em;\n  white-space: nowrap;\n}\n\n.role-developer {\n  background: rgba(96, 165, 250, 0.15);\n  color: #60a5fa;\n}\n\n.role-designer {\n  background: rgba(168, 85, 247, 0.15);\n  color: #a855f7;\n}\n\n.role-manager {\n  background: rgba(52, 211, 153, 0.15);\n  color: #34d399;\n}\n\n.role-qa {\n  background: rgba(251, 191, 36, 0.15);\n  color: #fbbf24;\n}\n\n/* -- Favorite button -- */\n.fav-btn {\n  background: none;\n  border: none;\n  font-size: 1.2rem;\n  cursor: pointer;\n  color: var(--text-muted);\n  padding: 0.2rem;\n  transition: all 0.15s ease;\n  line-height: 1;\n}\n\n.fav-btn:hover {\n  transform: scale(1.2);\n}\n\n.fav-btn.is-fav {\n  color: var(--accent);\n}\n\n/* -- Detail panel -- */\n.contact-detail {\n  border-left: 3px solid var(--accent);\n  animation: slide-in 0.2s ease;\n}\n\n.detail-header {\n  display: flex;\n  justify-content: space-between;\n  align-items: flex-start;\n  gap: 1rem;\n  flex-wrap: wrap;\n}\n\n.detail-header h3 {\n  font-size: 1.1rem;\n  margin-bottom: 0.15rem;\n}\n\n.detail-header .muted {\n  font-size: 0.85rem;\n  color: var(--text-muted);\n}\n\n.detail-actions {\n  display: flex;\n  gap: 0.5rem;\n  align-items: center;\n  flex-wrap: wrap;\n}\n\n/* -- Confirm group -- */\n.confirm-group {\n  display: inline-flex;\n  align-items: center;\n  gap: 0.35rem;\n}\n\n.confirm-text {\n  font-size: 0.82rem;\n  color: var(--danger);\n  font-weight: 500;\n}\n\n@keyframes slide-in {\n  from { opacity: 0; transform: translateY(-6px); }\n  to   { opacity: 1; transform: translateY(0); }\n}\n}\n\n/* -- Animation -- */\n@keyframes slide-in {\n  from { opacity: 0; transform: translateY(-6px); }\n  to   { opacity: 1; transform: translateY(0); }\n}\n\n/* -- Responsive -- */\n@media (max-width: 768px) {\n  .contacts-toolbar-row {\n    flex-direction: column;\n  }\n\n  .contacts-form {\n    grid-template-columns: 1fr;\n  }\n\n  .contacts-item {\n    flex-wrap: wrap;\n  }\n\n  .role-badge {\n    order: 10;\n    margin-left: calc(10px + 0.75rem);\n  }\n\n  .detail-header {\n    flex-direction: column;\n  }\n}\n',
  'cli/scaffold/scripts/components/contacts/contacts.html': '<!--\n  contacts.html — external template for contacts-page component\n\n  This template is fetched via templateUrl and uses {{expression}} syntax\n  for data binding. All zQuery directives work here: z-if, z-else,\n  z-for, z-show, z-bind, z-class, z-style, z-text, z-model, z-ref,\n  z-cloak, @click, @submit.prevent, etc.\n\n  Expressions have access to `state` and `props` automatically.\n  Inside z-for loops, use {{item.prop}} for per-item values.\n-->\n<div class="page-header" z-cloak>\n  <h1>Contacts</h1>\n  <p class="subtitle">\n    External template &amp; styles via <code>templateUrl</code> / <code>styleUrl</code>.\n    Directives: <code>z-if</code>, <code>z-for</code>, <code>z-show</code>,\n    <code>z-bind</code>, <code>z-class</code>, <code>z-model</code>, and more.\n  </p>\n</div>\n\n<!-- Toolbar: add button -->\n<div class="card contacts-toolbar">\n  <div class="contacts-toolbar-row">\n    <span class="contacts-count" z-if="contacts.length > 0">\n      <strong z-text="contacts.length"></strong> contacts\n      · <strong z-text="favoriteCount"></strong> ★ favorited\n      <span z-show="totalAdded > 0"> · <span z-text="totalAdded"></span> added this session</span>\n    </span>\n    <span class="contacts-count" z-else>No contacts yet</span>\n    <button class="btn btn-primary" @click="toggleForm">\n      <span z-if="showForm">✕ Cancel</span>\n      <span z-else>+ Add Contact</span>\n    </button>\n  </div>\n\n  <!-- Add contact form — toggled via z-show -->\n  <form class="contacts-form" z-show="showForm" @submit.prevent="addContact">\n    <div class="form-field form-field-full">\n      <input\n        type="text"\n        z-model="newName"\n        z-trim\n        placeholder="Full name"\n        class="input"\n        @blur="validateName"\n      />\n      <small class="field-error" z-show="nameError" z-text="nameError"></small>\n    </div>\n    <div class="form-field">\n      <input\n        type="email"\n        z-model="newEmail"\n        z-trim\n        placeholder="Email address"\n        class="input"\n        @blur="validateEmail"\n      />\n      <small class="field-error" z-show="emailError" z-text="emailError"></small>\n    </div>\n    <select z-model="newRole" class="input">\n      <option value="Developer">Developer</option>\n      <option value="Designer">Designer</option>\n      <option value="Manager">Manager</option>\n      <option value="QA">QA</option>\n    </select>\n    <button type="submit" class="btn btn-primary">Save Contact</button>\n  </form>\n</div>\n\n<!-- Contact count -->\n<div class="card" z-if="contacts.length > 0">\n  <!-- Contacts list — z-for renders each item -->\n  <ul class="contacts-list">\n    <li\n      z-for="contact in contacts"\n      class="contacts-item {{contact.id === selectedId ? \'selected\' : \'\'}} {{contact.favorite ? \'is-favorite\' : \'\'}}"\n      @click="selectContact({{contact.id}})"\n    >\n      <!-- Status indicator — class set per status -->\n      <span\n        class="status-dot status-{{contact.status}}"\n        title="{{contact.status}}"\n      ></span>\n\n      <!-- Contact info -->\n      <div class="contacts-info">\n        <strong>{{contact.name}}</strong>\n        <small>{{contact.email}}</small>\n      </div>\n\n      <!-- Role badge -->\n      <span class="role-badge role-{{contact.role.toLowerCase()}}">{{contact.role}}</span>\n\n      <!-- Favorite toggle — .stop modifier prevents row click -->\n      <button\n        class="fav-btn {{contact.favorite ? \'is-fav\' : \'\'}}"\n        @click.stop="toggleFavorite({{contact.id}})"\n      >{{contact.favorite ? \'★\' : \'☆\'}}</button>\n    </li>\n  </ul>\n</div>\n\n<!-- Empty state -->\n<div class="card" z-else>\n  <div class="empty-state">\n    <p>No contacts yet — add one above!</p>\n  </div>\n</div>\n\n<!-- Selected contact detail panel — z-if conditional rendering -->\n<div class="card contact-detail" z-if="selectedId !== null">\n  <div class="detail-header">\n    <div>\n      <h3 z-text="contacts.find(c => c.id === selectedId)?.name || \'\'"></h3>\n      <p class="muted" z-text="contacts.find(c => c.id === selectedId)?.email || \'\'"></p>\n    </div>\n    <div class="detail-actions">\n      <button\n        class="btn btn-outline btn-sm"\n        @click="cycleStatus({{selectedId}})"\n      >\n        Status: <span z-text="contacts.find(c => c.id === selectedId)?.status || \'\'"></span>\n      </button>\n\n      <!-- Confirm delete pattern using z-if / z-else -->\n      <button\n        class="btn btn-danger btn-sm"\n        z-if="confirmDeleteId !== selectedId"\n        @click.stop="confirmDelete({{selectedId}})"\n      >Delete</button>\n\n      <span z-else class="confirm-group">\n        <span class="confirm-text">Sure?</span>\n        <button class="btn btn-danger btn-sm" @click.stop="deleteContact({{selectedId}})">Yes</button>\n        <button class="btn btn-ghost btn-sm" @click.stop="cancelDelete">No</button>\n      </span>\n    </div>\n  </div>\n</div>\n'
};

// --- cli\scaffold\scripts\routes.js ——————————————————————————————
// scripts/routes.js — route definitions
//
// Each route maps a URL path to a component tag name.
// Supports: static paths, :params, wildcards, and lazy loading via `load`.

const routes = [
  { path: '/',         component: 'home-page'     },
  { path: '/counter',  component: 'counter-page'  },
  { path: '/todos',    component: 'todos-page'    },
  { path: '/contacts', component: 'contacts-page' },
  { path: '/api',      component: 'api-demo'      },
  { path: '/about',    component: 'about-page'    },
];

// --- cli\scaffold\scripts\store.js ———————————————————————————————
// scripts/store.js — global state management
//
// $.store() creates a centralized store with state, actions, and getters.
// Components can dispatch actions and subscribe to changes.
// The store is accessible anywhere via $.getStore('main').

const store = $.store('main', {
  state: {
    todos: [],
    visits: 0,

    // Contacts
    contacts: [
      { id: 1, name: 'Alice Johnson',  email: 'alice@example.com',  role: 'Designer',  status: 'online',  favorite: true  },
      { id: 2, name: 'Bob Martinez',   email: 'bob@example.com',    role: 'Developer', status: 'offline', favorite: false },
      { id: 3, name: 'Carol White',    email: 'carol@example.com',  role: 'Manager',   status: 'online',  favorite: true  },
      { id: 4, name: 'Dave Kim',       email: 'dave@example.com',   role: 'Designer',  status: 'away',    favorite: false },
      { id: 5, name: 'Eve Torres',     email: 'eve@example.com',    role: 'Developer', status: 'online',  favorite: false },
    ],
    contactsAdded: 0,
  },

  actions: {
    // Increment the global visit counter
    incrementVisits(state) {
      state.visits++;
    },

    // Add a new todo item using $.uuid() for unique IDs
    addTodo(state, text) {
      state.todos.push({
        id: $.uuid(),
        text: text.trim(),
        done: false,
        createdAt: Date.now(),
      });
    },

    // Toggle a todo's completion status
    toggleTodo(state, id) {
      const todo = state.todos.find(t => t.id === id);
      if (todo) todo.done = !todo.done;
    },

    // Remove a todo by ID
    removeTodo(state, id) {
      state.todos = state.todos.filter(t => t.id !== id);
    },

    // Clear all completed todos
    clearCompleted(state) {
      state.todos = state.todos.filter(t => !t.done);
    },

    // -- Contact actions --

    addContact(state, { name, email, role }) {
      state.contacts.push({
        id:       Date.now(),
        name,
        email,
        role,
        status:   'offline',
        favorite: false,
      });
      state.contactsAdded++;
    },

    deleteContact(state, id) {
      state.contacts = state.contacts.filter(c => c.id !== id);
    },

    toggleFavorite(state, id) {
      const c = state.contacts.find(c => c.id === id);
      if (c) c.favorite = !c.favorite;
    },

    cycleContactStatus(state, id) {
      const c = state.contacts.find(c => c.id === id);
      if (!c) return;
      const order = ['online', 'away', 'offline'];
      c.status = order[(order.indexOf(c.status) + 1) % 3];
    },
  },

  getters: {
    todoCount:    (state) => state.todos.length,
    doneCount:    (state) => state.todos.filter(t => t.done).length,
    pendingCount: (state) => state.todos.filter(t => !t.done).length,

    contactCount:    (state) => state.contacts.length,
    favoriteCount:   (state) => state.contacts.filter(c => c.favorite).length,
  },

  debug: true,  // logs dispatches to console in development
});

// --- cli\scaffold\scripts\components\home.js —————————————————————
// scripts/components/home.js — dashboard / landing page
//
// Demonstrates: $.component, state, render, mounted lifecycle,
//               signal + computed + effect (reactive primitives),
//               $.store integration, $.bus, template rendering

$.component('home-page', {
  state: () => ({
    greeting: '',
    signalDemo: 0,
  }),

  mounted() {
    // $.signal() — fine-grained reactive primitive
    const count = $.signal(0);

    // $.computed() — derived reactive value that auto-updates
    const doubled = $.computed(() => count.value * 2);

    // $.effect() — runs whenever its dependencies change
    $.effect(() => {
      this.state.signalDemo = doubled.value;
    });

    // Store the signal setter so the button can use it
    this._signalCount = count;

    // Greet based on time of day
    const hour = new Date().getHours();
    this.state.greeting = hour < 12 ? 'Good morning'
                        : hour < 18 ? 'Good afternoon'
                        : 'Good evening';

    // Track page visit via the global store
    const store = $.getStore('main');
    store.dispatch('incrementVisits');
  },

  incrementSignal() {
    if (this._signalCount) {
      this._signalCount.value++;
    }
  },

  render() {
    const store = $.getStore('main');
    return `
      <div class="page-header">
        <h1>${this.state.greeting} 👋</h1>
        <p class="subtitle">Welcome to your new <strong>zQuery</strong> app. Explore the pages to see different features in action.</p>
      </div>

      <div class="card-grid">
        <div class="card card-accent">
          <h3>⚡ Reactive Signals</h3>
          <p>Fine-grained reactivity with <code>signal()</code>, <code>computed()</code>, and <code>effect()</code>.</p>
          <div class="signal-demo">
            <span class="signal-value">Doubled: ${this.state.signalDemo}</span>
            <button class="btn btn-sm" @click="incrementSignal">Increment Signal</button>
          </div>
        </div>

        <div class="card">
          <h3>🔢 Counter</h3>
          <p>Component state, two-way binding with <code>z-model</code>, and event handling.</p>
          <a z-link="/counter" class="btn btn-outline">Try It →</a>
        </div>

        <div class="card">
          <h3>✅ Todos</h3>
          <p>Global store with actions & getters. <strong>${store.getters.todoCount}</strong> items, <strong>${store.getters.doneCount}</strong> done.</p>
          <a z-link="/todos" class="btn btn-outline">Try It →</a>
        </div>

        <div class="card">
          <h3>📇 Contacts</h3>
          <p>External templates &amp; styles via <code>templateUrl</code> / <code>styleUrl</code>. <strong>${store.getters.contactCount}</strong> contacts, <strong>${store.getters.favoriteCount}</strong> ★ favorited.</p>
          <a z-link="/contacts" class="btn btn-outline">Try It →</a>
        </div>

        <div class="card">
          <h3>🌐 API Demo</h3>
          <p>Fetch data with <code>$.get()</code>, loading states, and <code>$.escapeHtml()</code>.</p>
          <a z-link="/api" class="btn btn-outline">Try It →</a>
        </div>
      </div>

      <div class="card card-muted">
        <h3>📊 App Stats</h3>
        <div class="stats-grid">
          <div class="stat-group">
            <span class="stat-group-title">🏠 General</span>
            <div class="stat-group-values">
              <div class="stat">
                <span class="stat-value">${store.state.visits}</span>
                <span class="stat-label">Page Views</span>
              </div>
            </div>
          </div>

          <div class="stat-group">
            <span class="stat-group-title">✅ Todos</span>
            <div class="stat-group-values">
              <div class="stat">
                <span class="stat-value">${store.getters.todoCount}</span>
                <span class="stat-label">Total</span>
              </div>
              <div class="stat">
                <span class="stat-value">${store.getters.pendingCount}</span>
                <span class="stat-label">Pending</span>
              </div>
              <div class="stat">
                <span class="stat-value">${store.getters.doneCount}</span>
                <span class="stat-label">Done</span>
              </div>
            </div>
          </div>

          <div class="stat-group">
            <span class="stat-group-title">📇 Contacts</span>
            <div class="stat-group-values">
              <div class="stat">
                <span class="stat-value">${store.getters.contactCount}</span>
                <span class="stat-label">Total</span>
              </div>
              <div class="stat">
                <span class="stat-value">${store.getters.favoriteCount}</span>
                <span class="stat-label">★ Favorited</span>
              </div>
            </div>
          </div>
        </div>
        <small class="muted">Stats powered by <code>$.store()</code> getters — visit count tracked globally.</small>
      </div>
    `;
  }
});

// --- cli\scaffold\scripts\components\counter.js ——————————————————
// scripts/components/counter.js — interactive counter
//
// Demonstrates: component state, instance methods, @click event binding,
//               z-model two-way binding with z-number modifier, z-class,
//               z-if, z-for, $.bus toast notifications

$.component('counter-page', {
  state: () => ({
    count: 0,
    step: 1,
    history: [],
  }),

  increment() {
    this.state.count += this.state.step;
    this.state.history.push({ action: '+', value: this.state.step, result: this.state.count });
    if (this.state.history.length > 8) this.state.history.shift();
  },

  decrement() {
    this.state.count -= this.state.step;
    this.state.history.push({ action: '−', value: this.state.step, result: this.state.count });
    if (this.state.history.length > 8) this.state.history.shift();
  },

  reset() {
    this.state.count = 0;
    this.state.history = [];
    $.bus.emit('toast', { message: 'Counter reset!', type: 'info' });
  },

  render() {
    return `
      <div class="page-header">
        <h1>Counter</h1>
        <p class="subtitle">Component state, <code>@click</code> handlers, <code>z-model</code>, <code>z-class</code>, and <code>z-for</code>.</p>
      </div>

      <div class="card counter-card">
        <div class="counter-display">
          <span class="counter-value" z-class="{'negative': count < 0}">${this.state.count}</span>
        </div>

        <div class="counter-controls">
          <button class="btn btn-danger" @click="decrement">− Subtract</button>
          <button class="btn btn-primary" @click="increment">+ Add</button>
        </div>

        <div class="counter-step">
          <label>Step size:
            <input type="number" z-model="step" z-number min="1" max="100" class="input input-sm" />
          </label>
          <button class="btn btn-ghost btn-sm" @click="reset">Reset</button>
        </div>
      </div>

      <div class="card card-muted" z-if="history.length > 0">
        <h3>History</h3>
        <div class="history-list">
          <span z-for="e in history" class="history-item">{{e.action}}{{e.value}} → <strong>{{e.result}}</strong></span>
        </div>
      </div>
    `;
  }
});

// --- cli\scaffold\scripts\components\todos.js ————————————————————
// scripts/components/todos.js — todo list with global store
//
// Demonstrates: $.getStore, store.dispatch, store.subscribe,
//               store getters, z-model, z-ref, z-class, z-for,
//               z-if, z-show, @click with args, @submit.prevent,
//               mounted/destroyed lifecycle, $.bus toast, $.debounce

$.component('todos-page', {
  state: () => ({
    newTodo: '',
    filter: 'all',      // 'all' | 'active' | 'done'
    search: '',
    filtered: [],        // computed in render() for z-for access
    total: 0,
    done: 0,
    pending: 0,
  }),

  mounted() {
    const store = $.getStore('main');
    this._unsub = store.subscribe(() => this.setState({}));

    // $.debounce — debounced search filter (300ms)
    this._debouncedSearch = $.debounce((val) => {
      this.state.search = val;
    }, 300);
  },

  destroyed() {
    if (this._unsub) this._unsub();
  },

  addTodo() {
    const text = this.state.newTodo.trim();
    if (!text) return;
    $.getStore('main').dispatch('addTodo', text);
    this.state.newTodo = '';
    this.state.search = '';
    this.state.filter = 'all';
    $.bus.emit('toast', { message: 'Todo added!', type: 'success' });
  },

  toggleTodo(id) {
    $.getStore('main').dispatch('toggleTodo', id);
  },

  removeTodo(id) {
    $.getStore('main').dispatch('removeTodo', id);
    $.bus.emit('toast', { message: 'Todo removed', type: 'error' });
  },

  clearCompleted() {
    $.getStore('main').dispatch('clearCompleted');
    $.bus.emit('toast', { message: 'Completed todos cleared', type: 'info' });
  },

  setFilter(f) {
    this.state.filter = f;
  },

  onSearch(e) {
    this._debouncedSearch(e.target.value);
  },

  render() {
    const store = $.getStore('main');
    const todos = store.state.todos;
    const { filter, search } = this.state;

    // Compute filtered list and store stats into state for directive access
    let list = todos;
    if (filter === 'active') list = todos.filter(t => !t.done);
    if (filter === 'done')   list = todos.filter(t => t.done);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t => t.text.toLowerCase().includes(q));
    }
    this.state.filtered = list;
    this.state.total    = store.getters.todoCount;
    this.state.done     = store.getters.doneCount;
    this.state.pending  = store.getters.pendingCount;

    return `
      <div class="page-header">
        <h1>Todos</h1>
        <p class="subtitle">Global store with <code>$.store()</code>, <code>z-for</code>, <code>z-class</code>, <code>z-if</code>, and <code>z-show</code>.</p>
      </div>

      <div class="card">
        <form class="todo-form" @submit.prevent="addTodo">
          <input
            type="text"
            z-model="newTodo" z-trim
            placeholder="What needs to be done?"
            class="input"
            z-ref="todoInput"
          />
          <button type="submit" class="btn btn-primary">Add</button>
        </form>
      </div>

      <div class="card">
        <div class="todo-toolbar">
          <div class="todo-filters">
            <button class="btn btn-sm" z-class="{'btn-primary': filter === 'all', 'btn-ghost': filter !== 'all'}" @click="setFilter('all')">All (${this.state.total})</button>
            <button class="btn btn-sm" z-class="{'btn-primary': filter === 'active', 'btn-ghost': filter !== 'active'}" @click="setFilter('active')">Active (${this.state.pending})</button>
            <button class="btn btn-sm" z-class="{'btn-primary': filter === 'done', 'btn-ghost': filter !== 'done'}" @click="setFilter('done')">Done (${this.state.done})</button>
          </div>
          <input type="text" placeholder="Search…" class="input input-sm" @input="onSearch" value="${$.escapeHtml(this.state.search)}" />
        </div>

        <div z-if="filtered.length === 0" class="empty-state">
          <p>${this.state.total === 0 ? 'No todos yet — add one above!' : 'No matching todos.'}</p>
        </div>

        <ul z-else class="todo-list">
          <li z-for="t in filtered" class="todo-item {{t.done ? 'done' : ''}}">
            <button class="todo-check" @click="toggleTodo('{{t.id}}')"></button>
            <span class="todo-text">{{$.escapeHtml(t.text)}}</span>
            <button class="todo-remove" @click="removeTodo('{{t.id}}')">✕</button>
          </li>
        </ul>

        <div class="todo-footer" z-show="done > 0">
          <button class="btn btn-ghost btn-sm" @click="clearCompleted">Clear completed (${this.state.done})</button>
        </div>
      </div>
    `;
  }
});

// --- cli\scaffold\scripts\components\api-demo.js —————————————————
// scripts/components/api-demo.js — HTTP client demonstration
//
// Demonstrates: $.get() for fetching JSON, z-if/z-else conditional
//               rendering, z-show visibility, z-for list rendering,
//               z-text content binding, @click event handling,
//               loading/error states, $.escapeHtml(), async patterns

$.component('api-demo', {
  state: () => ({
    users: [],
    selectedUser: null,
    posts: [],
    loading: false,
    error: '',
  }),

  mounted() {
    this.fetchUsers();
  },

  async fetchUsers() {
    this.state.loading = true;
    this.state.error = '';
    try {
      // $.get() — zero-config JSON fetching
      const res = await $.get('https://jsonplaceholder.typicode.com/users');
      this.state.users = res.data.slice(0, 6);
    } catch (err) {
      this.state.error = 'Failed to load users. Check your connection.';
    }
    this.state.loading = false;
  },

  async selectUser(id) {
    this.state.selectedUser = this.state.users.find(u => u.id === Number(id));
    this.state.loading = true;
    try {
      const res = await $.get(`https://jsonplaceholder.typicode.com/posts?userId=${id}`);
      this.state.posts = res.data.slice(0, 4);
    } catch (err) {
      this.state.error = 'Failed to load posts.';
    }
    this.state.loading = false;
    $.bus.emit('toast', { message: `Loaded posts for ${this.state.selectedUser.name}`, type: 'success' });
  },

  clearSelection() {
    this.state.selectedUser = null;
    this.state.posts = [];
  },

  render() {
    const { selectedUser } = this.state;

    return `
      <div class="page-header">
        <h1>API Demo</h1>
        <p class="subtitle">Fetching data with <code>$.get()</code>. Directives: <code>z-if</code>, <code>z-show</code>, <code>z-for</code>, <code>z-text</code>.</p>
      </div>

      <div class="card card-error" z-show="error"><p>⚠ <span z-text="error"></span></p></div>
      <div class="loading-bar" z-show="loading"></div>

      <div z-if="!selectedUser">
        <div class="card">
          <h3>Users</h3>
          <p class="muted">Click a user to fetch their posts.</p>
          <div class="user-grid" z-if="users.length > 0">
            <button z-for="u in users" class="user-card" @click="selectUser({{u.id}})">
              <strong>{{u.name}}</strong>
              <small>@{{u.username}}</small>
              <small class="muted">{{u.company.name}}</small>
            </button>
          </div>
          <p z-else z-show="!loading">No users loaded.</p>
        </div>
      </div>

      <div z-else>
        <div class="card">
          <div class="user-detail-header">
            <div>
              <h3>${selectedUser ? $.escapeHtml(selectedUser.name) : ''}</h3>
              <p class="muted">${selectedUser ? `@${$.escapeHtml(selectedUser.username)} · ${$.escapeHtml(selectedUser.email)}` : ''}</p>
            </div>
            <button class="btn btn-ghost btn-sm" @click="clearSelection">← Back</button>
          </div>
        </div>

        <div class="card">
          <h3>Recent Posts</h3>
          <div class="posts-list" z-if="posts.length > 0">
            <article z-for="p in posts" class="post-item">
              <h4>{{p.title}}</h4>
              <p>{{p.body.substring(0, 120)}}…</p>
            </article>
          </div>
          <p z-else class="muted" z-show="!loading">No posts found.</p>
        </div>
      </div>
    `;
  }
});

// --- cli\scaffold\scripts\components\about.js ————————————————————
// scripts/components/about.js — about page with theme switcher
//
// Demonstrates: $.storage (localStorage wrapper), $.bus for notifications,
//               $.version, component methods, data-theme attribute toggling

$.component('about-page', {
  state: () => ({
    theme: 'dark',
  }),

  mounted() {
    // Read persisted theme via $.storage
    this.state.theme = $.storage.get('theme') || 'dark';
  },

  toggleTheme() {
    const next = this.state.theme === 'dark' ? 'light' : 'dark';
    this.state.theme = next;
    // Apply theme via data attribute
    document.documentElement.setAttribute('data-theme', next);
    // Persist via $.storage (wraps localStorage)
    $.storage.set('theme', next);
    $.bus.emit('toast', { message: `Switched to ${next} theme`, type: 'info' });
  },

  render() {
    return `
      <div class="page-header">
        <h1>About</h1>
        <p class="subtitle">Built with zQuery v${$.version} — a zero-dependency frontend library.</p>
      </div>

      <div class="card">
        <h3>🎨 Theme</h3>
        <p>Toggle between dark and light mode. Persisted to <code>localStorage</code> via <code>$.storage</code>.</p>
        <div class="theme-toggle">
          <span>Current: <strong>${this.state.theme}</strong></span>
          <button class="btn btn-outline" @click="toggleTheme">${this.state.theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}</button>
        </div>
      </div>

      <div class="card">
        <h3>🧰 Features Used in This App</h3>
        <div class="feature-grid">
          <div class="feature-item">
            <strong>$.component()</strong>
            <span>Reactive components with state, lifecycle hooks, and template rendering</span>
          </div>
          <div class="feature-item">
            <strong>$.router()</strong>
            <span>SPA routing with history mode, z-link navigation, and fallback pages</span>
          </div>
          <div class="feature-item">
            <strong>$.store()</strong>
            <span>Centralized state management with actions, getters, and subscriptions</span>
          </div>
          <div class="feature-item">
            <strong>$.get()</strong>
            <span>HTTP client for fetching JSON APIs with async/await</span>
          </div>
          <div class="feature-item">
            <strong>$.signal() / $.computed()</strong>
            <span>Fine-grained reactive primitives for derived state</span>
          </div>
          <div class="feature-item">
            <strong>$.bus</strong>
            <span>Event bus for cross-component communication (toast notifications)</span>
          </div>
          <div class="feature-item">
            <strong>$.storage</strong>
            <span>localStorage wrapper for persisting user preferences</span>
          </div>
          <div class="feature-item">
            <strong>$.debounce()</strong>
            <span>Debounced search input in the todos filter</span>
          </div>
          <div class="feature-item">
            <strong>$.escapeHtml()</strong>
            <span>Safe rendering of user-generated and API content</span>
          </div>
          <div class="feature-item">
            <strong>$.uuid()</strong>
            <span>Unique ID generation for new todo items</span>
          </div>
          <div class="feature-item">
            <strong>z-model / z-ref</strong>
            <span>Two-way data binding and DOM element references</span>
          </div>
          <div class="feature-item">
            <strong>templateUrl / styleUrl</strong>
            <span>External HTML templates and CSS with auto-scoping (contacts page)</span>
          </div>
          <div class="feature-item">
            <strong>z-if / z-for / z-show</strong>
            <span>Structural directives for conditional &amp; list rendering</span>
          </div>
          <div class="feature-item">
            <strong>z-bind / z-class / z-style</strong>
            <span>Dynamic attributes, classes, and inline styles</span>
          </div>
          <div class="feature-item">
            <strong>$.on()</strong>
            <span>Global delegated event listeners for the hamburger menu</span>
          </div>
        </div>
      </div>

      <div class="card card-muted">
        <h3>📚 Next Steps</h3>
        <ul class="next-steps">
          <li>Read the <a href="https://z-query.com/docs" target="_blank" rel="noopener">full documentation</a></li>
          <li>Explore the <a href="https://github.com/tonywied17/zero-query" target="_blank" rel="noopener">source on GitHub</a></li>
          <li>Run <code>npx zquery bundle</code> to build for production</li>
          <li>Run <code>npx zquery dev</code> for live-reload development</li>
        </ul>
      </div>
    `;
  }
});

// --- cli\scaffold\scripts\components\contacts\contacts.js ————————
// scripts/components/contacts/contacts.js — contact book
//
// Demonstrates: external templateUrl + styleUrl, z-if/z-else, z-for,
//               z-show, z-bind/:attr, z-class, z-style, z-text, z-html,
//               z-model, z-ref, z-cloak, @click, @submit.prevent,
//               @input.debounce, event modifiers, and template {{expressions}}
//
// This component uses external files for its template and styles,
// resolved automatically relative to this JS file's location.
// Contacts are persisted in the global $.store('main') so they
// survive navigation between routes.

$.component('contacts-page', {
  templateUrl: 'cli/scaffold/scripts/components/contacts/contacts.html',
  styleUrl:    'cli/scaffold/scripts/components/contacts/contacts.css',

  state: () => ({
    contacts: [],
    showForm: false,
    newName: '',
    newEmail: '',
    newRole: 'Developer',
    nameError: '',
    emailError: '',
    selectedId: null,
    confirmDeleteId: null,
    totalAdded: 0,
    favoriteCount: 0,
  }),

  mounted() {
    const store = $.getStore('main');
    this._syncFromStore(store);
    this._unsub = store.subscribe(() => this._syncFromStore(store));
  },

  destroyed() {
    if (this._unsub) this._unsub();
  },

  _syncFromStore(store) {
    this.state.contacts      = store.state.contacts;
    this.state.totalAdded    = store.state.contactsAdded;
    this.state.favoriteCount = store.getters.favoriteCount;
  },

  // -- Actions --

  toggleForm() {
    this.state.showForm = !this.state.showForm;
    if (!this.state.showForm) this._clearForm();
  },

  _validateName(name) {
    if (!name) return 'Name is required.';
    if (name.length < 2) return 'Name must be at least 2 characters.';
    return '';
  },

  _validateEmail(email) {
    if (!email) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';
    const store = $.getStore('main');
    if (store.state.contacts.some(c => c.email.toLowerCase() === email.toLowerCase())) {
      return 'A contact with this email already exists.';
    }
    return '';
  },

  validateName() {
    this.state.nameError = this._validateName(this.state.newName.trim());
  },

  validateEmail() {
    this.state.emailError = this._validateEmail(this.state.newEmail.trim());
  },

  addContact() {
    const name  = this.state.newName.trim();
    const email = this.state.newEmail.trim();

    const nameError  = this._validateName(name);
    const emailError = this._validateEmail(email);
    this.state.nameError  = nameError;
    this.state.emailError = emailError;
    if (nameError || emailError) return;

    $.getStore('main').dispatch('addContact', {
      name,
      email,
      role: this.state.newRole,
    });

    this._clearForm();
    this.state.showForm = false;
    $.bus.emit('toast', { message: `${name} added!`, type: 'success' });
  },

  toggleFavorite(id) {
    $.getStore('main').dispatch('toggleFavorite', Number(id));
  },

  selectContact(id) {
    this.state.selectedId = this.state.selectedId === Number(id) ? null : Number(id);
    this.state.confirmDeleteId = null;
  },

  confirmDelete(id) {
    this.state.confirmDeleteId = Number(id);
  },

  cancelDelete() {
    this.state.confirmDeleteId = null;
  },

  deleteContact(id) {
    const numId = Number(id);
    const store = $.getStore('main');
    const c = store.state.contacts.find(c => c.id === numId);
    store.dispatch('deleteContact', numId);
    this.state.selectedId = null;
    this.state.confirmDeleteId = null;
    $.bus.emit('toast', { message: `${c ? c.name : 'Contact'} removed`, type: 'error' });
  },

  cycleStatus(id) {
    $.getStore('main').dispatch('cycleContactStatus', Number(id));
  },

  _clearForm() {
    this.state.newName   = '';
    this.state.newEmail  = '';
    this.state.newRole   = 'Developer';
    this.state.nameError = '';
    this.state.emailError = '';
  },
});

// --- cli\scaffold\scripts\components\not-found.js ————————————————
// scripts/components/not-found.js — 404 fallback page
//
// Demonstrates: $.getRouter() to read the current path

$.component('not-found', {
  render() {
    const router = $.getRouter();
    return `
      <div class="page-header center">
        <h1>404</h1>
        <p class="subtitle">The page <code>${$.escapeHtml(router.current?.path || '')}</code> was not found.</p>
        <a z-link="/" class="btn btn-primary">← Go Home</a>
      </div>
    `;
  }
});

// --- cli\scaffold\scripts\app.js —————————————————————————————————
// scripts/app.js — application entry point
//
// This file bootstraps the zQuery app: imports all components,
// sets up routing, wires the responsive nav, and demonstrates
// several core APIs: $.router, $.ready, $.bus, $.on, and $.storage.
// ---------------------------------------------------------------------------
// Router — SPA navigation with history mode
// ---------------------------------------------------------------------------
const router = $.router({
  el: '#app',
  routes,
  fallback: 'not-found',
  mode: 'history'
});

// Highlight the active nav link on every route change
router.onChange((to) => {
  $.all('.nav-link').removeClass('active');
  $.all(`.nav-link[z-link="${to.path}"]`).addClass('active');

  // Close mobile menu on navigate
  closeMobileMenu();
});

// ---------------------------------------------------------------------------
// Responsive sidebar toggle
// ---------------------------------------------------------------------------
const sidebar = $.id('sidebar');
const overlay = $.id('overlay');
const toggle  = $.id('menu-toggle');

function openMobileMenu() {
  sidebar.classList.add('open');
  overlay.classList.add('visible');
  toggle.classList.add('active');
}

function closeMobileMenu() {
  sidebar.classList.remove('open');
  overlay.classList.remove('visible');
  toggle.classList.remove('active');
}

// $.on — global delegated event listeners
$.on('click', '#menu-toggle', () => {
  sidebar.classList.contains('open') ? closeMobileMenu() : openMobileMenu();
});
$.on('click', '#overlay', closeMobileMenu);

// Close sidebar on Escape key — using $.on direct (no selector needed)
$.on('keydown', (e) => {
  if (e.key === 'Escape') closeMobileMenu();
});

// ---------------------------------------------------------------------------
// Toast notification system via $.bus (event bus)
// ---------------------------------------------------------------------------
// Any component can emit: $.bus.emit('toast', { message, type })
// Types: 'success', 'error', 'info'
$.bus.on('toast', ({ message, type = 'info' }) => {
  const container = $.id('toasts');
  const toast = $.create('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
});

// ---------------------------------------------------------------------------
// On DOM ready — final setup
// ---------------------------------------------------------------------------
$.ready(() => {
  // Display version in the sidebar footer
  const versionEl = $.id('nav-version');
  if (versionEl) versionEl.textContent = 'v' + $.version;

  // Restore last theme from localStorage ($.storage)
  const savedTheme = $.storage.get('theme');
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

  // Set active link on initial load
  const current = window.location.pathname;
  $.all(`.nav-link[z-link="${current}"]`).addClass('active');

  console.log('⚡ {{NAME}} — powered by zQuery v' + $.version);
});

})();
