// home.js — Landing page
//
// Features used:
//   $.component  — define a component with state + render
//   $.signal     — reactive value container
//   $.computed   — derived reactive value
//   $.effect     — side-effect that auto-tracks signals

$.component('home-page', {
  state: () => ({
    greeting: '',
  }),

  mounted() {
    const hour = new Date().getHours();
    this.state.greeting =
      hour < 12 ? 'Good morning' :
      hour < 18 ? 'Good afternoon' : 'Good evening';
  },

  render() {
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
        <h3>Reactive Signals</h3>
        <p>Try the reactive primitives right here:</p>
        <div id="signal-demo"></div>
      </div>
    `;
  },

  // Quick signal demo wired up after render
  rendered() {
    const el = this.$el.querySelector('#signal-demo');
    if (!el) return;

    const count = $.signal(0);
    const doubled = $.computed(() => count.value * 2);

    const render = () => {
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:.75rem;margin-top:.5rem;">
          <button class="btn btn-outline btn-sm" id="sig-dec">−</button>
          <span style="font-size:1.25rem;font-weight:700;color:var(--accent);min-width:2rem;text-align:center;">${count.value}</span>
          <button class="btn btn-primary btn-sm" id="sig-inc">+</button>
          <span class="muted" style="margin-left:.5rem;">doubled = <strong style="color:var(--accent)">${doubled.value}</strong></span>
        </div>
      `;
      el.querySelector('#sig-inc').onclick = () => { count.value++; render(); };
      el.querySelector('#sig-dec').onclick = () => { count.value--; render(); };
    };

    render();
  },
});
