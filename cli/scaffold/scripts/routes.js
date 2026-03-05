// scripts/routes.js — route definitions
//
// Each route maps a URL path to a component tag name.
// Supports: static paths, :params, wildcards, and lazy loading via `load`.

export const routes = [
  { path: '/',         component: 'home-page'     },
  { path: '/counter',  component: 'counter-page'  },
  { path: '/todos',    component: 'todos-page'    },
  { path: '/contacts', component: 'contacts-page' },
  { path: '/api',      component: 'api-demo'      },
  { path: '/about',    component: 'about-page'    },
];
