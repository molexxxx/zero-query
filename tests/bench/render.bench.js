// Micro-benchmarks for renderer hot paths.
// Run with: npm run bench
//
// Intentionally simple — used to detect regressions between branches,
// not to produce absolute numbers. Compare relative timings.

import { bench, describe } from 'vitest';
import { component, mount, destroy } from '../../src/component.js';
import { morph } from '../../src/diff.js';

// Register components at module top-level (vitest bench's beforeAll
// behaviour is unreliable across benchmark iterations).
component('zq-bench-small', {
  state: () => ({ items: Array.from({ length: 50 }, (_, i) => ({ id: i, label: 'item-' + i })) }),
  render() {
    return '<ul>' + this.state.items.map(it => `<li>${it.label}</li>`).join('') + '</ul>';
  }
});
component('zq-bench-medium', {
  state: () => ({ items: Array.from({ length: 200 }, (_, i) => ({ id: i, label: 'item-' + i })) }),
  render() {
    return '<ul>' + this.state.items.map(it => `<li>${it.label}</li>`).join('') + '</ul>';
  }
});
component('zq-bench-large', {
  state: () => ({ items: Array.from({ length: 1000 }, (_, i) => ({ id: i, label: 'item-' + i })) }),
  render() {
    return '<ul>' + this.state.items.map(it => `<li>${it.label}</li>`).join('') + '</ul>';
  }
});
component('zq-bench-directives', {
  state: () => ({ items: Array.from({ length: 100 }, (_, i) => ({ id: i, n: i, on: i % 2 === 0 })) }),
  render() {
    return this.state.items.map(it =>
      `<div :data-id="${it.id}" z-class="{ active: ${it.on} }" z-style="{ color: 'rgb(${it.n}, 0, 0)' }">x</div>`
    ).join('');
  }
});

let counter = 0;
function mountFresh(name) {
  const el = document.createElement('div');
  el.id = `b-${name}-${++counter}`;
  document.body.appendChild(el);
  mount(el, name);
  destroy('#' + el.id);
  el.remove();
}

describe('mount cost', () => {
  bench('mount 50-node component', () => { mountFresh('zq-bench-small'); });
  bench('mount 200-node component', () => { mountFresh('zq-bench-medium'); });
  bench('mount 1000-node component', () => { mountFresh('zq-bench-large'); });
});

describe('keyed reorder', () => {
  function listHTML(keys) {
    let s = '';
    for (const k of keys) s += `<li data-key="${k}">item-${k}</li>`;
    return s;
  }
  const N = 100;
  const orderA = Array.from({ length: N }, (_, i) => i);
  const orderB = [...orderA].reverse();
  const htmlA = listHTML(orderA);
  const htmlB = listHTML(orderB);

  bench('100-item shuffled (reverse) keyed morph', () => {
    const live = document.createElement('ul');
    live.innerHTML = htmlA;
    morph(live, htmlB);
  });
});

describe('directive scan', () => {
  bench('mount 100 z-bind/z-class/z-style elements', () => { mountFresh('zq-bench-directives'); });
});
