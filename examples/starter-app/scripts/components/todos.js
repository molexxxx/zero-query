import { store } from '../store.js';

$.component('todos-page', {
  state: { newTodo: '' },

  addTodo() {
    const text = this.state.newTodo.trim();
    if (!text) return;
    store.dispatch('addTodo', text);
    this.state.newTodo = '';
  },

  toggleTodo(e, id) { store.dispatch('toggleTodo', Number(id)); },
  removeTodo(e, id) { store.dispatch('removeTodo', Number(id)); },

  render() {
    const todos = store.state.todos.__raw || store.state.todos;
    const total = todos.length;
    const done = todos.filter(t => t.done).length;

    return `
      <div>
        <div class="card">
          <h2>Todo List <span class="badge">${done}/${total}</span></h2>
          <p>Powered by the global store — state persists across route changes.</p>

          <div class="mt flex">
            <input z-model="newTodo" placeholder="Add a new todo..." z-ref="todoInput">
            <button @click="addTodo">Add</button>
          </div>

          <div class="mt">
            ${todos.map(todo => `
              <div class="todo-item ${todo.done ? 'done' : ''}">
                <input type="checkbox" ${todo.done ? 'checked' : ''} @click="toggleTodo(${todo.id})">
                <span>${todo.text}</span>
                <button class="danger" style="padding:0.25rem 0.5rem;font-size:0.8rem;" @click="removeTodo(${todo.id})">✕</button>
              </div>
            `).join('')}
          </div>

          ${total === 0 ? '<p class="mt" style="color:#484f58;text-align:center;">No todos yet. Add one above!</p>' : ''}
        </div>
      </div>
    `;
  },

  mounted() {
    this._unsub = store.subscribe('todos', () => {
      if (!this._destroyed) this._scheduleUpdate();
    });
  },

  destroyed() {
    if (this._unsub) this._unsub();
  }
});
