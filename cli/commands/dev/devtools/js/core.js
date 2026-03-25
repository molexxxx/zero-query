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
// Connection - find target window (opener popup → iframe fallback)
// ===================================================================
function isConnected() {
  try { return targetWin && (targetWin === window.opener ? !targetWin.closed : true) && targetWin.document; }
  catch(e) { return false; }
}

function detectMode() {
  if (window.opener) {
    // Opened as popup - hide iframe, use opener
    mode = 'popup';
    targetWin = window.opener;
  } else {
    // Standalone tab - embed app in iframe
    mode = 'split-h';
    targetWin = null; // will set from iframe.contentWindow
  }
  rootEl.className = mode;
}

detectMode();

// ===================================================================
// Layout toggle: split-h → split-v → devtools-only → split-h
// ===================================================================
var modeToggle = document.getElementById('mode-toggle');

function setMode(newMode) {
  mode = newMode;
  rootEl.style.gridTemplateColumns = '';
  rootEl.style.gridTemplateRows = '';
  rootEl.className = mode;
  modeToggle.textContent = mode === 'split-h' ? '\u2b82' : mode === 'split-v' ? '\u2b81' : '\u25a1';
  // Reset toolbar drag position
  var tb = document.getElementById('divider-toolbar');
  if (tb) { tb.style.left = ''; tb.style.top = ''; }
}

modeToggle.addEventListener('click', function() {
  if (mode === 'popup') return;
  if (mode === 'split-h') setMode('split-v');
  else if (mode === 'split-v') setMode('devtools-only');
  else setMode('split-h');
  // Reset viewport presets to desktop when switching modes
  var vBtns = document.querySelectorAll('.viewport-btn');
  vBtns.forEach(function(b) { b.classList.remove('active'); });
  var desk = document.querySelector('.viewport-btn[data-width="0"]');
  if (desk) desk.classList.add('active');
});

// ===================================================================
// Divider drag-to-resize
// ===================================================================
var divider = document.getElementById('divider');
var toolbar = document.getElementById('divider-toolbar');

// --- Toolbar drag (Y-axis in split-h, X-axis in split-v) ------------------
var tbDragging = false;
(function() {
  var startPos, startOffset;
  toolbar.addEventListener('mousedown', function(e) {
    if (e.target.closest('button') || e.target.closest('.route-label')) return;
    e.preventDefault();
    e.stopPropagation();
    tbDragging = true;
    toolbar.classList.add('dragging');
    iframe.style.pointerEvents = 'none';
    document.body.style.userSelect = 'none';

    var isH = mode === 'split-h';
    if (isH) {
      // Vertical column divider - drag toolbar up/down
      startPos = e.clientY;
      startOffset = parseInt(toolbar.style.top, 10) || toolbar.offsetTop;
    } else {
      // Horizontal row divider - drag toolbar left/right
      startPos = e.clientX;
      startOffset = parseInt(toolbar.style.left, 10) || toolbar.offsetLeft;
    }

    function onMove(e2) {
      if (isH) {
        var delta = e2.clientY - startPos;
        var max = divider.offsetHeight - toolbar.offsetHeight - 4;
        toolbar.style.top = Math.max(4, Math.min(max, startOffset + delta)) + 'px';
      } else {
        var delta = e2.clientX - startPos;
        var max = divider.offsetWidth - toolbar.offsetWidth - 4;
        toolbar.style.left = Math.max(4, Math.min(max, startOffset + delta)) + 'px';
      }
    }
    function onUp() {
      tbDragging = false;
      toolbar.classList.remove('dragging');
      iframe.style.pointerEvents = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
})();

divider.addEventListener('mousedown', function(e) {
  // Don't start drag when clicking toolbar buttons or dragging toolbar
  if (e.target.closest('.divider-toolbar')) return;
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
    updateViewportActive();
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
// Refresh button - reload the embedded iframe
// ===================================================================
document.getElementById('btn-refresh').addEventListener('click', function(e) {
  e.stopPropagation();
  if (mode === 'popup' && targetWin && !targetWin.closed) {
    targetWin.location.reload();
  } else if (iframe && iframe.contentWindow) {
    iframe.contentWindow.location.reload();
  }
});

// ===================================================================
// Viewport preset buttons - resize browser pane to mobile/tablet/desktop
// ===================================================================
var viewportBtns = document.querySelectorAll('.viewport-btn');

function updateViewportActive() {
  var w = iframe.offsetWidth;
  viewportBtns.forEach(function(b) {
    var target = parseInt(b.getAttribute('data-width'), 10);
    if (target === 0) {
      // Desktop is active when width doesn't match any preset
      b.classList.toggle('active', w > 780);
    } else {
      b.classList.toggle('active', Math.abs(w - target) < 20);
    }
  });
}

viewportBtns.forEach(function(btn) {
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    if (mode === 'popup') return;
    // Ensure we're in side-by-side mode
    if (mode !== 'split-h') setMode('split-h');
    var targetWidth = parseInt(this.getAttribute('data-width'), 10);
    var total = rootEl.offsetWidth;

    if (targetWidth === 0) {
      // Desktop - reset to default CSS proportions
      rootEl.style.gridTemplateColumns = '';
    } else {
      // Mobile/Tablet - set iframe column to exact pixel width
      var pct = Math.min(85, Math.max(15, (targetWidth / total) * 100));
      rootEl.style.gridTemplateColumns = pct.toFixed(1) + '% 4px 1fr';
    }

    viewportBtns.forEach(function(b) { b.classList.remove('active'); });
    this.classList.add('active');
  });
});

// ===================================================================
// Route indicator - toggle label showing current path + hash
// ===================================================================
var routeBtn = document.getElementById('btn-route');
var routeLabel = document.getElementById('route-label');

function getRoutePath() {
  try {
    var win = (mode === 'popup' && targetWin) ? targetWin : (iframe && iframe.contentWindow);
    if (!win) return '/';
    var loc = win.location;
    return (loc.pathname || '/') + (loc.hash || '');
  } catch(e) { return '/'; }
}

routeBtn.addEventListener('click', function(e) {
  e.stopPropagation();
  var isOpen = routeLabel.classList.toggle('open');
  if (isOpen) {
    routeLabel.textContent = getRoutePath();
    this.classList.add('active');
  } else {
    this.classList.remove('active');
  }
});

// Keep label in sync while open
setInterval(function() {
  if (routeLabel.classList.contains('open')) {
    routeLabel.textContent = getRoutePath();
  }
}, 500);

// ===================================================================
// init - connect to target window (popup or iframe)
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
// connectToTarget - read existing data, start listeners, periodic sync
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
      // Retry connection - opener may be mid-mutation, not truly gone
      try {
        if (mode === 'popup' && window.opener && !window.opener.closed) {
          targetWin = window.opener;
          targetDoc = targetWin.document;
          document.getElementById('disconnected').style.display = 'none';
        } else if (iframe && iframe.contentWindow) {
          targetWin = iframe.contentWindow;
          targetDoc = targetWin.document;
          document.getElementById('disconnected').style.display = 'none';
        }
      } catch(e) {}
      if (!isConnected()) {
        document.getElementById('disconnected').style.display = 'flex';
        return;
      }
    }
    // Keep targetDoc fresh - the opener may have reloaded (live-reload)
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
