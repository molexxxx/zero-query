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
        <h3><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="var(--accent)" style="width:20px;height:20px;vertical-align:-4px;margin-right:0.25rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42"/></svg> Theme</h3>
        <p>Toggle between dark and light mode. Persisted to <code>localStorage</code> via <code>$.storage</code>.</p>
        <div class="theme-toggle">
          <span>Current: <strong>${this.state.theme}</strong></span>
          <button class="btn btn-outline" @click="toggleTheme">${this.state.theme === 'dark' ? '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:16px;height:16px;vertical-align:-3px;margin-right:0.15rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"/></svg> Light Mode' : '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:16px;height:16px;vertical-align:-3px;margin-right:0.15rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"/></svg> Dark Mode'}</button>
        </div>
      </div>

      <div class="card">
        <h3><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="var(--accent)" style="width:20px;height:20px;vertical-align:-4px;margin-right:0.25rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75a4.5 4.5 0 0 1-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 1 1-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 0 1 6.336-4.486l-3.276 3.276a3.004 3.004 0 0 0 2.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852Z"/></svg> Features Used in This App</h3>
        <div class="feature-grid">
          <div class="feature-item">
            <strong>$.component()</strong>
            <span>Reactive components with state, lifecycle hooks, and template rendering</span>
          </div>
          <div class="feature-item">
            <strong>computed / watch</strong>
            <span>Derived state properties and reactive watchers on the counter page</span>
          </div>
          <div class="feature-item">
            <strong>DOM Diffing</strong>
            <span>Efficient <code>morph()</code> engine patches only changed DOM nodes on re-render</span>
          </div>
          <div class="feature-item">
            <strong>z-key</strong>
            <span>Keyed list reconciliation in z-for loops (todos, counter history, contacts)</span>
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
            <strong>CSP-safe expressions</strong>
            <span>Template expressions evaluated without <code>eval()</code> or <code>new Function()</code></span>
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
        <h3><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="var(--accent)" style="width:20px;height:20px;vertical-align:-4px;margin-right:0.25rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"/></svg> Next Steps</h3>
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
