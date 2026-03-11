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

    es.addEventListener('css', function(e) {
      var changedPath = (e.data || '').replace(/^\\/+/, '');
      var matched = false;

      // 1) Try cache-busting matching <link rel="stylesheet"> tags
      var sheets = document.querySelectorAll('link[rel="stylesheet"]');
      sheets.forEach(function(l) {
        var href = l.getAttribute('href');
        if (!href) return;
        var clean = href.replace(/[?&]_zqr=\\d+/, '').replace(/^\\/+/, '');
        if (changedPath && clean.indexOf(changedPath) === -1) return;
        matched = true;
        var sep = href.indexOf('?') >= 0 ? '&' : '?';
        l.setAttribute('href', href.replace(/[?&]_zqr=\\d+/, '') + sep + '_zqr=' + Date.now());
      });

      // 2) Try hot-swapping scoped <style data-zq-style-urls> elements
      //    These come from component styleUrl — the CSS was fetched, scoped,
      //    and injected as an inline <style>. We re-fetch and re-scope it.
      if (!matched) {
        var scopedEls = document.querySelectorAll('style[data-zq-style-urls]');
        scopedEls.forEach(function(el) {
          var urls = el.getAttribute('data-zq-style-urls') || '';
          var hit = urls.split(' ').some(function(u) {
            return u && u.replace(/^\\/+/, '').indexOf(changedPath) !== -1;
          });
          if (!hit) return;
          matched = true;

          var scopeAttr = el.getAttribute('data-zq-scope') || '';
          var inlineStyles = el.getAttribute('data-zq-inline') || '';

          // Re-fetch all style URLs (cache-busted)
          var urlList = urls.split(' ').filter(Boolean);
          Promise.all(urlList.map(function(u) {
            return fetch(u + (u.indexOf('?') >= 0 ? '&' : '?') + '_zqr=' + Date.now())
              .then(function(r) { return r.text(); });
          })).then(function(results) {
            var raw = (inlineStyles ? inlineStyles + '\\n' : '') + results.join('\\n');
            // Re-scope CSS with the same scope attribute
            if (scopeAttr) {
              var inAt = 0;
              raw = raw.replace(/([^{}]+)\\{|\\}/g, function(m, sel) {
                if (m === '}') { if (inAt > 0) inAt--; return m; }
                var t = sel.trim();
                if (t.charAt(0) === '@') { inAt++; return m; }
                if (inAt > 0 && /^[\\d%\\s,fromto]+$/.test(t.replace(/\\s/g, ''))) return m;
                return sel.split(',').map(function(s) { return '[' + scopeAttr + '] ' + s.trim(); }).join(', ') + ' {';
              });
            }
            el.textContent = raw;
          });
        });
      }

      // 3) Nothing matched — fall back to full reload
      if (!matched) { location.reload(); }
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

  // =====================================================================
  // Fetch / $.http Interceptor — pretty console logging
  // =====================================================================
  var __zqChannel;
  try { __zqChannel = new BroadcastChannel('__zq_devtools'); } catch(e) {}

  var __zqRequests = [];
  var __zqMorphEvents = [];
  var __zqMorphCount = 0;
  var __zqRenderCount = 0;
  var __zqReqId = 0;
  var _origFetch = window.fetch;

  window.fetch = function(input, init) {
    var url = typeof input === 'string' ? input : (input && input.url ? input.url : String(input));
    var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    var id = ++__zqReqId;
    var start = performance.now();

    // Skip internal dev-server requests
    if (url.indexOf('__zq_') !== -1 || url.indexOf('/_devtools') !== -1) {
      return _origFetch.apply(this, arguments);
    }

    return _origFetch.apply(this, arguments).then(function(response) {
      var elapsed = Math.round(performance.now() - start);
      var status = response.status;
      var cloned = response.clone();

      cloned.text().then(function(bodyText) {
        var entry = {
          id: id, method: method, url: url, status: status,
          elapsed: elapsed, bodyPreview: bodyText.slice(0, 5000),
          timestamp: Date.now()
        };
        __zqRequests.push(entry);
        if (__zqRequests.length > 500) __zqRequests.shift();
        updateDevBar();

        // Pretty console log
        var isOk = status >= 200 && status < 300;
        var color = isOk ? '#2ecc71' : status < 400 ? '#f39c12' : '#e74c3c';

        console.groupCollapsed(
          '%c ' + method + ' %c' + status + '%c ' + url + '  %c' + elapsed + 'ms',
          'background:' + color + ';color:#fff;padding:2px 6px;border-radius:3px;font-weight:700;font-size:11px',
          'color:' + color + ';font-weight:700;margin-left:8px',
          'color:inherit;margin-left:4px',
          'color:#888;margin-left:8px;font-size:11px'
        );

        // Response body
        try {
          var parsed = JSON.parse(bodyText);
          console.log('%c Response  ', 'background:#1e1e2e;color:#8be9fd;padding:2px 6px;border-radius:2px;font-weight:600', parsed);
        } catch(pe) {
          if (bodyText.length > 0) {
            console.log('%c Response  ', 'background:#1e1e2e;color:#8be9fd;padding:2px 6px;border-radius:2px;font-weight:600',
              bodyText.length > 500 ? bodyText.slice(0, 500) + '... (' + bodyText.length + ' chars)' : bodyText);
          }
        }

        // Headers
        try {
          console.log('%c Headers   ', 'background:#1e1e2e;color:#bd93f9;padding:2px 6px;border-radius:2px;font-weight:600',
            Object.fromEntries(response.headers.entries()));
        } catch(he) {}

        // Request body (if sent)
        if (init && init.body) {
          try {
            console.log('%c Request   ', 'background:#1e1e2e;color:#f1fa8c;padding:2px 6px;border-radius:2px;font-weight:600',
              JSON.parse(init.body));
          } catch(re) {
            console.log('%c Request   ', 'background:#1e1e2e;color:#f1fa8c;padding:2px 6px;border-radius:2px;font-weight:600',
              String(init.body).slice(0, 500));
          }
        }

        console.groupEnd();

        // Broadcast to devtools
        if (__zqChannel) {
          try { __zqChannel.postMessage({ type: 'http', data: entry }); } catch(ce) {}
        }
      }).catch(function() {});

      return response;
    }, function(err) {
      var elapsed = Math.round(performance.now() - start);
      console.groupCollapsed(
        '%c ' + method + ' %cERR%c ' + url + '  %c' + elapsed + 'ms',
        'background:#e74c3c;color:#fff;padding:2px 6px;border-radius:3px;font-weight:700;font-size:11px',
        'color:#e74c3c;font-weight:700;margin-left:8px',
        'color:inherit;margin-left:4px',
        'color:#888;margin-left:8px;font-size:11px'
      );
      console.error(err);
      console.groupEnd();

      var entry = { id: id, method: method, url: url, status: 0, elapsed: elapsed, bodyPreview: err.message, timestamp: Date.now() };
      __zqRequests.push(entry);
      updateDevBar();
      if (__zqChannel) {
        try { __zqChannel.postMessage({ type: 'http', data: entry }); } catch(ce) {}
      }

      throw err;
    });
  };

  // =====================================================================
  // Morph instrumentation — hook via window.__zqMorphHook (set by diff.js)
  // =====================================================================
  window.__zqMorphHook = function(el, elapsed) {
    __zqMorphCount++;
    updateDevBar();

    var evt = { target: el.id || el.tagName.toLowerCase(), elapsed: elapsed, kind: 'morph', timestamp: Date.now() };
    __zqMorphEvents.push(evt);
    if (__zqMorphEvents.length > 200) __zqMorphEvents.shift();

    // Console timing for slow morphs (> 4ms)
    if (elapsed > 4) {
      console.log(
        '%c morph %c' + elapsed.toFixed(2) + 'ms%c ' + (el.id || el.tagName.toLowerCase()),
        'background:#9b59b6;color:#fff;padding:2px 6px;border-radius:3px;font-weight:700;font-size:11px',
        'color:' + (elapsed > 16 ? '#e74c3c' : '#f39c12') + ';font-weight:700;margin-left:8px',
        'color:#888;margin-left:4px'
      );
    }

    // Broadcast to devtools
    if (__zqChannel) {
      try {
        __zqChannel.postMessage({
          type: 'morph-detail',
          data: evt
        });
      } catch(ce) {}
    }
  };

  // =====================================================================
  // Render instrumentation — hook for first-renders & route swaps
  // =====================================================================
  window.__zqRenderHook = function(el, elapsed, kind, name) {
    __zqRenderCount++;
    __zqMorphCount++; // count renders in the morph total for the toolbar
    updateDevBar();

    var evt = { target: name || el.id || el.tagName.toLowerCase(), elapsed: elapsed, kind: kind, timestamp: Date.now() };
    __zqMorphEvents.push(evt);
    if (__zqMorphEvents.length > 200) __zqMorphEvents.shift();

    // Console log for route/mount renders
    var label = kind === 'route' ? ' route ' : ' mount ';
    var bg = kind === 'route' ? '#d29922' : '#3fb950';
    console.log(
      '%c' + label + '%c' + elapsed.toFixed(2) + 'ms%c ' + (name || el.id || el.tagName.toLowerCase()),
      'background:' + bg + ';color:#fff;padding:2px 6px;border-radius:3px;font-weight:700;font-size:11px',
      'color:' + (elapsed > 16 ? '#e74c3c' : '#888') + ';font-weight:700;margin-left:8px',
      'color:#888;margin-left:4px'
    );

    // Broadcast to devtools
    if (__zqChannel) {
      try {
        __zqChannel.postMessage({
          type: 'render-detail',
          data: evt
        });
      } catch(ce) {}
    }
  };

  // =====================================================================
  // Dev Toolbar — floating bar with DOM viewer button & request counter
  // =====================================================================
  var devBar;

  function createDevBar() {
    devBar = document.createElement('div');
    devBar.id = '__zq_devbar';
    devBar.setAttribute('style',
      'position:fixed;bottom:12px;right:12px;z-index:2147483646;' +
      'display:flex;align-items:center;gap:6px;' +
      'background:rgba(22,27,34,0.92);border:1px solid rgba(48,54,61,0.8);' +
      'border-radius:8px;padding:4px 6px;backdrop-filter:blur(8px);' +
      'font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;' +
      'font-size:11px;color:#8b949e;user-select:none;cursor:default;' +
      'box-shadow:0 4px 12px rgba(0,0,0,0.4);'
    );
    devBar.innerHTML =
      '<span style="color:#58a6ff;font-weight:700;padding:0 4px;font-size:10px;letter-spacing:.5px">zQ</span>' +
      '<span id="__zq_bar_reqs" title="Network requests" style="padding:2px 6px;border-radius:4px;' +
        'background:rgba(88,166,255,0.1);color:#58a6ff;cursor:pointer;font-size:10px;font-weight:600;">0 req</span>' +
      '<span id="__zq_bar_morphs" title="Render operations" style="padding:2px 6px;border-radius:4px;' +
        'background:rgba(188,140,255,0.1);color:#bc8cff;cursor:pointer;font-size:10px;font-weight:600;">0 render</span>' +
      '<button id="__zq_bar_dom" title="Open DevTools (/_devtools)" style="' +
        'padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;' +
        'background:rgba(63,185,80,0.15);color:#3fb950;border:1px solid rgba(63,185,80,0.3);' +
        'cursor:pointer;font-family:inherit;transition:all .15s;' +
      '">DOM</button>' +
      '<button id="__zq_bar_close" title="Close toolbar" style="' +
        'padding:0 4px;color:#484f58;cursor:pointer;font-size:14px;border:none;' +
        'background:none;font-family:inherit;line-height:1;' +
      '">&times;</button>';

    document.body.appendChild(devBar);
    updateDevBar();

    // Check if we're inside a devtools split-view iframe
    function isInSplitFrame() {
      try { return window.parent !== window && window.parent.document.getElementById('app-frame'); }
      catch(e) { return false; }
    }

    // Switch tab in devtools (works for both split iframe and popup)
    function switchDevTab(tab) {
      if (__zqChannel) {
        __zqChannel.postMessage({ type: 'switch-tab', tab: tab });
      }
    }

    // Req counter → Network tab
    document.getElementById('__zq_bar_reqs').addEventListener('click', function() {
      if (isInSplitFrame()) {
        switchDevTab('network');
      } else {
        openDevToolsPopup('network');
      }
    });

    // Render counter → Performance tab
    document.getElementById('__zq_bar_morphs').addEventListener('click', function() {
      if (isInSplitFrame()) {
        switchDevTab('perf');
      } else {
        openDevToolsPopup('perf');
      }
    });

    // DOM button → Elements tab (in split) or open popup
    var __zqPopup = null;
    function openDevToolsPopup(tab) {
      // If popup is already open, just switch the tab via BroadcastChannel
      if (__zqPopup && !__zqPopup.closed) {
        switchDevTab(tab);
        __zqPopup.focus();
        return;
      }
      var w = 1080, h = 800;
      var left = window.screenX + window.outerWidth - w - 20;
      var top = window.screenY + 60;
      var url = '/_devtools' + (tab ? '#' + tab : '');
      __zqPopup = window.open(url, '__zq_devtools',
        'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top +
        ',resizable=yes,scrollbars=yes');
    }

    document.getElementById('__zq_bar_dom').addEventListener('click', function() {
      if (isInSplitFrame()) {
        switchDevTab('dom');
      } else {
        openDevToolsPopup('dom');
      }
    });

    // Close button
    document.getElementById('__zq_bar_close').addEventListener('click', function() {
      devBar.style.display = 'none';
    });

    // Hover effects
    document.getElementById('__zq_bar_dom').addEventListener('mouseover', function() {
      this.style.background = 'rgba(63,185,80,0.3)';
    });
    document.getElementById('__zq_bar_dom').addEventListener('mouseout', function() {
      this.style.background = 'rgba(63,185,80,0.15)';
    });
  }

  function updateDevBar() {
    if (!devBar) return;
    var reqEl = document.getElementById('__zq_bar_reqs');
    var morphEl = document.getElementById('__zq_bar_morphs');
    if (reqEl) reqEl.textContent = __zqRequests.length + ' req';
    if (morphEl) morphEl.textContent = __zqMorphCount + ' render';
  }

  // Expose for devtools popup
  window.__zqDevTools = {
    get requests() { return __zqRequests; },
    get morphEvents() { return __zqMorphEvents; },
    get morphCount() { return __zqMorphCount; },
    get renderCount() { return __zqRenderCount; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createDevBar);
  } else {
    createDevBar();
  }
})();
</script>`;

module.exports = OVERLAY_SCRIPT;
