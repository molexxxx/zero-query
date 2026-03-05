// scripts/components/counter.js — interactive counter
//
// Demonstrates: component state, instance methods, @click event binding,
//               z-model two-way binding with z-number modifier,
//               $.bus for toast notifications, conditional rendering

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
    // $.bus — emit a toast notification to the global listener in app.js
    $.bus.emit('toast', { message: 'Counter reset!', type: 'info' });
  },

  render() {
    const h = this.state.history;
    return `
      <div class="page-header">
        <h1>Counter</h1>
        <p class="subtitle">Component state, <code>@click</code> handlers, and <code>z-model</code> two‑way binding.</p>
      </div>

      <div class="card counter-card">
        <div class="counter-display">
          <span class="counter-value ${this.state.count < 0 ? 'negative' : ''}">${this.state.count}</span>
        </div>

        <div class="counter-controls">
          <button class="btn btn-danger" @click="decrement">− Subtract</button>
          <button class="btn btn-primary" @click="increment">+ Add</button>
        </div>

        <div class="counter-step">
          <label>Step size:
            <input type="number" z-model.number="step" min="1" max="100" class="input input-sm" />
          </label>
          <button class="btn btn-ghost btn-sm" @click="reset">Reset</button>
        </div>
      </div>

      ${h.length ? `
        <div class="card card-muted">
          <h3>History</h3>
          <div class="history-list">
            ${h.map(e =>
              `<span class="history-item">${e.action}${e.value} → <strong>${e.result}</strong></span>`
            ).join('')}
          </div>
        </div>
      ` : ''}
    `;
  }
});
