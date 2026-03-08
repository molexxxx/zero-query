import { describe, it, expect, beforeEach } from 'vitest';
import { morph } from '../src/diff.js';


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
});


// ---------------------------------------------------------------------------
// Keyed reconciliation
// ---------------------------------------------------------------------------

describe('morph — keyed', () => {
  it('matches elements by z-key', () => {
    const root = el('<div z-key="a">A</div><div z-key="b">B</div>');
    morph(root, '<div z-key="b">B-updated</div><div z-key="a">A-updated</div>');
    // Keys should match — b first, then a
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
});
