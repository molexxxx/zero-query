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

> **Lightweight, zero-dependency frontend library that combines jQuery-style DOM manipulation with a modern reactive component system, SPA router, global state management, HTTP client, and utility toolkit — all in a single ~100 KB minified browser bundle. Works out of the box with ES modules. An optional CLI bundler is available for single-file production builds.**

## Features

| Module | Highlights |
| --- | --- |
| **Components** | Reactive state, template literals, `@event` delegation (22 modifiers — key filters, system keys, `.outside`, timing, and more), `z-model` two-way binding (with `z-trim`, `z-number`, `z-lazy`, `z-debounce`, `z-uppercase`, `z-lowercase`), computed properties, watch callbacks, slot-based content projection, directives (`z-if`/`z-else-if`/`z-else`, `z-for`, `z-show`, `z-bind`/`:attr`, `z-class`, `z-style`, `z-text`, `z-html`, `z-ref`, `z-cloak`, `z-pre`, `z-key`, `z-skip`), DOM morphing engine with LIS-based keyed reconciliation (no innerHTML rebuild), CSP-safe expression evaluation with AST caching, scoped styles, external templates (`templateUrl` / `styleUrl`), lifecycle hooks, auto-injected base styles |
| **Router** | History & hash mode, route params (`:id`), wildcards, guards (`beforeEach`/`afterEach`), lazy loading, `z-link` navigation, `z-to-top` scroll modifier (`instant`/`smooth`), sub-route history substates (`pushSubstate`/`onSubstate`) |
| **Directives** | `z-if`, `z-for`, `z-model`, `z-show`, `z-bind`, `z-class`, `z-style`, `z-text`, `z-html`, `z-ref`, `z-cloak`, `z-pre`, `z-key`, `z-skip` &mdash; 17 built-in template directives |
| **Reactive** | Deep proxy reactivity, Signals (`.value`, `.peek()`), computed values, effects (auto-tracked with dispose) |
| **Store** | Reactive global state, named actions, computed getters, middleware, subscriptions, action history, snapshots |
| **Selectors & DOM** | jQuery-like chainable selectors, traversal, DOM manipulation, events, animation |
| **HTTP** | Fetch wrapper with auto-JSON, interceptors (with unsubscribe & clear), HEAD requests, parallel requests (`http.all`), config inspection (`getConfig`), timeout/abort, base URL |
| **Utils** | debounce, throttle, pipe, once, sleep, memoize, escapeHtml, stripHtml, uuid, capitalize, truncate, range, chunk, groupBy, unique, pick, omit, getPath/setPath, isEmpty, clamp, retry, timeout, deepClone, deepMerge, storage/session wrappers, event bus |
| **Dev Tools** | CLI dev server with live-reload, CSS hot-swap, full-screen error overlay, floating toolbar, dark-themed inspector panel (Router view, DOM tree, network log, component viewer, performance dashboard), fetch interceptor, render instrumentation, CLI bundler for single-file production builds |
| **SSR** | Server-side rendering to HTML strings in Node.js — `createSSRApp()`, `renderToString()`, `renderPage()` with SEO/Open Graph support, `renderBatch()` for parallel rendering, fragment mode, hydration markers, graceful error handling, `escapeHtml()` utility |

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

The `create` command generates a ready-to-run project with a sidebar layout, router, multiple components (including folder components with external templates and styles), and responsive styles. Use `--minimal` (or `-m`) to scaffold a lightweight 3-page starter instead. Use `--ssr` (or `-s`) to scaffold a project with a Node.js server-side rendering example. The dev server watches for file changes, hot-swaps CSS in-place, full-reloads on other changes, and handles SPA fallback routing.

#### Error Overlay

The dev server includes a **full-screen error overlay** that surfaces errors directly in the browser — similar to Vite or Angular:

- **Syntax errors** — JS files are validated on every save *before* the reload is triggered. If a syntax error is found the page stays intact and a dark overlay appears with the error message, file path, line:column, and a code frame pointing to the exact location.
- **Runtime errors** — uncaught exceptions and unhandled promise rejections are captured and displayed in the same overlay with a cleaned-up stack trace.
- The overlay **auto-clears** when you fix the error and save. Press `Esc` or click `×` to dismiss manually.

#### Floating Toolbar & Inspector

A compact expandable toolbar appears in the bottom-right corner. In its **collapsed** state it shows live render and request counters. Click the chevron to **expand** and reveal the route indicator (color-coded by the last navigation event — navigate, pop, replace, hashchange, substate), registered component count, and DOM element count. Click any stat to open a **dark-themed DevTools inspector** as a popup — or visit `http://localhost:<port>/_devtools` for a standalone split-view panel with five tabs: **Router** (live route state, guards, history timeline), **Components** (live state cards), **Performance** (render timeline with timing metrics), **Network** (fetch log with JSON viewer), and **Elements** (live DOM tree with component badges, source viewer, expand/collapse).

### Alternative: Manual Setup (No npm)

If you prefer **zero tooling**, download `dist/zquery.min.js` from the [dist/ folder](https://github.com/tonywied17/zero-query/tree/main/dist) and drop it into your project root or `assets/scripts/`. Then open `index.html` directly in a browser — no Node.js required.

```bash
git clone https://github.com/tonywied17/zero-query.git
cd zero-query
npx zquery build
# → dist/zquery.min.js  (~100 KB)
```

### Include in HTML

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My App</title>
  <link rel="stylesheet" href="global.css">
  <script src="zquery.min.js"></script>
  <script type="module" src="app/app.js"></script>
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
// app/app.js
import './components/home.js';
import './components/about.js';
import './components/contacts/contacts.js';
import { routes } from './routes.js';

$.router({ el: '#app', routes, fallback: 'not-found' });
```

### Define a Component

```js
// app/components/home.js
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
my-app/                          ← default scaffold (npx zquery create my-app)
  index.html
  global.css
  app/
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
      contact-card.js
      contacts/           ← folder component (templateUrl + styleUrl)
        contacts.js
        contacts.html
        contacts.css
      playground/          ← folder component
        playground.js
        playground.html
        playground.css
      toolkit/             ← folder component
        toolkit.js
        toolkit.html
        toolkit.css
  assets/
    scripts/              ← third-party JS (e.g. zquery.min.js for manual setup)
    styles/               ← additional stylesheets, fonts, etc.
```

Use `--minimal` for a lighter starting point (3 pages + 404 fallback):

```
my-app/                          ← minimal scaffold (npx zquery create my-app --minimal)
  index.html
  global.css
  app/
    app.js
    routes.js
    store.js
    components/
      home.js
      counter.js
      about.js
      not-found.js               ← 404 fallback
  assets/
```

Use `--ssr` for a project with server-side rendering:

```
my-app/                          ← SSR scaffold (npx zquery create my-app --ssr)
  index.html                     ← client HTML shell
  global.css
  app/
    app.js                       ← client entry — registers shared components
    routes.js                    ← shared route definitions
    components/
      home.js                    ← shared component (SSR + client)
      about.js
      not-found.js
  server/
    index.js                     ← SSR HTTP server
  assets/
```

Components in `app/components/` export plain definition objects — the client registers them with `$.component()`, the server with `app.component()`. The `--ssr` flag handles everything automatically — installs dependencies, starts the server at `http://localhost:3000`, and opens the browser.

- One component per file inside `components/`.
- Names **must contain a hyphen** (Web Component convention): `home-page`, `app-counter`, etc.
- Components with external templates or styles can use a subfolder (e.g. `contacts/contacts.js` + `contacts.html` + `contacts.css`).
- `app.js` is the single entry point — import components, create the store, and boot the router.
- `global.css` lives next to `index.html` for easy access; the bundler hashes it into `global.<hash>.min.css` for production.
- `assets/` holds static files that get copied to `dist/` as-is.

---

## CLI Bundler

The CLI compiles your entire app — ES modules, the library, external templates, and assets — into a **single production-ready bundle**. It outputs two builds in one step: a `server/` build for deploying to any web server, and a `local/` build that works straight from disk. No config, no flags — just point it at your app.

```bash
# Auto-detect entry from any .html with a module script
npx zquery bundle

# Or point to an app directory from anywhere
npx zquery bundle my-app/

# Or pass a direct entry file (skips auto-detection)
npx zquery bundle my-app/app/main.js
```

Output goes to `dist/` next to your `index.html`:

```
dist/
  server/               ← deploy to your web server (<base href="/"> for SPA routes)
    index.html
    z-app.<hash>.min.js
    global.<hash>.min.css
    assets/
  local/                ← open from disk (file://) — no server needed
    index.html
    z-app.<hash>.min.js
    ...
```

### Flags

| Flag | Short | Description |
| --- | --- | --- |
| `--out <path>` | `-o` | Custom output directory |
| `--index <file>` | `-i` | Index HTML file (default: auto-detected) |
| `--minimal` | `-m` | Only output HTML, bundled JS, and global CSS (skip static assets) |
| `--global-css <path>` | | Override global CSS input file (default: first `<link>` in HTML) |

### What the Bundler Does

1. **Entry detection** — a strict precedence order ensures the correct file is chosen:
   1. **HTML files** — `index.html` is checked first, then other `.html` files (root + one level deep).
   2. **Module scripts within HTML** — within each HTML file, a `<script type="module">` whose `src` resolves to `app.js` wins; otherwise the first module script tag is used.
   3. **JS file scan** — if no HTML match, JS files (up to 2 levels deep) are scanned in two passes: first for `$.router(` (the canonical app entry point), then for `$.mount(`, `$.store(`, or `mountAll(`.
   4. **Convention fallbacks** — `app/app.js`, `scripts/app.js`, `src/app.js`, `js/app.js`, `app.js`, `main.js`.
2. Resolves all `import` statements and topologically sorts dependencies
3. Strips `import`/`export` syntax, wraps in an IIFE
4. Embeds zQuery library and inlines `templateUrl` / `styleUrl` files
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
| `$.id` `$.class` `$.classes` `$.tag` `$.name` `$.children` `$.qs` `$.qsa` | Quick DOM refs |
| `$.create` | Element factory |
| `$.ready` `$.on` `$.off` | DOM ready, global event delegation & direct listeners |
| `$.fn` | Collection prototype (extend it) |
| `$.component` `$.mount` `$.mountAll` `$.getInstance` `$.destroy` `$.components` `$.prefetch` | Component system |
| `$.morph` `$.morphElement` | DOM morphing engine — LIS-based keyed reconciliation, `isEqualNode()` bail-outs, `z-skip` opt-out. Patches existing DOM to match new HTML without destroying unchanged nodes. Auto-key detection (`id`, `data-id`, `data-key`) — no `z-key` required. `$().html()` and `$().replaceWith()` auto-morph existing content; `$().morph()` for explicit morph |
| `$.safeEval` | CSP-safe expression evaluator (replaces `eval` / `new Function`) |
| `$.style` | Dynamically load global stylesheet file(s) at runtime |
| `$.router` `$.getRouter` | SPA router |
| `$.store` `$.getStore` | State management |
| `$.http` `$.get` `$.post` `$.put` `$.patch` `$.delete` `$.head` | HTTP client |
| `$.reactive` `$.Signal` `$.signal` `$.computed` `$.effect` | Reactive primitives |
| `$.debounce` `$.throttle` `$.pipe` `$.once` `$.sleep` `$.memoize` | Function utils |
| `$.escapeHtml` `$.stripHtml` `$.html` `$.trust` `$.TrustedHTML` `$.uuid` `$.camelCase` `$.kebabCase` `$.capitalize` `$.truncate` | String utils |
| `$.deepClone` `$.deepMerge` `$.isEqual` `$.pick` `$.omit` `$.getPath` `$.setPath` `$.isEmpty` | Object utils |
| `$.range` `$.unique` `$.chunk` `$.groupBy` | Array utils |
| `$.clamp` | Number utils |
| `$.retry` `$.timeout` | Async utils |
| `$.param` `$.parseQuery` | URL utils |
| `$.storage` `$.session` | Storage wrappers |
| `$.EventBus` `$.bus` | Event bus |
| `$.onError` `$.ZQueryError` `$.ErrorCode` `$.guardCallback` `$.guardAsync` `$.formatError` `$.validate` | Error handling |
| `$.version` | Library version |\n| `$.libSize` | Minified bundle size string (e.g. `\"~100 KB\"`) |
| `$.unitTests` | Build-time test results `{ passed, failed, total, suites, duration, ok }` |
| `$.meta` | Build metadata (populated by CLI bundler) |
| `$.noConflict` | Release `$` global |

| CLI Command | Description |
| --- | --- |
| `zquery create [dir]` | Scaffold a new project. Default: full-featured app. `--minimal` / `-m`: lightweight 3-page starter. `--ssr` / `-s`: SSR project with shared components and HTTP server. |
| `zquery dev [root]` | Dev server with live-reload, CSS hot-swap, error overlay, expandable floating toolbar &amp; five-tab inspector panel (port 3100). Visit `/_devtools` for the standalone panel. `--index` for custom HTML, `--bundle` for bundled mode, `--no-intercept` to skip CDN intercept. |
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
