## Why

Apps want overlay scrollbars that match their design, fade masks at overflow edges and
scrollbars that appear on hover or scroll — without losing what native scrolling gives
for free: wheel, touch and momentum, keyboard scrolling, zoom, find-in-page, RTL and
forced colors. Every library that ships a Scroll Area broke one of these (keyboard tab
stop rules that differ in four ways, `display: table` wrappers, leaked document
listeners, frozen thumbs in RTL and reversed layouts). This change specifies one that
keeps native scrolling and only draws over it.

Research: [scroll-area](../../../docs/research/scroll-area.md) (sources, Bug history,
Accessibility, Decisions) · [accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) ·
[native-platform](../../../docs/research/native-platform.md) ·
[overlay-infrastructure](../../../docs/research/overlay-infrastructure.md) (keyboard-focusable
scrollers, react-spectrum#10395)

**Depends on** `add-foundations` (runtime, delays, effects, contracts, drivers,
`testMachine`, React adapter), `add-a11y-foundations` (modality, `StyleInjection` nonce,
platform, reduced motion, invariants), `add-slider` (`pointer-drag`, driver pointer
steps `box()` / `pointer()`), `add-overlay-infrastructure` (the sequential tab-order
helper of focus containment — see design.md "Requests to other changes") and
`add-theme-system` (tokens, `decoration` family, stylesheet convention).

## What Changes

- New capability **`scroll-area`**: a native scroll container with custom scrollbars —
  parts, visibility types (`hover`, `scroll`, `auto`, `always`) with scheduler-driven
  delays, thumb geometry from measurement (RTL and reversed axes), thumb drag and track
  press, wheel over scrollbars, the viewport tab-stop rule, naming, hidden scrollbar
  parts, native scrollbar hiding that keeps zoom and forced colors working, nested
  areas, server rendering, `data-*` and CSS variables, contract and driver.
- `@rind-ui/core`: `scroll-area` machine, connect, contract; `core/dom/scroll-metrics.ts`
  (measurement, thumb writes, observers, wheel forwarding).
- `@rind-ui/react`: `ScrollArea.Root`, `Viewport`, `Content`, `Scrollbar`, `Thumb`,
  `Corner`.
- `@rind-ui/testing`: `getScrollArea` driver; model-based coverage.
- Theme stylesheet (`decoration` family, tier-3 `--rind-scroll-area-*` tokens), stories,
  docs page.

## Capabilities

### New Capabilities

- `scroll-area`: the Scroll Area component — native scrolling with custom scrollbars,
  visibility, geometry, drag, keyboard tab stop, attributes, contract.

### Modified Capabilities

None. `pointer-drag` (add-slider) is used as specified; the one helper needed from
add-overlay-infrastructure is listed in design.md "Requests to other changes".

## Non-goals

- Virtualization, infinite loading, stick-to-bottom (Message Thread owns it), scroll
  restoration, imperative `scrollTo` helpers (native `Element.scrollTo` on the viewport
  ref covers them).
- Any change to keyboard scrolling: no key handling, no JS smooth scrolling, no
  scroll hijacking.
- Overscroll (rubber-band) feedback on the thumb, press-and-hold repeat paging, a
  `glimpse` visibility type, per-platform switching to native bars (documented as a
  layered CSS recipe instead).
- An ARIA `scrollbar` widget: custom scrollbars stay hidden from assistive technology.
- Scroll-driven-animation positioning (`animation-timeline: scroll()`) until Firefox
  ships it.
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/scroll-area/{scroll-area.machine,scroll-area.connect,scroll-area.contract}.ts`,
  `packages/core/src/dom/scroll-metrics.ts`, `packages/react/src/scroll-area/*`,
  `getScrollArea` in `@rind-ui/testing`, `packages/theme/src/scroll-area.css`, stories,
  generated docs page.
- `core/dom`: the once-per-document style injection used by `touch-action.ts` becomes a
  keyed helper shared with the scroll-area rule (second user; no behaviour change).
- Public API: `scrollArea` machine/connect/contract, `ScrollArea` parts, `getScrollArea`.
- No new runtime dependency. Reado does not use a scroll area (native styled scrollbars);
  nothing migrates.
