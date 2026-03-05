// scripts/components/about.js — about page with theme switcher
//
// Demonstrates: $.storage (localStorage wrapper), $.bus for notifications,
//               $.version, component methods, data-theme attribute toggling

$.component('about-page', {
  state: () => ({
    theme: 'dark',
  }),

  mounted() {
    // Read persisted theme via $.storage
    this.state.theme = $.storage.get('theme') || 'dark';
  },

  toggleTheme() {
    const next = this.state.theme === 'dark' ? 'light' : 'dark';
    this.state.theme = next;
    // Apply theme via data attribute
    document.documentElement.setAttribute('data-theme', next);
    // Persist via $.storage (wraps localStorage)
    $.storage.set('theme', next);
    $.bus.emit('toast', { message: `Switched to ${next} theme`, type: 'info' });
  },

  render() {
    return `
      <div class="page-header">
        <h1>About</h1>
        <p class="subtitle">Built with zQuery v${$.version} — a zero-dependency frontend library.</p>
      </div>

      <div class="card">
        <h3>🎨 Theme</h3>
        <p>Toggle between dark and light mode. Persisted to <code>localStorage</code> via <code>$.storage</code>.</p>
        <div class="theme-toggle">
          <span>Current: <strong>${this.state.theme}</strong></span>
          <button class="btn btn-outline" @click="toggleTheme">${this.state.theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}</button>
        </div>
      </div>

      <div class="card">
        <h3>🧰 Features Used in This App</h3>
        <div class="feature-grid">
          <div class="feature-item">
            <strong>$.component()</strong>
            <span>Reactive components with state, lifecycle hooks, and template rendering</span>
          </div>
          <div class="feature-item">
            <strong>$.router()</strong>
            <span>SPA routing with history mode, z-link navigation, and fallback pages</span>
          </div>
          <div class="feature-item">
            <strong>$.store()</strong>
            <span>Centralized state management with actions, getters, and subscriptions</span>
          </div>
          <div class="feature-item">
            <strong>$.get()</strong>
            <span>HTTP client for fetching JSON APIs with async/await</span>
          </div>
          <div class="feature-item">
            <strong>$.signal() / $.computed()</strong>
            <span>Fine-grained reactive primitives for derived state</span>
          </div>
          <div class="feature-item">
            <strong>$.bus</strong>
            <span>Event bus for cross-component communication (toast notifications)</span>
          </div>
          <div class="feature-item">
            <strong>$.storage</strong>
            <span>localStorage wrapper for persisting user preferences</span>
          </div>
          <div class="feature-item">
            <strong>$.debounce()</strong>
            <span>Debounced search input in the todos filter</span>
          </div>
          <div class="feature-item">
            <strong>$.escapeHtml()</strong>
            <span>Safe rendering of user-generated and API content</span>
          </div>
          <div class="feature-item">
            <strong>$.uuid()</strong>
            <span>Unique ID generation for new todo items</span>
          </div>
          <div class="feature-item">
            <strong>z-model / z-ref</strong>
            <span>Two-way data binding and DOM element references</span>
          </div>
          <div class="feature-item">
            <strong>templateUrl / styleUrl</strong>
            <span>External HTML templates and CSS with auto-scoping (contacts page)</span>
          </div>
          <div class="feature-item">
            <strong>z-if / z-for / z-show</strong>
            <span>Structural directives for conditional &amp; list rendering</span>
          </div>
          <div class="feature-item">
            <strong>z-bind / z-class / z-style</strong>
            <span>Dynamic attributes, classes, and inline styles</span>
          </div>
          <div class="feature-item">
            <strong>$.on()</strong>
            <span>Global delegated event listeners for the hamburger menu</span>
          </div>
        </div>
      </div>

      <div class="card card-muted">
        <h3>📚 Next Steps</h3>
        <ul class="next-steps">
          <li>Read the <a href="https://z-query.com/docs" target="_blank" rel="noopener">full documentation</a></li>
          <li>Explore the <a href="https://github.com/tonywied17/zero-query" target="_blank" rel="noopener">source on GitHub</a></li>
          <li>Run <code>npx zquery bundle</code> to build for production</li>
          <li>Run <code>npx zquery dev</code> for live-reload development</li>
        </ul>
      </div>
    `;
  }
});
