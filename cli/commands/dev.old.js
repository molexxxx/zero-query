/**
 * cli/commands/dev.js — development server with live-reload
 *
 * Starts a zero-http server that serves the project root, injects an
 * SSE live-reload snippet, auto-resolves zquery.min.js, and watches
 * for file changes (CSS hot-swap, everything else full reload).
 *
 * Features:
 *   - Pre-validates JS files on save and reports syntax errors
 *   - Broadcasts errors to the browser via SSE with code frames
 *   - Full-screen error overlay in the browser (runtime + syntax)
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const { args, flag, option } = require('../args');

// ---------------------------------------------------------------------------
// Syntax validation helpers
// ---------------------------------------------------------------------------

/**
 * Generate a code frame string for an error at a given line/column.
 * Shows ~4 lines of context around the error with a caret pointer.
 */
function generateCodeFrame(source, line, column) {
  const lines  = source.split('\n');
  const start  = Math.max(0, line - 4);
  const end    = Math.min(lines.length, line + 3);
  const pad    = String(end).length;
  const frame  = [];

  for (let i = start; i < end; i++) {
    const lineNum = String(i + 1).padStart(pad);
    const marker  = i === line - 1 ? '>' : ' ';
    frame.push(`${marker} ${lineNum} | ${lines[i]}`);
    if (i === line - 1 && column > 0) {
      frame.push(`  ${' '.repeat(pad)} | ${' '.repeat(column - 1)}^`);
    }
  }
  return frame.join('\n');
}

/**
 * Validate a JavaScript file for syntax errors using Node's VM module.
 * Returns null if valid, or an error descriptor object.
 */
function validateJS(filePath, relPath) {
  let source;
  try { source = fs.readFileSync(filePath, 'utf-8'); } catch { return null; }

  // Strip import/export so the VM can parse it as a script.
  // Process line-by-line to guarantee line numbers stay accurate.
  const normalized = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const stripped = normalized.split('\n').map(line => {
    if (/^\s*import\s+.*from\s+['"]/.test(line))  return ' '.repeat(line.length);
    if (/^\s*import\s+['"]/.test(line))            return ' '.repeat(line.length);
    if (/^\s*export\s*\{/.test(line))              return ' '.repeat(line.length);
    line = line.replace(/^(\s*)export\s+default\s+/, '$1');
    line = line.replace(/^(\s*)export\s+(const|let|var|function|class|async\s+function)\s/, '$1$2 ');
    // import.meta is module-only syntax; replace with a harmless expression
    line = line.replace(/import\.meta\.url/g, "'__meta__'");
    line = line.replace(/import\.meta/g, '({})');
    return line;
  }).join('\n');

  try {
    new vm.Script(stripped, { filename: relPath });
    return null;
  } catch (err) {
    const line  = err.stack ? parseInt((err.stack.match(/:(\d+)/) || [])[1]) || 0 : 0;
    const col   = err.stack ? parseInt((err.stack.match(/:(\d+):(\d+)/) || [])[2]) || 0 : 0;
    const frame = line > 0 ? generateCodeFrame(source, line, col) : '';
    return {
      type:    err.constructor.name || 'SyntaxError',
      message: err.message,
      file:    relPath,
      line,
      column:  col,
      frame,
    };
  }
}

// ---------------------------------------------------------------------------
// SSE live-reload + error overlay client script injected into served HTML
// ---------------------------------------------------------------------------

const LIVE_RELOAD_SNIPPET = `<script>
(function(){
  // -----------------------------------------------------------------------
  // Error Overlay
  // -----------------------------------------------------------------------
  var overlayEl = null;

  var OVERLAY_STYLE =
    'position:fixed;top:0;left:0;width:100%;height:100%;' +
    'background:rgba(0,0,0,0.92);color:#fff;z-index:2147483647;' +
    'font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;' +
    'font-size:13px;overflow-y:auto;padding:0;margin:0;box-sizing:border-box;';

  var HEADER_STYLE =
    'padding:20px 24px 12px;border-bottom:1px solid rgba(255,255,255,0.1);' +
    'display:flex;align-items:flex-start;justify-content:space-between;';

  var TYPE_STYLE =
    'display:inline-block;padding:3px 8px;border-radius:4px;font-size:11px;' +
    'font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;';

  function createOverlay(data) {
    removeOverlay();
    var wrap = document.createElement('div');
    wrap.id = '__zq_error_overlay';
    wrap.setAttribute('style', OVERLAY_STYLE);
    // keyboard focus for esc
    wrap.setAttribute('tabindex', '-1');

    var isSyntax = data.type && /syntax|parse/i.test(data.type);
    var badgeColor = isSyntax ? '#e74c3c' : '#e67e22';

    var html = '';
    // Header row
    html += '<div style="' + HEADER_STYLE + '">';
    html += '<div>';
    html += '<span style="' + TYPE_STYLE + 'background:' + badgeColor + ';">' + esc(data.type || 'Error') + '</span>';
    html += '<div style="font-size:18px;font-weight:600;line-height:1.4;color:#ff6b6b;margin-top:4px;">';
    html += esc(data.message || 'Unknown error');
    html += '</div>';
    html += '</div>';
    // Close button
    html += '<button id="__zq_close" style="' +
      'background:none;border:1px solid rgba(255,255,255,0.2);color:#999;' +
      'font-size:20px;cursor:pointer;border-radius:6px;width:32px;height:32px;' +
      'display:flex;align-items:center;justify-content:center;flex-shrink:0;' +
      'margin-left:16px;transition:all 0.15s;"' +
      ' onmouseover="this.style.color=\\'#fff\\';this.style.borderColor=\\'rgba(255,255,255,0.5)\\'"' +
      ' onmouseout="this.style.color=\\'#999\\';this.style.borderColor=\\'rgba(255,255,255,0.2)\\'"' +
      '>&times;</button>';
    html += '</div>';

    // File location
    if (data.file) {
      html += '<div style="padding:10px 24px;color:#8be9fd;font-size:13px;">';
      html += '<span style="color:#888;">File: </span>' + esc(data.file);
      if (data.line) html += '<span style="color:#888;">:</span>' + data.line;
      if (data.column) html += '<span style="color:#888;">:</span>' + data.column;
      html += '</div>';
    }

    // Code frame
    if (data.frame) {
      html += '<pre style="' +
        'margin:0;padding:16px 24px;background:rgba(255,255,255,0.04);' +
        'border-top:1px solid rgba(255,255,255,0.06);' +
        'border-bottom:1px solid rgba(255,255,255,0.06);' +
        'overflow-x:auto;line-height:1.6;font-size:13px;' +
        '">';
      var frameLines = data.frame.split('\\n');
      for (var i = 0; i < frameLines.length; i++) {
        var fl = frameLines[i];
        if (fl.charAt(0) === '>') {
          html += '<span style="color:#ff6b6b;font-weight:600;">' + esc(fl) + '</span>\\n';
        } else if (fl.indexOf('^') !== -1 && fl.trim().replace(/[\\s|^]/g, '') === '') {
          html += '<span style="color:#e74c3c;font-weight:700;">' + esc(fl) + '</span>\\n';
        } else {
          html += '<span style="color:#999;">' + esc(fl) + '</span>\\n';
        }
      }
      html += '</pre>';
    }

    // Stack trace
    if (data.stack) {
      html += '<div style="padding:16px 24px;">';
      html += '<div style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Stack Trace</div>';
      html += '<pre style="margin:0;color:#bbb;font-size:12px;line-height:1.7;white-space:pre-wrap;word-break:break-word;">';
      html += esc(data.stack);
      html += '</pre></div>';
    }

    // Tip
    html += '<div style="padding:16px 24px;color:#555;font-size:11px;border-top:1px solid rgba(255,255,255,0.06);">';
    html += 'Fix the error and save — the overlay will clear automatically. Press <kbd style="' +
      'background:rgba(255,255,255,0.1);padding:1px 6px;border-radius:3px;font-size:11px;' +
      '">Esc</kbd> to dismiss.';
    html += '</div>';

    wrap.innerHTML = html;
    document.body.appendChild(wrap);
    overlayEl = wrap;

    // Close button handler
    var closeBtn = document.getElementById('__zq_close');
    if (closeBtn) closeBtn.addEventListener('click', removeOverlay);
    wrap.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') removeOverlay();
    });
    wrap.focus();
  }

  function removeOverlay() {
    if (overlayEl && overlayEl.parentNode) {
      overlayEl.parentNode.removeChild(overlayEl);
    }
    overlayEl = null;
  }

  function esc(s) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(s));
    return d.innerHTML;
  }

  // -----------------------------------------------------------------------
  // Runtime error handlers
  // -----------------------------------------------------------------------
  window.addEventListener('error', function(e) {
    if (!e.filename) return;
    var data = {
      type: (e.error && e.error.constructor && e.error.constructor.name) || 'Error',
      message: e.message || String(e.error),
      file: e.filename.replace(location.origin, ''),
      line: e.lineno || 0,
      column: e.colno || 0,
      stack: e.error && e.error.stack ? cleanStack(e.error.stack) : ''
    };
    createOverlay(data);
    logToConsole(data);
  });

  window.addEventListener('unhandledrejection', function(e) {
    var err = e.reason;
    var data = {
      type: 'Unhandled Promise Rejection',
      message: err && err.message ? err.message : String(err),
      stack: err && err.stack ? cleanStack(err.stack) : ''
    };
    createOverlay(data);
    logToConsole(data);
  });

  function cleanStack(stack) {
    return stack.split('\\n')
      .filter(function(l) {
        return l.indexOf('__zq_') === -1 && l.indexOf('EventSource') === -1;
      })
      .map(function(l) {
        return l.replace(location.origin, '');
      })
      .join('\\n');
  }

  function logToConsole(data) {
    var msg = '\\n%c zQuery DevError %c ' + data.type + ': ' + data.message;
    if (data.file) msg += '\\n  at ' + data.file + (data.line ? ':' + data.line : '') + (data.column ? ':' + data.column : '');
    console.error(msg, 'background:#e74c3c;color:#fff;padding:2px 6px;border-radius:3px;font-weight:700;', 'color:inherit;');
    if (data.frame) console.error(data.frame);
  }

  // -----------------------------------------------------------------------
  // SSE connection (live-reload + error events)
  // -----------------------------------------------------------------------
  var es, timer;
  function connect(){
    es = new EventSource('/__zq_reload');

    es.addEventListener('reload', function(){
      removeOverlay();
      location.reload();
    });

    es.addEventListener('css', function(e){
      var sheets = document.querySelectorAll('link[rel="stylesheet"]');
      sheets.forEach(function(l){
        var href = l.getAttribute('href');
        if(!href) return;
        var sep = href.indexOf('?') >= 0 ? '&' : '?';
        l.setAttribute('href', href.replace(/[?&]_zqr=\\\\d+/, '') + sep + '_zqr=' + Date.now());
      });
    });

    es.addEventListener('error:syntax', function(e){
      try {
        var data = JSON.parse(e.data);
        createOverlay(data);
        logToConsole(data);
      } catch(_){}
    });

    es.addEventListener('error:clear', function(){
      removeOverlay();
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

  // Custom HTML entry file (default: index.html)
  const htmlEntry = option('index', 'i', 'index.html');

  // Determine the project root to serve
  let root = null;
  for (let i = 1; i < args.length; i++) {
    if (!args[i].startsWith('-') && args[i - 1] !== '-p' && args[i - 1] !== '--port' && args[i - 1] !== '--index') {
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
      if (fs.existsSync(path.join(c, htmlEntry))) { root = c; break; }
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
    const indexPath = path.join(root, htmlEntry);
    if (!fs.existsSync(indexPath)) {
      res.status(404).send(`${htmlEntry} not found`);
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

  // Track current error state to know when to clear
  let currentError = null;

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
            return;
          }

          // Validate JS files for syntax errors before triggering reload
          if (ext === '.js') {
            const err = validateJS(fullPath, rel);
            if (err) {
              currentError = rel;
              console.log(`  ${now}  \x1b[31m error \x1b[0m ${rel}`);
              console.log(`         \x1b[31m${err.type}: ${err.message}\x1b[0m`);
              if (err.line) console.log(`         \x1b[2mat line ${err.line}${err.column ? ':' + err.column : ''}\x1b[0m`);
              broadcast('error:syntax', JSON.stringify(err));
              return;
            }
            // File was fixed — clear previous error if it was in this file
            if (currentError === rel) {
              currentError = null;
              broadcast('error:clear', '');
            }
          }

          console.log(`  ${now}  \x1b[36m reload \x1b[0m ${rel}`);
          broadcast('reload', rel);
        }, 100);
      });
      watchers.push(watcher);
    } catch (_) {}
  }

  app.listen(PORT, () => {
    console.log(`\n  \x1b[1mzQuery Dev Server\x1b[0m`);
    console.log(`  \x1b[2m${'-'.repeat(40)}\x1b[0m`);
    console.log(`  Local:       \x1b[36mhttp://localhost:${PORT}/\x1b[0m`);
    console.log(`  Root:        ${path.relative(process.cwd(), root) || '.'}`);
    if (htmlEntry !== 'index.html') console.log(`  HTML:        \x1b[36m${htmlEntry}\x1b[0m`);
    console.log(`  Live Reload: \x1b[32menabled\x1b[0m (SSE)`);
    console.log(`  Overlay:     \x1b[32menabled\x1b[0m (syntax + runtime errors)`);
    if (noIntercept) console.log(`  Intercept:   \x1b[33mdisabled\x1b[0m (--no-intercept)`);
    console.log(`  Watching:    all files in ${watchDirs.length} director${watchDirs.length === 1 ? 'y' : 'ies'}`);
    console.log(`  \x1b[2m${'-'.repeat(40)}\x1b[0m`);
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
