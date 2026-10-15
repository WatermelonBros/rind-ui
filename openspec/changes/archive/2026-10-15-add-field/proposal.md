## Why

Every form control needs the same wiring: a label, a description and an error message tied
to the control, `disabled`/`readOnly`/`required`/`invalid` passed through, and a validation
model that decides which error shows and when. The bug history (40 entries across nine
libraries) shows the same failures everywhere. Errors appeared too early, never, or stayed
after the fix. Each control wired timing on its own. Server errors were cleared by some
controls and not others. Errors in `aria-errormessage` were silent in VoiceOver. One id was
handed to several controls. Field specifies this once, so Text Field, Checkbox, Switch,
Radio Group, Select, Combobox and every later control get it unchanged.

Research: [field](../../../docs/research/field.md) ·
[form](../../../docs/research/form.md) · [fieldset](../../../docs/research/fieldset.md) ·
[label](../../../docs/research/label.md) ·
[accessibility](../../../docs/research/accessibility.md) §2, §7.4 ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) §1.2 I ·
[native-platform](../../../docs/research/native-platform.md) §14

Depends on: `add-foundations`, `add-a11y-foundations` (`announcer`, `i18n-messages`,
`interaction-modality`, `keyboard-interactions` IME guard, `element-ids`), `add-checkbox`
(`control-label`, `hidden-form-input`), `add-label` (`label-interaction`), `add-fieldset`
(disabled scope), `add-overlay-infrastructure` (`presence`, `layer-stack`).

## What Changes

- A public **Field** component with parts `Root`, `Label`, `Description` and
  `ErrorMessage`. It wraps exactly one rind-ui form control.
- **Shared capability `field-control`**, specified here once. It is the binding every rind
  form control implements:
  - register once with the enclosing Field (id, labelable or not, `focus()`, its native
    validity element, its typed value);
  - receive the Field's label and description ids and its
    `disabled`/`readOnly`/`required`/`invalid`, including a disabled Fieldset;
  - report accepted value changes and commits;
  - the Field's ARIA goes only to the registered control.

  Text Field (`add-text-field`) is the first implementation, and the existing control
  changes adopt it.
- **Shared capability `field-validation`**, specified here once:
  - sources in a fixed order: controlled `invalid`, server errors, native constraints,
    custom `validate` (sync or async);
  - native constraint validation as the single source of validity, through
    `setCustomValidity`;
  - display timing: `validationMode` `submit` (default: on the first submit attempt, then
    live), `blur` or `change`;
  - `validationBehavior` `native` (blocks submission) or `aria` (does not);
  - `touched`, `dirty` and `filled`;
  - the browser bubble kept when no ErrorMessage is rendered;
  - focus on the first invalid control;
  - announcements once per distinct message through the Announcer.
- ARIA: errors in `aria-describedby`, plus `aria-errormessage` only when the consumer opts
  in. `aria-invalid` only while an error is displayed, and only on roles that allow it.
  ErrorMessage is not a live region.
- The field **contract and driver** (`getField`), plus model-based tests driven through Text
  Field, stories, a theme stylesheet and a docs page.

## Capabilities

### New Capabilities

- `field`: the Field component: anatomy, labelling and description, ErrorMessage,
  data attributes, contract, theme.
- `field-control`: the binding between a Field and the rind-ui control inside it, and the
  rules every form control follows inside a Field.
- `field-validation`: the validation model (sources, order, native validity, timing,
  behaviour, async, display state, focus on invalid, announcements).

### Modified Capabilities

None. `control-label`, `hidden-form-input` (`add-checkbox`), `button-like-element`
(`add-button`), `layer-stack` (`add-overlay-infrastructure`) and the form control changes
need additions. They are listed in design.md under "Requests to other changes".

## Non-goals

- Form-wide behaviour: server errors by name, `onFormSubmit` values, the submit summary
  announcement, holding a submit for async validators, reset policy. These are in
  `add-form`. Field works inside a plain `<form>` without them.
- Several controls in one Field. A group of controls is one control (Checkbox Group, Radio
  Group) or a Fieldset of Fields (base-ui#4121, zag#2475).
- Schema integrations (Zod, Valibot) and form-level cross-field validators. A `validate`
  function receives all values, which is enough for an adapter later.
- Input masking and formatting.
- Framework adapters other than React; fx.

## Impact

- `packages/core`:
  - `components/field/` (machine, connect, contract, messages);
  - `components/shared/field-control.ts` (the binding);
  - `dom/constraint-validity.ts` (read, set and clear custom validity, find the first
    invalid control in tree order).
- `packages/react/src/field/`: the Field parts and the `FieldControl` context that controls
  read.
- `@rind-ui/testing`: `getField`, the `field-associated` trait and its invariants.
- `@rind-ui/theme/field.css`, stories, docs.
- Reado: its settings `Field` (a wrapping `<label>`) maps to `Field.Root` + `Field.Label`.
- No new runtime dependency.
