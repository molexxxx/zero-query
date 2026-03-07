$.component('compare-page', {
  state: () => ({
    activeTab: 'overview',
    tabs: [
      { id: 'overview',    label: 'Overview' },
      { id: 'selectors',   label: 'Selectors & DOM' },
      { id: 'components',  label: 'Components' },
      { id: 'directives',  label: 'Directives' },
      { id: 'reactivity',  label: 'Reactivity' },
      { id: 'native',      label: 'Native & Size' },
    ],
  }),

  // -----------------------------------------------------------------------
  // render
  // -----------------------------------------------------------------------
  render() {
    const t = this.state.activeTab;

    return `
      <div>
        ${this._hero()}

        <div class="card" style="padding:0;overflow:hidden;">
          <div class="cmp-tab-bar">
            <button z-for="tb in tabs" class="cmp-tab" z-class="{active: activeTab === '{{tb.id}}'}" @click="switchTab" data-tab="{{tb.id}}">{{tb.label}}</button>
          </div>
          <div class="cmp-tab-body">${this._panel(t)}</div>
        </div>

        ${this._verdict()}
      </div>
    `;
  },

  // -----------------------------------------------------------------------
  // Tab switching
  // -----------------------------------------------------------------------
  switchTab(e) {
    const tab = e.target.closest('[data-tab]');
    if (tab) this.state.activeTab = tab.dataset.tab;
  },

  // -----------------------------------------------------------------------
  // Lifecycle — Prism highlighting + de-indent fix for bundled builds
  // -----------------------------------------------------------------------
  mounted()  { this._highlightCode(); },
  updated()  { this._highlightCode(); },

  _highlightCode() {
    const root = this._el;
    if (!root) return;
    // De-indent: strip common leading whitespace that the bundler preserves
    root.querySelectorAll('pre > code').forEach(code => {
      if (code._zqDeindented) return;
      code._zqDeindented = true;
      const lines = code.textContent.split('\n');
      // Drop empty first/last lines from template literal formatting
      if (lines.length && !lines[0].trim()) lines.shift();
      if (lines.length && !lines[lines.length - 1].trim()) lines.pop();
      const minIndent = lines
        .filter(l => l.trim())
        .reduce((min, l) => Math.min(min, l.match(/^(\s*)/)[1].length), Infinity);
      if (minIndent > 0 && minIndent < Infinity) {
        code.textContent = lines.map(l => l.slice(minIndent)).join('\n');
      }
    });
    // Run Prism
    if (typeof Prism !== 'undefined') {
      root.querySelectorAll('pre code[class*="language-"]:not(.prism-highlighted)').forEach(el => {
        Prism.highlightElement(el);
        el.classList.add('prism-highlighted');
      });
    }
  },

  // -----------------------------------------------------------------------
  // Hero
  // -----------------------------------------------------------------------
  _hero() {
    return `
      <div class="card" style="text-align:center;padding:2.5rem 1.5rem;">
        <h1 style="font-size:2rem;color:#f0f6fc;margin-bottom:0.5rem;">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#58a6ff" style="width:28px;height:28px;vertical-align:-5px;margin-right:0.35rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>
          Framework Comparison
        </h1>
        <p style="max-width:640px;margin:0 auto;line-height:1.7;color:#8b949e;">
          See how zQuery stacks up against jQuery, Angular, and React &mdash; from selector ergonomics
          and component patterns to bundle size and native platform alignment.
        </p>
        <div style="margin-top:1.25rem;display:flex;justify-content:center;align-items:center;gap:0.75rem;flex-wrap:wrap;">
          <span class="badge" style="background:#0769ad;">jQuery</span>
          <span class="badge" style="background:#c3002f;">Angular</span>
          <span class="badge" style="background:#58a6ff;">React</span>
          <span class="badge" style="background:linear-gradient(135deg,#e3b341,#d29922);color:#0d1117;font-weight:700;letter-spacing:0.3px;box-shadow:0 0 8px #e3b34144;">zQuery</span>
        </div>
      </div>
    `;
  },

  // -----------------------------------------------------------------------
  // Panel router
  // -----------------------------------------------------------------------
  _panel(id) {
    switch (id) {
      case 'overview':   return this._overviewPanel();
      case 'selectors':  return this._selectorsPanel();
      case 'components': return this._componentsPanel();
      case 'directives': return this._directivesPanel();
      case 'reactivity': return this._reactivityPanel();
      case 'native':     return this._nativePanel();
      default:           return '';
    }
  },

  // -----------------------------------------------------------------------
  // Overview
  // -----------------------------------------------------------------------
  _overviewPanel() {
    const rows = [
      ['First Release',           '2006',           '2016',           '2013',           '2025'],
      ['Bundle Size (min)',       '~87 KB',         '~150 KB+',      '~44 KB (+ DOM)', '~54 KB'],
      ['Dependencies',            '0',              '5+ (RxJS&hellip;)',    '0 (core)',  '0'],
      ['Build Step Required',     'No',             'Yes (CLI)',      'Typical (JSX)',  'Optional'],
      ['Component Model',         'No',             'Yes',            'Yes',            'Yes'],
      ['Scoped Styles',           'No',             'Yes',            'CSS Modules / ext.', 'Yes (auto)'],
      ['Router Built-In',         'No',             'Yes',            'No (react-router)', 'Yes'],
      ['State Management',        'No',             'Services/RxJS',  'Context / ext.', 'Yes ($.store)'],
      ['Signals / Fine-Grained',  'No',             'v16+ (partial)', 'No',             'Yes ($.signal)'],
      ['HTTP Client',             '$.ajax',         'HttpClient',     'No (fetch/ext.)','Yes ($.http)'],
      ['Two-Way Binding',         'Manual',         'Yes (ngModel)',  'Controlled inputs','Yes (z-model)'],
      ['Built-in Directives',     'No',             'Yes',            'No (JSX only)',   'Yes (15)'],
      ['Event Bus',               'No',             'No (RxJS Subject)','No',            'Yes ($.bus)'],
      ['TypeScript',              'DefinitelyTyped','First-class',    'First-class',    'Bundled d.ts'],
    ];

    return `
      <div class="cmp-section">
        <h3>Feature Matrix</h3>
        <p>A side-by-side look at what ships out of the box with each framework. zQuery aims to be <strong>batteries-included</strong> &mdash; router, store, HTTP client, signals, and event bus all ship in a single ~54 KB file.</p>

        <div style="overflow-x:auto;">
          <table class="cmp-table">
            <thead>
              <tr>
                <th></th>
                <th><span class="cmp-lib" style="--accent:#0769ad;">jQuery</span></th>
                <th><span class="cmp-lib" style="--accent:#c3002f;">Angular</span></th>
                <th><span class="cmp-lib" style="--accent:#58a6ff;">React</span></th>
                <th class="cmp-zq-col"><span class="cmp-lib cmp-lib-zq">zQuery</span></th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `<tr><td class="cmp-label">${r[0]}</td>${r.slice(1, 4).map(c => `<td>${c}</td>`).join('')}<td class="cmp-zq-col">${r[4]}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>

        <div class="cmp-callout" style="margin-top:1rem;">
          <strong>Batteries included:</strong> Features like routing, state management, HTTP, and signals typically require separate packages in React (react-router, Redux/Zustand, axios) and even Angular (RxJS for state, HttpClient requires imports). zQuery ships all of these in a single zero-dependency file.
        </div>
      </div>
    `;
  },

  // -----------------------------------------------------------------------
  // Selectors & DOM
  // -----------------------------------------------------------------------
  _selectorsPanel() {
    return `
      <div class="cmp-section">
        <h3>Selector Engine</h3>
        <p>jQuery ships a custom Sizzle selector engine. zQuery delegates straight to the browser&rsquo;s native <code>querySelectorAll</code> with a thin wrapper &mdash; fewer allocations, zero parsing overhead, and automatic performance gains as browsers improve.</p>

        <div class="cmp-grid">
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#0769ad;">jQuery</div>
            <pre><code class="language-js">// Custom Sizzle engine → heavy wrapper
$('.items li').addClass('active')
              .css('color', 'red');

// Works, but each result becomes a
// heavyweight jQuery object</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#e3b341;">zQuery</div>
            <pre><code class="language-js">// Native querySelectorAll → thin wrapper
$('.items li').addClass('active')
              .css('color', 'red');

// Same chaining API, backed by the
// browser's own optimised engine</code></pre>
          </div>
        </div>

        <h3 style="margin-top:1.5rem;">Chaining &amp; DOM Manipulation</h3>
        <p>zQuery mirrors jQuery&rsquo;s chainable API with 57+ methods, but without a Virtual DOM or reconciler. Every call touches the real DOM directly.</p>

        <div class="cmp-grid cmp-grid-3">
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#0769ad;">jQuery</div>
            <pre><code class="language-js">$('#app')
  .find('.card')
  .addClass('active')
  .css('opacity', 1)
  .on('click', handler)
  .append('&lt;span&gt;New&lt;/span&gt;');</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#58a6ff;">React</div>
            <pre><code class="language-js">// No direct DOM — must go through
// Virtual DOM reconciliation
function App() {
  return (
    &lt;div className="active"
      style={{opacity: 1}}
      onClick={handler}&gt;
      &lt;span&gt;New&lt;/span&gt;
    &lt;/div&gt;
  );
}</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#e3b341;">zQuery</div>
            <pre><code class="language-js">$('#app')
  .find('.card')
  .addClass('active')
  .css('opacity', 1)
  .on('click', handler)
  .append('&lt;span&gt;New&lt;/span&gt;');</code></pre>
          </div>
        </div>

        <h3 style="margin-top:1.5rem;">Available Methods</h3>
        <p>zQuery&rsquo;s <code>$()</code> returns a <code>ZQueryCollection</code> with methods grouped by category:</p>

        <div style="overflow-x:auto;">
          <table class="cmp-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Methods</th>
              </tr>
            </thead>
            <tbody>
              <tr><td class="cmp-label">Traversal</td><td><code>find</code>, <code>parent</code>, <code>closest</code>, <code>children</code>, <code>siblings</code>, <code>next</code>, <code>prev</code></td></tr>
              <tr><td class="cmp-label">Filtering</td><td><code>filter</code>, <code>not</code>, <code>has</code>, <code>first</code>, <code>last</code>, <code>eq</code></td></tr>
              <tr><td class="cmp-label">Classes</td><td><code>addClass</code>, <code>removeClass</code>, <code>toggleClass</code>, <code>hasClass</code></td></tr>
              <tr><td class="cmp-label">Attributes</td><td><code>attr</code>, <code>removeAttr</code>, <code>prop</code>, <code>data</code></td></tr>
              <tr><td class="cmp-label">Content</td><td><code>html</code>, <code>text</code>, <code>val</code></td></tr>
              <tr><td class="cmp-label">DOM</td><td><code>append</code>, <code>prepend</code>, <code>after</code>, <code>before</code>, <code>wrap</code>, <code>remove</code>, <code>empty</code>, <code>clone</code>, <code>replaceWith</code></td></tr>
              <tr><td class="cmp-label">CSS</td><td><code>css</code>, <code>width</code>, <code>height</code>, <code>offset</code>, <code>position</code>, <code>show</code>, <code>hide</code>, <code>toggle</code></td></tr>
              <tr><td class="cmp-label">Events</td><td><code>on</code>, <code>off</code>, <code>one</code>, <code>trigger</code>, <code>click</code>, <code>submit</code>, <code>focus</code>, <code>blur</code></td></tr>
              <tr><td class="cmp-label">Animation</td><td><code>animate</code>, <code>fadeIn</code>, <code>fadeOut</code>, <code>slideToggle</code></td></tr>
              <tr><td class="cmp-label">Forms</td><td><code>serialize</code>, <code>serializeObject</code></td></tr>
              <tr><td class="cmp-label">Iteration</td><td><code>each</code>, <code>map</code>, <code>toArray</code>, <code>[Symbol.iterator]</code></td></tr>
            </tbody>
          </table>
        </div>

        <h3 style="margin-top:1.5rem;">Global Helpers</h3>
        <p>Beyond the collection API, zQuery exposes quick-access helpers on the <code>$</code> namespace:</p>

        <div class="cmp-grid">
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#e3b341;">Quick Selection</div>
            <pre><code class="language-js">$.id('app')       // getElementById
$.class('card')    // first .card element
$.classes('card')  // all .card elements
$.tag('li')        // all &lt;li&gt; elements
$.children('#app') // child nodes of #app</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#e3b341;">DOM Creation</div>
            <pre><code class="language-js">// $.create(tag, attrs, ...children)
const btn = $.create('button',
  { class: 'primary', id: 'save' },
  'Save Changes'
);
document.body.appendChild(btn);</code></pre>
          </div>
        </div>

        <div class="cmp-callout">
          <strong>API familiarity:</strong> If you know jQuery, you already know zQuery&rsquo;s selector API. The difference is under the hood &mdash; native <code>querySelectorAll</code>, native <code>addEventListener</code>, and a thin ~54&nbsp;KB footprint instead of an 87&nbsp;KB custom engine.
        </div>
      </div>
    `;
  },

  // -----------------------------------------------------------------------
  // Components
  // -----------------------------------------------------------------------
  _componentsPanel() {
    return `
      <div class="cmp-section">
        <h3>Defining Components</h3>
        <p>Angular uses decorated classes with a module system. React uses functions or classes with JSX. zQuery takes a single-call approach &mdash; one function, one plain object, zero boilerplate.</p>

        <div class="cmp-grid cmp-grid-3">
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#c3002f;">Angular</div>
            <pre><code class="language-js">@Component({
  selector: 'app-counter',
  template: \`
    &lt;p&gt;{{ count }}&lt;/p&gt;
    &lt;button (click)="inc()"&gt;+&lt;/button&gt;
  \`
})
export class CounterComponent {
  count = 0;
  inc() { this.count++; }
}</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#58a6ff;">React</div>
            <pre><code class="language-js">function Counter() {
  const [count, setCount]
    = useState(0);
  return (
    &lt;&gt;
      &lt;p&gt;{count}&lt;/p&gt;
      &lt;button onClick={() =&gt;
        setCount(c =&gt; c + 1)}&gt;
        +
      &lt;/button&gt;
    &lt;/&gt;
  );
}</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#e3b341;">zQuery</div>
            <pre><code class="language-js">$.component('counter', {
  state: { count: 0 },
  render() {
    return \`
      &lt;p&gt;\${this.state.count}&lt;/p&gt;
      &lt;button @click="inc"&gt;+&lt;/button&gt;
    \`;
  },
  inc() { this.state.count++; }
});</code></pre>
          </div>
        </div>

        <h3 style="margin-top:1.5rem;">Lifecycle Hooks</h3>
        <p>zQuery provides four clear lifecycle hooks that map to the natural lifecycle of a DOM element &mdash; no decorators, no dependency injection, and no hook-ordering rules.</p>

        <div class="cmp-grid cmp-grid-3">
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#c3002f;">Angular</div>
            <pre><code class="language-js">@Component({ ... })
export class MyWidget {
  ngOnInit()    { /* init      */ }
  ngAfterViewInit() { /* in DOM */ }
  ngOnChanges() { /* updated   */ }
  ngOnDestroy() { /* cleanup   */ }
}</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#58a6ff;">React</div>
            <pre><code class="language-js">function MyWidget() {
  useEffect(() =&gt; {
    // mounted
    return () =&gt; {
      // cleanup (destroyed)
    };
  }, []);
  // no direct "updated" hook
}</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#e3b341;">zQuery</div>
            <pre><code class="language-js">$.component('my-widget', {
  init()      { /* state ready     */ },
  mounted()   { /* in DOM          */ },
  updated()   { /* after re-render */ },
  destroyed() { /* cleanup         */ },
});</code></pre>
          </div>
        </div>

        <h3 style="margin-top:1.5rem;">Scoped Styles</h3>
        <p>Angular uses <code>ViewEncapsulation</code>. React relies on CSS Modules or CSS-in-JS libraries. zQuery auto-scopes component styles with zero config &mdash; no naming conventions, no extra tooling.</p>

        <div class="cmp-grid cmp-grid-3">
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#c3002f;">Angular</div>
            <pre><code class="language-js">@Component({
  styles: [\`
    .title { color: red; }
  \`],
  encapsulation:
    ViewEncapsulation.Emulated
})</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#58a6ff;">React</div>
            <pre><code class="language-js">// Requires CSS Modules + bundler
import styles from './widget.module.css';

function Widget() {
  return &lt;h1 className={
    styles.title}&gt;Hi&lt;/h1&gt;;
}</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#e3b341;">zQuery</div>
            <pre><code class="language-js">$.component('widget', {
  // Inline — auto-scoped
  styles: \`.title { color: red; }\`,
  // Or external file
  styleUrl: 'widget.css',
  render() {
    return '&lt;h1 class="title"&gt;Hi&lt;/h1&gt;';
  }
});</code></pre>
          </div>
        </div>

        <h3 style="margin-top:1.5rem;">External Templates</h3>
        <p>zQuery components can use external HTML files instead of inline <code>render()</code> &mdash; keeping markup, logic, and styles cleanly separated. Here&rsquo;s a contacts example showcasing everything you can do in an HTML template:</p>

        <div class="cmp-grid">
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#e3b341;">contacts.js</div>
            <pre><code class="language-js">$.component('contacts-page', {
  templateUrl: 'contacts.html',
  styleUrl:    'contacts.css',

  state: () => ({
    contacts: [],
    showForm: false,
    newName: '',
    newEmail: '',
  }),

  mounted() {
    // Hydrate from store
    const store = $.getStore('main');
    this.state.contacts =
      store.state.contacts || [];
  },

  toggleForm() {
    this.state.showForm =
      !this.state.showForm;
  },

  addContact() {
    const { newName, newEmail } = this.state;
    if (!newName || !newEmail) return;
    this.state.contacts.push({
      id: Date.now(),
      name: newName,
      email: newEmail,
      favorite: false,
    });
    this.state.newName = '';
    this.state.newEmail = '';
    this.state.showForm = false;
  },

  toggleFavorite(e) {
    const id = +e.target.dataset.id;
    const c = this.state.contacts
      .find(c => c.id === id);
    if (c) c.favorite = !c.favorite;
  },

  deleteContact(e) {
    const id = +e.target.dataset.id;
    this.state.contacts =
      this.state.contacts
        .filter(c => c.id !== id);
  },
});</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#e3b341;">contacts.html</div>
            <pre><code class="language-html">&lt;!-- z-cloak hides until rendered --&gt;
&lt;h1 z-cloak&gt;Contacts ({{contacts.length}})&lt;/h1&gt;

&lt;!-- z-if / z-else conditional blocks --&gt;
&lt;p z-if="contacts.length"&gt;
  Showing &lt;strong z-text="contacts.length"&gt;
  &lt;/strong&gt; contacts
&lt;/p&gt;
&lt;p z-else&gt;No contacts yet.&lt;/p&gt;

&lt;!-- z-for list rendering + {{}} --&gt;
&lt;ul z-show="contacts.length"&gt;
  &lt;li z-for="(c, i) in contacts"
      z-class="{fav: c.favorite}"&gt;
    {{i + 1}}. {{c.name}} &amp;mdash;
    &lt;span z-text="c.email"&gt;&lt;/span&gt;
    &lt;button @click="toggleFavorite"
            data-id="{{c.id}}"&gt;★&lt;/button&gt;
    &lt;button @click="deleteContact"
            data-id="{{c.id}}"&gt;✕&lt;/button&gt;
  &lt;/li&gt;
&lt;/ul&gt;

&lt;!-- @click event binding --&gt;
&lt;button @click="toggleForm"&gt;
  &lt;span z-if="showForm"&gt;Cancel&lt;/span&gt;
  &lt;span z-else&gt;+ Add&lt;/span&gt;
&lt;/button&gt;

&lt;!-- z-show, z-model, z-trim, @submit --&gt;
&lt;form z-show="showForm"
      @submit.prevent="addContact"&gt;
  &lt;input z-model="newName" z-trim
         placeholder="Name"&gt;
  &lt;input z-model="newEmail" z-trim
         placeholder="Email"&gt;
  &lt;button type="submit"
    z-ref="saveBtn"&gt;Save&lt;/button&gt;
&lt;/form&gt;</code></pre>
          </div>
        </div>

        <div class="cmp-callout" style="margin-top:1rem;">
          <strong>One template, many features:</strong> <code>{{expr}}</code> for inline interpolation, <code>z-text</code> / <code>z-html</code> for element content, <code>z-if</code> / <code>z-else</code> for conditionals, <code>z-for</code> for lists, <code>z-show</code> for toggling visibility, <code>z-model</code> + <code>z-trim</code> for two-way binding, <code>z-class</code> for dynamic classes, <code>z-ref</code> for DOM refs, <code>z-cloak</code> to prevent flash, and <code>@event</code> for event handling &mdash; all in plain HTML, no build step.
        </div>

        <p style="margin-top:1rem;margin-bottom:0.5rem;font-weight:600;color:#e6edf3;">templateUrl accepts multiple shapes:</p>
        <div class="cmp-grid cmp-grid-3">
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#58a6ff;">String</div>
            <pre><code class="language-js">templateUrl: 'page.html'

// used as the template
// directly — no extra access</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#58a6ff;">Array</div>
            <pre><code class="language-js">templateUrl: [
  'header.html',
  'footer.html'
]
// this.templates[0]
// this.templates[1]</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#58a6ff;">Object</div>
            <pre><code class="language-js">templateUrl: {
  main: 'main.html',
  side: 'side.html'
}
// this.templates.main
// this.templates.side</code></pre>
          </div>
        </div>

        <p style="margin-top:1rem;margin-bottom:0.5rem;font-weight:600;color:#e6edf3;">
          Or use <code>pages</code> for route-driven lazy-loaded templates:
        </p>
        <div class="cmp-grid">
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#3fb950;">pages config</div>
            <pre><code class="language-js">pages: {
  dir:     'pages',       // folder
  param:   'section',     // route param
  default: 'getting-started',
  items: [
    'getting-started',
    { id: 'router', label: 'Router' },
    { id: 'http',   label: 'HTTP Client' },
  ]
}</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#3fb950;">what you get</div>
            <pre><code class="language-js">// auto-resolved from dir + items:
//   pages/getting-started.html
//   pages/router.html
//   pages/http.html

this.pages      // [{id, label}, …]
this.activePage // current route param
this.templates  // { id: html, … }

// active page fetched first,
// rest prefetched in background</code></pre>
          </div>
        </div>

        <h3 style="margin-top:1.5rem;">Component Communication</h3>

        <div class="cmp-grid cmp-grid-3">
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#c3002f;">Angular</div>
            <pre><code class="language-js">// @Output + EventEmitter
@Output() saved =
  new EventEmitter&lt;string&gt;();

this.saved.emit(value);

// ViewChild for refs
@ViewChild('chart')
chartEl: ElementRef;</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#58a6ff;">React</div>
            <pre><code class="language-js">// Callback props
&lt;Child onSave={handleSave} /&gt;

// useRef for DOM access
const chart = useRef(null);
&lt;canvas ref={chart} /&gt;</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#e3b341;">zQuery</div>
            <pre><code class="language-js">// Emit a bubbling CustomEvent
this.emit('saved', { value });
// Parent: @saved="onSaved"

// DOM refs via z-ref
// &lt;canvas z-ref="chart"&gt;
this.refs.chart; // actual element

// Partial state merge
this.setState({ loading: false });</code></pre>
          </div>
        </div>

        <div class="cmp-callout">
          <strong>Microtask-batched renders:</strong> Multiple <code>state</code> mutations within the same tick are coalesced into a single DOM update &mdash; similar to React&rsquo;s batched setState, but automatic with no wrapper API needed.
        </div>
      </div>
    `;
  },

  // -----------------------------------------------------------------------
  // Directives
  // -----------------------------------------------------------------------
  _directivesPanel() {
    return `
      <div class="cmp-section">
        <h3>Template Directives</h3>
        <p>Angular pioneered template directives. React chose JSX expressions instead. zQuery brings a familiar directive syntax that works in plain HTML template literals &mdash; no build step, no compiler, no imports.</p>

        <h3 style="margin-top:1.5rem;">Conditional Rendering</h3>
        <div class="cmp-grid cmp-grid-3">
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#c3002f;">Angular</div>
            <pre><code class="language-html">&lt;!-- No else-if — nest templates --&gt;
&lt;div *ngIf="role==='admin'; else chk"&gt;
  Admin Panel
&lt;/div&gt;
&lt;ng-template #chk&gt;
  &lt;div *ngIf="role==='user'; else guest"&gt;
    Dashboard
  &lt;/div&gt;
&lt;/ng-template&gt;
&lt;ng-template #guest&gt;
  Please log in
&lt;/ng-template&gt;

&lt;div [hidden]="!open"&gt;Drawer&lt;/div&gt;</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#58a6ff;">React</div>
            <pre><code class="language-js">{role === 'admin'
  ? &lt;div&gt;Admin Panel&lt;/div&gt;
  : role === 'user'
    ? &lt;div&gt;Dashboard&lt;/div&gt;
    : &lt;div&gt;Please log in&lt;/div&gt;
}

{/* No show/hide directive —
    manual style toggle */}
&lt;div style={{
  display: open ? '' : 'none'
}}&gt;Drawer&lt;/div&gt;</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#e3b341;">zQuery</div>
            <pre><code class="language-html">&lt;div z-if="role === 'admin'"&gt;
  Admin Panel
&lt;/div&gt;
&lt;div z-else-if="role === 'user'"&gt;
  Dashboard
&lt;/div&gt;
&lt;div z-else&gt;
  Please log in
&lt;/div&gt;

&lt;!-- CSS toggle (keeps in DOM) --&gt;
&lt;div z-show="open"&gt;Drawer&lt;/div&gt;</code></pre>
          </div>
        </div>

        <h3 style="margin-top:1.5rem;">List Rendering</h3>
        <div class="cmp-grid cmp-grid-3">
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#c3002f;">Angular</div>
            <pre><code class="language-html">&lt;li *ngFor="let item of items;
            let i = index"&gt;
  {{ i }}: {{ item.name }}
&lt;/li&gt;

&lt;!-- Requires CommonModule --&gt;</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#58a6ff;">React</div>
            <pre><code class="language-js">{items.map((item, i) =&gt;
  &lt;li key={item.id}&gt;
    {i}: {item.name}
  &lt;/li&gt;
)}</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#e3b341;">zQuery</div>
            <pre><code class="language-html">&lt;!-- $index auto-provided --&gt;
&lt;li z-for="item in items"&gt;
  {{$index}}: {{item.name}}
&lt;/li&gt;

&lt;!-- Destructured index --&gt;
&lt;li z-for="(task, i) in tasks"&gt;
  {{i + 1}}. {{task.title}}
&lt;/li&gt;</code></pre>
          </div>
        </div>

        <h3 style="margin-top:1.5rem;">Event Handling</h3>
        <div class="cmp-grid cmp-grid-3">
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#c3002f;">Angular</div>
            <pre><code class="language-html">&lt;button (click)="save()"&gt;
&lt;input (keyup.enter)="submit()"&gt;
&lt;form (submit)="onSubmit($event)"&gt;

&lt;!-- No built-in debounce/throttle.
     Requires RxJS or manual code. --&gt;</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#58a6ff;">React</div>
            <pre><code class="language-js">&lt;button onClick={save}&gt;
&lt;input onKeyUp={handleKey} /&gt;
&lt;form onSubmit={e =&gt; {
  e.preventDefault();
  onSubmit();
}}&gt;

{/* No built-in modifiers.
    preventDefault is manual. */}</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#e3b341;">zQuery</div>
            <pre><code class="language-html">&lt;!-- @ shorthand or z-on: --&gt;
&lt;button @click="save"&gt;
&lt;button z-on:click="save"&gt;

&lt;!-- Chain modifiers declaratively --&gt;
&lt;form @submit.prevent="onSubmit"&gt;
&lt;button @click.once="init"&gt;
&lt;input @input.debounce.300="search"&gt;
&lt;div @scroll.throttle.100="onScroll"&gt;</code></pre>
          </div>
        </div>

        <h3 style="margin-top:1rem;">Event Modifiers at a Glance</h3>
        <div style="overflow-x:auto;">
          <table class="cmp-table">
            <thead>
              <tr>
                <th>Modifier</th>
                <th><span class="cmp-lib" style="--accent:#c3002f;">Angular</span></th>
                <th><span class="cmp-lib" style="--accent:#58a6ff;">React</span></th>
                <th class="cmp-zq-col"><span class="cmp-lib cmp-lib-zq">zQuery</span></th>
              </tr>
            </thead>
            <tbody>
              <tr><td class="cmp-label">.prevent</td><td>Manual</td><td>Manual</td><td class="cmp-zq-col"><span class="cmp-yes">&#10003;</span> Built-in</td></tr>
              <tr><td class="cmp-label">.stop</td><td>Manual</td><td>Manual</td><td class="cmp-zq-col"><span class="cmp-yes">&#10003;</span> Built-in</td></tr>
              <tr><td class="cmp-label">.once</td><td>Manual</td><td>Manual</td><td class="cmp-zq-col"><span class="cmp-yes">&#10003;</span> Built-in</td></tr>
              <tr><td class="cmp-label">.self</td><td>Manual</td><td>Manual</td><td class="cmp-zq-col"><span class="cmp-yes">&#10003;</span> Built-in</td></tr>
              <tr><td class="cmp-label">.capture</td><td>Manual</td><td>onClickCapture</td><td class="cmp-zq-col"><span class="cmp-yes">&#10003;</span> Built-in</td></tr>
              <tr><td class="cmp-label">.passive</td><td>Manual</td><td>Manual</td><td class="cmp-zq-col"><span class="cmp-yes">&#10003;</span> Built-in</td></tr>
              <tr><td class="cmp-label">.debounce.<em>ms</em></td><td><span class="cmp-no">&#10007;</span></td><td><span class="cmp-no">&#10007;</span></td><td class="cmp-zq-col"><span class="cmp-yes">&#10003;</span> Built-in</td></tr>
              <tr><td class="cmp-label">.throttle.<em>ms</em></td><td><span class="cmp-no">&#10007;</span></td><td><span class="cmp-no">&#10007;</span></td><td class="cmp-zq-col"><span class="cmp-yes">&#10003;</span> Built-in</td></tr>
            </tbody>
          </table>
        </div>

        <h3 style="margin-top:1.5rem;">Two-Way &amp; Attribute Binding</h3>
        <div class="cmp-grid cmp-grid-3">
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#c3002f;">Angular</div>
            <pre><code class="language-html">&lt;input [(ngModel)]="name"&gt;
&lt;div [ngClass]="{active: on}"&gt;
&lt;div [ngStyle]="{color: c}"&gt;
&lt;a [href]="url"&gt;

&lt;!-- Requires FormsModule import --&gt;</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#58a6ff;">React</div>
            <pre><code class="language-js">&lt;input value={name}
  onChange={e =&gt;
    setName(e.target.value)} /&gt;
&lt;div className={on?'active':''}&gt;
&lt;div style={{color: c}}&gt;
&lt;a href={url}&gt;

{/* Manual two-way wiring */}</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#e3b341;">zQuery</div>
            <pre><code class="language-html">&lt;!-- True two-way binding --&gt;
&lt;input z-model="name"&gt;

&lt;!-- Input modifiers --&gt;
&lt;input z-model="query" z-lazy&gt;
&lt;input z-model="tag" z-trim&gt;
&lt;input z-model="age" z-number&gt;

&lt;!-- Attribute &amp; dynamic binding --&gt;
&lt;a :href="url"&gt;
&lt;img z-bind:src="avatar"&gt;</code></pre>
          </div>
        </div>

        <h3 style="margin-top:1.5rem;">Content &amp; Styling Directives</h3>
        <div class="cmp-grid cmp-grid-3">
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#c3002f;">Angular</div>
            <pre><code class="language-html">&lt;span [textContent]="label"&gt;
&lt;div [innerHTML]="html"&gt;
&lt;div [ngClass]="{active: on}"&gt;
&lt;div [ngStyle]="{color: c}"&gt;

&lt;!-- No cloak or ref directive --&gt;
&lt;!-- ViewChild for refs --&gt;</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#58a6ff;">React</div>
            <pre><code class="language-js">&lt;span&gt;{label}&lt;/span&gt;
&lt;div dangerouslySetInnerHTML=
  {{__html: html}} /&gt;
&lt;div className={cls}&gt;
&lt;div style={styles}&gt;

{/* useRef() for refs */}
const el = useRef(null);</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#e3b341;">zQuery</div>
            <pre><code class="language-html">&lt;span z-text="label"&gt;&lt;/span&gt;
&lt;div z-html="richContent"&gt;&lt;/div&gt;
&lt;div z-class="{active: on}"&gt;
&lt;div z-style="{color: c}"&gt;

&lt;!-- DOM references --&gt;
&lt;canvas z-ref="chart"&gt;&lt;/canvas&gt;
&lt;!-- this.refs.chart in hooks --&gt;</code></pre>
          </div>
        </div>

        <h3 style="margin-top:1rem;">Utility Directives</h3>
        <p>zQuery-only directives with no Angular or React equivalent:</p>
        <div style="overflow-x:auto;">
          <table class="cmp-table">
            <thead>
              <tr>
                <th>Directive</th>
                <th>Purpose</th>
                <th>Example</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="cmp-label">z-cloak</td>
                <td>Hides element until the component renders, preventing flash of <code>{{curly}}</code> template syntax</td>
                <td><code>&lt;div z-cloak&gt;{{name}}&lt;/div&gt;</code></td>
              </tr>
              <tr>
                <td class="cmp-label">z-pre</td>
                <td>Skips directive processing for the element and its children &mdash; useful for displaying raw template syntax</td>
                <td><code>&lt;code z-pre&gt;{{raw}}&lt;/code&gt;</code></td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 style="margin-top:1.5rem;">Full Directive Reference</h3>
        <div style="overflow-x:auto;">
          <table class="cmp-table">
            <thead>
              <tr>
                <th>Directive</th>
                <th>Category</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr><td class="cmp-label">z-if</td><td>Conditional</td><td>Insert/remove element based on expression</td></tr>
              <tr><td class="cmp-label">z-else-if</td><td>Conditional</td><td>Chained conditional after <code>z-if</code></td></tr>
              <tr><td class="cmp-label">z-else</td><td>Conditional</td><td>Fallback block when prior conditions are false</td></tr>
              <tr><td class="cmp-label">z-show</td><td>Conditional</td><td>Toggle <code>display:none</code> — keeps element in DOM</td></tr>
              <tr><td class="cmp-label">z-for</td><td>Loop</td><td>Render list with auto <code>$index</code> or <code>(item, i)</code> destructuring</td></tr>
              <tr><td class="cmp-label">z-model</td><td>Binding</td><td>Two-way bind to form inputs, selects, textareas</td></tr>
              <tr><td class="cmp-label">z-bind / :</td><td>Binding</td><td>Dynamically set any HTML attribute</td></tr>
              <tr><td class="cmp-label">z-class</td><td>Binding</td><td>Conditional class names via object syntax</td></tr>
              <tr><td class="cmp-label">z-style</td><td>Binding</td><td>Dynamic inline styles via object syntax</td></tr>
              <tr><td class="cmp-label">z-text</td><td>Content</td><td>Set <code>textContent</code> from state</td></tr>
              <tr><td class="cmp-label">z-html</td><td>Content</td><td>Set <code>innerHTML</code> from state</td></tr>
              <tr><td class="cmp-label">z-ref</td><td>Utility</td><td>Name a DOM element for <code>this.refs.*</code> access</td></tr>
              <tr><td class="cmp-label">z-cloak</td><td>Utility</td><td>Hide until render to prevent template flash</td></tr>
              <tr><td class="cmp-label">z-pre</td><td>Utility</td><td>Skip directive processing on this subtree</td></tr>
              <tr><td class="cmp-label">@event / z-on:</td><td>Events</td><td>Bind DOM events with optional modifier chain</td></tr>
            </tbody>
          </table>
        </div>

        <div class="cmp-callout" style="margin-top:1rem;">
          <strong>Zero config &mdash; 15 directives included:</strong> Every directive listed above works out of the box in any <code>render()</code> template literal or external <code>templateUrl</code> file. No imports, no modules, no compiler plugins. Angular requires <code>CommonModule</code> and <code>FormsModule</code>. React has no directive concept &mdash; everything is JavaScript in JSX behind a mandatory build step.
        </div>
      </div>
    `;
  },

  // -----------------------------------------------------------------------
  // Reactivity
  // -----------------------------------------------------------------------
  _reactivityPanel() {
    return `
      <div class="cmp-section">
        <h3>Reactive Updates</h3>
        <p>React diffs an entire Virtual DOM tree on every render. Angular relies on zone.js change detection. zQuery uses <strong>ES Proxy-based reactivity</strong> &mdash; only the component whose state actually changed re-renders, and mutations are microtask-batched so rapid changes coalesce into a single DOM update.</p>

        <div class="cmp-meter-group">
          ${this._meter('Angular', 'Zone.js change detection &mdash; checks the entire tree', 60, '#c3002f')}
          ${this._meter('React',   'Virtual DOM diff &mdash; reconcile full subtree', 70, '#58a6ff')}
          ${this._meter('zQuery',  'Proxy-based &mdash; only the changed component re-renders', 90, '#e3b341')}
        </div>

        <h3 style="margin-top:1.5rem;">Signals (Fine-Grained Reactivity)</h3>
        <p>zQuery ships <code>$.signal</code>, <code>$.computed</code>, and <code>$.effect</code> for sub-component-level reactivity &mdash; similar to Solid.js or Angular 16+ signals, but included out of the box.</p>

        <div class="cmp-grid cmp-grid-3">
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#c3002f;">Angular (v16+)</div>
            <pre><code class="language-js">import { signal, computed, effect }
  from '@angular/core';

count = signal(0);
double = computed(() =&gt;
  this.count() * 2);

effect(() =&gt; {
  console.log(this.count());
});
// Angular-specific API</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#58a6ff;">React (hooks)</div>
            <pre><code class="language-js">const [count, setCount] = useState(0);
// Entire component re-renders on change

const double = useMemo(
  () =&gt; count * 2, [count]);

useEffect(() =&gt; {
  console.log(count);
}, [count]);
// Manual dependency array required</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#e3b341;">zQuery (signals)</div>
            <pre><code class="language-js">const count = $.signal(0);

const double = $.computed(() =&gt;
  count.value * 2);

$.effect(() =&gt; {
  console.log(count.value);
});
// Auto-tracked — no dep arrays
// .value for both reads &amp; writes</code></pre>
          </div>
        </div>

        <h3 style="margin-top:1.5rem;">Global Store</h3>
        <p>React needs Redux/Zustand/Context. Angular uses services + RxJS. zQuery ships a Redux-inspired store out of the box with reactive state, named actions, lazy getters, middleware, and key-specific subscriptions.</p>

        <div class="cmp-grid">
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#e3b341;">zQuery Store — Define</div>
            <pre><code class="language-js">const store = $.store({
  state: { count: 0, user: null },

  actions: {
    increment(state) { state.count++; },
    setUser(state, user) {
      state.user = user;
    }
  },

  getters: {
    double: s =&gt; s.count * 2,
    isLoggedIn: s =&gt; !!s.user
  },

  middleware: [
    (action, state, next) =&gt; {
      console.log('Action:', action);
      next();
    }
  ]
});</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#e3b341;">zQuery Store — Use</div>
            <pre><code class="language-js">// Dispatch actions
store.dispatch('increment');
store.dispatch('setUser', { name: 'Jo' });

// Read state &amp; getters
store.state.count;    // 1
store.getters.double; // 2 (lazy)

// Subscribe to specific keys
store.subscribe('count', val =&gt; {
  console.log('count changed:', val);
});

// Access from any component
this.store.state.count;</code></pre>
          </div>
        </div>

        <h3 style="margin-top:1.5rem;">Event Bus</h3>
        <p>For decoupled component-to-component messaging, zQuery includes a built-in pub/sub event bus &mdash; no external library or RxJS Subject required.</p>

        <div class="cmp-code-card" style="max-width:480px;">
          <div class="cmp-code-label" style="--accent:#e3b341;">$.bus</div>
          <pre><code class="language-js">// Subscribe
$.bus.on('notify', data =&gt; {
  console.log(data.message);
});

// One-time listener
$.bus.once('init', () =&gt; { ... });

// Emit from anywhere
$.bus.emit('notify', {
  message: 'Task complete'
});

// Clean up
$.bus.off('notify', handler);
$.bus.clear('notify');</code></pre>
        </div>

        <div class="cmp-callout" style="margin-top:1rem;">
          <strong>Three reactivity layers:</strong> zQuery gives you component-level Proxy reactivity for state, fine-grained signals for shared primitives, and a global store for app-wide state &mdash; all built-in, all working together.
        </div>
      </div>
    `;
  },

  // -----------------------------------------------------------------------
  // Native & Size
  // -----------------------------------------------------------------------
  _nativePanel() {
    return `
      <div class="cmp-section">
        <h3>How Native Is It?</h3>
        <p>One of zQuery&rsquo;s core design goals is to lean on the platform instead of replacing it. Here&rsquo;s how each framework scores on leveraging native browser APIs:</p>

        <div class="cmp-native-grid">

          <div class="cmp-native-card">
            <div class="cmp-native-header" style="--accent:#0769ad;">jQuery</div>
            <ul>
              <li><span class="cmp-yes">&#10003;</span> Direct DOM access</li>
              <li><span class="cmp-no">&#10007;</span> Custom Sizzle selector engine</li>
              <li><span class="cmp-no">&#10007;</span> Proprietary event system</li>
              <li><span class="cmp-no">&#10007;</span> No component model</li>
              <li><span class="cmp-meh">~</span> ESM added in v3.7+ (late)</li>
            </ul>
          </div>

          <div class="cmp-native-card">
            <div class="cmp-native-header" style="--accent:#c3002f;">Angular</div>
            <ul>
              <li><span class="cmp-no">&#10007;</span> Abstracted DOM (Renderer2)</li>
              <li><span class="cmp-no">&#10007;</span> Zone.js monkey-patches async APIs</li>
              <li><span class="cmp-yes">&#10003;</span> Module system (ES + NgModule)</li>
              <li><span class="cmp-yes">&#10003;</span> Custom elements support</li>
              <li><span class="cmp-no">&#10007;</span> Requires CLI &amp; TypeScript</li>
            </ul>
          </div>

          <div class="cmp-native-card">
            <div class="cmp-native-header" style="--accent:#58a6ff;">React</div>
            <ul>
              <li><span class="cmp-no">&#10007;</span> Virtual DOM layer</li>
              <li><span class="cmp-no">&#10007;</span> Synthetic event system</li>
              <li><span class="cmp-meh">~</span> JSX typical (not required)</li>
              <li><span class="cmp-meh">~</span> Third-party router / state</li>
              <li><span class="cmp-yes">&#10003;</span> ES modules (with bundler)</li>
            </ul>
          </div>

          <div class="cmp-native-card cmp-native-highlight">
            <div class="cmp-native-header" style="--accent:#e3b341;">zQuery</div>
            <ul>
              <li><span class="cmp-yes">&#10003;</span> Native <code>querySelectorAll</code></li>
              <li><span class="cmp-yes">&#10003;</span> Native <code>addEventListener</code></li>
              <li><span class="cmp-yes">&#10003;</span> ES modules out of the box</li>
              <li><span class="cmp-yes">&#10003;</span> Template literals &mdash; plain JS</li>
              <li><span class="cmp-yes">&#10003;</span> Native <code>fetch</code> for HTTP</li>
            </ul>
          </div>

        </div>

        <h3 style="margin-top:1.5rem;">Bundle Size Comparison</h3>
        <p>Minified production bundle size (core library only):</p>

        <div class="cmp-bars">
          ${this._bar('jQuery 3.x',  87,  150, '#0769ad')}
          ${this._bar('Angular 17+', 150, 150, '#c3002f')}
          ${this._bar('React + DOM', 44,  150, '#58a6ff')}
          ${this._bar('zQuery',      54,  150, '#e3b341')}
        </div>

        <h3 style="margin-top:1.5rem;">What Ships In That ~54 KB</h3>
        <p>Angular and React rarely ship alone. Routing, state management, and HTTP utilities are separate packages that add significant weight. Here&rsquo;s what zQuery includes in its single file:</p>

        <div style="overflow-x:auto;">
          <table class="cmp-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th><span class="cmp-lib" style="--accent:#0769ad;">jQuery</span></th>
                <th><span class="cmp-lib" style="--accent:#c3002f;">Angular</span></th>
                <th><span class="cmp-lib" style="--accent:#58a6ff;">React</span></th>
                <th class="cmp-zq-col"><span class="cmp-lib cmp-lib-zq">zQuery</span></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="cmp-label">Selectors &amp; DOM</td>
                <td>87 KB</td>
                <td>In core</td>
                <td>In core</td>
                <td class="cmp-zq-col" rowspan="8" style="vertical-align:middle;text-align:center;font-weight:600;color:#e3b341;font-size:1.1rem;">~54 KB<br><span style="font-size:0.75rem;font-weight:400;color:#8b949e;">all included</span></td>
              </tr>
              <tr>
                <td class="cmp-label">Components</td>
                <td><span class="cmp-no">&#10007;</span></td>
                <td>In core</td>
                <td>In core</td>
              </tr>
              <tr>
                <td class="cmp-label">Router</td>
                <td><span class="cmp-no">&#10007;</span></td>
                <td>+50 KB (@angular/router)</td>
                <td>+20 KB (react-router)</td>
              </tr>
              <tr>
                <td class="cmp-label">State Manager</td>
                <td><span class="cmp-no">&#10007;</span></td>
                <td>+30 KB (NgRx) or RxJS</td>
                <td>+15 KB (Redux/Zustand)</td>
              </tr>
              <tr>
                <td class="cmp-label">HTTP Client</td>
                <td>In core ($.ajax)</td>
                <td>+12 KB (HttpClientModule)</td>
                <td>+14 KB (axios) or manual fetch</td>
              </tr>
              <tr>
                <td class="cmp-label">Signals</td>
                <td><span class="cmp-no">&#10007;</span></td>
                <td>In core (v16+)</td>
                <td><span class="cmp-no">&#10007;</span></td>
              </tr>
              <tr>
                <td class="cmp-label">Event Bus</td>
                <td><span class="cmp-no">&#10007;</span></td>
                <td>RxJS Subject</td>
                <td><span class="cmp-no">&#10007;</span></td>
              </tr>
              <tr>
                <td class="cmp-label">Directives</td>
                <td><span class="cmp-no">&#10007;</span></td>
                <td>In core</td>
                <td><span class="cmp-no">&#10007;</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 style="margin-top:1.5rem;">Utility Toolkit</h3>
        <p>Also included in that ~54 KB &mdash; general-purpose helpers that would otherwise need separate packages:</p>

        <div class="cmp-grid">
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#e3b341;">Functional Helpers</div>
            <pre><code class="language-js">$.debounce(fn, 300)
$.throttle(fn, 100)
$.pipe(fn1, fn2, fn3)
$.once(fn)
await $.sleep(1000)

$.deepClone(obj)
$.deepMerge(target, source)
$.isEqual(a, b)</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#e3b341;">Storage &amp; Encoding</div>
            <pre><code class="language-js">// JSON-aware storage wrappers
$.storage.set('key', { nested: true })
$.storage.get('key') // → object
$.session.set('tmp', value)

$.escapeHtml('&lt;script&gt;')
$.param({ a: 1, b: 2 }) // → 'a=1&amp;b=2'
$.parseQuery('?a=1')     // → { a: '1' }
$.uuid()</code></pre>
          </div>
        </div>

        <div class="cmp-callout" style="margin-top:1rem;">
          <strong>Real-world comparison:</strong> A typical React app with react-router + Redux + axios ships ~120 KB+ of library code before your first line of application JS. zQuery covers all of that in ~54 KB &mdash; and it works without a build step.
        </div>
      </div>
    `;
  },

  // -----------------------------------------------------------------------
  // Verdict
  // -----------------------------------------------------------------------
  _verdict() {
    return `
      <div class="card" style="padding:1.5rem;margin-top:0;">
        <h2 style="margin-bottom:1rem;">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#e3b341" style="width:22px;height:22px;vertical-align:-4px;margin-right:0.35rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          The Bottom Line
        </h2>
        <div class="cmp-verdict-grid">
          ${this._verdictCard('jQuery', 'The API that made DOM manipulation easy &mdash; and zQuery keeps that exact <code>$()</code> feel with 57+ chainable methods. The difference: zQuery also gives you reactive components, an SPA router, a state store, signals, and an event bus. If you know jQuery, you already know half of zQuery &mdash; the rest is just the modern tooling jQuery never added.')}
          ${this._verdictCard('Angular', 'A powerful enterprise framework with deep TypeScript integration and a rich CLI. The trade-off: a steeper learning curve, RxJS as a hard dependency, and a module system to manage before writing your first component. zQuery offers components with scoped styles, 15 template directives, a full SPA router, reactive state, and an HTTP client &mdash; all approachable enough to ship a feature on day one.')}
          ${this._verdictCard('React', 'An excellent component model backed by the largest ecosystem in frontend. But React is intentionally just a view layer &mdash; routing, state, and HTTP are all third-party choices you have to pick, install, and keep in sync. zQuery ships all of that batteries-included, so there are no compatibility decisions and no dependency chains to untangle on upgrade day.')}
        </div>
      </div>
    `;
  },

  _verdictCard(name, text) {
    const colors = { jQuery: '#0769ad', Angular: '#c3002f', React: '#58a6ff' };
    return `
      <div style="padding:1rem;background:#0d1117;border:1px solid #21262d;border-radius:8px;border-top:3px solid ${colors[name] || '#30363d'};">
        <div style="font-weight:600;color:#f0f6fc;margin-bottom:0.5rem;">vs ${name}</div>
        <div style="color:#8b949e;font-size:0.85rem;line-height:1.6;">${text}</div>
      </div>
    `;
  },

  // -----------------------------------------------------------------------
  // UI helpers
  // -----------------------------------------------------------------------
  _meter(label, desc, pct, color) {
    return `
      <div class="cmp-meter">
        <div class="cmp-meter-head">
          <span style="font-weight:600;color:#f0f6fc;">${label}</span>
          <span style="font-size:0.8rem;color:#8b949e;">${desc}</span>
        </div>
        <div class="cmp-meter-track">
          <div class="cmp-meter-fill" style="width:${pct}%;background:${color};"></div>
        </div>
      </div>
    `;
  },

  _bar(label, size, max, color) {
    const pct = Math.round((size / max) * 100);
    return `
      <div class="cmp-bar-row">
        <span class="cmp-bar-label">${label}</span>
        <div class="cmp-bar-track">
          <div class="cmp-bar-fill" style="width:${pct}%;background:${color};"></div>
        </div>
        <span class="cmp-bar-size">${size} KB</span>
      </div>
    `;
  },

  // -----------------------------------------------------------------------
  // Scoped styles
  // -----------------------------------------------------------------------
  styles: `
    /* Tabs — wrapping pill layout */
    .cmp-tab-bar { display:flex; flex-wrap:wrap; gap:6px; padding:0.6rem; background:#0d1117; border-bottom:1px solid #21262d; }
    .cmp-tab { background:#161b22; color:#8b949e; border:1px solid #30363d; padding:0.45rem 0.9rem; font-size:0.8rem; font-weight:500; cursor:pointer; border-radius:6px; white-space:nowrap; transition: color .15s, background .15s, border-color .15s; }
    .cmp-tab:hover { color:#f0f6fc; background:#1c2129; border-color:#484f58; }
    .cmp-tab.active { color:#58a6ff; background:#58a6ff14; border-color:#58a6ff66; }

    .cmp-tab-body { padding:1.5rem; overflow:hidden; }

    /* Section text */
    .cmp-section h3 { color:#f0f6fc; margin-bottom:0.5rem; }
    .cmp-section p  { color:#8b949e; line-height:1.6; margin-bottom:1rem; }

    /* Comparison table */
    .cmp-table { width:100%; border-collapse:collapse; font-size:0.85rem; }
    .cmp-table th, .cmp-table td { padding:0.6rem 0.9rem; border-bottom:1px solid #21262d; text-align:left; }
    .cmp-table thead th { background:#0d1117; color:#8b949e; font-weight:500; position:sticky; top:0; }
    .cmp-table tbody td { color:#c9d1d9; }
    .cmp-table .cmp-label { color:#8b949e; font-weight:500; white-space:nowrap; }

    /* Scrollable wrappers (tables, etc.) */
    .cmp-section [style*="overflow-x"], .cmp-tab-body > div > [style*="overflow-x"] { scrollbar-width:thin; scrollbar-color:#30363d transparent; }
    .cmp-section [style*="overflow-x"]::-webkit-scrollbar, .cmp-tab-body > div > [style*="overflow-x"]::-webkit-scrollbar { height:4px; }
    .cmp-section [style*="overflow-x"]::-webkit-scrollbar-track, .cmp-tab-body > div > [style*="overflow-x"]::-webkit-scrollbar-track { background:transparent; }
    .cmp-section [style*="overflow-x"]::-webkit-scrollbar-thumb, .cmp-tab-body > div > [style*="overflow-x"]::-webkit-scrollbar-thumb { background:#30363d; border-radius:4px; }
    .cmp-section [style*="overflow-x"]::-webkit-scrollbar-thumb:hover, .cmp-tab-body > div > [style*="overflow-x"]::-webkit-scrollbar-thumb:hover { background:#484f58; }
    .cmp-lib { display:inline-block; padding:0.15rem 0.55rem; border-radius:4px; font-size:0.8rem; font-weight:600; background: color-mix(in srgb, var(--accent) 18%, transparent); color:var(--accent); }
    .cmp-lib-zq { --accent:#e3b341; font-size:0.85rem; padding:0.2rem 0.7rem; background:linear-gradient(135deg,#e3b341,#d29922); color:#0d1117; box-shadow:0 0 6px #e3b34144; }

    /* Highlighted zQuery column */
    .cmp-zq-col { background:#e3b34110; border-left:2px solid #e3b34144; }
    .cmp-table thead .cmp-zq-col { background:#e3b34118; }

    /* Code comparison grid */
    .cmp-grid   { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr)); gap:0.75rem; margin-bottom:1rem; overflow:hidden; }
    .cmp-grid-3 { grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr)); }
    .cmp-code-card { background:#0d1117; border:1px solid #21262d; border-radius:8px; overflow:hidden; min-width:0; max-width:100%; }
    .cmp-code-card { display:flex; flex-direction:column; }
    .cmp-code-card pre { margin:0; padding:0.75rem 1rem !important; font-size:0.8rem; background:transparent !important; overflow-x:auto; overflow-y:auto; min-width:0; max-width:100%; max-height:420px; }
    .cmp-code-card pre::-webkit-scrollbar { height:6px; width:6px; }
    .cmp-code-card pre::-webkit-scrollbar-track { background:#161b22; }
    .cmp-code-card pre::-webkit-scrollbar-thumb { background:#30363d; border-radius:4px; }
    .cmp-code-card pre::-webkit-scrollbar-thumb:hover { background:#484f58; }
    .cmp-code-card pre { scrollbar-width:thin; scrollbar-color:#30363d #161b22; }
    .cmp-code-label { padding:0.4rem 0.75rem; font-size:0.75rem; font-weight:600; background: color-mix(in srgb, var(--accent) 12%, #0d1117); color:var(--accent); border-bottom:1px solid #21262d; }

    /* Prism overrides inside compare cards */
    .cmp-code-card pre[class*="language-"],
    .cmp-code-card :not(pre) > code[class*="language-"] { background:transparent !important; border:none; margin:0; padding:0.75rem 1rem; text-shadow:none; }
    .cmp-code-card code[class*="language-"] { text-shadow:none; font-size:0.8rem; line-height:1.5; display:block; }
    .cmp-code-card div.code-toolbar { margin-bottom:0; overflow:hidden; min-width:0; max-width:100%; }
    .cmp-code-card .code-toolbar > .toolbar { display:none; }

    /* Callout */
    .cmp-callout { background:#0d1117; border-left:3px solid #58a6ff; padding:0.75rem 1rem; border-radius:0 6px 6px 0; font-size:0.85rem; color:#8b949e; line-height:1.6; }
    .cmp-callout strong { color:#c9d1d9; }
    .cmp-callout code { background:#21262d; padding:0.1rem 0.3rem; border-radius:4px; color:#79c0ff; font-size:0.82em; }

    /* Meter bars (reactivity panel) */
    .cmp-meter-group { display:flex; flex-direction:column; gap:0.75rem; }
    .cmp-meter-head  { display:flex; justify-content:space-between; align-items:baseline; gap:0.75rem; flex-wrap:wrap; margin-bottom:0.3rem; }
    .cmp-meter-head code { background:#21262d; padding:0.1rem 0.3rem; border-radius:4px; color:#79c0ff; font-size:0.82em; }
    .cmp-meter-track { height:8px; background:#21262d; border-radius:4px; overflow:hidden; }
    .cmp-meter-fill  { height:100%; border-radius:4px; transition:width .4s ease; }

    /* Size bar chart */
    .cmp-bars { display:flex; flex-direction:column; gap:0.5rem; }
    .cmp-bar-row   { display:flex; align-items:center; gap:0.75rem; }
    .cmp-bar-label { width:100px; text-align:right; font-size:0.82rem; color:#8b949e; flex-shrink:0; }
    .cmp-bar-track { flex:1; height:22px; background:#21262d; border-radius:4px; overflow:hidden; }
    .cmp-bar-fill  { height:100%; border-radius:4px; transition:width .4s ease; }
    .cmp-bar-size  { width:55px; font-size:0.82rem; color:#c9d1d9; font-variant-numeric:tabular-nums; }

    /* Native grid */
    .cmp-native-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(250px,100%),1fr)); gap:0.75rem; margin-bottom:1rem; }
    .cmp-native-card { background:#0d1117; border:1px solid #21262d; border-radius:8px; overflow:hidden; }
    .cmp-native-card ul { list-style:none; padding:0.6rem 0.75rem; margin:0; font-size:0.82rem; }
    .cmp-native-card li { padding:0.3rem 0; color:#c9d1d9; display:flex; gap:0.5rem; align-items:baseline; }
    .cmp-native-card code { background:#21262d; padding:0.1rem 0.3rem; border-radius:4px; color:#79c0ff; font-size:0.9em; }
    .cmp-native-header { padding:0.5rem 0.75rem; font-size:0.82rem; font-weight:600; background: color-mix(in srgb, var(--accent) 12%, #0d1117); color:var(--accent); border-bottom:1px solid #21262d; }
    .cmp-native-highlight { border-color:#e3b341; box-shadow:0 0 0 1px #e3b34144; }

    /* Verdict grid */
    .cmp-verdict-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr)); gap:0.75rem; }
    .cmp-yes  { color:#3fb950; font-weight:700; }
    .cmp-no   { color:#f85149; font-weight:700; }
    .cmp-meh  { color:#d29922; font-weight:700; }

    @media (max-width: 768px) {
      .cmp-tab-body { padding:1rem; }
      .cmp-grid, .cmp-grid-3 { grid-template-columns:1fr; gap:1rem; }
      .cmp-native-grid { grid-template-columns:1fr 1fr; }
      .cmp-verdict-grid { grid-template-columns:1fr; }
      .cmp-bar-label { width:75px; font-size:0.75rem; }
      .cmp-table { font-size:0.78rem; }
      .cmp-table th, .cmp-table td { padding:0.45rem 0.5rem; }
      .cmp-code-card pre { font-size:0.74rem; padding:0.6rem 0.75rem !important; -webkit-overflow-scrolling:touch; }
    }
    @media (max-width: 480px) {
      .cmp-tab { font-size:0.72rem; padding:0.4rem 0.6rem; }
      .cmp-native-grid { grid-template-columns:1fr; }
    }
  `,
});
