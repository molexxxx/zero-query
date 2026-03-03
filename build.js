/**
 * zQuery Build Script
 * 
 * Concatenates all ES modules into a single IIFE browser bundle.
 * Zero build-tool dependencies — just Node.js.
 * 
 * Usage:
 *   node build.js            → builds dist/zquery.js & dist/zquery.min.js
 *   node build.js --watch    → watches src/ and rebuilds on changes
 */

const { readFileSync, writeFileSync, mkdirSync, existsSync, watch } = require('fs');
const { join } = require('path');

// Read version from package.json
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));
const VERSION = pkg.version;

// Source files in dependency order
const modules = [
  'src/reactive.js',
  'src/core.js',
  'src/component.js',
  'src/router.js',
  'src/store.js',
  'src/http.js',
  'src/utils.js',
];

const DIST = join(__dirname, 'dist');
const OUT_FILE = join(DIST, 'zquery.js');
const MIN_FILE = join(DIST, 'zquery.min.js');


function build() {
  const start = Date.now();

  if (!existsSync(DIST)) mkdirSync(DIST, { recursive: true });

  // Read and strip import/export statements from each module
  const parts = modules.map(file => {
    let code = readFileSync(join(__dirname, file), 'utf-8');

    // Remove import lines (single-line and multi-line)
    code = code.replace(/^import\s+[\s\S]*?from\s+['"].*?['"];?\s*$/gm, '');
    // Remove export keywords but keep the declarations
    code = code.replace(/^export\s+(default\s+)?/gm, '');
    // Remove standalone export { ... } blocks (single-line and multi-line)
    code = code.replace(/^export\s*\{[\s\S]*?\};\s*$/gm, '');

    return `// --- ${file} ${'—'.repeat(60 - file.length)}\n${code.trim()}`;
  });

  // Read the index.js to extract the $ assembly logic
  let indexCode = readFileSync(join(__dirname, 'index.js'), 'utf-8');
  // Strip imports/exports from index (single-line and multi-line)
  indexCode = indexCode.replace(/^import\s+[\s\S]*?from\s+['"].*?['"];?\s*$/gm, '');
  indexCode = indexCode.replace(/^export\s*\{[\s\S]*?\};\s*$/gm, '');
  indexCode = indexCode.replace(/^export\s+(default\s+)?/gm, '');

  const banner = `/**
 * zQuery (zeroQuery) v${VERSION}
 * Lightweight Frontend Library
 * https://github.com/tonywied17/zero-query
 * (c) ${new Date().getFullYear()} Anthony Wiedman — MIT License
 */`;

  const bundle = `${banner}
(function(global) {
  'use strict';

${parts.join('\n\n')}

// --- index.js (assembly) ${'—'.repeat(42)}
${indexCode.trim().replace("'__VERSION__'", `'${VERSION}'`)}

})(typeof window !== 'undefined' ? window : globalThis);
`;

  writeFileSync(OUT_FILE, bundle, 'utf-8');

  // Basic minification (remove comments, collapse whitespace)
  // For production, use terser/uglify — this is a quick built-in.
  // The comment stripper is context-aware: it skips strings, template
  // literals, and regex literals so that '//' inside them isn't mangled.
  function stripComments(code) {
    let out = '';
    let i = 0;
    while (i < code.length) {
      const ch = code[i];
      const next = code[i + 1];

      // --- String literals ---
      if (ch === '"' || ch === "'" || ch === '`') {
        const quote = ch;
        out += ch;
        i++;
        while (i < code.length) {
          if (code[i] === '\\') { out += code[i] + (code[i + 1] || ''); i += 2; continue; }
          out += code[i];
          if (code[i] === quote) { i++; break; }
          i++;
        }
        continue;
      }

      // --- Block comment ---
      if (ch === '/' && next === '*') {
        i += 2;
        while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++;
        i += 2; // skip */
        continue;
      }

      // --- Line comment (only if not inside a regex) ---
      if (ch === '/' && next === '/') {
        // Heuristic: if the previous non-whitespace token is an operator,
        // keyword, or line start, this might be a regex. But '//' at the
        // start of a "line comment" position is almost always a real comment.
        // Look back for context: if preceding token is = ( , ; { } : ? [ | & ! ~ + - * %
        // then this is probably a regex — but a regex starting with '//' is
        // extremely rare and invalid, so we can safely treat '//' as comment.
        // Skip to end of line.
        i += 2;
        while (i < code.length && code[i] !== '\n') i++;
        continue;
      }

      // --- Regex literal ---
      if (ch === '/') {
        // Look back to see if '/' could start a regex
        const before = out.replace(/\s+$/, '');
        const last = before[before.length - 1];
        const isRegexCtx = !last || '=({[,;:!&|?~+-*/%^>'.includes(last)
          || before.endsWith('return') || before.endsWith('typeof')
          || before.endsWith('case') || before.endsWith('in')
          || before.endsWith('delete') || before.endsWith('void')
          || before.endsWith('throw') || before.endsWith('new');

        if (isRegexCtx) {
          out += ch;
          i++;
          let inCharClass = false;
          while (i < code.length) {
            const rc = code[i];
            if (rc === '\\') { out += rc + (code[i + 1] || ''); i += 2; continue; }
            if (rc === '[') inCharClass = true;
            if (rc === ']') inCharClass = false;
            out += rc;
            i++;
            if (rc === '/' && !inCharClass) {
              // Consume flags
              while (i < code.length && /[gimsuy]/.test(code[i])) { out += code[i]; i++; }
              break;
            }
          }
          continue;
        }
      }

      out += ch;
      i++;
    }
    return out;
  }

  const minified = banner + '\n' + stripComments(bundle.replace(banner, ''))
    .replace(/^\s*\n/gm, '')                     // empty lines
    .replace(/\n\s+/g, '\n')                     // leading whitespace
    .replace(/\s{2,}/g, ' ');                    // multiple spaces

  writeFileSync(MIN_FILE, minified, 'utf-8');

  const size = (readFileSync(OUT_FILE).length / 1024).toFixed(1);
  const minSize = (readFileSync(MIN_FILE).length / 1024).toFixed(1);
  const elapsed = Date.now() - start;

  console.log(`✓ Built dist/zquery.js (${size} KB) & dist/zquery.min.js (${minSize} KB) in ${elapsed}ms`);
}


// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
build();

if (process.argv.includes('--watch')) {
  console.log('Watching src/ for changes...');
  const srcDir = join(__dirname, 'src');
  let debounce;
  watch(srcDir, { recursive: true }, () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      console.log('Rebuilding...');
      try { build(); } catch (e) { console.error(e.message); }
    }, 200);
  });
  watch(join(__dirname, 'index.js'), () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      console.log('Rebuilding...');
      try { build(); } catch (e) { console.error(e.message); }
    }, 200);
  });
}
