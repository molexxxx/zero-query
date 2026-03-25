// api-demo.js - HTTP client demo
//
// Features used:
//   $.get()                - fetch JSON from an API
//   z-if / z-else / z-show - conditional rendering
//   z-for / z-text         - list rendering & text binding
//   $.escapeHtml()         - sanitize user-provided content
//   async methods          - loading & error state patterns

$.component('api-demo', {
  styles: `
    .api-users     { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                     gap: .75rem; }
    .api-user      { display: flex; flex-direction: column; gap: .2rem; padding: 1rem;
                     border-radius: var(--radius); border: 1px solid var(--border);
                     background: var(--bg-hover); cursor: pointer;
                     transition: border-color .15s, box-shadow .15s, transform .12s; text-align: left; }
    .api-user:hover { border-color: var(--accent); transform: translateY(-2px);
                      box-shadow: 0 4px 12px rgba(88,166,255,.12); }
    .api-user strong { color: var(--text); font-size: .95rem; }
    .api-user small  { color: var(--text-muted); font-size: .82rem; }
    .api-user .handle { color: var(--accent); font-weight: 500; }

    .api-detail    { display: flex; align-items: flex-start; justify-content: space-between;
                     gap: 1rem; flex-wrap: wrap; }
    .api-meta      { font-size: .88rem; color: var(--text-muted); margin-top: .15rem; }
    .api-meta span { margin-right: .75rem; }
    .api-meta .accent { color: var(--accent); }

    .api-posts     { display: flex; flex-direction: column; gap: .5rem; }
    .api-post      { padding: .85rem 1rem; border-radius: var(--radius);
                     border-left: 3px solid var(--accent); background: var(--bg-hover);
                     transition: border-color .15s; }
    .api-post:hover { border-left-color: #7ee787; }
    .api-post h4   { font-size: .92rem; margin: 0 0 .3rem; color: var(--text); }
    .api-post p    { font-size: .84rem; color: var(--text-muted); margin: 0; line-height: 1.5; }

    @media (max-width: 768px) {
      .api-users     { grid-template-columns: 1fr 1fr; }
      .api-detail    { flex-direction: column; }
    }
    @media (max-width: 480px) {
      .api-users     { grid-template-columns: 1fr; }
    }
  `,

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

      <div class="card card-error" z-show="error"><p><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:16px;height:16px;vertical-align:-3px;margin-right:0.15rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/></svg> <span z-text="error"></span></p></div>
      <div class="loading-bar" z-show="loading"></div>

      <div z-if="!selectedUser">
        <div class="card">
          <h3>Users</h3>
          <p class="muted" style="margin-bottom:.75rem;">Click a user card to fetch their recent posts via <code>$.get()</code>.</p>
          <div class="api-users" z-if="users.length > 0">
            <button z-for="u in users" class="api-user" @click="selectUser({{u.id}})">
              <strong>{{u.name}}</strong>
              <small class="handle">@{{u.username}}</small>
              <small>{{u.company.name}}</small>
            </button>
          </div>
          <p z-else z-show="!loading">No users loaded.</p>
        </div>
      </div>

      <div z-else>
        <div class="card">
          <div class="api-detail">
            <div>
              <h3 style="margin:0;">${selectedUser ? $.escapeHtml(selectedUser.name) : ''}</h3>
              <div class="api-meta">
                <span class="accent">@${selectedUser ? $.escapeHtml(selectedUser.username) : ''}</span>
                <span>${selectedUser ? $.escapeHtml(selectedUser.email) : ''}</span>
              </div>
            </div>
            <button class="btn btn-outline btn-sm" @click="clearSelection">← Back to users</button>
          </div>
        </div>

        <div class="card">
          <h3>Recent Posts</h3>
          <div class="api-posts" z-if="posts.length > 0">
            <article z-for="p in posts" class="api-post">
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
