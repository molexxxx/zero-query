/**
 * ┌---------------------------------------------------------┐
 * │  zQuery (zeroQuery) — Lightweight Frontend Library     │
 * │                                                         │
 * │  jQuery-like selectors · Reactive components            │
 * │  SPA router · State management · Zero dependencies      │
 * │                                                         │
 * │  https://github.com/tonywied17/zero-query              │
 * └---------------------------------------------------------┘
 */

import { query, queryAll, ZQueryCollection } from './src/core.js';
import { reactive, Signal, signal, computed, effect } from './src/reactive.js';
import { component, mount, mountAll, getInstance, destroy, getRegistry, prefetch, style } from './src/component.js';
import { createRouter, getRouter } from './src/router.js';
import { createStore, getStore } from './src/store.js';
import { http } from './src/http.js';
import { morph, morphElement } from './src/diff.js';
import { safeEval } from './src/expression.js';
import {
  debounce, throttle, pipe, once, sleep,
  escapeHtml, stripHtml, html, trust, TrustedHTML, uuid, camelCase, kebabCase,
  deepClone, deepMerge, isEqual, param, parseQuery,
  storage, session, EventBus, bus,
  range, unique, chunk, groupBy,
  pick, omit, getPath, setPath, isEmpty,
  capitalize, truncate, clamp,
  memoize, retry, timeout,
} from './src/utils.js';
import { ZQueryError, ErrorCode, onError, reportError, guardCallback, validate } from './src/errors.js';


// ---------------------------------------------------------------------------
// $ — The main function & namespace
// ---------------------------------------------------------------------------

/**
 * Main selector function — always returns a ZQueryCollection (like jQuery).
 * 
 *   $('selector')         → ZQueryCollection (querySelectorAll)
 *   $('<div>hello</div>') → ZQueryCollection from created elements
 *   $(element)            → ZQueryCollection wrapping the element
 *   $(fn)                 → DOMContentLoaded shorthand
 * 
 * @param {string|Element|NodeList|Function} selector
 * @param {string|Element} [context]
 * @returns {ZQueryCollection}
 */
function $(selector, context) {
  // $(fn) → DOM ready shorthand
  if (typeof selector === 'function') {
    query.ready(selector);
    return;
  }
  return query(selector, context);
}


// --- Quick refs (DOM selectors) --------------------------------------------
$.id       = query.id;
$.class    = query.class;
$.classes  = query.classes;
$.tag      = query.tag;
Object.defineProperty($, 'name', {
  value: query.name, writable: true, configurable: true
});
$.children = query.children;
$.qs       = query.qs;
$.qsa      = query.qsa;

// --- Collection selector ---------------------------------------------------
/**
 * Collection selector (like jQuery's $)
 * 
 *   $.all('selector')         → ZQueryCollection (querySelectorAll)
 *   $.all('<div>hello</div>') → create elements as collection
 *   $.all(element)            → wrap element in collection
 *   $.all(nodeList)           → wrap NodeList in collection
 * 
 * @param {string|Element|NodeList|Array} selector
 * @param {string|Element} [context]
 * @returns {ZQueryCollection}
 */
$.all = function(selector, context) {
  return queryAll(selector, context);
};

// --- DOM helpers -----------------------------------------------------------
$.create   = query.create;
$.ready    = query.ready;
$.on       = query.on;
$.off      = query.off;
$.fn       = query.fn;

// --- Reactive primitives ---------------------------------------------------
$.reactive = reactive;
$.Signal   = Signal;
$.signal   = signal;
$.computed = computed;
$.effect   = effect;

// --- Components ------------------------------------------------------------
$.component   = component;
$.mount       = mount;
$.mountAll    = mountAll;
$.getInstance = getInstance;
$.destroy     = destroy;
$.components  = getRegistry;
$.prefetch    = prefetch;
$.style       = style;
$.morph        = morph;
$.morphElement = morphElement;
$.safeEval    = safeEval;

// --- Router ----------------------------------------------------------------
$.router    = createRouter;
$.getRouter = getRouter;

// --- Store -----------------------------------------------------------------
$.store    = createStore;
$.getStore = getStore;

// --- HTTP ------------------------------------------------------------------
$.http   = http;
$.get    = http.get;
$.post   = http.post;
$.put    = http.put;
$.patch  = http.patch;
$.delete = http.delete;
$.head   = http.head;

// --- Utilities -------------------------------------------------------------
$.debounce   = debounce;
$.throttle   = throttle;
$.pipe       = pipe;
$.once       = once;
$.sleep      = sleep;
$.escapeHtml = escapeHtml;
$.stripHtml  = stripHtml;
$.html       = html;
$.trust      = trust;
$.TrustedHTML = TrustedHTML;
$.uuid       = uuid;
$.camelCase  = camelCase;
$.kebabCase  = kebabCase;
$.deepClone  = deepClone;
$.deepMerge  = deepMerge;
$.isEqual    = isEqual;
$.param      = param;
$.parseQuery = parseQuery;
$.storage    = storage;
$.session    = session;
$.EventBus   = EventBus;
$.bus        = bus;
$.range      = range;
$.unique     = unique;
$.chunk      = chunk;
$.groupBy    = groupBy;
$.pick       = pick;
$.omit       = omit;
$.getPath    = getPath;
$.setPath    = setPath;
$.isEmpty    = isEmpty;
$.capitalize = capitalize;
$.truncate   = truncate;
$.clamp      = clamp;
$.memoize    = memoize;
$.retry      = retry;
$.timeout    = timeout;

// --- Error handling --------------------------------------------------------
$.onError        = onError;
$.ZQueryError    = ZQueryError;
$.ErrorCode      = ErrorCode;
$.guardCallback  = guardCallback;
$.validate       = validate;

// --- Meta ------------------------------------------------------------------
$.version = '__VERSION__';
$.libSize = '__LIB_SIZE__';
$.meta    = {};                // populated at build time by CLI bundler

$.noConflict = () => {
  if (typeof window !== 'undefined' && window.$ === $) {
    delete window.$;
  }
  return $;
};


// ---------------------------------------------------------------------------
// Global exposure (browser)
// ---------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  window.$ = $;
  window.zQuery = $;
}


// ---------------------------------------------------------------------------
// Named exports (ES modules)
// ---------------------------------------------------------------------------
export {
  $,
  $ as zQuery,
  ZQueryCollection,
  queryAll,
  reactive, Signal, signal, computed, effect,
  component, mount, mountAll, getInstance, destroy, getRegistry, prefetch, style,
  morph, morphElement,
  safeEval,
  createRouter, getRouter,
  createStore, getStore,
  http,
  ZQueryError, ErrorCode, onError, reportError, guardCallback, validate,
  debounce, throttle, pipe, once, sleep,
  escapeHtml, stripHtml, html, trust, TrustedHTML, uuid, camelCase, kebabCase,
  deepClone, deepMerge, isEqual, param, parseQuery,
  storage, session, EventBus, bus,
  range, unique, chunk, groupBy,
  pick, omit, getPath, setPath, isEmpty,
  capitalize, truncate, clamp,
  memoize, retry, timeout,
};

export default $;
