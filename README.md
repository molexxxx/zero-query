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

## Quick Start (Browser Bundle + ES Modules — Recommended)

The preferred way to use zQuery is with the **pre-built browser bundle** (`zQuery.min.js`) paired with standard **ES module** `<script type="module">` tags for your app code. No npm install, no bundler, no transpiler — just grab the library and start writing components.

### 1. Get the library

Download `dist/zQuery.min.js` from the [GitHub releases](https://github.com/tonywied17/zero-query/releases/tag/RELEASE), or clone and build:

```bash
git clone https://github.com/tonywied17/zero-query.git
cd zero-query
node build.js
# → dist/zQuery.js  (~78 KB, readable)
# → dist/zQuery.min.js  (~45 KB, production)
```

### 2. Copy into your project

```
my-app/
  index.html
  scripts/
    vendor/
      zQuery.min.js      ← copy here
    app.js
    routes.js
    store.js
    components/
      home.js
      about.js
```

### 3. Include in HTML

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My App</title>

  <!-- Global styles — <link rel> in the HTML head is the recommended approach
       for app-wide CSS (resets, layout, themes). Prevents FOUC reliably. -->
  <link rel="stylesheet" href="styles/styles.css">

  <!-- Load zQuery (global $ and zQuery are available immediately) -->
  <script src="scripts/vendor/zQuery.min.js"></script>

  <!-- Your app code as ES module (components use $ globally) -->
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

### 4. Register components and boot the router

```js
// scripts/app.js
import './components/home.js';
import './components/about.js';
import { routes } from './routes.js';

// Global styles are loaded via <link rel="stylesheet"> in index.html (recommended).
// $.style() is available for dynamic stylesheets, runtime overrides, or theme switching.

const router = $.router({
  el: '#app',
  routes,
  fallback: 'not-found',
});
```

That's it — a fully working SPA with zero build tools. Your files are served as individual ES modules, which means instant browser caching, easy debugging, and native import/export.

> **Want a single-file build instead?** See the [CLI Bundler](#cli-bundler-optional) section below for an optional bundling step that compiles your entire app into one file.

---

## Recommended Project Structure

```
my-app/
  index.html                 ← entry point
  scripts/
    vendor/
      zQuery.min.js          ← the built library
    app.js                   ← boot: imports components, creates router & store
    app.css                  ← global styles (linked in index.html via <link rel>)
    routes.js                ← route definitions
    store.js                 ← global store config
    components/
      home.js                ← each page/component in its own file
      counter.js
      todos.js
      about.js
      not-found.js
```

**Conventions:**
- Place `zQuery.min.js` in a `vendor/` folder.
- One component per file inside `components/`.
- Store and routes get their own files at the `scripts/` root.
- `app.js` is the single entry point — import components, create the store, and boot the router.
- Component names **must contain a hyphen** (Web Component convention): `home-page`, `app-counter`, etc.

---

## CLI Bundler (Optional)

zQuery includes a zero-dependency CLI that compiles your entire app — ES modules, the library, external templates, and assets — into a **single bundled file** you can open directly from disk. Useful for offline distribution, `file://` deployments, or reducing HTTP requests.

### How It Works

The bundler auto-detects your entry point, embeds the zQuery library, resolves all ES module imports, inlines external templates, rewrites your `index.html`, and copies assets into a `dist/` folder. **No flags needed** — just point it at your app.

### Installation

```bash
npm install zero-query --save-dev
```

### Bundling

```bash
# From inside your project directory (auto-detects entry from index.html)
npx zquery bundle

# Or point to an entry from anywhere
npx zquery bundle path/to/scripts/app.js
```

That's it. The output goes to `dist/` next to your `index.html`, with two sub-folders:

```
dist/
  server/                   ← deploy to your web server
    index.html              ← has <base href="/"> for SPA deep routes
    z-app.a1b2c3d4.js      ← readable bundle (library + app + templates)
    z-app.a1b2c3d4.min.js  ← minified bundle
    styles/                 ← copied CSS
    scripts/vendor/         ← copied vendor assets
  local/                    ← open from disk (file://)
    index.html              ← relative paths, no <base> tag
    z-app.a1b2c3d4.js      ← same bundle
    ...                     ← same assets
```

**`server/`** — includes `<base href="/">` so deep-route refreshes (e.g. `/docs/router`) resolve assets from the site root. Deploy this folder to your web server.

**`local/`** — omits the `<base>` tag so paths resolve relative to the HTML file. Open `local/index.html` directly from disk — no server needed, zero console errors. The router auto-switches to hash mode on `file://`.

### Bundling the Starter App

The zero-query repo includes a starter app you can bundle from the repo root:

```bash
# npm script (defined in package.json)
npm run bundle:app

# or equivalently
npx zquery bundle examples/starter-app/scripts/app.js
```

### Optional Flags

| Flag | Short | Description |
| --- | --- | --- |
| `--out <path>` | `-o` | Custom output directory (default: `dist/` next to `index.html`) |
| `--html <file>` | — | Use a specific HTML file instead of the auto-detected one |
| `--watch` | `-w` | Watch source files and rebuild on changes |

### What Happens Under the Hood

1. **Entry detection** — Reads `index.html` for `<script type="module" src="...">`, or falls back to `scripts/app.js`, `app.js`, etc.
2. **Import graph** — Recursively resolves all `import` statements and topologically sorts them (leaves first).
3. **Module syntax stripping** — Removes `import`/`export` keywords, keeps declarations. Output is plain browser JS.
4. **Library embedding** — Finds `zquery.min.js` in your project or the package. Auto-builds from source if not found.
5. **Template inlining** — Detects `templateUrl`, `styleUrl`, and `pages` configs and inlines the referenced files so `file://` works without CORS issues.
6. **HTML rewriting** — Replaces `<script type="module">` with the bundle, removes the standalone library tag, and produces two output directories: `dist/server/` (with `<base href="/">` for web servers) and `dist/local/` (relative paths for `file://`). Assets are copied into both.
7. **Minification** — Produces hashed filenames (`z-app.<hash>.js` / `.min.js`) for cache-busting. Previous builds are cleaned automatically.

### Tips

- **Use relative imports** — `import './components/home.js'` (not bare specifiers)
- **One component per file** — the import walker resolves each file once
- **`import.meta.url`** is automatically replaced at bundle time
- **Hash routing** — on `file://`, the router switches to hash mode automatically

---

## Selectors & DOM: `$(selector)` & `$.all(selector)`

zQuery provides two selector functions:

- **`$(selector)`** — returns a **single element** (`querySelector`) or `null`
- **`$.all(selector)`** — returns a **collection** (`querySelectorAll`) as a chainable `ZQueryCollection`

Both also accept DOM elements, NodeLists, HTML strings, and (for `$` only) a function for DOM-ready.

```js
// Single element (querySelector)
const card = $('.card');           // first .card element (or null)
card.classList.add('active');      // plain DOM API

// Collection (querySelectorAll)
$.all('.card').addClass('active').css({ opacity: '1' });

// Create element from HTML
const el = $('<div class="alert">Hello!</div>');
document.body.appendChild(el);

// DOM ready shorthand
$(() => {
  console.log('DOM is ready');
});

// Wrap an existing element
$(document.getElementById('app'));  // returns the element as-is
```

### Quick-Ref Shortcuts

```js
$.id('myId')            // document.getElementById('myId')
$.class('myClass')      // document.querySelector('.myClass')
$.classes('myClass')    // Array.from(document.getElementsByClassName('myClass'))
$.tag('div')            // Array.from(document.getElementsByTagName('div'))
$.children('parentId')  // Array.from of children of #parentId
```

### Element Creation

```js
const btn = $.create('button', {
  class: 'primary',
  style: { padding: '10px' },
  onclick: () => alert('clicked'),
  data: { action: 'submit' }
}, 'Click Me');

document.body.appendChild(btn);
```

### Collection Methods (on `ZQueryCollection` via `$.all()`)

**Traversal:** `find()`, `parent()`, `closest()`, `children()`, `siblings()`, `next()`, `prev()`, `filter()`, `not()`, `has()`

**Iteration:** `each()`, `map()`, `first()`, `last()`, `eq(i)`, `toArray()`

**Classes:** `addClass()`, `removeClass()`, `toggleClass()`, `hasClass()`

**Attributes:** `attr()`, `removeAttr()`, `prop()`, `data()`

**Content:** `html()`, `text()`, `val()`

**DOM Manipulation:** `append()`, `prepend()`, `after()`, `before()`, `wrap()`, `remove()`, `empty()`, `clone()`, `replaceWith()`

**CSS / Dimensions:** `css()`, `width()`, `height()`, `offset()`, `position()`

**Visibility:** `show()`, `hide()`, `toggle()`

**Events:** `on()`, `off()`, `one()`, `trigger()`, `click()`, `submit()`, `focus()`, `blur()`

**Animation:** `animate()`, `fadeIn()`, `fadeOut()`, `slideToggle()`

**Forms:** `serialize()`, `serializeObject()`

### Delegated Events

```js
// Direct event on a collection
$.all('.btn').on('click', (e) => console.log('clicked', e.target));

// Delegated event (like jQuery's .on with selector)
$.all('#list').on('click', '.item', function(e) {
  console.log('Item clicked:', this.textContent);
});

// One-time event
$.all('.btn').one('click', () => console.log('fires once'));

// Custom event
$.all('.widget').trigger('custom:update', { value: 42 });
```

### Global Delegation

```js
// Listen for clicks on any .delete-btn anywhere in the document
$.on('click', '.delete-btn', function(e) {
  this.closest('.row').remove();
});
```

### Extend Collection Prototype

```js
// Add custom methods to all collections (like $.fn in jQuery)
$.fn.highlight = function(color = 'yellow') {
  return this.css({ background: color });
};

$.all('.important').highlight('#ff0');
```

---

## Components

Declarative components with reactive state, template literals, event delegation, two-way binding, scoped styles, and lifecycle hooks. No JSX, no virtual DOM, no build step.

### Defining a Component

```js
$.component('app-counter', {
  // Initial state (object or function returning object)
  state: () => ({ count: 0, step: 1 }),

  // Lifecycle hooks
  init()      { /* runs before first render */ },
  mounted()   { /* runs after first render & DOM insert */ },
  updated()   { /* runs after every re-render */ },
  destroyed() { /* runs on destroy — clean up subscriptions */ },

  // Methods (available as this.methodName and in @event bindings)
  increment() { this.state.count += this.state.step; },
  decrement() { this.state.count -= this.state.step; },
  reset()     { this.state.count = 0; },

  // Template (required) — return an HTML string
  render() {
    return `
      <div class="counter">
        <h2>Count: ${this.state.count}</h2>
        <button @click="decrement">−</button>
        <button @click="reset">Reset</button>
        <button @click="increment">+</button>
        <input z-model="step" type="number" min="1">
      </div>
    `;
  },

  // Scoped styles (optional — auto-prefixed to this component)
  styles: `
    .counter { text-align: center; }
    button { margin: 4px; }
  `
});
```

### Mounting

```js
// Mount into a specific element
$.mount('#app', 'app-counter');

// Mount with props
$.mount('#app', 'app-counter', { initialCount: 10 });

// Auto-mount: scan DOM for registered custom tags
$.mountAll();  // finds all <app-counter> tags and mounts them
```

### Directives

| Directive | Purpose | Example |
| --- | --- | --- |
| `@event` | Delegated event binding | `@click="save"` or `@click="save(1, 'draft')"` |
| `@event.prevent` | `preventDefault()` modifier | `@submit.prevent="handleForm"` |
| `@event.stop` | `stopPropagation()` modifier | `@click.stop="toggle"` |
| `z-model` | Reactive two-way input binding | `<input z-model="name">` |
| `z-model` + `z-lazy` | Update on blur instead of every keystroke | `<input z-model="search" z-lazy>` |
| `z-model` + `z-trim` | Trim whitespace before writing to state | `<input z-model="name" z-trim>` |
| `z-model` + `z-number` | Force numeric conversion | `<input z-model="qty" z-number>` |
| `z-ref` | Element reference | `<input z-ref="emailInput">` → `this.refs.emailInput` |

### Two-Way Binding (`z-model`)

`z-model` creates a **reactive two-way sync** between a form element and a state property. When the user types, state updates; when state changes, the element updates. Other parts of the template referencing the same state value re-render instantly.

Focus and cursor position are **automatically preserved** during re-renders.

```js
$.component('profile-form', {
  state: () => ({
    user: { name: '', email: '' },
    age: 25,
    plan: 'free',
    tags: [],
  }),

  render() {
    const s = this.state;
    return `
      <!-- Text input -- live display updates as you type -->
      <input z-model="user.name" z-trim placeholder="Name">
      <p>Hello, ${s.user.name || 'stranger'}!</p>

      <!-- Nested key, email type -->
      <input z-model="user.email" type="email" placeholder="Email">

      <!-- Number -- auto-converts to Number -->
      <input z-model="age" type="number" min="0">
      <p>Age: ${s.age} (type: ${typeof s.age})</p>

      <!-- Radio group -->
      <label><input z-model="plan" type="radio" value="free"> Free</label>
      <label><input z-model="plan" type="radio" value="pro"> Pro</label>
      <p>Plan: ${s.plan}</p>

      <!-- Select multiple -- syncs as array -->
      <select z-model="tags" multiple>
        <option>javascript</option>
        <option>html</option>
        <option>css</option>
      </select>
      <p>Tags: ${s.tags.join(', ')}</p>
    `;
  }
});
```

**Supported elements:** text inputs, textarea, number/range, checkbox, radio, select, select-multiple, contenteditable.

**Nested keys:** `z-model="user.name"` binds to `this.state.user.name`.

**Modifiers:** `z-lazy` (change event), `z-trim` (strip whitespace), `z-number` (force numeric). Combinable.

### Event Arguments

```js
// Pass arguments to methods from templates
// Supports: strings, numbers, booleans, null, state references
`<button @click="remove(${item.id})">Delete</button>`
`<button @click="setFilter('active')">Active</button>`
`<button @click="update(state.count)">Update</button>`
```

### Props

Props are passed as attributes on the custom element tag or via `$.mount()`:

```js
$.component('user-card', {
  render() {
    return `<div class="card"><h3>${this.props.name}</h3></div>`;
  }
});

// Via mount
$.mount('#target', 'user-card', { name: 'Tony' });

// Via HTML tag (auto-mounted)
// <user-card name="Tony"></user-card>
```

### Instance API

```js
const instance = $.mount('#app', 'my-component');

instance.state.count = 5;          // trigger re-render
instance.setState({ count: 5 });   // batch update
instance.emit('change', { v: 1 }); // dispatch custom event (bubbles)
instance.refs.myInput.focus();      // access z-ref elements
instance.destroy();                 // teardown
```

### Getting & Destroying Instances

```js
const inst = $.getInstance('#app');  // get instance for element
$.destroy('#app');                   // destroy component at element
$.components();                      // get registry of all definitions (debug)
```

### External Templates & Styles (`templateUrl` / `styleUrl`)

Components can load their HTML templates and CSS from external files instead of defining them inline. This is useful for large components, maintaining separation of concerns, or organizing components into folder structures.

**Relative Path Resolution:**

Relative `templateUrl`, `styleUrl`, and `pages.dir` paths are automatically resolved **relative to the component file** — no extra configuration needed:

```js
// File: scripts/components/widget/widget.js
$.component('my-widget', {
  templateUrl: 'template.html',        // → scripts/components/widget/template.html
  styleUrl:    'styles.css',           // → scripts/components/widget/styles.css
});
```

> zQuery auto-detects the calling module's URL at registration time. If you need to override the resolved base, pass a `base` string (e.g. `base: 'scripts/shared/'`). Absolute paths and full URLs are never affected.

**`styleUrl`** — load styles from a CSS file:

```js
$.component('my-widget', {
  state: { title: 'Hello' },

  render() {
    return `<div class="widget"><h2>${this.state.title}</h2></div>`;
  },

  styleUrl: 'styles.css'
});
```

**`templateUrl`** — load HTML template from a file:

```js
$.component('my-widget', {
  state: { title: 'Hello', items: ['A', 'B'] },

  templateUrl: 'template.html',
  styleUrl:    'styles.css'
});
```

The template file uses `{{expression}}` interpolation to access component state:

```html
<!-- components/my-widget/template.html -->
<div class="widget">
  <h2>{{title}}</h2>
  <p>Item count: {{items.length}}</p>
</div>
```

> **Notes:**
> - If both `render()` and `templateUrl` are defined, `render()` takes priority.
> - If both `styles` and `styleUrl` are defined, they are merged.
> - Templates and styles are fetched once per component definition and cached — multiple instances share the same cache.
> - Relative paths resolve relative to the component file automatically. Absolute paths and full URLs are used as-is.
> - `{{expression}}` has access to all `state` properties via a `with(state)` context.

### Multiple Templates — `templateUrl` as object or array

`templateUrl` also accepts an **object map** or **array** of URLs. When multiple templates are loaded, they are available inside the component via `this.templates` — a keyed map you can reference in your `render()` function.

```js
// Object form — keyed by name
$.component('docs-page', {
  templateUrl: {
    'router':     'pages/router.html',
    'store':      'pages/store.html',
    'components': 'pages/components.html',
  },
  render() {
    const page = this.props.$params.section || 'router';
    return `<div>${this.templates[page]}</div>`;
  }
});

// Array form — keyed by index
$.component('multi-step', {
  templateUrl: ['pages/step1.html', 'pages/step2.html'],
  render() {
    return `<div>${this.templates[this.state.step]}</div>`;
  }
});
```

### Multiple Stylesheets — `styleUrl` as array

`styleUrl` can also accept an **array of URLs**. All stylesheets are fetched in parallel, concatenated, and scoped to the component.

```js
$.component('my-widget', {
  styleUrl: [
    '../shared/base.css',
    'styles.css',
  ],
  render() { return '<div class="widget">Content</div>'; }
});
```

### Global Stylesheets

**Recommended:** Use a standard `<link rel="stylesheet">` tag in your `index.html` `<head>` for app-wide CSS (resets, layout, themes). This is the most reliable way to prevent FOUC (Flash of Unstyled Content) because the browser loads the stylesheet before first paint — no JavaScript execution needed.

```html
<!-- index.html -->
<head>
  <link rel="stylesheet" href="styles/styles.css">
  <script src="scripts/vendor/zQuery.min.js"></script>
  <script type="module" src="scripts/app.js"></script>
</head>
```

### Additional Stylesheets — `$.style()`

`$.style()` loads **global** (unscoped) stylesheet files programmatically — useful for **dynamic theme switching**, **loading additional CSS files at runtime**, **conditional styles**, or any case where a static `<link>` tag isn't flexible enough. Paths resolve **relative to the calling file**, just like component paths.

```js
// Load a stylesheet file dynamically
$.style('themes/dark.css');

// Multiple files
$.style(['reset.css', 'theme.css']);

// Returns a handle to remove later (theme switching)
const dark = $.style('themes/dark.css');
// ... later
dark.remove();  // unloads the stylesheet

// Override global styles by loading an additional file
$.style('overrides.css');
```

> **`<link rel>` vs `$.style()` vs `styleUrl`:**
> - Use a **`<link rel="stylesheet">`** in `index.html` for global/app-wide styles — best FOUC prevention.
> - Use **`$.style()`** to dynamically load additional stylesheet files (themes, overrides, conditional styles).
> - Use **`styleUrl`** on a component definition for styles scoped to that specific component.
> - Use component **`styles`** (inline string) for scoped inline CSS within a component definition.

### Pages Config — Multi-Page Components

The `pages` option is a high-level shorthand for components that display content from multiple HTML files in a directory (e.g. documentation, wizards, tabbed content). It replaces the need to manually build a `templateUrl` object map and maintain a separate page list.

```js
// File: scripts/components/docs/docs.js
$.component('docs-page', {
  pages: {
    dir:     'pages',                  // → scripts/components/docs/pages/
    param:   'section',                // reads :section from the route
    default: 'getting-started',        // fallback when param absent
    items: [
      'getting-started',               // label auto-derived: 'Getting Started'
      'project-structure',             // label auto-derived: 'Project Structure'
      { id: 'http', label: 'HTTP Client' },
      { id: 'utils', label: 'Utilities' },
    ],
  },

  styleUrl: 'docs.css',               // → scripts/components/docs/docs.css

  render() {
    return `
      <nav>
        ${this.pages.map(p => `
          <a class="${this.activePage === p.id ? 'active' : ''}"
             z-link="/docs/${p.id}">${p.label}</a>
        `).join('')}
      </nav>
      <main>${this.templates[this.activePage] || ''}</main>
    `;
  }
});
```

The `param` property tells the component **which route parameter to read**. It must match a `:param` segment in your router config. Use `fallback` so one route handles both the bare path and the parameterized path:

```js
// routes.js
$.router({
  routes: [
    { path: '/docs/:section', component: 'docs-page', fallback: '/docs' },
  ]
});
// /docs           → activePage = default ('getting-started')
// /docs/router    → activePage = 'router'
```

| Property | Type | Description |
| --- | --- | --- |
| `dir` | `string` | Directory path containing the page HTML files (resolved via `base`) |
| `param` | `string` | Route param name — must match a `:param` segment in your route |
| `default` | `string` | Page id shown when the route param is absent |
| `ext` | `string` | File extension (default `'.html'`) |
| `items` | `Array` | Page ids (strings) and/or `{id, label}` objects |

> **How it works:** Under the hood, `pages` auto-generates a `templateUrl` object map (`{ id: 'dir/id.html' }`) and normalizes the items into a `{id, label}` array. String ids auto-derive labels by converting kebab-case to Title Case (e.g. `'getting-started'` → `'Getting Started'`). The component then exposes `this.pages`, `this.activePage`, and `this.templates` inside `render()`.

---

## Router

Client-side SPA router supporting both history mode and hash mode, with route params, query strings, navigation guards, and lazy loading.

### Setup

```js
const router = $.router({
  el: '#app',                         // outlet element
  mode: 'history',                    // 'history' (default) or 'hash'
  base: '/my-app',                    // base path for sub-directory deployments
  routes: [
    { path: '/',           component: 'home-page' },
    { path: '/user/:id',   component: 'user-page' },
    { path: '/settings',   component: 'settings-page' },
  ],
  fallback: 'not-found'              // 404 component
});
```

### Route Definitions

```js
{
  path: '/user/:id',       // :param for dynamic segments
  component: 'user-page',  // registered component name (string)
  load: () => import('./pages/user.js'),  // lazy load module before mount
}
```

- **`path`** — URL pattern. Use `:param` for named params, `*` for wildcard.
- **`component`** — registered component name (string) or a render function `(route) => htmlString`.
- **`load`** — optional async function for lazy loading (called before component mount).
- **`fallback`** — an additional path that also matches this route. When matched via fallback, missing params are `undefined`. Useful for pages-config components: `{ path: '/docs/:section', fallback: '/docs' }`.

### Navigation

```js
router.navigate('/user/42');            // push + resolve
router.replace('/login');               // replace current history entry
router.back();                          // history.back()
router.forward();                       // history.forward()
router.go(-2);                          // history.go(n)
```

### Navigation Links (HTML)

```html
<!-- z-link attribute for SPA navigation (no page reload) -->
<a z-link="/">Home</a>
<a z-link="/user/42">Profile</a>
```

### Route Params & Query

Inside a routed component, params and query are available as props:

```js
$.component('user-page', {
  render() {
    const userId = this.props.$params.id;
    const tab = this.props.$query.tab || 'overview';
    return `<h1>User ${userId}</h1><p>Tab: ${tab}</p>`;
  }
});
```

### Navigation Guards

```js
// Before guard — return false to cancel, string to redirect
router.beforeEach((to, from) => {
  if (to.path === '/admin' && !isLoggedIn()) {
    return '/login';  // redirect
  }
});

// After guard — analytics, etc.
router.afterEach((to, from) => {
  trackPageView(to.path);
});
```

### Route Change Listener

```js
const unsub = router.onChange((to, from) => {
  console.log(`Navigated: ${from?.path} → ${to.path}`);
});
// unsub() to stop listening
```

### Current Route

```js
router.current   // { route, params, query, path }
router.path       // current path string
router.query      // current query as object
```

### Dynamic Routes

```js
router.add({ path: '/new-page', component: 'new-page' });
router.remove('/old-page');
```

### Sub-Path Deployment & `<base href>`

When deploying under a sub-directory (e.g. `https://example.com/my-app/`), the router **auto-detects** `<base href>` — no extra code needed.

**Option 1 — HTML `<base href>` tag (recommended):**

Add a `<base href>` tag to your `index.html`:

```html
<head>
  <base href="/my-app/">
  <!-- ... -->
</head>
```

The router reads this automatically. No changes to `app.js` required — just call `$.router()` as usual:

```js
$.router({ el: '#app', routes, fallback: 'not-found' });
```

**Option 2 — Explicit `base` option:**

```js
$.router({ el: '#app', base: '/my-app', routes: [...] });
```

> **Tip:** Using `<base href>` is preferred because it also controls how the browser resolves relative URLs for scripts, stylesheets, images, and fetch requests — keeping all path configuration in one place. The router checks `config.base` → `window.__ZQ_BASE` → `<base href>` tag, in that order.

For history mode, configure your server to rewrite all non-file requests to `index.html`. Example `.htaccess`:

```
RewriteEngine On
RewriteBase /my-app/
RewriteCond %{REQUEST_FILENAME} -f
RewriteRule ^ - [L]
RewriteRule ^ index.html [L]
```

---

## Store

Lightweight global state management with reactive proxies, named actions, computed getters, middleware, and subscriptions.

### Setup

```js
const store = $.store({
  state: {
    count: 0,
    user: null,
    todos: [],
  },

  actions: {
    increment(state)       { state.count++; },
    setUser(state, user)   { state.user = user; },
    addTodo(state, text)   {
      const raw = state.todos.__raw || state.todos;
      state.todos = [...raw, { id: Date.now(), text, done: false }];
    },
  },

  getters: {
    doubleCount: (state) => state.count * 2,
    doneCount:   (state) => state.todos.filter(t => t.done).length,
  },

  debug: true,  // logs actions to console
});
```

### Dispatching Actions

```js
store.dispatch('increment');
store.dispatch('setUser', { name: 'Tony', role: 'admin' });
store.dispatch('addTodo', 'Write documentation');
```

### Reading State

```js
store.state.count          // reactive — triggers subscribers on change
store.getters.doubleCount  // computed from state
store.snapshot()           // deep-cloned plain object
```

### Subscriptions

```js
// Subscribe to a specific key
const unsub = store.subscribe('count', (newVal, oldVal, key) => {
  console.log(`count changed: ${oldVal} → ${newVal}`);
});

// Wildcard — subscribe to all changes
store.subscribe((key, newVal, oldVal) => {
  console.log(`${key} changed`);
});

unsub(); // unsubscribe
```

### Using Store in Components

```js
$.component('my-widget', {
  mounted() {
    // Re-render when store key changes
    this._unsub = store.subscribe('count', () => {
      this._scheduleUpdate();
    });
  },

  destroyed() {
    this._unsub?.();
  },

  render() {
    return `<p>Count: ${store.state.count}</p>`;
  }
});
```

### Middleware

```js
store.use((actionName, args, state) => {
  console.log(`[middleware] ${actionName}`, args);
  // return false to block the action
});
```

### Named Stores

```js
const userStore = $.store('users', { state: { list: [] }, actions: { ... } });
const appStore  = $.store('app',   { state: { theme: 'dark' }, actions: { ... } });

// Retrieve later
$.getStore('users');
$.getStore('app');
```

### State Management

```js
store.replaceState({ count: 0, user: null, todos: [] });
store.reset({ count: 0, user: null, todos: [] });  // also clears history
store.history;  // array of { action, args, timestamp }
```

---

## HTTP Client

A lightweight fetch wrapper providing auto-JSON serialization, interceptors, timeout/abort support, and a clean chainable API.

### Basic Requests

```js
// GET with query params
const res = await $.get('/api/users', { page: 1, limit: 10 });
console.log(res.data);  // parsed JSON

// POST with JSON body
const created = await $.post('/api/users', { name: 'Tony', email: 'tony@example.com' });

// PUT, PATCH, DELETE
await $.put('/api/users/1', { name: 'Updated' });
await $.patch('/api/users/1', { email: 'new@example.com' });
await $.delete('/api/users/1');
```

### Configuration

```js
$.http.configure({
  baseURL: 'https://api.example.com',
  headers: { Authorization: 'Bearer token123' },
  timeout: 15000,  // ms (default: 30000)
});
```

### Interceptors

```js
// Request interceptor
$.http.onRequest((fetchOpts, url) => {
  fetchOpts.headers['X-Request-ID'] = $.uuid();
  // return false to block | return { url, options } to modify
});

// Response interceptor
$.http.onResponse((result) => {
  if (result.status === 401) {
    window.location.href = '/login';
  }
});
```

### Abort / Cancel

```js
const controller = $.http.createAbort();

$.get('/api/slow', null, { signal: controller.signal })
  .catch(err => console.log('Aborted:', err.message));

// Cancel after 2 seconds
setTimeout(() => controller.abort(), 2000);
```

### Response Object

Every request resolves with:

```js
{
  ok: true,              // response.ok
  status: 200,           // HTTP status code
  statusText: 'OK',
  headers: { ... },      // parsed headers object
  data: { ... },         // auto-parsed body (JSON, text, or blob)
  response: Response,    // raw fetch Response object
}
```

### FormData Upload

```js
const formData = new FormData();
formData.append('file', fileInput.files[0]);
await $.post('/api/upload', formData);
// Content-Type header is automatically removed so the browser sets multipart boundary
```

### Raw Fetch

```js
const raw = await $.http.raw('/api/stream', { method: 'GET' });
const reader = raw.body.getReader();
```

---

## Reactive Primitives

### Deep Reactive Proxy

```js
const data = $.reactive({ user: { name: 'Tony' } }, (key, value, old) => {
  console.log(`${key} changed: ${old} → ${value}`);
});

data.user.name = 'Updated';  // triggers callback
data.__isReactive;            // true
data.__raw;                   // original plain object
```

### Signals

Lightweight reactive primitives inspired by Solid/Preact signals:

```js
const count = $.signal(0);

// Auto-tracking effect
$.effect(() => {
  console.log('Count is:', count.value);  // runs immediately, re-runs on change
});

count.value = 5;  // triggers the effect

// Computed signal (derived)
const doubled = $.computed(() => count.value * 2);
console.log(doubled.value);  // 10

// Manual subscription
const unsub = count.subscribe(() => console.log('changed'));

// Peek without tracking
count.peek();  // returns value without subscribing
```

---

## Utilities

All utilities are available on the `$` namespace.

### Function Utilities

```js
// Debounce — delays until ms of inactivity
const search = $.debounce((query) => fetchResults(query), 300);
search('hello');
search.cancel();  // cancel pending call

// Throttle — max once per ms
const scroll = $.throttle(() => updatePosition(), 100);

// Pipe — left-to-right function composition
const transform = $.pipe(trim, lowercase, capitalize);
transform('  HELLO  ');  // 'Hello'

// Once — only runs the first time
const init = $.once(() => { /* heavy setup */ });

// Sleep — async delay
await $.sleep(1000);
```

### String Utilities

```js
$.escapeHtml('<script>alert("xss")</script>');
// &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;

// Template tag with auto-escaping
const safe = $.html`<div>${userInput}</div>`;

// Mark trusted HTML (skips escaping)
const raw = $.trust('<strong>Bold</strong>');
const output = $.html`<div>${raw}</div>`;  // <div><strong>Bold</strong></div>

$.uuid();                    // 'a1b2c3d4-...'
$.camelCase('my-component'); // 'myComponent'
$.kebabCase('myComponent');  // 'my-component'
```

### Object Utilities

```js
const clone = $.deepClone({ nested: { value: 1 } });
const merged = $.deepMerge({}, defaults, userConfig);
$.isEqual({ a: 1 }, { a: 1 });  // true
```

### URL Utilities

```js
$.param({ page: 1, sort: 'name' });  // 'page=1&sort=name'
$.parseQuery('page=1&sort=name');     // { page: '1', sort: 'name' }
```

### Storage Wrappers

```js
// localStorage with auto JSON serialization
$.storage.set('user', { name: 'Tony', prefs: { theme: 'dark' } });
$.storage.get('user');           // { name: 'Tony', prefs: { theme: 'dark' } }
$.storage.get('missing', []);    // [] (fallback)
$.storage.remove('user');
$.storage.clear();

// sessionStorage (same API)
$.session.set('token', 'abc123');
$.session.get('token');
```

### Event Bus

Global pub/sub for cross-component communication without direct coupling:

```js
// Subscribe
const unsub = $.bus.on('user:login', (user) => {
  console.log('Logged in:', user.name);
});

// Emit
$.bus.emit('user:login', { name: 'Tony' });

// One-time listener
$.bus.once('app:ready', () => { /* runs once */ });

// Unsubscribe
unsub();
$.bus.off('user:login', handler);
$.bus.clear();  // remove all listeners
```

---

## DOM Ready

```js
// Shorthand (pass function to $)
$(() => {
  console.log('DOM ready');
});

// Explicit
$.ready(() => {
  console.log('DOM ready');
});
```

---

## No-Conflict Mode

```js
const mq = $.noConflict();  // removes $ from window, returns the library
mq('.card').addClass('active');
```

---

## Building from Source

```bash
# One-time library build
node build.js
# → dist/zQuery.js  (development)
# → dist/zQuery.min.js  (production)

# Or use the CLI
npx zquery build
```

> **Note:** `npx zquery build` and `node build.js` must be run from the zero-query project root (where `src/` and `index.js` live). If you've added a `build` script to your own `package.json`, `npm run build` handles the working directory for you.

The build script is zero-dependency — just Node.js. It concatenates all ES modules into a single IIFE and strips import/export statements. The minified version strips comments and collapses whitespace. For production builds, pipe through Terser for optimal compression.

---

## Running the Starter App

```bash
# From the project root
node build.js                                    # build the library
cp dist/zQuery.min.js examples/starter-app/scripts/vendor/  # copy to app

# Start the dev server with live-reload (port 3100)
npm run dev
# → http://localhost:3100

# Or use any static server
npx serve examples/starter-app
```

The starter app includes: Home, Counter (reactive state + z-model), Todos (global store + subscriptions), API Docs (full reference), and About pages.

#### Bundled Version (Single-File)

You can also build a fully self-contained bundled version of the starter app:

```bash
npm run bundle:app

# Deploy the server build
# → dist/server/index.html (with <base href="/"> for web servers)

# Or open the local build from disk — no server needed
start examples/starter-app/dist/local/index.html
```

See [CLI Bundler](#cli-bundler-optional) for details.

### Dev Server (Live Reload)

The CLI includes a built-in dev server powered by [zero-http](https://github.com/tonywied17/zero-http). It provides SPA fallback routing, a file watcher, and **automatic live-reload** — the browser refreshes on every save.

```bash
# Start the dev server (auto-detects index.html in cwd)
npx zquery dev
# → http://localhost:3100

# Custom port
npx zquery dev --port 8080

# Serve a specific project folder
npx zquery dev path/to/my-app

# Watch mode — auto-rebuild bundle on file changes
npx zquery bundle --watch
```

**How it works:** The server injects a tiny SSE (Server-Sent Events) client into the served HTML at runtime. A file watcher monitors your project for changes to `.js`, `.css`, `.html`, `.json`, and `.svg` files and pushes reload events to the browser. CSS changes are hot-swapped without a full reload — everything else triggers a page refresh. Your source files are never modified; the snippet is only injected into the HTTP response.

`zquery dev` gives the fastest feedback loop — edit your ES module source files and watch the browser update instantly. Use `zquery bundle --watch` when you need the bundled output to update automatically as you work.

### Production Deployment

For production, use the bundled `dist/server/` output. It includes `<base href="/">` so deep-route refreshes resolve assets correctly. Configure your web server to rewrite non-file requests to `index.html`:

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

**Sub-path deployment** (e.g. hosted at `/my-app/`):

Set `<base href="/my-app/">` in your HTML `<head>` — the router auto-detects it. Or pass `base` explicitly:

```js
$.router({ el: '#app', base: '/my-app', routes });
```

```apache
# Apache — adjust RewriteBase
RewriteBase /my-app/
```

```nginx
# Nginx — adjust location block
location /my-app/ {
    try_files $uri $uri/ /my-app/index.html;
}
```

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
| `$.style` | Dynamically load additional global (unscoped) stylesheet file(s) — paths resolve relative to the calling file |
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

| CLI | Description |
| --- | --- |
| `zquery build` | Build the zQuery library (`dist/zQuery.min.js`) |
| `zquery bundle [entry]` | Bundle app ES modules into a single IIFE file |
| `zquery dev [root]` | Start a dev server with live-reload (port 3100) |
| `zquery --help` | Show CLI usage and options |

For full method signatures and options, see [API.md](API.md).

---

## Editor Support

The official **[zQuery for VS Code](https://marketplace.visualstudio.com/items?itemName=zQuery.zquery-vs-code)** extension for Visual Studio Code provides:

- **Autocomplete** for `$.*`, `$.http.*`, `$.storage.*`, `$.bus.*`, and 50+ collection chain methods
- **Hover documentation** with signatures and code examples for every method and directive
- **HTML directive support** — completions and docs for `@event` handlers, `z-model`, `z-ref`, `z-link`
- **55+ code snippets** — type `zq-` for components, router, store, HTTP, signals, and more

Install it from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=zQuery.zquery-vs-code) or search **"zQuery for VS Code"** in the Extensions view.

---

## License

MIT — [Anthony Wiedman / Molex](https://github.com/tonywied17)
