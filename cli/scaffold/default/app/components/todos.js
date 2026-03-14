// todos.js — Todo list with global store
//
// Features used:
//   $.getStore / dispatch / subscribe  — centralized state management
//   z-model / z-ref                    — form bindings
//   z-for + z-key                      — keyed list rendering with diffing
//   z-class / z-if / z-show            — conditional rendering
//   @submit.prevent / @keydown.escape  — event modifiers
//   mounted / destroyed lifecycle      — setup & teardown

$.component('todos-page', {
  styles: `
    .td-header     { display: flex; align-items: center; justify-content: space-between;
                     gap: 1rem; flex-wrap: wrap; }
    .td-stats      { display: flex; gap: 1.5rem; }
    .td-stat       { display: flex; flex-direction: column; align-items: center; }
    .td-stat-num   { font-size: 1.5rem; font-weight: 700; color: var(--accent);
                     font-variant-numeric: tabular-nums; line-height: 1.2; }
    .td-stat-label { font-size: .72rem; color: var(--text-muted); text-transform: uppercase;
                     letter-spacing: .04em; font-weight: 500; }

    .td-progress      { height: 4px; background: var(--bg-hover); border-radius: 4px;
                        overflow: hidden; margin-bottom: 1.25rem; }
    .td-progress-fill { height: 100%; background: var(--accent); border-radius: 4px;
                        transition: width .3s var(--ease-out); }

    .td-form       { display: flex; gap: .5rem; }
    .td-form .input { flex: 1; }

    .td-bar        { display: flex; align-items: center; justify-content: space-between;
                     gap: .75rem; flex-wrap: wrap; margin-bottom: .75rem; }
    .td-pills      { display: flex; gap: .35rem; }
    .td-pill       { padding: .3rem .75rem; border-radius: 999px; font-size: .82rem;
                     font-weight: 500; border: 1px solid var(--border); background: transparent;
                     color: var(--text-muted); cursor: pointer; transition: all .15s; }
    .td-pill:hover { border-color: var(--accent); color: var(--text); }
    .td-pill.on    { background: var(--accent); color: #fff; border-color: var(--accent); }
    .td-search     { width: 160px; }

    .td-list       { list-style: none; padding: 0; margin: 0; }
    .td-item       { display: flex; align-items: center; gap: .75rem; padding: .7rem .65rem;
                     border-radius: var(--radius); margin-bottom: 2px;
                     transition: background .12s; }
    .td-item:hover { background: var(--bg-hover); }
    .td-item.done .td-text { text-decoration: line-through; opacity: .45; }
    .td-chk        { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--border);
                     background: transparent; cursor: pointer; flex-shrink: 0;
                     transition: all .15s; display: flex; align-items: center; justify-content: center;
                     font-size: 11px; color: transparent; }
    .td-chk:hover  { border-color: var(--accent); box-shadow: 0 0 8px rgba(88,166,255,.15); }
    .td-item.done .td-chk { background: var(--accent); border-color: var(--accent); color: #fff; }
    .td-text       { flex: 1; font-size: .92rem; }
    .td-rm         { background: none; border: none; color: var(--text-muted); cursor: pointer;
                     font-size: .85rem; opacity: 0; transition: opacity .12s, color .12s; padding: .25rem; }
    .td-item:hover .td-rm { opacity: 1; }
    .td-rm:hover   { color: var(--danger); }

    .td-footer     { display: flex; align-items: center; justify-content: space-between;
                     padding-top: .75rem; border-top: 1px solid var(--border); margin-top: .5rem; }
    .td-footer-msg { font-size: .82rem; color: var(--text-muted); }
    .td-footer-msg b { color: var(--accent); }

    .td-empty      { text-align: center; padding: 2.5rem 1rem; }
    .td-empty-icon { font-size: 2.5rem; margin-bottom: .5rem; opacity: .4; }
    .td-empty p    { color: var(--text-muted); font-size: .9rem; }

    @media (max-width: 768px) {
      .td-header     { flex-direction: column; align-items: stretch; }
      .td-stats      { justify-content: center; gap: 1rem; }
      .td-bar        { flex-direction: column; align-items: stretch; }
      .td-search     { width: 100%; }
      .td-pills      { justify-content: center; }
      .td-footer     { flex-direction: column; gap: .5rem; text-align: center; }
    }
    @media (max-width: 480px) {
      .td-stats      { gap: .75rem; }
      .td-stat-num   { font-size: 1.2rem; }
    }
  `,

  state: () => ({
    newTodo: '',
    filter: 'all',
    search: '',
    filtered: [],
    total: 0,
    done: 0,
    pending: 0,
  }),

  mounted() {
    const store = $.getStore('main');
    this._unsub = store.subscribe(() => this.setState({}));
  },

  destroyed() {
    if (this._unsub) this._unsub();
  },

  addTodo() {
    const text = this.state.newTodo.trim();
    if (!text) return;
    $.getStore('main').dispatch('addTodo', text);
    this.state.newTodo = '';
    this.state.search = '';
    this.state.filter = 'all';
    $.bus.emit('toast', { message: 'Todo added!', type: 'success' });
  },

  toggleTodo(id) {
    $.getStore('main').dispatch('toggleTodo', id);
  },

  removeTodo(id) {
    $.getStore('main').dispatch('removeTodo', id);
    $.bus.emit('toast', { message: 'Todo removed', type: 'error' });
  },

  clearCompleted() {
    $.getStore('main').dispatch('clearCompleted');
    $.bus.emit('toast', { message: 'Completed todos cleared', type: 'info' });
  },

  setFilter(f) {
    this.state.filter = f;
  },

  clearSearch() {
    this.state.search = '';
  },

  clearNewTodo() {
    this.state.newTodo = '';
  },

  render() {
    const store = $.getStore('main');
    const todos = store.state.todos;
    const { filter, search } = this.state;

    let list = todos;
    if (filter === 'active') list = todos.filter(t => !t.done);
    if (filter === 'done')   list = todos.filter(t => t.done);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t => t.text.toLowerCase().includes(q));
    }
    this.state.filtered = list;
    this.state.total    = store.getters.todoCount;
    this.state.done     = store.getters.doneCount;
    this.state.pending  = store.getters.pendingCount;

    const pct = this.state.total > 0 ? Math.round((this.state.done / this.state.total) * 100) : 0;

    return `
      <div class="page-header">
        <h1>Todos</h1>
        <p class="subtitle">Global store with <code>$.store()</code>, <code>z-for</code> + <code>z-key</code>, <code>z-class</code>, <code>z-if</code>, <code>z-debounce</code>, and <code>@keydown.escape</code>.</p>
      </div>

      <div class="card">
        <div class="td-header">
          <form class="td-form" style="flex:1;" @submit.prevent="addTodo">
            <input
              type="text"
              z-model="newTodo" z-trim
              placeholder="What needs to be done?"
              class="input"
              z-ref="todoInput"
              @keydown.escape="clearNewTodo"
            />
            <button type="submit" class="btn btn-primary">Add</button>
          </form>
          <div class="td-stats">
            <div class="td-stat">
              <span class="td-stat-num">${this.state.total}</span>
              <span class="td-stat-label">Total</span>
            </div>
            <div class="td-stat">
              <span class="td-stat-num">${this.state.done}</span>
              <span class="td-stat-label">Done</span>
            </div>
            <div class="td-stat">
              <span class="td-stat-num">${pct}%</span>
              <span class="td-stat-label">Complete</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        ${this.state.total > 0 ? `
          <div class="td-progress"><div class="td-progress-fill" style="width:${pct}%;"></div></div>
        ` : ''}

        <div class="td-bar">
          <div class="td-pills">
            <button class="td-pill" z-class="{'on': filter === 'all'}" @click="setFilter('all')">All ${this.state.total}</button>
            <button class="td-pill" z-class="{'on': filter === 'active'}" @click="setFilter('active')">Active ${this.state.pending}</button>
            <button class="td-pill" z-class="{'on': filter === 'done'}" @click="setFilter('done')">Done ${this.state.done}</button>
          </div>
          <input type="text" placeholder="Search…" class="input input-sm td-search" z-model="search" z-debounce="300" z-trim @keydown.escape="clearSearch" />
        </div>

        <div z-if="filtered.length === 0" class="td-empty">
          <div class="td-empty-icon">${this.state.total === 0 ? '📝' : '🔍'}</div>
          <p>${this.state.total === 0 ? 'No todos yet — type something above and hit Add!' : 'No matching todos for this filter.'}</p>
        </div>

        <ul z-else class="td-list">
          <li z-for="t in filtered" z-key="{{t.id}}" class="td-item {{t.done ? 'done' : ''}}">
            <button class="td-chk" @click="toggleTodo('{{t.id}}')">✓</button>
            <span class="td-text">{{$.escapeHtml(t.text)}}</span>
            <button class="td-rm" @click="removeTodo('{{t.id}}')">✕</button>
          </li>
        </ul>

        <div class="td-footer" z-show="done > 0">
          <span class="td-footer-msg"><b>${this.state.done}</b> completed · <b>${this.state.pending}</b> remaining</span>
          <button class="btn btn-ghost btn-sm" @click="clearCompleted">Clear done</button>
        </div>
      </div>
    `;
  }
});
