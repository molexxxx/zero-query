$.component('not-found', {
  state: {},

  render() {
    const path = $.getRouter()?.path || '?';
    return `
      <div>
        <div class="card" style="text-align:center;">
          <h2 style="font-size:4rem;color:#484f58;">404</h2>
          <p>Page not found: <code>${path}</code></p>
          <div class="mt">
            <a z-link="/" style="color:#58a6ff;cursor:pointer;">← Back to Home</a>
          </div>
        </div>
      </div>
    `;
  }
});
