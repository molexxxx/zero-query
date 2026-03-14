// contacts.js — Contact book page
//
// Features used:
//   templateUrl / styleUrl  — external template & scoped styles
//   z-if / z-show / z-for   — conditional & list rendering
//   z-model / z-ref          — form bindings
//   @click / @submit.prevent — event handling
//   @keydown.escape          — keyboard modifier
//   $.getStore / dispatch    — store integration
//   $.bus.emit('toast')      — notifications

$.component('contacts-page', {
  templateUrl: 'contacts.html',
  styleUrl:    'contacts.css',

  state: () => ({
    contacts: [],
    showAddModal: false,
    newName: '',
    newEmail: '',
    newRole: 'Developer',
    newPhone: '',
    newBio: '',
    nameError: '',
    emailError: '',
    modalId: null,
    confirmDeleteId: null,
    totalAdded: 0,
    favoriteCount: 0,
    filterText: '',
    filterRole: '',
    // Derived state (not computed — external templates resolve state only)
    filteredContacts: [],
    modalContact: null,
  }),

  watch: {
    filterText() { this._recompute(); },
    filterRole() { this._recompute(); },
    modalId()    { this._recompute(); },
  },

  mounted() {
    const store = $.getStore('main');
    this._syncFromStore(store);
    this._unsub = store.subscribe(() => this._syncFromStore(store));

    // Global Escape handler — template @keydown.escape on overlays is
    // unreliable when no child element has focus (detail modal has no inputs).
    this._onEscape = (e) => {
      if (e.key !== 'Escape') return;
      if (this.state.showAddModal)       { this.closeAddModal(); e.stopPropagation(); }
      else if (this.state.modalId != null) { this.closeModal();    e.stopPropagation(); }
    };
    document.addEventListener('keydown', this._onEscape);
  },

  destroyed() {
    if (this._unsub) this._unsub();
    if (this._onEscape) document.removeEventListener('keydown', this._onEscape);
  },

  _syncFromStore(store) {
    // Shallow-clone each contact so the framework detects new references
    // (store actions mutate objects in place — same refs won't trigger re-render)
    this.state.contacts      = store.state.contacts.map(c => ({ ...c }));
    this.state.totalAdded    = store.state.contactsAdded;
    this.state.favoriteCount = store.getters.favoriteCount;
    this._recompute();
  },

  /** Recalculate derived state from current contacts + filter values. */
  _recompute() {
    let list = this.state.contacts;
    const q = this.state.filterText.toLowerCase();
    if (q) list = list.filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
    if (this.state.filterRole) list = list.filter(c => c.role === this.state.filterRole);
    this.state.filteredContacts = list;

    this.state.modalContact = this.state.modalId != null
      ? this.state.contacts.find(c => c.id === this.state.modalId) || null
      : null;
  },

  // -- Add-contact modal --

  openAddModal() {
    this.state.showAddModal = true;
  },

  closeAddModal() {
    this.state.showAddModal = false;
    this._clearForm();
  },

  _validateName(name) {
    if (!name) return 'Name is required.';
    if (name.length < 2) return 'At least 2 characters.';
    return '';
  },

  _validateEmail(email) {
    if (!email) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email.';
    const store = $.getStore('main');
    if (store.state.contacts.some(c => c.email.toLowerCase() === email.toLowerCase())) {
      return 'Email already exists.';
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
      role:  this.state.newRole,
      phone: this.state.newPhone.trim(),
      bio:   this.state.newBio.trim(),
    });

    this._clearForm();
    this.state.showAddModal = false;
    $.bus.emit('toast', { message: `${name} added!`, type: 'success' });
  },

  // -- Detail modal --

  openModal(id) {
    this.state.modalId = Number(id);
    this.state.confirmDeleteId = null;
  },

  closeModal() {
    this.state.modalId = null;
    this.state.confirmDeleteId = null;
  },

  // -- Actions --

  toggleFavorite(id) {
    $.getStore('main').dispatch('toggleFavorite', Number(id));
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
    this.state.modalId = null;
    this.state.confirmDeleteId = null;
    $.bus.emit('toast', { message: `${c ? c.name : 'Contact'} removed`, type: 'error' });
  },

  cycleStatus(id) {
    $.getStore('main').dispatch('cycleContactStatus', Number(id));
  },

  setFilter(role) {
    this.state.filterRole = this.state.filterRole === role ? '' : role;
  },

  _clearForm() {
    this.state.newName    = '';
    this.state.newEmail   = '';
    this.state.newRole    = 'Developer';
    this.state.newPhone   = '';
    this.state.newBio     = '';
    this.state.nameError  = '';
    this.state.emailError = '';
  },
});
