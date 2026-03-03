import { store } from '../store.js';

$.component('home-page', {
  state: { greeting: 'Welcome to zQuery!', bundleSize: '~45 KB' },

  async mounted() {
    // Subscribe to store changes so visits badge stays current
    this._unsub = store.subscribe(() => this._scheduleUpdate());
    try {
      // Use a range request to get the real file size, since a HEAD request
      // may return the compressed (gzip/brotli) Content-Length on servers
      // that transparently compress responses.
      const res = await fetch('scripts/vendor/zquery.min.js', { method: 'HEAD' });
      const encoding = res.headers.get('content-encoding');
      const bytes = Number(res.headers.get('content-length'));
      // Only trust content-length when the response isn't compressed
      if (bytes && !encoding) {
        this.state.bundleSize = `~${Math.round(bytes / 1024)} KB`;
      }
    } catch {}
  },

  destroyed() {
    if (this._unsub) this._unsub();
  },

  render() {
    return `
      <div>
        <div class="card">
          <h2>${this.state.greeting}</h2>
          <p>
            A lightweight frontend library combining the best of jQuery's simplicity
            with React/Angular's component model. Zero dependencies, works out of the box with ES modules.
            An optional <a z-link="/docs" style="color:#58a6ff;cursor:pointer;">CLI bundler</a> is available for single-file distribution.
          </p>
          <div class="mt flex">
            <span class="badge">v${$.version}</span>
            <span class="badge">Page visits: ${store.state.visits}</span>
          </div>
        </div>

        <div class="card">
          <h2>Features</h2>
          <ul style="list-style:none;margin-top:0.5rem;">
            <li>⚡ jQuery-like \`$()\` selector with full chaining</li>
            <li>🧩 Reactive components with template literals</li>
            <li>🔀 SPA router with params & guards</li>
            <li>📦 Global store (Redux-like, but simple)</li>
            <li>🌐 Fetch wrapper with interceptors</li>
            <li>🔧 Utilities: debounce, throttle, storage, event bus</li>
            <li>🔗 Signals & computed values</li>
            <li>📋 Two-way binding with z-model</li>
            <li>0️⃣ Zero dependencies, ${this.state.bundleSize} minified</li>
          </ul>
        </div>

        <div class="card">
          <h2>Explore the Docs</h2>
          <p>Check out the <a z-link="/docs" style="color:#58a6ff;cursor:pointer;">API Docs</a> page for full reference documentation with code examples covering every feature, directive, and utility method.</p>
        </div>
      </div>
    `;
  }
});
