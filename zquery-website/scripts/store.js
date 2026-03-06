// store.js — global store for the zQuery website
export const store = $.store({
  state: {
    theme: 'dark',
  },
  debug: true,
});

export default store;
