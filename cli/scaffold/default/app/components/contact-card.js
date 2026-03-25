// contact-card.js - Global contact detail popup
//
// Always-mounted overlay that listens for $.bus 'openContact' events.
// Works from any page without navigation.
//
// Features used:
//   $.bus.on / $.bus.emit   - event-driven communication
//   $.getStore              - read contact data from store
//   @click.self             - dismiss on backdrop click

$.component('contact-card', {
  styles: `
    /* Overlay */
    .cc-overlay {
      position: fixed; inset: 0; z-index: 300;
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      animation: cc-fade 0.15s ease;
    }
    @keyframes cc-fade { from { opacity: 0 } to { opacity: 1 } }

    /* Card */
    .cc-card {
      position: relative; width: 400px;
      max-width: calc(100vw - 2rem); max-height: calc(100vh - 4rem);
      overflow-y: auto;
      background: var(--bg-surface); border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: 0 24px 64px rgba(0,0,0,0.35);
      animation: cc-pop 0.2s var(--ease-out);
    }
    @keyframes cc-pop {
      from { opacity: 0; transform: scale(0.95) translateY(10px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }

    /* Strip */
    .cc-strip { height: 4px; border-radius: var(--radius-lg) var(--radius-lg) 0 0;
                transition: background 0.3s ease, box-shadow 0.3s ease, opacity 0.3s ease; }
    .cc-strip-online  { background: var(--success); box-shadow: 0 0 12px rgba(63,185,80,0.3); }
    .cc-strip-away    { background: var(--warning); }
    .cc-strip-offline { background: var(--text-muted); opacity: 0.3; }

    /* Close */
    .cc-close {
      position: absolute; top: 0.75rem; right: 0.75rem;
      width: 28px; height: 28px; border-radius: 50%; border: none;
      background: var(--bg-hover); color: var(--text-muted);
      font-size: 0.85rem; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.12s ease; z-index: 1;
    }
    .cc-close:hover { background: var(--danger); color: #fff; }

    /* Profile */
    .cc-profile {
      display: flex; flex-direction: column; align-items: center;
      padding: 1.75rem 1.5rem 1rem; position: relative;
    }
    .cc-avatar {
      width: 72px; height: 72px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 1.6rem; color: #fff;
      text-transform: uppercase;
      box-shadow: 0 4px 16px rgba(0,0,0,0.25);
      margin-bottom: 0.75rem;
    }
    .cc-dot {
      width: 14px; height: 14px; border-radius: 50%;
      border: 3px solid var(--bg-surface);
      position: absolute; top: calc(1.75rem + 56px); left: calc(50% + 22px);
      transition: background 0.3s ease, box-shadow 0.3s ease;
    }
    .cc-dot-online  { background: var(--success); box-shadow: 0 0 8px rgba(63,185,80,0.5); }
    .cc-dot-away    { background: var(--warning); }
    .cc-dot-offline { background: var(--text-muted); }

    .cc-profile h2 { font-size: 1.2rem; font-weight: 700; margin: 0 0 0.25rem; }
    .cc-role {
      font-size: 0.72rem; font-weight: 600; padding: 0.2rem 0.6rem;
      border-radius: 999px; text-transform: uppercase; letter-spacing: 0.04em;
    }
    .cc-role-developer { background: rgba(96,165,250,0.12); color: #60a5fa; }
    .cc-role-designer  { background: rgba(168,85,247,0.12); color: #a855f7; }
    .cc-role-manager   { background: rgba(52,211,153,0.12); color: #34d399; }
    .cc-role-qa        { background: rgba(251,191,36,0.12); color: #fbbf24; }

    /* Details grid */
    .cc-details {
      display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;
      padding: 0 1.5rem; margin-top: 0.5rem;
    }
    .cc-field  { display: flex; flex-direction: column; gap: 0.15rem; }
    .cc-label  { font-size: 0.68rem; font-weight: 600; text-transform: uppercase;
                 letter-spacing: 0.04em; color: var(--text-muted); }
    .cc-value  { font-size: 0.85rem; color: var(--text); word-break: break-word; }
    .cc-status { text-transform: capitalize; transition: color 0.3s ease; }

    /* Bio */
    .cc-bio    { padding: 0.75rem 1.5rem 0; }
    .cc-bio p  { font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; margin-top: 0.2rem; }

    /* Actions */
    .cc-actions { display: flex; gap: 0.4rem; padding: 1rem 1.5rem 1.25rem; flex-wrap: wrap; }

    /* Shared button styles (self-contained) */
    .cc-btn {
      padding: 0.4rem 0.85rem; font-size: 0.78rem; font-weight: 600;
      border-radius: var(--radius); border: 1px solid var(--border);
      background: transparent; color: var(--text-muted); cursor: pointer;
      font-family: inherit; transition: all 0.12s ease;
    }
    .cc-btn:hover { background: var(--bg-hover); color: var(--text); }
    .cc-btn-accent { border-color: var(--accent); color: var(--accent); }
    .cc-btn-accent:hover { background: var(--accent); color: #fff; }

    /* "View in Contacts" link */
    .cc-goto { font-size: 0.72rem; color: var(--text-muted); margin-left: auto;
               text-decoration: none; transition: color 0.15s ease; cursor: pointer; }
    .cc-goto:hover { color: var(--accent); }

    @media (max-width: 480px) {
      .cc-details { grid-template-columns: 1fr; }
      .cc-actions { justify-content: center; }
    }
  `,

  state: () => ({
    contact: null,
  }),

  mounted() {
    this._onOpen = (id) => {
      const store = $.getStore('main');
      if (!store) return;
      const c = store.state.contacts.find(c => c.id === Number(id));
      if (c) this.state.contact = { ...c };
    };
    $.bus.on('openContact', this._onOpen);

    this._onEsc = (e) => {
      if (e.key === 'Escape' && this.state.contact) {
        this.state.contact = null;
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', this._onEsc);

    // Keep card in sync when store changes (e.g. status cycle, favorite toggle)
    const store = $.getStore('main');
    if (store) {
      this._unsub = store.subscribe(() => {
        if (!this.state.contact) return;
        const c = store.state.contacts.find(c => c.id === this.state.contact.id);
        if (c) this.state.contact = { ...c };
        else this.state.contact = null; // deleted
      });
    }
  },

  destroyed() {
    if (this._onOpen) $.bus.off('openContact', this._onOpen);
    if (this._onEsc) document.removeEventListener('keydown', this._onEsc);
    if (this._unsub) this._unsub();
  },

  close() { this.state.contact = null; },

  toggleFav() {
    if (!this.state.contact) return;
    $.getStore('main').dispatch('toggleFavorite', this.state.contact.id);
  },

  cycleStatus() {
    if (!this.state.contact) return;
    $.getStore('main').dispatch('cycleContactStatus', this.state.contact.id);
  },

  goToContacts() {
    this.state.contact = null;
    $.getRouter().navigate('/contacts');
  },

  render() {
    const c = this.state.contact;
    if (!c) return '';

    const hue = (c.name.charCodeAt(0) * 7) % 360;

    return `
      <div class="cc-overlay" @click.self="close">
        <div class="cc-card">
          <div class="cc-strip cc-strip-${c.status}"></div>
          <button class="cc-close" @click="close">✕</button>

          <div class="cc-profile">
            <div class="cc-avatar" style="background:hsl(${hue},55%,42%)">
              ${c.name.charAt(0).toUpperCase()}
            </div>
            <div class="cc-dot cc-dot-${c.status}"></div>
            <h2>${$.escapeHtml(c.name)}</h2>
            <span class="cc-role cc-role-${c.role.toLowerCase()}">${$.escapeHtml(c.role)}</span>
          </div>

          <div class="cc-details">
            <div class="cc-field">
              <span class="cc-label">Email</span>
              <span class="cc-value">${$.escapeHtml(c.email)}</span>
            </div>
            ${c.phone ? `<div class="cc-field"><span class="cc-label">Phone</span><span class="cc-value">${$.escapeHtml(c.phone)}</span></div>` : ''}
            ${c.location ? `<div class="cc-field"><span class="cc-label">Location</span><span class="cc-value">${$.escapeHtml(c.location)}</span></div>` : ''}
            ${c.joined ? `<div class="cc-field"><span class="cc-label">Joined</span><span class="cc-value">${$.escapeHtml(c.joined)}</span></div>` : ''}
            <div class="cc-field">
              <span class="cc-label">Status</span>
              <span class="cc-value cc-status">${c.status}</span>
            </div>
          </div>

          ${c.bio ? `<div class="cc-bio"><span class="cc-label">Bio</span><p>${$.escapeHtml(c.bio)}</p></div>` : ''}

          <div class="cc-actions">
            <button class="cc-btn" @click="toggleFav">${c.favorite ? '★ Favorited' : '☆ Favorite'}</button>
            <button class="cc-btn" @click="cycleStatus">Cycle Status</button>
            <a class="cc-goto" @click="goToContacts">View in Contacts →</a>
          </div>
        </div>
      </div>
    `;
  }
});
