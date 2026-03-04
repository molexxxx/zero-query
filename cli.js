#!/usr/bin/env node

/**
 * zQuery CLI
 *
 * Zero-dependency command-line tool for building the zQuery library,
 * bundling zQuery-based applications, and running a dev server with
 * live-reload.
 *
 * Usage:
 *   zquery build                      Build the zQuery library (dist/)
 *
 *   zquery bundle [entry]             Bundle an app's ES modules into one file
 *   zquery bundle scripts/app.js      Specify entry explicitly
 *   zquery bundle -o build/           Custom output directory
 *   zquery bundle --html other.html   Use a specific HTML file instead of auto-detected
 *   zquery bundle --watch             Watch & rebuild on changes
 *
 *   zquery dev [root]                 Start dev server with live-reload
 *   zquery dev --port 8080            Custom port (default: 3100)
 *
 * Smart defaults (no flags needed for typical projects):
 *   - Entry is auto-detected from index.html's <script type="module" src="...">
 *   - zquery.min.js is always embedded (auto-built if not found)
 *   - index.html is always rewritten and assets are copied
 *   - Output goes to dist/ next to the detected index.html
 *
 * Examples:
 *   cd my-app && npx zero-query bundle              # just works!
 *   npx zero-query bundle path/to/scripts/app.js     # works from anywhere
 *   cd my-app && npx zquery dev                       # dev server with live-reload
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

  const outPath    = option('out', 'o', null);
  const watchMode  = flag('watch', 'w');

  // Auto-detect index.html by walking up from the entry file, then check cwd
  let htmlFile = option('html', null, null);
  let htmlAbs  = htmlFile ? path.resolve(projectRoot, htmlFile) : null;
  if (!htmlFile) {
    const htmlCandidates = [];
    // Walk up from the entry file's directory to cwd looking for index.html
    let entryDir = path.dirname(entry);
    while (entryDir.length >= projectRoot.length) {
      htmlCandidates.push(path.join(entryDir, 'index.html'));
      const parent = path.dirname(entryDir);
      if (parent === entryDir) break;
      entryDir = parent;
    }
    // Also check cwd and public/
    htmlCandidates.push(path.join(projectRoot, 'index.html'));
    htmlCandidates.push(path.join(projectRoot, 'public/index.html'));
    for (const candidate of htmlCandidates) {
      if (fs.existsSync(candidate)) {
        htmlAbs  = candidate;
        htmlFile = path.relative(projectRoot, candidate);
        break;
      }
    }
  }

  // Derive output directory:
  //   -o flag  → use that path
  //   else     → dist/ next to the detected HTML file (or cwd/dist/ as fallback)
  const entryRel  = path.relative(projectRoot, entry);
  const entryName = path.basename(entry, '.js');
  let baseDistDir;
  if (outPath) {
    const resolved = path.resolve(projectRoot, outPath);
    if (outPath.endsWith('/') || outPath.endsWith('\\') || !path.extname(outPath) ||
        (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory())) {
      baseDistDir = resolved;
    } else {
      baseDistDir = path.dirname(resolved);
    }
  } else if (htmlAbs) {
    baseDistDir = path.join(path.dirname(htmlAbs), 'dist');
  } else {
    baseDistDir = path.join(projectRoot, 'dist');
  }

  // Two output sub-directories: server/ (with <base href="/">) and local/ (relative paths)
  const serverDir = path.join(baseDistDir, 'server');
  const localDir  = path.join(baseDistDir, 'local');

  console.log(`\n  zQuery App Bundler`);
  console.log(`  Entry:   ${entryRel}`);
  console.log(`  Output:  ${path.relative(projectRoot, baseDistDir)}/server/ & local/`);
  console.log(`  Library: embedded`);
  console.log(`  HTML:    ${htmlFile || 'not found (no index.html detected)'}`);
  console.log('');

  function doBuild() {
    const start = Date.now();

    if (!fs.existsSync(serverDir)) fs.mkdirSync(serverDir, { recursive: true });
    if (!fs.existsSync(localDir))  fs.mkdirSync(localDir, { recursive: true });

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

    // Embed zquery.min.js — always included
    let libSection = '';
    {
      const pkgSrcDir  = path.join(__dirname, 'src');
      const pkgMinFile = path.join(__dirname, 'dist', 'zquery.min.js');

      // Always rebuild the library from source when running from the repo/package
      // so that dist/ stays current with the latest source changes.
      if (fs.existsSync(pkgSrcDir) && fs.existsSync(path.join(__dirname, 'index.js'))) {
        console.log(`\n  Building library from source...`);
        const prevCwd = process.cwd();
        try {
          process.chdir(__dirname);
          buildLibrary();
        } finally {
          process.chdir(prevCwd);
        }
      }

      // Now look for the library in common locations
      const htmlDir = htmlAbs ? path.dirname(htmlAbs) : null;
      const libCandidates = [
        // Prefer the freshly-built package dist
        path.join(__dirname, 'dist/zquery.min.js'),
        // Then check project-local locations
        htmlDir && path.join(htmlDir, 'scripts/vendor/zquery.min.js'),
        htmlDir && path.join(htmlDir, 'vendor/zquery.min.js'),
        path.join(projectRoot, 'scripts/vendor/zquery.min.js'),
        path.join(projectRoot, 'vendor/zquery.min.js'),
        path.join(projectRoot, 'lib/zquery.min.js'),
        path.join(projectRoot, 'dist/zquery.min.js'),
        path.join(projectRoot, 'zquery.min.js'),
      ].filter(Boolean);
      const libPath = libCandidates.find(p => fs.existsSync(p));

      if (libPath) {
        const libBytes = fs.statSync(libPath).size;
        libSection = `// --- zquery.min.js (library) ${'—'.repeat(34)}\n${fs.readFileSync(libPath, 'utf-8').trim()}\n\n`
                   + `// --- Build-time metadata ————————————————————————————\nif(typeof $!=="undefined"){$.meta=Object.assign($.meta||{},{libSize:${libBytes}});}\n\n`;
        console.log(`  Embedded library from ${path.relative(projectRoot, libPath)} (${(libBytes / 1024).toFixed(1)} KB)`);
      } else {
        console.warn(`\n  ⚠  Could not find zquery.min.js anywhere`);
        console.warn(`     Place zquery.min.js in scripts/vendor/, vendor/, lib/, or dist/`);
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
    const bundleBase  = `z-${entryName}.${contentHash}.js`;
    const minBase     = `z-${entryName}.${contentHash}.min.js`;

    // Remove previous hashed builds from both output directories
    const escName = entryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cleanRe = new RegExp(`^z-${escName}\\.[a-f0-9]{8}\\.(?:min\\.)?js$`);
    for (const dir of [serverDir, localDir]) {
      if (fs.existsSync(dir)) {
        for (const f of fs.readdirSync(dir)) {
          if (cleanRe.test(f)) fs.unlinkSync(path.join(dir, f));
        }
      }
    }

    // Write bundle into server/ (canonical), then copy to local/
    const bundleFile = path.join(serverDir, bundleBase);
    const minFile    = path.join(serverDir, minBase);
    fs.writeFileSync(bundleFile, bundle, 'utf-8');
    fs.writeFileSync(minFile, minify(bundle, banner), 'utf-8');
    fs.copyFileSync(bundleFile, path.join(localDir, bundleBase));
    fs.copyFileSync(minFile, path.join(localDir, minBase));

    console.log(`\n  ✓ ${bundleBase} (${sizeKB(fs.readFileSync(bundleFile))} KB)`);
    console.log(`  ✓ ${minBase} (${sizeKB(fs.readFileSync(minFile))} KB)`);

    // Rewrite index.html → two variants (server/ and local/)
    if (htmlFile) {
      const bundledFileSet = new Set(files);
      rewriteHtml(projectRoot, htmlFile, bundleFile, true, bundledFileSet, serverDir, localDir);
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
 * Copies all referenced assets into both server/ and local/ dist dirs,
 * then writes two index.html variants:
 *   server/index.html — has <base href="/"> for SPA deep-route support
 *   local/index.html  — no <base>, relative paths for file:// access
 *
 * Both are fully static HTML with no dynamic loading.
 */
function rewriteHtml(projectRoot, htmlRelPath, bundleFile, includeLib, bundledFiles, serverDir, localDir) {
  const htmlPath = path.resolve(projectRoot, htmlRelPath);
  if (!fs.existsSync(htmlPath)) {
    console.warn(`  ⚠  HTML file not found: ${htmlRelPath}`);
    return;
  }

  const htmlDir = path.dirname(htmlPath);
  let html = fs.readFileSync(htmlPath, 'utf-8');

  // Collect all asset references from the HTML (src=, href= on link/script/img)
  const assetRe = /(?:<(?:link|script|img)[^>]*?\s(?:src|href)\s*=\s*["'])([^"']+)["']/gi;
  const assets  = new Set();
  let m;
  while ((m = assetRe.exec(html)) !== null) {
    const ref = m[1];
    if (ref.startsWith('http') || ref.startsWith('//') || ref.startsWith('data:') || ref.startsWith('#')) continue;
    const refAbs = path.resolve(htmlDir, ref);
    if (bundledFiles && bundledFiles.has(refAbs)) continue;
    if (includeLib && /zquery(?:\.min)?\.js$/i.test(ref)) continue;
    assets.add(ref);
  }

  // Copy each referenced asset into BOTH dist dirs, preserving directory structure
  let copiedCount = 0;
  for (const asset of assets) {
    const srcFile = path.resolve(htmlDir, asset);
    if (!fs.existsSync(srcFile)) continue;

    for (const distDir of [serverDir, localDir]) {
      const destFile = path.join(distDir, asset);
      const destDir  = path.dirname(destFile);
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(srcFile, destFile);
    }
    copiedCount++;
  }

  // Also copy any CSS-referenced assets (fonts, images in url() etc.)
  for (const asset of assets) {
    const srcFile = path.resolve(htmlDir, asset);
    if (!fs.existsSync(srcFile) || !asset.endsWith('.css')) continue;

    const cssContent = fs.readFileSync(srcFile, 'utf-8');
    const urlRe = /url\(\s*["']?([^"')]+?)["']?\s*\)/g;
    let cm;
    while ((cm = urlRe.exec(cssContent)) !== null) {
      const ref = cm[1];
      if (ref.startsWith('data:') || ref.startsWith('http') || ref.startsWith('//')) continue;
      const cssSrcDir = path.dirname(srcFile);
      const assetSrc  = path.resolve(cssSrcDir, ref);
      if (!fs.existsSync(assetSrc)) continue;

      for (const distDir of [serverDir, localDir]) {
        const cssDestDir = path.dirname(path.join(distDir, asset));
        const assetDest  = path.resolve(cssDestDir, ref);
        if (!fs.existsSync(assetDest)) {
          const dir = path.dirname(assetDest);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.copyFileSync(assetSrc, assetDest);
        }
      }
      copiedCount++;
    }
  }

  // Make the bundle filename relative (same name in both dirs)
  const bundleRel = path.relative(serverDir, bundleFile).replace(/\\/g, '/');

  // Replace <script type="module" src="..."> with the bundle (defer)
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

  // ── server/index.html ──
  // Keep <base href="/"> as-is — the preload scanner sees it, all resources
  // resolve from root, deep-route refreshes work perfectly.
  const serverHtml = html;

  // ── local/index.html ──
  // Remove <base href="/"> so relative paths resolve from the HTML file's
  // directory — correct for file:// with zero console errors.
  const localHtml = html.replace(/<base\s+href\s*=\s*["']\/["'][^>]*>\s*\n?\s*/i, '');

  // Write both
  const htmlName = path.basename(htmlRelPath);
  fs.writeFileSync(path.join(serverDir, htmlName), serverHtml, 'utf-8');
  fs.writeFileSync(path.join(localDir, htmlName), localHtml, 'utf-8');
  console.log(`  ✓ server/${htmlName} (with <base href="/">)`);
  console.log(`  ✓ local/${htmlName}  (relative paths, file:// ready)`);
  console.log(`  ✓ Copied ${copiedCount} asset(s) into both dist dirs`);
}


// ---------------------------------------------------------------------------
// "dev" command — development server with live-reload
// ---------------------------------------------------------------------------

/**
 * SSE live-reload client script injected into served HTML.
 * Connects to /__zq_reload, reloads on 'reload' events,
 * and hot-swaps CSS on 'css' events without a full reload.
 */
const LIVE_RELOAD_SNIPPET = `<script>
(function(){
  var es, timer;
  function connect(){
    es = new EventSource('/__zq_reload');
    es.addEventListener('reload', function(){ location.reload(); });
    es.addEventListener('css', function(e){
      var sheets = document.querySelectorAll('link[rel="stylesheet"]');
      sheets.forEach(function(l){
        var href = l.getAttribute('href');
        if(!href) return;
        var sep = href.indexOf('?') >= 0 ? '&' : '?';
        l.setAttribute('href', href.replace(/[?&]_zqr=\\d+/, '') + sep + '_zqr=' + Date.now());
      });
    });
    es.onerror = function(){
      es.close();
      clearTimeout(timer);
      timer = setTimeout(connect, 2000);
    };
  }
  connect();
})();
</script>`;

function devServer() {
  let zeroHttp;
  try {
    zeroHttp = require('zero-http');
  } catch (_) {
    console.error(`\n  ✗ zero-http is required for the dev server.`);
    console.error(`    Install it: npm install zero-http --save-dev\n`);
    process.exit(1);
  }

  const { createApp, static: serveStatic } = zeroHttp;

  // Determine the project root to serve
  let root = null;
  for (let i = 1; i < args.length; i++) {
    if (!args[i].startsWith('-') && args[i - 1] !== '-p' && args[i - 1] !== '--port') {
      root = path.resolve(process.cwd(), args[i]);
      break;
    }
  }
  if (!root) {
    // Auto-detect: look for index.html in cwd or common sub-dirs
    const candidates = [
      process.cwd(),
      path.join(process.cwd(), 'public'),
      path.join(process.cwd(), 'src'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(path.join(c, 'index.html'))) { root = c; break; }
    }
    if (!root) root = process.cwd();
  }

  const PORT = parseInt(option('port', 'p', '3100'));

  // SSE clients for live-reload
  const sseClients = new Set();

  const app = createApp();

  // SSE endpoint — clients connect here for reload notifications
  app.get('/__zq_reload', (req, res) => {
    const sse = res.sse({ keepAlive: 30000, keepAliveComment: 'ping' });
    sseClients.add(sse);
    sse.on('close', () => sseClients.delete(sse));
  });

  // Static file serving
  app.use(serveStatic(root, { index: false, dotfiles: 'ignore' }));

  // SPA fallback — inject live-reload snippet into HTML
  app.get('*', (req, res) => {
    if (path.extname(req.url) && path.extname(req.url) !== '.html') {
      res.status(404).send('Not Found');
      return;
    }
    const indexPath = path.join(root, 'index.html');
    if (!fs.existsSync(indexPath)) {
      res.status(404).send('index.html not found');
      return;
    }
    let html = fs.readFileSync(indexPath, 'utf-8');
    // Inject live-reload snippet before </body> or at end
    if (html.includes('</body>')) {
      html = html.replace('</body>', LIVE_RELOAD_SNIPPET + '\n</body>');
    } else {
      html += LIVE_RELOAD_SNIPPET;
    }
    res.html(html);
  });

  // Broadcast a reload event to all connected SSE clients
  function broadcast(eventType, data) {
    for (const sse of sseClients) {
      try { sse.event(eventType, data || ''); } catch (_) { sseClients.delete(sse); }
    }
  }

  // File watcher — watch the project root for changes
  const WATCH_EXTS = new Set(['.js', '.css', '.html', '.htm', '.json', '.svg']);
  const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', '.cache']);
  let debounceTimer;

  function shouldWatch(filename) {
    if (!filename) return false;
    const ext = path.extname(filename).toLowerCase();
    return WATCH_EXTS.has(ext);
  }

  function isIgnored(filepath) {
    const parts = filepath.split(path.sep);
    return parts.some(p => IGNORE_DIRS.has(p));
  }

  // Collect directories to watch (walk root, skip ignored)
  function collectWatchDirs(dir) {
    const dirs = [dir];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (IGNORE_DIRS.has(entry.name)) continue;
        const sub = path.join(dir, entry.name);
        dirs.push(...collectWatchDirs(sub));
      }
    } catch (_) {}
    return dirs;
  }

  const watchDirs = collectWatchDirs(root);
  const watchers = [];

  for (const dir of watchDirs) {
    try {
      const watcher = fs.watch(dir, (eventType, filename) => {
        if (!shouldWatch(filename)) return;
        const fullPath = path.join(dir, filename || '');
        if (isIgnored(fullPath)) return;

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const rel = path.relative(root, fullPath).replace(/\\/g, '/');
          const ext = path.extname(filename).toLowerCase();
          const now = new Date().toLocaleTimeString();

          if (ext === '.css') {
            console.log(`  ${now}  \x1b[35m css \x1b[0m ${rel}`);
            broadcast('css', rel);
          } else {
            console.log(`  ${now}  \x1b[36m reload \x1b[0m ${rel}`);
            broadcast('reload', rel);
          }
        }, 100);
      });
      watchers.push(watcher);
    } catch (_) {}
  }

  app.listen(PORT, () => {
    console.log(`\n  \x1b[1mzQuery Dev Server\x1b[0m`);
    console.log(`  \x1b[2m${'─'.repeat(40)}\x1b[0m`);
    console.log(`  Local:       \x1b[36mhttp://localhost:${PORT}/\x1b[0m`);
    console.log(`  Root:        ${path.relative(process.cwd(), root) || '.'}`);
    console.log(`  Live Reload: \x1b[32menabled\x1b[0m (SSE)`);
    console.log(`  Watching:    ${WATCH_EXTS.size} file types in ${watchDirs.length} director${watchDirs.length === 1 ? 'y' : 'ies'}`);
    console.log(`  \x1b[2m${'─'.repeat(40)}\x1b[0m`);
    console.log(`  Press Ctrl+C to stop\n`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n  Shutting down...');
    watchers.forEach(w => w.close());
    for (const sse of sseClients) { try { sse.close(); } catch (_) {} }
    app.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000);
  });
}


// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

function showHelp() {
  console.log(`
  zQuery CLI — build, bundle & dev tool

  COMMANDS

    build                      Build the zQuery library → dist/
                               (must be run from the project root where src/ lives)

    bundle [entry]             Bundle app ES modules into a single file
      --out, -o <path>         Output directory (default: dist/ next to index.html)
      --html <file>            Use a specific HTML file (default: auto-detected)
      --watch, -w              Watch source files and rebuild on changes

    dev [root]                 Start a dev server with live-reload
      --port, -p <number>     Port number (default: 3100)

  SMART DEFAULTS

    The bundler works with zero flags for typical projects:
      • Entry is auto-detected from index.html <script type="module" src="...">
      • zquery.min.js is always embedded (auto-built from source if not found)
      • index.html is rewritten for both server and local (file://) use
      • Output goes to dist/server/ and dist/local/ next to the detected index.html

  OUTPUT

    The bundler produces two self-contained sub-directories:

      dist/server/               deploy to your web server
        index.html               has <base href="/"> for SPA deep routes
        z-<entry>.<hash>.js      readable bundle
        z-<entry>.<hash>.min.js  minified bundle

      dist/local/                open from disk (file://)
        index.html               relative paths, no <base> tag
        z-<entry>.<hash>.js      same bundle

    Previous hashed builds are automatically cleaned on each rebuild.

  DEVELOPMENT

    zquery dev                 start a dev server with live-reload (port 3100)
    zquery dev --port 8080     custom port
    zquery bundle --watch      watch mode — auto-rebuild bundle on source changes

  EXAMPLES

    # Start dev server with live-reload
    cd my-app && zquery dev

    # Build the library only
    zquery build

    # Bundle an app — auto-detects everything
    cd my-app && zquery bundle

    # Point to an entry from a parent directory
    zquery bundle path/to/scripts/app.js

    # Custom output directory
    zquery bundle -o build/

    # Watch mode (rebuild bundle on changes)
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
} else if (command === 'bundle') {
  bundleApp();
} else if (command === 'dev') {
  devServer();
} else {
  console.error(`\n  Unknown command: ${command}\n  Run "zquery --help" for usage.\n`);
  process.exit(1);
}
