/**
 * cli/utils.js — shared utility functions
 *
 * Context-aware comment stripping, quick minification, size formatting,
 * and recursive directory copying. These are consumed by both the
 * build and bundle commands.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// stripComments — context-aware, skips strings / templates / regex
// ---------------------------------------------------------------------------

function stripComments(code) {
  let out = '';
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    const next = code[i + 1];

    // String literals
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      out += ch; i++;
      while (i < code.length) {
        if (code[i] === '\\') { out += code[i] + (code[i + 1] || ''); i += 2; continue; }
        out += code[i];
        if (code[i] === quote) { i++; break; }
        i++;
      }
      continue;
    }

    // Block comment
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    // Line comment
    if (ch === '/' && next === '/') {
      i += 2;
      while (i < code.length && code[i] !== '\n') i++;
      continue;
    }

    // Regex literal
    if (ch === '/') {
      const before = out.replace(/\s+$/, '');
      const last = before[before.length - 1];
      const isRegexCtx = !last || '=({[,;:!&|?~+-*/%^>'.includes(last)
        || before.endsWith('return') || before.endsWith('typeof')
        || before.endsWith('case') || before.endsWith('in')
        || before.endsWith('delete') || before.endsWith('void')
        || before.endsWith('throw') || before.endsWith('new');
      if (isRegexCtx) {
        out += ch; i++;
        let inCharClass = false;
        while (i < code.length) {
          const rc = code[i];
          if (rc === '\\') { out += rc + (code[i + 1] || ''); i += 2; continue; }
          if (rc === '[') inCharClass = true;
          if (rc === ']') inCharClass = false;
          out += rc; i++;
          if (rc === '/' && !inCharClass) {
            while (i < code.length && /[gimsuy]/.test(code[i])) { out += code[i]; i++; }
            break;
          }
        }
        continue;
      }
    }

    out += ch; i++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// minify — quick minification (strips comments + collapses whitespace)
// ---------------------------------------------------------------------------

function minify(code, banner) {
  const body = stripComments(code.replace(banner, ''))
    .replace(/^\s*\n/gm, '')
    .replace(/\n\s+/g, '\n')
    .replace(/\s{2,}/g, ' ');
  return banner + '\n' + body;
}

// ---------------------------------------------------------------------------
// sizeKB — human-readable file size
// ---------------------------------------------------------------------------

function sizeKB(buf) {
  return (buf.length / 1024).toFixed(1);
}

// ---------------------------------------------------------------------------
// copyDirSync — recursive directory copy
// ---------------------------------------------------------------------------

function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

module.exports = { stripComments, minify, sizeKB, copyDirSync };
