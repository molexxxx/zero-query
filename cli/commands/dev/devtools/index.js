/**
 * cli/commands/dev/devtools/index.js - DevTools HTML assembler
 *
 * Reads CSS, HTML, and JS partials from this folder and concatenates them
 * into a single self-contained HTML page served at /_devtools.
 *
 * Communication:
 *   - window.opener: direct DOM access (same-origin popup)
 *   - BroadcastChannel('__zq_devtools'): cross-tab fallback
 */

'use strict';

const { readFileSync } = require('fs');
const { join } = require('path');

const dir = __dirname;
const read = (f) => readFileSync(join(dir, f), 'utf8');

const css = read('styles.css');
const html = read('panel.html');

const jsFiles = [
  'js/core.js',
  'js/tabs.js',
  'js/source.js',
  'js/elements.js',
  'js/network.js',
  'js/components.js',
  'js/performance.js',
  'js/router.js',
  'js/stats.js'
];

const js = jsFiles.map(read).join('\n\n');

module.exports = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>zQuery DevTools</title>
<style>
${css}
</style>
</head>
<body>
${html}
<script>
(function() {
'use strict';
${js}
})();
</script>
</body>
</html>`;
