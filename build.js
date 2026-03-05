/**
 * zQuery Build Script
 *
 * Thin wrapper around cli/commands/build.js with --watch support.
 *
 * Usage:
 *   node build.js            -> builds dist/zquery.js & dist/zquery.min.js
 *   node build.js --watch    -> watches src/ and rebuilds on changes
 */

const { join } = require('path');
const { watch } = require('fs');
const buildLibrary = require('./cli/commands/build');

console.log('\n  zQuery Library Build\n');
buildLibrary();

if (process.argv.includes('--watch')) {
  console.log('  Watching src/ for changes...\n');
  const srcDir = join(__dirname, 'src');
  let debounce;

  function rebuild() {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      console.log('  Rebuilding...\n');
      try { buildLibrary(); } catch (e) { console.error(e.message); }
    }, 200);
  }

  watch(srcDir, { recursive: true }, rebuild);
  watch(join(__dirname, 'index.js'), rebuild);
}
