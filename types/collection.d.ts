/**
 * ZQueryCollection — chainable DOM element wrapper.
 *
 * Returned by `$()`, `$.all()`, `$.create()`, and many traversal methods.
 * Similar to a jQuery object: wraps an array of elements with fluent methods.
 *
 * @module collection
 */

/**
 * Chainable wrapper around an array of DOM elements, similar to a jQuery object.
 * Returned by `$.all()` and many traversal / filtering methods.
 */
export class ZQueryCollection {
  /** Number of elements in the collection. */
  readonly length: number;

  /** Access element by numeric index. */
  readonly [index: number]: Element;

  constructor(elements: Element | Element[]);

  // -- Iteration -----------------------------------------------------------

  /**
   * Iterate over each element. `this` inside the callback is the element.
   * @returns The collection (for chaining).
   */
  each(fn: (this: Element, index: number, element: Element) => void): this;

  /**
   * Map over elements and return a plain array.
   */
  map<T>(fn: (this: Element, index: number, element: Element) => T): T[];

  /**
   * Iterate elements with Array-style `forEach`. Returns `this` for chaining.
   */
  forEach(fn: (element: Element, index: number, elements: Element[]) => void): this;

  /** First raw element, or `null`. */
  first(): Element | null;

  /** Last raw element, or `null`. */
  last(): Element | null;

  /** New collection containing only the element at `index`. */
  eq(index: number): ZQueryCollection;

  /** Convert to a plain `Element[]`. */
  toArray(): Element[];

  /** Iterable protocol — works with `for...of` and spread. */
  [Symbol.iterator](): IterableIterator<Element>;

  // -- Traversal -----------------------------------------------------------

  /** Descendants matching `selector`. */
  find(selector: string): ZQueryCollection;

  /** Unique parent elements. */
  parent(): ZQueryCollection;

  /** Nearest ancestor matching `selector`. */
  closest(selector: string): ZQueryCollection;

  /** Direct children, optionally filtered by `selector`. */
  children(selector?: string): ZQueryCollection;

  /** All sibling elements. */
  siblings(): ZQueryCollection;

  /** Next sibling of each element, optionally filtered by selector. */
  next(selector?: string): ZQueryCollection;

  /** Previous sibling of each element, optionally filtered by selector. */
  prev(selector?: string): ZQueryCollection;

  /** All following siblings, optionally filtered by selector. */
  nextAll(selector?: string): ZQueryCollection;

  /** Following siblings up to (but not including) the element matching `selector`. */
  nextUntil(selector?: string, filter?: string): ZQueryCollection;

  /** All preceding siblings, optionally filtered by selector. */
  prevAll(selector?: string): ZQueryCollection;

  /** Preceding siblings up to (but not including) the element matching `selector`. */
  prevUntil(selector?: string, filter?: string): ZQueryCollection;

  /** All ancestor elements, optionally filtered by selector (deduplicated). */
  parents(selector?: string): ZQueryCollection;

  /** Ancestors up to (but not including) the element matching `selector`. */
  parentsUntil(selector?: string, filter?: string): ZQueryCollection;

  /** All child nodes including text and comment nodes. */
  contents(): ZQueryCollection;

  // -- Filtering -----------------------------------------------------------

  /** Keep elements matching a CSS selector or predicate. */
  filter(selector: string): ZQueryCollection;
  filter(fn: (element: Element, index: number) => boolean): ZQueryCollection;

  /** Remove elements matching a CSS selector or predicate. */
  not(selector: string): ZQueryCollection;
  not(fn: (this: Element, index: number, element: Element) => boolean): ZQueryCollection;

  /** Keep elements that have a descendant matching `selector`. */
  has(selector: string): ZQueryCollection;

  /** Check if any element matches the selector or predicate. */
  is(selector: string): boolean;
  is(fn: (this: Element, index: number, element: Element) => boolean): boolean;

  /** Return a subset of the collection. */
  slice(start: number, end?: number): ZQueryCollection;

  /** Add elements to the collection, returning a new combined collection. */
  add(selector: string, context?: Element | Document): ZQueryCollection;
  add(element: Element): ZQueryCollection;
  add(collection: ZQueryCollection): ZQueryCollection;

  /** Retrieve a raw DOM element by index (supports negative). No args → array of all elements. */
  get(): Element[];
  get(index: number): Element | undefined;

  /** Position of the first element among its siblings, or index of a given element/selector in the collection. */
  index(selector?: string | Element): number;

  // -- Classes -------------------------------------------------------------

  /** Add one or more classes (space-separated strings accepted). */
  addClass(...names: string[]): this;

  /** Remove one or more classes. */
  removeClass(...names: string[]): this;

  /** Toggle one or more classes (space-separated strings accepted). Optional trailing `force` boolean. */
  toggleClass(...names: Array<string | boolean>): this;

  /** Check whether the first element has the given class. */
  hasClass(name: string): boolean;

  // -- Attributes & Properties ---------------------------------------------

  /** Get attribute value of the first element. */
  attr(name: string): string | null;
  /** Set attribute on all elements. */
  attr(name: string, value: string): this;

  /** Remove attribute from all elements. */
  removeAttr(name: string): this;

  /** Get JS property of the first element. */
  prop(name: string): any;
  /** Set JS property on all elements. */
  prop(name: string, value: any): this;

  /** Get data attribute value (JSON auto-parsed). No key → full dataset. */
  data(): DOMStringMap;
  data(key: string): any;
  /** Set data attribute on all elements. Objects are JSON-stringified. */
  data(key: string, value: any): this;

  // -- CSS & Dimensions ----------------------------------------------------

  /** Get computed style property of the first element, or `undefined` if empty. */
  css(property: string): string | undefined;
  /** Set inline styles on all elements. */
  css(props: Partial<CSSStyleDeclaration>): this;

  /** First element's width (from `getBoundingClientRect`). */
  width(): number | undefined;

  /** First element's height. */
  height(): number | undefined;

  /** Position relative to the document. */
  offset(): { top: number; left: number; width: number; height: number } | null;

  /** Position relative to the offset parent. */
  position(): { top: number; left: number } | null;

  /** Get vertical scroll position of the first element. */
  scrollTop(): number | undefined;
  /** Set vertical scroll position on all elements. */
  scrollTop(value: number): this;

  /** Get horizontal scroll position of the first element. */
  scrollLeft(): number | undefined;
  /** Set horizontal scroll position on all elements. */
  scrollLeft(value: number): this;

  /** Width including padding (clientWidth). */
  innerWidth(): number | undefined;

  /** Height including padding (clientHeight). */
  innerHeight(): number | undefined;

  /** Width including padding + border. Pass `true` to include margin. */
  outerWidth(includeMargin?: boolean): number | undefined;

  /** Height including padding + border. Pass `true` to include margin. */
  outerHeight(includeMargin?: boolean): number | undefined;

  // -- Content -------------------------------------------------------------

  /** Get `innerHTML` of the first element, or `undefined` if empty. */
  html(): string | undefined;
  /**
   * Set content on all elements. Auto-morphs when the element already has
   * children (preserves focus, scroll, form state, keyed reorder via LIS).
   * Empty elements receive raw `innerHTML` for fast first-paint.
   * Use `empty().html(content)` to force raw innerHTML.
   */
  html(content: string): this;

  /**
   * Morph all elements' children to match new HTML using the diff engine.
   * Always morphs regardless of whether the element already has children.
   */
  morph(content: string): this;

  /** Get `textContent` of the first element, or `undefined` if empty. */
  text(): string | undefined;
  /** Set `textContent` on all elements. */
  text(content: string): this;

  /** Get value of the first input/select/textarea, or `undefined` if empty. */
  val(): string | undefined;
  /** Set value on all inputs. */
  val(value: string): this;

  // -- DOM Manipulation ----------------------------------------------------

  /** Insert content at the end of each element. */
  append(content: string | Node | ZQueryCollection): this;

  /** Insert content at the beginning of each element. */
  prepend(content: string | Node): this;

  /** Insert content after each element. */
  after(content: string | Node): this;

  /** Insert content before each element. */
  before(content: string | Node): this;

  /** Wrap each element with the given HTML string or Node. */
  wrap(wrapper: string | Node): this;

  /** Remove all elements from the DOM. */
  remove(): this;

  /** Clear `innerHTML` of all elements. */
  empty(): this;

  /** Clone elements (default: deep clone). */
  clone(deep?: boolean): ZQueryCollection;

  /**
   * Replace elements with new content. When given an HTML string with the
   * same tag name, morphs the element in place (preserving identity and state).
   * Falls back to full replacement when the tag name differs or content is a Node.
   */
  replaceWith(content: string | Node): this;

  /** Insert every element in the collection at the end of the target. */
  appendTo(target: string | Element | ZQueryCollection): this;

  /** Insert every element in the collection at the beginning of the target. */
  prependTo(target: string | Element | ZQueryCollection): this;

  /** Insert every element in the collection after the target. */
  insertAfter(target: string | Element | ZQueryCollection): this;

  /** Insert every element in the collection before the target. */
  insertBefore(target: string | Element | ZQueryCollection): this;

  /** Replace the target elements with the collection's elements. */
  replaceAll(target: string | Element | ZQueryCollection): this;

  /** Remove the parent of each element, optionally only if it matches `selector`. */
  unwrap(selector?: string): this;

  /** Wrap all elements together in a single wrapper. */
  wrapAll(wrapper: string | Element): this;

  /** Wrap the inner contents of each element with the given wrapper. */
  wrapInner(wrapper: string | Element): this;

  /** Remove all elements from the DOM (alias for `remove`). */
  detach(): this;

  // -- Visibility ----------------------------------------------------------

  /** Show elements. Optional display value (default: `''`). */
  show(display?: string): this;

  /** Set `display: none` on all elements. */
  hide(): this;

  /** Toggle visibility. */
  toggle(display?: string): this;

  // -- Events --------------------------------------------------------------

  /** Attach event handler. Space-separated events accepted. */
  on(events: string, handler: (event: Event) => void): this;
  /** Delegated event handler. */
  on(events: string, selector: string, handler: (this: Element, event: Event) => void): this;

  /** Remove event handler. */
  off(events: string, handler: (event: Event) => void): this;

  /** One-time event handler. */
  one(event: string, handler: (event: Event) => void): this;

  /**
   * Dispatch a `CustomEvent` with optional detail payload.
   * Bubbles by default.
   */
  trigger(event: string, detail?: any): this;

  /** Attach click handler, or trigger a click when called with no arguments. */
  click(fn?: (event: Event) => void): this;

  /** Attach submit handler, or trigger submit when called with no arguments. */
  submit(fn?: (event: Event) => void): this;

  /** Focus the first element. */
  focus(): this;

  /** Blur the first element. */
  blur(): this;

  /** Bind mouseenter and mouseleave handlers. If only one function is provided, it's used for both. */
  hover(enterFn: (event: Event) => void, leaveFn?: (event: Event) => void): this;

  // -- Animation -----------------------------------------------------------

  /**
   * CSS transition animation.
   * @param props   CSS properties to animate to.
   * @param duration Duration in ms (default 300).
   * @param easing  CSS easing function (default `'ease'`).
   */
  animate(
    props: Partial<CSSStyleDeclaration>,
    duration?: number,
    easing?: string,
  ): Promise<ZQueryCollection>;

  /** Fade in (opacity 0→1). Default 300 ms. */
  fadeIn(duration?: number): Promise<ZQueryCollection>;

  /** Fade out (opacity 1→0) then hide. Default 300 ms. */
  fadeOut(duration?: number): Promise<ZQueryCollection>;

  /** Toggle fade in/out. Default 300 ms. */
  fadeToggle(duration?: number): Promise<ZQueryCollection>;

  /** Fade to a specific opacity. */
  fadeTo(duration: number, opacity: number): Promise<ZQueryCollection>;

  /** Slide down (reveal). Default 300 ms. */
  slideDown(duration?: number): this;

  /** Slide up (hide). Default 300 ms. */
  slideUp(duration?: number): this;

  /** Toggle height with a slide animation. Default 300 ms. */
  slideToggle(duration?: number): this;

  // -- Form Helpers --------------------------------------------------------

  /** URL-encoded form data string. */
  serialize(): string;

  /** Form data as key/value object. Duplicate keys become arrays. */
  serializeObject(): Record<string, string | string[]>;
}
