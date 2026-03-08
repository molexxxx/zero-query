import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { component, mount, mountAll, getInstance, destroy, getRegistry } from '../src/component.js';
import { ZQueryError } from '../src/errors.js';


// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeEach(() => {
  document.body.innerHTML = '';
});


// ---------------------------------------------------------------------------
// Component registration
// ---------------------------------------------------------------------------

describe('component() — registration', () => {
  it('registers a component', () => {
    component('test-comp', {
      state: () => ({ count: 0 }),
      render() { return `<p>${this.state.count}</p>`; },
    });
    const registry = getRegistry();
    expect(registry['test-comp']).toBeDefined();
  });

  it('throws ZQueryError if name has no hyphen', () => {
    expect(() => component('nohyphen', {})).toThrow(ZQueryError);
  });

  it('throws ZQueryError if name is empty', () => {
    expect(() => component('', {})).toThrow(ZQueryError);
  });

  it('throws ZQueryError if name is not a string', () => {
    expect(() => component(null, {})).toThrow(ZQueryError);
  });
});


// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

describe('mount()', () => {
  beforeEach(() => {
    component('mount-test', {
      state: () => ({ msg: 'Hello' }),
      render() { return `<div class="inner">${this.state.msg}</div>`; },
    });
    document.body.innerHTML = '<mount-test id="target"></mount-test>';
  });

  it('mounts component and renders HTML', () => {
    const instance = mount('#target', 'mount-test');
    expect(document.querySelector('.inner').textContent).toBe('Hello');
    expect(instance).toBeDefined();
  });

  it('throws ZQueryError for missing target', () => {
    expect(() => mount('#nonexistent', 'mount-test')).toThrow(ZQueryError);
  });

  it('throws ZQueryError for unregistered component', () => {
    expect(() => mount('#target', 'unknown-comp')).toThrow(ZQueryError);
  });

  it('getInstance returns instance after mount', () => {
    mount('#target', 'mount-test');
    const inst = getInstance('#target');
    expect(inst).not.toBeNull();
    expect(inst.state.msg).toBe('Hello');
  });
});


// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------

describe('component — lifecycle', () => {
  it('calls init on creation', () => {
    const initFn = vi.fn();
    component('life-init', {
      init: initFn,
      render() { return '<div>init</div>'; },
    });
    document.body.innerHTML = '<life-init id="li"></life-init>';
    mount('#li', 'life-init');
    expect(initFn).toHaveBeenCalledOnce();
  });

  it('calls mounted after first render', () => {
    const mountedFn = vi.fn();
    component('life-mounted', {
      mounted: mountedFn,
      render() { return '<div>mounted</div>'; },
    });
    document.body.innerHTML = '<life-mounted id="lm"></life-mounted>';
    mount('#lm', 'life-mounted');
    expect(mountedFn).toHaveBeenCalledOnce();
  });

  it('calls destroyed on destroy', () => {
    const destroyedFn = vi.fn();
    component('life-destroy', {
      destroyed: destroyedFn,
      render() { return '<div>destroy</div>'; },
    });
    document.body.innerHTML = '<life-destroy id="ld"></life-destroy>';
    mount('#ld', 'life-destroy');
    destroy('#ld');
    expect(destroyedFn).toHaveBeenCalledOnce();
  });

  it('does not crash when lifecycle hook throws', () => {
    component('life-throw', {
      init() { throw new Error('init error'); },
      render() { return '<div>throw</div>'; },
    });
    document.body.innerHTML = '<life-throw id="lt"></life-throw>';
    expect(() => mount('#lt', 'life-throw')).not.toThrow();
  });
});


// ---------------------------------------------------------------------------
// Reactive state
// ---------------------------------------------------------------------------

describe('component — reactive state', () => {
  it('re-renders on state change', async () => {
    component('react-state', {
      state: () => ({ count: 0 }),
      render() { return `<span class="count">${this.state.count}</span>`; },
    });
    document.body.innerHTML = '<react-state id="rs"></react-state>';
    const inst = mount('#rs', 'react-state');
    expect(document.querySelector('.count').textContent).toBe('0');

    inst.state.count = 5;
    // State update is batched via microtask
    await new Promise(r => queueMicrotask(r));
    expect(document.querySelector('.count').textContent).toBe('5');
  });
});


// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

describe('component — props', () => {
  it('receives props', () => {
    component('prop-test', {
      render() { return `<span class="prop">${this.props.label}</span>`; },
    });
    document.body.innerHTML = '<prop-test id="pt"></prop-test>';
    mount('#pt', 'prop-test', { label: 'Hello' });
    expect(document.querySelector('.prop').textContent).toBe('Hello');
  });

  it('props are frozen', () => {
    component('prop-freeze', {
      render() { return '<div>test</div>'; },
    });
    document.body.innerHTML = '<prop-freeze id="pf"></prop-freeze>';
    const inst = mount('#pf', 'prop-freeze', { x: 1 });
    expect(() => { inst.props.x = 2; }).toThrow();
  });
});


// ---------------------------------------------------------------------------
// Computed properties
// ---------------------------------------------------------------------------

describe('component — computed', () => {
  it('derives values from state', () => {
    component('comp-computed', {
      state: () => ({ count: 5 }),
      computed: {
        doubled(state) { return state.count * 2; },
      },
      render() { return `<span class="doubled">${this.computed.doubled}</span>`; },
    });
    document.body.innerHTML = '<comp-computed id="cc"></comp-computed>';
    const inst = mount('#cc', 'comp-computed');
    expect(inst.computed.doubled).toBe(10);
    expect(document.querySelector('.doubled').textContent).toBe('10');
  });
});


// ---------------------------------------------------------------------------
// User methods
// ---------------------------------------------------------------------------

describe('component — methods', () => {
  it('binds user methods to instance', () => {
    let captured;
    component('method-test', {
      state: () => ({ x: 42 }),
      myMethod() { captured = this.state.x; },
      render() { return '<div>methods</div>'; },
    });
    document.body.innerHTML = '<method-test id="mt"></method-test>';
    const inst = mount('#mt', 'method-test');
    inst.myMethod();
    expect(captured).toBe(42);
  });
});


// ---------------------------------------------------------------------------
// setState
// ---------------------------------------------------------------------------

describe('component — setState', () => {
  it('batch updates state', async () => {
    component('set-state', {
      state: () => ({ a: 1, b: 2 }),
      render() { return `<div>${this.state.a}-${this.state.b}</div>`; },
    });
    document.body.innerHTML = '<set-state id="ss"></set-state>';
    const inst = mount('#ss', 'set-state');
    inst.setState({ a: 10, b: 20 });
    await new Promise(r => queueMicrotask(r));
    expect(inst.state.a).toBe(10);
    expect(inst.state.b).toBe(20);
  });
});


// ---------------------------------------------------------------------------
// emit
// ---------------------------------------------------------------------------

describe('component — emit', () => {
  it('dispatches custom event', () => {
    component('emit-test', {
      render() { return '<div>emit</div>'; },
    });
    document.body.innerHTML = '<emit-test id="et"></emit-test>';
    const inst = mount('#et', 'emit-test');

    let received;
    document.querySelector('#et').addEventListener('my-event', (e) => {
      received = e.detail;
    });
    inst.emit('my-event', { data: 42 });
    expect(received).toEqual({ data: 42 });
  });
});


// ---------------------------------------------------------------------------
// destroy
// ---------------------------------------------------------------------------

describe('component — destroy', () => {
  it('clears innerHTML and removes from registry', () => {
    component('destroy-test', {
      render() { return '<div class="will-die">alive</div>'; },
    });
    document.body.innerHTML = '<destroy-test id="dt"></destroy-test>';
    mount('#dt', 'destroy-test');
    expect(document.querySelector('.will-die')).not.toBeNull();
    destroy('#dt');
    expect(document.querySelector('.will-die')).toBeNull();
    expect(getInstance('#dt')).toBeNull();
  });

  it('double destroy does not throw', () => {
    component('destroy-twice', {
      render() { return '<div>twice</div>'; },
    });
    document.body.innerHTML = '<destroy-twice id="d2"></destroy-twice>';
    mount('#d2', 'destroy-twice');
    destroy('#d2');
    expect(() => destroy('#d2')).not.toThrow();
  });
});


// ---------------------------------------------------------------------------
// mountAll
// ---------------------------------------------------------------------------

describe('mountAll()', () => {
  it('auto-mounts all registered component tags', () => {
    component('auto-a', {
      render() { return '<span class="auto-a">A</span>'; },
    });
    component('auto-b', {
      render() { return '<span class="auto-b">B</span>'; },
    });
    document.body.innerHTML = '<auto-a></auto-a><auto-b></auto-b>';
    mountAll();
    expect(document.querySelector('.auto-a').textContent).toBe('A');
    expect(document.querySelector('.auto-b').textContent).toBe('B');
  });
});
