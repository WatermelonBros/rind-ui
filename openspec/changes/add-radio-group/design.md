## Context

See proposal.md for why. Radio Group sits on `add-foundations` (runtime, controllables,
contracts, drivers, `testMachine`), `add-a11y-foundations` (press, modality guards, keys,
focus attributes, ids), `add-collections` (static registration, navigation, composite,
selection), `add-button` (`button-like-element`) and `add-checkbox` (`hidden-form-input`,
`control-label`). Library comparison and bug history:
[radio-group.md](../../../docs/research/radio-group.md).

## Goals / Non-Goals

**Goals:**
- A machine Segmented Control reuses unchanged.
- Check-on-move expressed as one machine transition, so no keydown flag can race focus.
- Native radio parity for forms without native radios as the focused element.

**Non-Goals:**
- Standalone radio, deselect (proposal). Toolbar mode is hosted mode (Machine).

## Decisions

### Visible control + hidden inputs, not native radios

The focusable element is a `button[role=radio]` (`button-like-element`), with one hidden
`input[type=radio]` per item from `hidden-form-input`. Native radios (Zag, React Aria,
Ariakit, Kobalte) give keyboard, validity, reset and autofill, but every native-path bug in
the research note comes from the hidden input being the focused element (scroll jumps,
VoiceOver ring on a 1 px input, locating by role and name, Safari focus calls), and the
keyboard has to be ours anyway (four arrows regardless of browser, RTL, no commit on
focus). Validity, reset and implicit submission still come from real radio inputs through
`hidden-form-input`. This is also what Checkbox and Switch do, so the three form controls
share one path.

### Machine

```
            FOCUS (control)                BLUR (focus left the group)
   idle ─────────────────────► focused ──────────────────────────────► idle

focused:  NAVIGATE [isKeyboard ∧ ¬readOnly]               → navigate, selectHighlighted
          NAVIGATE                                         → navigate
          FOCUS (another control)                          → highlightFocused
root:     PRESS (control or label) [¬readOnly]             → highlight, select, focusControl
          COLLECTION.CHANGE                                → repairCollection
          FORM.RESET                                       → resetToDefault
          INDICATOR.MEASURE                                → setIndicator (Segmented Control)
          $sync:value / $reverted
exit(focused): syncHighlightToSelection
effects: focusHighlighted (focused only)
```

- Context: the collections fields (`highlightedKey`, `highlightSource`, `lastCollection`);
  `value` is a controllable mapped to the selection model with `selectionMode: "single"`,
  `selectionBehavior: "replace"` and user deselect disabled (a `PRESS` on the checked key
  is a no-op transition, so no callback fires).
- Hosted mode (add-toolbar's `CompositeHost`, spec "Hosted By A Toolbar") replaces the
  earlier `checksOnMove` flag: when a host is present, radios also register with the
  host and take `host.itemProps(key)`; the root renders no keydown navigation and no
  fallback `tabIndex`; host `disabled` / `focusableWhenDisabled` apply. The machine never
  receives `NAVIGATE` while hosted, so it cannot check on move; activation accepts Enter
  as well as Space (APG toolbar example). Role and value are unchanged.
- Navigation uses the collection with `loop: true` (fixed), logical orientation `"both"`
  (all four arrows), and `navigable = enabled || focusableWhenDisabled`.
- `FORM.RESET` comes from `hidden-form-input`'s reset hook; uncontrolled: value ←
  `defaultValue`; controlled: proposal with `reason: "RESET"`.
- Disabled and read-only: disabled controls send no `PRESS` (press factory); read-only is
  a guard because read-only radios stay focusable and receive presses.
- `INDICATOR.MEASURE { box, cause }` stores the selection-indicator measurement
  (`add-tabs`) in context. Radio Group's connect never reads it; Segmented Control's does.
  One context slot is cheaper than a second machine or indicator state kept in parts.

### Connect

- `root`: `role="radiogroup"`, `aria-orientation`, `aria-labelledby` (label part when
  rendered) / consumer `aria-label`, `aria-describedby` (description; error message when
  invalid), `aria-required`, `aria-invalid`, `aria-readonly`, `aria-disabled`; keydown →
  `toLogicalKey(desc, { dir, orientation: "both" })` → `NAVIGATE`, ignoring modified and
  composing events and keys whose target is not a control; `tabIndex=0` only in the
  collections fallback (no enabled radio), together with `aria-disabled`.
- `item-control`: `button-like-element` props with `role="radio"` (Space-only activation
  per role), `aria-checked` (accessibility-critical), roving `tabIndex`, ids from
  `itemId("radio-group", root, "item-control", key)`, `control-label` wiring.
- `item`: renders the `hidden-form-input` props for that key (`type: "radio"`, shared
  `name`, `value`, `checked`, `required`, `disabled`, `form`).
- `item-indicator`: `aria-hidden`, mounted while checked (presence-compatible).
- Default `name`: `partId("radio-group", root, "name")` when the consumer gives none.

### Shared modules

`core/collection` (`navigation.ts`, `selection.ts`, `machine.ts`, `composite.ts` with the
SSR tab-stop fallback), `core/dom` (`item-registry.ts`, `press.ts`, `modality.ts`,
`keyboard.ts`, `focus-safely.ts`), `core/a11y` (`guards.ts`, `keys.ts`), `core/ids.ts`,
and from `add-checkbox` the `hidden-form-input` and `control-label` helpers.

### Exported for Segmented Control

`radioGroupMachine` and the item-registration helpers are exported from
`core/components/radio-group`; Segmented Control writes its own connect and contract on
the same machine (different parts and scope). The machine has no knowledge of either
component's parts.

### Contract

```ts
export const radioGroupContract = contract("radio-group", {
  anatomy: ["root", "label", "description", "error-message", "item", "item-control",
    "item-indicator", "item-label", "item-description"],
  locate: (name: string) => ({ role: "radiogroup", name }),
  actions: {
    check: {
      pointer: (env, name: string) => env.part("item-control", { role: "radio", name }).click(),
      touch: (env, name: string) => env.part("item-control", { role: "radio", name }).tap(),
      keyboard: (env, name: string) => arrowUntilChecked(env, name), // bounded: one cycle
      done: async (q, name) => (await q.checked()) === name,
    },
  },
  queries: { radios, checked, focusedRadio, isDisabled, isReadOnly, isRequired, isInvalid, formValue },
  traits: ["composite-roving", "selectable", "directional"],
})
```

Event mapping: `$sync:value` → prop step `{ props: (target) => ({ value: target }) }`;
`COLLECTION.CHANGE` → a prop step adding or removing an item; `FORM.RESET` → `{ skip:
"form reset is driven through the form element; covered by form tests" }`;
`INDICATOR.MEASURE` → `{ skip: "environment event: measured layout" }`. `bindProp` is not
needed (`disabled`/`readOnly` are guards, not states).

`formValue` reads `new FormData(form).getAll(name)` from the owning form of the first
hidden input (DOM adapter) or the same through `evaluate` (Playwright). Argument classes:
no value, first disabled, checked disabled, all disabled, read-only, required.

### Parts (React)

`RadioGroup.Root`, `Label`, `Description`, `ErrorMessage`, `Item` (registers via
`use-collection-items`, renders the hidden input last), `ItemControl`, `ItemIndicator`,
`ItemLabel`, `ItemDescription`. Thin.

### Theme

Component tokens `--rind-radio-group-*` (tier 3 of decision 0007, proposed), each defaulting to a semantic token; the stylesheet reads only those. `packages/theme/src/radio-group.css`: ring as a border on the control, dot as an inner
`currentColor` circle, forced-colors mapping (`ButtonText`, `Highlight`, `GrayText`),
24 px hit area via `--rind-hit-area` when the control is smaller, focus ring from
`base.css`.

### Field binding (amendment from add-field)

The group Root reads add-field's `field-control` binding and registers the group once as
one control; items keep their own ids and never register. Field ARIA goes on the root (its
own `error-message` defers to the Field's inside one); flags are OR-merged with the Field
and an enclosing Fieldset; the focus target is the checked radio, else the first enabled
one (spec "Field Control Binding", task A.2).

## Risks / Trade-offs

- [Browser autofill of radio groups is lost on the visible control] → hidden inputs carry
  name/value; autofill of radios is rare. Bits#2152 even asks to disable it.
- [A disabled group is skipped by Tab like native disabled radios (base-ui#4174, open)] → `focusableWhenDisabled` keeps it discoverable when a product needs that.
- [VoiceOver/TalkBack ignore `aria-readonly` and `aria-invalid` on radios (RA#2580,
  RA#2581)] → AT limitation; manual-protocol items, the states stay in the DOM.

## Migration Plan

None: new component. Reado uses Ark's Segment Group, which migrates to Segmented Control.

## Open Questions

None that change the specs. Toolbar behaviour is settled with `add-toolbar`.
