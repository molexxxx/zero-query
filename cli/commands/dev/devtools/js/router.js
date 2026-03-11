// ===================================================================
// Router panel
// ===================================================================
function renderRouter() {
  var content = document.getElementById('router-content');
  if (!content) return;
  var html = '';

  // Current route card
  var router = null;
  try { router = targetWin && targetWin.$ && targetWin.$.getRouter(); } catch(e) {}

  html += '<div class="router-card">';
  html += '<div class="router-title">Current Route</div>';
  if (router && router.current) {
    var cur = router.current;
    html += '<div class="router-row"><span class="router-key">Path</span><span class="router-val">' + esc(cur.path || '/') + '</span></div>';
    if (cur.route && cur.route.component) {
      html += '<div class="router-row"><span class="router-key">Component</span><span class="router-val" style="color:var(--purple)">' + esc(cur.route.component) + '</span></div>';
    }
    if (cur.params && Object.keys(cur.params).length) {
      html += '<div class="router-row"><span class="router-key">Params</span><span class="router-val">' + esc(JSON.stringify(cur.params)) + '</span></div>';
    }
    if (cur.query && Object.keys(cur.query).length) {
      html += '<div class="router-row"><span class="router-key">Query</span><span class="router-val">' + esc(JSON.stringify(cur.query)) + '</span></div>';
    }
    html += '<div class="router-row"><span class="router-key">Mode</span><span class="router-val">' + esc(router._mode || 'history') + '</span></div>';
    if (router._base) {
      html += '<div class="router-row"><span class="router-key">Base</span><span class="router-val">' + esc(router._base) + '</span></div>';
    }
  } else {
    html += '<div class="router-row" style="color:var(--text2)">No router detected</div>';
  }
  html += '</div>';

  // Guards & listeners
  if (router) {
    html += '<div class="router-card">';
    html += '<div class="router-title">Guards & Listeners</div>';
    var beforeCt = router._guards ? router._guards.before.length : 0;
    var afterCt = router._guards ? router._guards.after.length : 0;
    var substateCt = router._substateListeners ? router._substateListeners.length : 0;
    var onChangeCt = router._listeners ? router._listeners.size : 0;
    html += '<div class="router-row"><span class="router-key">beforeEach</span><span class="router-val">' + beforeCt + ' guard' + (beforeCt !== 1 ? 's' : '') + '</span></div>';
    html += '<div class="router-row"><span class="router-key">afterEach</span><span class="router-val">' + afterCt + ' guard' + (afterCt !== 1 ? 's' : '') + '</span></div>';
    html += '<div class="router-row"><span class="router-key">onSubstate</span><span class="router-val">' + substateCt + ' listener' + (substateCt !== 1 ? 's' : '') + '</span></div>';
    html += '<div class="router-row"><span class="router-key">onChange</span><span class="router-val">' + onChangeCt + ' watcher' + (onChangeCt !== 1 ? 's' : '') + '</span></div>';
    // Active substates in the history stack (computed from timeline)
    var activeSubs = 0;
    for (var si = 0; si < routerEvents.length; si++) {
      var act = routerEvents[si].action;
      if (act === 'substate') activeSubs++;
      else if (act === 'pop-substate') activeSubs = Math.max(0, activeSubs - 1);
      else if (act === 'navigate' || act === 'pop') activeSubs = 0;
    }
    html += '<div class="router-row"><span class="router-key">Substates</span><span class="router-val" style="color:' + (activeSubs > 0 ? 'var(--purple)' : 'var(--text2)') + '">' + activeSubs + ' in stack</span></div>';
    html += '</div>';

    // Registered routes
    html += '<div class="router-card">';
    html += '<div class="router-title">Registered Routes <span style="color:var(--text2);font-weight:400">(' + router._routes.length + ')</span></div>';
    for (var ri = 0; ri < router._routes.length; ri++) {
      var r = router._routes[ri];
      html += '<div class="router-row">';
      html += '<span class="router-val" style="color:var(--accent)">' + esc(r.path) + '</span>';
      if (r.component) html += '<span style="color:var(--purple);margin-left:8px">' + esc(r.component) + '</span>';
      if (r.load) html += '<span style="color:var(--yellow);margin-left:4px;font-size:9px">[lazy]</span>';
      html += '</div>';
    }
    html += '</div>';
  }

  // History timeline
  html += '<div class="router-card">';
  html += '<div class="router-title">History Timeline <span style="color:var(--text2);font-weight:400">(' + routerEvents.length + ')</span></div>';
  if (routerEvents.length === 0) {
    html += '<div style="color:var(--text2);padding:8px 0;font-size:11px">No navigation events recorded yet</div>';
  } else {
    html += '<div class="router-timeline">';
    for (var i = routerEvents.length - 1; i >= Math.max(0, routerEvents.length - 50); i--) {
      var ev = routerEvents[i];
      var badgeClass = 'nav';
      if (ev.action === 'replace') badgeClass = 'replace';
      else if (ev.action === 'substate' || ev.action === 'pop-substate') badgeClass = 'substate';
      else if (ev.action === 'pop') badgeClass = 'pop';
      else if (ev.action === 'hashchange') badgeClass = 'hash';
      html += '<div class="router-event">';
      html += '<span class="router-badge ' + badgeClass + '">' + esc(ev.action.toUpperCase()) + '</span>';
      html += '<div style="flex:1;min-width:0">';
      html += '<div class="router-url">' + esc(ev.url || '') + '</div>';
      if (ev.key) {
        html += '<div class="router-detail">key: <span style="color:var(--purple)">' + esc(ev.key) + '</span>';
        if (ev.data != null) html += ' &middot; data: <span style="color:var(--green)">' + esc(JSON.stringify(ev.data)) + '</span>';
        html += '</div>';
      }
      html += '</div>';
      html += '<span class="timestamp">' + formatTime(ev.timestamp) + '</span>';
      html += '</div>';
    }
    html += '</div>';
  }
  html += '</div>';

  content.innerHTML = html;
}
