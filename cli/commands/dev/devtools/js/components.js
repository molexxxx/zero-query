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
      // Find mounted instances (exclude scoped <style> tags that carry data-zq-component)
      var hosts = targetDoc.querySelectorAll(name + ':not(style)');
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
