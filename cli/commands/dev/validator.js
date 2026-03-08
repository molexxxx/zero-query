/**
 * cli/commands/dev/validator.js — JS syntax validation
 *
 * Pre-validates JavaScript files on save using Node's VM module.
 * Returns structured error descriptors with code frames compatible
 * with the browser error overlay.
 */

'use strict';

const fs = require('fs');
const vm = require('vm');

// ---------------------------------------------------------------------------
// Code frame generator
// ---------------------------------------------------------------------------

/**
 * Build a code frame showing ~4 lines of context around the error
 * with a caret pointer at the offending column.
 *
 * @param {string} source   — full file contents
 * @param {number} line     — 1-based line number
 * @param {number} column   — 1-based column number
 * @returns {string}
 */
function generateCodeFrame(source, line, column) {
  const lines = source.split('\n');
  const start = Math.max(0, line - 4);
  const end   = Math.min(lines.length, line + 3);
  const pad   = String(end).length;
  const frame = [];

  for (let i = start; i < end; i++) {
    const num    = String(i + 1).padStart(pad);
    const marker = i === line - 1 ? '>' : ' ';
    frame.push(`${marker} ${num} | ${lines[i]}`);
    if (i === line - 1 && column > 0) {
      frame.push(`  ${' '.repeat(pad)} | ${' '.repeat(column - 1)}^`);
    }
  }
  return frame.join('\n');
}

// ---------------------------------------------------------------------------
// JS validation
// ---------------------------------------------------------------------------

/**
 * Validate a JavaScript file for syntax errors.
 *
 * Strips ESM import/export statements (preserving line numbers) so the
 * VM can parse module-style code, then compiles via vm.Script.
 *
 * @param {string} filePath — absolute path to the file
 * @param {string} relPath  — display-friendly relative path
 * @returns {object|null}   — error descriptor, or null if valid
 */
function validateJS(filePath, relPath) {
  let source;
  try { source = fs.readFileSync(filePath, 'utf-8'); } catch { return null; }

  const normalized = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const stripped = normalized.split('\n').map(line => {
    if (/^\s*import\s+.*from\s+['"]/.test(line))  return ' '.repeat(line.length);
    if (/^\s*import\s+['"]/.test(line))            return ' '.repeat(line.length);
    if (/^\s*export\s*\{/.test(line))              return ' '.repeat(line.length);
    line = line.replace(/^(\s*)export\s+default\s+/, '$1');
    line = line.replace(/^(\s*)export\s+(const|let|var|function|class|async\s+function)\s/, '$1$2 ');
    line = line.replace(/import\.meta\.url/g, "'__meta__'");
    line = line.replace(/import\.meta/g, '({})');
    return line;
  }).join('\n');

  try {
    new vm.Script(stripped, { filename: relPath });
    return null;
  } catch (err) {
    const line   = err.stack ? parseInt((err.stack.match(/:(\d+)/) || [])[1]) || 0 : 0;
    const col    = err.stack ? parseInt((err.stack.match(/:(\d+):(\d+)/) || [])[2]) || 0 : 0;
    const frame  = line > 0 ? generateCodeFrame(source, line, col) : '';
    return {
      code:    'ZQ_DEV_SYNTAX',
      type:    err.constructor.name || 'SyntaxError',
      message: err.message,
      file:    relPath,
      line,
      column:  col,
      frame,
    };
  }
}

module.exports = { generateCodeFrame, validateJS };
