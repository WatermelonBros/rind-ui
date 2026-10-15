## Context

The research note ([slider.md](../../../docs/research/slider.md)) compares the seven
libraries and records the bug history behind each scenario. This change builds on:

- `add-foundations`: `setup().machine()`, `controllable()` with `equal`, `$sync`,
  `$reverted`, `ChangeDetails`, contracts, drivers, `testMachine` (`modalities`,
  `directions`, prop steps);
- `add-a11y-foundations`: `a11y/keys.ts` (`toLogicalKeyEvent` with `value: true`:
  INCREASE/DECREASE mirrored in RTL, Up always increases, PAGE_PREV/PAGE_NEXT, FIRST/LAST,
  DISMISS), `dom/modality.ts`, `focusSafely`, `dom/visually-hidden.ts` (input variant),
  `dom/text-selection.ts`, `i18n` (`format.number`, `resolveMessages`), `ids.ts`;
- `add-checkbox`: `hidden-form-input` (property sync, user-change events, reset,
  adoption of native input, implicit submission) and `control-label` (Description);
- `add-theme-system`: tokens, variants, stylesheet convention;
- `add-progress`: the `valued` extension in `model-based-testing` (arrays, contract
  expectations).

## Goals / Non-Goals

**Goals:**
- A layout-free machine: every transition, including pointer ones, runs in Node with
  numbers, and the model walks every edge in browser mode.
- Native range input per thumb with our machine as the only owner of the value.
- One commit path, one rounding helper, one axis function.

**Non-Goals:**
- Visual value tooltips while dragging (a consumer renders them inside `Thumb`).
- Momentum or wheel input.

## Decisions

### 1. Layout

```
packages/core/src/
├─ components/slider/
│  ├─ slider.machine.ts
│  ├─ slider.connect.ts
│  ├─ slider.contract.ts      contract + sliderInvariants
│  ├─ slider.messages.ts      thumbLabel, valueText
│  └─ slider.math.ts          bounds, collision, nearest thumb, `settle` (pure)
├─ shared/step-math.ts        snap, roundToStepPrecision, clamp, decimal count (pure; shared with Number Input)
├─ dom/pointer-drag.ts        capability `pointer-drag`
packages/react/src/slider/    Root, Label, ValueText, Control, Track, Indicator, Thumb, MarkerGroup, Marker, Description
packages/testing/src/adapters/{dom,playwright}.ts   box(), pointer(), fill()
packages/theme/src/slider.css
apps/storybook/src/slider/*.stories.tsx
```

### 2. Machine

```ts
type Thumb = number
type SliderEvent =
  | { type: "POINTER.DOWN"; fraction: number | null; thumb: Thumb | null; modality: "pointer" | "touch" }
  | { type: "POINTER.MOVE"; fraction: number }
  | { type: "POINTER.UP" }
  | { type: "POINTER.CANCEL" }                         // pointercancel, lost capture, disabled mid-drag
  | (LogicalKeyEvent & { thumb: Thumb })                // INCREASE DECREASE PAGE_PREV PAGE_NEXT FIRST LAST DISMISS
  | { type: "INPUT.CHANGE"; thumb: Thumb; value: number } // AT adjust (hidden-form-input adoption)
  | { type: "RESET" }
  | { type: "FOCUS"; thumb: Thumb; modality: Modality }
  | { type: "BLUR"; thumb: Thumb }
  | { type: "INPUT.SYNCED" }

states:
  idle      ── POINTER.DOWN [canInteract] / pickThumb, recordStart, setFromPointer, focusThumb ──► dragging
            ── INCREASE|DECREASE|PAGE_*|FIRST|LAST [canChange] / stepThumb, commit
            ── INPUT.CHANGE [canChange] / setFromInput, commit   (else resyncInput)
            ── RESET / restoreDefault
  dragging  ── POINTER.MOVE / setFromPointer (collision policy; swap moves focus)
            ── POINTER.UP / commitIfChanged ──► idle
            ── POINTER.CANCEL / restoreStart ──► idle
            ── DISMISS / restoreStart, stopPropagation ──► idle
  global    FOCUS/BLUR (context), INPUT.SYNCED, $reverted / clearPending
effects:   dragging: ["trackDrag"]  (pointer-drag capability)   service: ["formInput", "disabledWatch"]
```

- **Two states.** Focus is context (as in Checkbox): a third `focus` state (Zag) doubles
  edges for no transition that depends on it. `dragging` is a state because it owns an
  effect (document listeners) and changes Escape's meaning.
- **Value** is `controllable("value", { equal: sameNumbers })` over `readonly number[]`;
  the adapter converts the consumer's shape at the boundary (a `number` in, a `number`
  out). Every write goes through `slider.math.ts#settle(values, index, next, props)`
  (snap with decimal-safe rounding → neighbour bounds or collision policy → clamp), the
  single helper all paths share (BU#4547, RX#3852). Snapping, decimal-safe rounding
  (`roundToStepPrecision`, decimal counting incl. exponent notation) and `clamp` live in
  `core/shared/step-math.ts`, which `settle` imports; Number Input (`add-number-input`) is
  the second user, so they are shared rather than private to Slider. Moving them changes
  no behaviour.
- **Commit.** `commit` actions call `onValueCommit` with the resolved value after the
  write in the same step; `commitIfChanged` compares with `context.start` using the same
  `sameNumbers`. A controlled proposal that the parent refuses arrives as `$reverted`,
  and commits made for it are not repeated: `commit` runs only when the write was
  accepted (`details.cancel()` not called; uncontrolled) or, controlled, when the
  `$sync` that applies it arrives (pending marker, like Checkbox's `pendingUserValue`).
- **Pointer events carry fractions.** `trackDrag` is started by the `dragging` entry with
  `{ axis, dir, contain, grabOffset }`; `core/dom/pointer-drag.ts` measures the Control
  rect once per press (and the thumb size for `contain`), and sends `POINTER.MOVE` with
  a fraction. `POINTER.DOWN` is sent by connect's Control `pointerdown` through the same
  module (so it shares the geometry); `thumb` is set when the press target is inside a
  Thumb. `pickThumb` (pure): pressed thumb if enabled; else nearest enabled; ties →
  the thumb that can move toward the press; a stack → decided on the first move
  (`context.stackedPick`).
- **Escape** is mapped only while dragging (the `DISMISS` edge exists only there);
  connect calls `stopPropagation` when the machine handled it.
- **AT adjust.** `hidden-form-input`'s adoption hook sends `INPUT.CHANGE`; a guard
  failure or a snapped value re-syncs the input (`resyncInput` action through the form
  capability).

### 3. Native thumb inputs and forms

Each Thumb renders `<input type="range">` with `id`, `min`/`max` = neighbour bounds,
`step`, `name`, `form`, `disabled`, `defaultValue` (the current `defaultValue` prop, per
the add-field/add-form reset decision), and the value
written as a property by the form capability's `sync` on every step entry and after each
commit (React never receives a controlled `value`, which would also write the `value`
attribute and break reset). Keys are handled on its `keydown` with `preventDefault`; its
`input`/`change` events are ours only when `dispatch` says so (user change applied), and
any other native `input` is the adoption path. Implicit submission on Enter comes from
the `hidden-form-input` helper (a range input submits on Enter natively; we only avoid
blocking it).

This needs the `hidden-form-input` variant requested below: the inputs are the
accessible controls, so the "aria-hidden, tabIndex -1, focus forwarded" rules do not
apply to them, while sync, user-change events, reset and adoption do.

### 4. Connect output

| Part | Attributes |
|---|---|
| Root | `role="group"`, `aria-labelledby`, `id`, `dir`, shared `data-*` |
| Label | `<label>` with `id`, no `for`; pointer press → `focusSafely(firstEnabledInput, pointer)` |
| ValueText | text from `format.number`/`formatRange`/`Intl.ListFormat`; no live role |
| Control | `pointerdown` → pointer-drag start; `touch-action` by orientation; `user-select: none`; `position: relative` |
| Track / Indicator | Indicator: `--rind-slider-start/-end`, inline `inset-inline-start`/`inline-size` (or `bottom`/`block-size`) |
| Thumb | `data-index`, `data-active`, `--rind-slider-thumb-percent`, position style, `touch-action: none` |
| thumb input | `aria-valuenow/min/max/valuetext`, `aria-orientation`, `aria-readonly`, `aria-labelledby="<label> <self>"`, `aria-label` (thumb name), `aria-describedby`, hidden input style sized `100%` of the thumb, `pointer-events: none`, `writing-mode` when vertical |

Positions: `center` → `inset-inline-start: calc(p * 1%)` with `translate(-50%)` (logical,
so RTL needs nothing); `contain` → `calc(var(--rind-slider-thumb-size, 0px) / 2 + (100% -
var(--rind-slider-thumb-size, 0px)) * p / 100)`. Vertical uses `bottom`. Server and
client compute the same strings from the value, so no prehydration script (Base UI) and
no hidden-until-measured thumbs (Zag).

### 5. Shared module `core/dom/pointer-drag.ts`

```ts
interface PointerDragCapability {
  start(surface: Element, e: PointerEvent, o: { axis: "horizontal" | "vertical";
    dir: "ltr" | "rtl"; grabOffset: number; inset: number },
    send: (m: { type: "move"; fraction: number } | { type: "up" } | { type: "cancel" }) => void): () => void
  fraction(surface: Element, e: PointerEvent, o: …): number | null
}
```

Specified in `pointer-drag`. Not merged with Drawer's swipe gesture: that one measures
velocity, yields to scroll and writes CSS variables per frame; this one reports
absolute fractions per move. They share nothing but listener hygiene.

### 6. Contract and driver

- Pointer actions use `Part.pointer(phase, { at })` from `test-drivers`; the target
  fraction for a value is computed from `box()` of the Control and the thumb size, with
  `dir`/orientation read from `data-orientation` and `dir`. In jsdom they reject
  ("needs layout"); the jsdom project runs `testMachine` with `modalities: ["keyboard",
  "virtual"]` and `adjustNative` mapped to `INPUT.CHANGE`.
- `adjustNative(i, v)` uses `Part.fill(String(v))` on the thumb input.
- `valued` uses `add-progress`'s extension: expected values are the oracle's array in
  thumb order, expected texts from `messages.valueText` with the run's locale.
- Model configurations: single uncontrolled; `[20, 80]` with gap 2 and each collision
  policy; vertical; `dir="rtl"` (trait `directional`); `readOnly`; per-thumb disabled;
  `contain`; controlled wrapper that applies every proposal and one that refuses.
  `FOCUS`, `BLUR`, `INPUT.SYNCED` are `skip` (not user events); `POINTER.CANCEL` maps to
  a pointer step that dispatches `pointercancel` (browser only); `RESET` → `resetForm`.

### 7. Theme

`slider.css` in `@layer rind.components`: track (`--rind-slider-track-size`,
`--rind-slider-track-bg`), indicator (`--rind-slider-indicator-bg` → accent solid),
thumb (`--rind-slider-thumb-size` default `var(--rind-size-sm)`, border in the palette
`border` role for 3:1), focus ring from base, hit area pseudo-element, vertical via
`[data-orientation=vertical]`, `[data-dragging]` disables transitions, forced colors.
`data-variant` `solid` (filled indicator) / `soft` (tinted); `data-size` sm/md/lg changes
track and thumb sizes. Family: `range` (requested below).

### Requests to other changes (ALL APPLIED by the coordinator, 2026-10-14)

- **add-checkbox** (`hidden-form-input`): add a requirement *Accessible Native Input*: a
  component MAY declare that its native input is itself the accessible control (Slider's
  thumb inputs, later Angle Slider). Such an input is exempt from "aria-hidden,
  tabIndex -1, never focused, never receives pointer input as a target of forwarding,
  focus forwarded to the visible control"; it keeps property mirroring with the creation
  default as content attribute, user-change-only `input`/`change`, form reset as
  `RESET`, native-input adoption and the `form-associated` trait (minus the
  aria-hidden/tabIndex checks). One component may render several such inputs (one per
  thumb), each with its own `name`.
- **add-theme-system** (`theme-variants` → Family Matrix): add a family **range** for
  Slider, Progress and Meter with `data-variant` **solid**, soft and `data-size` sm,
  **md**, lg. (Also listed by `add-progress` and `add-meter`; one family.)
- **add-overlay-infrastructure** (`scroll-lock` → iOS Behaviour): the list of touches
  that are never prevented ("two-finger gestures, range inputs and text-selection
  handles") should also cover a touch that starts inside an element whose
  `touch-action` excludes the gesture's axis (a Slider Control), so a Slider in a modal
  drags on iOS (RA#9493). Our pointer events survive a prevented `touchmove`, so this is
  defensive; the Slider scenario "Inside a modal on iOS" verifies it either way.

### Field binding (amendment from add-field)

The Root reads add-field's `field-control` binding and registers the Slider once as one
control (thumbs never register; the first thumb input is the validity element). Field ARIA
goes on the thumb inputs; `required` is `data-required` only, since a range input always
has a value; flags are OR-merged with the Field and an enclosing Fieldset (spec "Field
Control Binding", task A.1).

## Risks / Trade-offs

- [Reverting on `pointercancel` loses a value the user meant when a diagonal touch drag
  is taken for scrolling] → `touch-action: pan-y` hands vertical intent to the page by
  design; device check in the manual protocol; switching to Base UI's touch tracking is
  contained in `pointer-drag.ts`.
- [`contain` relies on `--rind-slider-thumb-size` matching the real thumb] → the theme
  sets both from one token; pointer mapping measures the real size, so a mismatch is
  visual only; documented.
- [Per-thumb `min`/`max` attributes change the native step base] → bounds are always on
  the grid (neighbour values are snapped), so the base stays aligned.
- [VO may still read the previous value in interaction mode] → it does so on the APG
  example too (RA#5583); our part (no blur/refocus, same-step attributes) is covered by
  invariant 16; the rest is a manual-protocol note.

## Migration Plan

None for rind-ui. Reado's `SystemTab.tsx` native range becomes `Slider` with a unit
format; its visible `px` text becomes `ValueText`.
