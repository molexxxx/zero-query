// ===================================================================
// Tab switching
// ===================================================================
document.querySelector('.tabs').addEventListener('click', function(e) {
  var tab = e.target.closest('.tab');
  if (!tab) return;
  switchTab(tab.dataset.tab);
});

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
  var tabBtn = document.querySelector('.tab[data-tab="' + tabName + '"]');
  var panel = document.getElementById('panel-' + tabName);
  if (tabBtn) tabBtn.classList.add('active');
  if (panel) panel.classList.add('active');
  // Immediately refresh the tab's content
  if (tabName === 'components') renderComponents();
  else if (tabName === 'performance') renderPerf();
  else if (tabName === 'router') renderRouter();
}

// ===================================================================
// Topbar stat clicks → switch to corresponding tab
// ===================================================================
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
  try {
    if (targetWin && targetWin.__zqDevTools) {
      targetWin.__zqDevTools.requests = [];
    }
  } catch(e) {}
  renderNetwork();
  updateStats();
});

document.getElementById('perf-clear').addEventListener('click', function() {
  morphEvents = [];
  morphCount = 0;
  try {
    if (targetWin && targetWin.__zqDevTools) {
      targetWin.__zqDevTools.morphEvents = [];
      targetWin.__zqDevTools.morphCount = 0;
    }
  } catch(e) {}
  renderPerf();
  updateStats();
});

document.getElementById('router-clear').addEventListener('click', function() {
  routerEvents = [];
  try {
    if (targetWin && targetWin.__zqDevTools) {
      targetWin.__zqDevTools.routerEvents = [];
    }
  } catch(e) {}
  renderRouter();
});
