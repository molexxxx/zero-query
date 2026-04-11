// playground.js - Interactive UI patterns
//
// Features used:
//   @click.outside / .self / .once  - event modifiers
//   @keydown.escape / @keyup.enter  - keyboard modifiers
//   fadeIn / fadeOut / slideToggle   - DOM animations
//   z-style                         - reactive inline styles
//   z-html                          - trusted HTML rendering
//   $.fn                            - collection plugin system
//   z-skip                          - morph opt-out
//   templateUrl / styleUrl          - external files

// -- $.fn Plugins -------------------------------------------------
$.fn.highlight = function (color = 'var(--accent)') {
  this.css({ boxShadow: `0 0 0 3px ${color}`, transition: 'box-shadow .3s ease' });
  const self = this;
  setTimeout(() => self.css({ boxShadow: '' }), 1500);
  return this;
};

$.fn.shake = function () {
  const el = this[0];
  if (!el) return this;
  el.style.transition = 'transform .06s ease-in-out';
  const frames = ['-6px', '5px', '-4px', '3px', '-1px', '0'];
  let i = 0;
  const run = () => {
    if (i >= frames.length) { el.style.transform = ''; return; }
    el.style.transform = `translateX(${frames[i]})`;
    i++;
    requestAnimationFrame(() => setTimeout(run, 50));
  };
  run();
  return this;
};

$.fn.glow = function (color = 'var(--accent)') {
  this.css({ boxShadow: `0 0 20px ${color}, 0 0 40px ${color}`, transition: 'box-shadow .4s ease' });
  const self = this;
  setTimeout(() => self.css({ boxShadow: '' }), 2000);
  return this;
};

$.component('playground-page', {
  templateUrl: 'playground.html',
  styleUrl:    'playground.css',

  state: () => ({
    dropdownOpen: false,
    dropdownSelected: null,
    modalOpen: false,
    previewColor: '#58a6ff',
    previewSize: 18,
    previewRadius: 8,
    richContent: '<strong>Bold</strong>, <em>italic</em>, and <a href="#">links</a> rendered via <code>z-html</code>.',
    variant: 'info',
    onceClicked: false,
    shortcutLog: [],
  }),

  /* Dropdown → opens modal for the selected action */
  toggleDropdown() { this.state.dropdownOpen = !this.state.dropdownOpen; },
  closeDropdown()  { this.state.dropdownOpen = false; },
  selectItem(item) {
    this.state.dropdownSelected = item;
    this.state.dropdownOpen = false;
    this.openModal();
  },

  /* Modal with fadeIn / fadeOut */
  async openModal() {
    this.state.modalOpen = true;
    await $.sleep(20);
    const $bg = $(this._el).find('.pg-modal-backdrop');
    if ($bg.length) {
      await $bg.fadeIn(200);
      $bg.find('.pg-modal')[0]?.focus();
    }
  },
  async closeModal() {
    const $bg = $(this._el).find('.pg-modal-backdrop');
    if ($bg.length) await $bg.fadeOut(200);
    this.state.modalOpen = false;
  },
  confirmModal() {
    const item = this.state.dropdownSelected;
    this.closeModal();
    $.bus.emit('toast', { message: `${item} confirmed!`, type: 'success' });
  },

  /* Accordion - pure DOM, z-skip prevents morph interference */
  toggleAccordion(id) {
    $(this._el).find(`#pg-acc-${id}`).slideToggle(250);
    $(this._el).find(`#pg-acc-icon-${id}`).toggleClass('open');
  },

  /* Key shortcut log */
  logShortcut(name) {
    const raw = this.state.shortcutLog.__raw || this.state.shortcutLog;
    this.state.shortcutLog = [...raw, { id: Date.now(), name }].slice(-8);
  },

  /* $.fn plugin demos */
  highlightDemo() { $(this._el).find('#pg-plugin-box').highlight(); },
  shakeDemo()     { $(this._el).find('#pg-plugin-box').shake(); },
  glowDemo()      { $(this._el).find('#pg-plugin-box').glow(); },

  setVariant(v) {
    this.state.variant = v;
  },

  /* @click.once */
  onceAction() {
    this.state.onceClicked = true;
    $.bus.emit('toast', { message: 'Fired once - handler auto-removed!', type: 'info' });
  },
});