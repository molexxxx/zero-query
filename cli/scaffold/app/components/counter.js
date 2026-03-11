// scripts/components/counter.js — interactive counter
//
// Demonstrates: component state, computed properties, watch callbacks,
//               @click event binding, z-model two-way binding with
//               z-number modifier, z-class, z-if, z-for with z-key,
//               $.bus toast notifications

$.component('counter-page', {
  state: () => ({
    count: 0,
    step: 1,
    history: [],
  }),

  // Computed properties — derived values that update automatically
  computed: {
    isNegative: (state) => state.count < 0,
    historyCount: (state) => state.history.length,
    lastAction: (state) => state.history.length ? state.history[state.history.length - 1] : null,
  },

  // Watch — react to specific state changes
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
    this._pushHistory('−', this.state.step, this.state.count);
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

      <div class="card counter-card">
        <div class="counter-display">
          <span class="counter-value" z-class="{'negative': count < 0}">${this.state.count}</span>
        </div>

        <div class="counter-controls">
          <button class="btn btn-danger" @click="decrement">− Subtract</button>
          <button class="btn btn-primary" @click="increment">+ Add</button>
        </div>

        <div class="counter-step">
          <label>Step size:
            <input type="number" z-model="step" z-number min="1" max="100" class="input input-sm" />
          </label>
          <button class="btn btn-ghost btn-sm" @click="reset">Reset</button>
        </div>
      </div>

      <div class="card card-muted" z-if="history.length > 0">
        <h3>History <small style="color:var(--text-muted);font-weight:400;">(${this.computed.historyCount} entries)</small></h3>
        <div class="history-list">
          <span z-for="e in history" z-key="{{e.id}}" class="history-item">{{e.action}}{{e.value}} → <strong>{{e.result}}</strong></span>
        </div>
      </div>
    `;
  }
});
