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
// _copyTemplateLiteral — copy a template literal verbatim, tracking ${…}
//   nesting so that `//` inside template text isn't mistaken for a comment.
// ---------------------------------------------------------------------------

function _copyTemplateLiteral(code, start) {
  let out = '`';
  let i = start + 1; // skip opening backtick
  let depth = 0;
  while (i < code.length) {
    if (code[i] === '\\') { out += code[i] + (code[i + 1] || ''); i += 2; continue; }
    if (code[i] === '$' && code[i + 1] === '{') { depth++; out += '${'; i += 2; continue; }
    if (depth > 0) {
      if (code[i] === '{') { depth++; out += code[i]; i++; continue; }
      if (code[i] === '}') { depth--; out += code[i]; i++; continue; }
      if (code[i] === '`') {
        const nested = _copyTemplateLiteral(code, i);
        out += nested.text; i = nested.end; continue;
      }
      if (code[i] === '"' || code[i] === "'") {
        const q = code[i]; out += code[i]; i++;
        while (i < code.length) {
          if (code[i] === '\\') { out += code[i] + (code[i + 1] || ''); i += 2; continue; }
          out += code[i];
          if (code[i] === q) { i++; break; }
          i++;
        }
        continue;
      }
      out += code[i]; i++; continue;
    }
    if (code[i] === '`') { out += '`'; i++; return { text: out, end: i }; }
    out += code[i]; i++;
  }
  return { text: out, end: i };
}

// ---------------------------------------------------------------------------
// stripComments — context-aware, skips strings / templates / regex
// ---------------------------------------------------------------------------

function stripComments(code) {
  let out = '';
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    const next = code[i + 1];

    // Regular string literals: copy verbatim
    if (ch === '"' || ch === "'") {
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

    // Template literal: copy verbatim with ${…} nesting support
    if (ch === '`') {
      const tpl = _copyTemplateLiteral(code, i);
      out += tpl.text; i = tpl.end;
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
// minify — single-pass minification
//   Strips comments, collapses whitespace to the minimum required,
//   and preserves string / template-literal / regex content verbatim.
// ---------------------------------------------------------------------------

function minify(code, banner) {
  return banner + '\n' + _minifyBody(code.replace(banner, ''));
}

/**
 * Single-pass minifier: walks character-by-character, skips strings/regex,
 * strips comments, and emits a space only when both neighbours are
 * identifier-like characters (or when collapsing would create ++, --, // or /*).
 */
function _minifyBody(code) {
  let out = '';
  let i = 0;

  while (i < code.length) {
    const ch = code[i];
    const nx = code[i + 1];

    // ── Regular string literal: copy verbatim ─────────────────
    if (ch === '"' || ch === "'") {
      const q = ch;
      out += ch; i++;
      while (i < code.length) {
        if (code[i] === '\\') { out += code[i] + (code[i + 1] || ''); i += 2; continue; }
        out += code[i];
        if (code[i] === q) { i++; break; }
        i++;
      }
      continue;
    }

    // ── Template literal: copy verbatim with ${…} nesting ───────
    if (ch === '`') {
      const tpl = _copyTemplateLiteral(code, i);
      out += tpl.text; i = tpl.end;
      continue;
    }

    // ── Block comment: skip ─────────────────────────────────────
    if (ch === '/' && nx === '*') {
      i += 2;
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    // ── Line comment: skip ──────────────────────────────────────
    if (ch === '/' && nx === '/') {
      i += 2;
      while (i < code.length && code[i] !== '\n') i++;
      continue;
    }

    // ── Regex literal: copy verbatim ────────────────────────────
    if (ch === '/') {
      if (_isRegexCtx(out)) {
        out += ch; i++;
        let inCC = false;
        while (i < code.length) {
          const rc = code[i];
          if (rc === '\\') { out += rc + (code[i + 1] || ''); i += 2; continue; }
          if (rc === '[') inCC = true;
          if (rc === ']') inCC = false;
          out += rc; i++;
          if (rc === '/' && !inCC) {
            while (i < code.length && /[gimsuy]/.test(code[i])) { out += code[i]; i++; }
            break;
          }
        }
        continue;
      }
    }

    // ── Whitespace: collapse ────────────────────────────────────
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      while (i < code.length && (code[i] === ' ' || code[i] === '\t' || code[i] === '\n' || code[i] === '\r')) i++;
      const before = out[out.length - 1];
      const after  = code[i];
      if (_needsSpace(before, after)) out += ' ';
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}

/** True when removing the space between a and b would change semantics. */
function _needsSpace(a, b) {
  if (!a || !b) return false;
  const idA = (a >= 'a' && a <= 'z') || (a >= 'A' && a <= 'Z') || (a >= '0' && a <= '9') || a === '_' || a === '$';
  const idB = (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z') || (b >= '0' && b <= '9') || b === '_' || b === '$';
  if (idA && idB) return true;   // e.g. const x, return value
  if (a === '+' && b === '+') return true; // prevent ++
  if (a === '-' && b === '-') return true; // prevent --
  if (a === '/' && (b === '/' || b === '*')) return true; // prevent // or /*
  return false;
}

/** Heuristic: is the next '/' a regex start (vs division)? */
function _isRegexCtx(out) {
  let end = out.length - 1;
  while (end >= 0 && out[end] === ' ') end--;
  if (end < 0) return true;
  const last = out[end];
  if ('=({[,;:!&|?~+-*/%^>'.includes(last)) return true;
  const tail = out.substring(Math.max(0, end - 7), end + 1);
  const kws = ['return', 'typeof', 'case', 'in', 'delete', 'void', 'throw', 'new'];
  for (const kw of kws) {
    if (tail.endsWith(kw)) {
      const pos = end - kw.length;
      if (pos < 0 || !((out[pos] >= 'a' && out[pos] <= 'z') || (out[pos] >= 'A' && out[pos] <= 'Z') || (out[pos] >= '0' && out[pos] <= '9') || out[pos] === '_' || out[pos] === '$')) return true;
    }
  }
  return false;
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
