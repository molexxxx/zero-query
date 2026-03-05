// scripts/store.js — global state management
//
// $.store() creates a centralized store with state, actions, and getters.
// Components can dispatch actions and subscribe to changes.
// The store is accessible anywhere via $.getStore('main').

export const store = $.store('main', {
  state: {
    todos: [],
    visits: 0,
  },

  actions: {
    // Increment the global visit counter
    incrementVisits(state) {
      state.visits++;
    },

    // Add a new todo item using $.uuid() for unique IDs
    addTodo(state, text) {
      state.todos.push({
        id: $.uuid(),
        text: text.trim(),
        done: false,
        createdAt: Date.now(),
      });
    },

    // Toggle a todo's completion status
    toggleTodo(state, id) {
      const todo = state.todos.find(t => t.id === id);
      if (todo) todo.done = !todo.done;
    },

    // Remove a todo by ID
    removeTodo(state, id) {
      state.todos = state.todos.filter(t => t.id !== id);
    },

    // Clear all completed todos
    clearCompleted(state) {
      state.todos = state.todos.filter(t => !t.done);
    },
  },

  getters: {
    todoCount:    (state) => state.todos.length,
    doneCount:    (state) => state.todos.filter(t => t.done).length,
    pendingCount: (state) => state.todos.filter(t => !t.done).length,
  },

  debug: true,  // logs dispatches to console in development
});
