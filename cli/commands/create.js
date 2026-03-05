// cli/commands/create.js — scaffold a new zQuery project
// Reads template files from cli/scaffold/, replaces {{NAME}} with the project
// name, and writes them into the target directory.

const fs   = require('fs');
const path = require('path');

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
  const target = args[1] ? path.resolve(args[1]) : process.cwd();
  const name   = path.basename(target);

  // Guard: refuse to overwrite existing files
  const conflicts = ['index.html', 'scripts'].filter(f =>
    fs.existsSync(path.join(target, f))
  );
  if (conflicts.length) {
    console.error(`\n  \u2717 Directory already contains: ${conflicts.join(', ')}`);
    console.error(`  Aborting to avoid overwriting existing files.\n`);
    process.exit(1);
  }

  console.log(`\n  zQuery \u2014 Create Project\n`);
  console.log(`  Scaffolding into ${target}\n`);

  // Resolve the scaffold template directory
  const scaffoldDir = path.resolve(__dirname, '..', 'scaffold');

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
    console.log(`  \u2713 ${rel}`);
  }

  console.log(`
  Done! Next steps:

    npx zquery dev${target !== process.cwd() ? ` ${args[1]}` : ''}
`);
}

module.exports = createProject;
