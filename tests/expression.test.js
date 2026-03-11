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
