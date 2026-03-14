// store.js — Global state management
//
// A simple centralized store. Any component can access it
// via $.getStore('main') and dispatch actions to update state.

export const store = $.store('main', {
  state: {
    count: 0,
  },

  actions: {
    increment(state) {
      state.count++;
    },

    decrement(state) {
      state.count--;
    },

    reset(state) {
      state.count = 0;
    },
  },

  getters: {
    isNegative: (state) => state.count < 0,
    isPositive: (state) => state.count > 0,
  },

  debug: true,
});
