/**
 * DOM diffing, safe expression evaluator, and directive metadata.
 *
 * @module misc
 */

// ---------------------------------------------------------------------------
// DOM Diffing (Morphing)
// ---------------------------------------------------------------------------

/**
 * Morph an existing DOM element's children to match new HTML.
 * Only touches nodes that actually differ - preserves focus, scroll
 * positions, video playback, and other live DOM state.
 *
 * Use `z-key="uniqueId"` attributes on list items for keyed reconciliation.
 * Elements with `id`, `data-id`, or `data-key` attributes are auto-keyed.
 *
 * @param rootEl The live DOM container to patch.
 * @param newHTML The desired HTML string.
 */
export function morph(rootEl: Element, newHTML: string): void;

/**
 * Morph a single element in place - diffs attributes and children
 * without replacing the node reference. If the tag name matches, the
 * element is patched in place (preserving identity). If the tag differs,
 * the element is replaced.
 *
 * @param oldEl The live DOM element to patch.
 * @param newHTML HTML string for the replacement element.
 * @returns The resulting element (same ref if morphed, new if replaced).
 */
export function morphElement(oldEl: Element, newHTML: string): Element;

// ---------------------------------------------------------------------------
// Safe Expression Evaluator
// ---------------------------------------------------------------------------

/**
 * CSP-safe expression evaluator. Parses and evaluates JS expressions
 * without `eval()` or `new Function()`. Used internally by directives.
 *
 * @param expr  Expression string.
 * @param scope Array of scope objects checked in order for identifier resolution.
 * @returns Evaluation result, or `undefined` on error.
 */
export function safeEval(expr: string, scope: object[]): any;

// ---------------------------------------------------------------------------
// Directive System
// ---------------------------------------------------------------------------
//
// Directives are special attributes processed by zQuery's component renderer.
// They work in both `render()` template literals and external `templateUrl`
// HTML files. All expressions evaluate in the component's state context
// (bare names resolve to `this.state.*`; `props` and `refs` also available).
//
// ─── Structural Directives ──────────────────────────────────────────────
//
//   z-if="expression"          Conditional rendering - element removed when falsy.
//   z-else-if="expression"     Else-if branch (must be immediate sibling of z-if).
//   z-else                     Default branch (must follow z-if or z-else-if).
//
//   z-for="item in items"      List rendering - repeats the element per item.
//     {{item.prop}}              Use double-brace interpolation for item data.
//     (item, index) in items     Destructured index support.
//     n in 5                     Number range → [1, 2, 3, 4, 5].
//     (val, key) in object       Object iteration → {key, value} entries.
//
//   z-key="uniqueId"           Keyed reconciliation for list items.
//                              Preserves DOM nodes across reorders. Use inside
//                              z-for to give each item a stable identity.
//                              Example: <li z-for="item in items" z-key="{{item.id}}">
//
//   z-show="expression"        Toggle `display: none` (element stays in DOM).
//
// ─── Attribute Directives ───────────────────────────────────────────────
//
//   z-bind:attr="expression"   Dynamic attribute binding.
//   :attr="expression"         Shorthand for z-bind:attr.
//                              false/null/undefined → removes the attribute.
//                              true → sets empty attribute (e.g. disabled="").
//
//   z-class="expression"       Dynamic class binding.
//                              String: space-separated class names.
//                              Array: list of class names (falsy filtered).
//                              Object: { className: condition } map.
//
//   z-style="expression"       Dynamic inline styles.
//                              String: appended to existing cssText.
//                              Object: { property: value } map (camelCase keys).
//
//   z-html="expression"        Set innerHTML from expression (use trusted content only).
//   z-text="expression"        Set textContent from expression (safe, no HTML).
//
// ─── Form & Reference Directives ────────────────────────────────────────
//
//   z-model="stateKey"         Two-way binding for form elements.
//     Supports: input, textarea, select, select[multiple], contenteditable.
//     Nested keys: z-model="user.name" → this.state.user.name.
//     Modifiers (boolean attributes on same element):
//       z-lazy    - update on 'change' instead of 'input' (update on blur).
//       z-trim    - auto .trim() whitespace before writing to state.
//       z-number  - force Number() conversion regardless of input type.
//
//   z-ref="name"               Element reference → this.refs.name.
//
// ─── Event Directives ───────────────────────────────────────────────────
//
//   @event="method"            Event binding with delegation (shorthand).
//   z-on:event="method"        Event binding with delegation (full syntax).
//   @event="method(args)"      Pass arguments: strings, numbers, booleans,
//                              null, $event, state.key references.
//
//   Event Modifiers (chainable with dots):
//     .prevent                 event.preventDefault()
//     .stop                    event.stopPropagation()
//     .self                    Only fire if event.target === element itself.
//     .once                    Handler fires at most once per element.
//     .capture                 addEventListener with { capture: true }.
//     .passive                 addEventListener with { passive: true }.
//     .debounce.{ms}           Debounce: delay until {ms}ms idle (default 250).
//     .throttle.{ms}           Throttle: invoke at most once per {ms}ms (default 250).
//
// ─── Special Directives ─────────────────────────────────────────────────
//
//   z-cloak                    Hidden until rendered (auto-removed after mount).
//                              Global CSS: [z-cloak] { display: none !important }.
//                              Also injects: *, *::before, *::after { -webkit-tap-highlight-color: transparent }.
//
//   z-pre                      Skip all directive processing for this element
//                              and its descendants.
//
// ─── Slot System ────────────────────────────────────────────────────────
//
//   <slot>                     Default slot - replaced with child content
//                              passed by the parent component.
//   <slot name="header">       Named slot - replaced with child content that
//                              has a matching slot="header" attribute.
//   <slot>fallback</slot>      Fallback content shown when no slot content provided.
//
//   Parent usage:
//     <my-component>
//       <h1 slot="header">Title</h1>   (→ named slot "header")
//       <p>Body text</p>               (→ default slot)
//     </my-component>
//
// ─── Processing Order ───────────────────────────────────────────────────
//
//   1. z-for        (pre-innerHTML expansion)
//   2. z-if chain   (DOM removal)
//   3. z-show       (display toggle)
//   4. z-bind / :   (dynamic attributes)
//   5. z-class      (dynamic classes)
//   6. z-style      (dynamic styles)
//   7. z-html/text  (content injection)
//   8. @/z-on       (event binding)
//   9. z-ref        (element references)
//  10. z-model      (two-way binding)
//  11. z-cloak      (attribute removal)
//
// ---------------------------------------------------------------------------

/**
 * Supported event modifier strings for `@event` and `z-on:event` bindings.
 * Modifiers are appended to the event name with dots, e.g. `@click.prevent.stop`.
 */
export type EventModifier =
  | 'prevent'
  | 'stop'
  | 'self'
  | 'once'
  | 'capture'
  | 'passive'
  | `debounce`
  | `debounce.${number}`
  | `throttle`
  | `throttle.${number}`;
