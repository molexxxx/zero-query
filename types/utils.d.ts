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

// ---------------------------------------------------------------------------
// Array Utilities
// ---------------------------------------------------------------------------

/**
 * Generate a range of numbers.
 * - `range(n)` → `[0, 1, ..., n-1]`
 * - `range(start, end)` → `[start, start+1, ..., end-1]`
 * - `range(start, end, step)` → stepped range
 */
export function range(end: number): number[];
export function range(start: number, end: number, step?: number): number[];

/** Deduplicate an array. Optional `keyFn` for object identity. */
export function unique<T>(arr: T[], keyFn?: (item: T) => any): T[];

/** Split an array into chunks of `size`. */
export function chunk<T>(arr: T[], size: number): T[][];

/** Group array elements by a key function. */
export function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]>;

// ---------------------------------------------------------------------------
// Object Utilities (extended)
// ---------------------------------------------------------------------------

/** Pick specified keys from an object. */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>;

/** Omit specified keys from an object. */
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K>;

/** Get a deeply nested value by dot-path string. */
export function getPath<T = any>(obj: any, path: string, fallback?: T): T;

/** Set a deeply nested value by dot-path string. Returns the object. */
export function setPath<T extends object>(obj: T, path: string, value: any): T;

/** Check if a value is empty (null, undefined, '', [], {}, empty Map/Set). */
export function isEmpty(val: any): boolean;

// ---------------------------------------------------------------------------
// String Utilities (extended)
// ---------------------------------------------------------------------------

/** Capitalize the first letter and lowercase the rest. */
export function capitalize(str: string): string;

/** Truncate a string to `maxLen`, appending `suffix` (default `'…'`). */
export function truncate(str: string, maxLen: number, suffix?: string): string;

// ---------------------------------------------------------------------------
// Number Utilities
// ---------------------------------------------------------------------------

/** Clamp a number between `min` and `max` (inclusive). */
export function clamp(val: number, min: number, max: number): number;

// ---------------------------------------------------------------------------
// Function Utilities (extended)
// ---------------------------------------------------------------------------

/** Memoized function with `.clear()` to reset cache. */
export interface MemoizedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): ReturnType<T>;
  clear(): void;
}

/**
 * Memoize a function. Supports custom key function or `{ maxSize }` option.
 */
export function memoize<T extends (...args: any[]) => any>(fn: T, keyFn?: (...args: Parameters<T>) => any): MemoizedFunction<T>;
export function memoize<T extends (...args: any[]) => any>(fn: T, opts?: { maxSize?: number }): MemoizedFunction<T>;

// ---------------------------------------------------------------------------
// Async Utilities
// ---------------------------------------------------------------------------

/** Options for `retry`. */
export interface RetryOptions {
  /** Max attempts (default `3`). */
  attempts?: number;
  /** Initial delay in ms (default `1000`). */
  delay?: number;
  /** Backoff multiplier (default `1`). */
  backoff?: number;
}

/**
 * Retry an async function with configurable backoff.
 * The function receives the current attempt number (1-based).
 */
export function retry<T>(fn: (attempt: number) => Promise<T>, opts?: RetryOptions): Promise<T>;

/**
 * Race a promise against a timeout.
 * Rejects with an Error if the timeout is reached first.
 */
export function timeout<T>(promise: Promise<T>, ms: number, message?: string): Promise<T>;
