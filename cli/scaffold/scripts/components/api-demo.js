// scripts/components/api-demo.js — HTTP client demonstration
//
// Demonstrates: $.get() for fetching JSON, loading/error states,
//               $.escapeHtml() for safe rendering, async patterns,
//               mounted lifecycle, component state updates

$.component('api-demo', {
  state: () => ({
    users: [],
    selectedUser: null,
    posts: [],
    loading: false,
    error: '',
  }),

  mounted() {
    this.fetchUsers();
  },

  async fetchUsers() {
    this.state.loading = true;
    this.state.error = '';
    try {
      // $.get() — zero-config JSON fetching
      const res = await $.get('https://jsonplaceholder.typicode.com/users');
      this.state.users = res.data.slice(0, 6);
    } catch (err) {
      this.state.error = 'Failed to load users. Check your connection.';
    }
    this.state.loading = false;
  },

  async selectUser(id) {
    this.state.selectedUser = this.state.users.find(u => u.id === Number(id));
    this.state.loading = true;
    try {
      const res = await $.get(`https://jsonplaceholder.typicode.com/posts?userId=${id}`);
      this.state.posts = res.data.slice(0, 4);
    } catch (err) {
      this.state.error = 'Failed to load posts.';
    }
    this.state.loading = false;
    $.bus.emit('toast', { message: `Loaded posts for ${this.state.selectedUser.name}`, type: 'success' });
  },

  clearSelection() {
    this.state.selectedUser = null;
    this.state.posts = [];
  },

  render() {
    const { users, selectedUser, posts, loading, error } = this.state;

    return `
      <div class="page-header">
        <h1>API Demo</h1>
        <p class="subtitle">Fetching data with <code>$.get()</code> from JSONPlaceholder. Safe rendering with <code>$.escapeHtml()</code>.</p>
      </div>

      ${error ? `<div class="card card-error"><p>⚠ ${$.escapeHtml(error)}</p></div>` : ''}
      ${loading ? '<div class="loading-bar"></div>' : ''}

      ${!selectedUser ? `
        <div class="card">
          <h3>Users</h3>
          <p class="muted">Click a user to fetch their posts.</p>
          ${users.length ? `
            <div class="user-grid">
              ${users.map(u => `
                <button class="user-card" @click="selectUser(${u.id})">
                  <strong>${$.escapeHtml(u.name)}</strong>
                  <small>@${$.escapeHtml(u.username)}</small>
                  <small class="muted">${$.escapeHtml(u.company.name)}</small>
                </button>
              `).join('')}
            </div>
          ` : (!loading ? '<p>No users loaded.</p>' : '')}
        </div>
      ` : `
        <div class="card">
          <div class="user-detail-header">
            <div>
              <h3>${$.escapeHtml(selectedUser.name)}</h3>
              <p class="muted">@${$.escapeHtml(selectedUser.username)} · ${$.escapeHtml(selectedUser.email)}</p>
            </div>
            <button class="btn btn-ghost btn-sm" @click="clearSelection">← Back</button>
          </div>
        </div>

        <div class="card">
          <h3>Recent Posts</h3>
          ${posts.length ? `
            <div class="posts-list">
              ${posts.map(p => `
                <article class="post-item">
                  <h4>${$.escapeHtml(p.title)}</h4>
                  <p>${$.escapeHtml(p.body.substring(0, 120))}…</p>
                </article>
              `).join('')}
            </div>
          ` : (!loading ? '<p class="muted">No posts found.</p>' : '')}
        </div>
      `}
    `;
  }
});
