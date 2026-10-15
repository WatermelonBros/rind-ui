## Context

Button sits directly on `add-a11y-foundations`: press interactions already turn every
input into `PRESS.*` events with modality, the modality tracker produces
`data-focus-visible`, and the Announcer speaks. What remains is the element rules every
button-like part shares and the Button component itself. Research:
[button.md](../../../docs/research/button.md).

## Goals / Non-Goals

**Goals:**
- One shared connect helper that every button-like part (Button, Toggle, Switch and
  Checkbox controls, triggers) uses for element, `type`, substitution and disabled
  rules.
- A Button with a real machine so `testMachine` exercises it like every other
  component.

**Non-Goals:**
- Toggle state, groups, menu-button behaviour (their changes).
- Any change to press-interactions semantics; Button only consumes them.

## Decisions

### 1. Shared helper: `core/components/shared/button-like.ts`

```ts
interface ButtonLikeInput {
  role: "button" | "checkbox" | "switch"         // declared by the component
  element: ElementInfo | null                     // tag + role read from the ref via core/dom; null on the server
  disabled: boolean                               // prop || fieldset (tracked) || pending-as-disabled
  focusableWhenDisabled: boolean
  type?: "button" | "submit" | "reset"            // Button only; others always "button"
}
function buttonLikeProps(input: ButtonLikeInput): NeutralProps
```

- `element === null` (server, first render) uses the default element's rules: a native
  button, so SSR markup is `<button type="button" disabled?>`. A consumer `render` of a
  non-button that is server-rendered gets `role`/`tabIndex`/`aria-disabled` from the
  part's *declared* default-element override: the React part passes the rendered tag
  when it can know it statically (`render` given as an element), so hydration matches;
  for function renders the attributes appear after attach (documented).
- Link detection: `a[href]` (or `area[href]`) → link; a disabled link drops `href` and
  sets `role="link"`, `aria-disabled`, `tabIndex=-1` (Bits UI).
- Anchor branch (amended from add-link): when the rendered element is an `<a href>`,
  `buttonLikeProps` delegates to add-link's `linkProps` for activation, disabled and
  router behaviour (`link-navigation`), so `render={<a href>}` on a Button routes and
  handles modifier clicks exactly like a Link (react-spectrum#10603); button activation
  rules apply only to the other branches.
- Fieldset: `core/dom/fieldset-disabled.ts` (one MutationObserver per document with a
  `disabled` attribute filter, observing EVERY ancestor `fieldset`, not only the nearest;
  amended from add-fieldset) computes "inside a disabled fieldset and not inside that
  fieldset's first `<legend>` child" for every disabled ancestor, and feeds a
  `FIELDSET.CHANGE` event declared by each machine that uses the helper; the helper reads
  the resulting context flag. The effective disabled is `prop || native tracker ||
  Fieldset/Field context` (add-fieldset §2, add-field `field-control` binding), so
  portalled parts follow a disabled rind-ui Fieldset.
- Keyboard rules are not re-implemented: the helper passes the rendered tag and the
  declared role to the press factory, whose per-element rules already exist.
- Dev warning for interactive descendants runs once after attach.

Alternative considered: one `useButton`-style hook per framework (Base UI, React Aria)
— rejected; connect owns attributes and must stay framework-neutral.

### 2. Button machine

```ts
type ButtonEvent =
  | PressEvent                                   // PRESS.START | PRESS.END | PRESS.UP | PRESS | PRESS.CANCEL, from core/a11y
  | FocusEvent | BlurEvent                       // with modality
  | { type: "FIELDSET.CHANGE"; disabled: boolean }

setup({ guards: { isPending, isDisabled, isFocused }, actions: { notifyPress, notifyPressStart,
  notifyPressEnd, setFocused, clearFocused, setFieldsetDisabled, announcePending } })
.machine({
  id: "button",
  context: () => ({ focused: false, fieldsetDisabled: false }),
  values: { pending: bindProp("pending", { states: { pending: true, idle: false } }) },
  initial: "idle",                               // resolved from `pending` at creation
  on: { FOCUS: { actions: ["setFocused"] }, BLUR: { actions: ["clearFocused"] },
        "FIELDSET.CHANGE": { actions: ["setFieldsetDisabled"] } },
  states: {
    idle: { on: {
      PRESS: { guard: { not: "isDisabled" }, actions: ["notifyPress"] },
      "PRESS.START": { guard: { not: "isDisabled" }, actions: ["notifyPressStart"] },
      "PRESS.END": { actions: ["notifyPressEnd"] } } },
    pending: {
      entry: ["announcePending"] },              // guarded inside: only when context.focused
  },
})
```

- `pending` on first render: `pending` is a read-only prop binding
  (`machine-runtime` → "Read-Only Prop Bindings", add-foundations task 7.1), so the
  initial snapshot is already `pending` (correct SSR `data-state`) and later changes
  are `$sync` transitions.
- `announcePending`: `env.announcer.announce({ message: messages.pending, priority:
  "polite", key: \`button-${id}-pending\` })` when `context.focused`.
- Disabled (`isDisabled` = `props.disabled || context.fieldsetDisabled`) and pending
  both block `PRESS`; the press factory still runs (so `data-hover` and focus work) and
  the machine drops the events — this is what makes base-ui#1312 impossible:
  handler order cannot bypass a guard.
- `type="submit"` is rendered as `"button"` while `pending` (React Aria).

States and events in the graph: `idle --$sync:pending--> pending`,
`pending --$sync:pending--> idle`, internal `PRESS`, `PRESS.START`, `PRESS.END`,
`FOCUS`, `BLUR`, `FIELDSET.CHANGE`. The `$sync:pending` edges are mapped in the
contract to prop steps (`{ pending: true }` / `{ pending: false }`), which
`testMachine` drives through its `rerender` option (add-foundations task 7.2).

### 3. Contract

```ts
export const buttonContract = contract("button", {
  anatomy: ["root"],
  locate: (name: string, role: "button" | "link" = "button") => ({ role, name }),
  actions: {
    press: { pointer: (env) => env.part("root").click(), touch: (env) => env.part("root").tap(),
             keyboard: (env) => env.part("root").press("Enter"), done: async () => true },
    pressWithSpace: { keyboard: (env) => env.part("root").press("Space"), done: async () => true },
  },
  queries: {
    isDisabled: async (env) => (await env.part("root").attr("disabled")) !== null
      || (await env.part("root").attr("aria-disabled")) === "true",
    isPending: async (env) => (await env.part("root").attr("data-pending")) !== null,
    isFocused: (env) => env.part("root").isFocused(),
    isFocusVisible: async (env) => (await env.part("root").attr("data-focus-visible")) !== null,
  },
  states: { idle: { isPending: false }, pending: { isPending: true } },
  events: { PRESS: "press", "$sync:pending": { props: (to) => ({ pending: to === "pending" }) }, … },
  traits: [],
})
```

`done` is trivially true: a press has no observable postcondition on the Button itself;
the driver test asserts the consumer's spy. Virtual-parity is checked by the runner
through `inspect` (one `PRESS` step per activation).

### 4. React part

`<Button>` = `useMachine` + `buttonLikeProps` + press/hover factories + `mergeProps` +
`render`. Nothing else.

### 5. Theme

`button.css`: tokens only; `[data-scope=button][data-part=root]`, states via
`[data-disabled]`, `[data-pending]`, `[data-pressed]`, `[data-hover]`; focus from
`base.css`; ≥ 24×24 target; forced colors: border + `GrayText` for disabled.

## Risks / Trade-offs

- [Connect reads `pending` from props while the machine lags until `setProps`] → no
  visible lag (attributes come from props), model tests run on the machine; resolved
  for good if the runtime gains an initial-state resolver.
- [Function `render` of a non-button hydrates without `role` until attach] → documented;
  element renders are detected statically.
- [Fieldset MutationObserver per part] → only attached when a `fieldset` ancestor
  exists.
- [Polite pending announcement may be queued behind other speech] → acceptable; the
  visible label change carries the same information.

## Open Questions

- Automatic `useFormStatus` integration for submit Buttons (leaning: docs recipe only).
- Announce the end of pending as React Aria does?
