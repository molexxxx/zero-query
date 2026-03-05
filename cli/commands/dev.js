/**
 * cli/commands/dev.js — development server with live-reload
 *
 * Starts a zero-http server that serves the project root, injects an
 * SSE live-reload snippet, auto-resolves zquery.min.js, and watches
 * for file changes (CSS hot-swap, everything else full reload).
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const { args, flag, option } = require('../args');

// ---------------------------------------------------------------------------
// SSE live-reload client script injected into served HTML
// ---------------------------------------------------------------------------

const LIVE_RELOAD_SNIPPET = `<script>
(function(){
  var es, timer;
  function connect(){
    es = new EventSource('/__zq_reload');
    es.addEventListener('reload', function(){ location.reload(); });
    es.addEventListener('css', function(e){
      var sheets = document.querySelectorAll('link[rel="stylesheet"]');
      sheets.forEach(function(l){
        var href = l.getAttribute('href');
        if(!href) return;
        var sep = href.indexOf('?') >= 0 ? '&' : '?';
        l.setAttribute('href', href.replace(/[?&]_zqr=\\\\d+/, '') + sep + '_zqr=' + Date.now());
      });
    });
    es.onerror = function(){
      es.close();
      clearTimeout(timer);
      timer = setTimeout(connect, 2000);
    };
  }
  connect();
})();
</script>`;

// ---------------------------------------------------------------------------
// devServer
// ---------------------------------------------------------------------------

function devServer() {
  let zeroHttp;
  try {
    zeroHttp = require('zero-http');
  } catch (_) {
    console.error(`\n  ✗ zero-http is required for the dev server.`);
    console.error(`    Install it: npm install zero-http --save-dev\n`);
    process.exit(1);
  }

  const { createApp, static: serveStatic } = zeroHttp;

  // Determine the project root to serve
  let root = null;
  for (let i = 1; i < args.length; i++) {
    if (!args[i].startsWith('-') && args[i - 1] !== '-p' && args[i - 1] !== '--port') {
      root = path.resolve(process.cwd(), args[i]);
      break;
    }
  }
  if (!root) {
    const candidates = [
      process.cwd(),
      path.join(process.cwd(), 'public'),
      path.join(process.cwd(), 'src'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(path.join(c, 'index.html'))) { root = c; break; }
    }
    if (!root) root = process.cwd();
  }

  const PORT = parseInt(option('port', 'p', '3100'));

  // SSE clients
  const sseClients = new Set();

  const app = createApp();

  // SSE endpoint
  app.get('/__zq_reload', (req, res) => {
    const sse = res.sse({ keepAlive: 30000, keepAliveComment: 'ping' });
    sseClients.add(sse);
    sse.on('close', () => sseClients.delete(sse));
  });

  // Auto-resolve zquery.min.js
  // __dirname is cli/commands/, package root is two levels up
  const pkgRoot     = path.resolve(__dirname, '..', '..');
  const noIntercept = flag('no-intercept');

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

  // Static file serving
  app.use(serveStatic(root, { index: false, dotfiles: 'ignore' }));

  // SPA fallback — inject live-reload
  app.get('*', (req, res) => {
    if (path.extname(req.url) && path.extname(req.url) !== '.html') {
      res.status(404).send('Not Found');
      return;
    }
    const indexPath = path.join(root, 'index.html');
    if (!fs.existsSync(indexPath)) {
      res.status(404).send('index.html not found');
      return;
    }
    let html = fs.readFileSync(indexPath, 'utf-8');
    if (html.includes('</body>')) {
      html = html.replace('</body>', LIVE_RELOAD_SNIPPET + '\n</body>');
    } else {
      html += LIVE_RELOAD_SNIPPET;
    }
    res.html(html);
  });

  // Broadcast helper
  function broadcast(eventType, data) {
    for (const sse of sseClients) {
      try { sse.event(eventType, data || ''); } catch (_) { sseClients.delete(sse); }
    }
  }

  // File watcher
  const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', '.cache']);
  let debounceTimer;

  function shouldWatch(filename) {
    if (!filename) return false;
    if (filename.startsWith('.')) return false;
    return true;
  }

  function isIgnored(filepath) {
    const parts = filepath.split(path.sep);
    return parts.some(p => IGNORE_DIRS.has(p));
  }

  function collectWatchDirs(dir) {
    const dirs = [dir];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (IGNORE_DIRS.has(entry.name)) continue;
        const sub = path.join(dir, entry.name);
        dirs.push(...collectWatchDirs(sub));
      }
    } catch (_) {}
    return dirs;
  }

  const watchDirs = collectWatchDirs(root);
  const watchers  = [];

  for (const dir of watchDirs) {
    try {
      const watcher = fs.watch(dir, (eventType, filename) => {
        if (!shouldWatch(filename)) return;
        const fullPath = path.join(dir, filename || '');
        if (isIgnored(fullPath)) return;

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const rel = path.relative(root, fullPath).replace(/\\/g, '/');
          const ext = path.extname(filename).toLowerCase();
          const now = new Date().toLocaleTimeString();

          if (ext === '.css') {
            console.log(`  ${now}  \x1b[35m css \x1b[0m ${rel}`);
            broadcast('css', rel);
          } else {
            console.log(`  ${now}  \x1b[36m reload \x1b[0m ${rel}`);
            broadcast('reload', rel);
          }
        }, 100);
      });
      watchers.push(watcher);
    } catch (_) {}
  }

  app.listen(PORT, () => {
    console.log(`\n  \x1b[1mzQuery Dev Server\x1b[0m`);
    console.log(`  \x1b[2m${'─'.repeat(40)}\x1b[0m`);
    console.log(`  Local:       \x1b[36mhttp://localhost:${PORT}/\x1b[0m`);
    console.log(`  Root:        ${path.relative(process.cwd(), root) || '.'}`);
    console.log(`  Live Reload: \x1b[32menabled\x1b[0m (SSE)`);
    if (noIntercept) console.log(`  Intercept:   \x1b[33mdisabled\x1b[0m (--no-intercept)`);
    console.log(`  Watching:    all files in ${watchDirs.length} director${watchDirs.length === 1 ? 'y' : 'ies'}`);
    console.log(`  \x1b[2m${'─'.repeat(40)}\x1b[0m`);
    console.log(`  Press Ctrl+C to stop\n`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n  Shutting down...');
    watchers.forEach(w => w.close());
    for (const sse of sseClients) { try { sse.close(); } catch (_) {} }
    app.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000);
  });
}

module.exports = devServer;
