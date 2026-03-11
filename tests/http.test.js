import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http } from '../src/http.js';


// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------
let fetchSpy;

function mockFetch(response = {}, ok = true, status = 200) {
  const body = typeof response === 'string' ? response : JSON.stringify(response);
  const contentType = typeof response === 'string' ? 'text/plain' : 'application/json';

  fetchSpy = vi.fn(() =>
    Promise.resolve({
      ok,
      status,
      statusText: ok ? 'OK' : 'Error',
      headers: {
        get: (h) => h.toLowerCase() === 'content-type' ? contentType : null,
        entries: () => [[`content-type`, contentType]],
      },
      json: () => Promise.resolve(typeof response === 'object' ? response : JSON.parse(response)),
      text: () => Promise.resolve(body),
      blob: () => Promise.resolve(new Blob([body])),
    })
  );
  globalThis.fetch = fetchSpy;
}

beforeEach(() => {
  http.configure({ baseURL: '', headers: { 'Content-Type': 'application/json' }, timeout: 30000 });
});

afterEach(() => {
  vi.restoreAllMocks();
});


// ---------------------------------------------------------------------------
// GET requests
// ---------------------------------------------------------------------------

describe('http.get', () => {
  it('makes a GET request', async () => {
    mockFetch({ users: [] });
    const result = await http.get('https://api.test.com/users');
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(result.data).toEqual({ users: [] });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });

  it('appends query params for GET', async () => {
    mockFetch({});
    await http.get('https://api.test.com/search', { q: 'hello', page: '1' });
    const url = fetchSpy.mock.calls[0][0];
    expect(url).toContain('q=hello');
    expect(url).toContain('page=1');
  });

  it('uses baseURL', async () => {
    http.configure({ baseURL: 'https://api.test.com' });
    mockFetch({});
    await http.get('/users');
    expect(fetchSpy.mock.calls[0][0]).toBe('https://api.test.com/users');
  });
});


// ---------------------------------------------------------------------------
// POST requests
// ---------------------------------------------------------------------------

describe('http.post', () => {
  it('sends JSON body', async () => {
    mockFetch({ id: 1 });
    const result = await http.post('https://api.test.com/users', { name: 'Tony' });
    const opts = fetchSpy.mock.calls[0][1];
    expect(opts.method).toBe('POST');
    expect(opts.body).toBe(JSON.stringify({ name: 'Tony' }));
    expect(result.data).toEqual({ id: 1 });
  });

  it('handles FormData body', async () => {
    mockFetch({});
    const form = new FormData();
    form.append('file', 'data');
    await http.post('https://api.test.com/upload', form);
    const opts = fetchSpy.mock.calls[0][1];
    expect(opts.body).toBe(form);
    // Content-Type should be removed for FormData
    expect(opts.headers['Content-Type']).toBeUndefined();
  });
});


// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('http — error handling', () => {
  it('throws on non-ok response', async () => {
    mockFetch({ error: 'Not Found' }, false, 404);
    await expect(http.get('https://api.test.com/missing')).rejects.toThrow('HTTP 404');
  });

  it('error includes response data', async () => {
    mockFetch({ message: 'Unauthorized' }, false, 401);
    try {
      await http.get('https://api.test.com/protected');
    } catch (err) {
      expect(err.response).toBeDefined();
      expect(err.response.status).toBe(401);
    }
  });

  it('throws on invalid URL', async () => {
    await expect(http.get(null)).rejects.toThrow('requires a URL string');
    await expect(http.get(undefined)).rejects.toThrow('requires a URL string');
  });
});


// ---------------------------------------------------------------------------
// PUT / PATCH / DELETE
// ---------------------------------------------------------------------------

describe('http — other methods', () => {
  it('PUT sends correct method', async () => {
    mockFetch({});
    await http.put('https://api.test.com/users/1', { name: 'Updated' });
    expect(fetchSpy.mock.calls[0][1].method).toBe('PUT');
  });

  it('PATCH sends correct method', async () => {
    mockFetch({});
    await http.patch('https://api.test.com/users/1', { name: 'Patched' });
    expect(fetchSpy.mock.calls[0][1].method).toBe('PATCH');
  });

  it('DELETE sends correct method', async () => {
    mockFetch({});
    await http.delete('https://api.test.com/users/1');
    expect(fetchSpy.mock.calls[0][1].method).toBe('DELETE');
  });
});


// ---------------------------------------------------------------------------
// configure
// ---------------------------------------------------------------------------

describe('http.configure', () => {
  it('sets baseURL', async () => {
    http.configure({ baseURL: 'https://example.com/api' });
    mockFetch({});
    await http.get('/data');
    expect(fetchSpy.mock.calls[0][0]).toBe('https://example.com/api/data');
  });

  it('merges headers', async () => {
    http.configure({ headers: { Authorization: 'Bearer token' } });
    mockFetch({});
    await http.get('https://api.test.com/me');
    expect(fetchSpy.mock.calls[0][1].headers.Authorization).toBe('Bearer token');
  });
});


// ---------------------------------------------------------------------------
// Text response
// ---------------------------------------------------------------------------

describe('http — text response', () => {
  it('parses text response', async () => {
    mockFetch('Hello World');
    const result = await http.get('https://api.test.com/text');
    expect(result.data).toBe('Hello World');
  });
});


// ---------------------------------------------------------------------------
// Interceptors
// ---------------------------------------------------------------------------

describe('http — interceptors', () => {
  it('request interceptor via onRequest', async () => {
    http.configure({ baseURL: '' });
    http.onRequest((fetchOpts, url) => {
      fetchOpts.headers['X-Custom'] = 'test';
    });
    mockFetch({});
    await http.get('https://api.test.com/data');
    const opts = fetchSpy.mock.calls[0][1];
    expect(opts.headers['X-Custom']).toBe('test');
  });

  it('response interceptor via onResponse', async () => {
    http.onResponse((result) => {
      result.intercepted = true;
    });
    mockFetch({ x: 1 });
    const result = await http.get('https://api.test.com/data');
    expect(result.intercepted).toBe(true);
  });
});


// ---------------------------------------------------------------------------
// Timeout / abort
// ---------------------------------------------------------------------------

describe('http — abort signal', () => {
  it('passes signal through options', async () => {
    const controller = new AbortController();
    mockFetch({});
    await http.get('https://api.test.com/data', null, { signal: controller.signal });
    const opts = fetchSpy.mock.calls[0][1];
    expect(opts.signal).toBe(controller.signal);
  });
});


// ---------------------------------------------------------------------------
// Blob response
// ---------------------------------------------------------------------------

describe('http — blob response', () => {
  it('can request blob responses', async () => {
    mockFetch('binary data');
    const result = await http.get('https://api.test.com/file', null, { responseType: 'blob' });
    // Should have a data field (blob or fallback text)
    expect(result.data).toBeDefined();
  });
});


// ---------------------------------------------------------------------------
// HEAD and OPTIONS methods
// ---------------------------------------------------------------------------

describe('http — raw fetch pass-through', () => {
  it('raw() delegates to native fetch', async () => {
    mockFetch({ ok: true });
    await http.raw('https://api.test.com/ping', { method: 'HEAD' });
    expect(fetchSpy).toHaveBeenCalledWith('https://api.test.com/ping', { method: 'HEAD' });
  });
});


// ---------------------------------------------------------------------------
// Request with custom headers
// ---------------------------------------------------------------------------

describe('http — custom per-request headers', () => {
  it('merges per-request headers', async () => {
    mockFetch({});
    await http.get('https://api.test.com/data', null, {
      headers: { 'X-Request-Id': '123' },
    });
    const opts = fetchSpy.mock.calls[0][1];
    expect(opts.headers['X-Request-Id']).toBe('123');
  });
});


// ---------------------------------------------------------------------------
// Response metadata
// ---------------------------------------------------------------------------

describe('http — response metadata', () => {
  it('includes status and ok in result', async () => {
    mockFetch({ data: 'yes' }, true, 200);
    const result = await http.get('https://api.test.com/data');
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });

  it('includes statusText in error', async () => {
    mockFetch({ error: 'bad' }, false, 500);
    try {
      await http.get('https://api.test.com/fail');
    } catch (err) {
      expect(err.message).toContain('500');
    }
  });
});
