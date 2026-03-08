import { describe, it, expect, beforeEach } from 'vitest';
import { query, queryAll, ZQueryCollection } from '../src/core.js';


// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeEach(() => {
  document.body.innerHTML = `
    <div id="main">
      <p class="text">Hello</p>
      <p class="text">World</p>
      <span class="other">Span</span>
    </div>
  `;
});


// ---------------------------------------------------------------------------
// query() — single selector
// ---------------------------------------------------------------------------

describe('query()', () => {
  it('returns ZQueryCollection by CSS selector', () => {
    const col = query('#main');
    expect(col).toBeInstanceOf(ZQueryCollection);
    expect(col.first()).toBe(document.getElementById('main'));
  });

  it('returns empty collection for non-matching selector', () => {
    const col = query('#nonexistent');
    expect(col).toBeInstanceOf(ZQueryCollection);
    expect(col.length).toBe(0);
  });

  it('returns empty collection for null/undefined', () => {
    expect(query(null).length).toBe(0);
    expect(query(undefined).length).toBe(0);
  });

  it('wraps DOM element in collection', () => {
    const div = document.createElement('div');
    const col = query(div);
    expect(col).toBeInstanceOf(ZQueryCollection);
    expect(col.first()).toBe(div);
  });

  it('creates elements from HTML string as collection', () => {
    const col = query('<span>hello</span>');
    expect(col).toBeInstanceOf(ZQueryCollection);
    expect(col.first().tagName).toBe('SPAN');
    expect(col.first().textContent).toBe('hello');
  });

  it('returns all matching elements', () => {
    const col = query('.text');
    expect(col.length).toBe(2);
  });

  it('uses context parameter', () => {
    const col = query('.text', '#main');
    expect(col.length).toBe(2);
    expect(col.first().textContent).toBe('Hello');
  });

  it('supports chaining on result', () => {
    const col = query('#main').addClass('chained');
    expect(col.first().classList.contains('chained')).toBe(true);
  });
});


// ---------------------------------------------------------------------------
// queryAll() — collection selector
// ---------------------------------------------------------------------------

describe('queryAll()', () => {
  it('returns ZQueryCollection for CSS selector', () => {
    const col = queryAll('.text');
    expect(col).toBeInstanceOf(ZQueryCollection);
    expect(col.length).toBe(2);
  });

  it('returns empty collection for non-matching', () => {
    const col = queryAll('.nonexistent');
    expect(col.length).toBe(0);
  });

  it('wraps single element', () => {
    const div = document.createElement('div');
    const col = queryAll(div);
    expect(col.length).toBe(1);
    expect(col.first()).toBe(div);
  });

  it('creates elements from HTML', () => {
    const col = queryAll('<li>a</li><li>b</li>');
    expect(col.length).toBe(2);
  });

  it('returns empty for null', () => {
    expect(queryAll(null).length).toBe(0);
  });
});


// ---------------------------------------------------------------------------
// ZQueryCollection methods
// ---------------------------------------------------------------------------

describe('ZQueryCollection', () => {
  describe('iteration', () => {
    it('each() iterates elements', () => {
      const col = queryAll('.text');
      const tags = [];
      col.each((_, el) => tags.push(el.textContent));
      expect(tags).toEqual(['Hello', 'World']);
    });

    it('map() maps elements', () => {
      const texts = queryAll('.text').map((_, el) => el.textContent);
      expect(texts).toEqual(['Hello', 'World']);
    });

    it('first() and last()', () => {
      const col = queryAll('.text');
      expect(col.first().textContent).toBe('Hello');
      expect(col.last().textContent).toBe('World');
    });

    it('eq() returns sub-collection', () => {
      const col = queryAll('.text');
      expect(col.eq(1).first().textContent).toBe('World');
      expect(col.eq(5).length).toBe(0);
    });

    it('toArray() returns plain array', () => {
      const arr = queryAll('.text').toArray();
      expect(Array.isArray(arr)).toBe(true);
      expect(arr.length).toBe(2);
    });

    it('is iterable', () => {
      const col = queryAll('.text');
      const items = [...col];
      expect(items.length).toBe(2);
    });
  });


  describe('traversal', () => {
    it('find() searches descendants', () => {
      const main = queryAll('#main');
      const ps = main.find('.text');
      expect(ps.length).toBe(2);
    });

    it('parent() returns parents', () => {
      const p = queryAll('.text').parent();
      expect(p.first().id).toBe('main');
    });

    it('children() returns direct children', () => {
      const main = queryAll('#main');
      expect(main.children().length).toBe(3); // 2 p + 1 span
    });

    it('filter() with string selector', () => {
      const col = queryAll('#main').children();
      const ps = col.filter('p');
      expect(ps.length).toBe(2);
    });

    it('filter() with function', () => {
      const col = queryAll('#main').children();
      const ps = col.filter(el => el.tagName === 'P');
      expect(ps.length).toBe(2);
    });

    it('not() excludes elements', () => {
      const col = queryAll('#main').children();
      const nonP = col.not('p');
      expect(nonP.length).toBe(1);
      expect(nonP.first().tagName).toBe('SPAN');
    });
  });


  describe('classes', () => {
    it('addClass / hasClass / removeClass', () => {
      const col = queryAll('#main');
      col.addClass('active');
      expect(col.hasClass('active')).toBe(true);
      col.removeClass('active');
      expect(col.hasClass('active')).toBe(false);
    });

    it('toggleClass', () => {
      const col = queryAll('#main');
      col.toggleClass('toggled');
      expect(col.hasClass('toggled')).toBe(true);
      col.toggleClass('toggled');
      expect(col.hasClass('toggled')).toBe(false);
    });
  });


  describe('attributes', () => {
    it('attr get/set', () => {
      const col = queryAll('#main');
      col.attr('data-test', 'value');
      expect(col.attr('data-test')).toBe('value');
    });

    it('removeAttr', () => {
      const col = queryAll('#main');
      col.attr('data-x', 'y');
      col.removeAttr('data-x');
      expect(col.attr('data-x')).toBeNull();
    });

    it('data get/set', () => {
      const col = queryAll('#main');
      col.data('count', 42);
      expect(col.data('count')).toBe(42);
    });

    it('data handles objects via JSON', () => {
      const col = queryAll('#main');
      col.data('info', { a: 1 });
      expect(col.data('info')).toEqual({ a: 1 });
    });
  });


  describe('content', () => {
    it('html get/set', () => {
      const col = queryAll('#main');
      col.html('<b>bold</b>');
      expect(col.html()).toBe('<b>bold</b>');
    });

    it('text get/set', () => {
      const col = queryAll('.text').eq(0);
      col.text('Changed');
      expect(col.text()).toBe('Changed');
    });
  });


  describe('DOM manipulation', () => {
    it('append() adds content', () => {
      const col = queryAll('#main');
      col.append('<div class="appended">new</div>');
      expect(document.querySelector('.appended').textContent).toBe('new');
    });

    it('prepend() adds at start', () => {
      const col = queryAll('#main');
      col.prepend('<div class="first">start</div>');
      expect(col.first().firstElementChild.className).toBe('first');
    });

    it('remove() removes elements', () => {
      queryAll('.other').remove();
      expect(document.querySelector('.other')).toBeNull();
    });

    it('empty() clears content', () => {
      queryAll('#main').empty();
      expect(document.querySelector('#main').children.length).toBe(0);
    });

    it('clone() creates deep copy', () => {
      const col = queryAll('.text').eq(0);
      const clone = col.clone();
      expect(clone.first().textContent).toBe('Hello');
      expect(clone.first()).not.toBe(col.first());
    });
  });


  describe('visibility', () => {
    it('hide() sets display none', () => {
      queryAll('#main').hide();
      expect(document.getElementById('main').style.display).toBe('none');
    });

    it('show() clears display', () => {
      const main = document.getElementById('main');
      main.style.display = 'none';
      queryAll('#main').show();
      expect(main.style.display).toBe('');
    });
  });


  describe('events', () => {
    it('on() and trigger()', () => {
      let clicked = false;
      const col = queryAll('#main');
      col.on('click', () => { clicked = true; });
      col.trigger('click');
      expect(clicked).toBe(true);
    });

    it('off() removes handler', () => {
      let count = 0;
      const handler = () => { count++; };
      const col = queryAll('#main');
      col.on('click', handler);
      col.trigger('click');
      col.off('click', handler);
      col.trigger('click');
      expect(count).toBe(1);
    });
  });
});


// ---------------------------------------------------------------------------
// Quick ref helpers
// ---------------------------------------------------------------------------

describe('query quick refs', () => {
  it('$.id() returns element by id', () => {
    expect(query.id('main')).toBe(document.getElementById('main'));
  });

  it('$.class() returns first element by class', () => {
    expect(query.class('text').textContent).toBe('Hello');
  });

  it('$.classes() returns ZQueryCollection', () => {
    const col = query.classes('text');
    expect(col).toBeInstanceOf(ZQueryCollection);
    expect(col.length).toBe(2);
  });

  it('$.children() returns ZQueryCollection', () => {
    const col = query.children('main');
    expect(col).toBeInstanceOf(ZQueryCollection);
    expect(col.length).toBe(3);
  });

  it('$.tag() returns ZQueryCollection', () => {
    const col = query.tag('p');
    expect(col).toBeInstanceOf(ZQueryCollection);
    expect(col.length).toBe(2);
  });

  it('collection forEach() works like Array.forEach()', () => {
    const results = [];
    query.classes('text').forEach((el, i) => results.push({ i, text: el.textContent }));
    expect(results).toEqual([{ i: 0, text: 'Hello' }, { i: 1, text: 'World' }]);
  });

  it('$.create() creates element with attributes', () => {
    const el = query.create('div', { class: 'new', id: 'created' }, 'text');
    expect(el.tagName).toBe('DIV');
    expect(el.className).toBe('new');
    expect(el.id).toBe('created');
    expect(el.textContent).toBe('text');
  });
});
