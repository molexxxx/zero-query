// scripts/app.js — application entry point
//
// This file bootstraps the zQuery app: imports all components,
// sets up routing, wires the responsive nav, and demonstrates
// several core APIs: $.router, $.ready, $.bus, $.on, and $.storage.

import './store.js';
import './components/home.js';
import './components/counter.js';
import './components/todos.js';
import './components/api-demo.js';
import './components/about.js';
import './components/not-found.js';
import { routes } from './routes.js';

// ---------------------------------------------------------------------------
// Router — SPA navigation with history mode
// ---------------------------------------------------------------------------
const router = $.router({
  el: '#app',
  routes,
  fallback: 'not-found',
  mode: 'history'
});

// Highlight the active nav link on every route change
router.onChange((to) => {
  $.all('.nav-link').removeClass('active');
  $.all(`.nav-link[z-link="${to.path}"]`).addClass('active');

  // Close mobile menu on navigate
  closeMobileMenu();
});

// ---------------------------------------------------------------------------
// Responsive sidebar toggle
// ---------------------------------------------------------------------------
const sidebar = $.id('sidebar');
const overlay = $.id('overlay');
const toggle  = $.id('menu-toggle');

function openMobileMenu() {
  sidebar.classList.add('open');
  overlay.classList.add('visible');
  toggle.classList.add('active');
}

function closeMobileMenu() {
  sidebar.classList.remove('open');
  overlay.classList.remove('visible');
  toggle.classList.remove('active');
}

// $.on — global delegated event listeners
$.on('click', '#menu-toggle', () => {
  sidebar.classList.contains('open') ? closeMobileMenu() : openMobileMenu();
});
$.on('click', '#overlay', closeMobileMenu);

// Close sidebar on Escape key — using $.on direct (no selector needed)
$.on('keydown', (e) => {
  if (e.key === 'Escape') closeMobileMenu();
});

// ---------------------------------------------------------------------------
// Toast notification system via $.bus (event bus)
// ---------------------------------------------------------------------------
// Any component can emit: $.bus.emit('toast', { message, type })
// Types: 'success', 'error', 'info'
$.bus.on('toast', ({ message, type = 'info' }) => {
  const container = $.id('toasts');
  const toast = $.create('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
});

// ---------------------------------------------------------------------------
// On DOM ready — final setup
// ---------------------------------------------------------------------------
$.ready(() => {
  // Display version in the sidebar footer
  const versionEl = $.id('nav-version');
  if (versionEl) versionEl.textContent = 'v' + $.version;

  // Restore last theme from localStorage ($.storage)
  const savedTheme = $.storage.get('theme');
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

  // Set active link on initial load
  const current = window.location.pathname;
  $.all(`.nav-link[z-link="${current}"]`).addClass('active');

  console.log('⚡ {{NAME}} — powered by zQuery v' + $.version);
});
