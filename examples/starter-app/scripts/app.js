// App loader (ES module): registers components and boots the router

// Global app styles — a <link rel="stylesheet"> in index.html is recommended
// for critical styles (prevents FOUC). $.style() is available for dynamically
// loaded stylesheets, runtime overrides, or theme switching at any point.

import './components/home.js';
import './components/counter.js';
import './components/todos.js';
import './components/docs/index.js';
import './components/about.js';
import './components/not-found.js';
import { store } from './store.js';
import { routes } from './routes.js';

const router = $.router({
  el: '#app',
  routes,
  fallback: 'not-found',
});

router.onChange((to) => {
  store.dispatch('incrementVisits');
  document.querySelectorAll('nav a[z-link]').forEach(link => {
    const href = link.getAttribute('z-link');
    link.classList.toggle('active', href === to.path || (href !== '/' && to.path.startsWith(href + '/')));
  });
  // Close mobile nav on route change
  const nav = document.querySelector('nav');
  if (nav) nav.classList.remove('nav-open');
  const outlet = document.getElementById('app');
  if (outlet) {
    outlet.classList.remove('fade-in');
    void outlet.offsetWidth;
    outlet.classList.add('fade-in');
  }
});

$.ready(() => {
  console.log(`zQuery v${$.version} — Starter App loaded`);
  const initial = router.path || '/';
  document.querySelectorAll('nav a[z-link]').forEach(link => {
    const href = link.getAttribute('z-link');
    link.classList.toggle('active', href === initial || (href !== '/' && initial.startsWith(href + '/')));
  });
});
