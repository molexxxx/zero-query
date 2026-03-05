// scripts/components/counter.js — interactive counter
//
// Demonstrates: component state, instance methods, @click event binding,
//               z-model two-way binding with z-number modifier, z-class,
//               z-if, z-for, $.bus toast notifications

$.component('counter-page', {
  state: () => ({
    count: 0,
    step: 1,
    history: [],
  }),

  increment() {
    this.state.count += this.state.step;
    this.state.history.push({ action: '+', value: this.state.step, result: this.state.count });
    if (this.state.history.length > 8) this.state.history.shift();
  },

  decrement() {
    this.state.count -= this.state.step;
    this.state.history.push({ action: '−', value: this.state.step, result: this.state.count });
    if (this.state.history.length > 8) this.state.history.shift();
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
        <p class="subtitle">Component state, <code>@click</code> handlers, <code>z-model</code>, <code>z-class</code>, and <code>z-for</code>.</p>
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
        <h3>History</h3>
        <div class="history-list">
          <span z-for="e in history" class="history-item">{{e.action}}{{e.value}} → <strong>{{e.result}}</strong></span>
        </div>
      </div>
    `;
  }
});
