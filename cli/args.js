/**
 * cli/args.js — CLI argument parsing helpers
 *
 * Provides the raw args array and two helper functions for reading
 * named flags (--verbose, -v) and valued options (--port 8080, -p 8080).
 */

'use strict';

const args = process.argv.slice(2);

/**
 * Check whether a boolean flag is present.
 *   flag('verbose', 'v')  →  true if --verbose or -v appears
 */
function flag(name, short) {
  const i = args.indexOf(`--${name}`);
  const j = short ? args.indexOf(`-${short}`) : -1;
  return i !== -1 || j !== -1;
}

/**
 * Read a string-valued option.
 *   option('port', 'p', '3100')  →  the value after --port / -p, or '3100'
 */
function option(name, short, fallback) {
  let i = args.indexOf(`--${name}`);
  if (i === -1 && short) i = args.indexOf(`-${short}`);
  if (i !== -1 && i + 1 < args.length) return args[i + 1];
  return fallback;
}

module.exports = { args, flag, option };
