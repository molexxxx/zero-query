// ===================================================================
// DOM Tree
// ===================================================================
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

function buildNode(node, depth) {
  var wrap = document.createElement('div');
  wrap.className = 'tree-node';

  if (node.nodeType === 3) {
    var text = node.textContent.trim();
    if (!text) return wrap;
    var row = document.createElement('div');
    row.className = 'tree-row';
    var truncated = text.length > 60;
    row.innerHTML = '<span class="tree-toggle leaf"></span><span class="tree-text">' +
      esc(truncated ? text.slice(0, 60) + '...' : text) + '</span>' +
      (truncated ? '<span class="tree-peek" title="View full text">&#x1f441;</span>' : '');
    if (truncated) {
      row.__sourceText = text;
      row.__sourceLabel = 'Text content';
    }
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
  // style/script content is shown inline via the peek button — treat as leaf
  if (tag !== 'style' && tag !== 'script') {
    for (var i = 0; i < childNodes.length; i++) {
      var cn = childNodes[i];
      if (cn.nodeType === 1 || (cn.nodeType === 3 && cn.textContent.trim())) { hasChildren = true; break; }
    }
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

  // Show key attributes inline (skip internal zq attrs on scoped styles)
  var attrs = node.attributes;
  var shown = 0;
  for (var i = 0; i < attrs.length && shown < 4; i++) {
    var a = attrs[i];
    if (a.name === 'style' || a.name === 'class' && a.value.length > 40) continue;
    if (isScopedStyle && /^data-zq-/.test(a.name)) continue;
    html += ' <span class="tree-attr-name">' + esc(a.name) + '</span>';
    if (a.value) html += '=<span class="tree-attr-val">&quot;' + esc(a.value.length > 30 ? a.value.slice(0, 30) + '...' : a.value) + '&quot;</span>';
    shown++;
  }
  html += '<span class="tree-tag">&gt;</span>';

  // Badges for components, router, entry-point, scoped css
  if (isScopedStyle) {
    var scopeComp = node.getAttribute('data-zq-component');
    html += '<span class="tree-badge scoped">scoped css' + (scopeComp ? ' · ' + esc(scopeComp) : '') + '</span>';
  } else if (isComponent) html += '<span class="tree-badge comp">component</span>';
  if (isRouterView) html += '<span class="tree-badge router">router</span>';
  else if (isEntryPoint) html += '<span class="tree-badge entry">entry</span>';

  // Expand / collapse action buttons (visible on hover)
  if (hasChildren) {
    html += '<span class="tree-actions">';
    html += '<button class="tree-action" data-act="expand" title="Expand all">&#43;</button>';
    html += '<button class="tree-action" data-act="collapse" title="Collapse all">&#8722;</button>';
    html += '</span>';
  }

  // Inline text for leaf elements; add peek button for style/script with any content, or long text
  var hasInlineContent = false;
  if (tag === 'style' || tag === 'script') {
    var fullText = node.textContent.trim();
    if (fullText) {
      var preview = fullText.length > 50 ? fullText.slice(0, 50) + '...' : fullText;
      html += '<span class="tree-text">' + esc(preview) + '</span>';
      html += '<span class="tree-peek" title="View full source">&#x1f441;</span>';
      hasInlineContent = true;
    }
  } else if (!hasChildren || (childNodes.length === 1 && childNodes[0].nodeType === 3)) {
    var text = node.textContent.trim();
    if (text && text.length < 60) {
      html += '<span class="tree-text">' + esc(text) + '</span>';
      html += '<span class="tree-tag">&lt;/' + tag + '&gt;</span>';
    } else if (text && text.length >= 60) {
      html += '<span class="tree-text">' + esc(text.slice(0, 50) + '...') + '</span>';
      html += '<span class="tree-peek" title="View full text">&#x1f441;</span>';
      hasInlineContent = true;
    }
  }

  row.innerHTML = html;
  // Attach source data for peek overlay
  if (hasInlineContent) {
    row.__sourceText = node.textContent.trim();
    row.__sourceIsCSS = (tag === 'style');
    if (tag === 'style') {
      var scopeComp = node.getAttribute('data-zq-component');
      row.__sourceLabel = '<span class="tree-tag">&lt;style&gt;</span>' + (scopeComp ? ' <span class="tree-badge scoped">scoped css \u00b7 ' + esc(scopeComp) + '</span>' : '');
    } else if (tag === 'script') {
      row.__sourceLabel = '<span class="tree-tag">&lt;script&gt;</span>';
    } else {
      row.__sourceLabel = '<span class="tree-tag">&lt;' + tag + '&gt;</span> text content';
    }
  }
  wrap.appendChild(row);

  // Children container
  if (hasChildren) {
    var childDiv = document.createElement('div');
    childDiv.className = 'tree-children';

    // Restore expanded state or auto-expand; entry/router always expand, changed paths auto-expand (capped at depth 5)
    var alwaysOpen = isEntryPoint || isRouterView;
    var changedNow = changedPaths[nodePath] && depth < 6;
    var isExpanded = alwaysOpen || (expandedPaths.hasOwnProperty(nodePath) ? expandedPaths[nodePath] : (depth < 3 || changedNow));
    if (isExpanded) {
      childDiv.classList.add('open');
      row.querySelector('.tree-toggle').classList.add('open');
    }

    // Flash only actual mutation targets, not ancestors
    if (mutatedPaths[nodePath]) {
      row.classList.add('morph-changed');
      row.setAttribute('data-changed', '1');
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

  // Expand / collapse action buttons
  row.addEventListener('click', function(e) {
    var actBtn = e.target.closest('.tree-action');
    if (!actBtn) return;
    e.stopPropagation();
    var childContainer = row.nextElementSibling;
    if (!childContainer || !childContainer.classList.contains('tree-children')) return;
    var opening = actBtn.dataset.act === 'expand';
    if (opening) { childContainer.classList.add('open'); toggleEl.classList.add('open'); }
    else { childContainer.classList.remove('open'); toggleEl.classList.remove('open'); }
    expandedPaths[nodePath] = opening;
    var maxDepth = opening ? 4 : Infinity;
    function toggleNested(container, level) {
      if (level >= maxDepth) return;
      var children = container.children;
      for (var j = 0; j < children.length; j++) {
        var nested = children[j].querySelector(':scope > .tree-children');
        if (nested) {
          if (opening) nested.classList.add('open');
          else nested.classList.remove('open');
          var arrow = nested.previousElementSibling ? nested.previousElementSibling.querySelector('.tree-toggle') : null;
          if (arrow) { if (opening) arrow.classList.add('open'); else arrow.classList.remove('open'); }
          toggleNested(nested, level + 1);
        }
      }
    }
    toggleNested(childContainer, 0);
  });

  // Row click — select element (not toggle)
  row.addEventListener('click', function(e) {
    // Don't select when clicking toggle arrow, badge, action buttons, or peek
    if (e.target.closest('.tree-toggle') || e.target.closest('.tree-badge') || e.target.closest('.tree-action') || e.target.closest('.tree-peek')) return;
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

// ===================================================================
// Element highlighting
// ===================================================================
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

// ===================================================================
// Detail panel
// ===================================================================
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
      var val = esc(a.value);
      if (/^(src|href|action|data-src|poster|srcset)$/i.test(a.name) && a.value) {
        val = '<a href="' + esc(a.value) + '" target="_blank" rel="noopener" title="Open in new tab">' + val + '</a>';
      }
      html += '<div class="detail-row"><span class="detail-key">' + esc(a.name) + '</span><span class="detail-val">' + val + '</span></div>';
    }
    html += '</div>';
  }

  // Dimensions
  var rect = node.getBoundingClientRect();
  html += '<div class="detail-section"><h4>Box Model</h4>';
  html += '<div class="detail-row"><span class="detail-key">Size</span><span class="detail-val">' + Math.round(rect.width) + ' \u00d7 ' + Math.round(rect.height) + '</span></div>';
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
function startObserver() {
  if (!targetDoc || observer) return;
  observer = new MutationObserver(function(mutations) {
    // Collect paths of mutated nodes so we can auto-expand + highlight them
    var dominated = false;
    for (var i = 0; i < mutations.length; i++) {
      var m = mutations[i];
      var target = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      if (!target) continue;
      // Skip mutations caused by the devtools highlight overlay
      if (target.id === '__zq_highlight' || target.id === '__zq_error_overlay' || target.id === '__zq_devbar') continue;
      // Skip virtual-scroll hydration/dehydration churn (docs lazy chunks)
      if (target.classList && target.classList.contains('docs-lazy-chunk')) continue;
      if (target.closest && target.closest('.docs-lazy-chunk:not(.hydrated)')) continue;
      var isHighlightMutation = false;
      if (m.addedNodes) { for (var k = 0; k < m.addedNodes.length; k++) { if (m.addedNodes[k].id === '__zq_highlight') { isHighlightMutation = true; break; } } }
      if (!isHighlightMutation && m.removedNodes) { for (var k = 0; k < m.removedNodes.length; k++) { if (m.removedNodes[k].id === '__zq_highlight') { isHighlightMutation = true; break; } } }
      if (isHighlightMutation) continue;
      dominated = true;
        var tp = getNodePath(target);
        changedPaths[tp] = true;
        mutatedPaths[tp] = true;
        // Also mark added nodes
        if (m.addedNodes) {
          for (var j = 0; j < m.addedNodes.length; j++) {
            if (m.addedNodes[j].nodeType === 1) {
              var ap = getNodePath(m.addedNodes[j]);
              changedPaths[ap] = true;
              mutatedPaths[ap] = true;
            }
          }
        }
        // Mark ancestor paths so they auto-expand to reveal changes
        var cur = target.parentElement;
        while (cur && cur.nodeType === 1) {
          var p = getNodePath(cur);
          if (!expandedPaths.hasOwnProperty(p)) changedPaths[p] = true;
          cur = cur.parentElement;
        }
    }

    if (!dominated) return; // All mutations were from devtools highlight — skip rebuild

    // Debounce tree rebuild
    clearTimeout(startObserver._timer);
    startObserver._timer = setTimeout(function() {
      buildDOMTree();
      updateStats();

      // Scroll to deepest (last in DOM order) changed row
      var allChanged = document.querySelectorAll('.tree-row[data-changed]');
      if (allChanged.length) {
        allChanged[allChanged.length - 1].scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      // Clear changed paths after applying
      changedPaths = {};
      mutatedPaths = {};
    }, 300);
  });
  observer.observe(targetDoc.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true
  });
}
