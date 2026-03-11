// ===================================================================
// Shared state
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
var expandedPaths = {}; // track expanded nodes by path to survive rebuilds
var componentNames = {}; // cache of registered component tag names
var changedPaths = {};   // paths mutated since last rebuild (for auto-expand)
var mutatedPaths = {};   // actual mutation targets (for highlight + scroll)
var observer;
var morphEvents = [];
var routerEvents = [];

try { channel = new BroadcastChannel('__zq_devtools'); } catch(e) {}

// ===================================================================
// Utilities
// ===================================================================
function esc(s) {
  var d = document.createElement('span');
  d.textContent = s;
  return d.innerHTML;
}

function formatTime(ts) {
  if (!ts) return '';
  var d = new Date(ts);
  var h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
  var ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + ' ' + ampm;
}

// ===================================================================
// Connection — find target window (opener popup → iframe fallback)
// ===================================================================
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

// ===================================================================
// Layout toggle: split-h → split-v → devtools-only → split-h
// ===================================================================
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

// ===================================================================
// Divider drag-to-resize
// ===================================================================
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

// ===================================================================
// init — connect to target window (popup or iframe)
// ===================================================================
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

// ===================================================================
// connectToTarget — read existing data, start listeners, periodic sync
// ===================================================================
function connectToTarget() {

  // Read existing requests and render events from opener
  if (targetWin.__zqDevTools) {
    requests = targetWin.__zqDevTools.requests.slice();
    morphCount = targetWin.__zqDevTools.morphCount || 0;
    var stored = targetWin.__zqDevTools.morphEvents;
    if (stored && stored.length) {
      morphEvents = stored.slice();
    }
    var storedRouter = targetWin.__zqDevTools.routerEvents;
    if (storedRouter && storedRouter.length) {
      routerEvents = storedRouter.slice();
    }
  }

  buildDOMTree();
  renderNetwork();
  renderComponents();
  renderPerf();
  renderRouter();
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
      } else if (msg.type === 'router') {
        routerEvents.push(msg.data);
        if (routerEvents.length > 200) routerEvents.shift();
        var activeTab = document.querySelector('.tab.active');
        if (activeTab && activeTab.dataset.tab === 'router') renderRouter();
        updateStats();
      }
    };
  }

  // Periodic refresh for components + perf (fast when tab is visible)
  setInterval(function() {
    if (!isConnected()) {
      document.getElementById('disconnected').style.display = 'flex';
      return;
    }
    // Keep targetDoc fresh — the opener may have reloaded (live-reload)
    try {
      var freshDoc = targetWin.document;
      if (freshDoc !== targetDoc) {
        targetDoc = freshDoc;
        // Re-attach MutationObserver to the new document
        if (observer) { observer.disconnect(); observer = null; }
        startObserver();
        buildDOMTree();
      }
    } catch(e) {}
    var activeTab = document.querySelector('.tab.active');
    var tabName = activeTab ? activeTab.dataset.tab : '';
    if (tabName === 'components') renderComponents();
    updateStats();
    // Sync requests and render events from opener
    if (targetWin.__zqDevTools) {
      requests = targetWin.__zqDevTools.requests.slice();
      morphCount = targetWin.__zqDevTools.morphCount || 0;
      var stored = targetWin.__zqDevTools.morphEvents;
      if (stored && stored.length) {
        morphEvents = stored.slice();
      }
      var storedRouter = targetWin.__zqDevTools.routerEvents;
      if (storedRouter && storedRouter.length) {
        routerEvents = storedRouter.slice();
      }
    }
    if (tabName === 'perf') renderPerf();
    if (tabName === 'router') renderRouter();
  }, 800);
}
