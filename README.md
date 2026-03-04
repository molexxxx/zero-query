<p align="center">
  <img src="docs/images/logo.svg" alt="zQuery logo" width="300" height="300">
</p>

<h1 align="center">zQuery</h1>

<p align="center">

[![npm version](https://img.shields.io/npm/v/zero-query.svg)](https://www.npmjs.com/package/zero-query)
[![npm downloads](https://img.shields.io/npm/dm/zero-query.svg)](https://www.npmjs.com/package/zero-query)
[![GitHub](https://img.shields.io/badge/GitHub-zero--query-blue.svg)](https://github.com/tonywied17/zero-query)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Dependencies](https://img.shields.io/badge/dependencies-0-success.svg)](package.json)
[![VS Code Extension](https://img.shields.io/visual-studio-marketplace/v/zQuery.zquery-vs-code?label=VS%20Code&logo=visualstudiocode&color=007acc)](https://marketplace.visualstudio.com/items?itemName=zQuery.zquery-vs-code)

</p>

> **Lightweight, zero-dependency frontend library that combines jQuery-style DOM manipulation with a modern reactive component system, SPA router, global state management, HTTP client, and utility toolkit — all in a single ~45 KB minified browser bundle. Works out of the box with ES modules — no build step required. An optional CLI bundler is available for single-file distribution.**

## Features

| Module | Highlights |
| --- | --- |
| **Core `$()`** | jQuery-like chainable selectors, traversal, DOM manipulation, events, animation |
| **Components** | Reactive state, template literals, `@event` delegation, `z-model` two-way binding, scoped styles, lifecycle hooks |
| **Router** | History & hash mode, route params (`:id`), guards, lazy loading, `z-link` navigation |
| **Store** | Reactive global state, named actions, computed getters, middleware, subscriptions |
| **HTTP** | Fetch wrapper with auto-JSON, interceptors, timeout/abort, base URL |
| **Reactive** | Deep proxy reactivity, Signals, computed values, effects |
| **Utils** | debounce, throttle, pipe, once, sleep, escapeHtml, uuid, deepClone, deepMerge, storage/session wrappers, event bus |

---

## Quick Start

The preferred way to use zQuery is with the **pre-built browser bundle** (`zQuery.min.js`) paired with standard **ES module** `<script type="module">` tags for your app code. No npm install, no bundler, no transpiler — just grab the library and start writing components.

### 1. Get the Library

Download `dist/zQuery.min.js` from the [GitHub releases](https://github.com/tonywied17/zero-query/releases/tag/RELEASE), or clone and build:

```bash
git clone https://github.com/tonywied17/zero-query.git
cd zero-query
node build.js
# → dist/zQuery.min.js  (~45 KB)
```

### 2. Include in HTML

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My App</title>
  <link rel="stylesheet" href="styles/styles.css">
  <script src="scripts/vendor/zQuery.min.js"></script>
  <script type="module" src="scripts/app.js"></script>
</head>
<body>
  <nav>
    <a z-link="/">Home</a>
    <a z-link="/about">About</a>
  </nav>
  <div id="app"></div>
</body>
</html>
```

### 3. Boot Your App

```js
// scripts/app.js
import './components/home.js';
import './components/about.js';
import { routes } from './routes.js';

$.router({ el: '#app', routes, fallback: 'not-found' });
```

### 4. Define a Component

```js
// scripts/components/home.js
$.component('home-page', {
  state: () => ({ count: 0 }),
  increment() { this.state.count++; },
  render() {
    return `
      <h1>Home</h1>
      <p>Count: ${this.state.count}</p>
      <button @click="increment">+1</button>
    `;
  }
});
```

That's it — a fully working SPA with zero build tools.

---

## Recommended Project Structure

```
my-app/
  index.html
  scripts/
    vendor/
      zQuery.min.js
    app.js
    routes.js
    store.js
    components/
      home.js
      counter.js
      about.js
```

- One component per file inside `components/`.
- Names **must contain a hyphen** (Web Component convention): `home-page`, `app-counter`, etc.
- `app.js` is the single entry point — import components, create the store, and boot the router.

---

## Development Server

The CLI includes a built-in dev server with **live-reload** powered by [zero-http](https://github.com/tonywied17/zero-http). Install once:

```bash
# Per-project (recommended)
npm install zero-query --save-dev

# Or install globally to use zquery anywhere without npx
npm install zero-query -g
```

Then start the server:

```bash
# Start dev server (default port 3100)
npx zquery dev

# Custom port
npx zquery dev --port 8080

# Serve a specific project folder
npx zquery dev path/to/my-app
```

- **No build step** — the server serves your ES modules as-is.
- **CSS hot-swap** — `.css` changes reload in-place without a full refresh.
- **Full reload** — `.js`, `.html`, `.json`, and `.svg` changes trigger a page refresh.
- **SPA fallback** — non-file requests serve `index.html` so deep routes work.

The server injects a tiny SSE (Server-Sent Events) client into the HTTP response at runtime. Your source files are never modified.

---

## CLI Bundler

The CLI can compile your entire app — ES modules, the library, external templates, and assets — into a **single bundled file**.

```bash
# Auto-detect entry from index.html
npx zquery bundle

# Or specify an entry point
npx zquery bundle path/to/scripts/app.js
```

Output goes to `dist/` next to your `index.html`:

```
dist/
  server/               ← deploy to your web server (<base href="/"> for SPA routes)
    index.html
    z-app.<hash>.js
    z-app.<hash>.min.js
    styles/
  local/                ← open from disk (file://) — no server needed
    index.html
    z-app.<hash>.js
    ...
```

### Flags

| Flag | Short | Description |
| --- | --- | --- |
| `--out <path>` | `-o` | Custom output directory |
| `--html <file>` | — | Use a specific HTML file |
| `--watch` | `-w` | Watch and rebuild on changes |

### What the Bundler Does

1. Reads `index.html` for the `<script type="module">` entry point
2. Resolves all `import` statements and topologically sorts dependencies
3. Strips `import`/`export` syntax, wraps in an IIFE
4. Embeds zQuery library and inlines `templateUrl` / `styleUrl` / `pages` files
5. Rewrites HTML, copies assets, produces hashed filenames

---

## Production Deployment

Deploy the `dist/server/` output. Configure your web server to rewrite non-file requests to `index.html`:

**Apache (.htaccess):**
```apache
RewriteEngine On
RewriteBase /
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [L]
```

**Nginx:**
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

**Sub-path deployment** (e.g. `/my-app/`): set `<base href="/my-app/">` in your HTML — the router auto-detects it.

---

## Complete API at a Glance

| Namespace | Methods |
| --- | --- |
| `$()` | Single-element selector → `Element \| null` |
| `$.all()` | Collection selector → `ZQueryCollection` |
| `$.id` `$.class` `$.classes` `$.tag` `$.children` | Quick DOM refs |
| `$.create` | Element factory |
| `$.ready` `$.on` | DOM ready, global delegation |
| `$.fn` | Collection prototype (extend it) |
| `$.component` `$.mount` `$.mountAll` `$.getInstance` `$.destroy` `$.components` | Component system |
| `$.style` | Dynamically load global stylesheet file(s) at runtime |
| `$.router` `$.getRouter` | SPA router |
| `$.store` `$.getStore` | State management |
| `$.http` `$.get` `$.post` `$.put` `$.patch` `$.delete` | HTTP client |
| `$.reactive` `$.signal` `$.computed` `$.effect` | Reactive primitives |
| `$.debounce` `$.throttle` `$.pipe` `$.once` `$.sleep` | Function utils |
| `$.escapeHtml` `$.html` `$.trust` `$.uuid` `$.camelCase` `$.kebabCase` | String utils |
| `$.deepClone` `$.deepMerge` `$.isEqual` | Object utils |
| `$.param` `$.parseQuery` | URL utils |
| `$.storage` `$.session` | Storage wrappers |
| `$.bus` | Event bus |
| `$.version` | Library version |
| `$.noConflict` | Release `$` global |

| CLI Command | Description |
| --- | --- |
| `zquery dev [root]` | Dev server with live-reload (port 3100) |
| `zquery bundle [entry]` | Bundle app into a single IIFE file |
| `zquery build` | Build the zQuery library (`dist/zQuery.min.js`) |
| `zquery --help` | Show CLI usage |

For full method signatures, options, and examples, see **[API.md](API.md)**.

---

## Editor Support

The official **[zQuery for VS Code](https://marketplace.visualstudio.com/items?itemName=zQuery.zquery-vs-code)** extension provides autocomplete, hover docs, HTML directive support, and 55+ code snippets for every API method and directive. Install it from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=zQuery.zquery-vs-code) or search **"zQuery for VS Code"** in Extensions.

---

## License

MIT — [Anthony Wiedman / Molex](https://github.com/tonywied17)
