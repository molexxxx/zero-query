$.component('compare-page', {
  state: {
    activeTab: 'overview',
  },

  // -----------------------------------------------------------------------
  // render
  // -----------------------------------------------------------------------
  render() {
    const t = this.state.activeTab;

    const tabs = [
      { id: 'overview',    label: 'Overview' },
      { id: 'selectors',   label: 'Selectors & DOM' },
      { id: 'components',  label: 'Components' },
      { id: 'directives',  label: 'Directives' },
      { id: 'reactivity',  label: 'Reactivity' },
      { id: 'native',      label: 'Native & Size' },
    ];

    const tabBar = tabs.map(tb =>
      `<button class="${tb.id === t ? 'cmp-tab active' : 'cmp-tab'}" @click="switchTab" data-tab="${tb.id}">${tb.label}</button>`
    ).join('');

    return `
      <div>
        ${this._hero()}

        <div class="card" style="padding:0;overflow:hidden;">
          <div class="cmp-tab-bar">${tabBar}</div>
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
      ['First Release',           '2006',           '2016',           '2013',           '2026'],
      ['Bundle Size (min)',       '~87 KB',         '~150 KB+',      '~44 KB (+ DOM)', '~54 KB'],
      ['Dependencies',            '0',              '5+ (RxJS&hellip;)',    '0 (core)',  '0'],
      ['Build Step Required',     'No',             'Yes (CLI)',      'Typical (JSX)',  'Optional (CLI)'],
      ['Component Model',         'No',             'Yes',            'Yes',            'Yes'],
      ['Router Built-In',         'No',             'Yes',            'No (react-router)', 'Yes'],
      ['State Management',        'No',             'Services/RxJS',  'Context / ext.', 'Yes (store)'],
      ['HTTP Client',             '$.ajax',         'HttpClient',     'No (fetch/ext.)','Yes ($.http)'],
      ['Two-Way Binding',         'Manual',         'Yes (ngModel)',  'Controlled inputs','Yes (z-model)'],
      ['Built-in Directives',     'No',             'Yes (15+)',      'No (JSX only)',   'Yes (15+)'],
      ['TypeScript',              'DefinitelyTyped','First-class',    'First-class',    'Bundled d.ts'],
    ];

    return `
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
    `;
  },

  // -----------------------------------------------------------------------
  // Selectors & DOM
  // -----------------------------------------------------------------------
  _selectorsPanel() {
    return `
      <div class="cmp-section">
        <h3>Selector Performance &amp; Approach</h3>
        <p>Both jQuery and zQuery support full chaining. The key difference is <em>under the hood</em>: jQuery bundles a custom Sizzle selector engine and wraps results in heavyweight jQuery objects. zQuery delegates straight to the browser&rsquo;s native <code>querySelectorAll</code> with a thin wrapper &mdash; fewer allocations, zero parsing overhead, and automatic performance gains from browser updates.</p>

        <div class="cmp-grid">
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#0769ad;">jQuery</div>
            <pre><code class="language-js">// Custom Sizzle engine → jQuery object wrapper
$('.items li').addClass('active')
              .css('color', 'red');
// Chaining works, but every call re-wraps
// results in a heavy jQuery object</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#e3b341;">zQuery</div>
            <pre><code class="language-js">// Native querySelectorAll → thin wrapper
$('.items li').addClass('active')
              .css('color', 'red');
// Same chaining, but backed by the browser's
// own optimised selector engine</code></pre>
          </div>
        </div>

        <div class="cmp-callout">
          <strong>Key difference:</strong> Modern browsers have highly optimised <code>querySelectorAll</code>. By delegating to the native engine instead of maintaining a custom selector parser, zQuery gets O(0) maintenance overhead and automatic performance gains from browser updates.
        </div>

        <h3 style="margin-top:1.5rem;">DOM Manipulation</h3>
        <div class="cmp-grid">
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#58a6ff;">React</div>
            <pre><code class="language-js">// React: indirect via Virtual DOM diffing
function App() {
  return &lt;div className="box"&gt;Hello&lt;/div&gt;;
}
// Must go through reconciler to touch DOM</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#e3b341;">zQuery</div>
            <pre><code class="language-js">// zQuery: direct native DOM access
$('.box').html('Hello')
         .addClass('visible')
         .on('click', handler);
// Real DOM — no abstraction layer</code></pre>
          </div>
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
        <p>Each framework has its own component model. Angular uses decorated classes with a module system. React uses functions or classes with JSX. zQuery takes a single-call approach &mdash; one function, one options object, plain JavaScript.</p>

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
      &lt;button z-on:click="inc"&gt;
        +
      &lt;/button&gt;
    \`;
  },
  inc() { this.state.count++; }
});</code></pre>
          </div>
        </div>

        <div class="cmp-callout">
          <strong>Native templates:</strong> zQuery components use native ES template literals instead of a custom template syntax. Your browser runs the code you wrote, which means faster iteration and easier debugging via DevTools.
        </div>

        <h3 style="margin-top:1.5rem;">Lifecycle Hooks</h3>
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

        <div class="cmp-callout">
          <strong>Simple hooks:</strong> zQuery provides four clear lifecycle hooks that map to the natural lifecycle of a DOM element — no decorator metadata, no dependency-injected abstract classes, and no hook-ordering rules to memorize.
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
        <p>Angular pioneered template directives. React chose JSX expressions instead. zQuery brings a familiar directive syntax that works in plain HTML template literals &mdash; just write and run.</p>

        <h3 style="margin-top:1.5rem;">Conditional Rendering</h3>
        <div class="cmp-grid cmp-grid-3">
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#c3002f;">Angular</div>
            <pre><code class="language-html">&lt;div *ngIf="show; else other"&gt;
  Visible
&lt;/div&gt;
&lt;ng-template #other&gt;
  Hidden
&lt;/ng-template&gt;</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#58a6ff;">React</div>
            <pre><code class="language-js">{show
  ? &lt;div&gt;Visible&lt;/div&gt;
  : &lt;div&gt;Hidden&lt;/div&gt;
}</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#e3b341;">zQuery</div>
            <pre><code class="language-html">&lt;div z-if="show"&gt;Visible&lt;/div&gt;
&lt;div z-else&gt;Hidden&lt;/div&gt;

&lt;!-- Also: z-else-if="cond" --&gt;
&lt;div z-show="open"&gt;Toggle&lt;/div&gt;</code></pre>
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
            <pre><code class="language-html">&lt;li z-for="item in items"&gt;
  {{$index}}: {{item.name}}
&lt;/li&gt;
&lt;!-- $index auto-provided --&gt;</code></pre>
          </div>
        </div>

        <h3 style="margin-top:1.5rem;">Event Handling</h3>
        <div class="cmp-grid cmp-grid-3">
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#c3002f;">Angular</div>
            <pre><code class="language-html">&lt;button (click)="save()"&gt;
&lt;input (keyup.enter)="submit()"&gt;
&lt;form (submit)="onSubmit($event)"&gt;
&lt;!-- No built-in debounce --&gt;</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#58a6ff;">React</div>
            <pre><code class="language-js">&lt;button onClick={save}&gt;
&lt;input onKeyUp={handleKey} /&gt;
&lt;form onSubmit={onSubmit}&gt;
{/* No built-in debounce */}</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#e3b341;">zQuery</div>
            <pre><code class="language-html">&lt;!-- @ or z-on: — identical --&gt;
&lt;button @click="save"&gt;
&lt;button z-on:click="save"&gt;

&lt;!-- Built-in modifiers --&gt;
&lt;form @submit.prevent="onSubmit"&gt;
&lt;button @click.once="init"&gt;
&lt;input @input.debounce.300="search"&gt;
&lt;div @scroll.throttle.100="onScroll"&gt;</code></pre>
          </div>
        </div>

        <h3 style="margin-top:1.5rem;">Data Binding</h3>
        <div class="cmp-grid cmp-grid-3">
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#c3002f;">Angular</div>
            <pre><code class="language-html">&lt;input [(ngModel)]="name"&gt;
&lt;div [ngClass]="{active: on}"&gt;
&lt;div [ngStyle]="{color: c}"&gt;
&lt;a [href]="url"&gt;
&lt;!-- Requires FormsModule --&gt;</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#58a6ff;">React</div>
            <pre><code class="language-js">&lt;input value={name}
  onChange={e =&gt; setName(
    e.target.value)} /&gt;
&lt;div className={on?'active':''}&gt;
&lt;div style={{color: c}}&gt;
&lt;a href={url}&gt;</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#e3b341;">zQuery</div>
            <pre><code class="language-html">&lt;input z-model="name"&gt;
&lt;div z-class="{active: on}"&gt;
&lt;div z-style="{color: c}"&gt;
&lt;a :href="url"&gt;
&lt;span z-text="label"&gt;
&lt;div z-html="richContent"&gt;</code></pre>
          </div>
        </div>

        <h3 style="margin-top:1.5rem;">Event Modifiers at a Glance</h3>
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
              <tr><td class="cmp-label">.debounce.ms</td><td><span class="cmp-no">&#10007;</span></td><td><span class="cmp-no">&#10007;</span></td><td class="cmp-zq-col"><span class="cmp-yes">&#10003;</span> Built-in</td></tr>
              <tr><td class="cmp-label">.throttle.ms</td><td><span class="cmp-no">&#10007;</span></td><td><span class="cmp-no">&#10007;</span></td><td class="cmp-zq-col"><span class="cmp-yes">&#10003;</span> Built-in</td></tr>
            </tbody>
          </table>
        </div>

        <div class="cmp-callout" style="margin-top:1rem;">
          <strong>No imports needed:</strong> zQuery directives work out of the box in any <code>render()</code> template literal or external <code>templateUrl</code> file. Angular requires importing <code>CommonModule</code> and <code>FormsModule</code>. React has no directive concept — everything is JavaScript expressions in JSX that require a build step.
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
        <p>React diffs an entire Virtual DOM tree on every render. Angular relies on zone.js change detection. zQuery uses <strong>ES Proxy-based reactivity</strong> &mdash; only the component whose state actually changed re-renders.</p>

        <div class="cmp-meter-group">
          ${this._meter('Angular', 'Zone.js change detection &mdash; checks the entire tree', 60, '#c3002f')}
          ${this._meter('React',   'Virtual DOM diff &mdash; reconcile full subtree', 70, '#58a6ff')}
          ${this._meter('zQuery',  'Proxy-based &mdash; only the changed component re-renders', 90, '#e3b341')}
        </div>

        <h3 style="margin-top:1.5rem;">Signals (Fine-Grained)</h3>
        <p>zQuery ships signals (<code>$.signal</code>, <code>$.computed</code>, <code>$.effect</code>) for sub-component granularity &mdash; similar to Solid.js or Angular 16+ signals, but built-in and ready to use with zero configuration.</p>

        <div class="cmp-grid">
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#58a6ff;">React (hooks)</div>
            <pre><code class="language-js">const [count, setCount] = useState(0);
// Entire component re-renders on change
useEffect(() => {
  document.title = \`Count: \${count}\`;
}, [count]);
// Manual dependency array</code></pre>
          </div>
          <div class="cmp-code-card">
            <div class="cmp-code-label" style="--accent:#e3b341;">zQuery (signals)</div>
            <pre><code class="language-js">const count = $.signal(0);
// Auto-tracked — no dep arrays
$.effect(() => {
  document.title = \`Count: \${count.value}\`;
});
// Just works™ — .value reads &amp; writes</code></pre>
          </div>
        </div>

        <h3 style="margin-top:1.5rem;">Global Store</h3>
        <p>React needs Redux/Zustand/Context. Angular uses services + RxJS. zQuery ships a Redux-inspired store out of the box with <code>$.store</code>.</p>

        <div class="cmp-code-card" style="max-width:480px;">
          <div class="cmp-code-label" style="--accent:#e3b341;">zQuery Store</div>
          <pre><code class="language-js">const store = $.store({
  state:   { count: 0 },
  actions: {
    increment(state) { state.count++; }
  },
  getters: {
    double: s =&gt; s.count * 2
  }
});

store.dispatch('increment');
store.subscribe('count', val =&gt;
  console.log(val));</code></pre>
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
              <li><span class="cmp-no">&#10007;</span> No ES module support</li>
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
              <li><span class="cmp-yes">&#10003;</span> Optional CLI bundler for production</li>
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

        <div class="cmp-callout" style="margin-top:1rem;">
          <strong>Real-world note:</strong> Angular and React rarely ship alone &mdash; routing, state management, and HTTP utilities add significantly more weight. zQuery bundles <strong>all of those</strong> in its ~54 KB core.
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
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:0.75rem;">
          ${this._verdictCard('jQuery', 'Great for simple DOM tasks, but no component model, no reactivity, no router. Still useful — zQuery just gives you all that <em>and</em> the familiar <code>$()</code> API.')}
          ${this._verdictCard('Angular', 'Full-featured enterprise framework. Powerful but heavyweight — requires TypeScript, a CLI, and significant learning curve. zQuery covers 90% of the same surface in ~54 KB with zero setup.')}
          ${this._verdictCard('React', 'Excellent ecosystem and component model, but you need a router package, a state library, and an HTTP library separately. zQuery ships everything batteries-included out of the box.')}
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
    /* Tabs */
    .cmp-tab-bar { display:flex; gap:0; overflow-x:auto; background:#161b22; border-bottom:1px solid #30363d; padding:0 0.5rem; }
    .cmp-tab { background:none; color:#8b949e; border:none; padding:0.75rem 1.1rem; font-size:0.85rem; font-weight:500; cursor:pointer; border-bottom:2px solid transparent; border-radius:0; white-space:nowrap; transition: color .15s, border-color .15s; }
    .cmp-tab:hover { color:#f0f6fc; background:none; }
    .cmp-tab.active { color:#58a6ff; border-bottom-color:#58a6ff; background:none; }

    .cmp-tab-body { padding:1.5rem; }

    /* Section text */
    .cmp-section h3 { color:#f0f6fc; margin-bottom:0.5rem; }
    .cmp-section p  { color:#8b949e; line-height:1.6; margin-bottom:1rem; }

    /* Comparison table */
    .cmp-table { width:100%; border-collapse:collapse; font-size:0.85rem; }
    .cmp-table th, .cmp-table td { padding:0.6rem 0.9rem; border-bottom:1px solid #21262d; text-align:left; }
    .cmp-table thead th { background:#0d1117; color:#8b949e; font-weight:500; position:sticky; top:0; }
    .cmp-table tbody td { color:#c9d1d9; }
    .cmp-table .cmp-label { color:#8b949e; font-weight:500; white-space:nowrap; }
    .cmp-lib { display:inline-block; padding:0.15rem 0.55rem; border-radius:4px; font-size:0.8rem; font-weight:600; background: color-mix(in srgb, var(--accent) 18%, transparent); color:var(--accent); }
    .cmp-lib-zq { --accent:#e3b341; font-size:0.85rem; padding:0.2rem 0.7rem; background:linear-gradient(135deg,#e3b341,#d29922); color:#0d1117; box-shadow:0 0 6px #e3b34144; }

    /* Highlighted zQuery column */
    .cmp-zq-col { background:#e3b34110; border-left:2px solid #e3b34144; }
    .cmp-table thead .cmp-zq-col { background:#e3b34118; }

    /* Code comparison grid */
    .cmp-grid   { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:0.75rem; margin-bottom:1rem; }
    .cmp-grid-3 { grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); }
    .cmp-code-card { background:#0d1117; border:1px solid #21262d; border-radius:8px; overflow:hidden; }
    .cmp-code-card pre { margin:0; padding:0.75rem 1rem !important; font-size:0.8rem; background:transparent !important; }
    .cmp-code-label { padding:0.4rem 0.75rem; font-size:0.75rem; font-weight:600; background: color-mix(in srgb, var(--accent) 12%, #0d1117); color:var(--accent); border-bottom:1px solid #21262d; }

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
    .cmp-native-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:0.75rem; margin-bottom:1rem; }
    .cmp-native-card { background:#0d1117; border:1px solid #21262d; border-radius:8px; overflow:hidden; }
    .cmp-native-card ul { list-style:none; padding:0.6rem 0.75rem; margin:0; font-size:0.82rem; }
    .cmp-native-card li { padding:0.3rem 0; color:#c9d1d9; display:flex; gap:0.5rem; align-items:baseline; }
    .cmp-native-card code { background:#21262d; padding:0.1rem 0.3rem; border-radius:4px; color:#79c0ff; font-size:0.9em; }
    .cmp-native-header { padding:0.5rem 0.75rem; font-size:0.82rem; font-weight:600; background: color-mix(in srgb, var(--accent) 12%, #0d1117); color:var(--accent); border-bottom:1px solid #21262d; }
    .cmp-native-highlight { border-color:#e3b341; box-shadow:0 0 0 1px #e3b34144; }
    .cmp-yes  { color:#3fb950; font-weight:700; }
    .cmp-no   { color:#f85149; font-weight:700; }
    .cmp-meh  { color:#d29922; font-weight:700; }

    @media (max-width: 768px) {
      .cmp-tab-bar { padding:0 0.25rem; }
      .cmp-tab { padding:0.6rem 0.7rem; font-size:0.78rem; }
      .cmp-tab-body { padding:1rem; }
      .cmp-grid, .cmp-grid-3 { grid-template-columns:1fr; }
      .cmp-native-grid { grid-template-columns:1fr 1fr; }
      .cmp-bar-label { width:75px; font-size:0.75rem; }
      .cmp-table { font-size:0.78rem; }
      .cmp-table th, .cmp-table td { padding:0.45rem 0.5rem; }
    }
    @media (max-width: 480px) {
      .cmp-native-grid { grid-template-columns:1fr; }
    }
  `,
});
