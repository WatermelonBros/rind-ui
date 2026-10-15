## Why

Forms ask "which of these apply?" with a set of checkboxes that share one name, one label,
one required rule and often a "select all" checkbox. Done by hand on top of Checkbox, this
is where other libraries keep failing: a form reset that unchecks one box out of three, a
select-all that ticks disabled items or forgets the previous partial selection in
controlled mode, a "required" that never blocks submission or demands every box, labels
pointed at the wrong item. Checkbox Group specifies it once, right after Checkbox.

Research: [checkbox-group](../../../docs/research/checkbox-group.md) ·
[checkbox](../../../docs/research/checkbox.md) ·
[accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) ·
[native-platform](../../../docs/research/native-platform.md)

Depends on: `add-foundations`, `add-a11y-foundations`, `add-button` (`button-like-element`,
through Checkbox) and **`add-checkbox`**, whose capabilities `checkbox`,
`hidden-form-input` and `control-label` this change composes and does not re-specify.

## What Changes

- A `checkbox-group` machine in `@rind-ui/core`: a controllable `value: string[]`
  (`value` / `defaultValue` / `onValueChange`), item toggles, the APG tri-state "select
  all" cycle (mixed → all → none → previous partial selection), disabled items excluded
  from select-all, one group-level form reset, group-level disabled / read-only /
  required.
- Connect and React parts: `Root` (`role="group"`), `Label`, `Description`,
  `ErrorMessage`, `Parent` (the select-all checkbox); items are ordinary
  `Checkbox.Root value="…"` controlled by the group.
- Contract (`toggle(label)`, `toggleParent()`, `value()`, `parentState()`, …), generated
  driver, model-based tests, stories, theme stylesheet, docs page.

## Capabilities

### New Capabilities

- `checkbox-group`: the group value and its items, group labelling and description, the
  select-all parent checkbox and its cycle, disabled / read-only / required propagation,
  form submission and reset, keyboard and focus, `data-*` attributes, the contract.

### Modified Capabilities

None. `checkbox`, `hidden-form-input` and `control-label` (from `add-checkbox`) are used
as specified there.

## Non-goals

- Arrow-key / roving navigation between items (APG: each checkbox is a Tab stop; Reka's
  roving default is not copied).
- `min` / `max` selection limits (Ark `maxSelectedValues`, Reka `max`) — later, as a guard
  and `aria-disabled`.
- Validation display timing (on blur, on submit), custom `validate` functions and error
  text management — the Field / Form changes. This change ships `required`, `invalid` and
  an `ErrorMessage` part only.
- A single hidden input carrying the whole array (Reka): submission stays per item, as
  native checkboxes.
- Nested groups (a parent of parents, trees) — Tree View's concern.
- Checkbox items inside menus (`Menu.CheckboxItem` groups) — the Menu change.
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/checkbox-group/` (machine, connect, contract),
  `packages/react/src/checkbox-group/`, `packages/testing` (generated driver export),
  `packages/theme/src/checkbox-group.css`, stories and docs page.
- `checkbox` connect gains the group wiring hooks it reads from context (controlled
  `checked` / `onCheckedChange`, propagated `name`, `form`, `disabled`, `readOnly`,
  `required`, group description ids, reset suppression) — implemented here, on top of
  `add-checkbox`'s code.
- No new runtime dependency.
