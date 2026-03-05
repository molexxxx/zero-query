// scripts/components/home.js — dashboard / landing page
//
// Demonstrates: $.component, state, render, mounted lifecycle,
//               signal + computed + effect (reactive primitives),
//               $.store integration, $.bus, template rendering

$.component('home-page', {
  state: () => ({
    greeting: '',
    signalDemo: 0,
  }),

  mounted() {
    // $.signal() — fine-grained reactive primitive
    const count = $.signal(0);

    // $.computed() — derived reactive value that auto-updates
    const doubled = $.computed(() => count.value * 2);

    // $.effect() — runs whenever its dependencies change
    $.effect(() => {
      this.state.signalDemo = doubled.value;
    });

    // Store the signal setter so the button can use it
    this._signalCount = count;

    // Greet based on time of day
    const hour = new Date().getHours();
    this.state.greeting = hour < 12 ? 'Good morning'
                        : hour < 18 ? 'Good afternoon'
                        : 'Good evening';

    // Track page visit via the global store
    const store = $.getStore('main');
    store.dispatch('incrementVisits');
  },

  incrementSignal() {
    if (this._signalCount) {
      this._signalCount.value++;
    }
  },

  render() {
    const store = $.getStore('main');
    return `
      <div class="page-header">
        <h1>${this.state.greeting} 👋</h1>
        <p class="subtitle">Welcome to your new <strong>zQuery</strong> app. Explore the pages to see different features in action.</p>
      </div>

      <div class="card-grid">
        <div class="card card-accent">
          <h3>⚡ Reactive Signals</h3>
          <p>Fine-grained reactivity with <code>signal()</code>, <code>computed()</code>, and <code>effect()</code>.</p>
          <div class="signal-demo">
            <span class="signal-value">Doubled: ${this.state.signalDemo}</span>
            <button class="btn btn-sm" @click="incrementSignal">Increment Signal</button>
          </div>
        </div>

        <div class="card">
          <h3>🔢 Counter</h3>
          <p>Component state, two-way binding with <code>z-model</code>, and event handling.</p>
          <a z-link="/counter" class="btn btn-outline">Try It →</a>
        </div>

        <div class="card">
          <h3>✅ Todos</h3>
          <p>Global store with actions & getters. <strong>${store.getters.todoCount}</strong> items, <strong>${store.getters.doneCount}</strong> done.</p>
          <a z-link="/todos" class="btn btn-outline">Try It →</a>
        </div>

        <div class="card">
          <h3>📇 Contacts</h3>
          <p>External templates &amp; styles via <code>templateUrl</code> / <code>styleUrl</code>. <strong>${store.getters.contactCount}</strong> contacts, <strong>${store.getters.favoriteCount}</strong> ★ favorited.</p>
          <a z-link="/contacts" class="btn btn-outline">Try It →</a>
        </div>

        <div class="card">
          <h3>🌐 API Demo</h3>
          <p>Fetch data with <code>$.get()</code>, loading states, and <code>$.escapeHtml()</code>.</p>
          <a z-link="/api" class="btn btn-outline">Try It →</a>
        </div>
      </div>

      <div class="card card-muted">
        <h3>📊 App Stats</h3>
        <div class="stats-grid">
          <div class="stat-group">
            <span class="stat-group-title">🏠 General</span>
            <div class="stat-group-values">
              <div class="stat">
                <span class="stat-value">${store.state.visits}</span>
                <span class="stat-label">Page Views</span>
              </div>
            </div>
          </div>

          <div class="stat-group">
            <span class="stat-group-title">✅ Todos</span>
            <div class="stat-group-values">
              <div class="stat">
                <span class="stat-value">${store.getters.todoCount}</span>
                <span class="stat-label">Total</span>
              </div>
              <div class="stat">
                <span class="stat-value">${store.getters.pendingCount}</span>
                <span class="stat-label">Pending</span>
              </div>
              <div class="stat">
                <span class="stat-value">${store.getters.doneCount}</span>
                <span class="stat-label">Done</span>
              </div>
            </div>
          </div>

          <div class="stat-group">
            <span class="stat-group-title">📇 Contacts</span>
            <div class="stat-group-values">
              <div class="stat">
                <span class="stat-value">${store.getters.contactCount}</span>
                <span class="stat-label">Total</span>
              </div>
              <div class="stat">
                <span class="stat-value">${store.getters.favoriteCount}</span>
                <span class="stat-label">★ Favorited</span>
              </div>
            </div>
          </div>
        </div>
        <small class="muted">Stats powered by <code>$.store()</code> getters — visit count tracked globally.</small>
      </div>
    `;
  }
});
