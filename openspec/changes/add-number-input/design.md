## Context

[number-input.md](../../../docs/research/number-input.md) has the comparison and the bug
history behind each scenario. This change builds on, and does not re-specify:

| Change | What Number Input uses |
|---|---|
| `add-foundations` | `setup()`/`machine()`, `controllable()` (`value`), `$sync`/`$reverted`, `ChangeDetails.cancel()`, delayed transitions through the scheduler, effects, contracts (`{ skip }`, prop steps), drivers, `testMachine` |
| `add-a11y-foundations` | `press-interactions` (`PRESS.START/UP/END/CANCEL`, `PRESS`, press without focus, `pointercancel`), `keyboard-interactions` (`toLogicalKeyEvent` with `value: true`: INCREASE/DECREASE, PAGE_*, FIRST/LAST; IME guard), `interaction-modality`, `announcer` (keyed polite), `i18n-messages` (locale, `messages`), `a11y-quirks`, `platform-and-preferences` (`platform.ios`, `platform.android`) |
| `add-field` | `field-control` binding, `field-validation` (native validity from the validity element), Field parts |
| `add-text-field` | Root-as-Field (the Root creates a Field when not inside one) |
| `add-checkbox` | `hidden-form-input` (declared `<input type="number">`, property mirroring, user-change events, reset, adoption, focus redirect, validity element) |
| `add-button` | `button-like-element` for the triggers (`aria-disabled` + `focusableWhenDisabled`) |
| `add-slider` | `slider.math.ts` snapping and decimal-safe rounding (see Requests) |
| `add-progress` | `valued` trait expectations (`spinbutton` already listed) |
| `add-theme-system` | family `field` (Number Input already in the matrix), stylesheet convention |

## Goals / Non-Goals

**Goals:**
- One value model: free text while typing, a number at commit points; every path (key,
  trigger, wheel, paste, blur, Enter, reset, parent) goes through one `commit`/`step` helper.
- Parsing written zero times by us: `@internationalized/number` behind `core/i18n/number-parser.ts`.
- A machine that runs in Node with numbers only; press-and-hold walked by the model with fake
  timers.

**Non-Goals:**
- Scrubbing, live formatting, small step on Alt (proposal Non-goals).

## Decisions

### 1. Layout

```
packages/core/src/
├─ i18n/number-parser.ts            capability `number-parsing`: parse, isPartial, format, valueText, keypad quirk
├─ components/number-input/
│  ├─ number-input.machine.ts
│  ├─ number-input.connect.ts
│  ├─ number-input.contract.ts      contract + numberInputInvariants
│  └─ number-input.messages.ts
packages/react/src/number-input/    Root, Label, Description, ErrorMessage, Control, Input,
                                    IncrementTrigger, DecrementTrigger
packages/theme/src/number-input.css
```

### 2. Parser module (`number-parsing`)

`createNumberParser(locale, options) → { parse(text): number | null; isPartial(text, { allowNegative }): boolean; format(value): string; valueText(value): string; resolved }`,
cached per locale + options key (options compared by value: sorted entries). It wraps
`@internationalized/number` (`NumberParser`, `NumberFormatter`) and adds what that library
lacks or does differently:

- `arabext` digits (Persian) normalised to `arab`/`latn` before parsing (the library's
  numbering-system list is latn, arab, hanidec, deva, beng, fullwide);
- `isPartial` strips group separators before checking (react-spectrum#5927) and accepts
  prefixes of literals (react-spectrum#2806 is open upstream);
- default `maximumFractionDigits` raised to `max(decimals(step), decimals(value), 0)` capped
  at 20 when the consumer set no fraction or rounding option (base-ui#5420);
- `valueText` = `format` with U+2212 and accounting parentheses → minus;
- the keypad quirk (`keypad-decimal-separator`, condition `p.ios || p.android`, as registered in add-a11y-foundations): an inserted
  character equal to the device locale's decimal separator (`navigator.language` through the
  environment) and different from the field's is mapped in the insertion plan.

*Alternative*: port the parser (~300 lines) into core. Rejected by default: Base UI's own
parser is the source of half its number-field bugs (base-ui#5424, #4718, #5107, #5420), and four
libraries share the upstream one. The dependency is allowed by
[decision record 0009](../../../docs/decisions/0009-internationalized-number.md) (accepted,
2026-10-14): `@rind-ui/core` only, used only through this module, tree-shaken out of bundles
without numeric fields (size check, task 0.2).

### 3. Machine

```ts
type Trigger = "increment" | "decrement"
type NumberInputEvent =
  | { type: "INPUT"; text: string; composing: boolean }                  // accepted edit (insertion plan passed)
  | { type: "COMMIT"; source: "blur" | "enter" }
  | { type: "PASTE"; text: string }                                       // whole-text replacement
  | (LogicalKeyEvent & { large: boolean })                                // INCREASE DECREASE PAGE_NEXT PAGE_PREV FIRST LAST
  | { type: "WHEEL"; direction: 1 | -1; large: boolean }
  | { type: "PRESS.START" | "PRESS" | "PRESS.END" | "PRESS.CANCEL"; trigger: Trigger; pointerType: PointerType; modality: Modality }
  | { type: "COMPOSITION.START" } | { type: "COMPOSITION.END"; text: string }
  | { type: "FOCUS"; modality: Modality } | { type: "BLUR" }
  | { type: "RESET" }
  | { type: "INPUT.ADOPT"; value: number | null }                         // hidden-input autofill

states:
  idle       ── INPUT / setText, reportInputValue
             ── COMMIT [notComposing] / commitText            (parse → snap|validate → write → resyncText → announceIfRewritten)
             ── PASTE [editable] / commitPaste
             ── INCREASE|DECREASE|PAGE_*|FIRST|LAST [editable, notComposing] / step, commitInteraction
             ── WHEEL [editable] / step, commitInteraction
             ── PRESS.START [editable, canStep(trigger)] ──► pressing  (mouse/pen: step; touch: nothing)
             ── PRESS [editable, canStep, pointerType ∈ keyboard|virtual] / step, commitInteraction, announceIfRemote
             ── COMPOSITION.START ──► composing
  composing  ── INPUT / setText (no filtering) ; COMPOSITION.END / setText(normalised) ──► idle
  pressing   after spinDelay (props; 600 ms for touch) ──► spinning
             ── PRESS [touch, not spun] / step ; PRESS.END|PRESS.CANCEL ──► idle / commitInteraction, announceIfRemote
  spinning   entry: step ; after spinInterval [canStep] ──► spinning (re-entry repeats) ; [!canStep] ──► idle
             ── PRESS.END|PRESS.CANCEL ──► idle / commitInteraction, announceIfRemote
  global     FOCUS/BLUR (context; BLUR also sends COMMIT), RESET / restoreDefault, INPUT.ADOPT, $sync:value / resyncText, $reverted / resyncText
values:      value: controllable("value", { fallback: null, equal: Object.is })
             disabled, readOnly: bindProp — `pressing`/`spinning` are unreachable while either holds,
             and a `$sync` to disabled/readOnly exits them (base-ui#5434)
```

- **Why these states.** `pressing`/`spinning` own delayed transitions and change what `PRESS`
  means; `composing` disables filtering and key handling. Focus, `text`, `dirty` (text edited
  since the last commit), the pressed trigger and `steppedOnStart` are context. Typing is
  not a state: nothing in the graph depends on it except `dirty`, which guards read.
- **One step helper**: `nextStep(base, direction, size, props)` in `number-input.math.ts`,
  built on the shared step math (`snap`, `roundToStepPrecision`, `clamp`): base = parsed text
  when `dirty` else value; empty → `clamp(0)`; else next grid line in the direction; no-op →
  no change (base-ui#3887 at the bound ends spinning through `!canStep`).
- **Mouse step on PRESS.START, not PRESS.** Native number spinners and every library step on
  press-down for the mouse; `press-interactions` still delivers the trailing `PRESS`, which
  `steppedOnStart` swallows (base-ui#2588). Touch steps on `PRESS` (release), so a scroll's
  `PRESS.CANCEL` never steps (react-spectrum#8472). This is the only place a component acts on
  `PRESS.START`. WCAG 2.5.2 is met through its "abort or undo" clause: a step is undone by the
  opposite trigger or key, as with the native spinner.
- **Commit** (`commitText`): empty → `null`; `parse` → `null` ⇒ restore; else snap or keep;
  then the proposal; `resyncText` writes `format(resolved value)` to `context.text` after
  the value resolves (uncontrolled: same step; controlled: at `$sync`/`$reverted`, zag#3444).
  `commitInteraction` calls `onValueCommit` only when the interaction changed the value
  (pending marker as in Slider for controlled mode).
- **Announcements** (`announceIfRemote`, `announceIfRewritten`): `env.announcer.announce({
  message, priority: "polite", key: "number-input-<id>" })`; remote = the press modality was
  `touch` or `virtual`.

### 4. Connect

| Part | Attributes / handlers |
|---|---|
| Root | Field host attributes, `data-focus(-visible)`, `data-spinning`, `data-composing`, `dir` |
| Control | same state attributes, no role |
| Input | binding (`mergeFieldProps`), `role="spinbutton"` (unless the iOS quirk), `aria-value*`, `aria-required`, `type="text"`, `value={context.text}` (always controlled by the machine), `inputMode` (§5), `autoComplete/autoCorrect off`, `spellCheck=false`; `beforeinput` → `planInsertion(text, selection, data, inputType)` → `preventDefault` when rejected; `input` → `INPUT`; keydown → logical keys (IME guard, `preventDefault` only when handled; Home/End only with the bound); `paste` (whole selection) → `PASTE`; composition events; `focus`/`blur`; non-passive `wheel` listener attached by an effect while focused and `allowWheel` |
| Increment/DecrementTrigger | button-like props, `tabIndex=-1`, `aria-controls`, `aria-labelledby="<self> <label>"`, `aria-label` = message, `aria-disabled` when `!canStep`, press handlers with press-without-focus; on mouse/pen press with focus elsewhere `focusSafely(input, "pointer")`; `contextmenu` prevented while pressed |
| hidden input | `hidden-form-input` with `type="number"`, `min`/`max`/`step` (`any` without `min`), value property, adoption → `INPUT.ADOPT` |

`planInsertion` is pure (core) so jsdom and node tests cover it per locale.

### 5. `inputMode` and SSR

Server and first client render: `decimal` if fractions are allowed (`resolved.maximumFractionDigits > 0`
or a fractional step) else `numeric`. After mount, an effect re-renders with the platform
table (iPhone: negatives → `text`; Android: negatives → `numeric`). The text is formatted with
the resolved locale; if the client's locale differs from the server's, the input's value is
re-formatted after hydration and the React part sets `suppressHydrationWarning` on the input
only (Base UI does the same).

### 6. Contract and model-based tests

- `holdStepper` uses the adapter's pointer down/up with the injected time advance; jsdom runs
  it with fake timers (press interactions need no layout); `wheel` dispatches a `WheelEvent`.
- Configurations: uncontrolled empty, `defaultValue` with `min/max/step` (integers), decimal
  step 0.1, percent, `de-DE` currency, `ar-EG` (arab digits), `commitBehavior="validate"`,
  `allowWheel`, `spinOnPress={false}`, controlled accepting, controlled clamping (zag#3444),
  read-only, disabled toggled by prop steps, inside a Field (`change` mode), iOS platform
  preset (quirk) and Android preset.
- Delays (`spinDelay`, `spinInterval`) map to `holdStepper`; `COMPOSITION.*` to `compose`
  where the adapter supports it.

### 7. Theme

`number-input.css`, family `field`: `--rind-number-input-height` (from `--rind-size-control`),
`--rind-number-input-border`, `--rind-number-input-bg`, `--rind-number-input-soft-bg`,
`--rind-number-input-trigger-size`, focus ring on `[data-part=control]:has([data-focus-visible])`
(fallback: the input's own ring), triggers stacked or side by side via
`--rind-number-input-trigger-layout`, `font-variant-numeric: tabular-nums`, at-bound triggers
`opacity` plus `GrayText` in forced colors, hit area from `--rind-hit-area`, a `data-tone="danger"`
capture.

## Requests to other changes

- **APPLIED (coordinator, 2026-10-14).** **add-slider**: move the snapping and decimal-safe rounding helpers of `slider.math.ts`
  (`snap`, `roundToStepPrecision`, `clamp`, decimal counting incl. exponent notation) to
  `core/shared/step-math.ts` and import them from Slider. No behaviour change; Number Input is
  the second user (CLAUDE.md "generalise when the second component needs it").
- **APPLIED (coordinator, 2026-10-14).** **add-text-field**: expose Root-as-Field (the React Root that creates a Field service when
  there is no enclosing `FieldControlContext`, with the Field connect parameterised by scope)
  as a shared adapter helper (`react/src/field/use-field-host.ts`), so Number Input, Pin Input,
  Password Input and Search Field reuse it instead of copying it.
- **add-a11y-foundations** (`press-interactions`): let a pressable part opt into suppressing
  the touch context menu while a press is held without enabling long press (steppers hold for
  longer than the long-press threshold but are not long-pressable). Also two quirk entries in
  `a11y-quirks`: `ios-vo-spinbutton-input` and `keypad-decimal-separator`.
- **Decision record 0009** (not a change): accepted 2026-10-14 —
  [0009](../../../docs/decisions/0009-internationalized-number.md) allows
  `@internationalized/number` as a runtime dependency of `@rind-ui/core`.

## Risks / Trade-offs

- [New runtime dependency] → allowed by decision 0009; small, no dependencies of its own (the
  same family as `@internationalized/date`), used by four libraries; wrapped in one module;
  tree-shaking size check (task 0.2).
- [Mouse steps on press start, before release] → 2.5.2's undo clause applies (the opposite
  step reverts it); matches the native spinner; touch, AT and keyboard activate on release.
- [iOS quirk drops the role] → iOS users get a plain number textbox (the RA/Base UI behaviour
  everywhere); removed once device testing passes.
- [Value changes only at commit points; consumers wanting live values must use
  `onInputValueChange`] → matches RA; documented with a recipe.

## Migration Plan

Reado: `settings/fields.tsx` → `NumberInput.Root` with `onValueCommit` replacing the
draft-on-blur state; `AnywhereDialog.tsx` → `min={0}` and `onValueCommit`; `BrowserPanel.tsx`
width/height → `NumberInput` without triggers, zoom → `formatOptions={{ style: "percent" }}`
with the stored ratio.

## Open Questions

- Device check of `ios-vo-spinbutton-input` (iOS 27 VoiceOver focusing and editing an
  `<input role="spinbutton">`); the outcome only changes the quirk's condition.
