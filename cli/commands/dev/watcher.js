/**
 * cli/commands/dev/watcher.js — File system watcher
 *
 * Recursively watches the project root for file changes, validates
 * JS files for syntax errors, and broadcasts reload / CSS hot-swap /
 * error events through the SSE pool.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const { validateJS }                      = require('./validator');
const { logCSS, logReload, logError }     = require('./logger');

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', '.cache']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shouldWatch(filename) {
  return !!filename && !filename.startsWith('.');
}

function isIgnored(filepath) {
  return filepath.split(path.sep).some(p => IGNORE_DIRS.has(p));
}

/**
 * Return the file's mtime as a millisecond timestamp, or 0 if unreadable.
 * Used to ignore spurious fs.watch events (Windows fires on reads too).
 */
function mtime(filepath) {
  try { return fs.statSync(filepath).mtimeMs; } catch { return 0; }
}

/** Recursively collect every directory under `dir` (excluding ignored). */
function collectWatchDirs(dir) {
  const dirs = [dir];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || IGNORE_DIRS.has(entry.name)) continue;
      dirs.push(...collectWatchDirs(path.join(dir, entry.name)));
    }
  } catch { /* unreadable dir — skip */ }
  return dirs;
}

// ---------------------------------------------------------------------------
// Watcher factory
// ---------------------------------------------------------------------------

/**
 * Start watching `root` for file changes.
 *
 * @param {object}  opts
 * @param {string}  opts.root  — absolute project root
 * @param {SSEPool} opts.pool  — SSE broadcast pool
 * @returns {{ dirs: string[], destroy: Function }}
 */
function startWatcher({ root, pool, bundleMode, serveRoot }) {
  const watchDirs = collectWatchDirs(root);
  const watchers  = [];

  let debounceTimer;
  let currentError = null;   // track which file has an active error
  let bundleTimer = null;    // debounce for bundle rebuilds

  // Track file mtimes so we only react to genuine writes.
  // On Windows, fs.watch fires on reads/access too, which causes
  // spurious reloads the first time the server serves a file.
  // We seed the cache with current mtimes so the first real save
  // (which changes the mtime) is always detected.
  const mtimeCache = new Map();
  for (const d of watchDirs) {
    try {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        if (entry.isFile()) {
          const fp = path.join(d, entry.name);
          const mt = mtime(fp);
          if (mt) mtimeCache.set(fp, mt);
        }
      }
    } catch { /* skip */ }
  }

  for (const dir of watchDirs) {
    try {
      const watcher = fs.watch(dir, (_, filename) => {
        if (!shouldWatch(filename)) return;
        const fullPath = path.join(dir, filename || '');
        if (isIgnored(fullPath)) return;

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          // Skip if the file hasn't actually been modified
          const mt = mtime(fullPath);
          if (mt === 0) return;                 // deleted or unreadable
          const prev = mtimeCache.get(fullPath);
          mtimeCache.set(fullPath, mt);
          if (prev !== undefined && mt === prev) return; // unchanged

          const rel = path.relative(root, fullPath).replace(/\\/g, '/');
          const ext = path.extname(filename).toLowerCase();

          // ---- CSS hot-swap ----
          if (ext === '.css') {
            logCSS(rel);
            pool.broadcast('css', rel);
            return;
          }

          // ---- JS syntax check ----
          if (ext === '.js') {
            const err = validateJS(fullPath, rel);
            if (err) {
              currentError = rel;
              logError(err);
              pool.broadcast('error:syntax', JSON.stringify(err));
              return;
            }
            // File was fixed — clear previous overlay
            if (currentError === rel) {
              currentError = null;
              pool.broadcast('error:clear', '');
            }
          }

          // ---- Full reload ----
          if (bundleMode) {
            // Debounce bundle rebuilds (500ms) so rapid saves don't spam
            clearTimeout(bundleTimer);
            bundleTimer = setTimeout(() => {
              try {
                const bundleFn = require('../bundle');
                const { args: cliArgs } = require('../../args');
                const savedArgs = cliArgs.slice();
                cliArgs.length = 0;
                cliArgs.push('bundle');
                const prevCwd = process.cwd();
                process.chdir(root);
                bundleFn();
                process.chdir(prevCwd);
                cliArgs.length = 0;
                savedArgs.forEach(a => cliArgs.push(a));
                logReload(rel + ' (rebuilt)');
                pool.broadcast('reload', rel);
              } catch (err) {
                console.error('  Bundle rebuild failed:', err.message);
              }
            }, 500);
            return;
          }
          logReload(rel);
          pool.broadcast('reload', rel);
        }, 100);
      });
      watchers.push(watcher);
    } catch { /* dir became inaccessible — skip */ }
  }

  function destroy() {
    clearTimeout(debounceTimer);
    watchers.forEach(w => w.close());
  }

  return { dirs: watchDirs, destroy };
}

module.exports = { startWatcher, collectWatchDirs };
