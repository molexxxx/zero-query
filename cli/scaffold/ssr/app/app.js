// app.js - Client entry point
//
// Imports shared component definitions and registers them with zQuery.
// The SSR server imports the same definitions via createSSRApp().
// Server-fetched data is embedded in window.__SSR_DATA__ for hydration.

import { homePage }  from './components/home.js';
import { aboutPage } from './components/about.js';
import { blogList }  from './components/blog/index.js';
import { blogPost }  from './components/blog/post.js';
import { notFound }  from './components/not-found.js';
import { routes }    from './routes.js';

// Register shared component definitions on the client
$.component('home-page',  homePage);
$.component('about-page', aboutPage);
$.component('blog-list',  blogList);
$.component('blog-post',  blogPost);
$.component('not-found',  notFound);

// Route → page title mapping (mirrors server getMetaForRoute)
const routeTitles = {
  'home-page':  '{{NAME}} — Home',
  'blog-list':  'Blog — {{NAME}}',
  'blog-post':  null, // dynamic — set by component
  'about-page': 'About — {{NAME}}',
  'not-found':  'Page Not Found — {{NAME}}',
};

// Client-side router
const router = $.router({
  routes,
  fallback: 'not-found',
  mode: 'history'
});

// Update document.title on client-side navigations
router.onChange(({ route }) => {
  const title = routeTitles[route.component];
  if (title) document.title = title;
});
