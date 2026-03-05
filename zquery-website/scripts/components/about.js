import { store } from '../store.js';

$.component('about-page', {
  state: {},


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
            <tr><td style="color:#8b949e;padding:0.3rem 0;">Bundle size</td><td>~54 KB minified</td></tr>
            <tr><td style="color:#8b949e;padding:0.3rem 0;">Build step</td><td>Optional — works as ES modules out of the box. <code style="background:#21262d;padding:0.1rem 0.3rem;border-radius:4px;color:#79c0ff;font-size:0.85em;">npx zquery bundle</code> available for single-file builds.</td></tr>
            <tr><td style="color:#8b949e;padding:0.3rem 0;">License</td><td>MIT</td></tr>
          </table>
        </div>
      </div>
    `;
  }
});
