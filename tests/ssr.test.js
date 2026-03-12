import { describe, it, expect } from 'vitest';
import { createSSRApp, renderToString } from '../src/ssr.js';


// ---------------------------------------------------------------------------
// createSSRApp
// ---------------------------------------------------------------------------

describe('createSSRApp', () => {
  it('returns an SSRApp instance', () => {
    const app = createSSRApp();
    expect(app).toBeDefined();
    expect(typeof app.component).toBe('function');
    expect(typeof app.renderToString).toBe('function');
    expect(typeof app.renderPage).toBe('function');
  });
});


// ---------------------------------------------------------------------------
// component registration
// ---------------------------------------------------------------------------

describe('SSRApp — component', () => {
  it('registers a component and returns self for chaining', () => {
    const app = createSSRApp();
    const result = app.component('my-comp', {
      render() { return '<div>hello</div>'; }
    });
    expect(result).toBe(app);
  });

  it('throws when rendering unregistered component', async () => {
    const app = createSSRApp();
    await expect(app.renderToString('nonexistent')).rejects.toThrow('not registered');
  });
});


// ---------------------------------------------------------------------------
// renderToString (app method)
// ---------------------------------------------------------------------------

describe('SSRApp — renderToString', () => {
  it('renders basic component', async () => {
    const app = createSSRApp();
    app.component('my-page', {
      state: () => ({ title: 'Hello' }),
      render() { return `<h1>${this.state.title}</h1>`; }
    });
    const html = await app.renderToString('my-page');
    expect(html).toContain('<h1>Hello</h1>');
  });

  it('adds hydration marker by default', async () => {
    const app = createSSRApp();
    app.component('my-comp', { render() { return '<p>test</p>'; } });
    const html = await app.renderToString('my-comp');
    expect(html).toContain('data-zq-ssr');
  });

  it('omits hydration marker when hydrate=false', async () => {
    const app = createSSRApp();
    app.component('my-comp', { render() { return '<p>test</p>'; } });
    const html = await app.renderToString('my-comp', {}, { hydrate: false });
    expect(html).not.toContain('data-zq-ssr');
  });

  it('wraps output in component tag', async () => {
    const app = createSSRApp();
    app.component('custom-tag', { render() { return '<span>ok</span>'; } });
    const html = await app.renderToString('custom-tag');
    expect(html).toMatch(/^<custom-tag[^>]*>.*<\/custom-tag>$/);
  });

  it('passes props to component', async () => {
    const app = createSSRApp();
    app.component('greet', {
      render() { return `<span>${this.props.name}</span>`; }
    });
    const html = await app.renderToString('greet', { name: 'World' });
    expect(html).toContain('World');
  });

  it('strips z-cloak attributes', async () => {
    const app = createSSRApp();
    app.component('my-comp', {
      render() { return '<div z-cloak>content</div>'; }
    });
    const html = await app.renderToString('my-comp');
    expect(html).not.toContain('z-cloak');
    expect(html).toContain('content');
  });

  it('strips event bindings (@click, z-on:click)', async () => {
    const app = createSSRApp();
    app.component('my-comp', {
      render() { return '<button @click="handle">Click</button>'; }
    });
    const html = await app.renderToString('my-comp');
    expect(html).not.toContain('@click');
  });
});


// ---------------------------------------------------------------------------
// renderToString (standalone function)
// ---------------------------------------------------------------------------

describe('renderToString (standalone)', () => {
  it('renders a definition directly', () => {
    const html = renderToString({
      state: () => ({ msg: 'hi' }),
      render() { return `<p>${this.state.msg}</p>`; }
    });
    expect(html).toContain('<p>hi</p>');
  });

  it('returns empty string when no render function', () => {
    const html = renderToString({ state: {} });
    expect(html).toBe('');
  });
});


// ---------------------------------------------------------------------------
// State factory
// ---------------------------------------------------------------------------

describe('SSR — state factory', () => {
  it('calls state function for initial state', async () => {
    const app = createSSRApp();
    let callCount = 0;
    app.component('comp', {
      state: () => { callCount++; return { x: 1 }; },
      render() { return `<div>${this.state.x}</div>`; }
    });
    await app.renderToString('comp');
    expect(callCount).toBe(1);
  });

  it('supports state as object (copied)', async () => {
    const app = createSSRApp();
    const shared = { x: 1 };
    app.component('comp', {
      state: shared,
      render() { return `<div>${this.state.x}</div>`; }
    });
    const html = await app.renderToString('comp');
    expect(html).toContain('1');
  });
});


// ---------------------------------------------------------------------------
// Computed properties
// ---------------------------------------------------------------------------

describe('SSR — computed', () => {
  it('computes derived values', async () => {
    const app = createSSRApp();
    app.component('comp', {
      state: () => ({ first: 'Jane', last: 'Doe' }),
      computed: {
        full(state) { return `${state.first} ${state.last}`; }
      },
      render() { return `<span>${this.computed.full}</span>`; }
    });
    const html = await app.renderToString('comp');
    expect(html).toContain('Jane Doe');
  });
});


// ---------------------------------------------------------------------------
// Init lifecycle
// ---------------------------------------------------------------------------

describe('SSR — init lifecycle', () => {
  it('calls init() during construction', () => {
    let initCalled = false;
    renderToString({
      init() { initCalled = true; },
      render() { return '<div></div>'; }
    });
    expect(initCalled).toBe(true);
  });
});


// ---------------------------------------------------------------------------
// XSS sanitization via _escapeHtml
// ---------------------------------------------------------------------------

describe('SSR — XSS sanitization', () => {
  it('escapes HTML in renderPage title', async () => {
    const app = createSSRApp();
    const html = await app.renderPage({ title: '<script>alert("xss")</script>' });
    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes script paths in renderPage', async () => {
    const app = createSSRApp();
    const html = await app.renderPage({ scripts: ['"><script>alert(1)</script>'] });
    expect(html).toContain('&quot;');
  });

  it('strips onXxx attributes from bodyAttrs', async () => {
    const app = createSSRApp();
    const html = await app.renderPage({ bodyAttrs: 'onclick="alert(1)"' });
    expect(html).not.toContain('onclick');
  });

  it('strips javascript: from bodyAttrs', async () => {
    const app = createSSRApp();
    const html = await app.renderPage({ bodyAttrs: 'data-x="javascript:void(0)"' });
    expect(html).not.toContain('javascript:');
  });
});


// ---------------------------------------------------------------------------
// renderPage
// ---------------------------------------------------------------------------

describe('SSRApp — renderPage', () => {
  it('renders a full HTML page', async () => {
    const app = createSSRApp();
    app.component('page', { render() { return '<h1>Home</h1>'; } });
    const html = await app.renderPage({
      component: 'page',
      title: 'My App',
      lang: 'en'
    });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>My App</title>');
    expect(html).toContain('<h1>Home</h1>');
    expect(html).toContain('lang="en"');
  });

  it('renders without component', async () => {
    const app = createSSRApp();
    const html = await app.renderPage({ title: 'Empty' });
    expect(html).toContain('<title>Empty</title>');
    expect(html).toContain('<div id="app"></div>');
  });

  it('includes style links', async () => {
    const app = createSSRApp();
    const html = await app.renderPage({ styles: ['style.css', 'theme.css'] });
    expect(html).toContain('href="style.css"');
    expect(html).toContain('href="theme.css"');
  });

  it('includes script tags', async () => {
    const app = createSSRApp();
    const html = await app.renderPage({ scripts: ['app.js'] });
    expect(html).toContain('src="app.js"');
  });
});
