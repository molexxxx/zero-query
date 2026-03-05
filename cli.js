#!/usr/bin/env node

/**
 * zQuery CLI - thin entry point
 *
 * Dispatches to the appropriate command module under cli/commands/.
 * Run `zquery --help` for full usage information.
 */

const { args }       = require('./cli/args');
const buildLibrary   = require('./cli/commands/build');
const bundleApp      = require('./cli/commands/bundle');
const devServer      = require('./cli/commands/dev');
const createProject  = require('./cli/commands/create');
const showHelp       = require('./cli/help');

const command = args[0];

if (!command || command === '--help' || command === '-h' || command === 'help') {
  showHelp();
} else if (command === 'create') {
  createProject(args);
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
