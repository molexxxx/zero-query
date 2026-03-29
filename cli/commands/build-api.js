/**
 * cli/commands/build-api.js - auto-generate API.md from docs section data
 *
 * Reads the structured docs sections (zquery-website/app/components/docs/sections),
 * converts their HTML content to clean Markdown, and writes API.md.
 *
 * Usage: node cli/commands/build-api.js
 *        npm run build:api
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

// Sections to include in API.md and their order.
// Maps section ID → { file, export } for direct import (avoids pulling in
// getting-started.js which depends on the website store / globalThis.$).
const API_SECTIONS = [
  { id: 'router',         file: 'router.js',         exportName: 'routerSec'    },
  { id: 'components',     file: 'components.js',      exportName: 'components'   },
  { id: 'directives',     file: 'directives.js',      exportName: 'directives'   },
  { id: 'store',          file: 'store.js',            exportName: 'storeSec'     },
  { id: 'http',           file: 'http.js',             exportName: 'http'         },
  { id: 'reactive',       file: 'reactive.js',         exportName: 'reactive'     },
  { id: 'selectors',      file: 'selectors.js',        exportName: 'selectors'    },
  { id: 'utils',          file: 'utils.js',            exportName: 'utils'        },
  { id: 'error-handling', file: 'error-handling.js',   exportName: 'errorHandling'},
  { id: 'ssr',            file: 'ssr.js',              exportName: 'ssr'          },
  { id: 'security',       file: 'security.js',         exportName: 'security'     },
];


// ---------------------------------------------------------------------------
// HTML entity decoding
// ---------------------------------------------------------------------------

function unesc(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '\u2014')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&rarr;/g, '\u2192')
    .replace(/&larr;/g, '\u2190')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ensp;/g, ' ')
    .replace(/&emsp;/g, ' ')
    .replace(/&hellip;/g, '\u2026')
    .replace(/&times;/g, '\u00D7')
    .replace(/&copy;/g, '\u00A9')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rdquo;/g, '\u201D')
    .replace(/&ldquo;/g, '\u201C')
    .replace(/&bull;/g, '\u2022')
    .replace(/&middot;/g, '\u00B7')
    .replace(/&trade;/g, '\u2122')
    .replace(/&rsaquo;/g, '\u203A')
    .replace(/&lsaquo;/g, '\u2039')
    .replace(/&harr;/g, '\u2194')
    .replace(/&apos;/g, "'")
    .replace(/&hairsp;/g, '\u200A')
    .replace(/&thinsp;/g, '\u2009')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}


// ---------------------------------------------------------------------------
// Inline HTML → Markdown
// ---------------------------------------------------------------------------

/**
 * Convert inline HTML elements to their Markdown equivalents.
 * Handles: code, strong/b, em/i, a, br, spans (dots, badges, etc.)
 */
function inlineMd(html) {
  if (!html) return '';
  let md = html;

  // Strip decorative dots (colored circles in table cells)
  md = md.replace(/<span class="docs-dot"[^>]*><\/span>\s*/g, '');
  md = md.replace(/<span class="docs-legend-dot"[^>]*><\/span>\s*/g, '');
  md = md.replace(/<span class="docs-legend-item">[\s\S]*?<\/span>/g, '');

  // ZQueryCollection SVG badge → backtick text
  md = md.replace(/<span class="zq-badge">[\s\S]*?<\/span>/g, '`ZQueryCollection`');

  // Status badges (colored pills) → plain text
  md = md.replace(/<span\s+style="[^"]*background:[^"]*"[^>]*>([\s\S]*?)<\/span>/g, '$1');

  // Convert <a> links (before code, since links can wrap code elements)
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, '[$2]($1)');

  // Convert <code> (both inline and zq-inline variants)
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/g, (_, c) => '`' + unesc(c) + '`');

  // Convert <strong>/<b>
  md = md.replace(/<(?:strong|b)>([\s\S]*?)<\/(?:strong|b)>/g, '**$1**');

  // Convert <em>/<i>
  md = md.replace(/<(?:em|i)>([\s\S]*?)<\/(?:em|i)>/g, '*$1*');

  // Convert <br>
  md = md.replace(/<br\s*\/?>/g, '\n');

  // Strip remaining <span> (keep content)
  md = md.replace(/<span[^>]*>([\s\S]*?)<\/span>/g, '$1');

  return md;
}


// ---------------------------------------------------------------------------
// HTML table → Markdown table
// ---------------------------------------------------------------------------

function convertTable(tableHtml) {
  let html = tableHtml;

  // Strip legend rows (decorative colored-dot rows)
  html = html.replace(/<tr class="docs-table-legend-row">[\s\S]*?<\/tr>/g, '');

  const headers = [];
  const rows = [];

  // --- Extract header cells from <thead> ---
  const theadMatch = html.match(/<thead>([\s\S]*?)<\/thead>/);
  if (theadMatch) {
    const thRe = /<th[^>]*>([\s\S]*?)<\/th>/g;
    let m;
    while ((m = thRe.exec(theadMatch[1])) !== null) {
      headers.push(unesc(inlineMd(m[1])).trim());
    }
  }

  // --- Extract body rows from <tbody> ---
  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
  if (tbodyMatch) {
    const trRe = /<tr>([\s\S]*?)<\/tr>/g;
    let m;
    while ((m = trRe.exec(tbodyMatch[1])) !== null) {
      const cells = [];
      const tdRe = /<td>([\s\S]*?)<\/td>/g;
      let td;
      while ((td = tdRe.exec(m[1])) !== null) {
        let cell = unesc(inlineMd(td[1])).trim();
        cell = cell.replace(/\n+/g, ' ');    // flatten to single line
        cell = cell.replace(/\|/g, '\\|');   // escape pipe chars
        cells.push(cell);
      }
      rows.push(cells);
    }
  }

  if (!headers.length && !rows.length) return '';

  const colCount = Math.max(headers.length, rows[0]?.length || 0);

  // Pad short rows
  while (headers.length < colCount) headers.push('');
  rows.forEach(r => { while (r.length < colCount) r.push(''); });

  const lines = [];
  lines.push('| ' + headers.join(' | ') + ' |');
  lines.push('| ' + headers.map(() => '---').join(' | ') + ' |');
  rows.forEach(r => lines.push('| ' + r.join(' | ') + ' |'));

  return '\n' + lines.join('\n') + '\n';
}


// ---------------------------------------------------------------------------
// Full section HTML → Markdown
// ---------------------------------------------------------------------------

function htmlToMarkdown(html) {
  let md = html;

  // ---- Pass 1: Extract code blocks → placeholders ----
  // Matches: optional code-header div, then <pre z-skip><code class="language-xxx">...</code></pre>
  const codeBlocks = [];
  md = md.replace(
    /(?:<div class="code-header">[\s\S]*?<\/div>\s*)?<pre[^>]*>\s*<code class="language-(\w+)">([\s\S]*?)<\/code>\s*<\/pre>/g,
    (_, lang, src) => {
      const idx = codeBlocks.length;
      codeBlocks.push({ lang, src: unesc(src).trim() });
      return `\n__CODEBLOCK_${idx}__\n`;
    }
  );

  // ---- Pass 2: Convert tables ----
  md = md.replace(
    /<div class="docs-table-wrap">\s*<table[^>]*>([\s\S]*?)<\/table>\s*<\/div>/g,
    (_, content) => convertTable(content)
  );

  // ---- Pass 3: Convert callouts, tips, warnings ----
  md = md.replace(/<div class="docs-callout"[^>]*>([\s\S]*?)<\/div>/g, (_, c) => {
    const text = unesc(inlineMd(c)).trim();
    const lines = text.split('\n').map(l => '> ' + l);
    return '\n' + lines.join('\n') + '\n';
  });
  md = md.replace(/<div class="docs-tip">([\s\S]*?)<\/div>/g, (_, c) => {
    return '\n> **Tip:** ' + unesc(inlineMd(c)).trim() + '\n';
  });
  md = md.replace(/<div class="docs-warning">([\s\S]*?)<\/div>/g, (_, c) => {
    return '\n> **Warning:** ' + unesc(inlineMd(c)).trim() + '\n';
  });

  // ---- Pass 4: Strip legend bars & file trees ----
  md = md.replace(/<div class="docs-legend-bar">[\s\S]*?<\/div>/g, '');
  // File trees (only in non-API sections, but strip just in case)
  md = md.replace(/<div class="file-tree">[\s\S]*?<\/div>(?:\s*<\/div>)*/g, '');

  // ---- Pass 5: Convert headings ----
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/g, (_, c) => '\n## ' + unesc(inlineMd(c)).trim() + '\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/g, (_, c) => '\n### ' + unesc(inlineMd(c)).trim() + '\n');
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/g, (_, c) => '\n#### ' + unesc(inlineMd(c)).trim() + '\n');

  // ---- Pass 6: Convert lists ----
  md = md.replace(/<ul>([\s\S]*?)<\/ul>/g, (_, content) => {
    let result = '\n';
    const liRe = /<li>([\s\S]*?)<\/li>/g;
    let li;
    while ((li = liRe.exec(content)) !== null) {
      result += '- ' + unesc(inlineMd(li[1])).trim() + '\n';
    }
    return result;
  });
  md = md.replace(/<ol>([\s\S]*?)<\/ol>/g, (_, content) => {
    let result = '\n';
    let i = 1;
    const liRe = /<li>([\s\S]*?)<\/li>/g;
    let li;
    while ((li = liRe.exec(content)) !== null) {
      result += `${i++}. ` + unesc(inlineMd(li[1])).trim() + '\n';
    }
    return result;
  });

  // ---- Pass 7: Convert paragraphs ----
  md = md.replace(/<p>([\s\S]*?)<\/p>/g, (_, c) => '\n' + unesc(inlineMd(c)).trim() + '\n');

  // ---- Pass 8: Convert <hr> ----
  md = md.replace(/<hr\s*\/?>/g, '\n---\n');

  // ---- Pass 9: Remaining inline conversion ----
  md = inlineMd(md);

  // ---- Pass 10: Strip remaining HTML tags ----
  md = md.replace(/<[^>]+>/g, '');

  // ---- Pass 11: Decode remaining entities ----
  md = unesc(md);

  // ---- Pass 12: Clean up whitespace ----
  md = md.replace(/\n{3,}/g, '\n\n');
  md = md.trim();

  // ---- Pass 13: Restore code blocks ----
  codeBlocks.forEach((block, i) => {
    md = md.replace(
      `__CODEBLOCK_${i}__`,
      '\n```' + block.lang + '\n' + block.src + '\n```\n'
    );
  });

  // Final whitespace cleanup
  md = md.replace(/\n{3,}/g, '\n\n');

  return md;
}


// ---------------------------------------------------------------------------
// TOC builder
// ---------------------------------------------------------------------------

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/\$/g, '')
    .replace(/\(\)/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildToc(sections) {
  const lines = [];
  for (const section of sections) {
    // Get the section title from the first <h2> in content
    const html = section.content();
    const h2Match = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
    const title = h2Match ? unesc(inlineMd(h2Match[1])).trim() : section.label;
    lines.push(`- [${title}](#${slugify(title)})`);
    for (const h of section.headings) {
      const hText = unesc(h.text);
      lines.push(`  - [${hText}](#${slugify(hText)})`);
    }
  }
  return lines.join('\n');
}


// ---------------------------------------------------------------------------
// ES Module Exports section (generated from index.js)
// ---------------------------------------------------------------------------

function buildEsmSection(root) {
  const indexSrc = fs.readFileSync(path.join(root, 'index.js'), 'utf-8');

  // Extract the export block
  const exportMatch = indexSrc.match(/export\s*\{([\s\S]*?)\}/);
  if (!exportMatch) return '';

  const exports = exportMatch[1]
    .split(',')
    .map(e => e.trim())
    .filter(Boolean)
    .map(e => {
      const parts = e.split(/\s+as\s+/);
      return parts.length > 1
        ? { name: parts[1].trim(), alias: parts[0].trim() }
        : { name: parts[0].trim() };
    });

  const importNames = exports.map(e => {
    return e.alias ? `${e.alias} as ${e.name}` : e.name;
  });

  return [
    '## ES Module Exports (for npm/bundler usage)',
    '',
    'When used as an ES module (not the built bundle), the library provides named exports for every public API:',
    '',
    '```js',
    'import {',
    '  ' + importNames.join(',\n  '),
    "} from 'zero-query';",
    '```',
    '',
    '> The SSR module has its own entry point: `import { createSSRApp, renderToString } from \'zero-query/ssr\';`',
  ].join('\n');
}


// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function buildApi() {
  const root = process.cwd();
  const pkg  = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));

  console.log('\n  zQuery API.md Generator\n');

  // Import sections individually (ESM dynamic import)
  // We avoid importing sections/index.js because it pulls in getting-started.js
  // which depends on the website store ($.libSize).
  const sectionsDir = path.join(root, 'zquery-website', 'app', 'components', 'docs', 'sections');

  const apiSections = [];
  for (const entry of API_SECTIONS) {
    const fileUrl = pathToFileURL(path.join(sectionsDir, entry.file)).href;
    const mod = await import(fileUrl);
    const section = mod[entry.exportName];
    if (section) {
      apiSections.push(section);
    } else {
      console.warn(`  ⚠ Section "${entry.id}" not found in ${entry.file} (export: ${entry.exportName})`);
    }
  }

  console.log(`  Processing ${apiSections.length} sections...`);

  // --- Header ---
  const header = [
    '# zQuery (zeroQuery) - Full API Reference',
    '',
    'Complete API documentation for every module, method, option, and type in zQuery. All examples assume the global `$` is available via the built `zquery.min.js` bundle. For getting started, project setup, the dev server, and the CLI bundler, see [README.md](README.md).',
    '',
    '> **Editor Support:** Install the [zQuery for VS Code](https://marketplace.visualstudio.com/items?itemName=zQuery.zquery-vs-code) extension for autocomplete, hover docs, directive support, and 185+ code snippets.',
    '',
    '---',
  ].join('\n');

  // --- Table of Contents ---
  const toc = buildToc(apiSections);

  // --- Convert each section ---
  const sectionMds = apiSections.map(s => htmlToMarkdown(s.content()));

  // --- ES Module Exports ---
  const esm = buildEsmSection(root);

  // --- Assemble ---
  const parts = [header, '', '## Table of Contents', '', toc, '', '---'];

  for (const md of sectionMds) {
    parts.push('');
    parts.push(md);
    parts.push('');
    parts.push('---');
  }

  parts.push('');
  parts.push(esm);

  let output = parts.join('\n');
  output = output.replace(/\n{4,}/g, '\n\n\n');
  output = output.replace(/\n+$/, '\n');

  // --- Write ---
  const outPath = path.join(root, 'API.md');
  fs.writeFileSync(outPath, output, 'utf-8');

  const lines = output.split('\n').length;
  const kb    = Math.round(Buffer.from(output).byteLength / 1024);
  console.log(`  \u2713 API.md generated (${lines} lines, ${kb} KB)`);
  console.log();
}


// Allow both require() (from CLI) and direct execution
if (require.main === module) {
  buildApi().catch(err => {
    console.error('  \u2717 Failed to generate API.md:', err.message);
    console.error(err.stack);
    process.exit(1);
  });
}

module.exports = buildApi;
