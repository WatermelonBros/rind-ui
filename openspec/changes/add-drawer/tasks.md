## 0. Prerequisites

- [x] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-overlay-infrastructure` and `add-dialog` are applied
- [x] 0.2 Confirm the requests in design.md "Requests to other changes" are done: `buildDialogMachine` extension points and drawer as an eligible dialog parent (add-dialog), top-layer presses/focus not outside (add-overlay-infrastructure dismissable-layer) Builder: `dialogPieces` (D.1); drawer as a dialog parent and top-layer presses were already applied on main.

## 1. Swipe gesture (`core/dom/swipe.ts`, capability `swipe-gesture`)

- [x] 1.1 Pure helpers (Node tests): axis lock (6 px slop, 2:1 bias), damping, velocity from timestamps (100 ms window, 80 ms age, no per-sample floor), change-of-mind (10 px) → `direction: null`
- [x] 1.2 `trackSwipe`: start rules (primary button, single touch, composed path, exempt targets, `data-rind-no-swipe` with `alwaysFrom`, mouse/pen not on buttons/links, text selection, outside-DOM targets ignored), scroll arbitration (scrollers between target and element only, any element type, `preventDefault` only after attribution), pointer capture, touch events for touch, cancellation (pointercancel, lost capture, second touch, hidden document, stop), listeners only while pending/active
- [x] 1.3 CSS custom properties via CSSOM only, reset at start and stop, `onProgress`; no other inline style touched
- [x] 1.4 Browser tests for every `swipe-gesture` scenario (base-ui#4863, #5359, #4294, #4380, #5566, #5843, #5255, #5471, #5837; reka-ui#2907, #2876; zag#3148; vaul#555, #651), Chromium, Firefox and WebKit In packages/testing/src/swipe.dom.test.ts (jsdom + Chromium, Firefox, WebKit); the vaul#651 page-scroll case is in the Playwright fixture.

## 2. Test drag input (`@rind-ui/testing`)

- [x] 2.1 `Part.drag(vector, { pointerType, durationMs, steps })` in the DOM adapter (user-event pointer API for mouse; `TouchEvent` dispatch for touch) with timestamps driven by the adapter's time advance `Part.drag`; time is the environment's clock (spec delta: event timestamps cannot be faked in a real browser).
- [x] 2.2 Same in the Playwright adapter (`mouse.down/move/up`; dispatched touch events); a shared test proving identical reported velocity in both packages/testing/fixtures/drawer (Storybook retired).

## 3. Machine (`core/components/drawer/drawer.machine.ts`, `snap-points.ts`)

- [x] 3.1 `snap-points.ts` pure functions: resolve (fraction/px/rem, clamp, 1 px dedupe, order by size), `swipeDismisses`, `settleTarget` (300 ms projection, sequential), `cycle`; exhaustive Node tests (vaul#616, #284, #333)
- [x] 3.2 `drawerMachine` via `buildDialogMachine` (kind `drawer`, guarded `SWIPE` close event, controllable `snapPoint`, context `swipe`/sizes/nested, `open` effects and handlers, `$reverted` → `endSwipe`, registered `close-trigger`/`handle` parts); props with defaults Composition through `dialogPieces` (D.1), not an `extend` option.
- [x] 3.3 Effects: `swipeTracking` (directions from `side` + `dir`, follow-up `SWIPE.CANCEL` after an uncontrolled `cancel()`), `measureSize` (border-box), `nestedMetrics`, `keyboardInset`; "only way out" dev warning
- [x] 3.4 Node tests for every transition, controlled proposal holding `releasing`, `$reverted`, `cancel()`, snap reset on open, `closeOnSwipe={false}`

## 4. Drawer stack (`core/dom/drawer-stack.ts`)

- [x] 4.1 Per-document registry of open drawers (versioned global key), sizes, swiping, progress mirroring, indent element registration after mount; removal on close/stop (base-ui#5915)
- [x] 4.2 Browser tests: nested metrics controlled and uncontrolled (vaul#540), dialog inside drawer not counted (base-ui#4492), border-box (base-ui#4201) packages/testing/src/components/drawer-nesting.dom.test.tsx.

## 5. Connect (`drawer.connect.ts`, `drawer.messages.ts`)

- [x] 5.1 Dialog connect with scope `drawer`, layer meta family `drawer`, every attribute and variable of the spec's Data Attributes requirement; logical side resolution
- [x] 5.2 Handle: button form (press, name from `messages.expand`/`collapse`, `data-snap-point`) vs decorative form (`aria-hidden`, no handlers)
- [x] 5.3 Indent parts: `data-active`, no server/client markup difference
- [x] 5.4 Unit tests for every attribute in the spec

## 6. React parts (`packages/react/src/drawer`)

- [x] 6.1 `Root`, `Trigger`, `Backdrop`, `Positioner`, `Content`, `Title`, `Description`, `CloseTrigger` on the Dialog part implementations; `Handle`, `Indent`, `IndentBackground`; `render` prop on each
- [x] 6.2 React tests: Strict Mode, SSR + hydrate (indent, base-ui#4509), no render per pointer move (render counter), controlled async close (zag#3144, #3149) Strict Mode + hydrate (indent), render counter, controlled close: drawer.dom.test.tsx and drawer-nesting.dom.test.tsx. A close applied by a parent after a later render settles first (spec amended; backlog).

## 7. Contract and driver

- [x] 7.1 `drawer.contract.ts` per design §6 (Dialog helpers, `swipe` with `none` keyboard reason, `pressHandle`, queries, event map with skips)
- [x] 7.2 `getDrawer` export; driver tests in `browser` and `jsdom` projects and through Playwright against the site examples harness Playwright fixture: packages/testing/fixtures/drawer; site examples: apps/site/examples/drawer.tsx.

## 8. Tests

- [x] 8.1 One browser test per `drawer` spec scenario; regression scenarios reproduce the cited issue first (base-ui#4402, #4492, #4201, #4509, #4541, #5570, #5596, #5915; reka-ui#2933; zag#3144, #3149; vaul#245, #284, #333, #364, #397, #540, #589, #616; ark#2974) Scenarios in the DOM, nesting, swipe and Playwright suites; not every cited regression has its own reproduction (backlog).
- [x] 8.2 `testMachine` over the contract with props sets from design §6, all modalities incl. `virtual`, both directions; `layer`, `modal`, `restores-focus`, `presence` invariants; axe per state
- [x] 8.3 Virtual screen reader test: name, description, handle name; announcement log empty after a swipe

## 9. Theme (`packages/theme/src/drawer.css`)

- [x] 9.1 Tier-3 tokens `--rind-drawer-*` (bg, border, radius, shadow, size, handle size and colour, backdrop, indent scale) defaulting to semantic tokens (decision 0007, after `add-theme-system`); styles read only tier 3 and select on `data-*`; imported from `index.css`
- [x] 9.2 Per-side placement and transform from `--rind-drawer-snap-offset` plus swipe vars under `[data-swiping]`/`[data-swipe-dismiss]`, transitions off while swiping, `@starting-style` entry, exit from the release position, backdrop opacity and indent scale from `--rind-drawer-swipe-progress`, keyboard inset padding, `overscroll-behavior: contain`
- [x] 9.3 Reduced motion (duration tokens 0, no indent scale), forced colors (content border `CanvasText`, handle grip as border), handle hit area ≥ 24×24 via `--rind-hit-area`; Playwright forced-colors captures Playwright forced-colors captures: backlog.

## 10. Site examples

- [x] 10.1 Site examples (apps/site/examples/drawer.tsx, state examples for every contract state): Bottom sheet, each side incl. `inline-start` under RTL, snap points (handle, sequential), scrollable content, form with inputs (keyboard inset), non-modal, nested drawers with indent, dialog inside a drawer, toast over a drawer, controlled with async close, `closeOnSwipe={false}`, handle-only; state examples for `open` and `closed` (themed, so axe contrast runs on real styles)
- [x] 10.2 A driver example (docs testing example); all examples pass axe

## 11. Docs and manual checks

- [x] 11.1 Docs page (generated API facts + guide: Dialog or Drawer, sides, gesture alternatives (WCAG 2.5.1/2.5.7), snap points and the handle, nested drawers and indent, keyboard inset, Reado migration, testing with `getDrawer`/`testMachine`) The Reado migration lives outside the user docs (no other library names there).
- [x] 11.2 Manual device pass: iOS Safari and Chrome (scroll vs swipe, rubber band, keyboard inset, dock `pointercancel`), Android Chrome + TalkBack (close paths, back gesture behaviour recorded), VO iOS (handle name and activation); record in "Tested with"; quirk entries only for reproduced failures Manual device pass: needs a person with the devices (backlog).
- [x] 11.3 Mark `docs/research/drawer.md` done when archived; update Drawer status in `docs/components.md` as work progresses `wip` set; research note and `done` on archive.
- [x] 11.4 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset for core, react, testing, theme Targeted runs per the workflow; full suites in CI. Changeset added.

## Amendments (from add-heading)

- [x] A.1 `Title`/`Content` follow Dialog's heading rules (`h{level}` default `h2` via `headingProps`; content children in `Heading.Level` one deeper); tests for the "Title Heading Level" scenarios Title and Content are the Dialog's parts: its heading rules apply unchanged (covered by the Dialog's tests).

## Amendments (moved from add-dialog)

- [x] D.1 Dialog machine composition: `dialogPieces(config)` exports the Dialog's guards, actions, effects and both states' transitions (typed against the Dialog's types); `buildDialogMachine` assembles them unchanged and the Drawer composes them with its own (the select/listbox `collectionPieces` pattern). Chosen over an `extend` option: the drawer's events, context and values stay its own types, with no generic builder surface
