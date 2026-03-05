// scripts/components/todos.js — todo list with global store
//
// Demonstrates: $.getStore, store.dispatch, store.subscribe,
//               store getters, z-model, z-ref, @click with args,
//               mounted/destroyed lifecycle, $.bus toast, $.debounce,
//               conditional rendering, list rendering

$.component('todos-page', {
  state: () => ({
    newTodo: '',
    filter: 'all',      // 'all' | 'active' | 'done'
    search: '',
  }),

  mounted() {
    const store = $.getStore('main');
    // Subscribe to store changes — re-render when todos update
    this._unsub = store.subscribe(() => this.setState({}));

    // $.debounce — debounced search filter (300ms)
    this._debouncedSearch = $.debounce((val) => {
      this.state.search = val;
    }, 300);
  },

  destroyed() {
    // Clean up subscription to avoid memory leaks
    if (this._unsub) this._unsub();
  },

  addTodo() {
    const text = this.state.newTodo.trim();
    if (!text) return;
    const store = $.getStore('main');
    store.dispatch('addTodo', text);
    this.state.newTodo = '';
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

  onSearch(e) {
    this._debouncedSearch(e.target.value);
  },

  render() {
    const store = $.getStore('main');
    const todos = store.state.todos;
    const { filter, search } = this.state;

    // Filter todos
    let filtered = todos;
    if (filter === 'active') filtered = todos.filter(t => !t.done);
    if (filter === 'done')   filtered = todos.filter(t => t.done);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(t => t.text.toLowerCase().includes(q));
    }

    const total   = store.getters.todoCount;
    const done    = store.getters.doneCount;
    const pending = store.getters.pendingCount;

    return `
      <div class="page-header">
        <h1>Todos</h1>
        <p class="subtitle">Global store with <code>$.store()</code>, actions, getters, and <code>subscribe()</code>.</p>
      </div>

      <div class="card">
        <form class="todo-form" @submit.prevent="addTodo">
          <input
            type="text"
            z-model="newTodo" z-trim
            placeholder="What needs to be done?"
            class="input"
            z-ref="todoInput"
          />
          <button type="submit" class="btn btn-primary">Add</button>
        </form>
      </div>

      <div class="card">
        <div class="todo-toolbar">
          <div class="todo-filters">
            <button class="btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-ghost'}" @click="setFilter('all')">All (${total})</button>
            <button class="btn btn-sm ${filter === 'active' ? 'btn-primary' : 'btn-ghost'}" @click="setFilter('active')">Active (${pending})</button>
            <button class="btn btn-sm ${filter === 'done' ? 'btn-primary' : 'btn-ghost'}" @click="setFilter('done')">Done (${done})</button>
          </div>
          <input type="text" placeholder="Search…" class="input input-sm" @input="onSearch" value="${$.escapeHtml(this.state.search)}" />
        </div>

        ${filtered.length === 0 ? `
          <div class="empty-state">
            <p>${total === 0 ? 'No todos yet — add one above!' : 'No matching todos.'}</p>
          </div>
        ` : `
          <ul class="todo-list">
            ${filtered.map(t => `
              <li class="todo-item ${t.done ? 'done' : ''}">
                <button class="todo-check" @click="toggleTodo('${t.id}')"></button>
                <span class="todo-text">${$.escapeHtml(t.text)}</span>
                <button class="todo-remove" @click="removeTodo('${t.id}')">✕</button>
              </li>
            `).join('')}
          </ul>
        `}

        ${done > 0 ? `
          <div class="todo-footer">
            <button class="btn btn-ghost btn-sm" @click="clearCompleted">Clear completed (${done})</button>
          </div>
        ` : ''}
      </div>
    `;
  }
});
