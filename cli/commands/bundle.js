/**
 * cli/commands/bundle.js - app bundler command
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

const { args, flag, option }   = require('../args');
const { minify, sizeKB }      = require('../utils');
const buildLibrary             = require('./build');

// ---------------------------------------------------------------------------
// Module graph helpers
// ---------------------------------------------------------------------------

/** Resolve an import specifier relative to the importing file. */
function resolveImport(specifier, fromFile) {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) return null;
  // Skip non-JS assets (CSS, images, etc.) referenced in code examples
  if (/\.(?:css|json|svg|png|jpg|gif|woff2?|ttf|eot)$/i.test(specifier)) return null;
  let resolved = path.resolve(path.dirname(fromFile), specifier);
  if (!path.extname(resolved) && fs.existsSync(resolved + '.js')) {
    resolved += '.js';
  }
  return resolved;
}

/** Extract import specifiers from a source file. */
function extractImports(code) {
  // Only scan the import preamble (before the first top-level `export`)
  // so that code examples inside exported template strings are not
  // mistaken for real imports.
  const exportStart = code.search(/^export\b/m);
  const preamble = exportStart > -1 ? code.slice(0, exportStart) : code;

  const specifiers = [];
  let m;
  const fromRe = /\bfrom\s+['"]([^'"]+)['"]/g;
  while ((m = fromRe.exec(preamble)) !== null) specifiers.push(m[1]);
  const sideRe = /^\s*import\s+['"]([^'"]+)['"]\s*;?\s*$/gm;
  while ((m = sideRe.exec(preamble)) !== null) {
    if (!specifiers.includes(m[1])) specifiers.push(m[1]);
  }

  // Also capture re-exports anywhere in the file:
  //   export { x } from '...'   export * from '...'
  const reExportRe = /^\s*export\s+(?:\{[^}]*\}|\*)\s*from\s+['"]([^'"]+)['"]/gm;
  while ((m = reExportRe.exec(code)) !== null) {
    if (!specifiers.includes(m[1])) specifiers.push(m[1]);
  }
  return specifiers;
}

/** Walk the import graph - topological sort (leaves first). */
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
      // Only rewrite if the file actually exists - avoids mangling code examples
      if (!fs.existsSync(abs)) return match;
      const rel = path.relative(projectRoot, abs).replace(/\\/g, '/');
      return `${prefix}${quote}${rel}${quote}`;
    }
  );
}

/**
 * Minify HTML for inlining - strips indentation and collapses whitespace
 * between tags.  Preserves content inside <pre>, <code>, and <textarea>
 * blocks verbatim so syntax-highlighted code samples survive.
 */
function minifyHTML(html) {
  const preserved = [];
  // Protect <pre>…</pre> and <textarea>…</textarea> (multiline code blocks)
  html = html.replace(/<(pre|textarea)(\b[^>]*)>[\s\S]*?<\/\1>/gi, m => {
    preserved.push(m);
    return `\x00P${preserved.length - 1}\x00`;
  });
  // Strip HTML comments
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  // Collapse runs of whitespace (newlines + indentation) to a single space
  html = html.replace(/\s{2,}/g, ' ');
  // Remove space between tags: "> <" → "><"
  // but preserve a space when an inline element is involved (a, span, strong, em, b, i, code, small, sub, sup, abbr, label)
  html = html.replace(/>\s+</g, (m, offset) => {
    const before = html.slice(Math.max(0, offset - 80), offset + 1);
    const after  = html.slice(offset + m.length - 1, offset + m.length + 40);
    const inlineTags = /\b(a|span|strong|em|b|i|code|small|sub|sup|abbr|label)\b/i;
    const closingInline = /<\/\s*(a|span|strong|em|b|i|code|small|sub|sup|abbr|label)\s*>$/i.test(before);
    const openingInline = /^<(a|span|strong|em|b|i|code|small|sub|sup|abbr|label)[\s>]/i.test(after);
    return (closingInline || openingInline) ? '> <' : '><';
  });
  // Remove spaces inside opening tags:  <tag  attr = "val" > → <tag attr="val">
  html = html.replace(/ *\/ *>/g, '/>');
  html = html.replace(/ *= */g, '=');
  // Trim
  html = html.trim();
  // Restore preserved blocks
  html = html.replace(/\x00P(\d+)\x00/g, (_, i) => preserved[+i]);
  return html;
}

/**
 * Minify CSS for inlining - strips comments, collapses whitespace,
 * removes unnecessary spaces around punctuation.
 */
function minifyCSS(css) {
  // Strip block comments
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  // Collapse whitespace
  css = css.replace(/\s{2,}/g, ' ');
  // Remove spaces around { } : ; ,
  css = css.replace(/\s*([{};:,])\s*/g, '$1');
  // Remove trailing semicolons before }
  css = css.replace(/;}/g, '}');
  return css.trim();
}

/**
 * Walk JS source and minify the HTML/CSS inside template literals.
 * Handles ${…} interpolations (with nesting) and preserves <pre> blocks.
 * Only trims whitespace sequences that appear between/around HTML tags.
 */
function minifyTemplateLiterals(code) {
  let out = '';
  let i = 0;
  while (i < code.length) {
    const ch = code[i];

    // Regular string: copy verbatim
    if (ch === '"' || ch === "'") {
      const q = ch; out += ch; i++;
      while (i < code.length) {
        if (code[i] === '\\') { out += code[i] + (code[i + 1] || ''); i += 2; continue; }
        out += code[i];
        if (code[i] === q) { i++; break; }
        i++;
      }
      continue;
    }

    // Line comment: copy verbatim
    if (ch === '/' && code[i + 1] === '/') {
      while (i < code.length && code[i] !== '\n') out += code[i++];
      continue;
    }
    // Block comment: copy verbatim
    if (ch === '/' && code[i + 1] === '*') {
      out += '/*'; i += 2;
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) out += code[i++];
      out += '*/'; i += 2;
      continue;
    }

    // Template literal: extract, minify HTML, and emit
    if (ch === '`') {
      out += _minifyTemplate(code, i);
      // Advance past the template
      i = _skipTemplateLiteral(code, i);
      continue;
    }

    out += ch; i++;
  }
  return out;
}

/** Extract a full template literal (handling nested ${…}) and return it minified. */
function _minifyTemplate(code, start) {
  const end = _skipTemplateLiteral(code, start);
  const raw = code.substring(start, end);
  // Only minify templates that contain HTML tags or CSS rules
  if (/<\w/.test(raw)) return _collapseTemplateWS(raw);
  if (/[{};]\s/.test(raw) && /[.#\w-]+\s*\{/.test(raw)) return _collapseTemplateCSS(raw);
  return raw;
}

/** Return index past the closing backtick of a template starting at `start`. */
function _skipTemplateLiteral(code, start) {
  let i = start + 1; // skip opening backtick
  let depth = 0;
  while (i < code.length) {
    if (code[i] === '\\') { i += 2; continue; }
    if (code[i] === '$' && code[i + 1] === '{') { depth++; i += 2; continue; }
    if (depth > 0) {
      if (code[i] === '{') { depth++; i++; continue; }
      if (code[i] === '}') { depth--; i++; continue; }
      if (code[i] === '`') { i = _skipTemplateLiteral(code, i); continue; }
      if (code[i] === '"' || code[i] === "'") {
        const q = code[i]; i++;
        while (i < code.length) {
          if (code[i] === '\\') { i += 2; continue; }
          if (code[i] === q) { i++; break; }
          i++;
        }
        continue;
      }
      i++; continue;
    }
    if (code[i] === '`') { i++; return i; } // closing backtick
    i++;
  }
  return i;
}

/**
 * Collapse whitespace in the text portions of an HTML template literal,
 * preserving ${…} expressions, <pre> blocks, and inline text spacing.
 */
function _collapseTemplateWS(tpl) {
  // Build array of segments: text portions vs ${…} expressions
  const segments = [];
  let i = 1; // skip opening backtick
  let text = '';
  while (i < tpl.length - 1) { // stop before closing backtick
    if (tpl[i] === '\\') { text += tpl[i] + (tpl[i + 1] || ''); i += 2; continue; }
    if (tpl[i] === '$' && tpl[i + 1] === '{') {
      if (text) { segments.push({ type: 'text', val: text }); text = ''; }
      // Collect the full expression
      let depth = 1; let expr = '${'; i += 2;
      while (i < tpl.length - 1 && depth > 0) {
        if (tpl[i] === '\\') { expr += tpl[i] + (tpl[i + 1] || ''); i += 2; continue; }
        if (tpl[i] === '{') depth++;
        if (tpl[i] === '}') depth--;
        if (depth > 0) { expr += tpl[i]; i++; } else { expr += '}'; i++; }
      }
      segments.push({ type: 'expr', val: expr });
      continue;
    }
    text += tpl[i]; i++;
  }
  if (text) segments.push({ type: 'text', val: text });

  // Minify text segments (collapse whitespace between/around tags)
  for (let s = 0; s < segments.length; s++) {
    if (segments[s].type !== 'text') continue;
    let t = segments[s].val;
    // Protect <pre>…</pre> regions
    const preserved = [];
    t = t.replace(/<pre(\b[^>]*)>[\s\S]*?<\/pre>/gi, m => {
      preserved.push(m);
      return `\x00P${preserved.length - 1}\x00`;
    });
    // Collapse whitespace runs that touch a < or > but preserve a space
    // when an inline element boundary is involved
    t = t.replace(/>\s{2,}/g, (m, offset) => {
      const before = t.slice(Math.max(0, offset - 80), offset + 1);
      if (/<\/\s*(a|span|strong|em|b|i|code|small|sub|sup|abbr|label)\s*>$/i.test(before)) return '> ';
      return '>';
    });
    t = t.replace(/\s{2,}</g, (m, offset) => {
      const after = t.slice(offset + m.length - 1, offset + m.length + 40);
      if (/^<(a|span|strong|em|b|i|code|small|sub|sup|abbr|label)[\s>]/i.test(after)) return ' <';
      return '<';
    });
    // Collapse other multi-whitespace runs to a single space
    t = t.replace(/\s{2,}/g, ' ');
    // Restore <pre> blocks
    t = t.replace(/\x00P(\d+)\x00/g, (_, idx) => preserved[+idx]);
    segments[s].val = t;
  }

  return '`' + segments.map(s => s.val).join('') + '`';
}

/**
 * Collapse CSS whitespace inside a template literal (styles: `…`).
 * Uses the same segment-splitting approach as _collapseTemplateWS so
 * ${…} expressions are preserved untouched.
 */
function _collapseTemplateCSS(tpl) {
  const segments = [];
  let i = 1; let text = '';
  while (i < tpl.length - 1) {
    if (tpl[i] === '\\') { text += tpl[i] + (tpl[i + 1] || ''); i += 2; continue; }
    if (tpl[i] === '$' && tpl[i + 1] === '{') {
      if (text) { segments.push({ type: 'text', val: text }); text = ''; }
      let depth = 1; let expr = '${'; i += 2;
      while (i < tpl.length - 1 && depth > 0) {
        if (tpl[i] === '\\') { expr += tpl[i] + (tpl[i + 1] || ''); i += 2; continue; }
        if (tpl[i] === '{') depth++;
        if (tpl[i] === '}') depth--;
        if (depth > 0) { expr += tpl[i]; i++; } else { expr += '}'; i++; }
      }
      segments.push({ type: 'expr', val: expr });
      continue;
    }
    text += tpl[i]; i++;
  }
  if (text) segments.push({ type: 'text', val: text });

  for (let s = 0; s < segments.length; s++) {
    if (segments[s].type !== 'text') continue;
    let t = segments[s].val;
    t = t.replace(/\/\*[\s\S]*?\*\//g, '');
    t = t.replace(/\s{2,}/g, ' ');
    t = t.replace(/\s*([{};:,])\s*/g, '$1');
    t = t.replace(/;}/g, '}');
    segments[s].val = t;
  }
  return '`' + segments.map(s => s.val).join('') + '`';
}

/**
 * Scan bundled source files for external resource references
 * (templateUrl, styleUrl) and return a map of
 * { relativePath: fileContent } for inlining.
 */
function collectInlineResources(files, projectRoot) {
  const inlineMap = {};

  for (const file of files) {
    const code    = fs.readFileSync(file, 'utf-8');
    const fileDir = path.dirname(file);

    // styleUrl:
    const styleUrlRe = /styleUrl\s*:\s*['"]([^'"]+)['"]/g;
    const styleMatch = styleUrlRe.exec(code);
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
    } else if (/templateUrl\s*:/.test(code)) {
      // Dynamic templateUrl (e.g. Object.fromEntries, computed map) -
      // inline all .html files in the component's directory tree so
      // the runtime __zqInline lookup can resolve them by suffix.
      (function scanHtml(dir) {
        try {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isFile() && entry.name.endsWith('.html')) {
              const relKey = path.relative(projectRoot, full).replace(/\\/g, '/');
              if (!inlineMap[relKey]) {
                inlineMap[relKey] = fs.readFileSync(full, 'utf-8');
              }
            } else if (entry.isDirectory()) {
              scanHtml(full);
            }
          }
        } catch { /* permission error - skip */ }
      })(fileDir);
    }
  }

  // Minify inlined resources by type
  for (const key of Object.keys(inlineMap)) {
    if (key.endsWith('.html')) inlineMap[key] = minifyHTML(inlineMap[key]);
    else if (key.endsWith('.css')) inlineMap[key] = minifyCSS(inlineMap[key]);
  }

  return inlineMap;
}

/**
 * Auto-detect the app entry point.
 *
 * Strategy - ordered by precedence (first match wins):
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
      } catch { /* permission error - skip */ }
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
  //    Pass 1 - $.router (the canonical entry point).
  //    Pass 2 - $.mount, $.store, mountAll (component-level, lower confidence).
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
  const fallbacks = ['app/app.js', 'scripts/app.js', 'src/app.js', 'js/app.js', 'app.js', 'main.js'];
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
 *   server/index.html - <base href="/"> for SPA deep routes
 *   local/index.html  - relative paths for file:// access
 */
function rewriteHtml(projectRoot, htmlRelPath, bundleFile, includeLib, bundledFiles, serverDir, localDir, globalCssOrigHref, globalCssHash) {
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

  // Also scan the bundled JS for src/href references to local assets
  const bundleContent = fs.existsSync(bundleFile) ? fs.readFileSync(bundleFile, 'utf-8') : '';
  const jsAssetRe = /\b(?:src|href)\s*=\s*["\\]*["']([^"']+\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot|mp4|webm))["']/gi;
  while ((m = jsAssetRe.exec(bundleContent)) !== null) {
    const ref = m[1];
    if (ref.startsWith('http') || ref.startsWith('//') || ref.startsWith('data:')) continue;
    if (!assets.has(ref)) {
      const refAbs = path.resolve(htmlDir, ref);
      if (fs.existsSync(refAbs)) assets.add(ref);
    }
  }

  // For any referenced asset directories, copy all sibling files too
  const assetDirs = new Set();
  for (const asset of assets) {
    const dir = path.dirname(asset);
    if (dir && dir !== '.') assetDirs.add(dir);
  }
  for (const dir of assetDirs) {
    const absDirPath = path.resolve(htmlDir, dir);
    if (fs.existsSync(absDirPath) && fs.statSync(absDirPath).isDirectory()) {
      for (const child of fs.readdirSync(absDirPath)) {
        const childRel = path.join(dir, child).replace(/\\/g, '/');
        const childAbs = path.join(absDirPath, child);
        if (fs.statSync(childAbs).isFile() && !assets.has(childRel)) {
          assets.add(childRel);
        }
      }
    }
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

  // Rewrite global CSS link to hashed version
  if (globalCssOrigHref && globalCssHash) {
    const escapedHref = globalCssOrigHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cssLinkRe = new RegExp(
      `(<link[^>]+href\\s*=\\s*["'])${escapedHref}(["'][^>]*>)`, 'i'
    );
    html = html.replace(cssLinkRe, `$1${globalCssHash}$2`);
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
// Static asset copying
// ---------------------------------------------------------------------------

/**
 * Copy the entire app directory into both dist/server and dist/local,
 * skipping only build outputs, tooling dirs, and the app/ source dir.
 * This ensures all static assets (assets/, icons/, images/, fonts/,
 * manifests, etc.) are available in the built output without maintaining
 * a fragile whitelist.
 */
function copyStaticAssets(appRoot, serverDir, localDir, bundledFiles) {
  const SKIP_DIRS = new Set(['dist', 'node_modules', '.git', '.vscode']);

  // Case-insensitive match for App/ directory (contains bundled source)
  function isAppDir(name) {
    return name.toLowerCase() === 'app';
  }

  let copiedCount = 0;

  function copyEntry(srcPath, relPath) {
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      const dirName = path.basename(srcPath);
      if (SKIP_DIRS.has(dirName) || isAppDir(dirName)) return;
      for (const child of fs.readdirSync(srcPath)) {
        copyEntry(path.join(srcPath, child), path.join(relPath, child));
      }
    } else {
      if (bundledFiles && bundledFiles.has(path.resolve(srcPath))) return;
      for (const distDir of [serverDir, localDir]) {
        const dest = path.join(distDir, relPath);
        if (fs.existsSync(dest)) continue; // already copied by rewriteHtml
        const dir = path.dirname(dest);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.copyFileSync(srcPath, dest);
      }
      copiedCount++;
    }
  }

  for (const entry of fs.readdirSync(appRoot, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || isAppDir(entry.name)) continue;
      copyEntry(path.join(appRoot, entry.name), entry.name);
    } else {
      copyEntry(path.join(appRoot, entry.name), entry.name);
    }
  }

  if (copiedCount > 0) {
    console.log(`  \u2713 Copied ${copiedCount} additional static asset(s) into both dist dirs`);
  }
}

// ---------------------------------------------------------------------------
// Main bundleApp function
// ---------------------------------------------------------------------------

function bundleApp() {
  const projectRoot = process.cwd();
  const minimal = flag('minimal', 'm');
  const globalCssOverride = option('global-css', null, null);

  // Entry point - positional arg (directory or file) or auto-detection
  let entry = null;
  let targetDir = null;
  for (let i = 1; i < args.length; i++) {
    if (!args[i].startsWith('-') && args[i - 1] !== '-o' && args[i - 1] !== '--out' && args[i - 1] !== '--index') {
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
    console.error(`    Provide an app directory: zquery bundle my-app/`);
    console.error(`    Or pass a direct entry file: zquery bundle my-app/scripts/main.js\n`);
    process.exit(1);
  }

  const outPath = option('out', 'o', null);

  // Auto-detect HTML file
  let htmlFile = option('index', 'i', null);
  let htmlAbs  = htmlFile ? path.resolve(projectRoot, htmlFile) : null;
  if (!htmlFile) {
    // Strategy: first look for index.html walking up from entry, then
    // scan for any .html that references the entry via a module script tag.
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

    // If no index.html found, scan for any .html file that references
    // the entry point (supports home.html, app.html, etc.)
    if (!htmlAbs) {
      const searchRoot = targetDir || projectRoot;
      const htmlScan = [];
      for (const e of fs.readdirSync(searchRoot, { withFileTypes: true })) {
        if (e.isFile() && e.name.endsWith('.html')) {
          htmlScan.push(path.join(searchRoot, e.name));
        } else if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'dist') {
          try {
            for (const child of fs.readdirSync(path.join(searchRoot, e.name), { withFileTypes: true })) {
              if (child.isFile() && child.name.endsWith('.html')) {
                htmlScan.push(path.join(searchRoot, e.name, child.name));
              }
            }
          } catch { /* skip */ }
        }
      }
      // Prefer the HTML file that references our entry via a module script
      const moduleScriptRe = /<script[^>]+type\s*=\s*["']module["'][^>]+src\s*=\s*["']([^"']+)["']/g;
      for (const hp of htmlScan) {
        const content = fs.readFileSync(hp, 'utf-8');
        let m;
        moduleScriptRe.lastIndex = 0;
        while ((m = moduleScriptRe.exec(content)) !== null) {
          const resolved = path.resolve(path.dirname(hp), m[1]);
          if (resolved === path.resolve(entry)) {
            htmlAbs  = hp;
            htmlFile = path.relative(projectRoot, hp);
            break;
          }
        }
        if (htmlAbs) break;
      }
      // Last resort: use the first .html found
      if (!htmlAbs && htmlScan.length > 0) {
        htmlAbs  = htmlScan[0];
        htmlFile = path.relative(projectRoot, htmlScan[0]);
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
  console.log(`  HTML:    ${htmlFile || 'not found (no HTML detected)'}`);
  if (minimal) console.log(`  Mode:    minimal (HTML + JS + global CSS only)`);
  console.log('');

  // ------ doBuild (inlined) ------
  const start = Date.now();

  // Clean previous dist outputs for a fresh build
  for (const dir of [serverDir, localDir]) {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
  }
  fs.mkdirSync(serverDir, { recursive: true });
  fs.mkdirSync(localDir, { recursive: true });

  const files = walkImportGraph(entry);
  console.log(`  Resolved ${files.length} module(s):`);
  files.forEach(f => console.log(`    • ${path.relative(projectRoot, f)}`));

  const sections = files.map(file => {
    let code = fs.readFileSync(file, 'utf-8');
    code = stripModuleSyntax(code);
    code = replaceImportMeta(code, file, projectRoot);
    code = rewriteResourceUrls(code, file, projectRoot);
    code = minifyTemplateLiterals(code);
    const rel = path.relative(projectRoot, file);
    return `// --- ${rel} ${'-'.repeat(Math.max(1, 60 - rel.length))}\n${code.trim()}`;
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

    // Case-insensitive search for Assets/ directory
    function findAssetsDir(root) {
      try {
        for (const e of fs.readdirSync(root, { withFileTypes: true })) {
          if (e.isDirectory() && e.name.toLowerCase() === 'assets') return path.join(root, e.name);
        }
      } catch { /* skip */ }
      return null;
    }

    const assetsDir    = findAssetsDir(htmlDir || projectRoot);
    const altAssetsDir = htmlDir ? findAssetsDir(projectRoot) : null;

    const libCandidates = [
      path.join(pkgRoot, 'dist/zquery.min.js'),
      assetsDir    && path.join(assetsDir, 'scripts/zquery.min.js'),
      altAssetsDir && path.join(altAssetsDir, 'scripts/zquery.min.js'),
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
      libSection = `// --- zquery.min.js (library) ${'-'.repeat(34)}\n${fs.readFileSync(libPath, 'utf-8').trim()}\n\n`
                 + `// --- Build-time metadata ${'-'.repeat(50)}\nif(typeof $!=="undefined"){$.meta=Object.assign($.meta||{},{libSize:${libBytes}});}\n\n`;
      console.log(`  Embedded library from ${path.relative(projectRoot, libPath)} (${(libBytes / 1024).toFixed(1)} KB)`);
    } else {
      console.warn(`\n  ⚠  Could not find zquery.min.js anywhere`);
      console.warn(`     Place zquery.min.js in assets/scripts/, vendor/, lib/, or dist/`);
    }
  }

  const banner = `/**\n * App bundle - built by zQuery CLI\n * Entry: ${entryRel}\n * ${new Date().toISOString()}\n */`;

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
    inlineSection = `// --- Inlined resources (file:// support) ${'-'.repeat(20)}\nwindow.__zqInline = {\n${entries.join(',\n')}\n};\n\n`;
    console.log(`\n  Inlined ${Object.keys(inlineMap).length} external resource(s)`);
  }

  const bundle = `${banner}\n(function() {\n  'use strict';\n\n${libSection}${inlineSection}${sections.join('\n\n')}\n\n})();\n`;

  // Content-hashed filenames
  const contentHash = crypto.createHash('sha256').update(bundle).digest('hex').slice(0, 8);
  const minBase = `z-${entryName}.${contentHash}.min.js`;

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

  // Write minified bundle
  const minFile = path.join(serverDir, minBase);
  fs.writeFileSync(minFile, minify(bundle, banner), 'utf-8');
  fs.copyFileSync(minFile, path.join(localDir, minBase));

  console.log(`\n  ✓ ${minBase} (${sizeKB(fs.readFileSync(minFile))} KB)`);

  // ------------------------------------------------------------------
  // Global CSS bundling - extract from index.html <link> or --global-css
  // ------------------------------------------------------------------
  let globalCssHash = null;
  let globalCssOrigHref = null;
  let globalCssPath = null;
  if (htmlAbs) {
    const htmlContent = fs.readFileSync(htmlAbs, 'utf-8');
    const htmlDir = path.dirname(htmlAbs);

    // Determine global CSS path: --global-css flag overrides, else first <link rel="stylesheet"> in HTML
    globalCssPath = null;
    if (globalCssOverride) {
      globalCssPath = path.resolve(projectRoot, globalCssOverride);
      // Reconstruct relative href for HTML rewriting
      globalCssOrigHref = path.relative(htmlDir, globalCssPath).replace(/\\/g, '/');
    } else {
      const linkRe = /<link[^>]+rel\s*=\s*["']stylesheet["'][^>]+href\s*=\s*["']([^"']+)["']/gi;
      const altRe  = /<link[^>]+href\s*=\s*["']([^"']+)["'][^>]+rel\s*=\s*["']stylesheet["']/gi;
      let linkMatch = linkRe.exec(htmlContent) || altRe.exec(htmlContent);
      if (linkMatch) {
        globalCssOrigHref = linkMatch[1];
        // Strip query string / fragment so the path resolves to the actual file
        const cleanHref = linkMatch[1].split('?')[0].split('#')[0];
        globalCssPath = path.resolve(htmlDir, cleanHref);
      }
    }

    if (globalCssPath && fs.existsSync(globalCssPath)) {
      let cssContent = fs.readFileSync(globalCssPath, 'utf-8');
      const cssMin = minifyCSS(cssContent);
      const cssHash = crypto.createHash('sha256').update(cssMin).digest('hex').slice(0, 8);
      const cssOutName = `global.${cssHash}.min.css`;

      // Clean previous global CSS builds
      const cssCleanRe = /^global\.[a-f0-9]{8}\.min\.css$/;
      for (const dir of [serverDir, localDir]) {
        if (fs.existsSync(dir)) {
          for (const f of fs.readdirSync(dir)) {
            if (cssCleanRe.test(f)) fs.unlinkSync(path.join(dir, f));
          }
        }
      }

      fs.writeFileSync(path.join(serverDir, cssOutName), cssMin, 'utf-8');
      fs.writeFileSync(path.join(localDir, cssOutName), cssMin, 'utf-8');
      globalCssHash = cssOutName;
      console.log(`  ✓ ${cssOutName} (${sizeKB(Buffer.from(cssMin))} KB)`);
    }
  }

  // Rewrite HTML to reference the minified bundle
  const bundledFileSet = new Set(files);
  // Skip the original unminified global CSS from static asset copying
  if (globalCssPath) bundledFileSet.add(path.resolve(globalCssPath));
  if (htmlFile) {
    rewriteHtml(projectRoot, htmlFile, minFile, true, bundledFileSet, serverDir, localDir, globalCssOrigHref, globalCssHash);
  }

  // Copy static asset directories (icons/, images/, fonts/, etc.)
  if (!minimal) {
    const appRoot = htmlAbs ? path.dirname(htmlAbs) : (targetDir || projectRoot);
    copyStaticAssets(appRoot, serverDir, localDir, bundledFileSet);
  }

  const elapsed = Date.now() - start;
  console.log(`  Done in ${elapsed}ms\n`);
}

module.exports = bundleApp;
