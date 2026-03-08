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
