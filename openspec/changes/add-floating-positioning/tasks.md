## 1. Setup

- [ ] 1.1 Add `@floating-ui/dom@^1.8.0` as a runtime dependency of `@rind-ui/core`; confirm it is tree-shaken out of a Dialog-only bundle (size check)
- [ ] 1.2 Capability types in `core/env/position.ts` (`Side`, `Align`, `Placement`, `AnchorSource`, `PositionRequest`, `PositionHandle`, `PositionCapability`) and exports

## 2. Options and middleware (`core/dom/position`)

- [ ] 2.1 `PositioningOptions`, the four presets (`popup`, `dropdown`, `submenu`, `pointer`) and `resolvePositioning()` with logical→physical side resolution by direction; Node unit tests
- [ ] 2.2 Middleware list: inline → offset → flip/shift (order by alignment) → size → arrow → transform origin → hide; flip-only 1 px preferred-side bias; `layoutViewport` for shift
- [ ] 2.3 Size output: `--rind-available-*`, DPR-snapped `--rind-anchor-*`, written only on change
- [ ] 2.4 Transform-origin middleware (arrow tip, aligned edge, point anchor corner); Node tests of the maths
- [ ] 2.5 Hide middleware against the anchor's clipping ancestors plus "no layout box"
- [ ] 2.6 Arrow placement with `arrowPadding` and `uncentered` detection, measured on the positioner

## 3. Tracking (`domPositioning`)

- [ ] 3.1 `track()`: pass runner with cancellation tokens (close, anchor change, newer pass); first-placement report; discrete-change-only `onPlacement`
- [ ] 3.2 Strategy `auto` resolution on open (top layer, virtual/point anchor, fixed ancestor)
- [ ] 3.3 Triggers: `autoUpdate` (ancestor scroll/resize, element resize, layout shift), `visualViewport` resize/scroll, layer-stack `subscribe`, ancestor `animationend`/`transitionend`; `frame` and `none` tracking modes; `reposition()`
- [ ] 3.4 Self-resize updates moved to the next frame (no ResizeObserver loop)
- [ ] 3.5 Owner window/document everywhere; full cleanup on stop and on frame removal
- [ ] 3.6 `sideLock: "open"`; content-internal scroll does not trigger a pass
- [ ] 3.7 Manual mode: no writes, placed on open, requested side/align reported
- [ ] 3.8 No-layout environments: no throw, placed on open with requested placement

## 4. Connect helpers

- [ ] 4.1 `positionerProps`: first-frame style, seeded variables as constant keys, `data-side`/`data-align`/`data-anchor-hidden`/`data-placing`, `dir`, `position-anchor`
- [ ] 4.2 Content placing props (`data-placing`, inline `animation-name: none`) and `arrowProps` (`data-side`, `data-uncentered`)
- [ ] 4.3 `anchorProps` with `anchor-name: --rind-anchor-<id>`; shared `setPlacement` action and `PlacementState` type

## 5. Contract and testing support

- [ ] 5.1 `positioningQueries` contract fragment (`side`, `align`, `isAnchorHidden`, `isPlaced`)
- [ ] 5.2 `fakePositioning()` in `@rind-ui/testing` with `emit()`
- [ ] 5.3 `layoutInvariant` under trait `anchored`: viewport containment, no side-axis overlap, side matches `data-side`, arrow points at anchor; skipped and reported outside browser mode
- [ ] 5.4 Generic model-based invariant: focus enters the popup only after the first placement

## 6. Fixture (not a public component)

- [ ] 6.1 `packages/testing/fixtures/anchored/`: machine (closed/open, `trackPosition` effect, `POSITION.PLACED`, focus on first placement), connect, contract, React parts (trigger, positioner, content, arrow, portal)
- [ ] 6.2 Model-based tests of the fixture graph in Node with `fakePositioning()`

## 7. Browser suite (Chromium, Firefox, WebKit)

- [ ] 7.1 Fixture page knobs: edge anchors, 320×480, `deviceScaleFactor` 1.25, RTL + left scrollbar, fixed header, sticky anchor, scroll container, iframe, shadow root, native modal `<dialog>`, scaling-dialog animation, virtual marker, point anchor; global "ResizeObserver loop" error trap
- [ ] 7.2 One test per spec scenario in `specs/floating-positioning/spec.md`, run through the fixture driver plus `layoutInvariant`
- [ ] 7.3 Chromium-only visual-viewport tests (page scale factor, viewport shrink from the bottom)
- [ ] 7.4 Perf tests: 200 closed tooltips create no observers; scroll pass count and unchanged-variable writes bounded
- [ ] 7.5 jsdom suite: fixture `open()`/`isPlaced()` through `@rind-ui/testing/setup`

## 8. Theme, stories, docs

- [ ] 8.1 `packages/theme/src/positioner.css`: positioner z-index from `--layer-index`, `[data-placing]` animation guard, `max-width/max-height` caps with `--rind-available-*`, arrow drawn with border/`currentColor` (forced-colors safe), transform-origin on content
- [ ] 8.2 Storybook stories for the fixture (each preset, edges, RTL, 320 px, manual mode with CSS `position-area`), passing axe
- [ ] 8.3 Docs page "Positioning": options, presets, `data-*`, CSS variables, manual mode, known limitations (CSS `zoom`, iOS keyboard verification); generated API facts
- [ ] 8.4 Manual device checklist entries (iOS Safari keyboard, pinch-zoom; Android Chrome keyboard) added to the testing notes
