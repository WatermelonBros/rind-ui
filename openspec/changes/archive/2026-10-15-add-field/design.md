## Context

[field.md](../../../docs/research/field.md) compares the libraries and records the bugs
behind each scenario. This change builds on:

- `add-checkbox`: `control-label`, the Label/Description wiring with the label-forwarded
  click rule; `hidden-form-input`, the hidden native input with `required`, the `invalid`
  focus redirect, reset and the `form-associated` trait;
- `add-label`: `label-interaction`;
- `add-fieldset`: the disabled scope;
- `add-a11y-foundations`: the `Announcer`, `messages`, `focusSafely` with modality, the IME
  guard, `element-ids`;
- `add-overlay-infrastructure`: `presence` for the ErrorMessage, and `layer-stack`'s
  inside queries for `touched`.

Existing controls (Checkbox, Switch, Checkbox Group, Radio Group, Select, Combobox) already
take `disabled`, `readOnly`, `required`, `invalid`, `name` and extra `aria-describedby` ids,
and render their own Label and Description through `control-label`. Checkbox Group already
passes props to item services through a React context the Checkbox Root reads (its design
§2). Field uses the same pattern.

## Goals / Non-Goals

**Goals:**
- One validation engine. Controls report events and never decide timing (base-ui#1050).
- A Field works inside a plain `<form>`. Form adds behaviour but is not required.
- `testMachine` covers every Field transition, driven through Text Field's contract.

**Non-Goals:**
- Server-error mapping by name, the submit summary, and holding a submit for async
  validators (`add-form`).

## Decisions

### 1. Layout

```
packages/core/src/
├─ components/field/
│  ├─ field.machine.ts
│  ├─ field.connect.ts         Root/Label/Description/ErrorMessage props; the binding object
│  ├─ field.contract.ts        contract + fieldInvariants
│  └─ field.messages.ts
├─ components/shared/field-control.ts   FieldControlBinding type + mergeFieldProps(controlProps, binding)
└─ dom/constraint-validity.ts           readValidity, setOwnCustomValidity/clear, firstInvalidInTreeOrder
packages/react/src/field/      Root (service + context), Label, Description, ErrorMessage
packages/testing/src/traits/field-associated.ts
packages/theme/src/field.css
```

### 2. Machine

```ts
type FieldEvent =
  | { type: "CONTROL.REGISTER"; control: RegisteredControl }   // id, labelable, focus(), validityElement(), value()
  | { type: "CONTROL.UNREGISTER"; id: string }
  | { type: "CONTROL.CHANGE"; value: unknown; user: boolean; composing: boolean }
  | { type: "CONTROL.COMMIT" }                                  // Enter, Select close
  | { type: "FOCUS.ENTER"; modality: Modality }
  | { type: "FOCUS.LEAVE" }                                     // logical focus left (layers included)
  | { type: "INVALID" }                                         // native `invalid` on the validity element
  | { type: "SUBMIT.ATTEMPT" }                                  // from Form (validate(), submit)
  | { type: "VALIDATED"; token: number; result: ValidationResult }
  | { type: "ERRORS.EXTERNAL"; messages: string[] }             // from Form, by name
  | { type: "RESET" }

setup({ guards: { displayAllowed, hasError, isAsync, isStale, isDisabled, onlyValueMissingAndPristine },
        actions: { register, unregister, recordValue, markTouched, markAttempted, runSources,
                   setCustomValidity, clearExternal, focusControl, announce, resetFlags },
        effects: { validityListeners /* invalid (cancel iff ErrorMessage), form reset */ } })
.machine({
  id: "field",
  values: { invalid: bindProp({ states: { true: "invalid", false: "valid" } }) },   // read-only prop binding
  initial: "idle",
  states: {
    idle:       { on: { /* CHANGE/LEAVE/INVALID/SUBMIT run sources; display gate decides target */ } },
    validating: { on: { VALIDATED: [{ guard: "isStale" }, { guard: "hasError", target: "invalid" }, { target: "valid" }] } },
    valid:      {},
    invalid:    {},
  },
})
```

- **States are the display**, not the realtime result. `idle` means nothing is displayed.
  The realtime error is always computed (`runSources`) and written to native validity
  (`setCustomValidity`), but the machine only moves to `valid`/`invalid` when
  `displayAllowed` holds: the mode rule, the submit-attempt flag, and the pristine
  `valueMissing` rule. So `aria-invalid`, `data-invalid` and the ErrorMessage all derive
  from one state, and the invariants check exactly that.
- `touched`, `dirty`, `filled`, `focused`, `attempted`, `initialValue` (captured on the
  first registration only), `token` (latest validation) and `announced` (the last
  announced message) live in context. They are orthogonal flags, and as states they would
  multiply the graph. Guards read them.
- `invalid` is a read-only prop binding (`bindProp`). `true`/`false` pin the state through
  `$sync:invalid` edges; `undefined` releases it (base-ui#3777).
- **Async**: `runSources` returns a promise for a promise-returning `validate`. The machine
  enters `validating`, an effect awaits the promise and sends `VALIDATED` with the token,
  and `isStale` drops older tokens. The debounce is a delayed transition through the
  scheduler.
- **Announcements**: the `announce` action runs on entry to `invalid` and on a message
  change while in `invalid`. It is skipped when `focusControl` moved focus in the same step
  (failed submit), while `composing`, or when the message equals `announced`. It calls
  `env.announcer.announce({ message, priority: "polite", key: fieldKey })`.

### 3. The binding (`field-control`)

```ts
interface FieldControlBinding {
  ids: { label?: string; description?: string; error?: string }   // rendered parts only
  labelledBy(labelable: boolean): string | undefined               // control-label rule
  state: { disabled; readOnly; required; invalid; validationBehavior }
  errorMessageAttribute: "describedby" | "both"
  register(control: RegisteredControl): () => void
  report(event: { type: "change"; value; user; composing } | { type: "commit" }): void
}
```

- The React `Field.Root` provides the binding through a `FieldControlContext`. Every
  control's Root reads it and merges it with its own props through
  `mergeFieldProps(props, binding)`: OR for the booleans; describedby = Field ids + own +
  consumer; `name` from the Field when the control has none. This is the only new code in
  each control (see Requests).
- A control's popup or auxiliary input never reads the context. The control passes the
  binding only to its registered part (base-ui#4120).
- Focus leaving: the Field root listens to `focusin`/`focusout`. `FOCUS.LEAVE` is sent
  when `relatedTarget` is neither inside the Field root nor inside a layer whose logical
  parent is inside it. `null` related targets are ignored (window blur), as in
  dismissable-layer's outside-focus rule. That needs a layer-stack query (Requests).
- `invalid` events do not bubble, so the Field listens on the registered validity element
  (in the `validityListeners` effect, re-attached when the control re-registers).
- First invalid in tree order: the `INVALID` handler checks
  `firstInvalidInTreeOrder(form) === validityElement`, walking `form.elements` (React Aria's
  rule). Hidden inputs are form elements, so groups and Select take part. Only that Field
  focuses.

### 4. Connect output

| Part | Attributes (beyond scope attributes) |
|---|---|
| Root | state `data-*` (spec), `data-focus`, `data-focus-visible` |
| Label | `control-label` Label props for the registered control (`for` or press focus), `label-interaction` handlers, `id`, state `data-*` |
| Description | `id`, state `data-*` |
| ErrorMessage | `id`, state `data-*`; content from the displayed messages; mounted through `presence` |

Part ids come from `element-ids` (`field-<root>-label`, …). Description and ErrorMessage
are expected parts when rendered in the first pass, so the server HTML carries the
`aria-describedby` relation.

### 5. Contract, driver, model-based tests

- `getField(...).control(getX)` builds the control driver with the Field root as the
  search container. This is the only driver composition; it needs no change to drivers.
- `testMachine(fieldContract, …)` runs with a Text Field inside the Field. `CONTROL.CHANGE`
  maps to the Text Field driver's `type`/`clear`, `CONTROL.COMMIT` to Enter, `INVALID` and
  `SUBMIT.ATTEMPT` to clicking the story's submit button, `RESET` to its reset button, and
  `VALIDATED` is `skip` ("resolved by the effect"). Configurations: each `validationMode`,
  both behaviours, an async `validate` with fake timers, `invalid` prop steps.
- `field-associated` trait (`@rind-ui/testing/traits`) per the spec; Text Field declares it
  in `add-text-field`, and the other controls in their changes (Requests).

### 6. Theme

`field.css`: `:where([data-scope="field"])`, a grid gap from `--rind-field-gap`, Label
`--rind-field-label-*`, Description `--rind-field-description-color` (fallback
`--rind-color-text-muted`), ErrorMessage `--rind-field-error-color` (fallback
`--rind-color-danger-text`) and a `::before` mask icon in `currentColor`. No variant
family.

## Requests to other changes

- **APPLIED (coordinator, 2026-10-14).** **add-checkbox (`control-label`)**: the Label and Description may come from an enclosing
  Field. When the control is registered with a Field, `Label Names The Control` uses the
  Field's Label and its describedby rule adds the Field's Description and ErrorMessage
  ids (field-control "Description And Error Wiring"). A control's own Label inside a Field
  warns in development.
- **add-checkbox (`hidden-form-input`)**: items 1, 2 and 4 **APPLIED (coordinator, 2026-10-14).** Item 3 was not part of the approved set and is not applied.
  1. Expose the constraint input to `field-control` registration as the validity element.
  2. Keep a custom validity message set by Field across `sync()` (sync must not reset it).
  3. When Field cancels `invalid`, focus is moved by Field's focus target. The existing
     focus redirect stays for the uncancelled case.
  4. **Reset target — decided (coordinator, 2026-10-14)**: a form reset restores the
     *current* `defaultChecked` / `defaultValue` prop, not the one captured at creation,
     for parity with native React inputs, which update `defaultValue` when the prop
     changes (react-spectrum#6830, radix#4155). Changing a `default*` prop still never
     changes the component's current value or state (machine-runtime rule); it only
     changes what a reset restores. Applied in add-checkbox `hidden-form-input` "Form
     Reset" (scenario "Reset restores the current default") and aligned in add-slider.
- **APPLIED (coordinator, 2026-10-14).** (add-slider included.) **add-checkbox, add-switch, add-checkbox-group, add-radio-group, add-select,
  add-combobox, add-autocomplete (and every later form control: Slider, Number Input, Pin
  Input, Date Picker, Tags Input, Color Picker, Rating, File Upload)**: implement
  `field-control`:
  - read the binding in the Root;
  - register once (groups as one control; items must not register);
  - report accepted changes and commits (Select/Combobox: close = commit);
  - declare the `field-associated` trait;
  - a focus target that picks the invalid item or the tab stop;
  - add the field prop × control matrix test.

  Their `invalid` prop is OR'ed with the Field's displayed invalid, and their own
  ErrorMessage parts (Checkbox Group, Radio Group) remain usable outside a Field and
  defer to the Field's inside one.
- **APPLIED (coordinator, 2026-10-14).** **add-overlay-infrastructure (`layer-stack`)**: an inside query by element: "is target T
  inside element E, counting layers whose logical parent is inside E", for Field's
  `FOCUS.LEAVE` with portalled popups.
- **APPLIED (coordinator, 2026-10-14).** **add-button (`button-like-element`)**: read the Fieldset/Field disabled through the
  binding as well as the DOM tracker (also requested by add-fieldset).

## Risks / Trade-offs

- [Native validity as the source means `setCustomValidity` on every validation] →
  Cheap, synchronous, and the only way `form.checkValidity()` agrees with the UI.
- [The browser bubble shows for Fields without an ErrorMessage, with browser-language
  text] → It is better than a silent error. The docs recommend an ErrorMessage, and
  `messages` localise the text.
- [The touched rule depends on a new layer-stack query] → Until it lands, Field falls back
  to DOM containment plus "focus moved into any open layer", which is correct for one
  popup at a time.
- [Announcing errors may double with a screen reader re-reading describedby on focus] →
  Not announced when focus moved to the control. The model invariant and the manual
  protocol check it.

## Migration Plan

None for rind-ui. In Reado, `organisms/settings/fields.tsx` `Field` (`<label>` wrapping)
maps to `Field.Root` + `Field.Label` + the control. The `ModifiedMark` button stays a
sibling of the Label, as today.
