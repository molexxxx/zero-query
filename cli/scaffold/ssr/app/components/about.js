// about.js - About page component

export const aboutPage = {
  state: () => ({
    features: [
      'createSSRApp() - isolated component registry for Node.js',
      'renderToString() - render a component to an HTML string',
      'renderPage() - full HTML document with meta tags',
      'renderBatch() - render multiple components in one call',
      'Hydration markers (data-zq-ssr) for client takeover',
      'SEO: description, canonical URL, Open Graph tags',
    ]
  }),

  render() {
    const list = this.state.features.map(f => `<li>${f}</li>`).join('');
    return `
      <div class="page-header">
        <h1>About</h1>
        <p class="subtitle">SSR capabilities in this scaffold.</p>
      </div>
      <div class="card">
        <h3>SSR API</h3>
        <ul style="padding-left:1.2rem; line-height:2;">${list}</ul>
      </div>
    `;
  }
};
