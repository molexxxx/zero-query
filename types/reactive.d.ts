/**
 * Reactive primitives - deep proxies and signals.
 *
 * @module reactive
 */

/** Marker properties added to every reactive proxy. */
export interface ReactiveProxy<T extends object = object> {
  /** Always `true` - indicates this object is wrapped in a reactive Proxy. */
  readonly __isReactive: true;
  /** The original un-proxied object. */
  readonly __raw: T;
}

/**
 * Wrap an object in a deep Proxy that fires `onChange` on every set / delete.
 *
 * @param target   Plain object to make reactive.
 * @param onChange  Called with `(key, newValue, oldValue)` on every mutation.
 * @returns A proxied version of `target` with `__isReactive` and `__raw` markers.
 */
export function reactive<T extends object>(
  target: T,
  onChange: (key: string, value: any, oldValue: any) => void,
): T & ReactiveProxy<T>;

/**
 * A lightweight reactive primitive (inspired by Solid / Preact signals).
 *
 * Reading `.value` inside an `effect()` auto-subscribes to changes.
 * Writing `.value` triggers all subscribers and dependent effects.
 */
export class Signal<T = any> {
  constructor(value: T);

  /**
   * Get or set the current value.
   * The getter automatically tracks dependencies when accessed inside an `effect()`.
   */
  value: T;

  /** Read the current value *without* creating a subscription (no tracking). */
  peek(): T;

  /**
   * Manually subscribe to changes.
   * @returns An unsubscribe function.
   */
  subscribe(fn: () => void): () => void;

  toString(): string;
}

/** Create a new `Signal`. */
export function signal<T>(initial: T): Signal<T>;

/**
 * Create a derived signal that recomputes when its dependencies change.
 * The returned signal is effectively read-only.
 */
export function computed<T>(fn: () => T): Signal<T>;

/**
 * Create a side-effect that auto-subscribes to signals read during execution.
 * Re-runs automatically when any tracked signal changes.
 *
 * @param fn The effect function. Executed immediately on creation, then on signal changes.
 * @returns A dispose function - calling it stops tracking and prevents re-runs.
 *
 * @example
 * const count = signal(0);
 * const stop = effect(() => console.log(count.value)); // logs 0
 * count.value = 1; // logs 1
 * stop();          // effect no longer runs
 */
export function effect(fn: () => void): () => void;

/**
 * Batch multiple signal writes - subscribers and effects fire once at the end.
 * Nested batches are merged into the outermost one.
 *
 * @example
 * const a = signal(0);
 * const b = signal(0);
 * batch(() => {
 *   a.value = 1;
 *   b.value = 2;
 * }); // effects run once with both values updated
 */
export function batch<R = void>(fn: () => R): R;

/**
 * Execute a function without tracking signal reads as dependencies.
 * Useful inside effects when you need to read a signal without subscribing.
 *
 * @returns The return value of `fn`.
 */
export function untracked<T>(fn: () => T): T;
