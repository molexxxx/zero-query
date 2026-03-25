/**
 * Structured error handling - error codes, error class, and global handler.
 *
 * @module errors
 */

/** All structured error codes used by zQuery. */
export declare const ErrorCode: {
  // Reactive
  readonly REACTIVE_CALLBACK: 'ZQ_REACTIVE_CALLBACK';
  readonly SIGNAL_CALLBACK: 'ZQ_SIGNAL_CALLBACK';
  readonly EFFECT_EXEC: 'ZQ_EFFECT_EXEC';

  // Expression parser
  readonly EXPR_PARSE: 'ZQ_EXPR_PARSE';
  readonly EXPR_EVAL: 'ZQ_EXPR_EVAL';
  readonly EXPR_UNSAFE_ACCESS: 'ZQ_EXPR_UNSAFE_ACCESS';

  // Component
  readonly COMP_INVALID_NAME: 'ZQ_COMP_INVALID_NAME';
  readonly COMP_NOT_FOUND: 'ZQ_COMP_NOT_FOUND';
  readonly COMP_MOUNT_TARGET: 'ZQ_COMP_MOUNT_TARGET';
  readonly COMP_RENDER: 'ZQ_COMP_RENDER';
  readonly COMP_LIFECYCLE: 'ZQ_COMP_LIFECYCLE';
  readonly COMP_RESOURCE: 'ZQ_COMP_RESOURCE';
  readonly COMP_DIRECTIVE: 'ZQ_COMP_DIRECTIVE';

  // Router
  readonly ROUTER_LOAD: 'ZQ_ROUTER_LOAD';
  readonly ROUTER_GUARD: 'ZQ_ROUTER_GUARD';
  readonly ROUTER_RESOLVE: 'ZQ_ROUTER_RESOLVE';

  // Store
  readonly STORE_ACTION: 'ZQ_STORE_ACTION';
  readonly STORE_MIDDLEWARE: 'ZQ_STORE_MIDDLEWARE';
  readonly STORE_SUBSCRIBE: 'ZQ_STORE_SUBSCRIBE';

  // HTTP
  readonly HTTP_REQUEST: 'ZQ_HTTP_REQUEST';
  readonly HTTP_TIMEOUT: 'ZQ_HTTP_TIMEOUT';
  readonly HTTP_INTERCEPTOR: 'ZQ_HTTP_INTERCEPTOR';
  readonly HTTP_PARSE: 'ZQ_HTTP_PARSE';

  // SSR
  readonly SSR_RENDER: 'ZQ_SSR_RENDER';
  readonly SSR_COMPONENT: 'ZQ_SSR_COMPONENT';
  readonly SSR_HYDRATION: 'ZQ_SSR_HYDRATION';
  readonly SSR_PAGE: 'ZQ_SSR_PAGE';

  // General
  readonly INVALID_ARGUMENT: 'ZQ_INVALID_ARGUMENT';
};

/** Union of all error code string values. */
export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Structured error class used throughout zQuery. */
export class ZQueryError extends Error {
  readonly name: 'ZQueryError';
  /** Machine-readable error code (e.g. `'ZQ_COMP_RENDER'`). */
  readonly code: ErrorCodeValue;
  /** Extra contextual data (component name, expression string, etc.). */
  readonly context: Record<string, any>;
  /** Original error that caused this one, if any. */
  readonly cause?: Error;

  constructor(
    code: ErrorCodeValue,
    message: string,
    context?: Record<string, any>,
    cause?: Error,
  );
}

/** Error handler callback type. */
export type ZQueryErrorHandler = (error: ZQueryError) => void;

/**
 * Register a global error handler. Called whenever zQuery catches an
 * error internally. Multiple handlers are supported. Pass `null` to clear all.
 * @returns Unsubscribe function to remove this handler.
 */
export function onError(handler: ZQueryErrorHandler | null): () => void;

/**
 * Report an error through the global handler and console.
 * Non-throwing - used for recoverable errors in callbacks, lifecycle hooks, etc.
 */
export function reportError(
  code: ErrorCodeValue,
  message: string,
  context?: Record<string, any>,
  cause?: Error,
): void;

/**
 * Wrap a callback so that thrown errors are caught, reported via `reportError`,
 * and don't crash the current execution context.
 */
export function guardCallback<T extends (...args: any[]) => any>(
  fn: T,
  code: ErrorCodeValue,
  context?: Record<string, any>,
): (...args: Parameters<T>) => ReturnType<T> | undefined;

/**
 * Validate a required value is defined and of the expected type.
 * Throws `ZQueryError` with `INVALID_ARGUMENT` on failure.
 */
export function validate(value: any, name: string, expectedType?: string): void;

/** Formatted error structure for overlays and logging. */
export interface FormattedError {
  code: string;
  type: string;
  message: string;
  context: Record<string, any>;
  stack: string;
  cause: FormattedError | null;
}

/**
 * Format a ZQueryError into a structured object suitable for overlays/logging.
 */
export function formatError(err: ZQueryError | Error): FormattedError;

/**
 * Async version of guardCallback - wraps an async function so that
 * rejections are caught, reported, and don't crash execution.
 */
export function guardAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  code: ErrorCodeValue,
  context?: Record<string, any>,
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>> | undefined>;
