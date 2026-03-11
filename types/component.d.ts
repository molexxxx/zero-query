/**
 * Component system — define, mount, and manage reactive components.
 *
 * @module component
 */

import type { ReactiveProxy } from './reactive';
import type { NavigationContext } from './router';

/** Item in a `pages` config — either a string id or an `{ id, label }` object. */
export type PageItem = string | { id: string; label?: string };

/**
 * Declarative multi-page configuration for a component.
 *
 * Pages are **lazy-loaded**: only the active page is fetched on first render.
 * Remaining pages are prefetched in the background for instant navigation.
 */
export interface PagesConfig {
  /** Directory containing the page HTML files (resolved relative to `base`). */
  dir?: string;
  /** Route parameter name to read (e.g. `'section'` for `/docs/:section`). */
  param?: string;
  /** Default page id when the param is absent. */
  default?: string;
  /** File extension appended to each page id (default `'.html'`). */
  ext?: string;
  /** List of page ids and/or `{ id, label }` objects. */
  items?: PageItem[];
}

/** The object passed to `$.component()` to define a component. */
export interface ComponentDefinition {
  /**
   * Initial reactive state.
   * A function form is recommended so each instance gets its own copy.
   */
  state?: Record<string, any> | (() => Record<string, any>);

  /**
   * Returns an HTML string. Called on every state change.
   * `this` is the component instance.
   */
  render?(this: ComponentInstance): string;

  /** CSS string — scoped to the component root on first render. */
  styles?: string;

  /**
   * URL (or array / object map of URLs) to external HTML template file(s).
   * If `render()` is also defined, `render()` takes priority.
   */
  templateUrl?: string | string[] | Record<string, string>;

  /**
   * URL (or array of URLs) to external CSS file(s).
   * Fetched and auto-scoped on first mount; merged with `styles` if both present.
   */
  styleUrl?: string | string[];

  /** High-level multi-page configuration shorthand. */
  pages?: PagesConfig;

  /**
   * Override the base path for resolving relative `templateUrl`, `styleUrl`,
   * and `pages.dir` paths. Normally auto-detected from the calling file.
   */
  base?: string;

  /** Called before first render (during construction). */
  init?(this: ComponentInstance): void;

  /** Called once after first render and DOM insertion. */
  mounted?(this: ComponentInstance): void;

  /** Called after every subsequent re-render. */
  updated?(this: ComponentInstance): void;

  /** Called when the component is destroyed. Clean up subscriptions here. */
  destroyed?(this: ComponentInstance): void;

  /**
   * Computed properties — lazy getters derived from state.
   * Each function receives the raw state as its argument.
   * Access via `this.computed.name` in methods and templates.
   */
  computed?: Record<string, (state: Record<string, any>) => any>;

  /**
   * Watch state keys for changes.
   * Keys support dot-path notation (e.g. `'user.name'`).
   * Handler receives `(newValue, oldValue)`.
   */
  watch?: Record<
    string,
    | ((this: ComponentInstance, newVal: any, oldVal: any) => void)
    | { handler: (this: ComponentInstance, newVal: any, oldVal: any) => void }
  >;

  /** Additional keys become instance methods (bound to the instance). */
  [method: string]: any;
}

/** The runtime instance of a mounted component. */
export interface ComponentInstance {
  /** Reactive state proxy. Mutating triggers re-render. */
  state: Record<string, any> & ReactiveProxy;

  /**
   * Frozen props passed from parent / router.
   * When mounted by the router, includes `$route`, `$query`, and `$params`.
   */
  readonly props: Readonly<
    Record<string, any> & {
      $route?: NavigationContext;
      $query?: Record<string, string>;
      $params?: Record<string, string>;
    }
  >;

  /** Map of `z-ref` name → DOM element. Populated after each render. */
  refs: Record<string, Element>;

  /** Keyed template map (when using multi-`templateUrl` or `pages`). */
  templates: Record<string, string>;

  /** Normalized page metadata (when using `pages` config). */
  pages: Array<{ id: string; label: string }>;

  /** Active page id derived from route param (when using `pages` config). */
  activePage: string;

  /**
   * Computed properties — lazy getters derived from state.
   * Defined via `computed` in the component definition.
   */
  readonly computed: Record<string, any>;

  /** Merge partial state (triggers re-render). */
  setState(partial: Record<string, any>): void;

  /** Dispatch a bubbling `CustomEvent` from the component root. */
  emit(name: string, detail?: any): void;

  /** Teardown: removes listeners, scoped styles, clears DOM. */
  destroy(): void;

  /**
   * Manually queue a re-render (microtask-batched).
   * Safe to call from anywhere — state mutations during render are coalesced.
   */
  _scheduleUpdate(): void;

  /** Any user-defined methods from the component definition. */
  [method: string]: any;
}

/**
 * Register a new component.
 * @param name Must contain a hyphen (Web Component convention).
 * @param definition Component definition object.
 */
export function component(name: string, definition: ComponentDefinition): void;

/**
 * Mount a registered component into a target element.
 * @returns The component instance.
 */
export function mount(
  target: string | Element,
  componentName: string,
  props?: Record<string, any>,
): ComponentInstance;

/**
 * Scan `root` for elements whose tag matches a registered component and mount them.
 * @param root Defaults to `document.body`.
 */
export function mountAll(root?: Element): void;

/** Get the component instance mounted on `target`. */
export function getInstance(target: string | Element): ComponentInstance | null;

/** Destroy the component at the given target. */
export function destroy(target: string | Element): void;

/** Returns an object of all registered component definitions (for debugging). */
export function getRegistry(): Record<string, ComponentDefinition>;

/**
 * Pre-load external templates and styles for a registered component.
 * Useful for warming the cache before navigation to avoid blank flashes.
 * @param name Registered component name.
 */
export function prefetch(name: string): Promise<void>;

/** Handle returned by `$.style()`. */
export interface StyleHandle {
  /** Remove all injected `<link>` elements. */
  remove(): void;
  /** Resolves when all stylesheets have loaded. */
  ready: Promise<void>;
}

/** Options for `$.style()`. */
export interface StyleOptions {
  /** Hide page until loaded to prevent FOUC (default `true`). */
  critical?: boolean;
  /** Background color while hidden during critical load (default `'#0d1117'`). */
  bg?: string;
}

/**
 * Dynamically load global (unscoped) stylesheet file(s) into `<head>`.
 * Relative paths resolve relative to the calling file.
 */
export function style(urls: string | string[], opts?: StyleOptions): StyleHandle;
