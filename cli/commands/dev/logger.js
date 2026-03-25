/**
 * cli/commands/dev/logger.js - Terminal output helpers
 *
 * Provides styled console output for the dev server: startup banner,
 * timestamped file-change messages, and error formatting.
 */

'use strict';

// ANSI colour helpers (works on all modern terminals)
const c = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  cyan:    '\x1b[36m',
  magenta: '\x1b[35m',
};

function timestamp() {
  return new Date().toLocaleTimeString();
}

// ---------------------------------------------------------------------------
// Event-level log helpers
// ---------------------------------------------------------------------------

function logCSS(relPath) {
  console.log(`  ${timestamp()}  ${c.magenta} css ${c.reset} ${relPath}`);
}

function logReload(relPath) {
  console.log(`  ${timestamp()}  ${c.cyan} reload ${c.reset} ${relPath}`);
}

function logError(descriptor) {
  const t = timestamp();
  console.log(`  ${t}  ${c.red} error ${c.reset} ${descriptor.file}`);
  console.log(`         ${c.red}${descriptor.type}: ${descriptor.message}${c.reset}`);
  if (descriptor.line) {
    console.log(`         ${c.dim}at line ${descriptor.line}${descriptor.column ? ':' + descriptor.column : ''}${c.reset}`);
  }
}

// ---------------------------------------------------------------------------
// Startup banner
// ---------------------------------------------------------------------------

function printBanner({ port, root, htmlEntry, noIntercept, bundleMode, watchDirCount }) {
  const rule = c.dim + '-'.repeat(40) + c.reset;
  console.log(`\n  ${c.bold}zQuery Dev Server${c.reset}`);
  console.log(`  ${rule}`);
  console.log(`  Local:       ${c.cyan}http://localhost:${port}/${c.reset}`);
  console.log(`  DevTools:    ${c.cyan}http://localhost:${port}/_devtools${c.reset}`);
  console.log(`  Root:        ${root}`);
  if (bundleMode) {
    console.log(`  Mode:        ${c.yellow}bundled${c.reset} (serving from dist/server/)`);
  }
  if (htmlEntry !== 'index.html') {
    console.log(`  HTML:        ${c.cyan}${htmlEntry}${c.reset}`);
  }
  console.log(`  Live Reload: ${c.green}enabled${c.reset} (SSE)`);
  console.log(`  Overlay:     ${c.green}enabled${c.reset} (syntax + runtime + ZQueryError)`);
  console.log(`  Fetch Log:   ${c.green}enabled${c.reset} (auto-intercept all fetch/$.http)`);
  if (noIntercept) {
    console.log(`  Intercept:   ${c.yellow}disabled${c.reset} (--no-intercept)`);
  }
  console.log(`  Watching:    all files in ${watchDirCount} director${watchDirCount === 1 ? 'y' : 'ies'}`);
  console.log(`  ${rule}`);
  console.log(`  Press Ctrl+C to stop\n`);
}

module.exports = { logCSS, logReload, logError, printBanner };
