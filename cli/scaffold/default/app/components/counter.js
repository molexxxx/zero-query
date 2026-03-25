// counter.js - Interactive counter
//
// Features used:
//   state / computed / watch  - reactive data flow
//   @click                    - event binding
//   z-model + z-number        - two-way binding with type coercion
//   z-class / z-if / z-for    - conditional & list rendering
//   $.bus.emit('toast', …)    - notifications via event bus

$.component('counter-page', {
  styles: `
    .ctr-display   { padding: 2rem 0 1.25rem; text-align: center; }
    .ctr-num       { font-size: 4rem; font-weight: 800; font-variant-numeric: tabular-nums;
                     color: var(--accent); transition: color .2s;
                     letter-spacing: -0.02em; line-height: 1; }
    .ctr-num.negative { color: var(--danger); }
    .ctr-label     { font-size: .82rem; color: var(--text-muted); margin-top: .35rem; }
    .ctr-actions   { display: flex; justify-content: center; gap: .65rem;
                     margin-bottom: 1.5rem; }
    .ctr-actions .btn { min-width: 120px; justify-content: center; }
    .ctr-config    { display: flex; align-items: center; justify-content: center; gap: 1.25rem;
                     padding-top: 1.15rem; border-top: 1px solid var(--border); }
    .ctr-config label { display: flex; align-items: center; gap: .5rem;
                        color: var(--text-muted); font-size: .88rem; }
    .ctr-config .input-sm { width: 65px; text-align: center; }

    .ctr-hist      { display: flex; flex-wrap: wrap; gap: .4rem; }
    .ctr-hist-item { display: inline-flex; align-items: center; gap: .3rem;
                     padding: .3rem .65rem; border-radius: var(--radius);
                     background: var(--bg-hover); border: 1px solid var(--border);
                     font-size: .82rem; font-variant-numeric: tabular-nums;
                     transition: border-color .15s; }
    .ctr-hist-item:last-child { border-color: var(--accent); background: rgba(88,166,255,.06); }
    .ctr-hist-op   { color: var(--text-muted); font-weight: 500; }
    .ctr-hist-val  { color: var(--accent); font-weight: 600; }

    @media (max-width: 768px) {
      .ctr-num       { font-size: 2.75rem; }
      .ctr-actions   { gap: .5rem; }
      .ctr-actions .btn { min-width: 100px; }
      .ctr-config    { flex-wrap: wrap; gap: .75rem; justify-content: center; }
    }
    @media (max-width: 480px) {
      .ctr-num       { font-size: 2.25rem; }
      .ctr-actions .btn { min-width: 0; flex: 1; }
    }
  `,

  state: () => ({
    count: 0,
    step: 1,
    history: [],
  }),

  computed: {
    isNegative: (state) => state.count < 0,
    historyCount: (state) => state.history.length,
    lastAction: (state) => state.history.length ? state.history[state.history.length - 1] : null,
  },

  watch: {
    count(val) {
      if (val === 100) $.bus.emit('toast', { message: 'Century! 🎉', type: 'success' });
      if (val === -100) $.bus.emit('toast', { message: 'Negative century!', type: 'error' });
    },
  },

  increment() {
    this.state.count += this.state.step;
    this._pushHistory('+', this.state.step, this.state.count);
  },

  decrement() {
    this.state.count -= this.state.step;
    this._pushHistory('-', this.state.step, this.state.count);
  },

  _pushHistory(action, value, result) {
    const raw = this.state.history.__raw || this.state.history;
    const next = [...raw, { id: Date.now(), action, value, result }];
    this.state.history = next.length > 8 ? next.slice(-8) : next;
  },

  reset() {
    this.state.count = 0;
    this.state.history = [];
    $.bus.emit('toast', { message: 'Counter reset!', type: 'info' });
  },

  render() {
    return `
      <div class="page-header">
        <h1>Counter</h1>
        <p class="subtitle"><code>computed</code>, <code>watch</code>, <code>@click</code>, <code>z-model</code>, <code>z-class</code>, and <code>z-for</code> with <code>z-key</code>.</p>
      </div>

      <div class="card">
        <div class="ctr-display">
          <div class="ctr-num" z-class="{'negative': count < 0}">${this.state.count}</div>
          <div class="ctr-label">current value${this.state.step !== 1 ? ` · step ${this.state.step}` : ''}</div>
        </div>

        <div class="ctr-actions">
          <button class="btn btn-outline" @click="decrement">- Subtract</button>
          <button class="btn btn-primary" @click="increment">+ Add</button>
        </div>

        <div class="ctr-config">
          <label>Step size
            <input type="number" z-model="step" z-number min="1" max="100" class="input input-sm" />
          </label>
          <button class="btn btn-ghost btn-sm" @click="reset">Reset</button>
        </div>
      </div>

      <div class="card" z-if="history.length > 0">
        <h3>History <small style="color:var(--text-muted);font-weight:400;font-size:.85rem;">${this.computed.historyCount} entries</small></h3>
        <div class="ctr-hist">
          <span z-for="e in history" z-key="{{e.id}}" class="ctr-hist-item">
            <span class="ctr-hist-op">{{e.action}}{{e.value}}</span>
            <span class="ctr-hist-val">→ {{e.result}}</span>
          </span>
        </div>
      </div>
    `;
  }
});
