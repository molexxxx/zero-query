/**
 * cli/commands/dev/overlay.js — Client-side error overlay + SSE live-reload
 *
 * Returns an HTML <script> snippet that is injected before </body> in
 * every HTML response served by the dev server.  Responsibilities:
 *
 *   1. Error Overlay — full-screen dark overlay with code frames, stack
 *      traces, and ZQueryError metadata.  Dismissable via Esc or ×.
 *   2. Runtime error hooks — window.onerror, unhandledrejection, AND
 *      the zQuery $.onError() hook so framework-level errors are
 *      surfaced in the overlay automatically.
 *   3. SSE connection — listens for reload / css / error:syntax /
 *      error:clear events from the dev server watcher.
 */

'use strict';

// The snippet is a self-contained IIFE — no external dependencies.
// It must work in all browsers that support EventSource (IE11 excluded).

const OVERLAY_SCRIPT = `<script>
(function(){
  // =====================================================================
  // Error overlay
  // =====================================================================
  var overlayEl = null;

  var OVERLAY_CSS =
    'position:fixed;top:0;left:0;width:100%;height:100%;' +
    'background:rgba(0,0,0,0.92);color:#fff;z-index:2147483647;' +
    'font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;' +
    'font-size:13px;overflow-y:auto;padding:0;margin:0;box-sizing:border-box;';

  var HEADER_CSS =
    'padding:20px 24px 12px;border-bottom:1px solid rgba(255,255,255,0.1);' +
    'display:flex;align-items:flex-start;justify-content:space-between;';

  var BADGE_CSS =
    'display:inline-block;padding:3px 8px;border-radius:4px;font-size:11px;' +
    'font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;';

  // Map ZQueryError code prefixes to colours so devs can see at a glance
  // which subsystem produced the error.
  var CODE_COLORS = {
    'ZQ_REACTIVE':  '#9b59b6',
    'ZQ_SIGNAL':    '#9b59b6',
    'ZQ_EFFECT':    '#9b59b6',
    'ZQ_EXPR':      '#2980b9',
    'ZQ_COMP':      '#16a085',
    'ZQ_ROUTER':    '#d35400',
    'ZQ_STORE':     '#8e44ad',
    'ZQ_HTTP':      '#2c3e50',
    'ZQ_DEV':       '#e74c3c',
    'ZQ_INVALID':   '#7f8c8d',
  };

  function badgeColor(data) {
    if (data.code) {
      var keys = Object.keys(CODE_COLORS);
      for (var i = 0; i < keys.length; i++) {
        if (data.code.indexOf(keys[i]) === 0) return CODE_COLORS[keys[i]];
      }
    }
    if (data.type && /syntax|parse/i.test(data.type)) return '#e74c3c';
    return '#e67e22';
  }

  function esc(s) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(s));
    return d.innerHTML;
  }

  function createOverlay(data) {
    removeOverlay();
    var wrap = document.createElement('div');
    wrap.id = '__zq_error_overlay';
    wrap.setAttribute('style', OVERLAY_CSS);
    wrap.setAttribute('tabindex', '-1');

    var color = badgeColor(data);
    var html = '';

    // ----- header row -----
    html += '<div style="' + HEADER_CSS + '">';
    html += '<div>';

    // Error code badge (if present)
    if (data.code) {
      html += '<span style="' + BADGE_CSS + 'background:' + color + ';margin-right:6px;">' + esc(data.code) + '</span>';
    }
    // Type badge
    html += '<span style="' + BADGE_CSS + 'background:' + (data.code ? 'rgba(255,255,255,0.1)' : color) + ';">' + esc(data.type || 'Error') + '</span>';

    // Message
    html += '<div style="font-size:18px;font-weight:600;line-height:1.4;color:#ff6b6b;margin-top:4px;">';
    html += esc(data.message || 'Unknown error');
    html += '</div></div>';

    // Close button
    html += '<button id="__zq_close" style="' +
      'background:none;border:1px solid rgba(255,255,255,0.2);color:#999;' +
      'font-size:20px;cursor:pointer;border-radius:6px;width:32px;height:32px;' +
      'display:flex;align-items:center;justify-content:center;flex-shrink:0;' +
      'margin-left:16px;transition:all 0.15s;"' +
      ' onmouseover="this.style.color=\\'#fff\\';this.style.borderColor=\\'rgba(255,255,255,0.5)\\'"' +
      ' onmouseout="this.style.color=\\'#999\\';this.style.borderColor=\\'rgba(255,255,255,0.2)\\'"' +
      '>&times;</button>';
    html += '</div>';

    // ----- file location -----
    if (data.file) {
      html += '<div style="padding:10px 24px;color:#8be9fd;font-size:13px;">';
      html += '<span style="color:#888;">File: </span>' + esc(data.file);
      if (data.line) html += '<span style="color:#888;">:</span>' + data.line;
      if (data.column) html += '<span style="color:#888;">:</span>' + data.column;
      html += '</div>';
    }

    // ----- ZQueryError context (key/value pairs) -----
    if (data.context && typeof data.context === 'object' && Object.keys(data.context).length) {
      html += '<div style="padding:8px 24px;display:flex;flex-wrap:wrap;gap:8px;">';
      var ctxKeys = Object.keys(data.context);
      for (var ci = 0; ci < ctxKeys.length; ci++) {
        var k = ctxKeys[ci], v = data.context[k];
        html += '<span style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);' +
          'padding:3px 10px;border-radius:4px;font-size:12px;">' +
          '<span style="color:#888;">' + esc(k) + ': </span>' +
          '<span style="color:#f1fa8c;">' + esc(typeof v === 'object' ? JSON.stringify(v) : String(v)) + '</span>' +
          '</span>';
      }
      html += '</div>';
    }

    // ----- code frame -----
    if (data.frame) {
      html += '<pre style="' +
        'margin:0;padding:16px 24px;background:rgba(255,255,255,0.04);' +
        'border-top:1px solid rgba(255,255,255,0.06);' +
        'border-bottom:1px solid rgba(255,255,255,0.06);' +
        'overflow-x:auto;line-height:1.6;font-size:13px;">';
      var lines = data.frame.split('\\n');
      for (var fi = 0; fi < lines.length; fi++) {
        var fl = lines[fi];
        if (fl.charAt(0) === '>') {
          html += '<span style="color:#ff6b6b;font-weight:600;">' + esc(fl) + '</span>\\n';
        } else if (fl.indexOf('^') !== -1 && fl.trim().replace(/[\\s|^]/g, '') === '') {
          html += '<span style="color:#e74c3c;font-weight:700;">' + esc(fl) + '</span>\\n';
        } else {
          html += '<span style="color:#999;">' + esc(fl) + '</span>\\n';
        }
      }
      html += '</pre>';
    }

    // ----- stack trace -----
    if (data.stack) {
      html += '<div style="padding:16px 24px;">';
      html += '<div style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Stack Trace</div>';
      html += '<pre style="margin:0;color:#bbb;font-size:12px;line-height:1.7;white-space:pre-wrap;word-break:break-word;">';
      html += esc(data.stack);
      html += '</pre></div>';
    }

    // ----- tip -----
    html += '<div style="padding:16px 24px;color:#555;font-size:11px;border-top:1px solid rgba(255,255,255,0.06);">';
    html += 'Fix the error and save \\u2014 the overlay will clear automatically. Press <kbd style="' +
      'background:rgba(255,255,255,0.1);padding:1px 6px;border-radius:3px;font-size:11px;' +
      '">Esc</kbd> to dismiss.';
    html += '</div>';

    wrap.innerHTML = html;
    document.body.appendChild(wrap);
    overlayEl = wrap;

    var closeBtn = document.getElementById('__zq_close');
    if (closeBtn) closeBtn.addEventListener('click', removeOverlay);
    wrap.addEventListener('keydown', function(e) { if (e.key === 'Escape') removeOverlay(); });
    wrap.focus();
  }

  function removeOverlay() {
    if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
    overlayEl = null;
  }

  // =====================================================================
  // Console helper
  // =====================================================================
  function logToConsole(data) {
    var label = data.code ? data.code + ' ' : '';
    var msg = '\\n%c zQuery DevError %c ' + label + data.type + ': ' + data.message;
    if (data.file) msg += '\\n  at ' + data.file + (data.line ? ':' + data.line : '') + (data.column ? ':' + data.column : '');
    console.error(msg, 'background:#e74c3c;color:#fff;padding:2px 6px;border-radius:3px;font-weight:700;', 'color:inherit;');
    if (data.frame) console.error(data.frame);
  }

  function cleanStack(stack) {
    return stack.split('\\n')
      .filter(function(l) { return l.indexOf('__zq_') === -1 && l.indexOf('EventSource') === -1; })
      .map(function(l) { return l.replace(location.origin, ''); })
      .join('\\n');
  }

  // =====================================================================
  // Runtime error hooks
  // =====================================================================
  window.addEventListener('error', function(e) {
    if (!e.filename) return;
    var err = e.error || {};
    var data = {
      code:    err.code || '',
      type:    (err.constructor && err.constructor.name) || 'Error',
      message: e.message || String(err),
      file:    e.filename.replace(location.origin, ''),
      line:    e.lineno || 0,
      column:  e.colno || 0,
      context: err.context || null,
      stack:   err.stack ? cleanStack(err.stack) : ''
    };
    createOverlay(data);
    logToConsole(data);
  });

  window.addEventListener('unhandledrejection', function(e) {
    var err = e.reason || {};
    var data = {
      code:    err.code || '',
      type:    err.name === 'ZQueryError' ? 'ZQueryError' : 'Unhandled Promise Rejection',
      message: err.message || String(err),
      context: err.context || null,
      stack:   err.stack ? cleanStack(err.stack) : ''
    };
    createOverlay(data);
    logToConsole(data);
  });

  // =====================================================================
  // Hook into zQuery's $.onError() when the library is loaded
  // =====================================================================
  function hookZQueryErrors() {
    // $.onError is set by the framework — wait for it
    if (typeof $ !== 'undefined' && typeof $.onError === 'function') {
      $.onError(function(zqErr) {
        var data = {
          code:    zqErr.code || '',
          type:    'ZQueryError',
          message: zqErr.message,
          context: zqErr.context || null,
          stack:   zqErr.stack ? cleanStack(zqErr.stack) : ''
        };
        createOverlay(data);
        logToConsole(data);
      });
      return;
    }
    // Retry until the library has loaded (max ~5s)
    if (hookZQueryErrors._tries < 50) {
      hookZQueryErrors._tries++;
      setTimeout(hookZQueryErrors, 100);
    }
  }
  hookZQueryErrors._tries = 0;
  // Defer so the page's own scripts load first
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hookZQueryErrors);
  } else {
    setTimeout(hookZQueryErrors, 0);
  }

  // =====================================================================
  // SSE connection (live-reload + server-pushed errors)
  // =====================================================================
  var es, reconnectTimer;

  function connect() {
    es = new EventSource('/__zq_reload');

    es.addEventListener('reload', function() {
      removeOverlay();
      location.reload();
    });

    es.addEventListener('css', function() {
      var sheets = document.querySelectorAll('link[rel="stylesheet"]');
      sheets.forEach(function(l) {
        var href = l.getAttribute('href');
        if (!href) return;
        var sep = href.indexOf('?') >= 0 ? '&' : '?';
        l.setAttribute('href', href.replace(/[?&]_zqr=\\\\d+/, '') + sep + '_zqr=' + Date.now());
      });
    });

    es.addEventListener('error:syntax', function(e) {
      try { var data = JSON.parse(e.data); createOverlay(data); logToConsole(data); } catch(_){}
    });

    es.addEventListener('error:runtime', function(e) {
      try { var data = JSON.parse(e.data); createOverlay(data); logToConsole(data); } catch(_){}
    });

    es.addEventListener('error:clear', function() {
      removeOverlay();
    });

    es.onerror = function() {
      es.close();
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 2000);
    };
  }

  connect();
})();
</script>`;

module.exports = OVERLAY_SCRIPT;
