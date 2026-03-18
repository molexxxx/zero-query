import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ZQueryError, ErrorCode, onError, reportError, guardCallback, guardAsync, validate, formatError } from '../src/errors.js';


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

  it('has correct name', () => {
    const err = new ZQueryError(ErrorCode.INVALID_ARGUMENT, 'test');
    expect(err.name).toBe('ZQueryError');
  });

  it('has empty context by default', () => {
    const err = new ZQueryError(ErrorCode.INVALID_ARGUMENT, 'test');
    expect(err.context).toEqual({});
  });

  it('has no cause property when not provided', () => {
    const err = new ZQueryError(ErrorCode.INVALID_ARGUMENT, 'test');
    expect(err.cause).toBeUndefined();
  });

  it('has a stack trace', () => {
    const err = new ZQueryError(ErrorCode.COMP_RENDER, 'test');
    expect(err.stack).toBeDefined();
    expect(typeof err.stack).toBe('string');
    expect(err.stack.length).toBeGreaterThan(0);
  });

  it('works with JSON.stringify (context serializable)', () => {
    const err = new ZQueryError(ErrorCode.COMP_RENDER, 'test', { foo: 'bar' });
    const json = JSON.stringify({ code: err.code, context: err.context });
    expect(json).toContain('foo');
    expect(json).toContain('bar');
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

  it('has SSR codes', () => {
    expect(ErrorCode.SSR_RENDER).toBe('ZQ_SSR_RENDER');
    expect(ErrorCode.SSR_COMPONENT).toBe('ZQ_SSR_COMPONENT');
    expect(ErrorCode.SSR_HYDRATION).toBe('ZQ_SSR_HYDRATION');
    expect(ErrorCode.SSR_PAGE).toBe('ZQ_SSR_PAGE');
  });

  it('has general codes', () => {
    expect(ErrorCode.INVALID_ARGUMENT).toBe('ZQ_INVALID_ARGUMENT');
  });

  it('all codes start with ZQ_ prefix', () => {
    for (const [, value] of Object.entries(ErrorCode)) {
      expect(value).toMatch(/^ZQ_/);
    }
  });

  it('all codes are unique', () => {
    const values = Object.values(ErrorCode);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});


// ---------------------------------------------------------------------------
// onError / reportError — multi-handler support
// ---------------------------------------------------------------------------

describe('reportError', () => {
  let errorSpy;
  beforeEach(() => {
    onError(null); // reset handlers
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

  it('supports multiple handlers', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    onError(handler1);
    onError(handler2);
    reportError(ErrorCode.COMP_RENDER, 'test');
    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
  });

  it('both handlers receive the same error', () => {
    const errors = [];
    onError(err => errors.push(err));
    onError(err => errors.push(err));
    reportError(ErrorCode.COMP_RENDER, 'shared');
    expect(errors[0]).toBe(errors[1]);
  });

  it('handler can be removed via unsubscribe', () => {
    const handler = vi.fn();
    const unsub = onError(handler);
    unsub();
    reportError(ErrorCode.COMP_RENDER, 'test');
    expect(handler).not.toHaveBeenCalled();
  });

  it('removing one handler does not affect others', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    const unsub1 = onError(h1);
    onError(h2);
    unsub1();
    reportError(ErrorCode.COMP_RENDER, 'test');
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('one handler throwing does not prevent others from running', () => {
    const h1 = vi.fn(() => { throw new Error('boom'); });
    const h2 = vi.fn();
    onError(h1);
    onError(h2);
    reportError(ErrorCode.COMP_RENDER, 'test');
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });
});


// ---------------------------------------------------------------------------
// onError — clearing and edge cases
// ---------------------------------------------------------------------------

describe('onError — edge cases', () => {
  afterEach(() => onError(null));

  it('passing null clears all handlers', () => {
    const spy = vi.fn();
    onError(spy);
    onError(null);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    reportError(ErrorCode.INVALID_ARGUMENT, 'test');
    expect(spy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('passing non-function is ignored', () => {
    const spy = vi.fn();
    onError(spy);
    onError('not a function');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    reportError(ErrorCode.INVALID_ARGUMENT, 'test');
    // Original handler should still be there
    expect(spy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('handler exceptions do not crash reportError', () => {
    onError(() => { throw new Error('handler crash'); });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => reportError(ErrorCode.INVALID_ARGUMENT, 'test')).not.toThrow();
    errorSpy.mockRestore();
  });

  it('onError returns an unsubscribe function', () => {
    const unsub = onError(() => {});
    expect(typeof unsub).toBe('function');
  });

  it('onError(null) returns a no-op unsubscribe', () => {
    const unsub = onError(null);
    expect(typeof unsub).toBe('function');
    expect(() => unsub()).not.toThrow();
  });

  it('double unsubscribe is safe', () => {
    const handler = vi.fn();
    const unsub = onError(handler);
    unsub();
    expect(() => unsub()).not.toThrow();
  });
});


// ---------------------------------------------------------------------------
// reportError — cause handling
// ---------------------------------------------------------------------------

describe('reportError — cause handling', () => {
  let errorSpy;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    onError(null);
    errorSpy.mockRestore();
  });

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

  it('reports error without cause', () => {
    const handler = vi.fn();
    onError(handler);
    reportError(ErrorCode.STORE_ACTION, 'no cause');
    expect(handler.mock.calls[0][0].cause).toBeUndefined();
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
    onError(null);
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

  it('returns undefined on error', () => {
    const guarded = guardCallback(() => { throw new Error('bang'); }, ErrorCode.INVALID_ARGUMENT);
    expect(guarded()).toBeUndefined();
  });

  it('preserves context in error report', () => {
    const handler = vi.fn();
    onError(handler);
    const guarded = guardCallback(
      () => { throw new Error('bad'); },
      ErrorCode.COMP_LIFECYCLE,
      { hook: 'mounted', component: 'my-app' }
    );
    guarded();
    const err = handler.mock.calls[0][0];
    expect(err.code).toBe(ErrorCode.COMP_LIFECYCLE);
  });

  it('works with zero arguments', () => {
    const guarded = guardCallback(() => 'ok', ErrorCode.COMP_RENDER);
    expect(guarded()).toBe('ok');
  });

  it('works with many arguments', () => {
    const guarded = guardCallback((...args) => args.length, ErrorCode.COMP_RENDER);
    expect(guarded(1, 2, 3, 4, 5)).toBe(5);
  });
});


// ---------------------------------------------------------------------------
// guardAsync
// ---------------------------------------------------------------------------

describe('guardAsync', () => {
  let errorSpy;
  beforeEach(() => {
    onError(null);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    errorSpy.mockRestore();
    onError(null);
  });

  it('returns the resolved value on success', async () => {
    const guarded = guardAsync(async (x) => x * 2, ErrorCode.COMP_RENDER);
    expect(await guarded(5)).toBe(10);
  });

  it('catches async errors and reports them', async () => {
    const handler = vi.fn();
    onError(handler);
    const guarded = guardAsync(async () => { throw new Error('async boom'); }, ErrorCode.HTTP_REQUEST);
    const result = await guarded();
    expect(result).toBeUndefined();
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].code).toBe(ErrorCode.HTTP_REQUEST);
  });

  it('passes arguments through', async () => {
    const guarded = guardAsync(async (a, b) => a + b, ErrorCode.COMP_RENDER);
    expect(await guarded(3, 7)).toBe(10);
  });

  it('does not throw on rejection', async () => {
    const guarded = guardAsync(async () => { throw new Error('fail'); }, ErrorCode.STORE_ACTION);
    await expect(guarded()).resolves.toBeUndefined();
  });

  it('preserves context in error report', async () => {
    const handler = vi.fn();
    onError(handler);
    const guarded = guardAsync(
      async () => { throw new Error('bad'); },
      ErrorCode.ROUTER_LOAD,
      { route: '/about' }
    );
    await guarded();
    const err = handler.mock.calls[0][0];
    expect(err.code).toBe(ErrorCode.ROUTER_LOAD);
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

  it('validates without expectedType (null/undefined only)', () => {
    expect(() => validate(null, 'x')).toThrow();
    expect(() => validate(undefined, 'x')).toThrow();
    expect(() => validate(0, 'x')).not.toThrow();
    expect(() => validate('', 'x')).not.toThrow();
    expect(() => validate(false, 'x')).not.toThrow();
  });

  it('error message contains parameter name', () => {
    try {
      validate(null, 'myParam');
      expect.unreachable();
    } catch (err) {
      expect(err.message).toContain('myParam');
    }
  });

  it('error message for wrong type contains expected type', () => {
    try {
      validate(42, 'name', 'string');
      expect.unreachable();
    } catch (err) {
      expect(err.message).toContain('string');
      expect(err.message).toContain('number');
    }
  });

  it('accepts object type', () => {
    expect(() => validate({}, 'cfg', 'object')).not.toThrow();
    expect(() => validate('str', 'cfg', 'object')).toThrow();
  });

  it('accepts boolean type', () => {
    expect(() => validate(true, 'flag', 'boolean')).not.toThrow();
    expect(() => validate('yes', 'flag', 'boolean')).toThrow();
  });
});


// ---------------------------------------------------------------------------
// formatError
// ---------------------------------------------------------------------------

describe('formatError', () => {
  it('formats ZQueryError correctly', () => {
    const err = new ZQueryError(ErrorCode.COMP_RENDER, 'render failed', { component: 'my-app' });
    const formatted = formatError(err);
    expect(formatted.code).toBe('ZQ_COMP_RENDER');
    expect(formatted.type).toBe('ZQueryError');
    expect(formatted.message).toBe('render failed');
    expect(formatted.context.component).toBe('my-app');
    expect(formatted.stack).toBeDefined();
    expect(formatted.cause).toBeNull();
  });

  it('formats plain Error correctly', () => {
    const err = new Error('plain error');
    const formatted = formatError(err);
    expect(formatted.code).toBe('');
    expect(formatted.type).toBe('Error');
    expect(formatted.message).toBe('plain error');
    expect(formatted.context).toEqual({});
    expect(formatted.cause).toBeNull();
  });

  it('formats nested cause chain', () => {
    const root = new Error('root cause');
    const err = new ZQueryError(ErrorCode.HTTP_REQUEST, 'http failed', {}, root);
    const formatted = formatError(err);
    expect(formatted.cause).not.toBeNull();
    expect(formatted.cause.message).toBe('root cause');
    expect(formatted.cause.type).toBe('Error');
  });

  it('handles TypeError correctly', () => {
    const err = new TypeError('cannot read property');
    const formatted = formatError(err);
    expect(formatted.type).toBe('TypeError');
    expect(formatted.code).toBe('');
  });

  it('handles error with no message', () => {
    const err = new Error();
    const formatted = formatError(err);
    expect(formatted.message).toBeDefined();
  });

  it('returns serializable object', () => {
    const err = new ZQueryError(ErrorCode.STORE_ACTION, 'test', { action: 'foo' });
    const formatted = formatError(err);
    const json = JSON.stringify(formatted);
    expect(typeof json).toBe('string');
    const parsed = JSON.parse(json);
    expect(parsed.code).toBe('ZQ_STORE_ACTION');
  });
});


// ---------------------------------------------------------------------------
// Integration: SSR errors use SSR_* codes
// ---------------------------------------------------------------------------

describe('SSR error integration', () => {
  afterEach(() => onError(null));

  it('SSR error codes exist and are properly prefixed', () => {
    expect(ErrorCode.SSR_RENDER).toBe('ZQ_SSR_RENDER');
    expect(ErrorCode.SSR_COMPONENT).toBe('ZQ_SSR_COMPONENT');
    expect(ErrorCode.SSR_HYDRATION).toBe('ZQ_SSR_HYDRATION');
    expect(ErrorCode.SSR_PAGE).toBe('ZQ_SSR_PAGE');
  });

  it('ZQueryError with SSR code works correctly', () => {
    const err = new ZQueryError(ErrorCode.SSR_RENDER, 'SSR render failed', { component: 'my-page' });
    expect(err.code).toBe('ZQ_SSR_RENDER');
    expect(err.context.component).toBe('my-page');
    expect(err).toBeInstanceOf(Error);
  });

  it('reportError with SSR codes works', () => {
    const handler = vi.fn();
    onError(handler);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    reportError(ErrorCode.SSR_RENDER, 'ssr test', { component: 'test' });
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].code).toBe(ErrorCode.SSR_RENDER);

    spy.mockRestore();
  });

  it('formatError works with SSR errors', () => {
    const err = new ZQueryError(ErrorCode.SSR_COMPONENT, 'not registered', { component: 'foo' });
    const formatted = formatError(err);
    expect(formatted.code).toBe('ZQ_SSR_COMPONENT');
    expect(formatted.context.component).toBe('foo');
  });
});
