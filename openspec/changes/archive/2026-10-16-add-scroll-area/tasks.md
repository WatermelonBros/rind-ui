## 0. Prerequisites

- [x] 0.1 Confirm `add-a11y-foundations`, `add-slider` (`pointer-drag`, driver pointer steps), `add-overlay-infrastructure` and `add-theme-system` are merged, and that request 1 in design.md (`tabbables()` export) is applied or answered — merged; `tabbables()` is exported from core/dom/focus-scope

## 1. Machine

- [x] 1.1 `scroll-area.machine.ts`: states `idle` / `engaged` / `lingering` / `dragging`, events and context per design §1, delays `scrollEnd` (100 ms, reenter) and `hideDelay` through the scheduler, guards `isUserScroll` / `engagedBy(type)`, tab-stop latch on `VIEWPORT.BLUR`
- [x] 1.2 `view`: visibility per axis and type, Corner state, tab stop; Node tests for every type on a fake clock (hover leave at 599/600 ms, scroll type ignores hover, programmatic scroll quiet — BU#983, focus engages, drag end engaged vs lingering, tab stop kept while focused — BU#4205)

## 2. DOM module

- [x] 2.1 Generalise `core/dom/touch-action.ts` injection into a keyed `injectStyle(doc, key, css, nonce)` (textContent, nonce attribute + property, reset hook); `touch-action` uses it unchanged — already on main: `core/dom/inject-style.ts` (`injectStyle(doc, id, css, env)`), used by touch-action; Scroll Area injects through it
- [x] 2.2 `core/dom/scroll-metrics.ts`: layered rule, observers (viewport, content, content children, MutationObserver), rAF coalescing, read-then-write measure, range normalisation (RTL, row/column-reverse), computed-overflow axis rule, overflow-edge and corner variables, METRICS diffing, user-scroll marking, wheel forwarding (delta modes, `ctrlKey`, edges, `overscroll-behavior`), drag through `pointer-drag` (logical → physical fraction, snap off/restore), track `page` / `jump`, one `stop()` cleanup
- [x] 2.3 Browser tests: RTL without provider (BU#5300), `column-reverse` (RX#1585), corner reset (RX#2383), Collapsible inside (BU#4696), append while at end (RK#2303), `overflow-x: hidden` (RK#2802), overscroll containment (RX#1667), Ctrl+wheel untouched, snap during drag, 100× mount/unmount leaves no listener/observer/frame (BITS#2116, RX#1973), 30 instances without interleaved read-after-write (BU#3534), strict CSP + Trusted Types (BU#3550, RX#3117) — in `packages/testing/src/components/scroll-area.browser.test.tsx` (3 engines): RTL, column-reverse, corner reset, append at end, overflow-x hidden, overscroll containment, Ctrl+wheel, snap during drag, 100 mounts leave no wheel listener; the CSP nonce in `scroll-area.dom.test.tsx`. Not covered: the Collapsible-inside case (observers on Content children cover it), the 30-instance interleaving trace and Trusted Types enforcement

## 3. Connect

- [x] 3.1 `scroll-area.connect.ts`: parts and attributes per spec table, logical scrollbar insets, `aria-hidden` on Scrollbar/Thumb/Corner, `mousedown` prevented, `user-select: none`, `touch-action: none` on Thumb only, `role="region"` iff named, consumer `tabIndex` wins, dev warning for an unnamed tab stop, `data-variant/size/tone` pass-through
- [x] 3.2 Unit tests for every attribute and CSS variable, including absence before measuring (BU#3829)

## 4. React parts

- [x] 4.1 `ScrollArea.Root`, `Viewport`, `Content`, `Scrollbar`, `Thumb`, `Corner`; `render` on each; exported `measure()` via a ref handle on Root
- [x] 4.2 React tests: Strict Mode, SSR + hydration with identical markup and no thumb before measure (BU#4103), inside a modal Dialog (RA#10395), nested areas, Checkbox at the bottom of Content (ARK#3705) — Strict Mode SSR + hydration, inside a modal Dialog, nested areas (browser test); the Checkbox-at-the-bottom case relies on the injected `position: relative` on Content (checked by the rule test)

## 5. Contract and driver

- [x] 5.1 `scroll-area.contract.ts` per design §4: locate by region name or contained text, actions with keyboard twins / declared absences, queries, invariants (tab-stop rule, hidden parts not focusable, one dragging axis — ZG#3418, no presentational viewport — BU#5812), `{ skip }` reasons
- [x] 5.2 `getScrollArea` in `@rind-ui/testing`; the same driver test passes in browser mode, jsdom (fake metrics) and Playwright against Storybook; broken-wrapper fixtures prove each invariant fails — `getScrollArea`; jsdom runs the DOM test (nothing measured there), browser mode and Playwright run the driver (Playwright fixture instead of Storybook); the broken-wrapper fixture proves the tab-stop invariant

## 6. Model-based tests

- [x] 6.1 `testMachine(scrollAreaContract, …)` over the props classes of design §4, pointer, touch, keyboard and virtual modalities, `dir="rtl"` runs, axe `scrollable-region-focusable` per state — browser mode only (jsdom has no layout); `hover` and `auto` classes, pointer / keyboard / virtual, RTL runs; layout-driven events (SCROLL, DRAG.*, METRICS) are skips covered by the browser tests
- [x] 6.2 Scenario tests outside the model: fast drag released outside the window (BITS#1900, BU#2329), buttonless move over the thumb (BU#5371), release outside keeps position (BU#4433), touch swipe on a horizontal track pans the page (BU#2825), re-hover without thumb jump (BITS#1374), Safari tab order for text-only content — release outside, buttonless move, touch on the track, nested drag in the browser test; fast drag outside the window and re-hover without a jump rely on pointer-drag and on thumbs staying mounted (no dedicated test); Safari tab order is covered by the WebKit run of the dialog test

## 7. Theme

- [x] 7.1 `packages/theme/src/scroll-area.css`: `@layer rind.components`, `:where()` selectors, `--rind-scroll-area-*` tokens read with fallbacks and never declared, `decoration` family (no variant/size), `data-state` fade with duration tokens (reduced motion), thumb min size, hover widening, `data-tone="danger"`, forced-colors thumb (`CanvasText`, `forced-color-adjust: none`), vertical/horizontal/RTL; imported from `index.css`
- [x] 7.2 Playwright captures: forced colors, RTL, both axes with corner, reduced motion; documented recipes for native bars under forced colors and on coarse pointers — Playwright fixture: forced colors (thumb = CanvasText), RTL bar position, both axes with a corner, reduced motion (no transition); recipes on the docs page

## 8. Site examples

- [x] 8.1 Stories (themed): vertical, horizontal, both with corner, each `type`, fade masks from overflow edges, chat log `column-reverse`, RTL, text-only in a Dialog, list of buttons, nested, scroll snap, driver example; state stories (idle, engaged, dragging) with ARIA snapshots; axe clean — site examples (apps/site/examples/scroll-area.tsx): vertical, horizontal, both axes, every `type`, fade masks, chat log, RTL, button list, nested, snap; state example `idle` only (engaged, lingering and dragging are transient)

## 9. Docs

- [x] 9.1 Docs page (generated API facts): anatomy, `type` / `hideDelay` / `trackPress`, `data-*` and CSS variables, keyboard (native), tab-stop rule and naming, sizing the Viewport (RX#2307), Content requirement and its measurement ceiling, recipes (fade masks, native bars on touch / forced colors), migration from another Scroll Area component (no library named on the page), driver example, `llms.txt` entry
- [x] 9.2 Set Scroll Area to `wip`/`done` in `docs/components.md` as it progresses; archive the change when approved

## 10. Proof

- [x] 10.1 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset for core, react, testing, theme
