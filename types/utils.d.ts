/**
 * Utility functions — debounce, throttle, strings, objects, URL, storage, event bus.
 *
 * @module utils
 */

// ---------------------------------------------------------------------------
// Function Utilities
// ---------------------------------------------------------------------------

/** Debounced function with a `.cancel()` helper. */
export interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  /** Cancel the pending invocation. */
  cancel(): void;
}

/**
 * Returns a debounced function that delays execution until `ms` ms of inactivity.
 * @param ms Default `250`.
 */
export function debounce<T extends (...args: any[]) => any>(fn: T, ms?: number): DebouncedFunction<T>;

/**
 * Returns a throttled function that executes at most once per `ms` ms.
 * The return value of the original function is discarded.
 * @param ms Default `250`.
 */
export function throttle<T extends (...args: any[]) => any>(fn: T, ms?: number): (...args: Parameters<T>) => void;

/** Left-to-right function composition. */
export function pipe<A, B>(f1: (a: A) => B): (input: A) => B;
export function pipe<A, B, C>(f1: (a: A) => B, f2: (b: B) => C): (input: A) => C;
export function pipe<A, B, C, D>(f1: (a: A) => B, f2: (b: B) => C, f3: (c: C) => D): (input: A) => D;
export function pipe<A, B, C, D, E>(f1: (a: A) => B, f2: (b: B) => C, f3: (c: C) => D, f4: (d: D) => E): (input: A) => E;
export function pipe<T>(...fns: Array<(value: any) => any>): (input: T) => any;

/** Returns a function that only executes once, caching the result. */
export function once<T extends (...args: any[]) => any>(fn: T): (...args: Parameters<T>) => ReturnType<T>;

/** Returns a `Promise` that resolves after `ms` milliseconds. */
export function sleep(ms: number): Promise<void>;

// ---------------------------------------------------------------------------
// String Utilities
// ---------------------------------------------------------------------------

/** Escape HTML entities: `&`, `<`, `>`, `"`, `'`. */
export function escapeHtml(str: string): string;

/**
 * Tagged template literal that auto-escapes interpolated values.
 * Use `$.trust()` to mark values as safe.
 */
export function html(strings: TemplateStringsArray, ...values: any[]): string;

/** Wrapper that marks an HTML string as trusted (not escaped by `$.html`). */
export interface TrustedHTML {
  toString(): string;
}

/** Mark an HTML string as trusted so it won't be escaped in `$.html`. */
export function trust(htmlStr: string): TrustedHTML;

/** Generate a UUID v4 string. */
export function uuid(): string;

/** Convert kebab-case to camelCase. */
export function camelCase(str: string): string;

/** Convert camelCase to kebab-case. */
export function kebabCase(str: string): string;

// ---------------------------------------------------------------------------
// Object Utilities
// ---------------------------------------------------------------------------

/** Deep clone using `structuredClone` (JSON fallback). */
export function deepClone<T>(obj: T): T;

/** Recursively merge objects. Arrays are replaced, not merged. */
export function deepMerge<T extends object>(target: T, ...sources: Partial<T>[]): T;

/** Deep equality comparison. */
export function isEqual(a: any, b: any): boolean;

// ---------------------------------------------------------------------------
// URL Utilities
// ---------------------------------------------------------------------------

/** Serialize an object to a URL query string. */
export function param(obj: Record<string, any>): string;

/** Parse a URL query string into an object. */
export function parseQuery(str: string): Record<string, string>;

// ---------------------------------------------------------------------------
// Storage Wrappers
// ---------------------------------------------------------------------------

/** JSON-aware storage wrapper (localStorage or sessionStorage). */
export interface StorageWrapper {
  /**
   * Get and JSON-parse a value.
   * @param key    Storage key.
   * @param fallback Value returned if key is missing or parse fails (default `null`).
   */
  get<T = any>(key: string, fallback?: T): T;
  /** JSON-stringify and store. */
  set(key: string, value: any): void;
  /** Remove a key. */
  remove(key: string): void;
  /** Clear all entries. */
  clear(): void;
}

/** `localStorage` wrapper with auto JSON serialization. */
export declare const storage: StorageWrapper;

/** `sessionStorage` wrapper (same API as `storage`). */
export declare const session: StorageWrapper;

// ---------------------------------------------------------------------------
// Event Bus
// ---------------------------------------------------------------------------

/** Singleton pub/sub event bus for cross-component communication. */
export interface EventBus {
  /** Subscribe. Returns an unsubscribe function. */
  on(event: string, fn: (...args: any[]) => void): () => void;
  /** Unsubscribe a specific handler. */
  off(event: string, fn: (...args: any[]) => void): void;
  /** Emit an event with arguments. */
  emit(event: string, ...args: any[]): void;
  /** Subscribe for a single invocation. Returns an unsubscribe function. */
  once(event: string, fn: (...args: any[]) => void): () => void;
  /** Remove all listeners. */
  clear(): void;
}

/** Global event bus instance. */
export declare const bus: EventBus;
