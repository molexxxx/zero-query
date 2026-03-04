import { store } from '../store.js';

$.component('counter-page', {
  state: { count: 0, step: 1 },

  increment() { this.state.count += this.state.step; },
  decrement() { this.state.count -= this.state.step; },
  reset()     { this.state.count = 0; },
  
  render() {
    return `
      <div>
        <div class="card">
          <h2>Reactive Counter</h2>
          <p>State changes automatically trigger DOM updates.</p>
          <div class="counter-display">${this.state.count}</div>
          <div class="flex" style="justify-content:center;">
            <button @click="decrement">− Decrease</button>
            <button class="secondary" @click="reset">Reset</button>
            <button @click="increment">+ Increase</button>
          </div>
          <div class="mt flex" style="justify-content:center;align-items:center;">
            <label style="font-size:0.85rem;color:#8b949e;">Step size:</label>
            <input z-model="step" type="number" min="1" max="100" style="width:80px;">
          </div>
        </div>
      </div>
    `;
  }
});
