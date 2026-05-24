// cli/commands/create.js - scaffold a new zQuery project
//
// Templates live in cli/scaffold/<variant>/ (default, minimal, ssr, webrtc).
// Reads template files, replaces {{NAME}} with the project name,
// and writes them into the target directory.

const fs   = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
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

/**
 * Open the given URL in the user's default browser. Best-effort, silent on
 * failure (the server still prints the URL).
 */
function openBrowser(url) {
  const cmd = process.platform === 'win32' ? 'start ""'
            : process.platform === 'darwin' ? 'open' : 'xdg-open';
  try { execSync(`${cmd} ${url}`, { stdio: 'ignore' }); } catch { /* ignore */ }
}

/**
 * Spawn a long-running child process, wire SIGINT/SIGTERM to terminate it,
 * and exit when it does. Used by every scaffold variant to launch the dev /
 * SSR / signaling server right after install.
 */
function runAndExit(cmd, cmdArgs, cwd) {
  const child = spawn(cmd, cmdArgs, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  process.on('SIGINT',  () => { child.kill(); process.exit(); });
  process.on('SIGTERM', () => { child.kill(); process.exit(); });
  child.on('exit', (code) => process.exit(code || 0));
}

function createProject(args) {
  // First positional arg after "create" is the target dir (skip flags)
  const dirArg = args.slice(1).find(a => !a.startsWith('-'));
  const target = dirArg ? path.resolve(dirArg) : process.cwd();
  const name   = path.basename(target);

  // Determine scaffold variant: --minimal / -m  or  --ssr / -s  or --webrtc-demo / -w  or  default
  const variant = flag('minimal', 'm')      ? 'minimal'
                : flag('ssr', 's')          ? 'ssr'
                : flag('webrtc-demo', 'w')  ? 'webrtc'
                :                             'default';

  // Guard: refuse to overwrite existing files
  const checkFiles = ['index.html', 'global.css', 'app', 'assets', 'package.json'];
  if (variant === 'ssr' || variant === 'webrtc') checkFiles.push('server');
  const conflicts = checkFiles.filter(f =>
    fs.existsSync(path.join(target, f))
  );
  if (conflicts.length) {
    console.error(`\n  ✗ Directory already contains: ${conflicts.join(', ')}`);
    console.error(`  Aborting to avoid overwriting existing files.\n`);
    process.exit(1);
  }

  console.log(`\n  zQuery - Create Project (${variant})\n`);
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

  // Copy zquery.min.js from the package's pre-built dist into the project root
  // so file:// previews and the dev/SSR servers all serve the same minified
  // bundle that ships with the installed zero-query package. The dev server
  // also intercepts requests for "zquery.min.js" and will fall back to the
  // package copy if the file is missing, so this is a convenience for direct
  // file access (Open in Browser, etc.).
  const zqRoot = path.resolve(__dirname, '..', '..');
  {
    const zqMin = path.join(zqRoot, 'dist', 'zquery.min.js');
    if (fs.existsSync(zqMin)) {
      fs.copyFileSync(zqMin, path.join(target, 'zquery.min.js'));
      console.log(`  ✓ zquery.min.js`);
    }
  }

  // ---- Install dependencies (all variants ship a package.json) ----
  console.log(`\n  Installing dependencies...\n`);
  try {
    // Install zero-query from the same package that provides this CLI so
    // local-dev and published-npm both work. Any extra devDependencies in
    // the scaffold's package.json (e.g. @zero-server/* for webrtc) come in
    // on the follow-up plain `npm install`.
    execSync(`npm install "${zqRoot}"`, { cwd: target, stdio: 'inherit' });
    execSync(`npm install`,            { cwd: target, stdio: 'inherit' });
  } catch {
    console.error(`\n  ✗ npm install failed. Run it manually:\n\n    cd ${dirArg || '.'}\n    npm install\n    npm start\n`);
    process.exit(1);
  }

  // Refresh zquery.min.js from the freshly installed package (preferred
  // over the pre-copied one above so post-install rebuilds win).
  {
    const zqMin = path.join(target, 'node_modules', 'zero-query', 'dist', 'zquery.min.js');
    if (fs.existsSync(zqMin)) {
      fs.copyFileSync(zqMin, path.join(target, 'zquery.min.js'));
    }
  }

  // ---- Launch the right server for the variant ----
  if (variant === 'ssr') {
    console.log(`\n  Starting SSR server on http://localhost:3000 ...\n`);
    setTimeout(() => openBrowser('http://localhost:3000'), 500);
    runAndExit('node', ['server/index.js'], target);
    return;
  }

  if (variant === 'webrtc') {
    console.log(`
  Camera, microphone, and screen-share are OFF by default - users opt in
  from inside the room. Optional env vars:
    - WEBRTC_JWT_SECRET  enforce signed join tokens
    - TURN_SECRET + TURN_URLS  issue time-limited TURN credentials

  Starting WebRTC signaling + static server on http://localhost:3000 ...
`);
    setTimeout(() => openBrowser('http://localhost:3000'), 500);
    runAndExit('node', ['server/index.js'], target);
    return;
  }

  // default / minimal: invoke the local zquery CLI's dev command. We point
  // it at this same package's CLI entry so it works regardless of whether
  // node_modules/.bin/zquery resolved a shim correctly (Windows .cmd quirks
  // and all).
  console.log(`\n  Starting dev server on http://localhost:3100 ...\n`);
  setTimeout(() => openBrowser('http://localhost:3100'), 800);
  const cliEntry = path.resolve(__dirname, '..', 'index.js');
  runAndExit('node', [cliEntry, 'dev', target], target);
}

module.exports = createProject;
