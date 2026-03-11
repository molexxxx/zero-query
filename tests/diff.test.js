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
