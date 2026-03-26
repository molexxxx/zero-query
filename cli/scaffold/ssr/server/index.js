// server/index.js - SSR HTTP server
//
// Renders routes to HTML with zQuery SSR and serves them over HTTP.
// Components are imported from app/components/ - the same definitions
// the client uses.
//
// Usage:
//   node server/index.js
//   PORT=8080 node server/index.js

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSSRApp, matchRoute } from 'zero-query/ssr';

// Shared component definitions - same ones the client registers
import { homePage }  from '../app/components/home.js';
import { aboutPage } from '../app/components/about.js';
import { blogList }  from '../app/components/blog/index.js';
import { blogPost }  from '../app/components/blog/post.js';
import { notFound }  from '../app/components/not-found.js';
import { routes }    from '../app/routes.js';

// Server-side data — simulates a database or CMS
import { getAllPosts, getPostBySlug } from './data/posts.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const PORT = parseInt(process.env.PORT || '3000', 10);

// --- SSR app ----------------------------------------------------------------

const app = createSSRApp();
app.component('home-page',  homePage);
app.component('about-page', aboutPage);
app.component('blog-list',  blogList);
app.component('blog-post',  blogPost);
app.component('not-found',  notFound);

// --- Server-side data fetching ----------------------------------------------

/**
 * Fetch data for a matched route. This is where you'd query a database,
 * call an API, or read from the filesystem in a real application.
 * The returned object is passed as props to the component during SSR.
 */
function getPropsForRoute(component, params) {
  switch (component) {
    case 'blog-list':
      return { posts: getAllPosts() };
    case 'blog-post':
      return { post: getPostBySlug(params.slug) || null };
    default:
      return {};
  }
}

// --- SEO metadata per route -------------------------------------------------

/**
 * Return page-specific metadata for SEO, social sharing, and browser tabs.
 * The server injects these into the HTML shell's <head> before sending.
 *
 * In a real app you'd pull this from a CMS or database alongside the content.
 * Open Graph tags ensure rich link previews on social media.
 */
function getMetaForRoute(component, params, props) {
  const base = {
    title: '{{NAME}}',
    description: 'A zQuery SSR application.',
    ogType: 'website',
  };

  switch (component) {
    case 'home-page':
      return {
        ...base,
        title: '{{NAME}} — Home',
        description: 'A server-rendered application built with zQuery. Fast first paint, SEO-friendly, zero dependencies.',
      };

    case 'blog-list':
      return {
        ...base,
        title: 'Blog — {{NAME}}',
        description: 'Articles on server-side rendering, hydration, shared components, and modern web architecture.',
      };

    case 'blog-post': {
      const post = props.post;
      if (!post) return { ...base, title: 'Post Not Found — {{NAME}}' };
      return {
        ...base,
        title: `${post.title} — {{NAME}}`,
        description: post.summary,
        ogType: 'article',
      };
    }

    case 'about-page':
      return {
        ...base,
        title: 'About — {{NAME}}',
        description: 'Learn about zQuery — a zero-dependency frontend micro-library for reactive components, routing, SSR, and state management.',
      };

    default:
      return {
        ...base,
        title: 'Page Not Found — {{NAME}}',
        description: 'The page you\'re looking for doesn\'t exist.',
      };
  }
}

// --- Render a full HTML page ------------------------------------------------

// Read the index.html shell once at startup — it already has z-link nav,
// client scripts (zquery.min.js + app/app.js), and the <z-outlet> tag.
// On each request we render the matched component into the shell.
let shellCache = null;
async function getShell() {
  if (!shellCache) shellCache = await readFile(join(ROOT, 'index.html'), 'utf-8');
  return shellCache;
}

async function render(pathname) {
  const { component, params } = matchRoute(routes, pathname);
  const props = getPropsForRoute(component, params);
  const meta = getMetaForRoute(component, params, props);

  return app.renderShell(await getShell(), {
    component,
    props,
    title: meta.title,
    description: meta.description,
    og: {
      title: meta.title,
      description: meta.description,
      type: meta.ogType,
    },
    ssrData: { component, params, props, meta },
  });
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

  // --- JSON API for client-side navigation ----------------------------------
  // The client fetches data here when navigating via SPA (after initial SSR).
  // In a real app, these would query a database or external API.

  if (pathname === '/api/posts') {
    const json = JSON.stringify(getAllPosts());
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(json);
    return;
  }

  const postMatch = /^\/api\/posts\/([^/]+)$/.exec(pathname);
  if (postMatch) {
    const post = getPostBySlug(postMatch[1]) || null;
    res.writeHead(post ? 200 : 404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(post));
    return;
  }

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
