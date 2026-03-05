// store.js — global store for the zQuery website
export const store = $.store({
  state: {
    theme: 'dark',
    visits: 0,
  },
  actions: {
    incrementVisits(state) { state.visits++; },
  },
  debug: true,
});

export default store;
