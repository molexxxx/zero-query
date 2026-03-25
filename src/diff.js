/**
 * zQuery Diff - Lightweight DOM morphing engine
 *
 * Patches an existing DOM tree to match new HTML without destroying nodes
 * that haven't changed. Preserves focus, scroll positions, third-party
 * widget state, video playback, and other live DOM state.
 *
 * Approach: walk old and new trees in parallel, reconcile node by node.
 * Keyed elements (via `z-key`) get matched across position changes.
 *
 * Performance advantages over virtual DOM (React/Angular):
 *   - No virtual tree allocation or diffing - works directly on real DOM
 *   - Skips unchanged subtrees via fast isEqualNode() check
 *   - z-skip attribute to opt out of diffing entire subtrees
 *   - Reuses a single template element for HTML parsing (zero GC pressure)
 *   - Keyed reconciliation uses LIS (Longest Increasing Subsequence) to
 *     minimize DOM moves - same algorithm as Vue 3 / ivi
 *   - Minimal attribute diffing with early bail-out
 */

// ---------------------------------------------------------------------------
// Reusable template element - avoids per-call allocation
// ---------------------------------------------------------------------------
let _tpl = null;

function _getTemplate() {
  if (!_tpl) _tpl = document.createElement('template');
  return _tpl;
}

// ---------------------------------------------------------------------------
// morph(existingRoot, newHTML) - patch existing DOM to match newHTML
// ---------------------------------------------------------------------------

/**
 * Morph an existing DOM element's children to match new HTML.
 * Only touches nodes that actually differ.
 *
 * @param {Element} rootEl - The live DOM container to patch
 * @param {string} newHTML - The desired HTML string
 */
export function morph(rootEl, newHTML) {
  const start = typeof window !== 'undefined' && window.__zqMorphHook ? performance.now() : 0;
  const tpl = _getTemplate();
  tpl.innerHTML = newHTML;
  const newRoot = tpl.content;

  // Move children into a wrapper for consistent handling.
  // We move (not clone) from the template - cheaper than cloning.
  const tempDiv = document.createElement('div');
  while (newRoot.firstChild) tempDiv.appendChild(newRoot.firstChild);

  _morphChildren(rootEl, tempDiv);

  if (start) window.__zqMorphHook(rootEl, performance.now() - start);
}

/**
 * Morph a single element in place - diffs attributes and children
 * without replacing the node reference. Useful for replaceWith-style
 * updates where you want to keep the element identity when the tag
 * name matches.
 *
 * If the new HTML produces a different tag, falls back to native replace.
 *
 * @param {Element} oldEl - The live DOM element to patch
 * @param {string} newHTML - HTML string for the replacement element
 * @returns {Element} - The resulting element (same ref if morphed, new if replaced)
 */
export function morphElement(oldEl, newHTML) {
  const start = typeof window !== 'undefined' && window.__zqMorphHook ? performance.now() : 0;
  const tpl = _getTemplate();
  tpl.innerHTML = newHTML;
  const newEl = tpl.content.firstElementChild;
  if (!newEl) return oldEl;

  // Same tag - morph in place (preserves identity, event listeners, refs)
  if (oldEl.nodeName === newEl.nodeName) {
    _morphAttributes(oldEl, newEl);
    _morphChildren(oldEl, newEl);
    if (start) window.__zqMorphHook(oldEl, performance.now() - start);
    return oldEl;
  }

  // Different tag - must replace (can't morph <div> into <span>)
  const clone = newEl.cloneNode(true);
  oldEl.parentNode.replaceChild(clone, oldEl);
  if (start) window.__zqMorphHook(clone, performance.now() - start);
  return clone;
}

// Aliases for the concat build - core.js imports these as _morph / _morphElement,
// but the build strips `import … as` lines, so the aliases must exist at runtime.
const _morph = morph;
const _morphElement = morphElement;

/**
 * Reconcile children of `oldParent` to match `newParent`.
 *
 * @param {Element} oldParent - live DOM parent
 * @param {Element} newParent - desired state parent
 */
function _morphChildren(oldParent, newParent) {
  // Snapshot live NodeLists into arrays - childNodes is live and
  // mutates during insertBefore/removeChild. Using a for loop to push
  // avoids spread operator overhead for large child lists.
  const oldCN = oldParent.childNodes;
  const newCN = newParent.childNodes;
  const oldLen = oldCN.length;
  const newLen = newCN.length;
  const oldChildren = new Array(oldLen);
  const newChildren = new Array(newLen);
  for (let i = 0; i < oldLen; i++) oldChildren[i] = oldCN[i];
  for (let i = 0; i < newLen; i++) newChildren[i] = newCN[i];

  // Scan for keyed elements - only build maps if keys exist
  let hasKeys = false;
  let oldKeyMap, newKeyMap;

  for (let i = 0; i < oldLen; i++) {
    if (_getKey(oldChildren[i]) != null) { hasKeys = true; break; }
  }
  if (!hasKeys) {
    for (let i = 0; i < newLen; i++) {
      if (_getKey(newChildren[i]) != null) { hasKeys = true; break; }
    }
  }

  if (hasKeys) {
    oldKeyMap = new Map();
    newKeyMap = new Map();
    for (let i = 0; i < oldLen; i++) {
      const key = _getKey(oldChildren[i]);
      if (key != null) oldKeyMap.set(key, i);
    }
    for (let i = 0; i < newLen; i++) {
      const key = _getKey(newChildren[i]);
      if (key != null) newKeyMap.set(key, i);
    }
    _morphChildrenKeyed(oldParent, oldChildren, newChildren, oldKeyMap, newKeyMap);
  } else {
    _morphChildrenUnkeyed(oldParent, oldChildren, newChildren);
  }
}

/**
 * Unkeyed reconciliation - positional matching.
 */
function _morphChildrenUnkeyed(oldParent, oldChildren, newChildren) {
  const oldLen = oldChildren.length;
  const newLen = newChildren.length;
  const minLen = oldLen < newLen ? oldLen : newLen;

  // Morph overlapping range
  for (let i = 0; i < minLen; i++) {
    _morphNode(oldParent, oldChildren[i], newChildren[i]);
  }

  // Append new nodes
  if (newLen > oldLen) {
    for (let i = oldLen; i < newLen; i++) {
      oldParent.appendChild(newChildren[i].cloneNode(true));
    }
  }

  // Remove excess old nodes (iterate backwards to avoid index shifting)
  if (oldLen > newLen) {
    for (let i = oldLen - 1; i >= newLen; i--) {
      oldParent.removeChild(oldChildren[i]);
    }
  }
}

/**
 * Keyed reconciliation - match by z-key, reorder with minimal moves
 * using Longest Increasing Subsequence (LIS) to find the maximum set
 * of nodes that are already in the correct relative order, then only
 * move the remaining nodes.
 */
function _morphChildrenKeyed(oldParent, oldChildren, newChildren, oldKeyMap, newKeyMap) {
  const consumed = new Set();
  const newLen = newChildren.length;
  const matched = new Array(newLen);

  // Step 1: Match new children to old children by key
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

  // Step 2: Remove old keyed nodes not in the new tree
  for (let i = oldChildren.length - 1; i >= 0; i--) {
    if (!consumed.has(i)) {
      const key = _getKey(oldChildren[i]);
      if (key != null && !newKeyMap.has(key)) {
        oldParent.removeChild(oldChildren[i]);
      }
    }
  }

  // Step 3: Build index array for LIS of matched old indices.
  // This finds the largest set of keyed nodes already in order,
  // so we only need to move the rest - O(n log n) instead of O(n²).
  const oldIndices = [];      // Maps new-position → old-position (or -1)
  for (let i = 0; i < newLen; i++) {
    if (matched[i]) {
      const key = _getKey(newChildren[i]);
      oldIndices.push(oldKeyMap.get(key));
    } else {
      oldIndices.push(-1);
    }
  }

  const lisSet = _lis(oldIndices);

  // Step 4: Insert / reorder / morph - walk new children forward,
  // using LIS to decide which nodes stay in place.
  let cursor = oldParent.firstChild;
  const unkeyedOld = [];
  for (let i = 0; i < oldChildren.length; i++) {
    if (!consumed.has(i) && _getKey(oldChildren[i]) == null) {
      unkeyedOld.push(oldChildren[i]);
    }
  }
  let unkeyedIdx = 0;

  for (let i = 0; i < newLen; i++) {
    const newNode = newChildren[i];
    const newKey = _getKey(newNode);
    let oldNode = matched[i];

    if (!oldNode && newKey == null) {
      oldNode = unkeyedOld[unkeyedIdx++] || null;
    }

    if (oldNode) {
      // If this node is NOT part of the LIS, it needs to be moved
      if (!lisSet.has(i)) {
        oldParent.insertBefore(oldNode, cursor);
      }
      // Capture next sibling BEFORE _morphNode - if _morphNode calls
      // replaceChild, oldNode is removed and nextSibling becomes stale.
      const nextSib = oldNode.nextSibling;
      _morphNode(oldParent, oldNode, newNode);
      cursor = nextSib;
    } else {
      // Insert new node
      const clone = newNode.cloneNode(true);
      if (cursor) {
        oldParent.insertBefore(clone, cursor);
      } else {
        oldParent.appendChild(clone);
      }
    }
  }

  // Remove remaining unkeyed old nodes
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
 * Compute the Longest Increasing Subsequence of an index array.
 * Returns a Set of positions (in the input) that form the LIS.
 * Entries with value -1 (unmatched) are excluded.
 *
 * O(n log n) - same algorithm used by Vue 3 and ivi.
 *
 * @param {number[]} arr - array of old-tree indices (-1 = unmatched)
 * @returns {Set<number>} - positions in arr belonging to the LIS
 */
function _lis(arr) {
  const len = arr.length;
  const result = new Set();
  if (len === 0) return result;

  // tails[i] = index in arr of the smallest tail element for LIS of length i+1
  const tails = [];
  // prev[i] = predecessor index in arr for the LIS ending at arr[i]
  const prev = new Array(len).fill(-1);
  const tailIndices = []; // parallel to tails: actual positions

  for (let i = 0; i < len; i++) {
    if (arr[i] === -1) continue;
    const val = arr[i];

    // Binary search for insertion point in tails
    let lo = 0, hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid] < val) lo = mid + 1;
      else hi = mid;
    }

    tails[lo] = val;
    tailIndices[lo] = i;
    prev[i] = lo > 0 ? tailIndices[lo - 1] : -1;
  }

  // Reconstruct: walk backwards from the last element of LIS
  let k = tailIndices[tails.length - 1];
  for (let i = tails.length - 1; i >= 0; i--) {
    result.add(k);
    k = prev[k];
  }

  return result;
}

/**
 * Morph a single node in place.
 */
function _morphNode(parent, oldNode, newNode) {
  // Text / comment nodes - just update content
  if (oldNode.nodeType === 3 || oldNode.nodeType === 8) {
    if (newNode.nodeType === oldNode.nodeType) {
      if (oldNode.nodeValue !== newNode.nodeValue) {
        oldNode.nodeValue = newNode.nodeValue;
      }
      return;
    }
    // Different node types - replace
    parent.replaceChild(newNode.cloneNode(true), oldNode);
    return;
  }

  // Different node types or tag names - replace entirely
  if (oldNode.nodeType !== newNode.nodeType ||
      oldNode.nodeName !== newNode.nodeName) {
    parent.replaceChild(newNode.cloneNode(true), oldNode);
    return;
  }

  // Both are elements - diff attributes then recurse children
  if (oldNode.nodeType === 1) {
    // z-skip: developer opt-out - skip diffing this subtree entirely.
    // Useful for third-party widgets, canvas, video, or large static content.
    if (oldNode.hasAttribute('z-skip')) return;

    // Fast bail-out: if the elements are identical, skip everything.
    // isEqualNode() is a native C++ comparison - much faster than walking
    // attributes + children in JS when trees haven't changed.
    if (oldNode.isEqualNode(newNode)) return;

    _morphAttributes(oldNode, newNode);

    // Special elements: don't recurse into their children
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
      _morphChildren(oldNode, newNode);
      if (oldNode.value !== newNode.value) {
        oldNode.value = newNode.value;
      }
      return;
    }

    // Generic element - recurse children
    _morphChildren(oldNode, newNode);
  }
}

/**
 * Sync attributes from newEl onto oldEl.
 * Uses a single pass: build a set of new attribute names, iterate
 * old attrs for removals, then apply new attrs.
 */
function _morphAttributes(oldEl, newEl) {
  const newAttrs = newEl.attributes;
  const oldAttrs = oldEl.attributes;
  const newLen = newAttrs.length;
  const oldLen = oldAttrs.length;

  // Fast path: if both have same number of attributes, check if they're identical
  if (newLen === oldLen) {
    let same = true;
    for (let i = 0; i < newLen; i++) {
      const na = newAttrs[i];
      if (oldEl.getAttribute(na.name) !== na.value) { same = false; break; }
    }
    if (same) {
      // Also verify no extra old attrs (names mismatch)
      for (let i = 0; i < oldLen; i++) {
        if (!newEl.hasAttribute(oldAttrs[i].name)) { same = false; break; }
      }
    }
    if (same) return;
  }

  // Build set of new attr names for O(1) lookup during removal pass
  const newNames = new Set();
  for (let i = 0; i < newLen; i++) {
    const attr = newAttrs[i];
    newNames.add(attr.name);
    if (oldEl.getAttribute(attr.name) !== attr.value) {
      oldEl.setAttribute(attr.name, attr.value);
    }
  }

  // Remove stale attributes - snapshot names first because oldAttrs
  // is a live NamedNodeMap that mutates on removeAttribute().
  const oldNames = new Array(oldLen);
  for (let i = 0; i < oldLen; i++) oldNames[i] = oldAttrs[i].name;
  for (let i = oldNames.length - 1; i >= 0; i--) {
    if (!newNames.has(oldNames[i])) {
      oldEl.removeAttribute(oldNames[i]);
    }
  }
}

/**
 * Sync input element value, checked, disabled states.
 *
 * Only updates the value when the new HTML explicitly carries a `value`
 * attribute.  Templates that use z-model manage values through reactive
 * state + _bindModels - the morph engine should not interfere by wiping
 * a live input's content to '' just because the template has no `value`
 * attr.  This prevents the wipe-then-restore cycle that resets cursor
 * position on every keystroke.
 */
function _syncInputValue(oldEl, newEl) {
  const type = (oldEl.type || '').toLowerCase();

  if (type === 'checkbox' || type === 'radio') {
    if (oldEl.checked !== newEl.checked) oldEl.checked = newEl.checked;
  } else {
    const newVal = newEl.getAttribute('value');
    if (newVal !== null && oldEl.value !== newVal) {
      oldEl.value = newVal;
    }
  }

  // Sync disabled
  if (oldEl.disabled !== newEl.disabled) oldEl.disabled = newEl.disabled;
}

/**
 * Get the reconciliation key from a node.
 *
 * Priority: z-key attribute → id attribute → data-id / data-key.
 * Auto-detected keys use a `\0` prefix to avoid collisions with
 * explicit z-key values.
 *
 * This means the LIS-optimised keyed path activates automatically
 * whenever elements carry `id` or `data-id` / `data-key` attributes
 * - no extra markup required.
 *
 * @returns {string|null}
 */
function _getKey(node) {
  if (node.nodeType !== 1) return null;

  // Explicit z-key - highest priority
  const zk = node.getAttribute('z-key');
  if (zk) return zk;

  // Auto-key: id attribute (unique by spec)
  if (node.id) return '\0id:' + node.id;

  // Auto-key: data-id or data-key attributes
  const ds = node.dataset;
  if (ds) {
    if (ds.id)  return '\0data-id:'  + ds.id;
    if (ds.key) return '\0data-key:' + ds.key;
  }

  return null;
}
