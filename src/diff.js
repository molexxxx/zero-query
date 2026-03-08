/**
 * zQuery Diff — Lightweight DOM morphing engine
 *
 * Patches an existing DOM tree to match new HTML without destroying nodes
 * that haven't changed. Preserves focus, scroll positions, third-party
 * widget state, video playback, and other live DOM state.
 *
 * Approach: walk old and new trees in parallel, reconcile node by node.
 * Keyed elements (via `z-key`) get matched across position changes.
 */

// ---------------------------------------------------------------------------
// morph(existingRoot, newHTML) — patch existing DOM to match newHTML
// ---------------------------------------------------------------------------

/**
 * Morph an existing DOM element's children to match new HTML.
 * Only touches nodes that actually differ.
 *
 * @param {Element} rootEl — The live DOM container to patch
 * @param {string} newHTML — The desired HTML string
 */
export function morph(rootEl, newHTML) {
  const template = document.createElement('template');
  template.innerHTML = newHTML;
  const newRoot = template.content;

  // Convert to element for consistent handling — wrap in a div if needed
  const tempDiv = document.createElement('div');
  while (newRoot.firstChild) tempDiv.appendChild(newRoot.firstChild);

  _morphChildren(rootEl, tempDiv);
}

/**
 * Reconcile children of `oldParent` to match `newParent`.
 *
 * @param {Element} oldParent — live DOM parent
 * @param {Element} newParent — desired state parent
 */
function _morphChildren(oldParent, newParent) {
  const oldChildren = [...oldParent.childNodes];
  const newChildren = [...newParent.childNodes];

  // Build key maps for keyed element matching
  const oldKeyMap = new Map();
  const newKeyMap = new Map();

  for (let i = 0; i < oldChildren.length; i++) {
    const key = _getKey(oldChildren[i]);
    if (key != null) oldKeyMap.set(key, i);
  }
  for (let i = 0; i < newChildren.length; i++) {
    const key = _getKey(newChildren[i]);
    if (key != null) newKeyMap.set(key, i);
  }

  const hasKeys = oldKeyMap.size > 0 || newKeyMap.size > 0;

  if (hasKeys) {
    _morphChildrenKeyed(oldParent, oldChildren, newChildren, oldKeyMap, newKeyMap);
  } else {
    _morphChildrenUnkeyed(oldParent, oldChildren, newChildren);
  }
}

/**
 * Unkeyed reconciliation — positional matching.
 */
function _morphChildrenUnkeyed(oldParent, oldChildren, newChildren) {
  const maxLen = Math.max(oldChildren.length, newChildren.length);

  for (let i = 0; i < maxLen; i++) {
    const oldNode = oldChildren[i];
    const newNode = newChildren[i];

    if (!oldNode && newNode) {
      // New node — append
      oldParent.appendChild(newNode.cloneNode(true));
    } else if (oldNode && !newNode) {
      // Extra old node — remove
      oldParent.removeChild(oldNode);
    } else if (oldNode && newNode) {
      _morphNode(oldParent, oldNode, newNode);
    }
  }
}

/**
 * Keyed reconciliation — match by z-key, reorder minimal moves.
 */
function _morphChildrenKeyed(oldParent, oldChildren, newChildren, oldKeyMap, newKeyMap) {
  // Track which old nodes are consumed
  const consumed = new Set();

  // Step 1: Build ordered list of matched old nodes for new children
  const newLen = newChildren.length;
  const matched = new Array(newLen); // matched[newIdx] = oldNode | null

  for (let i = 0; i < newLen; i++) {
    const key = _getKey(newChildren[i]);
    if (key != null && oldKeyMap.has(key)) {
      const oldIdx = oldKeyMap.get(key);
      matched[i] = oldChildren[oldIdx];
      consumed.add(oldIdx);
    } else {
      matched[i] = null;
    }
  }

  // Step 2: Remove old nodes that are not in the new tree
  for (let i = oldChildren.length - 1; i >= 0; i--) {
    if (!consumed.has(i)) {
      const key = _getKey(oldChildren[i]);
      if (key != null && !newKeyMap.has(key)) {
        oldParent.removeChild(oldChildren[i]);
      } else if (key == null) {
        // Unkeyed old node — will be handled positionally below
      }
    }
  }

  // Step 3: Insert/reorder/morph
  let cursor = oldParent.firstChild;
  const unkeyedOld = oldChildren.filter((n, i) => !consumed.has(i) && _getKey(n) == null);
  let unkeyedIdx = 0;

  for (let i = 0; i < newLen; i++) {
    const newNode = newChildren[i];
    const newKey = _getKey(newNode);
    let oldNode = matched[i];

    if (!oldNode && newKey == null) {
      // Try to match an unkeyed old node positionally
      oldNode = unkeyedOld[unkeyedIdx++] || null;
    }

    if (oldNode) {
      // Move into position if needed
      if (oldNode !== cursor) {
        oldParent.insertBefore(oldNode, cursor);
      }
      // Morph in place
      _morphNode(oldParent, oldNode, newNode);
      cursor = oldNode.nextSibling;
    } else {
      // Insert new node
      const clone = newNode.cloneNode(true);
      if (cursor) {
        oldParent.insertBefore(clone, cursor);
      } else {
        oldParent.appendChild(clone);
      }
      // cursor stays the same — new node is before it
    }
  }

  // Remove any remaining unkeyed old nodes at the end
  while (unkeyedIdx < unkeyedOld.length) {
    const leftover = unkeyedOld[unkeyedIdx++];
    if (leftover.parentNode === oldParent) {
      oldParent.removeChild(leftover);
    }
  }

  // Remove any remaining keyed old nodes that weren't consumed
  for (let i = 0; i < oldChildren.length; i++) {
    if (!consumed.has(i)) {
      const node = oldChildren[i];
      if (node.parentNode === oldParent && _getKey(node) != null && !newKeyMap.has(_getKey(node))) {
        oldParent.removeChild(node);
      }
    }
  }
}

/**
 * Morph a single node in place.
 */
function _morphNode(parent, oldNode, newNode) {
  // Text / comment nodes — just update content
  if (oldNode.nodeType === 3 || oldNode.nodeType === 8) {
    if (newNode.nodeType === oldNode.nodeType) {
      if (oldNode.nodeValue !== newNode.nodeValue) {
        oldNode.nodeValue = newNode.nodeValue;
      }
      return;
    }
    // Different node types — replace
    parent.replaceChild(newNode.cloneNode(true), oldNode);
    return;
  }

  // Different node types or tag names — replace entirely
  if (oldNode.nodeType !== newNode.nodeType ||
      oldNode.nodeName !== newNode.nodeName) {
    parent.replaceChild(newNode.cloneNode(true), oldNode);
    return;
  }

  // Both are elements — diff attributes then recurse children
  if (oldNode.nodeType === 1) {
    _morphAttributes(oldNode, newNode);

    // Special elements: don't recurse into their children
    // (textarea value, input value, select, etc.)
    const tag = oldNode.nodeName;
    if (tag === 'INPUT') {
      _syncInputValue(oldNode, newNode);
      return;
    }
    if (tag === 'TEXTAREA') {
      if (oldNode.value !== newNode.textContent) {
        oldNode.value = newNode.textContent || '';
      }
      return;
    }
    if (tag === 'SELECT') {
      // Recurse children (options) then sync value
      _morphChildren(oldNode, newNode);
      if (oldNode.value !== newNode.value) {
        oldNode.value = newNode.value;
      }
      return;
    }

    // Generic element — recurse children
    _morphChildren(oldNode, newNode);
  }
}

/**
 * Sync attributes from newEl onto oldEl.
 */
function _morphAttributes(oldEl, newEl) {
  // Add/update attributes
  const newAttrs = newEl.attributes;
  for (let i = 0; i < newAttrs.length; i++) {
    const attr = newAttrs[i];
    if (oldEl.getAttribute(attr.name) !== attr.value) {
      oldEl.setAttribute(attr.name, attr.value);
    }
  }

  // Remove stale attributes
  const oldAttrs = oldEl.attributes;
  for (let i = oldAttrs.length - 1; i >= 0; i--) {
    const attr = oldAttrs[i];
    if (!newEl.hasAttribute(attr.name)) {
      oldEl.removeAttribute(attr.name);
    }
  }
}

/**
 * Sync input element value, checked, disabled states.
 */
function _syncInputValue(oldEl, newEl) {
  const type = (oldEl.type || '').toLowerCase();

  if (type === 'checkbox' || type === 'radio') {
    if (oldEl.checked !== newEl.checked) oldEl.checked = newEl.checked;
  } else {
    if (oldEl.value !== (newEl.getAttribute('value') || '')) {
      oldEl.value = newEl.getAttribute('value') || '';
    }
  }

  // Sync disabled
  if (oldEl.disabled !== newEl.disabled) oldEl.disabled = newEl.disabled;
}

/**
 * Get the reconciliation key from a node (z-key attribute).
 * @returns {string|null}
 */
function _getKey(node) {
  if (node.nodeType !== 1) return null;
  return node.getAttribute('z-key') || null;
}
