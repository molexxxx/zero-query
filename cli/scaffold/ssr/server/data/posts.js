// server/data/posts.js - Blog post data
//
// Simulates a database or CMS. In a real app you'd fetch from a DB,
// headless CMS, or markdown files. The server imports this data and
// passes it as props to blog components during SSR.

export const posts = [
  {
    slug: 'why-ssr-matters',
    title: 'Why Server-Side Rendering Matters',
    date: '2025-12-15',
    tag: 'SSR',
    summary:
      'SSR delivers fully rendered HTML to the browser, improving first contentful paint, SEO indexability, and perceived performance on slower connections.',
    body: `
      <p>Server-Side Rendering (SSR) generates the full HTML for a page on the server
      before sending it to the browser. Instead of shipping an empty shell and waiting
      for JavaScript to populate it, the user sees content immediately.</p>

      <h4>Key Benefits</h4>
      <ul>
        <li><strong>Faster First Paint</strong> — HTML arrives ready to display.
        No waiting for JS bundles to download and execute.</li>
        <li><strong>SEO Friendly</strong> — Search engine crawlers see complete
        content without running JavaScript.</li>
        <li><strong>Social Sharing</strong> — Open Graph meta tags are present in
        the initial response, so link previews work everywhere.</li>
        <li><strong>Accessibility</strong> — Content is available even if JS fails
        to load or is disabled.</li>
      </ul>

      <h4>The Trade-Off</h4>
      <p>SSR adds server-side compute cost per request. Strategies like render
      caching, edge deployment, and stale-while-revalidate headers help keep
      response times low while maintaining the benefits of dynamic rendering.</p>
    `,
  },
  {
    slug: 'hydration-explained',
    title: 'Hydration: Picking Up Where the Server Left Off',
    date: '2025-12-20',
    tag: 'Architecture',
    summary:
      'After the server sends HTML, the client "hydrates" the page — attaching event listeners and reactive state so the SPA takes over without a full re-render.',
    body: `
      <p>Hydration is the process where the client-side framework takes ownership
      of server-rendered HTML. The DOM is already there — hydration wires up event
      handlers, reactive state, and component lifecycles on top of it.</p>

      <h4>How It Works in zQuery</h4>
      <ol>
        <li>The server renders a component to HTML with <code>app.renderToString()</code>,
        adding a <code>data-zq-ssr</code> marker.</li>
        <li>The HTML is injected into the page shell and sent to the browser.</li>
        <li>The client loads the same component definitions and registers them
        with <code>$.component()</code>.</li>
        <li>The router detects the SSR marker and hydrates instead of re-rendering,
        preserving the existing DOM while activating reactivity.</li>
      </ol>

      <h4>Why This Matters</h4>
      <p>Without hydration, the client would discard the server HTML and re-render
      from scratch — causing a flash of empty content. Hydration gives you the best
      of both worlds: fast server-rendered first paint with full client interactivity.</p>
    `,
  },
  {
    slug: 'shared-components',
    title: 'Shared Components Across Client and Server',
    date: '2026-01-05',
    tag: 'Components',
    summary:
      'Write your component once and use it everywhere. The same definition object that powers client rendering can be imported by the SSR server to produce identical markup.',
    body: `
      <p>In zQuery, a component is a plain JavaScript object with <code>state</code>,
      <code>render()</code>, and optional lifecycle hooks. This simple contract means
      the same file works on both sides:</p>

      <pre><code>// components/greeting.js
export const greeting = {
  state: () => ({ name: 'World' }),
  render() {
    return \`&lt;h1&gt;Hello, \${this.state.name}!&lt;/h1&gt;\`;
  }
};</code></pre>

      <h4>Client</h4>
      <pre><code>import { greeting } from './components/greeting.js';
$.component('greeting', greeting);</code></pre>

      <h4>Server</h4>
      <pre><code>import { greeting } from '../app/components/greeting.js';
app.component('greeting', greeting);
const html = await app.renderToString('greeting', { name: 'Tony' });</code></pre>

      <p>No special file conventions, no build-time transforms. Just JavaScript
      modules shared between environments.</p>
    `,
  },
  {
    slug: 'ssr-caching-strategies',
    title: 'Caching Strategies for SSR Pages',
    date: '2026-01-18',
    tag: 'Performance',
    summary:
      'Combine stale-while-revalidate headers, in-memory render caching, and CDN edge caching to serve SSR pages at static-site speed without sacrificing freshness.',
    body: `
      <p>SSR is powerful but adds per-request compute. Smart caching lets you keep
      the dynamic benefits while serving at near-static speed.</p>

      <h4>Layer 1: In-Memory Cache</h4>
      <p>Cache rendered HTML in a <code>Map</code> keyed by route. Set a TTL
      (e.g. 60 seconds) and serve cached responses until they expire. Simple and
      effective for moderate traffic.</p>

      <h4>Layer 2: HTTP Cache Headers</h4>
      <pre><code>Cache-Control: public, s-maxage=60, stale-while-revalidate=300</code></pre>
      <p>This tells CDNs to serve cached content for 60s, then revalidate in the
      background for up to 5 minutes. Users always get a fast response.</p>

      <h4>Layer 3: CDN Edge Caching</h4>
      <p>Deploy behind a CDN (Cloudflare, Vercel Edge, Fastly) so cached pages are
      served from the nearest edge node. Combine with geographic routing for
      sub-100ms global TTFB.</p>

      <h4>When to Skip Caching</h4>
      <p>User-specific pages (dashboards, settings) shouldn't be edge-cached.
      Use <code>Cache-Control: private</code> and rely on in-memory caching
      or skip caching entirely for authenticated routes.</p>
    `,
  },
];

/** Find a single post by slug. Returns undefined if not found. */
export function getPostBySlug(slug) {
  return posts.find(p => p.slug === slug);
}

/** Return all posts (summary only — no body). */
export function getAllPosts() {
  return posts.map(({ slug, title, date, tag, summary }) => ({
    slug, title, date, tag, summary,
  }));
}
