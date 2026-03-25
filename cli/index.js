#!/usr/bin/env node

/**
 * zQuery CLI - entry point
 *
 * Dispatches to the appropriate command module under cli/commands/.
 * Run `zquery --help` for full usage information.
 */

const { join }  = require('path');
const { watch } = require('fs');

const { args, flag } = require('./args');
const buildLibrary   = require('./commands/build');
const bundleApp      = require('./commands/bundle');
const devServer      = require('./commands/dev');
const createProject  = require('./commands/create');
const showHelp       = require('./help');

const command = args[0];

if (!command || command === '--help' || command === '-h' || command === 'help') {
  showHelp();
} else if (command === 'create') {
  createProject(args);
} else if (command === 'build') {
  console.log('\n  zQuery Library Build\n');
  buildLibrary();

  if (flag('watch', 'w')) {
    console.log('  Watching src/ for changes...\n');
    const srcDir = join(process.cwd(), 'src');
    let debounce;

    function rebuild() {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        console.log('  Rebuilding...\n');
        try { buildLibrary(); } catch (e) { console.error(e.message); }
      }, 200);
    }

    watch(srcDir, { recursive: true }, rebuild);
    watch(join(process.cwd(), 'index.js'), rebuild);
  }
} else if (command === 'bundle') {
  bundleApp();
} else if (command === 'dev') {
  devServer();
} else {
  console.error(`\n  Unknown command: ${command}\n  Run "zquery --help" for usage.\n`);
  process.exit(1);
}
