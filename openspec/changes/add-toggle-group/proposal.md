## Why

Toggle Group ships in seven of nine libraries and is wave 1 (text formatting, alignment,
view options). The libraries disagree on its semantics: Radix, React Aria, Zag and Bits
announce a single-selection group as a radio group while keeping toolbar keys (arrows
only move, the pressed item can be un-pressed), which contradicts the radio pattern
(radix#4119); Base UI, Reka and Kobalte use toggle buttons, and an app migrating between
the two lost the "one of N" cue silently (base-ui#3525). The rest of the bug history is
unnamed groups, "none" not representable in controlled single mode, a root that steals
the tab stop, and missing Home/End. This change fixes the semantics once — toggle
buttons in both modes, with exclusive choices served by Segmented Control — on top of
`add-toggle` and `add-collections`.

Research note: [docs/research/toggle-group.md](../../../docs/research/toggle-group.md) (with
[toggle](../../../docs/research/toggle.md),
[segmented-control](../../../docs/research/segmented-control.md),
[collections](../../../docs/research/collections.md),
[accessibility](../../../docs/research/accessibility.md),
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md)).

Depends on:

- `add-foundations`: machine runtime, controllables, contracts, drivers, `testMachine`,
  React adapter.
- `add-a11y-foundations`: press, modality, focus attributes, logical keys and RTL, ids.
- `add-collections`: static item registration, roving focus, one tab stop, disabled
  items, single and multiple selection.
- `add-toggle`: the `toggle` capability (the item is a Toggle whose `pressed` the group
  owns).

## What Changes

- A public **Toggle Group** component: machine, connect, React parts `ToggleGroup.Root`
  and `ToggleGroup.Item`, contract and generated driver (`getToggleGroup`), model-based
  tests, stories, theme stylesheet and docs page.
- **Toggle buttons in both modes**: a named `group` of `button[aria-pressed]` items;
  never `radiogroup`/`radio`. Docs send exclusive, always-one-value choices to Segmented
  Control.
- **Toolbar keyboard**: arrows (both pairs when vertical) and Home/End move focus only;
  Space and Enter press; `loop` default true; RTL mirrored.
- `selectionMode: "single" | "multiple"` (default `single`), `value: string[]` in both
  modes (empty array = none), `disallowEmptySelection` (default false) in both modes.
- The tab stop is always an item, from the first render.

## Capabilities

### New Capabilities

- `toggle-group`: the Toggle Group component — anatomy, semantics, value and selection
  modes, keyboard and activation, tab stop, disabled items, `data-*` per part, contract
  and invariants, theme expectations.

### Modified Capabilities

None. The capabilities this builds on are introduced by the unarchived
`add-foundations`, `add-a11y-foundations`, `add-collections` and `add-toggle`.

## Non-goals

- Radio semantics in single mode (see research note; Segmented Control covers it).
- Form participation (radix#3058): Toggle has none either; Radio Group, Checkbox Group and
  Segmented Control submit values.
- A sliding indicator (radix#1439): Segmented Control's.
- The toolbar itself: `add-toolbar`; this change adds only the hosted mode through its
  `CompositeHost` port (no own tab stop and no loop inside a Toolbar).
- `aria-pressed="mixed"`, a minimum/maximum count beyond "not empty", framework adapters
  other than React, fx.

## Impact

- New code: `packages/core/src/components/toggle-group/` (machine, connect, contract),
  `packages/react/src/toggle-group/`, `packages/theme/src/toggle-group.css`, Storybook
  stories, docs page, `getToggleGroup` in `@rind-ui/testing`.
- No new dependencies.
