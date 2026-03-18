/**
 * Server-Side Rendering — render components to HTML strings.
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
 * Escape HTML entities — exposed for use in SSR templates.
 */
export function escapeHtml(str: string): string;
