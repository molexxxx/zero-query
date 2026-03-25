/**
 * cli/commands/dev/server.js - HTTP server & SSE broadcasting
 *
 * Creates the zero-http app, serves static files, injects the
 * error-overlay snippet into HTML responses, and manages the
 * SSE connection pool for live-reload events.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const OVERLAY_SCRIPT = require('./overlay');
const DEVTOOLS_HTML  = require('./devtools');

// ---------------------------------------------------------------------------
// SSE client pool
// ---------------------------------------------------------------------------

class SSEPool {
  constructor() {
    this._clients = new Set();
  }

  add(sse) {
    this._clients.add(sse);
    sse.on('close', () => this._clients.delete(sse));
  }

  broadcast(eventType, data) {
    for (const sse of this._clients) {
      try { sse.event(eventType, data || ''); } catch { this._clients.delete(sse); }
    }
  }

  closeAll() {
    for (const sse of this._clients) {
      try { sse.close(); } catch { /* ignore */ }
    }
    this._clients.clear();
  }
}

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

/**
 * Prompt the user to auto-install zero-http when it isn't found.
 * Resolves `true` if the user accepts, `false` otherwise.
 */
function promptInstall() {
  const rl = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(
      '\n  The local dev server requires zero-http, which is not installed.\n' +
      '  This package is only used during development and is not needed\n' +
      '  for building, bundling, or production.\n' +
      '  Install it now? (y/n): ',
      (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase() === 'y');
      }
    );
  });
}

/**
 * @param {object} opts
 * @param {string} opts.root        - absolute path to project root
 * @param {string} opts.htmlEntry   - e.g. 'index.html'
 * @param {number} opts.port
 * @param {boolean} opts.noIntercept - skip zquery.min.js auto-resolve
 * @returns {Promise<{ app, pool: SSEPool, listen: Function }>}
 */
async function createServer({ root, htmlEntry, port, noIntercept }) {
  let zeroHttp;
  try {
    zeroHttp = require('zero-http');
  } catch {
    const ok = await promptInstall();
    if (!ok) {
      console.error('\n  ✖ Cannot start dev server without zero-http.\n');
      process.exit(1);
    }
    const { execSync } = require('child_process');
    console.log('\n  Installing zero-http...\n');
    execSync('npm install zero-http --save-dev', { stdio: 'inherit' });
    zeroHttp = require('zero-http');
  }

  const { createApp, static: serveStatic } = zeroHttp;

  const app  = createApp();
  const pool = new SSEPool();

  // ---- SSE endpoint ----
  app.get('/__zq_reload', (req, res) => {
    const sse = res.sse({ keepAlive: 30000, keepAliveComment: 'ping' });
    pool.add(sse);
  });

  // ---- DevTools panel ----
  app.get('/_devtools', (req, res) => {
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'no-cache');
    res.send(DEVTOOLS_HTML);
  });

  // ---- Auto-resolve zquery.min.js ----
  const pkgRoot = path.resolve(__dirname, '..', '..', '..');

  app.use((req, res, next) => {
    if (noIntercept) return next();
    const basename = path.basename(req.url.split('?')[0]).toLowerCase();
    if (basename !== 'zquery.min.js') return next();

    const candidates = [
      path.join(pkgRoot, 'dist', 'zquery.min.js'),
      path.join(root, 'node_modules', 'zero-query', 'dist', 'zquery.min.js'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        res.set('Content-Type', 'application/javascript; charset=utf-8');
        res.set('Cache-Control', 'no-cache');
        res.send(fs.readFileSync(p, 'utf-8'));
        return;
      }
    }
    next();
  });

  // ---- Static files ----
  app.use(serveStatic(root, { index: false, dotfiles: 'ignore' }));

  // ---- SPA fallback - inject overlay/SSE snippet ----
  app.get('*', (req, res) => {
    if (path.extname(req.url) && path.extname(req.url) !== '.html') {
      res.status(404).send('Not Found');
      return;
    }
    const indexPath = path.join(root, htmlEntry);
    if (!fs.existsSync(indexPath)) {
      res.status(404).send(`${htmlEntry} not found`);
      return;
    }
    let html = fs.readFileSync(indexPath, 'utf-8');
    if (html.includes('</body>')) {
      html = html.replace('</body>', OVERLAY_SCRIPT + '\n</body>');
    } else {
      html += OVERLAY_SCRIPT;
    }
    res.html(html);
  });

  function listen(cb) {
    app.listen(port, cb);
  }

  return { app, pool, listen };
}

module.exports = { createServer, SSEPool };
