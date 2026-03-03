# zQuery (zeroQuery) — Full API Reference

Complete API documentation for every module, method, option, and type in zQuery. All examples assume the global `$` is available via the built `zQuery.min.js` bundle (the recommended ES module setup). If using the optional [CLI Bundler](#cli-bundler), the same API is available — the bundler simply concatenates your ES modules into a single file.

---

## Table of Contents

- [Selectors & DOM — Selector & Collection](#selectors--dom--selector--collection)
  - [$() Single-Element Selector](#--single-element-selector)
  - [$.all() Collection Selector](#all--collection-selector)
  - [ZQueryCollection Methods](#ZQueryCollection-methods)
  - [Quick-Ref Shortcuts](#quick-ref-shortcuts)
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
  - [External Templates & Styles](#external-templates--styles)
  - [Pages Config](#pages-config)
  - [Directives](#directives)
  - [$.mount()](#mounttarget-name-props)
  - [$.mountAll()](#mountallroot)
  - [$.getInstance()](#getinstancetarget)
  - [$.destroy()](#destroytarget)
  - [$.components()](#components)
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
- [Global API](#global-api)

---

## Selectors & DOM — Selector & Collection

### `$()` — Single-Element Selector

```js
$(selector, context?)
```

| Parameter | Type | Description |
| --- | --- | --- |
| `selector` | `string \| Element \| NodeList \| HTMLCollection \| Array \| Function` | CSS selector, HTML string, DOM node(s), or DOM-ready callback |
| `context` | `string \| Element` | Optional root to scope the query |

**Returns:** `Element | null` (except when `selector` is a function — then returns `undefined` and registers a DOM-ready handler).

**Behavior by input type:**

| Input | Result |
| --- | --- |
| `$('.card')` | First `.card` element via `querySelector` |
| `$('<div>HTML</div>')` | Create element from HTML string (first node) |
| `$(element)` | Return the element as-is |
| `$(nodeList)` | First element from the NodeList |
| `$([el1, el2])` | First element from the array |
| `$(function)` | Register DOMContentLoaded handler |
| `$(null)` / `$(undefined)` | `null` |
| `$(window)` | Window object |
| `$('li', '#myList')` | First `li` within `#myList` |

---

### `$.all()` — Collection Selector

```js
$.all(selector, context?)
```

| Parameter | Type | Description |
| --- | --- | --- |
| `selector` | `string \| Element \| NodeList \| HTMLCollection \| Array` | CSS selector, HTML string, or DOM node(s) |
| `context` | `string \| Element` | Optional root to scope the query |

**Returns:** `ZQueryCollection` — a chainable wrapper around an array of elements.

**Behavior by input type:**

| Input | Result |
| --- | --- |
| `$.all('.card')` | All `.card` elements via `querySelectorAll` |
| `$.all('<div>HTML</div>')` | Create elements from HTML string |
| `$.all(element)` | Wrap a single DOM element in a collection |
| `$.all(nodeList)` | Wrap a NodeList or HTMLCollection |
| `$.all([el1, el2])` | Wrap an array of elements |
| `$.all(null)` | Empty collection |

---

### ZQueryCollection Methods

#### Iteration

| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `each` | `each(fn(index, element))` | `this` | Iterate elements. `this` inside callback is the element. |
| `map` | `map(fn(index, element))` | `Array` | Map over elements, returns plain array. |
| `first` | `first()` | `Element \| null` | First raw element. |
| `last` | `last()` | `Element \| null` | Last raw element. |
| `eq` | `eq(index)` | `ZQueryCollection` | New collection with element at index. |
| `toArray` | `toArray()` | `Array<Element>` | Convert to plain array. |

Collection is iterable — works with `for...of` and spread `[...$.all('.items')]`.

```js
$.all('.card').each((i, el) => {
  console.log(i, el.textContent);
});

const texts = $.all('.card').map((i, el) => el.textContent);
```

#### Traversal

| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `find` | `find(selector)` | `ZQueryCollection` | Descendants matching selector. |
| `parent` | `parent()` | `ZQueryCollection` | Unique parent elements. |
| `closest` | `closest(selector)` | `ZQueryCollection` | Nearest ancestor matching selector. |
| `children` | `children(selector?)` | `ZQueryCollection` | Direct children, optionally filtered. |
| `siblings` | `siblings()` | `ZQueryCollection` | All sibling elements. |
| `next` | `next()` | `ZQueryCollection` | Next sibling of each element. |
| `prev` | `prev()` | `ZQueryCollection` | Previous sibling of each element. |

```js
$.all('#nav').find('a')           // all <a> inside #nav
$.all('.item').parent()           // parent of each .item
$.all('.child').closest('.card')  // nearest .card ancestor
$.all('#list').children('li')     // direct <li> children
$.all('.active').siblings()       // all siblings of .active
$.all('.item').next()             // next sibling
$.all('.item').prev()             // previous sibling
```

#### Filtering

| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `filter` | `filter(selector \| fn)` | `ZQueryCollection` | Keep matching elements. |
| `not` | `not(selector \| fn)` | `ZQueryCollection` | Remove matching elements. |
| `has` | `has(selector)` | `ZQueryCollection` | Keep elements that have a descendant matching selector. |

```js
$.all('.item').filter('.active')            // only .active items
$.all('.item').filter(el => el.id)          // only items with an id
$.all('.item').not('.disabled')             // exclude disabled
$.all('.card').has('.badge')                // cards that contain a .badge
```

#### Classes

| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `addClass` | `addClass(...names)` | `this` | Add one or more classes. Space-separated strings supported. |
| `removeClass` | `removeClass(...names)` | `this` | Remove classes. |
| `toggleClass` | `toggleClass(name, force?)` | `this` | Toggle a class. Optional `force` boolean. |
| `hasClass` | `hasClass(name)` | `boolean` | Check if first element has class. |

```js
$.all('.card').addClass('active highlight');
$.all('.card').removeClass('pending');
$.all('.card').toggleClass('open');
$.all('.card').toggleClass('visible', true);  // force add
$.all('.card').hasClass('active');            // true/false
```

#### Attributes & Properties

| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `attr` | `attr(name)` | `string \| null` | Get attribute of first element. |
| `attr` | `attr(name, value)` | `this` | Set attribute on all elements. |
| `removeAttr` | `removeAttr(name)` | `this` | Remove attribute from all elements. |
| `prop` | `prop(name)` | `any` | Get JS property of first element. |
| `prop` | `prop(name, value)` | `this` | Set JS property on all elements. |
| `data` | `data(key?)` | `any \| DOMStringMap` | Get data attribute (with JSON parse). No key returns full dataset. |
| `data` | `data(key, value)` | `this` | Set data attribute. Objects are JSON-stringified. |

```js
$.all('img').attr('src');                         // get
$.all('img').attr('alt', 'Photo');                // set
$.all('a').removeAttr('target');
$.all('input').prop('disabled');                  // get boolean property
$.all('input').prop('disabled', true);            // set
$.all('.card').data('config');                    // reads data-config, parses JSON
$.all('.card').data('config', { theme: 'dark' }); // sets data-config='{"theme":"dark"}'
$.all('.card').data();                            // returns full dataset object
```

#### CSS & Dimensions

| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `css` | `css(property)` | `string` | Get computed style of first element. |
| `css` | `css({ prop: value, ... })` | `this` | Set inline styles on all elements. |
| `width` | `width()` | `number` | First element's width (from `getBoundingClientRect`). |
| `height` | `height()` | `number` | First element's height. |
| `offset` | `offset()` | `{ top, left, width, height }` | Position relative to document. |
| `position` | `position()` | `{ top, left }` | Position relative to offset parent. |

```js
$.all('.box').css('background-color');              // get
$.all('.box').css({ background: '#333', padding: '1rem' });  // set
$.all('.box').width();    // 320
$.all('.box').height();   // 200
$.all('.box').offset();   // { top: 100, left: 50, width: 320, height: 200 }
$.all('.box').position(); // { top: 10, left: 10 }
```

#### Content

| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `html` | `html()` | `string` | Get innerHTML of first element. |
| `html` | `html(content)` | `this` | Set innerHTML on all elements. |
| `text` | `text()` | `string` | Get textContent of first element. |
| `text` | `text(content)` | `this` | Set textContent on all elements. |
| `val` | `val()` | `string` | Get value of first input/select/textarea. |
| `val` | `val(value)` | `this` | Set value on all inputs. |

```js
$.all('.card').html();                    // get innerHTML
$.all('.card').html('<p>New content</p>');  // set innerHTML
$.all('.card').text();                    // get textContent
$.all('.card').text('Plain text');         // set textContent
$.all('input').val();                     // get value
$.all('input').val('Hello');              // set value
```

#### DOM Manipulation

| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `append` | `append(content)` | `this` | Insert HTML string, Node, or Collection at end. |
| `prepend` | `prepend(content)` | `this` | Insert at beginning. |
| `after` | `after(content)` | `this` | Insert after each element. |
| `before` | `before(content)` | `this` | Insert before each element. |
| `wrap` | `wrap(wrapper)` | `this` | Wrap each element with HTML string or Node. |
| `remove` | `remove()` | `this` | Remove all elements from DOM. |
| `empty` | `empty()` | `this` | Clear innerHTML of all elements. |
| `clone` | `clone(deep?)` | `ZQueryCollection` | Clone elements (default: `deep = true`). |
| `replaceWith` | `replaceWith(content)` | `this` | Replace elements with new content. |

```js
$.all('#list').append('<li>New item</li>');
$.all('#list').prepend('<li>First item</li>');
$.all('.item').after('<div class="separator"></div>');
$.all('.item').before('<div class="header"></div>');
$.all('.card').wrap('<div class="wrapper"></div>');
$.all('.temp').remove();
$.all('#container').empty();
const copy = $.all('.card').clone();
$.all('.old').replaceWith('<div class="new">Replaced</div>');
```

#### Visibility

| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `show` | `show(display?)` | `this` | Show elements. Optional display value (default: `''`). |
| `hide` | `hide()` | `this` | Set `display: none`. |
| `toggle` | `toggle(display?)` | `this` | Toggle visibility. |

```js
$.all('.panel').show();
$.all('.panel').show('flex');  // show as flex
$.all('.panel').hide();
$.all('.panel').toggle();
```

#### Events

| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `on` | `on(events, handler)` | `this` | Attach event handler. Space-separated events supported. |
| `on` | `on(events, selector, handler)` | `this` | Delegated event handler. |
| `off` | `off(events, handler)` | `this` | Remove event handler. |
| `one` | `one(event, handler)` | `this` | One-time event handler. |
| `trigger` | `trigger(event, detail?)` | `this` | Dispatch CustomEvent with optional detail. Bubbles by default. |
| `click` | `click(fn?)` | `this` | Attach click handler or trigger click. |
| `submit` | `submit(fn?)` | `this` | Attach submit handler or trigger submit. |
| `focus` | `focus()` | `this` | Focus first element. |
| `blur` | `blur()` | `this` | Blur first element. |

```js
// Direct
$.all('.btn').on('click', (e) => { /* ... */ });

// Multiple events
$.all('.input').on('focus blur', (e) => { /* ... */ });

// Delegated
$.all('#list').on('click', '.item', function(e) {
  // 'this' is the matched .item element
});

// One-time
$.all('.btn').one('click', () => alert('Once!'));

// Custom event
$.all('.widget').trigger('refresh', { force: true });
$.all('.widget').on('refresh', (e) => console.log(e.detail.force));

// Shorthand
$.all('.btn').click(() => console.log('clicked'));
$.all('.btn').click();  // trigger
```

#### Animation

| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `animate` | `animate(props, duration?, easing?)` | `Promise<ZQueryCollection>` | CSS transition animation. |
| `fadeIn` | `fadeIn(duration?)` | `Promise<ZQueryCollection>` | Fade in (opacity 0→1). Default 300ms. |
| `fadeOut` | `fadeOut(duration?)` | `Promise<ZQueryCollection>` | Fade out (opacity 1→0) then hide. Default 300ms. |
| `slideToggle` | `slideToggle(duration?)` | `this` | Toggle height with slide animation. Default 300ms. |

```js
// Custom animation
await $.all('.card').animate({ opacity: '0', transform: 'translateY(-20px)' }, 500, 'ease-out');

// Fade
await $.all('.overlay').fadeIn(400);
await $.all('.overlay').fadeOut(400);

// Slide toggle
$.all('.panel').slideToggle(300);
```

#### Form Helpers

| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `serialize` | `serialize()` | `string` | URL-encoded form data string. |
| `serializeObject` | `serializeObject()` | `object` | Form data as key/value object. Handles duplicate keys as arrays. |

```js
$.all('#myForm').serialize();        // "name=Tony&email=tony%40x.com"
$.all('#myForm').serializeObject();  // { name: 'Tony', email: 'tony@x.com' }
```

---

### Quick-Ref Shortcuts

| Method | Signature | Returns | Description |
| --- | --- | --- | --- |
| `$.id` | `$.id(id)` | `Element \| null` | `document.getElementById(id)` |
| `$.class` | `$.class(name)` | `Element \| null` | `document.querySelector('.name')` |
| `$.classes` | `$.classes(name)` | `Array<Element>` | `document.getElementsByClassName(name)` as array |
| `$.tag` | `$.tag(name)` | `Array<Element>` | `document.getElementsByTagName(name)` as array |
| `$.children` | `$.children(parentId)` | `Array<Element>` | Children of `#parentId` as array |

---

### Static Helpers

#### `$.create(tag, attrs, ...children)`

Create a DOM element with attributes and children.

| Parameter | Type | Description |
| --- | --- | --- |
| `tag` | `string` | HTML tag name |
| `attrs` | `object` | Attributes object |
| `children` | `string \| Node` | Text nodes or DOM elements to append |

**Special `attrs` keys:**
- `class` — sets `className`
- `style` (object) — merges into `el.style`
- `on*` (function) — adds event listener (e.g. `onclick`, `onmouseenter`)
- `data` (object) — sets `dataset` keys

```js
const card = $.create('div', {
  class: 'card active',
  style: { padding: '1rem', background: '#161b22' },
  onclick: (e) => console.log('clicked'),
  data: { id: '42', type: 'user' }
}, 'Card Content');
```

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

#### `$.fn`

Alias for `ZQueryCollection.prototype` — extend to add custom methods to all collections.

```js
$.fn.disable = function() {
  return this.prop('disabled', true).addClass('disabled');
};

$.all('button.submit').disable();
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
| `pages` | `object` | No | Declarative multi-page config. Auto-generates `templateUrl` map and exposes `this.pages`, `this.activePage`, `this.templates`. See [Pages Config](#pages-config). |
| `base` | `string` | No | Optional override for the base path used to resolve relative `templateUrl`, `styleUrl`, and `pages.dir` paths. By default, paths resolve relative to the component file automatically — you only need `base` if you want to point somewhere else (e.g. `base: 'scripts/shared/'`). |
| `init` | `() => void` | No | Called before first render (during construction). |
| `mounted` | `() => void` | No | Called once after first render and DOM insertion. |
| `updated` | `() => void` | No | Called after every subsequent re-render. |
| `destroyed` | `() => void` | No | Called when the component is destroyed. Clean up subscriptions here. |
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
| `this.templates` | `object` | Keyed map of loaded templates (when using multi-`templateUrl` or `pages`). |
| `this.pages` | `Array<{id, label}>` | Normalized page metadata (when using `pages` config). |
| `this.activePage` | `string` | Active page id derived from route param (when using `pages` config). |
| `this.setState(partial)` | `(object) => void` | Merge partial state (triggers re-render). |
| `this.emit(name, detail)` | `(string, any) => void` | Dispatch a bubbling CustomEvent from the component root. |
| `this.destroy()` | `() => void` | Teardown: removes listeners, scoped styles, clears DOM. |
| `this._scheduleUpdate()` | `() => void` | Manually queue a re-render (microtask batched). Useful for store subscriptions. |

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

The `pages` option is a high-level shorthand for components that load and display multiple HTML pages from a directory. It auto-generates the `templateUrl` object map, normalizes page metadata, and derives the active page from a route parameter.

```js
// File: scripts/components/docs/docs.js
$.component('docs-page', {
  pages: {
    dir:     'pages',                  // → scripts/components/docs/pages/
    param:   'section',                // reads :section from the route
    default: 'getting-started',
    items: [
      'getting-started',
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
2. **Auto-generates `templateUrl`** — Creates `{ id: 'dir/id.ext', … }` for each item (only if `templateUrl` is not already set).
3. **Exposes `this.pages`** — Array of `{ id, label }` objects available inside `render()`.
4. **Exposes `this.activePage`** — The current page id, derived from `this.props.$params[param]` (falling back to `default` or the first item).
5. **Exposes `this.templates`** — The usual keyed template map (from the auto-generated `templateUrl`).

> **Tip:** The `pages` config is the recommended approach for documentation pages, multi-step wizards, tabbed views, or any component that switches between multiple HTML files driven by a route parameter.

### Directives

Used inside component `render()` HTML templates:

#### `@event` — Event Binding

```html
<!-- Simple method binding -->
<button @click="increment">+1</button>

<!-- With arguments -->
<button @click="remove(${item.id})">Delete</button>
<button @click="setMode('edit')">Edit</button>

<!-- With modifiers -->
<form @submit.prevent="save">...</form>
<div @click.stop="toggle">...</div>
<a @click.prevent.stop="navigate('home')">Home</a>
```

**Supported argument types:** strings (`'value'` or `"value"`), numbers, booleans (`true`/`false`), `null`, state references (`state.key`).

**Supported modifiers:**
- `.prevent` — calls `e.preventDefault()`
- `.stop` — calls `e.stopPropagation()`

#### `z-model` — Two-Way Binding

Creates a **reactive two-way sync** between a form element and a state property. When the user types or selects, the state updates and the rest of the template re-renders. Focus and cursor position are automatically preserved.

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

### `components()`

Returns an object of all registered component definitions (for debugging).

```js
console.log($.components());
// { 'home-page': { render: ..., state: ..., ... }, 'app-counter': { ... } }
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
| `mode` | `'history' \| 'hash'` | `'history'` | Routing mode. Hash mode uses `#/path`. |
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
| `destroy` | `destroy()` | — | Teardown router and mounted component. |

### Router Properties

| Property | Type | Description |
| --- | --- | --- |
| `current` | `object \| null` | `{ route, params, query, path }` for the current route. |
| `path` | `string` | Current path (with `base` stripped in history mode). |
| `query` | `object` | Parsed query string as object. |

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

Left-to-right function composition.

```js
const process = $.pipe(
  str => str.trim(),
  str => str.toLowerCase(),
  str => str.replace(/\s+/g, '-'),
);
process('  Hello World  ');  // 'hello-world'
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

## Global API

| Property/Method | Description |
| --- | --- |
| `$.style(urls)` | Dynamically load additional global (unscoped) stylesheet file(s) into `<head>`. Paths resolve relative to the calling file. Returns `{ remove(), ready }`. |
| `$.version` | Library version string (e.g. `'0.1.0'`). |
| `$.noConflict()` | Remove `$` from `window`, return the library object. |
| `window.$` | Global reference (auto-set in browser). |
| `window.zQuery` | Global alias (auto-set in browser). |

---

## ES Module Exports (for npm/bundler usage)

When used as an ES module (not the built bundle), the library exports:

```js
import {
  $, zQuery, ZQueryCollection, queryAll,
  reactive, signal, computed, effect,
  component, mount, mountAll, getInstance, destroy, style,
  createRouter, getRouter,
  createStore, getStore,
  http,
  debounce, throttle, pipe, once, sleep,
  escapeHtml, html, trust, uuid,
  deepClone, deepMerge, isEqual, param, parseQuery,
  storage, session, bus,
} from '@tonywied17/zero-query';
```

---

## CLI Bundler

The `zquery` CLI is a zero-dependency Node.js tool included in the `zero-query` npm package. It compiles your entire app — ES modules, the library, external templates, and assets — into a single self-contained bundle.

### Installation

```bash
npm install zero-query --save-dev
```

### Bundling

```bash
# From inside your project (auto-detects entry from index.html)
npx zquery bundle

# Or point to an entry from anywhere
npx zquery bundle path/to/scripts/app.js
```

Everything is automatic: the bundler finds your entry point, embeds the zQuery library, resolves all imports, inlines external templates, rewrites `index.html`, and copies assets into `dist/` next to your HTML file.

Output:
```
dist/
  index.html              ← rewritten HTML
  z-app.a1b2c3d4.js      ← readable bundle (library + app + templates)
  z-app.a1b2c3d4.min.js  ← minified bundle
  styles/                 ← copied assets
```

Filenames are content-hashed for cache-busting. Previous builds are cleaned automatically.

### Building the Library

If you're working on zQuery itself and need to rebuild `dist/zQuery.min.js`:

```bash
npx zquery build                # one-time build
```

> **Note:** `npx zquery build` must be run from the zero-query project root (where `src/` and `index.js` live). If you have a `build` script in your `package.json`, `npm run build` will handle the working directory automatically.

### Options

| Flag | Short | Description |
| --- | --- | --- |
| `--out <path>` | `-o` | Custom output directory (default: `dist/` next to `index.html`) |
| `--html <file>` | — | Use a specific HTML file instead of the auto-detected one |
| `--watch` | `-w` | Watch source files and rebuild on changes |

### What the Bundler Does

| Step | Description |
| --- | --- |
| **Entry detection** | Reads `index.html` for `<script type="module" src="...">`, or falls back to `scripts/app.js`, `app.js`, etc. |
| **Import graph** | Recursively resolves all `import` statements and topologically sorts dependencies (leaves first) |
| **Module stripping** | Removes `import`/`export` keywords, keeps declarations — output is plain browser JS wrapped in an IIFE |
| **Library embedding** | Finds `zquery.min.js` in common locations or auto-builds it from the package source |
| **Template inlining** | Detects `templateUrl`, `styleUrl`, and `pages` configs; inlines the referenced HTML/CSS so `file://` works |
| **HTML rewriting** | Replaces `<script type="module">` with the bundle, removes the standalone library tag, copies all assets |
| **Minification** | Produces both readable and minified builds with content-hashed filenames |

### Automatic Transformations

| Source | Result |
| --- | --- |
| `import ... from './x.js'` | Removed (code is concatenated in dependency order) |
| `import './x.js'` | Removed (side-effect import) |
| `export default ...` | `export default` removed, declaration kept |
| `export const` / `function` / `class` | `export` removed, declaration kept |
| `export { ... }` | Entire statement removed |
| `import.meta.url` | Replaced with `new URL('<relative-path>', document.baseURI).href` |

### Examples

```bash
# Bundle your app (auto-detects everything)
npx zquery bundle

# Specify entry explicitly
npx zquery bundle scripts/app.js

# Custom output directory
npx zquery bundle -o build/

# Watch mode
npx zquery bundle --watch
```
