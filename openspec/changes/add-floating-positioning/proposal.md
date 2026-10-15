## Why

Eleven components (Popover, Tooltip, Hover Card, Menu, Context Menu, Select,
Combobox, Navigation Menu, Date Picker, Color Picker, Tour — plus Mentions and
Citation) open a popup anchored to something. Every library that ships them has
a long tail of positioning bugs: a flash at the wrong place on the first frame,
flips caused by unmeasured heights, drift under pinch-zoom and the on-screen
keyboard, wrong collisions in the top layer, and costs that scale with the
number of closed tooltips on a page. Select, Menu and Tooltip are next in the
build order, so the shared positioning layer comes first.

Research: [floating-positioning](../../../docs/research/floating-positioning.md) ·
[native-platform §2, §4](../../../docs/research/native-platform.md) ·
[accessibility](../../../docs/research/accessibility.md) (rule 28, reflow) ·
[overlay-infrastructure](../../../docs/research/overlay-infrastructure.md)

## What Changes

- A positioning module in `@rind-ui/core` (`core/dom/position`) built on
  `@floating-ui/dom` (already an allowed dependency). It places a floating
  element against an element, virtual rectangle or point anchor, and handles
  collision avoidance, sizing, an arrow, a hidden anchor, tracking, RTL, the
  visual viewport and the top layer.
- A `position` **environment capability** that machines use from an effect
  scoped to their open state. Discrete results (side, align, anchor hidden,
  placed) come back as events. Continuous values are written as CSS custom
  properties and never go through the machine. The capability is separate from
  `domEnvironment()`, so bundles without anchored components don't carry
  Floating UI.
- Shared **connect helpers** for the `positioner` and `arrow` parts: the
  `data-side`, `data-align`, `data-anchor-hidden` and `data-placing`
  attributes, the first-frame style, `dir`, and `anchor-name` on the anchor.
- A **CSS custom property contract**: `--rind-available-width/height`,
  `--rind-anchor-width/height` and `--rind-transform-origin`.
- A reusable **contract query fragment** (`side`, `align`, `isAnchorHidden`,
  `isPlaced`), and a browser-only **layout invariant** in `@rind-ui/testing`.
- A manual mode in which rind writes no coordinates, so consumers can position
  with CSS anchor positioning themselves.
- Settles the positioning side of the `popover="manual"` spike from
  native-platform.md. Positioning is top-layer-safe and never promotes an
  element to the top layer.

## Capabilities

### New Capabilities

- `floating-positioning`: how an anchored popup is placed and kept in place
  (placement, collision avoidance, sizing, arrow, hidden anchor, tracking,
  virtual anchors, strategy, viewports, the first frame, RTL, manual mode), the
  attributes and CSS custom properties it exposes, its accessibility guarantees,
  its environment capability, and its contract queries and layout invariant.

### Modified Capabilities

None. The capabilities of `add-foundations` (machine runtime, contract, test
drivers) and `add-overlay-infrastructure` (layer stack, portal, presence) are
used as specified.

## Non-goals

- Promoting popups to the top layer (`popover="manual"`). The recommendation
  goes to `add-overlay-infrastructure`; no promotion happens in v1.
- CSS anchor positioning as the engine. The anchor name is exposed and the
  manual mode allows it, but the library does not use it.
- Behaviour that belongs to a single component: Select's item-aligned mode,
  Navigation Menu's viewport size animation, closing a popup when an ancestor
  scrolls, hover intent and safe polygons, scrolling a Tour target into view.
- Z-index management. The theme styles the positioner, and no computed
  z-index is copied.
- Floating Panel (draggable, not anchored).
- Any public component. This change provides the infrastructure and a test
  fixture only.

## Impact

- New: `packages/core/src/dom/position/`, `packages/core/src/env/position.ts`,
  connect helpers in `packages/core/src/dom/position/connect.ts`, a contract
  fragment in `packages/core/src/contract/`, a layout invariant in
  `packages/testing`, an anchored fixture in `packages/testing/fixtures/`, and
  theme rules for the positioner and arrow in `packages/theme`.
- Dependency: `@floating-ui/dom@^1.8.0` becomes a runtime dependency of
  `@rind-ui/core`. It is already allowed by
  [0002](../../../docs/decisions/0002-architecture.md), so no decision record is
  needed. 1.8.0 is the minimum because it adds `layoutViewport` and accepts
  explicit `undefined` under `exactOptionalPropertyTypes`.
- Depends on `add-foundations` (runtime, Environment, contract, drivers),
  `add-a11y-foundations` (direction for RTL placements, reduced-motion preference) and
  `add-overlay-infrastructure` (portal, layer stack, presence).
