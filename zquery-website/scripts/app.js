// App loader (ES module): registers components and boots the router

// Global app styles — a <link rel="stylesheet"> in index.html is recommended
// for critical styles (prevents FOUC). $.style() is available for dynamically
// loaded stylesheets, runtime overrides, or theme switching at any point.

import './components/home.js';
import './components/docs/docs.js';
import './components/about.js';
import './components/compare.js';
import './components/not-found.js';
import './store.js';
import { routes } from './routes.js';

const router = $.router({
  el: '#app',
  routes,
  fallback: 'not-found',
});

router.onChange((to) => {
  $.all('nav a[z-link]').each((i, link) => {
    const href = link.getAttribute('z-link');
    link.classList.toggle('active', href === to.path || (href !== '/' && to.path.startsWith(href + '/')));
  });
  // Close mobile nav on route change
  const nav = $('nav');
  if (nav) nav.classList.remove('nav-open');
  const outlet = $.id('app');
  if (outlet) {
    outlet.classList.remove('fade-in');
    void outlet.offsetWidth;
    outlet.classList.add('fade-in');
  }
});

// Delegated mobile-nav toggle (replaces inline onclick in HTML)
$.on('click', '.mobile-nav-toggle', function () {
  this.closest('nav').classList.toggle('nav-open');
});

$.ready(() => {
  console.log(`zQuery v${$.version} — library loaded`);
  const initial = router.path || '/';
  $.all('nav a[z-link]').each((i, link) => {
    const href = link.getAttribute('z-link');
    link.classList.toggle('active', href === initial || (href !== '/' && initial.startsWith(href + '/')));
  });
});
