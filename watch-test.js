// watch.js - Watch src/ and examples/starter-app/ for changes, rebuild and reload browser
const { spawn } = require('child_process');
const path = require('path');
const chokidar = require('chokidar');
const WebSocket = require('ws');
const fs = require('fs');

const BUILD_CMD = 'node build.js';
const SERVER_CMD = 'node examples/starter-app/local-server.js';
const WATCH_PATHS = [
  path.join(__dirname, 'src'),
  path.join(__dirname, 'examples', 'starter-app'),
];

let serverProcess = null;
let wss = null;

function startServer() {
  if (serverProcess) serverProcess.kill();
  serverProcess = spawn('node', ['examples/starter-app/local-server.js'], {
    stdio: 'inherit',
    cwd: __dirname,
    env: process.env,
  });
}

function build() {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', ['build.js'], { stdio: 'inherit', cwd: __dirname });
    proc.on('exit', code => (code === 0 ? resolve() : reject(code)));
  });
}

function setupWebSocketServer() {
  if (wss) wss.close();
  wss = new WebSocket.Server({ port: 35729 });
  wss.on('connection', ws => {
    ws.on('message', msg => {
      if (msg === 'ping') ws.send('pong');
    });
  });
}

function broadcastReload() {
  if (!wss) return;
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send('reload');
    }
  });
}

async function main() {
  await build();
  startServer();
  setupWebSocketServer();

  const watcher = chokidar.watch(WATCH_PATHS, {
    ignored: /dist|node_modules|\.git/,
    ignoreInitial: true,
    persistent: true,
  });

  watcher.on('all', async (event, filePath) => {
    if (/\.js$|\.css$|\.html$/.test(filePath)) {
      console.log(`[watch] ${event}: ${filePath}`);
      try {
        await build();
        broadcastReload();
      } catch (e) {
        console.error('[watch] Build failed:', e);
      }
    }
  });

  process.on('SIGINT', () => {
    watcher.close();
    if (serverProcess) serverProcess.kill();
    if (wss) wss.close();
    process.exit();
  });
}

main();
