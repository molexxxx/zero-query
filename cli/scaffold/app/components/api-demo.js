// scripts/components/api-demo.js — HTTP client demonstration
//
// Demonstrates: $.get() for fetching JSON, z-if/z-else conditional
//               rendering, z-show visibility, z-for list rendering,
//               z-text content binding, @click event handling,
//               loading/error states, $.escapeHtml(), async patterns

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
    const { selectedUser } = this.state;

    return `
      <div class="page-header">
        <h1>API Demo</h1>
        <p class="subtitle">Fetching data with <code>$.get()</code>. Directives: <code>z-if</code>, <code>z-show</code>, <code>z-for</code>, <code>z-text</code>.</p>
      </div>

      <div class="card card-error" z-show="error"><p>⚠ <span z-text="error"></span></p></div>
      <div class="loading-bar" z-show="loading"></div>

      <div z-if="!selectedUser">
        <div class="card">
          <h3>Users</h3>
          <p class="muted">Click a user to fetch their posts.</p>
          <div class="user-grid" z-if="users.length > 0">
            <button z-for="u in users" class="user-card" @click="selectUser({{u.id}})">
              <strong>{{u.name}}</strong>
              <small>@{{u.username}}</small>
              <small class="muted">{{u.company.name}}</small>
            </button>
          </div>
          <p z-else z-show="!loading">No users loaded.</p>
        </div>
      </div>

      <div z-else>
        <div class="card">
          <div class="user-detail-header">
            <div>
              <h3>${selectedUser ? $.escapeHtml(selectedUser.name) : ''}</h3>
              <p class="muted">${selectedUser ? `@${$.escapeHtml(selectedUser.username)} · ${$.escapeHtml(selectedUser.email)}` : ''}</p>
            </div>
            <button class="btn btn-ghost btn-sm" @click="clearSelection">← Back</button>
          </div>
        </div>

        <div class="card">
          <h3>Recent Posts</h3>
          <div class="posts-list" z-if="posts.length > 0">
            <article z-for="p in posts" class="post-item">
              <h4>{{p.title}}</h4>
              <p>{{p.body.substring(0, 120)}}…</p>
            </article>
          </div>
          <p z-else class="muted" z-show="!loading">No posts found.</p>
        </div>
      </div>
    `;
  }
});
