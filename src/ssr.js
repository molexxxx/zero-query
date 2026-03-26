/**
 * zQuery SSR - Server-side rendering to HTML string
 *
 * Renders registered components to static HTML strings for SEO,
 * initial page load performance, and static site generation.
 *
 * Works in Node.js - no DOM required for basic rendering.
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
import { reportError, ErrorCode, ZQueryError } from './errors.js';

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
          get: () => {
            try {
              return fn.call(this, this.state);
            } catch (err) {
              reportError(ErrorCode.SSR_RENDER, `Computed property "${name}" threw during SSR`, { property: name }, err);
              return undefined;
            }
          },
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

    // Init lifecycle - guarded so a broken init doesn't crash the whole render
    if (definition.init) {
      try {
        definition.init.call(this);
      } catch (err) {
        reportError(ErrorCode.SSR_RENDER, 'Component init() threw during SSR', {}, err);
      }
    }
  }

  render() {
    if (this._def.render) {
      try {
        let html = this._def.render.call(this);
        html = this._interpolate(html);
        return html;
      } catch (err) {
        reportError(ErrorCode.SSR_RENDER, 'Component render() threw during SSR', {}, err);
        return `<!-- SSR render error -->`;
      }
    }
    return '';
  }

  // Basic {{expression}} interpolation for SSR
  _interpolate(html) {
    return html.replace(/\{\{(.+?)\}\}/g, (_, expr) => {
      try {
        const result = safeEval(expr.trim(), [
          this.state,
          { props: this.props, computed: this.computed }
        ]);
        return result != null ? _escapeHtml(String(result)) : '';
      } catch (err) {
        reportError(ErrorCode.SSR_RENDER, `Expression "{{${expr.trim()}}}" failed during SSR`, { expression: expr.trim() }, err);
        return '';
      }
    });
  }
}

const SSR_RESERVED = new Set([
  'state', 'render', 'styles', 'init', 'mounted', 'updated', 'destroyed',
  'props', 'templateUrl', 'styleUrl', 'templates',
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
// SSR App - component registry + renderer
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
    if (typeof name !== 'string' || !name) {
      throw new ZQueryError(ErrorCode.SSR_COMPONENT, 'Component name must be a non-empty string');
    }
    if (!definition || typeof definition !== 'object') {
      throw new ZQueryError(ErrorCode.SSR_COMPONENT, `Invalid definition for component "${name}"`);
    }
    this._registry.set(name, definition);
    return this;
  }

  /**
   * Check whether a component is registered.
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    return this._registry.has(name);
  }

  /**
   * Render a component to an HTML string.
   *
   * @param {string} componentName - registered component name
   * @param {object} [props] - props to pass
   * @param {object} [options] - rendering options
   * @param {boolean} [options.hydrate=true] - add hydration marker
   * @param {string} [options.mode='html'] - 'html' (default) or 'fragment' (no wrapper tag)
   * @returns {Promise<string>} - rendered HTML
   */
  async renderToString(componentName, props = {}, options = {}) {
    const def = this._registry.get(componentName);
    if (!def) {
      throw new ZQueryError(
        ErrorCode.SSR_COMPONENT,
        `SSR: Component "${componentName}" not registered`,
        { component: componentName }
      );
    }

    const instance = new SSRComponent(def, props);
    let html = instance.render();

    // Strip z-cloak attributes (they're only for client-side FOUC prevention)
    html = html.replace(/\s*z-cloak\s*/g, ' ');

    // Clean up SSR-irrelevant attributes
    html = html.replace(/\s*@[\w.]+="[^"]*"/g, ''); // Remove event bindings
    html = html.replace(/\s*z-on:[\w.]+="[^"]*"/g, '');

    // Fragment mode - return inner HTML without wrapper tag
    if (options.mode === 'fragment') return html;

    const hydrate = options.hydrate !== false;
    const marker = hydrate ? ' data-zq-ssr' : '';

    return `<${componentName}${marker}>${html}</${componentName}>`;
  }

  /**
   * Render multiple components as a batch.
   *
   * @param {Array<{ name: string, props?: object, options?: object }>} entries
   * @returns {Promise<string[]>} - array of rendered HTML strings
   */
  async renderBatch(entries) {
    return Promise.all(
      entries.map(({ name, props, options }) => this.renderToString(name, props, options))
    );
  }

  /**
   * Render a full HTML page with a component mounted in a shell.
   *
   * @param {object} options
   * @param {string} options.component - component name to render
   * @param {object} [options.props] - props
   * @param {string} [options.title] - page title
   * @param {string} [options.description] - meta description for SEO
   * @param {string[]} [options.styles] - CSS file paths
   * @param {string[]} [options.scripts] - JS file paths
   * @param {string} [options.lang] - html lang attribute
   * @param {string} [options.meta] - additional head content
   * @param {string} [options.bodyAttrs] - extra body attributes
   * @param {object} [options.head] - structured head options
   * @param {string} [options.head.canonical] - canonical URL
   * @param {object} [options.head.og] - Open Graph tags
   * @returns {Promise<string>}
   */
  async renderPage(options = {}) {
    const {
      component: comp,
      props = {},
      title = '',
      description = '',
      styles = [],
      scripts = [],
      lang = 'en',
      meta = '',
      bodyAttrs = '',
      head = {},
    } = options;

    let content = '';
    if (comp) {
      try {
        content = await this.renderToString(comp, props);
      } catch (err) {
        reportError(ErrorCode.SSR_PAGE, `renderPage failed for component "${comp}"`, { component: comp }, err);
        content = `<!-- SSR error: ${_escapeHtml(err.message)} -->`;
      }
    }

    const styleLinks = styles.map(s => `<link rel="stylesheet" href="${_escapeHtml(s)}">`).join('\n    ');
    const scriptTags = scripts.map(s => `<script src="${_escapeHtml(s)}"></script>`).join('\n    ');

    // Build SEO / structured head tags
    let headExtra = meta;
    if (description) {
      headExtra += `\n    <meta name="description" content="${_escapeHtml(description)}">`;
    }
    if (head.canonical) {
      headExtra += `\n    <link rel="canonical" href="${_escapeHtml(head.canonical)}">`;
    }
    if (head.og) {
      for (const [key, val] of Object.entries(head.og)) {
        headExtra += `\n    <meta property="og:${_escapeHtml(key)}" content="${_escapeHtml(String(val))}">`;
      }
    }

    return `<!DOCTYPE html>
<html lang="${_escapeHtml(lang)}">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${_escapeHtml(title)}</title>
    ${headExtra}
    ${styleLinks}
  </head>
  <body ${bodyAttrs.replace(/on\w+\s*=/gi, '').replace(/javascript\s*:/gi, '')}>
    <div id="app">${content}</div>
    ${scriptTags}
  </body>
</html>`;
  }

  /**
   * Render a component into an existing HTML shell template.
   *
   * Unlike renderPage() which generates a full HTML document from scratch,
   * renderShell() takes your own index.html (with nav, footer, custom markup)
   * and injects the SSR-rendered component body plus metadata into it.
   *
   * Handles:
   *   - Component rendering into <z-outlet>
   *   - <title> replacement
   *   - <meta name="description"> replacement
   *   - Open Graph meta tag replacement (og:title, og:description, og:type, etc.)
   *   - window.__SSR_DATA__ hydration script injection
   *
   * @param {string} shell - HTML template string (your index.html)
   * @param {object} options
   * @param {string} options.component - registered component name to render
   * @param {object} [options.props] - props passed to the component
   * @param {string} [options.title] - page title (replaces <title>)
   * @param {string} [options.description] - meta description (replaces <meta name="description">)
   * @param {object} [options.og] - Open Graph tags to replace (e.g. { title, description, type, image })
   * @param {any}    [options.ssrData] - data to embed as window.__SSR_DATA__ for client hydration
   * @param {object} [options.renderOptions] - options passed to renderToString (hydrate, mode)
   * @returns {Promise<string>} - the shell with SSR content and metadata injected
   */
  async renderShell(shell, options = {}) {
    const {
      component: comp,
      props = {},
      title,
      description,
      og,
      ssrData,
      renderOptions,
    } = options;

    // Render the component
    let body = '';
    if (comp) {
      try {
        body = await this.renderToString(comp, props, renderOptions);
      } catch (err) {
        reportError(ErrorCode.SSR_PAGE, `renderShell failed for component "${comp}"`, { component: comp }, err);
        body = `<!-- SSR error: ${_escapeHtml(err.message)} -->`;
      }
    }

    let html = shell;

    // Inject SSR body into <z-outlet>
    // Use a replacer function to avoid $ substitution patterns in body
    html = html.replace(/(<z-outlet[^>]*>)([\s\S]*?)(<\/z-outlet>)?/, (_, open) => `${open}${body}</z-outlet>`);

    // Replace <title>
    if (title != null) {
      const safeTitle = _escapeHtml(title);
      html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${safeTitle}</title>`);
    }

    // Replace <meta name="description">
    if (description != null) {
      const safeDesc = _escapeHtml(description);
      html = html.replace(
        /<meta\s+name="description"\s+content="[^"]*">/,
        () => `<meta name="description" content="${safeDesc}">`
      );
    }

    // Replace Open Graph meta tags
    if (og) {
      for (const [key, value] of Object.entries(og)) {
        // Sanitize key: allow only safe OG property characters (alphanumeric, hyphens, underscores, colons)
        const safeKey = key.replace(/[^a-zA-Z0-9_:\-]/g, '');
        if (!safeKey) continue;
        const escaped = _escapeHtml(String(value));
        // Escape key for use in RegExp to prevent ReDoS
        const escapedKey = safeKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`<meta\\s+property="og:${escapedKey}"\\s+content="[^"]*">`);
        if (pattern.test(html)) {
          html = html.replace(pattern, () => `<meta property="og:${safeKey}" content="${escaped}">`);
        } else {
          // Tag doesn't exist — inject before </head>
          html = html.replace('</head>', () => `<meta property="og:${safeKey}" content="${escaped}">\n</head>`);
        }
      }
    }

    // Inject hydration data as window.__SSR_DATA__
    if (ssrData !== undefined) {
      // Escape </script> and <!-- sequences to prevent breaking out of the script tag
      const json = JSON.stringify(ssrData).replace(/<\//g, '<\\/').replace(/<!--/g, '<\\!--');
      html = html.replace('</head>', () => `<script>window.__SSR_DATA__=${json};</script>\n</head>`);
    }

    return html;
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
 * @param {object} definition - component definition
 * @param {object} [props] - props
 * @returns {string}
 */
export function renderToString(definition, props = {}) {
  if (!definition || typeof definition !== 'object') {
    throw new ZQueryError(ErrorCode.SSR_COMPONENT, 'renderToString requires a component definition object');
  }
  const instance = new SSRComponent(definition, props);
  return instance.render();
}

/**
 * Escape HTML entities - exposed for use in SSR templates.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return _escapeHtml(String(str));
}

// Re-export matchRoute so SSR servers can import from 'zero-query/ssr'
export { matchRoute } from './router.js';
