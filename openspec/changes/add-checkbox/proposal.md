## Why

Checkbox is a wave-1 component that Reado uses, and it is rind-ui's first form-associated
control. Every library we studied has had bugs in the same places: synthetic events from
the hidden input, double toggles through labels, Enter handling, form reset, and a hidden
input that shifts the layout. Getting the hidden-input and label wiring right once here also
covers Switch, Checkbox Group and the form controls that follow (Radio Group, Select,
Slider).

Research: [checkbox](../../../docs/research/checkbox.md) ·
[button](../../../docs/research/button.md) (button-like element) ·
[accessibility](../../../docs/research/accessibility.md) §1.4, §2, §10 ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) ·
[native-platform](../../../docs/research/native-platform.md) §14

Depends on: `add-foundations` (machine runtime, controllable values, contracts, drivers,
`testMachine`), `add-a11y-foundations` (press interactions, modality and focus-visible,
keyboard, ids, hidden content, invariants) and `add-button`. The Control is a button-like
part and uses `button-like-element` unchanged.

## What Changes

- A public **Checkbox** component with parts `Root`, `Control` (a native
  `<button role="checkbox">`), `Indicator`, `Label`, `Description` and an automatic
  `HiddenInput`. Its value is `checked: boolean | "indeterminate"` (`checked` /
  `defaultChecked` / `onCheckedChange`). It supports `disabled`, `focusableWhenDisabled`,
  `readOnly`, `required`, `invalid`, `name`, `value`, `form` and `uncheckedValue`.
- APG Checkbox semantics: `aria-checked="true|false|mixed"`, Space toggles, Enter never
  toggles and performs the form's implicit submission, and activating a mixed checkbox
  checks it.
- **Shared capability `hidden-form-input`**, specified here once. It is used by Checkbox,
  `add-switch` and `add-checkbox-group`, and later by Radio Group, Select, Slider and the
  other form controls. It covers:
  - a hidden native input that never shows up for AT or affects layout;
  - mirroring the value as DOM properties;
  - `input` and `change` events for user changes only (no synthetic `click`);
  - form reset turned into a `RESET` machine event;
  - native constraint validation, with focus redirected to the visible control;
  - `uncheckedValue`;
  - implicit submission on Enter;
  - a `form-associated` test trait with its invariants.
- **Shared capability `control-label`**, specified here once. It is used by Checkbox,
  `add-switch` and `add-checkbox-group` (items), and later by Radio. It covers:
  - Label and Description parts for a labelable control;
  - exactly one toggle per label click, whether it comes from our Label, a consumer
    `<label for>` or a wrapping `<label>`;
  - no focus ring after a label click;
  - an `aria-labelledby` fallback for a non-labelable substituted control.
- The checkbox **contract and driver** (`getCheckbox`): actions, queries, state
  observations and the `form-associated` trait. There are also model-based tests over
  `unchecked | checked | indeterminate`.
- Stories (including state stories), a theme stylesheet with a visible checkmark and dash
  in forced colors, and a docs page.

## Capabilities

### New Capabilities

- `checkbox`: the Checkbox component — anatomy, checked value and indeterminate state,
  ARIA, keyboard, pointer and AT activation, disabled and read-only, form participation
  through `hidden-form-input`, data attributes, contract, invariants, theme.
- `hidden-form-input`: the shared hidden native input that gives non-native controls form
  participation, native validation, reset and implicit submission, and the
  `form-associated` trait.
- `control-label`: the shared Label and Description wiring for labelable controls,
  including how label activation is counted.

### Modified Capabilities

None. `button-like-element` (`add-button`), `press-interactions`, `interaction-modality`,
`hidden-content` and `element-ids` (`add-a11y-foundations`) are used as specified. Where
this change needs something from them — the visually hidden input variant's static
position, label-forwarded clicks counting as `pointer`, a checkedness read in the test
`Env` — it is specified in the new capabilities above and implemented on top of their code.

## Non-goals

- **Checkbox Group** and the "select all" parent: `add-checkbox-group`. That change also
  adds the item-side hooks it needs, such as reset suppression.
- **Switch**: `add-switch`, which reuses `hidden-form-input` and `control-label`.
- **Field / Fieldset integration**: error message part, validation display timing, and
  `data-valid` / `data-touched` / `data-dirty`. These belong to the Field change. Until then
  the Checkbox takes `invalid` and `required`.
- Checkbox items inside collections: menu item checkboxes, row selection in Table or Grid
  List, Shift-click ranges. Those are the Menu and collections changes.
- A custom `trueValue` / `falseValue` (Reka) or non-string values.
- A bridge for React's synthetic `<form onChange>`, which React derives from `click` (see
  design).
- Toggling with Enter, native `<input type="checkbox">` as the visible control, and
  `ElementInternals`.

## Impact

- New code in `packages/core`:
  - `components/checkbox/` (machine, connect, contract);
  - `dom/hidden-input.ts` (`hidden-form-input`);
  - `components/shared/control-label.ts`;
  - the label-activation rule in `dom/press.ts` / `dom/modality.ts`.
- `packages/react/src/checkbox/` for the parts.
- `@rind-ui/testing`:
  - `getCheckbox`;
  - the `form-associated` trait and its invariants;
  - `Part.checked()` / `Part.indeterminate()` reads in both adapters.
- `@rind-ui/theme`: `checkbox.css`. Storybook: the checkbox stories. Docs: the checkbox page.
- Reado: replaces Ark's `Checkbox` during its migration. Mapping:
  `onCheckedChange({ checked })` becomes `(checked, details)`, and the explicit
  `HiddenInput` part goes away.
- No new runtime dependency.
