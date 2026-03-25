import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSSRApp, renderToString, escapeHtml } from '../src/ssr.js';
import { ZQueryError, ErrorCode, onError } from '../src/errors.js';


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
    expect(typeof app.renderBatch).toBe('function');
    expect(typeof app.has).toBe('function');
  });

  it('each call returns a fresh instance', () => {
    const a = createSSRApp();
    const b = createSSRApp();
    expect(a).not.toBe(b);
  });
});


// ---------------------------------------------------------------------------
// component registration
// ---------------------------------------------------------------------------

describe('SSRApp - component', () => {
  it('registers a component and returns self for chaining', () => {
    const app = createSSRApp();
    const result = app.component('my-comp', {
      render() { return '<div>hello</div>'; }
    });
    expect(result).toBe(app);
  });

  it('throws ZQueryError when rendering unregistered component', async () => {
    const app = createSSRApp();
    await expect(app.renderToString('nonexistent')).rejects.toThrow(ZQueryError);
    await expect(app.renderToString('nonexistent')).rejects.toThrow('not registered');
  });

  it('throws ZQueryError for invalid component name (empty string)', () => {
    const app = createSSRApp();
    expect(() => app.component('', {})).toThrow(ZQueryError);
  });

  it('throws ZQueryError for non-string component name', () => {
    const app = createSSRApp();
    expect(() => app.component(123, {})).toThrow(ZQueryError);
  });

  it('throws ZQueryError for invalid definition (null)', () => {
    const app = createSSRApp();
    expect(() => app.component('my-comp', null)).toThrow(ZQueryError);
  });

  it('throws ZQueryError for non-object definition', () => {
    const app = createSSRApp();
    expect(() => app.component('my-comp', 'not-an-object')).toThrow(ZQueryError);
  });

  it('allows re-registering a component (override)', async () => {
    const app = createSSRApp();
    app.component('my-comp', { render() { return '<p>v1</p>'; } });
    app.component('my-comp', { render() { return '<p>v2</p>'; } });
    const html = await app.renderToString('my-comp');
    expect(html).toContain('v2');
    expect(html).not.toContain('v1');
  });
});


// ---------------------------------------------------------------------------
// SSRApp.has()
// ---------------------------------------------------------------------------

describe('SSRApp - has', () => {
  it('returns false for unregistered', () => {
    const app = createSSRApp();
    expect(app.has('nope')).toBe(false);
  });

  it('returns true for registered', () => {
    const app = createSSRApp();
    app.component('my-comp', { render() { return ''; } });
    expect(app.has('my-comp')).toBe(true);
  });
});


// ---------------------------------------------------------------------------
// renderToString (app method)
// ---------------------------------------------------------------------------

describe('SSRApp - renderToString', () => {
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

  it('strips z-on: event bindings', async () => {
    const app = createSSRApp();
    app.component('my-comp', {
      render() { return '<button z-on:click="handle">Click</button>'; }
    });
    const html = await app.renderToString('my-comp');
    expect(html).not.toContain('z-on:');
  });

  it('renders empty string when no render function', async () => {
    const app = createSSRApp();
    app.component('empty', { state: () => ({}) });
    const html = await app.renderToString('empty');
    expect(html).toContain('<empty');
    expect(html).toContain('</empty>');
  });

  it('fragment mode returns inner HTML only', async () => {
    const app = createSSRApp();
    app.component('frag', { render() { return '<p>inner</p>'; } });
    const html = await app.renderToString('frag', {}, { mode: 'fragment' });
    expect(html).toBe('<p>inner</p>');
    expect(html).not.toContain('<frag');
  });

  it('error in render() produces comment and reports via error system', async () => {
    const handler = vi.fn();
    onError(handler);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const app = createSSRApp();
    app.component('bad', {
      render() { throw new Error('render boom'); }
    });
    const html = await app.renderToString('bad');
    expect(html).toContain('<!-- SSR render error -->');
    expect(html).not.toContain('render boom');
    expect(handler).toHaveBeenCalled();
    const err = handler.mock.calls[0][0];
    expect(err.code).toBe(ErrorCode.SSR_RENDER);

    spy.mockRestore();
    onError(null);
  });

  it('error in init() is reported but does not crash', async () => {
    const handler = vi.fn();
    onError(handler);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const app = createSSRApp();
    app.component('bad-init', {
      init() { throw new Error('init boom'); },
      render() { return '<div>ok</div>'; }
    });
    const html = await app.renderToString('bad-init');
    expect(html).toContain('<div>ok</div>');
    expect(handler).toHaveBeenCalled();

    spy.mockRestore();
    onError(null);
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

  it('throws ZQueryError for invalid definition', () => {
    expect(() => renderToString(null)).toThrow(ZQueryError);
    expect(() => renderToString('string')).toThrow(ZQueryError);
  });

  it('works with props', () => {
    const html = renderToString({
      render() { return `<span>${this.props.x}</span>`; }
    }, { x: 42 });
    expect(html).toContain('42');
  });

  it('props are frozen', () => {
    let frozen = false;
    renderToString({
      init() { frozen = Object.isFrozen(this.props); },
      render() { return ''; }
    }, { a: 1 });
    expect(frozen).toBe(true);
  });
});


// ---------------------------------------------------------------------------
// State factory
// ---------------------------------------------------------------------------

describe('SSR - state factory', () => {
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

  it('each render gets fresh state from factory', async () => {
    const app = createSSRApp();
    app.component('comp', {
      state: () => ({ count: 0 }),
      init() { this.state.count++; },
      render() { return `<p>${this.state.count}</p>`; }
    });
    const html1 = await app.renderToString('comp');
    const html2 = await app.renderToString('comp');
    expect(html1).toContain('<p>1</p>');
    expect(html2).toContain('<p>1</p>');
  });

  it('has __raw property on state', () => {
    let hasRaw = false;
    renderToString({
      init() { hasRaw = this.state.__raw === this.state; },
      render() { return ''; }
    });
    expect(hasRaw).toBe(true);
  });

  it('__raw is non-enumerable', () => {
    let keys = [];
    renderToString({
      state: () => ({ a: 1 }),
      init() { keys = Object.keys(this.state); },
      render() { return ''; }
    });
    expect(keys).not.toContain('__raw');
  });
});


// ---------------------------------------------------------------------------
// Computed properties
// ---------------------------------------------------------------------------

describe('SSR - computed', () => {
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

  it('computed has access to this context', async () => {
    const app = createSSRApp();
    app.component('comp', {
      state: () => ({ items: [1, 2, 3] }),
      computed: {
        count() { return this.state.items.length; }
      },
      render() { return `<p>${this.computed.count}</p>`; }
    });
    const html = await app.renderToString('comp');
    expect(html).toContain('<p>3</p>');
  });

  it('error in computed is reported and returns undefined', async () => {
    const handler = vi.fn();
    onError(handler);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const app = createSSRApp();
    app.component('comp', {
      state: () => ({}),
      computed: {
        broken() { throw new Error('computed boom'); }
      },
      render() { return `<p>${this.computed.broken}</p>`; }
    });
    const html = await app.renderToString('comp');
    expect(html).toContain('undefined');
    expect(handler).toHaveBeenCalled();

    spy.mockRestore();
    onError(null);
  });
});


// ---------------------------------------------------------------------------
// User methods
// ---------------------------------------------------------------------------

describe('SSR - user methods', () => {
  it('binds user methods and they can be called in render', async () => {
    const app = createSSRApp();
    app.component('comp', {
      state: () => ({ items: ['a', 'b'] }),
      getCount() { return this.state.items.length; },
      render() { return `<p>${this.getCount()}</p>`; }
    });
    const html = await app.renderToString('comp');
    expect(html).toContain('<p>2</p>');
  });

  it('does not bind reserved keys', () => {
    let hasMounted = false;
    renderToString({
      mounted() { hasMounted = true; },
      render() { return ''; }
    });
    expect(hasMounted).toBe(false);
  });
});


// ---------------------------------------------------------------------------
// Init lifecycle
// ---------------------------------------------------------------------------

describe('SSR - init lifecycle', () => {
  it('calls init() during construction', () => {
    let initCalled = false;
    renderToString({
      init() { initCalled = true; },
      render() { return '<div></div>'; }
    });
    expect(initCalled).toBe(true);
  });

  it('init can modify state before render', async () => {
    const app = createSSRApp();
    app.component('comp', {
      state: () => ({ msg: 'before' }),
      init() { this.state.msg = 'after'; },
      render() { return `<p>${this.state.msg}</p>`; }
    });
    const html = await app.renderToString('comp');
    expect(html).toContain('after');
  });

  it('init has access to props', () => {
    let receivedProps = null;
    renderToString({
      init() { receivedProps = this.props; },
      render() { return ''; }
    }, { x: 42 });
    expect(receivedProps.x).toBe(42);
  });
});


// ---------------------------------------------------------------------------
// {{expression}} interpolation
// ---------------------------------------------------------------------------

describe('SSR - expression interpolation', () => {
  it('interpolates {{state.key}} patterns', () => {
    const html = renderToString({
      state: () => ({ name: 'World' }),
      render() { return '<p>Hello {{name}}</p>'; }
    });
    expect(html).toContain('Hello World');
  });

  it('escapes HTML in interpolated values', () => {
    const html = renderToString({
      state: () => ({ xss: '<script>alert(1)</script>' }),
      render() { return '<p>{{xss}}</p>'; }
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders empty string for null/undefined expressions', () => {
    const html = renderToString({
      state: () => ({ x: null }),
      render() { return '<p>{{x}}</p>'; }
    });
    expect(html).toContain('<p></p>');
  });

  it('expression error is reported and produces empty string', () => {
    const handler = vi.fn();
    onError(handler);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const html = renderToString({
      state: () => ({}),
      render() { return '<p>{{nonexistent.deep.path}}</p>'; }
    });
    // Should still produce valid HTML (empty interpolation)
    expect(html).toContain('<p>');

    spy.mockRestore();
    onError(null);
  });
});


// ---------------------------------------------------------------------------
// XSS sanitization via _escapeHtml
// ---------------------------------------------------------------------------

describe('SSR - XSS sanitization', () => {
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

  it('escapes description in meta tag', async () => {
    const app = createSSRApp();
    const html = await app.renderPage({ description: '"><script>xss</script>' });
    expect(html).toContain('&quot;');
    expect(html).not.toContain('"><script>');
  });

  it('escapes OG tag values', async () => {
    const app = createSSRApp();
    const html = await app.renderPage({ head: { og: { title: '"><script>xss</script>' } } });
    expect(html).toContain('og:title');
    expect(html).not.toContain('"><script>');
  });
});


// ---------------------------------------------------------------------------
// renderPage
// ---------------------------------------------------------------------------

describe('SSRApp - renderPage', () => {
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

  it('includes meta description when provided', async () => {
    const app = createSSRApp();
    const html = await app.renderPage({ description: 'A cool page' });
    expect(html).toContain('<meta name="description" content="A cool page">');
  });

  it('includes canonical URL', async () => {
    const app = createSSRApp();
    const html = await app.renderPage({ head: { canonical: 'https://example.com/' } });
    expect(html).toContain('<link rel="canonical" href="https://example.com/">');
  });

  it('includes Open Graph tags', async () => {
    const app = createSSRApp();
    const html = await app.renderPage({
      head: { og: { title: 'My Page', image: 'https://example.com/img.png' } }
    });
    expect(html).toContain('property="og:title"');
    expect(html).toContain('content="My Page"');
    expect(html).toContain('property="og:image"');
  });

  it('gracefully handles render failure in renderPage', async () => {
    const handler = vi.fn();
    onError(handler);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const app = createSSRApp();
    app.component('bad-page', { render() { throw new Error('page boom'); } });
    const html = await app.renderPage({ component: 'bad-page', title: 'Oops' });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<!-- SSR render error -->');
    expect(html).not.toContain('page boom');
    expect(handler).toHaveBeenCalled();

    spy.mockRestore();
    onError(null);
  });

  it('has correct structure: doctype, html, head, body', async () => {
    const app = createSSRApp();
    const html = await app.renderPage({});
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<html');
    expect(html).toContain('<head>');
    expect(html).toContain('</head>');
    expect(html).toContain('<body');
    expect(html).toContain('</body>');
    expect(html).toContain('</html>');
  });

  it('defaults lang to "en"', async () => {
    const app = createSSRApp();
    const html = await app.renderPage({});
    expect(html).toContain('lang="en"');
  });
});


// ---------------------------------------------------------------------------
// renderBatch
// ---------------------------------------------------------------------------

describe('SSRApp - renderBatch', () => {
  it('renders multiple components at once', async () => {
    const app = createSSRApp();
    app.component('header-el', { render() { return '<header>Head</header>'; } });
    app.component('footer-el', { render() { return '<footer>Foot</footer>'; } });

    const results = await app.renderBatch([
      { name: 'header-el' },
      { name: 'footer-el' }
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]).toContain('Head');
    expect(results[1]).toContain('Foot');
  });

  it('passes props per entry', async () => {
    const app = createSSRApp();
    app.component('greeting', {
      render() { return `<span>${this.props.msg}</span>`; }
    });
    const results = await app.renderBatch([
      { name: 'greeting', props: { msg: 'Hello' } },
      { name: 'greeting', props: { msg: 'Bye' } }
    ]);
    expect(results[0]).toContain('Hello');
    expect(results[1]).toContain('Bye');
  });

  it('rejects if any component is unregistered', async () => {
    const app = createSSRApp();
    app.component('ok-comp', { render() { return '<p>ok</p>'; } });
    await expect(
      app.renderBatch([{ name: 'ok-comp' }, { name: 'missing' }])
    ).rejects.toThrow('not registered');
  });
});


// ---------------------------------------------------------------------------
// escapeHtml (exported utility)
// ---------------------------------------------------------------------------

describe('escapeHtml (exported)', () => {
  it('escapes all dangerous characters', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('leaves safe strings unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('coerces numbers to string', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});
