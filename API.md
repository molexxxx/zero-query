# zQuery (zeroQuery) — Full API Reference

Complete API documentation for every module, method, option, and type in zQuery. All examples assume the global `$` is available via the built `zQuery.min.js` bundle. For getting started, project setup, the dev server, and the CLI bundler, see [README.md](README.md).

> **Editor Support:** Install the [zQuery for VS Code](https://marketplace.visualstudio.com/items?itemName=zQuery.zquery-vs-code) extension for autocomplete, hover docs, directive support, and 140+ code snippets.

---

## Table of Contents

- [Selectors & DOM](#selectors--dom)
  - [Selecting Elements](#selecting-elements)
  - [Working with Single Elements](#working-with-single-elements)
  - [Collection Selector — $.all()](#collection-selector--all)
  - [Element Creation — $.create()](#element-creation--create)
  - [Collection Methods — ZQueryCollection](#collection-methods--zquerycollection)
  - [Events — DOM & Global](#events--dom--global)
  - [Animations](#animations)
  - [Form Helpers](#form-helpers)
  - [Extend with Plugins — $.fn](#extend-with-plugins--fn)
  - [Static Helpers](#static-helpers)
- [Reactive — Proxies & Signals](#reactive--proxies--signals)
  - [reactive()](#reactiveobject-onchange)
  - [signal()](#signalinitial)
  - [computed()](#computedfn)
  - [effect()](#effectfn)
- [Component System](#component-system)
  - [$.component()](#componentname-definition)
  - [Component Definition Options](#component-definition-options)
  - [Component Instance API](#component-instance-api)
  - [Computed Properties](#computed-properties)
  - [Watch Callbacks](#watch-callbacks)
  - [Slots — Content Projection](#slots--content-projection)
  - [External Templates & Styles](#external-templates--styles)
  - [Pages Config](#pages-config)
  - [Directives](#directives)
  - [z-key — Keyed Reconciliation](#z-key--keyed-reconciliation)
  - [$.mount()](#mounttarget-name-props)
  - [$.mountAll()](#mountallroot)
  - [$.getInstance()](#getinstancetarget)
  - [$.destroy()](#destroytarget)
  - [$.components() / getRegistry()](#components--getregistry)
  - [$.style()](#styleurls)
- [Router](#router)
  - [$.router() — createRouter](#routerconfig)
  - [Router Config Options](#router-config-options)
  - [Route Object](#route-object)
  - [Router Instance Methods](#router-instance-methods)
  - [Router Properties](#router-properties)
  - [Navigation Context](#navigation-context)
  - [$.getRouter()](#getrouter)
- [Store](#store)
  - [$.store() — createStore](#storeconfig)
  - [Store Config Options](#store-config-options)
  - [Store Instance Methods](#store-instance-methods)
  - [Store Properties](#store-properties)
  - [$.getStore()](#getstorename)
- [HTTP Client](#http-client)
  - [Request Methods](#request-methods)
  - [$.http.configure()](#httpconfigureoptions)
  - [Interceptors](#interceptors)
  - [$.http.createAbort()](#httpcreateabort)
  - [$.http.raw()](#httprawurl-opts)
  - [Response Object](#response-object)
- [Utilities](#utilities)
  - [Function Utilities](#function-utilities)
  - [String Utilities](#string-utilities)
  - [Object Utilities](#object-utilities)
  - [URL Utilities](#url-utilities)
  - [Storage Wrappers](#storage-wrappers)
  - [Event Bus](#event-bus)
- [Error Handling](#error-handling)
  - [Error Codes — $.ErrorCode](#error-codes--errorcode)
  - [ZQueryError](#zqueryerror)
  - [$.onError(handler)](#onerrorhandler)
  - [reportError()](#reporterrorcode-message-context-cause)
  - [guardCallback()](#guardcallbackfn-code-context)
  - [validate()](#validatevalue-name-expectedtype)
- [Global API](#global-api)
- [Server-Side Rendering (SSR)](#server-side-rendering-ssr)
- [ES Module Exports](#es-module-exports-for-npmbundler-usage)

---

## Selectors & DOM

zQuery gives you a full set of selectors for every common lookup pattern — by ID, class, tag, CSS query, or parent. Most of the time you're grabbing **one element**, so the API is designed around that. `$.all()` is there when you genuinely need a collection.

| Selector | Returns | Description |
| --- | --- | --- |
| `$(selector)` | `Element \| null` | First match via `querySelector`. Also accepts elements, NodeLists, HTML strings, and functions (DOM-ready). |
| `$.id(id)` | `Element \| null` | `document.getElementById` |
| `$.class(name)` | `Element \| null` | First element with the class — `querySelector('.name')` |
| `$.classes(name)` | `Array<Element>` | All elements with the class — `getElementsByClassName` as array |
| `$.tag(name)` | `Array<Element>` | All elements of a tag — `getElementsByTagName` as array |
| `$.children(parentId)` | `Array<Element>` | Direct children of `#parentId` as array |
| `$.all(selector)` | `ZQueryCollection` | All matches via `querySelectorAll`, wrapped in a chainable collection |

> `queryAll` is the ES module export name for `$.all()` — they are identical. Use `queryAll` in `import { queryAll } from '...'` contexts.

> **Which one should I use?** Reach for the specific helper first — `$.id()`, `$.class()`, `$.tag()` — they're shorter, faster, and make your intent obvious. Use `$()` for complex CSS selectors or scoped queries. Use `$.all()` only when you actually need to operate on **multiple elements** at once.

### Selecting Elements

```js
// By ID — grab a specific container, form, or section
const app      = $.id('app');
const sidebar  = $.id('sidebar');
const modal    = $.id('confirm-dialog');

// By class — first matching element
const hero     = $.class('hero-banner');
const active   = $.class('tab-active');

// All elements with a class — returns a plain array
const errors   = $.classes('field-error');    // [span.field-error, span.field-error, ...]

// By tag — all elements of that type
const images   = $.tag('img');               // every <img> on the page
const rows     = $.tag('tr');                // every table row

// Children of a specific parent
const navItems = $.children('main-nav');     // direct children of #main-nav

// CSS selector — for anything more specific
const email    = $('input[name="email"]');   // first matching input
const featured = $('article.featured');      // first featured article
const nested   = $('li', '#todo-list');      // first <li> inside #todo-list

// Create an element from an HTML string
const alert    = $('<div class="alert">Saved!</div>');

// DOM-ready callback
$(() => console.log('DOM is ready'));
```

### Working with Single Elements

Every selector above (except `$.all`) returns a **raw DOM element** — no wrapper, no abstraction. You use the standard DOM API directly:

```js
// Toggle a sidebar
const sidebar = $.id('sidebar');
sidebar.classList.toggle('collapsed');

// Read and update a form field
const emailInput = $('input[name="email"]');
console.log(emailInput.value);
emailInput.value = '';
emailInput.focus();

// Show/hide a modal
const modal = $.id('confirm-dialog');
modal.style.display = 'flex';         // show
modal.style.display = 'none';         // hide

// Update text content
$.id('cart-count').textContent = '3';

// Set attributes on a specific element
$.class('avatar').setAttribute('src', user.photoUrl);

// Loop over a plain array from $.classes / $.tag / $.children
$.classes('notification').forEach(el => el.remove());
$.tag('input').forEach(el => { el.disabled = true; });
```

> **No wrapper overhead.** Because `$()`, `$.id()`, `$.class()`, etc. return native DOM elements, you get full access to the browser API. There's no collection object to unwrap — just the element you asked for.

---

### Collection Selector — `$.all()`

When you need to apply the same operation to **many elements at once**, `$.all()` returns a `ZQueryCollection` with chainable helper methods:

```js
// Disable all submit buttons in a form while saving
$.all('#checkout-form button[type="submit"]').prop('disabled', true).addClass('saving');

// The collection is iterable — for...of and spread both work
for (const row of $.all('table.report tbody tr')) {
  console.log(row.cells[0].textContent);
}
```

---

### Element Creation — `$.create()`

Create a DOM element programmatically with attributes, styles, event listeners, and children in a single call:

```js
const btn = $.create('button', {
  class: 'primary',
  style: { padding: '10px', borderRadius: '6px' },
  onclick: () => alert('Clicked!'),
  data: { action: 'submit', id: '42' }  // sets data-action, data-id
}, 'Click Me');

document.body.appendChild(btn);
```

| Attribute Key | Behavior |
| --- | --- |
| `class` | Sets `className` directly |
| `style` (object) | Assigns each property to `el.style` |
| `on*` (e.g. `onclick`) | Adds event listener for the event name after "on" |
| `data` (object) | Sets `dataset` properties |
| Anything else | Calls `setAttribute(key, value)` |

Additional arguments after `attrs` are appended as children (strings become text nodes, elements are appended directly).

---

### Collection Methods — `ZQueryCollection`

When you call `$.all()`, the returned `ZQueryCollection` provides a rich set of chainable methods. Most setters return `this` for chaining; getters return the value from the first element.

#### Traversal & Filtering

| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `find` | `find(selector)` | `ZQueryCollection` | Find descendants matching selector |
| `parent` | `parent()` | `ZQueryCollection` | Direct parent of each element (deduplicated) |
| `closest` | `closest(selector)` | `ZQueryCollection` | Closest ancestor matching selector |
| `children` | `children(selector?)` | `ZQueryCollection` | Direct children, optionally filtered by selector |
| `siblings` | `siblings()` | `ZQueryCollection` | All sibling elements (excluding self) |
| `next` | `next()` | `ZQueryCollection` | Next sibling element |
| `prev` | `prev()` | `ZQueryCollection` | Previous sibling element |
| `filter` | `filter(selector \| fn)` | `ZQueryCollection` | Filter by CSS selector or callback `fn(index, el)` |
| `not` | `not(selector \| fn)` | `ZQueryCollection` | Inverse of `filter()` |
| `has` | `has(selector)` | `ZQueryCollection` | Keep elements that have a descendant matching selector |

#### Iteration

| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `each` | `each(fn)` | `this` | `fn.call(el, index, el)` — chainable |
| `map` | `map(fn)` | `Array` | `fn.call(el, index, el)` — returns plain array |
| `first` | `first()` | `Element \| null` | First element in collection |
| `last` | `last()` | `Element \| null` | Last element in collection |
| `eq` | `eq(index)` | `ZQueryCollection` | Single-element collection at given index |
| `toArray` | `toArray()` | `Array<Element>` | Spread to plain array |

> **Numeric indexing:** You can access elements directly by index — `$.all('.card')[0]` returns the first raw DOM element, just like an array. The collection also implements `[Symbol.iterator]`, so `for...of` and spread (`...`) work natively.

#### Classes & Attributes

| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `addClass` | `addClass(...names)` | `this` | Add one or more classes (space-separated names also work) |
| `removeClass` | `removeClass(...names)` | `this` | Remove one or more classes |
| `toggleClass` | `toggleClass(name, force?)` | `this` | Toggle class; optional `force` boolean |
| `hasClass` | `hasClass(name)` | `boolean` | Returns true if **first element** has the class |
| `attr` | `attr(name, value?)` | `string \| this` | Get (1 arg) or set (2 args) attribute |
| `removeAttr` | `removeAttr(name)` | `this` | Remove attribute from all elements |
| `prop` | `prop(name, value?)` | `any \| this` | Get/set DOM property (e.g. `checked`, `disabled`) |
| `data` | `data(key?, value?)` | `any \| this` | Get/set data attributes. Auto JSON-parses on get, auto JSON-stringifies objects on set |

#### Content & DOM Manipulation

| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `html` | `html(content?)` | `string \| this` | Get/set innerHTML |
| `text` | `text(content?)` | `string \| this` | Get/set textContent |
| `val` | `val(value?)` | `string \| this` | Get/set input/textarea value |
| `append` | `append(content)` | `this` | Append HTML string, Node, or ZQueryCollection |
| `prepend` | `prepend(content)` | `this` | Prepend content |
| `after` | `after(content)` | `this` | Insert content after each element |
| `before` | `before(content)` | `this` | Insert content before each element |
| `wrap` | `wrap(wrapper)` | `this` | Wrap each element with HTML string or element (cloned) |
| `remove` | `remove()` | `this` | Remove all elements from DOM |
| `empty` | `empty()` | `this` | Clear innerHTML of all elements |
| `clone` | `clone(deep = true)` | `ZQueryCollection` | Deep-clone all elements |
| `replaceWith` | `replaceWith(content)` | `this` | Replace each element with new content |

#### CSS & Dimensions

| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `css` | `css(prop \| object)` | `string \| this` | Get computed style (string arg) or set styles (object arg) |
| `width` | `width()` | `number` | First element width via `getBoundingClientRect` |
| `height` | `height()` | `number` | First element height via `getBoundingClientRect` |
| `offset` | `offset()` | `{ top, left, width, height } \| null` | Position relative to document (includes scroll offset) |
| `position` | `position()` | `{ top, left } \| null` | Position relative to offset parent (`offsetTop`/`offsetLeft`) |

#### Visibility

| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `show` | `show(display = '')` | `this` | Set `display` style (default removes `display: none`) |
| `hide` | `hide()` | `this` | Set `display: none` |
| `toggle` | `toggle(display = '')` | `this` | Toggle visibility |

#### Events

| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `on` | `on(event, selectorOrFn, fn?)` | `this` | Bind event(s). Supports space-separated events (`"click mouseenter"`). When `selectorOrFn` is a string, uses event delegation. |
| `off` | `off(event, fn)` | `this` | Unbind event(s). Space-separated events supported. |
| `one` | `one(event, fn)` | `this` | Bind event that fires once, then auto-removes |
| `trigger` | `trigger(event, detail?)` | `this` | Dispatch `CustomEvent` with `bubbles: true` |
| `click` | `click(fn?)` | `this` | Shorthand: bind click or trigger click (no args) |
| `submit` | `submit(fn?)` | `this` | Shorthand: bind submit or trigger submit |
| `focus` | `focus()` | `this` | Focus first element |
| `blur` | `blur()` | `this` | Blur first element |

---

### Events — DOM & Global

Single elements use native `addEventListener`. Collections get chainable `.on()`. Global events use `$.on()` / `$.off()`.

```js
// Single element — native DOM API
const saveBtn = $.id('save-btn');
saveBtn.addEventListener('click', () => { /* save logic */ });

// Keyboard shortcut on document via $.on()
$.on('keydown', (e) => {
  if (e.key === 'Escape') $.id('modal').style.display = 'none';
});

// Delegated — listen on a parent, filter by child selector
$.on('click', '.delete-btn', function(e) {
  this.closest('.todo-item').remove();
});

// Remove a global listener
const handler = (e) => console.log(e.detail);
$.on('theme:change', handler);
$.off('theme:change', handler);

// Collection .on() — when you truly need the same handler on many elements
$.all('nav a').on('mouseenter mouseleave', (e) => {
  e.target.classList.toggle('hovered');
});

// One-time event on a collection
$.all('.onboarding-step').one('click', function() {
  this.classList.add('completed');
});
```

> **Delegated events** are essential for dynamic content. Elements added to the DOM after binding still trigger delegated handlers because the check happens at event time, not bind time.

---

### Animations

All animation methods return `Promise`s, so you can `await` them for sequencing:

| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `animate` | `animate(props, duration = 300, easing = 'ease')` | `Promise<ZQueryCollection>` | CSS transition to target properties. Includes a fallback timeout at `duration + 50ms`. |
| `fadeIn` | `fadeIn(duration = 300)` | `Promise` | Fade in from `opacity: 0` to `opacity: 1` |
| `fadeOut` | `fadeOut(duration = 300)` | `Promise` | Fade out and hide element after completion |
| `slideToggle` | `slideToggle(duration = 300)` | `this` | Toggle height between 0 and natural height |

```js
// Fade in a single modal
const modal = $.id('modal');
await $.all([modal]).fadeIn(200);  // wrap in collection for animation helpers

// Or target by selector when animating multiple elements
await $.all('.row.removing').animate({ opacity: '0', transform: 'translateX(-20px)' }, 300);
$.all('.row.removing').remove();
```

---

### Form Helpers

```js
// Grab the form as a collection for serialize helpers
const form = $.all('#checkout-form');

// URL-encoded string (like traditional form submission)
form.serialize();        // "name=Tony&email=tony%40x.com"

// Plain object (handles duplicate field names as arrays)
form.serializeObject();  // { name: 'Tony', email: 'tony@x.com' }
// If multiple checkboxes: { colors: ['red', 'blue'] }
```

---

### Extend with Plugins — `$.fn`

`$.fn` is an alias for `ZQueryCollection.prototype`. Add custom methods to it just like jQuery plugins:

```js
// Define a plugin
$.fn.disable = function() {
  return this.prop('disabled', true).addClass('disabled');
};

// Use it on any collection
$.all('#settings-form input').disable();
```

> **Tip:** Always return `this` from plugin methods to preserve chainability.

---

### Static Helpers

#### `$.ready(fn)`

Register a DOMContentLoaded callback (fires immediately if already loaded).

```js
$.ready(() => console.log('DOM ready'));
```

#### `$.on(event, selector, handler)`

Global event delegation on `document`.

```js
$.on('click', '.nav-link', function(e) {
  // 'this' is the matched element
  console.log(this.href);
});
```

#### `$.on(event, handler)`

Direct event listener on `document` (no delegation). Useful for keyboard shortcuts, global key handlers, and other events where a CSS selector doesn't apply.

```js
// Close a modal on Escape
$.on('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});
```

#### `$.off(event, handler)`

Remove a direct global event listener previously attached with `$.on(event, handler)`.

```js
const onResize = () => console.log(window.innerWidth);
$.on('resize', onResize);
// later:
$.off('resize', onResize);
```

---

## Reactive — Proxies & Signals

### `reactive(object, onChange)`

Wraps an object in a deep Proxy that triggers `onChange` on any set or delete operation.

| Parameter | Type | Description |
| --- | --- | --- |
| `target` | `object` | The object to make reactive |
| `onChange` | `(key, value, oldValue) => void` | Callback on mutation |

**Returns:** Reactive `Proxy`

**Special properties:**
- `proxy.__isReactive` → `true`
- `proxy.__raw` → the original unwrapped object

```js
const state = $.reactive({ count: 0, user: { name: 'Tony' } }, (key, val, old) => {
  console.log(`${key}: ${old} → ${val}`);
});

state.count = 1;         // logs "count: 0 → 1"
state.user.name = 'New'; // logs "name: Tony → New" (deep reactive)
delete state.count;       // logs "count: 1 → undefined"
```

### `signal(initial)`

Create a reactive Signal primitive.

| Parameter | Type | Description |
| --- | --- | --- |
| `initial` | `any` | Initial value |

**Returns:** `Signal` instance

**Signal instance API:**

| Property/Method | Description |
| --- | --- |
| `.value` | Get/set the value. Getter auto-tracks in `effect()` scope. Setter notifies subscribers. |
| `.peek()` | Read value without tracking (no subscription created). |
| `.subscribe(fn)` | Manual subscription. Returns unsubscribe function. |
| `.toString()` | Returns `String(value)`. |

```js
const name = $.signal('Tony');
console.log(name.value);  // 'Tony'
name.value = 'Updated';   // triggers subscribers

const unsub = name.subscribe(() => console.log('name changed'));
unsub();
```

### `computed(fn)`

Create a derived Signal that auto-recomputes when its signal dependencies change.

| Parameter | Type | Description |
| --- | --- | --- |
| `fn` | `() => any` | Computation function (reads signals via `.value`) |

**Returns:** `Signal` (read-only — setting `.value` is not recommended)

```js
const count = $.signal(5);
const doubled = $.computed(() => count.value * 2);
console.log(doubled.value);  // 10
count.value = 10;
console.log(doubled.value);  // 20
```

### `effect(fn)`

Run a side-effect function that automatically subscribes to any Signals read during execution. Re-runs whenever those signals change.

| Parameter | Type | Description |
| --- | --- | --- |
| `fn` | `() => void` | Effect function |

**Returns:** `() => void` — dispose function

```js
const x = $.signal(1);
const y = $.signal(2);

const dispose = $.effect(() => {
  console.log('sum:', x.value + y.value);  // runs now: "sum: 3"
});

x.value = 10;  // re-runs: "sum: 12"
dispose();      // stops tracking
```

---

## Component System

### `component(name, definition)`

Register a new component.

| Parameter | Type | Description |
| --- | --- | --- |
| `name` | `string` | Component name — **must contain a hyphen** (e.g. `'app-counter'`) |
| `definition` | `object` | Component definition (see below) |

```js
$.component('app-counter', {
  state: () => ({ count: 0 }),
  render() { return `<p>${this.state.count}</p>`; },
  increment() { this.state.count++; }
});
```

### Component Definition Options

| Key | Type | Required | Description |
| --- | --- | --- | --- |
| `state` | `object \| () => object` | No | Initial reactive state. Function form recommended for reusability. |
| `render` | `() => string` | No | Returns HTML string. Called on every state change. `this` is the component instance. Required unless `templateUrl` is used. |
| `styles` | `string` | No | CSS string — automatically scoped to this component's root element on first render. |
| `templateUrl` | `string \| string[] \| { key: url }` | No | URL to an external HTML template file, or an array/object map of URLs for multi-template components. If `render()` is also defined, `render()` takes priority. See [External Templates & Styles](#external-templates--styles). |
| `styleUrl` | `string \| string[]` | No | URL (or array of URLs) to external CSS file(s). Fetched and scoped automatically on first mount. Merged with inline `styles` if both are present. |
| `pages` | `object` | No | Declarative multi-page config with lazy loading. Exposes `this.pages`, `this.activePage`, `this.templates`. See [Pages Config](#pages-config). |
| `base` | `string` | No | Optional override for the base path used to resolve relative `templateUrl`, `styleUrl`, and `pages.dir` paths. By default, paths resolve relative to the component file automatically — you only need `base` if you want to point somewhere else (e.g. `base: 'scripts/shared/'`). |
| `init` | `() => void` | No | Called before first render (during construction). |
| `mounted` | `() => void` | No | Called once after first render and DOM insertion. |
| `updated` | `() => void` | No | Called after every subsequent re-render. |
| `destroyed` | `() => void` | No | Called when the component is destroyed. Clean up subscriptions here. |
| `computed` | `object` | No | Object of getter functions. Each key becomes a derived value on `this.computed.name`. Receives raw state as argument. |
| `watch` | `object` | No | Object of callbacks keyed by state path. Called with `(newVal, oldVal)` when the watched key changes. Supports nested keys. |
| `props` | — | No | Reserved key; props are set externally. |
| *(any other key)* | `function` | No | Becomes an instance method, available as `this.methodName()` and in `@event` bindings. |

**Full example:**

```js
$.component('user-form', {
  state: () => ({
    name: '',
    email: '',
    submitted: false,
  }),

  styles: `
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; margin-bottom: 0.25rem; color: #8b949e; }
    .success { color: #3fb950; }
  `,

  init() {
    console.log('Form component initializing');
  },

  mounted() {
    this.refs.nameInput?.focus();
  },

  updated() {
    console.log('Form re-rendered');
  },

  destroyed() {
    console.log('Form destroyed');
  },

  handleSubmit(e) {
    this.state.submitted = true;
    this.emit('formSubmit', {
      name: this.state.name,
      email: this.state.email,
    });
  },

  render() {
    if (this.state.submitted) {
      return `<p class="success">Thanks, ${this.state.name}!</p>`;
    }
    return `
      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label>Name</label>
          <input z-model="name" z-ref="nameInput" placeholder="Your name">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input z-model="email" type="email" placeholder="you@example.com">
        </div>
        <button>Submit</button>
      </form>
    `;
  }
});
```

### Component Instance API

Available inside component methods as `this`, or from `$.mount()` / `$.getInstance()` return value:

| Property/Method | Type | Description |
| --- | --- | --- |
| `this.state` | `Proxy` | Reactive state. Mutating triggers re-render. |
| `this.state.__raw` | `object` | Raw (unwrapped) state object. Write here to avoid triggering re-render. |
| `this.props` | `object` | Frozen props passed from parent. |
| `this.refs` | `object` | Map of `z-ref` name → DOM element. Populated after each render. |
| `this.templates` | `object` | Keyed map of loaded templates (when using multi-`templateUrl` or `pages`). With `pages`, templates are populated lazily — the active page is always available, others fill in via background prefetch. |
| `this.pages` | `Array<{id, label}>` | Normalized page metadata (when using `pages` config). |
| `this.activePage` | `string` | Active page id derived from route param (when using `pages` config). |
| `this.setState(partial)` | `(object) => void` | Merge partial state (triggers re-render). |
| `this.emit(name, detail)` | `(string, any) => void` | Dispatch a bubbling CustomEvent from the component root. |
| `this.destroy()` | `() => void` | Teardown: removes listeners, scoped styles, clears DOM. |
| `this._scheduleUpdate()` | `() => void` | Manually queue a re-render (microtask batched). Safe to call from anywhere — state mutations during render are coalesced, so there is no risk of infinite re-render loops. Useful for store subscriptions. |

### Computed Properties

Computed properties are derived values recalculated from state whenever accessed. Define them as getter functions in the `computed` option — each receives the raw state object and returns a value.

```js
$.component('order-summary', {
  state: () => ({
    items: [
      { name: 'Widget', price: 9.99, qty: 2 },
      { name: 'Gadget', price: 24.99, qty: 1 },
    ],
    taxRate: 0.08,
  }),

  computed: {
    subtotal(state)  { return state.items.reduce((sum, i) => sum + i.price * i.qty, 0); },
    tax(state)       { return this.computed.subtotal * state.taxRate; },
    total(state)     { return this.computed.subtotal + this.computed.tax; },
    itemCount(state) { return state.items.reduce((sum, i) => sum + i.qty, 0); },
    isEmpty(state)   { return state.items.length === 0; },
  },

  render() {
    return `
      <p>Items: ${this.computed.itemCount}</p>
      <p>Total: $${this.computed.total.toFixed(2)}</p>
    `;
  }
});
```

| Detail | Description |
| --- | --- |
| Access | `this.computed.name` — available in `render()`, methods, and lifecycle hooks. |
| Mechanism | Each computed property is a getter via `Object.defineProperty`. Re-invoked on every access. |
| Argument | The function receives `this.state.__raw` (unwrapped state) as its first argument. |
| Cross-reference | Computed properties can reference other computed values (e.g. `this.computed.subtotal`). |

### Watch Callbacks

Watch callbacks fire when a specific state key changes. Use them for side effects — localStorage, analytics, toasts, external DOM updates, data fetching.

```js
$.component('settings-panel', {
  state: () => ({
    theme: 'dark',
    fontSize: 16,
    user: { name: 'Tony', email: 'tony@example.com' },
  }),

  watch: {
    theme(val, old) {
      document.documentElement.setAttribute('data-theme', val);
    },
    fontSize(val) {
      document.documentElement.style.fontSize = val + 'px';
    },
    'user.name'(val) {
      console.log('Name updated to:', val);
    },
  },

  render() { /* ... */ }
});
```

| Detail | Description |
| --- | --- |
| Signature | `key(newVal, oldVal)` — called with the new and previous values. |
| Nested keys | `'user.name'` watches the `name` property inside `user`. |
| Parent keys | A watcher on `'user'` also fires when `'user.name'` changes. |
| Timing | Fires synchronously in the reactive setter, before the batched DOM update. |

### Slots — Content Projection

Slots let a parent inject content into a child component's template. The child uses `<slot>` placeholders; the parent provides content inside the child's tag.

#### Default Slot

```js
$.component('card-box', {
  render() {
    return `<div class="card"><slot>Fallback content</slot></div>`;
  }
});
```

```html
<!-- Parent provides content -->
<card-box>
  <h3>Hello!</h3>
  <p>This fills the default slot.</p>
</card-box>

<!-- Empty tag shows fallback -->
<card-box></card-box>
```

#### Named Slots

```js
$.component('page-layout', {
  render() {
    return `
      <header><slot name="header">Default Header</slot></header>
      <main><slot>Default Body</slot></main>
      <footer><slot name="footer">Default Footer</slot></footer>
    `;
  }
});
```

```html
<page-layout>
  <div slot="header"><h1>My App</h1></div>
  <p>Body content (default slot).</p>
  <div slot="footer">&copy; 2026</div>
</page-layout>
```

| Detail | Description |
| --- | --- |
| Capture | Inner HTML is captured from the host element before the first render. |
| Named | Children with `slot="name"` go to the matching `<slot name="name">`. |
| Default | Everything else goes to the unnamed `<slot>` (the default slot). |
| Fallback | Content between `<slot>...</slot>` is used when no projected content is provided. |
| Timing | Slots are captured once at mount time — ideal for static content projection. |

### External Templates & Styles

Components can load HTML templates and CSS from external files. Resources are fetched once on first mount and cached globally.

#### `styleUrl` — External CSS

```js
$.component('my-widget', {
  state: { title: 'Hello' },
  render() { return `<div class="widget"><h2>${this.state.title}</h2></div>`; },
  styleUrl: 'styles.css'
});
```

The CSS file is fetched, scoped to the component, and injected into `<head>`. If `styles` (inline) is also defined, they are merged.

#### `templateUrl` — External HTML Template

```js
$.component('my-widget', {
  state: { title: 'Hello', items: ['A', 'B'] },
  templateUrl: 'template.html',
  styleUrl:    'styles.css'
});
```

Template file uses `{{expression}}` interpolation:

```html
<!-- components/my-widget/template.html -->
<div class="widget">
  <h2>{{title}}</h2>
  <p>Item count: {{items.length}}</p>
</div>
```

| Behavior | Detail |
| --- | --- |
| `render()` vs `templateUrl` | If both are defined, `render()` takes priority. |
| `styles` vs `styleUrl` | If both are defined, they are merged (inline first, then external). |
| Caching | Resources are fetched once per URL and shared across all instances of the definition. |
| URL resolution | Relative paths resolve relative to the component file automatically. Absolute paths and full URLs are used as-is. If a `base` string is provided, it overrides the auto-detected path. |
| `{{expression}}` context | Expressions run inside `with(state) { ... }` giving direct access to all state properties. `props` and `$` are also available. |

#### Multiple Templates — `templateUrl` as object or array

`templateUrl` also accepts an **object map** or **array** of URLs. When multiple templates are loaded, they are exposed as `this.templates` inside `render()`.

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

// Array form — keyed by index (0, 1, 2…)
$.component('multi-step', {
  templateUrl: ['pages/step1.html', 'pages/step2.html'],
  render() {
    return `<div>${this.templates[this.state.step]}</div>`;
  }
});
```

| Form | `this.templates` keys | Example access |
| --- | --- | --- |
| `string` | n/a (single template used automatically) | Not applicable |
| `string[]` | Numeric indices (`0`, `1`, `2`…) | `this.templates[0]` |
| `{ key: url }` | Named keys | `this.templates['router']` |

All templates are fetched in parallel on first mount and cached. Subsequent mounts are instant.

#### Multiple Stylesheets — `styleUrl` as array

`styleUrl` can accept an **array of URLs**. All stylesheets are fetched in parallel, concatenated, and scoped.

```js
$.component('my-widget', {
  styleUrl: [
    '../shared/base.css',
    'styles.css',
  ],
  render() { return '<div class="widget">Content</div>'; }
});
```

### Pages Config

The `pages` option is a high-level shorthand for components that load and display multiple HTML pages from a directory. It normalizes page metadata, derives the active page from a route parameter, and **lazy-loads templates** — only the active page is fetched on first render, and remaining pages are prefetched in the background for instant navigation.

```js
// File: scripts/components/docs/docs.js
$.component('docs-page', {
  pages: {
    dir:     'pages',                  // → scripts/components/docs/pages/
    param:   'section',                // reads :section from the route
    default: 'getting-started',
    items: [
      'getting-started',
      { id: 'dev-workflow', label: 'Development' },
      { id: 'cli-bundler', label: 'CLI Bundler' },
      'project-structure',
      { id: 'selectors', label: 'Selectors & DOM' },
      'components',
      'router',
      'store',
      { id: 'http', label: 'HTTP Client' },
      'reactive',
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

#### Pages Config Options

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `dir` | `string` | `''` | Directory containing the page HTML files (resolved via `base` if set). |
| `param` | `string` | — | Route param name — must match a `:param` segment in your route (e.g. `'section'` for `/docs/:section`). |
| `default` | `string` | first item | Page id shown when the route param is absent. |
| `ext` | `string` | `'.html'` | File extension appended to each page id. |
| `items` | `Array<string \| {id, label}>` | `[]` | List of page ids and/or objects. |

#### How `pages` Works

1. **Normalizes items** — Strings auto-derive labels by converting kebab-case to Title Case: `'getting-started'` → `{ id: 'getting-started', label: 'Getting Started' }`. Objects pass through with an optional auto-label.
2. **Builds a URL map** — Creates `{ id: 'dir/id.ext', … }` for each item.
3. **Lazy-loads the active page** — On first render only the active page’s HTML is fetched. The component renders as soon as that single file is ready.
4. **Prefetches remaining pages** — After the active page renders, all other page templates are fetched in the background. Navigation to those pages is then instant.
5. **Exposes `this.pages`** — Array of `{ id, label }` objects available inside `render()`.
6. **Exposes `this.activePage`** — The current page id, derived from `this.props.$params[param]` (falling back to `default` or the first item). If the param doesn’t match any known page, it falls back to the default.
7. **Exposes `this.templates`** — Keyed template map. The active page is always present; other pages appear as their background prefetch completes.

#### Adding Interactivity to Pages

Page HTML files are static content by default. If a page needs interactivity, embed a component tag directly in the HTML — the component system automatically initializes custom elements found in rendered content:

```html
<!-- pages/getting-started.html -->
<h2>Getting Started</h2>
<p>Follow the steps below to set up your project.</p>

<!-- Interactive component embedded in a static page -->
<install-wizard></install-wizard>

<h3>Next Steps</h3>
<p>Once installed, explore the Components section.</p>
```

```js
// components/install-wizard.js — registered separately
$.component('install-wizard', {
  state: () => ({ step: 1 }),
  render() {
    return `
      <div class="wizard">
        <p>Step ${this.state.step} of 3</p>
        <button @click="next">Next</button>
      </div>
    `;
  },
  next() { if (this.state.step < 3) this.state.step++; },
});
```

> **Tip:** Keep page files as plain HTML for content. When you need interactive widgets, create a component and drop its tag into the page HTML. If a "page" needs its own layout, lifecycle, or completely different UI, make it a separate route + component instead.

> **Tip:** The `pages` config is the recommended approach for documentation pages, multi-step wizards, tabbed views, or any component that switches between multiple HTML files driven by a route parameter.

### Directives

Directives are special attributes used inside component `render()` HTML templates. They're processed automatically on each render, giving you declarative control over the DOM without manual queries.

**Processing order:** `z-for` → `z-pre` → `z-if`/`z-else-if`/`z-else` → `z-show` → `z-bind`/`:attr` → `z-class` → `z-style` → `z-html` → `z-text` → `z-cloak` → `@event`/`z-on` → `z-ref` → `z-model` → `z-key` (morph engine)

#### `z-for` — List Rendering

Expands at the string level (before innerHTML is set). Use `{{expression}}` for interpolation inside the loop body.

| Form | Syntax | Description |
| --- | --- | --- |
| Array | `z-for="item in items"` | Iterates each element |
| Array with index | `z-for="(item, i) in items"` | Destructured — `item` is value, `i` is index |
| Number range | `z-for="n in 5"` | Produces 1, 2, 3, 4, 5 (1-based) |
| Object | `z-for="(val, key) in obj"` | Iterates `Object.entries()` |

```html
<!-- Array -->
<ul>
  <li z-for="item in items">{{item.name}}</li>
</ul>

<!-- Array with index -->
<ol>
  <li z-for="(todo, i) in todos">{{i + 1}}. {{todo.text}}</li>
</ol>

<!-- Number range -->
<span z-for="n in 5">Page {{n}} </span>

<!-- Object iteration -->
<div z-for="(val, key) in settings">{{key}}: {{val}}</div>
```

Nested `z-for` is supported — inner loops are processed first, then the parser recurses outward.

#### `z-if` / `z-else-if` / `z-else` — Conditional Rendering

Evaluates the expression. If truthy, the element is kept; if falsy, it's **removed from the DOM entirely**. Chain with immediate siblings:

```html
<div z-if="status === 'loading'">Loading...</div>
<div z-else-if="status === 'error'">Something went wrong</div>
<div z-else>Content here</div>
```

Only the first truthy branch is kept. All others are removed.

#### `z-show` — Toggle Display

Toggles `display: none` without removing the element from the DOM. Use when you need frequent toggling.

```html
<div z-show="isVisible">Now you see me</div>
<p z-show="items.length === 0">No items yet.</p>
```

#### `z-bind` / `:attr` — Dynamic Attribute Binding

Two equivalent syntaxes for binding any HTML attribute:

```html
<a z-bind:href="url">Link</a>
<a :href="url">Link</a>              <!-- shorthand -->
<img :src="imgPath" :alt="imgAlt">
<button :disabled="isLoading">Submit</button>
```

- `false` / `null` / `undefined` → attribute is **removed**
- `true` → boolean attribute (`<el disabled>`)
- Any other value → attribute set to `String(val)`

#### `z-class` — Dynamic Class Binding

Accepts a string, array, or object:

| Type | Example | Behavior |
| --- | --- | --- |
| String | `z-class="'active bold'"` | Splits on whitespace, adds each class |
| Array | `z-class="['active', isOpen && 'open']"` | Adds truthy entries as classes |
| Object | `z-class="{ active: isActive, disabled: !enabled }"` | Toggles each class based on its boolean value |

```html
<div z-class="{ active: isSelected, 'text-muted': !isEnabled }">...</div>
```

#### `z-style` — Dynamic Inline Styles

Accepts a string or object:

```html
<div z-style="{ color: textColor, fontSize: size + 'px' }">Styled</div>
<div z-style="'color:red;font-weight:bold'">Inline string</div>
```

Object keys use camelCase (`fontSize`, not `font-size`). String values are appended to existing `cssText`.

#### `z-text` — Safe Text Binding

Sets `el.textContent`. Does **not** parse HTML — safe by default.

```html
<span z-text="user.name"></span>
<p z-text="message"></p>
```

#### `z-html` — HTML Injection

Sets `el.innerHTML`. Use only with trusted content — caller is responsible for sanitization.

```html
<div z-html="richContent"></div>
```

#### `z-cloak` — Anti-FOUC

Elements with `z-cloak` are hidden via a global style rule (`[z-cloak]{display:none!important}`) injected at load time. The attribute is removed after the component renders, preventing a flash of unrendered template content.

The same auto-injected `<style>` tag also applies `-webkit-tap-highlight-color: transparent` to `*, *::before, *::after`, suppressing the default blue tap-highlight on mobile browsers for all zQuery apps.

```html
<div z-cloak>{{content that would flash}}</div>
```

#### `z-pre` — Skip Directive Processing

All elements inside a `[z-pre]` subtree are exempt from directive processing. Event bindings are also skipped.

```html
<div z-pre>
  <!-- This template syntax is displayed as-is, not evaluated -->
  <span z-if="show">This stays in the DOM literally</span>
</div>
```

#### `@event` / `z-on:event` — Event Binding

Two equivalent syntaxes:

```html
<button @click="increment">+1</button>
<button z-on:click="increment">+1</button>    <!-- verbose form -->
```

Events are bound via delegation on the component root element.

**With arguments:**

```html
<button @click="remove(${item.id})">Delete</button>
<button @click="setMode('edit')">Edit</button>
<button @click="doSomething($event, 'foo', 42)">Mixed args</button>
```

**Supported argument types:** strings (`'value'` or `"value"`), numbers, booleans (`true`/`false`), `null`, `$event` (native DOM event), state references (`state.key`).

If no parentheses are used (e.g. `@click="handler"`), the native event is automatically passed as the first argument.

**Event modifiers** are chained with dot syntax:

| Modifier | Description |
| --- | --- |
| `.prevent` | Calls `e.preventDefault()` |
| `.stop` | Calls `e.stopPropagation()` |
| `.self` | Only fires if `e.target` is the element itself (not a child) |
| `.once` | Handler fires only once, then is ignored |
| `.capture` | Registers listener in capture phase |
| `.passive` | Registers listener as passive |
| `.debounce.{ms}` | Delays invocation until idle for `{ms}` ms (default 250). E.g. `@input.debounce.300="search"` |
| `.throttle.{ms}` | Fires at most once per `{ms}` ms (default 250). E.g. `@scroll.throttle.100="onScroll"` |

```html
<form @submit.prevent="save">...</form>
<div @click.stop.self="toggle">...</div>
<input @input.debounce.300="search">
<div @scroll.throttle.100="onScroll">...</div>
<button @click.once="initialize">Init</button>
```

#### `z-model` — Two-Way Binding

Creates a reactive two-way sync between a form element and a state property. When the user types or selects, the state updates and the rest of the template re-renders.

> **Focus preservation:** During re-render, the DOM morphing engine patches only the nodes that changed, so focused elements typically survive untouched. As a fallback, focus and cursor position on **any focused input, textarea, or select** are saved before the morph and restored afterward — not just `z-model` elements. The element is relocated using the first available identifier: `z-model` attribute → `z-ref` attribute → a tag/type/name/placeholder combination. This means typing feels seamless even in plain `@input`-bound search fields or other non-`z-model` inputs.

| Element / Type | Behavior |
| --- | --- |
| Text input / textarea | Listens to `input` event, reads `el.value` |
| `type="number"` / `type="range"` | Reads as `Number(el.value)` |
| `type="checkbox"` | Listens to `change` event, reads `el.checked` (boolean) |
| `type="radio"` | Listens to `change` event, checks `el.value === state[key]` |
| `<select>` | Listens to `change` event, reads `el.value` |
| `<select multiple>` | Reads `el.selectedOptions` as array of strings |
| `[contenteditable]` | Listens to `input` event, reads `el.textContent` |

**Nested keys:** Use dot-notation to bind to nested state properties:

```html
<input z-model="user.name" placeholder="Name">
<input z-model="settings.fontSize" type="number">
```

**Modifiers:** Add boolean attributes to modify behavior:

| Attribute | Effect |
| --- | --- |
| `z-lazy` | Listen on `change` instead of `input` (update on blur, not every keystroke) |
| `z-trim` | Trim whitespace from string values before writing to state |
| `z-number` | Force `Number()` conversion regardless of input type |

```html
<input z-model="search" z-lazy placeholder="Search...">
<input z-model="username" z-trim>
<input z-model="price" z-lazy z-number z-trim>
```

**Full example:**

```js
$.component('binding-demo', {
  state: () => ({
    user: { name: '', email: '' },
    age: 0,
    plan: 'free',
    tags: [],
  }),

  render() {
    const s = this.state;
    return `
      <input z-model="user.name" z-trim placeholder="Name">
      <input z-model="user.email" type="email" placeholder="Email">
      <input z-model="age" type="number" min="0">
      <label><input z-model="plan" type="radio" value="free"> Free</label>
      <label><input z-model="plan" type="radio" value="pro"> Pro</label>
      <select z-model="tags" multiple>
        <option>javascript</option>
        <option>html</option>
        <option>css</option>
      </select>

      <pre>${JSON.stringify({
        name: s.user.name,
        email: s.user.email,
        age: s.age,
        plan: s.plan,
        tags: s.tags,
      }, null, 2)}</pre>
    `;
  }
});
```

#### `z-ref` — Element Reference

```html
<input z-ref="searchInput">
<canvas z-ref="chart"></canvas>
```

After render, access via `this.refs.searchInput` or `this.refs.chart`.

### z-key — Keyed Reconciliation

Add `z-key` to elements inside a `z-for` loop to enable keyed DOM reconciliation. When the list changes, the morph engine matches old and new DOM nodes by key rather than by position, preserving focus, input values, and animations.

```html
<ul>
  <li z-for="user in users" z-key="{{user.id}}">
    {{user.name}} — {{user.role}}
  </li>
</ul>
```

| Detail | Description |
| --- | --- |
| Placement | On the same element as `z-for`, or any child that needs identity tracking. |
| Value | Must be a unique, stable identifier per item (e.g. database ID, UUID). |
| Without key | Positional matching — old[0]↔new[0]. Moved nodes are patched in place. |
| With key | Identity matching — existing DOM nodes are moved, not recreated. |
| Avoid index | `z-key="{{i}}"` defeats the purpose since indices shift on insert/remove. |

> **Under the hood:** The `morph()` engine builds key maps for old and new children, then reconciles by moving, patching, or removing nodes as needed. Combined with Proxy-based reactivity (only the changed component re-renders), this delivers minimal DOM updates.

### `morph(rootEl, newHTML)`

Patch an existing DOM element's children to match new HTML without destroying unchanged nodes. Used internally by the component system on every re-render (after the first). Can also be called directly.

```js
// Programmatic usage outside components
$.morph($.id('list'), '<li>Updated</li><li>Items</li>');
```

| Parameter | Type | Description |
| --- | --- | --- |
| `rootEl` | `Element` | The live DOM container to patch |
| `newHTML` | `string` | The desired HTML string |

### `safeEval(expr, scope)`

CSP-safe expression evaluator. Parses and evaluates a JavaScript-like expression string without using `eval()` or `new Function()`. Used internally by all directives to evaluate expressions.

```js
$.safeEval('items.length > 0 && user.name', { items: [1, 2], user: { name: 'Tony' } });
// → 'Tony'

$.safeEval('price * qty + tax', { price: 9.99, qty: 2, tax: 1.50 });
// → 21.48
```

| Detail | Description |
| --- | --- |
| Supported | Property access, arithmetic, comparisons, logical ops, ternary, optional chaining (`?.`), nullish coalescing (`??`), template literals, array/object literals, method calls, `typeof`. |
| Blocked | `constructor`, `__proto__`, `prototype` access is blocked. |
| Safe methods | Whitelisted Array/String/Number/Object methods only (e.g. `.map()`, `.filter()`, `.trim()`, `.toFixed()`). |

### `mount(target, name, props?)`

Mount a registered component into a target element.

| Parameter | Type | Description |
| --- | --- | --- |
| `target` | `string \| Element` | CSS selector or DOM element |
| `name` | `string` | Registered component name |
| `props` | `object` | Props to pass (available as `this.props`) |

**Returns:** `Component` instance

If an existing component is mounted at `target`, it is destroyed first.

```js
const inst = $.mount('#app', 'home-page', { title: 'Welcome' });
```

### `mountAll(root?)`

Scan `root` (default: `document.body`) for any HTML elements whose tag name matches a registered component, and auto-mount them.

```html
<!-- In HTML -->
<app-counter></app-counter>
<user-card name="Tony" role="admin"></user-card>
```

```js
// After registering components
$.mountAll();
```

Attributes on the custom element tag become props. JSON-parseable values are auto-parsed.

### `getInstance(target)`

Get the component instance for a given element.

| Parameter | Type | Description |
| --- | --- | --- |
| `target` | `string \| Element` | Selector or element |

**Returns:** `Component \| null`

### `destroy(target)`

Destroy the component at the given target.

### `components()` / `getRegistry()`

Returns an object of all registered component definitions (for debugging). Available as `$.components()` on the global `$`, or as `getRegistry` when using ES module imports.

```js
console.log($.components());
// { 'home-page': { render: ..., state: ..., ... }, 'app-counter': { ... } }

// ES module equivalent:
import { getRegistry } from '@tonywied17/zero-query';
console.log(getRegistry());
```

### `style(urls)`

Dynamically load one or more **global** (unscoped) stylesheet files into `<head>`. Unlike component `styleUrl` (which scopes CSS to the component), `$.style()` injects stylesheets that apply to the entire page.

> **Recommended for global styles:** For app-wide CSS (resets, layout, themes), a `<link rel="stylesheet">` tag in your `index.html` `<head>` is the best approach — it prevents FOUC (Flash of Unstyled Content) most reliably because the browser loads it before first paint with no JavaScript needed. `$.style()` is intended for **dynamically loading additional stylesheet files** at runtime — theme switching, override files, conditional styles, etc.

Relative paths are resolved **relative to the calling file** (auto-detected via stack trace), just like component `styleUrl` and `templateUrl` paths.

| Parameter | Type | Description |
| --- | --- | --- |
| `urls` | `string \| string[]` | One or more stylesheet file URLs to load |
| `opts` | `object` | Options (optional) |
| `opts.critical` | `boolean` | Hide page until loaded to prevent FOUC (default `true`). |
| `opts.bg` | `string` | Background color while hidden during critical load (default `'#0d1117'`). |

**Returns:** `{ remove(): void, ready: Promise }` — `.remove()` to unload, `.ready` resolves when loaded.

**Behavior:**

| Detail | Description |
| --- | --- |
| **Relative paths** | Resolved against the calling module's directory (auto-detected). Absolute paths and full URLs are used as-is. |
| **Idempotent** | Duplicate URLs are ignored — calling `$.style('app.css')` twice only injects one `<link>`. |
| **DOM element** | Each stylesheet is injected as a `<link rel="stylesheet" data-zq-style>` in `<head>`. |
| **Removal** | The returned handle's `.remove()` detaches all injected `<link>` elements. |

**Examples:**

```js
// Load a stylesheet dynamically (e.g. theme switching)
const darkTheme = $.style('themes/dark.css');
// ... later
darkTheme.remove();

// Load multiple stylesheets
$.style(['reset.css', 'theme.css', 'layout.css']);

// Load an override file on top of global styles
$.style('overrides.css');

// Absolute path — resolved against origin root
$.style('/assets/global.css');
```

> **When to use `<link rel>` vs `$.style()` vs `styleUrl`:**
> - Use a **`<link rel="stylesheet">`** in `index.html` for global/app-wide styles (resets, layout, themes) — best FOUC prevention.
> - Use **`$.style()`** to dynamically load additional stylesheet files (themes, overrides, conditional styles).
> - Use **`styleUrl`** on a component definition for styles that should be **scoped** to that specific component.
> - Use component **`styles`** (inline string) for scoped inline CSS within a component definition.

---

## Router

### `router(config)`

Create and activate a client-side SPA router.

**Returns:** `Router` instance

### Router Config Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `el` | `string \| Element` | — | Outlet element where route components are rendered |
| `mode` | `'history' \| 'hash'` | `'history'` | Routing mode. Hash mode uses `#/path`. **Note:** On `file://` protocol, hash mode is always forced regardless of this setting (pushState cannot work on `file://`). |
| `base` | `string` | `''` | Base path prefix (e.g. `'/my-app'`). Stripped from path matching. **Auto-detected** from `<base href>` if not set (also checks `window.__ZQ_BASE`). |
| `routes` | `Array<RouteObject>` | `[]` | Initial route definitions |
| `fallback` | `string` | `null` | Component name to render when no route matches (404) |

```js
const router = $.router({
  el: '#app',
  mode: 'history',
  base: '/my-app',
  routes: [
    { path: '/', component: 'home-page' },
    { path: '/user/:id', component: 'user-page' },
    { path: '/lazy', load: () => import('./pages/lazy.js'), component: 'lazy-page' },
  ],
  fallback: 'not-found',
});
```

#### Using `<base href>` for Sub-Path Deployments

When deploying under a sub-directory (e.g. `https://example.com/my-app/`), add a `<base href>` tag to your HTML:

```html
<head>
  <base href="/my-app/">
</head>
```

The router picks this up automatically — no extra code needed:

```js
$.router({ el: '#app', routes, fallback: 'not-found' });
```

Detection priority: explicit `base` option → `window.__ZQ_BASE` → `<base href>` tag.

> This approach keeps all path configuration in one place and also affects how the browser resolves relative URLs for scripts, stylesheets, and fetch requests.

### Route Object

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `path` | `string` | **Yes** | URL pattern. Supports `:param` and `*` wildcard. |
| `component` | `string \| function` | **Yes** | Registered component name (auto-mounted), or `(route) => html` render function. |
| `load` | `() => Promise` | No | Async function called before mounting (for lazy-loading modules). |
| `fallback` | `string` | No | An additional path that also matches this route. When matched via fallback, missing `:param` values are `undefined`. Useful with `pages` config: `{ path: '/docs/:section', fallback: '/docs' }`. |

**Path pattern examples:**

| Pattern | Matches | Params |
| --- | --- | --- |
| `/` | Exactly `/` | — |
| `/user/:id` | `/user/42`, `/user/abc` | `{ id: '42' }` |
| `/post/:id/comment/:cid` | `/post/1/comment/5` | `{ id: '1', cid: '5' }` |
| `/files/*` | `/files/a/b/c` | Captured by wildcard group |

### Router Instance Methods

| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `navigate` | `navigate(path, options?)` | `this` | Push new state and resolve route. `options.state` passed to `pushState`. |
| `replace` | `replace(path, options?)` | `this` | Replace current state (no new history entry). |
| `back` | `back()` | `this` | `history.back()` |
| `forward` | `forward()` | `this` | `history.forward()` |
| `go` | `go(n)` | `this` | `history.go(n)` |
| `add` | `add(route)` | `this` | Add a route dynamically. Chainable. |
| `remove` | `remove(path)` | `this` | Remove route by path. |
| `beforeEach` | `beforeEach(fn)` | `this` | Add navigation guard. `fn(to, from)` — return `false` to cancel, `string` to redirect. |
| `afterEach` | `afterEach(fn)` | `this` | Add post-navigation guard. |
| `onChange` | `onChange(fn)` | `() => void` | Subscribe to route changes. Returns unsubscribe. `fn(to, from)`. |
| `resolve` | `resolve(path)` | `string` | Resolve an app-relative path to a full URL path (including base). Useful for programmatic link generation. |
| `destroy` | `destroy()` | — | Teardown router and mounted component. |

### Router Properties

| Property | Type | Description |
| --- | --- | --- |
| `current` | `object \| null` | `{ route, params, query, path }` for the current route. |
| `path` | `string` | Current path (with `base` stripped in history mode). |
| `query` | `object` | Parsed query string as object. |
| `base` | `string` | The resolved base path (from config, `window.__ZQ_BASE`, or `<base href>`). |

### Navigation Context

The `to` and `from` objects passed to guards and `onChange`:

```js
{
  route: { path, component, ... },  // matched route definition
  params: { id: '42' },             // parsed :param values
  query: { tab: 'settings' },       // parsed query string
  path: '/user/42',                  // matched path
}
```

**Routed component props:** When a component is mounted by the router, it receives:
- `this.props.$route` — the full route context
- `this.props.$params` — route params
- `this.props.$query` — query params
- Plus all route params individually (e.g. `this.props.id`)

### `z-link` — Navigation Links

Use the `z-link` attribute on `<a>` tags for SPA navigation. Clicks are intercepted and handled by the router (no page reload).

```html
<a z-link="/">Home</a>
<a z-link="/user/42">Profile</a>
<a z-link="/search?q=zQuery">Search</a>
```

### `getRouter()`

Get the currently active router instance.

```js
const router = $.getRouter();
router.navigate('/settings');
```

---

## Store

### `store(config)` / `store(name, config)`

Create a new global reactive store.

| Parameter | Type | Description |
| --- | --- | --- |
| `name` | `string` | Optional store name (default: `'default'`). Use for multiple stores. |
| `config` | `object` | Store configuration (see below). |

**Returns:** `Store` instance

### Store Config Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `state` | `object \| () => object` | `{}` | Initial state. Function form creates a fresh copy. |
| `actions` | `{ [name]: (state, ...args) => void }` | `{}` | Named functions that mutate state. First arg is always reactive `state`. |
| `getters` | `{ [name]: (state) => any }` | `{}` | Computed properties derived from state. Accessed as `store.getters.name`. |
| `debug` | `boolean` | `false` | Log dispatched actions to console. |

```js
const store = $.store({
  state: {
    items: [],
    filter: 'all',
  },
  actions: {
    addItem(state, item) {
      const raw = state.items.__raw || state.items;
      state.items = [...raw, item];
    },
    setFilter(state, filter) {
      state.filter = filter;
    },
  },
  getters: {
    filteredItems: (state) => {
      if (state.filter === 'all') return state.items;
      return state.items.filter(i => i.status === state.filter);
    },
    count: (state) => state.items.length,
  },
  debug: true,
});
```

> **Tip — Working with reactive arrays:** When replacing an array in state (push, splice equivalents), access the raw array first with `state.arrayKey.__raw || state.arrayKey`, then create a new array and assign it. This ensures the proxy triggers change detection.

### Store Instance Methods

| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `dispatch` | `dispatch(name, ...args)` | `any` | Execute a named action. Runs middleware first. Returns action's return value. |
| `subscribe` | `subscribe(key, fn)` | `() => void` | Listen to changes on a specific state key. `fn(value, oldValue, key)`. Returns unsubscribe. |
| `subscribe` | `subscribe(fn)` | `() => void` | Wildcard — listen to all state changes. `fn(key, value, oldValue)`. |
| `snapshot` | `snapshot()` | `object` | Deep clone of current state (plain object). |
| `replaceState` | `replaceState(newState)` | — | Replace entire state (clears old keys, merges new). |
| `use` | `use(fn)` | `this` | Add middleware. `fn(actionName, args, state)` — return `false` to block action. Chainable. |
| `reset` | `reset(initialState)` | — | Replace state and clear action history. |

### Store Properties

| Property | Type | Description |
| --- | --- | --- |
| `state` | `Proxy` | Reactive state proxy. Read/write triggers subscriptions. |
| `state.__raw` | `object` | Raw unwrapped state. |
| `getters` | `object` | Computed getters (lazily evaluated on access). |
| `history` | `Array<{ action, args, timestamp }>` | Log of all dispatched actions (read-only copy). |

### `getStore(name?)`

Retrieve a previously created store by name. Defaults to `'default'`.

```js
const store = $.getStore();        // default store
const users = $.getStore('users'); // named store
```

---

## HTTP Client

### Request Methods

All request methods return `Promise<ResponseObject>`.

| Method | Signature | Description |
| --- | --- | --- |
| `$.get` | `$.get(url, params?, opts?)` | GET request. `params` object appended as query string. |
| `$.post` | `$.post(url, data?, opts?)` | POST request. `data` sent as JSON body. |
| `$.put` | `$.put(url, data?, opts?)` | PUT request. |
| `$.patch` | `$.patch(url, data?, opts?)` | PATCH request. |
| `$.delete` | `$.delete(url, data?, opts?)` | DELETE request. |

Also available as `$.http.get(...)`, `$.http.post(...)`, etc.

**`opts` (per-request options):**

| Key | Type | Description |
| --- | --- | --- |
| `headers` | `object` | Additional headers (merged with defaults). |
| `timeout` | `number` | Override default timeout (ms). |
| `signal` | `AbortSignal` | Abort signal for cancellation. |
| `...` | — | Any other valid `fetch` options (e.g. `mode`, `credentials`). |

```js
// GET with query params
const { data } = await $.get('/api/users', { role: 'admin', page: 1 });

// POST JSON
const { data: user } = await $.post('/api/users', {
  name: 'Tony',
  email: 'tony@example.com'
});

// Upload FormData (Content-Type auto-removed for multipart boundary)
const fd = new FormData();
fd.append('avatar', file);
await $.post('/api/upload', fd);

// With per-request options
await $.get('/api/data', null, {
  headers: { 'Accept-Language': 'en' },
  timeout: 5000,
  credentials: 'include',
});
```

### `http.configure(options)`

Update default configuration for all subsequent requests.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `baseURL` | `string` | `''` | Prepended to non-absolute URLs. |
| `headers` | `object` | `{ 'Content-Type': 'application/json' }` | Default headers (merged, not replaced). |
| `timeout` | `number` | `30000` | Default timeout in ms. Set `0` to disable. |

```js
$.http.configure({
  baseURL: 'https://api.example.com/v2',
  headers: { Authorization: 'Bearer abc123' },
  timeout: 10000,
});
```

### Interceptors

#### `http.onRequest(fn)`

Add a request interceptor. Called before every request.

```js
$.http.onRequest(async (fetchOpts, url) => {
  // Add auth header
  fetchOpts.headers['Authorization'] = 'Bearer ' + getToken();

  // Return false to cancel the request
  if (!navigator.onLine) return false;

  // Return { url, options } to modify
  return {
    url: url + '?ts=' + Date.now(),
    options: fetchOpts,
  };
});
```

#### `http.onResponse(fn)`

Add a response interceptor. Called after every successful response (before error check).

```js
$.http.onResponse(async (result) => {
  // result: { ok, status, statusText, headers, data, response }
  if (result.status === 401) {
    await refreshToken();
  }
});
```

### `http.createAbort()`

Create a new `AbortController` for manual request cancellation.

```js
const controller = $.http.createAbort();
$.get('/api/slow', null, { signal: controller.signal });
controller.abort();  // cancels the request
```

### `http.raw(url, opts)`

Direct passthrough to native `fetch()` — no JSON handling, no interceptors, no timeout wrapper.

```js
const response = await $.http.raw('/api/stream');
```

### Response Object

Resolved by all request methods (except `raw`):

| Property | Type | Description |
| --- | --- | --- |
| `ok` | `boolean` | `true` if status 200-299 |
| `status` | `number` | HTTP status code |
| `statusText` | `string` | HTTP status text |
| `headers` | `object` | Response headers as plain object |
| `data` | `any` | Auto-parsed body (JSON object, text string, or Blob) |
| `response` | `Response` | Raw fetch `Response` object |

**Error handling:** Non-2xx responses throw an `Error` with a `.response` property containing the full response object.

```js
try {
  const res = await $.get('/api/data');
  console.log(res.data);
} catch (err) {
  console.error(err.response?.status);  // 404, 500, etc.
  console.error(err.response?.data);    // error body
}
```

**Content type handling:**
- `application/json` → `JSON.parse`
- `text/*` → plain text string
- `application/octet-stream`, `image/*` → `Blob`
- Other → tries JSON parse, falls back to text

---

## Utilities

### Function Utilities

#### `$.debounce(fn, ms?)`

Returns a debounced function that delays execution until `ms` milliseconds of inactivity.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `fn` | `function` | — | Function to debounce |
| `ms` | `number` | `250` | Delay in milliseconds |

**Returns:** Debounced function with `.cancel()` method.

```js
const search = $.debounce((q) => fetchResults(q), 300);
input.addEventListener('input', (e) => search(e.target.value));
search.cancel();  // cancel pending invocation
```

#### `$.throttle(fn, ms?)`

Returns a throttled function that executes at most once per `ms` milliseconds.

```js
const scroll = $.throttle(() => updateScrollPosition(), 100);
window.addEventListener('scroll', scroll);
```

#### `$.pipe(...fns)`

Left-to-right function composition. Each function receives the return value of the previous one. Functions can change the type along the pipeline.

```js
const process = $.pipe(
  str => str.trim(),
  str => str.toLowerCase(),
  str => str.replace(/\s+/g, '-'),
);
process('  Hello World  ');  // 'hello-world'

// Type-changing pipeline:
const toLength = $.pipe(
  (s) => s.trim(),           // string → string
  (s) => s.split(','),       // string → string[]
  (arr) => arr.length,       // string[] → number
);
toLength('a, b, c');  // 3
```

#### `$.once(fn)`

Returns a function that only executes once, returning the cached result on subsequent calls.

```js
const loadConfig = $.once(async () => await fetch('/config.json'));
await loadConfig();  // fetches
await loadConfig();  // returns cached result
```

#### `$.sleep(ms)`

Returns a Promise that resolves after `ms` milliseconds.

```js
await $.sleep(1000);  // wait 1 second
```

### String Utilities

#### `$.escapeHtml(str)`

Escape HTML entities: `&`, `<`, `>`, `"`, `'`.

```js
$.escapeHtml('<script>alert("xss")</script>');
// '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
```

#### `` $.html`template` ``

Tagged template literal that auto-escapes interpolated values:

```js
const name = '<b>Tony</b>';
const safe = $.html`<div>Hello, ${name}!</div>`;
// '<div>Hello, &lt;b&gt;Tony&lt;/b&gt;!</div>'
```

#### `$.trust(htmlStr)`

Wrap an HTML string as trusted — it will not be escaped when used inside `$.html`:

```js
const bold = $.trust('<strong>Bold</strong>');
const output = $.html`<p>${bold}</p>`;
// '<p><strong>Bold</strong></p>'
```

#### `$.uuid()`

Generate a UUID v4 string. Uses `crypto.randomUUID()` when available, otherwise falls back to Math.random.

```js
$.uuid();  // 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
```

#### `$.camelCase(str)` / `$.kebabCase(str)`

```js
$.camelCase('my-component');  // 'myComponent'
$.kebabCase('myComponent');   // 'my-component'
```

### Object Utilities

#### `$.deepClone(obj)`

Deep clone using `structuredClone` (with JSON fallback).

```js
const clone = $.deepClone({ nested: { array: [1, 2, 3] } });
```

#### `$.deepMerge(target, ...sources)`

Recursively merge objects. Arrays are replaced, not merged.

```js
const config = $.deepMerge({}, defaults, userConfig);
```

#### `$.isEqual(a, b)`

Deep equality comparison.

```js
$.isEqual({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } });  // true
$.isEqual([1, 2], [1, 2]);  // true
```

### URL Utilities

#### `$.param(obj)`

Serialize an object to URL query string.

```js
$.param({ page: 1, sort: 'name', q: 'hello world' });
// 'page=1&sort=name&q=hello+world'
```

#### `$.parseQuery(str)`

Parse a URL query string into an object.

```js
$.parseQuery('page=1&sort=name');
// { page: '1', sort: 'name' }
```

### Storage Wrappers

#### `$.storage` — localStorage

| Method | Signature | Description |
| --- | --- | --- |
| `get` | `get(key, fallback?)` | Get and JSON.parse. Returns `fallback` on missing/error. |
| `set` | `set(key, value)` | JSON.stringify and store. |
| `remove` | `remove(key)` | Remove key. |
| `clear` | `clear()` | Clear all localStorage. |

```js
$.storage.set('prefs', { theme: 'dark', lang: 'en' });
$.storage.get('prefs');           // { theme: 'dark', lang: 'en' }
$.storage.get('missing', null);   // null
$.storage.remove('prefs');
$.storage.clear();
```

#### `$.session` — sessionStorage

Same API as `$.storage`, backed by `sessionStorage`.

### Event Bus

#### `$.bus`

Singleton EventBus instance for cross-component communication.

| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `on` | `on(event, fn)` | `() => void` | Subscribe. Returns unsubscribe function. |
| `off` | `off(event, fn)` | — | Unsubscribe specific handler. |
| `emit` | `emit(event, ...args)` | — | Emit event with arguments. |
| `once` | `once(event, fn)` | `() => void` | Subscribe for one invocation. |
| `clear` | `clear()` | — | Remove all listeners. |

```js
// Cross-component communication
// In component A:
$.bus.emit('cart:updated', { count: 3 });

// In component B:
$.bus.on('cart:updated', (data) => {
  console.log('Cart has', data.count, 'items');
});
```

---

## Error Handling

zQuery includes a structured error-handling system so that runtime errors across every subsystem (reactive, component, router, store, HTTP, expression parser) are reported consistently. All internal errors are wrapped in a `ZQueryError` with a machine-readable code, a human-readable message, optional context, and the original cause.

### Error Codes — `$.ErrorCode`

A frozen object mapping friendly names to string codes. Use these to identify errors programmatically.

| Constant | Code | Subsystem |
| --- | --- | --- |
| `REACTIVE_CALLBACK` | `ZQ_REACTIVE_CALLBACK` | Reactive proxy/onChange |
| `SIGNAL_CALLBACK` | `ZQ_SIGNAL_CALLBACK` | Signal subscriber |
| `EFFECT_EXEC` | `ZQ_EFFECT_EXEC` | Effect execution |
| `EXPR_PARSE` | `ZQ_EXPR_PARSE` | Expression parser |
| `EXPR_EVAL` | `ZQ_EXPR_EVAL` | Expression evaluation |
| `EXPR_UNSAFE_ACCESS` | `ZQ_EXPR_UNSAFE_ACCESS` | Expression sandbox |
| `COMP_INVALID_NAME` | `ZQ_COMP_INVALID_NAME` | Component registration |
| `COMP_NOT_FOUND` | `ZQ_COMP_NOT_FOUND` | Component lookup |
| `COMP_MOUNT_TARGET` | `ZQ_COMP_MOUNT_TARGET` | Component mount target |
| `COMP_RENDER` | `ZQ_COMP_RENDER` | Component render |
| `COMP_LIFECYCLE` | `ZQ_COMP_LIFECYCLE` | Component lifecycle hook |
| `COMP_RESOURCE` | `ZQ_COMP_RESOURCE` | Component resource loading |
| `COMP_DIRECTIVE` | `ZQ_COMP_DIRECTIVE` | Directive processing |
| `ROUTER_LOAD` | `ZQ_ROUTER_LOAD` | Route page loading |
| `ROUTER_GUARD` | `ZQ_ROUTER_GUARD` | Navigation guard |
| `ROUTER_RESOLVE` | `ZQ_ROUTER_RESOLVE` | Route resolution |
| `STORE_ACTION` | `ZQ_STORE_ACTION` | Store action |
| `STORE_MIDDLEWARE` | `ZQ_STORE_MIDDLEWARE` | Store middleware |
| `STORE_SUBSCRIBE` | `ZQ_STORE_SUBSCRIBE` | Store subscriber |
| `HTTP_REQUEST` | `ZQ_HTTP_REQUEST` | HTTP request |
| `HTTP_TIMEOUT` | `ZQ_HTTP_TIMEOUT` | HTTP timeout |
| `HTTP_INTERCEPTOR` | `ZQ_HTTP_INTERCEPTOR` | HTTP interceptor |
| `HTTP_PARSE` | `ZQ_HTTP_PARSE` | HTTP response parsing |
| `INVALID_ARGUMENT` | `ZQ_INVALID_ARGUMENT` | General validation |

### `ZQueryError`

Custom `Error` subclass used by all internal error reports.

| Property | Type | Description |
| --- | --- | --- |
| `name` | `string` | Always `'ZQueryError'`. |
| `code` | `string` | One of the `$.ErrorCode` values. |
| `message` | `string` | Human-readable description. |
| `context` | `object` | Extra data — component name, expression string, etc. |
| `cause` | `Error?` | Original error (if wrapping another). |

```js
try {
  $.mount('#app', 'missing-component');
} catch (err) {
  if (err instanceof $.ZQueryError) {
    console.log(err.code);    // 'ZQ_COMP_NOT_FOUND'
    console.log(err.context); // { name: 'missing-component' }
  }
}
```

### `$.onError(handler)`

Register a global error handler that fires when any module catches an error internally. Useful for centralized logging, crash reporting, or dev-overlay integration. Pass `null` to remove.

```js
$.onError((err) => {
  console.warn(`[${err.code}]`, err.message, err.context);
  myErrorTracker.captureException(err);
});
```

### `reportError(code, message, context?, cause?)`

Report an error through the global handler **and** `console.error` without throwing. Used internally for recoverable errors in callbacks, lifecycle hooks, etc.

```js
import { reportError, ErrorCode } from '@tonywied17/zero-query';

reportError(ErrorCode.COMP_RENDER, 'Failed to render widget', { name: 'my-widget' }, originalError);
```

### `guardCallback(fn, code, context?)`

Wrap a function so thrown errors are caught, routed through `reportError`, and don't crash the current call stack. Returns a safe wrapper function.

```js
import { guardCallback, ErrorCode } from '@tonywied17/zero-query';

const safeTick = guardCallback(myTickFn, ErrorCode.EFFECT_EXEC, { label: 'animation' });
safeTick(); // errors are caught & reported, never thrown
```

### `validate(value, name, expectedType?)`

Assert a value is non-null and optionally the expected type. Throws `ZQueryError` with `INVALID_ARGUMENT` on failure — intended for fast-fail at API boundaries.

```js
import { validate } from '@tonywied17/zero-query';

validate(name, 'name', 'string');   // throws if name isn't a string
validate(el, 'target');             // throws if el is null/undefined
```

---

## Global API

| Property/Method | Description |
| --- | --- |
| `$.style(urls)` | Dynamically load additional global (unscoped) stylesheet file(s) into `<head>`. Paths resolve relative to the calling file. Returns `{ remove(), ready }`. |
| `$.morph(el, html)` | DOM morphing engine — patch existing DOM to match new HTML without destroying unchanged nodes. See [z-key](#z-key--keyed-reconciliation). |
| `$.safeEval(expr, scope)` | CSP-safe expression evaluator — parse and evaluate a JavaScript-like expression without `eval()` or `new Function()`. |
| `$.version` | Library version string (e.g. `'0.6.1'`). |
| `$.meta` | Build metadata object — populated at build time by the CLI bundler. Empty `{}` by default. |
| `$.noConflict()` | Remove `$` from `window`, return the library object. |
| `window.$` | Global reference (auto-set in browser). |
| `window.zQuery` | Global alias (auto-set in browser). |

---

## Server-Side Rendering (SSR)

zQuery includes a lightweight SSR module for rendering components to HTML strings in Node.js. Import from `src/ssr.js`.

### `createSSRApp()`

Create an SSR application instance.

```js
import { createSSRApp, renderToString } from '@tonywied17/zero-query';

const app = createSSRApp();

app.component('hello-world', {
  state: () => ({ name: 'World' }),
  render() {
    return `<h1>Hello, ${this.state.name}!</h1>`;
  }
});
```

### `renderToString(app, name, props?)`

Render a registered component to an HTML string.

```js
const html = await renderToString(app, 'hello-world', { name: 'Tony' });
// '<hello-world data-zq-ssr><h1>Hello, Tony!</h1></hello-world>'
```

### `app.renderPage(name, options?)`

Render a full HTML page with the component embedded.

```js
const page = await app.renderPage('hello-world', {
  title: 'My App',
  lang: 'en',
  styles: ['styles/global.css'],
  scripts: ['scripts/app.js'],
});
```

| Detail | Description |
| --- | --- |
| Hydration | Components rendered with SSR include a `data-zq-ssr` attribute for client-side hydration identification. |
| State | Initial state and props are serialized into the output for client-side pickup. |
| Scope | SSR uses its own component registry — call `app.component()` to register components for server rendering. |

---

## ES Module Exports (for npm/bundler usage)

When used as an ES module (not the built bundle), the library exports:

```js
import {
  $, zQuery, ZQueryCollection, queryAll,
  reactive, signal, computed, effect,
  component, mount, mountAll, getInstance, destroy, getRegistry, style,
  morph, safeEval,
  createRouter, getRouter,
  createStore, getStore,
  createSSRApp, renderToString,
  http,
  ZQueryError, ErrorCode, onError, reportError,
  debounce, throttle, pipe, once, sleep,
  escapeHtml, html, trust, uuid, camelCase, kebabCase,
  deepClone, deepMerge, isEqual, param, parseQuery,
  storage, session, bus,
} from '@tonywied17/zero-query';
```


