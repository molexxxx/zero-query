// store.js — Global state management
//
// A simple centralized store. Any component can access it
// via $.getStore('main') and dispatch actions to update state.

export const store = $.store('main', {
  state: {
    count: 0,
    step: 1,
  },

  actions: {
    increment(state) {
      state.count += state.step;
    },

    decrement(state) {
      state.count -= state.step;
    },

    reset(state) {
      state.count = 0;
    },

    setStep(state, value) {
      state.step = Math.max(1, Math.min(100, value));
    },
  },

  getters: {
    isNegative: (state) => state.count < 0,
    isPositive: (state) => state.count > 0,
  },

  debug: true,
});
