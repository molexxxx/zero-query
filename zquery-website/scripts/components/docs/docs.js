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
  },

  mounted() {
    this._highlight();
    this.state._mobile = this._mql.matches;
    this._pendingHash = this._readTargetHash();
    this._scrollToHash();
  },
  updated() {
    this._highlight();
    // Pick up any new hash (e.g. from a z-link navigation that just resolved)
    if (!this._pendingHash) this._pendingHash = this._readTargetHash();
    this._scrollToHash();
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
    const el = document.getElementById(hash);
    if (el) {
      this._pendingHash = null;
      this._pendingHashAttempts = 0;
      requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } else if (++this._pendingHashAttempts > 30) {
      // Give up — anchor doesn't exist in this page
      this._pendingHash = null;
      this._pendingHashAttempts = 0;
    }
  },

  _highlight() {
    const root = this.refs.content;
    if (!root) return;
    // Wrap bare .docs-table elements in a scroll container
    root.querySelectorAll('.docs-table').forEach(table => {
      if (table.parentElement && table.parentElement.classList.contains('docs-table-wrap')) return;
      const wrap = document.createElement('div');
      wrap.className = 'docs-table-wrap';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
    // Prism syntax highlighting
    if (typeof Prism === 'undefined') return;
    root.querySelectorAll('pre code[class*="language-"]').forEach(el => {
      if (!el.classList.contains('prism-highlighted')) {
        Prism.highlightElement(el);
        el.classList.add('prism-highlighted');
      }
    });
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
    const el = document.getElementById(id);
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
    if (!this.templates) {
      return '<div class="docs-layout"><p style="padding:2rem;color:#8b949e;">Loading documentation&hellip;</p></div>';
    }

    const s = this.state;
    const active = this.activePage;
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