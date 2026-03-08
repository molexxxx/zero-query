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
import { component, mount, mountAll, getInstance, destroy, getRegistry, style } from './src/component.js';
import { createRouter, getRouter } from './src/router.js';
import { createStore, getStore } from './src/store.js';
import { http } from './src/http.js';
import { morph } from './src/diff.js';
import { safeEval } from './src/expression.js';
import {
  debounce, throttle, pipe, once, sleep,
  escapeHtml, html, trust, uuid, camelCase, kebabCase,
  deepClone, deepMerge, isEqual, param, parseQuery,
  storage, session, bus,
} from './src/utils.js';
import { ZQueryError, ErrorCode, onError, reportError } from './src/errors.js';


// ---------------------------------------------------------------------------
// $ — The main function & namespace
// ---------------------------------------------------------------------------

/**
 * Main selector function
 * 
 *   $('selector')         → single Element (querySelector)
 *   $('<div>hello</div>') → create element (first created node)
 *   $(element)            → return element as-is
 *   $(fn)                 → DOMContentLoaded shorthand
 * 
 * @param {string|Element|NodeList|Function} selector
 * @param {string|Element} [context]
 * @returns {Element|null}
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
$.attr     = query.attr;
$.data     = query.data;
$.children = query.children;

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
$.style       = style;
$.morph       = morph;
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

// --- Utilities -------------------------------------------------------------
$.debounce   = debounce;
$.throttle   = throttle;
$.pipe       = pipe;
$.once       = once;
$.sleep      = sleep;
$.escapeHtml = escapeHtml;
$.html       = html;
$.trust      = trust;
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
$.bus        = bus;

// --- Error handling --------------------------------------------------------
$.onError     = onError;
$.ZQueryError = ZQueryError;
$.ErrorCode   = ErrorCode;

// --- Meta ------------------------------------------------------------------
$.version = '__VERSION__';
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
  component, mount, mountAll, getInstance, destroy, getRegistry, style,
  morph,
  safeEval,
  createRouter, getRouter,
  createStore, getStore,
  http,
  ZQueryError, ErrorCode, onError, reportError,
  debounce, throttle, pipe, once, sleep,
  escapeHtml, html, trust, uuid, camelCase, kebabCase,
  deepClone, deepMerge, isEqual, param, parseQuery,
  storage, session, bus,
};

export default $;
