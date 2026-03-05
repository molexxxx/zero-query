// cli/help.js — show CLI usage information

function showHelp() {
  console.log(`
  zQuery CLI \u2014 create, dev, bundle & build

  COMMANDS

    create [dir]               Scaffold a new zQuery project
                               Creates index.html, scripts/, styles/ in the target directory
                               (defaults to the current directory)

    dev [root]                 Start a dev server with live-reload
      --port, -p <number>     Port number (default: 3100)
      --no-intercept           Disable auto-resolution of zquery.min.js
                               (serve the on-disk vendor copy instead)

    bundle [dir]              Bundle app ES modules into a single file
      --out, -o <path>         Output directory (default: dist/ next to index.html)
      --html <file>            Use a specific HTML file (default: auto-detected)

    build                      Build the zQuery library \u2192 dist/      --watch, -w              Watch src/ and rebuild on changes                               (must be run from the project root where src/ lives)

  SMART DEFAULTS

    The bundler works with zero flags for typical projects:
      \u2022 Entry is auto-detected: scans .html for <script type="module">,
        then .js files for entry signatures, then convention fallbacks
      \u2022 zquery.min.js is always embedded (auto-built from source if not found)
      \u2022 index.html is rewritten for both server and local (file://) use
      \u2022 Output goes to dist/server/ and dist/local/ next to the detected index.html

  OUTPUT

    The bundler produces two self-contained sub-directories:

      dist/server/               deploy to your web server
        index.html               has <base href="/"> for SPA deep routes
        z-<entry>.<hash>.js      readable bundle
        z-<entry>.<hash>.min.js  minified bundle

      dist/local/                open from disk (file://)
        index.html               relative paths, no <base> tag
        z-<entry>.<hash>.js      same bundle

    Previous hashed builds are automatically cleaned on each rebuild.

  DEVELOPMENT

    zquery dev                 start a dev server with live-reload (port 3100)
    zquery dev --port 8080     custom port

  EXAMPLES

    # Scaffold a new project and start developing
    zquery create my-app && zquery dev my-app

    # Start dev server with live-reload
    zquery dev my-app

    # Build the library only
    zquery build

    # Bundle an app from the project root
    zquery bundle my-app/

    # Custom output directory
    zquery bundle my-app/ -o build/

  The bundler walks the ES module import graph starting from the entry
  file, topologically sorts dependencies, strips import/export syntax,
  and concatenates everything into a single IIFE with content-hashed
  filenames for cache-busting. No dependencies needed \u2014 just Node.js.
`);
}

module.exports = showHelp;
