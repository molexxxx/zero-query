/**
 * cli/commands/build.js — library build command
 *
 * Concatenates the zQuery source modules into dist/zquery.js and
 * dist/zquery.min.js.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { minify, sizeKB } = require('../utils');

function buildLibrary() {
  const pkg     = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
  const VERSION = pkg.version;

  const modules = [
    'src/errors.js',
    'src/reactive.js', 'src/core.js', 'src/expression.js', 'src/diff.js',
    'src/component.js', 'src/router.js', 'src/store.js', 'src/http.js',
    'src/utils.js',
  ];

  const DIST     = path.join(process.cwd(), 'dist');
  const OUT_FILE = path.join(DIST, 'zquery.js');
  const MIN_FILE = path.join(DIST, 'zquery.min.js');

  const start = Date.now();
  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });

  const parts = modules.map(file => {
    let code = fs.readFileSync(path.join(process.cwd(), file), 'utf-8');
    code = code.replace(/^import\s+[\s\S]*?from\s+['"].*?['"];?\s*$/gm, '');
    code = code.replace(/^export\s+(default\s+)?/gm, '');
    code = code.replace(/^export\s*\{[\s\S]*?\};\s*$/gm, '');
    return `// --- ${file} ${'-'.repeat(60 - file.length)}\n${code.trim()}`;
  });

  let indexCode = fs.readFileSync(path.join(process.cwd(), 'index.js'), 'utf-8');
  indexCode = indexCode.replace(/^import\s+[\s\S]*?from\s+['"].*?['"];?\s*$/gm, '');
  indexCode = indexCode.replace(/^export\s*\{[\s\S]*?\};\s*$/gm, '');
  indexCode = indexCode.replace(/^export\s+(default\s+)?/gm, '');

  const banner = `/**\n * zQuery (zeroQuery) v${VERSION}\n * Lightweight Frontend Library\n * https://github.com/tonywied17/zero-query\n * (c) ${new Date().getFullYear()} Anthony Wiedman - MIT License\n */`;

  const bundle = `${banner}\n(function(global) {\n  'use strict';\n\n${parts.join('\n\n')}\n\n// --- index.js (assembly) ${'-'.repeat(42)}\n${indexCode.trim().replace("'__VERSION__'", `'${VERSION}'`)}\n\n})(typeof window !== 'undefined' ? window : globalThis);\n`;

  fs.writeFileSync(OUT_FILE, bundle, 'utf-8');
  const minified = minify(bundle, banner);
  fs.writeFileSync(MIN_FILE, minified, 'utf-8');

  // Inject actual minified library size into both outputs
  const libSizeKB = Math.round(Buffer.from(minified).length / 1024);
  const libSizeStr = `~${libSizeKB} KB`;
  const outContent = fs.readFileSync(OUT_FILE, 'utf-8').replace("'__LIB_SIZE__'", `'${libSizeStr}'`);
  const minContent = minified.replace("'__LIB_SIZE__'", `'${libSizeStr}'`);
  fs.writeFileSync(OUT_FILE, outContent, 'utf-8');
  fs.writeFileSync(MIN_FILE, minContent, 'utf-8');

  const elapsed = Date.now() - start;
  console.log(`  ✓ dist/zquery.js (${sizeKB(fs.readFileSync(OUT_FILE))} KB)`);
  console.log(`  ✓ dist/zquery.min.js (${sizeKB(fs.readFileSync(MIN_FILE))} KB)`);
  console.log(`  Done in ${elapsed}ms\n`);

  return { DIST, OUT_FILE, MIN_FILE };
}

module.exports = buildLibrary;
