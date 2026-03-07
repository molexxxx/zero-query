import { store } from '../../store.js';

$.component('docs-page', {
  // Explicit base ensures styleUrl/pages resolve relative to this file
  // on any server — bypasses fragile Error().stack auto-detection.
  base: import.meta.url,

  state: () => ({
    searchQuery: '',
    sidebarOpen: false,
    _mobile: false,
  }),

  // Declarative pages config — single source of truth for all doc sections.
  // Paths are relative to this component file (via base above).
  pages: {
    dir:     'pages',
    param:   'section',
    default: 'getting-started',
    items: [
      'getting-started',
      { id: 'dev-workflow', label: 'Development' },
      { id: 'cli-bundler', label: 'CLI Bundler' },
      'project-structure',
      { id: 'selectors', label: 'Selectors & DOM' },
      'components',
      'directives',
      'router',
      'store',
      { id: 'http', label: 'HTTP Client' },
      'reactive',
      { id: 'utils', label: 'Utilities' },
    ],
  },

  // External stylesheet — relative to this file
  styleUrl: 'docs.css',

  /* -- Lifecycle -- */

  init() {
    // Detect mobile viewport via matchMedia (no CSS @media needed — avoids
    // zQuery's style-scoping regex which breaks @media blocks).
    this._mql = window.matchMedia('(max-width: 768px)');
    this._onMql = () => { this.state._mobile = this._mql.matches; };
    this._mql.addEventListener('change', this._onMql);

    // Scroll-spy: highlight the sidebar sub-item matching the visible heading
    this._onScroll = () => this._updateScrollSpy();
    window.addEventListener('scroll', this._onScroll, { passive: true });
  },

  mounted() {
    this._highlight();
    this.state._mobile = this._mql.matches;
    this._lastPage = this.activePage;
    this._pendingHash = this._readTargetHash();
    if (this._pendingHash) {
      // Immediately highlight the hash target in the sidebar
      this._applySpyActive(this._pendingHash);
      this._scrollToHash();
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    this._updateScrollSpy();
  },
  updated() {
    this._highlight();
    // Pick up any new hash (e.g. from a z-link navigation that just resolved)
    if (!this._pendingHash) this._pendingHash = this._readTargetHash();
    // Scroll to top when switching main sections (no hash target)
    const cur = this.activePage;
    if (cur !== this._lastPage) {
      this._lastPage = cur;
      if (!this._pendingHash) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
    this._scrollToHash();
    this._updateScrollSpy();
    if (this._filterActive && this.refs.searchInput) {
      const input = this.refs.searchInput;
      input.focus();
      const len = input.value.length;
      input.setSelectionRange(len, len);
      this._filterActive = false;
    }
  },

  destroyed() {
    if (this._mql && this._onMql) this._mql.removeEventListener('change', this._onMql);
    if (this._onScroll) window.removeEventListener('scroll', this._onScroll);
  },

  /* -- Helpers -- */

  /**
   * Read the scroll-to target from the URL hash (history mode) or the
   * global __zqScrollTarget (hash-mode routing where the URL hash is the
   * route path and can't carry a fragment).
   */
  _readTargetHash() {
    // History mode: hash is a real fragment like #cli-bundler
    const urlHash = window.location.hash.slice(1);
    if (urlHash && !urlHash.startsWith('/')) return urlHash;
    // Hash mode (file://): fragment was stored by the router
    if (window.__zqScrollTarget) {
      const target = window.__zqScrollTarget;
      delete window.__zqScrollTarget;
      return target;
    }
    return null;
  },

  /**
   * Scroll to the pending hash target. Persists across updated() calls
   * so it survives async template loading. Gives up after 30 attempts
   * (~500 ms) to avoid looping forever on a bad anchor.
   */
  _scrollToHash() {
    const hash = this._pendingHash;
    if (!hash) return;
    if (!this._pendingHashAttempts) this._pendingHashAttempts = 0;
    const el = $.id(hash);
    if (el) {
      this._pendingHash = null;
      this._pendingHashAttempts = 0;
      this._pinSpy(hash);
      requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } else if (++this._pendingHashAttempts > 30) {
      // Give up — anchor doesn't exist in this page
      this._pendingHash = null;
      this._pendingHashAttempts = 0;
    }
  },

  /**
   * Scroll-spy: highlight the sidebar sub-item matching the heading
   * currently in view.
   *
   * Two modes:
   *   1. PINNED — after a click or hash navigation the chosen ID is
   *      pinned.  The pin stays until the user manually scrolls 80+ px
   *      away from the settle position.  This guarantees the clicked
   *      item stays highlighted regardless of page geometry.
   *   2. FREE — normal scroll listening with a fixed offset.
   */

  /** Pin a heading ID as active.  Smooth-scroll settle is tracked
   *  automatically; once settled the pin is held until manual scroll. */
  _pinSpy(id) {
    this._pinnedId = id;
    this._pinScrollY = null;          // set once scroll settles
    this._applySpyActive(id);
    // Track scroll settle (no movement for 150 ms)
    const arm = () => {
      clearTimeout(this._pinTimer);
      this._pinTimer = setTimeout(() => {
        this._pinScrollY = window.scrollY;
        window.removeEventListener('scroll', arm);
      }, 150);
    };
    window.addEventListener('scroll', arm, { passive: true });
    arm();
  },

  _updateScrollSpy() {
    // --- Pinned mode: hold active until user scrolls away ---
    if (this._pinnedId) {
      if (this._pinScrollY !== null &&
          Math.abs(window.scrollY - this._pinScrollY) > 80) {
        // User scrolled away — release pin, fall through to free mode
        this._pinnedId = null;
        this._pinScrollY = null;
      } else {
        this._applySpyActive(this._pinnedId);
        return;
      }
    }

    // --- Free mode: dynamic scan line ---
    const content = this.refs.content;
    if (!content) return;
    const headings = $.all('h3[id]', content);
    if (!headings.length) return;

    const viewH     = window.innerHeight;
    const docH      = document.documentElement.scrollHeight;
    const maxScroll = docH - viewH;
    const remaining = maxScroll - window.scrollY;   // px of scroll room left

    // Base line is tighter (80 px) for finer activation.
    // As the user gets within 300 px of the page bottom the line ramps
    // smoothly toward 85 % of the viewport so bottom headings activate.
    const baseLine = 80;
    const rampZone = 300;
    let scanLine;
    if (remaining <= 0) {
      scanLine = viewH * 0.85;
    } else if (remaining < rampZone) {
      const t = 1 - remaining / rampZone;
      scanLine = baseLine + t * (viewH * 0.85 - baseLine);
    } else {
      scanLine = baseLine;
    }

    let activeId = null;
    for (const h of headings) {
      if (h.getBoundingClientRect().top <= scanLine) activeId = h.id;
    }

    this._applySpyActive(activeId);
  },

  _applySpyActive(activeId) {
    if (!this._el) return;
    const nav = $('.docs-sub-nav', this._el);
    if (!nav) return;
    $.all('.docs-sub-nav-item', nav).each((i, a) => {
      a.classList.toggle('active', (a.dataset.id || '') === activeId);
    });
  },

  _highlight() {
    const root = this.refs.content;
    if (!root) return;
    // Wrap bare .docs-table elements in a scroll container
    $.all('.docs-table', root).each((i, table) => {
      if (table.parentElement && table.parentElement.classList.contains('docs-table-wrap')) return;
      const wrap = $.create('div', { class: 'docs-table-wrap' });
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
    // File-tree folder toggles
    $.all('.file-tree .tree-dir > .tree-entry', root).each(function () {
      if (this._treeBound) return;
      this._treeBound = true;
      this.addEventListener('click', function (e) {
        if (e.target.closest('a')) return;           // let links navigate
        this.closest('.tree-dir').classList.toggle('open');
      });
    });
    // Prism syntax highlighting
    if (typeof Prism === 'undefined') return;
    $.all('pre code[class*="language-"]', root).not('.prism-highlighted').each(function () {
      Prism.highlightElement(this);
    }).addClass('prism-highlighted');
  },

  _stripTags(html) {
    return html.replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&mdash;/g, '\u2014').replace(/&ndash;/g, '\u2013')
      .replace(/&hellip;/g, '\u2026').replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
      .replace(/&\w+;/g, ' ').trim();
  },

  _slugify(text) {
    return this._stripTags(text).toLowerCase()
      .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
      .replace(/-+/g, '-').replace(/^-|-$/g, '');
  },

  _getHeadings(html) {
    const re = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi;
    const out = [];
    let m;
    while ((m = re.exec(html)) !== null) {
      const text = this._stripTags(m[2]);
      if (text) out.push({ level: +m[1], text: m[2].replace(/<[^>]+>/g, '').trim(), id: this._slugify(m[2]) });
    }
    return out;
  },

  _injectHeadingIds(html) {
    return html.replace(/<(h[23])(\s[^>]*)?(>)([\s\S]*?)<\/\1>/gi, (match, tag, attrs, gt, content) => {
      attrs = attrs || '';
      if (/\bid\s*=/.test(attrs)) return match;
      const id = this._slugify(content);
      return `<${tag}${attrs} id="${id}"${gt}${content}</${tag}>`;
    });
  },

  /* -- Event handlers -- */

  onFilter(e) {
    this._filterActive = true;
    this.state.searchQuery = e.target.value;
  },

  clearFilter(e) {
    this._filterActive = true;
    this.state.searchQuery = '';
  },

  scrollTo(e) {
    const id = e.target.closest('[data-id]')?.dataset?.id;
    if (!id) return;
    // Immediately highlight the clicked sub-item
    this._pinSpy(id);
    const el = $.id(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Update URL so the anchor link is shareable / survives refresh.
      // In hash mode the URL hash is the route path — we can't put the
      // anchor there without breaking routing.  Use the router's navigate
      // helper to keep the route intact and store the scroll target.
      const router = $.router();
      if (router && router._mode === 'hash') {
        // Route hash is already correct; just stash target for refresh
        window.__zqScrollTarget = id;
      } else {
        history.replaceState(null, '', window.location.pathname + '#' + id);
      }
    }
  },

  toggleSidebar() {
    this.state.sidebarOpen = !this.state.sidebarOpen;
  },

  closeSidebar() {
    this.state.sidebarOpen = false;
  },

  /* -- Render -- */

  render() {
    const s = this.state;
    const active = this.activePage;

    if (!this.templates || !this.templates[active]) {
      return '<div class="docs-layout"><p style="padding:2rem;color:#8b949e;">Loading documentation&hellip;</p></div>';
    }
    const q = s.searchQuery.trim().toLowerCase();

    // Build heading cache per page (used for sub-nav + search)
    const headingsMap = {};
    for (const sec of this.pages) {
      headingsMap[sec.id] = this._getHeadings(this.templates[sec.id] || '').filter(h => h.level === 3);
    }

    // Filter: match section label OR any sub-heading text
    const filtered = q
      ? this.pages.filter(sec =>
          sec.label.toLowerCase().includes(q) ||
          headingsMap[sec.id].some(h => h.text.toLowerCase().includes(q))
        )
      : this.pages;

    const mobile = this.state._mobile;

    return `
      <div class="docs-layout${mobile ? ' docs-mobile' : ''}">
        <div class="docs-sidebar-wrapper">
          <button class="docs-sidebar-toggle ${s.sidebarOpen ? 'expanded' : ''}" @click="toggleSidebar">
            <span class="toggle-icon"><svg viewBox="0 0 24 24"><polyline points="9 6 15 12 9 18"/></svg></span>
            <span class="toggle-label">${active ? this.pages.find(p => p.id === active)?.label || 'Sections' : 'Sections'}</span>
          </button>
          <aside class="docs-sidebar ${s.sidebarOpen ? 'sidebar-open' : ''}">
            <div class="docs-search">
              <input z-ref="searchInput" @input="onFilter" value="${s.searchQuery}" placeholder="Filter sections...">
              ${s.searchQuery ? '<a class="docs-search-clear" @click="clearFilter">&times;</a>' : ''}
            </div>
            <nav class="docs-nav">
              ${filtered.map(sec => {
                const isActive = active === sec.id;
                // When searching, show matching sub-headings in all results;
                // otherwise only show subs for the active section
                const subs = headingsMap[sec.id] || [];
                const visibleSubs = q
                  ? subs.filter(h => h.text.toLowerCase().includes(q) || sec.label.toLowerCase().includes(q))
                  : isActive ? subs : [];
                return `
                  <a class="docs-nav-item ${isActive ? 'active' : ''}"
                     z-link="/docs/${sec.id}" @click="closeSidebar">${sec.label}</a>
                  ${visibleSubs.length ? `<div class="docs-sub-nav">
                    ${visibleSubs.map(h => `<a class="docs-sub-nav-item${q && h.text.toLowerCase().includes(q) ? ' match' : ''}" ${isActive ? '@click="scrollTo"' : ''} ${isActive ? `data-id="${h.id}"` : `z-link="/docs/${sec.id}#${h.id}" @click="closeSidebar"`}>${h.text}</a>`).join('')}
                  </div>` : ''}
                `;
              }).join('')}
            </nav>
            <div class="docs-meta">
              <span class="badge">v${$.version}</span>
              <span style="color:#484f58;font-size:0.75rem;margin-left:0.5rem;">zQuery API Docs</span>
            </div>
          </aside>
        </div>

        <main class="docs-content" z-ref="content">
          <div class="docs-section">
            ${this._injectHeadingIds(this.templates[active] || this.templates['getting-started'] || '')}
          </div>
        </main>
      </div>
    `;
  },
});