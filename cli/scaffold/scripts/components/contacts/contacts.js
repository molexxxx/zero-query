// scripts/components/contacts/contacts.js — contact book
//
// Demonstrates: external templateUrl + styleUrl, z-if/z-else, z-for,
//               z-show, z-bind/:attr, z-class, z-style, z-text, z-html,
//               z-model, z-ref, z-cloak, @click, @submit.prevent,
//               @input.debounce, event modifiers, and template {{expressions}}
//
// This component uses external files for its template and styles,
// resolved automatically relative to this JS file's location.
// Contacts are persisted in the global $.store('main') so they
// survive navigation between routes.

$.component('contacts-page', {
  templateUrl: 'contacts.html',
  styleUrl:    'contacts.css',

  state: () => ({
    contacts: [],
    showForm: false,
    newName: '',
    newEmail: '',
    newRole: 'Developer',
    nameError: '',
    emailError: '',
    selectedId: null,
    selectedName: '',
    selectedEmail: '',
    selectedStatus: '',
    confirmDeleteId: null,
    totalAdded: 0,
    favoriteCount: 0,
  }),

  mounted() {
    const store = $.getStore('main');
    this._syncFromStore(store);
    this._unsub = store.subscribe(() => this._syncFromStore(store));
  },

  destroyed() {
    if (this._unsub) this._unsub();
  },

  _syncFromStore(store) {
    this.state.contacts      = store.state.contacts;
    this.state.totalAdded    = store.state.contactsAdded;
    this.state.favoriteCount = store.getters.favoriteCount;
    this._syncSelected();
  },

  // -- Actions --

  toggleForm() {
    this.state.showForm = !this.state.showForm;
    if (!this.state.showForm) this._clearForm();
  },

  _validateName(name) {
    if (!name) return 'Name is required.';
    if (name.length < 2) return 'Name must be at least 2 characters.';
    return '';
  },

  _validateEmail(email) {
    if (!email) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';
    const store = $.getStore('main');
    if (store.state.contacts.some(c => c.email.toLowerCase() === email.toLowerCase())) {
      return 'A contact with this email already exists.';
    }
    return '';
  },

  validateName() {
    this.state.nameError = this._validateName(this.state.newName.trim());
  },

  validateEmail() {
    this.state.emailError = this._validateEmail(this.state.newEmail.trim());
  },

  addContact() {
    const name  = this.state.newName.trim();
    const email = this.state.newEmail.trim();

    const nameError  = this._validateName(name);
    const emailError = this._validateEmail(email);
    this.state.nameError  = nameError;
    this.state.emailError = emailError;
    if (nameError || emailError) return;

    $.getStore('main').dispatch('addContact', {
      name,
      email,
      role: this.state.newRole,
    });

    this._clearForm();
    this.state.showForm = false;
    $.bus.emit('toast', { message: `${name} added!`, type: 'success' });
  },

  toggleFavorite(id) {
    $.getStore('main').dispatch('toggleFavorite', Number(id));
  },

  selectContact(id) {
    const numId = Number(id);
    this.state.selectedId = this.state.selectedId === numId ? null : numId;
    this.state.confirmDeleteId = null;
    this._syncSelected();
  },

  confirmDelete(id) {
    this.state.confirmDeleteId = Number(id);
  },

  cancelDelete() {
    this.state.confirmDeleteId = null;
  },

  deleteContact(id) {
    const numId = Number(id);
    const store = $.getStore('main');
    const c = store.state.contacts.find(c => c.id === numId);
    store.dispatch('deleteContact', numId);
    this.state.selectedId = null;
    this.state.confirmDeleteId = null;
    $.bus.emit('toast', { message: `${c ? c.name : 'Contact'} removed`, type: 'error' });
  },

  cycleStatus(id) {
    $.getStore('main').dispatch('cycleContactStatus', Number(id));
    this._syncSelected();
  },

  _syncSelected() {
    const c = this.state.selectedId != null
      ? this.state.contacts.find(c => c.id === this.state.selectedId)
      : null;
    this.state.selectedName   = c ? c.name : '';
    this.state.selectedEmail  = c ? c.email : '';
    this.state.selectedStatus = c ? c.status : '';
  },

  _clearForm() {
    this.state.newName   = '';
    this.state.newEmail  = '';
    this.state.newRole   = 'Developer';
    this.state.nameError = '';
    this.state.emailError = '';
  },
});
