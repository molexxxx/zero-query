// scripts/store.js — global state management
//
// $.store() creates a centralized store with state, actions, and getters.
// Components can dispatch actions and subscribe to changes.
// The store is accessible anywhere via $.getStore('main').

export const store = $.store('main', {
  state: {
    todos: [],
    visits: 0,

    // Contacts
    contacts: [
      { id: 1, name: 'Alice Johnson',  email: 'alice@example.com',  role: 'Designer',  status: 'online',  favorite: true  },
      { id: 2, name: 'Bob Martinez',   email: 'bob@example.com',    role: 'Developer', status: 'offline', favorite: false },
      { id: 3, name: 'Carol White',    email: 'carol@example.com',  role: 'Manager',   status: 'online',  favorite: true  },
      { id: 4, name: 'Dave Kim',       email: 'dave@example.com',   role: 'Designer',  status: 'away',    favorite: false },
      { id: 5, name: 'Eve Torres',     email: 'eve@example.com',    role: 'Developer', status: 'online',  favorite: false },
    ],
    contactsAdded: 0,
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

    // -- Contact actions --

    addContact(state, { name, email, role }) {
      state.contacts.push({
        id:       Date.now(),
        name,
        email,
        role,
        status:   'offline',
        favorite: false,
      });
      state.contactsAdded++;
    },

    deleteContact(state, id) {
      state.contacts = state.contacts.filter(c => c.id !== id);
    },

    toggleFavorite(state, id) {
      const c = state.contacts.find(c => c.id === id);
      if (c) c.favorite = !c.favorite;
    },

    cycleContactStatus(state, id) {
      const c = state.contacts.find(c => c.id === id);
      if (!c) return;
      const order = ['online', 'away', 'offline'];
      c.status = order[(order.indexOf(c.status) + 1) % 3];
    },
  },

  getters: {
    todoCount:    (state) => state.todos.length,
    doneCount:    (state) => state.todos.filter(t => t.done).length,
    pendingCount: (state) => state.todos.filter(t => !t.done).length,

    contactCount:    (state) => state.contacts.length,
    favoriteCount:   (state) => state.contacts.filter(c => c.favorite).length,
  },

  debug: true,  // logs dispatches to console in development
});
