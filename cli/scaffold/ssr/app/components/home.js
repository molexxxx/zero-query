// home.js - Home page component
//
// Exports a plain definition object that works on both client and server.
// The client registers it with $.component(), the server with app.component().

export const homePage = {
  state: () => ({
    greeting: 'Hello',
    timestamp: new Date().toLocaleTimeString(),
  }),

  // init() runs on both client and server - no DOM required
  init() {
    const hour = new Date().getHours();
    this.state.greeting =
      hour < 12 ? 'Good morning' :
      hour < 18 ? 'Good afternoon' : 'Good evening';
  },

  render() {
    return `
      <div class="page-header">
        <h1>${this.state.greeting} 👋</h1>
        <p class="subtitle">Rendered with zQuery SSR</p>
      </div>
      <div class="card">
        <h3>Server-Side Rendering</h3>
        <p>
          This page was rendered to HTML on the server and served as a complete
          document. The same component definition powers both the SSR server and
          the client-side SPA.
        </p>
        <p>Rendered at <strong>${this.state.timestamp}</strong></p>
      </div>
    `;
  }
};
