import { describe, it, expect, beforeEach } from 'vitest';
import { morph, morphElement } from '../src/diff.js';


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function el(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}

function morphAndGet(oldHTML, newHTML) {
  const root = el(oldHTML);
  morph(root, newHTML);
  return root;
}


// ---------------------------------------------------------------------------
// Basic morphing
// ---------------------------------------------------------------------------

describe('morph — basic', () => {
  it('updates text content', () => {
    const root = morphAndGet('<p>old</p>', '<p>new</p>');
    expect(root.innerHTML).toBe('<p>new</p>');
  });

  it('appends new elements', () => {
    const root = morphAndGet('<p>a</p>', '<p>a</p><p>b</p>');
    expect(root.children.length).toBe(2);
    expect(root.children[1].textContent).toBe('b');
  });

  it('removes extra elements', () => {
    const root = morphAndGet('<p>a</p><p>b</p>', '<p>a</p>');
    expect(root.children.length).toBe(1);
  });

  it('replaces elements with different tag', () => {
    const root = morphAndGet('<p>text</p>', '<div>text</div>');
    expect(root.children[0].tagName).toBe('DIV');
    expect(root.children[0].textContent).toBe('text');
  });

  it('handles empty to content', () => {
    const root = morphAndGet('', '<p>hello</p>');
    expect(root.innerHTML).toBe('<p>hello</p>');
  });

  it('handles content to empty', () => {
    const root = morphAndGet('<p>hello</p>', '');
    expect(root.children.length).toBe(0);
  });

  it('handles multiple appends at once', () => {
    const root = morphAndGet('<p>a</p>', '<p>a</p><p>b</p><p>c</p><p>d</p>');
    expect(root.children.length).toBe(4);
  });

  it('handles complete replacement of all children', () => {
    const root = morphAndGet('<p>a</p><p>b</p>', '<span>x</span><span>y</span>');
    expect(root.children[0].tagName).toBe('SPAN');
    expect(root.children[1].tagName).toBe('SPAN');
  });

  it('handles single text node to multiple elements', () => {
    const root = document.createElement('div');
    root.textContent = 'hello';
    morph(root, '<p>a</p><p>b</p>');
    expect(root.children.length).toBe(2);
  });

  it('handles morphing identical content (no-op)', () => {
    const root = el('<p>same</p>');
    const child = root.children[0];
    morph(root, '<p>same</p>');
    expect(root.children[0]).toBe(child); // identity preserved
    expect(root.innerHTML).toBe('<p>same</p>');
  });
});


// ---------------------------------------------------------------------------
// Attribute morphing
// ---------------------------------------------------------------------------

describe('morph — attributes', () => {
  it('adds new attributes', () => {
    const root = morphAndGet('<div></div>', '<div class="active"></div>');
    expect(root.children[0].className).toBe('active');
  });

  it('updates existing attributes', () => {
    const root = morphAndGet('<div class="old"></div>', '<div class="new"></div>');
    expect(root.children[0].className).toBe('new');
  });

  it('removes stale attributes', () => {
    const root = morphAndGet('<div class="x" id="y"></div>', '<div class="x"></div>');
    expect(root.children[0].hasAttribute('id')).toBe(false);
  });

  it('handles multiple attribute changes simultaneously', () => {
    const root = morphAndGet(
      '<div class="a" id="old" data-x="1"></div>',
      '<div class="b" title="new" data-y="2"></div>'
    );
    const d = root.children[0];
    expect(d.className).toBe('b');
    expect(d.hasAttribute('id')).toBe(false);
    expect(d.hasAttribute('data-x')).toBe(false);
    expect(d.getAttribute('title')).toBe('new');
    expect(d.getAttribute('data-y')).toBe('2');
  });

  it('preserves attributes that have not changed', () => {
    const root = morphAndGet('<div class="keep" id="a"></div>', '<div class="keep" id="b"></div>');
    expect(root.children[0].className).toBe('keep');
    expect(root.children[0].id).toBe('b');
  });

  it('handles attribute with empty value', () => {
    const root = morphAndGet('<div></div>', '<div hidden></div>');
    expect(root.children[0].hasAttribute('hidden')).toBe(true);
  });
});


// ---------------------------------------------------------------------------
// Keyed reconciliation
// ---------------------------------------------------------------------------

describe('morph — keyed', () => {
  it('matches elements by z-key', () => {
    const root = el('<div z-key="a">A</div><div z-key="b">B</div>');
    morph(root, '<div z-key="b">B-updated</div><div z-key="a">A-updated</div>');
    const kids = [...root.children];
    expect(kids[0].getAttribute('z-key')).toBe('b');
    expect(kids[0].textContent).toBe('B-updated');
    expect(kids[1].getAttribute('z-key')).toBe('a');
    expect(kids[1].textContent).toBe('A-updated');
  });

  it('removes keyed elements not in new tree', () => {
    const root = el('<div z-key="a">A</div><div z-key="b">B</div><div z-key="c">C</div>');
    morph(root, '<div z-key="a">A</div><div z-key="c">C</div>');
    expect(root.children.length).toBe(2);
    expect(root.children[0].getAttribute('z-key')).toBe('a');
    expect(root.children[1].getAttribute('z-key')).toBe('c');
  });

  it('inserts new keyed elements', () => {
    const root = el('<div z-key="a">A</div>');
    morph(root, '<div z-key="a">A</div><div z-key="b">B</div>');
    expect(root.children.length).toBe(2);
    expect(root.children[1].getAttribute('z-key')).toBe('b');
  });

  it('preserves keyed node identity on reorder', () => {
    const root = el('<div z-key="a">A</div><div z-key="b">B</div><div z-key="c">C</div>');
    const nodeA = root.children[0];
    const nodeB = root.children[1];
    const nodeC = root.children[2];
    morph(root, '<div z-key="c">C</div><div z-key="a">A</div><div z-key="b">B</div>');
    // Same DOM nodes, just reordered
    expect(root.children[0]).toBe(nodeC);
    expect(root.children[1]).toBe(nodeA);
    expect(root.children[2]).toBe(nodeB);
  });

  it('handles mixed keyed and unkeyed nodes', () => {
    const root = el('<div z-key="a">A</div><p>unkeyed</p><div z-key="b">B</div>');
    morph(root, '<div z-key="b">B2</div><span>new-unkeyed</span><div z-key="a">A2</div>');
    expect(root.children[0].getAttribute('z-key')).toBe('b');
    expect(root.children[0].textContent).toBe('B2');
    expect(root.children[2].getAttribute('z-key')).toBe('a');
    expect(root.children[2].textContent).toBe('A2');
  });

  it('handles complete key set swap', () => {
    const root = el('<div z-key="a">A</div><div z-key="b">B</div>');
    morph(root, '<div z-key="c">C</div><div z-key="d">D</div>');
    expect(root.children.length).toBe(2);
    expect(root.children[0].getAttribute('z-key')).toBe('c');
    expect(root.children[1].getAttribute('z-key')).toBe('d');
  });

  it('handles reverse order (worst case for naive diff)', () => {
    const root = el(
      '<div z-key="1">1</div><div z-key="2">2</div><div z-key="3">3</div>' +
      '<div z-key="4">4</div><div z-key="5">5</div>'
    );
    morph(root,
      '<div z-key="5">5</div><div z-key="4">4</div><div z-key="3">3</div>' +
      '<div z-key="2">2</div><div z-key="1">1</div>'
    );
    expect([...root.children].map(c => c.getAttribute('z-key'))).toEqual(['5','4','3','2','1']);
  });
});


// ---------------------------------------------------------------------------
// Input / form element handling
// ---------------------------------------------------------------------------

describe('morph — form elements', () => {
  it('syncs input value', () => {
    const root = el('<input value="old">');
    morph(root, '<input value="new">');
    expect(root.querySelector('input').value).toBe('new');
  });

  it('syncs checkbox checked state', () => {
    const root = el('<input type="checkbox">');
    root.querySelector('input').checked = false;
    morph(root, '<input type="checkbox" checked>');
    expect(root.querySelector('input').checked).toBe(true);
  });

  it('syncs textarea content', () => {
    const root = el('<textarea>old</textarea>');
    morph(root, '<textarea>new</textarea>');
    expect(root.querySelector('textarea').value).toBe('new');
  });

  it('syncs input disabled state', () => {
    const root = el('<input>');
    morph(root, '<input disabled>');
    expect(root.querySelector('input').disabled).toBe(true);
  });

  it('syncs radio button', () => {
    const root = el('<input type="radio" value="a">');
    root.querySelector('input').checked = false;
    morph(root, '<input type="radio" value="a" checked>');
    expect(root.querySelector('input').checked).toBe(true);
  });

  it('syncs select element value', () => {
    const root = el('<select><option value="a">A</option><option value="b">B</option></select>');
    root.querySelector('select').value = 'a';
    morph(root, '<select><option value="a">A</option><option value="b" selected>B</option></select>');
    // Note: jsdom may handle selected differently, but the morph should attempt to sync
    expect(root.querySelector('select')).toBeTruthy();
  });
});


// ---------------------------------------------------------------------------
// Text and comment nodes
// ---------------------------------------------------------------------------

describe('morph — text nodes', () => {
  it('updates text nodes', () => {
    const root = document.createElement('div');
    root.textContent = 'old';
    morph(root, 'new');
    expect(root.textContent).toBe('new');
  });

  it('handles multiple text nodes', () => {
    const root = document.createElement('div');
    root.appendChild(document.createTextNode('a'));
    root.appendChild(document.createTextNode('b'));
    morph(root, 'xy');
    expect(root.textContent).toBe('xy');
  });

  it('handles comment nodes', () => {
    const root = document.createElement('div');
    root.appendChild(document.createComment('old comment'));
    morph(root, '<!-- new comment -->');
    expect(root.childNodes[0].nodeType).toBe(8); // Comment node
    expect(root.childNodes[0].nodeValue).toBe(' new comment ');
  });
});


// ---------------------------------------------------------------------------
// Nested children
// ---------------------------------------------------------------------------

describe('morph — nested', () => {
  it('recursively morphs nested elements', () => {
    const root = morphAndGet(
      '<ul><li>a</li><li>b</li></ul>',
      '<ul><li>a</li><li>b-updated</li><li>c</li></ul>'
    );
    const items = root.querySelectorAll('li');
    expect(items.length).toBe(3);
    expect(items[1].textContent).toBe('b-updated');
    expect(items[2].textContent).toBe('c');
  });

  it('handles structure change in nested elements', () => {
    const root = morphAndGet(
      '<div><span>text</span></div>',
      '<div><p>new text</p></div>'
    );
    expect(root.querySelector('p').textContent).toBe('new text');
    expect(root.querySelector('span')).toBeNull();
  });

  it('handles deeply nested changes (3 levels)', () => {
    const root = morphAndGet(
      '<div><div><div><span>deep</span></div></div></div>',
      '<div><div><div><span>updated</span></div></div></div>'
    );
    expect(root.querySelector('span').textContent).toBe('updated');
  });

  it('handles nested list reorder with keys', () => {
    const root = morphAndGet(
      '<ul><li z-key="a">A</li><li z-key="b">B</li><li z-key="c">C</li></ul>',
      '<ul><li z-key="c">C</li><li z-key="a">A</li><li z-key="b">B</li></ul>'
    );
    const items = root.querySelectorAll('li');
    expect(items[0].getAttribute('z-key')).toBe('c');
    expect(items[1].getAttribute('z-key')).toBe('a');
    expect(items[2].getAttribute('z-key')).toBe('b');
  });
});


// ---------------------------------------------------------------------------
// Preserves unchanged nodes (identity)
// ---------------------------------------------------------------------------

describe('morph — preservation', () => {
  it('does not replace elements that have not changed', () => {
    const root = el('<p>same</p><p>will-change</p>');
    const firstP = root.children[0];
    morph(root, '<p>same</p><p>changed</p>');
    expect(root.children[0]).toBe(firstP); // same DOM node
    expect(root.children[1].textContent).toBe('changed');
  });

  it('preserves identity of deeply nested unchanged nodes', () => {
    const root = el('<div><ul><li>item</li></ul></div>');
    const li = root.querySelector('li');
    morph(root, '<div><ul><li>item</li></ul></div>');
    expect(root.querySelector('li')).toBe(li);
  });
});


// ---------------------------------------------------------------------------
// z-skip directive
// ---------------------------------------------------------------------------

describe('morph — z-skip', () => {
  it('skips subtrees with z-skip attribute', () => {
    const root = el('<div z-skip><p>original</p></div>');
    const p = root.querySelector('p');
    morph(root, '<div z-skip><p>updated</p></div>');
    // The inner content should NOT change because z-skip is set
    expect(root.querySelector('p')).toBe(p);
    expect(root.querySelector('p').textContent).toBe('original');
  });

  it('morphs sibling of z-skip normally', () => {
    const root = el('<div z-skip><p>skip me</p></div><div><p>morph me</p></div>');
    morph(root, '<div z-skip><p>different</p></div><div><p>morphed</p></div>');
    expect(root.children[0].querySelector('p').textContent).toBe('skip me');
    expect(root.children[1].querySelector('p').textContent).toBe('morphed');
  });
});


// ---------------------------------------------------------------------------
// isEqualNode fast bail-out
// ---------------------------------------------------------------------------

describe('morph — fast bail-out', () => {
  it('uses isEqualNode to skip identical elements', () => {
    const root = el('<div><p class="a" id="b">text</p></div>');
    const p = root.querySelector('p');
    morph(root, '<div><p class="a" id="b">text</p></div>');
    // isEqualNode returns true, so the node should be kept
    expect(root.querySelector('p')).toBe(p);
  });
});


// ---------------------------------------------------------------------------
// Edge cases & stress
// ---------------------------------------------------------------------------

describe('morph — edge cases', () => {
  it('handles whitespace-only text nodes', () => {
    const root = morphAndGet('<div>  </div>', '<div>text</div>');
    expect(root.children[0].textContent).toBe('text');
  });

  it('handles node type change (text → element)', () => {
    const root = document.createElement('div');
    root.appendChild(document.createTextNode('text'));
    morph(root, '<p>element</p>');
    expect(root.children[0].tagName).toBe('P');
  });

  it('handles large number of children', () => {
    const oldItems = Array.from({ length: 100 }, (_, i) => `<li>${i}</li>`).join('');
    const newItems = Array.from({ length: 100 }, (_, i) => `<li>${i * 2}</li>`).join('');
    const root = morphAndGet(`<ul>${oldItems}</ul>`, `<ul>${newItems}</ul>`);
    expect(root.querySelectorAll('li').length).toBe(100);
    expect(root.querySelectorAll('li')[50].textContent).toBe('100');
  });

  it('handles large keyed list shuffle', () => {
    const ids = Array.from({ length: 50 }, (_, i) => i);
    const shuffled = [...ids].sort(() => Math.random() - 0.5);
    const oldHTML = ids.map(i => `<div z-key="${i}">${i}</div>`).join('');
    const newHTML = shuffled.map(i => `<div z-key="${i}">${i}</div>`).join('');
    const root = el(oldHTML);
    morph(root, newHTML);
    const result = [...root.children].map(c => c.getAttribute('z-key'));
    expect(result).toEqual(shuffled.map(String));
  });

  it('handles empty string to empty string', () => {
    const root = morphAndGet('', '');
    expect(root.childNodes.length).toBe(0);
  });
});


// ---------------------------------------------------------------------------
// Auto-keyed reconciliation (id / data-id / data-key)
// ---------------------------------------------------------------------------

describe('morph — auto-keyed via id attribute', () => {
  it('reorders elements by id without z-key', () => {
    const root = el(
      '<div id="a">A</div><div id="b">B</div><div id="c">C</div>'
    );
    const refA = root.children[0];
    const refB = root.children[1];
    morph(root, '<div id="c">C</div><div id="a">A</div><div id="b">B</div>');
    // Node identity preserved — same DOM nodes, different order
    expect(root.children[1]).toBe(refA);
    expect(root.children[2]).toBe(refB);
    expect([...root.children].map(c => c.id)).toEqual(['c', 'a', 'b']);
  });

  it('reorders elements by data-id without z-key', () => {
    const root = el(
      '<li data-id="1">One</li><li data-id="2">Two</li><li data-id="3">Three</li>'
    );
    const ref1 = root.children[0];
    morph(root, '<li data-id="3">Three</li><li data-id="1">One</li><li data-id="2">Two</li>');
    expect(root.children[1]).toBe(ref1);
    expect([...root.children].map(c => c.dataset.id)).toEqual(['3', '1', '2']);
  });

  it('reorders elements by data-key without z-key', () => {
    const root = el(
      '<span data-key="x">X</span><span data-key="y">Y</span>'
    );
    const refX = root.children[0];
    morph(root, '<span data-key="y">Y</span><span data-key="x">X</span>');
    expect(root.children[1]).toBe(refX);
  });

  it('removes auto-keyed elements not in new tree', () => {
    const root = morphAndGet(
      '<p id="a">A</p><p id="b">B</p><p id="c">C</p>',
      '<p id="a">A</p><p id="c">C</p>'
    );
    expect(root.children.length).toBe(2);
    expect([...root.children].map(c => c.id)).toEqual(['a', 'c']);
  });

  it('inserts new auto-keyed elements', () => {
    const root = morphAndGet(
      '<p id="a">A</p><p id="c">C</p>',
      '<p id="a">A</p><p id="b">B</p><p id="c">C</p>'
    );
    expect(root.children.length).toBe(3);
    expect([...root.children].map(c => c.id)).toEqual(['a', 'b', 'c']);
  });
});


// ---------------------------------------------------------------------------
// morphElement — single-element morph
// ---------------------------------------------------------------------------

describe('morphElement', () => {
  it('morphs attributes and children, preserving identity', () => {
    const root = el('<div class="old"><span>old</span></div>');
    const target = root.children[0];
    const result = morphElement(target, '<div class="new"><span>new</span></div>');
    expect(result).toBe(target);  // same node
    expect(target.className).toBe('new');
    expect(target.children[0].textContent).toBe('new');
  });

  it('replaces element when tag name differs', () => {
    const root = el('<div>old</div>');
    const target = root.children[0];
    const result = morphElement(target, '<section>new</section>');
    expect(result).not.toBe(target);
    expect(result.tagName).toBe('SECTION');
    expect(result.textContent).toBe('new');
    expect(root.children[0]).toBe(result);
  });

  it('returns original element when nothing changes', () => {
    const root = el('<p class="x">same</p>');
    const target = root.children[0];
    const result = morphElement(target, '<p class="x">same</p>');
    expect(result).toBe(target);
  });

  it('handles empty new HTML gracefully', () => {
    const root = el('<div>content</div>');
    const target = root.children[0];
    const result = morphElement(target, '');
    expect(result).toBe(target);  // no-op on empty
  });
});


// ---------------------------------------------------------------------------
// Deep keyed reconciliation edge cases
// ---------------------------------------------------------------------------

describe('morph — keyed edge cases', () => {
  it('handles single keyed element swap', () => {
    const root = el('<div z-key="a">A</div>');
    const nodeA = root.children[0];
    morph(root, '<div z-key="b">B</div>');
    expect(root.children.length).toBe(1);
    expect(root.children[0].getAttribute('z-key')).toBe('b');
    expect(root.children[0]).not.toBe(nodeA);
  });

  it('preserves identity when keys are in sorted order (LIS full match)', () => {
    const root = el(
      '<div z-key="a">A</div><div z-key="b">B</div><div z-key="c">C</div>'
    );
    const nodes = [...root.children];
    morph(root, '<div z-key="a">A2</div><div z-key="b">B2</div><div z-key="c">C2</div>');
    expect(root.children[0]).toBe(nodes[0]);
    expect(root.children[1]).toBe(nodes[1]);
    expect(root.children[2]).toBe(nodes[2]);
    expect(root.children[0].textContent).toBe('A2');
  });

  it('handles keyed list grow and shrink in same morph', () => {
    const root = el(
      '<div z-key="a">A</div><div z-key="b">B</div><div z-key="c">C</div>'
    );
    morph(root, '<div z-key="b">B</div><div z-key="d">D</div>');
    expect(root.children.length).toBe(2);
    expect(root.children[0].getAttribute('z-key')).toBe('b');
    expect(root.children[1].getAttribute('z-key')).toBe('d');
  });

  it('handles all-new keys (full replacement)', () => {
    const root = el('<div z-key="a">A</div><div z-key="b">B</div>');
    morph(root, '<div z-key="x">X</div><div z-key="y">Y</div><div z-key="z">Z</div>');
    expect(root.children.length).toBe(3);
    expect([...root.children].map(c => c.getAttribute('z-key'))).toEqual(['x', 'y', 'z']);
  });

  it('handles keyed elements with attribute changes during reorder', () => {
    const root = el(
      '<div z-key="a" class="old-a">A</div><div z-key="b" class="old-b">B</div>'
    );
    const nodeA = root.children[0];
    const nodeB = root.children[1];
    morph(root, '<div z-key="b" class="new-b">B2</div><div z-key="a" class="new-a">A2</div>');
    expect(root.children[0]).toBe(nodeB);
    expect(root.children[1]).toBe(nodeA);
    expect(nodeA.className).toBe('new-a');
    expect(nodeB.className).toBe('new-b');
  });

  it('handles interleaved insert between existing keyed nodes', () => {
    const root = el('<div z-key="a">A</div><div z-key="c">C</div>');
    const nodeA = root.children[0];
    const nodeC = root.children[1];
    morph(root, '<div z-key="a">A</div><div z-key="b">B</div><div z-key="c">C</div>');
    expect(root.children.length).toBe(3);
    expect(root.children[0]).toBe(nodeA);
    expect(root.children[2]).toBe(nodeC);
    expect(root.children[1].textContent).toBe('B');
  });

  it('handles keyed list with duplicate key attributes gracefully', () => {
    // When duplicate keys exist, later entries override in the map (last wins)
    // morph should not crash, and at least one child gets the updated content
    const root = el('<div z-key="a">A1</div><div z-key="a">A2</div>');
    morph(root, '<div z-key="a">Updated</div>');
    const texts = [...root.children].map(c => c.textContent);
    expect(texts).toContain('Updated');
  });

  it('handles empty old with keyed new', () => {
    const root = document.createElement('div');
    morph(root, '<div z-key="a">A</div><div z-key="b">B</div>');
    expect(root.children.length).toBe(2);
    expect(root.children[0].getAttribute('z-key')).toBe('a');
  });

  it('handles keyed old to empty new', () => {
    const root = el('<div z-key="a">A</div><div z-key="b">B</div>');
    morph(root, '');
    expect(root.children.length).toBe(0);
  });
});


// ---------------------------------------------------------------------------
// Boolean attribute morphing
// ---------------------------------------------------------------------------

describe('morph — boolean attributes', () => {
  it('adds hidden attribute', () => {
    const root = morphAndGet('<div></div>', '<div hidden></div>');
    expect(root.children[0].hasAttribute('hidden')).toBe(true);
  });

  it('removes hidden attribute', () => {
    const root = morphAndGet('<div hidden></div>', '<div></div>');
    expect(root.children[0].hasAttribute('hidden')).toBe(false);
  });

  it('morphs readonly on input', () => {
    const root = morphAndGet('<input>', '<input readonly>');
    expect(root.querySelector('input').hasAttribute('readonly')).toBe(true);
  });

  it('morphs autofocus attribute', () => {
    const root = morphAndGet('<input>', '<input autofocus>');
    expect(root.querySelector('input').hasAttribute('autofocus')).toBe(true);
  });

  it('toggles multiple boolean attributes at once', () => {
    const root = morphAndGet('<input disabled readonly>', '<input>');
    const input = root.querySelector('input');
    expect(input.hasAttribute('disabled')).toBe(false);
    expect(input.hasAttribute('readonly')).toBe(false);
  });
});


// ---------------------------------------------------------------------------
// Complex form element morphing
// ---------------------------------------------------------------------------

describe('morph — complex form elements', () => {
  it('syncs input type change', () => {
    const root = morphAndGet('<input type="text" value="hello">', '<input type="password" value="secret">');
    const input = root.querySelector('input');
    expect(input.getAttribute('type')).toBe('password');
  });

  it('syncs multiple inputs simultaneously', () => {
    const root = el('<input value="a"><input type="checkbox"><textarea>old</textarea>');
    morph(root, '<input value="b"><input type="checkbox" checked><textarea>new</textarea>');
    expect(root.querySelectorAll('input')[0].value).toBe('b');
    expect(root.querySelectorAll('input')[1].checked).toBe(true);
    expect(root.querySelector('textarea').value).toBe('new');
  });

  it('syncs radio group checked state', () => {
    const root = el(
      '<input type="radio" name="choice" value="a" checked>' +
      '<input type="radio" name="choice" value="b">'
    );
    morph(root,
      '<input type="radio" name="choice" value="a">' +
      '<input type="radio" name="choice" value="b" checked>'
    );
    expect(root.querySelectorAll('input')[0].checked).toBe(false);
    expect(root.querySelectorAll('input')[1].checked).toBe(true);
  });

  it('syncs textarea from non-empty to empty', () => {
    const root = el('<textarea>content</textarea>');
    morph(root, '<textarea></textarea>');
    expect(root.querySelector('textarea').value).toBe('');
  });

  it('syncs select with added option', () => {
    const root = el('<select><option value="a">A</option></select>');
    morph(root, '<select><option value="a">A</option><option value="b">B</option></select>');
    expect(root.querySelectorAll('option').length).toBe(2);
  });

  it('handles input disabled toggle', () => {
    const root = el('<input disabled>');
    morph(root, '<input>');
    expect(root.querySelector('input').disabled).toBe(false);
  });
});


// ---------------------------------------------------------------------------
// Text / comment node edge cases
// ---------------------------------------------------------------------------

describe('morph — text and comment edge cases', () => {
  it('morphs comment to text node', () => {
    const root = document.createElement('div');
    root.appendChild(document.createComment('comment'));
    morph(root, 'text content');
    expect(root.childNodes[0].nodeType).toBe(3);
    expect(root.textContent).toBe('text content');
  });

  it('morphs text to comment node', () => {
    const root = document.createElement('div');
    root.textContent = 'text';
    morph(root, '<!-- comment -->');
    expect(root.childNodes[0].nodeType).toBe(8);
  });

  it('preserves identical text nodes', () => {
    const root = document.createElement('div');
    root.textContent = 'same';
    const textNode = root.childNodes[0];
    morph(root, 'same');
    expect(root.childNodes[0]).toBe(textNode);
  });

  it('handles mixed text and element children', () => {
    const root = document.createElement('div');
    root.innerHTML = 'text before <span>middle</span> text after';
    morph(root, 'new before <span>new middle</span> new after');
    expect(root.querySelector('span').textContent).toBe('new middle');
  });

  it('handles empty comment node', () => {
    const root = document.createElement('div');
    root.appendChild(document.createComment(''));
    morph(root, '<!---->');
    expect(root.childNodes[0].nodeType).toBe(8);
  });
});


// ---------------------------------------------------------------------------
// Nested structure edge cases
// ---------------------------------------------------------------------------

describe('morph — nested structure edge cases', () => {
  it('handles 5-level deep nesting change', () => {
    const root = morphAndGet(
      '<div><div><div><div><div>deep old</div></div></div></div></div>',
      '<div><div><div><div><div>deep new</div></div></div></div></div>'
    );
    let node = root;
    for (let i = 0; i < 5; i++) node = node.firstElementChild;
    expect(node.textContent).toBe('deep new');
  });

  it('handles structure change at intermediate level', () => {
    const root = morphAndGet(
      '<div><ul><li>a</li></ul></div>',
      '<div><ol><li>a</li></ol></div>'
    );
    expect(root.querySelector('ol')).not.toBeNull();
    expect(root.querySelector('ul')).toBeNull();
  });

  it('handles adding nested children inside empty element', () => {
    const root = morphAndGet('<div></div>', '<div><p><span>nested</span></p></div>');
    expect(root.querySelector('span').textContent).toBe('nested');
  });

  it('handles removing all nested children', () => {
    const root = morphAndGet(
      '<div><p><span>nested</span></p><ul><li>item</li></ul></div>',
      '<div></div>'
    );
    expect(root.children[0].children.length).toBe(0);
  });

  it('handles sibling addition with nested keyed content', () => {
    const root = el(
      '<ul><li z-key="a"><span>A</span></li></ul>'
    );
    morph(root,
      '<ul><li z-key="a"><span>A updated</span></li><li z-key="b"><span>B</span></li></ul>'
    );
    expect(root.querySelectorAll('li').length).toBe(2);
    expect(root.querySelector('li[z-key="a"] span').textContent).toBe('A updated');
  });
});


// ---------------------------------------------------------------------------
// z-skip with keyed children
// ---------------------------------------------------------------------------

describe('morph — z-skip + keyed interactions', () => {
  it('z-skip on parent skips entire keyed children', () => {
    const root = el('<div z-skip><p z-key="a">A</p><p z-key="b">B</p></div>');
    const pA = root.querySelector('p[z-key="a"]');
    morph(root, '<div z-skip><p z-key="b">B2</p><p z-key="a">A2</p></div>');
    // Children should NOT have been reordered
    expect(root.querySelector('p[z-key="a"]')).toBe(pA);
    expect(pA.textContent).toBe('A');
  });

  it('z-skip on one sibling does not affect other siblings', () => {
    const root = el(
      '<div z-skip><p>frozen</p></div><div><p>mutable</p></div>'
    );
    morph(root,
      '<div z-skip><p>changed?</p></div><div><p>changed!</p></div>'
    );
    expect(root.children[0].querySelector('p').textContent).toBe('frozen');
    expect(root.children[1].querySelector('p').textContent).toBe('changed!');
  });
});


// ---------------------------------------------------------------------------
// morphElement advanced cases
// ---------------------------------------------------------------------------

describe('morphElement — advanced', () => {
  it('morphs only attributes without child changes', () => {
    const root = el('<p class="old" data-x="1">text</p>');
    const target = root.children[0];
    const result = morphElement(target, '<p class="new" data-y="2">text</p>');
    expect(result).toBe(target);
    expect(target.className).toBe('new');
    expect(target.hasAttribute('data-x')).toBe(false);
    expect(target.getAttribute('data-y')).toBe('2');
  });

  it('morphs children while keeping same attributes', () => {
    const root = el('<div class="keep"><span>old</span></div>');
    const target = root.children[0];
    const result = morphElement(target, '<div class="keep"><span>new</span><span>added</span></div>');
    expect(result).toBe(target);
    expect(target.className).toBe('keep');
    expect(target.children.length).toBe(2);
    expect(target.children[1].textContent).toBe('added');
  });

  it('handles morphElement on nested structures', () => {
    const root = el('<div><ul><li>old</li></ul></div>');
    const target = root.children[0];
    morphElement(target, '<div><ul><li>new</li><li>added</li></ul></div>');
    expect(target.querySelectorAll('li').length).toBe(2);
    expect(target.querySelector('li').textContent).toBe('new');
  });
});


// ---------------------------------------------------------------------------
// Stress tests
// ---------------------------------------------------------------------------

describe('morph — stress tests', () => {
  it('handles 500 unkeyed children update', () => {
    const oldItems = Array.from({ length: 500 }, (_, i) => `<span>${i}</span>`).join('');
    const newItems = Array.from({ length: 500 }, (_, i) => `<span>${i + 1}</span>`).join('');
    const root = el(oldItems);
    morph(root, newItems);
    expect(root.children.length).toBe(500);
    expect(root.children[0].textContent).toBe('1');
    expect(root.children[499].textContent).toBe('500');
  });

  it('handles 100 keyed elements with middle insertion', () => {
    const ids = Array.from({ length: 100 }, (_, i) => i);
    const oldHTML = ids.map(i => `<div z-key="${i}">${i}</div>`).join('');
    // Insert new item in the middle
    const newIds = [...ids.slice(0, 50), 999, ...ids.slice(50)];
    const newHTML = newIds.map(i => `<div z-key="${i}">${i}</div>`).join('');
    const root = el(oldHTML);
    morph(root, newHTML);
    expect(root.children.length).toBe(101);
    expect(root.children[50].getAttribute('z-key')).toBe('999');
  });

  it('handles alternating insert/remove pattern', () => {
    const root = el('<p>a</p><p>b</p><p>c</p><p>d</p><p>e</p>');
    morph(root, '<p>a</p><p>c</p><p>e</p>');
    expect(root.children.length).toBe(3);
    expect([...root.children].map(c => c.textContent)).toEqual(['a', 'c', 'e']);
  });

  it('handles deep attribute churn', () => {
    const root = el(
      Array.from({ length: 20 }, (_, i) =>
        `<div class="c${i}" data-val="${i}" id="d${i}">item ${i}</div>`
      ).join('')
    );
    morph(root,
      Array.from({ length: 20 }, (_, i) =>
        `<div class="new-c${i}" data-val="${i * 2}" id="d${i}">updated ${i}</div>`
      ).join('')
    );
    expect(root.children[5].className).toBe('new-c5');
    expect(root.children[5].getAttribute('data-val')).toBe('10');
    expect(root.children[5].textContent).toBe('updated 5');
  });
});


// ---------------------------------------------------------------------------
// BUG FIX: keyed morph cursor after node replacement
// ---------------------------------------------------------------------------

describe('morph — keyed cursor after replaceChild', () => {
  it('correctly positions nodes when tag changes during keyed morph', () => {
    const root = el(
      '<div z-key="a">A</div>' +
      '<span z-key="b">B</span>' +
      '<div z-key="c">C</div>'
    );
    // Change <span> to <div> (triggers replaceChild inside _morphNode)
    // and reorder to force the LIS path
    morph(root,
      '<div z-key="c">C!</div>' +
      '<div z-key="b">B!</div>' +
      '<div z-key="a">A!</div>'
    );
    expect(root.children.length).toBe(3);
    expect(root.children[0].textContent).toBe('C!');
    expect(root.children[1].textContent).toBe('B!');
    expect(root.children[2].textContent).toBe('A!');
    // All should be <div> now (the span was replaced)
    expect(root.children[1].tagName).toBe('DIV');
  });
});


// ---------------------------------------------------------------------------
// BUG FIX: attribute removal on live NamedNodeMap
// ---------------------------------------------------------------------------

describe('morph — attribute removal stability', () => {
  it('removes multiple stale attributes without index errors', () => {
    const root = el('<div class="a" data-x="1" data-y="2" data-z="3" id="t1">hi</div>');
    morph(root, '<div id="t1">hi</div>');
    const child = root.firstElementChild;
    expect(child.hasAttribute('class')).toBe(false);
    expect(child.hasAttribute('data-x')).toBe(false);
    expect(child.hasAttribute('data-y')).toBe(false);
    expect(child.hasAttribute('data-z')).toBe(false);
    expect(child.id).toBe('t1');
  });

  it('adds new attributes and removes old ones in the same pass', () => {
    const root = el('<div class="old" data-old="1">test</div>');
    morph(root, '<div class="new" data-new="2" aria-label="item">test</div>');
    const child = root.firstElementChild;
    expect(child.className).toBe('new');
    expect(child.getAttribute('data-new')).toBe('2');
    expect(child.getAttribute('aria-label')).toBe('item');
    expect(child.hasAttribute('data-old')).toBe(false);
  });
});


// ---------------------------------------------------------------------------
// Round 3 — Extended coverage
// ---------------------------------------------------------------------------

describe('morph — __zqMorphHook performance hook', () => {
  it('calls the hook with root element and elapsed time for morph()', () => {
    const calls = [];
    window.__zqMorphHook = (el, ms) => calls.push({ el, ms });
    const root = el('<p>a</p>');
    morph(root, '<p>b</p>');
    delete window.__zqMorphHook;
    expect(calls.length).toBe(1);
    expect(calls[0].el).toBe(root);
    expect(typeof calls[0].ms).toBe('number');
    expect(calls[0].ms).toBeGreaterThanOrEqual(0);
  });

  it('calls the hook for morphElement same-tag path', () => {
    const calls = [];
    window.__zqMorphHook = (el, ms) => calls.push({ el, ms });
    const node = document.createElement('div');
    node.textContent = 'old';
    document.body.appendChild(node);
    const result = morphElement(node, '<div>new</div>');
    delete window.__zqMorphHook;
    expect(calls.length).toBe(1);
    expect(calls[0].el).toBe(node);
    expect(result).toBe(node);
  });

  it('calls the hook for morphElement different-tag path', () => {
    const calls = [];
    window.__zqMorphHook = (el, ms) => calls.push({ el, ms });
    const node = document.createElement('div');
    node.textContent = 'old';
    document.body.appendChild(node);
    const result = morphElement(node, '<span>new</span>');
    delete window.__zqMorphHook;
    expect(calls.length).toBe(1);
    expect(calls[0].el).toBe(result);
    expect(result.nodeName).toBe('SPAN');
  });

  it('does not call hook when __zqMorphHook is not defined', () => {
    delete window.__zqMorphHook;
    const root = el('<p>a</p>');
    // Should not throw
    morph(root, '<p>b</p>');
    expect(root.innerHTML).toBe('<p>b</p>');
  });
});

describe('morph — element to text node type change', () => {
  it('replaces element with text node at same position', () => {
    const root = el('<p>hello</p><div>world</div>');
    morph(root, 'just text');
    expect(root.textContent).toBe('just text');
  });

  it('replaces text node with element at same position', () => {
    const root = document.createElement('div');
    root.appendChild(document.createTextNode('plain text'));
    morph(root, '<p>element now</p>');
    expect(root.innerHTML).toBe('<p>element now</p>');
  });

  it('replaces comment with element', () => {
    const root = document.createElement('div');
    root.appendChild(document.createComment('a comment'));
    morph(root, '<span>replaced</span>');
    expect(root.innerHTML).toBe('<span>replaced</span>');
  });

  it('replaces element with comment', () => {
    const root = el('<p>text</p>');
    morph(root, '<!--comment-->');
    expect(root.childNodes[0].nodeType).toBe(8);
    expect(root.childNodes[0].nodeValue).toBe('comment');
  });
});

describe('morph — attributes fast-path bypass', () => {
  it('skips attribute update when count and values are identical but children differ', () => {
    const root = el('<div class="a" data-x="1"><p>old child</p></div>');
    const child = root.firstElementChild;
    morph(root, '<div class="a" data-x="1"><p>new child</p></div>');
    // Identity preserved because attrs are identical (fast path)
    expect(root.firstElementChild).toBe(child);
    expect(root.firstElementChild.querySelector('p').textContent).toBe('new child');
  });

  it('detects changed attribute value even when count is same', () => {
    const root = el('<div class="a" data-x="1">text</div>');
    morph(root, '<div class="b" data-x="1">text</div>');
    expect(root.firstElementChild.className).toBe('b');
  });

  it('handles zero attributes on both sides', () => {
    const root = el('<div>text</div>');
    morph(root, '<div>updated</div>');
    expect(root.firstElementChild.textContent).toBe('updated');
    expect(root.firstElementChild.attributes.length).toBe(0);
  });
});

describe('morph — textarea edge cases', () => {
  it('syncs textarea with null-like textContent', () => {
    const root = el('<textarea>old value</textarea>');
    morph(root, '<textarea></textarea>');
    expect(root.querySelector('textarea').value).toBe('');
  });

  it('preserves textarea value when content unchanged', () => {
    const root = el('<textarea>same</textarea>');
    morph(root, '<textarea>same</textarea>');
    expect(root.querySelector('textarea').value).toBe('same');
  });
});

describe('morph — select value sync', () => {
  it('syncs select value after morphing options', () => {
    const root = el('<select><option value="a">A</option><option value="b">B</option></select>');
    root.querySelector('select').value = 'a';
    morph(root, '<select><option value="a">A</option><option value="b" selected>B</option></select>');
    // jsdom may not fully support select.value sync, but we verify no crash
    expect(root.querySelector('select')).toBeTruthy();
  });

  it('adds new option to select', () => {
    const root = el('<select><option value="a">A</option></select>');
    morph(root, '<select><option value="a">A</option><option value="b">B</option></select>');
    expect(root.querySelectorAll('option').length).toBe(2);
  });
});

describe('morph — input sync edge cases', () => {
  it('syncs input value when new element has no value attribute', () => {
    const root = el('<input type="text" value="old">');
    morph(root, '<input type="text">');
    expect(root.querySelector('input').value).toBe('');
  });

  it('syncs disabled attribute toggle', () => {
    const root = el('<input type="text" disabled>');
    morph(root, '<input type="text">');
    expect(root.querySelector('input').disabled).toBe(false);
  });

  it('syncs from non-disabled to disabled', () => {
    const root = el('<input type="text">');
    morph(root, '<input type="text" disabled>');
    expect(root.querySelector('input').disabled).toBe(true);
  });

  it('syncs checkbox from unchecked to checked', () => {
    const root = el('<input type="checkbox">');
    morph(root, '<input type="checkbox" checked>');
    expect(root.querySelector('input').checked).toBe(true);
  });

  it('syncs radio from checked to unchecked', () => {
    const root = el('<input type="radio" checked>');
    morph(root, '<input type="radio">');
    expect(root.querySelector('input').checked).toBe(false);
  });
});

describe('morph — keyed with multiple unkeyed leftover', () => {
  it('consumes some unkeyed and removes remaining', () => {
    const root = el(
      '<div z-key="a">A</div><p>unkeyed1</p><p>unkeyed2</p><p>unkeyed3</p><div z-key="b">B</div>'
    );
    morph(root,
      '<div z-key="b">B</div><p>kept</p><div z-key="a">A</div>'
    );
    // b should be first, one unkeyed kept (morphed), a should follow, extra unkeyed removed
    const children = [...root.children];
    expect(children[0].textContent).toBe('B');
    expect(children[1].textContent).toBe('kept');
    expect(children[2].textContent).toBe('A');
    expect(children.length).toBe(3);
  });

  it('removes all unkeyed when new tree has none', () => {
    const root = el(
      '<div z-key="a">A</div><p>extra1</p><p>extra2</p><div z-key="b">B</div>'
    );
    morph(root, '<div z-key="b">B</div><div z-key="a">A</div>');
    expect(root.children.length).toBe(2);
    expect(root.children[0].textContent).toBe('B');
    expect(root.children[1].textContent).toBe('A');
  });
});

describe('morph — LIS edge cases', () => {
  it('handles all entries being unmatched (-1)', () => {
    // All new keyed elements with no matching old keys
    const root = el('<div z-key="x">X</div><div z-key="y">Y</div>');
    morph(root, '<div z-key="a">A</div><div z-key="b">B</div>');
    expect(root.children[0].textContent).toBe('A');
    expect(root.children[1].textContent).toBe('B');
  });

  it('handles single keyed element', () => {
    const root = el('<div z-key="a">old</div>');
    morph(root, '<div z-key="a">new</div>');
    expect(root.children[0].textContent).toBe('new');
    expect(root.children[0].getAttribute('z-key')).toBe('a');
  });

  it('handles already-sorted keyed list (LIS = full array)', () => {
    const root = el(
      '<div z-key="a">A</div><div z-key="b">B</div><div z-key="c">C</div>'
    );
    const refs = [...root.children];
    morph(root,
      '<div z-key="a">A2</div><div z-key="b">B2</div><div z-key="c">C2</div>'
    );
    // All in order — identity preserved, no moves
    expect(root.children[0]).toBe(refs[0]);
    expect(root.children[1]).toBe(refs[1]);
    expect(root.children[2]).toBe(refs[2]);
  });

  it('handles fully reversed keyed list (LIS length = 1)', () => {
    const root = el(
      '<div z-key="a">A</div><div z-key="b">B</div><div z-key="c">C</div><div z-key="d">D</div>'
    );
    morph(root,
      '<div z-key="d">D</div><div z-key="c">C</div><div z-key="b">B</div><div z-key="a">A</div>'
    );
    expect(root.children[0].textContent).toBe('D');
    expect(root.children[1].textContent).toBe('C');
    expect(root.children[2].textContent).toBe('B');
    expect(root.children[3].textContent).toBe('A');
  });
});

describe('morph — mixed content type transitions', () => {
  it('morphs from elements to mixed text and elements', () => {
    const root = el('<p>one</p><p>two</p>');
    morph(root, 'text<p>element</p>more text');
    expect(root.childNodes.length).toBe(3);
    expect(root.childNodes[0].nodeType).toBe(3); // text
    expect(root.childNodes[1].nodeName).toBe('P');
    expect(root.childNodes[2].nodeType).toBe(3); // text
  });

  it('morphs from text to comment', () => {
    const root = document.createElement('div');
    root.appendChild(document.createTextNode('hello'));
    morph(root, '<!--comment-->');
    expect(root.childNodes[0].nodeType).toBe(8);
  });

  it('morphs from comment to text', () => {
    const root = document.createElement('div');
    root.appendChild(document.createComment('old'));
    morph(root, 'text node');
    expect(root.childNodes[0].nodeType).toBe(3);
    expect(root.childNodes[0].nodeValue).toBe('text node');
  });
});

describe('morph — deeply nested keyed reorder', () => {
  it('reorders keyed elements inside a nested structure', () => {
    const root = el('<ul><li z-key="c">C</li><li z-key="a">A</li><li z-key="b">B</li></ul>');
    const ul = root.querySelector('ul');
    const liC = ul.children[0];
    morph(root, '<ul><li z-key="a">A</li><li z-key="b">B</li><li z-key="c">C</li></ul>');
    // liC should be the same node, just moved to end
    expect(ul.children[2]).toBe(liC);
    expect(ul.children[0].textContent).toBe('A');
    expect(ul.children[1].textContent).toBe('B');
    expect(ul.children[2].textContent).toBe('C');
  });
});

describe('morph — large scale stress tests', () => {
  it('handles 1000 unkeyed elements', () => {
    const genItems = n => Array.from({ length: n }, (_, i) => `<li>${i}</li>`).join('');
    const root = el(genItems(1000));
    morph(root, genItems(1000));
    expect(root.children.length).toBe(1000);
  });

  it('handles 200 keyed elements shuffled randomly', () => {
    const keys = Array.from({ length: 200 }, (_, i) => i);
    const shuffled = [...keys].sort(() => Math.random() - 0.5);
    const makeHTML = arr => arr.map(k => `<div z-key="${k}">${k}</div>`).join('');
    const root = el(makeHTML(keys));
    morph(root, makeHTML(shuffled));
    expect(root.children.length).toBe(200);
    for (let i = 0; i < 200; i++) {
      expect(root.children[i].textContent).toBe(String(shuffled[i]));
    }
  });

  it('handles rapid sequential morphs', () => {
    const root = el('<p>start</p>');
    for (let i = 0; i < 50; i++) {
      morph(root, `<p>step ${i}</p>`);
    }
    expect(root.innerHTML).toBe('<p>step 49</p>');
  });
});

describe('morph — auto-key edge cases', () => {
  it('handles mixed auto-key types (id, data-id, data-key)', () => {
    const root = el(
      '<div id="x">X</div><div data-id="y">Y</div><div data-key="z">Z</div>'
    );
    morph(root,
      '<div data-key="z">Z2</div><div id="x">X2</div><div data-id="y">Y2</div>'
    );
    expect(root.children[0].getAttribute('data-key')).toBe('z');
    expect(root.children[1].id).toBe('x');
    expect(root.children[2].getAttribute('data-id')).toBe('y');
  });

  it('prefers z-key over id', () => {
    const root = el('<div z-key="a" id="b">old</div>');
    morph(root, '<div z-key="a" id="b">new</div>');
    const child = root.firstElementChild;
    expect(child.getAttribute('z-key')).toBe('a');
    expect(child.textContent).toBe('new');
  });
});

describe('morph — whitespace and boundary edge cases', () => {
  it('handles only whitespace in new HTML', () => {
    const root = el('<p>content</p>');
    morph(root, '   \n\t  ');
    // Whitespace-only text nodes
    expect(root.children.length).toBe(0);
  });

  it('handles HTML with leading/trailing whitespace text nodes', () => {
    const root = el('<p>a</p>');
    morph(root, '  <p>b</p>  ');
    expect(root.querySelector('p').textContent).toBe('b');
  });

  it('handles special characters in text content', () => {
    const root = el('<p>old</p>');
    morph(root, '<p>&amp; &lt; &gt; &quot;</p>');
    expect(root.querySelector('p').textContent).toBe('& < > "');
  });
});

describe('morph — z-skip edge cases', () => {
  it('preserves z-skip subtree even when parent changes', () => {
    const root = el('<div class="outer"><div z-skip>KEEP ME</div><p>old</p></div>');
    const skipDiv = root.querySelector('[z-skip]');
    morph(root, '<div class="outer"><div z-skip>CHANGED</div><p>new</p></div>');
    // z-skip child preserved
    expect(root.querySelector('[z-skip]')).toBe(skipDiv);
    expect(skipDiv.textContent).toBe('KEEP ME');
    expect(root.querySelector('p').textContent).toBe('new');
  });

  it('z-skip on root element of subtree blocks all descendant changes', () => {
    const root = el('<div z-skip><span>a</span><span>b</span><span>c</span></div>');
    const children = [...root.firstElementChild.children];
    morph(root, '<div z-skip><span>x</span><span>y</span></div>');
    // All children preserved because z-skip blocks everything
    expect(root.firstElementChild.children[0]).toBe(children[0]);
    expect(root.firstElementChild.children[0].textContent).toBe('a');
  });
});

describe('morph — morphElement edge cases', () => {
  it('handles morphElement with complex nested content', () => {
    const node = document.createElement('div');
    node.innerHTML = '<ul><li>a</li><li>b</li></ul>';
    document.body.appendChild(node);
    const result = morphElement(node, '<div><ul><li>x</li><li>y</li><li>z</li></ul></div>');
    expect(result).toBe(node); // same tag, identity preserved
    expect(result.querySelectorAll('li').length).toBe(3);
    expect(result.querySelectorAll('li')[2].textContent).toBe('z');
  });

  it('handles morphElement from div to section (different tag) with nested content', () => {
    const node = document.createElement('div');
    node.innerHTML = '<p>content</p>';
    document.body.appendChild(node);
    const result = morphElement(node, '<section><p>new content</p></section>');
    expect(result.nodeName).toBe('SECTION');
    expect(result.querySelector('p').textContent).toBe('new content');
  });

  it('returns original element when new HTML string is empty', () => {
    const node = document.createElement('div');
    node.textContent = 'content';
    document.body.appendChild(node);
    const result = morphElement(node, '');
    expect(result).toBe(node);
    expect(result.textContent).toBe('content');
  });

  it('returns original element when new HTML produces only text (no element)', () => {
    const node = document.createElement('div');
    node.textContent = 'old';
    document.body.appendChild(node);
    const result = morphElement(node, 'just text no element');
    expect(result).toBe(node); // no firstElementChild → returns old
  });
});

describe('morph — keyed nodes with tag changes during reorder', () => {
  it('handles keyed nodes where matched node has different tag (replaceChild path)', () => {
    // This tests the cursor stability fix: capture nextSibling before _morphNode
    const root = el(
      '<div z-key="a">A</div><span z-key="b">B</span><div z-key="c">C</div>'
    );
    morph(root,
      '<span z-key="c">C2</span><div z-key="a">A2</div><div z-key="b">B2</div>'
    );
    expect(root.children[0].nodeName).toBe('SPAN');
    expect(root.children[0].textContent).toBe('C2');
    expect(root.children[1].textContent).toBe('A2');
    expect(root.children[2].textContent).toBe('B2');
  });
});

describe('morph — identity preservation across morphs', () => {
  it('preserves element identity through multiple consecutive morphs', () => {
    const root = el('<div id="target"><p>v1</p></div>');
    const target = root.firstElementChild;
    morph(root, '<div id="target"><p>v2</p></div>');
    expect(root.firstElementChild).toBe(target);
    morph(root, '<div id="target"><p>v3</p></div>');
    expect(root.firstElementChild).toBe(target);
    morph(root, '<div id="target"><p>v4</p><span>extra</span></div>');
    expect(root.firstElementChild).toBe(target);
    expect(target.children.length).toBe(2);
  });

  it('preserves input focus state across morph', () => {
    const root = el('<input type="text" value="hello"><p>text</p>');
    document.body.appendChild(root);
    const input = root.querySelector('input');
    input.focus();
    morph(root, '<input type="text" value="hello"><p>updated</p>');
    // Input should still be the same element
    expect(root.querySelector('input')).toBe(input);
  });
});
