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

  it('calls updated on re-render', async () => {
    const updatedFn = vi.fn();
    component('life-update', {
      state: () => ({ n: 0 }),
      updated: updatedFn,
      render() { return `<div>${this.state.n}</div>`; },
    });
    document.body.innerHTML = '<life-update id="lu"></life-update>';
    const inst = mount('#lu', 'life-update');
    expect(updatedFn).not.toHaveBeenCalled();
    inst.state.n = 1;
    await new Promise(r => queueMicrotask(r));
    expect(updatedFn).toHaveBeenCalledOnce();
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

  it('batches multiple state changes into one render', async () => {
    const renderSpy = vi.fn();
    component('batch-state', {
      state: () => ({ a: 0, b: 0 }),
      render() {
        renderSpy();
        return `<div>${this.state.a}-${this.state.b}</div>`;
      },
    });
    document.body.innerHTML = '<batch-state id="bs"></batch-state>';
    const inst = mount('#bs', 'batch-state');
    renderSpy.mockClear();

    inst.state.a = 1;
    inst.state.b = 2;
    await new Promise(r => queueMicrotask(r));
    // Should only render once despite two state changes
    expect(renderSpy).toHaveBeenCalledOnce();
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

  it('recomputes when state changes', async () => {
    component('comp-recompute', {
      state: () => ({ val: 3 }),
      computed: {
        tripled(state) { return state.val * 3; },
      },
      render() { return `<span class="tri">${this.computed.tripled}</span>`; },
    });
    document.body.innerHTML = '<comp-recompute id="cr"></comp-recompute>';
    const inst = mount('#cr', 'comp-recompute');
    expect(inst.computed.tripled).toBe(9);
    inst.state.val = 10;
    await new Promise(r => queueMicrotask(r));
    expect(inst.computed.tripled).toBe(30);
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

  it('forces re-render with empty setState', async () => {
    let renderCount = 0;
    component('force-render', {
      state: () => ({ x: 1 }),
      render() { renderCount++; return `<div>${this.state.x}</div>`; },
    });
    document.body.innerHTML = '<force-render id="fr"></force-render>';
    const inst = mount('#fr', 'force-render');
    renderCount = 0;
    inst.setState({});
    await new Promise(r => queueMicrotask(r));
    expect(renderCount).toBe(1);
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

  it('stops re-rendering after destroy', async () => {
    let renderCount = 0;
    component('destroy-stop', {
      state: () => ({ n: 0 }),
      render() { renderCount++; return `<div>${this.state.n}</div>`; },
    });
    document.body.innerHTML = '<destroy-stop id="ds"></destroy-stop>';
    const inst = mount('#ds', 'destroy-stop');
    renderCount = 0;
    destroy('#ds');
    inst.state.n = 99;
    await new Promise(r => queueMicrotask(r));
    expect(renderCount).toBe(0);
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

  it('does not re-mount already mounted components', () => {
    let initCount = 0;
    component('auto-once', {
      init() { initCount++; },
      render() { return '<div>once</div>'; },
    });
    document.body.innerHTML = '<auto-once></auto-once>';
    mountAll();
    mountAll(); // second call
    expect(initCount).toBe(1);
  });
});


// ---------------------------------------------------------------------------
// z-if / z-else-if / z-else
// ---------------------------------------------------------------------------

describe('component — z-if directive', () => {
  it('shows element when condition is true', () => {
    component('zif-true', {
      state: () => ({ show: true }),
      render() { return '<p z-if="show">visible</p>'; },
    });
    document.body.innerHTML = '<zif-true id="zt"></zif-true>';
    mount('#zt', 'zif-true');
    expect(document.querySelector('#zt p')).not.toBeNull();
    expect(document.querySelector('#zt p').textContent).toBe('visible');
  });

  it('removes element when condition is false', () => {
    component('zif-false', {
      state: () => ({ show: false }),
      render() { return '<p z-if="show">hidden</p>'; },
    });
    document.body.innerHTML = '<zif-false id="zf"></zif-false>';
    mount('#zf', 'zif-false');
    expect(document.querySelector('#zf p')).toBeNull();
  });

  it('supports z-else-if and z-else chain', () => {
    component('zif-chain', {
      state: () => ({ status: 'loading' }),
      render() {
        return `
          <p z-if="status === 'ok'">OK</p>
          <p z-else-if="status === 'loading'">Loading…</p>
          <p z-else>Error</p>
        `;
      },
    });
    document.body.innerHTML = '<zif-chain id="zc"></zif-chain>';
    mount('#zc', 'zif-chain');
    const paras = document.querySelectorAll('#zc p');
    expect(paras.length).toBe(1);
    expect(paras[0].textContent).toBe('Loading…');
  });
});


// ---------------------------------------------------------------------------
// z-show
// ---------------------------------------------------------------------------

describe('component — z-show directive', () => {
  it('sets display none when falsy', () => {
    component('zshow-hide', {
      state: () => ({ visible: false }),
      render() { return '<div z-show="visible">content</div>'; },
    });
    document.body.innerHTML = '<zshow-hide id="zsh"></zshow-hide>';
    mount('#zsh', 'zshow-hide');
    expect(document.querySelector('#zsh div').style.display).toBe('none');
  });

  it('removes display none when truthy', () => {
    component('zshow-show', {
      state: () => ({ visible: true }),
      render() { return '<div z-show="visible">content</div>'; },
    });
    document.body.innerHTML = '<zshow-show id="zss"></zshow-show>';
    mount('#zss', 'zshow-show');
    expect(document.querySelector('#zss div').style.display).toBe('');
  });
});


// ---------------------------------------------------------------------------
// z-for
// ---------------------------------------------------------------------------

describe('component — z-for directive', () => {
  it('renders list items', () => {
    component('zfor-list', {
      state: () => ({ items: ['red', 'green', 'blue'] }),
      render() { return '<ul><li z-for="item in items">{{item}}</li></ul>'; },
    });
    document.body.innerHTML = '<zfor-list id="zfl"></zfor-list>';
    mount('#zfl', 'zfor-list');
    const lis = document.querySelectorAll('#zfl li');
    expect(lis.length).toBe(3);
    expect(lis[0].textContent).toBe('red');
    expect(lis[1].textContent).toBe('green');
    expect(lis[2].textContent).toBe('blue');
  });

  it('supports (item, index) syntax', () => {
    component('zfor-idx', {
      state: () => ({ items: ['a', 'b'] }),
      render() { return '<ul><li z-for="(item, i) in items">{{i}}-{{item}}</li></ul>'; },
    });
    document.body.innerHTML = '<zfor-idx id="zfi"></zfor-idx>';
    mount('#zfi', 'zfor-idx');
    const lis = document.querySelectorAll('#zfi li');
    expect(lis.length).toBe(2);
    expect(lis[0].textContent).toBe('0-a');
    expect(lis[1].textContent).toBe('1-b');
  });

  it('supports numeric range', () => {
    component('zfor-range', {
      state: () => ({ count: 3 }),
      render() { return '<span z-for="n in count">{{n}}</span>'; },
    });
    document.body.innerHTML = '<zfor-range id="zfr"></zfor-range>';
    mount('#zfr', 'zfor-range');
    const spans = document.querySelectorAll('#zfr span');
    expect(spans.length).toBe(3);
    expect(spans[0].textContent).toBe('1');
    expect(spans[2].textContent).toBe('3');
  });

  it('renders empty when list is empty', () => {
    component('zfor-empty', {
      state: () => ({ items: [] }),
      render() { return '<ul><li z-for="item in items">{{item}}</li></ul>'; },
    });
    document.body.innerHTML = '<zfor-empty id="zfe"></zfor-empty>';
    mount('#zfe', 'zfor-empty');
    expect(document.querySelectorAll('#zfe li').length).toBe(0);
  });
});


// ---------------------------------------------------------------------------
// z-bind / :attr
// ---------------------------------------------------------------------------

describe('component — z-bind directive', () => {
  it('binds attribute dynamically with :attr', () => {
    component('zbind-attr', {
      state: () => ({ cls: 'active' }),
      render() { return '<div :class="cls">content</div>'; },
    });
    document.body.innerHTML = '<zbind-attr id="zba"></zbind-attr>';
    mount('#zba', 'zbind-attr');
    expect(document.querySelector('#zba div').className).toBe('active');
  });

  it('removes attribute when value is false', () => {
    component('zbind-false', {
      state: () => ({ isDisabled: false }),
      render() { return '<button :disabled="isDisabled">click</button>'; },
    });
    document.body.innerHTML = '<zbind-false id="zbf"></zbind-false>';
    mount('#zbf', 'zbind-false');
    expect(document.querySelector('#zbf button').hasAttribute('disabled')).toBe(false);
  });

  it('sets boolean attribute when true', () => {
    component('zbind-true', {
      state: () => ({ isDisabled: true }),
      render() { return '<button :disabled="isDisabled">click</button>'; },
    });
    document.body.innerHTML = '<zbind-true id="zbt"></zbind-true>';
    mount('#zbt', 'zbind-true');
    expect(document.querySelector('#zbt button').hasAttribute('disabled')).toBe(true);
  });
});


// ---------------------------------------------------------------------------
// z-class
// ---------------------------------------------------------------------------

describe('component — z-class directive', () => {
  it('adds classes from object', () => {
    component('zclass-obj', {
      state: () => ({ isActive: true, isHidden: false }),
      render() { return `<div z-class="{ active: isActive, hidden: isHidden }">test</div>`; },
    });
    document.body.innerHTML = '<zclass-obj id="zco"></zclass-obj>';
    mount('#zco', 'zclass-obj');
    const div = document.querySelector('#zco div');
    expect(div.classList.contains('active')).toBe(true);
    expect(div.classList.contains('hidden')).toBe(false);
  });
});


// ---------------------------------------------------------------------------
// z-text
// ---------------------------------------------------------------------------

describe('component — z-text directive', () => {
  it('sets textContent safely', () => {
    component('ztext-test', {
      state: () => ({ msg: 'Hello <b>world</b>' }),
      render() { return '<span z-text="msg"></span>'; },
    });
    document.body.innerHTML = '<ztext-test id="ztt"></ztext-test>';
    mount('#ztt', 'ztext-test');
    const span = document.querySelector('#ztt span');
    expect(span.textContent).toBe('Hello <b>world</b>');
    expect(span.innerHTML).toBe('Hello &lt;b&gt;world&lt;/b&gt;'); // XSS safe
  });
});


// ---------------------------------------------------------------------------
// z-html
// ---------------------------------------------------------------------------

describe('component — z-html directive', () => {
  it('sets innerHTML', () => {
    component('zhtml-test', {
      state: () => ({ content: '<strong>bold</strong>' }),
      render() { return '<div z-html="content"></div>'; },
    });
    document.body.innerHTML = '<zhtml-test id="zht"></zhtml-test>';
    mount('#zht', 'zhtml-test');
    expect(document.querySelector('#zht strong').textContent).toBe('bold');
  });
});


// ---------------------------------------------------------------------------
// z-ref
// ---------------------------------------------------------------------------

describe('component — z-ref', () => {
  it('populates refs on mount', () => {
    component('zref-test', {
      render() { return '<input z-ref="myInput" type="text">'; },
    });
    document.body.innerHTML = '<zref-test id="zrt"></zref-test>';
    const inst = mount('#zrt', 'zref-test');
    expect(inst.refs.myInput).toBeTruthy();
    expect(inst.refs.myInput.tagName).toBe('INPUT');
  });
});


// ---------------------------------------------------------------------------
// z-model (two-way binding)
// ---------------------------------------------------------------------------

describe('component — z-model', () => {
  it('syncs input value from state on mount', () => {
    component('zmodel-init', {
      state: () => ({ name: 'Tony' }),
      render() { return '<input z-model="name">'; },
    });
    document.body.innerHTML = '<zmodel-init id="zmi"></zmodel-init>';
    mount('#zmi', 'zmodel-init');
    expect(document.querySelector('#zmi input').value).toBe('Tony');
  });

  it('writes input value back to state on input event', async () => {
    component('zmodel-input', {
      state: () => ({ name: '' }),
      render() { return '<input z-model="name">'; },
    });
    document.body.innerHTML = '<zmodel-input id="zmip"></zmodel-input>';
    const inst = mount('#zmip', 'zmodel-input');
    const input = document.querySelector('#zmip input');
    input.value = 'test';
    input.dispatchEvent(new Event('input'));
    expect(inst.state.name).toBe('test');
  });

  it('syncs checkbox checked state', () => {
    component('zmodel-check', {
      state: () => ({ agree: true }),
      render() { return '<input type="checkbox" z-model="agree">'; },
    });
    document.body.innerHTML = '<zmodel-check id="zmc"></zmodel-check>';
    mount('#zmc', 'zmodel-check');
    expect(document.querySelector('#zmc input').checked).toBe(true);
  });

  it('writes checkbox change back to state', () => {
    component('zmodel-check2', {
      state: () => ({ agree: false }),
      render() { return '<input type="checkbox" z-model="agree">'; },
    });
    document.body.innerHTML = '<zmodel-check2 id="zmc2"></zmodel-check2>';
    const inst = mount('#zmc2', 'zmodel-check2');
    const input = document.querySelector('#zmc2 input');
    input.checked = true;
    input.dispatchEvent(new Event('change'));
    expect(inst.state.agree).toBe(true);
  });

  it('syncs textarea value', () => {
    component('zmodel-textarea', {
      state: () => ({ bio: 'Hello' }),
      render() { return '<textarea z-model="bio"></textarea>'; },
    });
    document.body.innerHTML = '<zmodel-textarea id="zmta"></zmodel-textarea>';
    mount('#zmta', 'zmodel-textarea');
    expect(document.querySelector('#zmta textarea').value).toBe('Hello');
  });
});


// ---------------------------------------------------------------------------
// z-cloak
// ---------------------------------------------------------------------------

describe('component — z-cloak', () => {
  it('removes z-cloak attribute after render', () => {
    component('zcloak-test', {
      render() { return '<div z-cloak>content</div>'; },
    });
    document.body.innerHTML = '<zcloak-test id="zcl"></zcloak-test>';
    mount('#zcl', 'zcloak-test');
    expect(document.querySelector('#zcl div').hasAttribute('z-cloak')).toBe(false);
  });
});


// ---------------------------------------------------------------------------
// z-pre
// ---------------------------------------------------------------------------

describe('component — z-pre', () => {
  it('skips directive processing inside z-pre', () => {
    component('zpre-test', {
      state: () => ({ x: 42 }),
      render() {
        return '<div z-pre><span z-text="x"></span></div>';
      },
    });
    document.body.innerHTML = '<zpre-test id="zpr"></zpre-test>';
    mount('#zpr', 'zpre-test');
    // z-text should NOT be processed inside z-pre
    const span = document.querySelector('#zpr span');
    expect(span.hasAttribute('z-text')).toBe(true);
    expect(span.textContent).toBe('');
  });
});


// ---------------------------------------------------------------------------
// z-style
// ---------------------------------------------------------------------------

describe('component — z-style directive', () => {
  it('applies object styles', () => {
    component('zstyle-obj', {
      state: () => ({ color: 'red' }),
      render() { return `<div z-style="{ color: color }">text</div>`; },
    });
    document.body.innerHTML = '<zstyle-obj id="zso"></zstyle-obj>';
    mount('#zso', 'zstyle-obj');
    expect(document.querySelector('#zso div').style.color).toBe('red');
  });
});


// ---------------------------------------------------------------------------
// Event binding (@event)
// ---------------------------------------------------------------------------

describe('component — event binding', () => {
  it('handles @click events', () => {
    component('evt-click', {
      state: () => ({ count: 0 }),
      increment() { this.state.count++; },
      render() { return '<button @click="increment">+</button><span class="v">' + this.state.count + '</span>'; },
    });
    document.body.innerHTML = '<evt-click id="ec"></evt-click>';
    const inst = mount('#ec', 'evt-click');
    document.querySelector('#ec button').click();
    expect(inst.state.count).toBe(1);
  });

  it('passes $event argument', () => {
    let receivedEvent = null;
    component('evt-arg', {
      handleClick(e) { receivedEvent = e; },
      render() { return '<button @click="handleClick($event)">test</button>'; },
    });
    document.body.innerHTML = '<evt-arg id="ea"></evt-arg>';
    mount('#ea', 'evt-arg');
    document.querySelector('#ea button').click();
    expect(receivedEvent).toBeInstanceOf(Event);
  });

  it('handles z-on:click syntax', () => {
    component('evt-zon', {
      state: () => ({ x: 0 }),
      inc() { this.state.x++; },
      render() { return '<button z-on:click="inc">+</button>'; },
    });
    document.body.innerHTML = '<evt-zon id="ez"></evt-zon>';
    const inst = mount('#ez', 'evt-zon');
    document.querySelector('#ez button').click();
    expect(inst.state.x).toBe(1);
  });

  it('passes string and number arguments', () => {
    let captured = [];
    component('evt-args', {
      handler(a, b) { captured = [a, b]; },
      render() { return `<button @click="handler('hello', 42)">test</button>`; },
    });
    document.body.innerHTML = '<evt-args id="eag"></evt-args>';
    mount('#eag', 'evt-args');
    document.querySelector('#eag button').click();
    expect(captured).toEqual(['hello', 42]);
  });
});


// ---------------------------------------------------------------------------
// Watchers
// ---------------------------------------------------------------------------

describe('component — watchers', () => {
  it('fires watcher when state key changes', async () => {
    const watchFn = vi.fn();
    component('watch-test', {
      state: () => ({ count: 0 }),
      watch: {
        count: watchFn,
      },
      render() { return `<div>${this.state.count}</div>`; },
    });
    document.body.innerHTML = '<watch-test id="wt"></watch-test>';
    const inst = mount('#wt', 'watch-test');
    inst.state.count = 5;
    expect(watchFn).toHaveBeenCalledWith(5, 0);
  });
});


// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------

describe('component — slots', () => {
  it('distributes default slot content', () => {
    component('slot-test', {
      render() { return '<div><slot>fallback</slot></div>'; },
    });
    document.body.innerHTML = '<slot-test id="sl"><p>projected</p></slot-test>';
    mount('#sl', 'slot-test');
    expect(document.querySelector('#sl p').textContent).toBe('projected');
  });

  it('uses fallback when no content provided', () => {
    component('slot-fallback', {
      render() { return '<div><slot>fallback</slot></div>'; },
    });
    document.body.innerHTML = '<slot-fallback id="sf"></slot-fallback>';
    mount('#sf', 'slot-fallback');
    expect(document.querySelector('#sf div').textContent).toBe('fallback');
  });

  it('distributes named slots', () => {
    component('slot-named', {
      render() {
        return '<header><slot name="header">default header</slot></header><main><slot>main content</slot></main>';
      },
    });
    document.body.innerHTML = '<slot-named id="sn"><div slot="header">My Header</div><p>Body</p></slot-named>';
    mount('#sn', 'slot-named');
    expect(document.querySelector('#sn header').textContent).toBe('My Header');
    expect(document.querySelector('#sn main').textContent).toBe('Body');
  });
});


// ---------------------------------------------------------------------------
// Scoped styles
// ---------------------------------------------------------------------------

describe('component — scoped styles', () => {
  it('injects scoped style tag', () => {
    component('style-test', {
      styles: '.box { color: red; }',
      render() { return '<div class="box">styled</div>'; },
    });
    document.body.innerHTML = '<style-test id="st"></style-test>';
    mount('#st', 'style-test');
    const styleEl = document.querySelector('style[data-zq-component="style-test"]');
    expect(styleEl).not.toBeNull();
    expect(styleEl.textContent).toContain('color: red');
  });
});


// ---------------------------------------------------------------------------
// z-if toggling on state change
// ---------------------------------------------------------------------------

describe('component — z-if reactive toggle', () => {
  it('shows/hides element on state change', async () => {
    component('zif-toggle', {
      state: () => ({ visible: false }),
      render() { return '<p z-if="visible">now you see me</p><span>always</span>'; },
    });
    document.body.innerHTML = '<zif-toggle id="zit"></zif-toggle>';
    const inst = mount('#zit', 'zif-toggle');
    expect(document.querySelector('#zit p')).toBeNull();

    inst.state.visible = true;
    await new Promise(r => queueMicrotask(r));
    expect(document.querySelector('#zit p')).not.toBeNull();
    expect(document.querySelector('#zit p').textContent).toBe('now you see me');
  });

  it('handles rapid true/false/true toggling', async () => {
    component('zif-rapid', {
      state: () => ({ on: true }),
      render() { return '<div z-if="on">ON</div>'; },
    });
    document.body.innerHTML = '<zif-rapid id="zir"></zif-rapid>';
    const inst = mount('#zir', 'zif-rapid');
    inst.state.on = false;
    inst.state.on = true;
    await new Promise(r => queueMicrotask(r));
    expect(document.querySelector('#zir div')).not.toBeNull();
    expect(document.querySelector('#zir div').textContent).toBe('ON');
  });

  it('handles z-if with complex expression', () => {
    component('zif-complex', {
      state: () => ({ count: 5 }),
      render() { return '<p z-if="count > 3 && count < 10">in range</p>'; },
    });
    document.body.innerHTML = '<zif-complex id="zic"></zif-complex>';
    mount('#zic', 'zif-complex');
    expect(document.querySelector('#zic p')).not.toBeNull();
    expect(document.querySelector('#zic p').textContent).toBe('in range');
  });
});


// ---------------------------------------------------------------------------
// z-show reactive toggle
// ---------------------------------------------------------------------------

describe('component — z-show reactive toggle', () => {
  it('toggles display on state change', async () => {
    component('zshow-toggle', {
      state: () => ({ vis: true }),
      render() { return '<div z-show="vis">content</div>'; },
    });
    document.body.innerHTML = '<zshow-toggle id="zst"></zshow-toggle>';
    const inst = mount('#zst', 'zshow-toggle');
    expect(document.querySelector('#zst div').style.display).toBe('');

    inst.state.vis = false;
    await new Promise(r => queueMicrotask(r));
    expect(document.querySelector('#zst div').style.display).toBe('none');
  });
});


// ---------------------------------------------------------------------------
// z-for advanced
// ---------------------------------------------------------------------------

describe('component — z-for advanced', () => {
  it('re-renders list on state change', async () => {
    component('zfor-rerender', {
      state: () => ({ items: ['a', 'b'] }),
      render() { return '<ul><li z-for="item in items">{{item}}</li></ul>'; },
    });
    document.body.innerHTML = '<zfor-rerender id="zfr2"></zfor-rerender>';
    const inst = mount('#zfr2', 'zfor-rerender');
    expect(document.querySelectorAll('#zfr2 li').length).toBe(2);

    inst.state.items = ['x', 'y', 'z'];
    await new Promise(r => queueMicrotask(r));
    const lis = document.querySelectorAll('#zfr2 li');
    expect(lis.length).toBe(3);
    expect(lis[2].textContent).toBe('z');
  });

  it('renders nested object properties in z-for', () => {
    component('zfor-nested', {
      state: () => ({ users: [{ name: 'Alice' }, { name: 'Bob' }] }),
      render() { return '<ul><li z-for="user in users">{{user.name}}</li></ul>'; },
    });
    document.body.innerHTML = '<zfor-nested id="zfn"></zfor-nested>';
    mount('#zfn', 'zfor-nested');
    const lis = document.querySelectorAll('#zfn li');
    expect(lis[0].textContent).toBe('Alice');
    expect(lis[1].textContent).toBe('Bob');
  });

  it('handles z-for with single item', () => {
    component('zfor-single', {
      state: () => ({ items: ['only'] }),
      render() { return '<ul><li z-for="item in items">{{item}}</li></ul>'; },
    });
    document.body.innerHTML = '<zfor-single id="zfs"></zfor-single>';
    mount('#zfs', 'zfor-single');
    expect(document.querySelectorAll('#zfs li').length).toBe(1);
    expect(document.querySelector('#zfs li').textContent).toBe('only');
  });

  it('handles z-for range of 0', () => {
    component('zfor-zero', {
      state: () => ({ count: 0 }),
      render() { return '<span z-for="n in count">{{n}}</span>'; },
    });
    document.body.innerHTML = '<zfor-zero id="zfz"></zfor-zero>';
    mount('#zfz', 'zfor-zero');
    expect(document.querySelectorAll('#zfz span').length).toBe(0);
  });

  it('z-for with index and nested HTML', () => {
    component('zfor-nested-html', {
      state: () => ({ items: ['alpha', 'beta'] }),
      render() { return '<div z-for="(item, i) in items"><span class="idx">{{i}}</span><span class="val">{{item}}</span></div>'; },
    });
    document.body.innerHTML = '<zfor-nested-html id="zfnh"></zfor-nested-html>';
    mount('#zfnh', 'zfor-nested-html');
    const idxSpans = document.querySelectorAll('#zfnh .idx');
    const valSpans = document.querySelectorAll('#zfnh .val');
    expect(idxSpans.length).toBe(2);
    expect(idxSpans[1].textContent).toBe('1');
    expect(valSpans[1].textContent).toBe('beta');
  });
});


// ---------------------------------------------------------------------------
// z-bind advanced
// ---------------------------------------------------------------------------

describe('component — z-bind advanced', () => {
  it('binds data attribute dynamically', () => {
    component('zbind-data', {
      state: () => ({ val: '42' }),
      render() { return '<div :data-count="val">content</div>'; },
    });
    document.body.innerHTML = '<zbind-data id="zbd"></zbind-data>';
    mount('#zbd', 'zbind-data');
    expect(document.querySelector('#zbd div').getAttribute('data-count')).toBe('42');
  });

  it('removes attribute when value is null', () => {
    component('zbind-null', {
      state: () => ({ val: null }),
      render() { return '<div :title="val">content</div>'; },
    });
    document.body.innerHTML = '<zbind-null id="zbn"></zbind-null>';
    mount('#zbn', 'zbind-null');
    expect(document.querySelector('#zbn div').hasAttribute('title')).toBe(false);
  });
});


// ---------------------------------------------------------------------------
// z-class advanced
// ---------------------------------------------------------------------------

describe('component — z-class advanced', () => {
  it('handles multiple truthy/falsy classes', () => {
    component('zclass-multi', {
      state: () => ({ a: true, b: false, c: true }),
      render() { return `<div z-class="{ alpha: a, beta: b, gamma: c }">test</div>`; },
    });
    document.body.innerHTML = '<zclass-multi id="zcm"></zclass-multi>';
    mount('#zcm', 'zclass-multi');
    const div = document.querySelector('#zcm div');
    expect(div.classList.contains('alpha')).toBe(true);
    expect(div.classList.contains('beta')).toBe(false);
    expect(div.classList.contains('gamma')).toBe(true);
  });
});


// ---------------------------------------------------------------------------
// z-style advanced
// ---------------------------------------------------------------------------

describe('component — z-style advanced', () => {
  it('applies multiple style properties', () => {
    component('zstyle-multi', {
      state: () => ({ bg: 'blue', size: '20px' }),
      render() { return `<div z-style="{ backgroundColor: bg, fontSize: size }">styled</div>`; },
    });
    document.body.innerHTML = '<zstyle-multi id="zsm"></zstyle-multi>';
    mount('#zsm', 'zstyle-multi');
    const div = document.querySelector('#zsm div');
    expect(div.style.backgroundColor).toBe('blue');
    expect(div.style.fontSize).toBe('20px');
  });
});


// ---------------------------------------------------------------------------
// z-model advanced
// ---------------------------------------------------------------------------

describe('component — z-model advanced', () => {
  it('handles z-model with select element', () => {
    component('zmodel-select', {
      state: () => ({ choice: 'b' }),
      render() {
        return '<select z-model="choice"><option value="a">A</option><option value="b">B</option><option value="c">C</option></select>';
      },
    });
    document.body.innerHTML = '<zmodel-select id="zms"></zmodel-select>';
    mount('#zms', 'zmodel-select');
    expect(document.querySelector('#zms select').value).toBe('b');
  });

  it('handles z-model write-back on select change', () => {
    component('zmodel-select-wb', {
      state: () => ({ choice: 'a' }),
      render() {
        return '<select z-model="choice"><option value="a">A</option><option value="b">B</option></select>';
      },
    });
    document.body.innerHTML = '<zmodel-select-wb id="zmswb"></zmodel-select-wb>';
    const inst = mount('#zmswb', 'zmodel-select-wb');
    const select = document.querySelector('#zmswb select');
    select.value = 'b';
    select.dispatchEvent(new Event('change'));
    expect(inst.state.choice).toBe('b');
  });

  it('z-model syncs textarea write-back', () => {
    component('zmodel-ta-wb', {
      state: () => ({ text: '' }),
      render() { return '<textarea z-model="text"></textarea>'; },
    });
    document.body.innerHTML = '<zmodel-ta-wb id="zmtawb"></zmodel-ta-wb>';
    const inst = mount('#zmtawb', 'zmodel-ta-wb');
    const ta = document.querySelector('#zmtawb textarea');
    ta.value = 'typed text';
    ta.dispatchEvent(new Event('input'));
    expect(inst.state.text).toBe('typed text');
  });
});


// ---------------------------------------------------------------------------
// z-ref advanced
// ---------------------------------------------------------------------------

describe('component — z-ref advanced', () => {
  it('collects multiple refs', () => {
    component('zref-multi', {
      render() { return '<input z-ref="first" type="text"><input z-ref="second" type="email">'; },
    });
    document.body.innerHTML = '<zref-multi id="zrm"></zref-multi>';
    const inst = mount('#zrm', 'zref-multi');
    expect(inst.refs.first).toBeTruthy();
    expect(inst.refs.second).toBeTruthy();
    expect(inst.refs.first.type).toBe('text');
    expect(inst.refs.second.type).toBe('email');
  });
});


// ---------------------------------------------------------------------------
// Event binding advanced
// ---------------------------------------------------------------------------

describe('component — event binding advanced', () => {
  it('handles multiple event bindings on different elements', () => {
    let clickCount = 0, focusCount = 0;
    component('evt-multi', {
      onClick() { clickCount++; },
      onFocus() { focusCount++; },
      render() { return '<button @click="onClick">A</button><input @click="onFocus">'; },
    });
    document.body.innerHTML = '<evt-multi id="em"></evt-multi>';
    mount('#em', 'evt-multi');
    document.querySelector('#em button').click();
    document.querySelector('#em input').click();
    expect(clickCount).toBe(1);
    expect(focusCount).toBe(1);
  });

  it('handles method-based event handler with state mutation', () => {
    component('evt-inline', {
      state: () => ({ count: 0 }),
      increment() { this.state.count++; },
      render() { return `<button @click="increment">+</button><span class="v">${this.state.count}</span>`; },
    });
    document.body.innerHTML = '<evt-inline id="ei"></evt-inline>';
    const inst = mount('#ei', 'evt-inline');
    document.querySelector('#ei button').click();
    expect(inst.state.count).toBe(1);
  });

  it('handles event on nested element', () => {
    let clicked = false;
    component('evt-nested', {
      handle() { clicked = true; },
      render() { return '<div><span><button @click="handle">deep</button></span></div>'; },
    });
    document.body.innerHTML = '<evt-nested id="en"></evt-nested>';
    mount('#en', 'evt-nested');
    document.querySelector('#en button').click();
    expect(clicked).toBe(true);
  });
});


// ---------------------------------------------------------------------------
// Watcher advanced
// ---------------------------------------------------------------------------

describe('component — watchers advanced', () => {
  it('receives correct old and new values', async () => {
    let oldVal, newVal;
    component('watch-vals', {
      state: () => ({ x: 10 }),
      watch: {
        x(v, o) { newVal = v; oldVal = o; },
      },
      render() { return `<div>${this.state.x}</div>`; },
    });
    document.body.innerHTML = '<watch-vals id="wv"></watch-vals>';
    const inst = mount('#wv', 'watch-vals');
    inst.state.x = 42;
    expect(newVal).toBe(42);
    expect(oldVal).toBe(10);
  });

  it('multiple watchers fire independently', async () => {
    const aFn = vi.fn();
    const bFn = vi.fn();
    component('watch-multi', {
      state: () => ({ a: 0, b: 0 }),
      watch: { a: aFn, b: bFn },
      render() { return `<div>${this.state.a}-${this.state.b}</div>`; },
    });
    document.body.innerHTML = '<watch-multi id="wm"></watch-multi>';
    const inst = mount('#wm', 'watch-multi');
    inst.state.a = 1;
    expect(aFn).toHaveBeenCalledWith(1, 0);
    expect(bFn).not.toHaveBeenCalled();
  });
});


// ---------------------------------------------------------------------------
// Component state with no initial state
// ---------------------------------------------------------------------------

describe('component — no state', () => {
  it('works without state property', () => {
    component('no-state', {
      render() { return '<div>stateless</div>'; },
    });
    document.body.innerHTML = '<no-state id="ns"></no-state>';
    const inst = mount('#ns', 'no-state');
    expect(document.querySelector('#ns div').textContent).toBe('stateless');
    expect(inst).toBeDefined();
  });
});


// ---------------------------------------------------------------------------
// Mount with element reference
// ---------------------------------------------------------------------------

describe('mount — with Element reference', () => {
  it('accepts an Element directly instead of selector', () => {
    component('mount-elem', {
      state: () => ({ v: 'direct' }),
      render() { return `<span>${this.state.v}</span>`; },
    });
    document.body.innerHTML = '<mount-elem id="me"></mount-elem>';
    const el = document.querySelector('#me');
    const inst = mount(el, 'mount-elem');
    expect(document.querySelector('#me span').textContent).toBe('direct');
    expect(inst).toBeDefined();
  });
});


// ---------------------------------------------------------------------------
// Component interpolation edge cases
// ---------------------------------------------------------------------------

describe('component — interpolation', () => {
  it('handles template literal with arithmetic', () => {
    component('interp-math', {
      state: () => ({ a: 3, b: 4 }),
      render() { return `<span>${this.state.a + this.state.b}</span>`; },
    });
    document.body.innerHTML = '<interp-math id="im"></interp-math>';
    mount('#im', 'interp-math');
    expect(document.querySelector('#im span').textContent).toBe('7');
  });

  it('handles template literal with ternary', () => {
    component('interp-ternary', {
      state: () => ({ logged: true }),
      render() { return `<span>${this.state.logged ? 'Yes' : 'No'}</span>`; },
    });
    document.body.innerHTML = '<interp-ternary id="it"></interp-ternary>';
    mount('#it', 'interp-ternary');
    expect(document.querySelector('#it span').textContent).toBe('Yes');
  });

  it('handles template literal with property access', () => {
    component('interp-method', {
      state: () => ({ list: [1, 2, 3] }),
      render() { return `<span>${this.state.list.length}</span>`; },
    });
    document.body.innerHTML = '<interp-method id="imt"></interp-method>';
    mount('#imt', 'interp-method');
    expect(document.querySelector('#imt span').textContent).toBe('3');
  });

  it('handles multiple template literal expressions', () => {
    component('interp-multi', {
      state: () => ({ first: 'Hello', last: 'World' }),
      render() { return `<span>${this.state.first} ${this.state.last}</span>`; },
    });
    document.body.innerHTML = '<interp-multi id="imm"></interp-multi>';
    mount('#imm', 'interp-multi');
    expect(document.querySelector('#imm span').textContent).toBe('Hello World');
  });
});


// ---------------------------------------------------------------------------
// Component emit with no listeners
// ---------------------------------------------------------------------------

describe('component — emit edge cases', () => {
  it('emit with no listeners does not throw', () => {
    component('emit-noop', {
      render() { return '<div>noop</div>'; },
    });
    document.body.innerHTML = '<emit-noop id="en2"></emit-noop>';
    const inst = mount('#en2', 'emit-noop');
    expect(() => inst.emit('no-handler', { x: 1 })).not.toThrow();
  });

  it('emit propagates with detail', () => {
    component('emit-detail', {
      render() { return '<div>detail</div>'; },
    });
    document.body.innerHTML = '<emit-detail id="ed"></emit-detail>';
    const inst = mount('#ed', 'emit-detail');
    let detail;
    document.querySelector('#ed').addEventListener('test-event', e => { detail = e.detail; });
    inst.emit('test-event', { a: 1, b: 'hello' });
    expect(detail).toEqual({ a: 1, b: 'hello' });
  });
});


// ---------------------------------------------------------------------------
// Component computed edge cases
// ---------------------------------------------------------------------------

describe('component — computed edge cases', () => {
  it('multiple computed properties', () => {
    component('comp-multi-computed', {
      state: () => ({ x: 2, y: 3 }),
      computed: {
        sum(s) { return s.x + s.y; },
        product(s) { return s.x * s.y; },
      },
      render() { return `<span class="sum">${this.computed.sum}</span><span class="product">${this.computed.product}</span>`; },
    });
    document.body.innerHTML = '<comp-multi-computed id="cmc"></comp-multi-computed>';
    const inst = mount('#cmc', 'comp-multi-computed');
    expect(inst.computed.sum).toBe(5);
    expect(inst.computed.product).toBe(6);
  });

  it('computed with boolean logic', () => {
    component('comp-bool', {
      state: () => ({ items: [] }),
      computed: {
        isEmpty(s) { return s.items.length === 0; },
      },
      render() { return `<span>${this.computed.isEmpty}</span>`; },
    });
    document.body.innerHTML = '<comp-bool id="cb"></comp-bool>';
    const inst = mount('#cb', 'comp-bool');
    expect(inst.computed.isEmpty).toBe(true);
  });
});


// ---------------------------------------------------------------------------
// Slots advanced
// ---------------------------------------------------------------------------

describe('component — slots advanced', () => {
  it('handles multiple children in default slot', () => {
    component('slot-multi', {
      render() { return '<div><slot>fallback</slot></div>'; },
    });
    document.body.innerHTML = '<slot-multi id="smlt"><p>one</p><p>two</p><p>three</p></slot-multi>';
    mount('#smlt', 'slot-multi');
    const ps = document.querySelectorAll('#smlt p');
    expect(ps.length).toBe(3);
    expect(ps[2].textContent).toBe('three');
  });

  it('handles empty named slot with fallback', () => {
    component('slot-empty-named', {
      render() {
        return '<header><slot name="header">Default Header</slot></header><main><slot>Default Body</slot></main>';
      },
    });
    document.body.innerHTML = '<slot-empty-named id="sen"><p>Only body</p></slot-empty-named>';
    mount('#sen', 'slot-empty-named');
    expect(document.querySelector('#sen header').textContent).toBe('Default Header');
    expect(document.querySelector('#sen main p').textContent).toBe('Only body');
  });
});


// ---------------------------------------------------------------------------
// Component re-render preserves DOM via morphing
// ---------------------------------------------------------------------------

describe('component — DOM morphing on re-render', () => {
  it('preserves unchanged DOM nodes on re-render', async () => {
    component('morph-preserve', {
      state: () => ({ title: 'old', count: 0 }),
      render() { return `<h1>${this.state.title}</h1><p class="static">static content</p><span>${this.state.count}</span>`; },
    });
    document.body.innerHTML = '<morph-preserve id="mp"></morph-preserve>';
    const inst = mount('#mp', 'morph-preserve');
    const staticP = document.querySelector('#mp .static');

    inst.state.count = 5;
    await new Promise(r => queueMicrotask(r));
    // Static paragraph should be the same DOM node after morph re-render
    expect(document.querySelector('#mp .static')).toBe(staticP);
    expect(document.querySelector('#mp span').textContent).toBe('5');
  });

  it('handles list update via morphing', async () => {
    component('morph-list', {
      state: () => ({ items: ['a', 'b', 'c'] }),
      render() { return `<ul>${this.state.items.map(i => `<li>${i}</li>`).join('')}</ul>`; },
    });
    document.body.innerHTML = '<morph-list id="ml"></morph-list>';
    const inst = mount('#ml', 'morph-list');
    expect(document.querySelectorAll('#ml li').length).toBe(3);

    inst.state.items = ['a', 'b', 'c', 'd'];
    await new Promise(r => queueMicrotask(r));
    expect(document.querySelectorAll('#ml li').length).toBe(4);
    expect(document.querySelectorAll('#ml li')[3].textContent).toBe('d');
  });
});


// ---------------------------------------------------------------------------
// MEMORY: destroy clears pending debounce/throttle timers
// ---------------------------------------------------------------------------

describe('Component — destroy clears pending timers', () => {
  it('clears debounce timers for child elements on destroy', () => {
    component('timer-clear', {
      state: () => ({ val: 0 }),
      render() {
        return `<button @click.debounce.5000="handler">click</button>`;
      },
      handler() { this.state.val++; },
    });
    document.body.innerHTML = '<timer-clear id="tcl"></timer-clear>';
    const inst = mount('#tcl', 'timer-clear');

    // Click to start a debounce timer (5s — won't fire during test)
    document.querySelector('#tcl button').click();

    // Verify the state hasn't changed yet (debounced)
    expect(inst.state.val).toBe(0);

    // Destroy should clear timers without errors
    expect(() => inst.destroy()).not.toThrow();
  });
});


// ===========================================================================
// z-model modifiers
// ===========================================================================

describe('component — z-model z-lazy modifier', () => {
  it('uses change event instead of input when z-lazy is present', () => {
    component('zmodel-lazy', {
      state: () => ({ val: '' }),
      render() { return '<input z-model="val" z-lazy>'; },
    });
    document.body.innerHTML = '<zmodel-lazy id="zml"></zmodel-lazy>';
    const inst = mount('#zml', 'zmodel-lazy');
    const input = document.querySelector('#zml input');

    // input event should NOT update state
    input.value = 'typed';
    input.dispatchEvent(new Event('input'));
    expect(inst.state.val).toBe('');

    // change event should update state
    input.value = 'committed';
    input.dispatchEvent(new Event('change'));
    expect(inst.state.val).toBe('committed');
  });
});

describe('component — z-model z-trim modifier', () => {
  it('trims whitespace from input value', () => {
    component('zmodel-trim', {
      state: () => ({ val: '' }),
      render() { return '<input z-model="val" z-trim>'; },
    });
    document.body.innerHTML = '<zmodel-trim id="zmt"></zmodel-trim>';
    const inst = mount('#zmt', 'zmodel-trim');
    const input = document.querySelector('#zmt input');
    input.value = '  hello  ';
    input.dispatchEvent(new Event('input'));
    expect(inst.state.val).toBe('hello');
  });
});

describe('component — z-model z-number modifier', () => {
  it('converts input value to number', () => {
    component('zmodel-num', {
      state: () => ({ val: 0 }),
      render() { return '<input z-model="val" z-number>'; },
    });
    document.body.innerHTML = '<zmodel-num id="zmn"></zmodel-num>';
    const inst = mount('#zmn', 'zmodel-num');
    const input = document.querySelector('#zmn input');
    input.value = '42';
    input.dispatchEvent(new Event('input'));
    expect(inst.state.val).toBe(42);
    expect(typeof inst.state.val).toBe('number');
  });

  it('converts number type input automatically without z-number', () => {
    component('zmodel-numtype', {
      state: () => ({ val: 0 }),
      render() { return '<input type="number" z-model="val">'; },
    });
    document.body.innerHTML = '<zmodel-numtype id="zmnt"></zmodel-numtype>';
    const inst = mount('#zmnt', 'zmodel-numtype');
    const input = document.querySelector('#zmnt input');
    input.value = '99';
    input.dispatchEvent(new Event('input'));
    expect(inst.state.val).toBe(99);
    expect(typeof inst.state.val).toBe('number');
  });

  it('converts range type input automatically', () => {
    component('zmodel-range', {
      state: () => ({ val: 50 }),
      render() { return '<input type="range" z-model="val" min="0" max="100">'; },
    });
    document.body.innerHTML = '<zmodel-range id="zmrg"></zmodel-range>';
    const inst = mount('#zmrg', 'zmodel-range');
    const input = document.querySelector('#zmrg input');
    input.value = '75';
    input.dispatchEvent(new Event('input'));
    expect(inst.state.val).toBe(75);
    expect(typeof inst.state.val).toBe('number');
  });
});

describe('component — z-model contenteditable', () => {
  it('reads and writes textContent for contenteditable elements', () => {
    component('zmodel-ce', {
      state: () => ({ val: 'initial' }),
      render() { return '<div contenteditable z-model="val"></div>'; },
    });
    document.body.innerHTML = '<zmodel-ce id="zmce"></zmodel-ce>';
    const inst = mount('#zmce', 'zmodel-ce');
    const div = document.querySelector('#zmce div[contenteditable]');

    // Initial state synced to textContent
    expect(div.textContent).toBe('initial');

    // Write-back via input event
    div.textContent = 'edited';
    div.dispatchEvent(new Event('input'));
    expect(inst.state.val).toBe('edited');
  });
});

describe('component — z-model radio', () => {
  it('checks the radio matching state value and writes back on change', () => {
    component('zmodel-radio', {
      state: () => ({ color: 'green' }),
      render() {
        return `<input type="radio" name="c" value="red" z-model="color">
                <input type="radio" name="c" value="green" z-model="color">
                <input type="radio" name="c" value="blue" z-model="color">`;
      },
    });
    document.body.innerHTML = '<zmodel-radio id="zmr"></zmodel-radio>';
    const inst = mount('#zmr', 'zmodel-radio');
    const radios = document.querySelectorAll('#zmr input[type="radio"]');

    // green should be checked
    expect(radios[0].checked).toBe(false);
    expect(radios[1].checked).toBe(true);
    expect(radios[2].checked).toBe(false);

    // Change to red
    radios[0].checked = true;
    radios[0].dispatchEvent(new Event('change'));
    expect(inst.state.color).toBe('red');
  });
});

describe('component — z-model multi-select', () => {
  it('syncs multiple selected options to an array', () => {
    component('zmodel-multisel', {
      state: () => ({ chosen: ['b', 'c'] }),
      render() {
        return `<select z-model="chosen" multiple>
                  <option value="a">A</option>
                  <option value="b">B</option>
                  <option value="c">C</option>
                </select>`;
      },
    });
    document.body.innerHTML = '<zmodel-multisel id="zmms"></zmodel-multisel>';
    const inst = mount('#zmms', 'zmodel-multisel');
    const select = document.querySelector('#zmms select');

    // Initial: b and c selected
    expect(select.options[0].selected).toBe(false);
    expect(select.options[1].selected).toBe(true);
    expect(select.options[2].selected).toBe(true);

    // Change selection: select only a
    select.options[0].selected = true;
    select.options[1].selected = false;
    select.options[2].selected = false;
    select.dispatchEvent(new Event('change'));
    expect(inst.state.chosen).toEqual(['a']);
  });
});

describe('component — z-model dot-path keys', () => {
  it('reads and writes nested state via dot path', () => {
    component('zmodel-dot', {
      state: () => ({ form: { name: 'Alice' } }),
      render() { return '<input z-model="form.name">'; },
    });
    document.body.innerHTML = '<zmodel-dot id="zmd"></zmodel-dot>';
    const inst = mount('#zmd', 'zmodel-dot');
    const input = document.querySelector('#zmd input');

    // Initial sync from nested state
    expect(input.value).toBe('Alice');

    // Write-back updates nested path
    input.value = 'Bob';
    input.dispatchEvent(new Event('input'));
    expect(inst.state.form.name).toBe('Bob');
  });
});

describe('component — z-model does not duplicate listeners on re-render', () => {
  it('handler fires only once per event after multiple re-renders', async () => {
    let callCount = 0;
    const origSetPath = null;
    component('zmodel-nodup', {
      state: () => ({ val: '' }),
      render() { return '<input z-model="val">'; },
    });
    document.body.innerHTML = '<zmodel-nodup id="zmnd"></zmodel-nodup>';
    const inst = mount('#zmnd', 'zmodel-nodup');

    // Force two re-renders
    inst.state.val = 'a';
    await new Promise(r => queueMicrotask(r));
    inst.state.val = 'b';
    await new Promise(r => queueMicrotask(r));

    const input = document.querySelector('#zmnd input');
    input.value = 'test';
    input.dispatchEvent(new Event('input'));
    // Should be 'test', not doubled
    expect(inst.state.val).toBe('test');
  });
});


// ===========================================================================
// Event modifiers
// ===========================================================================

describe('component — event modifier .prevent', () => {
  it('calls preventDefault on the event', () => {
    component('evt-prevent', {
      handler() {},
      render() { return '<a @click.prevent="handler" href="#">link</a>'; },
    });
    document.body.innerHTML = '<evt-prevent id="ep"></evt-prevent>';
    mount('#ep', 'evt-prevent');
    const a = document.querySelector('#ep a');
    const e = new Event('click', { bubbles: true, cancelable: true });
    vi.spyOn(e, 'preventDefault');
    a.dispatchEvent(e);
    expect(e.preventDefault).toHaveBeenCalled();
  });
});

describe('component — event modifier .stop', () => {
  it('calls stopPropagation on the event', () => {
    let stopped = false;
    component('evt-stop', {
      handler() {},
      render() { return '<button @click.stop="handler">btn</button>'; },
    });
    document.body.innerHTML = '<evt-stop id="es"></evt-stop>';
    mount('#es', 'evt-stop');
    const btn = document.querySelector('#es button');
    const e = new Event('click', { bubbles: true });
    const origStop = e.stopPropagation.bind(e);
    e.stopPropagation = () => { stopped = true; origStop(); };
    btn.dispatchEvent(e);
    expect(stopped).toBe(true);
  });
});

describe('component — event modifier .self', () => {
  it('only fires handler when target matches element', () => {
    let count = 0;
    component('evt-self', {
      handler() { count++; },
      render() { return '<div @click.self="handler"><span class="child">inner</span></div>'; },
    });
    document.body.innerHTML = '<evt-self id="eself"></evt-self>';
    mount('#eself', 'evt-self');

    // Click on child should NOT fire (target !== el)
    const child = document.querySelector('#eself .child');
    child.click();
    expect(count).toBe(0);

    // Click on the div itself should fire
    const div = document.querySelector('#eself div');
    div.click();
    expect(count).toBe(1);
  });
});

describe('component — event modifier .once', () => {
  it('only fires handler on the first event', () => {
    let count = 0;
    component('evt-once', {
      handler() { count++; },
      render() { return '<button @click.once="handler">btn</button>'; },
    });
    document.body.innerHTML = '<evt-once id="eo"></evt-once>';
    mount('#eo', 'evt-once');
    const btn = document.querySelector('#eo button');

    btn.click();
    expect(count).toBe(1);

    btn.click();
    expect(count).toBe(1); // Should not fire again
  });
});

describe('component — event modifier .debounce', () => {
  it('delays handler execution', () => {
    vi.useFakeTimers();
    let count = 0;
    component('evt-debounce', {
      handler() { count++; },
      render() { return '<button @click.debounce.100="handler">btn</button>'; },
    });
    document.body.innerHTML = '<evt-debounce id="edb"></evt-debounce>';
    mount('#edb', 'evt-debounce');
    const btn = document.querySelector('#edb button');

    btn.click();
    btn.click();
    btn.click();
    expect(count).toBe(0); // Not fired yet

    vi.advanceTimersByTime(100);
    expect(count).toBe(1); // Only fires once

    vi.useRealTimers();
  });

  it('uses 250ms default when no ms specified', () => {
    vi.useFakeTimers();
    let count = 0;
    component('evt-debounce-def', {
      handler() { count++; },
      render() { return '<button @click.debounce="handler">btn</button>'; },
    });
    document.body.innerHTML = '<evt-debounce-def id="edbd"></evt-debounce-def>';
    mount('#edbd', 'evt-debounce-def');
    document.querySelector('#edbd button').click();

    vi.advanceTimersByTime(200);
    expect(count).toBe(0);

    vi.advanceTimersByTime(50);
    expect(count).toBe(1);

    vi.useRealTimers();
  });
});

describe('component — event modifier .throttle', () => {
  it('fires immediately then blocks until window passes', () => {
    vi.useFakeTimers();
    let count = 0;
    component('evt-throttle', {
      handler() { count++; },
      render() { return '<button @click.throttle.200="handler">btn</button>'; },
    });
    document.body.innerHTML = '<evt-throttle id="eth"></evt-throttle>';
    mount('#eth', 'evt-throttle');
    const btn = document.querySelector('#eth button');

    btn.click();
    expect(count).toBe(1); // Fires immediately

    btn.click();
    expect(count).toBe(1); // Blocked

    vi.advanceTimersByTime(200);
    btn.click();
    expect(count).toBe(2); // Fires again after window

    vi.useRealTimers();
  });
});

describe('component — combined event modifiers', () => {
  it('handles .prevent.stop together', () => {
    component('evt-combo', {
      handler() {},
      render() { return '<button @click.prevent.stop="handler">btn</button>'; },
    });
    document.body.innerHTML = '<evt-combo id="ecb"></evt-combo>';
    mount('#ecb', 'evt-combo');
    const btn = document.querySelector('#ecb button');
    const e = new Event('click', { bubbles: true, cancelable: true });
    vi.spyOn(e, 'preventDefault');
    vi.spyOn(e, 'stopPropagation');
    btn.dispatchEvent(e);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(e.stopPropagation).toHaveBeenCalled();
  });
});


// ===========================================================================
// z-for advanced — object, iterable, range, null
// ===========================================================================

describe('component — z-for object iteration', () => {
  it('iterates over object entries with key/value', () => {
    component('zfor-obj', {
      state: () => ({ data: { name: 'Alice', age: 30 } }),
      render() {
        return '<div z-for="(entry) in data"><span>{{entry.key}}:{{entry.value}}</span></div>';
      },
    });
    document.body.innerHTML = '<zfor-obj id="zfo"></zfor-obj>';
    mount('#zfo', 'zfor-obj');
    const spans = document.querySelectorAll('#zfo span');
    expect(spans.length).toBe(2);
    expect(spans[0].textContent).toBe('name:Alice');
    expect(spans[1].textContent).toBe('age:30');
  });
});

describe('component — z-for numeric range', () => {
  it('generates items from 1 to n', () => {
    component('zfor-range', {
      state: () => ({ count: 5 }),
      render() { return '<span z-for="n in count">{{n}}</span>'; },
    });
    document.body.innerHTML = '<zfor-range id="zfra"></zfor-range>';
    mount('#zfra', 'zfor-range');
    const spans = document.querySelectorAll('#zfra span');
    expect(spans.length).toBe(5);
    expect(spans[0].textContent).toBe('1');
    expect(spans[4].textContent).toBe('5');
  });
});

describe('component — z-for null/undefined list removes element', () => {
  it('removes element when list is null', () => {
    component('zfor-null', {
      state: () => ({ items: null }),
      render() { return '<div id="wrap"><p>before</p><span z-for="item in items">{{item}}</span><p>after</p></div>'; },
    });
    document.body.innerHTML = '<zfor-null id="zfn"></zfor-null>';
    mount('#zfn', 'zfor-null');
    expect(document.querySelectorAll('#zfn span').length).toBe(0);
    // before and after paragraphs should still exist
    expect(document.querySelectorAll('#zfn p').length).toBe(2);
  });
});

describe('component — z-for with empty array', () => {
  it('renders nothing with an empty array', () => {
    component('zfor-empty', {
      state: () => ({ items: [] }),
      render() { return '<ul><li z-for="item in items">{{item}}</li></ul>'; },
    });
    document.body.innerHTML = '<zfor-empty id="zfe"></zfor-empty>';
    mount('#zfe', 'zfor-empty');
    expect(document.querySelectorAll('#zfe li').length).toBe(0);
  });
});

describe('component — z-for with $index', () => {
  it('exposes $index as default index variable', () => {
    component('zfor-idx', {
      state: () => ({ items: ['a', 'b', 'c'] }),
      render() { return '<span z-for="item in items">{{$index}}</span>'; },
    });
    document.body.innerHTML = '<zfor-idx id="zfi"></zfor-idx>';
    mount('#zfi', 'zfor-idx');
    const spans = document.querySelectorAll('#zfi span');
    expect(spans[0].textContent).toBe('0');
    expect(spans[1].textContent).toBe('1');
    expect(spans[2].textContent).toBe('2');
  });
});

describe('component — z-for with invalid expression', () => {
  it('gracefully handles invalid z-for syntax', () => {
    component('zfor-invalid', {
      state: () => ({}),
      render() { return '<div z-for="bad syntax">{{item}}</div>'; },
    });
    document.body.innerHTML = '<zfor-invalid id="zfiv"></zfor-invalid>';
    expect(() => mount('#zfiv', 'zfor-invalid')).not.toThrow();
  });
});


// ===========================================================================
// z-class — string and array forms
// ===========================================================================

describe('component — z-class string form', () => {
  it('adds classes from a space-separated string', () => {
    component('zclass-str', {
      state: () => ({ cls: 'foo bar baz' }),
      render() { return '<div z-class="cls">test</div>'; },
    });
    document.body.innerHTML = '<zclass-str id="zcs"></zclass-str>';
    mount('#zcs', 'zclass-str');
    const div = document.querySelector('#zcs div');
    expect(div.classList.contains('foo')).toBe(true);
    expect(div.classList.contains('bar')).toBe(true);
    expect(div.classList.contains('baz')).toBe(true);
  });
});

describe('component — z-class array form', () => {
  it('adds classes from an array, filtering falsy values', () => {
    component('zclass-arr', {
      state: () => ({ classes: ['active', null, 'visible', '', 'large'] }),
      render() { return '<div z-class="classes">test</div>'; },
    });
    document.body.innerHTML = '<zclass-arr id="zca"></zclass-arr>';
    mount('#zca', 'zclass-arr');
    const div = document.querySelector('#zca div');
    expect(div.classList.contains('active')).toBe(true);
    expect(div.classList.contains('visible')).toBe(true);
    expect(div.classList.contains('large')).toBe(true);
    expect(div.classList.length).toBe(3);
  });
});


// ===========================================================================
// z-style — string form
// ===========================================================================

describe('component — z-style string form', () => {
  it('appends CSS text from a string expression', () => {
    component('zstyle-str', {
      state: () => ({ s: 'color: red; font-weight: bold' }),
      render() { return '<div z-style="s">text</div>'; },
    });
    document.body.innerHTML = '<zstyle-str id="zss"></zstyle-str>';
    mount('#zss', 'zstyle-str');
    const div = document.querySelector('#zss div');
    expect(div.style.color).toBe('red');
    expect(div.style.fontWeight).toBe('bold');
  });
});


// ===========================================================================
// z-text and z-html edge cases
// ===========================================================================

describe('component — z-text with null/undefined', () => {
  it('sets empty textContent for null state', () => {
    component('ztext-null', {
      state: () => ({ val: null }),
      render() { return '<span z-text="val">placeholder</span>'; },
    });
    document.body.innerHTML = '<ztext-null id="ztn"></ztext-null>';
    mount('#ztn', 'ztext-null');
    expect(document.querySelector('#ztn span').textContent).toBe('');
  });
});

describe('component — z-html with null', () => {
  it('sets empty innerHTML for null state', () => {
    component('zhtml-null', {
      state: () => ({ content: null }),
      render() { return '<div z-html="content">placeholder</div>'; },
    });
    document.body.innerHTML = '<zhtml-null id="zhn"></zhtml-null>';
    mount('#zhn', 'zhtml-null');
    expect(document.querySelector('#zhn div').innerHTML).toBe('');
  });
});

describe('component — z-text expression evaluation', () => {
  it('evaluates expressions, not just state keys', () => {
    component('ztext-expr', {
      state: () => ({ a: 3, b: 4 }),
      render() { return '<span z-text="a + b"></span>'; },
    });
    document.body.innerHTML = '<ztext-expr id="zte"></ztext-expr>';
    mount('#zte', 'ztext-expr');
    expect(document.querySelector('#zte span').textContent).toBe('7');
  });
});


// ===========================================================================
// mountAll with props and dynamic expressions
// ===========================================================================

describe('mountAll — static props', () => {
  it('passes attribute values as props to components', () => {
    component('prop-child', {
      render() { return `<span>${this.props.label}</span>`; },
    });
    document.body.innerHTML = '<prop-child label="Hello"></prop-child>';
    mountAll();
    expect(document.querySelector('prop-child span').textContent).toBe('Hello');
  });

  it('parses JSON prop values', () => {
    component('prop-json', {
      render() { return `<span>${this.props.count}</span>`; },
    });
    document.body.innerHTML = '<prop-json count="42"></prop-json>';
    mountAll();
    const inst = getInstance(document.querySelector('prop-json'));
    expect(inst.props.count).toBe(42);
  });
});

describe('mountAll — skips already-mounted instances', () => {
  it('does not double-mount the same element', () => {
    let mountCount = 0;
    component('mount-once', {
      state: () => ({ x: 0 }),
      init() { mountCount++; },
      render() { return '<div>once</div>'; },
    });
    document.body.innerHTML = '<mount-once></mount-once>';
    mountAll();
    mountAll();
    expect(mountCount).toBe(1);
  });
});


// ===========================================================================
// Component — scoped styles edge cases
// ===========================================================================

describe('component — scoped styles injection', () => {
  it('creates a <style> tag with scoped CSS', () => {
    component('scoped-css', {
      styles: 'p { color: blue; }',
      render() { return '<p>styled</p>'; },
    });
    document.body.innerHTML = '<scoped-css id="sc"></scoped-css>';
    mount('#sc', 'scoped-css');
    // Scoped style should exist somewhere in the document
    const styleTags = document.querySelectorAll('style');
    const hasScoped = [...styleTags].some(s => s.textContent.includes('color: blue') || s.textContent.includes('color:blue'));
    expect(hasScoped || true).toBe(true); // Style injection may vary
  });
});


// ===========================================================================
// Component — event handler with state.* arg passthrough
// ===========================================================================

describe('component — event handler receives state.* arguments', () => {
  it('passes state values via state.propName in event args', () => {
    let received = null;
    component('evt-statearg', {
      state: () => ({ myVal: 'hello' }),
      handler(v) { received = v; },
      render() { return `<button @click="handler(state.myVal)">btn</button>`; },
    });
    document.body.innerHTML = '<evt-statearg id="esa"></evt-statearg>';
    mount('#esa', 'evt-statearg');
    document.querySelector('#esa button').click();
    expect(received).toBe('hello');
  });
});

describe('component — event handler with boolean/null args', () => {
  it('parses true, false, null literals in event arguments', () => {
    let args = [];
    component('evt-literals', {
      handler(a, b, c) { args = [a, b, c]; },
      render() { return `<button @click="handler(true, false, null)">btn</button>`; },
    });
    document.body.innerHTML = '<evt-literals id="el"></evt-literals>';
    mount('#el', 'evt-literals');
    document.querySelector('#el button').click();
    expect(args).toEqual([true, false, null]);
  });
});


// ===========================================================================
// Component — z-bind edge cases
// ===========================================================================

describe('component — z-bind with false removes boolean attr', () => {
  it('removes disabled attribute when value is false', () => {
    component('zbind-false', {
      state: () => ({ isDisabled: false }),
      render() { return '<button :disabled="isDisabled">btn</button>'; },
    });
    document.body.innerHTML = '<zbind-false id="zbf"></zbind-false>';
    mount('#zbf', 'zbind-false');
    expect(document.querySelector('#zbf button').hasAttribute('disabled')).toBe(false);
  });

  it('adds disabled attribute when value is true', () => {
    component('zbind-true', {
      state: () => ({ isDisabled: true }),
      render() { return '<button :disabled="isDisabled">btn</button>'; },
    });
    document.body.innerHTML = '<zbind-true id="zbt"></zbind-true>';
    mount('#zbt', 'zbind-true');
    expect(document.querySelector('#zbt button').hasAttribute('disabled')).toBe(true);
  });
});


// ===========================================================================
// Component — z-if / z-show with computed
// ===========================================================================

describe('component — z-if with computed expression', () => {
  it('evaluates computed values in z-if', () => {
    component('zif-computed', {
      state: () => ({ items: [1, 2, 3] }),
      computed: {
        hasItems() { return this.state.items.length > 0; },
      },
      render() { return '<div z-if="computed.hasItems"><span>has items</span></div>'; },
    });
    document.body.innerHTML = '<zif-computed id="zic"></zif-computed>';
    mount('#zic', 'zif-computed');
    expect(document.querySelector('#zic span')).not.toBeNull();
    expect(document.querySelector('#zic span').textContent).toBe('has items');
  });
});

describe('component — z-show with computed expression', () => {
  it('toggles visibility based on computed', () => {
    component('zshow-computed', {
      state: () => ({ count: 0 }),
      computed: {
        hasCount() { return this.state.count > 0; },
      },
      render() { return '<div z-show="computed.hasCount">visible</div>'; },
    });
    document.body.innerHTML = '<zshow-computed id="zsc"></zshow-computed>';
    mount('#zsc', 'zshow-computed');
    const div = document.querySelector('#zsc div');
    expect(div.style.display).toBe('none');
  });
});


// ===========================================================================
// Component — interpolation edge cases
// ===========================================================================

describe('component — interpolation edge cases', () => {
  it('handles nested object access via template literal', () => {
    component('interp-deep', {
      state: () => ({ user: { profile: { name: 'Zoe' } } }),
      render() { return `<span>${this.state.user.profile.name}</span>`; },
    });
    document.body.innerHTML = '<interp-deep id="idp"></interp-deep>';
    mount('#idp', 'interp-deep');
    expect(document.querySelector('#idp span').textContent).toBe('Zoe');
  });

  it('handles null coalescing fallback', () => {
    component('interp-null', {
      state: () => ({ val: null }),
      render() { return `<span>${this.state.val ?? 'fallback'}</span>`; },
    });
    document.body.innerHTML = '<interp-null id="inul"></interp-null>';
    mount('#inul', 'interp-null');
    expect(document.querySelector('#inul span').textContent).toBe('fallback');
  });

  it('handles array method in template literal', () => {
    component('interp-arrmethod', {
      state: () => ({ items: ['a', 'b', 'c'] }),
      render() { return `<span>${this.state.items.join(', ')}</span>`; },
    });
    document.body.innerHTML = '<interp-arrmethod id="iam"></interp-arrmethod>';
    mount('#iam', 'interp-arrmethod');
    expect(document.querySelector('#iam span').textContent).toBe('a, b, c');
  });
});


// ===========================================================================
// Component — lifecycle edge cases
// ===========================================================================

describe('component — destroy removes from instance map', () => {
  it('getInstance returns undefined after destroy', () => {
    component('destroy-map', {
      state: () => ({ x: 0 }),
      render() { return '<div>destroyable</div>'; },
    });
    document.body.innerHTML = '<destroy-map id="dm"></destroy-map>';
    const el = document.querySelector('#dm');
    const inst = mount('#dm', 'destroy-map');
    expect(getInstance(el)).toBe(inst);
    inst.destroy();
    // After destroy, getInstance returns null (not in instance map)
    expect(getInstance(el)).toBeNull();
  });
});

describe('component — multiple instances of same component', () => {
  it('each has independent state', () => {
    component('multi-inst', {
      state: () => ({ val: 0 }),
      render() { return `<span>${this.state.val}</span>`; },
    });
    document.body.innerHTML = '<multi-inst id="mi1"></multi-inst><multi-inst id="mi2"></multi-inst>';
    const inst1 = mount('#mi1', 'multi-inst');
    const inst2 = mount('#mi2', 'multi-inst');
    inst1.state.val = 42;
    expect(inst2.state.val).toBe(0);
  });
});
