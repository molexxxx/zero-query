// cli/help.js — show CLI usage information

function showHelp() {
  console.log(`
  zQuery CLI \u2014 create, dev, bundle & build

  COMMANDS

    create [dir]               Scaffold a new zQuery project
                               Creates index.html, global.css, app/, assets/ in the target directory
                               (defaults to the current directory)
      --minimal, -m            Use the minimal template (home, counter, about)
                               instead of the full-featured default scaffold

    dev [root]                 Start a dev server with live-reload
      --port, -p <number>     Port number (default: 3100)
      --index, -i <file>        Index HTML file (default: index.html)
      --no-intercept           Disable auto-resolution of zquery.min.js
                               (serve the on-disk vendor copy instead)
      --bundle, -b             Serve the bundled build (runs bundler first,
                               serves from dist/server/, auto-rebuilds on save)

                               Includes error overlay: syntax errors are
                               caught on save and shown as a full-screen
                               overlay in the browser. Runtime errors and
                               unhandled rejections are also captured.

    bundle [dir|file]          Bundle app ES modules into a single file
      --out, -o <path>         Output directory (default: dist/ next to HTML file)
      --index, -i <file>        Index HTML file (default: auto-detected)
      --minimal, -m            Only output HTML, bundled JS, and global CSS (skip static assets)
      --global-css <path>      Override global CSS input (default: first <link> in HTML)

    build                      Build the zQuery library \u2192 dist/      --watch, -w              Watch src/ and rebuild on changes                               (must be run from the project root where src/ lives)

  SMART DEFAULTS

    The bundler works with zero flags for typical projects:
      \u2022 Entry is auto-detected with strict precedence:
        1. index.html first, then other .html files
        2. Within HTML: module script pointing to app.js, else first module script
        3. JS scan: $.router( first (entry point), then $.mount( / $.store(
        4. Convention fallbacks (app/app.js, scripts/app.js, app.js, etc.)
      • Passing a directory auto-detects the entry; passing a file uses it directly
      • zquery.min.js is always embedded (auto-built from source if not found)
      • HTML file is auto-detected (any .html, not just index.html)
      • Output goes to dist/server/ and dist/local/ next to the detected HTML file

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

    The dev server includes a full-screen error overlay:
      • JS files are syntax-checked on save — errors block reload
        and show an overlay with exact file, line:column, and code frame
      • Runtime errors and unhandled rejections are also captured
      • The overlay auto-clears when the file is fixed and saved
      • Press Esc or click × to dismiss manually

  EXAMPLES

    # Scaffold a new project and start developing
    zquery create my-app && zquery dev my-app

    # Start dev server with live-reload
    zquery dev my-app

    # Build the library only
    zquery build

    # Bundle an app from the project root
    zquery bundle my-app/

    # Pass a direct entry file (skip auto-detection)
    zquery bundle my-app/app/main.js

    # Custom output directory
    zquery bundle my-app/ -o build/

    # Minimal build (HTML + JS + global CSS, no static asset copying)
    zquery bundle my-app/ --minimal

    # Dev server with a custom index page
    zquery dev my-app/ --index home.html

  The bundler walks the ES module import graph starting from the entry
  file, topologically sorts dependencies, strips import/export syntax,
  and concatenates everything into a single IIFE with content-hashed
  filenames for cache-busting. No dependencies needed \u2014 just Node.js.
`);
}

module.exports = showHelp;
