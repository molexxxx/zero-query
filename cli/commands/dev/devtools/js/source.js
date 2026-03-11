// ===================================================================
// Source Viewer Overlay
// ===================================================================
var sourceOverlay = document.getElementById('source-overlay');
var sourceTitle = document.getElementById('source-title');
var sourceContent = document.getElementById('source-content');
document.getElementById('source-close').addEventListener('click', function() {
  sourceOverlay.classList.remove('open');
});
sourceOverlay.addEventListener('click', function(e) {
  if (e.target === sourceOverlay) sourceOverlay.classList.remove('open');
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && sourceOverlay.classList.contains('open')) {
    sourceOverlay.classList.remove('open');
  }
});

function openSourceViewer(label, text, isCSS) {
  sourceTitle.innerHTML = label || 'Source';
  var body = sourceOverlay.querySelector('.source-body');
  if (isCSS) {
    body.innerHTML = buildCSSTree(text || '');
  } else {
    body.innerHTML = '<pre id="source-content"></pre>';
    body.querySelector('pre').textContent = text || '';
  }
  sourceOverlay.classList.add('open');
}

// Delegated click for CSS tree toggle (always wired, doesn't stack)
sourceOverlay.querySelector('.source-body').addEventListener('click', function(e) {
  var sel = e.target.closest('.css-sel');
  if (!sel) return;
  var arrow = sel.querySelector('.css-arrow');
  var props = sel.nextElementSibling;
  if (props && props.classList.contains('css-props')) {
    props.classList.toggle('open');
    if (arrow) arrow.classList.toggle('open');
  }
});

function buildCSSTree(css) {
  var html = '<div class="css-tree">';
  // Simple CSS parser: split into rules, comments, and at-rules
  var i = 0, len = css.length;
  while (i < len) {
    // Skip whitespace
    while (i < len && /\s/.test(css[i])) i++;
    if (i >= len) break;
    // Comment
    if (css[i] === '/' && css[i+1] === '*') {
      var end = css.indexOf('*/', i + 2);
      if (end === -1) end = len;
      else end += 2;
      html += '<div class="css-comment">' + esc(css.slice(i, end)) + '</div>';
      i = end;
      continue;
    }
    // Find selector (everything up to {)
    var bracePos = css.indexOf('{', i);
    if (bracePos === -1) {
      // Remaining text (malformed)
      html += '<div class="css-comment">' + esc(css.slice(i).trim()) + '</div>';
      break;
    }
    var selector = css.slice(i, bracePos).trim();
    i = bracePos + 1;
    // Find matching closing brace (handle nesting for @media etc, skip comments and strings)
    var depth = 1, bodyStart = i;
    while (i < len && depth > 0) {
      // Skip comments
      if (css[i] === '/' && css[i+1] === '*') {
        i += 2;
        while (i < len && !(css[i] === '*' && css[i+1] === '/')) i++;
        i += 2;
        continue;
      }
      // Skip quoted strings
      if (css[i] === '"' || css[i] === "'") {
        var q = css[i]; i++;
        while (i < len && css[i] !== q) { if (css[i] === '\\') i++; i++; }
        i++;
        continue;
      }
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      if (depth > 0) i++;
    }
    var body = css.slice(bodyStart, i).trim();
    i++; // skip }
    // Check if body contains nested rules (e.g. @media)
    if (body.indexOf('{') !== -1) {
      html += '<div class="css-rule">';
      html += '<div class="css-sel"><span class="css-arrow">&#9654;</span><span>' + esc(selector) + '</span><span class="css-brace">{</span></div>';
      html += '<div class="css-props">' + buildCSSTree(body) + '</div>';
      html += '</div>';
    } else {
      // Parse properties
      html += '<div class="css-rule">';
      html += '<div class="css-sel"><span class="css-arrow">&#9654;</span><span>' + esc(selector) + '</span><span class="css-brace">{</span></div>';
      html += '<div class="css-props">';
      var declarations = body.split(';');
      for (var d = 0; d < declarations.length; d++) {
        var decl = declarations[d].trim();
        if (!decl) continue;
        var colonIdx = decl.indexOf(':');
        if (colonIdx !== -1) {
          var prop = decl.slice(0, colonIdx).trim();
          var val = decl.slice(colonIdx + 1).trim();
          html += '<div class="css-prop"><span class="css-prop-name">' + esc(prop) + '</span>: <span class="css-prop-val">' + esc(val) + '</span>;</div>';
        } else {
          html += '<div class="css-prop">' + esc(decl) + '</div>';
        }
      }
      html += '</div></div>';
    }
  }
  html += '</div>';
  return html;
}

// Delegated peek handler on the DOM tree
document.getElementById('dom-tree').addEventListener('click', function(e) {
  var peek = e.target.closest('.tree-peek');
  if (!peek) return;
  e.stopPropagation();
  var row = peek.closest('.tree-row');
  if (row && row.__sourceText) {
    openSourceViewer(row.__sourceLabel || 'Source', row.__sourceText, row.__sourceIsCSS);
  }
});
