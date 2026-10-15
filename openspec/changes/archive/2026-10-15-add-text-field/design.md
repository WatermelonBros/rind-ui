## Context

[text-field.md](../../../docs/research/text-field.md) has the comparison and the bug
history. Field (`add-field`) provides labelling, validation and the `field-control` binding.
`keyboard-interactions` provides the IME guard. `press-interactions` provides press without
focus. `button-like-element` provides the ClearTrigger button. `announcer` provides keyed,
debounced announcements.

## Goals / Non-Goals

**Goals:**
- A native input that behaves exactly like one when uncontrolled. rind-ui adds state on
  top, never in front.
- `autosize-textarea` as a standalone `core/dom` module that Prompt Input reuses unchanged.

**Non-Goals:**
- Search, password, number and OTP behaviour (separate components). Password Input and
  Search Field are presets of this machine (§2); all four reuse the Field host helper (§3).

## Decisions

### 1. Layout

```
packages/core/src/
├─ components/text-field/{text-field.machine.ts, text-field.connect.ts, text-field.contract.ts, text-field.messages.ts}
└─ dom/autosize.ts                       autosize-textarea
packages/react/src/text-field/           Root (creates or joins a Field), Label, Description, ErrorMessage,
                                         Input, Textarea, ClearTrigger, CharacterCount
packages/react/src/field/use-field-host.ts   shared Root-as-Field helper (§3)
packages/theme/src/text-field.css
```

### 2. Machine

```ts
type TextFieldEvent =
  | { type: "INPUT"; value: string; composing: boolean; event: Event }
  | { type: "COMPOSITION.START" }
  | { type: "COMPOSITION.END"; value: string }
  | { type: "CLEAR"; modality: Modality }
  | { type: "RESET" }                                   // form reset: re-read the DOM value next frame
  | { type: "FOCUS"; modality: Modality } | { type: "BLUR" }

machine({
  id: "text-field",
  values: { value: controllable("value", { fallback: "" }) },   // not state-bound
  initial: "idle",
  states: {
    idle:      { on: { "COMPOSITION.START": "composing",
                       INPUT: { actions: ["setValue", "reportChange", "count"] },
                       CLEAR: { guard: "editable", actions: [{ clearInput: { reason: "CLEAR" } }, "focusInput"] } } },
    composing: { on: { INPUT: { actions: ["setValue", "reportComposing"] },        // no count, no announce
                       "COMPOSITION.END": { target: "idle", actions: ["setValue", "reportChange", "count"] } } },
  },
  on: { RESET: { actions: ["rereadValue"] }, FOCUS: { actions: ["setFocused"] }, BLUR: { actions: ["clearFocused"] } },
})
```

- `idle | composing` are states because guards and side effects differ in a way the model
  tests must walk. Focus is context (as in Checkbox).
- `setValue` in uncontrolled mode only records the DOM's value. The machine never writes
  `value` back. Controlled mode renders the prop (React does the write, outside
  composition semantics, which React handles).
- `clearInput` is the only DOM write: the native prototype setter, then one bubbling
  `input` event. React's value tracker sees a real change, so `onChange` runs once
  (unlike zag#3204, which patched the setter). That `input` event then produces the
  ordinary `INPUT`, so `onValueChange` and Field reporting happen once, with the reason
  overridden by a one-shot flag to the action's `reason` parameter (`CLEAR` for the
  ClearTrigger; Search Field's Escape passes `ESCAPE`).
- **Builder.** The definition comes from `buildTextFieldMachine(preset)` (as
  `add-dialog`'s `buildDialogMachine({ ..., extend })`): a preset adds controllable values,
  global events with their guards and actions (merged into `on`, so both states accept them),
  service effects and a `scope`; all static data evaluated once at module load, so the graph
  stays complete. `textFieldMachine = buildTextFieldMachine({})`. Connect, parts and contract
  take the scope as a parameter. Password Input (`add-password-input`) and Search Field
  (`add-search-field`) are the first presets, so they cannot drift from Text Field.
- Safari's commit-Enter after `compositionend` is handled by the IME guard's quirk entry.
  The machine adds nothing.
- `count` computes the CharacterCount and, while focused, calls the announcer with key
  `text-field-<id>-count` (the announcer's debounce gives "after a pause"), only past the
  threshold.

### 3. Root as Field

`TextField.Root` checks for an enclosing `FieldControlContext`. If there is none, it
creates a Field service itself (the `field` machine, with the Field props taken from the
Root) and provides it. Its Label, Description and ErrorMessage are then the Field parts
under scope `text-field`, through the Field connect parameterised by scope. If there is
one, the Root only registers. This keeps one validation engine and gives the simple
`<TextField.Root><TextField.Label/><TextField.Input/></TextField.Root>` form that RAC,
Kobalte and Ark users expect. The logic lives in one React helper,
`react/src/field/use-field-host.ts` (scope as a parameter), which Number Input, Pin Input,
Password Input and Search Field Roots reuse instead of copying it. Alternative considered: Text Field without its own label
parts, always inside a Field (Base UI). Rejected, because it adds a wrapper to the common
case.

### 4. Autosize (`core/dom/autosize.ts`)

```ts
autosize(textarea, env): () => void
```

- `env.css.supports("field-sizing", "content")` → set inline `field-sizing: content`, map
  `rows` to inline `min-block-size: calc(<rows>lh + padding + border)`, done.
- Fallback: `ResizeObserver` (width changes), `document.fonts` `loadingdone`, plus an
  explicit `measure()` that connect calls after every value commit (the machine's value,
  so controlled and programmatic changes resize too — kobalte#484). The height is written
  in the next frame through the scheduler: `height: auto`, then `scrollHeight + borders`
  with `parseFloat` (zag#2312), respecting computed `max-block-size` by toggling
  `overflow-y`. Firefox keeps its overflow (bmo 1787062, as React Aria does). It never
  touches `value` and never dispatches. Cleanup cancels the pending frame (base-ui#164).
- The module is deleted, keeping the native branch, when the support policy (native-platform
  open question) drops browsers without `field-sizing`.

### 5. Connect output

| Part | Attributes |
|---|---|
| Root | Field state `data-*`, `data-focus`, `data-focus-visible`, `data-composing` |
| Input / Textarea | binding (`id`, describedby incl. CharacterCount, `aria-invalid`, `required`/`aria-required`, `disabled` or `readOnly`+`aria-disabled`), `value` or `defaultValue`, input / composition / focus / keydown (Enter → commit, IME-guarded) handlers, autosize ref |
| ClearTrigger | button-like props, `aria-label` from `messages.clear`, `tabIndex=-1`, press without focus; not rendered when not clearable |
| CharacterCount | `id`, text, `data-over-limit` |

### 6. Contract and model-based tests

- `compose` uses the a11y-test-tooling adapter's composing keys. In browser mode it uses
  CDP `Input.imeSetComposition` in Chromium and a synthesized composition sequence
  elsewhere, as that tooling defines.
- Configurations: uncontrolled, controlled (applying every proposal), Textarea with
  autosize, with `maxLength` and with a soft `max`, read-only, focusable-disabled, inside a
  Field with `validationMode="change"`.

### 7. Theme

`text-field.css`, family `field`: `--rind-text-field-height` (from `--rind-size-control`),
`--rind-text-field-border`, `--rind-text-field-bg`, `--rind-text-field-soft-bg`, radius
from the control family, the invalid state adding a 2 px border-width change plus an inset
icon slot. Forced colors: `FieldText`/`Field` and `Highlight` for focus. ClearTrigger hit
area from `--rind-hit-area`. Textarea `rows` mapping through the inline variable that
autosize sets.

## Requests to other changes

- **add-a11y-foundations (`a11y-test-tooling`)**: confirm that the composing-keys adapter
  input can drive a full `compositionstart → input(isComposing) → compositionend` sequence
  in both adapters with a committed string. If it only marks keys as composing, add the
  sequence.
- **add-field**: none. Text Field is the first `field-control` implementation as
  specified.

## Risks / Trade-offs

- [ClearTrigger's programmatic write loses the native undo step (react-spectrum#6504)] →
  Documented. `setRangeText` would keep undo only in some engines, and it is not worth a
  second code path now.
- [Root-as-Field means two ways to compose (TextField alone, or inside Field)] → One
  engine. The development warning catches duplicated label parts.
- [Announcing counts can be chatty] → Threshold plus key debounce, focus-only. The
  threshold is configurable.

## Migration Plan

Reado:
- `atoms/Input.tsx`: `<TextField.Root data-variant>` + `Input`. The `icon` and `trailing`
  wrapper stays Reado's markup, and a clear button becomes `ClearTrigger`.
- `atoms/Textarea.tsx`: `Root` + `Textarea` (`autosize` where it used `resize-y`). The
  Cmd/Ctrl+Enter and Escape handlers stay in Reado as `onKeyDown`, guarded with the
  exported IME guard.
