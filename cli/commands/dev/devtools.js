/**
 * cli/commands/dev/devtools.js — Live DOM Inspector & DevTools panel
 *
 * Self-contained HTML page served at /_devtools. Opens as a popup from
 * the dev toolbar and inspects the opener window's live DOM, network
 * requests, component state, and morph events.
 *
 * Communication:
 *   - window.opener: direct DOM access (same-origin popup)
 *   - BroadcastChannel('__zq_devtools'): cross-tab fallback
 */

'use strict';

const DEVTOOLS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>zQuery DevTools</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0d1117;--bg2:#161b22;--bg3:#1c2128;--border:#30363d;--text:#c9d1d9;
--text2:#8b949e;--accent:#58a6ff;--green:#3fb950;--red:#f85149;--yellow:#d29922;
--purple:#bc8cff;--cyan:#79c0ff;--font:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
html,body{height:100%;background:var(--bg);color:var(--text);font:12px/1.5 var(--font);overflow:hidden}
a{color:var(--accent);text-decoration:none}
button{font:inherit;cursor:pointer;border:none;background:none;color:inherit}

/* Layout */
#root{display:grid;height:100vh}
#root.popup{grid-template-columns:1fr;grid-template-rows:0 1fr}
#root.split-h{grid-template-columns:1fr 4px 1fr;grid-template-rows:1fr}
#root.split-v{grid-template-columns:1fr;grid-template-rows:1fr 4px 1fr}
#root.devtools-only{grid-template-columns:1fr;grid-template-rows:1fr}
#root.devtools-only #app-frame,#root.devtools-only .divider{display:none}
#app-frame{border:none;width:100%;height:100%;background:#0d1117;color-scheme:dark}
#root.popup #app-frame{display:none}
.divider{background:var(--border);cursor:col-resize;position:relative;z-index:10}
#root.split-v .divider{cursor:row-resize}
.divider:hover{background:var(--accent)}
#devtools{display:grid;grid-template-rows:36px 1fr;overflow:hidden}

/* Top bar */
.topbar{display:flex;align-items:center;gap:8px;padding:0 12px;background:var(--bg2);
border-bottom:1px solid var(--border);font-size:11px;user-select:none}
.topbar-title{font-weight:700;color:var(--accent);margin-right:8px;font-size:12px}
.topbar-status{display:flex;align-items:center;gap:4px;color:var(--green)}
.topbar-status.err{color:var(--red)}
.topbar-dot{width:6px;height:6px;border-radius:50%;background:currentColor}
.topbar-right{margin-left:auto;display:flex;gap:12px;align-items:center;color:var(--text2)}
.topbar-stat{display:flex;align-items:center;gap:4px;cursor:pointer;border-radius:3px;padding:2px 6px}
.topbar-stat:hover{background:rgba(88,166,255,0.1)}

/* Tabs */
.tabs{display:flex;gap:0;border-bottom:1px solid var(--border);background:var(--bg2)}
.tab{padding:6px 16px;font-size:11px;font-weight:600;color:var(--text2);border-bottom:2px solid transparent;
transition:color .15s,border-color .15s}
.tab:hover{color:var(--text)}
.tab.active{color:var(--accent);border-bottom-color:var(--accent)}

/* Main area */
.main{display:grid;grid-template-rows:auto 1fr;overflow:hidden}
.panel{display:none;overflow:auto;padding:0}
.panel.active{display:block}

/* DOM Tree */
.tree{padding:8px 0;font-size:12px}
.tree-node{padding:0 0 0 14px}
.tree-row{display:flex;align-items:center;gap:2px;padding:1px 12px 1px 0;cursor:pointer;
border-radius:3px;white-space:nowrap;line-height:20px}
.tree-row:hover{background:rgba(88,166,255,0.08)}
.tree-row.selected{background:rgba(88,166,255,0.15)}
.tree-toggle{width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;
color:var(--text2);font-size:8px;flex-shrink:0;transition:transform .12s;cursor:pointer;border-radius:3px}
.tree-toggle:hover{background:rgba(88,166,255,0.15);color:var(--accent)}
.tree-toggle.open{transform:rotate(90deg)}
.tree-toggle.leaf{visibility:hidden;pointer-events:none}
.tree-tag{color:var(--purple)}
.tree-attr-name{color:var(--cyan)}
.tree-attr-val{color:var(--green)}
.tree-text{color:var(--text2);font-style:italic;max-width:300px;overflow:hidden;text-overflow:ellipsis}
.tree-comment{color:#555;font-style:italic}
.tree-children{display:none}
.tree-children.open{display:block}
.tree-badge{font-size:9px;padding:0 5px;border-radius:3px;font-weight:700;margin-left:4px;line-height:16px;letter-spacing:.3px}
.tree-badge.comp{background:rgba(188,140,255,0.15);color:var(--purple)}
.tree-badge.scoped{background:rgba(121,192,255,0.15);color:var(--cyan)}
.tree-badge.entry{background:rgba(63,185,80,0.15);color:var(--green)}
.tree-badge.router{background:rgba(210,153,34,0.15);color:var(--yellow)}

/* Morph highlights */
.tree-row.morph-added{background:rgba(63,185,80,0.15);animation:morphFade 2s ease-out forwards}
.tree-row.morph-removed{background:rgba(248,81,73,0.15);animation:morphFade 2s ease-out forwards}
.tree-row.morph-changed{background:rgba(210,153,34,0.15);animation:morphFade 2s ease-out forwards}
@keyframes morphFade{to{background:transparent}}

/* Details panel (above tree for elements) */
.detail{padding:12px;border-bottom:1px solid var(--border);background:var(--bg2);
max-height:40vh;overflow-y:auto;font-size:11px;position:relative}
.detail h4{color:var(--accent);font-size:11px;text-transform:uppercase;letter-spacing:.5px;margin:0 0 6px}
.detail-section{margin-bottom:12px}
.detail-row{display:flex;gap:8px;padding:2px 0}
.detail-key{color:var(--cyan);min-width:80px;flex-shrink:0}
.detail-val{color:var(--text);word-break:break-all}
.detail-close{position:absolute;top:8px;right:8px;background:none;border:none;color:var(--text2);cursor:pointer;
font-size:14px;line-height:1;padding:2px 6px;border-radius:3px}
.detail-close:hover{background:rgba(88,166,255,0.15);color:var(--accent)}
.panel-toolbar{display:flex;align-items:center;gap:8px;padding:6px 12px;border-bottom:1px solid var(--border);
background:var(--bg2);font-size:11px}
.panel-toolbar button{background:rgba(88,166,255,0.1);border:1px solid rgba(88,166,255,0.2);color:var(--accent);
padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px;font-weight:600}
.panel-toolbar button:hover{background:rgba(88,166,255,0.2)}
.timestamp{color:var(--text2);font-size:9px;margin-left:auto;font-family:monospace}

/* Network log */
.net-table{width:100%;border-collapse:collapse;font-size:11px}
.net-table th{position:sticky;top:0;background:var(--bg2);border-bottom:1px solid var(--border);
padding:6px 10px;text-align:left;font-weight:600;color:var(--text2);font-size:10px;text-transform:uppercase}
.net-table td{padding:5px 10px;border-bottom:1px solid rgba(48,54,61,0.5);white-space:nowrap}
.net-table tr:hover td{background:rgba(88,166,255,0.04)}
.net-table tr.expanded td{background:rgba(88,166,255,0.06)}
.net-method{font-weight:700;font-size:10px;padding:1px 5px;border-radius:3px;display:inline-block;min-width:36px;text-align:center}
.net-method.GET{background:rgba(88,166,255,0.15);color:var(--accent)}
.net-method.POST{background:rgba(63,185,80,0.15);color:var(--green)}
.net-method.PUT{background:rgba(210,153,34,0.15);color:var(--yellow)}
.net-method.PATCH{background:rgba(188,140,255,0.15);color:var(--purple)}
.net-method.DELETE{background:rgba(248,81,73,0.15);color:var(--red)}
.net-status{font-weight:600}
.net-status.ok{color:var(--green)}
.net-status.redirect{color:var(--yellow)}
.net-status.err{color:var(--red)}
.net-time{color:var(--text2)}
.net-url{color:var(--text);max-width:400px;overflow:hidden;text-overflow:ellipsis}
.net-body-row td{padding:8px 10px;white-space:pre-wrap;word-break:break-all;font-size:11px;
color:var(--text2);background:var(--bg3);border-bottom:1px solid var(--border)}
.net-body-row .json-tree{max-height:240px;overflow:auto;font-size:11px;line-height:1.6}
.json-key{color:var(--cyan)}
.json-str{color:var(--green)}
.json-num{color:var(--yellow)}
.json-bool{color:var(--purple);font-weight:600}
.json-null{color:var(--text2);font-style:italic}
.json-toggle{cursor:pointer;user-select:none;border-radius:3px;padding:0 2px}
.json-toggle:hover{background:rgba(88,166,255,0.1)}
.json-bracket{color:var(--text2)}
.json-ellipsis{color:var(--text2);font-style:italic;cursor:pointer}
.json-ellipsis:hover{color:var(--accent)}
.json-children{padding-left:16px}
.json-children.collapsed{display:none}
.json-comma{color:var(--text2)}
.json-count{color:var(--text2);font-size:10px;font-style:italic;margin-left:4px}

/* Components tab */
.comp-card{margin:8px;padding:10px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:6px}
.comp-name{color:var(--purple);font-weight:700;font-size:13px;margin-bottom:4px}
.comp-host{color:var(--text2);font-size:10px;margin-bottom:8px}
.comp-state{font-size:11px}
.comp-state-key{color:var(--cyan)}
.comp-state-val{color:var(--green)}

/* Performance tab */
.perf-card{margin:8px;padding:12px;background:var(--bg2);border:1px solid var(--border);border-radius:6px}
.perf-title{font-weight:700;color:var(--accent);margin-bottom:8px;font-size:12px}
.perf-bar{height:18px;background:var(--bg3);border-radius:3px;overflow:hidden;margin:4px 0}
.perf-fill{height:100%;border-radius:3px;transition:width .3s}
.perf-label{display:flex;justify-content:space-between;font-size:10px;color:var(--text2)}

/* Disconnected overlay */
.disconnected{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
justify-content:center;background:rgba(13,17,23,0.95);z-index:100;gap:12px}
.disconnected h2{color:var(--red);font-size:16px}
.disconnected p{color:var(--text2);font-size:13px;text-align:center;max-width:400px;line-height:1.6}
.disconnected code{background:var(--bg3);padding:2px 8px;border-radius:3px;color:var(--cyan)}

/* Empty state */
.empty-state{display:flex;align-items:center;justify-content:center;height:100%;color:var(--text2);
font-size:13px;flex-direction:column;gap:8px}

/* Scrollbar */
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:rgba(30,33,38,0.8);border-radius:2px}
::-webkit-scrollbar-thumb:hover{background:rgba(40,44,52,0.9)}
</style>
</head>
<body>
<div id="root">
  <!-- App iframe (for standalone tab mode) -->
  <iframe id="app-frame" src="/"></iframe>
  <div class="divider" id="divider"></div>
  <!-- DevTools panel -->
  <div id="devtools">
  <!-- Top bar -->
  <div class="topbar">
    <span class="topbar-title">zQuery DevTools</span>
    <button id="mode-toggle" title="Toggle layout" style="padding:2px 6px;border-radius:3px;background:rgba(88,166,255,0.1);color:var(--accent);font-size:10px;font-weight:600;border:1px solid rgba(88,166,255,0.2);cursor:pointer">⮂</button>
    <span class="topbar-status" id="status"><span class="topbar-dot"></span> <span id="status-text">Connecting...</span></span>
    <div class="topbar-right">
      <span class="topbar-stat" id="el-count" data-tab="dom" title="DOM elements">0 elements</span>
      <span class="topbar-stat" id="morph-count" data-tab="perf" title="Render operations">0 renders</span>
      <span class="topbar-stat" id="req-count" data-tab="network" title="Network requests">0 requests</span>
    </div>
  </div>

  <!-- Tabs + panels -->
  <div class="main">
    <div class="tabs">
      <button class="tab active" data-tab="dom">Elements</button>
      <button class="tab" data-tab="network">Network</button>
      <button class="tab" data-tab="components">Components</button>
      <button class="tab" data-tab="perf">Performance</button>
    </div>

    <!-- Elements panel -->
    <div class="panel active" id="panel-dom">
      <div class="detail" id="dom-detail" style="display:none"></div>
      <div class="tree" id="dom-tree"></div>
    </div>

    <!-- Network panel -->
    <div class="panel" id="panel-network">
      <div class="panel-toolbar" id="net-toolbar">
        <button id="net-clear" title="Clear network log">Clear</button>
      </div>
      <table class="net-table">
        <thead><tr><th>Method</th><th>Status</th><th>URL</th><th>Time</th><th>Timestamp</th><th style="width:35%">Preview</th></tr></thead>
        <tbody id="net-body"></tbody>
      </table>
    </div>

    <!-- Components panel -->
    <div class="panel" id="panel-components">
      <div id="comp-list"></div>
    </div>

    <!-- Performance panel -->
    <div class="panel" id="panel-perf">
      <div class="panel-toolbar" id="perf-toolbar">
        <button id="perf-clear" title="Clear performance recordings">Clear</button>
      </div>
      <div id="perf-content"></div>
    </div>
  </div>
  </div>
</div>

<div class="disconnected" id="disconnected" style="display:none">
  <h2>Connecting...</h2>
  <p>Loading your app in the embedded frame. If this persists, check that your dev server is running.</p>
</div>

<script>
(function() {
  'use strict';

  // ===================================================================
  // Connection — find target window (opener popup → iframe fallback)
  // ===================================================================
  var targetWin = null;
  var targetDoc = null;
  var channel;
  var morphCount = 0;
  var requests = [];
  var selectedEl = null;
  var rootEl = document.getElementById('root');
  var iframe = document.getElementById('app-frame');
  var mode = 'split-h'; // split-h | split-v | devtools-only | popup

  try { channel = new BroadcastChannel('__zq_devtools'); } catch(e) {}

  function isConnected() {
    try { return targetWin && (targetWin === window.opener ? !targetWin.closed : true) && targetWin.document; }
    catch(e) { return false; }
  }

  function detectMode() {
    if (window.opener) {
      // Opened as popup — hide iframe, use opener
      mode = 'popup';
      targetWin = window.opener;
    } else {
      // Standalone tab — embed app in iframe
      mode = 'split-h';
      targetWin = null; // will set from iframe.contentWindow
    }
    rootEl.className = mode;
  }

  detectMode();

  // Layout toggle: split-h → split-v → devtools-only → split-h
  document.getElementById('mode-toggle').addEventListener('click', function() {
    if (mode === 'popup') return; // can't toggle in popup mode
    if (mode === 'split-h') mode = 'split-v';
    else if (mode === 'split-v') mode = 'devtools-only';
    else mode = 'split-h';
    // Clear any inline grid overrides from drag-resize so the CSS class takes over
    rootEl.style.gridTemplateColumns = '';
    rootEl.style.gridTemplateRows = '';
    rootEl.className = mode;
    this.textContent = mode === 'split-h' ? '\u2b82' : mode === 'split-v' ? '\u2b81' : '\u25a1';
  });

  // Divider drag-to-resize
  var divider = document.getElementById('divider');
  divider.addEventListener('mousedown', function(e) {
    e.preventDefault();
    var startX = e.clientX, startY = e.clientY;
    var isH = mode === 'split-h';
    var total = isH ? rootEl.offsetWidth : rootEl.offsetHeight;
    var startFrac = isH
      ? (iframe.offsetWidth / total)
      : (iframe.offsetHeight / total);

    // Prevent iframe from stealing mouse events during drag
    iframe.style.pointerEvents = 'none';
    document.body.style.userSelect = 'none';
    document.body.style.cursor = isH ? 'col-resize' : 'row-resize';

    function onMove(e2) {
      var delta = isH ? (e2.clientX - startX) / total : (e2.clientY - startY) / total;
      var frac = Math.min(0.85, Math.max(0.15, startFrac + delta));
      var pct = (frac * 100).toFixed(1) + '%';
      var rest = ((1 - frac) * 100).toFixed(1) + '%';
      if (isH) rootEl.style.gridTemplateColumns = pct + ' 4px ' + rest;
      else rootEl.style.gridTemplateRows = pct + ' 4px ' + rest;
    }
    function onUp() {
      iframe.style.pointerEvents = '';
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  function init() {
    // If popup mode, targetWin is already set
    // If iframe mode, wait for iframe to load
    if (!isConnected()) {
      if (mode !== 'popup') {
        // Wait for iframe
        iframe.addEventListener('load', function() {
          try {
            targetWin = iframe.contentWindow;
            targetDoc = targetWin.document;
            // Inject dark scrollbar styles into the iframe content
            try {
              var s = targetDoc.createElement('style');
              s.textContent = '::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:2px}::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.2)}html{scrollbar-color:rgba(255,255,255,0.12) transparent;scrollbar-width:thin}';
              targetDoc.head.appendChild(s);
            } catch(se) {}
          } catch(e) {
            document.getElementById('disconnected').style.display = 'flex';
            return;
          }
          document.getElementById('disconnected').style.display = 'none';
          connectToTarget();
        });
        return;
      }
      document.getElementById('disconnected').style.display = 'flex';
      // Retry for popup opener
      setTimeout(function() {
        targetWin = window.opener;
        if (isConnected()) {
          document.getElementById('disconnected').style.display = 'none';
          init();
        }
      }, 1000);
      return;
    }

    targetDoc = targetWin.document;
    connectToTarget();
  }

  function connectToTarget() {

    // Read existing requests from opener
    if (targetWin.__zqDevTools) {
      requests = targetWin.__zqDevTools.requests.slice();
      morphCount = targetWin.__zqDevTools.morphCount || 0;
    }

    buildDOMTree();
    renderNetwork();
    renderComponents();
    renderPerf();
    startObserver();
    updateStats();

    // Listen for BroadcastChannel messages
    if (channel) {
      channel.onmessage = function(e) {
        var msg = e.data;
        if (msg.type === 'http') {
          requests.push(msg.data);
          if (requests.length > 500) requests.shift();
          renderNetwork();
          updateStats();
        } else if (msg.type === 'morph') {
          morphCount++;
          updateStats();
          renderPerf();
        } else if (msg.type === 'morph-detail') {
          morphCount++;
          recordMorphEvent(msg.data);
          updateStats();
          renderPerf();
        } else if (msg.type === 'render-detail') {
          morphCount++;
          recordMorphEvent({ target: msg.data.target, elapsed: msg.data.elapsed, kind: msg.data.kind, timestamp: msg.data.timestamp });
          updateStats();
          renderPerf();
        }
      };
    }

    // Periodic refresh for components + perf
    setInterval(function() {
      if (!isConnected()) {
        document.getElementById('disconnected').style.display = 'flex';
        return;
      }
      renderComponents();
      updateStats();
      // Sync requests from opener
      if (targetWin.__zqDevTools) {
        requests = targetWin.__zqDevTools.requests.slice();
        morphCount = targetWin.__zqDevTools.morphCount || 0;
      }
    }, 2000);
  }

  // ===================================================================
  // Tab switching
  // ===================================================================
  document.querySelector('.tabs').addEventListener('click', function(e) {
    var tab = e.target.closest('.tab');
    if (!tab) return;
    switchTab(tab.dataset.tab);
  });

  // ===================================================================
  // Topbar stat clicks → switch to corresponding tab
  // ===================================================================
  function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
    var tabBtn = document.querySelector('.tab[data-tab="' + tabName + '"]');
    var panel = document.getElementById('panel-' + tabName);
    if (tabBtn) tabBtn.classList.add('active');
    if (panel) panel.classList.add('active');
  }

  document.querySelector('.topbar-right').addEventListener('click', function(e) {
    var stat = e.target.closest('.topbar-stat');
    if (stat && stat.dataset.tab) switchTab(stat.dataset.tab);
  });

  // Listen for tab-switch requests from the app's devbar (via BroadcastChannel)
  if (channel) {
    channel.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'switch-tab' && e.data.tab) {
        switchTab(e.data.tab);
      }
    });
  }

  // Switch to tab specified in URL hash (e.g. /_devtools#network)
  var hashTab = location.hash.replace('#', '');
  if (hashTab) switchTab(hashTab);

  // ===================================================================
  // Clear / Reset buttons
  // ===================================================================
  document.getElementById('net-clear').addEventListener('click', function() {
    requests = [];
    renderNetwork();
    updateStats();
  });

  document.getElementById('perf-clear').addEventListener('click', function() {
    morphEvents = [];
    morphCount = 0;
    renderPerf();
    updateStats();
  });

  // ===================================================================
  // DOM Tree
  // ===================================================================
  var expandedPaths = {}; // track expanded nodes by path to survive rebuilds
  var componentNames = {}; // cache of registered component tag names

  function getNodePath(node) {
    var parts = [];
    var cur = node;
    while (cur && cur.nodeType === 1) {
      var tag = cur.tagName.toLowerCase();
      var idx = 0;
      var sib = cur.previousElementSibling;
      while (sib) { if (sib.tagName === cur.tagName) idx++; sib = sib.previousElementSibling; }
      parts.unshift(tag + (idx ? ':' + idx : ''));
      cur = cur.parentElement;
    }
    return parts.join('>');
  }

  function refreshComponentNames() {
    componentNames = {};
    try {
      if (targetWin && targetWin.$ && typeof targetWin.$.components === 'function') {
        var reg = targetWin.$.components();
        var keys = Object.keys(reg);
        for (var i = 0; i < keys.length; i++) componentNames[keys[i].toLowerCase()] = true;
      }
    } catch(e) {}
  }

  function buildDOMTree() {
    refreshComponentNames();
    var tree = document.getElementById('dom-tree');
    tree.innerHTML = '';
    if (!targetDoc) return;
    var root = targetDoc.documentElement;
    tree.appendChild(buildNode(root, 0));
  }

  function esc(s) {
    var d = document.createElement('span');
    d.textContent = s;
    return d.innerHTML;
  }

  function buildNode(node, depth) {
    var wrap = document.createElement('div');
    wrap.className = 'tree-node';

    if (node.nodeType === 3) {
      var text = node.textContent.trim();
      if (!text) return wrap;
      var row = document.createElement('div');
      row.className = 'tree-row';
      row.innerHTML = '<span class="tree-toggle leaf"></span><span class="tree-text">' +
        esc(text.length > 60 ? text.slice(0, 60) + '...' : text) + '</span>';
      wrap.appendChild(row);
      return wrap;
    }
    if (node.nodeType === 8) {
      var row = document.createElement('div');
      row.className = 'tree-row';
      row.innerHTML = '<span class="tree-toggle leaf"></span><span class="tree-comment">&lt;!-- ' +
        esc(node.textContent.trim().slice(0, 40)) + ' --&gt;</span>';
      wrap.appendChild(row);
      return wrap;
    }
    if (node.nodeType !== 1) return wrap;

    // Skip devtools-injected overlay
    if (node.id === '__zq_error_overlay' || node.id === '__zq_devbar') return wrap;

    var tag = node.tagName.toLowerCase();
    var nodePath = getNodePath(node);
    var hasChildren = false;
    var childNodes = node.childNodes;
    for (var i = 0; i < childNodes.length; i++) {
      var cn = childNodes[i];
      if (cn.nodeType === 1 || (cn.nodeType === 3 && cn.textContent.trim())) { hasChildren = true; break; }
    }

    // Detect special nodes
    var isScopedStyle = tag === 'style' && node.hasAttribute('data-zq-scope');
    var isComponent = !isScopedStyle && (componentNames[tag] || node.hasAttribute('data-zq-component'));
    var isRouterView = tag === 'div' && (node.id === 'app' || node.hasAttribute('data-zq-router'));
    var isEntryPoint = tag === 'body' || isRouterView;

    // Build row
    var row = document.createElement('div');
    row.className = 'tree-row';
    row.__targetNode = node;

    var toggleCls = hasChildren ? 'tree-toggle' : 'tree-toggle leaf';
    var html = '<span class="' + toggleCls + '">&#9654;</span>';
    html += '<span class="tree-tag">&lt;' + tag + '</span>';

    // Show key attributes inline
    var attrs = node.attributes;
    var shown = 0;
    for (var i = 0; i < attrs.length && shown < 4; i++) {
      var a = attrs[i];
      if (a.name === 'style' || a.name === 'class' && a.value.length > 40) continue;
      html += ' <span class="tree-attr-name">' + esc(a.name) + '</span>';
      if (a.value) html += '=<span class="tree-attr-val">&quot;' + esc(a.value.length > 30 ? a.value.slice(0, 30) + '...' : a.value) + '&quot;</span>';
      shown++;
    }
    html += '<span class="tree-tag">&gt;</span>';

    // Badges for components, router, entry-point, scoped css
    if (isScopedStyle) html += '<span class="tree-badge scoped">scoped css</span>';
    else if (isComponent) html += '<span class="tree-badge comp">component</span>';
    if (isRouterView) html += '<span class="tree-badge router">router</span>';
    else if (isEntryPoint) html += '<span class="tree-badge entry">entry</span>';

    // Inline text for leaf elements
    if (!hasChildren || (childNodes.length === 1 && childNodes[0].nodeType === 3)) {
      var text = node.textContent.trim();
      if (text && text.length < 60) {
        html += '<span class="tree-text">' + esc(text) + '</span>';
        html += '<span class="tree-tag">&lt;/' + tag + '&gt;</span>';
      }
    }

    row.innerHTML = html;
    wrap.appendChild(row);

    // Children container
    if (hasChildren) {
      var childDiv = document.createElement('div');
      childDiv.className = 'tree-children';

      // Restore expanded state or auto-expand first 3 levels
      var isExpanded = expandedPaths.hasOwnProperty(nodePath) ? expandedPaths[nodePath] : (depth < 3);
      if (isExpanded) {
        childDiv.classList.add('open');
        row.querySelector('.tree-toggle').classList.add('open');
      }

      for (var i = 0; i < childNodes.length; i++) {
        var child = buildNode(childNodes[i], depth + 1);
        if (child.innerHTML) childDiv.appendChild(child);
      }
      wrap.appendChild(childDiv);
    }

    // Toggle click (on the arrow only)
    var toggleEl = row.querySelector('.tree-toggle');
    if (hasChildren) {
      toggleEl.addEventListener('click', function(e) {
        e.stopPropagation();
        var children = row.nextElementSibling;
        if (children && children.classList.contains('tree-children')) {
          var opening = !children.classList.contains('open');
          children.classList.toggle('open');
          toggleEl.classList.toggle('open');
          expandedPaths[nodePath] = opening;
        }
      });
    }

    // Row click — select element (not toggle)
    row.addEventListener('click', function(e) {
      // Don't select when clicking toggle arrow
      if (e.target.closest('.tree-toggle')) return;
      document.querySelectorAll('.tree-row.selected').forEach(function(r) { r.classList.remove('selected'); });
      row.classList.add('selected');
      selectedEl = node;
      showDetail(node);
      try { highlightElement(node); } catch(err) {}
    });

    // Double-click to expand/collapse
    row.addEventListener('dblclick', function(e) {
      if (!hasChildren) return;
      e.preventDefault();
      var children = row.nextElementSibling;
      if (children && children.classList.contains('tree-children')) {
        var opening = !children.classList.contains('open');
        children.classList.toggle('open');
        toggleEl.classList.toggle('open');
        expandedPaths[nodePath] = opening;
      }
    });

    return wrap;
  }

  function highlightElement(el) {
    if (!targetWin || !targetDoc) return;
    // Remove previous highlight
    var prev = targetDoc.getElementById('__zq_highlight');
    if (prev) prev.remove();

    var rect = el.getBoundingClientRect();
    if (!rect.width && !rect.height) return;

    var box = targetDoc.createElement('div');
    box.id = '__zq_highlight';
    box.style.cssText = 'position:fixed;z-index:2147483645;pointer-events:none;' +
      'border:2px solid rgba(88,166,255,0.8);background:rgba(88,166,255,0.1);' +
      'transition:all .15s ease;' +
      'top:' + rect.top + 'px;left:' + rect.left + 'px;' +
      'width:' + rect.width + 'px;height:' + rect.height + 'px;';
    targetDoc.body.appendChild(box);
    setTimeout(function() { if (box.parentNode) box.remove(); }, 2000);
  }

  function showDetail(node) {
    var detail = document.getElementById('dom-detail');
    detail.style.display = 'block';
    var html = '<button class="detail-close" id="detail-close" title="Close">&times;</button>';

    // Tag and ID
    html += '<div class="detail-section"><h4>Element</h4>';
    html += '<div class="detail-row"><span class="detail-key">Tag</span><span class="detail-val">' + node.tagName.toLowerCase() + '</span></div>';
    if (node.id) html += '<div class="detail-row"><span class="detail-key">ID</span><span class="detail-val">' + esc(node.id) + '</span></div>';
    if (node.className) html += '<div class="detail-row"><span class="detail-key">Classes</span><span class="detail-val">' + esc(node.className) + '</span></div>';
    html += '</div>';

    // Attributes
    if (node.attributes.length) {
      html += '<div class="detail-section"><h4>Attributes</h4>';
      for (var i = 0; i < node.attributes.length; i++) {
        var a = node.attributes[i];
        html += '<div class="detail-row"><span class="detail-key">' + esc(a.name) + '</span><span class="detail-val">' + esc(a.value) + '</span></div>';
      }
      html += '</div>';
    }

    // Dimensions
    var rect = node.getBoundingClientRect();
    html += '<div class="detail-section"><h4>Box Model</h4>';
    html += '<div class="detail-row"><span class="detail-key">Size</span><span class="detail-val">' + Math.round(rect.width) + ' × ' + Math.round(rect.height) + '</span></div>';
    html += '<div class="detail-row"><span class="detail-key">Position</span><span class="detail-val">(' + Math.round(rect.left) + ', ' + Math.round(rect.top) + ')</span></div>';
    html += '</div>';

    // Component state
    try {
      if (targetWin.$ && targetWin.$.getInstance) {
        var inst = targetWin.$.getInstance(node);
        if (inst && inst.state) {
          html += '<div class="detail-section"><h4>Component State</h4>';
          var stateKeys = Object.keys(inst.state);
          for (var i = 0; i < stateKeys.length; i++) {
            var k = stateKeys[i];
            var v = inst.state[k];
            var display = typeof v === 'object' ? JSON.stringify(v, null, 1) : String(v);
            html += '<div class="detail-row"><span class="detail-key">' + esc(k) + '</span><span class="detail-val">' + esc(display) + '</span></div>';
          }
          html += '</div>';
        }
      }
    } catch(err) {}

    detail.innerHTML = html;
    document.getElementById('detail-close').addEventListener('click', function() {
      detail.style.display = 'none';
      document.querySelectorAll('.tree-row.selected').forEach(function(r) { r.classList.remove('selected'); });
      selectedEl = null;
    });
  }

  // ===================================================================
  // MutationObserver — watch target document for live DOM changes
  // ===================================================================
  var observer;

  function startObserver() {
    if (!targetDoc || observer) return;
    observer = new MutationObserver(function(mutations) {
      // Debounce tree rebuild
      clearTimeout(startObserver._timer);
      startObserver._timer = setTimeout(function() {
        buildDOMTree();
        updateStats();
      }, 150);
    });
    observer.observe(targetDoc.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });
  }

  // ===================================================================
  // Network log
  // ===================================================================
  function formatTime(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + ' ' + ampm;
  }

  function renderNetwork() {
    var tbody = document.getElementById('net-body');
    var html = '';
    for (var i = requests.length - 1; i >= 0; i--) {
      var r = requests[i];
      var statusCls = r.status < 300 ? 'ok' : r.status < 400 ? 'redirect' : 'err';
      var preview = '';
      if (r.bodyPreview) {
        try { preview = JSON.stringify(JSON.parse(r.bodyPreview), null, 0); } catch(e) { preview = r.bodyPreview; }
        if (preview.length > 120) preview = preview.slice(0, 120) + '...';
      }
      html += '<tr data-idx="' + i + '">';
      html += '<td><span class="net-method ' + r.method + '">' + r.method + '</span></td>';
      html += '<td><span class="net-status ' + statusCls + '">' + r.status + '</span></td>';
      html += '<td class="net-url" title="' + esc(r.url) + '">' + esc(r.url) + '</td>';
      html += '<td class="net-time">' + r.elapsed + 'ms</td>';
      html += '<td class="timestamp">' + formatTime(r.timestamp) + '</td>';
      html += '<td style="color:var(--text2);font-size:10px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(preview) + '</td>';
      html += '</tr>';
    }
    if (!html) html = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text2)">No requests yet</td></tr>';
    tbody.innerHTML = html;
  }

  // Click to expand/collapse (attached once, outside renderNetwork)
  document.getElementById('net-body').addEventListener('click', function(e) {
    var tr = e.target.closest('tr');
    if (!tr || !tr.dataset.idx) return;
    var idx = parseInt(tr.dataset.idx);
    var existing = tr.nextElementSibling;
    if (existing && existing.classList.contains('net-body-row')) {
      existing.remove();
      tr.classList.remove('expanded');
      return;
    }
    tr.classList.add('expanded');
    var r = requests[idx];
    if (!r) return;
    var detail = document.createElement('tr');
    detail.className = 'net-body-row';
    var td = document.createElement('td');
    td.colSpan = 6;
    var body = r.bodyPreview || '';
    var parsed = null;
    try { parsed = JSON.parse(body); } catch(e2) {}
    if (parsed !== null && typeof parsed === 'object') {
      var treeWrap = document.createElement('div');
      treeWrap.className = 'json-tree';
      treeWrap.appendChild(buildJsonNode(parsed, true));
      td.appendChild(treeWrap);
    } else {
      var pre = document.createElement('pre');
      pre.style.cssText = 'margin:0;max-height:240px;overflow:auto';
      pre.textContent = body;
      td.appendChild(pre);
    }
    detail.appendChild(td);
    tr.after(detail);
  });

  function buildJsonNode(val, isRoot) {
    var frag = document.createDocumentFragment();
    if (val === null) {
      var s = document.createElement('span');
      s.className = 'json-null';
      s.textContent = 'null';
      frag.appendChild(s);
      return frag;
    }
    if (typeof val === 'string') {
      var s = document.createElement('span');
      s.className = 'json-str';
      s.textContent = '"' + (val.length > 300 ? val.slice(0, 300) + '...' : val) + '"';
      frag.appendChild(s);
      return frag;
    }
    if (typeof val === 'number') {
      var s = document.createElement('span');
      s.className = 'json-num';
      s.textContent = String(val);
      frag.appendChild(s);
      return frag;
    }
    if (typeof val === 'boolean') {
      var s = document.createElement('span');
      s.className = 'json-bool';
      s.textContent = String(val);
      frag.appendChild(s);
      return frag;
    }
    var isArr = Array.isArray(val);
    var keys = isArr ? val : Object.keys(val);
    var len = isArr ? val.length : keys.length;
    var open = isArr ? '[' : '{';
    var close = isArr ? ']' : '}';

    // Toggle arrow + opening bracket
    var toggle = document.createElement('span');
    toggle.className = 'json-toggle';
    toggle.textContent = '\u25BE ';
    frag.appendChild(toggle);

    var bracket = document.createElement('span');
    bracket.className = 'json-bracket';
    bracket.textContent = open;
    frag.appendChild(bracket);

    var count = document.createElement('span');
    count.className = 'json-count';
    count.textContent = len + (isArr ? ' items' : ' keys');
    count.style.display = 'none';
    frag.appendChild(count);

    // Children
    var children = document.createElement('div');
    children.className = 'json-children';
    var entries = isArr ? val : keys;
    for (var i = 0; i < entries.length; i++) {
      var line = document.createElement('div');
      if (!isArr) {
        var k = document.createElement('span');
        k.className = 'json-key';
        k.textContent = '"' + entries[i] + '"';
        line.appendChild(k);
        var colon = document.createTextNode(': ');
        line.appendChild(colon);
        line.appendChild(buildJsonNode(val[entries[i]], false));
      } else {
        line.appendChild(buildJsonNode(entries[i], false));
      }
      if (i < entries.length - 1) {
        var comma = document.createElement('span');
        comma.className = 'json-comma';
        comma.textContent = ',';
        line.appendChild(comma);
      }
      children.appendChild(line);
    }
    frag.appendChild(children);

    var closeBracket = document.createElement('span');
    closeBracket.className = 'json-bracket';
    closeBracket.textContent = close;
    frag.appendChild(closeBracket);

    // Collapse large nodes by default (except root)
    if (!isRoot && len > 5) {
      children.classList.add('collapsed');
      toggle.textContent = '\u25B8 ';
      count.style.display = '';
      closeBracket.style.display = 'none';
    }

    toggle.addEventListener('click', function() {
      var collapsed = children.classList.contains('collapsed');
      children.classList.toggle('collapsed');
      toggle.textContent = collapsed ? '\u25BE ' : '\u25B8 ';
      count.style.display = collapsed ? 'none' : '';
      closeBracket.style.display = collapsed ? '' : 'none';
    });

    return frag;
  }

  // ===================================================================
  // Components
  // ===================================================================
  function renderComponents() {
    var list = document.getElementById('comp-list');
    if (!targetWin || !targetWin.$) {
      list.innerHTML = '<div class="empty-state">Waiting for zQuery to load...</div>';
      return;
    }
    var $ = targetWin.$;
    var html = '';

    // Iterate mounted components if components registry exists
    if ($ && typeof $.components === 'function') {
      var names = Object.keys($.components());
      if (!names.length) {
        list.innerHTML = '<div class="empty-state">No components registered</div>';
        return;
      }
      for (var n = 0; n < names.length; n++) {
        var name = names[n];
        // Find mounted instances
        var hosts = targetDoc.querySelectorAll(name + ',[data-zq-component="' + name + '"]');
        html += '<div class="comp-card">';
        html += '<div class="comp-name">&lt;' + name + '&gt;</div>';
        html += '<div class="comp-host">' + hosts.length + ' instance' + (hosts.length !== 1 ? 's' : '') + ' mounted</div>';
        hosts.forEach(function(host) {
          try {
            var inst = $.getInstance(host);
            if (inst && inst.state) {
              html += '<div class="comp-state">';
              var keys = Object.keys(inst.state);
              for (var k = 0; k < keys.length; k++) {
                var key = keys[k];
                var val = inst.state[key];
                var display = typeof val === 'object' ? JSON.stringify(val) : String(val);
                if (display.length > 80) display = display.slice(0, 80) + '...';
                html += '<div class="detail-row"><span class="comp-state-key">' + esc(key) + '</span><span class="comp-state-val">' + esc(display) + '</span></div>';
              }
              html += '</div>';
            }
          } catch(e) {}
        });
        html += '</div>';
      }
    }
    if (!html) html = '<div class="empty-state">No components found</div>';
    list.innerHTML = html;
  }

  // ===================================================================
  // Performance
  // ===================================================================
  var morphEvents = [];

  function recordMorphEvent(data) {
    if (!data.timestamp) data.timestamp = Date.now();
    morphEvents.push(data);
    if (morphEvents.length > 200) morphEvents.shift();
  }

  function renderPerf() {
    var content = document.getElementById('perf-content');
    var html = '';

    // Summary
    html += '<div class="perf-card">';
    html += '<div class="perf-title">Render Operations</div>';
    html += '<div class="detail-row"><span class="detail-key">Total</span><span class="detail-val">' + morphCount + '</span></div>';

    if (morphEvents.length) {
      var times = morphEvents.map(function(e) { return e.elapsed || 0; });
      var avg = times.reduce(function(a, b) { return a + b; }, 0) / times.length;
      var max = Math.max.apply(null, times);
      var min = Math.min.apply(null, times);
      html += '<div class="detail-row"><span class="detail-key">Avg time</span><span class="detail-val">' + avg.toFixed(2) + 'ms</span></div>';
      html += '<div class="detail-row"><span class="detail-key">Min / Max</span><span class="detail-val">' + min.toFixed(2) + 'ms / ' + max.toFixed(2) + 'ms</span></div>';
    }
    html += '</div>';

    // DOM stats
    if (targetDoc) {
      var allEls = targetDoc.querySelectorAll('*').length;
      html += '<div class="perf-card">';
      html += '<div class="perf-title">DOM Statistics</div>';
      html += '<div class="detail-row"><span class="detail-key">Elements</span><span class="detail-val">' + allEls + '</span></div>';
      html += '<div class="detail-row"><span class="detail-key">Tree depth</span><span class="detail-val">' + measureDepth(targetDoc.body) + '</span></div>';

      // Component count
      if (targetWin.$ && typeof targetWin.$.components === 'function') {
        html += '<div class="detail-row"><span class="detail-key">Components</span><span class="detail-val">' + Object.keys(targetWin.$.components()).length + ' registered</span></div>';
      }
      html += '</div>';
    }

    // Recent morph events
    if (morphEvents.length) {
      html += '<div class="perf-card">';
      html += '<div class="perf-title">Recent Renders</div>';
      for (var i = morphEvents.length - 1; i >= Math.max(0, morphEvents.length - 20); i--) {
        var ev = morphEvents[i];
        var kind = ev.kind || 'morph';
        var badge = kind === 'route' ? '<span style="color:#f5c542;font-weight:600;margin-right:6px">[route]</span>'
                  : kind === 'mount' ? '<span style="color:#66d9ef;font-weight:600;margin-right:6px">[mount]</span>'
                  : '<span style="color:#c792ea;font-weight:600;margin-right:6px">[morph]</span>';
        var pct = Math.min(100, (ev.elapsed / 16.67) * 100);
        var color = pct < 50 ? 'var(--green)' : pct < 100 ? 'var(--yellow)' : 'var(--red)';
        html += '<div class="perf-label"><span>' + badge + esc(ev.target || '?') + '</span><span class="timestamp">' + formatTime(ev.timestamp) + '</span><span style="min-width:60px;text-align:right">' + (ev.elapsed || 0).toFixed(2) + 'ms</span></div>';
        html += '<div class="perf-bar"><div class="perf-fill" style="width:' + Math.max(2, pct) + '%;background:' + color + '"></div></div>';
      }
      html += '</div>';
    }

    content.innerHTML = html;
  }

  function measureDepth(el) {
    if (!el || !el.children || !el.children.length) return 0;
    var max = 0;
    for (var i = 0; i < el.children.length; i++) {
      var d = measureDepth(el.children[i]);
      if (d > max) max = d;
    }
    return max + 1;
  }

  // ===================================================================
  // Stats bar
  // ===================================================================
  function updateStats() {
    try {
      var elCount = targetDoc ? targetDoc.querySelectorAll('*').length : 0;
      document.getElementById('el-count').textContent = elCount + ' elements';
    } catch(e) {}
    document.getElementById('morph-count').textContent = morphCount + ' renders';
    document.getElementById('req-count').textContent = requests.length + ' requests';

    var status = document.getElementById('status');
    var statusText = document.getElementById('status-text');
    if (isConnected()) {
      status.className = 'topbar-status';
      statusText.textContent = 'Connected';
    } else {
      status.className = 'topbar-status err';
      statusText.textContent = 'Disconnected';
    }
  }

  // ===================================================================
  // Boot
  // ===================================================================
  init();

})();
</script>
</body>
</html>`;

module.exports = DEVTOOLS_HTML;
