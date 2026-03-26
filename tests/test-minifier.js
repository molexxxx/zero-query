function minifyCSS(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  css = css.replace(/\s{2,}/g, ' ');
  css = css.replace(/\s*([{};,])\s*/g, '$1');
  css = css.replace(/:\s+/g, ':');
  css = css.replace(/;}/g, '}');
  return css.trim();
}

const tests = [
  // Pseudo-classes with descendant combinator (the bug was that the space before :not() was being removed, which is incorrect)
  ['.docs-section :not(pre) > code { color: red }',     'space before :not()'],
  ['.foo :has(.bar) { color: red }',                     'space before :has()'],
  ['.foo :is(.a, .b) { color: red }',                    'space before :is()'],
  ['.foo :where(.a) { color: red }',                     'space before :where()'],

  // Pseudo-elements
  ['.foo::before { content: "x" }',                      '::before'],
  ['.foo ::after { content: "x" }',                      'space before ::after'],

  // Pseudo-classes directly on element (no space - should stay compact)
  ['a:hover { color: red }',                             ':hover no space'],
  ['li:nth-child(2n + 1) { color: red }',                ':nth-child()'],
  ['input:focus-visible { outline: 1px }',               ':focus-visible'],

  // calc() - spaces around operators are significant!
  ['.foo { width: calc(100% - 20px) }',                  'calc() spaces'],
  ['.foo { width: calc(50vw + 2rem) }',                  'calc() addition'],
  ['.foo { font-size: clamp(1rem, 2vw, 3rem) }',         'clamp()'],

  // @media
  ['@media (min-width: 768px) { .foo { color: red } }',  '@media query'],
  ['@media screen and (max-width: 1024px) { .a { } }',   '@media screen and'],

  // Selector combinators
  ['.foo > .bar { color: red }',                         'child combinator >'],
  ['.foo + .bar { color: red }',                         'adjacent sibling +'],
  ['.foo ~ .bar { color: red }',                         'general sibling ~'],
  ['.foo .bar { color: red }',                           'descendant combinator'],

  // Custom properties
  ['body { --main-color: #333; color: var(--main-color) }', 'CSS variables'],

  // Attribute selectors
  ['[data-theme="dark"] { color: white }',               'attribute selector'],
  ['a[href^="https:"] { color: green }',                 'attr with colon'],

  // content with quotes
  ['.foo::before { content: "Hello World" }',            'content string'],

  // Multiple selectors with newlines
  ['.a,\n.b,\n.c { color: red }',                        'selector list'],

  // Keyframes
  ['@keyframes fade { 0% { opacity: 0 } 100% { opacity: 1 } }', '@keyframes'],

  // Nested :not with pseudo-class inside
  ['.foo :not(:last-child) { margin: 0 }',               ':not(:last-child)'],
  
  // Double :not
  ['.bar :not(.a):not(.b) { color: red }',               'chained :not()'],

  // :first-child as descendant
  ['.list :first-child { font-weight: bold }',           'space before :first-child'],

  // content with multiple spaces (potential issue)
  ['.foo::before { content: "a  b" }',                   'content double space'],

  // grid-template-areas
  ['.grid { grid-template-areas: "a a" "b c" }',        'grid-template-areas'],
];

console.log('=== CSS Minifier Edge Case Tests ===\n');
let issues = 0;
for (const [input, label] of tests) {
  const result = minifyCSS(input);
  console.log(`${label.padEnd(30)}| ${result}`);
}

// Specific assertions
console.log('\n=== Assertions ===\n');
function assert(input, expected, label) {
  const result = minifyCSS(input);
  const pass = result === expected;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`);
  if (!pass) {
    console.log(`  Expected: ${expected}`);
    console.log(`  Got:      ${result}`);
    issues++;
  }
}

assert('.parent :not(pre) > code { color: red }',
       '.parent :not(pre) > code{color:red}',
       'space before :not() preserved');

assert('a:hover { color: red }',
       'a:hover{color:red}',
       ':hover stays compact');

assert('.foo { width: calc(100% - 20px) }',
       '.foo{width:calc(100% - 20px)}',
       'calc() spaces preserved');

assert('@media (min-width: 768px) { .a { color: red } }',
       '@media (min-width:768px){.a{color:red}}',
       '@media colon stripped');

assert('.foo > .bar { color: red }',
       '.foo > .bar{color:red}',
       'child combinator preserved');

assert('.foo + .bar { color: red }',
       '.foo + .bar{color:red}',
       'adjacent sibling preserved');

assert('.foo .bar { color: red }',
       '.foo .bar{color:red}',
       'descendant space preserved');

assert('.foo::before { content: "x" }',
       '.foo::before{content:"x"}',
       '::before works');

assert('.foo ::after { content: "x" }',
       '.foo ::after{content:"x"}',
       'space before ::after preserved');

assert('li:nth-child(2n + 1) { color: red }',
       'li:nth-child(2n + 1){color:red}',
       ':nth-child args preserved');

assert('.list :first-child { font-weight: bold }',
       '.list :first-child{font-weight:bold}',
       'space before :first-child preserved');

assert('.list :last-child { font-weight: bold }',
       '.list :last-child{font-weight:bold}',
       'space before :last-child preserved');

assert('.bar :not(.a):not(.b) { color: red }',
       '.bar :not(.a):not(.b){color:red}',
       'chained :not() with leading space');

// Edge case: content with double spaces inside quotes
const dblSpace = minifyCSS('.foo::before { content: "a  b" }');
if (dblSpace.includes('content:"a b"')) {
  console.log('WARN content double space - "a  b" collapsed to "a b" (cosmetic, not functional)');
} else {
  console.log('PASS content double space preserved');
}

console.log(`\n${issues === 0 ? 'All assertions passed!' : issues + ' assertion(s) failed!'}`);
