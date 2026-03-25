// not-found.js - 404 fallback component

export const notFound = {
  render() {
    return `
      <div class="page-header" style="text-align:center; margin-top:4rem;">
        <h1>404</h1>
        <p class="subtitle">Page not found.</p>
        <p style="margin-top:1rem;">
          <a href="/" style="color:var(--accent);">← Home</a>
        </p>
      </div>
    `;
  }
};
