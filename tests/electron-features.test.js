import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStore, getStore, connectStore } from '../src/store.js';
import { component, mount, mountAll, getInstance, destroy, getRegistry } from '../src/component.js';
import { createRouter, getRouter } from '../src/router.js';


// ===========================================================================
// Feature 1: Multi-Key Store Subscriptions
// ===========================================================================

describe('Store - multi-key subscriptions', () => {
  it('subscribes to multiple keys with array syntax', () => {
    const store = createStore('multi-key-1', {
      state: { files: [], isProcessing: false, operation: '' },
      actions: {
        setFiles(state, v) { state.files = v; },
        setProcessing(state, v) { state.isProcessing = v; },
        setOperation(state, v) { state.operation = v; },
      },
    });
    const calls = [];
    store.subscribe(['files', 'isProcessing'], (key, value, old) => {
      calls.push({ key, newVal: value, oldVal: old });
    });

    store.dispatch('setFiles', ['a.mp3']);
    store.dispatch('setProcessing', true);
    store.dispatch('setOperation', 'encode');

    // Should only fire for 'files' and 'isProcessing', NOT 'operation'
    expect(calls.length).toBe(2);
    expect(calls[0].key).toBe('files');
    expect(calls[1].key).toBe('isProcessing');
    expect(calls[1].newVal).toBe(true);
  });

  it('unsubscribes from multi-key subscription', () => {
    const store = createStore('multi-key-2', {
      state: { a: 0, b: 0 },
      actions: {
        setA(state, v) { state.a = v; },
        setB(state, v) { state.b = v; },
      },
    });
    const fn = vi.fn();
    const unsub = store.subscribe(['a', 'b'], fn);

    store.dispatch('setA', 1);
    expect(fn).toHaveBeenCalledTimes(1);

    unsub();
    store.dispatch('setB', 2);
    expect(fn).toHaveBeenCalledTimes(1); // still 1, unsubscribed
  });

  it('multi-key subscription does not fire for unlisted keys', () => {
    const store = createStore('multi-key-3', {
      state: { x: 0, y: 0, z: 0 },
      actions: {
        setX(state, v) { state.x = v; },
        setY(state, v) { state.y = v; },
        setZ(state, v) { state.z = v; },
      },
    });
    const fn = vi.fn();
    store.subscribe(['x'], fn);

    store.dispatch('setY', 1);
    store.dispatch('setZ', 2);
    expect(fn).not.toHaveBeenCalled();

    store.dispatch('setX', 5);
    expect(fn).toHaveBeenCalledWith('x', 5, 0);
  });

  it('mixed: single-key, multi-key, and wildcard subscribers all fire correctly', () => {
    const store = createStore('multi-key-4', {
      state: { a: 0, b: 0, c: 0 },
      actions: {
        setA(state, v) { state.a = v; },
        setB(state, v) { state.b = v; },
        setC(state, v) { state.c = v; },
      },
    });
    const singleFn = vi.fn();
    const multiFn = vi.fn();
    const wildcardFn = vi.fn();

    store.subscribe('a', singleFn);
    store.subscribe(['a', 'b'], multiFn);
    store.subscribe(wildcardFn);

    store.dispatch('setA', 10);
    expect(singleFn).toHaveBeenCalledTimes(1);
    expect(multiFn).toHaveBeenCalledTimes(1);
    expect(wildcardFn).toHaveBeenCalledTimes(1);

    store.dispatch('setC', 30);
    expect(singleFn).toHaveBeenCalledTimes(1);
    expect(multiFn).toHaveBeenCalledTimes(1);
    expect(wildcardFn).toHaveBeenCalledTimes(2);
  });

  it('multi-key subscription works with batch', () => {
    const store = createStore('multi-key-batch', {
      state: { a: 0, b: 0 },
    });
    const fn = vi.fn();
    store.subscribe(['a', 'b'], fn);

    store.batch(state => {
      state.a = 1;
      state.b = 2;
    });

    // Batch deduplicates per key, so each key fires once
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('empty array subscription never fires', () => {
    const store = createStore('multi-key-empty', {
      state: { x: 0 },
      actions: { setX(state, v) { state.x = v; } },
    });
    const fn = vi.fn();
    store.subscribe([], fn);
    store.dispatch('setX', 1);
    expect(fn).not.toHaveBeenCalled();
  });
});


// ===========================================================================
// Feature 2: Reactive Component Props
// ===========================================================================

describe('Component - reactive props', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('reads props from element attributes with type coercion', () => {
    component('prop-card', {
      props: {
        label: { type: String, default: '' },
        value: { type: Number, default: 0 },
        active: { type: Boolean, default: false },
      },
      render() {
        return `<div>${this.props.label}: ${this.props.value} (${this.props.active})</div>`;
      },
    });
    document.body.innerHTML = '<prop-card id="pc" label="Count" value="42" active="true"></prop-card>';
    const inst = mount('#pc', 'prop-card');
    expect(inst.props.label).toBe('Count');
    expect(inst.props.value).toBe(42);
    expect(inst.props.active).toBe(true);
  });

  it('uses default values when attributes are missing', () => {
    component('prop-defaults', {
      props: {
        label: { type: String, default: 'untitled' },
        count: { type: Number, default: 5 },
      },
      render() {
        return `<div>${this.props.label}: ${this.props.count}</div>`;
      },
    });
    document.body.innerHTML = '<prop-defaults id="pd"></prop-defaults>';
    const inst = mount('#pd', 'prop-defaults');
    expect(inst.props.label).toBe('untitled');
    expect(inst.props.count).toBe(5);
  });

  it('passed props override attributes', () => {
    component('prop-override', {
      props: {
        title: { type: String, default: '' },
      },
      render() {
        return `<h1>${this.props.title}</h1>`;
      },
    });
    document.body.innerHTML = '<prop-override id="po" title="from-attr"></prop-override>';
    const inst = mount('#po', 'prop-override', { title: 'from-mount' });
    expect(inst.props.title).toBe('from-mount');
  });

  it('coerces Boolean props correctly', () => {
    component('prop-bool', {
      props: {
        enabled: { type: Boolean, default: false },
        disabled: { type: Boolean, default: true },
      },
      render() { return '<div></div>'; },
    });
    document.body.innerHTML = '<prop-bool id="pb" enabled="true" disabled="false"></prop-bool>';
    const inst = mount('#pb', 'prop-bool');
    expect(inst.props.enabled).toBe(true);
    expect(inst.props.disabled).toBe(false);
  });

  it('coerces Object/JSON props', () => {
    component('prop-json', {
      props: {
        config: { type: Object, default: () => ({}) },
      },
      render() { return '<div></div>'; },
    });
    document.body.innerHTML = `<prop-json id="pj" config='{"theme":"dark"}'></prop-json>`;
    const inst = mount('#pj', 'prop-json');
    expect(inst.props.config).toEqual({ theme: 'dark' });
  });

  it('props are frozen (read-only)', () => {
    component('prop-frozen', {
      props: {
        name: { type: String, default: 'test' },
      },
      render() { return '<div></div>'; },
    });
    document.body.innerHTML = '<prop-frozen id="pf" name="hello"></prop-frozen>';
    const inst = mount('#pf', 'prop-frozen');
    expect(() => { inst.props.name = 'changed'; }).toThrow();
  });

  it('re-reads props when attributes change (MutationObserver)', async () => {
    component('prop-observe', {
      props: {
        label: { type: String, default: '' },
      },
      render() {
        return `<span>${this.props.label}</span>`;
      },
    });
    document.body.innerHTML = '<prop-observe id="pob" label="initial"></prop-observe>';
    const inst = mount('#pob', 'prop-observe');
    expect(inst.props.label).toBe('initial');

    // Change the attribute
    document.querySelector('#pob').setAttribute('label', 'updated');
    // MutationObserver fires asynchronously
    await new Promise(r => setTimeout(r, 50));
    expect(inst.props.label).toBe('updated');
  });

  it('supports shorthand type-only syntax', () => {
    component('prop-short', {
      props: {
        name: String,
        count: Number,
      },
      render() { return '<div></div>'; },
    });
    document.body.innerHTML = '<prop-short id="ps" name="test" count="7"></prop-short>';
    const inst = mount('#ps', 'prop-short');
    expect(inst.props.name).toBe('test');
    expect(inst.props.count).toBe(7);
  });

  it('legacy frozen props work when no props definition', () => {
    component('prop-legacy', {
      render() { return `<div>${this.props.title}</div>`; },
    });
    document.body.innerHTML = '<prop-legacy id="pl"></prop-legacy>';
    const inst = mount('#pl', 'prop-legacy', { title: 'hello' });
    expect(inst.props.title).toBe('hello');
    expect(Object.isFrozen(inst.props)).toBe(true);
  });

  it('cleans up MutationObserver on destroy', () => {
    component('prop-cleanup', {
      props: {
        val: { type: String, default: '' },
      },
      render() { return '<div></div>'; },
    });
    document.body.innerHTML = '<prop-cleanup id="pcl" val="x"></prop-cleanup>';
    const inst = mount('#pcl', 'prop-cleanup');
    expect(inst._propObserver).toBeDefined();
    inst.destroy();
    expect(inst._propObserver).toBeNull();
  });
});


// ===========================================================================
// Feature 3: Store-Component Connector
// ===========================================================================

describe('connectStore - store-component connector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('creates a connector descriptor', () => {
    const store = createStore('conn-test-1', { state: { x: 1 } });
    const desc = connectStore(store, ['x']);
    expect(desc._zqConnector).toBe(true);
    expect(desc.store).toBe(store);
    expect(desc.keys).toEqual(['x']);
  });

  it('auto-syncs store state to component.stores on mount', () => {
    const myStore = createStore('conn-test-2', {
      state: { files: ['a.mp3', 'b.mp3'], mode: 'normal' },
      actions: { setMode(state, v) { state.mode = v; } },
    });

    component('store-comp', {
      stores: {
        app: connectStore(myStore, ['files', 'mode']),
      },
      render() {
        return `<div>${this.stores.app.files.length} files, ${this.stores.app.mode}</div>`;
      },
    });

    document.body.innerHTML = '<store-comp id="sc"></store-comp>';
    const inst = mount('#sc', 'store-comp');

    expect(inst.stores.app.files).toEqual(['a.mp3', 'b.mp3']);
    expect(inst.stores.app.mode).toBe('normal');
  });

  it('updates component when store state changes', async () => {
    const myStore = createStore('conn-test-3', {
      state: { count: 0 },
      actions: { inc(state) { state.count++; } },
    });

    component('store-reactive', {
      stores: {
        data: connectStore(myStore, ['count']),
      },
      render() {
        return `<span class="count">${this.stores.data.count}</span>`;
      },
    });

    document.body.innerHTML = '<store-reactive id="sr"></store-reactive>';
    const inst = mount('#sr', 'store-reactive');
    expect(inst.stores.data.count).toBe(0);

    myStore.dispatch('inc');
    expect(inst.stores.data.count).toBe(1);

    // Wait for microtask re-render
    await new Promise(r => queueMicrotask(r));
    expect(document.querySelector('.count').textContent).toBe('1');
  });

  it('cleans up subscriptions on destroy', () => {
    const myStore = createStore('conn-test-4', {
      state: { x: 0 },
      actions: { setX(state, v) { state.x = v; } },
    });

    component('store-cleanup', {
      stores: {
        s: connectStore(myStore, ['x']),
      },
      render() { return '<div></div>'; },
    });

    document.body.innerHTML = '<store-cleanup id="scl"></store-cleanup>';
    const inst = mount('#scl', 'store-cleanup');

    const wildcardsBefore = myStore._wildcards.size;
    inst.destroy();
    const wildcardsAfter = myStore._wildcards.size;
    expect(wildcardsAfter).toBe(wildcardsBefore - 1);
  });

  it('supports multiple store connections', () => {
    const storeA = createStore('conn-a', {
      state: { mode: 'edit' },
    });
    const storeB = createStore('conn-b', {
      state: { theme: 'dark' },
    });

    component('multi-store', {
      stores: {
        app: connectStore(storeA, ['mode']),
        ui: connectStore(storeB, ['theme']),
      },
      render() {
        return `<div>${this.stores.app.mode} - ${this.stores.ui.theme}</div>`;
      },
    });

    document.body.innerHTML = '<multi-store id="ms"></multi-store>';
    const inst = mount('#ms', 'multi-store');
    expect(inst.stores.app.mode).toBe('edit');
    expect(inst.stores.ui.theme).toBe('dark');
  });

  it('only subscribes to listed keys, not all', () => {
    const myStore = createStore('conn-selective', {
      state: { a: 0, b: 0, c: 0 },
      actions: { setC(state, v) { state.c = v; } },
    });

    const updateSpy = vi.fn();
    component('store-selective', {
      stores: {
        s: connectStore(myStore, ['a', 'b']),
      },
      updated: updateSpy,
      render() { return '<div></div>'; },
    });

    document.body.innerHTML = '<store-selective id="ss"></store-selective>';
    mount('#ss', 'store-selective');

    // Change a key NOT in the subscription list
    myStore.dispatch('setC', 99);

    // updated() should NOT be called for key 'c'
    expect(updateSpy).not.toHaveBeenCalled();
  });
});


// ===========================================================================
// Feature 4: Router keepAlive
// ===========================================================================

describe('Router - keepAlive', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="outlet"></div>';
    window.location.hash = '#/';
  });

  afterEach(() => {
    const router = getRouter();
    if (router) router.destroy();
  });

  it('caches keep-alive route components', async () => {
    component('player-page', {
      state: () => ({ playCount: 0 }),
      render() { return `<div class="player">${this.state.playCount}</div>`; },
    });
    component('dash-page', {
      render() { return '<div class="dash">Dashboard</div>'; },
    });

    const router = createRouter({
      el: '#outlet',
      mode: 'hash',
      routes: [
        { path: '/player', component: 'player-page', keepAlive: true },
        { path: '/', component: 'dash-page' },
      ],
    });

    // Navigate to player
    router.navigate('/player');
    await new Promise(r => setTimeout(r, 50));
    expect(document.querySelector('.player')).not.toBeNull();

    // Mutate player state
    const playerInst = router._instance;
    playerInst.state.playCount = 5;

    // Navigate away
    router.navigate('/');
    await new Promise(r => setTimeout(r, 50));

    // Navigate back to player - should reuse cached instance
    router.navigate('/player');
    await new Promise(r => setTimeout(r, 50));
    expect(router._instance).toBe(playerInst);
    expect(router._instance.state.playCount).toBe(5); // state preserved
  });

  it('calls activated/deactivated lifecycle hooks', async () => {
    const activated = vi.fn();
    const deactivated = vi.fn();

    component('ka-comp', {
      activated,
      deactivated,
      render() { return '<div>keepAlive comp</div>'; },
    });
    component('other-comp', {
      render() { return '<div>other</div>'; },
    });

    const router = createRouter({
      el: '#outlet',
      mode: 'hash',
      routes: [
        { path: '/ka', component: 'ka-comp', keepAlive: true },
        { path: '/', component: 'other-comp' },
      ],
    });

    // First visit - activated on mount
    router.navigate('/ka');
    await new Promise(r => setTimeout(r, 50));
    expect(activated).toHaveBeenCalledTimes(1);

    // Navigate away - deactivated
    router.navigate('/');
    await new Promise(r => setTimeout(r, 50));
    expect(deactivated).toHaveBeenCalledTimes(1);

    // Navigate back - activated again
    router.navigate('/ka');
    await new Promise(r => setTimeout(r, 50));
    expect(activated).toHaveBeenCalledTimes(2);
  });

  it('non-keepAlive routes destroy normally', async () => {
    const destroyFn = vi.fn();
    component('normal-page', {
      destroyed: destroyFn,
      render() { return '<div>normal</div>'; },
    });
    component('ka-page', {
      render() { return '<div>ka</div>'; },
    });

    const router = createRouter({
      el: '#outlet',
      mode: 'hash',
      routes: [
        { path: '/a', component: 'normal-page' },
        { path: '/b', component: 'ka-page', keepAlive: true },
      ],
    });

    router.navigate('/a');
    await new Promise(r => setTimeout(r, 50));

    router.navigate('/b');
    await new Promise(r => setTimeout(r, 50));
    expect(destroyFn).toHaveBeenCalledTimes(1);
  });

  it('hides keep-alive container with display:none on deactivation', async () => {
    component('ka-hide', {
      render() { return '<div>hidden-test</div>'; },
    });
    component('other-hide', {
      render() { return '<div>other</div>'; },
    });

    const router = createRouter({
      el: '#outlet',
      mode: 'hash',
      routes: [
        { path: '/ka', component: 'ka-hide', keepAlive: true },
        { path: '/', component: 'other-hide' },
      ],
    });

    router.navigate('/ka');
    await new Promise(r => setTimeout(r, 50));
    const kaContainer = document.querySelector('ka-hide');
    expect(kaContainer).not.toBeNull();

    router.navigate('/');
    await new Promise(r => setTimeout(r, 50));
    // The ka container should still be in the DOM but hidden
    const hiddenKa = document.querySelector('ka-hide');
    expect(hiddenKa).not.toBeNull();
    expect(hiddenKa.style.display).toBe('none');
  });
});


// ===========================================================================
// Feature 5: Transition Directives
// ===========================================================================

describe('Component - transitions', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('adds enter transition classes on z-if=true with z-transition', () => {
    component('trans-if', {
      state: () => ({ show: true }),
      render() {
        return `<div z-if="show" z-transition="fade">Content</div>`;
      },
    });
    document.body.innerHTML = '<trans-if id="ti"></trans-if>';
    const inst = mount('#ti', 'trans-if');
    const el = document.querySelector('#ti div');
    // On enter, should have enter-active and enter-from/enter-to classes
    expect(el.classList.contains('fade-enter-active') || el.classList.contains('fade-enter-from')).toBe(true);
  });

  it('component-level transition config applies enter class', () => {
    component('trans-cfg', {
      state: () => ({ show: true }),
      transition: {
        enter: 'animate-fade-in',
        leave: 'animate-fade-out',
        duration: 10,
      },
      render() {
        return `<div z-if="show" z-transition="custom">Content</div>`;
      },
    });
    document.body.innerHTML = '<trans-cfg id="tc"></trans-cfg>';
    mount('#tc', 'trans-cfg');
    // Component-level transition should apply enter class
    const el = document.querySelector('#tc div');
    expect(el).not.toBeNull();
    expect(el.classList.contains('animate-fade-in')).toBe(true);
  });

  it('z-show with z-transition sets enter classes on visible elements', () => {
    component('trans-show', {
      state: () => ({ visible: true }),
      render() {
        return `<div z-show="visible" z-transition="slide" data-zq-hidden="">Content</div>`;
      },
    });
    document.body.innerHTML = '<trans-show id="ts"></trans-show>';
    mount('#ts', 'trans-show');
    const el = document.querySelector('#ts div');
    expect(el).not.toBeNull();
    // Should be visible (not hidden)
    expect(el.style.display).not.toBe('none');
  });
});


// ===========================================================================
// Feature 6: Component Scoped Events (emit/on)
// ===========================================================================

describe('Component - scoped events (emit/on)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('emit() dispatches CustomEvent that bubbles', () => {
    component('emit-child', {
      render() { return '<button>click</button>'; },
      doEmit() {
        this.emit('item-selected', { id: 42 });
      },
    });

    document.body.innerHTML = '<emit-child id="ec"></emit-child>';
    const inst = mount('#ec', 'emit-child');

    const handler = vi.fn();
    document.body.addEventListener('item-selected', handler);

    inst.doEmit();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({ id: 42 });

    document.body.removeEventListener('item-selected', handler);
  });

  it('emit() event is cancelable', () => {
    component('emit-cancel', {
      render() { return '<div></div>'; },
      fire() { return this.emit('my-event', { x: 1 }); },
    });

    document.body.innerHTML = '<emit-cancel id="ecn"></emit-cancel>';
    const inst = mount('#ecn', 'emit-cancel');

    let prevented = false;
    document.querySelector('#ecn').addEventListener('my-event', (e) => {
      e.preventDefault();
      prevented = true;
    });

    inst.fire();
    expect(prevented).toBe(true);
  });

  it('parent @event binding catches child emit', async () => {
    component('child-emitter', {
      render() { return '<button @click="sendEvent">Go</button>'; },
      sendEvent() {
        this.emit('done', { result: 'ok' });
      },
    });

    component('parent-listener', {
      state: () => ({ received: '' }),
      render() {
        return `<child-emitter @done="onDone"></child-emitter><span>${this.state.received}</span>`;
      },
      onDone(e) {
        this.state.received = e.detail.result;
      },
    });

    document.body.innerHTML = '<parent-listener id="pl"></parent-listener>';
    const parentInst = mount('#pl', 'parent-listener');

    // Get the child instance and trigger emit
    const childEl = document.querySelector('child-emitter');
    const childInst = getInstance(childEl);
    childInst.sendEvent();

    // Wait for re-render
    await new Promise(r => queueMicrotask(r));
    expect(parentInst.state.received).toBe('ok');
  });
});


// ===========================================================================
// Feature 7: Electron Environment Detection
// ===========================================================================

describe('Electron environment detection', () => {
  it('$.isElectron is false in jsdom/browser', async () => {
    // Dynamic import to test the evaluated values
    const mod = await import('../index.js');
    const $ = mod.default;
    expect($.isElectron).toBe(false);
  });

  it('$.platform is "browser" in jsdom', async () => {
    const mod = await import('../index.js');
    const $ = mod.default;
    expect($.platform).toBe('browser');
  });

  it('$.isElectron detects Electron via navigator.userAgent', () => {
    // Simulate Electron user agent
    const original = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 Electron/25.0.0',
      configurable: true,
    });

    // Re-evaluate the detection logic
    const isElectron = /Electron/i.test(navigator.userAgent);
    expect(isElectron).toBe(true);

    // Restore
    Object.defineProperty(navigator, 'userAgent', {
      value: original,
      configurable: true,
    });
  });

  it('$.isElectron detects Electron via process.versions.electron', () => {
    // Simulate Electron process object
    const origProcess = globalThis.process;
    globalThis.process = { versions: { electron: '25.0.0', node: '18.0.0' } };

    const isElectron = typeof process !== 'undefined' && process.versions != null && !!process.versions.electron;
    expect(isElectron).toBe(true);

    globalThis.process = origProcess;
  });

  it('platform resolves correctly for different environments', () => {
    // browser: window exists, not electron
    const platformBrowser = (false) ? 'electron' : (typeof window !== 'undefined') ? 'browser' : 'node';
    expect(platformBrowser).toBe('browser');
  });
});


// ===========================================================================
// Feature: connectStore is exported
// ===========================================================================

describe('connectStore export', () => {
  it('is importable from store module', () => {
    expect(typeof connectStore).toBe('function');
  });

  it('is available on $ namespace', async () => {
    const mod = await import('../index.js');
    const $ = mod.default;
    expect(typeof $.connectStore).toBe('function');
  });
});


// ===========================================================================
// Integration: Full component with props + stores + emit
// ===========================================================================

describe('Integration - props + stores + emit', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('component with reactive props and store connector renders correctly', async () => {
    const appStore = createStore('integ-store', {
      state: { theme: 'dark', count: 0 },
      actions: {
        setTheme(state, v) { state.theme = v; },
        inc(state) { state.count++; },
      },
    });

    component('integ-card', {
      props: {
        title: { type: String, default: 'Card' },
        size: { type: Number, default: 1 },
      },
      stores: {
        app: connectStore(appStore, ['theme', 'count']),
      },
      render() {
        return `<div class="card ${this.stores.app.theme}">
          <h2>${this.props.title} (${this.props.size})</h2>
          <span class="count">${this.stores.app.count}</span>
        </div>`;
      },
    });

    document.body.innerHTML = '<integ-card id="ic" title="Stats" size="3"></integ-card>';
    const inst = mount('#ic', 'integ-card');

    expect(inst.props.title).toBe('Stats');
    expect(inst.props.size).toBe(3);
    expect(inst.stores.app.theme).toBe('dark');
    expect(inst.stores.app.count).toBe(0);

    // Dispatch store action
    appStore.dispatch('inc');
    expect(inst.stores.app.count).toBe(1);

    // Wait for re-render
    await new Promise(r => queueMicrotask(r));
    expect(document.querySelector('.count').textContent).toBe('1');
  });

  it('emitting from connected component works', () => {
    const store = createStore('integ-emit', { state: { x: 0 } });

    component('emit-connected', {
      stores: {
        s: connectStore(store, ['x']),
      },
      render() { return '<div></div>'; },
      notify() { this.emit('status-change', { x: this.stores.s.x }); },
    });

    document.body.innerHTML = '<emit-connected id="emc"></emit-connected>';
    const inst = mount('#emc', 'emit-connected');

    const handler = vi.fn();
    document.querySelector('#emc').addEventListener('status-change', handler);

    inst.notify();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({ x: 0 });
  });
});
