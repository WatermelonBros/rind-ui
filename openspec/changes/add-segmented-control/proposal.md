## Why

Reado uses Ark's Segment Group, and the build order puts Segmented Control in the first
batch (decision 0002). Only Ark and Kobalte ship one, both as a styled Radio Group; the
other libraries' users fake it with a single-selection Toggle Group, whose semantics
either contradict their keyboard (radio roles with move-only arrows, radix#4119) or lose
the "one of N" cue (base-ui#3525). Its own bugs are about the sliding indicator (not shown
on mount, no animation on the first change, wrong when scrolled) and a reused scope
leaking into the DOM. This change decides its semantics with that evidence — a radio
group — and builds it from `add-radio-group`'s machine and `add-tabs`' selection
indicator.

Research note: [docs/research/segmented-control.md](../../../docs/research/segmented-control.md)
(with [radio-group](../../../docs/research/radio-group.md),
[tabs](../../../docs/research/tabs.md),
[toggle-group](../../../docs/research/toggle-group.md),
[accessibility](../../../docs/research/accessibility.md),
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md)).

Depends on:

- `add-foundations`, `add-a11y-foundations`, `add-collections` (as Radio Group).
- `add-button`: `button-like-element` for the segment.
- `add-checkbox`: `hidden-form-input`.
- `add-radio-group`: the `radio-group` capability's behaviour and its exported machine.
- `add-tabs`: the `selection-indicator` capability and module.

## What Changes

- A public **Segmented Control** component with its own scope, connect, React parts
  `SegmentedControl.Root`, `Label`, `Item`, `Indicator`, contract and generated driver
  (`getSegmentedControl`), model-based tests, stories, theme stylesheet and docs page.
- **Radio semantics**: `radiogroup` + `radio` segments; arrows move and select; focus
  alone never selects; one tab stop; no deselect; form participation — all as the
  `radio-group` capability specifies, on the same machine.
- **Defaults** for the control: `orientation: "horizontal"`; a segment is one pressable
  element named by its content.
- **Indicator** from `selection-indicator`, positioned relative to the root.

## Capabilities

### New Capabilities

- `segmented-control`: the Segmented Control component — anatomy, semantics and the
  behaviour it inherits from `radio-group`, defaults, indicator, `data-*` per part,
  contract, theme expectations.

### Modified Capabilities

None. `radio-group` and `selection-indicator` are used as specified by `add-radio-group`
and `add-tabs`.

## Non-goals

- Toggle-button or tab semantics (Toggle Group and Tabs exist for those; research note).
- "Move without selecting" (kobalte#579): Tabs with manual activation or Toggle Group.
- Multiple selection, icon-plus-menu segments, overflow scrolling of segments.
- A pre-hydration indicator script; framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/segmented-control/` (connect, contract; the
  machine is `add-radio-group`'s), `packages/react/src/segmented-control/`,
  `packages/theme/src/segmented-control.css`, Storybook stories, docs page,
  `getSegmentedControl` in `@rind-ui/testing`.
- No new dependencies.
- Reado: Ark `SegmentGroup` → `SegmentedControl` during the migration (parts map
  `ItemText`/`ItemControl` into `Item`).
