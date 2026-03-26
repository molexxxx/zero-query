// routes.js - Route definitions (shared between client and server)

export const routes = [
  { path: '/',            component: 'home-page'  },
  { path: '/blog',        component: 'blog-list'  },
  { path: '/blog/:slug',  component: 'blog-post'  },
  { path: '/about',       component: 'about-page' },
];
