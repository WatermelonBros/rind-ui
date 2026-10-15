## Context

[label.md](../../../docs/research/label.md) compares the libraries and lists the bugs behind
each scenario. `add-checkbox` already defines `control-label`: a labelable control gets
`<label for>`, a non-labelable one gets `aria-labelledby` and a label press, and a click the
browser forwards from a label counts as a pointer press (the rule lives in
`core/dom/modality.ts` and `core/dom/press.ts`). This change adds the standalone Label and
moves the interaction details that every label shares into one module.

## Goals / Non-Goals

**Goals:**
- One module, `core/components/shared/label-interaction.ts`, used by the Label,
  `control-label` and `Field.Label`.
- No machine: the Label has no state and no transitions.

**Non-Goals:**
- Observing the target's state (disabled, invalid) for label styling: `control-label` and
  Field already have the state.

## Decisions

### 1. Layout

```
packages/core/src/
├─ components/label/label.connect.ts      root props from the rendered tag and the resolved target
├─ components/label/label.contract.ts
└─ components/shared/label-interaction.ts selection guard, focus forwarding, dev check, popup rule
packages/react/src/label/label.tsx
packages/theme/src/label.css
```

### 2. No machine

The Label's props depend only on the props and the rendered element. There is no event
that changes them, so a machine would be a graph with one node. `testMachine` is not run.
The contract has no states, and the docs page says so. Alternative considered: a
`label` machine with `focusTarget` as an event. Rejected, because focus forwarding is a
`core/dom` effect run from a handler and not a state change.

### 3. `label-interaction` module

```ts
interface LabelInteractionOptions {
  target: () => Element | null        // resolved after commit: `for` lookup, or HTMLLabelElement.control
  labelable: () => boolean            // false → no `for`, press focuses target
  focusTarget?: () => void            // controls override (a group focuses its tab stop)
}
labelInteraction(env, options): { onMouseDown, onPress?, checkAfterCommit(): void }
```

- `onMouseDown` implements the guard. It runs after the consumer handler (react-adapter
  merge order) and respects `preventRindHandler`. The interactive-descendant test uses
  `closest("button, input, select, textarea, a[href], [data-rind-pressable]")`;
  `data-rind-pressable` is the attribute `press-interactions` already puts on pressable
  parts. If that attribute does not exist in the implementation, the press module adds it.
- Focus forwarding goes through `focusSafely(target, { modality: "pointer", cause:
  "programmatic" })`.
- `checkAfterCommit` resolves the `for` target through the environment's root node, so a
  shadow root works. In development it warns. For a standalone Label whose target is
  non-labelable it drops `for` after commit. The server render keeps the consumer's `for`,
  because the server cannot know the target's tag.
- **Popup trigger rule**: `press-interactions` already classifies a label-forwarded click
  (`control-label`). A pressable part can declare `labelActivation: "focus"`. For such a
  part the press module turns a label-forwarded click into a focus with no `PRESS`. The
  declaration is a field of the part's press options, so Select, Combobox, Menu and Date
  Picker triggers opt in without new events. This needs the triggers to declare it; see
  Requests below.

### 4. Contract and driver

- `click` uses a new adapter input, `clickLabel(text)`, in both adapters. The DOM adapter
  dispatches the label's `pointerdown`, `mousedown`, `pointerup`, `mouseup` and `click` and
  lets jsdom's label activation forward the click. Playwright clicks the label. The
  forwarded click keeps `detail` and modifiers, which ariakit#7176 found missing in a
  hand-written helper.
- `controlName` reads the target through `HTMLLabelElement.control`, or through the
  `aria-labelledby` reverse lookup for a non-labelable target, and computes its name with
  `dom-accessibility-api` (0008).

### 5. Theme

`label.css`, `@layer rind.components`, `:where([data-scope="label"][data-part="root"])`,
tokens `--rind-label-font-size`, `--rind-label-font-weight`, `--rind-label-color`, each
with a semantic fallback. The Label belongs to no family in the theme-variants matrix; see
the theme request below.

## Requests to other changes

- **APPLIED (coordinator, 2026-10-14).** **add-checkbox (`control-label`)**: adopt `label-interaction`. The Label part gets the
  double-click selection guard and the development warnings, and the non-labelable
  fallback's press uses the module's focus forwarding. This changes no existing scenario.
- **add-a11y-foundations (`press-interactions`)**: add the part-level `labelActivation:
  "focus"` press option described in §3, and the `data-rind-pressable` marker if the press
  module does not set one.
- **APPLIED (coordinator, 2026-10-14).** **add-select, add-combobox, add-menu (and Date Picker later)**: declare
  `labelActivation: "focus"` on their triggers (radix#3679, headlessui#3787). Add a
  scenario "label click focuses the trigger and does not open it".
- **APPLIED (coordinator, 2026-10-14).** **add-theme-system (`theme-variants`)**: the family matrix should state that structural
  components (Label, Field, Fieldset, Form) belong to no family. They ignore
  `data-variant` and only scale with `data-size`.

## Risks / Trade-offs

- [The `for` removal after commit for a non-labelable target changes the markup between
  server and client] → It happens after hydration, as an effect. No mismatch warning is
  produced. The development warning tells the consumer to fix the markup.
- [`labelActivation: "focus"` diverges from what a `<label for>` does to a native
  `<button>`] → It matches what `<label>` does to `<select>`, which is the native control
  these triggers stand in for.

## Migration Plan

None. Reado has no Label component today. Its settings `Field` wraps the input in a
`<label>`, which keeps working.
