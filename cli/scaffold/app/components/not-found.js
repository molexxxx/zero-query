// scripts/components/not-found.js — 404 fallback page
//
// Demonstrates: $.getRouter() to read the current path

$.component('not-found', {
  render() {
    const router = $.getRouter();
    return `
      <div class="page-header center">
        <h1>404</h1>
        <p class="subtitle">The page <code>${$.escapeHtml(router.current?.path || '')}</code> was not found.</p>
        <a z-link="/" class="btn btn-primary">← Go Home</a>
      </div>
    `;
  }
});
