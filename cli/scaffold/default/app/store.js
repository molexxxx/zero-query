// store.js - Global state management
//
// Defines a centralized store with state, actions, and getters.
// Any component can access it via $.getStore('main').
// Dispatch actions to update state; subscribe to react to changes.

export const store = $.store('main', {
  state: {
    todos: [],
    visits: 0,

    // Contacts
    contacts: [
      { id: 1, name: 'Tony Wiedman',     email: 'tony@z-query.com',     role: 'Developer', status: 'online',  favorite: true,  phone: '+1 (555) 201-0017', location: 'Philadelphia, PA', joined: '2024-01-15', bio: 'Full-stack developer & creator of zQuery.' },
      { id: 2, name: 'Robert Baratheon', email: 'robert@stormlands.io', role: 'Manager',   status: 'offline', favorite: false, phone: '+1 (555) 783-1042', location: "Storm's End, Westeros", joined: '2024-03-22', bio: 'Former king turned project manager.' },
      { id: 3, name: 'Terry A. Davis',   email: 'terry@templeos.net',   role: 'Developer', status: 'online',  favorite: true,  phone: '+1 (555) 640-8086', location: 'Las Vegas, NV', joined: '2024-02-10', bio: 'Built an entire OS from scratch. Legendary.' },
      { id: 4, name: 'Trevor Moore',     email: 'trevor@wkuk.tv',       role: 'Designer',  status: 'away',    favorite: false, phone: '+1 (555) 994-2287', location: 'Los Angeles, CA', joined: '2024-05-08', bio: 'Comedian, writer, and creative visionary.' },
      { id: 5, name: 'Carlo Acutis',     email: 'carlo@vatican.va',     role: 'Developer', status: 'online',  favorite: false, phone: '+39 (02) 555-1430', location: 'Milan, Italy', joined: '2024-04-01', bio: 'Patron saint of the internet.' },
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

    addContact(state, { name, email, role, phone, location, bio }) {
      const cities = ['New York, NY', 'San Francisco, CA', 'Austin, TX', 'Seattle, WA', 'Chicago, IL', 'Denver, CO', 'Portland, OR', 'Boston, MA'];
      state.contacts.push({
        id:       Date.now(),
        name,
        email,
        role,
        status:   'offline',
        favorite: false,
        phone:    phone || '',
        location: location || cities[Math.floor(Math.random() * cities.length)],
        joined:   new Date().toISOString().slice(0, 10),
        bio:      bio || '',
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
