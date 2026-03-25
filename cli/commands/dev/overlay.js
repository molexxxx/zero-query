/**
 * cli/commands/dev/overlay.js - Client-side error overlay + SSE live-reload
 *
 * Returns an HTML <script> snippet that is injected before </body> in
 * every HTML response served by the dev server.  Responsibilities:
 *
 *   1. Error Overlay - full-screen dark overlay with code frames, stack
 *      traces, and ZQueryError metadata.  Dismissable via Esc or ×.
 *   2. Runtime error hooks - window.onerror, unhandledrejection, AND
 *      the zQuery $.onError() hook so framework-level errors are
 *      surfaced in the overlay automatically.
 *   3. SSE connection - listens for reload / css / error:syntax /
 *      error:clear events from the dev server watcher.
 */

'use strict';

// The snippet is a self-contained IIFE - no external dependencies.
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
    // $.onError is set by the framework - wait for it
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
      //    These come from component styleUrl - the CSS was fetched, scoped,
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
          var prevCSS = el.textContent; // preserve current styles as rollback
          Promise.all(urlList.map(function(u) {
            return fetch(u + (u.indexOf('?') >= 0 ? '&' : '?') + '_zqr=' + Date.now())
              .then(function(r) {
                if (!r.ok) throw new Error('CSS fetch failed: ' + r.status);
                return r.text();
              });
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
          }).catch(function() {
            // Restore previous CSS on failure to prevent blank page
            el.textContent = prevCSS;
          });
        });
      }

      // 3) Nothing matched - fall back to full reload
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
  // Fetch / $.http Interceptor - pretty console logging
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
  // Morph instrumentation - hook via window.__zqMorphHook (set by diff.js)
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
  // Render instrumentation - hook for first-renders & route swaps
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
  // Router instrumentation - history state tracking for devtools
  // =====================================================================
  var __zqRouterEvents = [];

  var _origPushState = history.pushState;
  history.pushState = function(state, title, url) {
    _origPushState.apply(this, arguments);
    var isSubstate = state && state.__zq === 'substate';
    var evt = {
      action: isSubstate ? 'substate' : 'navigate',
      url: String(url || location.href).replace(location.origin, ''),
      key: isSubstate ? state.key : null,
      data: isSubstate ? state.data : null,
      timestamp: Date.now()
    };
    __zqRouterEvents.push(evt);
    if (__zqRouterEvents.length > 200) __zqRouterEvents.shift();
    if (__zqChannel) {
      try { __zqChannel.postMessage({ type: 'router', data: evt }); } catch(e) {}
    }
    updateDevBar();
  };

  var _origReplaceState = history.replaceState;
  history.replaceState = function(state, title, url) {
    _origReplaceState.apply(this, arguments);
    var isSubstate = state && state.__zq === 'substate';
    var evt = {
      action: 'replace',
      url: String(url || location.href).replace(location.origin, ''),
      key: isSubstate ? state.key : null,
      data: isSubstate ? state.data : null,
      timestamp: Date.now()
    };
    __zqRouterEvents.push(evt);
    if (__zqRouterEvents.length > 200) __zqRouterEvents.shift();
    if (__zqChannel) {
      try { __zqChannel.postMessage({ type: 'router', data: evt }); } catch(e) {}
    }
    updateDevBar();
  };

  window.addEventListener('popstate', function(e) {
    var state = e.state;
    var isSubstate = state && state.__zq === 'substate';
    var evt = {
      action: isSubstate ? 'pop-substate' : 'pop',
      url: location.pathname + location.hash,
      key: isSubstate ? state.key : null,
      data: isSubstate ? state.data : null,
      timestamp: Date.now()
    };
    __zqRouterEvents.push(evt);
    if (__zqRouterEvents.length > 200) __zqRouterEvents.shift();
    if (__zqChannel) {
      try { __zqChannel.postMessage({ type: 'router', data: evt }); } catch(e) {}
    }
    updateDevBar();
  });

  window.addEventListener('hashchange', function() {
    var evt = {
      action: 'hashchange',
      url: location.hash,
      timestamp: Date.now()
    };
    __zqRouterEvents.push(evt);
    if (__zqRouterEvents.length > 200) __zqRouterEvents.shift();
    if (__zqChannel) {
      try { __zqChannel.postMessage({ type: 'router', data: evt }); } catch(e) {}
    }
    updateDevBar();
  });

  // =====================================================================
  // Dev Toolbar - expandable floating bar with stats
  // =====================================================================
  var devBar;
  var __zqBarExpanded = false;
  try { __zqBarExpanded = localStorage.getItem('__zq_bar_expanded') === '1'; } catch(e) {}
  var __zqRouteColors = {
    navigate:     { bg: 'rgba(63,185,80,0.12)',  fg: '#3fb950' },
    replace:      { bg: 'rgba(210,153,34,0.12)', fg: '#d29922' },
    pop:          { bg: 'rgba(248,81,73,0.12)',  fg: '#f85149' },
    'pop-substate':{ bg: 'rgba(248,81,73,0.12)', fg: '#f85149' },
    substate:     { bg: 'rgba(168,130,255,0.12)', fg: '#a882ff' },
    hashchange:   { bg: 'rgba(88,166,255,0.12)', fg: '#58a6ff' }
  };
  var __zqRouteDefault = { bg: 'rgba(227,155,55,0.12)', fg: '#e39b37' };
  var __zqRouteFadeTimer = null;

  function createDevBar() {
    devBar = document.createElement('div');
    devBar.id = '__zq_devbar';
    devBar.setAttribute('style',
      'position:fixed;bottom:12px;right:12px;z-index:2147483646;' +
      'display:flex;align-items:center;gap:4px;' +
      'background:rgba(22,27,34,0.92);border:1px solid rgba(48,54,61,0.8);' +
      'border-radius:8px;padding:4px 6px;backdrop-filter:blur(8px);' +
      'font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;' +
      'font-size:11px;color:#8b949e;user-select:none;cursor:default;' +
      'box-shadow:0 4px 12px rgba(0,0,0,0.4);transition:all .25s cubic-bezier(.22,1,.36,1);'
    );

    var statStyle = 'padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;cursor:pointer;white-space:nowrap;';
    var expandedStyle = statStyle + 'display:none;transform:scale(0);opacity:0;transform-origin:left center;will-change:transform,opacity;transition:transform .25s cubic-bezier(.22,1,.36,1),opacity .2s ease;';

    devBar.innerHTML =
      '<span style="color:#58a6ff;font-weight:700;padding:0 4px;font-size:10px;letter-spacing:.5px">zQ</span>' +
      // Expanded-only stats
      '<span id="__zq_bar_route" class="__zq_ex" title="Current route" style="' + expandedStyle +
        'background:rgba(227,155,55,0.12);color:#e39b37;outline-offset:1px;transition:transform .25s cubic-bezier(.22,1,.36,1),opacity .2s ease,background .3s ease,color .3s ease,outline-color .6s ease;">/</span>' +
      '<span id="__zq_bar_comps" class="__zq_ex" title="Registered components" style="' + expandedStyle +
        'background:rgba(168,130,255,0.1);color:#a882ff;">0 comps</span>' +
      // Always-visible stats
      '<span id="__zq_bar_morphs" title="Render operations" style="' + statStyle +
        'background:rgba(188,140,255,0.1);color:#bc8cff;">0 render</span>' +
      '<span id="__zq_bar_reqs" title="Network requests" style="' + statStyle +
        'background:rgba(88,166,255,0.1);color:#58a6ff;">0 req</span>' +
      // Expanded-only stats
      '<span id="__zq_bar_els" class="__zq_ex" title="DOM elements" style="' + expandedStyle +
        'background:rgba(63,185,80,0.1);color:#3fb950;">0 els</span>' +
      // Toggle expand/collapse
      '<button id="__zq_bar_toggle" title="Expand toolbar" style="' +
        'padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;' +
        'background:rgba(88,166,255,0.08);color:#58a6ff;border:1px solid rgba(88,166,255,0.2);' +
        'cursor:pointer;font-family:inherit;transition:all .15s;line-height:1;' +
      '"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 6 9 12 15 18"/></svg></button>' +
      '<button id="__zq_bar_close" title="Close toolbar" style="' +
        'padding:0 4px;color:#484f58;cursor:pointer;font-size:14px;border:none;' +
        'background:none;font-family:inherit;line-height:1;' +
      '">&times;</button>';

    document.body.appendChild(devBar);

    // If previously expanded, restore that state immediately
    if (__zqBarExpanded) {
      var items = devBar.querySelectorAll('.__zq_ex');
      var btn = document.getElementById('__zq_bar_toggle');
      if (btn) {
        btn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>';
        btn.title = 'Collapse toolbar';
      }
      for (var i = 0; i < items.length; i++) {
        items[i].style.display = 'inline';
        items[i].style.transform = 'scale(1)';
        items[i].style.opacity = '1';
      }
    }
    updateDevBar();

    // Live-poll stats so numbers stay current without waiting for events
    setInterval(updateDevBar, 1000);

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

    // Open devtools popup
    var __zqPopup = null;
    function openDevToolsPopup(tab) {
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

    function openTab(tab) {
      if (isInSplitFrame()) { switchDevTab(tab); } else { openDevToolsPopup(tab); }
    }

    // Stat click handlers → open relevant devtools tab
    document.getElementById('__zq_bar_route').addEventListener('click', function() { openTab('router'); });
    document.getElementById('__zq_bar_comps').addEventListener('click', function() { openTab('components'); });
    document.getElementById('__zq_bar_morphs').addEventListener('click', function() { openTab('perf'); });
    document.getElementById('__zq_bar_reqs').addEventListener('click', function() { openTab('network'); });
    document.getElementById('__zq_bar_els').addEventListener('click', function() { openTab('dom'); });

    // Expand / collapse toggle
    document.getElementById('__zq_bar_toggle').addEventListener('click', function() {
      __zqBarExpanded = !__zqBarExpanded;
      try { localStorage.setItem('__zq_bar_expanded', __zqBarExpanded ? '1' : '0'); } catch(e) {}
      var items = devBar.querySelectorAll('.__zq_ex');
      var btn = this;
      if (__zqBarExpanded) {
        btn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>';
        btn.title = 'Collapse toolbar';
        for (var i = 0; i < items.length; i++) {
          items[i].style.display = 'inline';
          items[i].offsetWidth; // reflow
          items[i].style.transform = 'scale(1)';
          items[i].style.opacity = '1';
        }
        updateDevBar();
      } else {
        btn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 6 9 12 15 18"/></svg>';
        btn.title = 'Expand toolbar';
        for (var i = 0; i < items.length; i++) {
          items[i].style.transform = 'scale(0)';
          items[i].style.opacity = '0';
        }
        setTimeout(function() {
          if (!__zqBarExpanded) {
            var items = devBar.querySelectorAll('.__zq_ex');
            for (var i = 0; i < items.length; i++) items[i].style.display = 'none';
          }
        }, 250);
      }
    });

    // Toggle hover
    document.getElementById('__zq_bar_toggle').addEventListener('mouseover', function() {
      this.style.background = 'rgba(88,166,255,0.18)';
    });
    document.getElementById('__zq_bar_toggle').addEventListener('mouseout', function() {
      this.style.background = 'rgba(88,166,255,0.08)';
    });

    // Close button
    document.getElementById('__zq_bar_close').addEventListener('click', function() {
      devBar.style.display = 'none';
    });
  }

  function updateDevBar() {
    if (!devBar) return;
    var reqEl = document.getElementById('__zq_bar_reqs');
    var morphEl = document.getElementById('__zq_bar_morphs');
    if (reqEl) reqEl.textContent = __zqRequests.length + ' req';
    if (morphEl) morphEl.textContent = __zqMorphCount + ' render';

    if (__zqBarExpanded) {
      var routeEl = document.getElementById('__zq_bar_route');
      var compsEl = document.getElementById('__zq_bar_comps');
      var elsEl = document.getElementById('__zq_bar_els');
      if (routeEl) {
        var lastEvt = __zqRouterEvents.length ? __zqRouterEvents[__zqRouterEvents.length - 1] : null;
        var action = lastEvt ? lastEvt.action : '';
        var path = location.pathname + location.hash;
        if (path.length > 16) path = path.substring(0, 14) + '…';
        var colors = __zqRouteColors[action] || __zqRouteDefault;
        routeEl.style.background = colors.bg;
        routeEl.style.color = colors.fg;
        if (action) {
          var label = action === 'pop-substate' ? 'pop' : action;
          routeEl.textContent = label + ' ' + path;
          routeEl.title = action + ' → ' + location.pathname + location.hash;
        } else {
          routeEl.textContent = path;
        }
        // Flash brightness on fresh events
        if (lastEvt && (Date.now() - lastEvt.timestamp) < 2000) {
          routeEl.style.outline = '1px solid ' + colors.fg;
          clearTimeout(__zqRouteFadeTimer);
          __zqRouteFadeTimer = setTimeout(function() {
            var el = document.getElementById('__zq_bar_route');
            if (el) el.style.outline = 'none';
          }, 1800);
        } else {
          routeEl.style.outline = 'none';
        }
      }
      if (compsEl) {
        var count = 0;
        try {
          if (window.$ && $.components) count = Object.keys($.components()).length;
          else if (window.$ && $._components) count = Object.keys($._components).length;
        } catch(e) {}
        compsEl.textContent = count + ' comps';
      }
      if (elsEl) {
        elsEl.textContent = document.querySelectorAll('*').length + ' els';
      }
    }
  }

  // Expose for devtools popup
  window.__zqDevTools = {
    get requests() { return __zqRequests; },
    get morphEvents() { return __zqMorphEvents; },
    get morphCount() { return __zqMorphCount; },
    get renderCount() { return __zqRenderCount; },
    get routerEvents() { return __zqRouterEvents; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createDevBar);
  } else {
    createDevBar();
  }
})();
</script>`;

module.exports = OVERLAY_SCRIPT;
