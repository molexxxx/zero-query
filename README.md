<p align="center">
  <img src=".github/images/logo-animated.svg" alt="zQuery logo" width="300" height="300">
</p>

<h1 align="center">zQuery</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/zero-query"><img src="https://raw.githubusercontent.com/tonywied17/tonywied17/main/.github/badges/zero-query-package-name-zquery.svg?v=7a51b269" alt="npm package"></a>
  <a href="https://www.npmjs.com/package/zero-query"><img src="https://raw.githubusercontent.com/tonywied17/tonywied17/main/.github/badges/zero-query-npm-zquery.svg?v=6baa3dbe" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/zero-query"><img src="https://raw.githubusercontent.com/tonywied17/tonywied17/main/.github/badges/zero-query-dm-zquery.svg?v=798985a4" alt="npm downloads"></a>
</p>

<p align="center">
  <a href="https://github.com/tonywied17/zero-query/actions/workflows/ci.yml"><img src="https://raw.githubusercontent.com/tonywied17/tonywied17/main/.github/badges/zero-query-ci-zquery.svg?v=29af6360" alt="CI"></a>
  <a href="https://github.com/tonywied17/zero-query"><img src="https://raw.githubusercontent.com/tonywied17/tonywied17/main/.github/badges/zero-query-tests-zquery.svg?v=fa09e3d4" alt="tests"></a>
  <a href="https://github.com/tonywied17/zero-query"><img src="https://raw.githubusercontent.com/tonywied17/tonywied17/main/.github/badges/zero-query-coverage-zquery.svg?v=a969c52b" alt="coverage"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://raw.githubusercontent.com/tonywied17/tonywied17/main/.github/badges/zero-query-license-zquery.svg?v=73a9f288" alt="License"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=zQuery.zquery-vs-code"><img src="https://raw.githubusercontent.com/tonywied17/tonywied17/main/.github/badges/zero-query-vscode-zquery.svg?v=a2c589fa" alt="VS Code Extension"></a>
</p>

> **Lightweight, zero-dependency frontend library that combines jQuery-style DOM manipulation with a modern reactive component system, SPA router, global state management, HTTP client, and utility toolkit - all in a single ~108 KB minified browser bundle. Works out of the box with ES modules. An optional CLI bundler is available for single-file production builds.**

## Features

| Module | Highlights |
| --- | --- |
| **Components** | Reactive state, template literals, `@event` delegation (key filters for any key via `KeyboardEvent.key`, system keys, `.outside`, timing, behavior modifiers, and more), `z-model` two-way binding (with `z-trim`, `z-number`, `z-lazy`, `z-debounce`, `z-uppercase`, `z-lowercase`), computed properties, watch callbacks, slot-based content projection, directives (`z-if`/`z-else-if`/`z-else`, `z-for`, `z-show`, `z-bind`/`:attr`, `z-class`, `z-style`, `z-text`, `z-html`, `z-ref`, `z-cloak`, `z-pre`, `z-key`, `z-skip`), DOM morphing engine with LIS-based keyed reconciliation (no innerHTML rebuild), CSP-safe expression evaluation with AST caching, scoped styles, external templates (`templateUrl` / `styleUrl`), lifecycle hooks, auto-injected base styles |
| **Router** | History & hash mode, route params (`:id`), wildcards, guards (`beforeEach`/`afterEach`), lazy loading, `z-link` navigation with `z-link-params`, `z-to-top` scroll modifier (`instant`/`smooth`), `z-active-route` active-link class directive, `<z-outlet>` declarative mount point, sub-route history substates (`pushSubstate`/`onSubstate`) |
| **Directives** | `z-if`, `z-else-if`, `z-else`, `z-for`, `z-model`, `z-show`, `z-bind`/`:attr`, `z-class`, `z-style`, `z-text`, `z-html`, `z-ref`, `z-cloak`, `z-pre`, `z-key`, `z-skip`, `@event`/`z-on` &mdash; 17 built-in template directives |
| **Reactive** | Deep proxy reactivity, Signals (`.value`, `.peek()`), computed values, effects (auto-tracked with dispose), `batch()` for deferred notifications, `untracked()` for dependency-free reads |
| **Store** | Reactive global state, named actions, computed getters, middleware, subscriptions, `batch()` grouped mutations, `checkpoint()`/`undo()`/`redo()` with configurable stack, action history, snapshots |
| **Selectors & DOM** | jQuery-like chainable selectors, traversal, DOM manipulation, events, animation |
| **HTTP** | Fetch wrapper with auto-JSON, interceptors (with unsubscribe & clear), HEAD requests, parallel requests (`http.all`), config inspection (`getConfig`), timeout/abort, base URL |
| **Utils** | debounce, throttle, pipe, once, sleep, memoize (LRU), escapeHtml, stripHtml, uuid, capitalize, truncate, range, chunk, groupBy, unique, pick, omit, getPath/setPath, isEmpty, clamp, retry, timeout, deepClone (enhanced fallback), deepMerge (prototype-pollution safe), storage/session wrappers, event bus |
| **Security** | XSS-safe template expressions (`{{}}` auto-escaping), sandboxed expression evaluator (blocks `window`, `Function`, `eval`, `RegExp`, `Error`, prototype chains), prototype pollution prevention in `deepMerge`/`setPath`, `z-link` protocol validation, SSR error sanitization, `renderShell()` metadata injection hardening (script-tag breakout prevention, ReDoS-safe OG keys, safe `.replace()` patterns) |
| **Dev Tools** | CLI dev server with live-reload, CSS hot-swap, full-screen error overlay, floating toolbar, dark-themed inspector panel (Router view, DOM tree, network log, component viewer, performance dashboard), fetch interceptor, render instrumentation, CLI bundler for single-file production builds |
| **SSR** | Server-side rendering to HTML strings in Node.js - `createSSRApp()`, `renderToString()`, `renderPage()` with SEO/Open Graph support, `renderShell()` for injecting SSR into custom HTML shells, `renderBatch()` for parallel rendering, fragment mode, hydration markers, graceful error handling, `escapeHtml()` utility |
| **WebRTC** | `SignalingClient` + `Peer` (perfect negotiation) + multi-peer `Room` speaking the `@zero-server/webrtc` wire protocol &mdash; `$.webrtc.join(url, opts)`, reactive `useRoom` / `usePeer` / `useTracks` / `useDataChannel` / `useConnectionQuality` composables, `z-stream` directive for binding remote `MediaStream`s to `<video>` / `<audio>`, SDP + ICE parsers, exponential-backoff reconnect, coalesced ICE trickle, TURN credential fetcher + auto-refresher, SFrame E2EE worker, SFU peer-dep adapters for `mediasoup-client` and `livekit-client`, join-token decoder, `getStats()` sampler with quality classification, typed error family (`WebRtcError`, `SignalingError`, `IceError`, `SdpError`, `TurnError`, `E2eeError`); scaffold a one-page demo with `npx zero-query create my-app --webrtc-demo` |

---

## Quick Start

### Recommended: CLI Dev Server

The fastest way to develop with zQuery is via the built-in **CLI dev server** with **live-reload**. It serves your ES modules as-is and automatically resolves the library - no manual downloads required.

Pick a scaffold flavor &mdash; every variant auto-installs, auto-starts, and opens your browser:

```bash
# Default: full sidebar layout, router, demo components, responsive styles
npx zero-query create my-app                    # → http://localhost:3100

# Minimal: lightweight 3-page starter
npx zero-query create my-app --minimal          # → http://localhost:3100   (alias: -m)

# SSR: Node.js server-side rendering project
npx zero-query create my-app --ssr              # → http://localhost:3000   (alias: -s)

# WebRTC: one-page video room backed by zero-server
npx zero-query create my-app --webrtc-demo      # → http://localhost:3000   (alias: -w)
```

That's it. One command scaffolds the project, installs dependencies, starts the server, and opens the browser. To restart later:

```bash
cd my-app
npm run dev      # or: npm start
```

> **Tip:** For the default and minimal variants, you can stay in the project root (where `node_modules` lives) instead of `cd`-ing into `my-app`. This keeps `index.d.ts` accessible to your IDE for full type/intellisense support.

The default scaffold ships a sidebar layout, router, multiple components (including folder components with external templates and styles), and responsive styles. The SSR variant runs a Node.js server that renders pages to HTML strings. The WebRTC variant is wired to [zero-server](https://github.com/tonywied17/zero-server) for signaling + TURN. The dev server watches for file changes, hot-swaps CSS in-place, full-reloads on other changes, and handles SPA fallback routing.

#### Error Overlay

The dev server includes a **full-screen error overlay** that surfaces errors directly in the browser - similar to Vite or Angular:

- **Syntax errors** - JS files are validated on every save *before* the reload is triggered. If a syntax error is found the page stays intact and a dark overlay appears with the error message, file path, line:column, and a code frame pointing to the exact location.
- **Runtime errors** - uncaught exceptions and unhandled promise rejections are captured and displayed in the same overlay with a cleaned-up stack trace.
- The overlay **auto-clears** when you fix the error and save. Press `Esc` or click `×` to dismiss manually.

#### Floating Toolbar & Inspector

A compact expandable toolbar appears in the bottom-right corner. In its **collapsed** state it shows live render and request counters. Click the chevron to **expand** and reveal the route indicator (color-coded by the last navigation event - navigate, pop, replace, hashchange, substate), registered component count, and DOM element count. Click any stat to open a **dark-themed DevTools inspector** as a popup - or visit `http://localhost:<port>/_devtools` for a standalone split-view panel with five tabs: **Router** (live route state, guards, history timeline), **Components** (live state cards), **Performance** (render timeline with timing metrics), **Network** (fetch log with JSON viewer), and **Elements** (live DOM tree with component badges, source viewer, expand/collapse).

### Alternative: Manual Setup (No npm)

If you prefer **zero tooling**, download `dist/zquery.min.js` from the [dist/ folder](https://github.com/tonywied17/zero-query/tree/main/dist) and drop it into your project root or `assets/scripts/`. Then open `index.html` directly in a browser - no Node.js required.

```bash
git clone https://github.com/tonywied17/zero-query.git
cd zero-query
npx zquery build
# → dist/zquery.min.js  (~108 KB)
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
  <z-outlet></z-outlet>
</body>
</html>
```

### Boot Your App

```js
// app/app.js
import './components/home.js';
import './components/about.js';
import './components/not-found.js';
import { routes } from './routes.js';

$.router({ routes, fallback: 'not-found' });
```

### Define a Component

One component per file — each self-registers via `$.component()` when imported:

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

The router's `fallback` component handles unmatched routes — same pattern. Use `$.getRouter().current?.path` to show the requested URL:

```js
// app/components/not-found.js
$.component('not-found', {
  render() {
    const router = $.getRouter();
    return `
      <div class="card">
        <h2>404</h2>
        <p>The page <code>${$.escapeHtml(router.current?.path || '')}</code> was not found.</p>
        <a z-link="/">Go Home</a>
      </div>
    `;
  }
});
```

That's it - a fully working SPA with the dev server's live-reload.

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
  index.html                     ← client HTML shell (meta tags, z-link nav)
  global.css
  package.json
  app/
    app.js                       ← client entry - registers shared components
    routes.js                    ← shared route definitions
    components/
      home.js                    ← shared component (SSR + client)
      about.js
      not-found.js
      blog/                      ← folder component - param routing
        index.js                 ← blog list (/blog)
        post.js                  ← blog detail (/blog/:slug)
  server/
    index.js                     ← SSR HTTP server with JSON API
    data/
      posts.js                   ← sample blog data
  assets/
```

Components in `app/components/` export plain definition objects - the client registers them with `$.component()`, the server with `app.component()`. The scaffold includes a blog with param-based routing (`/blog/:slug`), per-route SEO metadata, JSON API endpoints (`/api/posts`), and `window.__SSR_DATA__` hydration. The `--ssr` flag handles everything automatically - installs dependencies, starts the server at `http://localhost:3000`, and opens the browser.

Use `--webrtc-demo` (`-w`) for a one-page video room backed by [zero-server](https://github.com/tonywied17/zero-server):

```
my-app/                          ← webrtc scaffold (npx zquery create my-app --webrtc-demo)
  index.html                     ← single-page video room shell
  global.css
  package.json                   ← declares @zero-server/sdk + @zero-server/webrtc deps
  app/
    app.js                       ← boots the room component
    components/
      video-room.js              ← join controls, peer grid, z-stream bindings
  server/
    index.js                     ← signaling + static server (zero-server-backed)
  assets/
```

The signaling server is a thin wrapper around `@zero-server/webrtc` that issues join tokens, relays SDP/ICE, and serves the static client. Set `WEBRTC_JWT_SECRET`, `TURN_SECRET`, and `TURN_URLS` env vars to enable TURN. The `--webrtc-demo` flag installs all deps (zQuery + the two `@zero-server` packages), starts the signaling + static server at `http://localhost:3000`, and opens the browser.

- One component per file inside `components/`.
- Names **must contain a hyphen** (Web Component convention): `home-page`, `app-counter`, etc.
- Components with external templates or styles can use a subfolder (e.g. `contacts/contacts.js` + `contacts.html` + `contacts.css`).
- `app.js` is the single entry point - import components, create the store, and boot the router.
- `global.css` lives next to `index.html` for easy access; the bundler hashes it into `global.<hash>.min.css` for production.
- `assets/` holds static files that get copied to `dist/` as-is.

---

## CLI Bundler

The CLI compiles your entire app - ES modules, the library, external templates, and assets - into a **single production-ready bundle**. It outputs two builds in one step: a `server/` build for deploying to any web server, and a `local/` build that works straight from disk. No config, no flags - just point it at your app.

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
  local/                ← open from disk (file://) - no server needed
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

1. **Entry detection** - a strict precedence order ensures the correct file is chosen:
   1. **HTML files** - `index.html` is checked first, then other `.html` files (root + one level deep).
   2. **Module scripts within HTML** - within each HTML file, a `<script type="module">` whose `src` resolves to `app.js` wins; otherwise the first module script tag is used.
   3. **JS file scan** - if no HTML match, JS files (up to 2 levels deep) are scanned in two passes: first for `$.router(` (the canonical app entry point), then for `$.mount(`, `$.store(`, or `mountAll(`.
   4. **Convention fallbacks** - `app/app.js`, `scripts/app.js`, `src/app.js`, `js/app.js`, `app.js`, `main.js`.
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

**Sub-path deployment** (e.g. `/my-app/`): add `<base href="/my-app/">` to your `<head>` — the router auto-detects it:

```html
<head>
  <base href="/my-app/">
  <meta charset="UTF-8">
  <title>My App</title>
  ...
</head>
```

Or pass `base` directly in JavaScript:

```js
$.router({ base: '/my-app', routes });
```

---

## Complete API at a Glance

| Namespace | Methods |
| --- | --- |
| `$()` | Chainable selector → `ZQueryCollection` (CSS selectors, elements, NodeLists, HTML strings) |
| `$.all()` | Alias for `$()` - identical behavior |
| `$.id` `$.class` `$.classes` `$.tag` `$.name` `$.children` `$.qs` `$.qsa` | Quick DOM refs |
| `$.create` | Element factory |
| `$.ready` `$.on` `$.off` | DOM ready, global event delegation & direct listeners |
| `$.fn` | Collection prototype (extend it) |
| `$.component` `$.mount` `$.mountAll` `$.getInstance` `$.destroy` `$.components` `$.prefetch` | Component system |
| `$.morph` `$.morphElement` | DOM morphing engine - LIS-based keyed reconciliation, `isEqualNode()` bail-outs, `z-skip` opt-out. Patches existing DOM to match new HTML without destroying unchanged nodes. Auto-key detection (`id`, `data-id`, `data-key`) - no `z-key` required. `$().html()` and `$().replaceWith()` auto-morph existing content; `$().morph()` for explicit morph |
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
| `$.version` | Library version |\n| `$.libSize` | Minified bundle size string (e.g. `\"~108 KB\"`) |
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

MIT - [Anthony Wiedman / Molex](https://github.com/tonywied17)
