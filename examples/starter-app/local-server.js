/**
 * zQuery Dev Server — powered by zero-http
 * 
 * Serves the SPA demo with history mode routing.
 * Usage: node server.js [port]
 */

const { createApp, static: serveStatic } = require('zero-http');
const path = require('path');
const fs = require('fs');

const app = createApp();
const PORT = parseInt(process.argv[2]) || 3000;
const ROOT = path.resolve(__dirname);

app.use(serveStatic(ROOT, {
  index: false,
  dotfiles: 'ignore',
}));

// SPA fallback — serve index.html for any non-file route (history mode)
app.get('*', (req, res) =>
{
  if (path.extname(req.url))
  {
    res.status(404).send('Not Found');
    return;
  }
  const indexPath = path.join(ROOT, 'index.html');
  res.html(fs.readFileSync(indexPath, 'utf-8'));
});

app.listen(PORT, () =>
{
  console.log(`\n  zQuery Dev Server`);
  console.log(`  Local:  http://localhost:${PORT}/`);
  console.log(`  Press Ctrl+C to stop\n`);
});
