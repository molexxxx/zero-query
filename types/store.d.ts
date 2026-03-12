/**
 * Store — reactive global state management.
 *
 * @module store
 */

import type { ReactiveProxy } from './reactive';

/** Store configuration. */
export interface StoreConfig<
  S extends Record<string, any> = Record<string, any>,
  A extends Record<string, (state: S, ...args: any[]) => any> = Record<string, (state: S, ...args: any[]) => any>,
  G extends Record<string, (state: S) => any> = Record<string, (state: S) => any>,
> {
  /** Initial state. Function form creates a fresh copy. */
  state?: S | (() => S);

  /** Named action functions. The first argument is always the reactive `state`. */
  actions?: A;

  /** Computed getters derived from state (lazily evaluated). */
  getters?: G;

  /** Log dispatched actions to the console. */
  debug?: boolean;

  /** Maximum number of action history entries to keep (default `1000`). */
  maxHistory?: number;
}

/** A store action history entry. */
export interface StoreHistoryEntry {
  action: string;
  args: any[];
  timestamp: number;
}

/** The reactive store instance. */
export interface StoreInstance<
  S extends Record<string, any> = Record<string, any>,
  A extends Record<string, (state: S, ...args: any[]) => any> = Record<string, (state: S, ...args: any[]) => any>,
  G extends Record<string, (state: S) => any> = Record<string, (state: S) => any>,
> {
  /** Reactive state proxy. Read / write triggers subscriptions. */
  state: S & ReactiveProxy<S>;

  /** Computed getters object. */
  readonly getters: { readonly [K in keyof G]: ReturnType<G[K]> };

  /** Log of all dispatched actions. */
  readonly history: ReadonlyArray<StoreHistoryEntry>;

  /**
   * Execute a named action.
   * @returns The action's return value.
   */
  dispatch<K extends keyof A>(
    name: K,
    ...args: A[K] extends (state: any, ...rest: infer P) => any ? P : any[]
  ): ReturnType<A[K]>;
  dispatch(name: string, ...args: any[]): any;

  /**
   * Subscribe to changes on a specific state key.
   * Callback receives `(newValue, oldValue, key)`.
   * @returns An unsubscribe function.
   */
  subscribe(key: string, fn: (value: any, oldValue: any, key: string) => void): () => void;

  /**
   * Subscribe to all state changes (wildcard).
   * Callback receives `(key, newValue, oldValue)`.
   * @returns An unsubscribe function.
   */
  subscribe(fn: (key: string, value: any, oldValue: any) => void): () => void;

  /** Deep clone of the current state. */
  snapshot(): S;

  /** Replace the entire state. */
  replaceState(newState: Partial<S>): void;

  /**
   * Add middleware. Return `false` from `fn` to block the action.
   * Chainable.
   */
  use(fn: (actionName: string, args: any[], state: S) => boolean | void): StoreInstance<S, A, G>;

  /** Replace state and clear action history. */
  reset(initialState: Partial<S>): void;
}

/** Create a new global reactive store. */
export function createStore<
  S extends Record<string, any>,
  A extends Record<string, (state: S, ...args: any[]) => any>,
  G extends Record<string, (state: S) => any>,
>(config: StoreConfig<S, A, G>): StoreInstance<S, A, G>;
export function createStore<
  S extends Record<string, any>,
  A extends Record<string, (state: S, ...args: any[]) => any>,
  G extends Record<string, (state: S) => any>,
>(name: string, config: StoreConfig<S, A, G>): StoreInstance<S, A, G>;

/** Retrieve a previously created store by name (default: `'default'`). */
export function getStore<
  S extends Record<string, any> = Record<string, any>,
  A extends Record<string, (state: S, ...args: any[]) => any> = Record<string, (state: S, ...args: any[]) => any>,
  G extends Record<string, (state: S) => any> = Record<string, (state: S) => any>,
>(name?: string): StoreInstance<S, A, G> | null;
