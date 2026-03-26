// about.js - About page component

export const aboutPage = {
  render() {
    return `
      <div class="page-header">
        <h1>About</h1>
        <p class="subtitle">This app is powered by zQuery — a zero-dependency frontend micro-library.</p>
      </div>

      <div class="card">
        <h3>What is zQuery?</h3>
        <p style="line-height:1.7;">
          zQuery is a lightweight, zero-dependency JavaScript library for building
          reactive web applications. It provides components, routing, state management,
          server-side rendering, and more — all in a single, tiny package with no
          build step required.
        </p>
      </div>

      <div class="card">
        <h3>Core Features</h3>
        <ul style="padding-left:1.2rem; line-height:2;">
          <li><strong>Reactive state</strong> — fine-grained reactivity with <code>$.reactive()</code></li>
          <li><strong>Components</strong> — <code>$.component()</code> with state, lifecycle hooks, and computed properties</li>
          <li><strong>Routing</strong> — <code>$.router()</code> with history mode, params, guards, and <code>z-link</code> navigation</li>
          <li><strong>Store</strong> — centralized state via <code>$.store()</code></li>
          <li><strong>SSR</strong> — <code>createSSRApp()</code>, <code>renderToString()</code>, hydration markers</li>
          <li><strong>HTTP</strong> — <code>$.http</code> with interceptors, timeout, and parallel requests</li>
          <li><strong>Zero dependencies</strong> — nothing to install, audit, or keep up-to-date</li>
        </ul>
      </div>

      <div class="card">
        <h3>This Scaffold</h3>
        <p style="line-height:1.7;">
          You're running the <strong>SSR scaffold</strong> — a production-ready starter
          with server-side rendering, client hydration, param-based routing, JSON API
          endpoints, and per-route SEO metadata. Edit the components in <code>app/</code>
          and the server in <code>server/</code> to make it your own.
        </p>
      </div>

      <div class="card">
        <h3>Links</h3>
        <ul style="padding-left:1.2rem; line-height:2.2; list-style:none;">
          <li>📄 <a href="https://z-query.com" target="_blank" rel="noopener">zQuery Website</a></li>
          <li>📦 <a href="https://www.npmjs.com/package/zero-query" target="_blank" rel="noopener">npm — zero-query</a></li>
          <li>🛠️ <a href="https://github.com/tonywied17/zero-query" target="_blank" rel="noopener">GitHub Repository</a></li>
          <li>📖 <a href="https://z-query.com/docs" target="_blank" rel="noopener">Documentation</a></li>
        </ul>
      </div>
    `;
  }
};
