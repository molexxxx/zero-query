// app.js - Client entry point
//
// Imports shared component definitions and registers them with zQuery.
// The SSR server imports the same definitions via createSSRApp().

import { homePage }  from './components/home.js';
import { aboutPage } from './components/about.js';
import { notFound }  from './components/not-found.js';
import { routes }    from './routes.js';

// Register shared component definitions on the client
$.component('home-page',  homePage);
$.component('about-page', aboutPage);
$.component('not-found',  notFound);

// Client-side router
const router = $.router({
  routes,
  fallback: 'not-found',
  mode: 'history'
});

// Active nav highlighting
router.onChange((to) => {
  $.qsa('.nav-link').forEach(link => {
    const href = link.getAttribute('z-link') || link.getAttribute('href');
    link.classList.toggle('active', href === to.path);
  });
});
