# zQuery — Codebase Audit & Improvement Plan

_Generated 2026-05-23. Based on a thorough read of `src/` (≈6,800 LOC across 11 files) at commit `1388655` (`v1.2.0`)._

This is a **prioritized, surgical** plan — no rewrites, no architectural overhauls. Every item points to a real line range, has a concrete change, and (where relevant) a measured or estimated win.

---

## TL;DR

zQuery is well-engineered: LIS-based keyed reconciliation, AST-cached CSP-safe expressions, TreeWalker-based directive scanning, microtask-batched reactive scheduler, modern fallbacks (`crypto.randomUUID`, `AbortSignal.any`, `CSS.escape`, `structuredClone` in `utils`). The audit found:

- **0 critical exploits**
- **6 latent bugs** worth fixing
- **~12 high-impact perf wins** (chiefly: stop using `JSON.parse(JSON.stringify())` in `store.js`, batch directive scans, filter `MutationObserver`)
- **~600–1200 bytes** of bundle-size wins from dedup + modern API swaps
- **3 real memory-leak vectors** (unbounded keep-alive cache, repeated style injection, debounce/throttle teardown via `querySelectorAll('*')`)
- **~25 worthwhile test additions**

The proposed plan is broken into 5 phases, each landable independently as its own PR with a clear acceptance check.

---

## Phase 1 — Quick wins (safe, mechanical, no API change)

_Goal: clean wins with zero risk. Should land in one commit per file group._

### 1.1 — Replace `JSON.parse(JSON.stringify(...))` in [src/store.js](src/store.js) with `structuredClone()`
6 call sites:
- [src/store.js#L49](src/store.js#L49) — `_initialState` snapshot
- [src/store.js#L111](src/store.js#L111) — checkpoint snapshot
- [src/store.js#L125](src/store.js#L125) — undo snapshot
- [src/store.js#L138](src/store.js#L138) — redo snapshot
- [src/store.js#L231](src/store.js#L231) — `getState()`
- [src/store.js#L264](src/store.js#L264) — `reset()`

Use the already-exported `deepClone()` from [src/utils.js#L147](src/utils.js#L147) (which prefers `structuredClone`, falls back to JSON). Drops `Date`, `Map`, `Set`, typed-array, and circular-ref corruption. **Perf**: 5–10× faster for non-trivial state.

### 1.2 — Dedup helpers
- `escapeHtml` defined in both `core.js` and re-imported in `component.js` — keep one in `utils.js`, import everywhere.
- `_shallowEqual` duplicated in `router.js` + `component.js` — move to `utils.js` (internal export).
- `_getPath` / `_setPath` defined in `component.js` (~L195–240) duplicate `getPath`/`setPath` in `utils.js` — import.

### 1.3 — Drop `pkgMinFile` dead var in [cli/commands/bundle.js#L1061](cli/commands/bundle.js#L1061) and other ESLint-flagged unused vars (currently warnings):
- `cli/commands/bundle.js#L274` `inlineTags`
- `cli/commands/build.js#L133` `buildApi`
- `cli/commands/build-api.js#L363` `pkg`
- `src/router.js#L20` `destroy`
- `src/expression.js#L576/L582` `SAFE_MATH_PROPS`/`SAFE_JSON_PROPS` (if truly unused; otherwise export)
- `src/component.js#L766` `selector`

### 1.4 — `Object.hasOwn` instead of `in` / `hasOwnProperty.call` in `utils.deepMerge` (and audit `core.js`, `component.js`).

### 1.5 — Replace manual `appendChild` loops with `Element.replaceChildren()` in [src/core.js](src/core.js) `wrap`/`wrapAll`/`wrapInner` (~L667–725).

**Acceptance:** all 2508 tests pass; minified bundle drops by ≥300 bytes; no public API change.

---

## Phase 2 — Real bugs

### 2.1 — Unbounded keep-alive cache in [src/router.js](src/router.js) (~L590–605)
Add optional `keepAliveMax` to router config; LRU-evict beyond limit. Today a long-lived SPA visiting many routes will retain every component instance forever.

### 2.2 — `z-model` listener stacking on keyed reconciliation
[src/component.js](src/component.js) (~L1395–1410) — `_zqModelBound` flag does not survive keyed replacement of an `<input>`; new node may inherit the flag via clone path. Test by mounting → re-keying → typing; assert single listener via spy.

### 2.3 — Repeated style-sheet injection
[src/component.js](src/component.js) (~L1301–1318) — same `styleUrl` mounted N times appends N `<style>` tags. Cache by `styleUrl` (Map<url, HTMLStyleElement>), insert once, increment ref count, remove on last destroy.

### 2.4 — `destroy()` walks `querySelectorAll('*')` to clear timers
[src/component.js](src/component.js) (~L1616–1632) — use the existing `_debounceTimers` / `_throttleTimers` WeakMaps directly. O(timers) vs O(DOM size).

### 2.5 — `http.js` Content-Type detection ordering
[src/http.js](src/http.js) (~L117–133) — check `contentType.includes('application/json')` BEFORE attempting `JSON.parse`. Avoids try/catch on every text/html response.

### 2.6 — `ssr.renderShell` regex fragility
[src/ssr.js](src/ssr.js) (~L212–221) — meta-tag replace patterns assume single-space attribute separators. Use a permissive pattern (`/\s+/` between attrs) or one-shot tokenizer.

**Acceptance:** new regression tests in `router.test.js`, `component.test.js`, `http.test.js`, `ssr.test.js` cover each fix; tests fail before patch, pass after.

---

## Phase 3 — Performance (high-impact, measurable)

### 3.1 — Batch directive scans in `_processDirectives`
[src/component.js](src/component.js) (~L1150–1225) issues separate `querySelectorAll` per directive (`[z-if]`, `[z-show]`, `[:*]`, `[z-class]`, `[z-style]`, `[z-stream]`). Replace with a single `TreeWalker` (or one `querySelectorAll('[z-if],[z-show],[\\:],[z-class],[z-style],[z-stream]')` and partition by `attributes`). **Estimated win:** ~1.5–2× for medium components (50–200 nodes).

### 3.2 — Filter `MutationObserver` to observed props only
[src/component.js](src/component.js) (~L369–376) — pass `attributeFilter: [...propNames]` to `observe()`. Today every unrelated attribute change re-runs prop pickup.

### 3.3 — Cache expression evaluation results per (expr, scope-hash) in render pass
[src/expression.js](src/expression.js) — currently caches the parsed AST; doesn't cache evaluation. For static-ish bindings (`{{ user.name }}` when `user` hasn't changed), a per-render-tick cache keyed by `(astId, scopeVersion)` would short-circuit re-eval. Requires bumping a `scopeVersion` counter on each reactive write. **Estimated win:** 10–30% for render-heavy lists.

### 3.4 — Avoid re-walking text nodes for `{{}}` if no interpolations exist
[src/component.js](src/component.js) — first-mount cache a `Set<Element>` of nodes that contain `{{` and only scan those on subsequent morphs.

### 3.5 — `diff.js` LIS — skip pass when no keyed children
[src/diff.js](src/diff.js) (~L153–L497) — short-circuit the keyed branch when neither old nor new have a `data-key`. Falls back to plain index morph. Already partially done; audit for completeness.

### 3.6 — `core.js` `.attr()` single-attribute fast path
[src/core.js](src/core.js) (~L234–273) — mirror the existing class-fast-path for the common `attr('name', value)` case.

### 3.7 — Use `requestAnimationFrame` for layout-read-then-write directives
Audit `z-show`, transitions, and any directive that reads `offsetHeight` / `getBoundingClientRect` then writes a class — group reads via `rAF` to avoid forced sync layout.

**Acceptance:** add micro-benchmarks under `tests/bench/` (vitest `bench` API) for: mount cost (50/200/1000 nodes), keyed reorder, expression eval. CI publishes timings; PR requires no regression >5%.

---

## Phase 4 — Modern web platform replacements

### 4.1 — `Element.replaceChildren()` everywhere appropriate (Phase 1.5 extends here).
### 4.2 — `Element.toggleAttribute(name, force)` for boolean `z-bind` attrs.
### 4.3 — `URL` and `URLSearchParams` for `parseQuery`/`param` in [src/utils.js](src/utils.js) instead of hand-rolled parser. Smaller minified, spec-correct.
### 4.4 — `EventTarget` as the base class for `EventBus` in [src/utils.js](src/utils.js) — get `addEventListener({once})`, `signal`-based removal, and bubbling for free.
### 4.5 — `AbortSignal` integration in `debounce`/`throttle`/`http` (already partial in http) — pass `{ signal }` for cancellation.
### 4.6 — `CSS.escape()` for any selector built from user input (audit `core.js`, `router.js`).
### 4.7 — `Object.groupBy` (Node 21+, all modern browsers) in `utils.groupBy` with fallback.
### 4.8 — `URLPattern` (where supported) as an opt-in path matcher for `router.js`; current regex remains fallback.

**Acceptance:** feature-detect each; ship a `__POLYFILLS__` block that's tree-shaken in modern builds.

---

## Phase 5 — Security hardening & DX

### 5.1 — Expression length cap in [src/expression.js](src/expression.js) — refuse to parse expressions > 8 KB or AST depth > 32. Returns a typed `ZQueryError` instead of stack overflow.
### 5.2 — `router.parseLinkParams` — assert `typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)` after `JSON.parse`.
### 5.3 — `store.js` snapshot helpers — accept an optional `clone: false` option for read-only callers who don't need a deep copy (huge perf win when the caller treats state as immutable anyway).
### 5.4 — JSDoc pass on `core.js` chainable methods (`@returns {ZQueryCollection}`); `component.js` `@event` syntax with examples; `expression.js` documented grammar / precedence; `router.js` `z-link-params` format.
### 5.5 — Document footguns in `README.md` / `docs/`:
  - effects MUST be disposed
  - components without `destroy()` will leak `.outside` listeners
  - `z-debounce` value is captured at mount; changing it requires re-mount

---

## Test additions (lands alongside relevant phase)

Concrete missing tests (highest priority):
1. [tests/component.test.js](tests/component.test.js) — `z-model` on checkbox/radio/select/number/date/contenteditable; `z-debounce` rapid input; nested `z-for`; `z-for` over object; props via `:prop`; `connectStore`; external `templateUrl` + `{{}}`.
2. [tests/diff.test.js](tests/diff.test.js) — keyed list of 100 items shuffled (asserts LIS does ≤N moves); `z-skip` honored; all-keyed vs mixed-keyed.
3. [tests/router.test.js](tests/router.test.js) — redirect loop aborts after N hops; keep-alive cache with LRU; sub-route history back-button; chained guards; encoded route params.
4. [tests/expression.test.js](tests/expression.test.js) — `?.` + `??` combinations; spread in array/object literals; AST cache churn > 512; error messages do not leak source positions of secrets.
5. [tests/http.test.js](tests/http.test.js) — `Content-Type: text/html; charset=utf-8`; timeout race; FormData binary upload; interceptor mutating url/headers.
6. [tests/store.test.js](tests/store.test.js) — undo/redo nested; batch dedup; middleware that mutates args.
7. [tests/utils.test.js](tests/utils.test.js) — `deepClone` circular refs; `memoize` LRU eviction; `retry` backoff timing.

---

## Speculative / future (do not block on)

- `provide` / `inject` for deep prop passing
- Time-travel devtools panel via action recorder
- Auto-prefetch on `z-link` hover (IntersectionObserver + `Link rel=prefetch`)
- Request deduplication in `http.js` (return shared promise for in-flight identical requests)
- Lazy slot rendering
- Async SSR (`renderToString` returning a promise for components that load remote templates)

---

## Phase ordering & PR plan

| Phase | Risk | Test deltas | LOC | Suggested PR title |
|---|---|---|---|---|
| 1 — Quick wins | very low | +1 unit test | ~80 | `chore: dedup helpers, structuredClone, modern APIs` |
| 2 — Bug fixes | low (touches scheduler) | +6 regression tests | ~150 | `fix: keep-alive LRU, z-model rebind, style dedup, http content-type` |
| 3 — Perf | medium (renderer) | +bench suite | ~250 | `perf: batch directive scans, scoped MutationObserver, eval cache` |
| 4 — Modern APIs | low | +platform-detect tests | ~120 | `feat: adopt replaceChildren, URL, EventTarget, URLPattern (opt-in)` |
| 5 — Security & DX | very low | +5 sec tests | ~100 + JSDoc | `feat: expression caps, link-params validation, JSDoc pass` |

---

## Kickoff prompt (copy this to start)

> Work through `AUDIT.md` Phase 1 only. Do not touch anything outside Phase 1's bullet points. For each item:
>
> 1. Make the surgical change.
> 2. Run `npm test` — confirm 2508/2508 still pass.
> 3. Run `npm run lint` — confirm 0 errors (warnings tolerated).
> 4. Run `npm run build` — confirm minified bundle size dropped (report before/after in KB).
>
> When Phase 1 is fully landed in one commit with a message like `chore: phase 1 quick wins (audit)`, stop and report the bundle delta + test pass count. Do not start Phase 2 until I say so.
>
> Constraints:
> - No new dependencies.
> - No public API changes (additive only if needed).
> - Use `deepClone` from `src/utils.js` in `src/store.js` — do not re-implement.
> - Keep esbuild-compatible (no top-level `await`, no decorators).
> - If any test fails after a change, revert that one item and continue with the rest; flag the skipped item in the commit body.

After Phase 1 lands cleanly, run the equivalent prompt with `Phase 2`, then `Phase 3`, etc.
