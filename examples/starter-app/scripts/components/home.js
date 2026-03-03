$.component('home-page', {
  state: { greeting: 'Welcome to zQuery!' },

  render() {
    const features = [
      { icon: 'M13.5 3a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 12.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm-7.5 0a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM12 19.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM4.5 12a7.5 7.5 0 1115 0 7.5 7.5 0 01-15 0z',
        title: '$() Selectors', desc: 'jQuery-like API with full chaining' },
      { icon: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z',
        title: 'Components', desc: 'Reactive with template literals' },
      { icon: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
        title: 'SPA Router', desc: 'Params, guards & lazy loading' },
      { icon: 'M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375',
        title: 'Global Store', desc: 'Redux-like, but simple' },
      { icon: 'M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582',
        title: 'HTTP Client', desc: 'Fetch wrapper with interceptors' },
      { icon: 'M11.42 15.17l-5.1-5.1a1.5 1.5 0 010-2.12l.88-.88a1.5 1.5 0 012.12 0L12 9.75l5.46-5.46a1.5 1.5 0 012.12 0l.88.88a1.5 1.5 0 010 2.12l-8.46 8.46a1.5 1.5 0 01-2.12 0z',
        title: 'Signals', desc: 'Fine-grained reactive primitives' },
      { icon: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182',
        title: 'Two-Way Binding', desc: 'z-model directive' },
      { icon: 'M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 11-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 016.336-4.486l-3.276 3.276a3.004 3.004 0 002.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852z',
        title: 'Utilities', desc: 'Debounce, throttle, storage & more' },
    ];

    function card(f) {
      return '<div style="display:flex;gap:0.75rem;align-items:flex-start;padding:0.75rem;background:#0d1117;border:1px solid #21262d;border-radius:8px;">'
        + '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#58a6ff" style="width:20px;height:20px;flex-shrink:0;margin-top:2px;"><path stroke-linecap="round" stroke-linejoin="round" d="' + f.icon + '"/></svg>'
        + '<div><div style="color:#f0f6fc;font-weight:600;font-size:0.9rem;">' + f.title + '</div>'
        + '<div style="color:#8b949e;font-size:0.8rem;margin-top:2px;">' + f.desc + '</div></div></div>';
    }

    return `
      <div>
        <div class="card" style="text-align:center;padding:2.5rem 1.5rem;">
          <h1 style="font-size:2rem;color:#f0f6fc;margin-bottom:0.5rem;">${this.state.greeting}</h1>
          <p style="max-width:640px;margin:0 auto;line-height:1.7;">
            A lightweight frontend library combining the best of jQuery's simplicity
            with React/Angular's component model. Zero dependencies, works out of the box with ES modules.
            An optional <a z-link="/docs/getting-started#cli-bundler" style="color:#58a6ff;cursor:pointer;">CLI bundler</a> is available for single-file distribution.
          </p>
          <div style="margin-top:1.25rem;display:flex;justify-content:center;gap:0.75rem;flex-wrap:wrap;">
            <span class="badge">v${$.version}</span>
            <span class="badge" style="background:#238636;">~46 KB minified</span>
            <span class="badge" style="background:#30363d;">0 dependencies</span>
          </div>
        </div>

        <div class="card" style="padding:1.5rem;">
          <h2 style="margin-bottom:1rem;">Features</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:0.75rem;">
            ${features.map(card).join('')}
          </div>
        </div>

        <div class="card" style="text-align:center;padding:1.5rem;">
          <h2 style="margin-bottom:0.5rem;">Explore the Docs</h2>
          <p>Check out the <a z-link="/docs" style="color:#58a6ff;cursor:pointer;">API Docs</a> page for full reference documentation with code examples covering every feature, directive, and utility method.</p>
        </div>
      </div>
    `;
  }
});
