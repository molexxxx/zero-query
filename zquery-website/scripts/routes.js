export const routes = [
  { path: '/',               component: 'home-page' },
  { path: '/docs/:section',  component: 'docs-page', fallback: '/docs' },
  { path: '/about',          component: 'about-page' },
];

export default routes;
