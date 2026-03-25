/**
 * cli/commands/build.js - library build command
 *
 * Concatenates the zQuery source modules into dist/zquery.js and
 * dist/zquery.min.js.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execSync } = require('child_process');
const { minify, sizeKB } = require('../utils');

function buildLibrary() {
  const pkg     = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
  const VERSION = pkg.version;

  const modules = [
    'src/errors.js',
    'src/reactive.js', 'src/diff.js', 'src/core.js', 'src/expression.js',
    'src/component.js', 'src/router.js', 'src/store.js', 'src/http.js',
    'src/utils.js',
  ];

  const DIST     = path.join(process.cwd(), 'dist');
  const OUT_FILE = path.join(DIST, 'zquery.js');
  const MIN_FILE = path.join(DIST, 'zquery.min.js');

  const start = Date.now();
  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });

  // -----------------------------------------------------------------------
  // Run unit tests and capture results for $.unitTests
  // -----------------------------------------------------------------------
  let testResults = { passed: 0, failed: 0, total: 0, suites: 0, duration: 0, ok: false };
  try {
    const json = execSync('npx vitest run --reporter=json', {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120000,
    });
    // vitest --reporter=json outputs JSON to stdout; may include non-JSON lines
    const jsonStart = json.indexOf('{');
    if (jsonStart !== -1) {
      const parsed = JSON.parse(json.slice(jsonStart));
      const passed  = parsed.numPassedTests  || 0;
      const failed  = parsed.numFailedTests  || 0;
      const total   = parsed.numTotalTests   || 0;
      const suites  = parsed.numTotalTestSuites || 0;
      const dur     = Math.round((parsed.testResults || []).reduce((s, r) => s + (r.endTime - r.startTime), 0));
      testResults = { passed, failed, total, suites, duration: dur, ok: parsed.success !== false };
    }
    console.log(`  ✓ Tests: ${testResults.passed}/${testResults.total} passed (${testResults.suites} suites)\n`);
  } catch (err) {
    // Tests may fail but we still want to capture the numbers
    const out = (err.stdout || '') + (err.stderr || '');
    const jsonStart = out.indexOf('{');
    if (jsonStart !== -1) {
      try {
        const parsed = JSON.parse(out.slice(jsonStart));
        testResults = {
          passed:   parsed.numPassedTests  || 0,
          failed:   parsed.numFailedTests  || 0,
          total:    parsed.numTotalTests   || 0,
          suites:   parsed.numTotalTestSuites || 0,
          duration: Math.round((parsed.testResults || []).reduce((s, r) => s + (r.endTime - r.startTime), 0)),
          ok:       false,
        };
      } catch (_) { /* keep defaults */ }
    }
    console.log(`  ⚠ Tests: ${testResults.passed}/${testResults.total} passed, ${testResults.failed} failed\n`);
  }

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
  const testObj = JSON.stringify(testResults);
  let outContent = fs.readFileSync(OUT_FILE, 'utf-8').replace("'__LIB_SIZE__'", `'${libSizeStr}'`);
  let minContent = minified.replace("'__LIB_SIZE__'", `'${libSizeStr}'`);
  outContent = outContent.replace("'__UNIT_TESTS__'", testObj);
  minContent = minContent.replace("'__UNIT_TESTS__'", testObj);
  fs.writeFileSync(OUT_FILE, outContent, 'utf-8');
  fs.writeFileSync(MIN_FILE, minContent, 'utf-8');

  const elapsed = Date.now() - start;
  console.log(`  ✓ dist/zquery.js (${sizeKB(fs.readFileSync(OUT_FILE))} KB)`);
  console.log(`  ✓ dist/zquery.min.js (${sizeKB(fs.readFileSync(MIN_FILE))} KB)`);
  console.log(`  Done in ${elapsed}ms\n`);

  // --- Create dist/zquery.dist.zip -----------------------------------------
  const root = process.cwd();
  const zipFiles = [
    { src: OUT_FILE,                        name: 'zquery.js' },
    { src: MIN_FILE,                        name: 'zquery.min.js' },
    { src: path.join(root, 'LICENSE'),      name: 'LICENSE' },
    { src: path.join(root, 'API.md'),       name: 'API.md' },
    { src: path.join(root, 'README.md'),    name: 'README.md' },
  ];

  // Minimal ZIP builder (deflate via zlib, no external deps)
  function buildZip(entries) {
    const localHeaders = [];
    const centralHeaders = [];
    let offset = 0;

    for (const { name, data } of entries) {
      const nameBytes = Buffer.from(name, 'utf-8');
      const compressed = zlib.deflateRawSync(data, { level: 9 });
      const crc = crc32(data);
      const compLen = compressed.length;
      const uncompLen = data.length;

      // Local file header
      const local = Buffer.alloc(30 + nameBytes.length);
      local.writeUInt32LE(0x04034b50, 0);   // signature
      local.writeUInt16LE(20, 4);            // version needed
      local.writeUInt16LE(0, 6);             // flags
      local.writeUInt16LE(8, 8);             // compression: deflate
      local.writeUInt16LE(0, 10);            // mod time
      local.writeUInt16LE(0, 12);            // mod date
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(compLen, 18);
      local.writeUInt32LE(uncompLen, 22);
      local.writeUInt16LE(nameBytes.length, 26);
      local.writeUInt16LE(0, 28);            // extra field length
      nameBytes.copy(local, 30);

      localHeaders.push(Buffer.concat([local, compressed]));

      // Central directory header
      const central = Buffer.alloc(46 + nameBytes.length);
      central.writeUInt32LE(0x02014b50, 0);
      central.writeUInt16LE(20, 4);          // version made by
      central.writeUInt16LE(20, 6);          // version needed
      central.writeUInt16LE(0, 8);           // flags
      central.writeUInt16LE(8, 10);          // compression: deflate
      central.writeUInt16LE(0, 12);          // mod time
      central.writeUInt16LE(0, 14);          // mod date
      central.writeUInt32LE(crc, 16);
      central.writeUInt32LE(compLen, 20);
      central.writeUInt32LE(uncompLen, 24);
      central.writeUInt16LE(nameBytes.length, 28);
      central.writeUInt16LE(0, 30);          // extra field length
      central.writeUInt16LE(0, 32);          // comment length
      central.writeUInt16LE(0, 34);          // disk number
      central.writeUInt16LE(0, 36);          // internal attrs
      central.writeUInt32LE(0, 38);          // external attrs
      central.writeUInt32LE(offset, 42);     // local header offset
      nameBytes.copy(central, 46);
      centralHeaders.push(central);

      offset += local.length + compressed.length;
    }

    const centralDir = Buffer.concat(centralHeaders);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);               // disk number
    eocd.writeUInt16LE(0, 6);               // central dir disk
    eocd.writeUInt16LE(entries.length, 8);   // entries on disk
    eocd.writeUInt16LE(entries.length, 10);  // total entries
    eocd.writeUInt32LE(centralDir.length, 12);
    eocd.writeUInt32LE(offset, 16);          // central dir offset
    eocd.writeUInt16LE(0, 20);              // comment length

    return Buffer.concat([...localHeaders, centralDir, eocd]);
  }

  function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
      }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  const entries = zipFiles
    .filter(f => fs.existsSync(f.src))
    .map(f => ({ name: f.name, data: fs.readFileSync(f.src) }));

  const zipBuf = buildZip(entries);
  const zipPath = path.join(DIST, 'zquery.dist.zip');
  fs.writeFileSync(zipPath, zipBuf);
  console.log(`  ✓ dist/zquery.dist.zip (${sizeKB(zipBuf)} KB) - ${entries.length} files`);

  return { DIST, OUT_FILE, MIN_FILE };
}

module.exports = buildLibrary;
