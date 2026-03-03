import { store } from '../store.js';

$.component('about-page', {
  state: { bundleSize: '~45 KB minified' },

  async mounted() {
    try {
      const res = await fetch('scripts/vendor/zquery.min.js', { method: 'HEAD' });
      const encoding = res.headers.get('content-encoding');
      const bytes = Number(res.headers.get('content-length'));
      // Only trust content-length when the response isn't compressed
      if (bytes && !encoding) this.state.bundleSize = `~${Math.round(bytes / 1024)} KB minified`;
    } catch { /* keep default */ }
  },

  render() {
    return `
      <div>
        <div class="card">
          <h2>About zQuery</h2>
          <p>
            Built as a modern, minimal alternative to heavy frameworks.
            zQuery combines jQuery's ergonomic DOM manipulation with
            the component model of React/Angular — without the bloat.
          </p>
          <table style="margin-top:1rem;width:100%;font-size:0.9rem;">
            <tr><td style="color:#8b949e;padding:0.3rem 0;">Repository</td><td><a href="https://github.com/tonywied17/zero-query" target="_blank" rel="noopener" style="color:#58a6ff;text-decoration:none;">tonywied17/zero-query</a></td></tr>
            <tr><td style="color:#8b949e;padding:0.3rem 0;">Version</td><td>${$.version}</td></tr>
            <tr><td style="color:#8b949e;padding:0.3rem 0;">Dependencies</td><td>0</td></tr>
            <tr><td style="color:#8b949e;padding:0.3rem 0;">Bundle size</td><td>${this.state.bundleSize}</td></tr>
            <tr><td style="color:#8b949e;padding:0.3rem 0;">Build step</td><td>Optional (<code style="background:#21262d;padding:0.1rem 0.3rem;border-radius:4px;color:#79c0ff;font-size:0.85em;">node build.js</code>)</td></tr>
            <tr><td style="color:#8b949e;padding:0.3rem 0;">License</td><td>MIT</td></tr>
          </table>
        </div>
      </div>
    `;
  }
});
