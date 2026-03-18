// home.js — Landing page
//
// Features used:
//   $.component      — define a component
//   $.getStore       — read/dispatch global store
//   store.subscribe  — re-render on store changes
//   @click / z-model — event binding + two-way input

$.component('home-page', {
  state: () => ({
    greeting: '',
  }),

  mounted() {
    const hour = new Date().getHours();
    this.state.greeting =
      hour < 12 ? 'Good morning' :
      hour < 18 ? 'Good afternoon' : 'Good evening';

    this._unsub = $.getStore('main').subscribe(() => this.setState({}));
  },

  destroyed() {
    if (this._unsub) this._unsub();
  },

  increment() { $.getStore('main').dispatch('increment'); },
  decrement() { $.getStore('main').dispatch('decrement'); },
  reset()     { $.getStore('main').dispatch('reset'); },
  setStep(e)  { $.getStore('main').dispatch('setStep', Number(e.target.value)); },

  render() {
    const { count, step } = $.getStore('main').state;

    return `
      <div class="page-header">
        <h1>{{greeting}} 👋</h1>
        <p class="subtitle">Welcome to your new zQuery project.</p>
      </div>

      <div class="card">
        <h3>Getting Started</h3>
        <p>
          This is the <strong>minimal</strong> scaffold — three pages, a global store,
          and the router. Edit the files in <code>app/</code> to start building.
        </p>
        <p>
          Run <code>npx zquery dev</code> for live-reload, or
          <code>npx zquery bundle</code> when you're ready to ship.
        </p>
      </div>

      <div class="card">
        <h3>Global Store</h3>
        <p>The counter from <a z-link="/counter">Counter</a> is backed by <code>$.store</code> — its value persists across pages:</p>
        <div style="display:flex;align-items:center;gap:.75rem;margin-top:.75rem;">
          <button class="btn btn-outline btn-sm" @click="decrement">−</button>
          <span style="font-size:1.25rem;font-weight:700;color:var(--accent);min-width:2rem;text-align:center;">${count}</span>
          <button class="btn btn-primary btn-sm" @click="increment">+</button>
          <button class="btn btn-outline btn-sm" @click="reset" style="margin-left:.5rem;">Reset</button>
          <label style="display:flex;align-items:center;gap:.4rem;margin-left:.5rem;font-size:.85rem;color:var(--text-muted);">
            Step <input type="number" value="${step}" @input="setStep" min="1" max="100" class="input input-sm" style="width:55px;text-align:center;" />
          </label>
        </div>
      </div>
    `;
  },
});
