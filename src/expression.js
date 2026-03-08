/**
 * zQuery Expression Parser — CSP-safe expression evaluator
 *
 * Replaces `new Function()` / `eval()` with a hand-written parser that
 * evaluates expressions safely without violating Content Security Policy.
 *
 * Supports:
 *   - Property access:       user.name, items[0], items[i]
 *   - Method calls:          items.length, str.toUpperCase()
 *   - Arithmetic:            a + b, count * 2, i % 2
 *   - Comparison:            a === b, count > 0, x != null
 *   - Logical:               a && b, a || b, !a
 *   - Ternary:               a ? b : c
 *   - Typeof:                typeof x
 *   - Unary:                 -a, +a, !a
 *   - Literals:              42, 'hello', "world", true, false, null, undefined
 *   - Template literals:     `Hello ${name}`
 *   - Array literals:        [1, 2, 3]
 *   - Object literals:       { foo: 'bar', baz: 1 }
 *   - Grouping:              (a + b) * c
 *   - Nullish coalescing:    a ?? b
 *   - Optional chaining:     a?.b, a?.[b], a?.()
 */

// Token types
const T = {
  NUM: 1, STR: 2, IDENT: 3, OP: 4, PUNC: 5, TMPL: 6, EOF: 7
};

// Operator precedence (higher = binds tighter)
const PREC = {
  '??': 2,
  '||': 3,
  '&&': 4,
  '==': 8, '!=': 8, '===': 8, '!==': 8,
  '<': 9, '>': 9, '<=': 9, '>=': 9, 'instanceof': 9, 'in': 9,
  '+': 11, '-': 11,
  '*': 12, '/': 12, '%': 12,
};

const KEYWORDS = new Set([
  'true', 'false', 'null', 'undefined', 'typeof', 'instanceof', 'in',
  'new', 'void'
]);

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------
function tokenize(expr) {
  const tokens = [];
  let i = 0;
  const len = expr.length;

  while (i < len) {
    const ch = expr[i];

    // Whitespace
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { i++; continue; }

    // Numbers
    if ((ch >= '0' && ch <= '9') || (ch === '.' && i + 1 < len && expr[i + 1] >= '0' && expr[i + 1] <= '9')) {
      let num = '';
      if (ch === '0' && i + 1 < len && (expr[i + 1] === 'x' || expr[i + 1] === 'X')) {
        num = '0x'; i += 2;
        while (i < len && /[0-9a-fA-F]/.test(expr[i])) num += expr[i++];
      } else {
        while (i < len && ((expr[i] >= '0' && expr[i] <= '9') || expr[i] === '.')) num += expr[i++];
        if (i < len && (expr[i] === 'e' || expr[i] === 'E')) {
          num += expr[i++];
          if (i < len && (expr[i] === '+' || expr[i] === '-')) num += expr[i++];
          while (i < len && expr[i] >= '0' && expr[i] <= '9') num += expr[i++];
        }
      }
      tokens.push({ t: T.NUM, v: Number(num) });
      continue;
    }

    // Strings
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let str = '';
      i++;
      while (i < len && expr[i] !== quote) {
        if (expr[i] === '\\' && i + 1 < len) {
          const esc = expr[++i];
          if (esc === 'n') str += '\n';
          else if (esc === 't') str += '\t';
          else if (esc === 'r') str += '\r';
          else if (esc === '\\') str += '\\';
          else if (esc === quote) str += quote;
          else str += esc;
        } else {
          str += expr[i];
        }
        i++;
      }
      i++; // closing quote
      tokens.push({ t: T.STR, v: str });
      continue;
    }

    // Template literals
    if (ch === '`') {
      const parts = []; // alternating: string, expr, string, expr, ...
      let str = '';
      i++;
      while (i < len && expr[i] !== '`') {
        if (expr[i] === '$' && i + 1 < len && expr[i + 1] === '{') {
          parts.push(str);
          str = '';
          i += 2;
          let depth = 1;
          let inner = '';
          while (i < len && depth > 0) {
            if (expr[i] === '{') depth++;
            else if (expr[i] === '}') { depth--; if (depth === 0) break; }
            inner += expr[i++];
          }
          i++; // closing }
          parts.push({ expr: inner });
        } else {
          if (expr[i] === '\\' && i + 1 < len) { str += expr[++i]; }
          else str += expr[i];
          i++;
        }
      }
      i++; // closing backtick
      parts.push(str);
      tokens.push({ t: T.TMPL, v: parts });
      continue;
    }

    // Identifiers & keywords
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$') {
      let ident = '';
      while (i < len && /[\w$]/.test(expr[i])) ident += expr[i++];
      tokens.push({ t: T.IDENT, v: ident });
      continue;
    }

    // Multi-char operators
    const two = expr.slice(i, i + 3);
    if (two === '===' || two === '!==' || two === '?.') {
      if (two === '?.') {
        tokens.push({ t: T.OP, v: '?.' });
        i += 2;
      } else {
        tokens.push({ t: T.OP, v: two });
        i += 3;
      }
      continue;
    }
    const pair = expr.slice(i, i + 2);
    if (pair === '==' || pair === '!=' || pair === '<=' || pair === '>=' ||
        pair === '&&' || pair === '||' || pair === '??' || pair === '?.') {
      tokens.push({ t: T.OP, v: pair });
      i += 2;
      continue;
    }

    // Single char operators and punctuation
    if ('+-*/%'.includes(ch)) {
      tokens.push({ t: T.OP, v: ch });
      i++; continue;
    }
    if ('<>=!'.includes(ch)) {
      tokens.push({ t: T.OP, v: ch });
      i++; continue;
    }
    if ('()[]{},.?:'.includes(ch)) {
      tokens.push({ t: T.PUNC, v: ch });
      i++; continue;
    }

    // Unknown — skip
    i++;
  }

  tokens.push({ t: T.EOF, v: null });
  return tokens;
}

// ---------------------------------------------------------------------------
// Parser — Pratt (precedence climbing)
// ---------------------------------------------------------------------------
class Parser {
  constructor(tokens, scope) {
    this.tokens = tokens;
    this.pos = 0;
    this.scope = scope;
  }

  peek() { return this.tokens[this.pos]; }
  next() { return this.tokens[this.pos++]; }

  expect(type, val) {
    const t = this.next();
    if (t.t !== type || (val !== undefined && t.v !== val)) {
      throw new Error(`Expected ${val || type} but got ${t.v}`);
    }
    return t;
  }

  match(type, val) {
    const t = this.peek();
    if (t.t === type && (val === undefined || t.v === val)) {
      return this.next();
    }
    return null;
  }

  // Main entry
  parse() {
    const result = this.parseExpression(0);
    return result;
  }

  // Precedence climbing
  parseExpression(minPrec) {
    let left = this.parseUnary();

    while (true) {
      const tok = this.peek();

      // Ternary
      if (tok.t === T.PUNC && tok.v === '?') {
        // Distinguish ternary ? from optional chaining ?.
        if (this.tokens[this.pos + 1]?.v !== '.') {
          this.next(); // consume ?
          const truthy = this.parseExpression(0);
          this.expect(T.PUNC, ':');
          const falsy = this.parseExpression(0);
          left = { type: 'ternary', cond: left, truthy, falsy };
          continue;
        }
      }

      // Binary operators
      if (tok.t === T.OP && tok.v in PREC) {
        const prec = PREC[tok.v];
        if (prec <= minPrec) break;
        this.next();
        const right = this.parseExpression(prec);
        left = { type: 'binary', op: tok.v, left, right };
        continue;
      }

      // instanceof and in as binary operators
      if (tok.t === T.IDENT && (tok.v === 'instanceof' || tok.v === 'in') && PREC[tok.v] > minPrec) {
        const prec = PREC[tok.v];
        this.next();
        const right = this.parseExpression(prec);
        left = { type: 'binary', op: tok.v, left, right };
        continue;
      }

      break;
    }

    return left;
  }

  parseUnary() {
    const tok = this.peek();

    // typeof
    if (tok.t === T.IDENT && tok.v === 'typeof') {
      this.next();
      const arg = this.parseUnary();
      return { type: 'typeof', arg };
    }

    // void
    if (tok.t === T.IDENT && tok.v === 'void') {
      this.next();
      this.parseUnary(); // evaluate but discard
      return { type: 'literal', value: undefined };
    }

    // !expr
    if (tok.t === T.OP && tok.v === '!') {
      this.next();
      const arg = this.parseUnary();
      return { type: 'not', arg };
    }

    // -expr, +expr
    if (tok.t === T.OP && (tok.v === '-' || tok.v === '+')) {
      this.next();
      const arg = this.parseUnary();
      return { type: 'unary', op: tok.v, arg };
    }

    return this.parsePostfix();
  }

  parsePostfix() {
    let left = this.parsePrimary();

    while (true) {
      const tok = this.peek();

      // Property access: a.b
      if (tok.t === T.PUNC && tok.v === '.') {
        this.next();
        const prop = this.next();
        left = { type: 'member', obj: left, prop: prop.v, computed: false };
        // Check for method call: a.b()
        if (this.peek().t === T.PUNC && this.peek().v === '(') {
          left = this._parseCall(left);
        }
        continue;
      }

      // Optional chaining: a?.b, a?.[b], a?.()
      if (tok.t === T.OP && tok.v === '?.') {
        this.next();
        const next = this.peek();
        if (next.t === T.PUNC && next.v === '[') {
          // a?.[expr]
          this.next();
          const prop = this.parseExpression(0);
          this.expect(T.PUNC, ']');
          left = { type: 'optional_member', obj: left, prop, computed: true };
        } else if (next.t === T.PUNC && next.v === '(') {
          // a?.()
          left = { type: 'optional_call', callee: left, args: this._parseArgs() };
        } else {
          // a?.b
          const prop = this.next();
          left = { type: 'optional_member', obj: left, prop: prop.v, computed: false };
          if (this.peek().t === T.PUNC && this.peek().v === '(') {
            left = this._parseCall(left);
          }
        }
        continue;
      }

      // Computed access: a[b]
      if (tok.t === T.PUNC && tok.v === '[') {
        this.next();
        const prop = this.parseExpression(0);
        this.expect(T.PUNC, ']');
        left = { type: 'member', obj: left, prop, computed: true };
        // Check for method call: a[b]()
        if (this.peek().t === T.PUNC && this.peek().v === '(') {
          left = this._parseCall(left);
        }
        continue;
      }

      // Function call: fn()
      if (tok.t === T.PUNC && tok.v === '(') {
        left = this._parseCall(left);
        continue;
      }

      break;
    }

    return left;
  }

  _parseCall(callee) {
    const args = this._parseArgs();
    return { type: 'call', callee, args };
  }

  _parseArgs() {
    this.expect(T.PUNC, '(');
    const args = [];
    while (!(this.peek().t === T.PUNC && this.peek().v === ')') && this.peek().t !== T.EOF) {
      args.push(this.parseExpression(0));
      if (this.peek().t === T.PUNC && this.peek().v === ',') this.next();
    }
    this.expect(T.PUNC, ')');
    return args;
  }

  parsePrimary() {
    const tok = this.peek();

    // Number literal
    if (tok.t === T.NUM) {
      this.next();
      return { type: 'literal', value: tok.v };
    }

    // String literal
    if (tok.t === T.STR) {
      this.next();
      return { type: 'literal', value: tok.v };
    }

    // Template literal
    if (tok.t === T.TMPL) {
      this.next();
      return { type: 'template', parts: tok.v };
    }

    // Grouping (parenthesized expression)
    if (tok.t === T.PUNC && tok.v === '(') {
      this.next();
      const expr = this.parseExpression(0);
      this.expect(T.PUNC, ')');
      return expr;
    }

    // Array literal
    if (tok.t === T.PUNC && tok.v === '[') {
      this.next();
      const elements = [];
      while (!(this.peek().t === T.PUNC && this.peek().v === ']') && this.peek().t !== T.EOF) {
        elements.push(this.parseExpression(0));
        if (this.peek().t === T.PUNC && this.peek().v === ',') this.next();
      }
      this.expect(T.PUNC, ']');
      return { type: 'array', elements };
    }

    // Object literal
    if (tok.t === T.PUNC && tok.v === '{') {
      this.next();
      const properties = [];
      while (!(this.peek().t === T.PUNC && this.peek().v === '}') && this.peek().t !== T.EOF) {
        const keyTok = this.next();
        let key;
        if (keyTok.t === T.IDENT || keyTok.t === T.STR) key = keyTok.v;
        else if (keyTok.t === T.NUM) key = String(keyTok.v);
        else throw new Error('Invalid object key: ' + keyTok.v);

        // Shorthand property: { foo } means { foo: foo }
        if (this.peek().t === T.PUNC && (this.peek().v === ',' || this.peek().v === '}')) {
          properties.push({ key, value: { type: 'ident', name: key } });
        } else {
          this.expect(T.PUNC, ':');
          properties.push({ key, value: this.parseExpression(0) });
        }
        if (this.peek().t === T.PUNC && this.peek().v === ',') this.next();
      }
      this.expect(T.PUNC, '}');
      return { type: 'object', properties };
    }

    // Identifiers & keywords
    if (tok.t === T.IDENT) {
      this.next();

      // Keywords
      if (tok.v === 'true') return { type: 'literal', value: true };
      if (tok.v === 'false') return { type: 'literal', value: false };
      if (tok.v === 'null') return { type: 'literal', value: null };
      if (tok.v === 'undefined') return { type: 'literal', value: undefined };

      // new keyword
      if (tok.v === 'new') {
        const classExpr = this.parsePostfix();
        let args = [];
        if (this.peek().t === T.PUNC && this.peek().v === '(') {
          args = this._parseArgs();
        }
        return { type: 'new', callee: classExpr, args };
      }

      return { type: 'ident', name: tok.v };
    }

    // Fallback — return undefined for unparseable
    this.next();
    return { type: 'literal', value: undefined };
  }
}

// ---------------------------------------------------------------------------
// Evaluator — walks the AST, resolves against scope
// ---------------------------------------------------------------------------

/** Safe property access whitelist for built-in prototypes */
const SAFE_ARRAY_METHODS = new Set([
  'length', 'map', 'filter', 'find', 'findIndex', 'some', 'every',
  'reduce', 'reduceRight', 'forEach', 'includes', 'indexOf', 'lastIndexOf',
  'join', 'slice', 'concat', 'flat', 'flatMap', 'reverse', 'sort',
  'fill', 'keys', 'values', 'entries', 'at', 'toString',
]);

const SAFE_STRING_METHODS = new Set([
  'length', 'charAt', 'charCodeAt', 'includes', 'indexOf', 'lastIndexOf',
  'slice', 'substring', 'trim', 'trimStart', 'trimEnd', 'toLowerCase',
  'toUpperCase', 'split', 'replace', 'replaceAll', 'match', 'search',
  'startsWith', 'endsWith', 'padStart', 'padEnd', 'repeat', 'at',
  'toString', 'valueOf',
]);

const SAFE_NUMBER_METHODS = new Set([
  'toFixed', 'toPrecision', 'toString', 'valueOf',
]);

const SAFE_OBJECT_METHODS = new Set([
  'hasOwnProperty', 'toString', 'valueOf',
]);

const SAFE_MATH_PROPS = new Set([
  'PI', 'E', 'LN2', 'LN10', 'LOG2E', 'LOG10E', 'SQRT2', 'SQRT1_2',
  'abs', 'ceil', 'floor', 'round', 'trunc', 'max', 'min', 'pow',
  'sqrt', 'sign', 'random', 'log', 'log2', 'log10',
]);

const SAFE_JSON_PROPS = new Set(['parse', 'stringify']);

/**
 * Check if property access is safe
 */
function _isSafeAccess(obj, prop) {
  // Never allow access to dangerous properties
  const BLOCKED = new Set([
    'constructor', '__proto__', 'prototype', '__defineGetter__',
    '__defineSetter__', '__lookupGetter__', '__lookupSetter__',
  ]);
  if (typeof prop === 'string' && BLOCKED.has(prop)) return false;

  // Always allow plain object/function property access and array index access
  if (obj !== null && obj !== undefined && (typeof obj === 'object' || typeof obj === 'function')) return true;
  if (typeof obj === 'string') return SAFE_STRING_METHODS.has(prop);
  if (typeof obj === 'number') return SAFE_NUMBER_METHODS.has(prop);
  return false;
}

function evaluate(node, scope) {
  if (!node) return undefined;

  switch (node.type) {
    case 'literal':
      return node.value;

    case 'ident': {
      const name = node.name;
      // Check scope layers in order
      for (const layer of scope) {
        if (layer && typeof layer === 'object' && name in layer) {
          return layer[name];
        }
      }
      // Built-in globals (safe ones only)
      if (name === 'Math') return Math;
      if (name === 'JSON') return JSON;
      if (name === 'Date') return Date;
      if (name === 'Array') return Array;
      if (name === 'Object') return Object;
      if (name === 'String') return String;
      if (name === 'Number') return Number;
      if (name === 'Boolean') return Boolean;
      if (name === 'parseInt') return parseInt;
      if (name === 'parseFloat') return parseFloat;
      if (name === 'isNaN') return isNaN;
      if (name === 'isFinite') return isFinite;
      if (name === 'Infinity') return Infinity;
      if (name === 'NaN') return NaN;
      if (name === 'encodeURIComponent') return encodeURIComponent;
      if (name === 'decodeURIComponent') return decodeURIComponent;
      if (name === 'console') return console;
      return undefined;
    }

    case 'template': {
      // Template literal with interpolation
      let result = '';
      for (const part of node.parts) {
        if (typeof part === 'string') {
          result += part;
        } else if (part && part.expr) {
          result += String(safeEval(part.expr, scope) ?? '');
        }
      }
      return result;
    }

    case 'member': {
      const obj = evaluate(node.obj, scope);
      if (obj == null) return undefined;
      const prop = node.computed ? evaluate(node.prop, scope) : node.prop;
      if (!_isSafeAccess(obj, prop)) return undefined;
      return obj[prop];
    }

    case 'optional_member': {
      const obj = evaluate(node.obj, scope);
      if (obj == null) return undefined;
      const prop = node.computed ? evaluate(node.prop, scope) : node.prop;
      if (!_isSafeAccess(obj, prop)) return undefined;
      return obj[prop];
    }

    case 'call': {
      const result = _resolveCall(node, scope, false);
      return result;
    }

    case 'optional_call': {
      const callee = evaluate(node.callee, scope);
      if (callee == null) return undefined;
      if (typeof callee !== 'function') return undefined;
      const args = node.args.map(a => evaluate(a, scope));
      return callee(...args);
    }

    case 'new': {
      const Ctor = evaluate(node.callee, scope);
      if (typeof Ctor !== 'function') return undefined;
      // Only allow safe constructors
      if (Ctor === Date || Ctor === Array || Ctor === Map || Ctor === Set ||
          Ctor === RegExp || Ctor === Error || Ctor === URL || Ctor === URLSearchParams) {
        const args = node.args.map(a => evaluate(a, scope));
        return new Ctor(...args);
      }
      return undefined;
    }

    case 'binary':
      return _evalBinary(node, scope);

    case 'unary': {
      const val = evaluate(node.arg, scope);
      return node.op === '-' ? -val : +val;
    }

    case 'not':
      return !evaluate(node.arg, scope);

    case 'typeof': {
      try {
        return typeof evaluate(node.arg, scope);
      } catch {
        return 'undefined';
      }
    }

    case 'ternary': {
      const cond = evaluate(node.cond, scope);
      return cond ? evaluate(node.truthy, scope) : evaluate(node.falsy, scope);
    }

    case 'array':
      return node.elements.map(e => evaluate(e, scope));

    case 'object': {
      const obj = {};
      for (const { key, value } of node.properties) {
        obj[key] = evaluate(value, scope);
      }
      return obj;
    }

    default:
      return undefined;
  }
}

/**
 * Resolve and execute a function call safely.
 */
function _resolveCall(node, scope) {
  const callee = node.callee;
  const args = node.args.map(a => evaluate(a, scope));

  // Method call: obj.method() — bind `this` to obj
  if (callee.type === 'member' || callee.type === 'optional_member') {
    const obj = evaluate(callee.obj, scope);
    if (obj == null) return undefined;
    const prop = callee.computed ? evaluate(callee.prop, scope) : callee.prop;
    if (!_isSafeAccess(obj, prop)) return undefined;
    const fn = obj[prop];
    if (typeof fn !== 'function') return undefined;
    return fn.apply(obj, args);
  }

  // Direct call: fn(args)
  const fn = evaluate(callee, scope);
  if (typeof fn !== 'function') return undefined;
  return fn(...args);
}

/**
 * Evaluate binary expression.
 */
function _evalBinary(node, scope) {
  // Short-circuit for logical ops
  if (node.op === '&&') {
    const left = evaluate(node.left, scope);
    return left ? evaluate(node.right, scope) : left;
  }
  if (node.op === '||') {
    const left = evaluate(node.left, scope);
    return left ? left : evaluate(node.right, scope);
  }
  if (node.op === '??') {
    const left = evaluate(node.left, scope);
    return left != null ? left : evaluate(node.right, scope);
  }

  const left = evaluate(node.left, scope);
  const right = evaluate(node.right, scope);

  switch (node.op) {
    case '+': return left + right;
    case '-': return left - right;
    case '*': return left * right;
    case '/': return left / right;
    case '%': return left % right;
    case '==': return left == right;
    case '!=': return left != right;
    case '===': return left === right;
    case '!==': return left !== right;
    case '<': return left < right;
    case '>': return left > right;
    case '<=': return left <= right;
    case '>=': return left >= right;
    case 'instanceof': return left instanceof right;
    case 'in': return left in right;
    default: return undefined;
  }
}


// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Safely evaluate a JS expression string against scope layers.
 *
 * @param {string} expr — expression string
 * @param {object[]} scope — array of scope objects, checked in order
 *   Typical: [loopVars, state, { props, refs, $ }]
 * @returns {*} — evaluation result, or undefined on error
 */
export function safeEval(expr, scope) {
  try {
    const tokens = tokenize(expr.trim());
    const parser = new Parser(tokens, scope);
    const ast = parser.parse();
    return evaluate(ast, scope);
  } catch {
    return undefined;
  }
}
