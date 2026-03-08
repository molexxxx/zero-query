/**
 * zQuery SSR — Server-side rendering to HTML string
 *
 * Renders registered components to static HTML strings for SEO,
 * initial page load performance, and static site generation.
 *
 * Works in Node.js — no DOM required for basic rendering.
 * Supports hydration markers for client-side takeover.
 *
 * Usage (Node.js):
 *   import { renderToString, createSSRApp } from 'zero-query/ssr';
 *
 *   const app = createSSRApp();
 *   app.component('my-page', {
 *     state: () => ({ title: 'Hello' }),
 *     render() { return `<h1>${this.state.title}</h1>`; }
 *   });
 *
 *   const html = await app.renderToString('my-page', { title: 'World' });
 *   // → '<my-page data-zq-ssr><h1>World</h1></my-page>'
 */

import { safeEval } from './expression.js';

// ---------------------------------------------------------------------------
// Minimal reactive proxy for SSR (no scheduling, no DOM)
// ---------------------------------------------------------------------------
function ssrReactive(target) {
  // In SSR, state is plain objects — no Proxy needed since we don't re-render
  return target;
}

// ---------------------------------------------------------------------------
// SSR Component renderer
// ---------------------------------------------------------------------------
class SSRComponent {
  constructor(definition, props = {}) {
    this._def = definition;
    this.props = Object.freeze({ ...props });
    this.refs = {};
    this.templates = {};
    this.computed = {};

    // Initialize state
    const initialState = typeof definition.state === 'function'
      ? definition.state()
      : { ...(definition.state || {}) };
    this.state = initialState;

    // Add __raw to match client-side API
    Object.defineProperty(this.state, '__raw', { value: this.state, enumerable: false });

    // Computed properties
    if (definition.computed) {
      for (const [name, fn] of Object.entries(definition.computed)) {
        Object.defineProperty(this.computed, name, {
          get: () => fn.call(this, this.state),
          enumerable: true
        });
      }
    }

    // Bind user methods
    for (const [key, val] of Object.entries(definition)) {
      if (typeof val === 'function' && !SSR_RESERVED.has(key)) {
        this[key] = val.bind(this);
      }
    }

    // Init
    if (definition.init) definition.init.call(this);
  }

  render() {
    if (this._def.render) {
      let html = this._def.render.call(this);
      html = this._interpolate(html);
      return html;
    }
    return '';
  }

  // Basic {{expression}} interpolation for SSR
  _interpolate(html) {
    return html.replace(/\{\{(.+?)\}\}/g, (_, expr) => {
      const result = safeEval(expr.trim(), [
        this.state,
        { props: this.props, computed: this.computed }
      ]);
      return result != null ? _escapeHtml(String(result)) : '';
    });
  }
}

const SSR_RESERVED = new Set([
  'state', 'render', 'styles', 'init', 'mounted', 'updated', 'destroyed',
  'props', 'templateUrl', 'styleUrl', 'templates', 'pages', 'activePage',
  'base', 'computed', 'watch'
]);

// ---------------------------------------------------------------------------
// HTML escaping for SSR output
// ---------------------------------------------------------------------------
const _escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function _escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => _escapeMap[c]);
}

// ---------------------------------------------------------------------------
// SSR App — component registry + renderer
// ---------------------------------------------------------------------------
class SSRApp {
  constructor() {
    this._registry = new Map();
  }

  /**
   * Register a component for SSR.
   * @param {string} name
   * @param {object} definition
   */
  component(name, definition) {
    this._registry.set(name, definition);
    return this;
  }

  /**
   * Render a component to an HTML string.
   *
   * @param {string} componentName — registered component name
   * @param {object} [props] — props to pass
   * @param {object} [options] — rendering options
   * @param {boolean} [options.hydrate=true] — add hydration marker
   * @returns {Promise<string>} — rendered HTML
   */
  async renderToString(componentName, props = {}, options = {}) {
    const def = this._registry.get(componentName);
    if (!def) throw new Error(`SSR: Component "${componentName}" not registered`);

    const instance = new SSRComponent(def, props);
    let html = instance.render();

    // Strip z-cloak attributes (they're only for client-side FOUC prevention)
    html = html.replace(/\s*z-cloak\s*/g, ' ');

    // Clean up SSR-irrelevant attributes
    html = html.replace(/\s*@[\w.]+="[^"]*"/g, ''); // Remove event bindings
    html = html.replace(/\s*z-on:[\w.]+="[^"]*"/g, '');

    const hydrate = options.hydrate !== false;
    const marker = hydrate ? ' data-zq-ssr' : '';

    return `<${componentName}${marker}>${html}</${componentName}>`;
  }

  /**
   * Render a full HTML page with a component mounted in a shell.
   *
   * @param {object} options
   * @param {string} options.component — component name to render
   * @param {object} [options.props] — props
   * @param {string} [options.title] — page title
   * @param {string[]} [options.styles] — CSS file paths
   * @param {string[]} [options.scripts] — JS file paths
   * @param {string} [options.lang] — html lang attribute
   * @param {string} [options.meta] — additional head content
   * @returns {Promise<string>}
   */
  async renderPage(options = {}) {
    const {
      component: comp,
      props = {},
      title = '',
      styles = [],
      scripts = [],
      lang = 'en',
      meta = '',
      bodyAttrs = '',
    } = options;

    const content = comp ? await this.renderToString(comp, props) : '';

    const styleLinks = styles.map(s => `<link rel="stylesheet" href="${_escapeHtml(s)}">`).join('\n    ');
    const scriptTags = scripts.map(s => `<script src="${_escapeHtml(s)}"></script>`).join('\n    ');

    return `<!DOCTYPE html>
<html lang="${_escapeHtml(lang)}">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${_escapeHtml(title)}</title>
    ${meta}
    ${styleLinks}
  </head>
  <body ${bodyAttrs}>
    <div id="app">${content}</div>
    ${scriptTags}
  </body>
</html>`;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create an SSR application instance.
 * @returns {SSRApp}
 */
export function createSSRApp() {
  return new SSRApp();
}

/**
 * Quick one-shot render of a component definition to string.
 * @param {object} definition — component definition
 * @param {object} [props] — props
 * @returns {string}
 */
export function renderToString(definition, props = {}) {
  const instance = new SSRComponent(definition, props);
  return instance.render();
}
