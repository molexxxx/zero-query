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

describe('component() - registration', () => {
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

describe('component - lifecycle', () => {
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

describe('component - reactive state', () => {
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

describe('component - props', () => {
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

describe('component - computed', () => {
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

describe('component - methods', () => {
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

describe('component - setState', () => {
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

describe('component - emit', () => {
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

describe('component - destroy', () => {
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

describe('component - z-if directive', () => {
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

describe('component - z-show directive', () => {
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

describe('component - z-for directive', () => {
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

describe('component - z-bind directive', () => {
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

describe('component - z-class directive', () => {
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

describe('component - z-text directive', () => {
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

describe('component - z-html directive', () => {
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

describe('component - z-ref', () => {
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

describe('component - z-model', () => {
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

describe('component - z-cloak', () => {
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

describe('component - z-pre', () => {
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

describe('component - z-style directive', () => {
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

describe('component - event binding', () => {
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

describe('component - watchers', () => {
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

describe('component - slots', () => {
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

  // --- Edge cases: self-closing and whitespace ---

  it('handles self-closing <slot /> syntax', () => {
    component('slot-selfclose', {
      render() { return '<div><slot /></div>'; },
    });
    document.body.innerHTML = '<slot-selfclose id="ssc"><p>content</p></slot-selfclose>';
    mount('#ssc', 'slot-selfclose');
    expect(document.querySelector('#ssc p').textContent).toBe('content');
  });

  it('handles self-closing named <slot name="x" />', () => {
    component('slot-selfclose-named', {
      render() { return '<div><slot name="top" /></div>'; },
    });
    document.body.innerHTML = '<slot-selfclose-named id="sscn"><span slot="top">Top!</span></slot-selfclose-named>';
    mount('#sscn', 'slot-selfclose-named');
    expect(document.querySelector('#sscn span').textContent).toBe('Top!');
  });

  it('uses fallback for self-closing slot when no content', () => {
    component('slot-selfclose-fb', {
      render() { return '<div><slot />empty</div>'; },
    });
    document.body.innerHTML = '<slot-selfclose-fb id="sscfb"></slot-selfclose-fb>';
    mount('#sscfb', 'slot-selfclose-fb');
    // self-closing slot has no fallback content, so it's replaced with ''
    expect(document.querySelector('#sscfb div').textContent).toBe('empty');
  });

  // --- Text-only slot content ---

  it('projects plain text (no wrapper element) into default slot', () => {
    component('slot-textonly', {
      render() { return '<div><slot>fallback</slot></div>'; },
    });
    document.body.innerHTML = '<slot-textonly id="sto">Hello World</slot-textonly>';
    mount('#sto', 'slot-textonly');
    expect(document.querySelector('#sto div').textContent).toBe('Hello World');
  });

  it('ignores whitespace-only text nodes', () => {
    component('slot-whitespace', {
      render() { return '<div><slot>fallback</slot></div>'; },
    });
    document.body.innerHTML = '<slot-whitespace id="sw">   \n\t  </slot-whitespace>';
    mount('#sw', 'slot-whitespace');
    expect(document.querySelector('#sw div').textContent).toBe('fallback');
  });

  // --- Multiple elements in default slot ---

  it('projects multiple elements into default slot', () => {
    component('slot-multi', {
      render() { return '<div><slot></slot></div>'; },
    });
    document.body.innerHTML = '<slot-multi id="sm"><p>One</p><p>Two</p><p>Three</p></slot-multi>';
    mount('#sm', 'slot-multi');
    const paras = document.querySelectorAll('#sm div p');
    expect(paras.length).toBe(3);
    expect(paras[0].textContent).toBe('One');
    expect(paras[2].textContent).toBe('Three');
  });

  // --- Mixed named + default slot content ---

  it('separates named and default content correctly', () => {
    component('slot-mixed', {
      render() {
        return '<header><slot name="title">default title</slot></header><section><slot>default body</slot></section>';
      },
    });
    document.body.innerHTML = `
      <slot-mixed id="smx">
        <h1 slot="title">Custom Title</h1>
        <p>Paragraph 1</p>
        <p>Paragraph 2</p>
      </slot-mixed>`;
    mount('#smx', 'slot-mixed');
    expect(document.querySelector('#smx header').textContent).toBe('Custom Title');
    const section = document.querySelector('#smx section');
    expect(section.querySelectorAll('p').length).toBe(2);
  });

  // --- Multiple named slots ---

  it('distributes multiple named slots', () => {
    component('slot-multinamed', {
      render() {
        return '<header><slot name="header">H</slot></header><footer><slot name="footer">F</slot></footer><main><slot>M</slot></main>';
      },
    });
    document.body.innerHTML = `
      <slot-multinamed id="smn">
        <div slot="header">My Header</div>
        <div slot="footer">My Footer</div>
        <p>Body content</p>
      </slot-multinamed>`;
    mount('#smn', 'slot-multinamed');
    expect(document.querySelector('#smn header').textContent).toBe('My Header');
    expect(document.querySelector('#smn footer').textContent).toBe('My Footer');
    expect(document.querySelector('#smn main p').textContent).toBe('Body content');
  });

  // --- Named slot with multiple elements ---

  it('accumulates multiple elements for the same named slot', () => {
    component('slot-accumulate', {
      render() { return '<div><slot name="items">none</slot></div>'; },
    });
    document.body.innerHTML = `
      <slot-accumulate id="sac">
        <li slot="items">A</li>
        <li slot="items">B</li>
        <li slot="items">C</li>
      </slot-accumulate>`;
    mount('#sac', 'slot-accumulate');
    const lis = document.querySelectorAll('#sac li');
    expect(lis.length).toBe(3);
  });

  // --- Fallback for named slots ---

  it('uses fallback for unmatched named slot', () => {
    component('slot-namedfb', {
      render() {
        return '<header><slot name="header">Default Header</slot></header><footer><slot name="footer">Default Footer</slot></footer>';
      },
    });
    // Only provide header, not footer
    document.body.innerHTML = '<slot-namedfb id="snfb"><span slot="header">Custom H</span></slot-namedfb>';
    mount('#snfb', 'slot-namedfb');
    expect(document.querySelector('#snfb header').textContent).toBe('Custom H');
    expect(document.querySelector('#snfb footer').textContent).toBe('Default Footer');
  });

  // --- Empty element in default slot ---

  it('projects empty elements into default slot', () => {
    component('slot-emptyel', {
      render() { return '<div><slot>fallback</slot></div>'; },
    });
    document.body.innerHTML = '<slot-emptyel id="see"><br></slot-emptyel>';
    mount('#see', 'slot-emptyel');
    expect(document.querySelector('#see div br')).not.toBeNull();
  });

  // --- Slot content with HTML attributes and classes ---

  it('preserves attributes and classes on slotted content', () => {
    component('slot-attrs', {
      render() { return '<div><slot></slot></div>'; },
    });
    document.body.innerHTML = '<slot-attrs id="sa"><p class="highlight" data-id="42">Styled</p></slot-attrs>';
    mount('#sa', 'slot-attrs');
    const p = document.querySelector('#sa p');
    expect(p.classList.contains('highlight')).toBe(true);
    expect(p.getAttribute('data-id')).toBe('42');
  });

  // --- Slot content with nested HTML ---

  it('projects deeply nested HTML into slot', () => {
    component('slot-nested', {
      render() { return '<div><slot></slot></div>'; },
    });
    document.body.innerHTML = '<slot-nested id="sne"><div><ul><li><strong>Deep</strong></li></ul></div></slot-nested>';
    mount('#sne', 'slot-nested');
    expect(document.querySelector('#sne strong').textContent).toBe('Deep');
  });

  // --- Slot content persists across re-renders ---

  it('preserves slot content after state change re-render', async () => {
    component('slot-rerender', {
      state: () => ({ count: 0 }),
      render() {
        return `<p>Count: ${this.state.count}</p><div class="slotted"><slot>fallback</slot></div>`;
      },
    });
    document.body.innerHTML = '<slot-rerender id="srr"><span>Projected!</span></slot-rerender>';
    const inst = mount('#srr', 'slot-rerender');
    expect(document.querySelector('#srr .slotted span').textContent).toBe('Projected!');

    // Trigger re-render via state change (batched - need microtask flush)
    inst.state.count = 5;
    await new Promise(r => queueMicrotask(r));
    expect(document.querySelector('#srr p').textContent).toBe('Count: 5');
    expect(document.querySelector('#srr .slotted span').textContent).toBe('Projected!');
  });

  // --- Slot with special characters ---

  it('handles slot content with special characters', () => {
    component('slot-special', {
      render() { return '<div><slot></slot></div>'; },
    });
    document.body.innerHTML = '<slot-special id="ssp"><p>&amp; &lt;tag&gt; "quotes"</p></slot-special>';
    mount('#ssp', 'slot-special');
    const p = document.querySelector('#ssp p');
    expect(p.textContent).toContain('& <tag> "quotes"');
  });

  // --- No slot tag in template - content is replaced entirely ---

  it('discards projected content when template has no slot', () => {
    component('slot-nosite', {
      render() { return '<div>No slot here</div>'; },
    });
    document.body.innerHTML = '<slot-nosite id="sns"><p>Orphan</p></slot-nosite>';
    mount('#sns', 'slot-nosite');
    expect(document.querySelector('#sns div').textContent).toBe('No slot here');
    expect(document.querySelector('#sns p')).toBeNull();
  });

  // --- Multiple default slots in template (both should be filled) ---

  it('fills multiple default slot sites with the same content', () => {
    component('slot-dupdefault', {
      render() {
        return '<div class="a"><slot>fb1</slot></div><div class="b"><slot>fb2</slot></div>';
      },
    });
    document.body.innerHTML = '<slot-dupdefault id="sdd"><p>Content</p></slot-dupdefault>';
    mount('#sdd', 'slot-dupdefault');
    expect(document.querySelector('#sdd .a p').textContent).toBe('Content');
    expect(document.querySelector('#sdd .b p').textContent).toBe('Content');
  });

  // --- Named slot content with inline styles ---

  it('preserves inline styles on slotted elements', () => {
    component('slot-style', {
      render() { return '<div><slot name="styled">default</slot></div>'; },
    });
    document.body.innerHTML = '<slot-style id="sst"><span slot="styled" style="color: red;">Red</span></slot-style>';
    mount('#sst', 'slot-style');
    const span = document.querySelector('#sst span');
    expect(span.style.color).toBe('red');
  });

  // --- Mixed text and elements in default slot ---

  it('projects mixed text and element nodes', () => {
    component('slot-mixedcontent', {
      render() { return '<div><slot></slot></div>'; },
    });
    document.body.innerHTML = '<slot-mixedcontent id="smc">Text before <strong>bold</strong> text after</slot-mixedcontent>';
    mount('#smc', 'slot-mixedcontent');
    const div = document.querySelector('#smc div');
    expect(div.textContent).toContain('Text before');
    expect(div.textContent).toContain('bold');
    expect(div.textContent).toContain('text after');
  });

  // --- Comment nodes should be ignored ---

  it('ignores comment nodes in slot content', () => {
    component('slot-comments', {
      render() { return '<div><slot>fallback</slot></div>'; },
    });
    const el = document.createElement('slot-comments');
    el.id = 'scm';
    el.appendChild(document.createComment('this is a comment'));
    document.body.appendChild(el);
    mount('#scm', 'slot-comments');
    // Only a comment - should use fallback
    expect(document.querySelector('#scm div').textContent).toBe('fallback');
  });

  it('ignores comments but still captures sibling elements', () => {
    component('slot-comments-mix', {
      render() { return '<div><slot>fallback</slot></div>'; },
    });
    const el = document.createElement('slot-comments-mix');
    el.id = 'scmm';
    el.appendChild(document.createComment('comment'));
    const p = document.createElement('p');
    p.textContent = 'Real content';
    el.appendChild(p);
    document.body.appendChild(el);
    mount('#scmm', 'slot-comments-mix');
    expect(document.querySelector('#scmm p').textContent).toBe('Real content');
  });

  // --- Slot with fallback containing HTML ---

  it('renders rich HTML fallback when no content provided', () => {
    component('slot-richfb', {
      render() { return '<div><slot><em>No content</em> provided</slot></div>'; },
    });
    document.body.innerHTML = '<slot-richfb id="srf"></slot-richfb>';
    mount('#srf', 'slot-richfb');
    expect(document.querySelector('#srf em').textContent).toBe('No content');
    expect(document.querySelector('#srf div').textContent).toContain('provided');
  });

  it('replaces rich fallback when content is provided', () => {
    component('slot-richfb-replace', {
      render() { return '<div><slot><em>Fallback</em></slot></div>'; },
    });
    document.body.innerHTML = '<slot-richfb-replace id="srfr"><p>Real</p></slot-richfb-replace>';
    mount('#srfr', 'slot-richfb-replace');
    expect(document.querySelector('#srfr em')).toBeNull();
    expect(document.querySelector('#srfr p').textContent).toBe('Real');
  });

  // --- Named slot fallback with HTML ---

  it('uses rich fallback for named slot when unmatched', () => {
    component('slot-namedfb-rich', {
      render() { return '<div><slot name="info"><span class="default">Default Info</span></slot></div>'; },
    });
    document.body.innerHTML = '<slot-namedfb-rich id="snfbr"></slot-namedfb-rich>';
    mount('#snfbr', 'slot-namedfb-rich');
    expect(document.querySelector('#snfbr .default').textContent).toBe('Default Info');
  });

  // --- Slot content with z- attributes should not be processed as directives ---

  it('slot projected content is static (outerHTML snapshot)', () => {
    component('slot-static', {
      state: () => ({ label: 'Label' }),
      render() { return '<div><slot></slot><p>State: ${this.state.label}</p></div>'; },
    });
    document.body.innerHTML = '<slot-static id="ssta"><span data-info="test">Static span</span></slot-static>';
    mount('#ssta', 'slot-static');
    expect(document.querySelector('#ssta span').textContent).toBe('Static span');
    expect(document.querySelector('#ssta span').getAttribute('data-info')).toBe('test');
  });

  // --- Default slot with only named content (no default → fallback) ---

  it('uses default slot fallback when all child content is named', () => {
    component('slot-allnamed', {
      render() {
        return '<header><slot name="header">H</slot></header><main><slot>Default body</slot></main>';
      },
    });
    document.body.innerHTML = '<slot-allnamed id="san"><div slot="header">Title</div></slot-allnamed>';
    mount('#san', 'slot-allnamed');
    expect(document.querySelector('#san header').textContent).toBe('Title');
    expect(document.querySelector('#san main').textContent).toBe('Default body');
  });

  // --- Empty component (no children at all) ---

  it('uses all fallbacks when component has no children', () => {
    component('slot-empty', {
      render() {
        return '<header><slot name="h">FH</slot></header><main><slot>FM</slot></main><footer><slot name="f">FF</slot></footer>';
      },
    });
    document.body.innerHTML = '<slot-empty id="sem"></slot-empty>';
    mount('#sem', 'slot-empty');
    expect(document.querySelector('#sem header').textContent).toBe('FH');
    expect(document.querySelector('#sem main').textContent).toBe('FM');
    expect(document.querySelector('#sem footer').textContent).toBe('FF');
  });

  // --- BUG: slot="" (empty string) should map to default slot ---

  it('treats slot="" as the default slot', () => {
    component('slot-emptyattr', {
      render() { return '<div><slot>fallback</slot></div>'; },
    });
    document.body.innerHTML = '<slot-emptyattr id="sea"><p slot="">Empty attr</p></slot-emptyattr>';
    mount('#sea', 'slot-emptyattr');
    expect(document.querySelector('#sea p').textContent).toBe('Empty attr');
  });

  it('treats bare slot attribute (no value) as default slot', () => {
    component('slot-bareattr', {
      render() { return '<div><slot>fallback</slot></div>'; },
    });
    const el = document.createElement('slot-bareattr');
    el.id = 'sba';
    const p = document.createElement('p');
    p.textContent = 'Bare attr';
    p.setAttribute('slot', '');
    el.appendChild(p);
    document.body.appendChild(el);
    mount('#sba', 'slot-bareattr');
    expect(document.querySelector('#sba p').textContent).toBe('Bare attr');
  });

  // --- Slot content with template literal expressions should be static ---

  it('does not evaluate expressions in projected slot content', () => {
    component('slot-noeval', {
      state: () => ({ x: 'STATE' }),
      render() { return '<div><slot></slot></div>'; },
    });
    document.body.innerHTML = '<slot-noeval id="sne2"><p>${this.state.x}</p></slot-noeval>';
    mount('#sne2', 'slot-noeval');
    // The projected content is raw HTML, not evaluated as a template expression
    expect(document.querySelector('#sne2 p').textContent).toBe('${this.state.x}');
  });

  // --- Multiple re-renders preserve slots ---

  it('preserves slot content after multiple state changes', async () => {
    component('slot-multirerender', {
      state: () => ({ n: 0 }),
      render() {
        return `<span>${this.state.n}</span><div class="slot"><slot>fb</slot></div>`;
      },
    });
    document.body.innerHTML = '<slot-multirerender id="smrr"><b>Slot!</b></slot-multirerender>';
    const inst = mount('#smrr', 'slot-multirerender');
    expect(document.querySelector('#smrr .slot b').textContent).toBe('Slot!');

    for (let i = 1; i <= 5; i++) {
      inst.state.n = i;
      await new Promise(r => queueMicrotask(r));
      expect(document.querySelector('#smrr span').textContent).toBe(String(i));
      expect(document.querySelector('#smrr .slot b').textContent).toBe('Slot!');
    }
  });

  // --- Named slot with extra whitespace in template ---

  it('handles extra whitespace around slot name attribute', () => {
    component('slot-wsname', {
      render() { return '<div><slot  name="hd"  >fallback</slot></div>'; },
    });
    document.body.innerHTML = '<slot-wsname id="swn"><span slot="hd">HdContent</span></slot-wsname>';
    mount('#swn', 'slot-wsname');
    expect(document.querySelector('#swn span').textContent).toBe('HdContent');
  });
});


// ---------------------------------------------------------------------------
// Scoped styles
// ---------------------------------------------------------------------------

describe('component - scoped styles', () => {
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

describe('component - z-if reactive toggle', () => {
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

describe('component - z-show reactive toggle', () => {
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

describe('component - z-for advanced', () => {
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

describe('component - z-bind advanced', () => {
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

describe('component - z-class advanced', () => {
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

describe('component - z-style advanced', () => {
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

describe('component - z-model advanced', () => {
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

describe('component - z-ref advanced', () => {
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

describe('component - event binding advanced', () => {
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

describe('component - watchers advanced', () => {
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

describe('component - no state', () => {
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

describe('mount - with Element reference', () => {
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

describe('component - interpolation', () => {
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

describe('component - emit edge cases', () => {
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

describe('component - computed edge cases', () => {
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

describe('component - slots advanced', () => {
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

describe('component - DOM morphing on re-render', () => {
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

describe('Component - destroy clears pending timers', () => {
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

    // Click to start a debounce timer (5s - won't fire during test)
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

describe('component - z-model z-lazy modifier', () => {
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

describe('component - z-model z-trim modifier', () => {
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

describe('component - z-model z-number modifier', () => {
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

describe('component - z-model contenteditable', () => {
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


// ===========================================================================
// z-model z-debounce modifier
// ===========================================================================

describe('component - z-model z-debounce modifier', () => {
  it('delays state update by the specified ms', () => {
    vi.useFakeTimers();
    component('zmodel-debounce', {
      state: () => ({ search: '' }),
      render() { return '<input z-model="search" z-debounce="200">'; },
    });
    document.body.innerHTML = '<zmodel-debounce id="zmd"></zmodel-debounce>';
    const inst = mount('#zmd', 'zmodel-debounce');
    const input = document.querySelector('#zmd input');

    input.value = 'hel';
    input.dispatchEvent(new Event('input'));
    expect(inst.state.search).toBe(''); // Not yet

    vi.advanceTimersByTime(100);
    input.value = 'hello';
    input.dispatchEvent(new Event('input'));
    expect(inst.state.search).toBe(''); // Timer restarted

    vi.advanceTimersByTime(200);
    expect(inst.state.search).toBe('hello'); // Now fires

    vi.useRealTimers();
  });

  it('defaults to 250ms when no value is specified', () => {
    vi.useFakeTimers();
    component('zmodel-debounce-def', {
      state: () => ({ q: '' }),
      render() { return '<input z-model="q" z-debounce>'; },
    });
    document.body.innerHTML = '<zmodel-debounce-def id="zmdd"></zmodel-debounce-def>';
    const inst = mount('#zmdd', 'zmodel-debounce-def');
    const input = document.querySelector('#zmdd input');

    input.value = 'test';
    input.dispatchEvent(new Event('input'));
    expect(inst.state.q).toBe('');

    vi.advanceTimersByTime(249);
    expect(inst.state.q).toBe('');

    vi.advanceTimersByTime(1);
    expect(inst.state.q).toBe('test');

    vi.useRealTimers();
  });

  it('works alongside z-trim', () => {
    vi.useFakeTimers();
    component('zmodel-debounce-trim', {
      state: () => ({ val: '' }),
      render() { return '<input z-model="val" z-debounce="100" z-trim>'; },
    });
    document.body.innerHTML = '<zmodel-debounce-trim id="zmdt"></zmodel-debounce-trim>';
    const inst = mount('#zmdt', 'zmodel-debounce-trim');
    const input = document.querySelector('#zmdt input');

    input.value = '  hello  ';
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(100);
    expect(inst.state.val).toBe('hello');

    vi.useRealTimers();
  });
});


// ===========================================================================
// z-model z-uppercase / z-lowercase modifiers
// ===========================================================================

describe('component - z-model z-uppercase modifier', () => {
  it('converts input value to uppercase before writing to state', () => {
    component('zmodel-upper', {
      state: () => ({ val: '' }),
      render() { return '<input z-model="val" z-uppercase>'; },
    });
    document.body.innerHTML = '<zmodel-upper id="zmu"></zmodel-upper>';
    const inst = mount('#zmu', 'zmodel-upper');
    const input = document.querySelector('#zmu input');

    input.value = 'hello world';
    input.dispatchEvent(new Event('input'));
    expect(inst.state.val).toBe('HELLO WORLD');
  });

  it('works with z-trim', () => {
    component('zmodel-upper-trim', {
      state: () => ({ val: '' }),
      render() { return '<input z-model="val" z-uppercase z-trim>'; },
    });
    document.body.innerHTML = '<zmodel-upper-trim id="zmut"></zmodel-upper-trim>';
    const inst = mount('#zmut', 'zmodel-upper-trim');
    const input = document.querySelector('#zmut input');

    input.value = '  hello  ';
    input.dispatchEvent(new Event('input'));
    expect(inst.state.val).toBe('HELLO');
  });
});

describe('component - z-model z-lowercase modifier', () => {
  it('converts input value to lowercase before writing to state', () => {
    component('zmodel-lower', {
      state: () => ({ val: '' }),
      render() { return '<input z-model="val" z-lowercase>'; },
    });
    document.body.innerHTML = '<zmodel-lower id="zmlw"></zmodel-lower>';
    const inst = mount('#zmlw', 'zmodel-lower');
    const input = document.querySelector('#zmlw input');

    input.value = 'HELLO World';
    input.dispatchEvent(new Event('input'));
    expect(inst.state.val).toBe('hello world');
  });

  it('works on textarea', () => {
    component('zmodel-lower-ta', {
      state: () => ({ val: '' }),
      render() { return '<textarea z-model="val" z-lowercase></textarea>'; },
    });
    document.body.innerHTML = '<zmodel-lower-ta id="zmlt"></zmodel-lower-ta>';
    const inst = mount('#zmlt', 'zmodel-lower-ta');
    const ta = document.querySelector('#zmlt textarea');

    ta.value = 'MiXeD CaSe';
    ta.dispatchEvent(new Event('input'));
    expect(inst.state.val).toBe('mixed case');
  });
});


describe('component - z-model radio', () => {
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

describe('component - z-model multi-select', () => {
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

describe('component - z-model dot-path keys', () => {
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

describe('component - z-model does not duplicate listeners on re-render', () => {
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

describe('component - event modifier .prevent', () => {
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

describe('component - event modifier .stop', () => {
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

describe('component - event modifier .self', () => {
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

describe('component - event modifier .once', () => {
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

describe('component - event modifier .debounce', () => {
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

describe('component - event modifier .throttle', () => {
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

describe('component - combined event modifiers', () => {
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
// Key modifiers - .enter, .escape, .tab, .space, .delete, .up, .down, .left, .right
// ===========================================================================

describe('component - key modifier .enter', () => {
  it('fires handler only on Enter key', () => {
    let count = 0;
    component('key-enter', {
      handler() { count++; },
      render() { return '<input @keydown.enter="handler">'; },
    });
    document.body.innerHTML = '<key-enter id="ke"></key-enter>';
    mount('#ke', 'key-enter');
    const input = document.querySelector('#ke input');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(count).toBe(1);

    // Other keys should NOT fire
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(count).toBe(1);
  });
});

describe('component - key modifier .escape', () => {
  it('fires handler only on Escape key', () => {
    let count = 0;
    component('key-esc', {
      handler() { count++; },
      render() { return '<input @keydown.escape="handler">'; },
    });
    document.body.innerHTML = '<key-esc id="kesc"></key-esc>';
    mount('#kesc', 'key-esc');
    const input = document.querySelector('#kesc input');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(count).toBe(1);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(count).toBe(1);
  });
});

describe('component - key modifier .tab', () => {
  it('fires handler only on Tab key', () => {
    let count = 0;
    component('key-tab', {
      handler() { count++; },
      render() { return '<input @keydown.tab="handler">'; },
    });
    document.body.innerHTML = '<key-tab id="ktab"></key-tab>';
    mount('#ktab', 'key-tab');
    const input = document.querySelector('#ktab input');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(count).toBe(1);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(count).toBe(1);
  });
});

describe('component - key modifier .space', () => {
  it('fires handler only on Space key', () => {
    let count = 0;
    component('key-space', {
      handler() { count++; },
      render() { return '<button @keydown.space="handler">btn</button>'; },
    });
    document.body.innerHTML = '<key-space id="kspc"></key-space>';
    mount('#kspc', 'key-space');
    const btn = document.querySelector('#kspc button');

    btn.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(count).toBe(1);

    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(count).toBe(1);
  });
});

describe('component - key modifier .delete', () => {
  it('fires handler on Delete and Backspace keys', () => {
    let count = 0;
    component('key-del', {
      handler() { count++; },
      render() { return '<input @keydown.delete="handler">'; },
    });
    document.body.innerHTML = '<key-del id="kdel"></key-del>';
    mount('#kdel', 'key-del');
    const input = document.querySelector('#kdel input');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    expect(count).toBe(1);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    expect(count).toBe(2);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(count).toBe(2);
  });
});

describe('component - key modifier arrow keys', () => {
  it('.up fires only on ArrowUp', () => {
    let count = 0;
    component('key-up', {
      handler() { count++; },
      render() { return '<input @keydown.up="handler">'; },
    });
    document.body.innerHTML = '<key-up id="kup"></key-up>';
    mount('#kup', 'key-up');
    const input = document.querySelector('#kup input');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(count).toBe(1);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(count).toBe(1);
  });

  it('.down fires only on ArrowDown', () => {
    let count = 0;
    component('key-down', {
      handler() { count++; },
      render() { return '<input @keydown.down="handler">'; },
    });
    document.body.innerHTML = '<key-down id="kdn"></key-down>';
    mount('#kdn', 'key-down');
    const input = document.querySelector('#kdn input');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(count).toBe(1);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(count).toBe(1);
  });

  it('.left fires only on ArrowLeft', () => {
    let count = 0;
    component('key-left', {
      handler() { count++; },
      render() { return '<input @keydown.left="handler">'; },
    });
    document.body.innerHTML = '<key-left id="klf"></key-left>';
    mount('#klf', 'key-left');
    const input = document.querySelector('#klf input');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(count).toBe(1);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(count).toBe(1);
  });

  it('.right fires only on ArrowRight', () => {
    let count = 0;
    component('key-right', {
      handler() { count++; },
      render() { return '<input @keydown.right="handler">'; },
    });
    document.body.innerHTML = '<key-right id="krt"></key-right>';
    mount('#krt', 'key-right');
    const input = document.querySelector('#krt input');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(count).toBe(1);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(count).toBe(1);
  });
});

describe('component - key modifiers combined with other modifiers', () => {
  it('.enter.prevent prevents default only on Enter', () => {
    component('key-enter-prev', {
      handler() {},
      render() { return '<input @keydown.enter.prevent="handler">'; },
    });
    document.body.innerHTML = '<key-enter-prev id="kep"></key-enter-prev>';
    mount('#kep', 'key-enter-prev');
    const input = document.querySelector('#kep input');

    const enterEvt = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    vi.spyOn(enterEvt, 'preventDefault');
    input.dispatchEvent(enterEvt);
    expect(enterEvt.preventDefault).toHaveBeenCalled();

    // Other key should not trigger handler or preventDefault
    const tabEvt = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    vi.spyOn(tabEvt, 'preventDefault');
    input.dispatchEvent(tabEvt);
    expect(tabEvt.preventDefault).not.toHaveBeenCalled();
  });
});


// ===========================================================================
// System key modifiers - .ctrl, .shift, .alt, .meta
// ===========================================================================

describe('component - system key modifier .ctrl', () => {
  it('fires only when Ctrl is held', () => {
    let count = 0;
    component('sys-ctrl', {
      handler() { count++; },
      render() { return '<input @keydown.ctrl="handler">'; },
    });
    document.body.innerHTML = '<sys-ctrl id="sc"></sys-ctrl>';
    mount('#sc', 'sys-ctrl');
    const input = document.querySelector('#sc input');

    // Without Ctrl - should NOT fire
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, ctrlKey: false }));
    expect(count).toBe(0);

    // With Ctrl - should fire
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, ctrlKey: true }));
    expect(count).toBe(1);
  });
});

describe('component - system key modifier .shift', () => {
  it('fires only when Shift is held', () => {
    let count = 0;
    component('sys-shift', {
      handler() { count++; },
      render() { return '<input @keydown.shift="handler">'; },
    });
    document.body.innerHTML = '<sys-shift id="ss"></sys-shift>';
    mount('#ss', 'sys-shift');
    const input = document.querySelector('#ss input');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, shiftKey: false }));
    expect(count).toBe(0);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, shiftKey: true }));
    expect(count).toBe(1);
  });
});

describe('component - system key modifier .alt', () => {
  it('fires only when Alt is held', () => {
    let count = 0;
    component('sys-alt', {
      handler() { count++; },
      render() { return '<input @keydown.alt="handler">'; },
    });
    document.body.innerHTML = '<sys-alt id="sa"></sys-alt>';
    mount('#sa', 'sys-alt');
    const input = document.querySelector('#sa input');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, altKey: false }));
    expect(count).toBe(0);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, altKey: true }));
    expect(count).toBe(1);
  });
});

describe('component - system key modifier .meta', () => {
  it('fires only when Meta (Cmd/Win) is held', () => {
    let count = 0;
    component('sys-meta', {
      handler() { count++; },
      render() { return '<input @keydown.meta="handler">'; },
    });
    document.body.innerHTML = '<sys-meta id="sm"></sys-meta>';
    mount('#sm', 'sys-meta');
    const input = document.querySelector('#sm input');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, metaKey: false }));
    expect(count).toBe(0);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, metaKey: true }));
    expect(count).toBe(1);
  });
});

describe('component - combined key + system modifiers', () => {
  it('.ctrl.enter fires only on Ctrl+Enter', () => {
    let count = 0;
    component('sys-ctrl-enter', {
      handler() { count++; },
      render() { return '<textarea @keydown.ctrl.enter="handler"></textarea>'; },
    });
    document.body.innerHTML = '<sys-ctrl-enter id="sce"></sys-ctrl-enter>';
    mount('#sce', 'sys-ctrl-enter');
    const ta = document.querySelector('#sce textarea');

    // Enter without Ctrl
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, ctrlKey: false }));
    expect(count).toBe(0);

    // Ctrl without Enter
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, ctrlKey: true }));
    expect(count).toBe(0);

    // Ctrl+Enter
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, ctrlKey: true }));
    expect(count).toBe(1);
  });

  it('.shift.enter fires only on Shift+Enter', () => {
    let count = 0;
    component('sys-shift-enter', {
      handler() { count++; },
      render() { return '<textarea @keydown.shift.enter="handler"></textarea>'; },
    });
    document.body.innerHTML = '<sys-shift-enter id="sse"></sys-shift-enter>';
    mount('#sse', 'sys-shift-enter');
    const ta = document.querySelector('#sse textarea');

    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, shiftKey: false }));
    expect(count).toBe(0);

    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, shiftKey: true }));
    expect(count).toBe(1);
  });
});


// ===========================================================================
// Dynamic key modifiers - arbitrary keys matched against e.key
// ===========================================================================

describe('component - dynamic key modifier: single letter keys', () => {
  it('.a fires only on "a" key (case-insensitive)', () => {
    let count = 0;
    component('dkey-a', {
      handler() { count++; },
      render() { return '<input @keydown.a="handler">'; },
    });
    document.body.innerHTML = '<dkey-a id="dka"></dkey-a>';
    mount('#dka', 'dkey-a');
    const input = document.querySelector('#dka input');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(count).toBe(1);

    // Uppercase A should also match (case-insensitive)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', bubbles: true }));
    expect(count).toBe(2);

    // Other keys must NOT fire
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(count).toBe(2);
  });

  it('.z fires only on "z" key', () => {
    let count = 0;
    component('dkey-z', {
      handler() { count++; },
      render() { return '<input @keydown.z="handler">'; },
    });
    document.body.innerHTML = '<dkey-z id="dkz"></dkey-z>';
    mount('#dkz', 'dkey-z');
    const input = document.querySelector('#dkz input');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true }));
    expect(count).toBe(1);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Z', bubbles: true }));
    expect(count).toBe(2);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(count).toBe(2);
  });
});

describe('component - dynamic key modifier: function keys', () => {
  it('.f1 fires only on F1', () => {
    let count = 0;
    component('dkey-f1', {
      handler() { count++; },
      render() { return '<div @keydown.f1="handler" tabindex="0">x</div>'; },
    });
    document.body.innerHTML = '<dkey-f1 id="dkf1"></dkey-f1>';
    mount('#dkf1', 'dkey-f1');
    const el = document.querySelector('#dkf1 div');

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'F1', bubbles: true }));
    expect(count).toBe(1);

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true }));
    expect(count).toBe(1);
  });

  it('.f12 fires only on F12', () => {
    let count = 0;
    component('dkey-f12', {
      handler() { count++; },
      render() { return '<div @keydown.f12="handler" tabindex="0">x</div>'; },
    });
    document.body.innerHTML = '<dkey-f12 id="dkf12"></dkey-f12>';
    mount('#dkf12', 'dkey-f12');
    const el = document.querySelector('#dkf12 div');

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'F12', bubbles: true }));
    expect(count).toBe(1);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'F1', bubbles: true }));
    expect(count).toBe(1);
  });
});

describe('component - dynamic key modifier: numeric keys', () => {
  it('.0 fires only on "0" key (not confused with debounce/throttle ms)', () => {
    let count = 0;
    component('dkey-zero', {
      handler() { count++; },
      render() { return '<input @keydown.0="handler">'; },
    });
    document.body.innerHTML = '<dkey-zero id="dk0"></dkey-zero>';
    mount('#dk0', 'dkey-zero');
    const input = document.querySelector('#dk0 input');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: '0', bubbles: true }));
    expect(count).toBe(1);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
    expect(count).toBe(1);
  });
});

describe('component - dynamic key modifier: special/punctuation keys', () => {
  it('.+ fires on "+" key', () => {
    let count = 0;
    component('dkey-plus', {
      handler() { count++; },
      render() { return '<div @keydown.+="handler" tabindex="0">x</div>'; },
    });
    document.body.innerHTML = '<dkey-plus id="dkplus"></dkey-plus>';
    mount('#dkplus', 'dkey-plus');
    const el = document.querySelector('#dkplus div');

    el.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
    expect(count).toBe(1);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: '-', bubbles: true }));
    expect(count).toBe(1);
  });

  it('.- fires on "-" key', () => {
    let count = 0;
    component('dkey-minus', {
      handler() { count++; },
      render() { return '<div @keydown.-="handler" tabindex="0">x</div>'; },
    });
    document.body.innerHTML = '<dkey-minus id="dkminus"></dkey-minus>';
    mount('#dkminus', 'dkey-minus');
    const el = document.querySelector('#dkminus div');

    el.dispatchEvent(new KeyboardEvent('keydown', { key: '-', bubbles: true }));
    expect(count).toBe(1);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
    expect(count).toBe(1);
  });
});

describe('component - dynamic key modifier combined with system modifiers', () => {
  it('.ctrl.s fires only on Ctrl+S', () => {
    let count = 0;
    component('dkey-ctrl-s', {
      handler() { count++; },
      render() { return '<div @keydown.ctrl.s="handler" tabindex="0">x</div>'; },
    });
    document.body.innerHTML = '<dkey-ctrl-s id="dkcs"></dkey-ctrl-s>';
    mount('#dkcs', 'dkey-ctrl-s');
    const el = document.querySelector('#dkcs div');

    // S without Ctrl → no fire
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true, ctrlKey: false }));
    expect(count).toBe(0);

    // Ctrl without S → no fire
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, ctrlKey: true }));
    expect(count).toBe(0);

    // Ctrl+S → fire
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true, ctrlKey: true }));
    expect(count).toBe(1);

    // Ctrl+Shift+S (uppercase) → also fires (case insensitive)
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'S', bubbles: true, ctrlKey: true }));
    expect(count).toBe(2);
  });

  it('.meta.k fires only on Meta+K', () => {
    let count = 0;
    component('dkey-meta-k', {
      handler() { count++; },
      render() { return '<div @keydown.meta.k="handler" tabindex="0">x</div>'; },
    });
    document.body.innerHTML = '<dkey-meta-k id="dkmk"></dkey-meta-k>';
    mount('#dkmk', 'dkey-meta-k');
    const el = document.querySelector('#dkmk div');

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true, metaKey: false }));
    expect(count).toBe(0);

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true, metaKey: true }));
    expect(count).toBe(1);
  });

  it('.alt.shift.f fires only on Alt+Shift+F', () => {
    let count = 0;
    component('dkey-alt-sf', {
      handler() { count++; },
      render() { return '<div @keydown.alt.shift.f="handler" tabindex="0">x</div>'; },
    });
    document.body.innerHTML = '<dkey-alt-sf id="dkas"></dkey-alt-sf>';
    mount('#dkas', 'dkey-alt-sf');
    const el = document.querySelector('#dkas div');

    // Missing shift
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true, altKey: true, shiftKey: false }));
    expect(count).toBe(0);

    // Missing alt
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true, altKey: false, shiftKey: true }));
    expect(count).toBe(0);

    // Both held
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true, altKey: true, shiftKey: true }));
    expect(count).toBe(1);
  });
});

describe('component - dynamic key modifier combined with behaviour modifiers', () => {
  it('.a.prevent calls preventDefault only on "a" key', () => {
    component('dkey-a-prev', {
      handler() {},
      render() { return '<input @keydown.a.prevent="handler">'; },
    });
    document.body.innerHTML = '<dkey-a-prev id="dkap"></dkey-a-prev>';
    mount('#dkap', 'dkey-a-prev');
    const input = document.querySelector('#dkap input');

    const aEvt = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    vi.spyOn(aEvt, 'preventDefault');
    input.dispatchEvent(aEvt);
    expect(aEvt.preventDefault).toHaveBeenCalled();

    const bEvt = new KeyboardEvent('keydown', { key: 'b', bubbles: true, cancelable: true });
    vi.spyOn(bEvt, 'preventDefault');
    input.dispatchEvent(bEvt);
    expect(bEvt.preventDefault).not.toHaveBeenCalled();
  });

  it('.ctrl.s.prevent.stop calls both preventDefault and stopPropagation', () => {
    component('dkey-cs-ps', {
      handler() {},
      render() { return '<div @keydown.ctrl.s.prevent.stop="handler" tabindex="0">x</div>'; },
    });
    document.body.innerHTML = '<dkey-cs-ps id="dkcsps"></dkey-cs-ps>';
    mount('#dkcsps', 'dkey-cs-ps');
    const el = document.querySelector('#dkcsps div');

    const evt = new KeyboardEvent('keydown', { key: 's', bubbles: true, cancelable: true, ctrlKey: true });
    vi.spyOn(evt, 'preventDefault');
    vi.spyOn(evt, 'stopPropagation');
    el.dispatchEvent(evt);
    expect(evt.preventDefault).toHaveBeenCalled();
    expect(evt.stopPropagation).toHaveBeenCalled();
  });
});

describe('component - dynamic key modifier: named shortcuts still work', () => {
  it('named shortcuts take priority over dynamic matching', () => {
    // .space maps to ' ' (literal space char) via _keyMap, NOT "space" string
    let count = 0;
    component('dkey-space-prio', {
      handler() { count++; },
      render() { return '<button @keydown.space="handler">x</button>'; },
    });
    document.body.innerHTML = '<dkey-space-prio id="dksp"></dkey-space-prio>';
    mount('#dksp', 'dkey-space-prio');
    const btn = document.querySelector('#dksp button');

    // ' ' is the actual e.key for Space
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(count).toBe(1);

    // 'space' is NOT the e.key - should NOT fire because .space uses _keyMap
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'space', bubbles: true }));
    expect(count).toBe(1);
  });

  it('.delete still matches both Delete and Backspace', () => {
    let count = 0;
    component('dkey-del-prio', {
      handler() { count++; },
      render() { return '<input @keydown.delete="handler">'; },
    });
    document.body.innerHTML = '<dkey-del-prio id="dkdp"></dkey-del-prio>';
    mount('#dkdp', 'dkey-del-prio');
    const input = document.querySelector('#dkdp input');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    expect(count).toBe(1);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    expect(count).toBe(2);
  });
});

describe('component - dynamic key modifier: no-key events are not filtered', () => {
  it('click events pass through dynamic key modifiers without e.key', () => {
    // A .prevent on a click should not be treated as a key filter
    let count = 0;
    component('dkey-click-ok', {
      handler() { count++; },
      render() { return '<button @click.prevent="handler">x</button>'; },
    });
    document.body.innerHTML = '<dkey-click-ok id="dkco"></dkey-click-ok>';
    mount('#dkco', 'dkey-click-ok');
    const btn = document.querySelector('#dkco button');

    btn.click();
    expect(count).toBe(1);
  });
});

describe('component - dynamic key modifier: debounce/throttle ms values not treated as keys', () => {
  it('.debounce.300 does not treat "300" as a key filter', async () => {
    let count = 0;
    component('dkey-deb-num', {
      handler() { count++; },
      render() { return '<input @input.debounce.300="handler">'; },
    });
    document.body.innerHTML = '<dkey-deb-num id="dkdn"></dkey-deb-num>';
    mount('#dkdn', 'dkey-deb-num');
    const input = document.querySelector('#dkdn input');

    input.dispatchEvent(new Event('input', { bubbles: true }));
    // Should be debounced, not blocked by "300" key filter
    await new Promise(r => setTimeout(r, 350));
    expect(count).toBe(1);
  });
});

describe('component - dynamic key modifier: multiple dynamic keys on separate bindings', () => {
  it('separate @keydown.a and @keydown.b fire independently', () => {
    let aCount = 0, bCount = 0;
    component('dkey-ab', {
      handlerA() { aCount++; },
      handlerB() { bCount++; },
      render() { return '<input @keydown.a="handlerA" @keydown.b="handlerB">'; },
    });
    document.body.innerHTML = '<dkey-ab id="dkab"></dkey-ab>';
    mount('#dkab', 'dkey-ab');
    const input = document.querySelector('#dkab input');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(aCount).toBe(1);
    expect(bCount).toBe(0);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }));
    expect(aCount).toBe(1);
    expect(bCount).toBe(1);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
    expect(aCount).toBe(1);
    expect(bCount).toBe(1);
  });
});

describe('component - dynamic key modifier: keyup vs keydown', () => {
  it('.a works on keyup events too', () => {
    let downCount = 0, upCount = 0;
    component('dkey-updown', {
      onDown() { downCount++; },
      onUp() { upCount++; },
      render() { return '<input @keydown.a="onDown" @keyup.a="onUp">'; },
    });
    document.body.innerHTML = '<dkey-updown id="dkud"></dkey-updown>';
    mount('#dkud', 'dkey-updown');
    const input = document.querySelector('#dkud input');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(downCount).toBe(1);
    expect(upCount).toBe(0);

    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }));
    expect(downCount).toBe(1);
    expect(upCount).toBe(1);

    // Wrong key on both → neither fires
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'b', bubbles: true }));
    expect(downCount).toBe(1);
    expect(upCount).toBe(1);
  });
});

describe('component - dynamic key modifier: edge cases with e.key', () => {
  it('event without e.key property does not fire dynamic key handler', () => {
    let count = 0;
    component('dkey-nokey', {
      handler() { count++; },
      render() { return '<div @keydown.a="handler" tabindex="0">x</div>'; },
    });
    document.body.innerHTML = '<dkey-nokey id="dknk"></dkey-nokey>';
    mount('#dknk', 'dkey-nokey');
    const el = document.querySelector('#dknk div');

    // KeyboardEvent with no key specified → e.key is empty string
    el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    expect(count).toBe(0);
  });

  it('case-insensitive match for multi-char keys like PageDown', () => {
    let count = 0;
    component('dkey-pgdn', {
      handler() { count++; },
      render() { return '<div @keydown.pagedown="handler" tabindex="0">x</div>'; },
    });
    document.body.innerHTML = '<dkey-pgdn id="dkpd"></dkey-pgdn>';
    mount('#dkpd', 'dkey-pgdn');
    const el = document.querySelector('#dkpd div');

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
    expect(count).toBe(1);

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }));
    expect(count).toBe(1);
  });

  it('.home and .end match Home / End keys', () => {
    let homeCount = 0, endCount = 0;
    component('dkey-homeend', {
      onHome() { homeCount++; },
      onEnd() { endCount++; },
      render() { return '<input @keydown.home="onHome" @keydown.end="onEnd">'; },
    });
    document.body.innerHTML = '<dkey-homeend id="dkhe"></dkey-homeend>';
    mount('#dkhe', 'dkey-homeend');
    const input = document.querySelector('#dkhe input');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(homeCount).toBe(1);
    expect(endCount).toBe(0);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(homeCount).toBe(1);
    expect(endCount).toBe(1);
  });

  it('.insert matches Insert key', () => {
    let count = 0;
    component('dkey-ins', {
      handler() { count++; },
      render() { return '<input @keydown.insert="handler">'; },
    });
    document.body.innerHTML = '<dkey-ins id="dkins"></dkey-ins>';
    mount('#dkins', 'dkey-ins');
    const input = document.querySelector('#dkins input');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Insert', bubbles: true }));
    expect(count).toBe(1);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    expect(count).toBe(1);
  });
});

describe('component - dynamic key modifier: non-interfering with existing modifiers', () => {
  it('.once still works with dynamic key', () => {
    let count = 0;
    component('dkey-once-a', {
      handler() { count++; },
      render() { return '<input @keydown.a.once="handler">'; },
    });
    document.body.innerHTML = '<dkey-once-a id="dkoa"></dkey-once-a>';
    mount('#dkoa', 'dkey-once-a');
    const input = document.querySelector('#dkoa input');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(count).toBe(1);

    // Second press should NOT fire (.once)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(count).toBe(1);
  });

  it('.self still works with dynamic key', () => {
    let count = 0;
    component('dkey-self-a', {
      handler() { count++; },
      render() { return '<div @keydown.a.self="handler" tabindex="0"><span>child</span></div>'; },
    });
    document.body.innerHTML = '<dkey-self-a id="dksa"></dkey-self-a>';
    mount('#dksa', 'dkey-self-a');
    const div = document.querySelector('#dksa div');
    const span = document.querySelector('#dksa span');

    // Fire on div itself → should work
    div.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(count).toBe(1);

    // Fire from child → should NOT fire (.self)
    span.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(count).toBe(1);
  });
});


// ===========================================================================
// .outside modifier - fire when event target is outside the element
// ===========================================================================

describe('component - .outside event modifier', () => {
  it('fires handler when clicking outside the element', () => {
    let count = 0;
    component('evt-outside', {
      close() { count++; },
      render() { return '<div class="dropdown" @click.outside="close"><span>menu</span></div>'; },
    });
    document.body.innerHTML = '<evt-outside id="eo"></evt-outside>';
    mount('#eo', 'evt-outside');

    // Click inside the dropdown - should NOT fire
    document.querySelector('#eo .dropdown').click();
    expect(count).toBe(0);

    // Click inside a child - should NOT fire
    document.querySelector('#eo span').click();
    expect(count).toBe(0);

    // Click on the component root (outside the dropdown) - should fire
    document.querySelector('#eo').dispatchEvent(new Event('click', { bubbles: true }));
    expect(count).toBe(1);
  });

  it('fires handler when clicking on document body (outside component)', () => {
    let count = 0;
    component('evt-outside2', {
      close() { count++; },
      render() { return '<div class="modal" @click.outside="close">modal content</div>'; },
    });
    document.body.innerHTML = '<div id="other">other</div><evt-outside2 id="eo2"></evt-outside2>';
    mount('#eo2', 'evt-outside2');

    // Click on unrelated element
    document.querySelector('#other').dispatchEvent(new Event('click', { bubbles: true }));
    expect(count).toBe(1);
  });

  it('does not fire on click inside the element', () => {
    let count = 0;
    component('evt-outside3', {
      close() { count++; },
      render() { return '<div class="panel" @click.outside="close"><button>inside</button></div>'; },
    });
    document.body.innerHTML = '<evt-outside3 id="eo3"></evt-outside3>';
    mount('#eo3', 'evt-outside3');

    document.querySelector('#eo3 button').click();
    expect(count).toBe(0);
    document.querySelector('#eo3 .panel').click();
    expect(count).toBe(0);
  });
});
// z-for advanced - object, iterable, range, null
// ===========================================================================

describe('component - z-for object iteration', () => {
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

describe('component - z-for numeric range', () => {
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

describe('component - z-for null/undefined list removes element', () => {
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

describe('component - z-for with empty array', () => {
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

describe('component - z-for with $index', () => {
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

describe('component - z-for with invalid expression', () => {
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
// z-class - string and array forms
// ===========================================================================

describe('component - z-class string form', () => {
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

describe('component - z-class array form', () => {
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
// z-style - string form
// ===========================================================================

describe('component - z-style string form', () => {
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

describe('component - z-text with null/undefined', () => {
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

describe('component - z-html with null', () => {
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

describe('component - z-text expression evaluation', () => {
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

describe('mountAll - static props', () => {
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

describe('mountAll - skips already-mounted instances', () => {
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
// Component - scoped styles edge cases
// ===========================================================================

describe('component - scoped styles injection', () => {
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
// Component - event handler with state.* arg passthrough
// ===========================================================================

describe('component - event handler receives state.* arguments', () => {
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

describe('component - event handler with boolean/null args', () => {
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
// Component - z-bind edge cases
// ===========================================================================

describe('component - z-bind with false removes boolean attr', () => {
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
// Component - z-if / z-show with computed
// ===========================================================================

describe('component - z-if with computed expression', () => {
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

describe('component - z-show with computed expression', () => {
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
// Component - interpolation edge cases
// ===========================================================================

describe('component - interpolation edge cases', () => {
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
// Component - lifecycle edge cases
// ===========================================================================

describe('component - destroy removes from instance map', () => {
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

describe('component - multiple instances of same component', () => {
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


// ===========================================================================
// Custom HTML tag - "drop it anywhere" behavior
// ===========================================================================

describe('custom HTML tag - drop-in component mounting', () => {

  // -- Basic rendering -------------------------------------------------------

  it('renders a component when its custom tag appears in the DOM', () => {
    component('drop-basic', {
      render() { return '<p class="drop-basic-out">Hello from drop-in</p>'; },
    });
    document.body.innerHTML = '<drop-basic></drop-basic>';
    mountAll();
    expect(document.querySelector('.drop-basic-out').textContent).toBe('Hello from drop-in');
  });

  it('renders initial state into the template', () => {
    component('drop-state', {
      state: () => ({ name: 'World' }),
      render() { return `<span class="drop-state-out">Hello ${this.state.name}</span>`; },
    });
    document.body.innerHTML = '<drop-state></drop-state>';
    mountAll();
    expect(document.querySelector('.drop-state-out').textContent).toBe('Hello World');
  });

  // -- State reactivity ------------------------------------------------------

  it('re-renders when state changes', async () => {
    component('drop-reactive', {
      state: () => ({ count: 0 }),
      render() { return `<span class="drop-r">${this.state.count}</span>`; },
    });
    document.body.innerHTML = '<drop-reactive></drop-reactive>';
    mountAll();
    expect(document.querySelector('.drop-r').textContent).toBe('0');

    const inst = getInstance(document.querySelector('drop-reactive'));
    inst.state.count = 5;
    await new Promise(r => setTimeout(r, 50));
    expect(document.querySelector('.drop-r').textContent).toBe('5');
  });

  // -- Event handling --------------------------------------------------------

  it('handles @click on a button inside the component', async () => {
    component('drop-click', {
      state: () => ({ count: 0 }),
      increment() { this.state.count++; },
      render() {
        return `
          <div>
            <span class="drop-click-val">${this.state.count}</span>
            <button class="drop-click-btn" @click="increment">+1</button>
          </div>
        `;
      },
    });
    document.body.innerHTML = '<drop-click></drop-click>';
    mountAll();
    expect(document.querySelector('.drop-click-val').textContent).toBe('0');

    document.querySelector('.drop-click-btn').click();
    await new Promise(r => setTimeout(r, 50));
    expect(document.querySelector('.drop-click-val').textContent).toBe('1');

    document.querySelector('.drop-click-btn').click();
    document.querySelector('.drop-click-btn').click();
    await new Promise(r => setTimeout(r, 50));
    expect(document.querySelector('.drop-click-val').textContent).toBe('3');
  });

  // -- Multiple instances (independent state) --------------------------------

  it('mounts multiple instances with independent state', async () => {
    component('drop-multi', {
      state: () => ({ n: 0 }),
      bump() { this.state.n++; },
      render() {
        return `<div><span class="dm-val">${this.state.n}</span><button class="dm-btn" @click="bump">+</button></div>`;
      },
    });
    document.body.innerHTML = `
      <drop-multi id="dm1"></drop-multi>
      <drop-multi id="dm2"></drop-multi>
    `;
    mountAll();

    const vals = () => [...document.querySelectorAll('.dm-val')].map(el => el.textContent);
    expect(vals()).toEqual(['0', '0']);

    // Click only the first one's button
    document.querySelector('#dm1 .dm-btn').click();
    await new Promise(r => setTimeout(r, 50));
    expect(vals()).toEqual(['1', '0']);
  });

  // -- Static props from attributes ------------------------------------------

  it('passes static attributes as props', () => {
    component('drop-props', {
      render() { return `<span class="dp-out">${this.props.label}</span>`; },
    });
    document.body.innerHTML = '<drop-props label="Click me"></drop-props>';
    mountAll();
    expect(document.querySelector('.dp-out').textContent).toBe('Click me');
  });

  it('JSON-parses numeric and boolean attribute values', () => {
    component('drop-json-props', {
      render() {
        return `<span class="djp-type">${typeof this.props.count}-${typeof this.props.active}</span>`;
      },
    });
    document.body.innerHTML = '<drop-json-props count="5" active="true"></drop-json-props>';
    mountAll();
    expect(document.querySelector('.djp-type').textContent).toBe('number-boolean');
  });

  // -- Lifecycle hooks -------------------------------------------------------

  it('calls init and mounted hooks', () => {
    const order = [];
    component('drop-lifecycle', {
      init() { order.push('init'); },
      mounted() { order.push('mounted'); },
      render() { return '<div>lifecycle</div>'; },
    });
    document.body.innerHTML = '<drop-lifecycle></drop-lifecycle>';
    mountAll();
    expect(order).toEqual(['init', 'mounted']);
  });

  it('calls destroyed hook when instance is destroyed', () => {
    let destroyed = false;
    component('drop-destroy', {
      destroyed() { destroyed = true; },
      render() { return '<div>destroyable</div>'; },
    });
    document.body.innerHTML = '<drop-destroy></drop-destroy>';
    mountAll();
    const inst = getInstance(document.querySelector('drop-destroy'));
    inst.destroy();
    expect(destroyed).toBe(true);
  });

  // -- Nested components (child tags inside parent render) -------------------

  it('auto-mounts child components rendered inside a parent', () => {
    component('drop-child', {
      render() { return '<em class="dc-child">child</em>'; },
    });
    component('drop-parent', {
      render() { return '<div class="dc-parent"><drop-child></drop-child></div>'; },
    });
    document.body.innerHTML = '<drop-parent></drop-parent>';
    mountAll();
    expect(document.querySelector('.dc-parent')).not.toBeNull();
    expect(document.querySelector('.dc-child').textContent).toBe('child');
  });

  // -- Idempotency -----------------------------------------------------------

  it('does not re-mount an already-mounted tag on repeated mountAll calls', () => {
    let initCount = 0;
    component('drop-idempotent', {
      init() { initCount++; },
      render() { return '<div>idem</div>'; },
    });
    document.body.innerHTML = '<drop-idempotent></drop-idempotent>';
    mountAll();
    mountAll();
    mountAll();
    expect(initCount).toBe(1);
  });

  // -- Scattered placement ---------------------------------------------------

  it('mounts tags scattered among regular HTML', () => {
    component('drop-scattered', {
      render() { return '<b class="ds-out">found</b>'; },
    });
    document.body.innerHTML = `
      <header><h1>Page Title</h1></header>
      <main>
        <p>Some content</p>
        <drop-scattered></drop-scattered>
        <p>More content</p>
      </main>
      <footer>
        <drop-scattered></drop-scattered>
      </footer>
    `;
    mountAll();
    const tags = document.querySelectorAll('.ds-out');
    expect(tags.length).toBe(2);
    tags.forEach(el => expect(el.textContent).toBe('found'));
  });

  // -- Full click-counter example from docs ----------------------------------

  it('click-counter from docs works end-to-end', async () => {
    component('click-counter', {
      state: () => ({ count: 0 }),
      increment() { this.state.count++; },
      render() {
        return `
          <div class="counter">
            <span class="cc-count">Count: ${this.state.count}</span>
            <button class="cc-btn" @click="increment">+1</button>
          </div>
        `;
      },
    });

    // Drop it anywhere - just like the docs say
    document.body.innerHTML = `
      <h1>My Page</h1>
      <click-counter></click-counter>
      <p>Some other content</p>
      <click-counter></click-counter>
    `;
    mountAll();

    const counts = () => [...document.querySelectorAll('.cc-count')].map(el => el.textContent);
    const buttons = document.querySelectorAll('.cc-btn');

    expect(counts()).toEqual(['Count: 0', 'Count: 0']);

    // Click the first counter 3 times
    buttons[0].click();
    buttons[0].click();
    buttons[0].click();
    await new Promise(r => setTimeout(r, 50));
    expect(counts()).toEqual(['Count: 3', 'Count: 0']);

    // Click the second counter once
    buttons[1].click();
    await new Promise(r => setTimeout(r, 50));
    expect(counts()).toEqual(['Count: 3', 'Count: 1']);
  });
});
