// store.js — global store for the demo
export const store = $.store({
  state: {
    theme: 'dark',
    visits: 0,
    todos: [
      { id: 1, text: 'Try zQuery selectors', done: true },
      { id: 2, text: 'Build a component', done: false },
      { id: 3, text: 'Set up the router', done: false },
    ],
  },
  actions: {
    incrementVisits(state) { state.visits++; },
    addTodo(state, text) {
      const raw = state.todos.__raw || state.todos;
      state.todos = [...raw, { id: Date.now(), text, done: false }];
    },
    toggleTodo(state, id) {
      const raw = state.todos.__raw || state.todos;
      state.todos = raw.map(t => t.id === id ? { ...t, done: !t.done } : t);
    },
    removeTodo(state, id) {
      const raw = state.todos.__raw || state.todos;
      state.todos = raw.filter(t => t.id !== id);
    },
  },
  getters: {
    todoCount: (state) => state.todos.length,
    doneCount: (state) => state.todos.filter(t => t.done).length,
  },
  debug: true,
});

export default store;
