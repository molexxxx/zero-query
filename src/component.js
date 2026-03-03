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

import { reactive } from './reactive.js';

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
export function component(name, definition) {
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
export function mount(target, componentName, props = {}) {
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
export function mountAll(root = document.body) {
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
export function style(urls, opts = {}) {
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
