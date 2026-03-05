// scripts/components/contacts/contacts.js — contact book
//
// Demonstrates: external templateUrl + styleUrl, z-if/z-else, z-for,
//               z-show, z-bind/:attr, z-class, z-style, z-text, z-html,
//               z-model, z-ref, z-cloak, @click, @submit.prevent,
//               @input.debounce, event modifiers, and template {{expressions}}
//
// This component uses external files for its template and styles,
// resolved automatically relative to this JS file's location.

$.component('contacts-page', {
  templateUrl: 'contacts.html',
  styleUrl:    'contacts.css',

  state: () => ({
    contacts: [
      { id: 1, name: 'Alice Johnson',  email: 'alice@example.com',  role: 'Designer',  status: 'online',  favorite: true  },
      { id: 2, name: 'Bob Martinez',   email: 'bob@example.com',    role: 'Developer', status: 'offline', favorite: false },
      { id: 3, name: 'Carol White',    email: 'carol@example.com',  role: 'Manager',   status: 'online',  favorite: true  },
      { id: 4, name: 'Dave Kim',       email: 'dave@example.com',   role: 'Designer',  status: 'away',    favorite: false },
      { id: 5, name: 'Eve Torres',     email: 'eve@example.com',    role: 'Developer', status: 'online',  favorite: false },
    ],
    showForm: false,
    newName: '',
    newEmail: '',
    newRole: 'Developer',
    selectedId: null,
    confirmDeleteId: null,
    totalAdded: 0,
  }),

  // -- Actions --

  toggleForm() {
    this.state.showForm = !this.state.showForm;
    if (!this.state.showForm) this._clearForm();
  },

  addContact() {
    const name  = this.state.newName.trim();
    const email = this.state.newEmail.trim();
    if (!name || !email) return;

    this.state.contacts.push({
      id:       Date.now(),
      name,
      email,
      role:     this.state.newRole,
      status:   'offline',
      favorite: false,
    });

    this._clearForm();
    this.state.showForm = false;
    this.state.totalAdded++;
    $.bus.emit('toast', { message: `${name} added!`, type: 'success' });
  },

  toggleFavorite(id) {
    const c = this.state.contacts.find(c => c.id === Number(id));
    if (c) c.favorite = !c.favorite;
  },

  selectContact(id) {
    this.state.selectedId = this.state.selectedId === Number(id) ? null : Number(id);
    this.state.confirmDeleteId = null;
  },

  confirmDelete(id) {
    this.state.confirmDeleteId = Number(id);
  },

  cancelDelete() {
    this.state.confirmDeleteId = null;
  },

  deleteContact(id) {
    const c = this.state.contacts.find(c => c.id === Number(id));
    this.state.contacts = this.state.contacts.filter(c => c.id !== Number(id));
    this.state.selectedId = null;
    this.state.confirmDeleteId = null;
    $.bus.emit('toast', { message: `${c ? c.name : 'Contact'} removed`, type: 'error' });
  },

  cycleStatus(id) {
    const c = this.state.contacts.find(c => c.id === Number(id));
    if (!c) return;
    const order = ['online', 'away', 'offline'];
    c.status = order[(order.indexOf(c.status) + 1) % 3];
  },

  _clearForm() {
    this.state.newName  = '';
    this.state.newEmail = '';
    this.state.newRole  = 'Developer';
  },
});
