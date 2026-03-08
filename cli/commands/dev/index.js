/**
 * cli/commands/dev/index.js — Dev server orchestrator
 *
 * Ties together the HTTP server, file watcher, logger, and overlay
 * to provide a complete development environment with live-reload,
 * syntax validation, and a full-screen error overlay that surfaces
 * both build-time and runtime ZQueryErrors.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const { args, flag, option } = require('../../args');
const { createServer }       = require('./server');
const { startWatcher }       = require('./watcher');
const { printBanner }        = require('./logger');

// ---------------------------------------------------------------------------
// Resolve project root
// ---------------------------------------------------------------------------

function resolveRoot(htmlEntry) {
  // Explicit positional argument  →  zquery dev <dir>
  for (let i = 1; i < args.length; i++) {
    const prev = args[i - 1];
    if (!args[i].startsWith('-') && prev !== '-p' && prev !== '--port' && prev !== '--index' && prev !== '-i') {
      return path.resolve(process.cwd(), args[i]);
    }
  }

  // Auto-detect: first candidate that contains the HTML entry file
  const candidates = [
    process.cwd(),
    path.join(process.cwd(), 'public'),
    path.join(process.cwd(), 'src'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, htmlEntry))) return c;
  }
  return process.cwd();
}

// ---------------------------------------------------------------------------
// devServer — main entry point (called from cli/index.js)
// ---------------------------------------------------------------------------

function devServer() {
  const htmlEntry   = option('index', 'i', 'index.html');
  const port        = parseInt(option('port', 'p', '3100'), 10);
  const noIntercept = flag('no-intercept');
  const root        = resolveRoot(htmlEntry);

  // Start HTTP server + SSE pool
  const { app, pool, listen } = createServer({ root, htmlEntry, port, noIntercept });

  // Start file watcher
  const watcher = startWatcher({ root, pool });

  // Boot
  listen(() => {
    printBanner({
      port,
      root:          path.relative(process.cwd(), root) || '.',
      htmlEntry,
      noIntercept,
      watchDirCount: watcher.dirs.length,
    });
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n  Shutting down...');
    watcher.destroy();
    pool.closeAll();
    app.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000);
  });
}

module.exports = devServer;
