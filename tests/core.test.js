import { describe, it, expect, beforeEach } from 'vitest';
import { query, queryAll, ZQueryCollection } from '../src/core.js';


// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeEach(() => {
  document.body.innerHTML = `
    <div id="main">
      <p class="text first-p">Hello</p>
      <p class="text second-p">World</p>
      <span class="other">Span</span>
      <p class="text third-p">Extra</p>
    </div>
    <div id="sidebar">
      <ul id="nav">
        <li class="nav-item active">Home</li>
        <li class="nav-item">About</li>
        <li class="nav-item">Contact</li>
      </ul>
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
    expect(col.length).toBe(3);
  });

  it('uses context parameter', () => {
    const col = query('.text', '#main');
    expect(col.length).toBe(3);
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
    expect(col.length).toBe(3);
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
      expect(tags).toEqual(['Hello', 'World', 'Extra']);
    });

    it('map() maps elements', () => {
      const texts = queryAll('.text').map((_, el) => el.textContent);
      expect(texts).toEqual(['Hello', 'World', 'Extra']);
    });

    it('first() and last()', () => {
      const col = queryAll('.text');
      expect(col.first().textContent).toBe('Hello');
      expect(col.last().textContent).toBe('Extra');
    });

    it('eq() returns sub-collection', () => {
      const col = queryAll('.text');
      expect(col.eq(1).first().textContent).toBe('World');
      expect(col.eq(5).length).toBe(0);
    });

    it('toArray() returns plain array', () => {
      const arr = queryAll('.text').toArray();
      expect(Array.isArray(arr)).toBe(true);
      expect(arr.length).toBe(3);
    });

    it('is iterable', () => {
      const col = queryAll('.text');
      const items = [...col];
      expect(items.length).toBe(3);
    });
  });


  describe('traversal', () => {
    it('find() searches descendants', () => {
      const main = queryAll('#main');
      const ps = main.find('.text');
      expect(ps.length).toBe(3);
    });

    it('parent() returns parents', () => {
      const p = queryAll('.text').parent();
      expect(p.first().id).toBe('main');
    });

    it('children() returns direct children', () => {
      const main = queryAll('#main');
      expect(main.children().length).toBe(4); // 3 p + 1 span
    });

    it('filter() with string selector', () => {
      const col = queryAll('#main').children();
      const ps = col.filter('p');
      expect(ps.length).toBe(3);
    });

    it('filter() with function', () => {
      const col = queryAll('#main').children();
      const ps = col.filter(el => el.tagName === 'P');
      expect(ps.length).toBe(3);
    });

    it('not() excludes elements', () => {
      const col = queryAll('#main').children();
      const nonP = col.not('p');
      expect(nonP.length).toBe(1);
      expect(nonP.first().tagName).toBe('SPAN');
    });

    it('next() returns next sibling', () => {
      const col = queryAll('.first-p');
      expect(col.next().first().classList.contains('second-p')).toBe(true);
    });

    it('next(selector) filters by selector', () => {
      const col = queryAll('.first-p');
      expect(col.next('.second-p').length).toBe(1);
      expect(col.next('.third-p').length).toBe(0);
    });

    it('prev() returns previous sibling', () => {
      const col = queryAll('.second-p');
      expect(col.prev().first().classList.contains('first-p')).toBe(true);
    });

    it('prev(selector) filters by selector', () => {
      const col = queryAll('.second-p');
      expect(col.prev('.first-p').length).toBe(1);
      expect(col.prev('.other').length).toBe(0);
    });

    it('nextAll() returns all following siblings', () => {
      const col = queryAll('.first-p');
      expect(col.nextAll().length).toBe(3); // second-p, other, third-p
    });

    it('nextAll(selector) filters', () => {
      const col = queryAll('.first-p');
      expect(col.nextAll('.text').length).toBe(2);
    });

    it('nextUntil() stops at selector', () => {
      const col = queryAll('.first-p');
      const result = col.nextUntil('.third-p');
      expect(result.length).toBe(2); // second-p, other
    });

    it('prevAll() returns all preceding siblings', () => {
      const col = queryAll('.third-p');
      expect(col.prevAll().length).toBe(3);
    });

    it('prevAll(selector) filters', () => {
      const col = queryAll('.third-p');
      expect(col.prevAll('.text').length).toBe(2);
    });

    it('prevUntil() stops at selector', () => {
      const col = queryAll('.third-p');
      const result = col.prevUntil('.first-p');
      expect(result.length).toBe(2); // other, second-p
    });

    it('parents() returns all ancestors', () => {
      const col = queryAll('.first-p');
      const parents = col.parents();
      expect(parents.length).toBeGreaterThanOrEqual(2); // #main, body, html
    });

    it('parents(selector) filters', () => {
      const col = queryAll('.first-p');
      expect(col.parents('#main').length).toBe(1);
    });

    it('parentsUntil() stops at selector', () => {
      const col = queryAll('.first-p');
      const result = col.parentsUntil('body');
      expect(result.length).toBe(1); // just #main
    });

    it('contents() includes text nodes', () => {
      document.body.innerHTML = '<div id="ct">text<span>child</span></div>';
      const col = queryAll('#ct');
      expect(col.contents().length).toBe(2); // text node + span
    });

    it('siblings() returns all siblings excluding self', () => {
      const col = queryAll('.other');
      const sibs = col.siblings();
      expect(sibs.length).toBe(3); // three .text p's
    });

    it('closest() finds ancestor', () => {
      const col = queryAll('.nav-item').eq(0);
      expect(col.closest('#nav').length).toBe(1);
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

    it('toggleClass with multiple classes', () => {
      const col = queryAll('#main');
      col.toggleClass('a', 'b');
      expect(col[0].classList.contains('a')).toBe(true);
      expect(col[0].classList.contains('b')).toBe(true);
      col.toggleClass('a', 'b');
      expect(col[0].classList.contains('a')).toBe(false);
      expect(col[0].classList.contains('b')).toBe(false);
    });

    it('toggleClass with force boolean', () => {
      const col = queryAll('#main');
      col.toggleClass('forced', true);
      expect(col.hasClass('forced')).toBe(true);
      col.toggleClass('forced', true);
      expect(col.hasClass('forced')).toBe(true);
      col.toggleClass('forced', false);
      expect(col.hasClass('forced')).toBe(false);
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

    it('html() auto-morphs when element has existing children', () => {
      const main = document.querySelector('#main');
      main.innerHTML = '<p id="preserved">old text</p>';
      const ref = main.children[0];  // grab DOM reference
      const col = queryAll('#main');
      col.html('<p id="preserved">new text</p>');
      // Same DOM node preserved — morph, not innerHTML replace
      expect(main.children[0]).toBe(ref);
      expect(main.children[0].textContent).toBe('new text');
    });

    it('html() uses innerHTML for empty elements (fast first-paint)', () => {
      const main = document.querySelector('#main');
      main.innerHTML = '';  // make it empty
      const col = queryAll('#main');
      col.html('<p id="fresh">hello</p>');
      expect(main.innerHTML).toBe('<p id="fresh">hello</p>');
    });

    it('empty().html() forces raw innerHTML (opt-out of morph)', () => {
      const main = document.querySelector('#main');
      main.innerHTML = '<p id="old">will be destroyed</p>';
      const ref = main.children[0];
      const col = queryAll('#main');
      col.empty().html('<p id="old">replaced</p>');
      // NOT the same node — empty() cleared children, so html() used innerHTML
      expect(main.children[0]).not.toBe(ref);
      expect(main.children[0].textContent).toBe('replaced');
    });

    it('text get/set', () => {
      const col = queryAll('.text').eq(0);
      col.text('Changed');
      expect(col.text()).toBe('Changed');
    });

    it('morph() diffs content instead of replacing', () => {
      const main = document.querySelector('#main');
      main.innerHTML = '<p id="keep">old</p>';
      const ref = main.children[0];
      const col = queryAll('#main');
      col.morph('<p id="keep">new</p>');
      // Same DOM node preserved (morph, not innerHTML)
      expect(main.children[0]).toBe(ref);
      expect(main.children[0].textContent).toBe('new');
    });

    it('morph() is chainable', () => {
      const col = queryAll('#main');
      const ret = col.morph('<p>m</p>');
      expect(ret).toBe(col);
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

    it('on() works on non-Element targets like window', () => {
      let fired = false;
      const col = new ZQueryCollection([window]);
      col.on('custom-win-evt', () => { fired = true; });
      window.dispatchEvent(new Event('custom-win-evt'));
      expect(fired).toBe(true);
    });

    it('$.on() with EventTarget binds directly to that target', () => {
      let fired = false;
      const target = new EventTarget();
      query.on('test-evt', target, () => { fired = true; });
      target.dispatchEvent(new Event('test-evt'));
      expect(fired).toBe(true);
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
    expect(col.length).toBe(3);
  });

  it('$.children() returns ZQueryCollection', () => {
    const col = query.children('main');
    expect(col).toBeInstanceOf(ZQueryCollection);
    expect(col.length).toBe(4);
  });

  it('$.tag() returns ZQueryCollection', () => {
    const col = query.tag('p');
    expect(col).toBeInstanceOf(ZQueryCollection);
    expect(col.length).toBe(3);
  });

  describe('collection forEach() works like Array.forEach()', () => {
    it('iterates with el, index, array args', () => {
      const results = [];
      query.classes('text').forEach((el, i) => results.push({ i, text: el.textContent }));
      expect(results).toEqual([{ i: 0, text: 'Hello' }, { i: 1, text: 'World' }, { i: 2, text: 'Extra' }]);
    });
  });

  it('$.create() creates element with attributes', () => {
    const col = query.create('div', { class: 'new', id: 'created' }, 'text');
    expect(col).toBeInstanceOf(ZQueryCollection);
    expect(col.length).toBe(1);
    const el = col[0];
    expect(el.tagName).toBe('DIV');
    expect(el.className).toBe('new');
    expect(el.id).toBe('created');
    expect(el.textContent).toBe('text');
  });
});


// ---------------------------------------------------------------------------
// New filtering / collection methods
// ---------------------------------------------------------------------------

describe('filtering & collection', () => {
  it('is() checks if any element matches selector', () => {
    expect(queryAll('#main').children().is('p')).toBe(true);
    expect(queryAll('#main').children().is('table')).toBe(false);
  });

  it('is() with function', () => {
    const result = queryAll('.text').is(function(i) { return this.textContent === 'World'; });
    expect(result).toBe(true);
  });

  it('has() keeps elements containing matching descendant', () => {
    const col = queryAll('#sidebar').has('.nav-item');
    expect(col.length).toBe(1);
  });

  it('slice() returns subset', () => {
    const col = queryAll('.text').slice(0, 2);
    expect(col.length).toBe(2);
    expect(col.first().textContent).toBe('Hello');
  });

  it('slice() with negative index', () => {
    const col = queryAll('.text').slice(-1);
    expect(col.length).toBe(1);
    expect(col.first().textContent).toBe('Extra');
  });

  it('add() merges collections', () => {
    const col = queryAll('.first-p').add('.other');
    expect(col.length).toBe(2);
  });

  it('add() with element', () => {
    const el = document.getElementById('main');
    const col = queryAll('.first-p').add(el);
    expect(col.length).toBe(2);
  });

  it('add() with ZQueryCollection', () => {
    const col = queryAll('.first-p').add(queryAll('.other'));
    expect(col.length).toBe(2);
  });

  it('get() with no args returns array', () => {
    const arr = queryAll('.text').get();
    expect(Array.isArray(arr)).toBe(true);
    expect(arr.length).toBe(3);
  });

  it('get(index) returns element', () => {
    const el = queryAll('.text').get(1);
    expect(el.textContent).toBe('World');
  });

  it('get(negative) returns from end', () => {
    const el = queryAll('.text').get(-1);
    expect(el.textContent).toBe('Extra');
  });

  it('index() returns position among siblings', () => {
    const col = queryAll('.other');
    expect(col.index()).toBe(2); // 3rd child (0-indexed)
  });

  it('index(element) returns position in collection', () => {
    const other = document.querySelector('.other');
    const col = queryAll('#main').children();
    expect(col.index(other)).toBe(2);
  });
});


// ---------------------------------------------------------------------------
// Inverse DOM manipulation (appendTo, prependTo, insertAfter, insertBefore, etc.)
// ---------------------------------------------------------------------------

describe('inverse DOM manipulation', () => {
  it('appendTo() moves elements into target', () => {
    queryAll('<div class="new-item">new</div>').appendTo('#nav');
    const nav = document.getElementById('nav');
    expect(nav.lastElementChild.className).toBe('new-item');
  });

  it('prependTo() inserts at start of target', () => {
    queryAll('<li class="first-item">first</li>').prependTo('#nav');
    const nav = document.getElementById('nav');
    expect(nav.firstElementChild.className).toBe('first-item');
  });

  it('insertAfter() inserts after target', () => {
    queryAll('<span class="inserted">!</span>').insertAfter('.first-p');
    const firstP = document.querySelector('.first-p');
    expect(firstP.nextElementSibling.className).toBe('inserted');
  });

  it('insertBefore() inserts before target', () => {
    queryAll('<span class="inserted">!</span>').insertBefore('.second-p');
    const secondP = document.querySelector('.second-p');
    expect(secondP.previousElementSibling.className).toBe('inserted');
  });

  it('replaceAll() replaces target elements', () => {
    queryAll('<em>replaced</em>').replaceAll('.other');
    expect(document.querySelector('.other')).toBeNull();
    expect(document.querySelector('em').textContent).toBe('replaced');
  });

  it('unwrap() removes parent wrapper', () => {
    // wrap nav-items in a div first
    const items = queryAll('.nav-item');
    const count = items.length;
    items.eq(0).wrap('<div class="wrapper"></div>');
    expect(document.querySelector('.wrapper')).not.toBeNull();
    queryAll('.nav-item').eq(0).unwrap('.wrapper');
    expect(document.querySelector('.wrapper')).toBeNull();
  });

  it('wrapAll() wraps all elements in one wrapper', () => {
    queryAll('.nav-item').wrapAll('<div class="all-wrap"></div>');
    const wrap = document.querySelector('.all-wrap');
    expect(wrap).not.toBeNull();
    expect(wrap.children.length).toBe(3);
  });

  it('wrapInner() wraps inner contents', () => {
    queryAll('.first-p').wrapInner('<strong></strong>');
    const strong = document.querySelector('.first-p > strong');
    expect(strong).not.toBeNull();
    expect(strong.textContent).toBe('Hello');
  });

  it('detach() removes elements (alias for remove)', () => {
    queryAll('.other').detach();
    expect(document.querySelector('.other')).toBeNull();
  });
});


// ---------------------------------------------------------------------------
// CSS dimension methods
// ---------------------------------------------------------------------------

describe('CSS dimension methods', () => {
  it('scrollTop() get returns a number', () => {
    const val = queryAll('#main').scrollTop();
    expect(typeof val).toBe('number');
  });

  it('scrollTop(value) sets scroll position', () => {
    const main = document.getElementById('main');
    main.style.overflow = 'auto';
    main.style.height = '10px';
    main.innerHTML = '<div style="height:1000px">tall</div>';
    queryAll('#main').scrollTop(50);
    expect(main.scrollTop).toBe(50);
  });

  it('scrollLeft() get returns a number', () => {
    const val = queryAll('#main').scrollLeft();
    expect(typeof val).toBe('number');
  });

  it('innerWidth() returns clientWidth', () => {
    const main = document.getElementById('main');
    // jsdom sets clientWidth to 0 but the method should still return a number
    const val = queryAll('#main').innerWidth();
    expect(typeof val).toBe('number');
  });

  it('innerHeight() returns clientHeight', () => {
    const val = queryAll('#main').innerHeight();
    expect(typeof val).toBe('number');
  });

  it('outerWidth() returns offsetWidth', () => {
    const val = queryAll('#main').outerWidth();
    expect(typeof val).toBe('number');
  });

  it('outerHeight() returns offsetHeight', () => {
    const val = queryAll('#main').outerHeight();
    expect(typeof val).toBe('number');
  });

  it('outerWidth(true) includes margin', () => {
    const main = document.getElementById('main');
    main.style.margin = '10px';
    const val = queryAll('#main').outerWidth(true);
    expect(typeof val).toBe('number');
  });
});


// ---------------------------------------------------------------------------
// prop() method
// ---------------------------------------------------------------------------

describe('ZQueryCollection — prop()', () => {
  it('gets a DOM property', () => {
    document.body.innerHTML = '<input type="checkbox" checked>';
    const col = queryAll('input');
    expect(col.prop('checked')).toBe(true);
  });

  it('sets a DOM property', () => {
    document.body.innerHTML = '<input type="checkbox">';
    const col = queryAll('input');
    col.prop('checked', true);
    expect(col[0].checked).toBe(true);
  });

  it('sets multiple properties via sequential calls', () => {
    document.body.innerHTML = '<input type="text">';
    const col = queryAll('input');
    col.prop('disabled', true);
    col.prop('value', 'hello');
    expect(col[0].disabled).toBe(true);
    expect(col[0].value).toBe('hello');
  });
});


// ---------------------------------------------------------------------------
// css() method
// ---------------------------------------------------------------------------

describe('ZQueryCollection — css()', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="styled">test</div>';
  });

  it('sets style properties from object', () => {
    queryAll('#styled').css({ color: 'red', 'font-size': '16px' });
    const el = document.getElementById('styled');
    expect(el.style.color).toBe('red');
  });

  it('returns collection for chaining', () => {
    const col = queryAll('#styled').css({ color: 'blue' });
    expect(col).toBeInstanceOf(ZQueryCollection);
  });
});


// ---------------------------------------------------------------------------
// val() method
// ---------------------------------------------------------------------------

describe('ZQueryCollection — val()', () => {
  it('gets input value', () => {
    document.body.innerHTML = '<input value="test">';
    expect(queryAll('input').val()).toBe('test');
  });

  it('sets input value', () => {
    document.body.innerHTML = '<input value="">';
    queryAll('input').val('new value');
    expect(document.querySelector('input').value).toBe('new value');
  });

  it('gets select value', () => {
    document.body.innerHTML = '<select><option value="a" selected>A</option><option value="b">B</option></select>';
    expect(queryAll('select').val()).toBe('a');
  });

  it('gets textarea value', () => {
    document.body.innerHTML = '<textarea>hello</textarea>';
    expect(queryAll('textarea').val()).toBe('hello');
  });
});


// ---------------------------------------------------------------------------
// after(), before() methods
// ---------------------------------------------------------------------------

describe('ZQueryCollection — after() / before()', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="container"><p id="target">target</p></div>';
  });

  it('after() inserts content after element', () => {
    queryAll('#target').after('<span class="after">after</span>');
    const next = document.getElementById('target').nextElementSibling;
    expect(next.className).toBe('after');
  });

  it('before() inserts content before element', () => {
    queryAll('#target').before('<span class="before">before</span>');
    const prev = document.getElementById('target').previousElementSibling;
    expect(prev.className).toBe('before');
  });
});


// ---------------------------------------------------------------------------
// wrap() method
// ---------------------------------------------------------------------------

describe('ZQueryCollection — wrap()', () => {
  it('wraps element in new parent', () => {
    document.body.innerHTML = '<div id="container"><p id="target">text</p></div>';
    queryAll('#target').wrap('<div class="wrapper"></div>');
    const wrapper = document.querySelector('.wrapper');
    expect(wrapper).not.toBeNull();
    expect(wrapper.querySelector('#target')).not.toBeNull();
  });
});


// ---------------------------------------------------------------------------
// replaceWith() method
// ---------------------------------------------------------------------------

describe('ZQueryCollection — replaceWith()', () => {
  it('replaces element with new content', () => {
    document.body.innerHTML = '<div id="container"><p id="old">old</p></div>';
    queryAll('#old').replaceWith('<span id="new">new</span>');
    expect(document.querySelector('#old')).toBeNull();
    expect(document.querySelector('#new')).not.toBeNull();
  });

  it('auto-morphs when tag name matches (preserves identity)', () => {
    document.body.innerHTML = '<div id="container"><p id="target" class="old">old text</p></div>';
    const target = document.querySelector('#target');
    queryAll('#target').replaceWith('<p id="target" class="new">new text</p>');
    // Same DOM node — morphed, not replaced
    expect(document.querySelector('#target')).toBe(target);
    expect(target.className).toBe('new');
    expect(target.textContent).toBe('new text');
  });

  it('replaces when tag name differs', () => {
    document.body.innerHTML = '<div id="container"><p id="old">old</p></div>';
    const oldRef = document.querySelector('#old');
    queryAll('#old').replaceWith('<section id="replaced">new</section>');
    expect(document.querySelector('#replaced')).not.toBe(oldRef);
    expect(document.querySelector('#replaced').tagName).toBe('SECTION');
  });
});


// ---------------------------------------------------------------------------
// offset() and position()
// ---------------------------------------------------------------------------

describe('ZQueryCollection — offset() / position()', () => {
  it('offset() returns object with top and left', () => {
    document.body.innerHTML = '<div id="box">box</div>';
    const off = queryAll('#box').offset();
    expect(off).toHaveProperty('top');
    expect(off).toHaveProperty('left');
    expect(typeof off.top).toBe('number');
  });

  it('position() returns object with top and left', () => {
    document.body.innerHTML = '<div id="box">box</div>';
    const pos = queryAll('#box').position();
    expect(pos).toHaveProperty('top');
    expect(pos).toHaveProperty('left');
  });
});


// ---------------------------------------------------------------------------
// width() and height()
// ---------------------------------------------------------------------------

describe('ZQueryCollection — width() / height()', () => {
  it('width() returns a number', () => {
    document.body.innerHTML = '<div id="box" style="width:100px">box</div>';
    const val = queryAll('#box').width();
    expect(typeof val).toBe('number');
  });

  it('height() returns a number', () => {
    document.body.innerHTML = '<div id="box" style="height:50px">box</div>';
    const val = queryAll('#box').height();
    expect(typeof val).toBe('number');
  });
});


// ---------------------------------------------------------------------------
// animate()
// ---------------------------------------------------------------------------

describe('ZQueryCollection — animate()', () => {
  it('returns a promise', () => {
    document.body.innerHTML = '<div id="box">box</div>';
    const result = queryAll('#box').animate({ opacity: 0 }, 100);
    // animate() returns a Promise
    expect(result).toBeInstanceOf(Promise);
  });
});


// ---------------------------------------------------------------------------
// hover() convenience
// ---------------------------------------------------------------------------

describe('hover()', () => {
  it('binds mouseenter and mouseleave', () => {
    let entered = false, left = false;
    const col = queryAll('#main');
    col.hover(() => { entered = true; }, () => { left = true; });
    col.first().dispatchEvent(new Event('mouseenter'));
    col.first().dispatchEvent(new Event('mouseleave'));
    expect(entered).toBe(true);
    expect(left).toBe(true);
  });

  it('uses same fn for both if only one provided', () => {
    let count = 0;
    const col = queryAll('#main');
    col.hover(() => { count++; });
    col.first().dispatchEvent(new Event('mouseenter'));
    col.first().dispatchEvent(new Event('mouseleave'));
    expect(count).toBe(2);
  });
});
