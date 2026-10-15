## MODIFIED Requirements

### Requirement: Contract

Radio Group SHALL ship a contract with scope `radio-group`, anatomy matching the parts,
located by role `radiogroup` and exact accessible name. Actions: `check(name)` — pointer
and touch: press the radio named `name`; keyboard: focus the group and press ArrowDown
until that radio is checked; completes when `checked()` equals `name`. Queries: `radios()`
(accessible names in order), `checked()` (name of the radio with `aria-checked="true"`, or
null), `focusedRadio()`, `isDisabled(name)`, `isReadOnly()`, `isRequired()`, `isInvalid()`
and `formValue()` (the entries the owning form would submit for the group's name).
Traits: `composite-roving`, `selectable` and `directional`. Focus SHALL change only the focus
state and the focused-item query, never the value; the contract declares the item as
committing on focus for that reason, and the value is checked by the `form-associated` trait
after every step. A generated driver `getRadioGroup(target, { name })` SHALL be exported
from `@rind-ui/testing`.

#### Scenario: Same test in both environments

- **WHEN** a test calls `getRadioGroup(screen, { name: "Size" }).check("Large")` and then
  the same with a Playwright `page`
- **THEN** both resolve once "Large" is checked and `formValue()` returns `[["size", "l"]]`

#### Scenario: Model-based run

- **WHEN** `testMachine(radioGroupContract, …)` runs with argument classes for no value,
  first item disabled, checked item disabled, all disabled, read-only, required and both
  directions
- **THEN** every transition runs in the pointer, touch, keyboard and virtual modalities
  with every generic and trait invariant checked after each step
