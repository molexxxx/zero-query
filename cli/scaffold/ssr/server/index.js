// server/index.js — SSR HTTP server
//
// Renders routes to HTML with zQuery SSR and serves them over HTTP.
// Components are imported from app/components/ — the same definitions
// the client uses.
//
// Usage:
//   node server/index.js
//   PORT=8080 node server/index.js

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSSRApp } from 'zero-query/ssr';

// Shared component definitions — same ones the client registers
import { homePage }  from '../app/components/home.js';
import { aboutPage } from '../app/components/about.js';
import { notFound }  from '../app/components/not-found.js';
import { routes }    from '../app/routes.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const PORT = parseInt(process.env.PORT || '3000', 10);

// --- SSR app ----------------------------------------------------------------

const app = createSSRApp();
app.component('home-page',  homePage);
app.component('about-page', aboutPage);
app.component('not-found',  notFound);

// --- Route matching ---------------------------------------------------------

function matchRoute(pathname) {
  const route = routes.find(r => r.path === pathname);
  return route ? route.component : 'not-found';
}

// --- Render a full HTML page ------------------------------------------------

async function render(pathname) {
  const component = matchRoute(pathname);
  const body = await app.renderToString(component);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{NAME}}</title>
  <link rel="stylesheet" href="/global.css">
</head>
<body>
  <nav class="navbar">
    <span class="brand">⚡ {{NAME}}</span>
    <div class="nav-links">
${routes.map(r =>
  `      <a href="${r.path}" class="nav-link${r.path === pathname ? ' active' : ''}">${
    r.path === '/' ? 'Home' : r.path.slice(1)[0].toUpperCase() + r.path.slice(2)
  }</a>`).join('\n')}
    </div>
  </nav>
  <main id="app">${body}</main>
  <footer class="footer"><small>Built with zQuery · SSR</small></footer>
</body>
</html>`;
}

// --- Static files -----------------------------------------------------------

const MIME = {
  '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

async function serveStatic(res, pathname) {
  const ext = extname(pathname);
  if (!MIME[ext]) return false;

  const filePath = join(ROOT, pathname);
  if (!resolve(filePath).startsWith(resolve(ROOT))) return false;

  try {
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] });
    res.end(data);
    return true;
  } catch { return false; }
}

// --- HTTP server ------------------------------------------------------------

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);

  // Static assets (CSS, images, etc.)
  if (pathname !== '/' && await serveStatic(res, pathname)) return;

  // SSR route
  try {
    const html = await render(pathname);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch (err) {
    console.error('SSR error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
    }
    res.end('Internal Server Error');
  }
}).listen(PORT, () => {
  console.log(`\n  ⚡ SSR server → http://localhost:${PORT}\n`);
  routes.forEach(r => console.log(`    ${r.path.padEnd(10)} → ${r.component}`));
  console.log(`    *         → not-found\n`);
});
