/**
 * zQuery HTTP — Lightweight fetch wrapper
 * 
 * Clean API for GET/POST/PUT/PATCH/DELETE with:
 *   - Auto JSON serialization/deserialization
 *   - Request/response interceptors
 *   - Timeout support
 *   - Base URL configuration
 *   - Abort controller integration
 * 
 * Usage:
 *   $.http.get('/api/users');
 *   $.http.post('/api/users', { name: 'Tony' });
 *   $.http.configure({ baseURL: 'https://api.example.com', headers: { Authorization: 'Bearer ...' } });
 */

const _config = {
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
};

const _interceptors = {
  request: [],
  response: [],
};


/**
 * Core request function
 */
async function request(method, url, data, options = {}) {
  if (!url || typeof url !== 'string') {
    throw new Error(`HTTP request requires a URL string, got ${typeof url}`);
  }
  let fullURL = url.startsWith('http') ? url : _config.baseURL + url;
  let headers = { ..._config.headers, ...options.headers };
  let body = undefined;

  // Build fetch options
  const fetchOpts = {
    method: method.toUpperCase(),
    headers,
    ...options,
  };

  // Handle body
  if (data !== undefined && method !== 'GET' && method !== 'HEAD') {
    if (data instanceof FormData) {
      body = data;
      delete fetchOpts.headers['Content-Type']; // Let browser set multipart boundary
    } else if (typeof data === 'object') {
      body = JSON.stringify(data);
    } else {
      body = data;
    }
    fetchOpts.body = body;
  }

  // Query params for GET
  if (data && (method === 'GET' || method === 'HEAD') && typeof data === 'object') {
    const params = new URLSearchParams(data).toString();
    fullURL += (fullURL.includes('?') ? '&' : '?') + params;
  }

  // Timeout via AbortController
  const controller = new AbortController();
  fetchOpts.signal = options.signal || controller.signal;
  const timeout = options.timeout ?? _config.timeout;
  let timer;
  if (timeout > 0) {
    timer = setTimeout(() => controller.abort(), timeout);
  }

  // Run request interceptors
  for (const interceptor of _interceptors.request) {
    const result = await interceptor(fetchOpts, fullURL);
    if (result === false) throw new Error('Request blocked by interceptor');
    if (result?.url) fullURL = result.url;
    if (result?.options) Object.assign(fetchOpts, result.options);
  }

  try {
    const response = await fetch(fullURL, fetchOpts);
    if (timer) clearTimeout(timer);

    // Parse response
    const contentType = response.headers.get('Content-Type') || '';
    let responseData;

    try {
      if (contentType.includes('application/json')) {
        responseData = await response.json();
      } else if (contentType.includes('text/')) {
        responseData = await response.text();
      } else if (contentType.includes('application/octet-stream') || contentType.includes('image/')) {
        responseData = await response.blob();
      } else {
        // Try JSON first, fall back to text
        const text = await response.text();
        try { responseData = JSON.parse(text); } catch { responseData = text; }
      }
    } catch (parseErr) {
      responseData = null;
      console.warn(`[zQuery HTTP] Failed to parse response body from ${method} ${fullURL}:`, parseErr.message);
    }

    const result = {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData,
      response,
    };

    // Run response interceptors
    for (const interceptor of _interceptors.response) {
      await interceptor(result);
    }

    if (!response.ok) {
      const err = new Error(`HTTP ${response.status}: ${response.statusText}`);
      err.response = result;
      throw err;
    }

    return result;
  } catch (err) {
    if (timer) clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms: ${method} ${fullURL}`);
    }
    throw err;
  }
}


// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export const http = {
  get:     (url, params, opts)  => request('GET', url, params, opts),
  post:    (url, data, opts)    => request('POST', url, data, opts),
  put:     (url, data, opts)    => request('PUT', url, data, opts),
  patch:   (url, data, opts)    => request('PATCH', url, data, opts),
  delete:  (url, data, opts)    => request('DELETE', url, data, opts),

  /**
   * Configure defaults
   */
  configure(opts) {
    if (opts.baseURL !== undefined) _config.baseURL = opts.baseURL;
    if (opts.headers) Object.assign(_config.headers, opts.headers);
    if (opts.timeout !== undefined) _config.timeout = opts.timeout;
  },

  /**
   * Add request interceptor
   * @param {Function} fn — (fetchOpts, url) → void | false | { url, options }
   */
  onRequest(fn) {
    _interceptors.request.push(fn);
  },

  /**
   * Add response interceptor
   * @param {Function} fn — (result) → void
   */
  onResponse(fn) {
    _interceptors.response.push(fn);
  },

  /**
   * Create a standalone AbortController for manual cancellation
   */
  createAbort() {
    return new AbortController();
  },

  /**
   * Raw fetch pass-through (for edge cases)
   */
  raw: (url, opts) => fetch(url, opts),
};
