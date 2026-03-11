// ===================================================================
// Network log
// ===================================================================
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
