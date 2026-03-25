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

  // Route stat - show current path
  try {
    var router = targetWin && targetWin.$ && targetWin.$.getRouter();
    var routeStat = document.getElementById('route-stat');
    if (routeStat && router && router.current) {
      routeStat.textContent = router.current.path || '/';
    }
  } catch(e) {}

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
