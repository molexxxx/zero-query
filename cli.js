#!/usr/bin/env node

/**
 * zQuery CLI
 *
 * Zero-dependency command-line tool for building the zQuery library
 * and bundling zQuery-based applications into a single file.
 *
 * Usage:
 *   zquery build                      Build the zQuery library (dist/)
 *   zquery build --watch              Build & watch for library changes
 *
 *   zquery bundle [entry]             Bundle an app's ES modules into one file
 *   zquery bundle scripts/app.js      Specify entry explicitly
 *   zquery bundle -o dist/            Custom output directory
 *   zquery bundle --include-lib       Embed zquery.min.js in the bundle
 *   zquery bundle --watch             Watch & rebuild on changes
 *   zquery bundle --html index.html   Rewrite <script type="module"> to use bundle
 *
 * Output files use content-hashed names for cache-busting:
 *   z-<entry>.<hash>.js / z-<entry>.<hash>.min.js
 *
 * Examples:
 *   cd my-zquery-app && npx zero-query bundle
 *   npx zero-query bundle scripts/app.js -o dist/ --include-lib
 */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const command = args[0];

function flag(name, short) {
  const i = args.indexOf(`--${name}`);
  const j = short ? args.indexOf(`-${short}`) : -1;
  return i !== -1 || j !== -1;
}

function option(name, short, fallback) {
  let i = args.indexOf(`--${name}`);
  if (i === -1 && short) i = args.indexOf(`-${short}`);
  if (i !== -1 && i + 1 < args.length) return args[i + 1];
  return fallback;
}

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

/**
 * Context-aware comment stripper — skips strings, templates, regex.
 * Reused from build.js.
 */
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

/** Quick minification (same approach as build.js). */
function minify(code, banner) {
  const body = stripComments(code.replace(banner, ''))
    .replace(/^\s*\n/gm, '')
    .replace(/\n\s+/g, '\n')
    .replace(/\s{2,}/g, ' ');
  return banner + '\n' + body;
}

function sizeKB(buf) {
  return (buf.length / 1024).toFixed(1);
}

// ---------------------------------------------------------------------------
// "build" command — library build (mirrors build.js)
// ---------------------------------------------------------------------------

function buildLibrary() {
  const pkg     = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
  const VERSION = pkg.version;

  const modules = [
    'src/reactive.js', 'src/core.js', 'src/component.js',
    'src/router.js',   'src/store.js', 'src/http.js', 'src/utils.js',
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
    return `// --- ${file} ${'—'.repeat(60 - file.length)}\n${code.trim()}`;
  });

  let indexCode = fs.readFileSync(path.join(process.cwd(), 'index.js'), 'utf-8');
  indexCode = indexCode.replace(/^import\s+[\s\S]*?from\s+['"].*?['"];?\s*$/gm, '');
  indexCode = indexCode.replace(/^export\s*\{[\s\S]*?\};\s*$/gm, '');
  indexCode = indexCode.replace(/^export\s+(default\s+)?/gm, '');

  const banner = `/**\n * zQuery (zeroQuery) v${VERSION}\n * Lightweight Frontend Library\n * https://github.com/tonywied17/zero-query\n * (c) ${new Date().getFullYear()} Anthony Wiedman — MIT License\n */`;

  const bundle = `${banner}\n(function(global) {\n  'use strict';\n\n${parts.join('\n\n')}\n\n// --- index.js (assembly) ${'—'.repeat(42)}\n${indexCode.trim().replace("'__VERSION__'", `'${VERSION}'`)}\n\n})(typeof window !== 'undefined' ? window : globalThis);\n`;

  fs.writeFileSync(OUT_FILE, bundle, 'utf-8');
  fs.writeFileSync(MIN_FILE, minify(bundle, banner), 'utf-8');

  const elapsed = Date.now() - start;
  console.log(`  ✓ dist/zquery.js (${sizeKB(fs.readFileSync(OUT_FILE))} KB)`);
  console.log(`  ✓ dist/zquery.min.js (${sizeKB(fs.readFileSync(MIN_FILE))} KB)`);
  console.log(`  Done in ${elapsed}ms\n`);

  return { DIST, OUT_FILE, MIN_FILE };
}


// ---------------------------------------------------------------------------
// "bundle" command — app bundler
// ---------------------------------------------------------------------------

/**
 * Resolve an import specifier relative to the importing file.
 */
function resolveImport(specifier, fromFile) {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) return null; // bare specifier
  let resolved = path.resolve(path.dirname(fromFile), specifier);
  // If no extension and a .js file exists, add it
  if (!path.extname(resolved) && fs.existsSync(resolved + '.js')) {
    resolved += '.js';
  }
  return resolved;
}

/**
 * Extract import specifiers from a source file.
 * Handles: import 'x', import x from 'x', import { a } from 'x', import * as x from 'x'
 * (including multi-line destructured imports)
 */
function extractImports(code) {
  const specifiers = [];
  let m;
  // Pattern 1: import ... from 'specifier'  (works for single & multi-line)
  const fromRe = /\bfrom\s+['"]([^'"]+)['"]/g;
  while ((m = fromRe.exec(code)) !== null) {
    specifiers.push(m[1]);
  }
  // Pattern 2: side-effect imports — import './foo.js';
  const sideRe = /^\s*import\s+['"]([^'"]+)['"]\s*;?\s*$/gm;
  while ((m = sideRe.exec(code)) !== null) {
    if (!specifiers.includes(m[1])) specifiers.push(m[1]);
  }
  return specifiers;
}

/**
 * Walk the import graph starting from `entry`, return files in dependency
 * order (leaves first — topological sort).
 */
function walkImportGraph(entry) {
  const visited = new Set();
  const order = [];

  function visit(file) {
    const abs = path.resolve(file);
    if (visited.has(abs)) return;
    visited.add(abs);

    if (!fs.existsSync(abs)) {
      console.warn(`  ⚠  Missing file: ${abs}`);
      return;
    }

    const code = fs.readFileSync(abs, 'utf-8');
    const imports = extractImports(code);

    for (const spec of imports) {
      const resolved = resolveImport(spec, abs);
      if (resolved) visit(resolved);
    }

    order.push(abs);
  }

  visit(entry);
  return order;
}

/**
 * Strip ES module import/export syntax from code, keeping declarations.
 */
function stripModuleSyntax(code) {
  // Remove import lines  (single-line and multi-line from ... )
  code = code.replace(/^\s*import\s+[\s\S]*?from\s+['"].*?['"];?\s*$/gm, '');
  // Remove side-effect imports   import './foo.js';
  code = code.replace(/^\s*import\s+['"].*?['"];?\s*$/gm, '');
  // Remove export default but keep the expression
  code = code.replace(/^(\s*)export\s+default\s+/gm, '$1');
  // Remove export keyword but keep declarations
  code = code.replace(/^(\s*)export\s+(const|let|var|function|class|async\s+function)\s/gm, '$1$2 ');
  // Remove standalone export { ... } blocks
  code = code.replace(/^\s*export\s*\{[\s\S]*?\};?\s*$/gm, '');
  return code;
}

/**
 * Replace `import.meta.url` with a runtime equivalent.
 * In a non-module <script>, import.meta doesn't exist, so we substitute
 * document.currentScript.src (set at load time) relative to the original
 * file's path inside the project.
 */
function replaceImportMeta(code, filePath, projectRoot) {
  if (!code.includes('import.meta')) return code;
  // Compute the web-relative path of this file from the project root
  const rel = path.relative(projectRoot, filePath).replace(/\\/g, '/');
  // Replace import.meta.url with a constructed URL based on the page origin
  code = code.replace(
    /import\.meta\.url/g,
    `(new URL('${rel}', document.baseURI).href)`
  );
  return code;
}

/**
 * Scan bundled source files for external resource references
 * (pages config, templateUrl, styleUrl) and read those files so they
 * can be inlined into the bundle for file:// support.
 *
 * Returns a map of { relativePath: fileContent }.
 */
function collectInlineResources(files, projectRoot) {
  const inlineMap = {};

  for (const file of files) {
    const code = fs.readFileSync(file, 'utf-8');
    const fileDir = path.dirname(file);

    // Detect `pages:` config — look for dir and items
    const pagesMatch = code.match(/pages\s*:\s*\{[^}]*dir\s*:\s*['"]([^'"]+)['"]/s);
    if (pagesMatch) {
      const pagesDir = pagesMatch[1];
      const ext = (code.match(/pages\s*:\s*\{[^}]*ext\s*:\s*['"]([^'"]+)['"]/s) || [])[1] || '.html';

      // Extract item IDs from the items array
      const itemsMatch = code.match(/items\s*:\s*\[([\s\S]*?)\]/);
      if (itemsMatch) {
        const itemsBlock = itemsMatch[1];
        const ids = [];
        // Match string items: 'getting-started'
        let m;
        const strRe = /['"]([^'"]+)['"]/g;
        const objIdRe = /id\s*:\s*['"]([^'"]+)['"]/g;
        // Collect all quoted strings that look like page IDs
        while ((m = strRe.exec(itemsBlock)) !== null) {
          // Skip labels (preceded by "label:")
          const before = itemsBlock.substring(Math.max(0, m.index - 20), m.index);
          if (/label\s*:\s*$/.test(before)) continue;
          ids.push(m[1]);
        }

        // Read each page file
        const absPagesDir = path.join(fileDir, pagesDir);
        for (const id of ids) {
          const pagePath = path.join(absPagesDir, id + ext);
          if (fs.existsSync(pagePath)) {
            const relKey = path.relative(projectRoot, pagePath).replace(/\\/g, '/');
            inlineMap[relKey] = fs.readFileSync(pagePath, 'utf-8');
          }
        }
      }
    }

    // Detect `styleUrl:` — single string
    const styleMatch = code.match(/styleUrl\s*:\s*['"]([^'"]+)['"]/);
    if (styleMatch) {
      const stylePath = path.join(fileDir, styleMatch[1]);
      if (fs.existsSync(stylePath)) {
        const relKey = path.relative(projectRoot, stylePath).replace(/\\/g, '/');
        inlineMap[relKey] = fs.readFileSync(stylePath, 'utf-8');
      }
    }

    // Detect `templateUrl:` — single string
    const tmplMatch = code.match(/templateUrl\s*:\s*['"]([^'"]+)['"]/);
    if (tmplMatch) {
      const tmplPath = path.join(fileDir, tmplMatch[1]);
      if (fs.existsSync(tmplPath)) {
        const relKey = path.relative(projectRoot, tmplPath).replace(/\\/g, '/');
        inlineMap[relKey] = fs.readFileSync(tmplPath, 'utf-8');
      }
    }
  }

  return inlineMap;
}

/**
 * Try to auto-detect the app entry point.
 * Looks for <script type="module" src="..."> in an index.html,
 * or falls back to common conventions.
 */
function detectEntry(projectRoot) {
  const htmlCandidates = ['index.html', 'public/index.html'];
  for (const htmlFile of htmlCandidates) {
    const htmlPath = path.join(projectRoot, htmlFile);
    if (fs.existsSync(htmlPath)) {
      const html = fs.readFileSync(htmlPath, 'utf-8');
      const m = html.match(/<script[^>]+type\s*=\s*["']module["'][^>]+src\s*=\s*["']([^"']+)["']/);
      if (m) return path.join(projectRoot, m[1]);
    }
  }
  // Convention fallback
  const fallbacks = ['scripts/app.js', 'src/app.js', 'js/app.js', 'app.js', 'main.js'];
  for (const f of fallbacks) {
    const fp = path.join(projectRoot, f);
    if (fs.existsSync(fp)) return fp;
  }
  return null;
}


function bundleApp() {
  const projectRoot = process.cwd();

  // Entry point
  let entry = null;
  // First positional arg after "bundle" that doesn't start with -
  for (let i = 1; i < args.length; i++) {
    if (!args[i].startsWith('-') && args[i - 1] !== '-o' && args[i - 1] !== '--out' && args[i - 1] !== '--html') {
      entry = path.resolve(projectRoot, args[i]);
      break;
    }
  }
  if (!entry) entry = detectEntry(projectRoot);

  if (!entry || !fs.existsSync(entry)) {
    console.error(`\n  ✗ Could not find entry file.`);
    console.error(`    Provide one explicitly: zquery bundle scripts/app.js\n`);
    process.exit(1);
  }

  const includeLib = flag('include-lib', 'L');
  const outPath    = option('out', 'o', null);
  const htmlFile   = option('html', null, null);
  const watchMode  = flag('watch', 'w');

  // Derive output directory (filename is auto-generated with a content hash)
  const entryRel  = path.relative(projectRoot, entry);
  const entryName = path.basename(entry, '.js');
  let distDir;
  if (outPath) {
    const resolved = path.resolve(projectRoot, outPath);
    // -o accepts a directory path or a file path (directory is extracted)
    if (outPath.endsWith('/') || outPath.endsWith('\\') || !path.extname(outPath) ||
        (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory())) {
      distDir = resolved;
    } else {
      distDir = path.dirname(resolved);
    }
  } else {
    distDir = path.join(projectRoot, 'dist');
  }

  console.log(`\n  zQuery App Bundler`);
  console.log(`  Entry:   ${entryRel}`);
  console.log(`  Output:  ${path.relative(projectRoot, distDir)}/z-${entryName}.[hash].js`);
  if (includeLib) console.log(`  Library: embedded`);
  console.log('');

  function doBuild() {
    const start = Date.now();

    if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

    // Walk the import graph
    const files = walkImportGraph(entry);
    console.log(`  Resolved ${files.length} module(s):`);
    files.forEach(f => console.log(`    • ${path.relative(projectRoot, f)}`));

    // Build concatenated source
    const sections = files.map(file => {
      let code = fs.readFileSync(file, 'utf-8');
      code = stripModuleSyntax(code);
      code = replaceImportMeta(code, file, projectRoot);
      const rel = path.relative(projectRoot, file);
      return `// --- ${rel} ${'—'.repeat(Math.max(1, 60 - rel.length))}\n${code.trim()}`;
    });

    // Optionally prepend zquery.min.js
    let libSection = '';
    if (includeLib) {
      // Look for the library in common locations
      const libCandidates = [
        path.join(projectRoot, 'scripts/vendor/zquery.min.js'),
        path.join(projectRoot, 'vendor/zquery.min.js'),
        path.join(projectRoot, 'lib/zquery.min.js'),
        path.join(projectRoot, 'dist/zquery.min.js'),
        path.join(projectRoot, 'zquery.min.js'),
        // If run from the zero-query repo itself
        path.join(__dirname, 'dist/zquery.min.js'),
      ];
      const libPath = libCandidates.find(p => fs.existsSync(p));
      if (libPath) {
        libSection = `// --- zquery.min.js (library) ${'—'.repeat(34)}\n${fs.readFileSync(libPath, 'utf-8').trim()}\n\n`;
        console.log(`\n  Embedded library from ${path.relative(projectRoot, libPath)}`);
      } else {
        console.warn(`\n  ⚠  Could not find zquery.min.js — skipping --include-lib`);
        console.warn(`     Build the library first: zquery build`);
      }
    }

    const banner = `/**\n * App bundle — built by zQuery CLI\n * Entry: ${entryRel}\n * ${new Date().toISOString()}\n */`;

    // Scan for external resources (pages, templateUrl, styleUrl) and inline them
    const inlineMap = collectInlineResources(files, projectRoot);
    let inlineSection = '';
    if (Object.keys(inlineMap).length > 0) {
      const entries = Object.entries(inlineMap).map(([key, content]) => {
        // Escape for embedding in a JS string literal
        const escaped = content
          .replace(/\\/g, '\\\\')
          .replace(/'/g, "\\'")
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '');
        return `  '${key}': '${escaped}'`;
      });
      inlineSection = `// --- Inlined resources (file:// support) ${'—'.repeat(20)}\nwindow.__zqInline = {\n${entries.join(',\n')}\n};\n\n`;
      console.log(`\n  Inlined ${Object.keys(inlineMap).length} external resource(s)`);
    }

    const bundle = `${banner}\n(function() {\n  'use strict';\n\n${libSection}${inlineSection}${sections.join('\n\n')}\n\n})();\n`;

    // Content-hashed output filenames (z-<name>.<hash>.js)
    const contentHash = crypto.createHash('sha256').update(bundle).digest('hex').slice(0, 8);
    const bundleFile  = path.join(distDir, `z-${entryName}.${contentHash}.js`);
    const minFile     = path.join(distDir, `z-${entryName}.${contentHash}.min.js`);

    // Remove previous hashed builds
    const escName = entryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cleanRe = new RegExp(`^z-${escName}\\.[a-f0-9]{8}\\.(?:min\\.)?js$`);
    if (fs.existsSync(distDir)) {
      for (const f of fs.readdirSync(distDir)) {
        if (cleanRe.test(f)) fs.unlinkSync(path.join(distDir, f));
      }
    }

    fs.writeFileSync(bundleFile, bundle, 'utf-8');
    fs.writeFileSync(minFile, minify(bundle, banner), 'utf-8');

    console.log(`\n  ✓ ${path.relative(projectRoot, bundleFile)} (${sizeKB(fs.readFileSync(bundleFile))} KB)`);
    console.log(`  ✓ ${path.relative(projectRoot, minFile)} (${sizeKB(fs.readFileSync(minFile))} KB)`);

    // Optionally rewrite index.html
    if (htmlFile) {
      const bundledFileSet = new Set(files);
      rewriteHtml(projectRoot, htmlFile, bundleFile, includeLib, bundledFileSet);
    }

    const elapsed = Date.now() - start;
    console.log(`  Done in ${elapsed}ms\n`);
  }

  doBuild();

  // Watch mode
  if (watchMode) {
    const watchDirs = new Set();
    const files = walkImportGraph(entry);
    files.forEach(f => watchDirs.add(path.dirname(f)));

    console.log('  Watching for changes...\n');
    let debounceTimer;
    for (const dir of watchDirs) {
      fs.watch(dir, { recursive: true }, (_, filename) => {
        if (!filename || !filename.endsWith('.js')) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          console.log(`  Changed: ${filename} — rebuilding...`);
          try { doBuild(); } catch (e) { console.error(`  ✗ ${e.message}`); }
        }, 200);
      });
    }
  }
}

/**
 * Recursively copy a directory.
 */
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

/**
 * Rewrite an HTML file to replace the module <script> with the bundle.
 * Copies all referenced assets (CSS, JS, images) into dist/ so the
 * output folder is fully self-contained and deployable.
 */
function rewriteHtml(projectRoot, htmlRelPath, bundleFile, includeLib, bundledFiles) {
  const htmlPath = path.resolve(projectRoot, htmlRelPath);
  if (!fs.existsSync(htmlPath)) {
    console.warn(`  ⚠  HTML file not found: ${htmlRelPath}`);
    return;
  }

  const htmlDir  = path.dirname(htmlPath);
  const distDir  = path.dirname(bundleFile);
  let html = fs.readFileSync(htmlPath, 'utf-8');

  // Collect all asset references from the HTML (src=, href= on link/script/img)
  const assetRe = /(?:<(?:link|script|img)[^>]*?\s(?:src|href)\s*=\s*["'])([^"']+)["']/gi;
  const assets  = new Set();
  let m;
  while ((m = assetRe.exec(html)) !== null) {
    const ref = m[1];
    // Skip absolute URLs, data URIs, protocol-relative, and anchors
    if (ref.startsWith('http') || ref.startsWith('//') || ref.startsWith('data:') || ref.startsWith('#')) continue;
    // Skip the module entry (already bundled)
    const refAbs = path.resolve(htmlDir, ref);
    if (bundledFiles && bundledFiles.has(refAbs)) continue;
    // Skip zquery lib if we're embedding it
    if (includeLib && /zquery(?:\.min)?\.js$/i.test(ref)) continue;
    assets.add(ref);
  }

  // Copy each referenced asset into dist/, preserving directory structure
  let copiedCount = 0;
  const copiedDirs = new Set();
  for (const asset of assets) {
    const srcFile = path.resolve(htmlDir, asset);
    if (!fs.existsSync(srcFile)) continue;

    const destFile = path.join(distDir, asset);
    const destDir  = path.dirname(destFile);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    fs.copyFileSync(srcFile, destFile);
    copiedCount++;

    // If this is inside a directory that may contain sibling assets
    // (fonts referenced by CSS, etc.), track it
    copiedDirs.add(path.dirname(srcFile));
  }

  // Also copy any CSS-referenced assets: scan copied CSS files for url()
  // references and copy those too
  for (const asset of assets) {
    const srcFile = path.resolve(htmlDir, asset);
    if (!fs.existsSync(srcFile) || !asset.endsWith('.css')) continue;

    const cssContent = fs.readFileSync(srcFile, 'utf-8');
    const urlRe = /url\(\s*["']?([^"')]+?)["']?\s*\)/g;
    let cm;
    while ((cm = urlRe.exec(cssContent)) !== null) {
      const ref = cm[1];
      if (ref.startsWith('data:') || ref.startsWith('http') || ref.startsWith('//')) continue;
      const cssSrcDir  = path.dirname(srcFile);
      const assetSrc   = path.resolve(cssSrcDir, ref);
      const cssDestDir = path.dirname(path.join(distDir, asset));
      const assetDest  = path.resolve(cssDestDir, ref);
      if (fs.existsSync(assetSrc) && !fs.existsSync(assetDest)) {
        const dir = path.dirname(assetDest);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.copyFileSync(assetSrc, assetDest);
        copiedCount++;
      }
    }
  }

  // Make the bundle path relative to the dist/ HTML
  const bundleRel = path.relative(distDir, bundleFile).replace(/\\/g, '/');

  // Replace <script type="module" src="..."> with the bundle (regular script)
  // Use "defer" so the script runs after DOM is parsed — module scripts are
  // deferred by default, but regular scripts in <head> are not.
  html = html.replace(
    /<script\s+type\s*=\s*["']module["']\s+src\s*=\s*["'][^"']+["']\s*>\s*<\/script>/gi,
    `<script defer src="${bundleRel}"></script>`
  );

  // If library is embedded, remove the standalone zquery script tag
  if (includeLib) {
    html = html.replace(
      /\s*<script\s+src\s*=\s*["'][^"']*zquery(?:\.min)?\.js["']\s*>\s*<\/script>/gi,
      ''
    );
  }

  // SPA deep-route fix: keep <base href="/"> so refreshing on a route like
  // /docs/project-structure still resolves assets from the root.  However,
  // when opened via file:// the root is the drive letter (file:///C:/), so
  // inject a tiny inline script that switches the base to "./" for file://.
  html = html.replace(
    /(<base\s+href\s*=\s*["']\/["'][^>]*>)/i,
    '$1<script>if(location.protocol==="file:")document.querySelector("base").href="./"</script>'
  );

  // Write HTML
  const outHtml = path.join(distDir, path.basename(htmlRelPath));
  fs.writeFileSync(outHtml, html, 'utf-8');
  console.log(`  ✓ ${path.relative(projectRoot, outHtml)} (HTML rewritten)`);
  console.log(`  ✓ Copied ${copiedCount} asset(s) into ${path.relative(projectRoot, distDir)}/`);
}


// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

function showHelp() {
  console.log(`
  zQuery CLI — build & bundle tool

  COMMANDS

    build                      Build the zQuery library → dist/
      --watch, -w              Watch src/ and rebuild on changes

    bundle [entry]             Bundle app ES modules into a single file
      --out, -o <path>         Output directory (default: dist/)
      --include-lib, -L        Embed zquery.min.js in the bundle
      --html <file>            Rewrite HTML file to reference the bundle
      --watch, -w              Watch source files and rebuild on changes

  OUTPUT

    Bundle filenames are content-hashed for cache-busting:
      z-<entry>.<hash>.js        readable bundle
      z-<entry>.<hash>.min.js    minified bundle
    Previous hashed builds are automatically cleaned on each rebuild.

  EXAMPLES

    # Build the library
    zquery build

    # Bundle an app (auto-detects entry from index.html)
    cd my-app && zquery bundle

    # Bundle with all options
    zquery bundle scripts/app.js -o dist/ -L --html index.html

    # Watch mode
    zquery bundle --watch

  The bundler walks the ES module import graph starting from the entry
  file, topologically sorts dependencies, strips import/export syntax,
  and concatenates everything into a single IIFE with content-hashed
  filenames for cache-busting. No dependencies needed — just Node.js.
`);
}


// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

if (!command || command === '--help' || command === '-h' || command === 'help') {
  showHelp();
} else if (command === 'build') {
  console.log('\n  zQuery Library Build\n');
  buildLibrary();
  if (flag('watch', 'w')) {
    console.log('  Watching src/ for changes...\n');
    const srcDir = path.join(process.cwd(), 'src');
    let debounceTimer;
    const rebuild = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log('  Rebuilding...');
        try { buildLibrary(); } catch (e) { console.error(`  ✗ ${e.message}`); }
      }, 200);
    };
    fs.watch(srcDir, { recursive: true }, rebuild);
    fs.watch(path.join(process.cwd(), 'index.js'), rebuild);
  }
} else if (command === 'bundle') {
  bundleApp();
} else {
  console.error(`\n  Unknown command: ${command}\n  Run "zquery --help" for usage.\n`);
  process.exit(1);
}
