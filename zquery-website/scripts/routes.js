export const routes = [
  { path: '/',               component: 'home-page' },
  { path: '/docs/:section',  component: 'docs-page', fallback: '/docs' },
  { path: '/compare',        component: 'compare-page' },
  { path: '/about',          component: 'about-page' },
];

export default routes;
