// home.js - Landing page / dashboard
//
// Features used:
//   $.component   - define a component with state + render
//   $.signal      - reactive value container
//   $.computed    - derived reactive value
//   $.effect      - side-effect that auto-tracks signals
//   $.getStore    - access the global store

$.component('home-page', {
  styles: `
    .sig-lab        { padding: 1.5rem 2rem; border-radius: var(--radius-lg);
                      background: var(--bg-hover); border: 1px solid var(--border); }
    .sig-row        { display: flex; gap: 1.25rem; align-items: center; flex-wrap: wrap;
                      margin-bottom: 1rem; }
    .sig-val        { display: inline-flex; align-items: center; gap: .4rem;
                      padding: .4rem .85rem; border-radius: var(--radius);
                      background: rgba(88,166,255,.08); border: 1px solid rgba(88,166,255,.15);
                      font-family: monospace; font-size: 1rem; font-weight: 600; }
    .sig-val span   { color: var(--accent); }
    .sig-val small  { color: var(--text-muted); font-weight: 400; font-size: .85rem; }
    .sig-op         { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
    .sig-graph      { display: flex; gap: 3px; align-items: flex-end; height: 56px;
                      margin-top: .75rem; }
    .sig-bar        { flex: 1; min-width: 4px; max-width: 24px;
                      background: var(--accent); border-radius: 3px 3px 0 0;
                      opacity: .65; transition: height .15s ease; }

    /* Custom dropdown for operation picker */
    .sig-select     { position: relative; z-index: 2; }
    .sig-select-trigger {
                      display: inline-flex; align-items: center; gap: .4rem;
                      padding: .4rem .85rem; border-radius: var(--radius);
                      background: var(--bg-surface); border: 1px solid var(--border);
                      color: var(--text); font-size: .9rem; font-family: inherit;
                      cursor: pointer; transition: all .15s ease; user-select: none; }
    .sig-select-trigger:hover { border-color: var(--accent); background: var(--accent-soft); }
    .sig-select-trigger.open  { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(88,166,255,.1); }
    .sig-select-trigger .sig-select-arrow {
                      font-size: .65rem; color: var(--text-muted); transition: transform .15s ease;
                      margin-left: .15rem; }
    .sig-select-trigger.open .sig-select-arrow { transform: rotate(180deg); }
    .sig-select-menu {
                      position: absolute; top: calc(100% + 4px); left: 0; min-width: 160px;
                      background: var(--bg-surface); border: 1px solid var(--border);
                      border-radius: var(--radius); padding: .3rem;
                      box-shadow: 0 8px 24px rgba(0,0,0,.25); z-index: 50; }
    .sig-select-item {
                      display: flex; align-items: center; gap: .5rem;
                      padding: .4rem .65rem; border-radius: calc(var(--radius) - 2px);
                      font-size: .84rem; cursor: pointer; color: var(--text);
                      transition: all .1s ease; }
    .sig-select-item:hover { background: var(--bg-hover); }
    .sig-select-item.active { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
    .sig-select-item .sig-select-symbol {
                      width: 1.4rem; text-align: center; font-weight: 600; font-size: .9rem; }

    .sig-how        { display: grid; grid-template-columns: repeat(3, 1fr);
                      gap: 1rem; margin-top: 1.25rem; }
    .sig-concept    { padding: 1rem 1.1rem; border-radius: var(--radius);
                      border: 1px solid var(--border); background: var(--bg-surface); }
    .sig-concept h4 { font-size: .85rem; margin: 0 0 .4rem; color: var(--accent);
                      text-transform: uppercase; letter-spacing: .04em; font-weight: 600; }
    .sig-concept p  { font-size: .84rem; color: var(--text-muted); margin: 0; line-height: 1.5; }
    .sig-concept code { font-size: .8rem; color: var(--text); }

    @media (max-width: 768px) {
      .sig-lab           { padding: 1rem; }
      .sig-row           { gap: .5rem; }
      .sig-how           { grid-template-columns: 1fr; }
      .sig-select-menu   { left: auto; right: 0; }
    }
    @media (max-width: 480px) {
      .sig-lab           { padding: .75rem; }
      .sig-op            { gap: .3rem; }
      .sig-val           { padding: .25rem .5rem; font-size: .82rem; }
    }
  `,

  state: () => ({
    greeting: '',
    sigA: 0,
    sigB: 0,
    sigOp: 'add',
    sigResult: 0,
    sigHistory: [],
    opOpen: false,
  }),

  mounted() {
    // $.signal() + $.computed() + $.effect() wired together
    this._sigA = $.signal(3);
    this._sigB = $.signal(5);
    this._op   = $.signal('add');

    this._result = $.computed(() => {
      const a = this._sigA.value, b = this._sigB.value;
      switch (this._op.value) {
        case 'add':      return a + b;
        case 'subtract': return a - b;
        case 'multiply': return a * b;
        case 'divide':   return b !== 0 ? +(a / b).toFixed(4) : 'Infinity';
        case 'power':    return Math.pow(a, b);
        case 'modulo':   return b !== 0 ? a % b : 'NaN';
        default:         return 0;
      }
    });

    $.effect(() => {
      const val = typeof this._result.value === 'number' ? this._result.value : 0;
      this.state.sigA = this._sigA.value;
      this.state.sigB = this._sigB.value;
      this.state.sigOp = this._op.value;
      this.state.sigResult = this._result.value;
      const raw = this.state.sigHistory.__raw || this.state.sigHistory;
      this.state.sigHistory = [...raw, Math.abs(val)].slice(-20);
    });

    const hour = new Date().getHours();
    this.state.greeting = hour < 12 ? 'Good morning'
                        : hour < 18 ? 'Good afternoon'
                        : 'Good evening';

    // Visits are tracked globally via router.afterEach in app.js
  },

  updateA(e) { this._sigA.value = Number(e.target.value) || 0; },
  updateB(e) { this._sigB.value = Number(e.target.value) || 0; },
  updateOp(e) { this._op.value = e.target.value; },
  bumpA(d)   { this._sigA.value += d; },
  bumpB(d)   { this._sigB.value += d; },
  toggleOp() { this.state.opOpen = !this.state.opOpen; },
  closeOp()  { this.state.opOpen = false; },
  pickOp(op) { this._op.value = op; this.state.opOpen = false; },

  render() {
    const store = $.getStore('main');
    const s = this.state;
    const opLabels = { add: '+', subtract: '-', multiply: '×', divide: '÷', power: '^', modulo: '%' };
    const maxH = Math.max(1, ...s.sigHistory.map(v => Math.sqrt(Math.abs(v) + 1)));
    return `
      <div class="page-header">
        <h1>${s.greeting}</h1>
        <p class="subtitle">Welcome to your new <strong>zQuery</strong> app. Explore the pages to see different features in action.</p>
      </div>

      <div class="card card-accent">
        <h3><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="var(--accent)" style="width:20px;height:20px;vertical-align:-4px;margin-right:0.25rem;"><path stroke-linecap="round" stroke-linejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"/></svg> Reactive Signals Lab</h3>
        <p style="margin-bottom:.65rem;">Signals are <strong>reactive primitives</strong> - values that automatically notify dependents when they change.
          Adjust <strong>A</strong> and <strong>B</strong> below and watch the computed result update instantly, with no manual DOM wiring.</p>

        <div class="sig-lab">
          <div class="sig-row">
            <div class="sig-op">
              <button class="btn btn-sm btn-ghost" @click="bumpA(-1)">-</button>
              <div class="sig-val"><small>A</small> <span>${s.sigA}</span></div>
              <button class="btn btn-sm btn-ghost" @click="bumpA(1)">+</button>
            </div>
            <div class="sig-select" @click.outside="closeOp">
              <button class="sig-select-trigger ${s.opOpen ? 'open' : ''}" @click="toggleOp">
                <span class="sig-select-symbol">${opLabels[s.sigOp] || '+'}</span> ${s.sigOp.charAt(0).toUpperCase() + s.sigOp.slice(1)}
                <span class="sig-select-arrow">▼</span>
              </button>
              <div class="sig-select-menu" z-show="opOpen">
                ${Object.entries(opLabels).map(([key, sym]) => `
                  <div class="sig-select-item ${s.sigOp === key ? 'active' : ''}" @click="pickOp('${key}')">
                    <span class="sig-select-symbol">${sym}</span> ${key.charAt(0).toUpperCase() + key.slice(1)}
                  </div>
                `).join('')}
              </div>
            </div>
            <div class="sig-op">
              <button class="btn btn-sm btn-ghost" @click="bumpB(-1)">-</button>
              <div class="sig-val"><small>B</small> <span>${s.sigB}</span></div>
              <button class="btn btn-sm btn-ghost" @click="bumpB(1)">+</button>
            </div>
            <span style="font-size:1.1rem;color:var(--text-muted);">=</span>
            <div class="sig-val" style="background:rgba(88,166,255,.14);"><span style="font-size:1.05rem;">${s.sigResult}</span></div>
          </div>

          <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:.4rem;">
            <code>$.computed(() => ${s.sigA} ${opLabels[s.sigOp] || '+'} ${s.sigB})</code> → <strong style="color:var(--accent);">${s.sigResult}</strong>
          </div>

          ${s.sigHistory.length > 1 ? `
            <div class="sig-graph">
              ${s.sigHistory.map(v => `<div class="sig-bar" style="height:${Math.max(6, (Math.sqrt(Math.abs(v) + 1) / maxH) * 56)}px;"></div>`).join('')}
            </div>
            <div style="font-size:.75rem;color:var(--text-muted);margin-top:.35rem;">Result history - ${s.sigHistory.length} values tracked by <code>effect()</code></div>
          ` : ''}
        </div>

        <div class="sig-how">
          <div class="sig-concept">
            <h4>Signal</h4>
            <p>A reactive value container. When you write <code>$.signal(3)</code> you get an object whose <code>.value</code> automatically triggers updates when changed.</p>
          </div>
          <div class="sig-concept">
            <h4>Computed</h4>
            <p>A derived value that re-evaluates when its dependencies change. <code>$.computed(() => A + B)</code> recalculates whenever A or B updates - no manual calls.</p>
          </div>
          <div class="sig-concept">
            <h4>Effect</h4>
            <p>A side-effect that runs automatically when tracked signals change. The bar chart above is powered by <code>$.effect()</code> - it records every new result.</p>
          </div>
        </div>
      </div>

      <div class="card-grid">
        <div class="card">
          <h3><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="var(--accent)" style="width:20px;height:20px;vertical-align:-4px;margin-right:0.25rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5-3.9 19.5m-2.1-19.5-3.9 19.5"/></svg> Counter</h3>
          <p><code>computed</code> properties, <code>watch</code> callbacks, and <code>z-for</code> with <code>z-key</code> diffing.</p>
          <a z-link="/counter" class="btn btn-outline">Try It →</a>
        </div>

        <div class="card">
          <h3><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="var(--accent)" style="width:20px;height:20px;vertical-align:-4px;margin-right:0.25rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg> Todos</h3>
          <p>Global store, <code>z-key</code> keyed lists, DOM diffing. <strong>${store.getters.todoCount}</strong> items, <strong>${store.getters.doneCount}</strong> done.</p>
          <a z-link="/todos" class="btn btn-outline">Try It →</a>
        </div>

        <div class="card">
          <h3><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="var(--accent)" style="width:20px;height:20px;vertical-align:-4px;margin-right:0.25rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z"/></svg> Contacts</h3>
          <p>External templates, scoped styles, and <code>z-key</code> keyed lists. <strong>${store.getters.contactCount}</strong> contacts, <strong>${store.getters.favoriteCount}</strong> ★ favorited.</p>
          <a z-link="/contacts" class="btn btn-outline">Try It →</a>
        </div>

        <div class="card">
          <h3><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="var(--accent)" style="width:20px;height:20px;vertical-align:-4px;margin-right:0.25rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418"/></svg> API Demo</h3>
          <p>Fetch data with <code>$.get()</code>, loading states, and <code>$.escapeHtml()</code>.</p>
          <a z-link="/api" class="btn btn-outline">Try It →</a>
        </div>

        <div class="card">
          <h3><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="var(--accent)" style="width:20px;height:20px;vertical-align:-4px;margin-right:0.25rem;"><path stroke-linecap="round" stroke-linejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/></svg> Playground</h3>
          <p><code>@click.outside</code> dropdowns, <code>fadeIn/fadeOut</code> modals, <code>slideToggle</code>, <code>z-style</code>, and <code>$.fn</code> plugins.</p>
          <a z-link="/playground" class="btn btn-outline">Try It →</a>
        </div>

        <div class="card">
          <h3><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="var(--accent)" style="width:20px;height:20px;vertical-align:-4px;margin-right:0.25rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75a4.5 4.5 0 0 1-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 1 1-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 0 1 6.336-4.486l-3.276 3.276a3.004 3.004 0 0 0 2.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852Z"/></svg> Toolkit</h3>
          <p>HTTP interceptors &amp; CRUD, <code>$.pipe</code>, <code>$.memoize</code>, <code>$.retry</code>, store middleware, and snapshots.</p>
          <a z-link="/toolkit" class="btn btn-outline">Try It →</a>
        </div>
      </div>

    `;
  }
});
