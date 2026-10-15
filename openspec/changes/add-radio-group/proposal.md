## Why

Radio Group ships in all nine libraries and is wave 1; Segmented Control (used by Reado)
is built on it. The libraries' bugs cluster in four places: selection triggered by
`focus` instead of the arrow key (programmatic focus, dialog autofocus, pointer focus and
screen-reader focus all checked radios), the hidden form input leaking into the
accessibility tree or taking focus, the tab stop when nothing (or a disabled radio) is
checked, and form parity (required, reset, empty submission). `add-collections` and
`add-checkbox` already solve navigation and form participation once; this change
specifies the component.

Research note: [docs/research/radio-group.md](../../../docs/research/radio-group.md) (with
[collections](../../../docs/research/collections.md),
[accessibility](../../../docs/research/accessibility.md),
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md),
[native-platform](../../../docs/research/native-platform.md) §9 and §14).

Depends on:

- `add-foundations`: machine runtime, controllables, contracts, drivers, `testMachine`,
  React adapter.
- `add-a11y-foundations`: press, modality guards, focus attributes, logical keys and RTL,
  ids.
- `add-collections`: static item registration, roving focus, tab stop, disabled items,
  single selection.
- `add-button`: `button-like-element` (the radio control, Space-only activation for
  `role="radio"`).
- `add-checkbox`: `hidden-form-input` (one hidden `input[type=radio]` per item, reset,
  constraint validation, implicit submission) and `control-label` (item label and
  description).

## What Changes

- A public **Radio Group** component: machine, connect, React parts `RadioGroup.Root`,
  `Label`, `Description`, `ErrorMessage`, `Item`, `ItemControl`, `ItemIndicator`,
  `ItemLabel`, `ItemDescription`, contract and generated driver (`getRadioGroup`),
  model-based tests, stories, theme stylesheet and docs page.
- **Arrow keys move and check; focus alone never checks.** Checking is part of the
  keyboard move in the machine (no "arrow key is down" flags); all four arrows work
  whatever the orientation; horizontal arrows mirror in RTL; the group always wraps.
- **One tab stop**: the checked enabled radio, else the first enabled radio, else the
  (disabled) group itself, as `add-collections` defines.
- **Forms** through `hidden-form-input`: `name` (default derived from the root id),
  `form`, `required`, reset to the default, native constraint validation with focus on
  the visible control, empty submission identical to native radios, Enter submits.
- `required`, `invalid`, `readOnly` and `disabled` exposed on the `radiogroup`; read-only
  groups stay navigable but never change.
- The machine is exported for Segmented Control (`add-segmented-control`).

## Capabilities

### New Capabilities

- `radio-group`: the Radio Group component — anatomy, value, keyboard and activation,
  tab stop, disabled/read-only/required/invalid states, roles and names, form
  participation, `data-*` per part, contract and invariants, theme expectations.

### Modified Capabilities

None. The capabilities this builds on are introduced by the unarchived
`add-foundations`, `add-a11y-foundations`, `add-collections`, `add-button` and
`add-checkbox`.

## Non-goals

- The toolbar itself: add-toolbar owns it; this change adds only the hosted mode through
  its `CompositeHost` port (arrows move only, Space and Enter check, no own tab stop).
- Deselecting a checked radio by pressing it again (RA#4971, radix#1336): not native
  radio behaviour; clearing is programmatic (`value={null}`).
- A single standalone Radio outside a group (base-ui#1328).
- A sliding group indicator: that is Segmented Control's `Indicator`.
- Typeahead, Home/End (not part of the APG radio pattern), framework adapters other than
  React, fx.

## Impact

- New code: `packages/core/src/components/radio-group/` (machine, connect, contract),
  `packages/react/src/radio-group/`, `packages/theme/src/radio-group.css`, Storybook
  stories, docs page, `getRadioGroup` in `@rind-ui/testing`.
- No new dependencies.
