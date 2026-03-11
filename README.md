<p align="center">
  <img src=".github/images/logo-animated.svg" alt="zQuery logo" width="300" height="300">
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

> **Lightweight, zero-dependency frontend library that combines jQuery-style DOM manipulation with a modern reactive component system, SPA router, global state management, HTTP client, and utility toolkit — all in a single ~86 KB minified browser bundle. Works out of the box with ES modules. An optional CLI bundler is available for single-file production builds.**

## Features

| Module | Highlights |
| --- | --- |
| **Components** | Reactive state, template literals, `@event` delegation (8 modifiers), `z-model` two-way binding, computed properties, watch callbacks, slot-based content projection, directives (`z-if`/`z-else-if`/`z-else`, `z-for`, `z-show`, `z-bind`/`:attr`, `z-class`, `z-style`, `z-text`, `z-html`, `z-ref`, `z-cloak`, `z-pre`, `z-key`, `z-skip`), DOM morphing engine with LIS-based keyed reconciliation (no innerHTML rebuild), CSP-safe expression evaluation with AST caching, scoped styles, external templates (`templateUrl` / `styleUrl`), lifecycle hooks, auto-injected base styles |
| **Router** | History & hash mode, route params (`:id`), guards, lazy loading, `z-link` navigation, `z-to-top` scroll modifier (`instant`/`smooth`) |
| **Directives** | `z-if`, `z-for`, `z-model`, `z-show`, `z-bind`, `z-class`, `z-style`, `z-text`, `z-html`, `z-ref`, `z-cloak`, `z-pre`, `z-key`, `z-skip` &mdash; 17 built-in template directives |
| **Reactive** | Deep proxy reactivity, Signals (`.value`, `.peek()`), computed values, effects (auto-tracked with dispose) |
| **Store** | Reactive global state, named actions, computed getters, middleware, subscriptions |
| **Selectors & DOM** | jQuery-like chainable selectors, traversal, DOM manipulation, events, animation |
| **HTTP** | Fetch wrapper with auto-JSON, interceptors, timeout/abort, base URL |
| **Utils** | debounce, throttle, pipe, once, sleep, escapeHtml, uuid, deepClone, deepMerge, storage/session wrappers, event bus |
| **Dev Tools** | CLI dev server with live-reload, full-screen error overlay (syntax + runtime), CLI bundler for single-file production builds |

---

## Quick Start

### Recommended: CLI Dev Server

The fastest way to develop with zQuery is via the built-in **CLI dev server** with **live-reload**. It serves your ES modules as-is and automatically resolves the library — no manual downloads required.

```bash
# Install (per-project or globally)
npm install zero-query --save-dev   # or: npm install zero-query -g
```

Scaffold a new project and start the server:

```bash
npx zquery create my-app
npx zquery dev my-app
```

> **Tip:** Stay in the project root (where `node_modules` lives) instead of `cd`-ing into `my-app`. This keeps `index.d.ts` accessible to your IDE for full type/intellisense support.

The `create` command generates a ready-to-run project with a sidebar layout, router, multiple components (including a folder component with external template and styles), and responsive styles. The dev server watches for file changes, hot-swaps CSS in-place, full-reloads on other changes, and handles SPA fallback routing.

#### Error Overlay

The dev server includes a **full-screen error overlay** that surfaces errors directly in the browser — similar to Vite or Angular:

- **Syntax errors** — JS files are validated on every save *before* the reload is triggered. If a syntax error is found the page stays intact and a dark overlay appears with the error message, file path, line:column, and a code frame pointing to the exact location.
- **Runtime errors** — uncaught exceptions and unhandled promise rejections are captured and displayed in the same overlay with a cleaned-up stack trace.
- The overlay **auto-clears** when you fix the error and save. Press `Esc` or click `×` to dismiss manually.

### Alternative: Manual Setup (No npm)

If you prefer **zero tooling**, download `dist/zquery.min.js` from the [GitHub releases](https://github.com/tonywied17/zero-query/releases/tag/RELEASE) and drop it into `scripts/vendor/`. Then open `index.html` directly in a browser — no Node.js required.

```bash
git clone https://github.com/tonywied17/zero-query.git
cd zero-query
npx zquery build
# → dist/zquery.min.js  (~86 KB)
```

### Include in HTML

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My App</title>
  <link rel="stylesheet" href="styles/styles.css">
  <script src="scripts/vendor/zquery.min.js"></script>
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

### Boot Your App

```js
// scripts/app.js
import './components/home.js';
import './components/about.js';
import './components/contacts/contacts.js';
import { routes } from './routes.js';

$.router({ el: '#app', routes, fallback: 'not-found' });
```

### Define a Component

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

That's it — a fully working SPA with the dev server's live-reload.

---

## Recommended Project Structure

```
my-app/
  index.html
  scripts/
    vendor/
      zquery.min.js       ← only needed for manual setup; dev server auto-resolves
    app.js
    routes.js
    store.js
    components/
      home.js
      counter.js
      todos.js
      api-demo.js
      about.js
      not-found.js
      contacts/           ← folder component (templateUrl + styleUrl)
        contacts.js
        contacts.html
        contacts.css
  styles/
    styles.css
```

- One component per file inside `components/`.
- Names **must contain a hyphen** (Web Component convention): `home-page`, `app-counter`, etc.
- Components with external templates or styles can use a subfolder (e.g. `contacts/contacts.js` + `contacts.html` + `contacts.css`).
- `app.js` is the single entry point — import components, create the store, and boot the router.

---

## CLI Bundler

The CLI compiles your entire app — ES modules, the library, external templates, and assets — into a **single production-ready bundle**. It outputs two builds in one step: a `server/` build for deploying to any web server, and a `local/` build that works straight from disk. No config, no flags — just point it at your app.

```bash
# Auto-detect entry from any .html with a module script
npx zquery bundle

# Or point to an app directory from anywhere
npx zquery bundle my-app/

# Or pass a direct entry file (skips auto-detection)
npx zquery bundle my-app/scripts/main.js
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
| `--index <file>` | `-i` | Index HTML file (default: auto-detected) |
| `--minimal` | `-m` | Only output HTML + bundled JS (skip static assets) |

### What the Bundler Does

1. **Entry detection** — a strict precedence order ensures the correct file is chosen:
   1. **HTML files** — `index.html` is checked first, then other `.html` files (root + one level deep).
   2. **Module scripts within HTML** — within each HTML file, a `<script type="module">` whose `src` resolves to `app.js` wins; otherwise the first module script tag is used.
   3. **JS file scan** — if no HTML match, JS files (up to 2 levels deep) are scanned in two passes: first for `$.router(` (the canonical app entry point), then for `$.mount(`, `$.store(`, or `mountAll(`.
   4. **Convention fallbacks** — `scripts/app.js`, `src/app.js`, `js/app.js`, `app.js`, `main.js`.
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
| `$()` | Chainable selector → `ZQueryCollection` (CSS selectors, elements, NodeLists, HTML strings) |
| `$.all()` | Alias for `$()` — identical behavior |
| `$.id` `$.class` `$.classes` `$.tag` `$.name` `$.children` | Quick DOM refs |
| `$.create` | Element factory |
| `$.ready` `$.on` `$.off` | DOM ready, global event delegation & direct listeners |
| `$.fn` | Collection prototype (extend it) |
| `$.component` `$.mount` `$.mountAll` `$.getInstance` `$.destroy` `$.components` | Component system |
| `$.morph` | DOM morphing engine — LIS-based keyed reconciliation, `isEqualNode()` bail-outs, `z-skip` opt-out. Patches existing DOM to match new HTML without destroying unchanged nodes |
| `$.safeEval` | CSP-safe expression evaluator (replaces `eval` / `new Function`) |
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
| `$.meta` | Build metadata (populated by CLI bundler) |
| `$.noConflict` | Release `$` global |

| CLI Command | Description |
| --- | --- |
| `zquery create [dir]` | Scaffold a new project (index.html, components, store, styles) |
| `zquery dev [root]` | Dev server with live-reload &amp; error overlay (port 3100). `--index` for custom HTML. |
| `zquery bundle [dir\|file]` | Bundle app into a single IIFE file. Accepts dir or direct entry file. |
| `zquery build` | Build the zQuery library (`dist/zquery.min.js`) |
| `zquery --help` | Show CLI usage |

For full method signatures, options, and examples, see **[API.md](API.md)**.

---

## Editor Support

The official **[zQuery for VS Code](https://marketplace.visualstudio.com/items?itemName=zQuery.zquery-vs-code)** extension provides autocomplete, hover docs, HTML directive support, and 185+ code snippets for every API method and directive. Install it from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=zQuery.zquery-vs-code) or search **"zQuery for VS Code"** in Extensions.

---

## License

MIT — [Anthony Wiedman / Molex](https://github.com/tonywied17)
