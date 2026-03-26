// blog/post.js - Single blog post detail component
//
// Renders the full content of a blog post. Data flow:
//   SSR:    Server passes { post } as props → init() reads this.props.post
//   Client: init() checks window.__SSR_DATA__ first, then fetches from
//           /api/posts/:slug for client-side navigations.
//
// Route:  /blog/:slug
//
// Demonstrates:
//   - Param routing with this.props.$params.slug (or this.props.slug)
//   - Server data injection via props (SSR) and fetch (client)
//   - z-link for back-navigation without full page reload
//   - Graceful handling of missing data (404-style fallback)

export const blogPost = {
  state: () => ({
    post: null,
    loaded: false,
  }),

  async init() {
    const slug = this.props.slug || (this.props.$params && this.props.$params.slug);

    // On the server, props.post is injected by app.renderToString()
    if (this.props.post) {
      this.state.post = this.props.post;
      this.state.loaded = true;
      return;
    }

    // On the client, check for SSR-embedded data first (initial page load)
    const ssrData = typeof window !== 'undefined' && window.__SSR_DATA__;
    if (ssrData && ssrData.component === 'blog-post' && ssrData.params.slug === slug) {
      this.state.post = ssrData.props.post;
      this.state.loaded = true;
      if (ssrData.meta && ssrData.meta.title) document.title = ssrData.meta.title;
      window.__SSR_DATA__ = null;
      return;
    }

    // Client navigation — fetch from server API
    const res = await fetch(`/api/posts/${slug}`);
    if (res.ok) {
      this.state.post = await res.json();
    }
    this.state.loaded = true;

    // Update page title for client-side navigations
    if (this.state.post) {
      document.title = `${this.state.post.title} — {{NAME}}`;
    } else {
      document.title = 'Post Not Found — {{NAME}}';
    }
  },

  render() {
    const post = this.state.post;

    if (!post) {
      return `
        <div class="page-header center">
          <h1>Post Not Found</h1>
          <p class="subtitle">The article you're looking for doesn't exist.</p>
          <p style="margin-top:1rem;">
            <a z-link="/blog" class="back-link">← Back to Blog</a>
          </p>
        </div>
      `;
    }

    return `
      <article class="blog-post">
        <header class="page-header">
          <a z-link="/blog" class="back-link">← Back to Blog</a>
          <h1>${post.title}</h1>
          <div class="blog-post-meta">
            <span class="badge badge-ssr">${post.tag}</span>
            <time class="blog-date">${post.date}</time>
          </div>
        </header>
        <div class="blog-post-body">${post.body}</div>
      </article>
    `;
  }
};
