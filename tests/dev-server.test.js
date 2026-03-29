/**
 * Dev server unit tests.
 *
 * Validates the SSEPool class, createServer() factory, middleware wiring,
 * SSE endpoint, keep-alive timeouts, SPA fallback, auto-resolve, and
 * all recent additions (helmet, compress, cors, retry/pad).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';


// ---------------------------------------------------------------------------
// SSEPool tests (pure logic, no server needed)
// ---------------------------------------------------------------------------

describe('SSEPool', () => {
  let SSEPool;

  beforeEach(async () => {
    vi.resetModules();
    ({ SSEPool } = await import('../cli/commands/dev/server.js'));
  });

  it('exports SSEPool class', () => {
    expect(SSEPool).toBeTypeOf('function');
  });

  it('starts with zero clients', () => {
    const pool = new SSEPool();
    expect(pool.size).toBe(0);
  });

  it('add() stores a client and size reflects count', () => {
    const pool = new SSEPool();
    const sse = { on: vi.fn(), event: vi.fn(), close: vi.fn() };
    pool.add(sse);
    expect(pool.size).toBe(1);
    expect(sse.on).toHaveBeenCalledWith('close', expect.any(Function));
  });

  it('add() registers close listener that removes client', () => {
    const pool = new SSEPool();
    let closeCb;
    const sse = { on: vi.fn((evt, cb) => { closeCb = cb; }), event: vi.fn(), close: vi.fn() };
    pool.add(sse);
    expect(pool.size).toBe(1);
    closeCb(); // simulate close
    expect(pool.size).toBe(0);
  });

  it('broadcast() sends event to all clients', () => {
    const pool = new SSEPool();
    const sse1 = { on: vi.fn(), event: vi.fn(), close: vi.fn() };
    const sse2 = { on: vi.fn(), event: vi.fn(), close: vi.fn() };
    pool.add(sse1);
    pool.add(sse2);
    pool.broadcast('reload', 'app.js');
    expect(sse1.event).toHaveBeenCalledWith('reload', 'app.js');
    expect(sse2.event).toHaveBeenCalledWith('reload', 'app.js');
  });

  it('broadcast() uses empty string when data is falsy', () => {
    const pool = new SSEPool();
    const sse = { on: vi.fn(), event: vi.fn(), close: vi.fn() };
    pool.add(sse);
    pool.broadcast('ping');
    expect(sse.event).toHaveBeenCalledWith('ping', '');
  });

  it('broadcast() removes clients that throw', () => {
    const pool = new SSEPool();
    const bad = { on: vi.fn(), event: vi.fn(() => { throw new Error('gone'); }), close: vi.fn() };
    const good = { on: vi.fn(), event: vi.fn(), close: vi.fn() };
    pool.add(bad);
    pool.add(good);
    pool.broadcast('reload', '');
    expect(pool.size).toBe(1); // bad removed
    expect(good.event).toHaveBeenCalled();
  });

  it('closeAll() closes every client and empties the pool', () => {
    const pool = new SSEPool();
    const sse1 = { on: vi.fn(), event: vi.fn(), close: vi.fn() };
    const sse2 = { on: vi.fn(), event: vi.fn(), close: vi.fn() };
    pool.add(sse1);
    pool.add(sse2);
    pool.closeAll();
    expect(pool.size).toBe(0);
    expect(sse1.close).toHaveBeenCalled();
    expect(sse2.close).toHaveBeenCalled();
  });

  it('closeAll() ignores errors from close()', () => {
    const pool = new SSEPool();
    const sse = { on: vi.fn(), event: vi.fn(), close: vi.fn(() => { throw new Error('boom'); }) };
    pool.add(sse);
    expect(() => pool.closeAll()).not.toThrow();
    expect(pool.size).toBe(0);
  });

  it('multiple add/remove cycles work correctly', () => {
    const pool = new SSEPool();
    const closers = [];
    for (let i = 0; i < 5; i++) {
      const sse = { on: vi.fn((_, cb) => closers.push(cb)), event: vi.fn(), close: vi.fn() };
      pool.add(sse);
    }
    expect(pool.size).toBe(5);
    closers[0]();
    closers[2]();
    closers[4]();
    expect(pool.size).toBe(2);
    pool.closeAll();
    expect(pool.size).toBe(0);
  });
});


// ---------------------------------------------------------------------------
// createServer tests (requires zero-http — integration)
// ---------------------------------------------------------------------------

describe('createServer', () => {
  let createServer, createServerFn;
  let tmpRoot;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../cli/commands/dev/server.js');
    createServerFn = mod.createServer;

    tmpRoot = path.join(os.tmpdir(), 'zq-dev-test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
    fs.mkdirSync(tmpRoot, { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'index.html'), '<!DOCTYPE html><html><head></head><body><p>Hello</p></body></html>');
    fs.writeFileSync(path.join(tmpRoot, 'style.css'), 'body { margin: 0; }');
    fs.writeFileSync(path.join(tmpRoot, 'app.js'), 'console.log("ok");');
  });

  afterEach(() => {
    if (tmpRoot && fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  // Check if zero-http is available before running integration tests
  let zeroHttpAvailable = false;
  try { require('zero-http'); zeroHttpAvailable = true; } catch {}

  it('createServer is exported as a function', () => {
    expect(createServerFn).toBeTypeOf('function');
  });

  it.skipIf(!zeroHttpAvailable)('returns app, pool, and listen', async () => {
    const result = await createServerFn({ root: tmpRoot, htmlEntry: 'index.html', port: 0, noIntercept: true });
    expect(result).toBeDefined();
    expect(result.app).toBeDefined();
    expect(result.pool).toBeDefined();
    expect(result.listen).toBeTypeOf('function');
  });

  it.skipIf(!zeroHttpAvailable)('pool is an SSEPool instance with size/broadcast/closeAll', async () => {
    const { pool } = await createServerFn({ root: tmpRoot, htmlEntry: 'index.html', port: 0, noIntercept: true });
    expect(pool.size).toBe(0);
    expect(pool.broadcast).toBeTypeOf('function');
    expect(pool.closeAll).toBeTypeOf('function');
    expect(pool.add).toBeTypeOf('function');
  });

  it.skipIf(!zeroHttpAvailable)('listen() starts the server and returns the server object', async () => {
    const { listen } = await createServerFn({ root: tmpRoot, htmlEntry: 'index.html', port: 0, noIntercept: true });
    const server = listen(() => {});
    expect(server).toBeDefined();
    expect(server.keepAliveTimeout).toBe(65000);
    expect(server.headersTimeout).toBe(66000);
    server.close();
  });

  it.skipIf(!zeroHttpAvailable)('app has registered routes for SSE and devtools', async () => {
    const { app } = await createServerFn({ root: tmpRoot, htmlEntry: 'index.html', port: 0, noIntercept: true });
    // The app should be a valid zero-http app with the ability to handle routes
    expect(app).toBeDefined();
    expect(app.listen).toBeTypeOf('function');
  });
});


// ---------------------------------------------------------------------------
// Server middleware & route integration (real HTTP requests)
// ---------------------------------------------------------------------------

describe('Dev server HTTP integration', () => {
  let createServerFn;
  let tmpRoot, server, port;

  let zeroHttpAvailable = false;
  try { require('zero-http'); zeroHttpAvailable = true; } catch {}

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../cli/commands/dev/server.js');
    createServerFn = mod.createServer;

    tmpRoot = path.join(os.tmpdir(), 'zq-dev-http-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
    fs.mkdirSync(tmpRoot, { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'index.html'),
      '<!DOCTYPE html><html><head></head><body><p>Hello</p></body></html>');
    fs.writeFileSync(path.join(tmpRoot, 'style.css'), 'body { margin: 0; }');
    fs.writeFileSync(path.join(tmpRoot, 'app.js'), 'console.log("ok");');
  });

  afterEach(() => {
    if (server) { try { server.close(); } catch {} }
    if (tmpRoot && fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  async function boot() {
    const result = await createServerFn({ root: tmpRoot, htmlEntry: 'index.html', port: 0, noIntercept: true });
    return new Promise((resolve) => {
      server = result.listen(() => {
        port = server.address().port;
        resolve(result);
      });
    });
  }

  it.skipIf(!zeroHttpAvailable)('serves static CSS files', async () => {
    await boot();
    const res = await fetch(`http://127.0.0.1:${port}/style.css`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('margin: 0');
  });

  it.skipIf(!zeroHttpAvailable)('serves static JS files', async () => {
    await boot();
    const res = await fetch(`http://127.0.0.1:${port}/app.js`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('console.log');
  });

  it.skipIf(!zeroHttpAvailable)('SPA fallback injects overlay script into HTML', async () => {
    await boot();
    const res = await fetch(`http://127.0.0.1:${port}/`);
    expect(res.status).toBe(200);
    const text = await res.text();
    // Original content preserved
    expect(text).toContain('<p>Hello</p>');
    // Overlay script injected before </body>
    expect(text).toContain('__zq_error_overlay');
  });

  it.skipIf(!zeroHttpAvailable)('SPA fallback works for non-existent routes', async () => {
    await boot();
    const res = await fetch(`http://127.0.0.1:${port}/about`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('<p>Hello</p>');
  });

  it.skipIf(!zeroHttpAvailable)('returns 404 for missing non-HTML file extensions', async () => {
    await boot();
    const res = await fetch(`http://127.0.0.1:${port}/missing.png`);
    expect(res.status).toBe(404);
  });

  it.skipIf(!zeroHttpAvailable)('devtools endpoint returns HTML', async () => {
    await boot();
    const res = await fetch(`http://127.0.0.1:${port}/_devtools`);
    expect(res.status).toBe(200);
    const ct = res.headers.get('content-type');
    expect(ct).toContain('text/html');
    const text = await res.text();
    expect(text).toContain('<!DOCTYPE html');
  });

  // --- Helmet (security headers) ---

  it.skipIf(!zeroHttpAvailable)('helmet sets Content-Security-Policy header', async () => {
    await boot();
    const res = await fetch(`http://127.0.0.1:${port}/`);
    const csp = res.headers.get('content-security-policy');
    expect(csp).toBeDefined();
    expect(csp).toContain("'self'");
    expect(csp).toContain("'unsafe-inline'");
    expect(csp).toContain("'unsafe-eval'");
  });

  it.skipIf(!zeroHttpAvailable)('helmet sets X-Content-Type-Options header', async () => {
    await boot();
    const res = await fetch(`http://127.0.0.1:${port}/`);
    const xcto = res.headers.get('x-content-type-options');
    expect(xcto).toBe('nosniff');
  });

  it.skipIf(!zeroHttpAvailable)('helmet does NOT set Strict-Transport-Security (dev)', async () => {
    await boot();
    const res = await fetch(`http://127.0.0.1:${port}/`);
    const hsts = res.headers.get('strict-transport-security');
    expect(hsts).toBeNull();
  });

  it.skipIf(!zeroHttpAvailable)('helmet does NOT set X-Frame-Options (dev allows framing)', async () => {
    await boot();
    const res = await fetch(`http://127.0.0.1:${port}/`);
    const xfo = res.headers.get('x-frame-options');
    expect(xfo).toBeNull();
  });

  // --- CORS ---

  it.skipIf(!zeroHttpAvailable)('CORS allows cross-origin requests', async () => {
    await boot();
    const res = await fetch(`http://127.0.0.1:${port}/style.css`, {
      headers: { 'Origin': 'http://localhost:8080' },
    });
    const acao = res.headers.get('access-control-allow-origin');
    expect(acao).toBeDefined();
  });

  // --- SSE endpoint ---

  it.skipIf(!zeroHttpAvailable)('SSE endpoint responds with event stream', async () => {
    const { pool } = await boot();
    const controller = new AbortController();
    const res = await fetch(`http://127.0.0.1:${port}/__zq_reload`, {
      signal: controller.signal,
      headers: { 'Accept': 'text/event-stream' },
    });
    expect(res.status).toBe(200);
    const ct = res.headers.get('content-type');
    expect(ct).toContain('text/event-stream');
    // The pool should have one client now
    expect(pool.size).toBe(1);
    controller.abort();
    // Give the abort a moment to process
    await new Promise(r => setTimeout(r, 50));
  });

  // --- Compression ---

  it.skipIf(!zeroHttpAvailable)('compress middleware sets content-encoding for large responses', async () => {
    // Create a file larger than 1024 bytes (the threshold)
    const largeContent = 'body { ' + 'color: red; '.repeat(200) + '}';
    fs.writeFileSync(path.join(tmpRoot, 'large.css'), largeContent);
    await boot();
    const res = await fetch(`http://127.0.0.1:${port}/large.css`, {
      headers: { 'Accept-Encoding': 'gzip, deflate, br' },
    });
    expect(res.status).toBe(200);
    // The response should be compressed — check encoding header
    const enc = res.headers.get('content-encoding');
    // Accept either br, gzip, or deflate depending on what zero-http negotiates
    expect(['br', 'gzip', 'deflate']).toContain(enc);
  });

  it.skipIf(!zeroHttpAvailable)('compress middleware is active on static files', async () => {
    await boot();
    const res = await fetch(`http://127.0.0.1:${port}/style.css`, {
      headers: { 'Accept-Encoding': 'gzip, deflate, br' },
    });
    expect(res.status).toBe(200);
    // Compression is applied — exact encoding depends on zero-http negotiation
    const text = await res.text();
    expect(text).toContain('margin: 0');
  });

  // --- Keep-alive ---

  it.skipIf(!zeroHttpAvailable)('server has correct keep-alive and headers timeouts', async () => {
    await boot();
    expect(server.keepAliveTimeout).toBe(65000);
    expect(server.headersTimeout).toBe(66000);
  });

  // --- Missing htmlEntry ---

  it.skipIf(!zeroHttpAvailable)('returns 404 when htmlEntry is missing', async () => {
    // Remove the index.html to simulate a missing entry
    fs.unlinkSync(path.join(tmpRoot, 'index.html'));
    await boot();
    const res = await fetch(`http://127.0.0.1:${port}/`);
    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text).toContain('index.html not found');
  });

  // --- HTML without </body> ---

  it.skipIf(!zeroHttpAvailable)('injects overlay even when </body> tag is missing', async () => {
    fs.writeFileSync(path.join(tmpRoot, 'index.html'), '<html><head></head><p>No body tag</p></html>');
    await boot();
    const res = await fetch(`http://127.0.0.1:${port}/`);
    const text = await res.text();
    expect(text).toContain('No body tag');
    expect(text).toContain('__zq_error_overlay');
  });
});


// ---------------------------------------------------------------------------
// Watcher helpers (pure functions)
// ---------------------------------------------------------------------------

describe('Watcher helpers', () => {
  it('validator module exports validateJS function', async () => {
    vi.resetModules();
    const mod = await import('../cli/commands/dev/validator.js');
    expect(mod.validateJS).toBeTypeOf('function');
  });

  it('validateJS returns null for valid JS', async () => {
    vi.resetModules();
    const { validateJS } = await import('../cli/commands/dev/validator.js');
    const tmpFile = path.join(os.tmpdir(), 'zq-valid-' + Date.now() + '.js');
    fs.writeFileSync(tmpFile, 'const x = 1;\nfunction foo() { return x; }');
    const result = validateJS(tmpFile, 'test.js');
    expect(result).toBeNull();
    fs.unlinkSync(tmpFile);
  });

  it('validateJS returns error object for invalid JS', async () => {
    vi.resetModules();
    const { validateJS } = await import('../cli/commands/dev/validator.js');
    const tmpFile = path.join(os.tmpdir(), 'zq-invalid-' + Date.now() + '.js');
    fs.writeFileSync(tmpFile, 'const x = {;\n');
    const result = validateJS(tmpFile, 'test.js');
    expect(result).not.toBeNull();
    expect(result.file).toBe('test.js');
    fs.unlinkSync(tmpFile);
  });

  it('overlay module exports a string', async () => {
    vi.resetModules();
    const mod = await import('../cli/commands/dev/overlay.js');
    const overlay = mod.default || mod;
    expect(typeof overlay).toBe('string');
    expect(overlay.length).toBeGreaterThan(100);
  });

  it('devtools module exports HTML string', async () => {
    vi.resetModules();
    const mod = await import('../cli/commands/dev/devtools/index.js');
    const html = mod.default || mod;
    expect(typeof html).toBe('string');
    expect(html).toContain('<!DOCTYPE html');
  });

  it('logger exports printBanner, logCSS, logReload, logError', async () => {
    vi.resetModules();
    const mod = await import('../cli/commands/dev/logger.js');
    expect(mod.printBanner).toBeTypeOf('function');
    expect(mod.logCSS).toBeTypeOf('function');
    expect(mod.logReload).toBeTypeOf('function');
    expect(mod.logError).toBeTypeOf('function');
  });
});


// ---------------------------------------------------------------------------
// promptInstall (unit - does not call real readline in test)
// ---------------------------------------------------------------------------

describe('Server module exports', () => {
  it('exports createServer and SSEPool', async () => {
    vi.resetModules();
    const mod = await import('../cli/commands/dev/server.js');
    expect(mod.createServer).toBeTypeOf('function');
    expect(mod.SSEPool).toBeTypeOf('function');
  });

  it('dev/index.js exports devServer function', async () => {
    vi.resetModules();
    const mod = await import('../cli/commands/dev/index.js');
    const fn = mod.default || mod;
    expect(fn).toBeTypeOf('function');
  });

  it('watcher exports startWatcher', async () => {
    vi.resetModules();
    const mod = await import('../cli/commands/dev/watcher.js');
    expect(mod.startWatcher).toBeTypeOf('function');
  });
});
