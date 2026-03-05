// scripts/components/todos.js — todo list with global store
//
// Demonstrates: $.getStore, store.dispatch, store.subscribe,
//               store getters, z-model, z-ref, z-class, z-for,
//               z-if, z-show, @click with args, @submit.prevent,
//               mounted/destroyed lifecycle, $.bus toast, $.debounce

$.component('todos-page', {
  state: () => ({
    newTodo: '',
    filter: 'all',      // 'all' | 'active' | 'done'
    search: '',
    filtered: [],        // computed in render() for z-for access
    total: 0,
    done: 0,
    pending: 0,
  }),

  mounted() {
    const store = $.getStore('main');
    this._unsub = store.subscribe(() => this.setState({}));

    // $.debounce — debounced search filter (300ms)
    this._debouncedSearch = $.debounce((val) => {
      this.state.search = val;
    }, 300);
  },

  destroyed() {
    if (this._unsub) this._unsub();
  },

  addTodo() {
    const text = this.state.newTodo.trim();
    if (!text) return;
    $.getStore('main').dispatch('addTodo', text);
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

    // Compute filtered list and store stats into state for directive access
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

    return `
      <div class="page-header">
        <h1>Todos</h1>
        <p class="subtitle">Global store with <code>$.store()</code>, <code>z-for</code>, <code>z-class</code>, <code>z-if</code>, and <code>z-show</code>.</p>
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
            <button class="btn btn-sm" z-class="{'btn-primary': filter === 'all', 'btn-ghost': filter !== 'all'}" @click="setFilter('all')">All (${this.state.total})</button>
            <button class="btn btn-sm" z-class="{'btn-primary': filter === 'active', 'btn-ghost': filter !== 'active'}" @click="setFilter('active')">Active (${this.state.pending})</button>
            <button class="btn btn-sm" z-class="{'btn-primary': filter === 'done', 'btn-ghost': filter !== 'done'}" @click="setFilter('done')">Done (${this.state.done})</button>
          </div>
          <input type="text" placeholder="Search…" class="input input-sm" @input="onSearch" value="${$.escapeHtml(this.state.search)}" />
        </div>

        <div z-if="filtered.length === 0" class="empty-state">
          <p>${this.state.total === 0 ? 'No todos yet — add one above!' : 'No matching todos.'}</p>
        </div>

        <ul z-else class="todo-list">
          <li z-for="t in filtered" class="todo-item {{t.done ? 'done' : ''}}">
            <button class="todo-check" @click="toggleTodo('{{t.id}}')"></button>
            <span class="todo-text">{{$.escapeHtml(t.text)}}</span>
            <button class="todo-remove" @click="removeTodo('{{t.id}}')">✕</button>
          </li>
        </ul>

        <div class="todo-footer" z-show="done > 0">
          <button class="btn btn-ghost btn-sm" @click="clearCompleted">Clear completed (${this.state.done})</button>
        </div>
      </div>
    `;
  }
});
