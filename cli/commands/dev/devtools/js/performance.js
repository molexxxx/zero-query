// ===================================================================
// Performance
// ===================================================================
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
