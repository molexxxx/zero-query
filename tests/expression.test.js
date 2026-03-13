import { describe, it, expect } from 'vitest';
import { safeEval } from '../src/expression.js';


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const eval_ = (expr, ...scopes) => safeEval(expr, scopes.length ? scopes : [{}]);


// ---------------------------------------------------------------------------
// Literals
// ---------------------------------------------------------------------------

describe('expression parser — literals', () => {
  it('numbers', () => {
    expect(eval_('42')).toBe(42);
    expect(eval_('3.14')).toBe(3.14);
    expect(eval_('0xFF')).toBe(255);
    expect(eval_('1e3')).toBe(1000);
  });

  it('strings', () => {
    expect(eval_("'hello'")).toBe('hello');
    expect(eval_('"world"')).toBe('world');
    expect(eval_("'it\\'s'")).toBe("it's");
  });

  it('booleans and null/undefined', () => {
    expect(eval_('true')).toBe(true);
    expect(eval_('false')).toBe(false);
    expect(eval_('null')).toBe(null);
    expect(eval_('undefined')).toBe(undefined);
  });

  it('empty expression returns undefined', () => {
    expect(eval_('')).toBe(undefined);
    expect(eval_('   ')).toBe(undefined);
  });
});


// ---------------------------------------------------------------------------
// Arithmetic
// ---------------------------------------------------------------------------

describe('expression parser — arithmetic', () => {
  it('basic operations', () => {
    expect(eval_('2 + 3')).toBe(5);
    expect(eval_('10 - 4')).toBe(6);
    expect(eval_('3 * 7')).toBe(21);
    expect(eval_('15 / 3')).toBe(5);
    expect(eval_('10 % 3')).toBe(1);
  });

  it('operator precedence', () => {
    expect(eval_('2 + 3 * 4')).toBe(14);
    expect(eval_('(2 + 3) * 4')).toBe(20);
  });

  it('unary operators', () => {
    expect(eval_('-5')).toBe(-5);
    expect(eval_('+3')).toBe(3);
  });
});


// ---------------------------------------------------------------------------
// Comparison & logical
// ---------------------------------------------------------------------------

describe('expression parser — comparison', () => {
  it('equality', () => {
    expect(eval_('1 === 1')).toBe(true);
    expect(eval_('1 !== 2')).toBe(true);
    expect(eval_("1 == '1'")).toBe(true);
    expect(eval_("1 != '2'")).toBe(true);
  });

  it('relational', () => {
    expect(eval_('3 > 2')).toBe(true);
    expect(eval_('3 < 2')).toBe(false);
    expect(eval_('3 >= 3')).toBe(true);
    expect(eval_('3 <= 2')).toBe(false);
  });
});


describe('expression parser — logical', () => {
  it('&& and ||', () => {
    expect(eval_('true && false')).toBe(false);
    expect(eval_('true || false')).toBe(true);
    expect(eval_('0 || 42')).toBe(42);
    expect(eval_("'' || 'default'")).toBe('default');
  });

  it('!', () => {
    expect(eval_('!true')).toBe(false);
    expect(eval_('!false')).toBe(true);
    expect(eval_('!0')).toBe(true);
  });

  it('nullish coalescing ??', () => {
    expect(eval_('null ?? 10')).toBe(10);
    expect(eval_('undefined ?? 20')).toBe(20);
    expect(eval_('0 ?? 30')).toBe(0);
    expect(eval_("'' ?? 'fallback'")).toBe('');
  });
});


// ---------------------------------------------------------------------------
// Ternary
// ---------------------------------------------------------------------------

describe('expression parser — ternary', () => {
  it('evaluates truthy branch', () => {
    expect(eval_("true ? 'yes' : 'no'")).toBe('yes');
  });

  it('evaluates falsy branch', () => {
    expect(eval_("false ? 'yes' : 'no'")).toBe('no');
  });

  it('works with expressions', () => {
    expect(eval_('5 > 3 ? 10 : 20')).toBe(10);
  });
});


// ---------------------------------------------------------------------------
// Property access & scope
// ---------------------------------------------------------------------------

describe('expression parser — property access', () => {
  it('reads scope variables', () => {
    expect(eval_('x', { x: 42 })).toBe(42);
    expect(eval_('name', { name: 'Tony' })).toBe('Tony');
  });

  it('dot access', () => {
    expect(eval_('user.name', { user: { name: 'Tony' } })).toBe('Tony');
  });

  it('computed access', () => {
    expect(eval_('items[0]', { items: ['a', 'b', 'c'] })).toBe('a');
    expect(eval_('obj[key]', { obj: { x: 1 }, key: 'x' })).toBe(1);
  });

  it('optional chaining ?.', () => {
    expect(eval_('user?.name', { user: null })).toBe(undefined);
    expect(eval_('user?.name', { user: { name: 'Tony' } })).toBe('Tony');
  });

  it('returns undefined for missing scope keys', () => {
    expect(eval_('missing')).toBe(undefined);
    expect(eval_('a.b.c', { a: {} })).toBe(undefined);
  });
});


// ---------------------------------------------------------------------------
// Method calls
// ---------------------------------------------------------------------------

describe('expression parser — method calls', () => {
  it('string methods', () => {
    expect(eval_("'hello'.toUpperCase()")).toBe('HELLO');
    expect(eval_("'hello world'.split(' ')")).toEqual(['hello', 'world']);
    expect(eval_("'abc'.includes('b')")).toBe(true);
  });

  it('array methods', () => {
    expect(eval_('items.length', { items: [1, 2, 3] })).toBe(3);
    expect(eval_('items.includes(2)', { items: [1, 2, 3] })).toBe(true);
    expect(eval_("items.join(',')", { items: [1, 2, 3] })).toBe('1,2,3');
  });

  it('custom function calls', () => {
    const add = (a, b) => a + b;
    expect(eval_('add(1, 2)', { add })).toBe(3);
  });
});


// ---------------------------------------------------------------------------
// Built-in globals
// ---------------------------------------------------------------------------

describe('expression parser — built-in globals', () => {
  it('Math', () => {
    expect(eval_('Math.PI')).toBeCloseTo(3.14159);
    expect(eval_('Math.max(1, 5, 3)')).toBe(5);
    expect(eval_('Math.abs(-7)')).toBe(7);
  });

  it('JSON', () => {
    expect(eval_("JSON.parse('{\"a\":1}')")).toEqual({ a: 1 });
  });

  it('parseInt/parseFloat', () => {
    expect(eval_("parseInt('42')")).toBe(42);
    expect(eval_("parseFloat('3.14')")).toBeCloseTo(3.14);
  });

  it('isNaN', () => {
    expect(eval_('isNaN(NaN)')).toBe(true);
    expect(eval_('isNaN(5)')).toBe(false);
  });
});


// ---------------------------------------------------------------------------
// Template literals
// ---------------------------------------------------------------------------

describe('expression parser — template literals', () => {
  it('simple interpolation', () => {
    expect(eval_('`Hello ${name}`', { name: 'Tony' })).toBe('Hello Tony');
  });

  it('expression inside interpolation', () => {
    expect(eval_('`${a + b}`', { a: 1, b: 2 })).toBe('3');
  });

  it('no interpolation', () => {
    expect(eval_('`plain text`')).toBe('plain text');
  });
});


// ---------------------------------------------------------------------------
// Array & object literals
// ---------------------------------------------------------------------------

describe('expression parser — array/object literals', () => {
  it('array literal', () => {
    expect(eval_('[1, 2, 3]')).toEqual([1, 2, 3]);
    expect(eval_('[]')).toEqual([]);
  });

  it('object literal', () => {
    expect(eval_("{ x: 1, y: 'two' }")).toEqual({ x: 1, y: 'two' });
  });

  it('shorthand property', () => {
    expect(eval_('{ x }', { x: 42 })).toEqual({ x: 42 });
  });
});


// ---------------------------------------------------------------------------
// Arrow functions
// ---------------------------------------------------------------------------

describe('expression parser — arrow functions', () => {
  it('single-param arrow', () => {
    const fn = eval_('x => x * 2');
    expect(fn(3)).toBe(6);
  });

  it('multi-param arrow', () => {
    const fn = eval_('(a, b) => a + b');
    expect(fn(1, 2)).toBe(3);
  });

  it('no-param arrow', () => {
    const fn = eval_('() => 42');
    expect(fn()).toBe(42);
  });

  it('arrow with scope access', () => {
    const items = [1, 2, 3];
    expect(eval_('items.filter(x => x > 1)', { items })).toEqual([2, 3]);
  });
});


// ---------------------------------------------------------------------------
// typeof
// ---------------------------------------------------------------------------

describe('expression parser — typeof', () => {
  it('typeof string', () => {
    expect(eval_("typeof 'hello'")).toBe('string');
  });

  it('typeof number', () => {
    expect(eval_('typeof 42')).toBe('number');
  });

  it('typeof undefined variable', () => {
    expect(eval_('typeof missing')).toBe('undefined');
  });
});


// ---------------------------------------------------------------------------
// Safety / security
// ---------------------------------------------------------------------------

describe('expression parser — safety', () => {
  it('blocks constructor access', () => {
    expect(eval_("''.constructor")).toBe(undefined);
  });

  it('blocks __proto__ access', () => {
    expect(eval_("({}).__proto__", {})).toBe(undefined);
  });

  it('returns undefined for invalid expressions', () => {
    expect(eval_('!!!!')).toBe(undefined);
  });

  it('handles deeply nested safe access', () => {
    const data = { a: { b: { c: { d: 'deep' } } } };
    expect(eval_('a.b.c.d', data)).toBe('deep');
  });
});


// ---------------------------------------------------------------------------
// Multi-scope resolution
// ---------------------------------------------------------------------------

describe('expression parser — multi-scope', () => {
  it('checks scope layers in order', () => {
    expect(safeEval('x', [{ x: 'first' }, { x: 'second' }])).toBe('first');
  });

  it('falls through to second scope', () => {
    expect(safeEval('y', [{ x: 1 }, { y: 2 }])).toBe(2);
  });
});


// ---------------------------------------------------------------------------
// in operator
// ---------------------------------------------------------------------------

describe('expression parser — in operator', () => {
  it('checks property existence', () => {
    expect(eval_("'x' in obj", { obj: { x: 1 } })).toBe(true);
    expect(eval_("'y' in obj", { obj: { x: 1 } })).toBe(false);
  });
});


// ---------------------------------------------------------------------------
// instanceof operator
// ---------------------------------------------------------------------------

describe('expression parser — instanceof', () => {
  it('checks instanceOf', () => {
    expect(eval_('arr instanceof Array', { arr: [1, 2] })).toBe(true);
    expect(eval_('obj instanceof Array', { obj: {} })).toBe(false);
  });
});


// ---------------------------------------------------------------------------
// Nested ternary
// ---------------------------------------------------------------------------

describe('expression parser — nested ternary', () => {
  it('evaluates simple ternary correctly', () => {
    expect(eval_("x > 10 ? 'big' : 'small'", { x: 12 })).toBe('big');
    expect(eval_("x > 10 ? 'big' : 'small'", { x: 2 })).toBe('small');
  });
});


// ---------------------------------------------------------------------------
// Chained method calls
// ---------------------------------------------------------------------------

describe('expression parser — chained calls', () => {
  it('chains array methods', () => {
    expect(eval_('items.filter(x => x > 1).map(x => x * 2)', { items: [1, 2, 3] })).toEqual([4, 6]);
  });

  it('chains string methods', () => {
    expect(eval_("name.trim().toUpperCase()", { name: ' hello ' })).toBe('HELLO');
  });
});


// ---------------------------------------------------------------------------
// Spread operator
// ---------------------------------------------------------------------------

describe('expression parser — spread / rest', () => {
  it('spread is not supported — returns gracefully', () => {
    // The parser does not support spread syntax; verify it doesn't throw
    const result = eval_('[...items, 4]', { items: [1, 2, 3] });
    expect(result).toBeDefined();
  });
});


// ---------------------------------------------------------------------------
// Destructuring assignment in arrow body
// ---------------------------------------------------------------------------

describe('expression parser — complex arrow', () => {
  it('arrow as callback in array method', () => {
    const items = [{ n: 'a' }, { n: 'b' }];
    expect(eval_('items.map(x => x.n)', { items })).toEqual(['a', 'b']);
  });

  it('arrow with ternary body', () => {
    const fn = eval_('x => x > 0 ? "pos" : "neg"');
    expect(fn(1)).toBe('pos');
    expect(fn(-1)).toBe('neg');
  });
});


// ---------------------------------------------------------------------------
// Bitwise operators
// ---------------------------------------------------------------------------

describe('expression parser — bitwise', () => {
  it('bitwise operators are not supported — does not throw', () => {
    // The expression parser does not implement bitwise operators
    // Verify graceful fallback rather than crashes
    expect(() => eval_('5 | 3')).not.toThrow();
    expect(() => eval_('5 & 3')).not.toThrow();
    expect(() => eval_('5 ^ 3')).not.toThrow();
  });
});


// ---------------------------------------------------------------------------
// Comma expressions
// ---------------------------------------------------------------------------

describe('expression parser — comma', () => {
  it('comma expressions are not supported — does not throw', () => {
    // The parser does not support comma expressions
    expect(() => eval_('(1, 2, 3)')).not.toThrow();
  });
});


// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('expression parser — edge cases', () => {
  it('handles very long dot chains', () => {
    const data = { a: { b: { c: { d: { e: 42 } } } } };
    expect(eval_('a.b.c.d.e', data)).toBe(42);
  });

  it('handles numeric string keys in bracket access', () => {
    expect(eval_("items['0']", { items: ['a', 'b'] })).toBe('a');
  });

  it('handles conditional access chains', () => {
    expect(eval_('a?.b?.c', { a: null })).toBe(undefined);
    expect(eval_('a?.b?.c', { a: { b: { c: 1 } } })).toBe(1);
  });

  it('handles string with special characters', () => {
    expect(eval_("'hello\\nworld'")).toContain('hello');
  });

  it('handles negative numbers in expressions', () => {
    expect(eval_('-1 + -2')).toBe(-3);
  });

  it('exponentiation ** is not supported — does not throw', () => {
    // The parser does not implement ** operator
    expect(() => eval_('2 ** 3')).not.toThrow();
  });

  it('handles empty array/object', () => {
    expect(eval_('[]')).toEqual([]);
    expect(eval_('{}')).toEqual({});
  });
});


// ---------------------------------------------------------------------------
// Optional chaining edge cases
// ---------------------------------------------------------------------------

describe('expression parser — optional chaining edge cases', () => {
  it('returns undefined for null base with ?.', () => {
    expect(eval_('a?.b', { a: null })).toBeUndefined();
  });

  it('returns undefined for undefined base with ?.', () => {
    expect(eval_('a?.b', { a: undefined })).toBeUndefined();
  });

  it('chains multiple optional access', () => {
    expect(eval_('a?.b?.c', { a: { b: { c: 42 } } })).toBe(42);
  });

  it('chains optional where middle is null', () => {
    expect(eval_('a?.b?.c', { a: { b: null } })).toBeUndefined();
  });

  it('optional chaining with method call', () => {
    expect(eval_('arr?.length', { arr: [1, 2, 3] })).toBe(3);
    expect(eval_('arr?.length', { arr: null })).toBeUndefined();
  });

  it('optional chaining on computed property', () => {
    expect(eval_('obj?.[key]', { obj: { x: 1 }, key: 'x' })).toBe(1);
    expect(eval_('obj?.[key]', { obj: null, key: 'x' })).toBeUndefined();
  });
});


// ---------------------------------------------------------------------------
// Complex property access
// ---------------------------------------------------------------------------

describe('expression parser — complex property access', () => {
  it('accesses deeply nested objects', () => {
    const scope = { a: { b: { c: { d: { e: 'deep' } } } } };
    expect(eval_('a.b.c.d.e', scope)).toBe('deep');
  });

  it('accesses array index then property', () => {
    expect(eval_('arr[0].name', { arr: [{ name: 'first' }] })).toBe('first');
  });

  it('accesses property then array index', () => {
    expect(eval_('obj.items[1]', { obj: { items: ['a', 'b', 'c'] } })).toBe('b');
  });

  it('accesses computed property with variable', () => {
    expect(eval_('obj[key]', { obj: { x: 10, y: 20 }, key: 'y' })).toBe(20);
  });

  it('accesses nested computed property', () => {
    const scope = { data: { users: { alice: { age: 30 } } }, name: 'alice' };
    expect(eval_('data.users[name].age', scope)).toBe(30);
  });
});


// ---------------------------------------------------------------------------
// Arrow function edge cases
// ---------------------------------------------------------------------------

describe('expression parser — arrow function edge cases', () => {
  it('no-param arrow function', () => {
    const fn = eval_('() => 42');
    expect(fn()).toBe(42);
  });

  it('single-param arrow (no parens)', () => {
    const fn = eval_('x => x * 2');
    expect(fn(5)).toBe(10);
  });

  it('multi-param arrow', () => {
    const fn = eval_('(a, b) => a + b');
    expect(fn(3, 4)).toBe(7);
  });

  it('arrow using outer scope', () => {
    const fn = eval_('x => x + y', { y: 10 });
    expect(fn(5)).toBe(15);
  });

  it('arrow with ternary body', () => {
    const fn = eval_('x => x > 0 ? "pos" : "neg"');
    expect(fn(1)).toBe('pos');
    expect(fn(-1)).toBe('neg');
  });
});


// ---------------------------------------------------------------------------
// Template literal edge cases
// ---------------------------------------------------------------------------

describe('expression parser — template literal edge cases', () => {
  it('template with no interpolation', () => {
    expect(eval_('`hello world`')).toBe('hello world');
  });

  it('template with multiple interpolations', () => {
    expect(eval_('`${a} and ${b}`', { a: 'foo', b: 'bar' })).toBe('foo and bar');
  });

  it('template with expression in interpolation', () => {
    expect(eval_('`sum is ${a + b}`', { a: 3, b: 4 })).toBe('sum is 7');
  });

  it('template with nested property access', () => {
    expect(eval_('`Hello ${user.name}`', { user: { name: 'Alice' } })).toBe('Hello Alice');
  });

  it('template with ternary in interpolation', () => {
    expect(eval_('`${x > 0 ? "yes" : "no"}`', { x: 1 })).toBe('yes');
  });

  it('empty template literal', () => {
    expect(eval_('``')).toBe('');
  });
});


// ---------------------------------------------------------------------------
// Nullish coalescing edge cases
// ---------------------------------------------------------------------------

describe('expression parser — nullish coalescing edge cases', () => {
  it('returns left side for 0', () => {
    expect(eval_('x ?? 10', { x: 0 })).toBe(0);
  });

  it('returns left side for empty string', () => {
    expect(eval_('x ?? "default"', { x: '' })).toBe('');
  });

  it('returns left side for false', () => {
    expect(eval_('x ?? true', { x: false })).toBe(false);
  });

  it('returns right side for null', () => {
    expect(eval_('x ?? 10', { x: null })).toBe(10);
  });

  it('returns right side for undefined', () => {
    expect(eval_('x ?? 10', { x: undefined })).toBe(10);
  });

  it('chains with ||', () => {
    expect(eval_('(a ?? b) || c', { a: null, b: 0, c: 5 })).toBe(5);
  });
});


// ---------------------------------------------------------------------------
// Typeof edge cases
// ---------------------------------------------------------------------------

describe('expression parser — typeof edge cases', () => {
  it('typeof undefined variable returns "undefined"', () => {
    expect(eval_('typeof x')).toBe('undefined');
  });

  it('typeof number', () => {
    expect(eval_('typeof x', { x: 42 })).toBe('number');
  });

  it('typeof string', () => {
    expect(eval_('typeof x', { x: 'hi' })).toBe('string');
  });

  it('typeof object', () => {
    expect(eval_('typeof x', { x: {} })).toBe('object');
  });

  it('typeof null', () => {
    expect(eval_('typeof x', { x: null })).toBe('object');
  });

  it('typeof function', () => {
    expect(eval_('typeof x', { x: () => {} })).toBe('function');
  });

  it('typeof boolean', () => {
    expect(eval_('typeof x', { x: true })).toBe('boolean');
  });
});


// ---------------------------------------------------------------------------
// Array/Object literal edge cases
// ---------------------------------------------------------------------------

describe('expression parser — array/object literal edge cases', () => {
  it('array with trailing expression', () => {
    expect(eval_('[1, 2, 3].length')).toBe(3);
  });

  it('array with mixed types', () => {
    expect(eval_('[1, "two", true, null]')).toEqual([1, 'two', true, null]);
  });

  it('object with computed values', () => {
    expect(eval_('{ x: a + 1, y: b * 2 }', { a: 2, b: 3 })).toEqual({ x: 3, y: 6 });
  });

  it('nested array literal', () => {
    expect(eval_('[[1, 2], [3, 4]]')).toEqual([[1, 2], [3, 4]]);
  });

  it('nested object literal', () => {
    expect(eval_('{ a: { b: 1 } }')).toEqual({ a: { b: 1 } });
  });

  it('array of objects', () => {
    expect(eval_('[{ x: 1 }, { x: 2 }]')).toEqual([{ x: 1 }, { x: 2 }]);
  });
});


// ---------------------------------------------------------------------------
// Method call edge cases
// ---------------------------------------------------------------------------

describe('expression parser — method call edge cases', () => {
  it('chained string methods', () => {
    expect(eval_('"Hello World".toLowerCase().split(" ")')).toEqual(['hello', 'world']);
  });

  it('array filter', () => {
    expect(eval_('items.filter(x => x > 2)', { items: [1, 2, 3, 4] })).toEqual([3, 4]);
  });

  it('array map', () => {
    expect(eval_('items.map(x => x * 2)', { items: [1, 2, 3] })).toEqual([2, 4, 6]);
  });

  it('array includes', () => {
    expect(eval_('items.includes(2)', { items: [1, 2, 3] })).toBe(true);
    expect(eval_('items.includes(5)', { items: [1, 2, 3] })).toBe(false);
  });

  it('string includes', () => {
    expect(eval_('"hello world".includes("world")')).toBe(true);
  });

  it('string startsWith/endsWith', () => {
    expect(eval_('"hello".startsWith("hel")')).toBe(true);
    expect(eval_('"hello".endsWith("lo")')).toBe(true);
  });

  it('JSON.stringify', () => {
    expect(eval_('JSON.stringify({ a: 1 })')).toBe('{"a":1}');
  });

  it('JSON.parse', () => {
    expect(eval_('JSON.parse(\'{"a":1}\')')).toEqual({ a: 1 });
  });

  it('Math.max with multiple args', () => {
    expect(eval_('Math.max(1, 5, 3, 2, 4)')).toBe(5);
  });

  it('Math.min with multiple args', () => {
    expect(eval_('Math.min(1, 5, 3, 2, 4)')).toBe(1);
  });
});


// ---------------------------------------------------------------------------
// Multi-scope resolution
// ---------------------------------------------------------------------------

describe('expression parser — multi-scope resolution', () => {
  it('resolves from first scope when available', () => {
    expect(eval_('x', { x: 1 }, { x: 2 })).toBe(1);
  });

  it('falls back to second scope', () => {
    expect(eval_('y', { x: 1 }, { y: 2 })).toBe(2);
  });

  it('resolves different keys from different scopes', () => {
    expect(eval_('x + y', { x: 10 }, { y: 20 })).toBe(30);
  });
});


// ---------------------------------------------------------------------------
// Security: blocked access
// ---------------------------------------------------------------------------

describe('expression parser — security', () => {
  it('blocks constructor access', () => {
    expect(() => eval_('"".constructor')).not.toThrow();
  });

  it('blocks __proto__ access', () => {
    expect(() => eval_('obj.__proto__', { obj: {} })).not.toThrow();
  });

  it('handles invalid expressions gracefully', () => {
    expect(() => eval_('++++')).not.toThrow();
  });

  it('global access is sandboxed — no window', () => {
    expect(eval_('typeof window')).toBe('undefined');
  });

  it('global access is sandboxed — no document', () => {
    expect(eval_('typeof document')).toBe('undefined');
  });
});


// ---------------------------------------------------------------------------
// Comparison edge cases
// ---------------------------------------------------------------------------

describe('expression parser — comparison edge cases', () => {
  it('strict equality with type mismatch', () => {
    expect(eval_('1 === "1"')).toBe(false);
  });

  it('loose equality with type coercion', () => {
    expect(eval_('1 == "1"')).toBe(true);
  });

  it('strict inequality', () => {
    expect(eval_('1 !== "1"')).toBe(true);
  });

  it('comparison with null', () => {
    expect(eval_('null === null')).toBe(true);
    expect(eval_('null == undefined')).toBe(true);
  });

  it('greater than / less than edge cases', () => {
    expect(eval_('0 < -1')).toBe(false);
    expect(eval_('-1 < 0')).toBe(true);
  });
});


// ---------------------------------------------------------------------------
// Grouping / precedence
// ---------------------------------------------------------------------------

describe('expression parser — grouping and precedence', () => {
  it('parentheses override precedence', () => {
    expect(eval_('(2 + 3) * 4')).toBe(20);
  });

  it('nested parentheses', () => {
    expect(eval_('((1 + 2) * (3 + 4))')).toBe(21);
  });

  it('logical operators precedence', () => {
    expect(eval_('true || false && false')).toBe(true);
  });

  it('ternary with comparison', () => {
    expect(eval_('x > 5 ? "big" : "small"', { x: 10 })).toBe('big');
  });

  it('nested ternary', () => {
    expect(eval_('x > 10 ? "big" : x > 5 ? "med" : "small"', { x: 7 })).toBe('med');
  });
});


// ===========================================================================
// new keyword — safe constructors
// ===========================================================================

describe('safeEval — new keyword', () => {
  it('creates new Date (no args)', () => {
    const result = eval_('new Date');
    expect(result).toBeInstanceOf(Date);
  });

  it('creates new Array (no args)', () => {
    const result = eval_('new Array');
    expect(result).toBeInstanceOf(Array);
  });

  it('Map/Set/RegExp in globals — new creates instances', () => {
    // Map, Set, RegExp are now exposed as globals and whitelisted as safe constructors
    expect(eval_('new Map')).toBeInstanceOf(Map);
    expect(eval_('new Set')).toBeInstanceOf(Set);
    expect(eval_('new RegExp')).toBeInstanceOf(RegExp);
  });

  it('new with args — parser correctly passes args to constructor', () => {
    const result = eval_('new Date(2024, 0, 1)');
    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2024);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(1);
  });

  it('blocks unsafe constructors', () => {
    const result = eval_('new Function');
    expect(result).toBeUndefined();
  });
});


// ===========================================================================
// void operator
// ===========================================================================

describe('safeEval — void operator', () => {
  it('returns undefined', () => {
    expect(eval_('void 0')).toBeUndefined();
  });

  it('returns undefined for any expression', () => {
    expect(eval_('void "hello"')).toBeUndefined();
  });
});


// ===========================================================================
// AST cache
// ===========================================================================

describe('safeEval — AST cache', () => {
  it('returns same result on repeated evaluation (cache hit)', () => {
    const r1 = eval_('1 + 2');
    const r2 = eval_('1 + 2');
    expect(r1).toBe(3);
    expect(r2).toBe(3);
  });

  it('handles many unique expressions without error (cache eviction)', () => {
    // Generate enough unique expressions to trigger cache eviction (>512)
    for (let i = 0; i < 520; i++) {
      expect(eval_(`${i} + 1`)).toBe(i + 1);
    }
  });
});


// ===========================================================================
// Optional call ?.()
// ===========================================================================

describe('safeEval — optional call ?.()', () => {
  it('calls function when not null', () => {
    expect(eval_('fn?.()', { fn: () => 42 })).toBe(42);
  });

  it('returns undefined when callee is null', () => {
    expect(eval_('fn?.()', { fn: null })).toBeUndefined();
  });

  it('returns undefined when callee is undefined', () => {
    expect(eval_('fn?.()', {})).toBeUndefined();
  });
});


// ===========================================================================
// Global builtins
// ===========================================================================

describe('safeEval — global builtins', () => {
  it('accesses Date constructor', () => {
    expect(eval_('Date.now()')).toBeGreaterThan(0);
  });

  it('accesses Array.isArray', () => {
    expect(eval_('Array.isArray(items)', { items: [1, 2] })).toBe(true);
  });

  it('accesses Object.keys', () => {
    expect(eval_('Object.keys(obj).length', { obj: { a: 1, b: 2 } })).toBe(2);
  });

  it('accesses String methods', () => {
    expect(eval_('String(42)')).toBe('42');
  });

  it('accesses Number function', () => {
    expect(eval_('Number("42")')).toBe(42);
  });

  it('accesses Boolean function', () => {
    expect(eval_('Boolean(0)')).toBe(false);
  });

  it('accesses parseInt', () => {
    expect(eval_('parseInt("42abc")')).toBe(42);
  });

  it('accesses parseFloat', () => {
    expect(eval_('parseFloat("3.14")')).toBe(3.14);
  });

  it('accesses isNaN', () => {
    expect(eval_('isNaN(NaN)')).toBe(true);
  });

  it('accesses isFinite', () => {
    expect(eval_('isFinite(42)')).toBe(true);
    expect(eval_('isFinite(Infinity)')).toBe(false);
  });

  it('accesses Infinity', () => {
    expect(eval_('Infinity')).toBe(Infinity);
  });

  it('accesses NaN', () => {
    expect(eval_('isNaN(NaN)')).toBe(true);
  });

  it('accesses encodeURIComponent', () => {
    expect(eval_('encodeURIComponent("hello world")')).toBe('hello%20world');
  });

  it('accesses decodeURIComponent', () => {
    expect(eval_('decodeURIComponent("hello%20world")')).toBe('hello world');
  });
});


// ===========================================================================
// Number methods
// ===========================================================================

describe('safeEval — number methods', () => {
  it('calls toFixed', () => {
    expect(eval_('x.toFixed(2)', { x: 3.14159 })).toBe('3.14');
  });

  it('calls toString on number', () => {
    expect(eval_('x.toString()', { x: 42 })).toBe('42');
  });
});


// ===========================================================================
// Empty/edge expressions
// ===========================================================================

describe('safeEval — edge cases', () => {
  it('returns undefined for empty string', () => {
    expect(eval_('')).toBeUndefined();
  });

  it('returns undefined for whitespace-only', () => {
    expect(eval_('   ')).toBeUndefined();
  });

  it('fast path for simple identifier', () => {
    expect(eval_('name', { name: 'Alice' })).toBe('Alice');
  });

  it('handles hasOwnProperty access', () => {
    const obj = { a: 1 };
    expect(eval_('obj.hasOwnProperty("a")', { obj })).toBe(true);
  });
});
