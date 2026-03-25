// about.js - About page with theme switcher
//
// Features used:
//   $.storage   - localStorage wrapper (get / set)
//   $.version   - library version string
//   data-theme  - dark / light theming

$.component('about-page', {
  styles: `
    .theme-switch   { display: inline-flex; border-radius: var(--radius); overflow: hidden;
                      border: 1px solid var(--border); background: var(--bg); }
    .theme-btn      { padding: 0.45rem 1rem; font-size: 0.82rem; font-weight: 500;
                      background: transparent; border: none; color: var(--text-muted);
                      cursor: pointer; transition: all .15s ease; font-family: inherit; }
    .theme-btn:hover  { color: var(--text); background: var(--bg-hover); }
    .theme-btn.active { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
    .theme-btn + .theme-btn { border-left: 1px solid var(--border); }

    .next-steps     { padding-left: 1.25rem; }
    .next-steps li  { margin-bottom: 0.4rem; font-size: 0.9rem; color: var(--text-muted); }
    .next-steps a   { color: var(--accent); }
  `,

  state: () => ({
    theme: 'system',
  }),

  mounted() {
    this.state.theme = $.storage.get('theme') || 'system';
  },

  setTheme(mode) {
    this.state.theme = mode;
    $.storage.set('theme', mode);
    window.__applyTheme(mode);
  },

  render() {
    const t = this.state.theme;
    return `
      <div class="page-header">
        <h1>About</h1>
        <p class="subtitle">zQuery v${$.version} - zero-dependency frontend micro-library.</p>
      </div>

      <div class="card">
        <h3>Theme</h3>
        <p>Choose your preferred appearance. <strong>System</strong> follows your OS setting.</p>
        <div class="theme-switch">
          <button class="theme-btn ${t === 'system' ? 'active' : ''}" @click="setTheme('system')">System</button>
          <button class="theme-btn ${t === 'dark' ? 'active' : ''}" @click="setTheme('dark')">Dark</button>
          <button class="theme-btn ${t === 'light' ? 'active' : ''}" @click="setTheme('light')">Light</button>
        </div>
      </div>

      <div class="card">
        <h3>Next Steps</h3>
        <ul class="next-steps">
          <li>Read the <a href="https://z-query.com/docs" target="_blank" rel="noopener">full documentation</a></li>
          <li>Explore the <a href="https://github.com/tonywied17/zero-query" target="_blank" rel="noopener">source on GitHub</a></li>
          <li>Run <code>npx zquery bundle</code> to build for production</li>
          <li>Run <code>npx zquery dev</code> for live-reload development</li>
          <li>Try <code>npx zquery create my-app</code> for the full-featured scaffold</li>
        </ul>
      </div>
    `;
  }
});
