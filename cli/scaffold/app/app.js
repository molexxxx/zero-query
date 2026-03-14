// app/app.js — application entry point
//
// This file bootstraps the zQuery app: imports all components,
// sets up routing, wires the responsive nav, and demonstrates
// several core APIs: $.router, $.ready, $.bus, $.on, $.storage,
// router.afterEach, and $.create.

import './store.js';
import './components/home.js';
import './components/counter.js';
import './components/todos.js';
import './components/api-demo.js';
import './components/playground/playground.js';
import './components/toolkit/toolkit.js';
import './components/about.js';
import './components/contact-card.js';
import './components/contacts/contacts.js';
import './components/not-found.js';
import { routes } from './routes.js';

// ---------------------------------------------------------------------------
// Router — SPA navigation with history mode
// ---------------------------------------------------------------------------
const router = $.router({
  el: '#app',   //@ Mount point (Set in index.html)
  routes,
  fallback: 'not-found',
  mode: 'history'
});

// Post-navigation hook — track page views on every navigation
router.afterEach((to) => {
  const store = $.getStore('main');
  if (store) store.dispatch('incrementVisits');
  console.log('📊 Navigated to:', to.path);
});

// Highlight the active nav link on every route change
router.onChange((to) => {
  $.all('.nav-link').removeClass('active');
  $(`.nav-link[z-link="${to.path}"]`).addClass('active');

  // Close mobile menu on navigate
  closeMobileMenu();
});

// ---------------------------------------------------------------------------
// Responsive sidebar toggle
// ---------------------------------------------------------------------------
const $sidebar = $('#sidebar');
const $overlay = $('#overlay');
const $toggle  = $('#menu-toggle');

function toggleMobileMenu(open) {
  $sidebar.toggleClass('open', open);
  $overlay.toggleClass('visible', open);
  $toggle.toggleClass('active', open);
}

function closeMobileMenu() { toggleMobileMenu(false); }

// $.on — global delegated event listeners
$.on('click', '#menu-toggle', () => toggleMobileMenu(!$sidebar.hasClass('open')));
$.on('click', '#overlay', closeMobileMenu);

// Close sidebar on Escape key — using $.on direct (no selector needed)
$.on('keydown', (e) => {
  if (e.key === 'Escape') closeMobileMenu();
});

// ---------------------------------------------------------------------------
// Sidebar stats panel — collapsible, live-updating from $.store
// Starts expanded by default. Open/closed state saved via $.storage.
// ---------------------------------------------------------------------------
$.on('click', '#stats-toggle', () => {
  const $body  = $('#stats-body');
  const $arrow = $('#stats-arrow');
  if (!$body.length) return;
  const open = $body.css('display') !== 'none';
  open ? $body.hide() : $body.show();
  $arrow.toggleClass('open', !open);
  $.storage.set('statsOpen', !open);
});

function updateSidebarStats() {
  const store = $.getStore('main');
  if (!store) return;
  $('#ss-visits').text(store.state.visits);
  $('#ss-todos').text(store.getters.todoCount);
  $('#ss-pending').text(store.getters.pendingCount);
  $('#ss-done').text(store.getters.doneCount);
  $('#ss-contacts').text(store.getters.contactCount);
  $('#ss-favorites').text(store.getters.favoriteCount);
}

// ---------------------------------------------------------------------------
// Sidebar contacts — live status indicators from $.store
// ---------------------------------------------------------------------------
function updateSidebarContacts() {
  const store = $.getStore('main');
  if (!store) return;
  const $list = $('#sc-list');
  if (!$list.length) return;

  const sorted = [...store.state.contacts].sort((a, b) => {
    const order = { online: 0, away: 1, offline: 2 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
  });

  const html = sorted.map(c => {
    const hue = (c.name.charCodeAt(0) * 7) % 360;
    const initial = $.escapeHtml(c.name.charAt(0).toUpperCase());
    const name = $.escapeHtml(c.name);
    return `<div class="sc-item" data-contact-id="${c.id}">
      <span class="sc-avatar" style="background:hsl(${hue},55%,42%)">${initial}</span>
      <span class="sc-dot sc-dot-${c.status}"></span>
      <span class="sc-name">${name}</span>
    </div>`;
  }).join('');

  $list.html(html);
}

// ---------------------------------------------------------------------------
// Toast notification system via $.bus (event bus)
// ---------------------------------------------------------------------------
// Any component can emit: $.bus.emit('toast', { message, type })
// Types: 'success', 'error', 'info'
$.bus.on('toast', ({ message, type = 'info' }) => {
  const toast = $.create('div')
    .addClass('toast', `toast-${type}`)
    .text(message)
    .appendTo('#toasts');
  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.addClass('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
});

// ---------------------------------------------------------------------------
// On DOM ready — final setup
// ---------------------------------------------------------------------------
$.ready(() => {
  // Display version in the sidebar footer
  $('#nav-version').text('v' + $.version);

  // Theme: restore saved preference or auto-detect from system
  const saved = $.storage.get('theme'); // 'dark' | 'light' | 'system' | null
  const preference = saved || 'system';
  applyTheme(preference);

  // Listen for OS color-scheme changes (only applies when preference is 'system')
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const current = $.storage.get('theme') || 'system';
    if (current === 'system') applyTheme('system');
  });

  // Set active link on initial load
  const current = window.location.pathname;
  $.all(`.nav-link[z-link="${current}"]`).addClass('active');

  // Stats panel: restore open/closed from $.storage (defaults to open)
  const statsOpen = $.storage.get('statsOpen');
  if (statsOpen === false) {
    $('#stats-body').hide();
    $('#stats-arrow').removeClass('open');
  }

  // Sidebar contact click — open the global contact card overlay
  $('#sc-list').on('click', '.sc-item', (e) => {
    const item = e.target.closest('.sc-item');
    if (!item) return;
    const id = Number(item.dataset.contactId);
    if (id) $.bus.emit('openContact', id);
  });

  // Initial sidebar stats + contacts + live subscription
  updateSidebarStats();
  updateSidebarContacts();
  const store = $.getStore('main');
  if (store) {
    store.subscribe(updateSidebarStats);
    store.subscribe(updateSidebarContacts);
  }

  // Mount any components outside the router outlet (e.g. <contact-card>)
  $.mountAll();

  console.log('⚡ {{NAME}} — powered by zQuery v' + $.version);
});

// ---------------------------------------------------------------------------
// Theme helper — resolves 'system' to actual dark/light and applies it
// ---------------------------------------------------------------------------
function applyTheme(preference) {
  let resolved = preference;
  if (preference === 'system') {
    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  $('html').attr('data-theme', resolved);
}

// Expose globally so components can call it
window.__applyTheme = applyTheme;
