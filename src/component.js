/**
 * zQuery Component - Lightweight reactive component system
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
 *   - Relative path resolution - templateUrl and styleUrl
 *     resolve relative to the component file automatically
 */

import { reactive } from './reactive.js';
import { morph } from './diff.js';
import { safeEval } from './expression.js';
import { reportError, ErrorCode, ZQueryError } from './errors.js';
import { escapeHtml } from './utils.js';

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
 * @param {string} url - URL to fetch
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
 * - If `base` is falsy, return `url` unchanged - _fetchResource's own
 *   fallback (page root / <base href>) handles it.
 *
 * @param {string} url   - URL or relative path to resolve
 * @param {string} [base] - auto-detected caller URL or explicit base path
 * @returns {string}
 */
function _resolveUrl(url, base) {
  if (!base || !url || typeof url !== 'string') return url;
  // Already absolute - nothing to do
  if (url.startsWith('/') || url.includes('://') || url.startsWith('//')) return url;
  try {
    if (base.includes('://')) {
      // Absolute base (auto-detected module URL)
      return new URL(url, base).href;
    }
    // Relative base string - resolve against page root first
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
      // Skip the zQuery library itself - by filename pattern and captured URL
      if (/zquery(\.min)?\.js$/i.test(url)) continue;
      if (_ownScriptUrl && url.replace(/[?#].*$/, '') === _ownScriptUrl) continue;
      // Return directory (strip filename, keep trailing slash)
      return url.replace(/\/[^/]*$/, '/');
    }
  } catch { /* stack parsing unsupported - fall back silently */ }
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
        const slotName = node.getAttribute('slot') || 'default';
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

    // Computed properties - lazy getters derived from state
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
      if (changedKey === key || key.startsWith(changedKey + '.') || changedKey.startsWith(key + '.')) {
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
      return; // Skip this render - will re-render after load
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
          return result != null ? escapeHtml(String(result)) : '';
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
      let noScopeDepth = 0;   // brace depth at which a no-scope @-rule started (0 = none active)
      let braceDepth = 0;     // overall brace depth
      const scoped = combinedStyles.replace(/([^{}]+)\{|\}/g, (match, selector) => {
        if (match === '}') {
          if (noScopeDepth > 0 && braceDepth <= noScopeDepth) noScopeDepth = 0;
          braceDepth--;
          return match;
        }
        braceDepth++;
        const trimmed = selector.trim();
        // Don't scope @-rules themselves
        if (trimmed.startsWith('@')) {
          // @keyframes and @font-face contain non-selector content - skip scoping inside them
          if (/^@(keyframes|font-face)\b/.test(trimmed)) {
            noScopeDepth = braceDepth;
          }
          return match;
        }
        // Inside @keyframes or @font-face - don't scope inner rules
        if (noScopeDepth > 0 && braceDepth > noScopeDepth) {
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

    // Update DOM via morphing (diffing) - preserves unchanged nodes
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

    // Restore focus if the morph replaced the focused element.
    // Always restore selectionRange - even when the element is still
    // the activeElement - because _bindModels or morph attribute syncing
    // can alter the value and move the cursor.
    if (_focusInfo) {
      const el = this._el.querySelector(_focusInfo.selector);
      if (el) {
        if (el !== document.activeElement) el.focus();
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
  // internal binding map - existing DOM listeners are reused since they
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

    // Only attach DOM listeners once - reuse on subsequent renders.
    // The handlers close over `this` and read `this._eventBindings`
    // at fire time, so they always use the latest binding map.
    if (this._delegatedEvents) {
      // Already attached - just make sure new event types are covered
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

    // .outside - attach a document-level listener for bindings that need
    // to detect clicks/events outside their element.
    this._outsideListeners = this._outsideListeners || [];
    for (const [event, bindings] of eventMap) {
      for (const binding of bindings) {
        if (!binding.modifiers.includes('outside')) continue;
        const outsideHandler = (e) => {
          if (binding.el.contains(e.target)) return;
          const match = binding.methodExpr.match(/^(\w+)(?:\(([^)]*)\))?$/);
          if (!match) return;
          const fn = this[match[1]];
          if (typeof fn === 'function') fn.call(this, e);
        };
        document.addEventListener(event, outsideHandler, true);
        this._outsideListeners.push({ event, handler: outsideHandler });
      }
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
        // Read bindings from live map - always up to date after re-renders
        const currentBindings = this._eventBindings?.get(event) || [];

        // Collect matching bindings with their matched elements, then sort
        // deepest-first so .stop correctly prevents ancestor handlers
        // (mimics real DOM bubbling order within delegated events).
        const hits = [];
        for (const binding of currentBindings) {
          const matched = e.target.closest(binding.selector);
          if (!matched) continue;
          hits.push({ ...binding, matched });
        }
        hits.sort((a, b) => {
          if (a.matched === b.matched) return 0;
          return a.matched.contains(b.matched) ? 1 : -1;
        });

        let stoppedAt = null; // Track elements that called .stop
        for (const { selector, methodExpr, modifiers, el, matched } of hits) {

          // In delegated events, .stop should prevent ancestor bindings from
          // firing - stopPropagation alone only stops real DOM bubbling.
          if (stoppedAt) {
            let blocked = false;
            for (const stopped of stoppedAt) {
              if (matched.contains(stopped) && matched !== stopped) { blocked = true; break; }
            }
            if (blocked) continue;
          }

          // .self - only fire if target is the element itself
          if (modifiers.includes('self') && e.target !== el) continue;

          // .outside - only fire if event target is OUTSIDE the element
          if (modifiers.includes('outside')) {
            if (el.contains(e.target)) continue;
          }

          // Key modifiers - filter keyboard events by key
          const _keyMap = { enter: 'Enter', escape: 'Escape', tab: 'Tab', space: ' ', delete: 'Delete|Backspace', up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
          let keyFiltered = false;
          for (const mod of modifiers) {
            if (_keyMap[mod]) {
              const keys = _keyMap[mod].split('|');
              if (!e.key || !keys.includes(e.key)) { keyFiltered = true; break; }
            }
          }
          if (keyFiltered) continue;

          // System key modifiers - require modifier keys to be held
          if (modifiers.includes('ctrl') && !e.ctrlKey) continue;
          if (modifiers.includes('shift') && !e.shiftKey) continue;
          if (modifiers.includes('alt') && !e.altKey) continue;
          if (modifiers.includes('meta') && !e.metaKey) continue;

          // Handle modifiers
          if (modifiers.includes('prevent')) e.preventDefault();
          if (modifiers.includes('stop')) {
            e.stopPropagation();
            if (!stoppedAt) stoppedAt = [];
            stoppedAt.push(matched);
          }

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

          // .debounce.{ms} - delay invocation until idle
          const debounceIdx = modifiers.indexOf('debounce');
          if (debounceIdx !== -1) {
            const ms = parseInt(modifiers[debounceIdx + 1], 10) || 250;
            const timers = _debounceTimers.get(el) || {};
            clearTimeout(timers[event]);
            timers[event] = setTimeout(() => invoke(e), ms);
            _debounceTimers.set(el, timers);
            continue;
          }

          // .throttle.{ms} - fire at most once per interval
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

          // .once - fire once then ignore
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
  //    z-lazy      - listen on 'change' instead of 'input' (update on blur / commit)
  //    z-trim      - trim whitespace before writing to state
  //    z-number    - force Number() conversion regardless of input type
  //    z-debounce  - debounce state writes (default 250ms, or z-debounce="300")
  //    z-uppercase - convert string to uppercase before writing to state
  //    z-lowercase - convert string to lowercase before writing to state
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
      const isUpper  = el.hasAttribute('z-uppercase');
      const isLower  = el.hasAttribute('z-lowercase');
      const hasDebounce = el.hasAttribute('z-debounce');
      const debounceMs  = hasDebounce ? (parseInt(el.getAttribute('z-debounce'), 10) || 250) : 0;

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
        if (isUpper && typeof val === 'string') val = val.toUpperCase();
        if (isLower && typeof val === 'string') val = val.toLowerCase();
        if (isNum || type === 'number' || type === 'range') val = Number(val);

        // Write through the reactive proxy (triggers re-render).
        // Focus + cursor are preserved automatically by _render().
        _setPath(this.state, key, val);
      };

      if (hasDebounce) {
        let timer = null;
        el.addEventListener(event, () => {
          clearTimeout(timer);
          timer = setTimeout(handler, debounceMs);
        });
      } else {
        el.addEventListener(event, handler);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Expression evaluator - CSP-safe parser (no eval / new Function)
  // ---------------------------------------------------------------------------
  _evalExpr(expr) {
    return safeEval(expr, [
      this.state.__raw || this.state,
      { props: this.props, refs: this.refs, computed: this.computed, $: typeof window !== 'undefined' ? window.$ : undefined }
    ]);
  }

  // ---------------------------------------------------------------------------
  // z-for - Expand list-rendering directives (pre-innerHTML, string level)
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
              return result != null ? escapeHtml(String(result)) : '';
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
  // _expandContentDirectives - Pre-morph z-html & z-text expansion
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
  // _processDirectives - Post-innerHTML DOM-level directive processing
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
    // Use TreeWalker instead of querySelectorAll('*') - avoids
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
    if (this._outsideListeners) {
      this._outsideListeners.forEach(({ event, handler }) => document.removeEventListener(event, handler, true));
      this._outsideListeners = [];
    }
    this._delegatedEvents = null;
    this._eventBindings = null;
    // Clear any pending debounce/throttle timers to prevent stale closures.
    // Timers are keyed by individual child elements, so iterate all descendants.
    const allEls = this._el.querySelectorAll('*');
    allEls.forEach(child => {
      const dTimers = _debounceTimers.get(child);
      if (dTimers) {
        for (const key in dTimers) clearTimeout(dTimers[key]);
        _debounceTimers.delete(child);
      }
      const tTimers = _throttleTimers.get(child);
      if (tTimers) {
        for (const key in tTimers) clearTimeout(tTimers[key]);
        _throttleTimers.delete(child);
      }
    });
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
 * @param {string} name - tag name (must contain a hyphen, e.g. 'app-counter')
 * @param {object} definition - component definition
 */
export function component(name, definition) {
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
 * @param {string|Element} target - selector or element to mount into
 * @param {string} componentName - registered component name
 * @param {object} props - props to pass
 * @returns {Component}
 */
export function mount(target, componentName, props = {}) {
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
 * @param {Element} root - root element to scan (default: document.body)
 */
export function mountAll(root = document.body) {
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

        // Dynamic prop: :propName="expression" - evaluate in parent context
        if (attr.name.startsWith(':')) {
          const propName = attr.name.slice(1);
          if (parentInstance) {
            props[propName] = safeEval(attr.value, [
              parentInstance.state.__raw || parentInstance.state,
              { props: parentInstance.props, refs: parentInstance.refs, computed: parentInstance.computed, $: typeof window !== 'undefined' ? window.$ : undefined }
            ]);
          } else {
            // No parent - try JSON parse
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
export function getInstance(target) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  return _instances.get(el) || null;
}

/**
 * Destroy a component at the given target
 * @param {string|Element} target
 */
export function destroy(target) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  const inst = _instances.get(el);
  if (inst) inst.destroy();
}

/**
 * Get the registry (for debugging)
 */
export function getRegistry() {
  return Object.fromEntries(_registry);
}

/**
 * Pre-load a component's external templates and styles so the next mount
 * renders synchronously (no blank flash while fetching).
 * Safe to call multiple times - skips if already loaded.
 * @param {string} name - registered component name
 * @returns {Promise<void>}
 */
export async function prefetch(name) {
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
 *   $.style('/assets/global.css')                // absolute - used as-is
 *   $.style('app.css', { critical: false })       // opt out of FOUC prevention
 *
 * Options:
 *   critical  - (boolean, default true) When true, zQuery injects a tiny
 *               inline style that hides the page (`visibility: hidden`) and
 *               removes it once the stylesheet has loaded. This prevents
 *               FOUC (Flash of Unstyled Content) entirely - no special
 *               markup needed in the HTML file. Set to false to load
 *               the stylesheet without blocking paint.
 *   bg        - (string, default '#0d1117') Background color applied while
 *               the page is hidden during critical load. Prevents a white
 *               flash on dark-themed apps. Only used when critical is true.
 *
 * Duplicate URLs are ignored (idempotent).
 *
 * @param {string|string[]} urls - stylesheet URL(s) to load
 * @param {object} [opts] - options
 * @param {boolean} [opts.critical=true] - hide page until loaded (prevents FOUC)
 * @param {string} [opts.bg] - background color while hidden (default '#0d1117')
 * @returns {{ remove: Function, ready: Promise }} - .remove() to unload, .ready resolves when loaded
 */
export function style(urls, opts = {}) {
  const callerBase = _detectCallerBase();
  const list = Array.isArray(urls) ? urls : [urls];
  const elements = [];
  const loadPromises = [];

  // Critical mode (default: true): inject a tiny inline <style> that hides the
  // page and sets a background color. Fully self-contained - no markup needed
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
