## Context

The research note ([checkbox.md](../../../docs/research/checkbox.md)) compares the nine
libraries and records the bug history behind every scenario. This change builds on:

- `add-foundations`: `setup().machine()`, `controllable()` with state binding, `$sync` and
  `$reverted`, `ChangeDetails`, `createService`, contracts, drivers, `testMachine`;
- `add-a11y-foundations`: `core/dom/press.ts` (per-role keyboard rules: role `checkbox` is
  Space-only), `core/dom/modality.ts`, `focusSafely`, `core/dom/visually-hidden.ts` (input
  variant), `ids.ts`, `a11y/guards.ts`, the a11y invariants;
- `add-button`: `core/components/shared/button-like.ts` (element substitution,
  `focusableWhenDisabled`, disabled fieldset, shared data attributes).

The two shared capabilities, `hidden-form-input` and `control-label`, are new and are used
by `add-switch` and `add-checkbox-group`, which are written against this design.

## Goals / Non-Goals

**Goals:**
- One hidden-input module and one label module that Switch, Checkbox Group, Radio Group,
  Select and Slider can use unchanged.
- Every bug in the research table that maps to a scenario has a test that reproduces it,
  in jsdom where the event order can be synthesised and in browser mode otherwise.
- `testMachine(checkboxContract, …)` covers every transition in every modality, with the
  `form-associated` invariants on every step.

**Non-Goals:**
- An error message part (Field change). The Field binding itself (`field-control`, Field as
  label/description source, validity element) is an amendment from `add-field` (tasks A.5–A.7).
- Group behaviour (`add-checkbox-group`). That change adds the item-side hooks, such as the
  group reset suppression the `hidden-form-input` spec already allows.

## Decisions

### 1. Layout

```
packages/core/src/
├─ components/checkbox/
│  ├─ checkbox.machine.ts
│  ├─ checkbox.connect.ts     uses button-like, control-label, hidden-input helpers
│  ├─ checkbox.contract.ts    contract + checkboxInvariants
│  └─ checkbox.messages.ts    (empty today; no AT strings of its own)
├─ components/shared/control-label.ts   Label/Description props, label-press fallback
└─ dom/hidden-input.ts                  sync, events, reset, validation focus, implicit submit
packages/react/src/checkbox/            Root, Control, Indicator, Label, Description (+ internal HiddenInput)
packages/testing/src/traits/form-associated.ts
packages/theme/src/checkbox.css
apps/storybook/src/checkbox/*.stories.tsx
```

### 2. Machine

```ts
type CheckedState = boolean | "indeterminate"

type CheckboxEvent =
  | { type: "TOGGLE"; modality: Modality }   // Control PRESS; Label press in the non-labelable fallback
  | { type: "RESET" }                        // hidden-input: the form's reset event
  | { type: "FOCUS"; modality: Modality }
  | { type: "BLUR" }
  | { type: "INPUT.SYNCED" }                 // hidden-input: a pending user change was dispatched

export const checkboxMachine = setup({
  types: type<{ props: CheckboxProps; events: CheckboxEvent; env: CheckboxEnv;
    context: { focused: boolean; pendingUserValue: CheckedState | null; initial: CheckedState } }>(),
  guards: {
    canToggle: ({ props }) => !props.disabled && !props.readOnly,
    defaultIsChecked: ({ context }) => context.initial === true,
    defaultIsIndeterminate: ({ context }) => context.initial === "indeterminate",
  },
  actions: {
    recordUserChange,   // pendingUserValue := next value (also runs for controlled proposals)
    clearUserChange,    // on $reverted and INPUT.SYNCED
    syncHiddenInput,    // env.formInput.sync(snapshot) — runs before onCheckedChange (spec: headlessui#3760)
    setFocused, clearFocused,
  },
  effects: { formInput: /* env.formInput.track({ onReset: () => send({ type: "RESET" }) }) */ },
}).machine({
  id: "checkbox",
  context: (props) => ({ focused: false, pendingUserValue: null, initial: props.checked ?? props.defaultChecked ?? false }),
  values: {
    checked: controllable("checked", {
      fallback: false,
      states: { unchecked: false, checked: true, indeterminate: "indeterminate" },
    }),
  },
  initial: "unchecked",            // overridden by the bound value
  effects: ["formInput"],          // service-scoped: reset listener, focus forwarding, change dispatch
  on: {
    FOCUS: { actions: ["setFocused"] }, BLUR: { actions: ["clearFocused"] },
    RESET: [
      { guard: "defaultIsChecked", target: "checked" },
      { guard: "defaultIsIndeterminate", target: "indeterminate" },
      { target: "unchecked" },
    ],
    $reverted: { actions: ["clearUserChange"] },
    "INPUT.SYNCED": { actions: ["clearUserChange"] },
  },
  states: {
    unchecked:     { entry: ["syncHiddenInput"], on: { TOGGLE: { guard: "canToggle", target: "checked",   actions: ["recordUserChange"] } } },
    checked:       { entry: ["syncHiddenInput"], on: { TOGGLE: { guard: "canToggle", target: "unchecked", actions: ["recordUserChange"] } } },
    indeterminate: { entry: ["syncHiddenInput"], on: { TOGGLE: { guard: "canToggle", target: "checked",   actions: ["recordUserChange"] } } },
  },
})
```

- **Three flat states bound to one controllable.** A separate `indeterminate` prop (React
  Aria, Base UI, Headless UI, Bits) allows `checked && indeterminate`, which has no
  `aria-checked` value and doubles the graph. A union value gives three states that model
  tests walk exactly, and it matches Ark, which Reado migrates from. `onCheckedChange`
  receives `CheckedState`, but user-driven calls only ever pass `boolean` (spec: Checked
  Value).
- **`RESET` targets the current `defaultChecked` prop** (decision from add-field/add-form,
  2026-10-14; react-spectrum#6830, radix#4155): native React inputs update `defaultChecked`
  when the prop changes, and React 19 action resets restore it. `context.initial` is
  therefore refreshed from the latest `defaultChecked` prop, and the `RESET` guards read it.
  A `defaultChecked` change still never changes the current value or state
  (machine-runtime §5.4); it only changes what a reset restores. Guards on context are
  checked by the driver (testing.md).
- **Focus** is context, not a state. Two orthogonal focus states would double the graph for
  no transition that depends on them. `data-focus-visible` is computed in connect from
  `focused` and the environment's modality (a11y-foundations design §3).
- **`pendingUserValue`** is how the hidden input tells a user change from a programmatic one
  in controlled mode, where the user's `TOGGLE` is only a proposal: the transition's own
  actions run (`recordUserChange`), and the `$sync` that applies it later finds a matching
  pending value. A refusal produces `$reverted`, which clears it, so a later parent-driven
  change stays silent. Radix needed a user-click counter for the same problem (RX#4102).
- **Alternatives considered:** a single `ready` state with `checked` in context (Zag). It was
  rejected because the graph would have no edges for model tests to cover and `data-state`
  would not map to states.

### 3. Hidden input (`core/dom/hidden-input.ts`, capability `hidden-form-input`)

```ts
interface FormInputCapability {        // added to the Environment by this change
  sync(input: HiddenInputValue): void  // properties only; never the `checked` attribute
  track(options: {
    onReset(): void
    resetsWithForm?: boolean           // false when a group owns the reset (add-checkbox-group)
  }): () => void
}
type HiddenInputValue = { checked: boolean; indeterminate: boolean; value: string;
  dispatch: boolean }                  // dispatch = pendingUserValue matches the new value
```

- **Rendering**: Root renders `<input type="checkbox" aria-hidden tabIndex={-1} id=…
  data-part="hidden-input">` after its children. It uses the visually hidden input style:
  `position: absolute`, no offsets (so it sits at its static position next to the Control),
  1 px, `margin: -1px`, `clip-path: inset(50%)`, `pointer-events: none`. Base UI's style
  avoids Radix's control-sized, translated input (RX#3588, RX#867) and an off-screen focus
  scroll (ARK#3705).
- **Sync**: the `syncHiddenInput` entry action runs on every state entry, including `$sync`
  entries and the first start. It writes `checked` and `indeterminate` through the
  prototype's property setters, so React's value tracker is not confused. When `dispatch` is
  true it then dispatches `input` and `change` (bubbling, `composed: false`) and sends
  `INPUT.SYNCED`. Entry actions run before the runtime calls `onCheckedChange` for an
  uncontrolled change, which satisfies the HUI#3760 scenario. A post-commit hook in the React
  parts calls `sync` again with `dispatch: false`, so the DOM is right after hydration and
  after any re-render. `sync` never calls `setCustomValidity`, so a message an enclosing
  Field set on the input (it is the `field-control` validity element) survives every
  re-sync. The `defaultChecked` property follows the current `defaultChecked` prop. The
  server render emits `checked` (default) and `name`/`value`/
  `required`/`disabled`/`form` attributes.
- **No `click`**: React derives `onChange` for checkboxes from `click`, so React's synthetic
  `<form onChange>` does not see our changes. A synthetic `click` reaches ancestors' click
  handlers, which is the largest bug class in the table (RX#3265, ZG#633, BU#5175). We choose
  native listeners and correct click semantics. The trade-off is documented on the docs page
  (Non-goal in the proposal).
- **Reset**: `track` listens on `input.form` (resolved again when `form` changes) for
  `reset`, ignoring `defaultPrevented` resets. It calls `onReset` synchronously, which sends
  `RESET`. Then, after one animation frame (the browser has reset the input to its
  `defaultChecked` by then), it re-syncs from the latest snapshot.
- **Focus forwarding**: a `focus` listener on the hidden input calls
  `focusSafely(control, { modality: "keyboard" })`. Validation focus counts as keyboard so
  `data-focus-visible` shows (React Aria treats `invalid` focus the same way).
- **Implicit submission**: connect's Control `keydown` for Enter, unless `defaultPrevented`,
  calls `implicitSubmit(form)`. That clicks `form`'s first submit button in tree order (or a
  submit button associated through `form=`), the HTML default button, if it is enabled. With
  no default button it does nothing, matching Chromium, Firefox and WebKit for checkboxes.
  Base UI's `getDefaultFormSubmitter` and Headless UI's `attemptSubmit` do the same.
- **Two-part values** (requested by add-date-range-field): the list carriers cannot express a typed pair, so
  `HiddenInputValue` may carry a second input (same declared type, `endName`) that `sync` mirrors like the first. Only the first
  is the validity element and the Field's control; the second is never focusable or registered. Checkbox itself never renders it.
- **`uncheckedValue`**: Root also renders `<input type="hidden" name value=uncheckedValue>`
  while unchecked and enabled.
- **Fieldset**: `button-like-element` already tracks a disabled fieldset. The hidden input
  is natively disabled by it too, so submission matches.

### 4. Label wiring (`core/components/shared/control-label.ts`, capability `control-label`)

- **Labelable Control** (default `<button>`): `Label` gets `htmlFor = controlId` and no
  handlers. The browser's label activation dispatches one `click` on the Control, and press
  interactions turn it into one `PRESS`, mapped to `TOGGLE`. Because the hidden input comes
  after the Control in tree order, it is never a wrapping label's first labelable
  descendant.
- **Modality**: `dom/modality.ts` and `dom/press.ts` gain one rule. A `click` on element E,
  preceded in the same interaction by a `pointerdown` on a `<label>` whose `control === E`
  (or on a descendant of such a label), is a pointer press, not virtual. The label's
  `.control` is read at `pointerdown` time. This covers our Label, consumer `<label for>` and
  wrapping labels, which no Label-part handler could. The press module then focuses the
  Control through `focusSafely`, keeping modality `pointer`.
- **Non-labelable Control** (`render={<div />}`): connect reads the tag (`button-like`
  helper). The Label renders without `htmlFor`, the Control gets `aria-labelledby`, and the
  Label spreads press handlers whose `PRESS` sends `TOGGLE` with the Label's modality and
  focuses the Control.
- **`label-interaction`** (add-label): the Label part uses the shared module for the
  double-click guard (`detail > 1` only), never cancels clicks, and emits its development
  warnings; the fallback's press focuses through its focus forwarding and then sends
  `TOGGLE`.
- **Field**: when the control is registered with a Field (`field-control`), the Field's
  Label and Description replace the component's own as label and description source; an
  own Label inside a Field warns in development.
- **Name**: connect never sets `aria-labelledby` for a labelable Control, so a consumer
  `aria-label` plus a wrapping label is not concatenated by us (BU#5786). Accname rules
  decide, and `aria-label` wins.
- **Description**: registered on mount and unmount (accessibility.md §2). `aria-describedby`
  = consumer ids + group ids + Description id, the last only while rendered.

### 5. Connect output

| Part | Attributes (beyond `data-scope`/`data-part`/`data-instance`) |
|---|---|
| Root | `data-state`, `data-disabled`, `data-readonly`, `data-required`, `data-invalid`, `data-focus`, `data-focus-visible` |
| Control | button-like attributes (`type="button"`, disabled / `aria-disabled`), `role="checkbox"`, `aria-checked`, `aria-required`, `aria-invalid`, `aria-readonly`, `aria-describedby`, `aria-labelledby` (fallback only), `id`; press, focus, hover and Enter handlers; the state `data-*` plus `data-focus`, `data-focus-visible`, `data-pressed`, `data-hover` |
| Indicator | `aria-hidden="true"`, state `data-*` |
| Label | `htmlFor` (labelable Control) or press handlers (fallback), `id`, state `data-*` |
| Description | `id`, state `data-*` |
| HiddenInput | `type="checkbox"`, `aria-hidden`, `tabIndex=-1`, `id`, `name`, `value`, `form`, `required`, `disabled`, `defaultChecked` (current `defaultChecked` prop), style |

`TOGGLE` comes from the press module's `PRESS` only. `PRESS.START/END/UP/CANCEL` drive
`data-pressed` and are not sent to the machine.

### 6. Contract and driver

As specified in `checkbox` → Contract. Implementation notes:

- `toggle`'s postcondition compares against `checkedState` read before the action. The
  action implementation captures it and passes it to `done` as an argument. This needs no
  change to the foundations contract shape.
- `resetForm` finds the reset button with `env.find({ role: "button", name })`, using a name
  the story provides through the driver's anchor options (default "Reset").
- `formValue` reads `part("hidden-input").checked()` and `.value()`. `Part.checked()` and
  `Part.indeterminate()` are added to both adapters: the DOM adapter reads the property and
  Playwright uses `locator.evaluate`.
- `form-associated` trait (`@rind-ui/testing/traits`): the runner installs `input`, `change`
  and `click` counters on the hidden input and on the component's parent element before the
  first step. It compares them with the oracle's count of value-changing steps (steps whose
  oracle transition changed `values.checked` and was not `$sync`-only without a pending user
  change).
- Model-based configurations: `props` sets `{}` (uncontrolled), `{ defaultChecked:
  "indeterminate" }`, `{ readOnly: true }`, `{ disabled: true, focusableWhenDisabled: true }`
  and a controlled wrapper story that applies every proposal. `RESET` runs through
  `resetForm` against a story with a form and a reset button. `FOCUS`, `BLUR` and
  `INPUT.SYNCED` are `skip`, because they are not user-reachable as events.

### 7. React parts

Thin, as usual. `Checkbox.Root` creates the service (`useMachine`), renders `children` then
the internal `HiddenInput` (and the `uncheckedValue` input). `Control`, `Indicator`, `Label`
and `Description` read slices with `useSelector`. `Indicator` children may be a function of
`{ checked, indeterminate }`, so the consumer can draw a check or a dash.

### 8. Theme

`checkbox.css`:

- the control box has a border, and the Indicator glyph is an inline SVG with
  `currentColor`;
- `[data-state=unchecked]` hides the glyph with `visibility: hidden`, so it stays in place
  with no layout jump;
- `@media (forced-colors: active)`: checked and indeterminate use `Highlight` and
  `HighlightText`, disabled uses `GrayText`, the border is always `CanvasText`;
- the hit area comes from `--rind-hit-area`, and the Label is part of the target;
- transitions use duration tokens.

## Risks / Trade-offs

- [React apps that rely on synthetic `<form onChange>` miss checkbox changes] → Documented,
  with `onCheckedChange` or a native `change` listener as the answer. Revisit with a React
  adapter bridge if Reado or early users need it (open question in the research note).
- [The label-press modality rule reads `label.control` at `pointerdown`; a label whose `for`
  changes between down and click is misclassified] → The only consequence is a focus ring
  (`virtual`); activation is still one `PRESS`.
- [Implicit submission is reimplemented] → It is small, follows HTML's default-button rule,
  and runs as a browser-mode test in all three engines against a native checkbox in the same
  form.
- [The entry-action sync touches the DOM from a machine action] → Only through the injected
  `FormInputCapability`. Node tests use a recording fake, as they do for focus.
- [A hidden input in every Checkbox, even outside forms] → One small node per Checkbox. In
  return the server render and pre-hydration submission work, and form detection is not a
  mount-time switch (the reason for Radix's `isFormControl` SSR default).

## Migration Plan

None for rind-ui (no public API yet). Reado's Ark Checkbox maps as follows:

- `Checkbox.Root` (`<label>`) becomes `Root` + `Label`;
- `Checkbox.Control` becomes `Control`;
- `Checkbox.HiddenInput` is deleted;
- `onCheckedChange({ checked })` becomes `onCheckedChange(checked, details)`.

Amendment (from add-date-field): the validity element may also carry a control-owned message (e.g. `badInput`) composed with the Field's; re-syncs never clear it and may call `setCustomValidity` to keep it (task A.9).
