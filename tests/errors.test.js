import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ZQueryError, ErrorCode, onError, reportError, guardCallback, validate } from '../src/errors.js';


// ---------------------------------------------------------------------------
// ZQueryError
// ---------------------------------------------------------------------------

describe('ZQueryError', () => {
  it('extends Error', () => {
    const err = new ZQueryError(ErrorCode.INVALID_ARGUMENT, 'test msg');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ZQueryError);
  });

  it('sets code, message, and context', () => {
    const err = new ZQueryError(ErrorCode.COMP_RENDER, 'render failed', { component: 'my-app' });
    expect(err.code).toBe('ZQ_COMP_RENDER');
    expect(err.message).toBe('render failed');
    expect(err.context.component).toBe('my-app');
    expect(err.name).toBe('ZQueryError');
  });

  it('stores cause', () => {
    const cause = new Error('original');
    const err = new ZQueryError(ErrorCode.HTTP_REQUEST, 'http error', {}, cause);
    expect(err.cause).toBe(cause);
  });
});


// ---------------------------------------------------------------------------
// ErrorCode
// ---------------------------------------------------------------------------

describe('ErrorCode', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(ErrorCode)).toBe(true);
  });

  it('contains expected codes', () => {
    expect(ErrorCode.REACTIVE_CALLBACK).toBe('ZQ_REACTIVE_CALLBACK');
    expect(ErrorCode.EXPR_PARSE).toBe('ZQ_EXPR_PARSE');
    expect(ErrorCode.COMP_NOT_FOUND).toBe('ZQ_COMP_NOT_FOUND');
    expect(ErrorCode.STORE_ACTION).toBe('ZQ_STORE_ACTION');
    expect(ErrorCode.HTTP_REQUEST).toBe('ZQ_HTTP_REQUEST');
    expect(ErrorCode.ROUTER_LOAD).toBe('ZQ_ROUTER_LOAD');
  });
});


// ---------------------------------------------------------------------------
// onError / reportError
// ---------------------------------------------------------------------------

describe('reportError', () => {
  let errorSpy;
  beforeEach(() => {
    onError(null); // reset handler
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    errorSpy.mockRestore();
    onError(null);
  });

  it('logs to console.error', () => {
    reportError(ErrorCode.STORE_ACTION, 'test error', { action: 'foo' });
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0][0]).toContain('ZQ_STORE_ACTION');
  });

  it('calls global error handler', () => {
    const handler = vi.fn();
    onError(handler);
    reportError(ErrorCode.COMP_RENDER, 'render failed');
    expect(handler).toHaveBeenCalledOnce();
    const err = handler.mock.calls[0][0];
    expect(err).toBeInstanceOf(ZQueryError);
    expect(err.code).toBe('ZQ_COMP_RENDER');
  });

  it('does not crash if handler throws', () => {
    onError(() => { throw new Error('handler error'); });
    expect(() => reportError(ErrorCode.COMP_RENDER, 'test')).not.toThrow();
  });

  it('passes cause through', () => {
    const handler = vi.fn();
    onError(handler);
    const cause = new Error('root cause');
    reportError(ErrorCode.HTTP_REQUEST, 'http failed', {}, cause);
    expect(handler.mock.calls[0][0].cause).toBe(cause);
  });
});


// ---------------------------------------------------------------------------
// guardCallback
// ---------------------------------------------------------------------------

describe('guardCallback', () => {
  let errorSpy;
  beforeEach(() => {
    onError(null);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('returns the same value as original function', () => {
    const guarded = guardCallback((x) => x * 2, ErrorCode.COMP_RENDER);
    expect(guarded(5)).toBe(10);
  });

  it('catches errors and reports them', () => {
    const handler = vi.fn();
    onError(handler);
    const guarded = guardCallback(() => { throw new Error('boom'); }, ErrorCode.COMP_RENDER, { component: 'test' });
    expect(() => guarded()).not.toThrow();
    expect(handler).toHaveBeenCalledOnce();
  });

  it('passes arguments through', () => {
    const guarded = guardCallback((a, b) => a + b, ErrorCode.COMP_RENDER);
    expect(guarded(1, 2)).toBe(3);
  });
});


// ---------------------------------------------------------------------------
// validate
// ---------------------------------------------------------------------------

describe('validate', () => {
  it('passes for valid values', () => {
    expect(() => validate('hello', 'name', 'string')).not.toThrow();
    expect(() => validate(42, 'count', 'number')).not.toThrow();
    expect(() => validate(() => {}, 'fn', 'function')).not.toThrow();
  });

  it('throws ZQueryError for null', () => {
    expect(() => validate(null, 'name', 'string')).toThrow(ZQueryError);
  });

  it('throws ZQueryError for undefined', () => {
    expect(() => validate(undefined, 'count')).toThrow(ZQueryError);
  });

  it('throws ZQueryError for wrong type', () => {
    expect(() => validate(42, 'name', 'string')).toThrow(ZQueryError);
  });

  it('error has INVALID_ARGUMENT code', () => {
    try {
      validate(null, 'param');
    } catch (err) {
      expect(err.code).toBe(ErrorCode.INVALID_ARGUMENT);
    }
  });
});


// ===========================================================================
// onError — clearing and edge cases
// ===========================================================================

describe('onError — edge cases', () => {
  afterEach(() => onError(null));

  it('passing null clears handler', () => {
    const spy = vi.fn();
    onError(spy);
    onError(null);
    reportError(ErrorCode.INVALID_ARGUMENT, 'test');
    expect(spy).not.toHaveBeenCalled();
  });

  it('passing non-function is treated as null', () => {
    const spy = vi.fn();
    onError(spy);
    onError('not a function');
    reportError(ErrorCode.INVALID_ARGUMENT, 'test');
    expect(spy).not.toHaveBeenCalled();
  });

  it('handler exceptions do not crash reportError', () => {
    onError(() => { throw new Error('handler crash'); });
    expect(() => reportError(ErrorCode.INVALID_ARGUMENT, 'test')).not.toThrow();
  });
});


// ===========================================================================
// reportError — cause reuse
// ===========================================================================

describe('reportError — cause handling', () => {
  afterEach(() => onError(null));

  it('reuses ZQueryError cause directly', () => {
    const causes = [];
    onError((err) => causes.push(err));
    const existing = new ZQueryError(ErrorCode.COMP_RENDER, 'original');
    reportError(ErrorCode.COMP_RENDER, 'wrapped', {}, existing);
    expect(causes[0]).toBe(existing);
  });

  it('wraps non-ZQueryError cause', () => {
    const causes = [];
    onError((err) => causes.push(err));
    const original = new Error('plain error');
    reportError(ErrorCode.COMP_RENDER, 'wrapped', {}, original);
    expect(causes[0]).toBeInstanceOf(ZQueryError);
    expect(causes[0].cause).toBe(original);
  });
});


// ===========================================================================
// guardCallback
// ===========================================================================

describe('guardCallback — edge cases', () => {
  afterEach(() => onError(null));

  it('returns function result on success', () => {
    const guarded = guardCallback(() => 42, ErrorCode.INVALID_ARGUMENT);
    expect(guarded()).toBe(42);
  });

  it('returns undefined on error', () => {
    const guarded = guardCallback(() => { throw new Error('bang'); }, ErrorCode.INVALID_ARGUMENT);
    expect(guarded()).toBeUndefined();
  });

  it('passes arguments through', () => {
    const guarded = guardCallback((a, b) => a + b, ErrorCode.INVALID_ARGUMENT);
    expect(guarded(2, 3)).toBe(5);
  });
});


// ===========================================================================
// validate — edge cases
// ===========================================================================

describe('validate — edge cases', () => {
  it('validates without expectedType (null/undefined only)', () => {
    expect(() => validate(null, 'x')).toThrow();
    expect(() => validate(undefined, 'x')).toThrow();
    expect(() => validate(0, 'x')).not.toThrow();
    expect(() => validate('', 'x')).not.toThrow();
    expect(() => validate(false, 'x')).not.toThrow();
  });
});


// ===========================================================================
// ZQueryError — structure
// ===========================================================================

describe('ZQueryError — structure', () => {
  it('has correct name', () => {
    const err = new ZQueryError(ErrorCode.INVALID_ARGUMENT, 'test');
    expect(err.name).toBe('ZQueryError');
  });

  it('has empty context by default', () => {
    const err = new ZQueryError(ErrorCode.INVALID_ARGUMENT, 'test');
    expect(err.context).toEqual({});
  });

  it('stores cause when provided', () => {
    const cause = new Error('root');
    const err = new ZQueryError(ErrorCode.INVALID_ARGUMENT, 'test', {}, cause);
    expect(err.cause).toBe(cause);
  });

  it('has no cause property when not provided', () => {
    const err = new ZQueryError(ErrorCode.INVALID_ARGUMENT, 'test');
    expect(err.cause).toBeUndefined();
  });
});


// ===========================================================================
// ErrorCode — completeness
// ===========================================================================

describe('ErrorCode — all codes defined', () => {
  it('has reactive codes', () => {
    expect(ErrorCode.REACTIVE_CALLBACK).toBe('ZQ_REACTIVE_CALLBACK');
    expect(ErrorCode.SIGNAL_CALLBACK).toBe('ZQ_SIGNAL_CALLBACK');
    expect(ErrorCode.EFFECT_EXEC).toBe('ZQ_EFFECT_EXEC');
  });

  it('has expression codes', () => {
    expect(ErrorCode.EXPR_PARSE).toBe('ZQ_EXPR_PARSE');
    expect(ErrorCode.EXPR_EVAL).toBe('ZQ_EXPR_EVAL');
    expect(ErrorCode.EXPR_UNSAFE_ACCESS).toBe('ZQ_EXPR_UNSAFE_ACCESS');
  });

  it('has component codes', () => {
    expect(ErrorCode.COMP_INVALID_NAME).toBe('ZQ_COMP_INVALID_NAME');
    expect(ErrorCode.COMP_NOT_FOUND).toBe('ZQ_COMP_NOT_FOUND');
    expect(ErrorCode.COMP_MOUNT_TARGET).toBe('ZQ_COMP_MOUNT_TARGET');
    expect(ErrorCode.COMP_RENDER).toBe('ZQ_COMP_RENDER');
    expect(ErrorCode.COMP_LIFECYCLE).toBe('ZQ_COMP_LIFECYCLE');
    expect(ErrorCode.COMP_RESOURCE).toBe('ZQ_COMP_RESOURCE');
    expect(ErrorCode.COMP_DIRECTIVE).toBe('ZQ_COMP_DIRECTIVE');
  });

  it('has router codes', () => {
    expect(ErrorCode.ROUTER_LOAD).toBe('ZQ_ROUTER_LOAD');
    expect(ErrorCode.ROUTER_GUARD).toBe('ZQ_ROUTER_GUARD');
    expect(ErrorCode.ROUTER_RESOLVE).toBe('ZQ_ROUTER_RESOLVE');
  });

  it('has store codes', () => {
    expect(ErrorCode.STORE_ACTION).toBe('ZQ_STORE_ACTION');
    expect(ErrorCode.STORE_MIDDLEWARE).toBe('ZQ_STORE_MIDDLEWARE');
    expect(ErrorCode.STORE_SUBSCRIBE).toBe('ZQ_STORE_SUBSCRIBE');
  });

  it('has http codes', () => {
    expect(ErrorCode.HTTP_REQUEST).toBe('ZQ_HTTP_REQUEST');
    expect(ErrorCode.HTTP_TIMEOUT).toBe('ZQ_HTTP_TIMEOUT');
    expect(ErrorCode.HTTP_INTERCEPTOR).toBe('ZQ_HTTP_INTERCEPTOR');
    expect(ErrorCode.HTTP_PARSE).toBe('ZQ_HTTP_PARSE');
  });

  it('has general codes', () => {
    expect(ErrorCode.INVALID_ARGUMENT).toBe('ZQ_INVALID_ARGUMENT');
  });

  it('object is frozen', () => {
    expect(Object.isFrozen(ErrorCode)).toBe(true);
  });
});
