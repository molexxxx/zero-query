// cli/commands/create.js — scaffold a new zQuery project
//
// Templates live in cli/scaffold/<variant>/ (default or minimal).
// Reads template files, replaces {{NAME}} with the project name,
// and writes them into the target directory.

const fs   = require('fs');
const path = require('path');
const { flag } = require('../args');

/**
 * Recursively collect every file under `dir`, returning paths relative to `dir`.
 */
function walkDir(dir, prefix = '') {
  const entries = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      entries.push(...walkDir(path.join(dir, entry.name), rel));
    } else {
      entries.push(rel);
    }
  }
  return entries;
}

function createProject(args) {
  // First positional arg after "create" is the target dir (skip flags)
  const dirArg = args.slice(1).find(a => !a.startsWith('-'));
  const target = dirArg ? path.resolve(dirArg) : process.cwd();
  const name   = path.basename(target);

  // Determine scaffold variant: --minimal / -m  or  default
  const variant = flag('minimal', 'm') ? 'minimal' : 'default';

  // Guard: refuse to overwrite existing files
  const conflicts = ['index.html', 'global.css', 'app', 'assets'].filter(f =>
    fs.existsSync(path.join(target, f))
  );
  if (conflicts.length) {
    console.error(`\n  ✗ Directory already contains: ${conflicts.join(', ')}`);
    console.error(`  Aborting to avoid overwriting existing files.\n`);
    process.exit(1);
  }

  console.log(`\n  zQuery — Create Project (${variant})\n`);
  console.log(`  Scaffolding into ${target}\n`);

  // Resolve the scaffold template directory for the chosen variant
  const scaffoldDir = path.resolve(__dirname, '..', 'scaffold', variant);

  if (!fs.existsSync(scaffoldDir)) {
    console.error(`\n  ✗ Scaffold variant "${variant}" not found.\n`);
    process.exit(1);
  }

  // Walk the scaffold directory and copy each file
  const templateFiles = walkDir(scaffoldDir);

  for (const rel of templateFiles) {
    const src = path.join(scaffoldDir, rel);
    let content = fs.readFileSync(src, 'utf-8');

    // Replace the {{NAME}} placeholder with the actual project name
    content = content.replace(/\{\{NAME\}\}/g, name);

    const dest = path.join(target, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content, 'utf-8');
    console.log(`  ✓ ${rel}`);
  }

  console.log(`
  Done! Next steps:

    npx zquery dev${target !== process.cwd() ? ` ${dirArg}` : ''}
`);
}

module.exports = createProject;
