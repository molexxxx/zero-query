// app.js - Application entry point
//
// Bootstraps the app: imports components, sets up routing,
// and wires the responsive sidebar.
//
// Key APIs used:
//   $.router  - SPA navigation (history mode)
//   $.ready   - run after DOM is loaded
//   $.on      - global delegated event listeners
//   $.storage - localStorage wrapper

import './store.js';
import './components/home.js';
import './components/counter.js';
import './components/about.js';
import './components/not-found.js';
import { routes } from './routes.js';

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const router = $.router({
  routes,
  fallback: 'not-found',
  mode: 'history'
});

// Close mobile menu on route change
router.onChange(() => {
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

$.on('click', '#menu-toggle', () => toggleMobileMenu(!$sidebar.hasClass('open')));
$.on('click', '#overlay', closeMobileMenu);
$.on('keydown', (e) => { if (e.key === 'Escape') closeMobileMenu(); });

// ---------------------------------------------------------------------------
// On DOM ready
// ---------------------------------------------------------------------------
$.ready(() => {
  // Display version in the sidebar footer
  $('#nav-version').text('v' + $.version);

  // Theme: restore saved preference or auto-detect from system
  const saved = $.storage.get('theme');
  const preference = saved || 'system';
  applyTheme(preference);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const current = $.storage.get('theme') || 'system';
    if (current === 'system') applyTheme('system');
  });

  // Active nav highlighting is handled by z-active-route in the HTML

  console.log('⚡ {{NAME}} - powered by zQuery v' + $.version);
});

// ---------------------------------------------------------------------------
// Theme helper
// ---------------------------------------------------------------------------
function applyTheme(preference) {
  let resolved = preference;
  if (preference === 'system') {
    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  $('html').attr('data-theme', resolved);
}

window.__applyTheme = applyTheme;
