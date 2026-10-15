## Context

See proposal.md for why. The Switch reuses, unchanged: the machine runtime and
controllables (`add-foundations`), press / modality / keyboard modules and invariants
(`add-a11y-foundations`), `button-like-element` (`add-button`) and the hidden form input,
label wiring and implicit-submission helper used by the Checkbox Control
(`add-checkbox`). Research decisions: `docs/research/switch.md` → Decisions.

## Goals / Non-Goals

**Goals:**
- The Switch is the Checkbox's anatomy with `role="switch"`, a `Thumb` instead of an
  `Indicator`, and no mixed state, so the shared modules are reused as-is.
- Every bug in the research table that is ours to prevent has a scenario and a test.

**Non-Goals:**
- A shared "boolean control" machine factory for Checkbox, Switch and Toggle. Each
  machine is a few lines; sharing would couple three components' state names for no
  consumer benefit. Revisit if a fourth boolean control appears.

## Decisions

### Layout

```
packages/core/src/components/switch/
├─ switch.machine.ts    states, events, guards (no DOM)
├─ switch.connect.ts    props per part; uses button-like-element, control-label, hidden-form-input helpers
└─ switch.contract.ts   contract + switchInvariants
packages/react/src/switch/switch.tsx   Root, Control, Thumb, Label, Description (Root renders HiddenInput)
packages/theme/src/switch.css
```

### Machine

```ts
type SwitchEvent =
  | { type: "TOGGLE"; modality: Modality }          // Control PRESS, Label press (control-label)
  | { type: "RESET" }                               // hidden-form-input: form reset
  | { type: "FOCUS"; modality: Modality }
  | { type: "BLUR" }

switchMachine = setup({ types, guards: { canToggle }, actions: { setFocused, clearFocused } })
  .machine({
    id: "switch",
    values: { checked: controllable("checked", { fallback: false,
      states: { unchecked: false, checked: true } }) },
    context: () => ({ focused: false, focusModality: null }),
    initial: "unchecked",                            // bound value decides
    on: { FOCUS: { actions: ["setFocused"] }, BLUR: { actions: ["clearFocused"] } },
    states: {
      unchecked: { on: { TOGGLE: { target: "checked", guard: "canToggle" }, RESET: "<default>" } },
      checked:   { on: { TOGGLE: { target: "unchecked", guard: "canToggle" }, RESET: "<default>" } },
    },
  })
```

- `canToggle` = not `disabled` and not `readOnly` (reads props, so `testMachine` runs
  both configurations).
- `RESET` targets the state bound to `defaultChecked`; since the target depends on a
  prop it is declared as a guarded pair (`{ target: "checked", guard: "defaultIsChecked" }`,
  `{ target: "unchecked" }`) in each state. In controlled mode the runtime turns it into
  a proposal with `reason: "RESET"`.
- `$sync:checked` and `$reverted` come from the runtime; `$reverted` needs no handler
  (the hidden input re-syncs from the snapshot).
- Enter is not a machine event: connect delegates Enter on the Control to the
  implicit-submission helper `add-checkbox` introduces for its Control. Alternative
  considered: an `ENTER` event with a `submit` action — rejected, it is a DOM side effect
  with no state change and would add an edge the model test can only skip.

### Connect

- Control: `button-like-element` props with `role: "switch"`, `aria-checked`
  (`String(checked)`), `aria-readonly/required/invalid`, press handlers sending
  `TOGGLE { modality }`, Space-only keyboard rule (press-interactions' per-role rule
  for `switch`), focus attributes. `type="button"` and `role` are marked
  accessibility-critical (dev warning on override, HUI#2935).
- Label / Description: `control-label` helpers, keyed to the Control id.
- Thumb: `aria-hidden`, state attributes only.
- Root: state attributes; renders `hidden-form-input` with `type: "checkbox"`, `checked`,
  `name`, `value ?? "on"`, `form`, `required`, `disabled`, `uncheckedValue`.

### Contract

As in the spec's Contract requirement; `formValue` uses the checkedness read
`hidden-form-input` adds to the environment. `switchInvariants`: never `mixed`, name
stable across states (compares the name recorded at the first step of each path),
Thumb hidden, single toggle per activation (on top of the generic virtual-parity
check).

### Theme

Track `inline-size: 2.5rem; block-size: 1.5rem` (≥ 24 px), thumb positioned with
`inset-inline-start` so RTL needs no extra rule; checked state = thumb position +
`--rind-switch-checked` background + border; under `forced-colors: active` the track has
a `CanvasText` border and the checked thumb a `Highlight` background; transitions use
`--rind-duration-fast`.

### Field binding (amendment from add-field)

The Root reads add-field's `field-control` binding and registers the Switch once (hidden
input as validity element). Field ARIA goes on the Control only; `disabled` / `readOnly` /
`required` / `invalid` are OR-merged with the Field and an enclosing Fieldset (spec "Field
Control Binding", task A.1).

## Risks / Trade-offs

- [Consumers porting from Radix/Base UI expect Enter to toggle] → documented on the docs
  page with the native-parity rationale; ark#2946 shows the same choice holds up.
- [AT wording for `role=switch` varies (older NVDA/JAWS say "toggle button" or
  "checkbox")] → state is still conveyed; the manual protocol records current wording.
- [Shared modules from `add-checkbox` change] → Switch tests run the same
  `form-associated` trait, so a regression shows up in both components.

## Open Questions

- Exact NVDA/JAWS/TalkBack wording for `role=switch` on current versions — recorded in
  the first manual protocol pass; no spec impact.
