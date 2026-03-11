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
        <h1>${this.state.greeting}</h1>
        <p class="subtitle">Welcome to your new <strong>zQuery</strong> app. Explore the pages to see different features in action.</p>
      </div>

      <div class="card-grid">
        <div class="card card-accent">
          <h3><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="var(--accent)" style="width:20px;height:20px;vertical-align:-4px;margin-right:0.25rem;"><path stroke-linecap="round" stroke-linejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"/></svg> Reactive Signals</h3>
          <p>Fine-grained reactivity with <code>signal()</code>, <code>computed()</code>, and <code>effect()</code>.</p>
          <div class="signal-demo">
            <span class="signal-value">Doubled: ${this.state.signalDemo}</span>
            <button class="btn btn-sm" @click="incrementSignal">Increment Signal</button>
          </div>
        </div>

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
      </div>

      <div class="card card-muted">
        <h3><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="var(--accent)" style="width:20px;height:20px;vertical-align:-4px;margin-right:0.25rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"/></svg> App Stats</h3>
        <div class="stats-grid">
          <div class="stat-group">
            <span class="stat-group-title"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:14px;height:14px;vertical-align:-2px;margin-right:0.2rem;"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 12 8.954-8.955a1.126 1.126 0 0 1 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/></svg> General</span>
            <div class="stat-group-values">
              <div class="stat">
                <span class="stat-value">${store.state.visits}</span>
                <span class="stat-label">Page Views</span>
              </div>
            </div>
          </div>

          <div class="stat-group">
            <span class="stat-group-title"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:14px;height:14px;vertical-align:-2px;margin-right:0.2rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg> Todos</span>
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
            <span class="stat-group-title"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:14px;height:14px;vertical-align:-2px;margin-right:0.2rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z"/></svg> Contacts</span>
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
