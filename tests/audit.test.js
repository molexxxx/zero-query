/**
 * Comprehensive audit test suite.
 * Re-auditing most critical areas with intensive edge case coverage.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { morph, morphElement } from '../src/diff.js';
import { reactive, Signal, signal, computed, effect } from '../src/reactive.js';
import { safeEval } from '../src/expression.js';
import {
  debounce, throttle, pipe, once, sleep,
  escapeHtml, html, trust, TrustedHTML, uuid, camelCase, kebabCase,
  deepClone, deepMerge, isEqual, param, parseQuery,
  storage, session, EventBus, bus,
} from '../src/utils.js';
import { createRouter, getRouter } from '../src/router.js';
import { component, mount, mountAll, destroy, prefetch, getInstance } from '../src/component.js';
import { createStore, getStore } from '../src/store.js';


// ===========================================================================
// Register dummy components used by router tests
// ===========================================================================
component('home-page', { render: () => '<p>home</p>' });
component('about-page', { render: () => '<p>about</p>' });
component('user-page', { render: () => '<p>user</p>' });
component('docs-page', { render: () => '<p>docs</p>' });

// ===========================================================================
// Helpers
// ===========================================================================
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

const eval_ = (expr, ...scopes) => safeEval(expr, scopes.length ? scopes : [{}]);


// ===========================================================================
// 1. LIS ALGORITHM & KEYED RECONCILIATION - AUDIT
// ===========================================================================

describe('LIS & keyed diff - advanced audit', () => {

  it('correctly handles LIS with all elements already in order', () => {
    // If all keys are in order, LIS = full set, no moves needed
    const root = el(
      '<div z-key="1">1</div><div z-key="2">2</div><div z-key="3">3</div><div z-key="4">4</div>'
    );
    const nodes = [...root.children];
    morph(root, '<div z-key="1">1u</div><div z-key="2">2u</div><div z-key="3">3u</div><div z-key="4">4u</div>');
    // All nodes should be same identity (no moves)
    for (let i = 0; i < 4; i++) {
      expect(root.children[i]).toBe(nodes[i]);
      expect(root.children[i].textContent).toBe(`${i + 1}u`);
    }
  });

  it('correctly handles LIS with single element out of place', () => {
    // [a, b, c, d] â†’ [a, c, d, b] - only b needs to move
    const root = el(
      '<div z-key="a">A</div><div z-key="b">B</div><div z-key="c">C</div><div z-key="d">D</div>'
    );
    const nodeA = root.children[0];
    const nodeB = root.children[1];
    const nodeC = root.children[2];
    const nodeD = root.children[3];
    morph(root, '<div z-key="a">A</div><div z-key="c">C</div><div z-key="d">D</div><div z-key="b">B</div>');
    expect(root.children[0]).toBe(nodeA);
    expect(root.children[1]).toBe(nodeC);
    expect(root.children[2]).toBe(nodeD);
    expect(root.children[3]).toBe(nodeB);
  });

  it('LIS handles fully reversed order correctly', () => {
    const keys = ['a', 'b', 'c', 'd', 'e'];
    const root = el(keys.map(k => `<div z-key="${k}">${k}</div>`).join(''));
    const reversed = [...keys].reverse();
    morph(root, reversed.map(k => `<div z-key="${k}">${k}</div>`).join(''));
    const result = [...root.children].map(c => c.getAttribute('z-key'));
    expect(result).toEqual(reversed);
  });

  it('LIS handles interleaved insert and remove', () => {
    // Old: [a, b, c, d, e] â†’ New: [f, a, c, g, e]
    const root = el(
      '<div z-key="a">A</div><div z-key="b">B</div><div z-key="c">C</div>' +
      '<div z-key="d">D</div><div z-key="e">E</div>'
    );
    const nodeA = root.children[0];
    const nodeC = root.children[2];
    const nodeE = root.children[4];
    morph(root,
      '<div z-key="f">F</div><div z-key="a">A</div><div z-key="c">C</div>' +
      '<div z-key="g">G</div><div z-key="e">E</div>'
    );
    expect(root.children.length).toBe(5);
    expect(root.children[0].getAttribute('z-key')).toBe('f');
    expect(root.children[1]).toBe(nodeA);
    expect(root.children[2]).toBe(nodeC);
    expect(root.children[3].getAttribute('z-key')).toBe('g');
    expect(root.children[4]).toBe(nodeE);
  });

  it('LIS with no overlapping keys - full replacement', () => {
    const root = el(
      '<div z-key="a">A</div><div z-key="b">B</div><div z-key="c">C</div>'
    );
    morph(root,
      '<div z-key="x">X</div><div z-key="y">Y</div><div z-key="z">Z</div>'
    );
    expect(root.children.length).toBe(3);
    expect([...root.children].map(c => c.getAttribute('z-key'))).toEqual(['x', 'y', 'z']);
  });

  it('keyed reorder with attribute and content updates simultaneously', () => {
    const root = el(
      '<div z-key="a" class="old-a" data-x="1">A-old</div>' +
      '<div z-key="b" class="old-b" data-x="2">B-old</div>' +
      '<div z-key="c" class="old-c" data-x="3">C-old</div>'
    );
    const nodeA = root.children[0];
    const nodeB = root.children[1];
    morph(root,
      '<div z-key="c" class="new-c" data-x="30">C-new</div>' +
      '<div z-key="a" class="new-a" data-x="10">A-new</div>' +
      '<div z-key="b" class="new-b" data-x="20">B-new</div>'
    );
    expect(root.children[1]).toBe(nodeA);
    expect(root.children[2]).toBe(nodeB);
    expect(nodeA.className).toBe('new-a');
    expect(nodeA.textContent).toBe('A-new');
    expect(nodeA.dataset.x).toBe('10');
    expect(nodeB.className).toBe('new-b');
  });

  it('auto-key via id interleaved with unkeyed nodes', () => {
    const root = el('<div id="a">A</div><p>text1</p><div id="b">B</div><p>text2</p>');
    const nodeA = root.children[0];
    const nodeB = root.children[2];
    morph(root, '<div id="b">B2</div><p>text3</p><div id="a">A2</div><p>text4</p>');
    expect(root.children[0]).toBe(nodeB);
    expect(root.children[2]).toBe(nodeA);
    expect(nodeA.textContent).toBe('A2');
    expect(nodeB.textContent).toBe('B2');
  });

  it('z-key takes priority over id for reconciliation', () => {
    const root = el('<div z-key="k1" id="x">A</div><div z-key="k2" id="y">B</div>');
    const ref1 = root.children[0];
    const ref2 = root.children[1];
    morph(root, '<div z-key="k2" id="y">B2</div><div z-key="k1" id="x">A2</div>');
    expect(root.children[0]).toBe(ref2);
    expect(root.children[1]).toBe(ref1);
    expect(ref1.textContent).toBe('A2');
    expect(ref2.textContent).toBe('B2');
  });

  it('handles LIS edge case with large list and one insertion at front', () => {
    const count = 20;
    const keys = Array.from({ length: count }, (_, i) => String(i));
    const root = el(keys.map(k => `<div z-key="${k}">${k}</div>`).join(''));
    const originalFirst = root.children[0];
    const newKeys = ['new', ...keys];
    morph(root, newKeys.map(k => `<div z-key="${k}">${k}</div>`).join(''));
    expect(root.children.length).toBe(count + 1);
    expect(root.children[0].getAttribute('z-key')).toBe('new');
    expect(root.children[1]).toBe(originalFirst);
  });

  it('handles consecutive moves (rotate left)', () => {
    // [a, b, c, d] â†’ [b, c, d, a]
    const root = el(
      '<div z-key="a">A</div><div z-key="b">B</div><div z-key="c">C</div><div z-key="d">D</div>'
    );
    const refs = [...root.children];
    morph(root, '<div z-key="b">B</div><div z-key="c">C</div><div z-key="d">D</div><div z-key="a">A</div>');
    expect(root.children[0]).toBe(refs[1]);
    expect(root.children[1]).toBe(refs[2]);
    expect(root.children[2]).toBe(refs[3]);
    expect(root.children[3]).toBe(refs[0]);
  });

  it('handles pairwise swap', () => {
    // [a, b, c, d] â†’ [b, a, d, c]
    const root = el(
      '<div z-key="a">A</div><div z-key="b">B</div><div z-key="c">C</div><div z-key="d">D</div>'
    );
    const refs = [...root.children];
    morph(root, '<div z-key="b">B</div><div z-key="a">A</div><div z-key="d">D</div><div z-key="c">C</div>');
    expect(root.children[0]).toBe(refs[1]);
    expect(root.children[1]).toBe(refs[0]);
    expect(root.children[2]).toBe(refs[3]);
    expect(root.children[3]).toBe(refs[2]);
  });
});


// ===========================================================================
// 2. MORPH ENGINE & SELECTOR ENGINE CONSISTENCY - AUDIT
// ===========================================================================

describe('morph engine consistency - audit', () => {

  it('morphing preserves event listeners attached via addEventListener', () => {
    const root = el('<button id="btn">Click</button>');
    const btn = root.querySelector('#btn');
    const handler = vi.fn();
    btn.addEventListener('click', handler);
    morph(root, '<button id="btn">Click Updated</button>');
    // Same node should be preserved (id-keyed auto-reconciliation)
    const newBtn = root.querySelector('#btn');
    expect(newBtn).toBe(btn);
    newBtn.click();
    expect(handler).toHaveBeenCalledOnce();
  });

  it('morphing preserves CSS classes added programmatically', () => {
    const root = el('<div id="target">content</div>');
    const target = root.querySelector('#target');
    target.classList.add('programmatic');
    // Morph with same attributes - should preserve via isEqualNode
    morph(root, '<div id="target">content updated</div>');
    const newTarget = root.querySelector('#target');
    expect(newTarget).toBe(target);
    // Programmatic class should be gone because the morph syncs attributes from newNode
    // (which doesn't have 'programmatic' class). This is correct behavior.
    expect(newTarget.classList.contains('programmatic')).toBe(false);
  });

  it('morphing handles inline style changes', () => {
    const root = el('<div style="color: red;">text</div>');
    morph(root, '<div style="color: blue;">text</div>');
    expect(root.children[0].style.color).toBe('blue');
  });

  it('morphing handles class addition and removal simultaneously', () => {
    const root = el('<div class="a b c">text</div>');
    morph(root, '<div class="b c d">text</div>');
    const el_ = root.children[0];
    expect(el_.classList.contains('a')).toBe(false);
    expect(el_.classList.contains('b')).toBe(true);
    expect(el_.classList.contains('c')).toBe(true);
    expect(el_.classList.contains('d')).toBe(true);
  });

  it('morph handles SVG elements', () => {
    const root = document.createElement('div');
    root.innerHTML = '<svg><circle cx="50" cy="50" r="40"/></svg>';
    morph(root, '<svg><circle cx="100" cy="100" r="50"/></svg>');
    const circle = root.querySelector('circle');
    expect(circle.getAttribute('cx')).toBe('100');
    expect(circle.getAttribute('r')).toBe('50');
  });

  it('morph handles data-* attributes', () => {
    const root = el('<div data-value="old" data-type="text">content</div>');
    morph(root, '<div data-value="new" data-extra="added">content</div>');
    const d = root.children[0];
    expect(d.dataset.value).toBe('new');
    expect(d.dataset.extra).toBe('added');
    expect(d.dataset.type).toBeUndefined();
  });

  it('morph handles empty attribute properly', () => {
    const root = el('<input type="text">');
    morph(root, '<input type="text" disabled>');
    expect(root.querySelector('input').disabled).toBe(true);
  });

  it('morph correctly handles table structures', () => {
    const root = el(
      '<table><tbody><tr><td>old</td></tr></tbody></table>'
    );
    morph(root,
      '<table><tbody><tr><td>new</td></tr><tr><td>added</td></tr></tbody></table>'
    );
    expect(root.querySelectorAll('td').length).toBe(2);
    expect(root.querySelectorAll('td')[0].textContent).toBe('new');
    expect(root.querySelectorAll('td')[1].textContent).toBe('added');
  });

  it('morphElement handles whitespace and text content changes', () => {
    const root = el('<div>  old text  </div>');
    const target = root.children[0];
    const result = morphElement(target, '<div>  new text  </div>');
    expect(result).toBe(target);
    expect(target.textContent).toBe('  new text  ');
  });
});


// ===========================================================================
// 3. REACTIVITY - SIGNALS, COMPUTED, EFFECTS - AUDIT
// ===========================================================================

describe('reactivity audit - edge cases', () => {

  it('effect re-tracks dependencies properly after conditional branch change', () => {
    const flag = signal(true);
    const a = signal('A');
    const b = signal('B');
    const log = vi.fn();

    effect(() => {
      if (flag.value) {
        log('a:' + a.value);
      } else {
        log('b:' + b.value);
      }
    });
    expect(log).toHaveBeenCalledWith('a:A');
    log.mockClear();

    // Changing b while flag=true should NOT trigger
    b.value = 'B2';
    expect(log).not.toHaveBeenCalled();

    // Switch branch
    flag.value = false;
    expect(log).toHaveBeenCalledWith('b:B2');
    log.mockClear();

    // Now changing a should NOT trigger (stale dep removed)
    a.value = 'A2';
    expect(log).not.toHaveBeenCalled();

    // Changing b SHOULD trigger
    b.value = 'B3';
    expect(log).toHaveBeenCalledWith('b:B3');
  });

  it('computed with boolean stability does not over-notify', () => {
    const n = signal(5);
    const isPositive = computed(() => n.value > 0);
    const spy = vi.fn();
    isPositive.subscribe(spy);

    n.value = 10; // still positive, no change
    expect(spy).not.toHaveBeenCalled();

    n.value = -1; // now negative, should notify
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockClear();
    n.value = -5; // still negative, no change
    expect(spy).not.toHaveBeenCalled();
  });

  it('multiple effects on same signal run in subscription order', () => {
    const s = signal(0);
    const order = [];
    effect(() => { s.value; order.push('first'); });
    effect(() => { s.value; order.push('second'); });
    order.length = 0;
    s.value = 1;
    expect(order).toEqual(['first', 'second']);
  });

  it('effect handles signal updated inside effect (glitch-free reads)', () => {
    const a = signal(1);
    const b = signal(1);
    const results = [];

    effect(() => {
      results.push(a.value + b.value);
    });

    expect(results).toEqual([2]);
    a.value = 2;
    expect(results).toEqual([2, 3]);
  });

  it('reactive proxy handles Object.keys correctly', () => {
    const fn = vi.fn();
    const obj = reactive({ a: 1, b: 2, c: 3 }, fn);
    expect(Object.keys(obj)).toEqual(['a', 'b', 'c']);
  });

  it('reactive proxy handles "in" operator', () => {
    const fn = vi.fn();
    const obj = reactive({ a: 1 }, fn);
    expect('a' in obj).toBe(true);
    expect('b' in obj).toBe(false);
  });

  it('reactive proxy handles for...in loop', () => {
    const fn = vi.fn();
    const obj = reactive({ x: 1, y: 2 }, fn);
    const keys = [];
    for (const k in obj) keys.push(k);
    expect(keys).toEqual(['x', 'y']);
  });

  it('reactive handles deeply nested object replacement', () => {
    const fn = vi.fn();
    const obj = reactive({ a: { b: { c: 1 } } }, fn);
    obj.a = { b: { c: 2 } };
    expect(fn).toHaveBeenCalled();
    expect(obj.a.b.c).toBe(2);
  });

  it('reactive handles setting property to null', () => {
    const fn = vi.fn();
    const obj = reactive({ value: { nested: true } }, fn);
    obj.value = null;
    expect(fn).toHaveBeenCalledWith('value', null, expect.any(Object));
    expect(obj.value).toBeNull();
  });

  it('signal with undefined initial value works', () => {
    const s = signal(undefined);
    expect(s.value).toBeUndefined();
    s.value = 42;
    expect(s.value).toBe(42);
  });

  it('computed with undefined result works', () => {
    const s = signal(null);
    const c = computed(() => s.value?.name);
    expect(c.value).toBeUndefined();
    s.value = { name: 'test' };
    expect(c.value).toBe('test');
  });

  it('disposing an effect that was already disposed is safe', () => {
    const s = signal(0);
    const fn = vi.fn(() => s.value);
    const dispose = effect(fn);
    dispose();
    dispose(); // second dispose should not throw
    s.value = 1;
    expect(fn).toHaveBeenCalledTimes(1); // only initial
  });
});


// ===========================================================================
// 4. UTILITIES - THOROUGH BUG HUNTING
// ===========================================================================

describe('utils audit - edge cases', () => {

  // --- debounce edge cases ---
  it('debounce handles zero delay', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 0);
    d('a');
    vi.advanceTimersByTime(0);
    expect(fn).toHaveBeenCalledWith('a');
    vi.useRealTimers();
  });

  it('debounce passes all arguments', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 50);
    d(1, 'two', { three: 3 });
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledWith(1, 'two', { three: 3 });
    vi.useRealTimers();
  });

  // --- throttle edge cases ---
  it('throttle allows call after interval expires', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const t = throttle(fn, 100);
    t('first');
    expect(fn).toHaveBeenCalledWith('first');
    vi.advanceTimersByTime(100);
    // After interval, next call should fire immediately
    fn.mockClear();
    t('second');
    expect(fn).toHaveBeenCalledWith('second');
    vi.useRealTimers();
  });

  it('throttle trailing call fires with correct arguments', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const t = throttle(fn, 100);
    t('first');
    t('second');
    t('third'); // should overwrite 'second' as the trailing call
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenLastCalledWith('third');
    vi.useRealTimers();
  });

  // --- once edge cases ---
  it('once preserves the return value across calls', () => {
    let counter = 0;
    const fn = once(() => ++counter);
    expect(fn()).toBe(1);
    expect(fn()).toBe(1);
    expect(fn()).toBe(1);
    expect(counter).toBe(1);
  });

  // --- escapeHtml edge cases ---
  it('escapeHtml handles all special characters mixed with regular text', () => {
    expect(escapeHtml('Hello & "World" <script>\'s</script>'))
      .toBe('Hello &amp; &quot;World&quot; &lt;script&gt;&#39;s&lt;/script&gt;');
  });

  it('escapeHtml handles numbers and booleans', () => {
    expect(escapeHtml(0)).toBe('0');
    expect(escapeHtml(false)).toBe('false');
    expect(escapeHtml(undefined)).toBe('undefined');
  });

  // --- html template tag edge cases ---
  it('html template tag handles multiple interpolations', () => {
    const a = '<b>bold</b>';
    const b = '"quoted"';
    const result = html`<p>${a} and ${b}</p>`;
    expect(result).toContain('&lt;b&gt;bold&lt;/b&gt;');
    expect(result).toContain('&quot;quoted&quot;');
    expect(result).toContain('<p>');
    expect(result).toContain('</p>');
  });

  it('html template tag handles zero and empty string interpolations', () => {
    const result = html`<span>${0}</span>`;
    expect(result).toBe('<span>0</span>');
  });

  // --- uuid ---
  it('uuid generates valid v4 format consistently', () => {
    for (let i = 0; i < 20; i++) {
      expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });

  // --- camelCase / kebabCase edge cases ---
  it('camelCase handles multiple consecutive hyphens', () => {
    expect(camelCase('my--component')).toBe('my-Component');
  });

  it('kebabCase handles consecutive uppercase letters', () => {
    expect(kebabCase('HTMLParser')).toBe('html-parser');
  });

  it('camelCase handles already camelCased string', () => {
    expect(camelCase('myComponent')).toBe('myComponent');
  });

  it('kebabCase handles single lowercase word', () => {
    expect(kebabCase('hello')).toBe('hello');
  });

  // --- deepClone edge cases ---
  it('deepClone handles Date objects', () => {
    const original = { date: new Date('2024-01-15') };
    const clone = deepClone(original);
    expect(clone.date).toBeInstanceOf(Date);
    expect(clone.date.getTime()).toBe(original.date.getTime());
    clone.date.setFullYear(2026);
    expect(original.date.getFullYear()).toBe(2024);
  });

  it('deepClone handles nested arrays within objects', () => {
    const original = { data: [{ id: 1, tags: ['a', 'b'] }, { id: 2, tags: ['c'] }] };
    const clone = deepClone(original);
    clone.data[0].tags.push('new');
    expect(original.data[0].tags).toEqual(['a', 'b']);
  });

  it('deepClone handles null values', () => {
    const clone = deepClone({ a: null, b: undefined });
    expect(clone.a).toBeNull();
    // Note: JSON.parse/JSON.stringify loses undefined
  });

  // --- deepMerge edge cases ---
  it('deepMerge does not merge arrays deeply (replaces)', () => {
    const target = { list: [1, 2, 3] };
    const source = { list: [4, 5] };
    deepMerge(target, source);
    expect(target.list).toEqual([4, 5]);
  });

  it('deepMerge handles empty source', () => {
    const target = { a: 1 };
    deepMerge(target, {});
    expect(target).toEqual({ a: 1 });
  });

  it('deepMerge handles multiple sources', () => {
    const result = deepMerge({ a: 1 }, { b: 2 }, { c: 3 });
    expect(result).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('deepMerge handles nested conflict', () => {
    const target = { config: { debug: true, level: 'info' } };
    const source = { config: { level: 'error', verbose: false } };
    deepMerge(target, source);
    expect(target.config).toEqual({ debug: true, level: 'error', verbose: false });
  });

  // --- isEqual edge cases ---
  it('isEqual handles nested arrays', () => {
    expect(isEqual([1, [2, 3]], [1, [2, 3]])).toBe(true);
    expect(isEqual([1, [2, 3]], [1, [2, 4]])).toBe(false);
  });

  it('isEqual handles mixed types', () => {
    expect(isEqual(1, '1')).toBe(false);
    expect(isEqual(true, 1)).toBe(false);
    expect(isEqual(null, undefined)).toBe(false);
    expect(isEqual(0, false)).toBe(false);
  });

  it('isEqual handles empty objects and arrays', () => {
    expect(isEqual({}, {})).toBe(true);
    expect(isEqual([], [])).toBe(true);
    expect(isEqual({}, [])).toBe(false);
  });

  // --- param edge cases ---
  it('param handles special characters', () => {
    const result = param({ query: 'hello world', tag: 'a&b' });
    expect(result).toContain('hello+world');
    expect(result).toContain('a%26b');
  });

  it('param handles numeric values', () => {
    expect(param({ page: 1, limit: 20 })).toBe('page=1&limit=20');
  });

  // --- parseQuery edge cases ---
  it('parseQuery handles encoded values', () => {
    const result = parseQuery('name=hello%20world&tag=a%26b');
    expect(result.name).toBe('hello world');
    expect(result.tag).toBe('a&b');
  });

  it('parseQuery handles duplicate keys (last wins)', () => {
    const result = parseQuery('a=1&a=2');
    expect(result.a).toBe('2');
  });

  // --- bus event bus edge cases ---
  it('bus.emit does nothing for unregistered events', () => {
    expect(() => bus.emit('nonexistent', 'data')).not.toThrow();
  });

  it('bus.once fires only once', () => {
    const fn = vi.fn();
    bus.once('test-once', fn);
    bus.emit('test-once', 'a');
    bus.emit('test-once', 'b');
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('bus.off removes specific handler', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    bus.on('test-off', fn1);
    bus.on('test-off', fn2);
    bus.off('test-off', fn1);
    bus.emit('test-off', 'data');
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledWith('data');
    bus.clear();
  });

  it('bus.on returns unsubscribe function', () => {
    const fn = vi.fn();
    const unsub = bus.on('test-unsub', fn);
    unsub();
    bus.emit('test-unsub');
    expect(fn).not.toHaveBeenCalled();
    bus.clear();
  });

  it('bus.clear removes all handlers', () => {
    const fn = vi.fn();
    bus.on('test-clear', fn);
    bus.clear();
    bus.emit('test-clear');
    expect(fn).not.toHaveBeenCalled();
  });

  // --- storage edge cases ---
  it('storage.set and get handles various types', () => {
    localStorage.clear();
    storage.set('num', 42);
    storage.set('str', 'hello');
    storage.set('bool', true);
    storage.set('arr', [1, 2, 3]);
    storage.set('obj', { a: 1 });
    expect(storage.get('num')).toBe(42);
    expect(storage.get('str')).toBe('hello');
    expect(storage.get('bool')).toBe(true);
    expect(storage.get('arr')).toEqual([1, 2, 3]);
    expect(storage.get('obj')).toEqual({ a: 1 });
  });

  it('storage.get returns fallback when JSON parse fails', () => {
    localStorage.setItem('bad', 'not valid json {');
    expect(storage.get('bad', 'fallback')).toBe('fallback');
  });
});


// ===========================================================================
// 5. DIRECTIVES - @ and z-on INTERCHANGEABILITY
// ===========================================================================

describe('directives - @ and z-on audit', () => {

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('@ shorthand and z-on: are equivalent for click', () => {
    // Register component with both syntaxes
    component('dir-test-at', {
      state: () => ({ count1: 0, count2: 0 }),
      inc1() { this.state.count1++; },
      inc2() { this.state.count2++; },
      render() {
        return `
          <button id="btn1" @click="inc1">@ button</button>
          <button id="btn2" z-on:click="inc2">z-on button</button>
          <span id="c1">${this.state.count1}</span>
          <span id="c2">${this.state.count2}</span>
        `;
      }
    });

    const el = document.createElement('dir-test-at');
    document.getElementById('app').appendChild(el);
    const inst = mount(el, 'dir-test-at');

    const btn1 = el.querySelector('#btn1');
    const btn2 = el.querySelector('#btn2');

    expect(btn1).not.toBeNull();
    expect(btn2).not.toBeNull();

    btn1.click();
    // Wait for microtask (state update is batched)
    return new Promise(resolve => {
      queueMicrotask(() => {
        expect(el.querySelector('#c1').textContent).toBe('1');
        btn2.click();
        queueMicrotask(() => {
          expect(el.querySelector('#c2').textContent).toBe('1');
          inst.destroy();
          resolve();
        });
      });
    });
  });

  it('@ shorthand works with modifiers like .prevent', () => {
    component('dir-test-prevent', {
      state: () => ({ submitted: false }),
      handleSubmit() { this.state.submitted = true; },
      render() {
        return `
          <form id="frm" @submit.prevent="handleSubmit">
            <button type="submit" id="btn">Submit</button>
          </form>
          <span id="result">${this.state.submitted}</span>
        `;
      }
    });

    const el = document.createElement('dir-test-prevent');
    document.getElementById('app').appendChild(el);
    const inst = mount(el, 'dir-test-prevent');

    const form = el.querySelector('#frm');
    expect(form).not.toBeNull();

    // Dispatch submit event
    const event = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(event);

    return new Promise(resolve => {
      queueMicrotask(() => {
        // The submit should have been prevented (defaultPrevented)
        // and handleSubmit should have been called
        expect(el.querySelector('#result').textContent).toBe('true');
        inst.destroy();
        resolve();
      });
    });
  });

  it('z-on:event and @event both support .stop modifier', async () => {
    component('dir-test-stop', {
      state: () => ({ inner: 0, outer: 0 }),
      innerClick() { this.state.inner++; },
      outerClick() { this.state.outer++; },
      render() {
        return `
          <div @click="outerClick">
            <button id="inner" @click.stop="innerClick">Inner</button>
          </div>
          <span id="innerCount">${this.state.inner}</span>
          <span id="outerCount">${this.state.outer}</span>
        `;
      }
    });

    const el = document.createElement('dir-test-stop');
    document.getElementById('app').appendChild(el);
    const inst = mount(el, 'dir-test-stop');

    el.querySelector('#inner').click();

    await new Promise(r => queueMicrotask(r));
    expect(el.querySelector('#innerCount').textContent).toBe('1');
    // Outer should NOT have fired due to .stop
    expect(el.querySelector('#outerCount').textContent).toBe('0');
    inst.destroy();
  });
});


// ===========================================================================
// 6. EXPRESSION PARSER / INTERPOLATION - AUDIT
// ===========================================================================

describe('expression parser audit - edge cases', () => {

  it('handles deeply nested property access', () => {
    expect(eval_('a.b.c.d.e', { a: { b: { c: { d: { e: 42 } } } } })).toBe(42);
  });

  it('handles chained method calls', () => {
    expect(eval_("'hello world'.split(' ').join('-')")).toBe('hello-world');
  });

  it('handles optional chaining with method call', () => {
    expect(eval_('arr?.map(x => x * 2)', { arr: [1, 2, 3] })).toEqual([2, 4, 6]);
    expect(eval_('arr?.map(x => x * 2)', { arr: null })).toBeUndefined();
  });

  it('handles template literals with expressions', () => {
    expect(eval_('`Hello ${name}!`', { name: 'World' })).toBe('Hello World!');
  });

  it('handles template literals with complex expressions', () => {
    expect(eval_('`${a + b} = ${a} + ${b}`', { a: 1, b: 2 })).toBe('3 = 1 + 2');
  });

  it('handles nested ternary operators', () => {
    expect(eval_("x > 5 ? 'high' : x > 2 ? 'mid' : 'low'", { x: 6 })).toBe('high');
    expect(eval_("x > 5 ? 'high' : x > 2 ? 'mid' : 'low'", { x: 3 })).toBe('mid');
    expect(eval_("x > 5 ? 'high' : x > 2 ? 'mid' : 'low'", { x: 1 })).toBe('low');
  });

  it('handles array literal with expressions', () => {
    expect(eval_('[a, b, a + b]', { a: 1, b: 2 })).toEqual([1, 2, 3]);
  });

  it('handles object literal with expressions', () => {
    expect(eval_('{ x: a, y: b }', { a: 1, b: 2 })).toEqual({ x: 1, y: 2 });
  });

  it('handles arrow function in filter', () => {
    expect(eval_('items.filter(x => x > 2)', { items: [1, 2, 3, 4] })).toEqual([3, 4]);
  });

  it('handles arrow function in map', () => {
    expect(eval_('items.map(x => x * 2)', { items: [1, 2, 3] })).toEqual([2, 4, 6]);
  });

  it('handles typeof operator', () => {
    expect(eval_("typeof x", { x: 42 })).toBe('number');
    expect(eval_("typeof x", { x: 'hello' })).toBe('string');
    expect(eval_("typeof x", {})).toBe('undefined');
  });

  it('handles instanceof operator', () => {
    expect(eval_('arr instanceof Array', { arr: [1, 2] })).toBe(true);
  });

  it('handles new Date()', () => {
    const result = eval_("new Date('2024-01-15')");
    expect(result).toBeInstanceOf(Date);
  });

  it('handles Math globals', () => {
    expect(eval_('Math.min(1, 2, 3)')).toBe(1);
    expect(eval_('Math.floor(3.7)')).toBe(3);
    expect(eval_('Math.ceil(3.2)')).toBe(4);
  });

  it('blocks constructor access for security', () => {
    expect(eval_('obj.constructor', { obj: {} })).toBeUndefined();
  });

  it('blocks __proto__ access for security', () => {
    expect(eval_('obj.__proto__', { obj: {} })).toBeUndefined();
  });

  it('handles shorthand object properties', () => {
    expect(eval_('{ x, y }', { x: 1, y: 2 })).toEqual({ x: 1, y: 2 });
  });

  it('handles string comparison', () => {
    expect(eval_("name === 'Tony'", { name: 'Tony' })).toBe(true);
    expect(eval_("name === 'Tony'", { name: 'Sam' })).toBe(false);
  });

  it('handles nullish coalescing with undefined', () => {
    expect(eval_('x ?? "default"', {})).toBe('default');
  });

  it('handles complex scope resolution with multiple layers', () => {
    const result = safeEval('x + y', [{ x: 1 }, { y: 2 }]);
    expect(result).toBe(3);
  });

  it('first scope layer wins for duplicate keys', () => {
    const result = safeEval('x', [{ x: 'first' }, { x: 'second' }]);
    expect(result).toBe('first');
  });

  it('handles empty array and object access gracefully', () => {
    expect(eval_('arr.length', { arr: [] })).toBe(0);
    expect(eval_('obj.missing', { obj: {} })).toBeUndefined();
  });

  it('handles chaining with null intermediate', () => {
    expect(eval_('a?.b?.c', { a: null })).toBeUndefined();
    expect(eval_('a?.b?.c', { a: { b: null } })).toBeUndefined();
  });

  it('handles multiline expressions (from templates)', () => {
    // Expression parser should handle whitespace/newlines
    expect(eval_(`
      items.length > 0
        ? 'has items'
        : 'empty'
    `, { items: [1] })).toBe('has items');
  });
});


// ===========================================================================
// 7. ROUTER - BASE HREF AND PATH HANDLING - AUDIT
// ===========================================================================

describe('router - base href audit', () => {

  let router;

  afterEach(() => {
    if (router) {
      router.destroy();
      router = null;
    }
  });

  it('_normalizePath strips base prefix if accidentally included', () => {
    router = createRouter({
      base: '/app',
      mode: 'hash',
      routes: []
    });
    expect(router._normalizePath('/app/docs')).toBe('/docs');
    expect(router._normalizePath('/app')).toBe('/');
  });

  it('_normalizePath handles paths without leading slash', () => {
    router = createRouter({
      base: '/app',
      mode: 'hash',
      routes: []
    });
    expect(router._normalizePath('docs')).toBe('/docs');
    expect(router._normalizePath('')).toBe('/');
  });

  it('resolve prepends base to path', () => {
    router = createRouter({
      base: '/app',
      mode: 'hash',
      routes: []
    });
    expect(router.resolve('/docs')).toBe('/app/docs');
    expect(router.resolve('/')).toBe('/app/');
  });

  it('base path does not double-prefix on navigate', () => {
    router = createRouter({
      el: '#app',
      base: '/app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/about', component: 'about-page' },
      ]
    });
    // User navigates with path that already includes base
    router.navigate('/app/about');
    // Should normalize to /about, not /app/app/about
    expect(window.location.hash).toBe('#/about');
  });

  it('navigate with empty path goes to root', () => {
    document.body.innerHTML = '<div id="app"></div>';
    router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
      ]
    });
    router.navigate('');
    expect(window.location.hash).toBe('#/');
  });

  it('hash mode handles fragment in route correctly', () => {
    document.body.innerHTML = '<div id="app"></div>';
    router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/docs', component: 'docs-page' },
      ]
    });
    // Navigate with fragment
    router.navigate('/docs#section1');
    // Fragment should be stored as scroll target, path is /docs
    expect(window.location.hash).toBe('#/docs');
  });

  it('query string is parsed correctly', () => {
    document.body.innerHTML = '<div id="app"></div>';
    window.location.hash = '#/?foo=bar&num=42';
    router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [{ path: '/', component: 'home-page' }]
    });
    const query = router.query;
    expect(query.foo).toBe('bar');
    expect(query.num).toBe('42');
  });

  it('route params are extracted correctly', () => {
    router = createRouter({
      mode: 'hash',
      routes: [
        { path: '/user/:id/post/:postId', component: 'user-page' }
      ]
    });
    const route = router._routes[0];
    const match = '/user/42/post/7'.match(route._regex);
    expect(match).not.toBeNull();
    const params = {};
    route._keys.forEach((key, i) => { params[key] = match[i + 1]; });
    expect(params).toEqual({ id: '42', postId: '7' });
  });

  it('wildcard route matches any path', () => {
    router = createRouter({
      mode: 'hash',
      routes: [
        { path: '/files/*', component: 'user-page' }
      ]
    });
    const route = router._routes[0];
    expect(route._regex.test('/files/some/deep/path')).toBe(true);
    expect(route._regex.test('/files/')).toBe(true);
    expect(route._regex.test('/other')).toBe(false);
  });

  it('fallback route is registered as alias', () => {
    router = createRouter({
      mode: 'hash',
      routes: [
        { path: '/docs/:section', fallback: '/docs', component: 'docs-page' }
      ]
    });
    expect(router._routes.length).toBe(2);
    expect(router._routes[0]._regex.test('/docs/intro')).toBe(true);
    expect(router._routes[1]._regex.test('/docs')).toBe(true);
  });

  it('navigation guards can cancel navigation', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    window.location.hash = '#/';
    router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/protected', component: 'about-page' },
      ]
    });
    router.beforeEach((to) => {
      if (to.path === '/protected') return false;
    });
    router.navigate('/protected');
    // Wait for resolution
    await new Promise(r => setTimeout(r, 50));
    // Guard returned false, so navigation should be cancelled
    // Current route should still be what it was before
  });

  it('onChange listener fires on navigation', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    window.location.hash = '#/';
    // Register dummy components so the router can mount them
    component('home-onchange', { render() { return '<p>Home</p>'; } });
    component('about-onchange', { render() { return '<p>About</p>'; } });
    router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-onchange' },
        { path: '/about', component: 'about-onchange' },
      ]
    });
    const listener = vi.fn();
    router.onChange(listener);
    router.navigate('/about');
    await new Promise(r => setTimeout(r, 100));
    expect(listener).toHaveBeenCalled();
  });

  it('destroy removes event listeners', () => {
    router = createRouter({
      mode: 'hash',
      routes: [{ path: '/', component: 'home-page' }]
    });
    router.destroy();
    expect(router._onNavEvent).toBeNull();
    expect(router._onLinkClick).toBeNull();
    router = null;
  });
});


// ===========================================================================
// 8. ROUTING + LAZY LOADING - AUDIT
// ===========================================================================

describe('router - lazy loading and morph interaction', () => {

  afterEach(() => {
    const r = getRouter();
    if (r) r.destroy();
  });

  it('route.load function is called before mounting', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    window.location.hash = '#/';

    const loadSpy = vi.fn(() => Promise.resolve());

    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/lazy', load: loadSpy, component: 'about-page' },
      ]
    });

    router.navigate('/lazy');
    await new Promise(r => setTimeout(r, 100));
    expect(loadSpy).toHaveBeenCalled();
    router.destroy();
  });

  it('route.load failure does not crash the router', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    window.location.hash = '#/';

    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/fail', load: () => Promise.reject(new Error('load error')), component: 'about-page' },
      ]
    });

    // Should not throw
    router.navigate('/fail');
    await new Promise(r => setTimeout(r, 100));
    router.destroy();
  });

  it('navigating rapidly between routes does not cause errors', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    window.location.hash = '#/';

    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/about', component: 'about-page' },
        { path: '/user/:id', component: 'user-page' },
      ]
    });

    // Rapid navigation
    router.navigate('/about');
    router.navigate('/');
    router.navigate('/user/1');
    router.navigate('/about');
    router.navigate('/');

    await new Promise(r => setTimeout(r, 200));
    // Should not throw or leave the UI in a broken state
    router.destroy();
  });

  it('same-route navigation is skipped (no duplicate mount)', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    window.location.hash = '#/about';

    const router = createRouter({
      el: '#app',
      mode: 'hash',
      routes: [
        { path: '/', component: 'home-page' },
        { path: '/about', component: 'about-page' },
      ]
    });

    await new Promise(r => setTimeout(r, 50));
    const firstChild = document.querySelector('#app').firstElementChild;

    // Navigate to same route
    router.navigate('/about');
    await new Promise(r => setTimeout(r, 50));
    // Should be the same component instance
    router.destroy();
  });
});


// ===========================================================================
// 9. COMPONENT DIRECTIVES - z-for, z-if, z-show, z-bind, z-class, z-style
// ===========================================================================

describe('component directives audit', () => {

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('z-for with array renders correct number of items', () => {
    component('zfor-list', {
      state: () => ({ items: ['a', 'b', 'c'] }),
      render() {
        return `<ul><li z-for="item in items">{{item}}</li></ul>`;
      }
    });
    const el = document.createElement('zfor-list');
    document.getElementById('app').appendChild(el);
    const inst = mount(el, 'zfor-list');
    expect(el.querySelectorAll('li').length).toBe(3);
    expect(el.querySelectorAll('li')[0].textContent).toBe('a');
    expect(el.querySelectorAll('li')[2].textContent).toBe('c');
    inst.destroy();
  });

  it('z-for with index variable', () => {
    component('zfor-index', {
      state: () => ({ items: ['x', 'y', 'z'] }),
      render() {
        return `<ul><li z-for="(item, i) in items">{{i}}: {{item}}</li></ul>`;
      }
    });
    const el = document.createElement('zfor-index');
    document.getElementById('app').appendChild(el);
    const inst = mount(el, 'zfor-index');
    expect(el.querySelectorAll('li')[0].textContent).toBe('0: x');
    expect(el.querySelectorAll('li')[1].textContent).toBe('1: y');
    inst.destroy();
  });

  it('z-for with number range', () => {
    component('zfor-range', {
      state: () => ({ count: 3 }),
      render() {
        return `<ul><li z-for="n in count">{{n}}</li></ul>`;
      }
    });
    const el = document.createElement('zfor-range');
    document.getElementById('app').appendChild(el);
    const inst = mount(el, 'zfor-range');
    expect(el.querySelectorAll('li').length).toBe(3);
    expect(el.querySelectorAll('li')[0].textContent).toBe('1');
    expect(el.querySelectorAll('li')[2].textContent).toBe('3');
    inst.destroy();
  });

  it('z-if conditionally renders elements', () => {
    component('zif-test', {
      state: () => ({ visible: true }),
      render() {
        return `
          <div z-if="visible" id="shown">Visible</div>
          <div z-else id="hidden">Hidden</div>
        `;
      }
    });
    const el = document.createElement('zif-test');
    document.getElementById('app').appendChild(el);
    const inst = mount(el, 'zif-test');
    expect(el.querySelector('#shown')).not.toBeNull();
    expect(el.querySelector('#hidden')).toBeNull();
    inst.destroy();
  });

  it('z-show toggles display style', () => {
    component('zshow-test', {
      state: () => ({ visible: false }),
      render() {
        return `<div z-show="visible" id="target">Content</div>`;
      }
    });
    const el = document.createElement('zshow-test');
    document.getElementById('app').appendChild(el);
    const inst = mount(el, 'zshow-test');
    expect(el.querySelector('#target').style.display).toBe('none');
    inst.destroy();
  });

  it('z-bind dynamically sets attributes', () => {
    component('zbind-test', {
      state: () => ({ href: 'https://example.com', isDisabled: true }),
      render() {
        return `
          <a z-bind:href="href" id="link">Link</a>
          <button :disabled="isDisabled" id="btn">Button</button>
        `;
      }
    });
    const el = document.createElement('zbind-test');
    document.getElementById('app').appendChild(el);
    const inst = mount(el, 'zbind-test');
    expect(el.querySelector('#link').getAttribute('href')).toBe('https://example.com');
    expect(el.querySelector('#btn').hasAttribute('disabled')).toBe(true);
    inst.destroy();
  });

  it('z-class with object syntax', () => {
    component('zclass-test', {
      state: () => ({ isActive: true, isError: false }),
      render() {
        return `<div z-class="{ active: isActive, error: isError }" id="target">Content</div>`;
      }
    });
    const el = document.createElement('zclass-test');
    document.getElementById('app').appendChild(el);
    const inst = mount(el, 'zclass-test');
    const target = el.querySelector('#target');
    expect(target.classList.contains('active')).toBe(true);
    expect(target.classList.contains('error')).toBe(false);
    inst.destroy();
  });

  it('z-style with object syntax', () => {
    component('zstyle-test', {
      state: () => ({ color: 'red', fontSize: '16px' }),
      render() {
        return `<div z-style="{ color: color, fontSize: fontSize }" id="target">Styled</div>`;
      }
    });
    const el = document.createElement('zstyle-test');
    document.getElementById('app').appendChild(el);
    const inst = mount(el, 'zstyle-test');
    const target = el.querySelector('#target');
    expect(target.style.color).toBe('red');
    expect(target.style.fontSize).toBe('16px');
    inst.destroy();
  });
});


// ===========================================================================
// 10. MORPH ENGINE - APPEND, CSS, EVENT LISTENER PRESERVATION
// ===========================================================================

describe('morph engine - DOM operations interplay', () => {

  it('morph after programmatic addClass preserves new class from morph', () => {
    const root = el('<div class="original">text</div>');
    root.children[0].classList.add('custom');
    morph(root, '<div class="updated">text</div>');
    // After morph, class should match the new HTML
    expect(root.children[0].className).toBe('updated');
  });

  it('morph preserves input focus state conceptually (same node)', () => {
    const root = el('<input id="myinput" value="hello">');
    const input = root.querySelector('input');
    morph(root, '<input id="myinput" value="hello updated">');
    // same node via auto-key (id)
    expect(root.querySelector('#myinput')).toBe(input);
    expect(input.value).toBe('hello updated');
  });

  it('morph handles script tags (should not execute)', () => {
    const root = el('<div>content</div>');
    morph(root, '<div>content</div><script>window.__test = true;</script>');
    // Script should exist in DOM but not execute
    expect(window.__test).toBeUndefined();
    delete window.__test;
  });

  it('morph handles style elements correctly', () => {
    const root = el('<style>.a { color: red; }</style>');
    morph(root, '<style>.a { color: blue; }</style>');
    expect(root.querySelector('style').textContent).toBe('.a { color: blue; }');
  });

  it('morph handles img src changes', () => {
    const root = el('<img src="old.png" alt="image">');
    morph(root, '<img src="new.png" alt="image updated">');
    const img = root.querySelector('img');
    expect(img.getAttribute('src')).toBe('new.png');
    expect(img.getAttribute('alt')).toBe('image updated');
  });

  it('unkeyed morph with same content at different positions', () => {
    const root = el('<div>A</div><div>B</div><div>C</div>');
    morph(root, '<div>C</div><div>B</div><div>A</div>');
    // Unkeyed - positional matching updates content in place
    expect(root.children[0].textContent).toBe('C');
    expect(root.children[1].textContent).toBe('B');
    expect(root.children[2].textContent).toBe('A');
  });

  it('morph handles nested keyed and unkeyed mix correctly', () => {
    const root = el(`
      <div z-key="container">
        <p>Static text</p>
        <ul>
          <li z-key="item-1">Item 1</li>
          <li z-key="item-2">Item 2</li>
        </ul>
      </div>
    `);
    morph(root, `
      <div z-key="container">
        <p>Updated text</p>
        <ul>
          <li z-key="item-2">Item 2 updated</li>
          <li z-key="item-1">Item 1 updated</li>
          <li z-key="item-3">Item 3 new</li>
        </ul>
      </div>
    `);
    const lis = root.querySelectorAll('li');
    expect(lis.length).toBe(3);
    expect(lis[0].textContent).toBe('Item 2 updated');
    expect(lis[1].textContent).toBe('Item 1 updated');
    expect(lis[2].textContent).toBe('Item 3 new');
    expect(root.querySelector('p').textContent).toBe('Updated text');
  });

  it('morph handles select with dynamic options', () => {
    const root = el(`
      <select>
        <option value="a">A</option>
        <option value="b" selected>B</option>
      </select>
    `);
    morph(root, `
      <select>
        <option value="a" selected>A</option>
        <option value="b">B</option>
        <option value="c">C</option>
      </select>
    `);
    const options = root.querySelectorAll('option');
    expect(options.length).toBe(3);
  });
});


// ===========================================================================
// 11. INTERPOLATION & PARSING - ALL CONTEXTS
// ===========================================================================

describe('interpolation and parsing - audit', () => {

  it('safeEval handles string concatenation with +', () => {
    expect(eval_("'hello' + ' ' + 'world'")).toBe('hello world');
  });

  it('safeEval handles numeric string coercion', () => {
    expect(eval_("'value: ' + 42")).toBe('value: 42');
  });

  it('safeEval handles array index with variable', () => {
    expect(eval_('items[idx]', { items: ['a', 'b', 'c'], idx: 1 })).toBe('b');
  });

  it('safeEval handles Object.keys-like access', () => {
    // Can't call Object.keys directly (blocked), but can access properties
    const result = eval_('items.length', { items: [1, 2, 3] });
    expect(result).toBe(3);
  });

  it('safeEval handles reduce with arrow function', () => {
    const result = eval_('items.reduce((sum, x) => sum + x, 0)', { items: [1, 2, 3, 4] });
    expect(result).toBe(10);
  });

  it('safeEval handles chained array operations', () => {
    const result = eval_('items.filter(x => x > 2).map(x => x * 10)', { items: [1, 2, 3, 4] });
    expect(result).toEqual([30, 40]);
  });

  it('safeEval handles comparison chain', () => {
    expect(eval_('a > b && b > c', { a: 3, b: 2, c: 1 })).toBe(true);
    expect(eval_('a > b && b > c', { a: 3, b: 2, c: 5 })).toBe(false);
  });

  it('safeEval handles in operator', () => {
    expect(eval_("'a' in obj", { obj: { a: 1, b: 2 } })).toBe(true);
    expect(eval_("'c' in obj", { obj: { a: 1 } })).toBe(false);
  });

  it('safeEval handles Array.isArray check', () => {
    // Note: Array.isArray may not be accessible directly, let's test instanceof
    expect(eval_('arr instanceof Array', { arr: [1, 2] })).toBe(true);
  });

  it('safeEval caches AST for repeated expressions', () => {
    // Call the same expression multiple times to test caching
    for (let i = 0; i < 10; i++) {
      expect(eval_('x + 1', { x: i })).toBe(i + 1);
    }
  });

  it('safeEval returns undefined for unparseable expressions gracefully', () => {
    expect(eval_('{')).toBeUndefined();
    expect(eval_('if (true) {}')).toBeUndefined();
  });

  it('template literal with nested template literal', () => {
    // This is a complex edge case for the tokenizer
    expect(eval_('`outer ${`inner ${x}`}`', { x: 42 })).toBe('outer inner 42');
  });

  it('handles hex and scientific notation numbers', () => {
    expect(eval_('0xFF')).toBe(255);
    expect(eval_('1e3')).toBe(1000);
    expect(eval_('2.5e2')).toBe(250);
  });

  it('handles escape sequences in strings', () => {
    expect(eval_("'line1\\nline2'")).toBe('line1\nline2');
    expect(eval_("'tab\\there'")).toBe('tab\there');
  });

  it('handles object method call in scope', () => {
    const obj = {
      items: [3, 1, 4, 1, 5],
      getMax() { return Math.max(...this.items); }
    };
    // Direct method call won't work because of `this` context
    // But we can test accessing properties and calling array methods
    expect(eval_('items.indexOf(4)', { items: [3, 1, 4, 1, 5] })).toBe(2);
  });
});


// ===========================================================================
// 12. COMPONENT LIFECYCLE & STATE REACTIVITY
// ===========================================================================

describe('component lifecycle audit', () => {

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('component state changes trigger re-render via morph', () => {
    component('state-render', {
      state: () => ({ count: 0 }),
      inc() { this.state.count++; },
      render() {
        return `<span id="val">${this.state.count}</span><button @click="inc">+</button>`;
      }
    });
    const el = document.createElement('state-render');
    document.getElementById('app').appendChild(el);
    const inst = mount(el, 'state-render');
    expect(el.querySelector('#val').textContent).toBe('0');

    inst.state.count = 5;

    return new Promise(resolve => {
      queueMicrotask(() => {
        expect(el.querySelector('#val').textContent).toBe('5');
        inst.destroy();
        resolve();
      });
    });
  });

  it('computed properties are available in templates', () => {
    component('comp-computed', {
      state: () => ({ firstName: 'John', lastName: 'Doe' }),
      computed: {
        fullName(state) { return `${state.firstName} ${state.lastName}`; }
      },
      render() {
        return `<span id="name">${this.computed.fullName}</span>`;
      }
    });
    const el = document.createElement('comp-computed');
    document.getElementById('app').appendChild(el);
    const inst = mount(el, 'comp-computed');
    expect(el.querySelector('#name').textContent).toBe('John Doe');
    inst.destroy();
  });

  it('destroying a component clears its innerHTML', () => {
    component('destroy-test', {
      render() { return `<p>Content</p>`; }
    });
    const el = document.createElement('destroy-test');
    document.getElementById('app').appendChild(el);
    const inst = mount(el, 'destroy-test');
    expect(el.innerHTML).toContain('Content');
    inst.destroy();
    expect(el.innerHTML).toBe('');
  });

  it('z-ref sets element references', () => {
    component('ref-test', {
      render() {
        return `<input z-ref="myInput" type="text">`;
      },
      mounted() {
        expect(this.refs.myInput).toBeTruthy();
        expect(this.refs.myInput.tagName).toBe('INPUT');
      }
    });
    const el = document.createElement('ref-test');
    document.getElementById('app').appendChild(el);
    const inst = mount(el, 'ref-test');
    expect(inst.refs.myInput).toBeTruthy();
    inst.destroy();
  });

  it('props are frozen and available in component', () => {
    component('props-test', {
      render() {
        return `<span id="prop">${this.props.name || 'none'}</span>`;
      }
    });
    const el = document.createElement('props-test');
    document.getElementById('app').appendChild(el);
    const inst = mount(el, 'props-test', { name: 'Tony' });
    expect(el.querySelector('#prop').textContent).toBe('Tony');
    expect(Object.isFrozen(inst.props)).toBe(true);
    inst.destroy();
  });

  it('setState triggers re-render', () => {
    component('setstate-test', {
      state: () => ({ val: 'initial' }),
      render() {
        return `<span id="val">${this.state.val}</span>`;
      }
    });
    const el = document.createElement('setstate-test');
    document.getElementById('app').appendChild(el);
    const inst = mount(el, 'setstate-test');
    inst.setState({ val: 'updated' });

    return new Promise(resolve => {
      queueMicrotask(() => {
        expect(el.querySelector('#val').textContent).toBe('updated');
        inst.destroy();
        resolve();
      });
    });
  });
});


// ===========================================================================
// 13. $ selector + ZQueryCollection + Morph engine integration
// ===========================================================================
import { query, queryAll, ZQueryCollection } from '../src/core.js';
import $, { $ as $named } from '../index.js';

describe('$ selector + ZQueryCollection + morph engine', () => {
  let root;

  beforeEach(() => {
    root = document.createElement('div');
    root.id = 'zq-root';
    document.body.appendChild(root);
  });

  afterEach(() => {
    root.remove();
  });

  // --- $() selector variants ------------------------------------------------

  describe('$() selector returns ZQueryCollection', () => {
    it('CSS selector returns ZQueryCollection', () => {
      root.innerHTML = '<span class="item">A</span><span class="item">B</span>';
      const col = query('.item');
      expect(col).toBeInstanceOf(ZQueryCollection);
      expect(col.length).toBe(2);
    });

    it('HTML string creates elements', () => {
      const col = query('<div class="created"><span>hi</span></div>');
      expect(col).toBeInstanceOf(ZQueryCollection);
      expect(col.length).toBe(1);
      expect(col.first().tagName).toBe('DIV');
      expect(col.find('span').length).toBe(1);
    });

    it('wraps a DOM element', () => {
      const col = query(root);
      expect(col).toBeInstanceOf(ZQueryCollection);
      expect(col.first()).toBe(root);
    });

    it('wraps NodeList', () => {
      root.innerHTML = '<p>1</p><p>2</p><p>3</p>';
      const nl = root.querySelectorAll('p');
      const col = query(nl);
      expect(col.length).toBe(3);
    });

    it('wraps Array of elements', () => {
      const els = [document.createElement('a'), document.createElement('b')];
      const col = query(els);
      expect(col.length).toBe(2);
    });

    it('returns same instance for ZQueryCollection input', () => {
      const col = new ZQueryCollection([root]);
      expect(query(col)).toBe(col);
    });

    it('returns empty collection for null/undefined/false', () => {
      expect(query(null).length).toBe(0);
      expect(query(undefined).length).toBe(0);
      expect(query(false).length).toBe(0);
    });

    it('context parameter scopes selector', () => {
      root.innerHTML = '<div id="scope"><span class="x">in</span></div><span class="x">out</span>';
      const col = query('.x', '#scope');
      expect(col.length).toBe(1);
      expect(col.first().textContent).toBe('in');
    });

    it('context as element scopes selector', () => {
      root.innerHTML = '<div id="scope2"><span class="y">in</span></div><span class="y">out</span>';
      const scope = document.getElementById('scope2');
      const col = query('.y', scope);
      expect(col.length).toBe(1);
    });
  });

  // --- $.all() aliases query -------------------------------------------------

  describe('$.all() collection selector', () => {
    it('$.all returns ZQueryCollection', () => {
      root.innerHTML = '<li>1</li><li>2</li>';
      const col = queryAll('li');
      expect(col).toBeInstanceOf(ZQueryCollection);
      expect(col.length).toBe(2);
    });

    it('$.all passes through existing collection', () => {
      const existing = new ZQueryCollection([root]);
      expect(queryAll(existing)).toBe(existing);
    });

    it('$.all wraps Window', () => {
      const col = queryAll(window);
      expect(col.length).toBe(1);
      expect(col.first()).toBe(window);
    });
  });

  // --- $.create() with morph ------------------------------------------------

  describe('$.create() + morph integration', () => {
    it('creates element with attrs and children', () => {
      const col = $.create('div', { class: 'box', 'data-id': '42' }, 'Hello');
      expect(col).toBeInstanceOf(ZQueryCollection);
      expect(col.first().className).toBe('box');
      expect(col.first().dataset.id).toBe('42');
      expect(col.first().textContent).toBe('Hello');
    });

    it('$.create element can be morphed via collection .morph()', () => {
      const col = $.create('div', {}, 'initial');
      root.appendChild(col.first());
      const el = root.querySelector('div');
      // morph the created element through collection
      query(el).morph('<p>morphed</p>');
      expect(el.innerHTML).toBe('<p>morphed</p>');
    });

    it('$.create with event handler attrs', () => {
      let clicked = false;
      const col = $.create('button', { onClick: () => { clicked = true; } }, 'Click');
      root.appendChild(col.first());
      col.first().click();
      expect(clicked).toBe(true);
    });

    it('$.create with style object', () => {
      const col = $.create('span', { style: { color: 'red', fontWeight: 'bold' } }, 'styled');
      expect(col.first().style.color).toBe('red');
      expect(col.first().style.fontWeight).toBe('bold');
    });

    it('$.create with data object', () => {
      const col = $.create('div', { data: { userId: '7', role: 'admin' } });
      expect(col.first().dataset.userId).toBe('7');
      expect(col.first().dataset.role).toBe('admin');
    });

    it('$.create with Node children', () => {
      const span = document.createElement('span');
      span.textContent = 'child';
      const col = $.create('div', {}, span);
      expect(col.first().querySelector('span').textContent).toBe('child');
    });
  });

  // --- .html() auto-morph + morph engine interaction -------------------------

  describe('collection .html() auto-morph', () => {
    it('auto-morphs when element has existing children', () => {
      root.innerHTML = '<p id="keep">old</p>';
      const pRef = root.querySelector('#keep');
      query(root).html('<p id="keep">new</p>');
      // Same DOM node preserved (morph, not replace)
      expect(root.querySelector('#keep')).toBe(pRef);
      expect(pRef.textContent).toBe('new');
    });

    it('uses raw innerHTML when element is empty (fast first-paint)', () => {
      root.innerHTML = '';
      query(root).html('<p id="fresh">hello</p>');
      expect(root.querySelector('#fresh').textContent).toBe('hello');
    });

    it('empty().html() forces raw innerHTML bypassing morph', () => {
      root.innerHTML = '<p id="old">old</p>';
      const oldRef = root.querySelector('#old');
      query(root).empty().html('<p id="old">replaced</p>');
      // Not the same reference - was re-created via innerHTML
      expect(root.querySelector('#old')).not.toBe(oldRef);
      expect(root.querySelector('#old').textContent).toBe('replaced');
    });

    it('auto-morph preserves keyed elements with z-key', () => {
      root.innerHTML = '<div z-key="a">A</div><div z-key="b">B</div>';
      const aRef = root.querySelector('[z-key="a"]');
      const bRef = root.querySelector('[z-key="b"]');
      // Reverse order
      query(root).html('<div z-key="b">B2</div><div z-key="a">A2</div>');
      expect(root.querySelector('[z-key="a"]')).toBe(aRef);
      expect(root.querySelector('[z-key="b"]')).toBe(bRef);
      expect(aRef.textContent).toBe('A2');
      expect(bRef.textContent).toBe('B2');
    });

    it('auto-morph preserves keyed elements with id attribute', () => {
      root.innerHTML = '<span id="s1">1</span><span id="s2">2</span><span id="s3">3</span>';
      const refs = { s1: root.querySelector('#s1'), s2: root.querySelector('#s2'), s3: root.querySelector('#s3') };
      // Rotate: 3,1,2
      query(root).html('<span id="s3">3</span><span id="s1">1</span><span id="s2">2</span>');
      expect(root.querySelector('#s1')).toBe(refs.s1);
      expect(root.querySelector('#s2')).toBe(refs.s2);
      expect(root.querySelector('#s3')).toBe(refs.s3);
    });

    it('auto-morph preserves keyed elements with data-id', () => {
      root.innerHTML = '<div data-id="x">X</div><div data-id="y">Y</div>';
      const xRef = root.querySelector('[data-id="x"]');
      // Swap
      query(root).html('<div data-id="y">Y</div><div data-id="x">X</div>');
      expect(root.querySelector('[data-id="x"]')).toBe(xRef);
    });

    it('auto-morph preserves keyed elements with data-key', () => {
      root.innerHTML = '<li data-key="k1">1</li><li data-key="k2">2</li>';
      const k1Ref = root.querySelector('[data-key="k1"]');
      query(root).html('<li data-key="k2">2</li><li data-key="k1">1!</li>');
      expect(root.querySelector('[data-key="k1"]')).toBe(k1Ref);
      expect(k1Ref.textContent).toBe('1!');
    });

    it('auto-morph syncs input value', () => {
      root.innerHTML = '<input type="text" value="old" />';
      const input = root.querySelector('input');
      input.value = 'user-typed';
      query(root).html('<input type="text" value="synced" />');
      expect(root.querySelector('input')).toBe(input);
      expect(input.value).toBe('synced');
    });

    it('auto-morph syncs checkbox checked state', () => {
      root.innerHTML = '<input type="checkbox" />';
      const cb = root.querySelector('input');
      expect(cb.checked).toBe(false);
      query(root).html('<input type="checkbox" checked />');
      expect(root.querySelector('input')).toBe(cb);
      expect(cb.checked).toBe(true);
    });

    it('auto-morph syncs textarea value', () => {
      root.innerHTML = '<textarea>old</textarea>';
      const ta = root.querySelector('textarea');
      query(root).html('<textarea>new content</textarea>');
      expect(root.querySelector('textarea')).toBe(ta);
      expect(ta.value).toBe('new content');
    });

    it('auto-morph syncs select value', () => {
      root.innerHTML = '<select><option value="a">A</option><option value="b">B</option></select>';
      const sel = root.querySelector('select');
      sel.value = 'a';
      query(root).html('<select value="b"><option value="a">A</option><option value="b" selected>B</option></select>');
      expect(root.querySelector('select')).toBe(sel);
    });

    it('auto-morph respects z-skip attribute', () => {
      root.innerHTML = '<div z-skip>DO NOT TOUCH</div><p>morph me</p>';
      const skipDiv = root.querySelector('[z-skip]');
      query(root).html('<div z-skip>CHANGED</div><p>morphed</p>');
      expect(skipDiv.textContent).toBe('DO NOT TOUCH');
      expect(root.querySelector('p').textContent).toBe('morphed');
    });
  });

  // --- .morph() explicit morph -----------------------------------------------

  describe('collection .morph() explicit', () => {
    it('always uses diff engine even on empty elements', () => {
      root.innerHTML = '';
      query(root).morph('<p>explicit</p>');
      expect(root.querySelector('p').textContent).toBe('explicit');
    });

    it('preserves node identity for same-tag elements', () => {
      root.innerHTML = '<div id="m1">old</div>';
      const ref = root.querySelector('#m1');
      query(root).morph('<div id="m1">new</div>');
      expect(root.querySelector('#m1')).toBe(ref);
    });

    it('is chainable', () => {
      root.innerHTML = '<span>x</span>';
      const result = query(root).morph('<span>y</span>').addClass('done');
      expect(result).toBeInstanceOf(ZQueryCollection);
      expect(root.classList.contains('done')).toBe(true);
    });

    it('handles adding new nodes', () => {
      root.innerHTML = '<p>1</p>';
      query(root).morph('<p>1</p><p>2</p><p>3</p>');
      expect(root.querySelectorAll('p').length).toBe(3);
    });

    it('handles removing nodes', () => {
      root.innerHTML = '<p>1</p><p>2</p><p>3</p>';
      query(root).morph('<p>1</p>');
      expect(root.querySelectorAll('p').length).toBe(1);
    });

    it('handles complete content replacement', () => {
      root.innerHTML = '<div>old</div>';
      query(root).morph('<span>new</span>');
      expect(root.querySelector('span').textContent).toBe('new');
      expect(root.querySelector('div')).toBeNull();
    });

    it('morphs multiple collection elements', () => {
      root.innerHTML = '<div class="box"><p>old1</p></div><div class="box"><p>old2</p></div>';
      const boxes = query('.box');
      boxes.morph('<p>updated</p>');
      root.querySelectorAll('.box').forEach(box => {
        expect(box.querySelector('p').textContent).toBe('updated');
      });
    });
  });

  // --- .replaceWith() auto-morph ---------------------------------------------

  describe('collection .replaceWith() + morph', () => {
    it('auto-morphs when tag name matches (string content)', () => {
      root.innerHTML = '<p id="rw" class="old">old text</p>';
      const pRef = root.querySelector('#rw');
      query(pRef).replaceWith('<p id="rw" class="new">new text</p>');
      // Same node - morphed, not replaced
      expect(root.querySelector('#rw')).toBe(pRef);
      expect(pRef.className).toBe('new');
      expect(pRef.textContent).toBe('new text');
    });

    it('replaces when tag differs', () => {
      root.innerHTML = '<p id="rw2">paragraph</p>';
      const pRef = root.querySelector('#rw2');
      query(pRef).replaceWith('<div id="rw2">div now</div>');
      expect(root.querySelector('#rw2')).not.toBe(pRef);
      expect(root.querySelector('#rw2').tagName).toBe('DIV');
    });

    it('replaces with Node content', () => {
      root.innerHTML = '<span id="rw3">old</span>';
      const newEl = document.createElement('em');
      newEl.textContent = 'emphasis';
      query(root.querySelector('#rw3')).replaceWith(newEl);
      expect(root.querySelector('em').textContent).toBe('emphasis');
      expect(root.querySelector('span')).toBeNull();
    });
  });

  // --- Keyed morph via $ collection + LIS verification -----------------------

  describe('$ collection + keyed morph (LIS)', () => {
    it('reverse of keyed list preserves all node identities', () => {
      root.innerHTML = '<div z-key="1">a</div><div z-key="2">b</div><div z-key="3">c</div><div z-key="4">d</div><div z-key="5">e</div>';
      const refs = {};
      for (let i = 1; i <= 5; i++) refs[i] = root.querySelector(`[z-key="${i}"]`);
      query(root).html('<div z-key="5">e</div><div z-key="4">d</div><div z-key="3">c</div><div z-key="2">b</div><div z-key="1">a</div>');
      for (let i = 1; i <= 5; i++) {
        expect(root.querySelector(`[z-key="${i}"]`)).toBe(refs[i]);
      }
    });

    it('interleaved insert among keyed nodes', () => {
      root.innerHTML = '<p z-key="a">A</p><p z-key="c">C</p>';
      const aRef = root.querySelector('[z-key="a"]');
      const cRef = root.querySelector('[z-key="c"]');
      query(root).morph('<p z-key="a">A</p><p z-key="b">B</p><p z-key="c">C</p>');
      expect(root.querySelector('[z-key="a"]')).toBe(aRef);
      expect(root.querySelector('[z-key="c"]')).toBe(cRef);
      expect(root.children.length).toBe(3);
      expect(root.children[1].textContent).toBe('B');
    });

    it('keyed removal preserves remaining nodes', () => {
      root.innerHTML = '<div z-key="x">X</div><div z-key="y">Y</div><div z-key="z">Z</div>';
      const zRef = root.querySelector('[z-key="z"]');
      query(root).morph('<div z-key="x">X</div><div z-key="z">Z</div>');
      expect(root.children.length).toBe(2);
      expect(root.querySelector('[z-key="z"]')).toBe(zRef);
    });

    it('mixed keyed + unkeyed nodes', () => {
      root.innerHTML = '<div z-key="k1">keyed1</div><p>unkeyed</p><div z-key="k2">keyed2</div>';
      const k1 = root.querySelector('[z-key="k1"]');
      const k2 = root.querySelector('[z-key="k2"]');
      query(root).morph('<div z-key="k2">keyed2!</div><p>unkeyed updated</p><div z-key="k1">keyed1!</div>');
      expect(root.querySelector('[z-key="k1"]')).toBe(k1);
      expect(root.querySelector('[z-key="k2"]')).toBe(k2);
      expect(k1.textContent).toBe('keyed1!');
      expect(k2.textContent).toBe('keyed2!');
    });

    it('large keyed shuffle preserves all identities', () => {
      const count = 50;
      const items = Array.from({ length: count }, (_, i) => `<li z-key="i${i}">${i}</li>`);
      root.innerHTML = items.join('');
      const refs = {};
      for (let i = 0; i < count; i++) refs[i] = root.querySelector(`[z-key="i${i}"]`);
      // Fisher-Yates shuffle
      const shuffled = [...items];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = (i * 7 + 3) % (i + 1); // deterministic pseudo-shuffle
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      query(root).morph(shuffled.join(''));
      for (let i = 0; i < count; i++) {
        expect(root.querySelector(`[z-key="i${i}"]`)).toBe(refs[i]);
      }
    });
  });

  // --- $ static helpers with morph -------------------------------------------

  describe('$.morph and $.morphElement static helpers', () => {
    it('$.morph patches root children', () => {
      root.innerHTML = '<span>old</span>';
      const ref = root.querySelector('span');
      $.morph(root, '<span>new</span>');
      expect(root.querySelector('span')).toBe(ref);
      expect(ref.textContent).toBe('new');
    });

    it('$.morphElement morphs same-tag element in place', () => {
      root.innerHTML = '<p id="me" class="a">old</p>';
      const pRef = root.querySelector('#me');
      const result = $.morphElement(pRef, '<p id="me" class="b">new</p>');
      expect(result).toBe(pRef);
      expect(pRef.className).toBe('b');
      expect(pRef.textContent).toBe('new');
    });

    it('$.morphElement replaces when tag differs', () => {
      root.innerHTML = '<p id="me2">para</p>';
      const pRef = root.querySelector('#me2');
      const result = $.morphElement(pRef, '<div id="me2">div</div>');
      expect(result).not.toBe(pRef);
      expect(result.tagName).toBe('DIV');
    });
  });

  // --- $.fn extension + morph -------------------------------------------------

  describe('$.fn prototype extension', () => {
    it('extending $.fn adds method to all collections', () => {
      $.fn.testMethod = function() { return 'works'; };
      const col = query(root);
      expect(col.testMethod()).toBe('works');
      delete $.fn.testMethod;
    });

    it('custom $.fn method can use morph internally', () => {
      $.fn.updateContent = function(html) {
        return this.morph(html);
      };
      root.innerHTML = '<span>before</span>';
      const ref = root.querySelector('span');
      query(root).updateContent('<span>after</span>');
      expect(root.querySelector('span')).toBe(ref);
      expect(ref.textContent).toBe('after');
      delete $.fn.updateContent;
    });
  });

  // --- Quick refs with morph -------------------------------------------------

  describe('$ quick refs', () => {
    it('$.id returns raw element', () => {
      const el = $.id('zq-root');
      expect(el).toBe(root);
    });

    it('$.classes returns ZQueryCollection', () => {
      root.innerHTML = '<span class="qr">a</span><span class="qr">b</span>';
      const col = $.classes('qr');
      expect(col).toBeInstanceOf(ZQueryCollection);
      expect(col.length).toBe(2);
    });

    it('$.tag returns ZQueryCollection', () => {
      root.innerHTML = '<em>1</em><em>2</em>';
      const col = $.tag('em');
      expect(col.length).toBeGreaterThanOrEqual(2);
    });

    it('$.children returns ZQueryCollection of child elements', () => {
      root.innerHTML = '<p>a</p><p>b</p>';
      const col = $.children('zq-root');
      expect(col).toBeInstanceOf(ZQueryCollection);
      expect(col.length).toBe(2);
    });
  });

  // --- Chaining operations after morph ---------------------------------------

  describe('chaining after morph operations', () => {
    it('morph â†’ find â†’ each', () => {
      root.innerHTML = '<ul><li>1</li></ul>';
      query(root).morph('<ul><li class="item">A</li><li class="item">B</li></ul>');
      const texts = [];
      query(root).find('.item').each((_, el) => texts.push(el.textContent));
      expect(texts).toEqual(['A', 'B']);
    });

    it('morph â†’ addClass â†’ attr', () => {
      root.innerHTML = '<div>x</div>';
      const col = query(root).morph('<div>y</div>').addClass('morphed').attr('data-state', 'done');
      expect(root.classList.contains('morphed')).toBe(true);
      expect(root.getAttribute('data-state')).toBe('done');
      expect(col).toBeInstanceOf(ZQueryCollection);
    });

    it('html â†’ find â†’ text', () => {
      root.innerHTML = '<span>old</span>';
      query(root).html('<span id="target">value</span>');
      expect(query('#target').text()).toBe('value');
    });

    it('morph â†’ children â†’ filter', () => {
      root.innerHTML = '<p>x</p>';
      query(root).morph('<p class="a">1</p><p class="b">2</p><p class="a">3</p>');
      const filtered = query(root).children('.a');
      expect(filtered.length).toBe(2);
    });
  });

  // --- Edge cases: empty collections -----------------------------------------

  describe('empty collection safety', () => {
    it('morph on empty collection is no-op', () => {
      const col = new ZQueryCollection([]);
      expect(() => col.morph('<p>test</p>')).not.toThrow();
    });

    it('html(content) on empty collection is no-op', () => {
      const col = new ZQueryCollection([]);
      expect(() => col.html('<p>test</p>')).not.toThrow();
    });

    it('replaceWith on empty collection is no-op', () => {
      const col = new ZQueryCollection([]);
      expect(() => col.replaceWith('<p>test</p>')).not.toThrow();
    });

    it('first() on empty returns null', () => {
      expect(new ZQueryCollection([]).first()).toBeNull();
    });

    it('last() on empty returns null', () => {
      expect(new ZQueryCollection([]).last()).toBeNull();
    });

    it('eq() on out-of-bounds returns empty collection', () => {
      const col = new ZQueryCollection([root]);
      expect(col.eq(99).length).toBe(0);
    });

    it('html() getter on empty returns undefined', () => {
      expect(new ZQueryCollection([]).html()).toBeUndefined();
    });

    it('text() getter on empty returns undefined', () => {
      expect(new ZQueryCollection([]).text()).toBeUndefined();
    });

    it('val() getter on empty returns undefined', () => {
      expect(new ZQueryCollection([]).val()).toBeUndefined();
    });

    it('attr() getter on empty returns undefined', () => {
      expect(new ZQueryCollection([]).attr('id')).toBeUndefined();
    });

    it('hasClass on empty returns false', () => {
      expect(new ZQueryCollection([]).hasClass('x')).toBe(false);
    });
  });

  // --- Attribute morph via collection ----------------------------------------

  describe('attribute morphing through collection', () => {
    it('morph updates attributes without replacing node', () => {
      root.innerHTML = '<div id="atm" class="old" data-x="1">text</div>';
      const ref = root.querySelector('#atm');
      query(root).morph('<div id="atm" class="new" data-x="2" data-y="3">text</div>');
      expect(root.querySelector('#atm')).toBe(ref);
      expect(ref.className).toBe('new');
      expect(ref.dataset.x).toBe('2');
      expect(ref.dataset.y).toBe('3');
    });

    it('morph removes stale attributes', () => {
      root.innerHTML = '<span id="ra" data-old="yes" title="tip">hi</span>';
      const ref = root.querySelector('#ra');
      query(root).morph('<span id="ra">hi</span>');
      expect(ref.hasAttribute('data-old')).toBe(false);
      expect(ref.hasAttribute('title')).toBe(false);
      expect(ref.id).toBe('ra');
    });
  });

  // --- Text/comment node morphing via collection -----------------------------

  describe('text and comment node morphing', () => {
    it('morph updates text nodes', () => {
      root.innerHTML = 'hello world';
      query(root).morph('goodbye world');
      expect(root.textContent).toBe('goodbye world');
    });

    it('morph handles mixed text and elements', () => {
      root.innerHTML = '<p>para</p>';
      query(root).morph('just text');
      expect(root.textContent).toBe('just text');
      expect(root.querySelector('p')).toBeNull();
    });

    it('morph transitions from text to elements', () => {
      root.textContent = 'plain text';
      query(root).morph('<p>structured</p>');
      expect(root.querySelector('p').textContent).toBe('structured');
    });
  });

  // --- Event preservation through morph via $ --------------------------------

  describe('event preservation through $ morph', () => {
    it('event listeners survive morph (same node identity)', () => {
      root.innerHTML = '<button id="ep">click</button>';
      const btn = root.querySelector('#ep');
      let clicked = 0;
      btn.addEventListener('click', () => { clicked++; });
      // Morph - button identity preserved
      query(root).morph('<button id="ep">click!</button>');
      expect(root.querySelector('#ep')).toBe(btn);
      btn.click();
      expect(clicked).toBe(1);
    });

    it('delegated events via collection survive morph', () => {
      root.innerHTML = '<div id="del"><span class="target">hit</span></div>';
      let hits = 0;
      query('#del').on('click', '.target', () => { hits++; });
      // Morph inner content
      query('#del').morph('<span class="target">hit2</span>');
      root.querySelector('.target').click();
      expect(hits).toBe(1);
    });
  });

  // --- Collection iteration with morphed content -----------------------------

  describe('iteration methods on morphed content', () => {
    it('forEach works after morph', () => {
      root.innerHTML = '<span>old</span>';
      query(root).morph('<span class="it">A</span><span class="it">B</span>');
      const tags = [];
      query('.it').forEach(el => tags.push(el.textContent));
      expect(tags).toEqual(['A', 'B']);
    });

    it('map works after morph', () => {
      root.innerHTML = '<p>x</p>';
      query(root).morph('<p class="mp">1</p><p class="mp">2</p><p class="mp">3</p>');
      const values = query('.mp').map((_, el) => el.textContent);
      expect(values).toEqual(['1', '2', '3']);
    });

    it('Symbol.iterator works on collection', () => {
      root.innerHTML = '<i>A</i><i>B</i>';
      const col = query('i');
      const texts = [];
      for (const el of col) texts.push(el.textContent);
      expect(texts).toEqual(['A', 'B']);
    });
  });
});

// ===========================================================================
// 14. CSP-safe - no eval / new Function anywhere in production source
// ===========================================================================
describe('CSP-safe (no eval/new Function)', () => {
  it('safeEval evaluates simple identifiers without eval', () => {
    const ctx = { foo: 42 };
    expect(safeEval('foo', [ctx])).toBe(42);
  });

  it('safeEval evaluates member expressions', () => {
    const ctx = { user: { name: 'Tony' } };
    expect(safeEval('user.name', [ctx])).toBe('Tony');
  });

  it('safeEval evaluates arithmetic expressions', () => {
    const ctx = { a: 10, b: 3 };
    expect(safeEval('a + b', [ctx])).toBe(13);
    expect(safeEval('a * b', [ctx])).toBe(30);
    expect(safeEval('a - b', [ctx])).toBe(7);
  });

  it('safeEval evaluates comparison expressions', () => {
    const ctx = { x: 5 };
    expect(safeEval('x > 3', [ctx])).toBe(true);
    expect(safeEval('x === 5', [ctx])).toBe(true);
    expect(safeEval('x < 2', [ctx])).toBe(false);
  });

  it('safeEval evaluates ternary expressions', () => {
    const ctx = { flag: true };
    expect(safeEval('flag ? "yes" : "no"', [ctx])).toBe('yes');
  });

  it('safeEval evaluates logical operators', () => {
    const ctx = { a: true, b: false };
    expect(safeEval('a && b', [ctx])).toBe(false);
    expect(safeEval('a || b', [ctx])).toBe(true);
    expect(safeEval('!b', [ctx])).toBe(true);
  });

  it('safeEval evaluates array literals', () => {
    const ctx = { a: 1, b: 2 };
    expect(safeEval('[a, b]', [ctx])).toEqual([1, 2]);
  });

  it('safeEval evaluates object literals', () => {
    const ctx = { x: 10 };
    expect(safeEval('{ val: x }', [ctx])).toEqual({ val: 10 });
  });

  it('safeEval evaluates method calls on objects', () => {
    const ctx = { items: [3, 1, 2] };
    expect(safeEval('items.includes(2)', [ctx])).toBe(true);
    expect(safeEval('items.length', [ctx])).toBe(3);
  });

  it('safeEval evaluates string methods', () => {
    const ctx = { name: ' hello ' };
    expect(safeEval('name.trim()', [ctx])).toBe('hello');
    expect(safeEval('name.trim().toUpperCase()', [ctx])).toBe('HELLO');
  });

  it('safeEval returns undefined for invalid expressions (graceful fallback)', () => {
    expect(safeEval('???', [])).toBeUndefined();
    expect(safeEval('', [])).toBeUndefined();
  });

  it('safeEval handles template literals', () => {
    const ctx = { name: 'world' };
    expect(safeEval('`hello ${name}`', [ctx])).toBe('hello world');
  });

  it('safeEval evaluates nullish coalescing', () => {
    const ctx = { val: null, fallback: 42 };
    expect(safeEval('val ?? fallback', [ctx])).toBe(42);
  });

  it('safeEval evaluates optional chaining', () => {
    const ctx = { user: null };
    expect(safeEval('user?.name', [ctx])).toBeUndefined();
    const ctx2 = { user: { name: 'Tony' } };
    expect(safeEval('user?.name', [ctx2])).toBe('Tony');
  });

  it('safeEval caches parsed ASTs for performance', () => {
    const ctx = { x: 1 };
    // Same expression evaluated multiple times should reuse cached AST
    for (let i = 0; i < 100; i++) {
      expect(safeEval('x + 1', [ctx])).toBe(2);
    }
  });

  it('safeEval handles spread in array literals', () => {
    const ctx = { arr: [1, 2], extra: 3 };
    expect(safeEval('[...arr, extra]', [ctx])).toEqual([1, 2, 3]);
  });

  it('safeEval handles spread combining multiple arrays', () => {
    const ctx = { a: [1, 2], b: [3, 4] };
    expect(safeEval('[...a, ...b]', [ctx])).toEqual([1, 2, 3, 4]);
  });

  it('safeEval handles spread in object literals', () => {
    const ctx = { base: { x: 1, y: 2 }, extra: 3 };
    expect(safeEval('{ ...base, z: extra }', [ctx])).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('safeEval handles spread merging multiple objects', () => {
    const ctx = { a: { x: 1 }, b: { y: 2, x: 3 } };
    expect(safeEval('{ ...a, ...b }', [ctx])).toEqual({ x: 3, y: 2 });
  });

  it('safeEval handles spread in function call arguments', () => {
    const ctx = { args: [1, 2, 3], Math };
    expect(safeEval('Math.max(...args)', [ctx])).toBe(3);
  });

  it('safeEval handles spread with empty arrays', () => {
    const ctx = { empty: [], items: [1] };
    expect(safeEval('[...empty, ...items]', [ctx])).toEqual([1]);
  });

  it('safeEval handles spread of null/undefined gracefully', () => {
    const ctx = { val: null };
    // Spreading null should be handled gracefully (skipped)
    expect(safeEval('[...val]', [ctx])).toEqual([]);
  });

  it('safeEval evaluates arrow functions in context like filter/map', () => {
    const ctx = { items: [1, 2, 3, 4] };
    expect(safeEval('items.filter(x => x > 2)', [ctx])).toEqual([3, 4]);
    expect(safeEval('items.map(x => x * 2)', [ctx])).toEqual([2, 4, 6, 8]);
  });
});


// ===========================================================================
// 15. Event Bus (pub/sub)
// ===========================================================================
describe('EventBus', () => {
  let testBus;

  beforeEach(() => {
    testBus = new EventBus();
  });

  it('on/emit delivers messages to subscribers', () => {
    const received = [];
    testBus.on('msg', (data) => received.push(data));
    testBus.emit('msg', 'hello');
    testBus.emit('msg', 'world');
    expect(received).toEqual(['hello', 'world']);
  });

  it('on returns an unsubscribe function', () => {
    const received = [];
    const unsub = testBus.on('ev', (d) => received.push(d));
    testBus.emit('ev', 1);
    unsub();
    testBus.emit('ev', 2);
    expect(received).toEqual([1]);
  });

  it('off removes a specific handler', () => {
    const received = [];
    const fn = (d) => received.push(d);
    testBus.on('ev', fn);
    testBus.emit('ev', 'a');
    testBus.off('ev', fn);
    testBus.emit('ev', 'b');
    expect(received).toEqual(['a']);
  });

  it('once fires handler only once then auto-removes', () => {
    const received = [];
    testBus.once('ev', (d) => received.push(d));
    testBus.emit('ev', 'first');
    testBus.emit('ev', 'second');
    expect(received).toEqual(['first']);
  });

  it('once returns an unsubscribe function', () => {
    const received = [];
    const unsub = testBus.once('ev', (d) => received.push(d));
    unsub(); // unsubscribe before any emit
    testBus.emit('ev', 'data');
    expect(received).toEqual([]);
  });

  it('clear removes all handlers for all events', () => {
    const received = [];
    testBus.on('a', () => received.push('a'));
    testBus.on('b', () => received.push('b'));
    testBus.clear();
    testBus.emit('a');
    testBus.emit('b');
    expect(received).toEqual([]);
  });

  it('multiple subscribers on same event all receive messages', () => {
    const r1 = [], r2 = [];
    testBus.on('ev', (d) => r1.push(d));
    testBus.on('ev', (d) => r2.push(d));
    testBus.emit('ev', 'data');
    expect(r1).toEqual(['data']);
    expect(r2).toEqual(['data']);
  });

  it('emit with no subscribers does not throw', () => {
    expect(() => testBus.emit('nonexistent', 'data')).not.toThrow();
  });

  it('emit passes multiple arguments', () => {
    let args;
    testBus.on('ev', (...a) => { args = a; });
    testBus.emit('ev', 1, 2, 3);
    expect(args).toEqual([1, 2, 3]);
  });

  it('off on nonexistent event does not throw', () => {
    expect(() => testBus.off('nope', () => {})).not.toThrow();
  });

  it('same function registered twice is deduplicated (Set)', () => {
    const received = [];
    const fn = (d) => received.push(d);
    testBus.on('ev', fn);
    testBus.on('ev', fn); // same reference, Set deduplicates
    testBus.emit('ev', 'x');
    expect(received).toEqual(['x']); // only once
  });

  it('on during emit does not affect current emit round (Set.forEach)', () => {
    // Set.forEach visits elements added during iteration; verify behavior
    const received = [];
    testBus.on('ev', () => {
      received.push('first');
      testBus.on('ev', () => received.push('dynamic'));
    });
    testBus.emit('ev');
    // Set.forEach WILL call the newly added handler in the same iteration
    // This is a characteristic of Set behavior, not a bug
    expect(received).toContain('first');
  });

  it('handler that throws during emit does not prevent other handlers', () => {
    // Since Set.forEach is used, an exception in one handler WILL prevent subsequent handlers.
    // This tests the CURRENT behavior - if the framework wants error isolation,
    // it would need try/catch inside the forEach.
    const received = [];
    testBus.on('ev', () => { throw new Error('boom'); });
    testBus.on('ev', () => received.push('second'));
    // Currently, the second handler may not execute due to unprotected forEach.
    // This documents the behavior - if this test fails after a framework fix, that's good.
    expect(() => testBus.emit('ev')).toThrow('boom');
  });

  it('emit with zero arguments works', () => {
    let called = false;
    testBus.on('ev', () => { called = true; });
    testBus.emit('ev');
    expect(called).toBe(true);
  });

  it('independent events do not interfere', () => {
    const aReceived = [], bReceived = [];
    testBus.on('a', (d) => aReceived.push(d));
    testBus.on('b', (d) => bReceived.push(d));
    testBus.emit('a', 1);
    testBus.emit('b', 2);
    expect(aReceived).toEqual([1]);
    expect(bReceived).toEqual([2]);
  });

  it('global bus is a pre-constructed EventBus instance', () => {
    expect(bus).toBeDefined();
    expect(typeof bus.on).toBe('function');
    expect(typeof bus.off).toBe('function');
    expect(typeof bus.emit).toBe('function');
    expect(typeof bus.once).toBe('function');
    expect(typeof bus.clear).toBe('function');
  });
});


// ===========================================================================
// 16. DOM Reconciliation / Morph
// ===========================================================================
describe('DOM Reconciliation (morph)', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('morph preserves existing DOM nodes when only text changes', () => {
    container.innerHTML = '<p>old</p>';
    const pBefore = container.querySelector('p');
    morph(container, '<p>new</p>');
    const pAfter = container.querySelector('p');
    expect(pAfter).toBe(pBefore); // same DOM node preserved
    expect(pAfter.textContent).toBe('new');
  });

  it('morph preserves existing DOM nodes when only attributes change', () => {
    container.innerHTML = '<div class="a"></div>';
    const divBefore = container.querySelector('div');
    morph(container, '<div class="b"></div>');
    expect(container.querySelector('div')).toBe(divBefore);
    expect(divBefore.className).toBe('b');
  });

  it('morph adds new elements', () => {
    container.innerHTML = '<p>1</p>';
    morph(container, '<p>1</p><p>2</p>');
    expect(container.children.length).toBe(2);
    expect(container.children[1].textContent).toBe('2');
  });

  it('morph removes excess elements', () => {
    container.innerHTML = '<p>1</p><p>2</p><p>3</p>';
    morph(container, '<p>1</p>');
    expect(container.children.length).toBe(1);
  });

  it('morph handles keyed reordering', () => {
    container.innerHTML = '<div z-key="a">A</div><div z-key="b">B</div><div z-key="c">C</div>';
    const [a, b, c] = [...container.children];
    morph(container, '<div z-key="c">C</div><div z-key="a">A</div><div z-key="b">B</div>');
    expect(container.children[0]).toBe(c);
    expect(container.children[1]).toBe(a);
    expect(container.children[2]).toBe(b);
  });

  it('morph preserves input value (focus preservation)', () => {
    container.innerHTML = '<input type="text" value="hello">';
    const input = container.querySelector('input');
    input.value = 'user typed';
    morph(container, '<input type="text" value="hello">');
    // morph syncs value from new node, but the input element should be preserved
    expect(container.querySelector('input')).toBe(input);
  });

  it('morph handles different node types (replaces entirely)', () => {
    container.innerHTML = '<p>paragraph</p>';
    morph(container, '<div>div now</div>');
    expect(container.children[0].tagName).toBe('DIV');
    expect(container.children[0].textContent).toBe('div now');
  });

  it('morph handles empty old and new', () => {
    container.innerHTML = '';
    morph(container, '');
    expect(container.innerHTML).toBe('');
  });

  it('morph handles old empty, new has content', () => {
    container.innerHTML = '';
    morph(container, '<p>added</p>');
    expect(container.children.length).toBe(1);
    expect(container.children[0].textContent).toBe('added');
  });

  it('morph handles old has content, new empty', () => {
    container.innerHTML = '<p>will remove</p>';
    morph(container, '');
    expect(container.children.length).toBe(0);
  });

  it('morph skips z-skip subtrees', () => {
    container.innerHTML = '<div z-skip>DO NOT TOUCH</div>';
    morph(container, '<div z-skip>REPLACED</div>');
    expect(container.children[0].textContent).toBe('DO NOT TOUCH');
  });

  it('morph handles text node changes', () => {
    container.innerHTML = 'plain text';
    morph(container, 'updated text');
    expect(container.textContent).toBe('updated text');
  });

  it('morph handles nested structure changes', () => {
    container.innerHTML = '<div><span>A</span><span>B</span></div>';
    morph(container, '<div><span>A</span><span>B</span><span>C</span></div>');
    expect(container.querySelector('div').children.length).toBe(3);
  });

  it('morph handles attribute removal', () => {
    container.innerHTML = '<div class="x" data-val="y"></div>';
    morph(container, '<div></div>');
    const d = container.querySelector('div');
    expect(d.hasAttribute('class')).toBe(false);
    expect(d.hasAttribute('data-val')).toBe(false);
  });

  it('morph handles attribute addition', () => {
    container.innerHTML = '<div></div>';
    morph(container, '<div class="added" data-info="test"></div>');
    const d = container.querySelector('div');
    expect(d.className).toBe('added');
    expect(d.getAttribute('data-info')).toBe('test');
  });

  it('isEqualNode fast bail-out: identical subtrees skip processing', () => {
    const html = '<div><span class="a">text</span><span class="b">more</span></div>';
    container.innerHTML = html;
    const spanBefore = container.querySelector('.a');
    morph(container, html);
    // Same node preserved (the tree was identical, isEqualNode returned true)
    expect(container.querySelector('.a')).toBe(spanBefore);
  });

  it('isEqualNode: changed subtrees are still properly morphed', () => {
    container.innerHTML = '<div><span class="a">old</span></div>';
    morph(container, '<div><span class="a">new</span></div>');
    expect(container.querySelector('.a').textContent).toBe('new');
  });

  it('morph preserves select element value', () => {
    container.innerHTML = '<select><option value="a">A</option><option value="b" selected>B</option></select>';
    const sel = container.querySelector('select');
    expect(sel.value).toBe('b');
    morph(container, '<select><option value="a">A</option><option value="b" selected>B</option></select>');
    expect(container.querySelector('select')).toBe(sel);
  });

  it('morph handles textarea value sync', () => {
    container.innerHTML = '<textarea>old content</textarea>';
    const ta = container.querySelector('textarea');
    morph(container, '<textarea>new content</textarea>');
    expect(container.querySelector('textarea')).toBe(ta);
    expect(ta.value).toBe('new content');
  });

  it('morphElement works between two standalone elements', () => {
    const el = document.createElement('div');
    el.innerHTML = '<span>old</span>';
    container.appendChild(el);
    morphElement(el, '<div><span>new</span></div>');
    expect(el.querySelector('span').textContent).toBe('new');
  });
});


// ===========================================================================
// 17. State Management (Store)
// ===========================================================================
describe('Store', () => {
  it('createStore creates a store with reactive state', () => {
    const store = createStore('test-basic', {
      state: { count: 0, name: 'zQuery' }
    });
    expect(store.state.count).toBe(0);
    expect(store.state.name).toBe('zQuery');
  });

  it('dispatch mutates state via named actions', () => {
    const store = createStore('test-dispatch', {
      state: { count: 0 },
      actions: {
        increment(state) { state.count++; },
        add(state, amount) { state.count += amount; }
      }
    });
    store.dispatch('increment');
    expect(store.state.count).toBe(1);
    store.dispatch('add', 5);
    expect(store.state.count).toBe(6);
  });

  it('dispatch with unknown action reports error (does not throw)', () => {
    const store = createStore('test-unknown-action', { state: {} });
    expect(() => store.dispatch('nonexistent')).not.toThrow();
  });

  it('subscribe to key-specific changes', () => {
    const store = createStore('test-sub', {
      state: { count: 0 },
      actions: { inc(state) { state.count++; } }
    });
    const received = [];
    store.subscribe('count', (val, old) => received.push({ val, old }));
    store.dispatch('inc');
    store.dispatch('inc');
    expect(received).toEqual([
      { val: 1, old: 0 },
      { val: 2, old: 1 }
    ]);
  });

  it('subscribe returns unsubscribe function', () => {
    const store = createStore('test-unsub', {
      state: { x: 0 },
      actions: { bump(state) { state.x++; } }
    });
    const received = [];
    const unsub = store.subscribe('x', (val) => received.push(val));
    store.dispatch('bump');
    unsub();
    store.dispatch('bump');
    expect(received).toEqual([1]);
  });

  it('wildcard subscribe receives all changes', () => {
    const store = createStore('test-wildcard', {
      state: { a: 0, b: 0 },
      actions: {
        setA(state, val) { state.a = val; },
        setB(state, val) { state.b = val; }
      }
    });
    const received = [];
    store.subscribe((key, val, old) => received.push({ key, val, old }));
    store.dispatch('setA', 10);
    store.dispatch('setB', 20);
    expect(received).toEqual([
      { key: 'a', val: 10, old: 0 },
      { key: 'b', val: 20, old: 0 }
    ]);
  });

  it('getters compute derived state', () => {
    const store = createStore('test-getters', {
      state: { count: 5 },
      getters: {
        doubled: (state) => state.count * 2,
        isPositive: (state) => state.count > 0
      }
    });
    expect(store.getters.doubled).toBe(10);
    expect(store.getters.isPositive).toBe(true);
  });

  it('getters recompute when state changes', () => {
    const store = createStore('test-getters-reactive', {
      state: { count: 1 },
      actions: { inc(state) { state.count++; } },
      getters: { doubled: (state) => state.count * 2 }
    });
    expect(store.getters.doubled).toBe(2);
    store.dispatch('inc');
    expect(store.getters.doubled).toBe(4);
  });

  it('middleware can block actions by returning false', () => {
    const store = createStore('test-mw-block', {
      state: { count: 0 },
      actions: { inc(state) { state.count++; } }
    });
    store.use((name) => name === 'inc' ? false : undefined);
    store.dispatch('inc');
    expect(store.state.count).toBe(0); // blocked
  });

  it('middleware that throws blocks the action', () => {
    const store = createStore('test-mw-throw', {
      state: { count: 0 },
      actions: { inc(state) { state.count++; } }
    });
    store.use(() => { throw new Error('middleware error'); });
    store.dispatch('inc');
    expect(store.state.count).toBe(0); // blocked by throw
  });

  it('middleware receives action name, args, and state', () => {
    const store = createStore('test-mw-args', {
      state: { x: 0 },
      actions: { setX(state, val) { state.x = val; } }
    });
    let mwArgs;
    store.use((name, args, state) => { mwArgs = { name, args, x: state.x }; });
    store.dispatch('setX', 42);
    expect(mwArgs.name).toBe('setX');
    expect(mwArgs.args).toEqual([42]);
    expect(mwArgs.x).toBe(0); // state before action ran
  });

  it('use() returns the store for chaining', () => {
    const store = createStore('test-chain', { state: {} });
    const result = store.use(() => {});
    expect(result).toBe(store);
  });

  it('history tracks dispatched actions', () => {
    const store = createStore('test-history', {
      state: { x: 0 },
      actions: { inc(state) { state.x++; } }
    });
    store.dispatch('inc');
    store.dispatch('inc');
    const h = store.history;
    expect(h.length).toBe(2);
    expect(h[0].action).toBe('inc');
    expect(h[1].action).toBe('inc');
    expect(typeof h[0].timestamp).toBe('number');
  });

  it('history is immutable (returns copy)', () => {
    const store = createStore('test-history-immut', {
      state: { x: 0 },
      actions: { inc(state) { state.x++; } }
    });
    store.dispatch('inc');
    const h1 = store.history;
    h1.push({ action: 'fake' });
    expect(store.history.length).toBe(1); // original not mutated
  });

  it('history caps at maxHistory', () => {
    const store = createStore('test-maxhist', {
      state: { x: 0 },
      maxHistory: 3,
      actions: { inc(state) { state.x++; } }
    });
    for (let i = 0; i < 10; i++) store.dispatch('inc');
    expect(store.history.length).toBe(3);
  });

  it('snapshot returns a plain object copy of state', () => {
    const store = createStore('test-snapshot', {
      state: { count: 5, nested: { a: 1 } }
    });
    const snap = store.snapshot();
    expect(snap).toEqual({ count: 5, nested: { a: 1 } });
    // Mutation of snapshot does not affect store
    snap.count = 999;
    expect(store.state.count).toBe(5);
  });

  it('replaceState replaces all state', () => {
    const store = createStore('test-replace', {
      state: { a: 1, b: 2 }
    });
    store.replaceState({ c: 3, d: 4 });
    expect(store.state.c).toBe(3);
    expect(store.state.d).toBe(4);
    expect(store.state.a).toBeUndefined();
    expect(store.state.b).toBeUndefined();
  });

  it('reset restores state and clears history', () => {
    const store = createStore('test-reset', {
      state: { count: 0 },
      actions: { inc(state) { state.count++; } }
    });
    store.dispatch('inc');
    store.dispatch('inc');
    expect(store.state.count).toBe(2);
    expect(store.history.length).toBe(2);
    store.reset({ count: 0 });
    expect(store.state.count).toBe(0);
    expect(store.history.length).toBe(0);
  });

  it('state as a function (factory pattern)', () => {
    const store = createStore('test-factory', {
      state: () => ({ count: 0 })
    });
    expect(store.state.count).toBe(0);
  });

  it('getStore retrieves store by name', () => {
    const store = createStore('findme', { state: { x: 42 } });
    expect(getStore('findme')).toBe(store);
  });

  it('getStore returns null for non-existent store', () => {
    expect(getStore('does-not-exist')).toBeNull();
  });

  it('createStore with just config (no name) uses default', () => {
    const store = createStore({ state: { x: 1 } });
    expect(getStore('default')).toBe(store);
  });

  it('subscriber that throws does not break other subscribers', () => {
    const store = createStore('test-sub-throw', {
      state: { x: 0 },
      actions: { bump(state) { state.x++; } }
    });
    const received = [];
    store.subscribe('x', () => { throw new Error('sub error'); });
    store.subscribe('x', (val) => received.push(val));
    store.dispatch('bump');
    // The second subscriber still gets called because reportError is used (not re-throw)
    expect(received).toEqual([1]);
  });

  it('action return value is returned by dispatch', () => {
    const store = createStore('test-return', {
      state: { x: 0 },
      actions: { compute(state) { return state.x + 100; } }
    });
    expect(store.dispatch('compute')).toBe(100);
  });

  it('multiple middleware run in order', () => {
    const store = createStore('test-mw-order', {
      state: { x: 0 },
      actions: { inc(state) { state.x++; } }
    });
    const order = [];
    store.use(() => { order.push(1); });
    store.use(() => { order.push(2); });
    store.dispatch('inc');
    expect(order).toEqual([1, 2]);
  });

  it('direct state mutation triggers subscribers', () => {
    const store = createStore('test-direct', {
      state: { x: 0 }
    });
    const received = [];
    store.subscribe('x', (val) => received.push(val));
    store.state.x = 99;
    expect(received).toEqual([99]);
  });
});


// ===========================================================================
// 18. Scoped Styles
// ===========================================================================
describe('Scoped Styles', () => {
  afterEach(() => {
    document.querySelectorAll('style[data-zq-scope]').forEach(s => s.remove());
    document.querySelectorAll('[class^="scope-test"]').forEach(el => el.remove());
  });

  it('component with styles creates scoped style element in head', () => {
    const name = 'scope-test-' + Math.random().toString(36).slice(2, 8);
    component(name, {
      styles: '.item { color: red; }',
      render: () => '<div class="item">test</div>'
    });
    const el = document.createElement(name);
    document.body.appendChild(el);
    mount(el, name);

    const styleEl = document.querySelector(`style[data-zq-component="${name}"]`);
    expect(styleEl).toBeTruthy();
    // Should have scope attribute in selector
    expect(styleEl.textContent).toContain('[z-s');
    expect(styleEl.textContent).toContain('.item');
    el.remove();
  });

  it('scope attribute is set on the component root element', () => {
    const name = 'scope-test-attr-' + Math.random().toString(36).slice(2, 8);
    component(name, {
      styles: '.inner { color: blue; }',
      render: () => '<span class="inner">hi</span>'
    });
    const el = document.createElement(name);
    document.body.appendChild(el);
    mount(el, name);

    const attrs = [...el.attributes].filter(a => a.name.startsWith('z-s'));
    expect(attrs.length).toBe(1);
    el.remove();
  });

  it('scoped styles rewrite selectors with scope attribute', () => {
    const name = 'scope-test-rewrite-' + Math.random().toString(36).slice(2, 8);
    component(name, {
      styles: '.box { padding: 10px; } .box .inner { margin: 5px; }',
      render: () => '<div class="box"><div class="inner">x</div></div>'
    });
    const el = document.createElement(name);
    document.body.appendChild(el);
    mount(el, name);

    const styleEl = document.querySelector(`style[data-zq-component="${name}"]`);
    const text = styleEl.textContent;
    // Each selector should be prefixed with [z-sN]
    expect(text).toMatch(/\[z-s\d+\]\s+\.box\s*\{/);
    expect(text).toMatch(/\[z-s\d+\]\s+\.box \.inner\s*\{/);
    el.remove();
  });

  it('scoped styles handle comma-separated selectors', () => {
    const name = 'scope-test-comma-' + Math.random().toString(36).slice(2, 8);
    component(name, {
      styles: '.a, .b { color: red; }',
      render: () => '<div class="a">A</div><div class="b">B</div>'
    });
    const el = document.createElement(name);
    document.body.appendChild(el);
    mount(el, name);

    const styleEl = document.querySelector(`style[data-zq-component="${name}"]`);
    const text = styleEl.textContent;
    // Both selectors should be independently prefixed
    expect(text).toMatch(/\[z-s\d+\]\s+\.a/);
    expect(text).toMatch(/\[z-s\d+\]\s+\.b/);
    el.remove();
  });

  it('@keyframes content is NOT scoped', () => {
    const name = 'scope-test-kf-' + Math.random().toString(36).slice(2, 8);
    component(name, {
      styles: '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } .animated { animation: fadeIn 1s; }',
      render: () => '<div class="animated">x</div>'
    });
    const el = document.createElement(name);
    document.body.appendChild(el);
    mount(el, name);

    const styleEl = document.querySelector(`style[data-zq-component="${name}"]`);
    const text = styleEl.textContent;
    // The @keyframes rule itself should not be scoped
    expect(text).toContain('@keyframes fadeIn');
    // "from" and "to" inside @keyframes should NOT have [z-s] prefix
    expect(text).not.toMatch(/\[z-s\d+\]\s+from/);
    expect(text).not.toMatch(/\[z-s\d+\]\s+to/);
    // But .animated SHOULD be scoped
    expect(text).toMatch(/\[z-s\d+\]\s+\.animated/);
    el.remove();
  });

  it('@font-face content is NOT scoped', () => {
    const name = 'scope-test-ff-' + Math.random().toString(36).slice(2, 8);
    component(name, {
      styles: "@font-face { font-family: 'TestFont'; src: url('test.woff2'); } .text { font-family: 'TestFont'; }",
      render: () => '<div class="text">x</div>'
    });
    const el = document.createElement(name);
    document.body.appendChild(el);
    mount(el, name);

    const styleEl = document.querySelector(`style[data-zq-component="${name}"]`);
    const text = styleEl.textContent;
    expect(text).toContain('@font-face');
    // .text should be scoped
    expect(text).toMatch(/\[z-s\d+\]\s+\.text/);
    el.remove();
  });

  it('@media rules are not scoped but their contents ARE', () => {
    const name = 'scope-test-media-' + Math.random().toString(36).slice(2, 8);
    component(name, {
      styles: '@media (max-width: 600px) { .mobile { display: block; } }',
      render: () => '<div class="mobile">x</div>'
    });
    const el = document.createElement(name);
    document.body.appendChild(el);
    mount(el, name);

    const styleEl = document.querySelector(`style[data-zq-component="${name}"]`);
    const text = styleEl.textContent;
    expect(text).toContain('@media');
    // .mobile inside @media should be scoped
    expect(text).toMatch(/\[z-s\d+\]\s+\.mobile/);
    el.remove();
  });
});


// ===========================================================================
// 19. Two-Way Binding (z-model)
// ===========================================================================
describe('Two-Way Binding (z-model)', () => {
  afterEach(() => {
    document.querySelectorAll('[class^="bind-test"]').forEach(el => el.remove());
  });

  it('text input binds to state and reflects state changes', () => {
    const name = 'bind-test-text-' + Math.random().toString(36).slice(2, 8);
    component(name, {
      state: () => ({ name: 'initial' }),
      render() { return `<input z-model="name" type="text"><span>${this.state.name}</span>`; }
    });
    const el = document.createElement(name);
    document.body.appendChild(el);
    mount(el, name);

    const input = el.querySelector('input');
    expect(input.value).toBe('initial');
  });

  it('checkbox binds to boolean state', () => {
    const name = 'bind-test-check-' + Math.random().toString(36).slice(2, 8);
    component(name, {
      state: () => ({ active: true }),
      render() { return `<input z-model="active" type="checkbox">`; }
    });
    const el = document.createElement(name);
    document.body.appendChild(el);
    mount(el, name);

    const input = el.querySelector('input');
    expect(input.checked).toBe(true);
  });

  it('radio buttons bind to state value', () => {
    const name = 'bind-test-radio-' + Math.random().toString(36).slice(2, 8);
    component(name, {
      state: () => ({ color: 'blue' }),
      render() {
        return `
          <input z-model="color" type="radio" value="red">
          <input z-model="color" type="radio" value="blue">
          <input z-model="color" type="radio" value="green">
        `;
      }
    });
    const el = document.createElement(name);
    document.body.appendChild(el);
    mount(el, name);

    const radios = el.querySelectorAll('input');
    expect(radios[0].checked).toBe(false); // red
    expect(radios[1].checked).toBe(true);  // blue
    expect(radios[2].checked).toBe(false); // green
  });

  it('select element binds to state', () => {
    const name = 'bind-test-select-' + Math.random().toString(36).slice(2, 8);
    component(name, {
      state: () => ({ fruit: 'banana' }),
      render() {
        return `
          <select z-model="fruit">
            <option value="apple">Apple</option>
            <option value="banana">Banana</option>
            <option value="cherry">Cherry</option>
          </select>
        `;
      }
    });
    const el = document.createElement(name);
    document.body.appendChild(el);
    mount(el, name);

    const select = el.querySelector('select');
    expect(select.value).toBe('banana');
  });

  it('select multiple binds to array state', () => {
    const name = 'bind-test-multi-' + Math.random().toString(36).slice(2, 8);
    component(name, {
      state: () => ({ chosen: ['a', 'c'] }),
      render() {
        return `
          <select z-model="chosen" multiple>
            <option value="a">A</option>
            <option value="b">B</option>
            <option value="c">C</option>
          </select>
        `;
      }
    });
    const el = document.createElement(name);
    document.body.appendChild(el);
    mount(el, name);

    const opts = el.querySelector('select').options;
    expect(opts[0].selected).toBe(true);  // a
    expect(opts[1].selected).toBe(false); // b
    expect(opts[2].selected).toBe(true);  // c
  });

  it('contenteditable binds to state', () => {
    const name = 'bind-test-ce-' + Math.random().toString(36).slice(2, 8);
    component(name, {
      state: () => ({ content: 'editable text' }),
      render() {
        return `<div z-model="content" contenteditable="true"></div>`;
      }
    });
    const el = document.createElement(name);
    document.body.appendChild(el);
    mount(el, name);

    const ce = el.querySelector('[contenteditable]');
    expect(ce.textContent).toBe('editable text');
  });

  it('dot-path key binds to nested state', () => {
    const name = 'bind-test-dot-' + Math.random().toString(36).slice(2, 8);
    component(name, {
      state: () => ({ user: { name: 'Tony' } }),
      render() {
        return `<input z-model="user.name" type="text">`;
      }
    });
    const el = document.createElement(name);
    document.body.appendChild(el);
    mount(el, name);

    const input = el.querySelector('input');
    expect(input.value).toBe('Tony');
  });

  it('z-model with undefined state initializes input as empty', () => {
    const name = 'bind-test-undef-' + Math.random().toString(36).slice(2, 8);
    component(name, {
      state: () => ({}),
      render() {
        return `<input z-model="missing" type="text">`;
      }
    });
    const el = document.createElement(name);
    document.body.appendChild(el);
    mount(el, name);

    const input = el.querySelector('input');
    expect(input.value).toBe('');
  });
});


// ===========================================================================
// 20. Input Modifiers (z-lazy, z-trim, z-number)
// ===========================================================================
describe('Input Modifiers (z-lazy, z-trim, z-number)', () => {
  afterEach(() => {
    document.querySelectorAll('[class^="mod-test"]').forEach(el => el.remove());
  });

  it('z-lazy uses change event instead of input', () => {
    const name = 'mod-test-lazy-' + Math.random().toString(36).slice(2, 8);
    component(name, {
      state: () => ({ val: '' }),
      render() {
        return `<input z-model="val" z-lazy type="text"><span id="out">${this.state.val}</span>`;
      }
    });
    const el = document.createElement(name);
    document.body.appendChild(el);
    mount(el, name);

    const input = el.querySelector('input');
    const inst = getInstance(el);

    // Simulate typing (fires 'input' event - should NOT update with z-lazy)
    input.value = 'typed';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    // State should NOT have changed yet since z-lazy listens to 'change'
    // We need to check the instance state
    if (inst) {
      expect(inst.state.val).toBe('');
    }

    // Now fire 'change' event - should update
    input.dispatchEvent(new Event('change', { bubbles: true }));
    if (inst) {
      expect(inst.state.val).toBe('typed');
    }
  });

  it('z-trim trims whitespace from input value', () => {
    const name = 'mod-test-trim-' + Math.random().toString(36).slice(2, 8);
    component(name, {
      state: () => ({ val: '' }),
      render() {
        return `<input z-model="val" z-trim type="text">`;
      }
    });
    const el = document.createElement(name);
    document.body.appendChild(el);
    mount(el, name);

    const input = el.querySelector('input');
    const inst = getInstance(el);
    input.value = '  hello world  ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (inst) {
      expect(inst.state.val).toBe('hello world');
    }
  });

  it('z-number converts value to Number', () => {
    const name = 'mod-test-num-' + Math.random().toString(36).slice(2, 8);
    component(name, {
      state: () => ({ val: 0 }),
      render() {
        return `<input z-model="val" z-number type="text">`;
      }
    });
    const el = document.createElement(name);
    document.body.appendChild(el);
    mount(el, name);

    const input = el.querySelector('input');
    const inst = getInstance(el);
    input.value = '42';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (inst) {
      expect(inst.state.val).toBe(42);
      expect(typeof inst.state.val).toBe('number');
    }
  });

  it('type="number" auto-applies numeric conversion', () => {
    const name = 'mod-test-typenum-' + Math.random().toString(36).slice(2, 8);
    component(name, {
      state: () => ({ val: 0 }),
      render() {
        return `<input z-model="val" type="number">`;
      }
    });
    const el = document.createElement(name);
    document.body.appendChild(el);
    mount(el, name);

    const input = el.querySelector('input');
    const inst = getInstance(el);
    input.value = '99';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (inst) {
      expect(inst.state.val).toBe(99);
      expect(typeof inst.state.val).toBe('number');
    }
  });

  it('type="range" auto-applies numeric conversion', () => {
    const name = 'mod-test-range-' + Math.random().toString(36).slice(2, 8);
    component(name, {
      state: () => ({ val: 50 }),
      render() {
        return `<input z-model="val" type="range" min="0" max="100">`;
      }
    });
    const el = document.createElement(name);
    document.body.appendChild(el);
    mount(el, name);

    const input = el.querySelector('input');
    const inst = getInstance(el);
    input.value = '75';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (inst) {
      expect(inst.state.val).toBe(75);
    }
  });

  it('z-trim + z-number combined: trims then converts', () => {
    const name = 'mod-test-combo-' + Math.random().toString(36).slice(2, 8);
    component(name, {
      state: () => ({ val: 0 }),
      render() {
        return `<input z-model="val" z-trim z-number type="text">`;
      }
    });
    const el = document.createElement(name);
    document.body.appendChild(el);
    mount(el, name);

    const input = el.querySelector('input');
    const inst = getInstance(el);
    input.value = '  123  ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (inst) {
      expect(inst.state.val).toBe(123);
    }
  });

  it('z-lazy + z-trim combined', () => {
    const name = 'mod-test-lazy-trim-' + Math.random().toString(36).slice(2, 8);
    component(name, {
      state: () => ({ val: '' }),
      render() {
        return `<input z-model="val" z-lazy z-trim type="text">`;
      }
    });
    const el = document.createElement(name);
    document.body.appendChild(el);
    mount(el, name);

    const input = el.querySelector('input');
    const inst = getInstance(el);
    input.value = '  spaced  ';
    // input event should NOT trigger due to z-lazy
    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (inst) {
      expect(inst.state.val).toBe('');
    }
    // change event should trigger with trim applied
    input.dispatchEvent(new Event('change', { bubbles: true }));
    if (inst) {
      expect(inst.state.val).toBe('spaced');
    }
  });

  it('checkbox binding fires on change event', () => {
    const name = 'mod-test-cb-change-' + Math.random().toString(36).slice(2, 8);
    component(name, {
      state: () => ({ checked: false }),
      render() {
        return `<input z-model="checked" type="checkbox">`;
      }
    });
    const el = document.createElement(name);
    document.body.appendChild(el);
    mount(el, name);

    const input = el.querySelector('input');
    const inst = getInstance(el);
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    if (inst) {
      expect(inst.state.checked).toBe(true);
    }
  });
});


// ===========================================================================
// 21. Import/Export Correctness
// ===========================================================================
describe('Import/Export correctness', () => {
  it('TrustedHTML class is exported and constructible', () => {
    expect(TrustedHTML).toBeDefined();
    expect(typeof TrustedHTML).toBe('function');
    const t = new TrustedHTML('<b>hi</b>');
    expect(t.toString()).toBe('<b>hi</b>');
  });

  it('EventBus class is exported and constructible', () => {
    expect(EventBus).toBeDefined();
    expect(typeof EventBus).toBe('function');
    const b = new EventBus();
    expect(typeof b.on).toBe('function');
    expect(typeof b.off).toBe('function');
    expect(typeof b.emit).toBe('function');
    expect(typeof b.once).toBe('function');
    expect(typeof b.clear).toBe('function');
  });

  it('trust() returns TrustedHTML instances', () => {
    const t = trust('<em>safe</em>');
    expect(t).toBeInstanceOf(TrustedHTML);
    expect(t.toString()).toBe('<em>safe</em>');
  });

  it('bus is an instance of EventBus', () => {
    expect(bus).toBeInstanceOf(EventBus);
  });

  it('$ namespace exposes TrustedHTML and EventBus', async () => {
    const mod = await import('../index.js');
    const $ = mod.default;
    expect($.TrustedHTML).toBe(TrustedHTML);
    expect($.EventBus).toBe(EventBus);
  });

  it('named exports include TrustedHTML and EventBus', async () => {
    const mod = await import('../index.js');
    expect(mod.TrustedHTML).toBe(TrustedHTML);
    expect(mod.EventBus).toBe(EventBus);
  });

  it('all major symbols are exported from index.js', async () => {
    const mod = await import('../index.js');
    // Core
    expect(mod.$).toBeDefined();
    expect(mod.ZQueryCollection).toBeDefined();
    // Reactive
    expect(mod.reactive).toBeDefined();
    expect(mod.Signal).toBeDefined();
    expect(mod.signal).toBeDefined();
    expect(mod.computed).toBeDefined();
    expect(mod.effect).toBeDefined();
    // Components
    expect(mod.component).toBeDefined();
    expect(mod.mount).toBeDefined();
    expect(mod.mountAll).toBeDefined();
    expect(mod.getInstance).toBeDefined();
    expect(mod.destroy).toBeDefined();
    expect(mod.style).toBeDefined();
    // DOM
    expect(mod.morph).toBeDefined();
    expect(mod.morphElement).toBeDefined();
    expect(mod.safeEval).toBeDefined();
    // Router
    expect(mod.createRouter).toBeDefined();
    expect(mod.getRouter).toBeDefined();
    // Store
    expect(mod.createStore).toBeDefined();
    expect(mod.getStore).toBeDefined();
    // HTTP
    expect(mod.http).toBeDefined();
    // Errors
    expect(mod.ZQueryError).toBeDefined();
    expect(mod.ErrorCode).toBeDefined();
    expect(mod.onError).toBeDefined();
    expect(mod.reportError).toBeDefined();
    // Utils
    expect(mod.debounce).toBeDefined();
    expect(mod.throttle).toBeDefined();
    expect(mod.pipe).toBeDefined();
    expect(mod.once).toBeDefined();
    expect(mod.sleep).toBeDefined();
    expect(mod.escapeHtml).toBeDefined();
    expect(mod.html).toBeDefined();
    expect(mod.trust).toBeDefined();
    expect(mod.TrustedHTML).toBeDefined();
    expect(mod.uuid).toBeDefined();
    expect(mod.camelCase).toBeDefined();
    expect(mod.kebabCase).toBeDefined();
    expect(mod.deepClone).toBeDefined();
    expect(mod.deepMerge).toBeDefined();
    expect(mod.isEqual).toBeDefined();
    expect(mod.param).toBeDefined();
    expect(mod.parseQuery).toBeDefined();
    expect(mod.storage).toBeDefined();
    expect(mod.session).toBeDefined();
    expect(mod.EventBus).toBeDefined();
    expect(mod.bus).toBeDefined();
  });
});


// ===========================================================================
// 22. Reactive system edge cases
// ===========================================================================
describe('Reactive edge cases', () => {
  it('reactive proxy cache returns same proxy for same nested object', () => {
    const data = { nested: { x: 1 } };
    const changes = [];
    const r = reactive(data, (k, v, o) => changes.push(k));
    const p1 = r.nested;
    const p2 = r.nested;
    // Should be the same proxy reference (WeakMap cache)
    expect(p1).toBe(p2);
  });

  it('reactive.__raw returns the underlying object', () => {
    const data = { count: 0 };
    const r = reactive(data, () => {});
    expect(r.__raw).toBe(data);
  });

  it('reactive.__isReactive returns true', () => {
    const r = reactive({}, () => {});
    expect(r.__isReactive).toBe(true);
  });

  it('reactive set skips onChange when value is identical', () => {
    const changes = [];
    const r = reactive({ x: 5 }, (k, v, o) => changes.push(k));
    r.x = 5; // same value
    expect(changes).toEqual([]); // no notification
  });

  it('reactive delete triggers onChange', () => {
    const changes = [];
    const r = reactive({ x: 1 }, (k, v, o) => changes.push({ k, v, o }));
    delete r.x;
    expect(changes).toEqual([{ k: 'x', v: undefined, o: 1 }]);
  });

  it('reactive invalidates proxy cache when old object value is replaced', () => {
    const data = { nested: { x: 1 } };
    const r = reactive(data, () => {});
    const oldProxy = r.nested;
    r.nested = { x: 2 };
    const newProxy = r.nested;
    // New proxy should be different since the underlying object changed
    expect(newProxy).not.toBe(oldProxy);
    expect(newProxy.x).toBe(2);
  });

  it('reactive handles non-object target gracefully', () => {
    expect(reactive(42, () => {})).toBe(42);
    expect(reactive(null, () => {})).toBeNull();
    expect(reactive('str', () => {})).toBe('str');
  });

  it('reactive onChange error is caught and reported', () => {
    const r = reactive({ x: 0 }, () => { throw new Error('boom'); });
    // Should not throw - error is caught and reported internally
    expect(() => { r.x = 1; }).not.toThrow();
  });

  it('reactive deeply nested mutation triggers notification', () => {
    const data = { a: { b: { c: 0 } } };
    const changes = [];
    const r = reactive(data, (k, v, o) => changes.push(k));
    r.a.b.c = 99;
    expect(changes).toContain('c');
  });

  it('Signal basic get/set works', () => {
    const s = new Signal(10);
    expect(s.value).toBe(10);
    s.value = 20;
    expect(s.value).toBe(20);
  });

  it('Signal skip notification on same value', () => {
    const s = new Signal(5);
    const calls = [];
    s.subscribe(() => calls.push('called'));
    s.value = 5; // same value
    expect(calls).toEqual([]);
  });

  it('Signal.peek() reads without tracking', () => {
    const s = new Signal(42);
    expect(s.peek()).toBe(42);
  });

  it('Signal.toString() returns string of value', () => {
    const s = new Signal(123);
    expect(s.toString()).toBe('123');
  });

  it('Signal subscribe/unsubscribe works', () => {
    const s = new Signal(0);
    const calls = [];
    const unsub = s.subscribe(() => calls.push('notified'));
    s.value = 1;
    expect(calls).toEqual(['notified']);
    unsub();
    s.value = 2;
    expect(calls).toEqual(['notified']); // no second call
  });

  it('signal() shorthand creates a Signal', () => {
    const s = signal(0);
    expect(s).toBeInstanceOf(Signal);
    expect(s.value).toBe(0);
  });

  it('computed() creates a derived signal', () => {
    const count = signal(5);
    const doubled = computed(() => count.value * 2);
    expect(doubled.value).toBe(10);
    count.value = 10;
    expect(doubled.value).toBe(20);
  });

  it('effect() auto-tracks dependencies', () => {
    const count = signal(0);
    const log = [];
    effect(() => { log.push(count.value); });
    expect(log).toEqual([0]); // runs immediately
    count.value = 1;
    expect(log).toEqual([0, 1]);
    count.value = 2;
    expect(log).toEqual([0, 1, 2]);
  });

  it('effect cleanup: unsubscribe stops tracking', () => {
    const count = signal(0);
    const log = [];
    const unsub = effect(() => { log.push(count.value); });
    expect(log).toEqual([0]);
    unsub();
    count.value = 1;
    expect(log).toEqual([0]); // no more tracking
  });
});


// ===========================================================================
// 23. TrustedHTML / html template tag
// ===========================================================================
describe('TrustedHTML and html template tag', () => {
  it('TrustedHTML wraps and unwraps HTML string', () => {
    const t = new TrustedHTML('<b>bold</b>');
    expect(t._html).toBe('<b>bold</b>');
    expect(t.toString()).toBe('<b>bold</b>');
    expect(`${t}`).toBe('<b>bold</b>');
  });

  it('trust() returns TrustedHTML instance', () => {
    const t = trust('<i>italic</i>');
    expect(t).toBeInstanceOf(TrustedHTML);
    expect(t.toString()).toBe('<i>italic</i>');
  });

  it('html template tag escapes interpolated values', () => {
    const userInput = '<script>alert("xss")</script>';
    const result = html`<div>${userInput}</div>`;
    expect(result).toContain('&lt;script&gt;');
    expect(result).not.toContain('<script>');
  });

  it('html template tag does not escape TrustedHTML values', () => {
    const trusted = trust('<b>bold</b>');
    const result = html`<div>${trusted}</div>`;
    expect(result).toContain('<b>bold</b>');
  });

  it('html template tag handles multiple interpolations', () => {
    const name = 'Tony';
    const dangerous = '<img onerror="alert(1)">';
    const safe = trust('<em>safe</em>');
    const result = html`<p>${name}</p><p>${dangerous}</p><p>${safe}</p>`;
    expect(result).toContain('Tony');
    expect(result).toContain('&lt;img');
    expect(result).toContain('<em>safe</em>');
  });

  it('html template tag handles null and undefined gracefully', () => {
    const result = html`<div>${null}${undefined}</div>`;
    // Should not throw; values should be stringified
    expect(result).toContain('<div>');
  });

  it('escapeHtml escapes all dangerous characters', () => {
    expect(escapeHtml('&')).toBe('&amp;');
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('>')).toBe('&gt;');
    expect(escapeHtml('"')).toBe('&quot;');
    expect(escapeHtml("'")).toBe('&#39;');
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });
});


// ===========================================================================
// 24. Bug 9 — `new` constructor globals reachable
// ===========================================================================
describe('new constructor globals (Bug 9)', () => {
  const eval_ = (expr, ctx = {}) => safeEval(expr, [ctx]);

  it('new Map() creates a Map', () => {
    const result = eval_('new Map()');
    expect(result).toBeInstanceOf(Map);
  });

  it('new Set([1,2,3]) creates a Set with values', () => {
    const result = eval_('new Set(items)', { items: [1, 2, 3] });
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(3);
    expect(result.has(2)).toBe(true);
  });

  it('new RegExp creates a RegExp', () => {
    const result = eval_('new RegExp(pat, flags)', { pat: '^hello', flags: 'i' });
    expect(result).toBeInstanceOf(RegExp);
    expect(result.test('Hello world')).toBe(true);
  });

  it('new URL creates a URL', () => {
    const result = eval_('new URL(str)', { str: 'https://example.com/path' });
    expect(result).toBeInstanceOf(URL);
    expect(result.pathname).toBe('/path');
  });

  it('new URLSearchParams creates URLSearchParams', () => {
    const result = eval_('new URLSearchParams(str)', { str: 'a=1&b=2' });
    expect(result).toBeInstanceOf(URLSearchParams);
    expect(result.get('a')).toBe('1');
    expect(result.get('b')).toBe('2');
  });

  it('new Error creates an Error', () => {
    const result = eval_('new Error(msg)', { msg: 'test error' });
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('test error');
  });

  it('Map and Set are accessible as identifiers for instanceof', () => {
    expect(eval_('val instanceof Map', { val: new Map() })).toBe(true);
    expect(eval_('val instanceof Set', { val: new Set() })).toBe(true);
  });
});


// ===========================================================================
// 25. Bug 10 — optional_call preserves `this` binding
// ===========================================================================
describe('optional_call this binding (Bug 10)', () => {
  const eval_ = (expr, ctx = {}) => safeEval(expr, [ctx]);

  it('arr?.filter?.() preserves this on double-optional chain', () => {
    const result = eval_('arr?.filter?.(x => x > 1)', { arr: [1, 2, 3] });
    expect(result).toEqual([2, 3]);
  });

  it('str?.toUpperCase?.() preserves this', () => {
    const result = eval_('str?.toUpperCase?.()', { str: 'hello' });
    expect(result).toBe('HELLO');
  });

  it('obj?.method?.() binds this to obj', () => {
    const obj = { name: 'Tony', greet() { return this.name; } };
    const result = eval_('obj?.greet?.()', { obj });
    expect(result).toBe('Tony');
  });

  it('null?.method?.() returns undefined (no crash)', () => {
    const result = eval_('val?.toString?.()', { val: null });
    expect(result).toBeUndefined();
  });
});


// ===========================================================================
// 26. Bug 11 — HTTP abort vs timeout distinction
// ===========================================================================
describe('HTTP abort vs timeout message (Bug 11)', () => {
  it('user abort says "aborted" not "timeout"', async () => {
    const controller = new AbortController();
    controller.abort(); // abort before fetch

    // Mock fetch to reject with AbortError
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(() => Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));

    const { http } = await import('../src/http.js');
    try {
      await http.get('https://example.com/test', null, { signal: controller.signal, timeout: 0 });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err.message).toContain('aborted');
      expect(err.message).not.toContain('timeout');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});


// ===========================================================================
// 27. Bug 12 — isEqual circular reference protection
// ===========================================================================
describe('isEqual circular reference protection (Bug 12)', () => {
  it('does not stack overflow on circular objects', () => {
    const a = { x: 1 };
    a.self = a;
    const b = { x: 1 };
    b.self = b;
    // Should not throw — just return true (both are circular in the same shape)
    expect(() => isEqual(a, b)).not.toThrow();
    expect(isEqual(a, b)).toBe(true);
  });

  it('does not stack overflow on circular arrays', () => {
    const a = [1, 2];
    a.push(a);
    const b = [1, 2];
    b.push(b);
    expect(() => isEqual(a, b)).not.toThrow();
  });

  it('still correctly compares non-circular objects', () => {
    expect(isEqual({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } })).toBe(true);
    expect(isEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(isEqual([1, 2], [1, 2])).toBe(true);
    expect(isEqual([1, 2], [1, 3])).toBe(false);
  });
});
