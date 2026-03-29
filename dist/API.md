# zQuery (zeroQuery) - Full API Reference

Complete API documentation for every module, method, option, and type in zQuery. All examples assume the global `$` is available via the built `zquery.min.js` bundle. For getting started, project setup, the dev server, and the CLI bundler, see [README.md](README.md).

> **Editor Support:** Install the [zQuery for VS Code](https://marketplace.visualstudio.com/items?itemName=zQuery.zquery-vs-code) extension for autocomplete, hover docs, directive support, and 185+ code snippets.

---

## Table of Contents

- [Router](#router)
  - [Setup](#setup)
  - [Config Options](#config-options)
  - [Routing Modes](#routing-modes)
  - [Route Definitions](#route-definitions)
  - [Route Matching](#route-matching)
  - [Navigation](#navigation)
  - [Navigation Links - z-link](#navigation-links-z-link)
  - [Scroll to Top - z-to-top](#scroll-to-top-z-to-top)
  - [Active Route - z-active-route](#active-route-z-active-route)
  - [Route Params & Query](#route-params-query)
  - [Lazy Loading](#lazy-loading)
  - [Render Functions](#render-functions)
  - [Navigation Guards](#navigation-guards)
  - [Change Listener](#change-listener)
  - [Current Route State](#current-route-state)
  - [matchRoute()](#matchroute)
  - [Dynamic Route Management](#dynamic-route-management)
  - [Hash Fragments](#hash-fragments)
  - [Sub-Route History Substates](#sub-route-history-substates)
  - [Cleanup & Destroy](#cleanup-destroy)
  - [How Navigation Works](#how-navigation-works)
  - [Full Example](#full-example)
- [Components](#components)
  - [Your First Component](#your-first-component)
  - [Anatomy of a Component](#anatomy-of-a-component)
  - [State & Reactivity](#state-reactivity)
  - [Computed Properties](#computed-properties)
  - [Watchers](#watchers)
  - [Templates](#templates)
  - [Events & Forms](#events-forms)
  - [Lifecycle](#lifecycle)
  - [Props & Communication](#props-communication)
  - [Scoped Styles](#scoped-styles)
  - [DOM Morphing](#dom-morphing)
  - [Mounting & Instance API](#mounting-instance-api)
  - [Quick Reference](#quick-reference)
- [Directives](#directives)
  - [Quick Reference](#quick-reference)
  - [z-if / z-else-if / z-else](#z-if-z-else-if-z-else)
  - [z-for](#z-for)
  - [z-key](#z-key)
  - [z-show](#z-show)
  - [z-bind / :attr](#z-bind-attr)
  - [z-class](#z-class)
  - [z-style](#z-style)
  - [z-html & z-text](#z-html-z-text)
  - [Event Binding (@event)](#event-binding-event)
  - [z-model](#z-model)
  - [z-ref](#z-ref)
  - [z-cloak](#z-cloak)
  - [z-pre](#z-pre)
  - [z-skip](#z-skip)
  - [Expression Context](#expression-context)
  - [External Templates](#external-templates)
  - [Processing Order](#processing-order)
- [Store](#store)
  - [Setup](#setup)
  - [Dispatching Actions](#dispatching-actions)
  - [Reading State & Getters](#reading-state-getters)
  - [Subscriptions](#subscriptions)
  - [Middleware](#middleware)
  - [Named Stores](#named-stores)
  - [Async Actions](#async-actions)
  - [Batch Updates](#batch-updates)
  - [Checkpoint / Undo / Redo](#checkpoint-undo-redo)
  - [State Utilities](#state-utilities)
  - [Error Resilience](#error-resilience)
  - [Using Store in Components](#using-store-in-components)
  - [Quick Reference](#quick-reference)
- [HTTP Client](#http-client)
  - [Request Methods](#request-methods)
  - [Configuration](#configuration)
  - [Response Object](#response-object)
  - [Auto-Parsing](#auto-parsing)
  - [Interceptors](#interceptors)
  - [Abort / Cancel](#abort-cancel)
  - [FormData & String Bodies](#formdata-string-bodies)
  - [Error Handling](#error-handling)
  - [Per-Request Options](#per-request-options)
  - [Parallel Requests](#parallel-requests)
  - [Raw Fetch Passthrough](#raw-fetch-passthrough)
- [Reactive](#reactive)
  - [$.reactive()](#reactive)
  - [$.Signal](#signal)
  - [$.signal()](#signal)
  - [$.computed()](#computed)
  - [$.effect()](#effect)
  - [$.batch()](#batch)
  - [$.untracked()](#untracked)
  - [Summary](#summary)
  - [How Auto-Tracking Works](#how-auto-tracking-works)
  - [Error Resilience](#error-resilience)
  - [Quick Reference](#quick-reference)
- [Selectors & Collections](#selectors-collections)
  - [$() Main Selector](#main-selector)
  - [Raw-Element Shortcuts](#raw-element-shortcuts)
  - [Multi-Element Shortcuts](#multi-element-shortcuts)
  - [Collection Methods](#collection-methods)
  - [Element Creation](#element-creation)
  - [Animations](#animations)
  - [Form Helpers](#form-helpers)
  - [DOM Ready & Plugins](#dom-ready-plugins)
  - [Native DOM Equivalents](#native-dom-equivalents)
- [Utilities](#utilities)
  - [Function Utilities](#function-utilities)
  - [String Utilities](#string-utilities)
  - [Object Utilities](#object-utilities)
  - [Array Utilities](#array-utilities)
  - [Number Utilities](#number-utilities)
  - [Async Utilities](#async-utilities)
  - [URL Utilities](#url-utilities)
  - [Storage Wrappers](#storage-wrappers)
  - [Event Bus](#event-bus)
  - [Global Helpers](#global-helpers)
  - [Quick Reference](#quick-reference)
- [Error Handling](#error-handling)
  - [What Gets Caught](#what-gets-caught)
  - [Syntax Error Code Frames](#syntax-error-code-frames)
  - [Framework Error Codes](#framework-error-codes)
  - [Context Metadata](#context-metadata)
  - [Dismissing & Auto-Clear](#dismissing-auto-clear)
  - [Programmatic Error Handling](#programmatic-error-handling)
  - [Error Utilities](#error-utilities)
  - [formatError()](#formaterror)
  - [guardAsync()](#guardasync)
  - [All Error Codes](#all-error-codes)
- [Server-Side Rendering (SSR)](#server-side-rendering-ssr)
  - [Overview](#overview)
  - [SSR Scaffold](#ssr-scaffold)
  - [createSSRApp()](#createssrapp)
  - [Registering Components](#registering-components)
  - [renderToString()](#rendertostring)
  - [renderPage()](#renderpage)
  - [renderBatch()](#renderbatch)
  - [renderShell()](#rendershell)
  - [Hydration](#hydration)
  - [Error Handling in SSR](#error-handling-in-ssr)
  - [escapeHtml()](#escapehtml)
  - [matchRoute()](#matchroute)
- [Security](#security)
  - [Overview](#overview)
  - [Template Expression Escaping](#template-expression-escaping)
  - [z-html & Trusted HTML](#z-html-trusted-html)
  - [Expression Sandbox](#expression-sandbox)
  - [Prototype Pollution Prevention](#prototype-pollution-prevention)
  - [Route Link Validation](#route-link-validation)
  - [SSR Error Sanitization](#ssr-error-sanitization)
  - [Best Practices](#best-practices)
  - [Quick Reference](#quick-reference)

---

## Router

  
Client-side SPA router with history and hash mode, dynamic params, query strings, navigation guards, lazy loading, and lifecycle hooks. Handles `z-link` interception, `popstate`/`hashchange` events, and component mounting automatically.

  
### Setup

  
Place a `` element in your HTML — the router auto-detects it as the mount point:

  

```html
<!-- index.html -->
<z-outlet></z-outlet>
```

  

```javascript
const router = $.router({
  routes: [
    { path: '/',           component: 'home-page' },
    { path: '/user/:id',   component: 'user-page' },
    { path: '/settings',   component: 'settings-page' },
    { path: '/admin/*',    component: 'admin-page' },  // wildcard
  ],
  fallback: 'not-found'    // 404 component (when no route matches)
});
```

  
> **Tip:** **Recommended:** Use `` in your HTML rather than passing `el` in JavaScript. The router auto-detects it, keeping your JS cleaner and your outlet visible in markup. You can still pass `el` to override if needed.

  
### Config Options

  
| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `el` | `string \| Element` | `z-outlet` | The DOM element (or selector) where matched components are mounted. **Auto-detects** `` if omitted — only needed when using a custom container. |
| `mode` | `'history' \| 'hash'` | `'history'` | **History mode** uses clean URLs (`/about`) and requires server-side fallback. **Hash mode** uses `#/about` and works on any static host. |
| `base` | `string` | `''` | Base path prefix for sub-directory deployments. **Auto-detected** from `` if not set (also checks `window.__ZQ_BASE`). Trailing slash is removed. |
| `routes` | `Array` | `[]` | Array of route definitions (see below) |
| `fallback` | `string \| null` | `null` | Component name to mount when no route matches (404 page) |

  
### Routing Modes

  
| Mode | URL Format | Event | Server Config? |
| --- | --- | --- | --- |
| `history` (default) | `/about` | `popstate` | Yes — needs a catch-all rewrite rule so direct URLs don’t 404 |
| `hash` | `#/about` | `hashchange` | No — works on any static host |

  
**Base path detection** follows this priority: `config.base` → `window.__ZQ_BASE` → `` tag. The trailing slash is always stripped.

  
> **Tip:** **file:// auto-switch:** If the page is opened from disk (`file://` protocol), zQuery automatically forces hash mode regardless of what you set in `mode`. This means your app works instantly by double-clicking the HTML file — no server needed during development.

  

```javascript
// History mode - clean URLs (requires server fallback)
$.router({ mode: 'history', routes: [...] });

// Hash mode - works anywhere
$.router({ mode: 'hash', routes: [...] });

// Sub-directory deployment
$.router({ base: '/my-app', routes: [...] });

// Or set the base globally (useful for build tools)
window.__ZQ_BASE = '/my-app';

// Custom outlet (override auto-detection)
$.router({ el: '#my-container', routes: [...] });
```

  
### Route Definitions

  
| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `path` | `string` | Yes | URL pattern. Use `:param` for dynamic segments and `*` for wildcards. |
| `component` | `string \| function` | Yes | Registered component name, or a render function `(route) => htmlString`. |
| `load` | `() => Promise` | No | Lazy-load function called before mounting (see **Lazy Loading**). |
| `fallback` | `string` | No | An additional bare path that also mounts the same component. Useful when a `:param` route should also match without the param. |

  

```javascript
// Examples of route definitions:
{ path: '/',              component: 'home-page' }            // exact match
{ path: '/user/:id',      component: 'user-page' }            // dynamic param
{ path: '/user/:id/posts', component: 'user-posts' }          // multi-segment
{ path: '/docs/:section', component: 'docs-page',             // fallback path
                           fallback: '/docs' }
{ path: '/docs/*',         component: 'docs-page' }           // wildcard catch-all
{ path: '/lazy',           component: 'lazy-page',            // lazy-loaded
                            load: () => import('./lazy.js') }
{ path: '/preview',        component: (route) =>              // render function
                            `<h1>Preview: ${route.path}</h1>` }
```

  
### Route Matching

  
Routes are tested in **registration order** — the first match wins. Place specific routes before general ones.

  
| Pattern | Matches | Example |
| --- | --- | --- |
| `/about` | Exact path only | `/about` ✓   `/about/team` ✗ |
| `/user/:id` | One dynamic segment | `/user/42` ✓   params: `{ id: "42" }` |
| `/post/:postId/comment/:commentId` | Multiple dynamic segments | `/post/5/comment/99` ✓ |
| `/docs/*` | Everything after prefix | `/docs/api/router` ✓   captures: `"api/router"` |

  
> **Order matters:** Define `/user/settings` *before* `/user/:id`, otherwise `/user/settings` is captured by the `:id` param. Wildcards (`*`) should always be last.

  
When no route matches, the `fallback` component is mounted (your 404 page). If no fallback is configured, the outlet is left empty.

  
### Navigation

  
`navigate()` pushes a new history entry; `replace()` replaces the current one (no back-button entry). Both accept a path and an optional options object.

  
| Navigate Option | Type | Description |
| --- | --- | --- |
| `params` | `Object` | Fills `:param` placeholders in the path. Values are URI-encoded automatically. |
| `state` | `any` | Data passed to `history.pushState` / `replaceState`. |
| `force` | `boolean` | Force navigation even if the target URL matches the current one (`false` by default). |

  

```javascript
// Simple navigation
router.navigate('/about');

// Dynamic params
router.navigate('/user/:id', { params: { id: 42 } });
// → /user/42

// Multiple params
router.navigate('/post/:postId/comment/:commentId', {
  params: { postId: 5, commentId: 99 }
});

// Replace (redirect - no back-button entry)
router.replace('/dashboard');
router.replace('/user/:id', { params: { id: 42 } });

// With history state
router.navigate('/user/:id', {
  params: { id: 42 },
  state: { from: 'user-list' }
});
```

  
| Method | Description |
| --- | --- |
| `back()` | Go back one entry |
| `forward()` | Go forward one entry |
| `go(n)` | Go `n` entries (negative = back) |
| `add(route)` | Add a route definition at runtime (see **Dynamic Route Management**) |
| `remove(path)` | Remove a route by path |
| `resolve(path)` | Resolve an app-relative path to a full URL path (including base) |
| `destroy()` | Tear down the router and all listeners (see **Cleanup**) |
| `pushSubstate(key, data?)` | Push a sub-route history entry (see **Substates**) |
| `onSubstate(fn)` | Listen for substate pops. Returns unsubscribe function. |

  
> **Tip:** **navigate vs replace:** Use `navigate()` for normal links (creates a back-button entry). Use `replace()` for redirects, post-login flows, and tab switches where "back" shouldn’t revisit the previous state.

  
> **Same-path deduplication:** Calling `navigate()` with the same URL that is already active is a no-op — no duplicate history entry is created. Hash-only changes on the same route (e.g. `/docs` → `/docs#api`) use `replaceState` so the back button returns to the *previous route*, not the previous scroll position. Pass `{ force: true }` to override.

  
All navigation methods return the router instance — calls can be chained:

  

```javascript
router.navigate('/home').back();
router.add({ path: '/new', component: 'new-page' }).navigate('/new');
```

  
### Navigation Links — `z-link`

  
Add `z-link` to any element for SPA navigation. Clicks are intercepted and routed client-side — no full page reload.

  

```html
<!-- Static paths -->
<a z-link="/">Home</a>
<a z-link="/about">About</a>
<a z-link="/settings?tab=general">Settings</a>

<!-- Dynamic in render() - use template literals -->
<a z-link="/user/${user.id}">${user.name}</a>

<!-- Dynamic in HTML templates - use :z-link binding -->
<a :z-link="'/user/' + state.userId">View Profile</a>

<!-- Named params - keep the pattern readable -->
<a z-link="/user/:id" z-link-params='{"id": "42"}'>User 42</a>
<a z-link="/post/:postId/comment/:commentId"
   z-link-params='{"postId": "5", "commentId": "99"}'>Comment</a>
```

  
| Approach | Best For |
| --- | --- |
| `z-link="/user/\${id}"` | Template literals inside `render()` — simplest |
| `:z-link="expr"` | External HTML templates using the directive system |
| `z-link-params='{}' ` | Route patterns with many `:param` segments — keeps the path readable |

  
> **Tip:** **Modifier-key bypass:** Ctrl+click, Cmd+click, Shift+click, Alt+click, and `target="_blank"` links are left alone — they open in a new tab as expected. Malformed `z-link-params` JSON is gracefully ignored.

  
> **Warning:** **Internal routes only:** `z-link` accepts only internal route paths. Protocol schemes like `http:`, `javascript:`, and `data:` are automatically rejected. Use regular `` tags for external links.

  
### Scroll to Top — `z-to-top`

  
Add `z-to-top` to a `z-link` to scroll to the top after navigation. Defaults to `"instant"`; set `"smooth"` for animated scrolling. Omit it entirely to preserve scroll position (useful for tabs / sub-views).

  

```html
<a z-link="/" z-to-top>Home</a>
<a z-link="/about" z-to-top="instant">About</a>
<a z-link="/docs" z-to-top="smooth">API Docs</a>
```

  
### Active Route — `z-active-route`

  
Automatically toggle a CSS class on elements based on whether their route matches the current path. Similar to Angular’s `routerLinkActive` directive. Processed after every route resolution.

  
| Attribute | Required | Description |
| --- | --- | --- |
| `z-active-route="/path"` | Yes | The path to match against. **Prefix match** by default (e.g. `/docs` matches `/docs/intro`). |
| `z-active-class="className"` | No | Custom class to toggle (default: `active`). |
| `z-active-exact` | No | Require exact path match instead of prefix match. |

  

```html
<!-- Basic: adds "active" class when on /docs or any /docs/* subpath -->
<a z-link="/docs" z-active-route="/docs">Docs</a>

<!-- Custom class name -->
<a z-link="/about" z-active-route="/about" z-active-class="selected">About</a>

<!-- Exact match only (won't match /docs/intro, only /docs) -->
<a z-link="/docs" z-active-route="/docs" z-active-exact>Docs</a>

<!-- Home link: use z-active-exact so it doesn't match every route -->
<a z-link="/" z-active-route="/" z-active-exact>Home</a>

<!-- Works on any element, not just links -->
<li z-active-route="/settings" z-active-class="nav-highlight">
  <a z-link="/settings">Settings</a>
</li>
```

  

```html
<!-- Full nav example -->
<nav>
  <a z-link="/" z-active-route="/" z-active-exact>Home</a>
  <a z-link="/docs" z-active-route="/docs">Docs</a>
  <a z-link="/about" z-active-route="/about">About</a>
</nav>
```

  
> **Root path special case:** The root path `/` only matches itself, never prefixes other paths. This prevents every link from being marked active. Use `z-active-exact` on root links for clarity.

  
> **Tip:** Unlike Angular’s `routerLinkActive` which infers the route from `routerLink`, zQuery uses an explicit path in `z-active-route`. This lets you apply the active class to *any* element, not just links.

  
### Route Params & Query

  
The router passes route info as special props to mounted components. Params are always strings.

  
| Prop | Description |
| --- | --- |
| `this.props.$params` | Dynamic route parameters — `{ id: '42' }` from `/user/:id` |
| `this.props.$query` | Parsed query string — `{ tab: 'general' }` from `?tab=general` |
| `this.props.$route` | Full route object: `{ route, params, query, path }` |
| `this.props.{param}` | Params are also spread as top-level props — `this.props.id` |

  

```javascript
// Route: { path: '/user/:id', component: 'user-page' }
// URL:   /user/42?tab=posts

$.component('user-page', {
  state: () => ({ user: null }),
  async mounted() {
    const res = await fetch(`/api/users/${this.props.id}`);
    this.state.user = await res.json();
  },
  render() {
    const { id } = this.props.$params;
    const tab = this.props.$query.tab || 'profile';
    return `
      <h1>User ${id}</h1>
      <nav>
        <a z-link="/user/${id}?tab=profile">Profile</a>
        <a z-link="/user/${id}?tab=posts">Posts</a>
      </nav>
      <p>Active tab: ${tab}</p>
    `;
  }
});
```

  
### Lazy Loading

  
Use the `load` property on a route to defer its module import until the route is first visited. This keeps your initial bundle small and loads heavy pages on demand.

  

```javascript
const router = $.router({
  routes: [
    { path: '/',      component: 'home-page' },
    { path: '/dashboard', component: 'dashboard-page',
      load: () => import('./pages/dashboard.js') },
    { path: '/reports',   component: 'reports-page',
      load: () => import('./pages/reports.js') },
  ]
});
```

  
`load()` is called **once**, right before the component mounts — after guards pass but before rendering. If the promise rejects (e.g. network error), navigation is aborted and the current route stays active.

  
> **Tip:** **Code-splitting tip:** Each `import()` becomes a separate chunk when you bundle. Group related components into one file or split every page — whatever fits your app size.

  
### Render Functions

  
For lightweight routes that don’t need a full component, pass a function instead of a component name. It receives the route context and returns an HTML string.

  

```javascript
const router = $.router({
  routes: [
    { path: '/',      component: 'home-page' },
    { path: '/preview/:id', component: (route) => `
      <div class="preview">
        <h1>Preview</h1>
        <p>Viewing item ${route.params.id}</p>
        <p>Query: ${JSON.stringify(route.query)}</p>
      </div>
    `},
  ]
});
```

  
> **No lifecycle:** Render functions inject raw HTML into the outlet — no `mounted`, `destroyed`, or reactive state. Use them for static preview pages, simple redirects, or placeholder content. For anything interactive, use a registered component.

  
### Navigation Guards

  
Intercept navigation to protect routes, redirect, or run side effects. Guards can be `async`.

  
| Guard | Runs | Can Cancel/Redirect? |
| --- | --- | --- |
| `beforeEach(fn)` | **Before** the route changes | Yes — return `false` to cancel, a path string to redirect |
| `afterEach(fn)` | **After** the component mounts | No — for analytics, scroll restoration, title updates |

  

```javascript
// Protect a route
router.beforeEach((to, from) => {
  if (to.path.startsWith('/admin') && !isLoggedIn()) return '/login';
});

// Confirm unsaved changes
router.beforeEach((to, from) => {
  if (hasUnsavedChanges && !confirm('Discard changes?')) return false;
});

// Async guard
router.beforeEach(async (to) => {
  if (to.path.startsWith('/admin') && !(await verifyToken())) return '/login';
});

// After-navigation side effects
router.afterEach((to) => {
  analytics.pageView(to.path);
  document.title = to.route?.title || 'My App';
});
```

  
Both callbacks receive `(to, from)` objects with `{ path, params, query, route }`. On initial page load, `from` is `null` — always use optional chaining (`from?.path`).

  
> **Tip:** **Redirect guards:** When a `beforeEach` guard returns a path string, the redirect uses `replaceState` so the blocked URL never appears in the browser’s history.

  
> **Warning:** **Redirect loop protection:** If guards redirect more than **10 times** in a single navigation cycle, the router bails out to prevent infinite loops. If your guard throws an error, it is caught automatically — the navigation is cancelled but the router keeps running.

  
### Change Listener

  
Subscribe to route changes without using a guard. Returns an **unsubscribe function**. Internally uses a `Set`, so adding the same function twice is a no-op.

  

```javascript
const unsub = router.onChange((to, from) => {
  console.log(from?.path, '→', to.path);
  document.title = to.route?.title || 'My App';
});

// Stop listening later
unsub();
```

  
### Current Route State

  
| Property | Returns | Description |
| --- | --- | --- |
| `router.current` | `{ route, params, query, path } \| null` | Full current route state. `null` before the first navigation resolves. |
| `router.path` | `string` | Current path (base-stripped in history mode). Trailing slash is normalized. |
| `router.query` | `Object` | Current parsed query parameters. |
| `router.base` | `string` | The resolved base path (read-only). |

  

```javascript
console.log(router.path);    // '/user/42'
console.log(router.query);   // { page: '2', sort: 'name' }
console.log(router.current); // { route, params, query, path }

// Access from anywhere via $.getRouter()
const r = $.getRouter();
if (r.current?.params.id) console.log('Viewing user:', r.current.params.id);
```

  
> **Tip:** `resolve(path)` adds the base prefix to a relative path — useful for programmatic link generation:

  

```javascript
// Base is '/my-app'
router.resolve('/user/42');  // → '/my-app/user/42'
router.resolve('/');         // → '/my-app'
```

  
### matchRoute()

  
Standalone, **DOM-free** route matcher. Uses the same matching logic as the client-side router internally — extracted so SSR servers (or any non-browser code) can resolve a URL path to a component without needing the DOM.

  

```javascript
import { matchRoute } from 'zero-query/ssr';  // or from 'zero-query'

const routes = [
  { path: '/',           component: 'home-page' },
  { path: '/blog',       component: 'blog-list' },
  { path: '/blog/:slug', component: 'blog-post' },
  { path: '/about',      component: 'about-page' },
];

matchRoute(routes, '/blog/hello-world');
// → { component: 'blog-post', params: { slug: 'hello-world' } }

matchRoute(routes, '/nope');
// → { component: 'not-found', params: {} }

matchRoute(routes, '/nope', '404-page');
// → { component: '404-page', params: {} }
```

  
| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `routes` | `RouteDefinition[]` | — | Array of route objects with `path` and `component` |
| `pathname` | `string` | — | URL path to match (e.g. `'/blog/my-post'`) |
| `fallback` | `string` | `'not-found'` | Component name returned when no route matches |

  
**Returns:** `{ component: string, params: Record }`

  
Supports `:param` segments, `*` wildcards, and per-route `fallback` aliases — identical to the client router’s matching rules. Routes are tested in order; the first match wins.

  
> **Tip:** **SSR usage:** Import from `zero-query/ssr` in your server entry to resolve incoming request URLs to component names without duplicating the matching logic.

  

```javascript
// SSR server example
import { createSSRApp, matchRoute } from 'zero-query/ssr';
import { routes } from '../app/routes.js';

const app = createSSRApp();
// ... register components ...

async function render(pathname) {
  const { component, params } = matchRoute(routes, pathname);
  const html = await app.renderToString(component, { ...params });
  return html;
}
```

  
### Dynamic Route Management

  
Add or remove routes at runtime. Both methods are chainable.

  

```javascript
// Add a route dynamically (e.g. after loading a plugin)
router.add({ path: '/plugin', component: 'plugin-page' });

// Add with a fallback alias - registers two routes
router.add({
  path: '/docs/:section',
  component: 'docs-page',
  fallback: '/docs'
});

// Remove a route by path
router.remove('/plugin');

// Chain calls
router
  .add({ path: '/new-feature', component: 'feature-page' })
  .navigate('/new-feature');
```

  
> **Tip:** Routes added via `add()` are appended to the end of the route list. Since matching is first-match-wins, they won’t shadow existing routes with the same pattern.

  
### Hash Fragments

  
Navigate to an anchor within a page using a `#fragment` suffix. Behavior differs by routing mode:

  
| Mode | Behavior |
| --- | --- |
| **History** | The fragment element is scrolled into view with `scrollIntoView({ behavior: "smooth", block: "start" })`. |
| **Hash** | Since the hash is used for routing, fragments are stored internally (`window.__zqScrollTarget`) and applied after the route resolves. |

  

```javascript
// History mode
router.navigate('/docs#api');  // scrolls to <div id="api">

// Hash mode - same syntax, handled internally
router.navigate('/docs#api');
```

  
### Sub-Route History Substates

  
Substates push lightweight history entries for **in-component UI changes** — modals, tabs, panels, expandable sections — without changing the URL. The back button undoes the most recent UI change instead of leaving the page.

  
| Method | Description |
| --- | --- |
| `pushSubstate(key, data?)` | Push a substate history entry. `key` identifies the type (e.g. `'modal'`, `'tab'`); `data` is arbitrary serializable state. |
| `onSubstate(fn)` | Listen for substate pops. `fn(key, data, action)` — return `true` to consume the pop (skip route resolution). Returns an unsubscribe function. |

  
| `action` value | Meaning |
| --- | --- |
| `'pop'` | The user pressed Back while a substate entry was on top of the history stack. |
| `'resolve'` | A leftover substate entry was found during normal route resolution (e.g. an unhandled entry). |
| `'reset'` | All remaining substate entries were flushed because the stack was exhausted (the user pressed Back past all substates). |

  

```javascript
// 1. Push a substate when opening a modal
function openModal(id) {
  showModal(id);
  router.pushSubstate('modal', { id });
}

// 2. Listen for back-button on substates
router.onSubstate((key, data, action) => {
  if (key === 'modal') {
    closeModal(data.id);    // undo the UI change
    return true;            // handled - don't resolve routes
  }
  if (action === 'reset') {
    resetUI();              // all substates flushed
  }
});
```

  
> **How it works:** `pushSubstate()` calls `history.pushState()` with a zQuery state marker — the URL stays the same. When the user presses Back, `popstate` fires with the marker. zQuery calls `onSubstate` listeners first. If any returns `true`, the pop is consumed. Otherwise, normal routing proceeds.

  

```javascript
// Tab switching with substates
function switchTab(name) {
  this.state.activeTab = name;
  router.pushSubstate('tab', { name });
}

const unsub = router.onSubstate((key, data, action) => {
  if (key === 'tab') {
    this.state.activeTab = data.name;
    return true;
  }
});

// Stop listening when component unmounts
unsub();
```

  
> **Tip:** **Use cases:** modals, side panels, multi-step forms, tab switches, expandable detail views, and any inner-component navigation where "back" should undo a UI action instead of leaving the page entirely.

  
### Cleanup & Destroy

  
Call `destroy()` to tear down the router completely. This is useful in tests or when replacing a router at runtime.

  

```javascript
router.destroy();
```

  
| What gets cleaned up | Detail |
| --- | --- |
| Window event listeners | `popstate` and `hashchange` handlers are removed |
| Document click listener | `z-link` interception is removed |
| Mounted component | The current component instance is destroyed |
| Route table | All registered routes are cleared |
| Guards & listeners | `beforeEach`, `afterEach`, `onChange`, and `onSubstate` listeners are all cleared |
| Substate tracking | The internal `_inSubstate` flag is reset |

  
### How Navigation Works

  
Every route change — whether from a click, `navigate()`, or the back button — follows this resolution pipeline:

  
1. **Trigger:** `navigate()` / `replace()` / `popstate` / `z-link` click
2. **Dedup check:** Same URL → no-op (unless `force: true`)
3. **Substate check:** If a substate marker is in `history.state`, fire substate listeners first
4. **Path parsing:** Extract path and query from the current URL
5. **Route match:** Test routes in order — first match wins. Fall back to the 404 component if none match
6. **Same-route skip:** If the matched component + params + query are identical to the current state, skip re-rendering
7. **beforeEach guards:** Run all guards (async, serial). `false` cancels; a path string redirects
8. **Lazy load:** Call `load()` if present (abort on rejection)
9. **Mount:** Destroy old component, create new one (or call render function)
10. **afterEach guards:** Run post-navigation hooks
11. **Notify:** Fire all `onChange` listeners

  
> **Re-entrancy safe:** If a guard or listener triggers another navigation, the current resolution is completed first — no double-mounts or race conditions.

  
### Full Example

  

```javascript
const router = $.router({
  routes: [
    { path: '/',          component: 'home-page' },
    { path: '/users',     component: 'user-list' },
    { path: '/user/:id',  component: 'user-detail',
      load: () => import('./pages/user-detail.js') },
    { path: '/admin',     component: 'admin-page' },
    { path: '/preview/:id', component: (route) =>
      `<h1>Preview #${route.params.id}</h1>` },
  ],
  fallback: 'not-found'
});

// Guard - protect admin route
router.beforeEach((to) => {
  if (to.path === '/admin' && !isLoggedIn()) return '/login';
});

// After-hook - scroll to top
router.afterEach(() => window.scrollTo(0, 0));

// Listen for changes
router.onChange((to, from) => {
  console.log(`${from?.path || '(initial)'} → ${to.path}`);
});

// Substates - modal back-button support
router.onSubstate((key, data) => {
  if (key === 'modal') { closeModal(data.id); return true; }
});

// Programmatic navigation
document.querySelector('#go').addEventListener('click', () => {
  router.navigate('/user/:id', { params: { id: input.value } });
});
```


---

## Components

  
Components are the core building block in zQuery. Each one is a self-contained unit with its own state, template, lifecycle, and scoped styles — all defined in a single `$.component()` call.

  
### Your First Component

  
Here’s a counter in under 15 lines:

  

```javascript
$.component('click-counter', {
  state: { count: 0 },
  increment() { this.state.count++; },
  render() {
    return \`
      <div class="counter">
        <span>Count: \$\{this.state.count}</span>
        <button @click="increment">+1</button>
      </div>
    \`;
  }
});
```

  
Drop `` anywhere in your HTML and it just works.

  
> **Tip:** If you come from React, think of `$.component()` as a combination of `useState`, `useEffect`, and JSX — with no build step. If you come from Vue, it's very close to the Options API.

  
### Anatomy of a Component

  
Every component is an object passed to `$.component(name, options)`. Here’s how the pieces fit together:

  
| Key | Purpose | Required |
| --- | --- | --- |
| `render()` | Returns an HTML string for the component template | One of render or templateUrl |
| `templateUrl` | Path to an external `.html` template file | One of render or templateUrl |
| `state` | Reactive data — object or factory function | No (defaults to `{}`) |
| `computed` | Derived getters accessed via `this.computed` | No |
| `watch` | Callbacks that fire when state keys change | No |
| `init()` / `mounted()` / `updated()` / `destroyed()` | Lifecycle hooks | No |
| `styles` / `styleUrl` | Scoped CSS (inline string or external file) | No |
| *any other function* | Becomes a component method (no wrapper needed) | No |

  
> The `state` key is special — it creates a deeply reactive proxy. Mutate properties and the component re-renders automatically. You never call a `setState()` or `forceUpdate()`.

  
### State & Reactivity

  
All properties under `state` become reactive. Mutate a property and the DOM updates on the next microtick:

  

```javascript
$.component('notification-badge', {
  state: { unread: 0 },
  render() {
    return \`<span class="badge">\$\{this.state.unread || ''}</span>\`;
  },
  mounted() {
    setInterval(() => this.state.unread++, 5000);
  }
});
```

  
| Pattern | Syntax | When to Use |
| --- | --- | --- |
| Object literal | `state: { count: 0 }` | Single-instance components (most cases) |
| Factory function | `state: () => ({ count: 0 })` | Multiple instances — each gets its own copy |

  
> **Tip:** Use a factory function `state: () => ({ ... })` when the same component appears more than once on a page. An object literal is shared across instances, which can cause unexpected coupling.

  
### Computed Properties

  
Computed props are getters derived from state. They’re accessed like normal properties on `this.computed`:

  

```javascript
$.component('cart-summary', {
  state: { items: [{ price: 9.99, qty: 2 }, { price: 4.50, qty: 1 }] },
  computed: {
    total()    { return this.state.items.reduce((s, i) => s + i.price * i.qty, 0); },
    count()    { return this.state.items.reduce((s, i) => s + i.qty, 0); },
    formatted(){ return '

  
### Watchers

  
React to specific state changes with `watch`. Each watcher receives the new and old value:

  
| Feature | Detail |
| --- | --- |
| Key | Must match a top-level `state` property name |
| Arguments | `(newValue, oldValue)` |
| Timing | Fires *after* the re-render triggered by the change |
| Use cases | Side effects: localStorage sync, analytics, DOM APIs |

  

```javascript
$.component('theme-switcher', {
  state: { theme: 'light' },
  watch: {
    theme(val, old) {
      document.documentElement.setAttribute('data-theme', val);
      console.log(\`Theme changed: \$\{old} → \$\{val}\`);
    }
  },
  toggle() { this.state.theme = this.state.theme === 'light' ? 'dark' : 'light'; },
  render() {
    return \`<button @click="toggle">\$\{this.state.theme}</button>\`;
  }
});
```

  
### Templates

  
Templates can be **inline** (a `render()` function returning a string) or **external** (loaded from an HTML file via `templateUrl`).

  
> **`${}` vs `{{}}` — know the difference:**
>   
>     `${}` is a *JavaScript* template literal — evaluated when `render()` runs. Use it for state, methods, and conditional template assembly.
>     `{{}}` is zQuery’s *template interpolation* — evaluated **after** render, at the string level. Required inside `z-for` loops to access iteration variables. **Auto-escapes HTML entities** for XSS safety.
>     In **external templates** (`templateUrl`), `{{}}` is the only syntax — there is no JS context, so `${}` does not apply.
>     In **inline `render()`**, use `${}` for everything *except* inside `z-for` bodies, where loop variables like `item` require `{{}}`.
>     To render raw HTML, use the `z-html` directive instead (trusted content only).
>   

  
#### Inline Template

  

```javascript
$.component('user-list', {
  state: {
    users: [
      { name: 'Alice', role: 'Admin' },
      { name: 'Bob', role: 'Editor' }
    ]
  },
  render() {
    return \`
      <ul>
        \$\{this.state.users.map(u => \`<li>\$\{u.name} (\$\{u.role})</li>\`).join('')}
      </ul>
    \`;
  }
});
```

  
#### External Template

  
Load HTML from a separate file with optional CSS — keeps markup, logic, and styles cleanly separated:

  

```javascript
$.component('contacts-page', {
  templateUrl: 'contacts.html',
  styleUrl:    'contacts.css',

  state: () => ({
    contacts: [],
    showForm: false,
    newName: '',
    newEmail: '',
  }),

  mounted() {
    const store = $.getStore('main');
    this.state.contacts = store.state.contacts || [];
  },

  addContact() {
    const { newName, newEmail } = this.state;
    if (!newName || !newEmail) return;
    this.state.contacts.push({
      id: Date.now(), name: newName,
      email: newEmail, favorite: false,
    });
    this.state.newName = '';
    this.state.newEmail = '';
    this.state.showForm = false;
  },

  toggleFavorite(e) {
    const id = +e.target.dataset.id;
    const c = this.state.contacts.find(c => c.id === id);
    if (c) c.favorite = !c.favorite;
  },

  deleteContact(e) {
    const id = +e.target.dataset.id;
    this.state.contacts = this.state.contacts.filter(c => c.id !== id);
  },
});
```

  

```html
<!-- z-cloak hides until rendered -->
<h1 z-cloak>Contacts ({{contacts.length}})</h1>

<!-- z-if / z-else conditional blocks -->
<p z-if="contacts.length">
  Showing <strong z-text="contacts.length"></strong> contacts
</p>
<p z-else>No contacts yet.</p>

<!-- z-for list rendering + {{}} interpolation -->
<ul z-show="contacts.length">
  <li z-for="(c, i) in contacts" z-class="{fav: c.favorite}">
    {{i + 1}}. {{c.name}} — <span z-text="c.email"></span>
    <button @click="toggleFavorite" data-id="{{c.id}}">★</button>
    <button @click="deleteContact" data-id="{{c.id}}">✕</button>
  </li>
</ul>

<!-- @click event binding -->
<button @click="toggleForm">
  <span z-if="showForm">Cancel</span>
  <span z-else>+ Add</span>
</button>

<!-- z-show, z-model, z-trim, @submit -->
<form z-show="showForm" @submit.prevent="addContact">
  <input z-model="newName" z-trim placeholder="Name">
  <input z-model="newEmail" z-trim placeholder="Email">
  <button type="submit" z-ref="saveBtn">Save</button>
</form>
```

  
> **One template, many features** — `{{expr}}` interpolation, `z-text` / `z-html` for content, `z-if` / `z-else` conditionals, `z-for` lists, `z-show` visibility, `z-model` + modifiers (`z-trim`, `z-debounce`, `z-uppercase`, `z-lowercase`), `z-class` dynamic classes, `z-ref` DOM refs, `z-cloak` flash prevention, and `@event` / `z-on:event` with key modifiers (`.enter`, `.escape`, …), system keys (`.ctrl`, `.shift`, …), and `.outside` — all in plain HTML.

  
| Key | Type | Description |
| --- | --- | --- |
| templateUrl | `string \| string[] \| object` | Path to external HTML file(s). Array = indexed map; object = named map. |
| styleUrl | `string \| string[]` | Path to external CSS file(s) (scoped). Array = all concatenated. |
| base | `string` | Base URL prepended to templateUrl / styleUrl. Auto-detected from the importing file if omitted. |

  
> **Tip:** **Multiple templates:** Pass an array for indexed access (`this.templates[0]`), or an object for named access (`this.templates.sidebar`). Useful for components that switch between views.

  

```javascript
// Single template
templateUrl: 'contacts.html'

// Array - access via this.templates[0], this.templates[1]
templateUrl: ['main.html', 'detail.html']

// Object - access via this.templates.main, this.templates.sidebar
templateUrl: { main: 'main.html', sidebar: 'sidebar.html' }
```

  
### Events & Forms

  
Bind events with `@event="method"` (or the longhand `z-on:event="method"`) and use `z-model` for two-way form binding. Handlers are component methods that receive the native event by default:

  

```html
<form @submit.prevent="save">
  <input type="text" z-model="name" z-trim placeholder="Name" />
  <input type="email" z-model="email" placeholder="Email" />
  <button type="submit">Save Contact</button>
</form>
```

  

```javascript
$.component('contact-form', {
  state: { name: '', email: '' },
  save() {
    console.log(this.state.name, this.state.email);
  },
  render() { return \`...\`; }
});
```

  
> **Tip:** See Directives › Event Binding for modifiers, argument passing, and `$event`. See Directives › z-model for the full form element & modifier reference.

  
### Lifecycle

  
> **Lifecycle flow:** `init` → first render → `mounted` → [state mutates → re-render → `updated`]* → `destroyed`

  
| Hook | When It Fires | Common Use |
| --- | --- | --- |
| `init()` | Instance created, state ready, before first render | Fetch initial data, set up subscriptions |
| `mounted()` | First render complete, element in DOM | DOM queries, timers, third-party libs |
| `updated()` | Re-render complete | Re-init plugins on new DOM |
| `destroyed()` | Component removed from DOM | Timers, listeners, subscriptions cleanup |

  

```javascript
$.component('live-clock', {
  state: { time: new Date().toLocaleTimeString() },
  mounted() {
    this._timer = setInterval(() => {
      this.state.time = new Date().toLocaleTimeString();
    }, 1000);
  },
  destroyed() {
    clearInterval(this._timer);
  },
  render() {
    return \`<time>\$\{this.state.time}</time>\`;
  }
});
```

  
> **Warning:** Always clean up in `destroyed()`. Timers, event listeners, and store subscriptions that outlive their component cause memory leaks.

  
### Props & Communication

  
#### Attributes → Props

  
Pass data from a parent via HTML attributes. Props are auto-extracted and available on `this.props`:

  

```javascript
$.component('user-card', {
  state: { name: '', role: '' },
  mounted() {
    this.state.name = this.props.name || 'Guest';
    this.state.role = this.props.role || 'Viewer';
  },
  render() {
    return \`<div class="card"><strong>\$\{this.state.name}</strong> — \$\{this.state.role}</div>\`;
  }
});
```

  

```html
<!-- Static props -->
<user-card name="Alice" role="Admin"></user-card>

<!-- Dynamic props - uses the :prop binding syntax -->
<user-card :name="state.currentUser" :role="state.userRole"></user-card>
```

  
| Syntax | Evaluation | Example |
| --- | --- | --- |
| `attr="value"` | Parsed as JSON first, then plain string | `count="5"` → number `5` |
| `:attr="expression"` | Evaluated in parent component context | `:items="state.list"` → live parent data |

  
> **Tip:** Dynamic props (`:propName`) are evaluated in the parent component’s scope, so they can reference the parent’s state, computed properties, and methods.

  
#### Child → Parent Events

  
Children dispatch custom events; parents listen with `@event`:

  

```javascript
// Child - dispatches a custom event
$.component('color-picker', {
  pick(color) {
    this.emit('color-change', color);
  }
});

// Parent - listens for the event
$.component('theme-editor', {
  onColor(e) {
    document.body.style.background = e.detail;
  },
  render() {
    return \`<color-picker @color-change="onColor"></color-picker>\`;
  }
});
```

  
#### Slots

  
Content between a component’s tags is projected into default or named `` elements:

  

```javascript
$.component('modal-dialog', {
  render() {
    return \`
      <div class="overlay">
        <div class="modal">
          <header><slot name="header">Default Title</slot></header>
          <section><slot></slot></section>
        </div>
      </div>
    \`;
  }
});
```

  

```html
<modal-dialog>
  <span slot="header">Confirm Delete</span>
  <p>Are you sure you want to delete this item?</p>
</modal-dialog>
```

  
| Feature | Syntax | Notes |
| --- | --- | --- |
| Default slot | `` or `` | All child content without a `slot` attribute is projected here |
| Named slot | `` | Matches child elements with `slot="header"` |
| Fallback | `Fallback text` | Shown when no matching content is provided (supports HTML) |
| Multiple sites | Two `` tags in one template | Same content is duplicated into every matching slot site |
| Accumulation | Multiple children with `slot="items"` | All matching elements are concatenated into the named slot |

  
> Slot content is captured *once* at mount time as a static HTML snapshot. It is **not** re-evaluated as a template expression — projected content survives every re-render unchanged. Attributes, classes, inline styles, and nested HTML are all preserved.

  
> **Tip:** If you need to query projected content, do so in `updated()` or with a `requestAnimationFrame` in `mounted()`.

  
### Scoped Styles

  
Keep styles local to a component with the `styles` key or `styleUrl` for external CSS:

  

```javascript
$.component('pricing-card', {
  state: { plan: 'Pro', price: '9.99' },
  styles: \`
    .card  { border: 1px solid #30363d; border-radius: 8px; padding: 1.5rem; }
    .price { font-size: 2rem; color: #58a6ff; }
  \`,
  render() {
    return \`
      <div class="card">
        <h3>\$\{this.state.plan}</h3>
        <p class="price">\$\{this.state.price}/mo</p>
      </div>
    \`;
  }
});
```

  
Styles are scoped using an auto-generated attribute, so they never leak. You can also use `styleUrl` for external CSS files. `@media`, `@keyframes`, and `@font-face` rules are preserved as-is (not scoped).

  
#### Global Stylesheets — `$.style()`

  
Load global (unscoped) CSS into the page. Returns a handle with a `.ready` promise and a `.remove()` method:

  

```javascript
// Load one or more global stylesheets
const theme = $.style('theme.css');

// Wait for them to load, then show the page
await theme.ready;

// Unload later
theme.remove();
```

  
| Option | Default | Description |
| --- | --- | --- |
| `critical` | `true` | If true, hides the page with an overlay until all sheets have loaded. Prevents flash of unstyled content (FOUC). |
| `bg` | `"#0d1117"` | Background color of the loading overlay. |

  

```javascript
// Non-critical - load in background without hiding the page
$.style('extras.css', { critical: false });

// Multiple sheets at once
$.style(['reset.css', 'typography.css', 'layout.css']);
```

  
> **Tip:** Duplicate URLs are ignored — calling `$.style("theme.css")` twice only loads it once.

  
### DOM Morphing

  
zQuery re-renders by **morphing** the real DOM against the new template HTML — no virtual DOM, no diff tree. The morph engine preserves focus, scroll position, and CSS transitions.

  
#### Render Strategy

  
| Strategy | How | When |
| --- | --- | --- |
| Attribute Morph | Patches only changed attributes | Same tag, same children count |
| Keyed Reconciliation | Uses `z-key` to match children by identity | Lists with add/remove/reorder |
| Full Replace | Replaces entire subtree | Tag changed, or `z-skip` subtree |

  
#### Preserved State During Re-render

  
| State | Preserved? | Notes |
| --- | --- | --- |
| Focus | Yes | Active element focus and cursor position are restored |
| Scroll | Yes | Scroll positions inside containers are maintained |
| CSS transitions | Yes | In-flight transitions continue uninterrupted |
| ``/`` playback | Yes | Media state is never reset |
| Animation state | With z-key | Keyed elements retain animation progress |
| Selection range | With z-key | Text selection is restored for keyed inputs |

  
#### Algorithm In Five Steps

  
1. **Parse** — New template string → DocumentFragment
2. **Match** — Walk old & new trees node-by-node
3. **Diff attributes** — Add / change / remove only what differs
4. **Reconcile children** — Keyed = LIS-based reorder; unkeyed = pairwise patch
5. **Commit** — Minimal DOM ops; event listeners from `@event` are rebound

  
#### `z-key` — Keyed Lists (LIS Reconciliation)

  
zQuery uses a **Longest Increasing Subsequence (LIS)** algorithm to reconcile keyed lists with the minimum number of DOM moves:

  

```javascript
$.component('sortable-list', {
  state: {
    items: [
      { id: 1, text: 'Alpha' },
      { id: 2, text: 'Beta' },
      { id: 3, text: 'Gamma' }
    ]
  },
  shuffle() {
    this.state.items = this.state.items.sort(() => Math.random() - 0.5);
  },
  render() {
    return \`
      <button @click="shuffle">Shuffle</button>
      <ul>
        \$\{this.state.items.map(i => \`<li z-key="\$\{i.id}">\$\{i.text}</li>\`).join('')}
      </ul>
    \`;
  }
});
```

  
| Mode | Behavior |
| --- | --- |
| Keyed (`z-key`) | Moves real DOM nodes; preserves internal state & focus |
| Unkeyed | Patches nodes in-place; faster for static lists or append-only |

  
#### `z-skip`

  
Mark a subtree as “hands off” — the morph engine will never touch it. Useful for third-party widgets, ``, or syntax-highlighted code blocks:

  

```html
<div z-skip>
  <!-- Morphing will never touch children here -->
  <canvas id="chart"></canvas>
</div>
```

  
#### Manual Morph API

  
| Method | Description |
| --- | --- |
| `$.morph(oldEl, newHTML)` | Morph a single element to match new HTML string |
| `$.morphElement(oldEl, newEl)` | Morph by comparing two live DOM elements |

  

```javascript
// Morph a container from HTML string
$.morph($.id('stats'), '<div id="stats"><p>Updated!</p></div>');

// Or from a live element
const newEl = document.createElement('div');
newEl.innerHTML = '<p>Fresh content</p>';
$.morphElement($.id('panel'), newEl);
```

  
> **Tip:** When you use `$()` to set `.html()` on a component root, auto-morph kicks in automatically — no manual call needed.

  
**Auto-Key Detection:** zQuery automatically detects `z-key` attributes in child lists and switches to keyed reconciliation. If any child has `z-key`, the entire sibling group is reconciled as a keyed list.

  
### Mounting & Instance API

  
Mount your app entry point or standalone components with these helpers:

  

```javascript
// Auto-discover and mount all registered components
$.mountAll();

// Mount a specific component into a target
$.mount('#sidebar', 'nav-menu');

// Mount with props
$.mount('#header', 'user-badge', { name: 'Alice' });
```

  
| Property / Method | Description |
| --- | --- |
| `this.state` | Reactive state proxy - mutate to trigger re-render |
| `this.computed` | Access computed properties |
| `this.props` | Frozen object of HTML attributes / parent-passed props |
| `this._el` | The component’s root DOM element |
| `this.refs` | Map of `z-ref` elements |
| `this.setState(partial)` | Merge partial state and re-render (pass `{}` to force re-render) |
| `this.destroy()` | Tear down the component and clean up |
| `this.emit(event, detail)` | Dispatch a CustomEvent from the host element (bubbles) |

  
### Quick Reference

  
| Key | Type | Description |
| --- | --- | --- |
| `render()` | function | Returns HTML string for rendering |
| `templateUrl` | string \| string[] \| object | Path to external HTML template(s) |
| `state` | object | Initial reactive state |
| `computed` | object | Derived getters (accessed via `this.computed`) |
| `watch` | object | State-change watchers `{ key(newVal, oldVal) }` |
| `init()` | function | After instance creation, before first render |
| `mounted()` | function | After first render (DOM ready) |
| `updated()` | function | After re-render |
| `destroyed()` | function | Component removed from DOM |
| `styles` | string | Inline CSS string (auto-scoped) |
| `styleUrl` | string | External CSS file (scoped) |
| `base` | string | Base path for templateUrl / styleUrl |

  
> **Tip:** Any function on the definition object that isn’t a reserved key is automatically bound as a method on the component instance. No `methods: {}` wrapper needed.

  
> **Warning:** Avoid using reserved keys as method names: `state`, `render`, `styles`, `init`, `mounted`, `updated`, `destroyed`, `props`, `computed`, `watch`. These are used internally by zQuery. + this.computed.total.toFixed(2); }
  },
  render() {
    return \`<p>\$\{this.computed.count} items — \$\{this.computed.formatted}</p>\`;
  }
});
```

  
### Watchers

  
React to specific state changes with `watch`. Each watcher receives the new and old value:

  
| Feature | Detail |
| --- | --- |
| Key | Must match a top-level `state` property name |
| Arguments | `(newValue, oldValue)` |
| Timing | Fires *after* the re-render triggered by the change |
| Use cases | Side effects: localStorage sync, analytics, DOM APIs |

  
__CODEBLOCK_3__

  
### Templates

  
Templates can be **inline** (a `render()` function returning a string) or **external** (loaded from an HTML file via `templateUrl`).

  
> **`${}` vs `{{}}` — know the difference:**
>   
>     `${}` is a *JavaScript* template literal — evaluated when `render()` runs. Use it for state, methods, and conditional template assembly.
>     `{{}}` is zQuery’s *template interpolation* — evaluated **after** render, at the string level. Required inside `z-for` loops to access iteration variables. **Auto-escapes HTML entities** for XSS safety.
>     In **external templates** (`templateUrl`), `{{}}` is the only syntax — there is no JS context, so `${}` does not apply.
>     In **inline `render()`**, use `${}` for everything *except* inside `z-for` bodies, where loop variables like `item` require `{{}}`.
>     To render raw HTML, use the `z-html` directive instead (trusted content only).
>   

  
#### Inline Template

  
__CODEBLOCK_4__

  
#### External Template

  
Load HTML from a separate file with optional CSS — keeps markup, logic, and styles cleanly separated:

  
__CODEBLOCK_5__

  
__CODEBLOCK_6__

  
> **One template, many features** — `{{expr}}` interpolation, `z-text` / `z-html` for content, `z-if` / `z-else` conditionals, `z-for` lists, `z-show` visibility, `z-model` + modifiers (`z-trim`, `z-debounce`, `z-uppercase`, `z-lowercase`), `z-class` dynamic classes, `z-ref` DOM refs, `z-cloak` flash prevention, and `@event` / `z-on:event` with key modifiers (`.enter`, `.escape`, …), system keys (`.ctrl`, `.shift`, …), and `.outside` — all in plain HTML.

  
| Key | Type | Description |
| --- | --- | --- |
| templateUrl | `string \| string[] \| object` | Path to external HTML file(s). Array = indexed map; object = named map. |
| styleUrl | `string \| string[]` | Path to external CSS file(s) (scoped). Array = all concatenated. |
| base | `string` | Base URL prepended to templateUrl / styleUrl. Auto-detected from the importing file if omitted. |

  
> **Tip:** **Multiple templates:** Pass an array for indexed access (`this.templates[0]`), or an object for named access (`this.templates.sidebar`). Useful for components that switch between views.

  
__CODEBLOCK_7__

  
### Events & Forms

  
Bind events with `@event="method"` (or the longhand `z-on:event="method"`) and use `z-model` for two-way form binding. Handlers are component methods that receive the native event by default:

  
__CODEBLOCK_8__

  
__CODEBLOCK_9__

  
> **Tip:** See Directives › Event Binding for modifiers, argument passing, and `$event`. See Directives › z-model for the full form element & modifier reference.

  
### Lifecycle

  
> **Lifecycle flow:** `init` → first render → `mounted` → [state mutates → re-render → `updated`]* → `destroyed`

  
| Hook | When It Fires | Common Use |
| --- | --- | --- |
| `init()` | Instance created, state ready, before first render | Fetch initial data, set up subscriptions |
| `mounted()` | First render complete, element in DOM | DOM queries, timers, third-party libs |
| `updated()` | Re-render complete | Re-init plugins on new DOM |
| `destroyed()` | Component removed from DOM | Timers, listeners, subscriptions cleanup |

  
__CODEBLOCK_10__

  
> **Warning:** Always clean up in `destroyed()`. Timers, event listeners, and store subscriptions that outlive their component cause memory leaks.

  
### Props & Communication

  
#### Attributes → Props

  
Pass data from a parent via HTML attributes. Props are auto-extracted and available on `this.props`:

  
__CODEBLOCK_11__

  
__CODEBLOCK_12__

  
| Syntax | Evaluation | Example |
| --- | --- | --- |
| `attr="value"` | Parsed as JSON first, then plain string | `count="5"` → number `5` |
| `:attr="expression"` | Evaluated in parent component context | `:items="state.list"` → live parent data |

  
> **Tip:** Dynamic props (`:propName`) are evaluated in the parent component’s scope, so they can reference the parent’s state, computed properties, and methods.

  
#### Child → Parent Events

  
Children dispatch custom events; parents listen with `@event`:

  
__CODEBLOCK_13__

  
#### Slots

  
Content between a component’s tags is projected into default or named `` elements:

  
__CODEBLOCK_14__

  
__CODEBLOCK_15__

  
| Feature | Syntax | Notes |
| --- | --- | --- |
| Default slot | `` or `` | All child content without a `slot` attribute is projected here |
| Named slot | `` | Matches child elements with `slot="header"` |
| Fallback | `Fallback text` | Shown when no matching content is provided (supports HTML) |
| Multiple sites | Two `` tags in one template | Same content is duplicated into every matching slot site |
| Accumulation | Multiple children with `slot="items"` | All matching elements are concatenated into the named slot |

  
> Slot content is captured *once* at mount time as a static HTML snapshot. It is **not** re-evaluated as a template expression — projected content survives every re-render unchanged. Attributes, classes, inline styles, and nested HTML are all preserved.

  
> **Tip:** If you need to query projected content, do so in `updated()` or with a `requestAnimationFrame` in `mounted()`.

  
### Scoped Styles

  
Keep styles local to a component with the `styles` key or `styleUrl` for external CSS:

  
__CODEBLOCK_16__

  
Styles are scoped using an auto-generated attribute, so they never leak. You can also use `styleUrl` for external CSS files. `@media`, `@keyframes`, and `@font-face` rules are preserved as-is (not scoped).

  
#### Global Stylesheets — `$.style()`

  
Load global (unscoped) CSS into the page. Returns a handle with a `.ready` promise and a `.remove()` method:

  
__CODEBLOCK_17__

  
| Option | Default | Description |
| --- | --- | --- |
| `critical` | `true` | If true, hides the page with an overlay until all sheets have loaded. Prevents flash of unstyled content (FOUC). |
| `bg` | `"#0d1117"` | Background color of the loading overlay. |

  
__CODEBLOCK_18__

  
> **Tip:** Duplicate URLs are ignored — calling `$.style("theme.css")` twice only loads it once.

  
### DOM Morphing

  
zQuery re-renders by **morphing** the real DOM against the new template HTML — no virtual DOM, no diff tree. The morph engine preserves focus, scroll position, and CSS transitions.

  
#### Render Strategy

  
| Strategy | How | When |
| --- | --- | --- |
| Attribute Morph | Patches only changed attributes | Same tag, same children count |
| Keyed Reconciliation | Uses `z-key` to match children by identity | Lists with add/remove/reorder |
| Full Replace | Replaces entire subtree | Tag changed, or `z-skip` subtree |

  
#### Preserved State During Re-render

  
| State | Preserved? | Notes |
| --- | --- | --- |
| Focus | Yes | Active element focus and cursor position are restored |
| Scroll | Yes | Scroll positions inside containers are maintained |
| CSS transitions | Yes | In-flight transitions continue uninterrupted |
| ``/`` playback | Yes | Media state is never reset |
| Animation state | With z-key | Keyed elements retain animation progress |
| Selection range | With z-key | Text selection is restored for keyed inputs |

  
#### Algorithm In Five Steps

  
1. **Parse** — New template string → DocumentFragment
2. **Match** — Walk old & new trees node-by-node
3. **Diff attributes** — Add / change / remove only what differs
4. **Reconcile children** — Keyed = LIS-based reorder; unkeyed = pairwise patch
5. **Commit** — Minimal DOM ops; event listeners from `@event` are rebound

  
#### `z-key` — Keyed Lists (LIS Reconciliation)

  
zQuery uses a **Longest Increasing Subsequence (LIS)** algorithm to reconcile keyed lists with the minimum number of DOM moves:

  
__CODEBLOCK_19__

  
| Mode | Behavior |
| --- | --- |
| Keyed (`z-key`) | Moves real DOM nodes; preserves internal state & focus |
| Unkeyed | Patches nodes in-place; faster for static lists or append-only |

  
#### `z-skip`

  
Mark a subtree as “hands off” — the morph engine will never touch it. Useful for third-party widgets, ``, or syntax-highlighted code blocks:

  
__CODEBLOCK_20__

  
#### Manual Morph API

  
| Method | Description |
| --- | --- |
| `$.morph(oldEl, newHTML)` | Morph a single element to match new HTML string |
| `$.morphElement(oldEl, newEl)` | Morph by comparing two live DOM elements |

  
__CODEBLOCK_21__

  
> **Tip:** When you use `$()` to set `.html()` on a component root, auto-morph kicks in automatically — no manual call needed.

  
**Auto-Key Detection:** zQuery automatically detects `z-key` attributes in child lists and switches to keyed reconciliation. If any child has `z-key`, the entire sibling group is reconciled as a keyed list.

  
### Mounting & Instance API

  
Mount your app entry point or standalone components with these helpers:

  
__CODEBLOCK_22__

  
| Property / Method | Description |
| --- | --- |
| `this.state` | Reactive state proxy - mutate to trigger re-render |
| `this.computed` | Access computed properties |
| `this.props` | Frozen object of HTML attributes / parent-passed props |
| `this._el` | The component’s root DOM element |
| `this.refs` | Map of `z-ref` elements |
| `this.setState(partial)` | Merge partial state and re-render (pass `{}` to force re-render) |
| `this.destroy()` | Tear down the component and clean up |
| `this.emit(event, detail)` | Dispatch a CustomEvent from the host element (bubbles) |

  
### Quick Reference

  
| Key | Type | Description |
| --- | --- | --- |
| `render()` | function | Returns HTML string for rendering |
| `templateUrl` | string \| string[] \| object | Path to external HTML template(s) |
| `state` | object | Initial reactive state |
| `computed` | object | Derived getters (accessed via `this.computed`) |
| `watch` | object | State-change watchers `{ key(newVal, oldVal) }` |
| `init()` | function | After instance creation, before first render |
| `mounted()` | function | After first render (DOM ready) |
| `updated()` | function | After re-render |
| `destroyed()` | function | Component removed from DOM |
| `styles` | string | Inline CSS string (auto-scoped) |
| `styleUrl` | string | External CSS file (scoped) |
| `base` | string | Base path for templateUrl / styleUrl |

  
> **Tip:** Any function on the definition object that isn’t a reserved key is automatically bound as a method on the component instance. No `methods: {}` wrapper needed.

  
> **Warning:** Avoid using reserved keys as method names: `state`, `render`, `styles`, `init`, `mounted`, `updated`, `destroyed`, `props`, `computed`, `watch`. These are used internally by zQuery.

---

## Directives

  
Directives are special HTML attributes that add reactive behavior to your templates. They’re processed after every render and morph pass.

  
### Quick Reference

  
| Directive | Short | Description |
| --- | --- | --- |
| `z-if` |  | Conditionally render element |
| `z-else-if` |  | Else-if branch |
| `z-else` |  | Else branch |
| `z-show` |  | Toggle visibility (display: none) |
| `z-for` |  | Repeat element for each item |
| `z-key` |  | Unique key for list reconciliation |
| `z-bind:attr` | `:attr` | Bind attribute to expression |
| `z-class` |  | Dynamic CSS classes |
| `z-style` |  | Dynamic inline styles |
| `z-model` |  | Two-way form binding |
| `z-html` |  | Set innerHTML from expression |
| `z-text` |  | Set textContent from expression |
| `z-on:event` | `@event` | Bind DOM event to method |
| `@event.mod` |  | Event with modifier(s) |
| `z-ref` |  | Register element in `this.refs` |
| `z-cloak` |  | Hide until component renders |
| `z-pre` |  | Skip directive processing |
| `z-skip` |  | Skip morph for subtree |
| `z-to-top` |  | Scroll to top on click — see **Router** section |
| `z-link` |  | Client-side SPA link — see **Router** section |

  
### z-if / z-else-if / z-else

  
Conditionally render elements based on expressions evaluated against component state:

  

```html
<div z-if="state.status === 'loading'">Loading...</div>
<div z-else-if="state.status === 'error'">Something went wrong</div>
<div z-else>
  <p>Data loaded successfully!</p>
</div>
```

  

```javascript
$.component('status-display', {
  state: { status: 'loading' },
  mounted() {
    setTimeout(() => { this.state.status = 'ready'; }, 2000);
  },
  render() {
    return \`
      <div z-if="state.status === 'loading'">⏳ Loading...</div>
      <div z-else-if="state.status === 'error'">❌ Error</div>
      <div z-else>✅ Ready!</div>
    \`;
  }
});
```

  
| Feature | `z-if` | `z-show` |
| --- | --- | --- |
| DOM presence | Removed/added | Always in DOM |
| Toggle cost | Higher (create/destroy) | Lower (CSS only) |
| Best for | Rarely toggled content | Frequently toggled content |
| Transitions | Triggers mount/destroy | CSS transitions work naturally |

  
### z-for

  
Repeat an element for each item in an array, object, or range:

  

```html
<!-- Array -->
<li z-for="item in state.items" z-key="item.id">{{item.name}}</li>

<!-- With index -->
<li z-for="(item, index) in state.items">{{index}}: {{item.name}}</li>

<!-- Range (1 to 5) -->
<span z-for="n in 5">{{n}} </span>

<!-- Object entries -->
<div z-for="(value, key) in state.config">{{key}}: {{value}}</div>
```

  

```javascript
$.component('todo-list', {
  state: {
    todos: [
      { id: 1, text: 'Learn zQuery', done: true },
      { id: 2, text: 'Build an app', done: false }
    ]
  },
  toggle(id) {
    const t = this.state.todos.find(t => t.id === id);
    if (t) t.done = !t.done;
  },
  render() {
    return \`
      <ul>
        <li z-for="todo in state.todos" z-key="todo.id" @click="toggle(todo.id)"
            z-class="{ done: todo.done }">
          {{todo.text}}
        </li>
      </ul>
    \`;
  }
});
```

  
> **Tip:** Always add `z-key` when using `z-for` with items that can be reordered or removed. This enables LIS-based reconciliation for minimal DOM operations.

  
### z-key

  
Assign a unique identity to each repeated element so the morph engine can track them across re-renders:

  

```html
<div z-for="task in state.tasks" z-key="task.id">
  <input type="text" z-model="task.name" />
  <span>{{task.status}}</span>
</div>
```

  
| Scenario | Without `z-key` | With `z-key` |
| --- | --- | --- |
| Reorder items | Patches text in place (loses focus) | Moves real DOM nodes (preserves focus) |
| Remove middle item | All nodes after it re-render | Only the removed node is detached |
| Add item | May re-render all siblings | Only inserts the new node |

  

```javascript
$.component('task-list', {
  state: {
    tasks: [
      { id: 1, name: 'Design', status: 'done' },
      { id: 2, name: 'Build', status: 'wip' },
      { id: 3, name: 'Test', status: 'todo' }
    ]
  },
  sort() { this.state.tasks.sort((a, b) => a.name.localeCompare(b.name)); },
  render() {
    return \`
      <button @click="sort">Sort A-Z</button>
      <ul>
        <li z-for="t in state.tasks" z-key="t.id">{{t.name}} ({{t.status}})</li>
      </ul>
    \`;
  }
});
```

  
> **Tip:** Never use the loop index as a key on mutable lists — it defeats the purpose of keyed reconciliation. Use a stable unique identifier like a database ID.

  
### z-show

  
Toggle visibility without removing the element from the DOM:

  

```html
<div z-show="state.isOpen" class="panel">
  Panel content here
</div>
```

  

```javascript
$.component('toggle-panel', {
  state: { isOpen: false },
  toggle() { this.state.isOpen = !this.state.isOpen; },
  render() {
    return \`
      <button @click="toggle">Toggle</button>
      <div z-show="state.isOpen" class="panel">Now you see me</div>
    \`;
  }
});
```

  
### z-bind / `:attr`

  
Bind any HTML attribute to a JavaScript expression. Use `z-bind:attr` or the `:attr` shorthand:

  
| Syntax | Example | Notes |
| --- | --- | --- |
| Full | `z-bind:href="state.url"` | Explicit longhand form |
| Shorthand | `:href="state.url"` | Preferred — cleaner to read |
| Boolean attr | `:disabled="state.loading"` | Removed from DOM when falsy, added when truthy |
| String attr | `:title="state.label"` | Set to the expression’s string value |

  

```html
<!-- Full syntax -->
<a z-bind:href="state.url">Link</a>

<!-- Shorthand -->
<a :href="state.url">Link</a>

<!-- Boolean attribute - removed when falsy -->
<button :disabled="state.loading">Submit</button>

<!-- Dynamic attributes -->
<img :src="state.avatarUrl" :alt="state.name">
```

  

```javascript
$.component('dynamic-link', {
  state: { url: 'https://github.com', label: 'GitHub' },
  render() {
    return \`<a :href="state.url" target="_blank">{{state.label}}</a>\`;
  }
});
```

  
> **Tip:** Boolean attributes (`disabled`, `hidden`, `checked`, etc.) are removed from the DOM when the expression is falsy, and added when truthy.

  
### z-class

  
Dynamically toggle CSS classes. Accepts three syntax forms:

  
| Syntax | Example | Result |
| --- | --- | --- |
| Object | `z-class="{ active: state.on, dim: state.faded }"` | Adds/removes each class based on its boolean value |
| String | `z-class="state.dynamicClass"` | Sets the class to the expression’s string value |
| Array | `z-class="[state.base, state.lg ? 'lg' : 'sm']"` | Joins array items into space-separated classes |

  

```html
<!-- Object syntax - keys are class names, values are booleans -->
<div z-class="{ active: state.isActive, disabled: state.isDisabled }">

<!-- String expression -->
<div z-class="state.dynamicClass">

<!-- Array syntax -->
<div z-class="[state.baseClass, state.isLarge ? 'lg' : 'sm']">
```

  

```javascript
$.component('tab-button', {
  state: { active: 'home' },
  render() {
    return \`
      <button z-class="{ active: state.active === 'home' }" @click="state.active = 'home'">Home</button>
      <button z-class="{ active: state.active === 'about' }" @click="state.active = 'about'">About</button>
    \`;
  }
});
```

  
> **Tip:** Static classes on the same element are preserved. `z-class` only manages the classes it controls — it won’t remove classes you set in plain `class="..."`.

  
### z-style

  
Dynamically set inline styles:

  
| Syntax | Example | Notes |
| --- | --- | --- |
| Object | `z-style="{ color: state.c, fontSize: state.size + 'px' }"` | Keys are camelCase CSS properties |
| String | `z-style="'background:' + state.bg"` | Raw CSS string — replaces the entire `style` attribute |

  

```html
<!-- Object syntax -->
<div z-style="{ color: state.textColor, fontSize: state.size + 'px' }">

<!-- String expression -->
<div z-style="'background:' + state.bg">
```

  

```javascript
$.component('color-picker', {
  state: { hue: 200 },
  render() {
    return \`
      <input type="range" min="0" max="360" z-model="hue" z-number />
      <div z-style="{ backgroundColor: 'hsl(' + state.hue + ', 70%, 50%)', width: '100px', height: '100px', borderRadius: '8px' }"></div>
    \`;
  }
});
```

  
> **Tip:** Object syntax merges with existing inline styles. Use camelCase property names (`fontSize`) — they’re converted to kebab-case (`font-size`) automatically.

  
### z-html & z-text

  
Set element content from an expression:

  
| Directive | Sets | Escapes HTML | Use For |
| --- | --- | --- | --- |
| `z-text` | `textContent` | Yes (safe) | Labels, numbers, any text-only content |
| `z-html` | `innerHTML` | No (raw) | Rendered markdown, rich text from trusted sources |

  

```javascript
$.component('article-view', {
  state: {
    title: 'Hello World',
    body: '<p>This is <strong>rich</strong> content.</p>'
  },
  render() {
    return \`
      <h2 z-text="state.title"></h2>
      <div z-html="state.body"></div>
    \`;
  }
});
```

  
> **Warning:** `z-html` inserts raw HTML — equivalent to Vue’s `v-html`. Never use it with user-supplied content without sanitization. Use `z-text` or `{{expression}}` (which auto-escapes HTML) for user input. See the *Security* section for details.

  
> **Tip:** `z-text` is morph-friendly and will not disrupt focus or selection. Prefer it over `{{}}` interpolation for text-only content that changes frequently.

  
### Event Binding — `@event`

  
Bind any DOM event with `@event="method"` (shorthand) or `z-on:event="method"` (longhand). Works with any native DOM event — `click`, `submit`, `keyup`, `focus`, `input`, `mouseenter`, `scroll`, etc.

  

```html
<!-- Common events -->
<button @click="save">Save</button>
<form @submit.prevent="onSubmit">...</form>
<input @keyup="onKey">
<input @focus="onFocus">
<input @input.debounce.300="search">
<div @mouseenter="onHover">
<div @scroll.throttle.100="onScroll">

<!-- Longhand -->
<button z-on:click="save">Save</button>
```

  
#### Handlers & `$event`

  
A handler value is a **method name** on your component. With no parentheses, the native event object is passed automatically. With parentheses, you control exactly what the handler receives — use `$event` to inject the native event:

  

```html
<!-- No parens → handler receives the native event automatically -->
<button @click="remove">Delete</button>

<!-- With parens → you control the arguments -->
<button @click="remove(item.id)">Delete #{{item.id}}</button>

<!-- Mix $event with your own args -->
<button @click="update(item.id, $event)">Update</button>
```

  

```javascript
$.component('item-list', {
  state: { items: [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }] },

  // No parens: receives native Event
  remove(event) {
    console.log(event.target);
  },

  // With parens: receives what you pass
  remove(id) {
    this.state.items = this.state.items.filter(i => i.id !== id);
  },

  // Mixed: your arg + native event
  update(id, event) {
    console.log('Updating', id, 'from', event.target);
  }
});
```

  
| Expression | Handler Receives | When to Use |
| --- | --- | --- |
| `@submit="save"` | `(event)` | You need the DOM event (target, form data, etc.) |
| `@click="remove(item.id)"` | `(item.id)` | You need data, not the event object |
| `@input="validate(state.email, $event)"` | `(state.email, event)` | You need both data and the event |

  
#### Supported Argument Types

  
Arguments inside parentheses are parsed at call time. These types are supported:

  
| Type | Example | Resolves To |
| --- | --- | --- |
| State path | `@submit.prevent="save(state.name)"` | Current value of `this.state.name` |
| Nested state | `@change="update(state.user.id)"` | Deep property access |
| String | `@click="setMode('edit')"` | `"edit"` |
| Number | `@click="setPage(1)"` | `1` |
| Boolean | `@focus="toggle(true)"` | `true` / `false` |
| Null | `@blur="reset(null)"` | `null` |
| $event | `@keyup="handle($event)"` | Native DOM event object |

  
#### Event Modifiers

  
Modifiers chain with dots — no manual `e.preventDefault()` calls needed:

  
| Modifier | Effect | Example |
| --- | --- | --- |
| `.prevent` | Calls `preventDefault()` | `@submit.prevent="save"` |
| `.stop` | Calls `stopPropagation()` | `@click.stop="toggle"` |
| `.self` | Only fires if target is the element itself | `@click.self="close"` |
| `.once` | Fires once, then ignored | `@click.once="init"` |
| `.outside` | Fires only when event is *outside* the element | `@click.outside="close"` |
| `.capture` | Listens in capture phase | `@click.capture="log"` |
| `.passive` | Passive listener (perf hint) | `@scroll.passive="onScroll"` |
| `.debounce.{ms}` | Delays until idle (default 250ms) | `@input.debounce.300="search"` |
| `.throttle.{ms}` | At most once per interval (default 250ms) | `@scroll.throttle.100="update"` |
| `.enter` | Requires the `Enter` key | `@keyup.enter="submit"` |
| `.escape` | Requires the `Escape` key | `@keydown.escape="close"` |
| `.tab` | Requires the `Tab` key | `@keydown.tab="next"` |
| `.space` | Requires the `Space` key | `@keyup.space="play"` |
| `.delete` | Requires `Delete` or `Backspace` | `@keydown.delete="remove"` |
| `.up` | Requires `ArrowUp` | `@keydown.up="prev"` |
| `.down` | Requires `ArrowDown` | `@keydown.down="next"` |
| `.left` | Requires `ArrowLeft` | `@keydown.left="back"` |
| `.right` | Requires `ArrowRight` | `@keydown.right="forward"` |
| `.ctrl` | Requires `Ctrl` held | `@keyup.ctrl.enter="save"` |
| `.shift` | Requires `Shift` held | `@click.shift="selectRange"` |
| `.alt` | Requires `Alt` held | `@click.alt="inspect"` |
| `.meta` | Requires `Meta` (⌘/⊞) held | `@keyup.meta.enter="send"` |
| `.{key}` | Any key — matched case-insensitively against `e.key` | `@keydown.a="handler"` |

  

```html
<!-- Combine modifiers -->
<form @submit.prevent.stop="save">
  <input @input.debounce.300="search" />
  <button @click.once="init">Initialize</button>
  <div @click.self="close" class="overlay">
    <div class="modal">...</div>
  </div>
</form>

<!-- Key modifiers -->
<input @keyup.enter="submitSearch" placeholder="Press Enter to search" />
<div @keydown.escape="closeModal">...</div>
<div @keydown.up="prevItem" @keydown.down="nextItem">

<!-- Dynamic key modifiers (any key) -->
<input @keydown.a="onLetterA" />
<div @keydown.f1.prevent="showHelp">...</div>
<input @keydown.pagedown="nextPage" @keydown.pageup="prevPage" />

<!-- System key combos -->
<textarea @keyup.ctrl.enter="send">...</textarea>
<div @keydown.ctrl.s.prevent="save">...</div>
<li @click.ctrl="toggleSelect">

<!-- Outside - close dropdown when clicking elsewhere -->
<div class="dropdown" @click.outside="isOpen = false">
  <button @click="isOpen = !isOpen">Menu</button>
  <ul z-show="isOpen">...</ul>
</div>
```

  
> **Tip:** Events use **delegation** — zQuery attaches one listener per event type on the component root and matches targets at fire time. This means dynamically rendered elements (e.g. items from `z-for`) work automatically with no extra binding.

  
> **Key & system modifiers** are combinable: `@keyup.ctrl.enter="save"` requires Ctrl + Enter. Beyond the named shortcuts above, any unrecognised modifier is matched **case-insensitively** against `e.key` — so `.a`, `.f1`, `.pagedown`, `.home`, `.+`, and even `.0` all work. Perfect for hotkeys: `@keydown.ctrl.s.prevent="save"`.

  
> **Tip:** The `.outside` modifier installs a document-level listener (cleaned up on destroy) so clicks anywhere outside the element trigger the handler — ideal for dropdowns, modals, and popovers.

  
### z-model

  
Two-way binding for form elements. The value of `z-model` is a **state property name** — zQuery handles everything else:

  
> **How z-model works**
> 
> 
> ``  ↔  `this.state.email`
> 
> 
> **State → DOM:** On every render, zQuery reads `state.email` and sets the element’s `.value` (or `.checked`, `.selected`, etc.).
> 
> **DOM → State:** When the user types, zQuery listens for the `input` event, reads the element’s value, and writes it back to `state.email` through the reactive proxy — which triggers a re-render. Focus and cursor position are preserved automatically.

  
Nested state paths work too — `z-model="user.profile.name"` maps to `this.state.user.profile.name`. zQuery automatically picks the right DOM property based on element type:

  
| Element | Type | Binds To | Example |
| --- | --- | --- | --- |
| `` | text / email / password / … | `.value` | `` |
| `` | number | `.value` | `` |
| `` | checkbox | `.checked` | `` |
| `` | radio | `.value` (grouped by name) | `` |
| `` | — | `.value` | `` |
| `` | — | `.value` | `...` |
| `` | — | Array of selected values | `...` |
| `[contenteditable]` | — | `.textContent` | `` |

  

```html
<input type="text" z-model="name" />
<input type="checkbox" z-model="agreed" />
<select z-model="country">
  <option value="us">United States</option>
  <option value="uk">United Kingdom</option>
</select>
<textarea z-model="bio"></textarea>
```

  
#### Modifiers

  
Add modifier attributes alongside `z-model`:

  
| Modifier | Effect | Example |
| --- | --- | --- |
| `z-lazy` | Syncs on `change` instead of `input` (fires less often) | `` |
| `z-number` | Casts value to `Number` | `` |
| `z-trim` | Trims leading/trailing whitespace | `` |
| `z-uppercase` | Converts to uppercase before writing to state | `` |
| `z-lowercase` | Converts to lowercase before writing to state | `` |
| `z-debounce` | Debounce state writes (default 250ms, or `z-debounce="500"`) | `` |

  

```html
<!-- Modifiers are separate attributes -->
<input z-model="search" z-lazy />
<input z-model="age" z-number />
<input z-model="username" z-trim />

<!-- Transform and timing modifiers -->
<input z-model="productCode" z-uppercase z-trim />
<input z-model="email" z-lowercase z-trim />
<input z-model="query" z-debounce placeholder="Search..." />
<input z-model="query" z-debounce="500" z-trim />
```

  
> **Tip:** Modifier pipeline order: raw value → `z-trim` → `z-uppercase` / `z-lowercase` → `z-number`. Debounce wraps the entire pipeline so state only updates after the user pauses typing.

  
#### Complete Form Example

  
Putting it all together — a registration form with multiple z-model features:

  

```javascript
$.component('signup-form', {
  state: () => ({
    username: '',
    email: '',
    age: 0,
    plan: 'free',
    bio: '',
    agreed: false,
  }),
  submit() {
    console.log(this.state);
  },
  render() {
    return \`
      <form @submit.prevent="submit">
        <input z-model="username" z-trim z-lowercase placeholder="Username" />
        <input z-model="email" z-trim z-lowercase type="email" placeholder="Email" />
        <input z-model="age" z-number type="number" min="13" />
        <label><input z-model="plan" type="radio" value="free"> Free</label>
        <label><input z-model="plan" type="radio" value="pro"> Pro</label>
        <textarea z-model="bio" z-trim z-debounce="500" placeholder="About you"></textarea>
        <label><input z-model="agreed" type="checkbox"> I agree</label>
        <button type="submit" :disabled="!agreed">Sign Up</button>
      </form>
    \`;
  }
});
```

  
### z-ref

  
Register an element reference accessible via `this.refs`. Useful for imperative DOM access (focus, measurements, third-party libs):

  
| Feature | Detail |
| --- | --- |
| Access | `this.refs.refName` returns the raw DOM element |
| Timing | Available after `mounted()` and `updated()` |
| Re-renders | Refs are re-bound on every render pass — always up to date |
| Multiple | Each `z-ref` name must be unique within the component |

  

```javascript
$.component('focus-input', {
  render() {
    return \`<input z-ref="nameInput" type="text" />\`;
  },
  mounted() {
    this.refs.nameInput.focus();
  }
});
```

  
### z-cloak

  
Prevents flash of uncompiled template. The attribute is removed once the component renders:

  

```html
<div z-cloak>{{ state.message }}</div>
```

  

```css
[z-cloak] { display: none !important; }
```

  
> **Tip:** zQuery automatically injects the `[z-cloak]` CSS rule, so you usually don’t need to add it yourself.

  
### z-pre

  
Skip directive processing for an element and all its children:

  

```html
<div z-pre>
  <!-- This won't be processed - useful for showing raw template syntax -->
  <span z-if="state.show">This z-if is left as-is</span>
</div>
```

  
### z-skip

  
Tell the morph engine to skip this subtree entirely during re-renders:

  

```html
<div z-skip>
  <canvas id="chart"></canvas>
</div>
```

  
> **Warning:** Use `z-skip` sparingly. Skipped subtrees won’t update when state changes — only use it for content managed outside zQuery (third-party libs, highlighted code blocks, etc.).

  
> `z-to-top` and `z-link` are router attributes — see the **Router** documentation section for full usage, values, and examples.

  
### Expression Context

  
Expressions inside directives are evaluated in a sandboxed scope with access to:

  
| Name | Access | Description |
| --- | --- | --- |
| `state` | `state.prop` | Component reactive state |
| `computed` | `computed.prop` | Computed properties |
| `methods` | `methodName()` | Component methods (in `@event`) |
| `Loop variable` | `item`, `index` | Declared in `z-for` — e.g. `z-for="(item, i) in list"` |
| `$index` | `$index` | Auto-provided loop index when no explicit index variable is declared |
| `$event` | `$event` | Native DOM event object (in `@event`) |

  
### External Templates

  
Directives work identically in external `.html` templates loaded via `templateUrl`:

  

```html
<!-- template.html -->
<div z-if="state.loaded">
  <ul>
    <li z-for="item in state.items" z-key="item.id">{{item.name}}</li>
  </ul>
</div>
<div z-else>Loading...</div>
```

  

```javascript
$.component('my-page', {
  templateUrl: 'template.html',
  state: { loaded: false, items: [] },
  async mounted() {
    const res = await $.http.get('/api/items');
    this.state.items = res.data;
    this.state.loaded = true;
  }
});
```

  
### Processing Order

  
Directives are processed in this order on every render pass:

  
| # | Directive | Phase | Description |
| --- | --- | --- | --- |
| 1 | `z-pre` | Skip | Entire subtree excluded from processing |
| 2 | `z-for` | String expansion | List items expanded before morph |
| 3 | `z-html` / `z-text` | String expansion | Content injected before morph |
| 4 | *DOM morph* | Diff & patch | Minimal DOM operations applied |
| 5 | `z-if` / `z-else-if` / `z-else` | Post-morph | Conditional rendering |
| 6 | `z-show` | Post-morph | CSS visibility toggle |
| 7 | `z-bind` / `:attr` | Post-morph | Attribute binding |
| 8 | `z-class` | Post-morph | Dynamic class binding |
| 9 | `z-style` | Post-morph | Dynamic style binding |
| 10 | `z-cloak` | Post-morph | Remove cloak attribute |
| 11 | `@event` / `z-on:event` | Binding | Event listener delegation setup |
| 12 | `z-ref` | Binding | Register in `this.refs` map |
| 13 | `z-model` | Binding | Two-way form binding setup |

  
> **Tip:** String-level directives (`z-for`, `z-html`, `z-text`) run *before* the DOM morph, so their output is diffed efficiently. Post-morph directives run on the live DOM after patching.

---

## Store

  
Global state management with actions, getters, subscriptions, and middleware. Inspired by Vuex/Redux but without the boilerplate.

  
> **Data flow:** Component dispatches `action` → middleware pipeline → action mutates `state` → getters recompute → subscribers notified → UI updates

  
### Setup

  

```javascript
const store = $.store({
  state: {
    user: null,
    theme: 'dark',
    count: 0
  },
  getters: {
    isLoggedIn: (state) => !!state.user,
    displayName: (state) => state.user?.name || 'Guest'
  },
  actions: {
    login(state, user) { state.user = user; },
    logout(state)      { state.user = null; },
    increment(state)   { state.count++; },
    setTheme(state, t) { state.theme = t; }
  }
});
```

  
| Option | Type | Description |
| --- | --- | --- |
| `state` | object \| function | Initial state (becomes reactive). Function form creates a fresh copy. |
| `getters` | object | Derived values — `fn(state)` |
| `actions` | object | Functions that mutate state — `fn(state, ...args)` |
| `debug` | boolean | Log dispatched actions to console (default `false`) |
| `maxHistory` | number | Maximum action history entries to keep (default `1000`) |
| `maxUndo` | number | Maximum undo checkpoint stack size (default `50`) |

  
### Dispatching Actions

  

```javascript
store.dispatch('increment');
store.dispatch('login', { name: 'Alice', role: 'admin' });
store.dispatch('setTheme', 'light');

// dispatch() returns the action's return value
const result = store.dispatch('compute');
```

  
> **Warning:** Mutate state only inside actions. Direct mutation like `store.state.count++` triggers subscribers (via reactive Proxy) but bypasses middleware and action history.

  
> **Tip:** `dispatch()` returns whatever the action function returns. This is useful for actions that compute a value or return a status.

  
### Reading State & Getters

  

```javascript
// State
console.log(store.state.count);   // 0
console.log(store.state.theme);   // 'dark'

// Getters
console.log(store.getters.isLoggedIn);   // false
console.log(store.getters.displayName);  // 'Guest'
```

  
### Subscriptions

  
React to state changes anywhere in your app:

  
| Pattern | Use Case |
| --- | --- |
| Key-specific subscriber | React when a single state key changes |
| Wildcard subscriber | Logging, analytics, persistence (all changes) |
| Component-bound | Re-render component on store change |

  
| Signature | Callback Args | Use Case |
| --- | --- | --- |
| `subscribe(key, fn)` | `(key, value, oldValue)` | React to a single state key |
| `subscribe(fn)` | `(key, value, oldValue)` | React to all state changes |

  
> **Tip:** Both key-specific and wildcard subscribers receive the same arguments: `(key, value, oldValue)`.

  

```javascript
// Subscribe to a specific state key
const unsub = store.subscribe('count', (key, value, oldValue) => {
  console.log(\`count changed: \$\{oldValue} → \$\{value}\`);
});

// Subscribe to ALL state changes (wildcard)
const unsubAll = store.subscribe((key, value, oldValue) => {
  console.log(\`[Store] \$\{key}: \$\{oldValue} → \$\{value}\`);
});

// Unsubscribe later
unsub();
unsubAll();
```

  
### Middleware

  
Intercept every dispatch for logging, validation, or persistence:

  

```javascript
const store = $.store({
  state: { count: 0 },
  actions: { increment(s) { s.count++; } }
});

// Add middleware with store.use()
store.use((actionName, args, state) => {
  console.log(\`[\$\{actionName}]\`, args, state);
  // Return false to BLOCK the action
});

// Validation middleware
store.use((actionName, args, state) => {
  if (actionName === 'increment' && state.count >= 100) {
    console.warn('Count limit reached');
    return false;  // block the dispatch
  }
});
```

  
| Parameter | Description |
| --- | --- |
| `actionName` | Action name string |
| `args` | Arguments array passed to dispatch |
| `state` | Current state object |

  
> **Tip:** Middleware runs in the order added via `store.use()`. Return `false` from any middleware to block the dispatch. All other return values are ignored.

  

```javascript
// use() is chainable
store
  .use((name, args) => console.log(name, args))
  .use((name, args, state) => {
    if (name === 'delete' && !state.isAdmin) return false;
  });
```

  
### Named Stores

  
Create multiple independent stores and retrieve them by name. `$.getStore(name)` returns the store instance, or `null` if no store with that name exists.

  

```javascript
$.store('auth', { state: { user: null }, actions: { /* ... */ } });
$.store('cart', { state: { items: [] }, actions: { /* ... */ } });

// Retrieve anywhere
const auth = $.getStore('auth');
const cart = $.getStore('cart');

// Returns null for unknown store names
const nope = $.getStore('nonexistent');  // null
```

  
> **Tip:** If no name is passed to `$.store(config)`, the store is registered under `"default"`. Retrieve it with `$.getStore()` (no argument).

  
### Async Actions

  
Actions can be `async` — `dispatch()` returns the Promise so you can `await` the result:

  

```javascript
const store = $.store({
  state: { data: null, loading: false },
  actions: {
    async fetchData(state, url) {
      state.loading = true;
      const res = await fetch(url);
      state.data = await res.json();
      state.loading = false;
    }
  }
});

await store.dispatch('fetchData', '/api/users');
```

  
> **Tip:** Because `dispatch()` returns the action's return value, async actions naturally return a Promise you can `await`, chain with `.then()`, or ignore for fire-and-forget.

  
### Batch Updates

  
Group multiple state mutations into a single notification pass. Subscribers fire once per key with only the **final** value, eliminating redundant re-renders.

  

```javascript
// Without batch: subscriber fires for EACH mutation
store.subscribe('count', (v) => console.log(v));  // fires 3 times

store.state.count = 1;
store.state.count = 2;
store.state.count = 3;

// With batch: subscriber fires ONCE with the final value
store.batch(state => {
  state.count = 1;
  state.count = 2;
  state.count = 3;  // subscriber only sees this value
  state.name = 'hello';
});
```

  
| Behavior | Detail |
| --- | --- |
| Deduplication | Multiple writes to the same key fire the subscriber **once** with the last value |
| Per-key granularity | Each changed key fires its own subscriber independently |
| Return value | `batch()` returns whatever the callback returns |
| Error safety | If the callback throws, pending notifications still flush via `finally` |
| Nesting | Nested `batch()` calls are safe — only the outermost batch flushes |

  
> **Tip:** Use `batch()` when updating multiple state keys inside a loop or complex handler. This prevents intermediate states from triggering wasted renders.

  
### Checkpoint / Undo / Redo

  
Snapshot-based undo/redo system. Call `checkpoint()` before making changes to save a restore point. `undo()` reverts to the last checkpoint, and `redo()` re-applies the last undo.

  

```javascript
const store = $.store({
  state: { text: '', color: 'blue' },
  maxUndo: 50,  // optional, default 50
  actions: {
    setText(state, val) { state.text = val; },
    setColor(state, val) { state.color = val; }
  }
});

store.checkpoint();                   // save current state
store.dispatch('setText', 'hello');
store.dispatch('setColor', 'red');

store.canUndo;  // true
store.undo();   // state → { text: '', color: 'blue' }

store.canRedo;  // true
store.redo();   // state → { text: 'hello', color: 'red' }
```

  
| API | Returns | Description |
| --- | --- | --- |
| `store.checkpoint()` | `void` | Snapshot current state and push onto the undo stack. Clears the redo stack (new branch). |
| `store.undo()` | `boolean` | Revert to the last checkpoint. Returns `false` if nothing to undo. |
| `store.redo()` | `boolean` | Re-apply the last undo. Returns `false` if nothing to redo. |
| `store.canUndo` | `boolean` | Getter — `true` if the undo stack is non-empty |
| `store.canRedo` | `boolean` | Getter — `true` if the redo stack is non-empty |

  

```javascript
// Undo/redo with UI buttons
document.querySelector('#undo').addEventListener('click', () => {
  if (store.canUndo) store.undo();
});
document.querySelector('#redo').addEventListener('click', () => {
  if (store.canRedo) store.redo();
});
```

  
> **Warning:** `checkpoint()` clears the redo stack. Once you save a new checkpoint after undoing, you cannot redo past that point (same behavior as most text editors).

  
> **Tip:** The undo stack is capped at `maxUndo` (default 50). When exceeded, the oldest checkpoint is discarded. Set `maxUndo` in the store config to tune.

  
### State Utilities

  
| Method | Description |
| --- | --- |
| `store.replaceState(obj)` | Replace entire state object |
| `store.reset(initialState?)` | Replace state and clear action history + undo/redo stacks. When called **with no arguments**, resets to the original initial state passed at store creation. |
| `store.snapshot()` | Deep clone of current state |
| `store.use(fn)` | Add middleware — `fn(actionName, args, state)`, return `false` to block |
| `store.batch(fn)` | Group mutations — subscribers fire once per key with the final value |
| `store.checkpoint()` | Snapshot state onto the undo stack (clears redo stack) |
| `store.undo()` | Revert to last checkpoint — returns `false` if nothing to undo |
| `store.redo()` | Re-apply last undo — returns `false` if nothing to redo |
| `store.canUndo` | Getter — `true` if the undo stack is non-empty |
| `store.canRedo` | Getter — `true` if the redo stack is non-empty |
| `store.history` | Array of `{ action, args, timestamp }` entries |

  

```javascript
// Save / restore
const saved = store.snapshot();
store.replaceState(saved);

// Reset to original initial state (clears history + undo/redo)
store.reset();

// Reset to a custom state
store.reset({ count: 0, user: null });

// View action history
console.log(store.history);
// [{ action: 'increment', args: [], timestamp: 1700000000000 }, ...]
```

  
> **Tip:** `store.history` is capped at `maxHistory` entries (default 1000). When the cap is exceeded, the oldest entries are trimmed automatically. Set `maxHistory` in the store config to tune.

  
> **Tip:** `store.reset()` with no arguments uses a deep copy of the original initial state you passed at store creation — no need to keep a reference to it yourself.

  
### Error Resilience

  
The store catches and reports errors in subscribers, actions, and middleware so a single bug never brings down the whole app:

  
| Scenario | Behavior |
| --- | --- |
| Subscriber throws | Error is caught and reported via `$.reportError()`. Other subscribers still fire. |
| Action throws | Error is caught and reported. State may be partially mutated — keep actions simple. |
| Middleware throws | Error is caught and reported. The action is **not** executed (same as returning `false`). |
| Unknown action dispatched | Warning reported via `$.reportError()`. No crash. |

  
> **Tip:** All store errors use the `STORE_ACTION`, `STORE_SUBSCRIBE`, or `STORE_MIDDLEWARE` error codes. See the *Error Handling → All Error Codes* section for details.

  
### Using Store in Components

  

```javascript
import { store } from '../../store.js';

$.component('user-status', {
  state: { name: '' },
  mounted() {
    // Sync store → component on any store change
    this._unsub = store.subscribe((key, value, old) => {
      this.state.name = store.getters.displayName;
      this.scheduleUpdate();
    });
    this.state.name = store.getters.displayName;
  },
  destroyed() {
    this._unsub();
  },
  template() {
    return \`<span>Hello, \$\{this.state.name}</span>\`;
  }
});
```

  
> **Tip:** When storing arrays in state, use `state.items = [...state.items, newItem]` for reliable reactivity, or use `splice/push` on `$.reactive()` arrays.

  
> **Warning:** Always call the unsubscribe function in `destroyed()` to avoid memory leaks.

  
### Quick Reference

  
| API | Description |
| --- | --- |
| `$.store(config)` | Create a store (registered as `"default"`) |
| `$.store(name, config)` | Create a named store |
| `$.getStore(name?)` | Retrieve a store by name (`null` if not found) |
| `store.state` | Reactive state proxy — read/write triggers subscriptions |
| `store.getters` | Computed derived values (lazy, re-evaluated on access) |
| `store.dispatch(name, ...args)` | Run a named action through middleware → returns action result |
| `store.subscribe(key, fn)` | Listen to one key — `fn(value, old, key)` |
| `store.subscribe(fn)` | Listen to all keys — `fn(key, value, old)` |
| `store.use(fn)` | Add middleware (chainable) — return `false` to block |
| `store.batch(fn)` | Group mutations — subscribers fire once per key with final value |
| `store.checkpoint()` | Snapshot state onto undo stack (clears redo) |
| `store.undo()` | Revert to last checkpoint — returns `boolean` |
| `store.redo()` | Re-apply last undo — returns `boolean` |
| `store.canUndo` | Getter — `true` if undo stack is non-empty |
| `store.canRedo` | Getter — `true` if redo stack is non-empty |
| `store.snapshot()` | Deep clone of current state |
| `store.replaceState(obj)` | Replace entire state (old keys removed) |
| `store.reset(obj?)` | Replace state + clear history and undo/redo stacks (defaults to initial state) |
| `store.history` | Read-only array of `{ action, args, timestamp }` |

---

## HTTP Client

  
A lightweight `fetch`-based HTTP client with automatic JSON parsing, interceptors, abort support, and a clean chainable API.

  
### Request Methods

  
| Method | Signature | Description |
| --- | --- | --- |
| `$.http.get` | `get(url, params?, opts?)` | GET request (params serialized as query string) |
| `$.http.post` | `post(url, data?, opts?)` | POST request (JSON body) |
| `$.http.put` | `put(url, data?, opts?)` | PUT request |
| `$.http.patch` | `patch(url, data?, opts?)` | PATCH request |
| `$.http.delete` | `delete(url, data?, opts?)` | DELETE request |
| `$.http.head` | `head(url, opts?)` | HEAD request — no body; useful for resource checks, content-length, caching headers |

  

```javascript
// Basic GET
const res = await $.http.get('/api/users');
console.log(res.data);  // parsed JSON

// GET with query params - appended as ?page=2&limit=10
await $.http.get('/api/users', { page: 2, limit: 10 });

// GET with existing query string - params appended with &
await $.http.get('/api/search?q=hello', { page: 2 });
// → /api/search?q=hello&page=2

// POST with JSON body
await $.http.post('/api/users', { name: 'Alice', role: 'admin' });

// PUT
await $.http.put('/api/users/1', { name: 'Alice Updated' });

// PATCH - partial update
await $.http.patch('/api/users/1', { role: 'editor' });

// DELETE (body optional)
await $.http.delete('/api/users/1');
await $.http.delete('/api/items', { ids: [1, 2, 3] });  // with body

// HEAD - check resource existence or read headers (no body transferred)
const check = await $.http.head('/api/users/1');
console.log(check.ok);      // true if resource exists
console.log(check.headers); // { 'content-length': '1234', ... }
```

  
### Configuration

  

```javascript
// Set defaults for all requests
$.http.configure({
  baseURL: 'https://api.example.com',
  headers: {
    'Authorization': 'Bearer token123',
    'X-Custom': 'value'
  },
  timeout: 5000
});

// Read current config at any time (returns a safe copy)
const cfg = $.http.getConfig();
console.log(cfg.baseURL);  // 'https://api.example.com'
console.log(cfg.timeout);  // 5000
console.log(cfg.headers);  // { 'Content-Type': '...', 'Authorization': '...' }
```

  
| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `baseURL` | string | `''` | Prepended to all relative URLs |
| `headers` | object | `{ 'Content-Type': 'application/json' }` | Default headers merged into every request |
| `timeout` | number | `30000` | Request timeout in ms (0 = no timeout) |

  
| Method | Description |
| --- | --- |
| `$.http.configure(opts)` | Set defaults for `baseURL`, `headers`, and `timeout` |
| `$.http.getConfig()` | Returns a safe copy of current config: `{ baseURL, headers, timeout }` |

  
> **Tip:** Per-request config overrides defaults: `$.http.get('/api/data', null, { timeout: 10000 })`. Set `timeout: 0` to disable the timeout entirely.

  
### Response Object

  
Every request method returns a `Promise`:

  
| Property | Type | Description |
| --- | --- | --- |
| `data` | `any` | Auto-parsed body (JSON object, text string, or Blob — see Auto-Parsing below) |
| `status` | `number` | HTTP status code (200, 404, 500, etc.) |
| `statusText` | `string` | HTTP status text ("OK", "Not Found", etc.) |
| `headers` | `Record` | Response headers as a plain key-value object |
| `ok` | `boolean` | `true` if status 200–299 |
| `response` | `Response` | Original `fetch` Response object (for streaming, etc.) |

  

```javascript
const res = await $.http.get('/api/users');
console.log(res.ok);         // true
console.log(res.status);     // 200
console.log(res.data);       // { users: [...] }
console.log(res.headers);    // { 'content-type': 'application/json', ... }
console.log(res.response);   // raw fetch Response (for advanced use)
```

  
### Auto-Parsing

  
The response body is automatically parsed based on the `Content-Type` header:

  
| Content-Type | `data` type | Behavior |
| --- | --- | --- |
| `application/json` | object | `response.json()` — auto-parsed into a JS object |
| `text/*` | string | `response.text()` — plain text |
| `application/octet-stream`, `image/*` | Blob | `response.blob()` — binary data |
| Other / unknown | object or string | Try JSON parse first, fall back to text |
| Parse failure | `null` | Returns `null` with a console warning |

  

```javascript
// JSON - auto-parsed
const json = await $.http.get('/api/users');
console.log(json.data);  // { users: [...] }

// Text - returned as string
const text = await $.http.get('/api/health');
console.log(text.data);  // "OK"

// Binary - returned as Blob
const img = await $.http.get('/api/avatar.png');
const url = URL.createObjectURL(img.data);
```

  
### Interceptors

  
Transform requests and responses globally:

  

```javascript
// Request interceptor - runs before every fetch
$.http.onRequest((fetchOpts, url) => {
  fetchOpts.headers['X-Timestamp'] = Date.now();
  // Return nothing to continue, or return { url, options } to modify
});

// Response interceptor - runs after every response
$.http.onResponse((result) => {
  if (result.status === 401) {
    window.location = '/login';
  }
});

// Block a request by returning false
$.http.onRequest((fetchOpts, url) => {
  if (url.includes('/admin') && !isAdmin) return false;
});
```

  
| Method | Signature | Behavior |
| --- | --- | --- |
| `onRequest(fn)` | `(fetchOpts, url)` | Return `false` to block, `{ url, options }` to modify, or nothing. **Returns** unsubscribe function |
| `onResponse(fn)` | `(result)` | Receives `{ ok, status, data, headers, response }`. **Returns** unsubscribe function |
| `clearInterceptors(type?)` | `(type?)` | No args = clear all; `"request"` or `"response"` for one type |

  

```javascript
// Interceptors return unsubscribe functions (like $.bus.on)
const unsub = $.http.onRequest((opts, url) => {
  opts.headers['X-Token'] = getToken();
});

// Later - remove this specific interceptor
unsub();

// Nuclear option - remove all interceptors at once
$.http.clearInterceptors();

// Or just one type
$.http.clearInterceptors('request');
$.http.clearInterceptors('response');
```

  
### Abort / Cancel

  
Use `$.http.createAbort()` (or `new AbortController()`) and pass its signal via the `opts` parameter (3rd argument):

  

```javascript
const controller = $.http.createAbort();

// Signal goes in the 3rd arg (opts), 2nd arg is data/params (null here)
$.http.get('/api/slow', null, { signal: controller.signal })
  .catch(err => console.log(err.message));
  // → "Request aborted: GET https://…/api/slow"

// Cancel after 2 seconds
setTimeout(() => controller.abort(), 2000);
```

  
> **Tip:** You can also use `new AbortController()` directly — `$.http.createAbort()` is a convenience alias. When both a user signal and the default timeout are active, they are automatically combined.

  
**Timeout vs. Abort messages:**

  
| Scenario | Error Message |
| --- | --- |
| Timeout fires | `Request timeout after 30000ms: GET /api/slow` |
| User calls `controller.abort()` | `Request aborted: GET /api/slow` |

  
### FormData & String Bodies

  
The `data` parameter accepts three types:

  
| Data Type | Behavior |
| --- | --- |
| Object | `JSON.stringify()` — sent with `Content-Type: application/json` |
| FormData | Sent raw — `Content-Type` header is *removed* so the browser auto-sets `multipart/form-data` with the correct boundary |
| String | Sent as-is — useful for XML, CSV, plain text, etc. |

  

```javascript
// FormData - file upload
const form = document.querySelector('#upload-form');
const formData = new FormData(form);
await $.http.post('/api/upload', formData);

// String body - plain text, CSV, XML, etc.
await $.http.post('/api/log', 'Raw log entry text');

// Object - auto JSON.stringify()
await $.http.post('/api/users', { name: 'Alice' });
```

  
> **Tip:** For GET and HEAD requests, object data is serialized as query parameters instead of a request body.

  
### Error Handling

  
> 4xx Client errors | 5xx Server errors | Network Connection failures | Abort Timeout / cancel

  
Non-2xx responses throw an `Error` with an attached `err.response` object:

  
| Error Source | `err.response` | `err.message` |
| --- | --- | --- |
| 4xx / 5xx status | Full response object (`status`, `data`, `headers`) | `HTTP 404: Not Found` |
| Network failure | `undefined` | `Failed to fetch` (browser message) |
| Timeout | `undefined` | `Request timeout after 30000ms: GET /api/slow` |
| User abort | `undefined` | `Request aborted: GET /api/data` |
| Invalid URL | `undefined` | `HTTP request requires a URL string, got undefined` |

  

```javascript
try {
  const res = await $.http.get('/api/data');
  console.log(res.data);
} catch (err) {
  if (err.response) {
    // Server responded with 4xx/5xx
    console.log(err.response.status);  // 404
    console.log(err.response.data);    // { error: 'Not Found' }
  } else {
    // Network error, timeout, abort, or invalid URL
    console.log(err.message);
  }
}
```

  
> **Tip:** The `err.response` property is only present for server errors (4xx/5xx). Network failures, timeouts, and aborts produce a plain `Error` without `.response`.

  
### Per-Request Options

  
The `opts` parameter (3rd argument) accepts any `RequestInit` property plus zQuery extras:

  
| Option | Type | Description |
| --- | --- | --- |
| `headers` | `Record` | Merged with default headers for this request |
| `timeout` | `number` | Override default timeout (ms). `0` disables timeout. |
| `signal` | `AbortSignal` | Abort signal for manual cancellation |
| `mode` | `string` | Fetch mode: `"cors"`, `"no-cors"`, `"same-origin"` |
| `credentials` | `string` | `"include"`, `"same-origin"`, `"omit"` |
| `cache` | `string` | `"no-cache"`, `"no-store"`, `"reload"`, etc. |
| `redirect` | `string` | `"follow"`, `"manual"`, `"error"` |

  

```javascript
// Custom headers for one request
await $.http.get('/api/data', null, {
  headers: { 'X-Request-Id': 'abc-123' }
});

// No timeout for a slow endpoint
await $.http.post('/api/report', bigPayload, { timeout: 0 });

// Include cookies for cross-origin request
await $.http.get('/api/me', null, {
  credentials: 'include',
  mode: 'cors'
});
```

  
### Parallel Requests

  
Use `$.http.all()` to fire multiple requests concurrently and wait for all of them:

  

```javascript
// Fetch three endpoints in parallel
const [users, posts, comments] = await $.http.all([
  $.http.get('/api/users'),
  $.http.get('/api/posts'),
  $.http.get('/api/comments'),
]);

console.log(users.data, posts.data, comments.data);

// If any request fails, the whole call rejects
try {
  await $.http.all([$.http.get('/a'), $.http.get('/404')]);
} catch (err) {
  console.log(err.message); // "HTTP 404: Not Found"
}
```

  
> **Tip:** `$.http.all()` is a convenience wrapper around `Promise.all` that keeps your HTTP operations in a single namespace.

  
### Raw Fetch Passthrough

  
Need full `fetch` control? Use `$.http.raw()` for a direct `fetch` passthrough — no interceptors, no JSON parsing, no timeout:

  

```javascript
// Direct fetch - no interceptors, no JSON parsing
const res = await $.http.raw('/api/stream', {
  method: 'GET',
  cache: 'no-store',
  credentials: 'include'
});
const reader = res.body.getReader();

// Useful for streaming, SSE, or any edge case
const events = await $.http.raw('/api/events', {
  headers: { Accept: 'text/event-stream' }
});
```

  
> **Warning:** `$.http.raw()` returns a native `Response` object, not the zQuery `HttpResponse` wrapper. You handle parsing, errors, and timeouts yourself.

---

## Reactive

  
Standalone reactivity primitives you can use anywhere — inside or outside components.

  
> **Signal flow:** `$.signal()` / `$.reactive()` → `$.computed()` derives → `$.effect()` runs side-effects

  
### $.reactive()

  
Create a deeply reactive proxy that notifies on any property change:

  

```javascript
const data = $.reactive({
  user: { name: 'Alice', score: 0 },
  items: ['a', 'b', 'c']
}, (prop, value, oldValue) => {
  console.log(\`Changed: \$\{prop} = \$\{oldValue} → \$\{value}\`);
});

data.user.score = 42;     // logs "Changed: score = 0 → 42"
data.items.push('d');      // logs "Changed: 3 = undefined → d"
delete data.user.score;    // logs "Changed: score = 42 → undefined"
```

  
| Parameter | Type | Description |
| --- | --- | --- |
| `target` | object | The object to make reactive |
| `callback` | function | Called on every property change `(key, value, oldValue)` |

  
| Special Property | Description |
| --- | --- |
| `__raw` | Access the unwrapped original object |
| `__isReactive` | Always `true` on reactive proxies |

  
> **Warning:** Array mutation methods (`push`, `splice`, etc.) trigger the callback for each affected index. For bulk updates, consider replacing the entire array: `data.items = [...data.items, ...newItems]`.

  

```javascript
// Array reactivity examples
data.items.push('d');      // callback fires for index 3 + length
data.items[0] = 'z';      // callback fires for index '0'
data.items.splice(1, 1);  // callback fires for each shifted index

// Passing a non-object returns it as-is (no proxy)
$.reactive(42, fn);        // → 42
$.reactive(null, fn);      // → null
```

  
> **Tip:** `delete obj.key` triggers the callback with `(key, undefined, oldValue)` — useful for clearing optional properties.

  
### $.Signal

  
The `Signal` class constructor is also exposed directly as `$.Signal`. This is the same class returned by `$.signal()` — use it for `instanceof` checks or when you prefer the `new` keyword:

  

```javascript
// Using the constructor directly
const count = new $.Signal(0);

// instanceof check
console.log(count instanceof $.Signal);  // true

// Identical to $.signal(0)
const same = $.signal(0);
console.log(same instanceof $.Signal);   // true
```

  
> **Tip:** `$.signal(val)` is the recommended shorthand. `$.Signal` is mainly useful for type checks and advanced patterns.

  
### $.signal()

  
A fine-grained reactive primitive. Read with `.value`, write by assigning `.value`:

  

```javascript
const count = $.signal(0);

console.log(count.value);  // 0
count.value = 5;           // triggers subscribers

// Subscribe to changes (callback receives no arguments - read .value inside)
const unsub = count.subscribe(() => console.log('Count is now', count.value));
unsub();  // unsubscribe
```

  
| Member | Description |
| --- | --- |
| `.value` | Get or set the current value (triggers reactivity on set) |
| *equality check* | Assigning the same value (`===`) is a no-op — no subscribers fire |
| `.subscribe(fn)` | Register a listener `fn()` called with no arguments; returns an unsubscribe function |
| `.peek()` | Read value without triggering tracking |
| `.toString()` | Returns `String(.value)` |

  
### $.computed()

  
Derive a read-only signal from other signals. Re-evaluates automatically when dependencies change:

  

```javascript
const price    = $.signal(29.99);
const quantity = $.signal(3);
const total    = $.computed(() => price.value * quantity.value);

console.log(total.value);  // 89.97
quantity.value = 5;
console.log(total.value);  // 149.95
```

  
> **Tip:** Computed signals only notify subscribers when the **result actually changes**. If a dependency changes but the computed value stays the same, subscribers are not fired.

  

```javascript
// Chained computed - computed from computed
const count = $.signal(2);
const doubled = $.computed(() => count.value * 2);
const quadrupled = $.computed(() => doubled.value * 2);
console.log(quadrupled.value);  // 8
count.value = 3;
console.log(quadrupled.value);  // 12
```

  
### $.effect()

  
Run a side-effect whenever its tracked signals change. Returns a **dispose** function that stops all tracking:

  

```javascript
const theme = $.signal('dark');

const dispose = $.effect(() => {
  document.body.className = theme.value;
});

theme.value = 'light';  // body.className → 'light'
dispose();              // stop tracking - future changes ignored
```

  

```javascript
// peek() reads value WITHOUT creating a dependency
const count = $.signal(0);
const label = $.signal('Count');

$.effect(() => {
  // label.value is tracked - effect re-runs when label changes
  // count.peek() is NOT tracked - changes to count are ignored
  console.log(label.value + ':', count.peek());
});
```

  
> **Tip:** Effects automatically clean up stale dependencies on each re-run. If a conditional branch stops reading a signal, the effect unsubscribes from it. This prevents memory leaks and unnecessary re-runs.

  
### $.batch()

  
Defer all signal notifications until the batch function completes. Effects that depend on multiple signals run **exactly once** (deduplicated by subscriber identity).

  

```javascript
const a = $.signal(1);
const b = $.signal(2);

$.effect(() => {
  console.log(a.value + b.value);
});
// logs 3

$.batch(() => {
  a.value = 10;
  b.value = 20;
});
// Effect fires ONCE → logs 30 (not 12 then 30)
```

  
| Behavior | Detail |
| --- | --- |
| Deduplication | Each affected subscriber runs once, regardless of how many signals changed |
| Nesting | Inner `batch()` calls just run — only the outermost batch flushes |
| Error safety | Subscribers still flush via `finally` if the batch callback throws |
| Computed signals | Update correctly after batch — dependencies are recalculated on access |
| Return value | `batch()` returns whatever the callback returns |

  

```javascript
// batch() returns the callback's return value
const result = $.batch(() => {
  a.value = 100;
  b.value = 200;
  return a.value + b.value;
});
console.log(result); // 300
```

  
> **Tip:** Use `$.batch()` when updating multiple related signals in one operation — such as form resets or API response hydration — to avoid intermediate renders.

  
### $.untracked()

  
Read signals inside `untracked()` without registering them as dependencies. The enclosing effect will **not** re-run when those signals change.

  

```javascript
const a = $.signal(1);
const b = $.signal(10);

$.effect(() => {
  const aVal = a.value;                      // tracked
  const bVal = $.untracked(() => b.value);    // NOT tracked
  console.log(aVal + bVal);
});
// logs 11

b.value = 20;   // effect does NOT re-run
a.value = 2;    // effect re-runs → logs 22 (reads updated b)
```

  
| Behavior | Detail |
| --- | --- |
| Return value | Returns whatever the callback returns |
| Works in `computed()` | Yes — reads inside `untracked()` are not tracked as computed dependencies either |
| Outer tracking | Preserves the outer effect's tracking context — signals read *outside* `untracked()` are still tracked |
| No effect context | If called outside an effect, it just runs the callback normally |

  
> **Tip:** Use `$.untracked()` to read "reference data" (e.g. a config signal) without subscribing to its changes. This is especially useful when one signal is used only for its current snapshot.

  
### Summary

  
| Function | Returns | Use Case |
| --- | --- | --- |
| `$.reactive(obj, cb)` | Proxy | Deep object reactivity with change callback |
| `$.signal(val)` | Signal | Single-value reactivity (fine-grained) |
| `$.computed(fn)` | Computed Signal | Derived values that auto-update |
| `$.effect(fn)` | dispose fn | Side-effects that re-run on signal changes |
| `$.batch(fn)` | any | Defer notifications — subscribers run once after all signals update |
| `$.untracked(fn)` | any | Read signals without subscribing — changes are ignored |

  
> **Tip:** Use `signals` for individual values that change independently. Use `$.reactive()` when you have a config object or deeply nested state that needs unified change detection.

  
### How Auto-Tracking Works

  
When an `$.effect()` runs, it sets a global flag. Any `.value` read during that run registers the effect as a subscriber. On the next run, old subscriptions are cleaned up and new ones are created based on whatever signals were actually read:

  

```javascript
const show = $.signal(true);
const a = $.signal('A');
const b = $.signal('B');

$.effect(() => {
  // Only the signals read THIS run become dependencies
  if (show.value) {
    console.log(a.value);   // a is tracked
  } else {
    console.log(b.value);   // b is tracked instead
  }
});
// Logs 'A'

show.value = false;
// Effect re-runs, now tracks show + b (a is unsubscribed)
// Logs 'B'

a.value = 'A2';  // does NOT re-run (a is no longer tracked)
```

  
> **Key concept:** Dependencies are dynamic. An effect only tracks signals it actually reads during its most recent execution. This is why `peek()` is useful — it reads a value without becoming a dependency.

  
### Error Resilience

  
All reactive callbacks are wrapped in try/catch. A single error never crashes the system:

  
| Scenario | Behavior |
| --- | --- |
| `$.reactive()` onChange throws | Error caught and reported. The property is still set. |
| Signal subscriber throws | Error caught. Remaining subscribers still fire. |
| `$.effect()` function throws | Error caught and reported. Effect remains active for future runs. |
| `$.computed()` function throws | Error caught via the internal effect. Signal value stays at previous result. |
| Invalid onChange (not a function) | Warning reported, replaced with a no-op. Proxy still works. |

  
> **Tip:** Reactive errors use the `REACTIVE_CALLBACK`, `SIGNAL_CALLBACK`, and `EFFECT_EXEC` error codes. See the *Error Handling → All Error Codes* section for details.

  
### Quick Reference

  
| API | Description |
| --- | --- |
| `$.reactive(obj, cb)` | Deep reactive proxy — `cb(key, value, old)` on every set/delete |
| `obj.__raw` | Unwrap to the original object |
| `obj.__isReactive` | Always `true` on reactive proxies |
| `$.Signal` | Signal class constructor (for `instanceof` checks) |
| `$.signal(val)` | Create a signal — read/write via `.value` |
| `.value` | Get/set (auto-tracks in effects, skips same-value writes) |
| `.peek()` | Read without tracking (avoids effect dependency) |
| `.subscribe(fn)` | Manual subscription — returns unsubscribe function |
| `.toString()` | Returns `String(value)` |
| `$.computed(fn)` | Derived signal — re-computes when deps change, skips if result unchanged |
| `$.effect(fn)` | Side-effect that auto-tracks — returns dispose function |
| `$.batch(fn)` | Defer notifications — subscribers fire once after batch completes |
| `$.untracked(fn)` | Read signals without creating dependencies |

---

## Selectors & Collections

  
zQuery ships a jQuery-style `$()` selector that returns a `ZQueryCollection` — an array-like wrapper with chainable DOM manipulation methods, plus a handful of global helpers on `$` itself.

  
### $() Main Selector

  
`$()` accepts multiple overloads:

  
| Call Form | Returns | Description |
| --- | --- | --- |
| `$(selector)` | `ZQueryCollection` | CSS selector → all matching elements |
| `$(element)` | `ZQueryCollection` | Wrap a single DOM element |
| `$(nodeList)` | `ZQueryCollection` | Wrap a NodeList or HTMLCollection |
| `$(collection)` | `ZQueryCollection` | Re-wrap another ZQueryCollection |
| `$(window)` | `ZQueryCollection` | Wrap the Window object (for events) |
| `$(document)` | `ZQueryCollection` | Wrap the Document object |
| `$(html)` | `ZQueryCollection` | Parse an HTML string into elements |

  

```javascript
// CSS selector
$('.nav-link').addClass('active');

// Wrap a raw element
$(document.body).css({ background: '#0d1117' });

// Parse HTML string
$('<div class="toast">Saved!</div>').appendTo('body');

// NodeList
$(document.querySelectorAll('input')).val('');
```

  
### Raw-Element Shortcuts

  
When you need a single raw `HTMLElement` instead of a collection:

  
| Method | Returns | Equivalent |
| --- | --- | --- |
| `$.id(id)` | `Element \| null` | `document.getElementById(id)` |
| `$.class(name)` | `Element \| null` | `document.querySelector('.name')` |
| `$.qs(selector, context?)` | `Element \| null` | `context.querySelector(selector)` |
| `$.qsa(selector, context?)` | `Element[]` | `Array.from(context.querySelectorAll(selector))` |

  

```javascript
// Fast ID lookup (no collection overhead)
const el = $.id('main-content');
el.textContent = 'Updated';

// Class lookup (returns first matching element)
const card = $.class('card');
console.log(card?.textContent);

// Raw querySelector shortcut
const nav = $.qs('.main-nav');
nav.style.background = '#1a1a2e';

// Raw querySelectorAll - returns a plain Array
const items = $.qsa('.list-item');
items.forEach(el => el.classList.add('ready'));

// With a context element
const sidebar = $.id('sidebar');
const links = $.qsa('a', sidebar);
console.log(links.length);
```

  
### Multi-Element Shortcuts

  
These all return a `ZQueryCollection` so you can chain methods directly:

  
| Method | Returns | Equivalent |
| --- | --- | --- |
| `$.all(selector, context?)` | `ZQueryCollection` | `context.querySelectorAll(selector)` |
| `$.classes(name)` | `ZQueryCollection` | `document.getElementsByClassName(name)` |
| `$.tag(name)` | `ZQueryCollection` | `document.getElementsByTagName(name)` |
| `$.name(name)` | `ZQueryCollection` | `document.getElementsByName(name)` |
| `$.children(parentId)` | `ZQueryCollection` | `document.getElementById(parentId).children` |

  

```javascript
// $.all() - returns a collection (alias for $())
$.all('.card').addClass('shadow');

// $.classes() - all elements with class
$.classes('card').css({ border: '1px solid #ccc' });

// $.tag() - all elements by tag name
$.tag('input').val('');

// $.name() - all elements by name attribute
$.name('email').addClass('highlight');

// $.children() - direct children of element by ID
$.children('sidebar').addClass('nav-item');
```

  
### Collection Methods

  
#### Iteration

  
| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `each` | `each(fn)` | `this` | Iterate: `fn(index, element)` with `this` bound to element |
| `forEach` | `forEach(fn)` | `this` | Array-style: `fn(element, index, array)` — matches `Array.forEach` |
| `map` | `map(fn)` | `Array` | Map to array of values |
| `filter` | `filter(fn)` | `ZQueryCollection` | Filter to matching elements |
| `not` | `not(selectorOrFn)` | `ZQueryCollection` | Exclude matching elements |
| `has` | `has(selector)` | `ZQueryCollection` | Keep elements containing match |
| `is` | `is(selectorOrFn)` | `boolean` | Test if any element matches |
| `toArray` | `toArray()` | `Array` | Convert to standard array |
| `get` | `get(index?)` | `Element \| Array` | Get element by index, negative from end, or all (no args) |
| `eq` | `eq(index)` | `ZQueryCollection` | Collection of single element at index |

  

```javascript
// each() - jQuery-style callback: fn(index, element), this = element
$('.card').each(function(i, el) { console.log(i, this.id); });

// forEach() - Array-style callback: fn(element, index, array)
$('.card').forEach((el, i) => console.log(i, el.id));

// Iterable - for...of and spread syntax work out of the box
for (const el of $('.card')) el.style.opacity = '1';
const arr = [...$('.card')]; // spread into a plain array

$('.card').filter(el => el.dataset.active === 'true');
$('.item').not('.disabled').addClass('selectable');
$('.card').is('.active');  // true / false
$('.card').get(-1);        // last raw element (negative index)
```

  
#### Traversal & Filtering

  
| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `find` | `find(selector)` | `ZQueryCollection` | Find descendants matching selector |
| `closest` | `closest(selector)` | `ZQueryCollection` | Closest ancestor matching selector (includes self) |
| `parent` | `parent()` | `ZQueryCollection` | Direct parent(s) |
| `parents` | `parents(selector?)` | `ZQueryCollection` | All ancestors, optionally filtered |
| `parentsUntil` | `parentsUntil(stop, filter?)` | `ZQueryCollection` | Ancestors up to (not including) `stop`, optionally filtered |
| `children` | `children(selector?)` | `ZQueryCollection` | Direct children, optionally filtered |
| `contents` | `contents()` | `ZQueryCollection` | All child nodes (incl. text nodes) |
| `siblings` | `siblings(selector?)` | `ZQueryCollection` | All siblings excluding self, optionally filtered |
| `next` | `next(selector?)` | `ZQueryCollection` | Next sibling element, optionally filtered |
| `prev` | `prev(selector?)` | `ZQueryCollection` | Previous sibling element, optionally filtered |
| `nextAll` | `nextAll(selector?)` | `ZQueryCollection` | All following siblings |
| `prevAll` | `prevAll(selector?)` | `ZQueryCollection` | All preceding siblings |
| `nextUntil` | `nextUntil(stop, filter?)` | `ZQueryCollection` | Following siblings up to (not including) `stop` |
| `prevUntil` | `prevUntil(stop, filter?)` | `ZQueryCollection` | Preceding siblings up to (not including) `stop` |
| `first` | `first()` | `Element \| null` | First raw element (use `eq(0)` for a collection) |
| `last` | `last()` | `Element \| null` | Last raw element (use `eq(-1)` for a collection) |
| `slice` | `slice(start, end?)` | `ZQueryCollection` | Sub-collection by index range (supports negative indices) |
| `index` | `index(element?)` | `number` | Index among siblings (no args) or position of element in collection |
| `add` | `add(selector \| element \| collection)` | `ZQueryCollection` | Merge with another selection |
| `clone` | `clone(deep?)` | `ZQueryCollection` | Clone elements (`deep = true` by default) |

  

```javascript
$('.card').find('.title').text();
$('#btn').closest('.toolbar');
$('.item').parent().addClass('parent');
$('.active').siblings().removeClass('active');

// *Until methods - collect siblings/ancestors up to a boundary
$('.first').nextUntil('.last');           // between first and last
$('.first').nextUntil('.last', '.item');  // …filtered to .item only
$('#child').parentsUntil('body');         // ancestors up to body

$('li').first();  // raw Element (or null)
$('li').eq(0).addClass('top');  // wraps in collection for chaining
$('li').slice(0, 3).css({ fontWeight: 'bold' });
$('li').slice(-1); // last item as a collection
```

  
#### Classes & Attributes

  
| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `addClass` | `addClass(...cls)` | `this` | Add one or more classes (multiple args or space-separated) |
| `removeClass` | `removeClass(...cls)` | `this` | Remove one or more classes |
| `toggleClass` | `toggleClass(...cls, force?)` | `this` | Toggle class(es). Optional boolean to force add/remove. |
| `hasClass` | `hasClass(cls)` | `boolean` | Test if first element has class |
| `attr` | `attr(key, val?)` | `string \| this` | Get/set HTML attribute |
| `attr` | `attr(obj)` | `this` | Set multiple attributes from an object |
| `removeAttr` | `removeAttr(key)` | `this` | Remove attribute |
| `prop` | `prop(key, val?)` | `any \| this` | Get/set DOM property (e.g. `checked`, `disabled`) |
| `data` | `data(key?, val?)` | `any \| this` | Get/set `dataset` values (auto JSON parse/stringify). No args returns full dataset. |
| `val` | `val(value?)` | `string \| this` | Get/set form element value (`input`, `select`, `textarea`) |

  

```javascript
$('.card').addClass('shadow', 'elevated');  // multiple args
$('.card').addClass('shadow elevated');     // space-separated
$('#toggle').toggleClass('active');
$('#toggle').toggleClass('active', true);  // force add
$('.btn').hasClass('primary');   // true/false

// Set attributes - single or multiple
$('a').attr('target', '_blank');
$('#el').attr({ 'data-x': '1', 'data-y': '2', title: 'hello' });

// data() with auto JSON
$('#box').data('config', { theme: 'dark' });
$('#box').data('config');  // { theme: 'dark' } - auto-parsed
$('#box').data();          // full DOMStringMap

$('#name').val();                // read value
$('#name').val('New Value');     // set value
```

  
#### Content & DOM Manipulation

  
| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `html` | `html(content?)` | `string \| this` | Get/set innerHTML. Auto-morphs when element already has children. |
| `morph` | `morph(content)` | `this` | Explicitly diff/patch content via the morph engine (always morphs, never falls back to innerHTML) |
| `text` | `text(content?)` | `string \| this` | Get/set textContent |
| `append` | `append(content)` | `this` | Append child (string, Node, or collection) |
| `prepend` | `prepend(content)` | `this` | Prepend child (string, Node, or collection) |
| `before` | `before(content)` | `this` | Insert before each element |
| `after` | `after(content)` | `this` | Insert after each element |
| `appendTo` | `appendTo(target)` | `this` | Append self to target |
| `prependTo` | `prependTo(target)` | `this` | Prepend self to target |
| `insertBefore` | `insertBefore(target)` | `this` | Insert self before target |
| `insertAfter` | `insertAfter(target)` | `this` | Insert self after target |
| `wrap` | `wrap(html)` | `this` | Wrap each element in HTML structure |
| `wrapAll` | `wrapAll(html)` | `this` | Wrap entire set in one structure |
| `wrapInner` | `wrapInner(html)` | `this` | Wrap inner content of each element |
| `unwrap` | `unwrap(selector?)` | `this` | Remove parent wrapper (optionally only if it matches selector) |
| `empty` | `empty()` | `this` | Remove all children |
| `remove` | `remove()` | `this` | Remove elements from DOM |
| `detach` | `detach()` | `this` | Remove from DOM (alias of `remove()`) |
| `replaceWith` | `replaceWith(content)` | `this` | Replace element. Auto-morphs when tag name matches. |
| `replaceAll` | `replaceAll(target)` | `this` | Replace target elements with self |

  

```javascript
$('#list').append('<li>New item</li>');
$('.toast').appendTo('#container');
$('.card').wrap('<div class="card-wrapper"></div>');
$('.old-list').replaceWith('<ul class="new-list"></ul>');

// html() auto-morph: if the element already has children,
// zQuery runs the diff engine instead of raw innerHTML:
$('#my-component').html(\`<div>\$\{newContent}</div>\`);

// Explicit morph (always diffs, even on empty elements):
$('#root').morph('<ul><li>updated</li></ul>');

// Opt out of morph - empty() first to force innerHTML:
$('#root').empty().html('<div>fresh</div>');
```

  
> **Tip:** **Auto-Morph:** When you call `.html()` on an element that already has children, zQuery runs the morph algorithm instead of a raw innerHTML swap. This preserves focus, scroll position, CSS transitions, and event listeners. Use `.morph()` for explicit morph control, or `.empty().html()` to opt out.

  
**Auto-Key Detection:** When morphing a list of children, if *any* child has a `z-key` attribute, the entire sibling group is reconciled using keyed LIS-based reorder. Otherwise, children are patched pairwise.

  
#### CSS & Dimensions

  
| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `css` | `css(prop)` | `string` | Get computed style value |
| `css` | `css(prop, val)` | `this` | Set one style |
| `css` | `css(obj)` | `this` | Set multiple styles from object |
| `width` | `width()` | `number \| undefined` | Content width via `getBoundingClientRect` (getter only — use `.css("width", val)` to set) |
| `height` | `height()` | `number \| undefined` | Content height via `getBoundingClientRect` (getter only — use `.css("height", val)` to set) |
| `outerWidth` | `outerWidth(margins?)` | `number` | Width including padding+border (+ margins if `true`) |
| `outerHeight` | `outerHeight(margins?)` | `number` | Height including padding+border (+ margins if `true`) |
| `innerWidth` | `innerWidth()` | `number` | Width including padding (`clientWidth`) |
| `innerHeight` | `innerHeight()` | `number` | Height including padding (`clientHeight`) |
| `offset` | `offset()` | `{ top, left, width, height }` | Position & size relative to document (accounts for scroll) |
| `position` | `position()` | `{ top, left }` | Position relative to offset parent (`offsetTop` / `offsetLeft`) |
| `scrollTop` | `scrollTop(val?)` | `number \| this` | Get/set vertical scroll position (works on elements and `window`) |
| `scrollLeft` | `scrollLeft(val?)` | `number \| this` | Get/set horizontal scroll position (works on elements and `window`) |

  

```javascript
$('.card').css('borderRadius');           // get
$('.card').css('borderRadius', '12px');   // set one
$('.card').css({ opacity: 0.5, transform: 'scale(0.95)' });

$('#box').width();      // 300  (number, no 'px')
$('#box').css('width', '400px');   // use .css() to set

$('#box').outerWidth(true);   // includes margin
$('#box').innerWidth();       // content + padding

$('#box').offset();     // { top: 120, left: 50, width: 300, height: 200 }
$('#box').position();   // { top: 20, left: 10 } - relative to offset parent

$('#scroll-area').scrollTop();   // get
$('#scroll-area').scrollTop(0);  // scroll to top
```

  
#### Visibility

  
| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `show` | `show()` | `this` | Set `display: ''` |
| `hide` | `hide()` | `this` | Set `display: none` |
| `toggle` | `toggle(display?)` | `this` | Toggle visibility. Optional display value (e.g. `"flex"`) used when showing. |

  
#### Events

  
**Single Element (native API)** — for `$.id()` results, use the browser’s built-in methods:

  

```javascript
const el = $.id('my-btn');
el.addEventListener('click', handler);
el.removeEventListener('click', handler);
```

  
**Global `$.on()` / `$.off()`**

  
| Method | Signature | Description |
| --- | --- | --- |
| `$.on` | `$.on(event, handler)` | Direct listener on `document` |
| `$.on` | `$.on(event, selector, handler)` | Delegated — only fires when target matches `selector` |
| `$.on` | `$.on(event, target, handler)` | Direct listener on a specific `EventTarget` (e.g. `window`) |
| `$.off` | `$.off(event, handler)` | Remove a direct listener |

  

```javascript
// Keyboard shortcut
$.on('keydown', (e) => {
  if (e.key === 'Escape') $('#modal').hide();
});

// Delegated - works for elements added dynamically
$.on('click', '.delete-btn', function(e) {
  this.closest('.todo-item').remove();
});

// Target-bound - useful for non-bubbling events like scroll
$.on('scroll', window, () => {
  console.log('scrolled to', window.scrollY);
});

// Custom event
const handler = (e) => console.log(e.detail);
$.on('theme:change', handler);
$.off('theme:change', handler);
```

  
#### Collection Events — `.on()` / `.off()` / `.one()`

  
`$()` returns a collection, so you get chainable event methods directly:

  
| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `on` | `on(event, selectorOrFn, fn?)` | `this` | Bind event(s). Space-separated events (`"click mouseenter"`) and delegation supported. |
| `off` | `off(event, fn)` | `this` | Unbind event(s) |
| `one` | `one(event, fn)` | `this` | Fire once, then auto-remove |
| `trigger` | `trigger(event, detail?)` | `this` | Dispatch `CustomEvent` with `bubbles: true` |
| `click` | `click(fn?)` | `this` | Bind click or trigger click (no args) |
| `submit` | `submit(fn?)` | `this` | Bind submit or trigger submit |
| `focus` | `focus()` | `this` | Focus first element |
| `blur` | `blur()` | `this` | Blur first element |
| `hover` | `hover(enterFn, leaveFn?)` | `this` | Bind mouseenter/mouseleave. If one fn, it’s used for both. |

  

```javascript
// Hover effect on all nav links
$('a.nav-link').on('mouseenter mouseleave', (e) => {
  e.target.classList.toggle('hovered');
});

// Hover shorthand (like jQuery)
$('.card').hover(
  function() { $(this).addClass('shadow'); },
  function() { $(this).removeClass('shadow'); }
);

// One-time event
$('.onboarding-step').one('click', function() {
  this.classList.add('completed');
});

// Click handler
$('[data-action="delete"]').on('click', handleDelete);

// $(window) also works
$(window).on('scroll', () => {
  console.log('scrolled to', window.scrollY);
});
```

  
### Element Creation — `$.create()`

  
Create a DOM element programmatically with attributes, styles, event listeners, and children in a single call. Returns a `ZQueryCollection` so you can chain additional methods:

  

```javascript
// Create and append in one expression
const btn = $.create('button', {
  class: 'primary',
  style: { padding: '10px', borderRadius: '6px' },
  onclick: () => alert('Clicked!'),
  data: { action: 'submit', id: '42' }
}, 'Click Me').appendTo('body');

// Chaining - create, style, and insert in one expression
$.create('div', { class: 'toast' })
  .text('Saved!')
  .css({ opacity: 1 })
  .appendTo('#toasts');

// Access the raw DOM element via index
const rawEl = $.create('input', { type: 'text' })[0];
```

  
| Attribute Key | Behavior |
| --- | --- |
| `class` | Sets `className` directly |
| `style` (object) | Assigns each property to `el.style` |
| `on*` (e.g. `onclick`) | Adds event listener for the event name after “on” |
| `data` (object) | Sets `dataset` properties |
| Anything else | Calls `setAttribute(key, value)` |

  
Additional arguments after `attrs` are appended as children (strings become text nodes, elements are appended directly).

  
### Animations

  
Collection animation methods return `Promise`s, so you can `await` them for sequencing:

  
| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `animate` | `animate(props, duration = 300, easing = 'ease')` | `Promise` | CSS transition to target properties. Fallback timeout at `duration + 50ms`. |
| `fadeIn` | `fadeIn(duration = 300)` | `Promise` | Fade in from `opacity: 0` to `1` |
| `fadeOut` | `fadeOut(duration = 300)` | `Promise` | Fade out and hide element |
| `fadeToggle` | `fadeToggle(duration = 300)` | `Promise` | Toggle fade in/out |
| `fadeTo` | `fadeTo(duration, opacity)` | `Promise` | Fade to a specific opacity |
| `slideDown` | `slideDown(duration = 300)` | `this` | Slide-reveal element (height 0 → natural) |
| `slideUp` | `slideUp(duration = 300)` | `this` | Slide-hide element (height → 0, then display none) |
| `slideToggle` | `slideToggle(duration = 300)` | `this` | Toggle height between 0 and natural height |

  

```javascript
// Fade in a modal
await $('#modal').fadeIn(200);

// Fade to half opacity
await $('.hint').fadeTo(400, 0.5);

// Toggle fade
$('#overlay').fadeToggle();

// Slide panel down / up
$('#details').slideDown();
$('#details').slideUp(500);

// Slide out rows then remove them
await $('.row.removing')
  .animate({ opacity: '0', transform: 'translateX(-20px)' }, 300);
$('.row.removing').remove();
```

  
### Form Helpers

  
Serialize form data with two collection methods. Both read all named form controls (inputs, selects, textareas, checkboxes, radio buttons):

  
| Method | Returns | Description |
| --- | --- | --- |
| `.serialize()` | `string` | URL-encoded string identical to a traditional form submission |
| `.serializeObject()` | `object` | Plain JS object — duplicate field names become arrays automatically |

  

```javascript
const form = $('#checkout-form');

form.serialize();        // "name=Tony&email=tony%40x.com"
form.serializeObject();  // { name: 'Tony', email: 'tony@x.com' }

// AJAX form submit
const data = $('form').eq(0).serializeObject();
await $.http.post('/api/contact', data);
$('form').eq(0).find('input, textarea').val('');
```

  
### DOM Ready & Plugins

  
`$.ready(fn)` runs your callback when the DOM is ready. If the document has already loaded, it fires immediately:

  

```javascript
$.ready(() => {
  console.log('DOM is ready!');
  $('.app').addClass('loaded');
});
```

  
`$.fn` is an alias for `ZQueryCollection.prototype`. Add custom methods just like jQuery plugins:

  

```javascript
// Define a plugin
$.fn.disable = function() {
  return this.prop('disabled', true).addClass('disabled');
};

// Use it on any collection
$('input').disable();
$('#settings-form select').disable();
```

  
### Native DOM Equivalents

  
For raw elements (`$.id`, `$.class`, `$.qs`, `$.qsa`) you use the native DOM API. `$.classes()`, `$.tag()`, `$.name()`, and `$.children()` return collections that support all the chainable methods above. Here’s a quick reference mapping collection methods to their native counterparts:

  
| Collection Method | Native Equivalent |
| --- | --- |
| `$.qs(sel, ctx?)` | `ctx.querySelector(sel)` |
| `$.qsa(sel, ctx?)` | `Array.from(ctx.querySelectorAll(sel))` |
| `.find(sel)` | `el.querySelectorAll(sel)` |
| `.parent()` | `el.parentElement` |
| `.closest(sel)` | `el.closest(sel)` |
| `.next()` / `.prev()` | `el.nextElementSibling` / `el.previousElementSibling` |
| `.nextAll()` / `.prevAll()` | Loop over `nextElementSibling` / `previousElementSibling` |
| `.parents()` | Loop over `el.parentElement` |
| `.contents()` | `el.childNodes` |
| `.addClass()` / `.removeClass()` | `el.classList.add()` / `el.classList.remove()` |
| `.toggleClass()` | `el.classList.toggle()` |
| `.attr(k, v)` | `el.setAttribute(k, v)` |
| `.prop(k, v)` | `el[k] = v` |
| `.html()` / `.text()` | `el.innerHTML` / `el.textContent` |
| `.morph()` | No native equivalent — uses zQuery’s diff engine |
| `.val()` | `el.value` |
| `.css(obj)` | `Object.assign(el.style, obj)` |
| `.offset()` | `el.getBoundingClientRect()` + `window.scrollY/X` |
| `.position()` | `{ top: el.offsetTop, left: el.offsetLeft }` |
| `.show()` / `.hide()` | `el.style.display = ''` / `el.style.display = 'none'` |
| `.remove()` | `el.remove()` |
| `.on(evt, fn)` | `el.addEventListener(evt, fn)` |

---

## Utilities

  
Quality-of-life helpers available on the global `$` object. Every function is also a named export from `src/utils.js`, making them tree-shakeable when imported selectively.

  
### Function Utilities

  
| Method | Signature | Description |
| --- | --- | --- |
| `$.debounce` | `debounce(fn, ms = 250)` | Delay execution until `ms` ms of inactivity; returned function has `.cancel()` |
| `$.throttle` | `throttle(fn, ms = 250)` | Leading + trailing: first call fires immediately, subsequent calls within the window fire once the window elapses |
| `$.pipe` | `pipe(...fns)` | Compose functions left-to-right; with zero functions acts as identity |
| `$.once` | `once(fn)` | Run `fn` once; subsequent calls return the cached first result |
| `$.sleep` | `sleep(ms)` | Returns a `Promise` that resolves after `ms` milliseconds |
| `$.memoize` | `memoize(fn, keyFnOrOpts?)` | Cache return values; supports custom key function or `{ maxSize }` for LRU eviction; has `.clear()` |

  

```javascript
// Debounce a search handler
const search = $.debounce((q) => fetchResults(q), 300);
input.addEventListener('input', (e) => search(e.target.value));
search.cancel(); // cancel pending call

// Throttle scroll - fires immediately on first call,
// then at most once per 100 ms (trailing edge)
const onScroll = $.throttle(() => updatePosition(), 100);
window.addEventListener('scroll', onScroll);

// Pipe - compose transforms left-to-right
const process = $.pipe(trim, lowercase, slugify);
process('  Hello World  '); // 'hello-world'

// Sleep
await $.sleep(1000);
console.log('1 second later');

// Memoize - cache expensive computations
const fib = $.memoize((n) => (n <= 1 ? n : fib(n - 1) + fib(n - 2)));
fib(40); // fast on repeat calls

// Memoize with custom key for multi-arg functions
const add = $.memoize((a, b) => a + b, (a, b) => `${a}:${b}`);

// Memoize with LRU eviction
const lookup = $.memoize(fetchUser, { maxSize: 100 });
lookup.clear(); // flush the cache
```

  
> **Warning:** By default `$.memoize` uses only the **first argument** as cache key. For multi-argument functions, pass a custom key function as the second parameter.

  
### String Utilities

  
| Method | Signature | Description |
| --- | --- | --- |
| `$.escapeHtml` | `escapeHtml(str)` | Escape `&<>"'` — non-strings are coerced via `String()` |
| `$.stripHtml` | `stripHtml(str)` | Remove all HTML tags from a string; non-strings coerced |
| `$.html` | `html`...`` | Tagged template — auto-escapes interpolated values; `null`/`undefined` → `""` |
| `$.trust` | `trust(str)` | Mark a string as trusted HTML (skip escaping in `$.html`) |
| `$.TrustedHTML` | `new TrustedHTML(str)` | Class backing `$.trust()` — also exported for `instanceof` checks |
| `$.uuid` | `uuid()` | Generate a UUID v4 string via `crypto.randomUUID()` (regex fallback) |
| `$.camelCase` | `camelCase(str)` | `my-thing` → `myThing` |
| `$.kebabCase` | `kebabCase(str)` | `myThing` → `my-thing` — handles consecutive uppercase |
| `$.capitalize` | `capitalize(str)` | Uppercase first letter, lowercase the rest; empty string → `""` |
| `$.truncate` | `truncate(str, maxLen, suffix?)` | Truncate to `maxLen` chars with optional suffix (default `…`); no-op if already short enough |

  

```javascript
$.escapeHtml('<script>alert("!")</script>');
// '<script>alert("!")</script>'

// Tagged template - auto-escapes interpolated values
const name = '<b>Bob</b>';
$.html`<p>Hello ${name}</p>`;
// '<p>Hello <b>Bob</b></p>'

// Trust a string to skip escaping
const icon = $.trust('<svg>...</svg>');
$.html`<div>${icon}</div>`;
// '<div><svg>...</svg></div>'

$.uuid(); // 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'

$.camelCase('my-component');     // 'myComponent'
$.kebabCase('myComponent');      // 'my-component'

$.stripHtml('<p>Hello <b>world</b></p>'); // 'Hello world'

$.capitalize('hello');           // 'Hello'

$.truncate('A really long sentence here', 15);
// 'A really long…'
$.truncate('A really long sentence here', 15, '...');
// 'A really lo...'
```

  
### Object Utilities

  
| Method | Signature | Description |
| --- | --- | --- |
| `$.deepClone` | `deepClone(obj)` | Deep copy via `structuredClone` when available; enhanced fallback handles `Date`, `RegExp`, `Map`, `Set`, `ArrayBuffer`, typed arrays, and circular references |
| `$.deepMerge` | `deepMerge(target, ...sources)` | Recursive merge — arrays are *replaced*, not concatenated; circular-reference safe; blocks `__proto__`, `constructor`, `prototype` keys |
| `$.isEqual` | `isEqual(a, b)` | Deep equality check; distinguishes arrays from plain objects; circular-reference safe |
| `$.pick` | `pick(obj, keys)` | Return new object with only the listed keys (missing keys skipped) |
| `$.omit` | `omit(obj, keys)` | Return new object without the listed keys |
| `$.getPath` | `getPath(obj, path, fallback?)` | Read a dot-separated path (e.g. `"a.b.0"`); works with array indices |
| `$.setPath` | `setPath(obj, path, value)` | Write a value at a dot-separated path; creates intermediary objects; blocks `__proto__`, `constructor`, `prototype` segments; **returns** `obj` for chaining |
| `$.isEmpty` | `isEmpty(val)` | `true` for `null`, `undefined`, `""`, `[]`, `{}`, empty `Map`/`Set`; `false` for `0` and `false` |

  

```javascript
const copy = $.deepClone({ a: { b: [1, 2] } });

const merged = $.deepMerge(
  { ui: { theme: 'dark', density: 'compact' } },
  { ui: { theme: 'light' } }
);
// { ui: { theme: 'light', density: 'compact' } }

$.isEqual({ a: 1, b: [2, 3] }, { a: 1, b: [2, 3] }); // true
$.isEqual({ a: 1 }, { a: 2 });                         // false
$.isEqual([1, 2], { 0: 1, 1: 2 });                     // false (array ≠ object)

// Pick / Omit
const user = { id: 1, name: 'Ada', role: 'admin', email: 'ada@x.com' };
$.pick(user, ['name', 'email']); // { name: 'Ada', email: 'ada@x.com' }
$.omit(user, ['role']);           // { id: 1, name: 'Ada', email: 'ada@x.com' }

// Deep path access - works with array indices too
const cfg = { db: { host: 'localhost', port: 5432 } };
$.getPath(cfg, 'db.host');            // 'localhost'
$.getPath(cfg, 'db.ssl', false);      // false (fallback)

// setPath returns obj for chaining
$.setPath(cfg, 'db.ssl', true);       // cfg.db.ssl === true
$.setPath({}, 'a.b.c', 42);           // { a: { b: { c: 42 } } }

// isEmpty
$.isEmpty(null);  // true  <div class="docs-warning"><strong>Prototype pollution protection:</strong> <code>deepMerge()</code> and <code>setPath()</code> silently skip <code>__proto__</code>, <code>constructor</code>, and <code>prototype</code> keys. This prevents attackers from injecting malicious properties via crafted JSON payloads.</div>$.isEmpty('');    // true
$.isEmpty([]);    // true
$.isEmpty({});    // true
$.isEmpty(new Map()); // true
$.isEmpty(0);     // false
$.isEmpty(false); // false
```

  
> **Tip:** The fallback clone (when `structuredClone` is unavailable) manually handles `Date`, `RegExp`, `Map`, `Set`, `ArrayBuffer`, typed arrays, and circular references. It preserves `undefined` values and prototype chains — no data loss compared to the JSON round-trip approach.

  
### Array Utilities

  
| Method | Signature | Description |
| --- | --- | --- |
| `$.range` | `range(end)` \| `range(start, end, step?)` | Generate a number array (like Python’s `range`); supports negative & float steps |
| `$.unique` | `unique(arr, keyFn?)` | Deduplicate; first occurrence wins; optional key function for objects |
| `$.chunk` | `chunk(arr, size)` | Split array into chunks of `size` (last chunk may be smaller) |
| `$.groupBy` | `groupBy(arr, keyFn)` | Group items into `{ key: [...items] }` by a key function |

  

```javascript
// range
$.range(5);            // [0, 1, 2, 3, 4]
$.range(2, 6);         // [2, 3, 4, 5]
$.range(0, 10, 3);     // [0, 3, 6, 9]
$.range(5, 0, -1);     // [5, 4, 3, 2, 1]
$.range(0, 1, 0.25);   // [0, 0.25, 0.5, 0.75]

// unique
$.unique([1, 2, 2, 3, 1]);  // [1, 2, 3]
const users = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 1, name: 'C' }];
$.unique(users, u => u.id); // first two only

// chunk
$.chunk([1, 2, 3, 4, 5], 2);  // [[1,2], [3,4], [5]]

// groupBy
const items = [{ type: 'fruit', name: 'apple' }, { type: 'veg', name: 'carrot' }, { type: 'fruit', name: 'banana' }];
$.groupBy(items, i => i.type);
// { fruit: [{…}, {…}], veg: [{…}] }
```

  
> **Tip:** `$.range` returns an empty array if `step` is `0` or goes in the wrong direction relative to start/end.

  
### Number Utilities

  
| Method | Signature | Description |
| --- | --- | --- |
| `$.clamp` | `clamp(val, min, max)` | Clamp a number between `min` and `max` (inclusive) |

  

```javascript
$.clamp(15, 0, 10);   // 10
$.clamp(-5, 0, 10);   // 0
$.clamp(7, 0, 10);    // 7
$.clamp(0, 0, 100);   // 0   (boundary)
$.clamp(100, 0, 100); // 100 (boundary)
```

  
### Async Utilities

  
| Method | Signature | Description |
| --- | --- | --- |
| `$.retry` | `retry(fn, opts?)` | Retry an async `fn(attempt)` with configurable attempts, delay, and backoff |
| `$.timeout` | `timeout(promise, ms, message?)` | Race a promise against a timer; rejects with `Error` if `ms` elapses; cleans up timer automatically |

  
**`retry` options**

  
| Option | Default | Description |
| --- | --- | --- |
| `attempts` | `3` | Maximum number of attempts before rejecting |
| `delay` | `1000` | Milliseconds between retries |
| `backoff` | `1` | Multiplier applied to delay after each failure (e.g. `2` for exponential) |

  

```javascript
// Retry - up to 3 attempts, 1 s between retries
await $.retry(() => fetch('/api/data').then(r => { if (!r.ok) throw r; return r.json(); }));

// Retry with exponential backoff
await $.retry(
  (attempt) => fetch('/api/flaky'),
  { attempts: 5, delay: 500, backoff: 2 }
);
// Delays: 500 ms → 1000 ms → 2000 ms → 4000 ms

// Timeout - reject if fetch takes longer than 3 s
const data = await $.timeout(fetch('/api/slow'), 3000);

// Custom error message
await $.timeout(longTask(), 5000, 'Task exceeded 5 s limit');
```

  
> **Tip:** `$.timeout` automatically clears its internal timer via `.finally()`, so there is no risk of lingering timers.

  
### URL Utilities

  
| Method | Signature | Description |
| --- | --- | --- |
| `$.param` | `param(obj)` | Serialize object to URL query string via `URLSearchParams` |
| `$.parseQuery` | `parseQuery(str)` | Parse query string into plain object; handles leading `?` |

  

```javascript
$.parseQuery('?page=2&sort=name');
// { page: '2', sort: 'name' }

$.param({ page: 2, sort: 'name' });
// 'page=2&sort=name'
```

  
### Storage Wrappers

  
| Method | Signature | Description |
| --- | --- | --- |
| `$.storage.get` | `get(key, fallback?)` | JSON-parsed `localStorage` read; returns `fallback` (default `null`) if missing *or* parse fails |
| `$.storage.set` | `set(key, val)` | JSON-stringified `localStorage` write |
| `$.storage.remove` | `remove(key)` | Remove a `localStorage` key |
| `$.storage.clear` | `clear()` | Clear all `localStorage` |
| `$.session.get` | `get(key, fallback?)` | JSON-parsed `sessionStorage` read |
| `$.session.set` | `set(key, val)` | JSON-stringified `sessionStorage` write |
| `$.session.remove` | `remove(key)` | Remove a `sessionStorage` key |
| `$.session.clear` | `clear()` | Clear all `sessionStorage` |

  

```javascript
$.storage.set('prefs', { theme: 'dark', lang: 'en' });
const prefs = $.storage.get('prefs');
// { theme: 'dark', lang: 'en' }

$.storage.get('missing', { fallback: true });
// { fallback: true }

$.session.set('token', 'abc123');
const token = $.session.get('token');

$.storage.remove('prefs');
$.session.clear();
```

  
> **Tip:** Values are JSON-serialized automatically. Unlike raw `localStorage.getItem()`, you get proper types back — numbers stay numbers, objects stay objects.

  
### Event Bus

  
A lightweight pub/sub bus for decoupled cross-component communication. A shared singleton `$.bus` is provided, or create your own with `new $.EventBus()`.

  
| Method | Signature | Description |
| --- | --- | --- |
| `$.bus.on` | `on(event, handler)` | Subscribe; **returns** an unsubscribe function |
| `$.bus.off` | `off(event, handler)` | Unsubscribe a specific handler |
| `$.bus.emit` | `emit(event, ...args)` | Emit an event with arguments |
| `$.bus.once` | `once(event, handler)` | Subscribe once; auto-removed after first fire; **returns** unsubscribe function |
| `$.bus.clear` | `clear()` | Remove **all** listeners on every event |
| `$.EventBus` | `new EventBus()` | Create a custom bus instance with the same API |

  

```javascript
// Notifications system
$.bus.on('notify', (msg, type) => {
  showToast(msg, type);
});

// From anywhere in the app
$.bus.emit('notify', 'Item saved!', 'success');

// One-time listener
$.bus.once('app:ready', () => {
  console.log('App initialized');
});

// Use the returned unsubscribe function
const unsub = $.bus.on('resize', updateLayout);
unsub(); // stop listening

// Create a scoped bus for a subsystem
const formBus = new $.EventBus();
formBus.on('validate', checkFields);
formBus.emit('validate');
formBus.clear(); // only clears formBus
```

  
### Global Helpers

  
Not from `utils.js` but available on the `$` namespace alongside the utilities above.

  
| Method | Signature | Description |
| --- | --- | --- |
| `$.ready` | `ready(fn)` | Run `fn` on `DOMContentLoaded` (or immediately if already fired) |
| `$.style` | `style(urls, opts?)` | Load CSS stylesheet(s) with FOUC prevention; returns `{ remove, ready }` |

  

```javascript
$.ready(() => {
  console.log('DOM is ready');
  $.mount('#app');
});

// Load external CSS with critical mode (hides page until loaded)
const theme = $.style('https://cdn.example.com/theme.css');
await theme.ready;

// Load multiple stylesheets
const styles = $.style(['./reset.css', './app.css'], {
  critical: true,    // default - hides page until loaded
  bg: '#0d1117'      // background color while hidden
});

// Remove loaded stylesheets
styles.remove();
```

  
### Quick Reference

  
All 37 utility exports at a glance, grouped by category:

  
| Category | Methods |
| --- | --- |
| **Function** | `debounce` · `throttle` · `pipe` · `once` · `sleep` · `memoize` |
| **String** | `escapeHtml` · `stripHtml` · `html` · `trust` · `TrustedHTML` · `uuid` · `camelCase` · `kebabCase` · `capitalize` · `truncate` |
| **Object** | `deepClone` · `deepMerge` · `isEqual` · `pick` · `omit` · `getPath` · `setPath` · `isEmpty` |
| **Array** | `range` · `unique` · `chunk` · `groupBy` |
| **Number** | `clamp` |
| **Async** | `retry` · `timeout` |
| **URL** | `param` · `parseQuery` |
| **Storage** | `storage` (`.get` `.set` `.remove` `.clear`) · `session` (same API) |
| **Event Bus** | `EventBus` · `bus` (`.on` `.off` `.emit` `.once` `.clear`) |

---

## Error Handling

  
During development, zQuery catches errors **before they bury themselves in the console** and shows them right in the browser as a full-screen overlay. Syntax mistakes, runtime crashes, and framework-level `ZQueryError` exceptions all appear in the same place — color-coded so you can tell at a glance what went wrong and where.

  
### What Gets Caught

  
The dev server watches for three categories of errors:

  
| Category | When | What You See |
| --- | --- | --- |
| **Syntax errors** | Every time you save a `.js` file, it’s validated *before* the browser reloads. | File path, line:column, and a **code frame** with a caret pointing at the problem. The page does **not** reload so your state is preserved. |
| **Runtime errors** | Uncaught exceptions and unhandled promise rejections. | Error type, message, file:line:column, and a cleaned stack trace (internal noise is stripped automatically). |
| **ZQueryError** | Framework-level errors raised by the router, components, store, reactive system, etc. | A **color-coded error code badge**, the message, any context metadata (component name, directive, expression…), and a stack trace. |

  
### Syntax Error Code Frames

  
When a syntax error is caught on save, the overlay shows the surrounding source with the bad line highlighted and a `^` caret marking the exact column:

  

```bash
1 | import { store } from '../store.js';
  2 |
> 3 | const count = store.getState(
                                    ^
  4 | // missing closing paren
  5 | console.log(count);
```

  
Fix the error and save again — the overlay clears automatically and the page reloads.

  
### Framework Error Codes

  
Every `ZQueryError` carries a code prefixed by the subsystem that raised it. The overlay color-codes these so you can immediately see where the problem lives:

  
| Prefix | Subsystem | Color |
| --- | --- | --- |
| `ZQ_REACTIVE` / `ZQ_SIGNAL` / `ZQ_EFFECT` | Reactive core | ■ Purple |
| `ZQ_EXPR` | Expression evaluation | ■ Blue |
| `ZQ_COMP` | Components | ■ Teal |
| `ZQ_ROUTER` | Router | ■ Orange |
| `ZQ_STORE` | Store | ■ Violet |
| `ZQ_HTTP` | HTTP client | ■ Dark slate |
| `ZQ_DEV` | Dev server (syntax errors) | ■ Red |
| `ZQ_INVALID` | Invalid argument / config | ■ Grey |

  
Syntax/parse errors without a `ZQ_` code get a red badge; everything else defaults to orange.

  
### Context Metadata

  
When a `ZQueryError` includes a `context` object, its key/value pairs are shown as inline tags directly below the error message. For example, a component render error might show:

  
- `component: my-widget`
- `directive: z-if`
- `expression: items.length > 0`

  
This tells you exactly which part of your app triggered the error without having to dig through a stack trace.

  
### Dismissing & Auto-Clear

  
The overlay disappears on its own when you fix the error and save — no manual action needed. You can also dismiss it at any time:

  
- Press Esc
- Click the **×** button

  
> **Tip:** **Console log.** Every overlay error is also logged to the browser console with a styled `zQuery DevError` badge so you still have a record after dismissing.

  
> **Production safety.** The error reporting script is **never** written to disk and is **not** included in `zquery bundle` builds. Your shipped code is completely clean.

  
### Programmatic Error Handling

  
Beyond the dev overlay, zQuery provides a programmatic error handling API. Register global handlers with `$.onError()` to catch all internal `ZQueryError` exceptions — useful for logging, crash reporting, or custom UI. **Multiple handlers** can coexist (the dev overlay and your own handlers both fire), and each call returns an **unsubscribe function**:

  

```javascript
// Register multiple handlers - both fire on every error
const unsub1 = $.onError((err) => {
  console.warn(\`[\${err.code}]\`, err.message, err.context);
});

const unsub2 = $.onError((err) => {
  myErrorTracker.captureException(err);
});

// Remove a specific handler
unsub1();

// Clear ALL handlers
$.onError(null);
```

  
| Property | Type | Description |
| --- | --- | --- |
| `err.code` | string | Machine-readable error code (e.g. `"ZQ_COMP_RENDER"`) |
| `err.message` | string | Human-readable description |
| `err.context` | object | Extra data — component name, expression, directive, etc. |
| `err.cause` | Error? | Original error if wrapping another |

  
### Error Utilities

  
Helper functions are available on the `$` namespace for defensive coding at API boundaries:

  
| Function | Signature | Description |
| --- | --- | --- |
| `$.reportError` | `reportError(code, message, context?, cause?)` | Report an error without throwing. Calls all `$.onError` handlers and always logs to `console.error`. If `cause` is already a `ZQueryError`, it’s reused as-is. |
| `$.guardCallback` | `guardCallback(fn, code, context?)` | Wrap a synchronous function so thrown errors are caught, reported via `$.onError`, and don’t crash the call stack. Returns a safe wrapper. |
| `$.guardAsync` | `guardAsync(fn, code, context?)` | Same as `guardCallback` but for **async** functions. Catches both thrown errors and rejected promises. |
| `$.formatError` | `formatError(err)` | Convert any `Error` or `ZQueryError` into a plain serializable object with `code`, `type`, `message`, `context`, `stack`, and `cause`. |
| `$.validate` | `validate(value, name, expectedType?)` | Assert a value is non-null and optionally the expected type. Throws `ZQueryError` with `INVALID_ARGUMENT` on failure. |

  

```javascript
// reportError - non-throwing reporter
$.reportError($.ErrorCode.HTTP_REQUEST, 'Custom API failed', { url: '/api/data' });

// guardCallback - safe sync wrapper
const safeTick = $.guardCallback(myTickFn, $.ErrorCode.EFFECT_EXEC);
safeTick(); // errors are caught & reported, never thrown

// guardAsync - safe async wrapper
const safeFetch = $.guardAsync(fetchData, $.ErrorCode.HTTP_REQUEST);
await safeFetch(); // rejections are caught & reported

// validate - fast-fail at API boundaries
$.validate(name, 'name', 'string');   // throws if not a string
$.validate(el, 'target');             // throws if null/undefined
```

  
> **Tip:** `guardCallback` is used internally by zQuery for all lifecycle hooks and directive callbacks. `guardAsync` is the async equivalent — use it for fetch handlers, timers, or any async code where a rejection shouldn’t crash the entire flow.

  
### formatError()

  
Convert any error into a plain, serializable object — useful for logging services, JSON APIs, or the dev overlay:

  

```javascript
const formatted = $.formatError(err);
// {
//   code: 'ZQ_COMP_RENDER',
//   type: 'ZQueryError',
//   message: 'render failed',
//   context: { component: 'my-widget' },
//   stack: '...',
//   cause: null
// }

// Works with any Error - nested cause chains are recursed
const nested = $.formatError(new Error('outer', { cause: new TypeError('inner') }));
// nested.cause → { code: null, type: 'TypeError', message: 'inner', ... }
```

  
| Property | Type | Description |
| --- | --- | --- |
| `code` | string \| null | Error code (if `ZQueryError`), otherwise `null` |
| `type` | string | Error class name (`"ZQueryError"`, `"TypeError"`, etc.) |
| `message` | string | Human-readable message |
| `context` | object \| null | Context metadata (if `ZQueryError`) |
| `stack` | string | Stack trace |
| `cause` | object \| null | Recursively formatted cause chain |

  
### guardAsync()

  
Wraps an async function so that both thrown errors **and** rejected promises are caught, reported through the error system, and never propagate:

  

```javascript
const safeFetch = $.guardAsync(
  async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  },
  $.ErrorCode.HTTP_REQUEST,
  { endpoint: '/api/data' }
);

const data = await safeFetch('/api/data');
// If it fails: error is reported, data === undefined
```

  
> **Tip:** `guardAsync` returns `undefined` on failure, so always check the return value. The error is still reported to all `$.onError` handlers and logged to the console.

  
### All Error Codes

  
The full list of error codes available on `$.ErrorCode` (28 total, frozen at load time):

  
| Code | Constant | Subsystem |
| --- | --- | --- |
| `ZQ_REACTIVE_CALLBACK` | `ErrorCode.REACTIVE_CALLBACK` | Reactive proxy callback error |
| `ZQ_SIGNAL_CALLBACK` | `ErrorCode.SIGNAL_CALLBACK` | Signal subscriber error |
| `ZQ_EFFECT_EXEC` | `ErrorCode.EFFECT_EXEC` | Effect execution error |
| `ZQ_EXPR_PARSE` | `ErrorCode.EXPR_PARSE` | Expression parse failure |
| `ZQ_EXPR_EVAL` | `ErrorCode.EXPR_EVAL` | Expression evaluation error |
| `ZQ_EXPR_UNSAFE_ACCESS` | `ErrorCode.EXPR_UNSAFE_ACCESS` | Blocked unsafe property access |
| `ZQ_COMP_INVALID_NAME` | `ErrorCode.COMP_INVALID_NAME` | Missing or non-hyphenated name |
| `ZQ_COMP_NOT_FOUND` | `ErrorCode.COMP_NOT_FOUND` | Component not registered |
| `ZQ_COMP_MOUNT_TARGET` | `ErrorCode.COMP_MOUNT_TARGET` | Mount target not in DOM |
| `ZQ_COMP_RENDER` | `ErrorCode.COMP_RENDER` | Render function failed |
| `ZQ_COMP_LIFECYCLE` | `ErrorCode.COMP_LIFECYCLE` | Lifecycle hook error |
| `ZQ_COMP_RESOURCE` | `ErrorCode.COMP_RESOURCE` | Template/style fetch failure |
| `ZQ_COMP_DIRECTIVE` | `ErrorCode.COMP_DIRECTIVE` | Directive processing error |
| `ZQ_ROUTER_LOAD` | `ErrorCode.ROUTER_LOAD` | Lazy-load failure |
| `ZQ_ROUTER_GUARD` | `ErrorCode.ROUTER_GUARD` | Navigation guard error |
| `ZQ_ROUTER_RESOLVE` | `ErrorCode.ROUTER_RESOLVE` | Route resolution failure |
| `ZQ_STORE_ACTION` | `ErrorCode.STORE_ACTION` | Unknown or failed action |
| `ZQ_STORE_MIDDLEWARE` | `ErrorCode.STORE_MIDDLEWARE` | Middleware error |
| `ZQ_STORE_SUBSCRIBE` | `ErrorCode.STORE_SUBSCRIBE` | Subscriber callback error |
| `ZQ_HTTP_REQUEST` | `ErrorCode.HTTP_REQUEST` | Request failed |
| `ZQ_HTTP_TIMEOUT` | `ErrorCode.HTTP_TIMEOUT` | Request timed out |
| `ZQ_HTTP_INTERCEPTOR` | `ErrorCode.HTTP_INTERCEPTOR` | Interceptor error |
| `ZQ_HTTP_PARSE` | `ErrorCode.HTTP_PARSE` | Response parse failure |
| `ZQ_SSR_RENDER` | `ErrorCode.SSR_RENDER` | SSR render/init/interpolation failure |
| `ZQ_SSR_COMPONENT` | `ErrorCode.SSR_COMPONENT` | SSR component registration or lookup |
| `ZQ_SSR_HYDRATION` | `ErrorCode.SSR_HYDRATION` | Hydration mismatch (reserved) |
| `ZQ_SSR_PAGE` | `ErrorCode.SSR_PAGE` | Full-page render failure |
| `ZQ_INVALID_ARGUMENT` | `ErrorCode.INVALID_ARGUMENT` | Invalid argument or config |

  
> **Tip:** Use these constants in `$.guardCallback` and `$.reportError` instead of raw strings: `$.ErrorCode.COMP_RENDER` is safer than `"ZQ_COMP_RENDER"`.

---

## Server-Side Rendering (SSR)

  
zQuery includes a lightweight SSR module for rendering components to HTML strings in **Node.js**. Use it for SEO, faster initial page loads, static site generation, or API-driven HTML responses. No DOM required — it runs entirely on the server.

  
### Overview

  
SSR works alongside your existing client-side app. You define components once and render them on both the server and the client:

  
1. **Server** — `createSSRApp()` registers components and renders them to HTML strings via `renderToString()` or `renderPage()`.
2. **Client** — The same component definitions run in the browser via `$.component()`. The client hydrates the server-rendered HTML for full interactivity.

  

```javascript
// Node.js - server entry
import { createSSRApp } from 'zero-query/ssr';

const app = createSSRApp();

app.component('hello-world', {
  state: () => ({ name: 'World' }),
  render() {
    return \`<h1>Hello, \${this.state.name}!</h1>\`;
  }
});

const html = await app.renderToString('hello-world');
// '<hello-world data-zq-ssr><h1>Hello, World!</h1></hello-world>'
```

  
> **Node.js only.** The SSR module is a separate import (`zero-query/ssr`) and does not run in the browser. Your client-side app uses the normal `$` global as usual.

  
### SSR Scaffold

  
The quickest way to get started with SSR is the scaffold command. It generates a complete project, installs dependencies, starts the server, and opens the browser:

  

```bash
npx zquery create my-app --ssr    # or: -s
```

  
That’s it — one command. The SSR server starts at `http://localhost:3000` and the browser opens automatically. Press `Ctrl+C` to stop.

  
The generated project:

  
- [index.html](https://github.com/tonywied17/zero-query/blob/main/cli/scaffold/ssr/index.html)client HTML shell (meta tags, z-link nav)
- [global.css](https://github.com/tonywied17/zero-query/blob/main/cli/scaffold/ssr/global.css)dark theme styles
- [package.json](https://github.com/tonywied17/zero-query/blob/main/cli/scaffold/ssr/package.json)
- [app.js](https://github.com/tonywied17/zero-query/blob/main/cli/scaffold/ssr/app/app.js)client entry — imports & registers shared components
- [routes.js](https://github.com/tonywied17/zero-query/blob/main/cli/scaffold/ssr/app/routes.js)shared route definitions
- [home.js](https://github.com/tonywied17/zero-query/blob/main/cli/scaffold/ssr/app/components/home.js)
- [about.js](https://github.com/tonywied17/zero-query/blob/main/cli/scaffold/ssr/app/components/about.js)
- [not-found.js](https://github.com/tonywied17/zero-query/blob/main/cli/scaffold/ssr/app/components/not-found.js)
- [index.js](https://github.com/tonywied17/zero-query/blob/main/cli/scaffold/ssr/app/components/blog/index.js)blog list (/blog)
- [post.js](https://github.com/tonywied17/zero-query/blob/main/cli/scaffold/ssr/app/components/blog/post.js)blog detail (/blog/:slug)
▶[server](https://github.com/tonywied17/zero-query/tree/main/cli/scaffold/ssr/server)Node.js SSR server
- [index.js](https://github.com/tonywied17/zero-query/blob/main/cli/scaffold/ssr/server/index.js)SSR HTTP server with JSON API
- [posts.js](https://github.com/tonywied17/zero-query/blob/main/cli/scaffold/ssr/server/data/posts.js)sample blog data
▶[assets](https://github.com/tonywied17/zero-query/tree/main/cli/scaffold/ssr/assets)
  
Components in `app/components/` export plain definition objects. The client registers them with `$.component()`, the server with `app.component()` — same files, same definitions, two runtimes. The scaffold includes:

  
    A **blog** with param-based routing (`/blog/:slug`) as a folder component
    **Per-route SEO metadata** — ``, ``, Open Graph tags injected during SSR
    **`matchRoute()`** for URL-to-component resolution — no manual route-matching boilerplate
    **`renderShell()`** for injecting SSR body + metadata into your `index.html` — no manual regex replacements
    **JSON API endpoints** at `/api/posts` and `/api/posts/:slug`
    **`window.__SSR_DATA__`** hydration — server-fetched data embedded in the page for client reuse
    **`z-active-route`** nav highlighting on all links
  
  
To restart the server manually after stopping:

  

```bash
cd my-app
node server/index.js
```

  
### createSSRApp()

  
Create an SSR application instance with its own isolated component registry:

  

```javascript
import { createSSRApp } from 'zero-query/ssr';

const app = createSSRApp();
```

  
The returned `app` object has these methods:

  
| Method | Description |
| --- | --- |
| `app.component(name, def)` | Register a component for SSR rendering |
| `app.has(name)` | Check if a component is registered (returns boolean) |
| `app.renderToString(name, props?, opts?)` | Render a component to an HTML string |
| `app.renderPage(opts?)` | Render a full HTML document with a component embedded |
| `app.renderBatch(entries)` | Render multiple components in parallel |
| `app.renderShell(shell, opts?)` | Render a component into an existing HTML shell template (your `index.html`) |

  
### Registering Components

  
SSR components use the same definition format as client-side `$.component()`, but skip DOM-dependent features (event handlers, `mounted` lifecycle, `z-model`, etc.):

  

```javascript
app.component('user-card', {
  state: () => ({
    name: 'Anonymous',
    role: 'viewer',
  }),

  // init() runs during SSR - use it for server-side setup
  init() {
    if (this.props.admin) this.state.role = 'admin';
  },

  // computed properties work in SSR
  computed: {
    displayName() {
      return this.state.name + ' (' + this.state.role + ')';
    }
  },

  render() {
    return \`
      <div class="card">
        <h3>\${this.computed.displayName}</h3>
      </div>
    \`;
  }
});
```

  
| Feature | SSR Support |
| --- | --- |
| `state` | Yes — function or object |
| `init()` | Yes — runs during SSR (guarded against errors) |
| `render()` | Yes — must return an HTML string |
| `computed` | Yes — computed getters are evaluated |
| `methods` | Yes — bound to the instance and available in `render()` |
| `props` | Yes — passed via `renderToString(name, props)` |
| `mounted()` | No — skipped (no DOM on server) |
| `@event` / `z-on:` | Stripped from output — no runtime events on server |
| `z-model` | Stripped from output |
| `{{expressions}}` | Yes — interpolated with CSP-safe evaluator, XSS-escaped |

  
> **Validation:** Component names must be non-empty strings and definitions must be objects. Invalid arguments throw a `ZQueryError` with code `ZQ_SSR_COMPONENT`.

  
### renderToString()

  
Render a registered component to an HTML string:

  

```javascript
// Basic render
const html = await app.renderToString('user-card', { name: 'Tony' });
// '<user-card data-zq-ssr><div class="card"><h3>Tony (viewer)</h3></div></user-card>'

// Without hydration marker
const static_ = await app.renderToString('user-card', {}, { hydrate: false });
// '<user-card><div class="card">...</div></user-card>'

// Fragment mode - inner HTML only, no wrapper tag
const fragment = await app.renderToString('user-card', {}, { mode: 'fragment' });
// '<div class="card"><h3>Anonymous (viewer)</h3></div>'
```

  
| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `hydrate` | boolean | `true` | Add `data-zq-ssr` attribute for client-side hydration detection |
| `mode` | string | `"full"` | Set to `"fragment"` to return inner HTML without the wrapper element |

  
There is also a **standalone** `renderToString()` export for one-shot renders without creating an app:

  

```javascript
import { renderToString } from 'zero-query/ssr';

const html = renderToString({
  state: () => ({ msg: 'Hello' }),
  render() { return \`<p>\${this.state.msg}</p>\`; }
});
// '<p>Hello</p>'
```

  
### renderPage()

  
Render a complete HTML document with a component embedded, ready to send as an HTTP response:

  

```javascript
const page = await app.renderPage({
  component: 'home-page',
  title: 'My App',
  description: 'A fast, SEO-friendly page rendered with zQuery SSR',
  lang: 'en',
  styles: ['global.css'],
  scripts: ['zquery.min.js', 'app/app.js'],
  head: {
    canonical: 'https://example.com/',
    og: {
      title: 'My App',
      description: 'Built with zQuery SSR',
      image: 'https://example.com/og.png',
      type: 'website',
    }
  }
});

// Send as HTTP response (Express example)
res.setHeader('Content-Type', 'text/html');
res.send(page);
```

  
| Option | Type | Description |
| --- | --- | --- |
| `component` | string | Component name to render in the page body |
| `props` | object | Props to pass to the component |
| `title` | string | Page `` |
| `description` | string | `` for SEO |
| `lang` | string | HTML `lang` attribute (default `"en"`) |
| `styles` | string[] | CSS file paths → `` tags |
| `scripts` | string[] | JS file paths → `` tags |
| `meta` | string | Additional raw HTML injected into `` |
| `bodyAttrs` | string | Attributes for the `` tag |
| `head.canonical` | string | `` URL |
| `head.og` | object | Open Graph `` tags — any key/value pairs |

  
### renderBatch()

  
Render multiple components in parallel using `Promise.all`:

  

```javascript
const results = await app.renderBatch([
  { name: 'hero-section' },
  { name: 'feature-list', props: { count: 5 } },
  { name: 'footer-section', options: { hydrate: false } },
]);

// results is an array of HTML strings
const combined = results.join('\n');
```

  
| Entry Property | Type | Description |
| --- | --- | --- |
| `name` | string | Component name |
| `props` | object | Props (optional) |
| `options` | object | Same options as `renderToString` (optional) |

  
### renderShell()

  
Render a component into an existing HTML shell template. Unlike `renderPage()` which generates a full HTML document from scratch, `renderShell()` takes your own `index.html` (with nav, footer, custom markup) and injects the SSR-rendered component body plus metadata into it.

  
Handles:

  
- Component rendering into ``
- `` replacement
- `` replacement
- Open Graph meta tag replacement / injection
- `window.__SSR_DATA__` hydration script injection

  

```javascript
const shell = await readFile('index.html', 'utf-8');

const html = await app.renderShell(shell, {
  component: 'blog-post',
  props: { post },
  title: `${post.title} — MyApp`,
  description: post.summary,
  og: {
    title: `${post.title} — MyApp`,
    description: post.summary,
    type: 'article',
  },
  ssrData: { component, params, props },
});
```

  
| Option | Type | Description |
| --- | --- | --- |
| `component` | `string` | Registered component name to render into `` |
| `props` | `object` | Props passed to the component |
| `title` | `string` | Page title — replaces `` tag |
| `description` | `string` | Meta description — replaces `` |
| `og` | `object` | Open Graph tags to replace or inject (e.g. `{ title, description, type, image }`) |
| `ssrData` | `any` | Data embedded as `window.__SSR_DATA__` before `` for client hydration |
| `renderOptions` | `object` | Options passed through to `renderToString` (`hydrate`, `mode`) |

  
> **Tip:** **renderPage vs renderShell:** Use `renderPage()` when you want zQuery to generate the entire HTML document (quick prototypes, static site generation). Use `renderShell()` when you have your own `index.html` with custom layout, nav, footer, and just need the SSR body + metadata injected into it.

  
> **Security:** All injected values (title, description, OG tags) are HTML-escaped. OG keys are sanitized to safe characters. The `ssrData` JSON escapes `` and `Security → SSR Error Sanitization for details.

  
The SSR scaffold uses `renderShell()` to keep the server’s `render()` function clean:

  

```javascript
async function render(pathname) {
  const { component, params } = matchRoute(routes, pathname);
  const props = getPropsForRoute(component, params);
  const meta  = getMetaForRoute(component, params, props);

  return app.renderShell(await getShell(), {
    component,
    props,
    title: meta.title,
    description: meta.description,
    og: { title: meta.title, description: meta.description, type: meta.ogType },
    ssrData: { component, params, props, meta },
  });
}
```

  
### Hydration

  
By default, SSR output includes a `data-zq-ssr` attribute on the wrapper element:

  

```html
<user-card data-zq-ssr><div class="card"><h3>Tony</h3></div></user-card>
```

  
When the client-side app loads, it can detect these markers and take over the existing DOM rather than re-rendering from scratch. This gives users instant visible content from the server while the full client app boots in the background.

  
> **Tip:** Set `{ hydrate: false }` in render options for purely static HTML that doesn’t need client-side interactivity (e.g. email templates, static pages, RSS feeds).

  
### Error Handling in SSR

  
SSR is fully integrated with the error system. Errors are caught, reported, and handled gracefully — one broken component won’t crash your server:

  
| Failure Point | Behavior |
| --- | --- |
| `render()` throws | Produces `` HTML comment instead of crashing |
| `init()` throws | Reported via `$.onError`, render continues with initial state |
| Computed getter throws | Returns `undefined`, error reported |
| `{{expression}}` fails | Renders as empty string, error reported |
| `renderPage()` component fails | Page still renders with error comment in body |
| `renderShell()` component fails | Shell still renders with error comment in `` |

  
All SSR errors use dedicated error codes:

  
| Code | Constant | When |
| --- | --- | --- |
| `ZQ_SSR_RENDER` | `ErrorCode.SSR_RENDER` | Component render, init, interpolation, or computed failure |
| `ZQ_SSR_COMPONENT` | `ErrorCode.SSR_COMPONENT` | Invalid component registration or missing component |
| `ZQ_SSR_HYDRATION` | `ErrorCode.SSR_HYDRATION` | Reserved for hydration mismatch detection |
| `ZQ_SSR_PAGE` | `ErrorCode.SSR_PAGE` | Full-page render failure |

  

```javascript
import { onError } from 'zero-query';

// Catch SSR errors on the server
onError((err) => {
  if (err.code.startsWith('ZQ_SSR')) {
    console.error('[SSR]', err.message, err.context);
    // send to monitoring service, etc.
  }
});
```

  
### escapeHtml()

  
The SSR module exports an `escapeHtml()` utility for safe HTML escaping in your templates:

  

```javascript
import { escapeHtml } from 'zero-query/ssr';

const safe = escapeHtml('<script>alert("xss")</script>');
// '<script>alert("xss")</script>'
```

  
This is the same function used internally by the SSR expression interpolator to prevent XSS in `{{...}}` output.

  
### matchRoute()

  
The SSR module re-exports `matchRoute()` from the router — a standalone, **DOM-free** route matcher that resolves a URL pathname to a component name and parsed params. This eliminates the need to duplicate route-matching logic in your server code.

  

```javascript
import { createSSRApp, matchRoute } from 'zero-query/ssr';
import { routes } from '../app/routes.js';

const app = createSSRApp();
// ... register components ...

async function render(pathname) {
  const { component, params } = matchRoute(routes, pathname);
  const props = getPropsForRoute(component, params);
  const html = await app.renderToString(component, props);
  return html;
}
```

  
| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `routes` | `RouteDefinition[]` | — | Array of route objects with `path` and `component` |
| `pathname` | `string` | — | URL path to match (e.g. `'/blog/my-post'`) |
| `fallback` | `string` | `'not-found'` | Component name returned when no route matches |

  
**Returns:** `{ component: string, params: Record }`

  
Uses the same matching rules as the client-side router: `:param` segments, `*` wildcards, first-match-wins order, and per-route `fallback` aliases. See the Router → matchRoute() section for full details.

---

## Security

  
zQuery applies defense-in-depth across templates, expressions, state utilities, routing, and SSR. This page summarizes the built-in protections and explains how to keep your app safe.

  
### Overview

  
| Layer | Protection |
| --- | --- |
| Templates | `{{expression}}` output is HTML-escaped automatically — XSS-safe by default |
| Expressions | Sandboxed evaluator — no access to `window`, `document`, `Function`, `eval`, or prototype chains |
| State utilities | `deepMerge()` and `setPath()` block `__proto__`, `constructor`, `prototype` keys |
| Routing | `z-link` rejects protocol schemes (`javascript:`, `data:`, etc.) |
| SSR | Error messages are never exposed in HTML output; `renderShell()` escapes all injected metadata and prevents script-tag breakout |
| `z-html` | Inserts raw HTML — only use with trusted content |

  
### Template Expression Escaping

  
The `{{expression}}` syntax in templates and `z-for` loops automatically escapes HTML entities in the output. This prevents stored XSS attacks when state contains user-supplied content.

  

```javascript
// State contains user input with HTML
state.name = '<img src=x onerror=alert(1)>';

// In template: {{state.name}}
// Rendered as: <img src=x onerror=alert(1)>
// The HTML is displayed as text, not executed
```

  
| Syntax | Escapes HTML? | Use For |
| --- | --- | --- |
| `{{expression}}` | **Yes** (auto-escaped) | Text content, labels, user-supplied data — safe by default |
| `z-text="expr"` | **Yes** (sets `textContent`) | Text-only content, numbers, counters |
| `z-html="expr"` | **No** (raw `innerHTML`) | Trusted rich HTML only — never use with user input |

  
> Both `{{expression}}` and `z-text` are XSS-safe. Only `z-html` inserts raw HTML.

  
### z-html & Trusted HTML

  
The `z-html` directive sets `innerHTML` directly — equivalent to Vue’s `v-html` or React’s `dangerouslySetInnerHTML`. It exists for rendering trusted HTML like pre-sanitized markdown, CMS content, or SVG icons.

  
> **Warning:** **Never** pass user-supplied input to `z-html` without sanitization. This creates a direct XSS vulnerability.

  

```html
<!-- SAFE: server-rendered markdown (already sanitized) -->
<div z-html="state.sanitizedMarkdown"></div>

<!-- DANGEROUS: raw user input -->
<!-- <div z-html="state.userComment"></div>  ← XSS risk! -->

<!-- SAFE: use z-text for user content -->
<p z-text="state.userComment"></p>
```

  
> **Tip:** If you need to render user HTML, sanitize it server-side (e.g. with DOMPurify) before storing it. Then use `z-html` only on the sanitized output.

  
### Expression Sandbox

  
zQuery’s expression evaluator runs in a sandboxed scope. Template expressions (`{{expr}}`, `z-if`, `z-for`, `:z-bind`, etc.) cannot access:

  
| Blocked | Reason |
| --- | --- |
| `window` / `document` / `globalThis` | Prevents DOM manipulation and global state access |
| `Function` / `eval` | Prevents arbitrary code execution |
| `RegExp` | Prevents ReDoS (catastrophic backtracking) attacks |
| `Error` | Prevents information disclosure via stack traces |
| `__proto__` / `constructor` / `prototype` | Prevents prototype chain traversal |
| `.call()` / `.apply()` / `.bind()` | Prevents context manipulation |

  
**Allowed globals** (safe, side-effect-free):

  

```javascript
// Constructors
Date, Array, Map, Set, URL, URLSearchParams, Object, String, Number, Boolean

// Static utilities
Math, JSON, console

// Functions
parseInt, parseFloat, isNaN, isFinite,
encodeURIComponent, decodeURIComponent
```

  
> **Tip:** The sandbox also blocks property access to `__defineGetter__` and other internal properties. If an expression tries to access a blocked identifier or property, it silently returns `undefined`.

  
### Prototype Pollution Prevention

  
`$.deepMerge()` and `$.setPath()` block unsafe keys to prevent prototype pollution attacks. These keys are silently skipped:

  

```javascript
// These keys are blocked and silently dropped:
$.deepMerge({}, { __proto__: { polluted: true } });
// Object.prototype.polluted is still undefined ✓

$.deepMerge({}, { constructor: { prototype: { bad: true } } });
// Blocked ✓

$.setPath({}, '__proto__.polluted', true);
// Blocked ✓

// Safe keys still work normally:
$.deepMerge({ a: 1 }, { b: 2 });          // { a: 1, b: 2 } ✓
$.setPath({}, 'user.name', 'Alice');        // { user: { name: 'Alice' } } ✓
```

  
> **Why this matters:** If your app merges untrusted JSON (e.g. from an API or user input) into state objects, prototype pollution could inject properties onto `Object.prototype`, affecting every object in the application. The blocked-key guard prevents this attack vector.

  
### Route Link Validation

  
The `z-link` click handler rejects any value that looks like a protocol scheme. This defense-in-depth check ensures that `javascript:` and other dangerous protocols are never processed by the router:

  

```html
<!-- These work (internal route paths): -->
<a z-link="/about">About</a>
<a z-link="/user/42">User</a>

<!-- These are silently rejected (protocol schemes): -->
<!-- z-link="javascript:alert(1)"  → ignored -->
<!-- z-link="data:text/html,..."   → ignored -->
<!-- z-link="http://evil.com"      → ignored -->
```

  
> **Tip:** For external links, use a regular `` tag. `z-link` is designed exclusively for SPA route navigation.

  
### SSR Error Sanitization

  
When a component throws during server-side rendering, zQuery inserts a generic error comment in the HTML output:

  

```html
<!-- SSR render error -->
```

  
The actual error details (message, stack trace, file paths) are reported via `$.reportError()` for developer debugging but are **never** exposed in the HTML sent to end users. This prevents information disclosure about your server’s internal implementation.

  
`renderShell()` applies additional hardening when injecting metadata into your HTML shell:

  
| Vector | Protection |
| --- | --- |
| Script-tag breakout via `ssrData` | `` and `` tag |
| ReDoS via OG keys | Open Graph keys are sanitized to `[a-zA-Z0-9_:-]` and regex-escaped before pattern matching |
| Attribute injection via OG keys | Special characters (quotes, angle brackets) are stripped from OG keys, preventing attribute breakout |
| `$` substitution in component output | All `.replace()` calls use replacer functions instead of replacement strings, preventing `$1`, `$'`, `$`` pattern corruption |
| XSS via title / description / OG values | All injected text is HTML-escaped via `escapeHtml()` |

  
### Best Practices

  
zQuery is secure by default, but application code still needs to follow good habits. Here are guidelines for keeping your app safe:

  
#### 1. Prefer `{{ }}` and `z-text` over `z-html`

  
Template expressions and `z-text` auto-escape HTML. Only reach for `z-html` when you genuinely need to render trusted rich HTML (pre-sanitized markdown, CMS output, SVG icons).

  

```html
<!-- Good: auto-escaped, XSS-safe -->
<p>{{state.userInput}}</p>
<span z-text="state.comment"></span>

<!-- Only when needed, and only with sanitized content -->
<div z-html="state.sanitizedMarkdown"></div>
```

  
#### 2. Sanitize before storing, not before rendering

  
If your app accepts rich HTML from users (comments, bios, posts), sanitize it **server-side** before saving. Then `z-html` can safely render the pre-sanitized output.

  

```javascript
// Server-side (Node.js example with DOMPurify + jsdom)
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
const { window } = new JSDOM('');
const purify = DOMPurify(window);

const clean = purify.sanitize(userInput);
// Store 'clean' in your database  safe for z-html
```

  
#### 3. Never build dynamic expressions from user input

  
The expression sandbox protects against template-level attacks, but avoid constructing expression strings from untrusted data in your JavaScript:

  

```javascript
// BAD: building expression from user input
const expr = userInput; // could be "constructor.constructor('alert(1)')();"
element.setAttribute('z-if', expr);

// GOOD: bind user values through state
this.state.showPanel = validateBoolean(userInput);
// template: <div z-if="state.showPanel">...</div>
```

  
#### 4. Validate API data before merging into state

  
Even though `deepMerge()` blocks prototype pollution keys, you should still validate data shapes from external APIs before merging them into your store:

  

```javascript
// Validate expected shape before merge
const data = await $.http.get('/api/settings');
if (data && typeof data.theme === 'string' && typeof data.fontSize === 'number') {
  $.store.batch(() => {
    $.store.state.settings = $.deepMerge($.store.state.settings, data);
  });
}
```

  
#### 5. Use `z-link` for internal navigation only

  
The `z-link` directive is for SPA route paths. For external URLs, use standard anchor tags with `target="_blank"` and `rel="noopener"`:

  

```html
<!-- Internal route: use z-link -->
<a z-link="/settings">Settings</a>

<!-- External link: use regular href -->
<a href="https://github.com/tonywied17/zero-query"
   target="_blank" rel="noopener">GitHub</a>
```

  
#### 6. Keep error details server-side in production

  
zQuery’s SSR already strips error details from HTML output. Apply the same principle in your own error handling — log full details server-side, show generic messages to users.

  
> **Tip:** Following these practices plus the built-in protections gives you a strong defense-in-depth posture. The library handles the framework layer so you can focus on application-level validation.

  
### Quick Reference

  
| Feature | Protection |
| --- | --- |
| `{{expr}}` interpolation | Auto-escapes HTML entities (XSS-safe) |
| `z-text` | Sets `textContent` (XSS-safe) |
| `z-html` | Raw `innerHTML` — trusted content only |
| Expression evaluator | Sandboxed — blocks `window`, `Function`, `eval`, `RegExp`, `Error`, prototype access |
| `deepMerge()` / `setPath()` | Blocks `__proto__`, `constructor`, `prototype` keys |
| `z-link` | Rejects protocol schemes (`javascript:`, `data:`, `http:`) |
| SSR errors | Generic comment in HTML — details stay server-side |
| `renderShell()` metadata | HTML-escaped values, sanitized OG keys, script-tag breakout prevention, safe `.replace()` patterns |

---

## ES Module Exports (for npm/bundler usage)

When used as an ES module (not the built bundle), the library provides named exports for every public API:

```js
import {
  $,
  $ as zQuery,
  ZQueryCollection,
  queryAll,
  reactive,
  Signal,
  signal,
  computed,
  effect,
  batch,
  untracked,
  component,
  mount,
  mountAll,
  getInstance,
  destroy,
  getRegistry,
  prefetch,
  style,
  morph,
  morphElement,
  safeEval,
  createRouter,
  getRouter,
  matchRoute,
  createStore,
  getStore,
  http,
  ZQueryError,
  ErrorCode,
  onError,
  reportError,
  guardCallback,
  guardAsync,
  validate,
  formatError,
  debounce,
  throttle,
  pipe,
  once,
  sleep,
  escapeHtml,
  stripHtml,
  html,
  trust,
  TrustedHTML,
  uuid,
  camelCase,
  kebabCase,
  deepClone,
  deepMerge,
  isEqual,
  param,
  parseQuery,
  storage,
  session,
  EventBus,
  bus,
  range,
  unique,
  chunk,
  groupBy,
  pick,
  omit,
  getPath,
  setPath,
  isEmpty,
  capitalize,
  truncate,
  clamp,
  memoize,
  retry,
  timeout
} from 'zero-query';
```

> The SSR module has its own entry point: `import { createSSRApp, renderToString } from 'zero-query/ssr';`