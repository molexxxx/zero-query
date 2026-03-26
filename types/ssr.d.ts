/**
 * Server-Side Rendering - render components to HTML strings.
 *
 * @module ssr
 */

import type { ComponentDefinition } from './component';

/** SSR application instance for server-side component rendering. */
export interface SSRApp {
  /** Register a component for SSR. */
  component(name: string, definition: ComponentDefinition): SSRApp;

  /** Check whether a component is registered. */
  has(name: string): boolean;

  /**
   * Render a component to an HTML string.
   * @param componentName Registered component name.
   * @param props Props to pass to the component.
   * @param options Rendering options.
   */
  renderToString(
    componentName: string,
    props?: Record<string, any>,
    options?: { hydrate?: boolean; mode?: 'html' | 'fragment' },
  ): Promise<string>;

  /**
   * Render multiple components as a batch.
   */
  renderBatch(
    entries: Array<{ name: string; props?: Record<string, any>; options?: { hydrate?: boolean; mode?: 'html' | 'fragment' } }>,
  ): Promise<string[]>;

  /**
   * Render a full HTML page with a component mounted in a shell.
   */
  renderPage(options: {
    component?: string;
    props?: Record<string, any>;
    title?: string;
    description?: string;
    styles?: string[];
    scripts?: string[];
    lang?: string;
    meta?: string;
    bodyAttrs?: string;
    head?: {
      canonical?: string;
      og?: Record<string, string>;
    };
  }): Promise<string>;

  /**
   * Render a component into an existing HTML shell template.
   *
   * Unlike `renderPage()` which generates a full document from scratch,
   * `renderShell()` takes your own `index.html` (with nav, footer, custom
   * markup) and injects the SSR-rendered component body plus metadata.
   *
   * Handles `<z-outlet>` injection, `<title>` replacement, meta description,
   * Open Graph tags, and `window.__SSR_DATA__` hydration data.
   *
   * @param shell - HTML template string (your index.html content).
   * @param options - Rendering and metadata options.
   */
  renderShell(shell: string, options?: {
    /** Registered component name to render into `<z-outlet>`. */
    component?: string;
    /** Props passed to the component. */
    props?: Record<string, any>;
    /** Page title — replaces `<title>`. */
    title?: string;
    /** Meta description — replaces `<meta name="description">`. */
    description?: string;
    /** Open Graph tags to replace or inject (e.g. `{ title, description, type, image }`). */
    og?: Record<string, string>;
    /** Data embedded as `window.__SSR_DATA__` for client-side hydration. */
    ssrData?: any;
    /** Options passed through to `renderToString()` (hydrate, mode). */
    renderOptions?: { hydrate?: boolean; mode?: 'html' | 'fragment' };
  }): Promise<string>;
}

/** Create an SSR application instance. */
export function createSSRApp(): SSRApp;

/**
 * Quick one-shot render of a component definition to an HTML string.
 * @param definition Component definition object.
 * @param props Props to pass.
 */
export function renderToString(definition: ComponentDefinition, props?: Record<string, any>): string;

/**
 * Escape HTML entities - exposed for use in SSR templates.
 */
export function escapeHtml(str: string): string;

// Re-exported from router for SSR server convenience
export { matchRoute, RouteMatch } from './router';
