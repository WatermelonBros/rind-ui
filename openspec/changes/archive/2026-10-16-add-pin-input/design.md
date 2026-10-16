## Context

[pin-input.md](../../../docs/research/pin-input.md) compares the libraries and records the bug
history behind each scenario. This change builds on, without re-specifying:

| Change | What Pin Input uses |
|---|---|
| `add-foundations` | `setup()`/`machine()`, `controllable()` (`value`), `$sync`/`$reverted`, effects, contracts, drivers, `testMachine` |
| `add-a11y-foundations` | `keyboard-interactions` IME guard, `interaction-modality` (`data-focus-visible`), `platform-and-preferences`, `i18n-messages`, the CSP nonce from the environment |
| `add-field` | `field-control`, `field-validation` (native validity of the input; per-key messages) |
| `add-text-field` | Root-as-Field (helper requested in `add-number-input`) |
| `add-theme-system` | family `field`, stylesheet convention |

## Goals / Non-Goals

**Goals:**
- Native single-input behaviour (autofill, paste, undo, IME, screen readers) with
  presentational slots driven by `data-*`.
- Every editing rule in one pure function (`planEdit`) testable in Node.

**Non-Goals:**
- Visual caret animation (theme), WebOTP, timers (proposal Non-goals).

## Decisions

### 1. One input, not one per slot

*Chosen*: one `<input>` over `aria-hidden` slots (input-otp, Bits UI). *Rejected*: one input
per slot (Zag, Radix, Base UI, Reka). Every autofill and paste bug in the research table is
specific to splitting the value across inputs, and the per-slot heuristics (treat >1
character as a paste, `maxLength` and `autoComplete` only on the tab stop, password-manager
ignore attributes on the other slots) keep breaking (zag#2118, radix#3641, reka-ui#2210,
bits-ui#1053). The overlay's known costs (input-otp#32) are addressed differently from
input-otp: no letter-spacing hacks (presses map to slots by geometry, so the input's text
layout does not matter), no programmatic range selections (replacement is done in
`beforeinput`), transparent paint through one injected style.

### 2. Layout

```
packages/core/src/components/pin-input/
├─ pin-input.machine.ts
├─ pin-input.connect.ts
├─ pin-input.contract.ts       contract + pinInputInvariants
├─ pin-input.messages.ts
└─ edit-plan.ts                planEdit, normalise (NFKC, sanitize, strip separators), filter (pure)
packages/react/src/pin-input/  Root, Label, Description, ErrorMessage, Control, Input, Slot
packages/theme/src/pin-input.css
```

### 3. Machine

```ts
type PinInputEvent =
  | { type: "EDIT"; plan: EditPlan }                     // from beforeinput: accepted insertion/deletion → next value + caret
  | { type: "INPUT"; text: string; source: "native" | "autofill" }  // native input not planned (autofill, script fill, undo)
  | { type: "CARET"; index: number }                     // selectionchange while focused (collapsed)
  | { type: "SLOT.PRESS"; index: number; modality: Modality }
  | { type: "COMPOSITION.START" } | { type: "COMPOSITION.END"; text: string }
  | { type: "FOCUS"; modality: Modality } | { type: "BLUR" }
  | { type: "RESET" }

states:
  idle       ── EDIT [editable] / applyPlan, maybeComplete
             ── INPUT [editable] / normaliseAndApply, maybeComplete   (else resyncInput)
             ── SLOT.PRESS / placeCaret ; CARET / recordCaret
             ── COMPOSITION.START ──► composing
  composing  ── COMPOSITION.END / normaliseAndApply(as insertion), maybeComplete ──► idle
             (EDIT and INPUT are not filtered here; the browser owns the text until the end)
  global     FOCUS/BLUR (context), RESET / restoreDefault, $sync:value / clampCaret, $reverted / resyncInput
values:      value: controllable("value", { fallback: "" })
effects:     focused: ["caretSync"] — selectionchange listener + writes the planned caret with
             setSelectionRange in the same task as the value commit
```

- `planEdit(value, caret, { inputType, data }, rules)` returns `{ accept: false }` or
  `{ next, caret, reason }`; connect calls `preventDefault` on every insertion and applies the
  plan through the machine (controlled input; React writes the value), so replacement,
  truncation and separators are deterministic. Deletions and history return `accept: true`
  with no plan and the native edit proceeds (its `input` event arrives as `INPUT`).
- `maybeComplete` compares the new value's length with `length` and the previous length /
  the reason (paste, autofill) — base-ui#4679; `autoSubmit` calls `form.requestSubmit()` from
  an effect and never focuses afterwards (base-ui#5088).
- Native `input` listener (not React's `onChange`) so script fills are seen (input-otp#152).
- Slot geometry: on `pointerdown` over the input, connect asks `core/dom` for the slot whose
  border box contains the press x (slots found by `data-scope`/`data-part`/`data-instance`),
  calls `preventDefault` (no native caret placement), focuses the input if needed
  (`focusSafely`) and sends `SLOT.PRESS`.

### 4. Connect output

| Part | Attributes |
|---|---|
| Root / Control | Field host attributes (Control: `position: relative`), `dir="ltr"` default, `data-complete`, `data-focus(-visible)`, `data-composing` |
| Input | binding (`mergeFieldProps`), `type`, `autoComplete`, `inputMode`, `maxLength`, anchored `pattern`, `autoCapitalize`, `autoCorrect`, `spellCheck`, `value={value}`, inline overlay style (`position:absolute; inset:0; background/color/caret-color: transparent; border:0; outline:0`), handlers (`beforeinput`, native `input`, composition, focus, blur, `pointerdown`) |
| Slot | `aria-hidden`, `data-index`, `data-filled`, `data-active`, `data-caret`, `data-masked`, `data-disabled`, children = character / mask character |

Injected style (helper requested below): `[data-scope=pin-input][data-part=input]::selection
{ background: transparent; color: transparent }` and the `:autofill`/`:-webkit-autofill`
rules (`-webkit-text-fill-color: transparent; box-shadow` reset), once per document root with
the CSP nonce.

### 5. Contract and model-based tests

- `paste` uses the adapters' clipboard input (Testing Library `user.paste`, Playwright
  `keyboard.insertText` after a clipboard write); `autofill` uses the native setter + `input`.
- `pressSlot` needs layout (jsdom rejects; the jsdom project runs keyboard and virtual only).
- Configurations: numeric length 6 uncontrolled; alphanumeric with an uppercasing `sanitize`;
  masked PIN length 4 with `autoComplete="off"`; controlled accepting and controlled refusing;
  `autoSubmit` in a form with another required field; read-only; inside a Field with an
  ErrorMessage; `dir="rtl"` page.

### 6. Theme

`pin-input.css`, family `field`: slot box (`--rind-pin-input-slot-size`,
`--rind-pin-input-slot-gap`, `--rind-pin-input-slot-border`, `--rind-pin-input-slot-bg`,
`--rind-pin-input-slot-soft-bg`), active slot ring from the base focus ring when the input has
`data-focus-visible` (always shown for keyboard; for pointer the active slot gets a border),
fake caret on `[data-caret]` blinking through the duration tokens (off under reduced motion),
`--rind-pin-input-badge-space` padding at the inline end of the control, forced colors with
`CanvasText` borders and `Highlight` for the active slot, a `data-tone="danger"` capture.

## Requests to other changes

- **add-a11y-foundations**: generalise the per-document style injection that
  `press-interactions` uses for `touch-action` (with the environment's CSP nonce, once per
  document or shadow root) into a `core/dom/inject-style.ts` helper that components may use for
  pseudo-element rules that cannot be inline (Pin Input's transparent selection and autofill
  paint; Password Input's and Search Field's native-button hiding).
- **APPLIED (coordinator, 2026-10-14).** **add-number-input** (`add-text-field` request there): the Root-as-Field helper is reused
  here unchanged.

## Risks / Trade-offs

- [iOS may still draw selection handles or a caret line over the transparent input
  (input-otp#32, #110)] → no programmatic range selection, transparent caret; device check in
  the manual protocol; documented.
- [Controlled input means programmatic writes lose the native undo step for planned
  insertions] → deletions stay native; a code field rarely needs undo across insertions.
- [Slot hit-testing needs layout] → jsdom covers keyboard and virtual paths only; browser mode
  covers pointer.

## Migration Plan

None (Reado has no pin input).
