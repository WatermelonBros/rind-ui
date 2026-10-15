## Why

Switch is a wave-1 component (8 of 9 libraries ship it) and the second boolean form
control after Checkbox. Its bug history across libraries is mostly form plumbing and
label wiring that `add-checkbox` already solves once, plus a few switch-specific traps
(Enter semantics, `mixed` creeping in, names that change with state, invisible thumbs in
forced colors). With the shared pieces in place, Switch is a small, fully specified
component.

Research: [switch](../../../docs/research/switch.md) ·
[accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) ·
[native-platform](../../../docs/research/native-platform.md) §8, §14

Depends on: `add-foundations`, `add-a11y-foundations`, `add-button`
(`button-like-element`) and `add-checkbox` (`hidden-form-input`, `control-label`). This
change reuses those capabilities and does not re-specify them.

## What Changes

- A public **Switch** in `@rind-ui/core` (machine, connect, contract) and
  `@rind-ui/react` (parts `Root`, `Control`, `Thumb`, `Label`, `Description`; the hidden
  input is rendered by `Root`).
- Boolean controllable `checked` / `defaultChecked` / `onCheckedChange`; `disabled`,
  `focusableWhenDisabled`, `readOnly`, `required`, `invalid`, `name`, `value`, `form`,
  `uncheckedValue`.
- Keyboard: Space toggles; Enter does not toggle and performs the form's implicit
  submission (native-checkbox parity, same rule as the Checkbox Control).
- `data-*` styling contract, a driver (`getSwitch`), model-based tests and
  switch-specific invariants (never `mixed`, name stable across states).
- `switch.css` in `@rind-ui/theme`: target size, forced colors, RTL thumb.
- Docs page with the switch vs checkbox vs toggle-button guidance.

## Capabilities

### New Capabilities

- `switch`: the Switch component — anatomy, value, ARIA, keyboard, activation, disabled
  and read-only, form participation (through `hidden-form-input`), data attributes,
  contract, invariants and theme.

### Modified Capabilities

None. `button-like-element`, `hidden-form-input` and `control-label` are used as
specified by `add-button` and `add-checkbox`.

## Non-goals

- A mixed / indeterminate switch (ARIA `switch` has no mixed state; use Checkbox).
- Native `<input type="checkbox" switch>` (Safari only).
- Field / Fieldset integration (error message part, validation display) — the Field
  change.
- A switch group; a Switch with a loading state.
- Arrow-key or drag-to-toggle gestures.
- Framework adapters other than React; fx.

## Impact

- New: `packages/core/src/components/switch/` (`switch.machine.ts`, `switch.connect.ts`,
  `switch.contract.ts`), `packages/react/src/switch/`, `getSwitch` in
  `@rind-ui/testing`, `packages/theme/src/switch.css`, Storybook stories, docs page.
- No new dependency.
