import { describe, it, expect, beforeEach, vi } from 'vitest';
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

  // qs / qsa — raw DOM shortcuts
  it('$.qs() returns raw element by CSS selector', () => {
    const el = query.qs('#main');
    expect(el).toBe(document.getElementById('main'));
    expect(el).toBeInstanceOf(HTMLElement);
  });

  it('$.qs() returns null for non-matching selector', () => {
    expect(query.qs('#nonexistent')).toBeNull();
  });

  it('$.qs() scopes to context element', () => {
    const sidebar = document.getElementById('sidebar');
    const el = query.qs('.nav-item', sidebar);
    expect(el.textContent).toBe('Home');
  });

  it('$.qsa() returns array of raw elements', () => {
    const els = query.qsa('.text');
    expect(Array.isArray(els)).toBe(true);
    expect(els.length).toBe(3);
    expect(els[0]).toBeInstanceOf(HTMLElement);
  });

  it('$.qsa() returns empty array for non-matching selector', () => {
    const els = query.qsa('.nonexistent');
    expect(els).toEqual([]);
  });

  it('$.qsa() scopes to context element', () => {
    const nav = document.getElementById('nav');
    const els = query.qsa('.nav-item', nav);
    expect(els.length).toBe(3);
    expect(els[0].textContent).toBe('Home');
  });

  it('$.qsa() result supports Array methods', () => {
    const names = query.qsa('.nav-item').map(el => el.textContent);
    expect(names).toEqual(['Home', 'About', 'Contact']);
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


// ---------------------------------------------------------------------------
// ZQueryCollection — empty collection safety
// ---------------------------------------------------------------------------

describe('ZQueryCollection — empty collection operations', () => {
  it('first() returns null on empty', () => {
    expect(queryAll('.nonexistent').first()).toBeNull();
  });

  it('last() returns null on empty', () => {
    expect(queryAll('.nonexistent').last()).toBeNull();
  });

  it('each() on empty collection does not call callback', () => {
    const fn = vi.fn();
    queryAll('.nonexistent').each(fn);
    expect(fn).not.toHaveBeenCalled();
  });

  it('map() on empty returns empty array', () => {
    expect(queryAll('.nonexistent').map(el => el)).toEqual([]);
  });

  it('html() get on empty returns undefined', () => {
    const result = queryAll('.nonexistent').html();
    expect(result).toBeUndefined();
  });

  it('text() get on empty returns undefined', () => {
    const result = queryAll('.nonexistent').text();
    expect(result).toBeUndefined();
  });

  it('val() get on empty returns undefined', () => {
    expect(queryAll('.nonexistent').val()).toBeUndefined();
  });

  it('addClass on empty does not throw', () => {
    expect(() => queryAll('.nonexistent').addClass('test')).not.toThrow();
  });

  it('attr() get on empty returns undefined', () => {
    expect(queryAll('.nonexistent').attr('id')).toBeUndefined();
  });

  it('chaining on empty collection', () => {
    const col = queryAll('.nonexistent');
    const result = col.addClass('x').removeClass('x').toggleClass('y');
    expect(result).toBeInstanceOf(ZQueryCollection);
    expect(result.length).toBe(0);
  });
});


// ---------------------------------------------------------------------------
// Collection wrapping edge cases
// ---------------------------------------------------------------------------

describe('query — wrapping edge cases', () => {
  it('wraps an HTMLCollection', () => {
    const col = queryAll(document.getElementsByClassName('text'));
    expect(col).toBeInstanceOf(ZQueryCollection);
    expect(col.length).toBe(3);
  });

  it('wraps a NodeList', () => {
    const col = queryAll(document.querySelectorAll('.text'));
    expect(col).toBeInstanceOf(ZQueryCollection);
    expect(col.length).toBe(3);
  });

  it('wraps an Array of elements', () => {
    const arr = [document.getElementById('main'), document.getElementById('sidebar')];
    const col = queryAll(arr);
    expect(col.length).toBe(2);
    expect(col.first().id).toBe('main');
  });

  it('query() wraps ZQueryCollection (returns as-is)', () => {
    const original = queryAll('.text');
    const wrapped = query(original);
    expect(wrapped).toBe(original);
  });

  it('creates multiple elements from HTML', () => {
    const col = queryAll('<p>a</p><p>b</p><p>c</p>');
    expect(col.length).toBe(3);
    expect(col.first().textContent).toBe('a');
    expect(col.last().textContent).toBe('c');
  });
});


// ---------------------------------------------------------------------------
// html() morphing advanced
// ---------------------------------------------------------------------------

describe('ZQueryCollection — html() morphing advanced', () => {
  it('morphs complex nested structure', () => {
    document.body.innerHTML = '<div id="m"><ul><li id="i1">old1</li><li id="i2">old2</li></ul></div>';
    const li1 = document.getElementById('i1');
    queryAll('#m').html('<ul><li id="i1">new1</li><li id="i2">new2</li><li id="i3">new3</li></ul>');
    // li1 should be preserved (same id → morph)
    expect(document.getElementById('i1')).toBe(li1);
    expect(li1.textContent).toBe('new1');
    expect(document.querySelectorAll('#m li').length).toBe(3);
  });

  it('morph() handles tag change at root', () => {
    document.body.innerHTML = '<div id="m"><p>old</p></div>';
    queryAll('#m').morph('<span>new</span>');
    expect(document.querySelector('#m span')).not.toBeNull();
    expect(document.querySelector('#m p')).toBeNull();
  });
});


// ---------------------------------------------------------------------------
// Event delegation
// ---------------------------------------------------------------------------

describe('ZQueryCollection — event delegation', () => {
  it('on() with selector delegates to matching children', () => {
    let clicked = null;
    queryAll('#nav').on('click', '.nav-item', function() { clicked = this.textContent; });
    document.querySelector('.nav-item.active').click();
    expect(clicked).toBe('Home');
  });

  it('delegated event does not fire for non-matching elements', () => {
    let fired = false;
    queryAll('#main').on('click', '.nonexistent', () => { fired = true; });
    document.querySelector('.text').click();
    expect(fired).toBe(false);
  });
});


// ---------------------------------------------------------------------------
// Multiple class operations
// ---------------------------------------------------------------------------

describe('ZQueryCollection — multiple class operations', () => {
  it('addClass with space-separated classes', () => {
    const col = queryAll('#main');
    col.addClass('a', 'b', 'c');
    expect(col.first().classList.contains('a')).toBe(true);
    expect(col.first().classList.contains('b')).toBe(true);
    expect(col.first().classList.contains('c')).toBe(true);
  });

  it('removeClass with multiple classes', () => {
    const col = queryAll('#main');
    col.addClass('x', 'y', 'z');
    col.removeClass('x', 'z');
    expect(col.first().classList.contains('x')).toBe(false);
    expect(col.first().classList.contains('y')).toBe(true);
    expect(col.first().classList.contains('z')).toBe(false);
  });
});


// ---------------------------------------------------------------------------
// Traversal edge cases
// ---------------------------------------------------------------------------

describe('ZQueryCollection — traversal edge cases', () => {
  it('find() returns empty when no descendants match', () => {
    expect(queryAll('#main').find('.nonexistent').length).toBe(0);
  });

  it('parent() on body returns html', () => {
    const parents = queryAll('body').parent();
    expect(parents.first().tagName).toBe('HTML');
  });

  it('children() with selector filters', () => {
    const col = queryAll('#main').children('.text');
    expect(col.length).toBe(3);
  });

  it('closest() returns self if it matches', () => {
    const col = queryAll('#main');
    expect(col.closest('#main').first()).toBe(document.getElementById('main'));
  });

  it('closest() returns empty when no match', () => {
    expect(queryAll('.text').closest('.nonexistent').length).toBe(0);
  });

  it('siblings() returns all siblings', () => {
    const sibs = queryAll('.first-p').siblings();
    // siblings() returns all sibling elements except self
    expect(sibs.length).toBeGreaterThanOrEqual(2);
  });

  it('next() at end returns empty', () => {
    const col = queryAll('.third-p');
    expect(col.next().length).toBe(0);
  });

  it('prev() at start returns empty', () => {
    const col = queryAll('.first-p');
    expect(col.prev().length).toBe(0);
  });
});


// ---------------------------------------------------------------------------
// DOM manipulation edge cases
// ---------------------------------------------------------------------------

describe('ZQueryCollection — DOM manipulation edge cases', () => {
  it('append with element node', () => {
    const newEl = document.createElement('div');
    newEl.id = 'appended-el';
    queryAll('#main').append(newEl);
    expect(document.getElementById('appended-el')).not.toBeNull();
    expect(document.getElementById('appended-el').parentElement.id).toBe('main');
  });

  it('prepend with element node', () => {
    const newEl = document.createElement('div');
    newEl.id = 'prepended-el';
    queryAll('#main').prepend(newEl);
    expect(document.getElementById('main').firstElementChild.id).toBe('prepended-el');
  });

  it('remove on already-removed element does not throw', () => {
    const col = queryAll('.text').eq(0);
    col.remove();
    expect(() => col.remove()).not.toThrow();
  });

  it('clone produces independent copy', () => {
    const original = queryAll('.first-p');
    const cloned = original.clone();
    cloned.addClass('cloned-class');
    expect(original.hasClass('cloned-class')).toBe(false);
    expect(cloned.hasClass('cloned-class')).toBe(true);
  });

  it('empty() on already empty element', () => {
    document.body.innerHTML = '<div id="empty"></div>';
    expect(() => queryAll('#empty').empty()).not.toThrow();
    expect(document.getElementById('empty').children.length).toBe(0);
  });
});


// ---------------------------------------------------------------------------
// Attribute edge cases
// ---------------------------------------------------------------------------

describe('ZQueryCollection — attribute edge cases', () => {
  it('attr() set with sequential calls sets multiple attributes', () => {
    document.body.innerHTML = '<div id="a"></div>';
    queryAll('#a').attr('data-x', '1').attr('data-y', '2').attr('title', 'test');
    const el = document.getElementById('a');
    expect(el.getAttribute('data-x')).toBe('1');
    expect(el.getAttribute('data-y')).toBe('2');
    expect(el.getAttribute('title')).toBe('test');
  });

  it('data() returns undefined for missing key', () => {
    expect(queryAll('#main').data('nonexistent')).toBeUndefined();
  });

  it('removeAttr on nonexistent attribute does not throw', () => {
    expect(() => queryAll('#main').removeAttr('data-nope')).not.toThrow();
  });
});


// ---------------------------------------------------------------------------
// css() advanced
// ---------------------------------------------------------------------------

describe('ZQueryCollection — css() advanced', () => {
  it('sets a single style property via object', () => {
    document.body.innerHTML = '<div id="s">test</div>';
    queryAll('#s').css({ color: 'green' });
    expect(document.getElementById('s').style.color).toBe('green');
  });

  it('sets multiple CSS properties', () => {
    document.body.innerHTML = '<div id="s2">test</div>';
    queryAll('#s2').css({ color: 'red', 'font-weight': 'bold', display: 'flex' });
    const el = document.getElementById('s2');
    expect(el.style.color).toBe('red');
    expect(el.style.display).toBe('flex');
  });
});


// ---------------------------------------------------------------------------
// $.create advanced
// ---------------------------------------------------------------------------

describe('query.create — advanced', () => {
  it('creates element with no attributes', () => {
    const col = query.create('span');
    expect(col.length).toBe(1);
    expect(col[0].tagName).toBe('SPAN');
  });

  it('creates element with multiple children', () => {
    const child1 = document.createElement('span');
    child1.textContent = 'span child';
    const col = query.create('div', {}, 'text', child1);
    expect(col[0].childNodes.length).toBe(2);
    expect(col[0].childNodes[0].textContent).toBe('text');
    expect(col[0].querySelector('span').textContent).toBe('span child');
  });

  it('creates element with boolean attributes', () => {
    const col = query.create('input', { type: 'text', disabled: '' });
    expect(col[0].tagName).toBe('INPUT');
    expect(col[0].getAttribute('type')).toBe('text');
  });
});


// ---------------------------------------------------------------------------
// Prop edge cases
// ---------------------------------------------------------------------------

describe('ZQueryCollection — prop() edge cases', () => {
  it('gets defaultValue property', () => {
    document.body.innerHTML = '<input value="initial">';
    const col = queryAll('input');
    expect(col.prop('defaultValue')).toBe('initial');
  });

  it('gets tagName property', () => {
    const col = queryAll('#main');
    expect(col.prop('tagName')).toBe('DIV');
  });

  it('prop on empty collection returns undefined', () => {
    expect(queryAll('.nonexistent').prop('checked')).toBeUndefined();
  });
});


// ---------------------------------------------------------------------------
// BUG FIX: siblings() with selector filtering + null parent guard
// ---------------------------------------------------------------------------

describe('ZQueryCollection — siblings() fixes', () => {
  it('filters siblings by selector', () => {
    document.body.innerHTML = '<div><p class="a">1</p><p class="b">2</p><p class="a">3</p></div>';
    const sibs = queryAll('.b').siblings('.a');
    expect(sibs.length).toBe(2);
  });

  it('returns all siblings when no selector given', () => {
    document.body.innerHTML = '<div><p>1</p><p id="mid">2</p><p>3</p></div>';
    const sibs = queryAll('#mid').siblings();
    expect(sibs.length).toBe(2);
  });

  it('does not crash on detached element (no parentElement)', () => {
    const detached = document.createElement('div');
    const col = new ZQueryCollection([detached]);
    expect(() => col.siblings()).not.toThrow();
    expect(col.siblings().length).toBe(0);
  });
});


// ---------------------------------------------------------------------------
// BUG FIX: ZQueryCollection constructor null safety
// ---------------------------------------------------------------------------

describe('ZQueryCollection — constructor null/undefined safety', () => {
  it('creates empty collection from null', () => {
    const col = new ZQueryCollection(null);
    expect(col.length).toBe(0);
  });

  it('creates empty collection from undefined', () => {
    const col = new ZQueryCollection(undefined);
    expect(col.length).toBe(0);
  });

  it('wraps a single element', () => {
    const el = document.createElement('div');
    const col = new ZQueryCollection(el);
    expect(col.length).toBe(1);
    expect(col[0]).toBe(el);
  });
});


// ---------------------------------------------------------------------------
// BUG FIX: attr() with object syntax
// ---------------------------------------------------------------------------

describe('ZQueryCollection — attr() object set', () => {
  it('sets multiple attributes with object', () => {
    document.body.innerHTML = '<div id="at"></div>';
    queryAll('#at').attr({ 'data-x': '1', 'data-y': '2', title: 'hello' });
    const el = document.getElementById('at');
    expect(el.getAttribute('data-x')).toBe('1');
    expect(el.getAttribute('data-y')).toBe('2');
    expect(el.getAttribute('title')).toBe('hello');
  });
});


// ---------------------------------------------------------------------------
// BUG FIX: css() two-argument setter
// ---------------------------------------------------------------------------

describe('ZQueryCollection — css() two-argument setter', () => {
  it('sets a CSS property with key-value arguments', () => {
    document.body.innerHTML = '<div id="cs">text</div>';
    queryAll('#cs').css('color', 'green');
    expect(document.getElementById('cs').style.color).toBe('green');
  });

  it('still works as getter with single string arg', () => {
    document.body.innerHTML = '<div id="cs2" style="color: red;">text</div>';
    const val = queryAll('#cs2').css('color');
    expect(val).toBeDefined();
  });

  it('still works as setter with object arg', () => {
    document.body.innerHTML = '<div id="cs3">text</div>';
    queryAll('#cs3').css({ color: 'blue', display: 'flex' });
    const el = document.getElementById('cs3');
    expect(el.style.color).toBe('blue');
    expect(el.style.display).toBe('flex');
  });
});


// ---------------------------------------------------------------------------
// BUG FIX: wrap() does not crash on empty/invalid wrapper
// ---------------------------------------------------------------------------

describe('ZQueryCollection — wrap() safety', () => {
  it('does not crash if wrapper string is empty', () => {
    document.body.innerHTML = '<div id="w"><p>inside</p></div>';
    expect(() => queryAll('#w p').wrap('')).not.toThrow();
  });

  it('does not crash on detached element (no parentNode)', () => {
    const detached = document.createElement('span');
    const col = new ZQueryCollection([detached]);
    expect(() => col.wrap('<div></div>')).not.toThrow();
  });
});


// ---------------------------------------------------------------------------
// BUG FIX: index() does not crash on detached element
// ---------------------------------------------------------------------------

describe('ZQueryCollection — index() null parent safety', () => {
  it('returns -1 for detached element', () => {
    const detached = document.createElement('div');
    const col = new ZQueryCollection([detached]);
    expect(col.index()).toBe(-1);
  });
});


// ---------------------------------------------------------------------------
// BUG FIX: delegated on() / off() handler removal
// ---------------------------------------------------------------------------

describe('ZQueryCollection — delegated on/off', () => {
  it('off() removes delegated event handlers', () => {
    document.body.innerHTML = '<div id="parent"><button class="btn">click</button></div>';
    const parent = new ZQueryCollection([document.getElementById('parent')]);
    const handler = vi.fn();

    parent.on('click', '.btn', handler);
    document.querySelector('.btn').click();
    expect(handler).toHaveBeenCalledTimes(1);

    parent.off('click', handler);
    document.querySelector('.btn').click();
    // Should not fire again after off()
    expect(handler).toHaveBeenCalledTimes(1);
  });
});


// ---------------------------------------------------------------------------
// BUG FIX: animate() resolves immediately on empty collection
// ---------------------------------------------------------------------------

describe('ZQueryCollection — animate() empty collection', () => {
  it('resolves immediately when collection is empty', async () => {
    const col = new ZQueryCollection([]);
    const result = await col.animate({ opacity: '0' }, 50);
    expect(result).toBe(col);
  });
});


// ===========================================================================
// one() — single-fire event listener
// ===========================================================================

describe('ZQueryCollection — one()', () => {
  it('fires handler only once', () => {
    const handler = vi.fn();
    document.body.innerHTML = '<button id="one-btn">click</button>';
    const col = query('#one-btn');
    col.one('click', handler);
    document.querySelector('#one-btn').click();
    document.querySelector('#one-btn').click();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});


// ===========================================================================
// toggle() — show/hide toggle
// ===========================================================================

describe('ZQueryCollection — toggle()', () => {
  it('hides a visible element', () => {
    const el = document.querySelector('#main');
    el.style.display = '';
    const col = query('#main');
    col.toggle();
    expect(el.style.display).toBe('none');
  });

  it('shows a hidden element', () => {
    const el = document.querySelector('#main');
    el.style.display = 'none';
    const col = query('#main');
    col.toggle();
    expect(el.style.display).toBe('');
  });

  it('uses custom display value when showing', () => {
    const el = document.querySelector('#main');
    el.style.display = 'none';
    const col = query('#main');
    col.toggle('flex');
    expect(el.style.display).toBe('flex');
  });
});


// ===========================================================================
// serialize() and serializeObject()
// ===========================================================================

describe('ZQueryCollection — serialize()', () => {
  it('serializes form inputs to URL-encoded string', () => {
    document.body.innerHTML = '<form id="f"><input name="user" value="Alice"><input name="age" value="30"></form>';
    const result = query('#f').serialize();
    expect(result).toContain('user=Alice');
    expect(result).toContain('age=30');
  });

  it('returns empty string for non-form element', () => {
    expect(query('#main').serialize()).toBe('');
  });
});

describe('ZQueryCollection — serializeObject()', () => {
  it('builds an object from form fields', () => {
    document.body.innerHTML = '<form id="f"><input name="user" value="Alice"><input name="age" value="30"></form>';
    expect(query('#f').serializeObject()).toEqual({ user: 'Alice', age: '30' });
  });

  it('groups duplicate keys into arrays', () => {
    document.body.innerHTML = `<form id="f">
      <input name="tags" value="a">
      <input name="tags" value="b">
      <input name="tags" value="c">
    </form>`;
    expect(query('#f').serializeObject()).toEqual({ tags: ['a', 'b', 'c'] });
  });

  it('returns empty object for non-form element', () => {
    expect(query('#main').serializeObject()).toEqual({});
  });
});


// ===========================================================================
// $.ready
// ===========================================================================

describe('$.ready', () => {
  it('calls function immediately when document is not loading', () => {
    const fn = vi.fn();
    query.ready(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});


// ===========================================================================
// $.name
// ===========================================================================

describe('$.name', () => {
  it('selects elements by name attribute', () => {
    document.body.innerHTML = '<input name="email" value="a@b.com"><input name="email" value="x@y.com"><input name="other">';
    const result = query.name('email');
    expect(result.length).toBe(2);
  });
});


// ===========================================================================
// $.create
// ===========================================================================

describe('$.create', () => {
  it('creates an element with attributes', () => {
    const col = query.create('div', { id: 'test', class: 'box' }, 'hello');
    const el = col.first();
    expect(el.tagName).toBe('DIV');
    expect(el.id).toBe('test');
    expect(el.className).toBe('box');
    expect(el.textContent).toBe('hello');
  });

  it('applies style object', () => {
    const col = query.create('span', { style: { color: 'red', fontSize: '20px' } });
    const el = col.first();
    expect(el.style.color).toBe('red');
    expect(el.style.fontSize).toBe('20px');
  });

  it('binds event handlers via on* attributes', () => {
    const handler = vi.fn();
    const col = query.create('button', { onclick: handler }, 'click me');
    col.first().click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('sets data attributes from data object', () => {
    const col = query.create('div', { data: { userId: '42', role: 'admin' } });
    const el = col.first();
    expect(el.dataset.userId).toBe('42');
    expect(el.dataset.role).toBe('admin');
  });

  it('appends child Node elements', () => {
    const child = document.createElement('span');
    child.textContent = 'child';
    const col = query.create('div', {}, child);
    const el = col.first();
    expect(el.children.length).toBe(1);
    expect(el.querySelector('span').textContent).toBe('child');
  });
});


// ===========================================================================
// data() — no key returns full dataset
// ===========================================================================

describe('ZQueryCollection — data() full dataset', () => {
  it('returns the full dataset when no key is given', () => {
    document.body.innerHTML = '<div id="d" data-x="1" data-y="2"></div>';
    const ds = query('#d').data();
    expect(ds.x).toBe('1');
    expect(ds.y).toBe('2');
  });
});


// ===========================================================================
// css() getter on empty collection
// ===========================================================================

describe('ZQueryCollection — css() empty collection', () => {
  it('returns undefined when collection is empty', () => {
    const col = new ZQueryCollection([]);
    expect(col.css('color')).toBeUndefined();
  });
});


// ===========================================================================
// append/prepend/after/before with Node
// ===========================================================================

describe('ZQueryCollection — append/prepend with Node', () => {
  it('appends a Node element', () => {
    document.body.innerHTML = '<div id="container"><p>existing</p></div>';
    const newNode = document.createElement('span');
    newNode.textContent = 'appended';
    query('#container').append(newNode);
    expect(document.querySelector('#container span').textContent).toBe('appended');
    expect(document.querySelector('#container').lastElementChild.tagName).toBe('SPAN');
  });

  it('prepends a Node element', () => {
    document.body.innerHTML = '<div id="container"><p>existing</p></div>';
    const newNode = document.createElement('span');
    newNode.textContent = 'prepended';
    query('#container').prepend(newNode);
    expect(document.querySelector('#container').firstElementChild.tagName).toBe('SPAN');
  });

  it('appends a ZQueryCollection', () => {
    document.body.innerHTML = '<div id="container"></div><span class="source">item</span>';
    const source = queryAll('.source');
    query('#container').append(source);
    expect(document.querySelector('#container span').textContent).toBe('item');
  });
});

describe('ZQueryCollection — after/before with Node', () => {
  it('inserts Node after element', () => {
    document.body.innerHTML = '<div id="anchor"></div>';
    const newNode = document.createElement('span');
    newNode.id = 'after';
    query('#anchor').after(newNode);
    expect(document.querySelector('#anchor').nextElementSibling.id).toBe('after');
  });

  it('inserts Node before element', () => {
    document.body.innerHTML = '<div id="anchor"></div>';
    const newNode = document.createElement('span');
    newNode.id = 'before';
    query('#anchor').before(newNode);
    expect(document.querySelector('#anchor').previousElementSibling.id).toBe('before');
  });
});


// ===========================================================================
// replaceWith using Node
// ===========================================================================

describe('ZQueryCollection — replaceWith(Node)', () => {
  it('replaces element with a Node', () => {
    document.body.innerHTML = '<div id="old">old</div>';
    const newNode = document.createElement('span');
    newNode.id = 'new';
    newNode.textContent = 'replaced';
    query('#old').replaceWith(newNode);
    expect(document.querySelector('#old')).toBeNull();
    expect(document.querySelector('#new').textContent).toBe('replaced');
  });
});


// ===========================================================================
// nextUntil/prevUntil/parentsUntil with filter
// ===========================================================================

describe('ZQueryCollection — nextUntil with filter', () => {
  it('collects siblings until stop selector, applying filter', () => {
    document.body.innerHTML = '<div id="start"></div><span class="a">A</span><p>P</p><span class="a">A2</span><div id="stop"></div>';
    const result = query('#start').nextUntil('#stop', 'span');
    expect(result.length).toBe(2); // only <span> siblings
  });
});

describe('ZQueryCollection — prevUntil with filter', () => {
  it('collects previous siblings until stop selector, applying filter', () => {
    document.body.innerHTML = '<div id="stop"></div><span>A</span><p>P</p><span>B</span><div id="end"></div>';
    const result = query('#end').prevUntil('#stop', 'span');
    expect(result.length).toBe(2);
  });
});

describe('ZQueryCollection — parentsUntil with filter', () => {
  it('collects parent elements until stop selector, applying filter', () => {
    document.body.innerHTML = '<section><article><div><span id="target"></span></div></article></section>';
    const result = query('#target').parentsUntil('section', 'div');
    expect(result.length).toBe(1);
    expect(result.first().tagName).toBe('DIV');
  });
});


// ===========================================================================
// delegated on() at document level
// ===========================================================================

describe('ZQueryCollection — delegated on()', () => {
  it('delegates event to matching child selector', () => {
    document.body.innerHTML = '<div id="container"><button class="action">click</button></div>';
    const handler = vi.fn();
    query('#container').on('click', '.action', handler);
    document.querySelector('.action').click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not fire for non-matching elements', () => {
    document.body.innerHTML = '<div id="container"><span class="other">x</span></div>';
    const handler = vi.fn();
    query('#container').on('click', '.action', handler);
    document.querySelector('.other').click();
    expect(handler).not.toHaveBeenCalled();
  });
});


// ===========================================================================
// Multi-event on/off
// ===========================================================================

describe('ZQueryCollection — multi-event on()', () => {
  it('binds handler to multiple space-separated events', () => {
    document.body.innerHTML = '<input id="inp" type="text">';
    const handler = vi.fn();
    query('#inp').on('focus blur', handler);
    document.querySelector('#inp').dispatchEvent(new Event('focus'));
    document.querySelector('#inp').dispatchEvent(new Event('blur'));
    expect(handler).toHaveBeenCalledTimes(2);
  });
});


// ===========================================================================
// scrollTop/scrollLeft getters
// ===========================================================================

describe('ZQueryCollection — scrollTop/scrollLeft', () => {
  it('gets and sets scrollTop', () => {
    document.body.innerHTML = '<div id="scr" style="overflow:auto; height: 50px;"><div style="height:200px;">x</div></div>';
    const el = document.querySelector('#scr');
    query('#scr').scrollTop(100);
    expect(el.scrollTop).toBe(100);
  });

  it('gets scrollTop value', () => {
    document.body.innerHTML = '<div id="scr" style="overflow:auto; height: 50px;"><div style="height:200px;">x</div></div>';
    document.querySelector('#scr').scrollTop = 50;
    expect(query('#scr').scrollTop()).toBe(50);
  });
});


// ===========================================================================
// slideDown/slideUp set styles
// ===========================================================================

describe('ZQueryCollection — slideDown/slideUp', () => {
  it('slideDown sets overflow hidden and maxHeight initially', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="slide" style="display:none;">content</div>';
    query('#slide').slideDown(100);
    const el = document.querySelector('#slide');
    expect(el.style.overflow).toBe('hidden');
    // maxHeight could be '0' or '0px' depending on jsdom normalization
    expect(el.style.maxHeight).toMatch(/^0(px)?$/);
    vi.advanceTimersByTime(100);
    vi.useRealTimers();
  });

  it('slideUp hides element after duration', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="slide">content</div>';
    query('#slide').slideUp(100);
    vi.advanceTimersByTime(100);
    expect(document.querySelector('#slide').style.display).toBe('none');
    vi.useRealTimers();
  });
});


// ===========================================================================
// fadeIn/fadeOut set opacity
// ===========================================================================

describe('ZQueryCollection — fadeIn/fadeOut', () => {
  it('fadeIn sets initial opacity to 0', () => {
    document.body.innerHTML = '<div id="fade" style="display:none;">content</div>';
    query('#fade').fadeIn(100);
    const el = document.querySelector('#fade');
    expect(el.style.opacity).toBe('0');
  });

  it('fadeTo animates to specified opacity', () => {
    document.body.innerHTML = '<div id="fade">content</div>';
    query('#fade').fadeTo(100, 0.5);
    // Animation starts — just verify no throw
    expect(document.querySelector('#fade')).not.toBeNull();
  });
});
