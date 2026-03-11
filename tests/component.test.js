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
