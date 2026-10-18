## Why

Resizable panels (an editor with a sidebar, a list and a detail view, a terminal under a
code pane) are the APG Window Splitter pattern. Two libraries ship it, both ported from one
reference implementation, and their trackers repeat the same bugs: layout shift on the
server because sizes exist only after panels register, pixel constraints that drift into
percentages on resize, drags stuck over iframes or after `pointercancel`, inverted arrows
in one orientation, swapped `aria-valuemin`/`max` beyond the first handle, and a focused
state that ignores keys after a hover. `pointer-drag` (from `add-slider`) already owns the
drag lifecycle, so Splitter is a value machine on top of it.

Research: [docs/research/splitter.md](../../../docs/research/splitter.md) ·
[separator](../../../docs/research/separator.md) · [slider](../../../docs/research/slider.md) ·
cross-cutting [accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) ·
[native-platform](../../../docs/research/native-platform.md).

**Depends on** `add-foundations`, `add-a11y-foundations` and `add-slider` (`pointer-drag`).

## What Changes

- A `splitter` component: machine, connect, contract, React parts `Root`, `Panel`,
  `Handle`.
- Sizes are one controllable array in percent of the panels' space; constraints (`min`,
  `max`, `collapsible`, `collapsedSize`) are declared on the Root, as percent numbers or
  `"Npx"` strings resolved against the measured group on every resize.
- Every handle is a focusable `separator` with the primary pane's size and effective
  bounds, `aria-orientation` perpendicular to the panel axis and `aria-controls`.
- Keyboard: arrows on the handle's axis (mirrored in RTL), Home / End, Enter to collapse
  or restore the primary pane. Pointer: drag with capture, Escape and `pointercancel`
  restore the sizes at the press.
- `onSizesCommit` once per interaction, the persistence hook.
- Contract (`splitterContract`), driver (`getSplitter`), theme stylesheet, site examples
  and skin, docs page.

## Capabilities

### New Capabilities

- `splitter`: the Splitter component — parts, sizes and constraints, layout, handle
  semantics, keyboard, pointer drag, collapse, commit, contract and driver.

### Modified Capabilities

None. `pointer-drag` is reused unchanged.

## Non-goals

- F6 pane cycling (APG optional), double click to reset, dragging at the intersection of
  nested splitters, `preserve-pixel-size` on group resize, built-in storage: the backlog
  lists them.
- Panels registering their own constraints (the cause of the server layout shift).
- Framework adapters other than React; fx.

## Impact

- New: `packages/core/src/components/splitter/*`, `packages/react/src/splitter/*`,
  `packages/testing/src/components/splitter*`, `packages/theme/src/splitter.css`,
  `apps/site/examples/splitter.tsx`, `apps/site/skins/splitter.css`,
  `docs/components/splitter.md`.
- Exports added to `@rind-ui/core`, `@rind-ui/react`, `@rind-ui/testing`,
  `@rind-ui/theme`.
