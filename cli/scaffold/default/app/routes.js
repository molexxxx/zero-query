// routes.js — Route definitions
//
// Maps URL paths to component tag names.
// Also supports :params, wildcards, and lazy loading via `load`.

export const routes = [
  { path: '/',           component: 'home-page'       },
  { path: '/counter',    component: 'counter-page'    },
  { path: '/todos',      component: 'todos-page'      },
  { path: '/contacts',   component: 'contacts-page'   },
  { path: '/api',        component: 'api-demo'        },
  { path: '/playground', component: 'playground-page' },
  { path: '/toolkit',    component: 'toolkit-page'    },
  { path: '/about',      component: 'about-page'      },
];
