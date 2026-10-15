## Context

`add-checkbox` gives a `checkbox` machine (states `unchecked | checked | indeterminate`
bound to the controllable `checked`), its connect and parts, `hidden-form-input` (per-control
native input, user-initiated `input`/`change`, form `reset` → `RESET`, invalid → focus the
Control, trait `form-associated`) and `control-label`. The runtime (`add-foundations`) makes
a controlled write a proposal and keeps context written by the transition's actions. The
binding research is [checkbox-group.md](../../../docs/research/checkbox-group.md) §Decisions.

## Goals / Non-Goals

**Goals:**
- No new mechanism in Checkbox: items and the Parent are ordinary `checkbox` services in
  controlled mode.
- The select-all cycle behaves the same controlled and uncontrolled, and is model-tested.

**Non-Goals:**
- Machine composition primitives in the runtime (machine-runtime open question 2 stays
  open for Menu/Combobox); this change uses adapter-wired sibling services.

## Decisions

### 1. Machine `checkbox-group`

```ts
type CheckboxGroupEvent =
  | { type: "ITEM.TOGGLE"; value: string; checked: boolean; modality: Modality }
  | { type: "PARENT.TOGGLE"; modality: Modality }
  | { type: "ITEM.REGISTER"; value: string; id: string; disabled: boolean }
  | { type: "ITEM.UNREGISTER"; value: string; id: string }
  | { type: "RESET" }

setup({ guards: { isPartial, allSelectableSelected, hasMemory, cycleAll, cycleNone, interactive },
        actions: { toggleItem, selectAll, selectNone, restoreMemory, register, unregister,
                   resetValue, endCycle } })
.machine({
  id: "checkbox-group",
  context: () => ({ cycle: "idle" as "idle" | "all" | "none", memory: [] as string[],
                    items: new Map<string, { ids: string[]; disabled: boolean }>() }),
  values: { value: controllable("value", { fallback: [], equal: sameSet }) },
  initial: "ready",
  states: {
    ready: {
      on: {
        "ITEM.TOGGLE":   { guard: "interactive", actions: ["toggleItem"] },          // memory := result, cycle := idle
        "PARENT.TOGGLE": [
          { guard: { and: ["interactive", "cycleAll"] },  actions: ["selectNone"] },    // cycle := none
          { guard: { and: ["interactive", "cycleNone"] }, actions: ["restoreMemory"] }, // cycle := idle
          { guard: { and: ["interactive", "isPartial"] }, actions: ["selectAll"] },     // memory := value, cycle := all
          { guard: { and: ["interactive", "allSelectableSelected"] }, actions: ["selectNone"] },
          { guard: "interactive", actions: ["selectAll"] },
        ],
        "ITEM.REGISTER": { actions: ["register"] },
        "ITEM.UNREGISTER": { actions: ["unregister"] },
        RESET: { actions: ["resetValue", "endCycle"] },
        $reverted: { actions: ["endCycle"] },
      },
    },
  },
})
```

- **One state, cycle in context.** The value is an array not bound to states; a parent
  cycle encoded as states would not advance in controlled mode, because a controlled write
  is a proposal and leaves the state unchanged until `$sync` — which only exists for
  state-bound values. Context written by actions survives proposals (runtime rule), so the
  cycle advances identically in both modes; `$reverted` (parent refused) ends it. This is
  the Base UI #4552 fix by construction. Alternative considered: states `idle | all | none`
  — rejected for that reason.
- Guards over context and the resolved value give the model runner its branches; the
  contract's `events` map plus prop configurations (`allValues`, disabled items, `disabled`,
  `readOnly`) reach every guarded edge.
- `selectAll` / `selectNone` compute selectable-all / selectable-none from `allValues` and
  the registry's disabled flags (unregistered values count as enabled).
- `resetValue` proposes `defaultValue` with reason `RESET`; the uncontrolled default is the
  one frozen at creation.
- Derived (computed): `parentState` (`checked | unchecked | indeterminate` over
  `allValues`), `requiredActive` (`required && value.length === 0`), `controlsIds`
  (registered ids, in registration order of `allValues`).

### 2. Composition with Checkbox (sibling services)

Each item and the Parent keep their own `checkbox` service (focus, press, data attributes,
hidden input). The group connect returns, per item value, the controlled props the item's
service is created with: `checked = value.includes(v)`, `onCheckedChange → send(ITEM.TOGGLE)`,
`disabled = group || item`, `readOnly = group || item`, `required = item || requiredActive`,
`name`/`form` from the group, extra `aria-describedby` ids, and `resetsWithForm: false`
(an internal option of `hidden-form-input`'s reset hook, added to Checkbox by this change,
so only the group answers `reset`). The Parent gets `checked = parentState` and
`onCheckedChange → send(PARENT.TOGGLE)`, no `name`, `aria-controls = controlsIds`.
Items register on mount (`ITEM.REGISTER` with their *rendered* id and disabled flag) and
unregister on unmount. React: `CheckboxGroup.Root` provides a context the Checkbox Root
reads; nothing else in Checkbox changes. Alternative: a parent-owned child service
(`spawn`-lite) — deferred to the composition decision for Menu.

### 3. Required encoding

While `requiredActive`, every enabled item gets native `required` and `aria-required`; the
browser's constraint validation then fails on the first item and `hidden-form-input`
redirects focus to its Control. Rejected: one hidden input with the array (Reka #1777 —
never invalid) and `required` on every item unconditionally (Bits UI — requires all).
The browser's own validation message ("Please check this box") is used; a group-specific
message goes in the ErrorMessage part (Field change will add custom validity messages).

### 4. Parts and `data-*`

| Part | Element | ARIA / data |
|---|---|---|
| `Root` | `div` | `role="group"`, `aria-labelledby` (Label, while rendered), `aria-describedby` (Description, ErrorMessage); none of them when rendered as `fieldset` with a `legend` Label; `data-disabled`, `data-readonly`, `data-required`, `data-invalid` |
| `Label` | `span` | id for `aria-labelledby` |
| `Description` | `p` | id |
| `ErrorMessage` | `p` | id; not live |
| `Parent` | Checkbox Root | full checkbox anatomy + `data-parent`, `aria-controls` on its Control |
| items | `Checkbox.Root value` | checkbox attributes + `data-value` |

Ids: `partId("checkbox-group", root, part)` from `element-ids`; item ids remain the items'
own.

### 5. Shared modules used

`core/dom/hidden-input` and `control-label` helpers (from `add-checkbox`), `core/dom/press`
and modality (through Checkbox), `core/ids`. No `core/collection`: the group is not a
composite (no roving, no typeahead).

### 6. Contract

```ts
export const checkboxGroupContract = contract("checkbox-group", {
  anatomy: ["root", "label", "description", "error-message", "parent", "item"],
  locate: (name: string) => ({ role: "group", name }),
  actions: {
    toggle: {
      pointer: (env, label: string) => env.find({ role: "checkbox", name: label }).click(),
      keyboard: async (env, label: string) => env.find({ role: "checkbox", name: label }).press("Space"),
      done: /* value() changed */,
    },
    toggleParent: { pointer: (env) => env.part("parent").click(), keyboard: (env) => env.part("parent").press("Space"), done: /* value() changed */ },
  },
  queries: { value, parentState, isDisabled, isRequired, isInvalid },
  states: { ready: {} },
  events: { "ITEM.TOGGLE": { action: "toggle", args: (ctx) => [ctx.firstEnabledItemLabel] }, "PARENT.TOGGLE": "toggleParent" },
  traits: ["form-associated"],
})
```

Item lookups are scoped to the group instance (items carry the group's `data-instance` as
an extra attribute set by the group context, so `part("item", { role, name })` stays
instance-scoped). Per-contract invariants: Parent's `aria-checked` equals the oracle's
`parentState`; every item's `aria-checked` equals membership in the oracle value; no item
carries `aria-required` while the value is non-empty unless individually required.

### Field binding (amendment from add-field)

The group Root reads add-field's `field-control` binding and registers the group once as
one control; items never register. Field ARIA goes on the group (its own ErrorMessage
defers to the Field's inside one); flags are OR-merged with the Field and an enclosing
Fieldset; the focus target is the first invalid item, else the first enabled one (spec
"Field Control Binding", task A.1).

## Risks / Trade-offs

- [Context-encoded cycle is less visible in the graph than states] → guards are named and
  enumerated in the graph; the per-contract invariant checks `parentState` every step.
- [`allValues` duplicates the item list] → required only for `Parent`; a dev warning when a
  registered item's value is missing from `allValues` or vice versa.
- [Browser validation message is checkbox-specific] → ErrorMessage part; custom validity
  comes from the Field through the `field-control` binding (amendment A.1).
- [`value` may contain disabled items FormData omits (Base UI #5208)] → documented: state is
  the selection, submission is native.

## Open Questions

- Whether to fold the group label into each item's description on iOS, where VoiceOver does
  not announce groups — needs a device test; it would be a quirk entry, no spec change.
