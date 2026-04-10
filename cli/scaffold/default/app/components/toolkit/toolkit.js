// toolkit.js - HTTP, utilities, and advanced store features
//
// Features used:
//   $.http / $.post / $.put / $.delete  - HTTP client + interceptors
//   $.pipe / $.memoize / $.retry        - functional utilities
//   $.groupBy / $.chunk / $.unique      - collection helpers
//   store.use / snapshot / history      - middleware & time-travel
//   templateUrl / styleUrl              - external template & styles

$.component('toolkit-page', {
  templateUrl: 'toolkit.html',
  styleUrl:    'toolkit.css',

  state: () => ({
    activeTab: 'http',
    httpLog: [],
    httpMethod: '',
    httpEndpoint: '',
    httpStatusCode: null,
    httpOutput: '',
    searchQuery: '',
    searchResults: [],
    searchLoading: false,
    activeUtil: '',
    utilOutput: '',
    storeLog: [],
    storeSnap: null,
    storeHistory: null,
    // Derived state for template expressions
    methodClass: 'get',
    statusOk: false,
    actionCount: 0,
  }),

  // init() lifecycle - runs before the first render
  init() {
    this._prevBaseURL = $.http.getConfig().baseURL || '';
    $.http.configure({ baseURL: 'https://jsonplaceholder.typicode.com' });

    this._unsubReq = $.http.onRequest((opts, url) => {
      this._pushLog('→  ' + (opts.method || 'GET') + '  ' + url);
    });
    this._unsubRes = $.http.onResponse((result) => {
      this._pushLog('←  ' + result.status + '  ' + (result.statusText || 'OK'));
    });

    this._mwActive = true;
    $.getStore('main').use((action, args) => {
      if (!this._mwActive) return;
      const raw = this.state.storeLog.__raw || this.state.storeLog;
      this.state.storeLog = [...raw, {
        id: Date.now(), action,
        args: JSON.stringify(args).slice(0, 60),
        time: new Date().toLocaleTimeString(),
      }].slice(-8);
    });

    // Keep actionCount in sync with store history
    this._syncActionCount();
    this._storeSub = $.getStore('main').subscribe(() => this._syncActionCount());
  },

  destroyed() {
    this._mwActive = false;
    if (this._unsubReq) this._unsubReq();
    if (this._unsubRes) this._unsubRes();
    if (this._abortCtrl) this._abortCtrl.abort();
    if (this._storeSub) this._storeSub();
    $.http.configure({ baseURL: this._prevBaseURL });
  },

  _pushLog(msg) {
    const raw = this.state.httpLog.__raw || this.state.httpLog;
    this.state.httpLog = [...raw, { id: Date.now(), msg }].slice(-10);
  },

  _syncActionCount() {
    const store = $.getStore('main');
    this.state.actionCount = store.history ? store.history.length : 0;
  },

  _updateHttpMeta(method, endpoint) {
    this.state.httpMethod = method;
    this.state.httpEndpoint = endpoint;
    this.state.httpOutput = '';
    this.state.httpStatusCode = null;
    this.state.methodClass = method === 'DELETE' ? 'del' : (method || 'get').toLowerCase();
    this.state.statusOk = false;
  },

  _setHttpResult(status, output) {
    this.state.httpStatusCode = status;
    this.state.statusOk = status >= 200 && status < 400;
    this.state.httpOutput = output;
  },

  setTab(tab) {
    this.state.activeTab = tab;
    this.state.utilOutput = '';
    this.state.activeUtil = '';
    this.state.httpOutput = '';
    this.state.httpMethod = '';
    this.state.httpStatusCode = null;
    this.state.storeSnap = null;
    this.state.storeHistory = null;
  },

  /* -- HTTP demos --------------------------------------------- */

  async doGet() {
    this._updateHttpMeta('GET', '/posts/1');
    try {
      const { data, status } = await $.get('/posts/1');
      this._setHttpResult(status, JSON.stringify(data, null, 2));
    } catch (e) { this._setHttpResult(0, 'Error: ' + e.message); }
  },

  async doPost() {
    this._updateHttpMeta('POST', '/posts');
    try {
      const { data, status } = await $.post('/posts', {
        title: 'Created with zQuery', body: 'Sent via $.post()', userId: 1,
      });
      this._setHttpResult(status, JSON.stringify(data, null, 2));
      $.bus.emit('toast', { message: 'POST successful!', type: 'success' });
    } catch (e) { this._setHttpResult(0, 'Error: ' + e.message); }
  },

  async doPut() {
    this._updateHttpMeta('PUT', '/posts/1');
    try {
      const { data, status } = await $.put('/posts/1', {
        id: 1, title: 'Updated via $.put()', body: 'Full resource replacement', userId: 1,
      });
      this._setHttpResult(status, JSON.stringify(data, null, 2));
      $.bus.emit('toast', { message: 'PUT successful!', type: 'success' });
    } catch (e) { this._setHttpResult(0, 'Error: ' + e.message); }
  },

  async doDelete() {
    this._updateHttpMeta('DELETE', '/posts/1');
    try {
      const { status } = await $.delete('/posts/1');
      this._setHttpResult(status, 'Resource deleted successfully.');
      $.bus.emit('toast', { message: 'DELETE sent', type: 'info' });
    } catch (e) { this._setHttpResult(0, 'Error: ' + e.message); }
  },

  async doSearch(e) {
    const q = e.target.value.trim().toLowerCase();
    this.state.searchQuery = e.target.value;
    if (!q) { this.state.searchResults = []; return; }

    if (this._abortCtrl) this._abortCtrl.abort();
    this._abortCtrl = $.http.createAbort();
    this.state.searchLoading = true;

    try {
      const { data } = await $.get('/users', null, { signal: this._abortCtrl.signal });
      this.state.searchResults = data.filter(u =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      ).slice(0, 5);
    } catch (err) {
      if (err.name !== 'AbortError') this.state.searchResults = [];
    } finally { this.state.searchLoading = false; }
  },

  /* -- Utility demos ------------------------------------------- */

  runUtil(name) {
    this.state.activeUtil = name;
    const demos = {
      pipe: () => {
        const slugify = $.pipe(
          s => s.trim(), s => s.toLowerCase(),
          s => s.replace(/[^a-z0-9]+/g, '-'), s => s.replace(/^-|-$/g, ''),
        );
        const input = '  Hello World! Creating Slugs  ';
        return `$.pipe(trim, lower, replace, strip)\n\nInput:  "${input}"\nOutput: "${slugify(input)}"`;
      },
      memoize: () => {
        const slowFib = (n) => n <= 1 ? n : slowFib(n - 1) + slowFib(n - 2);
        const t0 = performance.now();
        const result = slowFib(35);
        const slowTime = performance.now() - t0;

        const memoFib = $.memoize((n) => n <= 1 ? n : memoFib(n - 1) + memoFib(n - 2));
        const t1 = performance.now();
        memoFib(35);
        const fastTime = performance.now() - t1;

        const t2 = performance.now();
        memoFib(35);
        const cachedTime = performance.now() - t2;

        return [
          `$.memoize(fibonacci)`,
          ``,
          `fib(35) = ${result}`,
          `----------------------------`,
          `No memoize:  ${slowTime.toFixed(1)} ms`,
          `Memoized:    ${fastTime.toFixed(3)} ms`,
          `Cached:      ${cachedTime.toFixed(4)} ms  ⚡`,
          ``,
          `Speedup:     ${(slowTime / Math.max(fastTime, 0.001)).toFixed(0)}× faster`,
        ].join('\n');
      },
      retry: async () => {
        this.state.utilOutput = '⏳ Running with exponential backoff…';
        const log = [];
        try {
          await $.retry(async (attempt) => {
            log.push(`  #${attempt}  ${attempt < 3 ? '✗ failed' : '✓ succeeded!'}`);
            if (attempt < 3) throw new Error('Simulated failure');
            return 'ok';
          }, { attempts: 3, delay: 400, backoff: 2 });
        } catch (e) { log.push('  All attempts failed.'); }
        this.state.utilOutput = '$.retry({ attempts: 3, delay: 400, backoff: 2 })\n\n' + log.join('\n');
      },
      arrays: () => {
        const data = [
          { name: 'Alice', dept: 'eng' }, { name: 'Bob', dept: 'qa' },
          { name: 'Carol', dept: 'eng' }, { name: 'Dave', dept: 'design' },
        ];
        return [
          '$.groupBy(people, p => p.dept)',
          JSON.stringify($.groupBy(data, p => p.dept), null, 2),
          '',
          '$.chunk($.range(1,9), 3)  →  ' + JSON.stringify($.chunk($.range(1, 9), 3)),
          '$.unique([3,1,4,1,5,9])   →  ' + JSON.stringify($.unique([3, 1, 4, 1, 5, 9, 2, 5])),
          '$.range(0, 10, 2)         →  ' + JSON.stringify($.range(0, 10, 2)),
        ].join('\n');
      },
      objects: () => {
        const obj = { name: 'Tony', email: 'tony@dev.io', role: 'admin', secret: 'abc' };
        const a = { x: 1, nested: { y: 2 } };
        return [
          `$.pick(obj, ["name","email"])  →  ${JSON.stringify($.pick(obj, ['name', 'email']))}`,
          `$.omit(obj, ["secret"])        →  ${JSON.stringify($.omit(obj, ['secret']))}`,
          `$.isEqual(a, b)               →  ${$.isEqual(a, { x: 1, nested: { y: 2 } })}`,
          ``,
          `$.deepMerge({}, a, { nested: { z: 3 } })`,
          JSON.stringify($.deepMerge({}, a, { nested: { z: 3 } }), null, 2),
        ].join('\n');
      },
      strings: () => [
        `$.capitalize('hello')          →  "${$.capitalize('hello')}"`,
        `$.truncate('Hello World!', 8)  →  "${$.truncate('Hello World!', 8)}"`,
        `$.camelCase('my-component')    →  "${$.camelCase('my-component')}"`,
        `$.kebabCase('myComponent')     →  "${$.kebabCase('myComponent')}"`,
        ``,
        `$.param({ q: 'test', page: 2 })`,
        `  →  "${$.param({ q: 'test', page: 2 })}"`,
        ``,
        `$.parseQuery('?q=test&page=2')`,
        `  →  ${JSON.stringify($.parseQuery('?q=test&page=2'))}`,
      ].join('\n'),
    };

    const fn = demos[name];
    if (!fn) return;
    const result = fn();
    if (result && typeof result.then === 'function') return;
    this.state.utilOutput = result;
  },

  /* -- Store demos -------------------------------------------- */

  takeSnapshot() {
    this.state.storeSnap = JSON.stringify($.getStore('main').snapshot(), null, 2);
    this.state.storeHistory = null;
    $.bus.emit('toast', { message: 'Snapshot captured!', type: 'info' });
  },

  viewHistory() {
    const h = $.getStore('main').history.slice(-6);
    this.state.storeHistory = JSON.stringify(h, null, 2);
    this.state.storeSnap = null;
  },
});
