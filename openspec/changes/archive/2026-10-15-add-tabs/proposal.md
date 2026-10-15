## Why

Tabs ship in all nine libraries ([components.md](../../../docs/components.md)) and are wave
1. Their bug history is dominated by a handful of mistakes repeated across libraries:
screen-reader focus that selects a tab (radix#1047, open since 2021), activation on
`mousedown`, no tab stop when nothing is selected or the selected tab is disabled, tabs
and panels paired by index, inactive panels hidden only visually, and an indicator that
mis-measures. `add-collections` already solves navigation, the single tab stop and
selection once; this change specifies the component on top of it.

Research note: [docs/research/tabs.md](../../../docs/research/tabs.md) (with
[collections](../../../docs/research/collections.md),
[accessibility](../../../docs/research/accessibility.md),
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md),
[native-platform](../../../docs/research/native-platform.md) §6 and §9).

Depends on:

- `add-foundations`: machine runtime, controllables, contracts, drivers, `testMachine`,
  React adapter.
- `add-a11y-foundations`: press, modality guards (keyboard-only automatic activation),
  focus attributes, logical keys and RTL, ids, hidden content and find-in-page reveal,
  reduced motion.
- `add-collections`: static item registration, roving focus, exactly one tab stop,
  disabled items, single selection, highlight repair.
- `add-button`: `button-like-element` for the tab element.

## What Changes

- A public **Tabs** component: machine, connect, React parts `Tabs.Root`, `Tabs.List`,
  `Tabs.Tab`, `Tabs.Panel`, `Tabs.Indicator`, contract and generated driver (`getTabs`),
  model-based tests, stories, theme stylesheet and docs page.
- **Automatic activation is keyboard-only**: a tab is selected by a keyboard move in the
  list, never by `focus` alone (screen-reader cursor, programmatic focus, right click).
  `activationMode: "manual"` selects on Enter/Space only. Pointer selection happens on
  release.
- **Panels**: `inactivePanels: "unmount" | "hidden" | "until-found"` (default
  `unmount`); in `until-found` find-in-page selects the tab that holds the match.
  A panel is a tab stop only when it has no tabbable content.
- **Orientation**: horizontal lists use Left/Right; vertical lists accept both arrow
  pairs (orientation is not announced to screen-reader users).
- A shared **selection indicator** module (`core/dom/selection-indicator.ts`) that
  exposes the selected item's box as CSS custom properties and never animates
  layout-driven moves; Segmented Control reuses it.

## Capabilities

### New Capabilities

- `tabs`: the Tabs component — anatomy, value and default selection, activation,
  keyboard, roles and ARIA, panels and find-in-page, focus and tab stops, `data-*` per
  part, contract and invariants, theme expectations.
- `selection-indicator`: measuring the selected item of a composite and exposing it as
  CSS custom properties and data attributes, for any component with a sliding selection
  highlight (Tabs, Segmented Control).

### Modified Capabilities

None. The capabilities this builds on are introduced by the unarchived
`add-foundations`, `add-a11y-foundations`, `add-collections` and `add-button`.

## Non-goals

- Tabs as navigation links (`href`, router integration; RA#8470, zag#3354): links that
  change the page are Navigation Menu / Link territory. A `Tab` rendered as `<a>` through
  `render` keeps tab semantics and does not navigate.
- Closable, reorderable (drag and drop) or overflowing tabs that collapse into a menu.
- Popup menus on tabs (`aria-haspopup`, Shift+F10) and Delete to remove a tab.
- A pre-hydration script for the indicator (Base UI); the indicator is hidden until the
  first measurement.
- Animating panel height (consumers use presence/theme), Toolbar integration, framework
  adapters other than React, fx.

## Impact

- New code: `packages/core/src/components/tabs/` (machine, connect, contract),
  `packages/core/src/dom/selection-indicator.ts`, `packages/core/src/dom/tabbable-content.ts`
  (panel "has tabbable content" observer), `packages/react/src/tabs/`,
  `packages/theme/src/tabs.css`, Storybook stories, docs page, `getTabs` in
  `@rind-ui/testing`.
- No new dependencies.
