/**
 * zQuery Errors — Structured error handling system
 *
 * Provides typed error classes and a configurable error handler so that
 * errors surface consistently across all modules (reactive, component,
 * router, store, expression parser, HTTP, etc.).
 *
 * Default behaviour: errors are logged via console.warn/error.
 * Users can override with $.onError(handler) to integrate with their
 * own logging, crash-reporting, or UI notification system.
 */

// ---------------------------------------------------------------------------
// Error codes — every zQuery error has a unique code for programmatic use
// ---------------------------------------------------------------------------
export const ErrorCode = Object.freeze({
  // Reactive
  REACTIVE_CALLBACK:   'ZQ_REACTIVE_CALLBACK',
  SIGNAL_CALLBACK:     'ZQ_SIGNAL_CALLBACK',
  EFFECT_EXEC:         'ZQ_EFFECT_EXEC',

  // Expression parser
  EXPR_PARSE:          'ZQ_EXPR_PARSE',
  EXPR_EVAL:           'ZQ_EXPR_EVAL',
  EXPR_UNSAFE_ACCESS:  'ZQ_EXPR_UNSAFE_ACCESS',

  // Component
  COMP_INVALID_NAME:   'ZQ_COMP_INVALID_NAME',
  COMP_NOT_FOUND:      'ZQ_COMP_NOT_FOUND',
  COMP_MOUNT_TARGET:   'ZQ_COMP_MOUNT_TARGET',
  COMP_RENDER:         'ZQ_COMP_RENDER',
  COMP_LIFECYCLE:      'ZQ_COMP_LIFECYCLE',
  COMP_RESOURCE:       'ZQ_COMP_RESOURCE',
  COMP_DIRECTIVE:      'ZQ_COMP_DIRECTIVE',

  // Router
  ROUTER_LOAD:         'ZQ_ROUTER_LOAD',
  ROUTER_GUARD:        'ZQ_ROUTER_GUARD',
  ROUTER_RESOLVE:      'ZQ_ROUTER_RESOLVE',

  // Store
  STORE_ACTION:        'ZQ_STORE_ACTION',
  STORE_MIDDLEWARE:     'ZQ_STORE_MIDDLEWARE',
  STORE_SUBSCRIBE:     'ZQ_STORE_SUBSCRIBE',

  // HTTP
  HTTP_REQUEST:        'ZQ_HTTP_REQUEST',
  HTTP_TIMEOUT:        'ZQ_HTTP_TIMEOUT',
  HTTP_INTERCEPTOR:    'ZQ_HTTP_INTERCEPTOR',
  HTTP_PARSE:          'ZQ_HTTP_PARSE',

  // General
  INVALID_ARGUMENT:    'ZQ_INVALID_ARGUMENT',
});


// ---------------------------------------------------------------------------
// ZQueryError — custom error class
// ---------------------------------------------------------------------------
export class ZQueryError extends Error {
  /**
   * @param {string} code    — one of ErrorCode values
   * @param {string} message — human-readable description
   * @param {object} [context] — extra data (component name, expression, etc.)
   * @param {Error}  [cause]   — original error
   */
  constructor(code, message, context = {}, cause) {
    super(message);
    this.name = 'ZQueryError';
    this.code = code;
    this.context = context;
    if (cause) this.cause = cause;
  }
}


// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
let _errorHandler = null;

/**
 * Register a global error handler.
 * Called whenever zQuery catches an error internally.
 *
 * @param {Function|null} handler — (error: ZQueryError) => void
 */
export function onError(handler) {
  _errorHandler = typeof handler === 'function' ? handler : null;
}

/**
 * Report an error through the global handler and console.
 * Non-throwing — used for recoverable errors in callbacks, lifecycle hooks, etc.
 *
 * @param {string} code — ErrorCode
 * @param {string} message
 * @param {object} [context]
 * @param {Error} [cause]
 */
export function reportError(code, message, context = {}, cause) {
  const err = cause instanceof ZQueryError
    ? cause
    : new ZQueryError(code, message, context, cause);

  // User handler gets first crack
  if (_errorHandler) {
    try { _errorHandler(err); } catch { /* prevent handler from crashing framework */ }
  }

  // Always log for developer visibility
  console.error(`[zQuery ${code}] ${message}`, context, cause || '');
}

/**
 * Wrap a callback so that thrown errors are caught, reported, and don't crash
 * the current execution context.
 *
 * @param {Function} fn
 * @param {string} code — ErrorCode to use if the callback throws
 * @param {object} [context]
 * @returns {Function}
 */
export function guardCallback(fn, code, context = {}) {
  return (...args) => {
    try {
      return fn(...args);
    } catch (err) {
      reportError(code, err.message || 'Callback error', context, err);
    }
  };
}

/**
 * Validate a required value is defined and of the expected type.
 * Throws ZQueryError on failure (for fast-fail at API boundaries).
 *
 * @param {*} value
 * @param {string} name — parameter name for error message
 * @param {string} expectedType — 'string', 'function', 'object', etc.
 */
export function validate(value, name, expectedType) {
  if (value === undefined || value === null) {
    throw new ZQueryError(
      ErrorCode.INVALID_ARGUMENT,
      `"${name}" is required but got ${value}`
    );
  }
  if (expectedType && typeof value !== expectedType) {
    throw new ZQueryError(
      ErrorCode.INVALID_ARGUMENT,
      `"${name}" must be a ${expectedType}, got ${typeof value}`
    );
  }
}
