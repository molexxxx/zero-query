/**
 * cli/commands/bundle.js — app bundler command
 *
 * Walks the ES module import graph starting from an entry file,
 * strips import/export syntax, concatenates everything into a single
 * IIFE with content-hashed filenames, and rewrites index.html for
 * both server and local (file://) deployment.
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const { args, option }        = require('../args');
const { minify, sizeKB }      = require('../utils');
const buildLibrary             = require('./build');

// ---------------------------------------------------------------------------
// Module graph helpers
// ---------------------------------------------------------------------------

/** Resolve an import specifier relative to the importing file. */
function resolveImport(specifier, fromFile) {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) return null;
  let resolved = path.resolve(path.dirname(fromFile), specifier);
  if (!path.extname(resolved) && fs.existsSync(resolved + '.js')) {
    resolved += '.js';
  }
  return resolved;
}

/** Extract import specifiers from a source file. */
function extractImports(code) {
  const specifiers = [];
  let m;
  const fromRe = /\bfrom\s+['"]([^'"]+)['"]/g;
  while ((m = fromRe.exec(code)) !== null) specifiers.push(m[1]);
  const sideRe = /^\s*import\s+['"]([^'"]+)['"]\s*;?\s*$/gm;
  while ((m = sideRe.exec(code)) !== null) {
    if (!specifiers.includes(m[1])) specifiers.push(m[1]);
  }
  return specifiers;
}

/** Walk the import graph — topological sort (leaves first). */
function walkImportGraph(entry) {
  const visited = new Set();
  const order   = [];

  function visit(file) {
    const abs = path.resolve(file);
    if (visited.has(abs)) return;
    visited.add(abs);

    if (!fs.existsSync(abs)) {
      console.warn(`  ⚠  Missing file: ${abs}`);
      return;
    }

    const code    = fs.readFileSync(abs, 'utf-8');
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

/** Strip ES module import/export syntax, keeping declarations. */
function stripModuleSyntax(code) {
  code = code.replace(/^\s*import\s+[\s\S]*?from\s+['"].*?['"];?\s*$/gm, '');
  code = code.replace(/^\s*import\s+['"].*?['"];?\s*$/gm, '');
  code = code.replace(/^(\s*)export\s+default\s+/gm, '$1');
  code = code.replace(/^(\s*)export\s+(const|let|var|function|class|async\s+function)\s/gm, '$1$2 ');
  code = code.replace(/^\s*export\s*\{[\s\S]*?\};?\s*$/gm, '');
  return code;
}

/** Replace import.meta.url with a runtime equivalent. */
function replaceImportMeta(code, filePath, projectRoot) {
  if (!code.includes('import.meta')) return code;
  const rel = path.relative(projectRoot, filePath).replace(/\\/g, '/');
  return code.replace(/import\.meta\.url/g, `(new URL('${rel}', document.baseURI).href)`);
}

/**
 * Rewrite templateUrl / styleUrl relative paths to project-relative paths.
 * In a bundled IIFE, caller-base detection returns undefined (all stack
 * frames point to the single bundle file), so relative URLs like
 * 'contacts.html' never resolve to their original directory.  By rewriting
 * them to the same project-relative keys used in window.__zqInline, the
 * runtime inline-resource lookup succeeds without a network fetch.
 */
function rewriteResourceUrls(code, filePath, projectRoot) {
  const fileDir = path.dirname(filePath);
  return code.replace(
    /((?:templateUrl|styleUrl)\s*:\s*)(['"])([^'"]+)\2/g,
    (match, prefix, quote, url) => {
      if (url.startsWith('/') || url.includes('://')) return match;
      const abs = path.resolve(fileDir, url);
      const rel = path.relative(projectRoot, abs).replace(/\\/g, '/');
      return `${prefix}${quote}${rel}${quote}`;
    }
  );
}

/**
 * Scan bundled source files for external resource references
 * (pages config, templateUrl, styleUrl) and return a map of
 * { relativePath: fileContent } for inlining.
 */
function collectInlineResources(files, projectRoot) {
  const inlineMap = {};

  for (const file of files) {
    const code    = fs.readFileSync(file, 'utf-8');
    const fileDir = path.dirname(file);

    // pages: config
    const pagesMatch = code.match(/pages\s*:\s*\{[^}]*dir\s*:\s*['"]([^'"]+)['"]/s);
    if (pagesMatch) {
      const pagesDir = pagesMatch[1];
      const ext = (code.match(/pages\s*:\s*\{[^}]*ext\s*:\s*['"]([^'"]+)['"]/s) || [])[1] || '.html';
      const itemsMatch = code.match(/items\s*:\s*\[([\s\S]*?)\]/);
      if (itemsMatch) {
        const itemsBlock = itemsMatch[1];
        const ids = [];
        let m;
        const strRe = /['"]([^'"]+)['"]/g;
        while ((m = strRe.exec(itemsBlock)) !== null) {
          const before = itemsBlock.substring(Math.max(0, m.index - 20), m.index);
          if (/label\s*:\s*$/.test(before)) continue;
          ids.push(m[1]);
        }
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

    // styleUrl:
    const styleMatch = code.match(/styleUrl\s*:\s*['"]([^'"]+)['"]/);
    if (styleMatch) {
      const stylePath = path.join(fileDir, styleMatch[1]);
      if (fs.existsSync(stylePath)) {
        const relKey = path.relative(projectRoot, stylePath).replace(/\\/g, '/');
        inlineMap[relKey] = fs.readFileSync(stylePath, 'utf-8');
      }
    }

    // templateUrl:
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
 * Auto-detect the app entry point.
 *
 * Strategy — ordered by precedence (first match wins):
 *   1. HTML discovery: index.html first, then other .html files
 *      (root level + one directory deep).
 *   2. Within each HTML file, prefer a module <script> whose src
 *      resolves to app.js, then fall back to the first module
 *      <script> tag regardless of name.
 *   3. JS file scan: look for $.router first (entry point by design),
 *      then $.mount / $.store / mountAll.
 *   4. Convention fallback paths.
 */
function detectEntry(projectRoot) {
  // Matches all <script type="module" src="…"> tags (global)
  const moduleScriptReG = /<script[^>]+type\s*=\s*["']module["'][^>]+src\s*=\s*["']([^"']+)["']/g;

  // Collect HTML files: root level + one directory deep
  const htmlFiles = [];
  for (const entry of fs.readdirSync(projectRoot, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.html')) {
      htmlFiles.push(path.join(projectRoot, entry.name));
    } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
      const sub = path.join(projectRoot, entry.name);
      try {
        for (const child of fs.readdirSync(sub, { withFileTypes: true })) {
          if (child.isFile() && child.name.endsWith('.html')) {
            htmlFiles.push(path.join(sub, child.name));
          }
        }
      } catch { /* permission error — skip */ }
    }
  }

  // Sort: index.html first (at any depth), then alphabetical
  htmlFiles.sort((a, b) => {
    const aIsIndex = path.basename(a) === 'index.html' ? 0 : 1;
    const bIsIndex = path.basename(b) === 'index.html' ? 0 : 1;
    if (aIsIndex !== bIsIndex) return aIsIndex - bIsIndex;
    return a.localeCompare(b);
  });

  // 1. Parse module <script> tags from HTML files (index.html evaluated first).
  //    Within each file prefer a src ending in app.js, else the first module tag.
  for (const htmlPath of htmlFiles) {
    const html = fs.readFileSync(htmlPath, 'utf-8');
    const htmlDir = path.dirname(htmlPath);

    let appJsEntry   = null;  // src that resolves to app.js
    let firstEntry   = null;  // first module script src
    let m;
    moduleScriptReG.lastIndex = 0;
    while ((m = moduleScriptReG.exec(html)) !== null) {
      const resolved = path.resolve(htmlDir, m[1]);
      if (!fs.existsSync(resolved)) continue;
      if (!firstEntry) firstEntry = resolved;
      if (path.basename(resolved) === 'app.js') { appJsEntry = resolved; break; }
    }

    if (appJsEntry) return appJsEntry;
    if (firstEntry) return firstEntry;
  }

  // 2. Search JS files for entry-point patterns.
  //    Pass 1 — $.router (the canonical entry point).
  //    Pass 2 — $.mount, $.store, mountAll (component-level, lower confidence).
  const routerRe  = /\$\.router\s*\(/;
  const otherRe   = /\$\.(mount|store)\s*\(|mountAll\s*\(/;

  function collectJS(dir, depth = 0) {
    const results = [];
    if (depth > 2) return results;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
        const full = path.join(dir, entry.name);
        if (entry.isFile() && entry.name.endsWith('.js')) {
          results.push(full);
        } else if (entry.isDirectory()) {
          results.push(...collectJS(full, depth + 1));
        }
      }
    } catch { /* skip */ }
    return results;
  }

  const jsFiles = collectJS(projectRoot);

  // Pass 1: $.router
  for (const file of jsFiles) {
    const code = fs.readFileSync(file, 'utf-8');
    if (routerRe.test(code)) return file;
  }
  // Pass 2: other entry-point signals
  for (const file of jsFiles) {
    const code = fs.readFileSync(file, 'utf-8');
    if (otherRe.test(code)) return file;
  }

  // 3. Convention fallbacks
  const fallbacks = ['scripts/app.js', 'src/app.js', 'js/app.js', 'app.js', 'main.js'];
  for (const f of fallbacks) {
    const fp = path.join(projectRoot, f);
    if (fs.existsSync(fp)) return fp;
  }
  return null;
}

// ---------------------------------------------------------------------------
// HTML rewriting
// ---------------------------------------------------------------------------

/**
 * Rewrite an HTML file to replace the module <script> with the bundle.
 * Produces two variants:
 *   server/index.html — <base href="/"> for SPA deep routes
 *   local/index.html  — relative paths for file:// access
 */
function rewriteHtml(projectRoot, htmlRelPath, bundleFile, includeLib, bundledFiles, serverDir, localDir) {
  const htmlPath = path.resolve(projectRoot, htmlRelPath);
  if (!fs.existsSync(htmlPath)) {
    console.warn(`  ⚠  HTML file not found: ${htmlRelPath}`);
    return;
  }

  const htmlDir = path.dirname(htmlPath);
  let html = fs.readFileSync(htmlPath, 'utf-8');

  // Collect asset references from HTML
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

  // Copy assets into both dist dirs
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

  // Copy CSS-referenced assets (fonts, images in url())
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

  const bundleRel = path.relative(serverDir, bundleFile).replace(/\\/g, '/');

  html = html.replace(
    /<script\s+type\s*=\s*["']module["']\s+src\s*=\s*["'][^"']+["']\s*>\s*<\/script>/gi,
    `<script defer src="${bundleRel}"></script>`
  );

  if (includeLib) {
    html = html.replace(
      /\s*<script\s+src\s*=\s*["'][^"']*zquery(?:\.min)?\.js["']\s*>\s*<\/script>/gi,
      ''
    );
  }

  const serverHtml = html;
  const localHtml  = html.replace(/<base\s+href\s*=\s*["']\/["'][^>]*>\s*\n?\s*/i, '');

  const htmlName = path.basename(htmlRelPath);
  fs.writeFileSync(path.join(serverDir, htmlName), serverHtml, 'utf-8');
  fs.writeFileSync(path.join(localDir, htmlName), localHtml, 'utf-8');
  console.log(`  ✓ server/${htmlName} (with <base href="/">)`);
  console.log(`  ✓ local/${htmlName}  (relative paths, file:// ready)`);
  console.log(`  ✓ Copied ${copiedCount} asset(s) into both dist dirs`);
}

// ---------------------------------------------------------------------------
// Main bundleApp function
// ---------------------------------------------------------------------------

function bundleApp() {
  const projectRoot = process.cwd();

  // Entry point — accepts a directory (auto-detects entry inside it) or a file
  let entry = null;
  let targetDir = null;
  for (let i = 1; i < args.length; i++) {
    if (!args[i].startsWith('-') && args[i - 1] !== '-o' && args[i - 1] !== '--out' && args[i - 1] !== '--html') {
      const resolved = path.resolve(projectRoot, args[i]);
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        targetDir = resolved;
        entry = detectEntry(resolved);
      } else {
        entry = resolved;
      }
      break;
    }
  }
  if (!entry) entry = detectEntry(projectRoot);

  if (!entry || !fs.existsSync(entry)) {
    console.error(`\n  \u2717 Could not find entry file.`);
    console.error(`    Provide an app directory: zquery bundle my-app/\n`);
    process.exit(1);
  }

  const outPath = option('out', 'o', null);

  // Auto-detect index.html
  let htmlFile = option('html', null, null);
  let htmlAbs  = htmlFile ? path.resolve(projectRoot, htmlFile) : null;
  if (!htmlFile) {
    const htmlCandidates = [];
    let entryDir = path.dirname(entry);
    while (entryDir.length >= projectRoot.length) {
      htmlCandidates.push(path.join(entryDir, 'index.html'));
      const parent = path.dirname(entryDir);
      if (parent === entryDir) break;
      entryDir = parent;
    }
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

  // Output directory
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

  const serverDir = path.join(baseDistDir, 'server');
  const localDir  = path.join(baseDistDir, 'local');

  console.log(`\n  zQuery App Bundler`);
  console.log(`  Entry:   ${entryRel}`);
  console.log(`  Output:  ${path.relative(projectRoot, baseDistDir)}/server/ & local/`);
  console.log(`  Library: embedded`);
  console.log(`  HTML:    ${htmlFile || 'not found (no index.html detected)'}`);
  console.log('');

  // ------ doBuild (inlined) ------
  const start = Date.now();

  if (!fs.existsSync(serverDir)) fs.mkdirSync(serverDir, { recursive: true });
  if (!fs.existsSync(localDir))  fs.mkdirSync(localDir, { recursive: true });

  const files = walkImportGraph(entry);
  console.log(`  Resolved ${files.length} module(s):`);
  files.forEach(f => console.log(`    • ${path.relative(projectRoot, f)}`));

  const sections = files.map(file => {
    let code = fs.readFileSync(file, 'utf-8');
    code = stripModuleSyntax(code);
    code = replaceImportMeta(code, file, projectRoot);
    code = rewriteResourceUrls(code, file, projectRoot);
    const rel = path.relative(projectRoot, file);
    return `// --- ${rel} ${'—'.repeat(Math.max(1, 60 - rel.length))}\n${code.trim()}`;
  });

  // Embed zquery.min.js
  let libSection = '';
  {
    // __dirname is cli/commands/, so the package root is two levels up
    const pkgRoot    = path.resolve(__dirname, '..', '..');
    const pkgSrcDir  = path.join(pkgRoot, 'src');
    const pkgMinFile = path.join(pkgRoot, 'dist', 'zquery.min.js');

    if (fs.existsSync(pkgSrcDir) && fs.existsSync(path.join(pkgRoot, 'index.js'))) {
      console.log(`\n  Building library from source...`);
      const prevCwd = process.cwd();
      try {
        process.chdir(pkgRoot);
        buildLibrary();
      } finally {
        process.chdir(prevCwd);
      }
    }

    const htmlDir = htmlAbs ? path.dirname(htmlAbs) : null;
    const libCandidates = [
      path.join(pkgRoot, 'dist/zquery.min.js'),
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

  // Inline resources
  const inlineMap = collectInlineResources(files, projectRoot);
  let inlineSection = '';
  if (Object.keys(inlineMap).length > 0) {
    const entries = Object.entries(inlineMap).map(([key, content]) => {
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

  // Content-hashed filenames
  const contentHash = crypto.createHash('sha256').update(bundle).digest('hex').slice(0, 8);
  const bundleBase  = `z-${entryName}.${contentHash}.js`;
  const minBase     = `z-${entryName}.${contentHash}.min.js`;

  // Clean previous builds
  const escName = entryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cleanRe = new RegExp(`^z-${escName}\\.[a-f0-9]{8}\\.(?:min\\.)?js$`);
  for (const dir of [serverDir, localDir]) {
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        if (cleanRe.test(f)) fs.unlinkSync(path.join(dir, f));
      }
    }
  }

  // Write bundles
  const bundleFile = path.join(serverDir, bundleBase);
  const minFile    = path.join(serverDir, minBase);
  fs.writeFileSync(bundleFile, bundle, 'utf-8');
  fs.writeFileSync(minFile, minify(bundle, banner), 'utf-8');
  fs.copyFileSync(bundleFile, path.join(localDir, bundleBase));
  fs.copyFileSync(minFile, path.join(localDir, minBase));

  console.log(`\n  ✓ ${bundleBase} (${sizeKB(fs.readFileSync(bundleFile))} KB)`);
  console.log(`  ✓ ${minBase} (${sizeKB(fs.readFileSync(minFile))} KB)`);

  // Rewrite HTML
  if (htmlFile) {
    const bundledFileSet = new Set(files);
    rewriteHtml(projectRoot, htmlFile, minFile, true, bundledFileSet, serverDir, localDir);
  }

  const elapsed = Date.now() - start;
  console.log(`  Done in ${elapsed}ms\n`);
}

module.exports = bundleApp;
