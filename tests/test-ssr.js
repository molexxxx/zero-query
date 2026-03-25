#!/usr/bin/env node
const { execSync, spawn } = require('child_process');
const { mkdtempSync, rmSync } = require('fs');
const { join } = require('path');
const os = require('os');

const root = join(__dirname, '..');
const tmp  = mkdtempSync(join(os.tmpdir(), 'zq-ssr-'));

console.log(`Scaffolding SSR app to ${tmp}\n`);
execSync(`node cli/index.js create "${tmp}" --ssr`, { cwd: root, stdio: 'inherit' });
console.log(`\nInstalling local zero-query...\n`);
execSync(`npm install "${root}"`, { cwd: tmp, stdio: 'inherit' });

console.log(`\nStarting SSR server...\n`);
const child = spawn('node', ['server/index.js'], { cwd: tmp, stdio: 'inherit' });

setTimeout(() => {
  const open = process.platform === 'win32' ? 'start'
             : process.platform === 'darwin' ? 'open' : 'xdg-open';
  try { execSync(`${open} http://localhost:3000`, { stdio: 'ignore' }); } catch {}
}, 500);

function cleanup() { try { rmSync(tmp, { recursive: true, force: true }); } catch {} }
process.on('SIGINT',  () => { child.kill(); cleanup(); process.exit(); });
process.on('SIGTERM', () => { child.kill(); cleanup(); process.exit(); });
child.on('exit', () => { cleanup(); process.exit(); });
