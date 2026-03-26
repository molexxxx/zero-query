// blog/index.js - Blog listing component
//
// Renders a grid of blog post cards. Data flow:
//   SSR:    Server passes { posts } as props → render() reads this.props.posts
//   Client: init() checks window.__SSR_DATA__ first (hydration), then fetches
//           from /api/posts for subsequent navigations.
//
// Demonstrates:
//   - Shared component that works on both server and client
//   - Server data injection via props (SSR) and fetch (client)
//   - z-link with dynamic URLs for client-side navigation
//   - Clean SSR-friendly templates (no DOM API in render)

export const blogList = {
  state: () => ({
    posts: [],
    loaded: false,
  }),

  async init() {
    // On the server, props.posts is injected by app.renderToString()
    if (this.props.posts) {
      this.state.posts = this.props.posts;
      this.state.loaded = true;
      return;
    }

    // On the client, check for SSR-embedded data first (initial page load)
    const ssrData = typeof window !== 'undefined' && window.__SSR_DATA__;
    if (ssrData && ssrData.component === 'blog-list') {
      this.state.posts = ssrData.props.posts;
      this.state.loaded = true;
      window.__SSR_DATA__ = null;
      return;
    }

    // Client navigation — fetch from server API
    const res = await fetch('/api/posts');
    this.state.posts = await res.json();
    this.state.loaded = true;
  },

  render() {
    const posts = this.state.posts;

    const cards = posts.map(post => `
      <a z-link="/blog/${post.slug}" class="blog-card">
        <div class="blog-card-header">
          <span class="badge badge-ssr">${post.tag}</span>
          <time class="blog-date">${post.date}</time>
        </div>
        <h3 class="blog-title">${post.title}</h3>
        <p class="blog-summary">${post.summary}</p>
      </a>
    `).join('');

    return `
      <div class="page-header">
        <h1>Blog</h1>
        <p class="subtitle">Server-rendered articles — fast first paint, fully crawlable.</p>
      </div>
      <div class="blog-grid">${cards}</div>
    `;
  }
};
