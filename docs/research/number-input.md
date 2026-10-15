# Number Input — research

Status: done · Wave: 2 (Number Field in React Aria, Base UI, Reka, Kobalte; Number Input in Ark/Zag)

Read [text-field.md](text-field.md) and [field.md](field.md) first: Number Input is a
`field-control` and its Root acts as a Field like Text Field's. Cross-cutting:
[accessibility.md](accessibility.md) §5 (press without focus, long press), §6 (logical keys,
IME guard), §7 (Announcer), §9 (numbers through `Intl`); [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
cause G (value announced one step late), J (mobile ATs and spinbuttons), I
(`aria-roledescription` + required on iOS); [native-platform.md](native-platform.md) §8
(avoid a visible `type=number`, keep a hidden one for forms) and §14 (hidden native inputs).
Reado: `organisms/settings/fields.tsx` (`type=number`, draft text committed on blur),
`organisms/AnywhereDialog.tsx` (`min={0}`, `Number(e.target.value) || 0`),
`organisms/BrowserPanel.tsx` (width, height and a zoom percent as `type=number`).

## Pattern

- WAI-ARIA APG [Spinbutton](https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/) and its
  [Quantity example](https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/examples/quantity-spinbutton/)
  (fetched 2026-10-14): `<input type="text" role="spinbutton">` with `aria-valuenow`,
  `aria-valuemin`/`aria-valuemax` when known, `aria-valuetext` when the number alone is not
  friendly, `aria-invalid` when out of range. Increment/decrement buttons are `tabindex="-1"`
  (skipped by Tab, still reachable by touch and voice users), named ("Add adult"), with
  `aria-controls` → input and `aria-disabled="true"` at a bound. The example announces the
  new value through a polite `output` after a **button** press (focus is not on the input
  then).
- Keyboard: ArrowUp/ArrowDown step; Home/End set min/max **if the spinbutton has one**;
  PageUp/PageDown (optional) large step; standard single-line text editing must keep working
  ("JavaScript must not capture key events used for text editing"). Rejected input leaves text
  and value unchanged.
- WCAG: 1.3.5 (purpose), 2.5.1/2.5.7 (no gesture-only path: the scrub areas Base UI and Zag
  ship are pointer-only), 2.5.8 (stepper target size), 3.3.1 (range errors are identified),
  4.1.2 (value exposed).

## How the others built it

### React Aria (`react-aria/src/numberfield/useNumberField.ts`, `spinbutton/useSpinButton.ts`, `react-stately/src/numberfield/useNumberFieldState.ts`, `@internationalized/number/src/NumberParser.ts`)

- State: `numberValue` (`NaN` = empty, RA#6971 asks for `null`) controllable, plus
  `inputValue` text. `onChange` fires on **commit** only (blur, Enter, steps); typing changes
  only the text (RA#7984 and RA#6156 ask for live values). `commitBehavior: "snap"` (clamp +
  snap on blur) or `"validate"` (keep the typed value, validate min/max/step natively through
  a detached `<input type=number>` to get the browser's messages).
- Parsing: `NumberParser` detects the numbering system of the typed text (latn, arab,
  hanidec, deva, beng, fullwide — deva/beng added by RA#6623), strips literals (currency,
  unit, percent, bidi controls), accepts ASCII `-` for the locale minus, `'` for Swiss `’`,
  space for fr-FR's narrow no-break group, `,`/U+060C as Arabic decimal. `isValidPartialNumber`
  filters keystrokes (`onChange` drops a text that is not a valid partial number).
  Percent is parsed by moving the decimal point in the string (no float `/100`).
- Steps: `safeNextStep` snaps an off-grid value to the next grid line in the step's
  direction before adding a step; empty + increment → `min` (or 0), empty + decrement →
  `max` (or 0); decimal-safe `handleDecimalOperation`; percent default step 0.01.
- Input props: `type="text"`, `inputMode` per platform (iPhone has no minus key in
  `numeric`/`decimal` → `text` when negatives are allowed; Android `numeric` has minus and
  decimal), `autoComplete/autoCorrect off`, `spellCheck=false`. **`role` is removed**
  ("we can't focus a spin button with VO") and `aria-roledescription="Number field"` is
  added except on iOS ("so that required state will announce"); the value attributes are
  dropped. `name`/`form` go to a hidden input. The group (`role=group`) carries
  `aria-invalid`.
- `useSpinButton`: Up/Down/PageUp/PageDown/Home/End with key repeat; announces the value
  text **assertively** on every change while focused (and again on commit when the text
  changed); replaces `-` with U+2212 so VoiceOver says "minus"; "Empty" for an empty field
  (iOS VO read a stale "50%"). Steppers: mouse steps on press start, then repeats after
  400 ms every 60 ms; touch waits 600 ms and steps on release if it did not spin, cancels
  on `pointercancel`, suppresses `contextmenu` during the hold. Steppers are
  `excludeFromTabOrder`, `preventFocusOnPress`, `allowFocusWhenDisabled`, `aria-label`
  "Increase {fieldLabel}", `aria-controls` → input; a mouse press focuses the input, touch
  focuses the button so the keyboard does not open.
- Wheel: on while focus is within, opt-out `isWheelDisabled`; `deltaY > 0` increments (RA#4196:
  inverted on Windows mice), ignores mostly-horizontal deltas (RA#1792).
- Notable: the most complete i18n; paste that replaces the whole text commits immediately.
- Problems: RA#1893/RA#9899 (inline `formatOptions` reset typing), RA#9671 (Enter commits
  without flush → stale value submitted), RA#9444 (blur clears server errors), RA#8503
  (iPhone `inputMode` → SSR mismatch), RA#2806/RA#5927 (deletions rejected), RA#5731 (iOS
  decimal keypad), RA#8472 (touch scroll steps), RA#4157 (held key floods the announcer).

### Ark UI / Zag (`zag/packages/machines/number-input/src/*`)

- States `idle`, `focused`, `before:spin`, `spinning`, `scrubbing`; `value` is a **string**
  (`onValueChange({ value, valueAsNumber })`), `@internationalized/number` parser,
  `onValueCommit` on blur/Enter, `onValueInvalid` for out-of-range, `clampValueOnBlur`
  (= not `allowOverflow`), `allowMouseWheel` opt-in, `spinOnPress`, 300 ms delay then 50 ms
  interval, `largeStep`/`smallStep` with Shift/Alt (and Meta). Scrubber uses pointer lock
  and a virtual cursor (pointer only). Defaults `min`/`max` = ±`MAX_SAFE_INTEGER`, which then
  appear in `aria-valuemin/max`.
- Input: `role="spinbutton"`, `aria-roledescription="numberfield"`, `aria-valuetext` from
  `translations.valueText`, `inputMode="decimal"`, `pattern`, `beforeinput` filtering with
  `isValidPartialNumber`; cursor recorded and restored around reformatting (ZG#2712).
  Triggers `tabIndex=-1`, `aria-controls`, step on `pointerdown` (ZG#987: mouse only at
  first), `aria-label` "increment value"/"decrease value" (inconsistent defaults).
- Problems: ZG#3444 (open: controlled parent refuses or clamps, the typed text stays), ZG#2783
  (percent float), ZG#1710 (Enter broke later keys), ZG#2083 (React `onChange` missed
  backspace → `onInput`), ark#1838/ZG#1022 (fr-FR currency step from typed text), ark#3500
  (iOS comma keypad vs `en-US`), ark#3133 (locale provider ignored), ZG#2943 (`invalid`
  should override out-of-range), ark#1609 (opt out of press-and-hold).

### Base UI (`number-field/root/NumberFieldRoot.tsx`, `input/NumberFieldInput.tsx`, `root/useNumberFieldStepperButton.ts`, `internals/usePressAndHold.ts`, `utils/parse.ts`)

- `value: number | null`; `onValueChange` on every parseable keystroke and every step,
  `onValueCommitted` on blur/Enter/step end; `allowOutOfRange` (typing may leave the range,
  steps clamp), `snapOnStep`, `step`/`smallStep` (Alt)/`largeStep` (Shift), `allowWheelScrub`
  opt-in (non-passive listener, ignores Ctrl = pinch, horizontal gestures), `ScrubArea`
  (pointer lock; not in Safari).
- **Own parser** (`utils/parse.ts`) instead of `@internationalized/number`: many bugs
  BU#5424 (open: "1.2.3" shown, 12.3 submitted), BU#4718 (Persian digits blocked), BU#5107
  (multi-character currency `R$` not editable), BU#5420 (rounds to 3 decimals).
- Hidden `<input type="number">` with `name`, `min`, `max`, `step` (min added for
  react#12334 `stepMismatch`), `aria-hidden`, `tabIndex=-1`, autofill through its `onChange`
  (`valueAsNumber`). BU#3574: focus landed on the `aria-hidden` input and blocked submit.
- Input: `type=text`, `aria-roledescription="Number field"`, **no `spinbutton` role**,
  `inputMode` `decimal`/`text` on iOS set after mount; Home/End only when the bound exists;
  PageUp/PageDown not handled; programmatic focus places the caret at the end (BU#5576).
- Press-and-hold (`usePressAndHold`): 400 ms then 60 ms ticks; touch/pen wait 50 ms and give
  up after 3 moves (scroll); a global `pointerup` ends it; `onStop` commits once. Steppers
  `tabIndex=-1`, not `aria-hidden` ("touch screen readers should be able to use the buttons"),
  `focusableWhenDisabled`, disabled at the bound, `aria-label` "Increase"/"Decrease",
  user-select none; mouse focuses the input, touch/pen do not (BU#1528 stylus toggled the
  keyboard). BU#3887 (hold kept calling `onValueChange` at max), BU#5434 (hold continued
  after disable), BU#2588 (`onValueChange` twice per click), BU#2710 (open: option not to
  focus the input).

### Reka UI (`NumberField/NumberFieldRoot.vue`, `NumberFieldInput.vue`, `utils.ts`)

- `@internationalized/number`; `modelValue` updates on blur/Enter (Reka#1720 asks for live);
  `stepSnapping`, `allowInvalid` (Reka#2760, Base UI's `allowOutOfRange`), `startingValue`,
  `disableWheelChange` (wheel **on** by default) + `invertWheelChange`, `focusOnChange`.
  `getNextValue` aligns off-grid values to the grid in the step direction (Reka#2758).
  Input `role="spinbutton"`, `aria-roledescription`, `beforeinput` validation that **skips
  deletions and history** (from the unit-deletion bug class), composition tracked so the
  commit keydown is skipped.
- Problems: Reka#1385 (Enter submitted the previous value), Reka#2315 (tap opens the
  keyboard), Reka#2947 (touch scroll steps), Reka#2200 (open, iOS: the trigger becomes
  `disabled` between pointerdown and pointerup at the bound, so the click is lost).

### Kobalte (`number-field/*`, `spin-button/spin-button-root.tsx`)

- React Aria's model in Solid: `@internationalized/number`, `rawValue` + formatted value
  (KB#418 open: `onChange`/`onRawValueChange` inconsistencies), `role="spinbutton"` on the
  input with value attributes, assertive announcement of the value text, U+2212 minus.
  `VaryTrigger` steps by `step` — KB#470 (triggers ignored `step`), KB#451 (decimal step
  jumped to the next integer).

## Accessibility

- **Role.** APG and the Quantity example use `role="spinbutton"` on a text input; Zag, Reka
  and Kobalte do too. React Aria and Base UI drop the role and use a textbox with
  `aria-roledescription="Number field"`, because VoiceOver could not focus a spinbutton
  (RA comment) — our AT note records that iOS VO cannot focus `role=spinbutton` *segments*
  (cause J), and that `aria-roledescription` on form controls makes iOS VO drop "required"
  (webkit 221065, cause I) and caused RA#8503's hydration mismatch. Decision: `spinbutton`
  (value semantics are announced natively; no roledescription), with an iOS quirk entry
  (`ios-vo-spinbutton-input`) that renders a plain textbox on iOS until a device test shows
  VO focuses and edits a spinbutton input (Open question).
- **Value attributes.** `aria-valuenow` = the number (absent when empty), `aria-valuemin/max`
  only when the consumer set a bound (never ±`MAX_SAFE_INTEGER`, Zag), `aria-valuetext` =
  the formatted value through `messages.valueText`, with U+2212 for the minus and the
  accounting parentheses rewritten as a minus (RA#4160), `messages.empty` ("Empty") when
  empty. Updated in the same task as the key (cause G; invariant 16) — never blur/refocus.
- **Announcements.** Keys on a focused spinbutton: none of ours (the AT reads the value
  change; RA's assertive announcement on every change floods: RA#4157). Stepper presses
  from touch/virtual (focus is not on the input): one polite, keyed announcement of the
  value text (APG example; the key debounce leaves only the final value after a hold). A
  commit that rewrites what the user typed (clamped, snapped, re-parsed — RA#4967) announces
  the new value politely. Never assertive (accessibility.md §7.4).
- **Steppers.** `<button type="button" tabindex="-1">`, name `messages.increment` +
  `aria-labelledby="<self> <label>"` ("Increase Quantity", Label-in-Name kept),
  `aria-controls` → input, not `aria-hidden` (touch screen readers, BU comment). At a bound:
  `aria-disabled="true"`, never native `disabled` (RA#2119 focus stuck, Reka#2200 lost click),
  presses ignored. Press without focus (a11y-foundations): a mouse/pen press keeps or moves
  focus to the input; touch and virtual presses never move focus (no keyboard pops, VO
  cursor stays: RA comment, Reka#2315, BU#1528).
- **Keyboard** (APG): Up/Down, Shift+Up/Down and PageUp/PageDown (large step), Home/End only
  with a bound, otherwise native caret movement; Enter commits then lets implicit submission
  happen; every key IME-guarded (RA#6678, ZG#1507 full-width digits). No RTL flip (vertical
  keys). Wheel opt-in.
- **Mobile.** `inputMode` per platform (RA's table); iOS decimal keypads show the device
  region's separator (RA#5731, ark#3500): on touch platforms the typed separator is mapped
  to the field's decimal separator (quirk entry).
- **Forced colors / target size.** Stepper glyphs in `currentColor`, ≥ 24×24 CSS px hit area;
  the invalid state has a non-colour cue (Text Field's family).
- **Native.** A visible `type=number` is avoided (native-platform §8: wheel changes value, no
  formatting, `valueAsNumber` NaN mid-typing); a hidden `type=number` carries the form value
  and the range/step validity messages in the user's language (RA uses a detached one for
  messages; Base UI a hidden one).

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Zag | [ZG#3444](https://github.com/chakra-ui/zag/issues/3444) | Controlled parent clamps to 10, input shows "1000" | text rewritten only when the value changes; refusal changes nothing | open | refusal (`$reverted`) and `$sync` both rewrite the text from the value |
| Zag | [ZG#2712](https://github.com/chakra-ui/zag/issues/2712) | caret jumps to end while editing | reformatting every keystroke | fixed (record/restore cursor) | never reformat while typing; format on commit only |
| Zag | [ZG#2783](https://github.com/chakra-ui/zag/issues/2783) | 414% → 413.99999999999994 | float `×100` | answered: use string value | percent parsed in the string (NumberParser); values rounded to step/format precision |
| Zag | [ZG#1710](https://github.com/chakra-ui/zag/issues/1710) | after Enter, arrows stop working | Enter left the focused state | fixed | Enter is a commit, not a state change; model-tested |
| Zag | [ZG#2083](https://github.com/chakra-ui/zag/issues/2083) | backspace after a step not seen | React `onChange` skipped | switched to `onInput` | read the text from `input` events |
| Zag | [ZG#987](https://github.com/chakra-ui/zag/issues/987) | triggers dead on touch | mouse-only handlers | fixed | steppers go through press interactions |
| Zag | [ZG#2943](https://github.com/chakra-ui/zag/issues/2943) | `invalid` prop could not clear range error | out-of-range OR'ed in | fixed | invalid comes only from Field (controlled `invalid` first) |
| Ark | [ark#3500](https://github.com/chakra-ui/ark/issues/3500) | iOS keypad shows `,`, `en-US` field rejects it | keypad follows device region | closed (no fix) | map the keypad's decimal separator on touch platforms |
| Ark | [ark#1838](https://github.com/chakra-ui/ark/issues/1838) | fr-FR "10,50" + increment → "1 051,00 €" | stepped from mis-parsed text | fixed in Zag | step from the parsed text with the field's locale |
| Ark | [ark#1609](https://github.com/chakra-ui/ark/issues/1609) | wants no press-and-hold | always spins | `spinOnPress` | `spinOnPress` prop |
| RA | [RA#4157](https://github.com/adobe/react-spectrum/issues/4157) | holding Arrow announces ~23 stale values | assertive announce per change | closed | no announcement for keys; keyed coalescing for stepper presses |
| RA | [RA#4160](https://github.com/adobe/react-spectrum/issues/4160) | "($57.00)" not read as negative | accounting format | fixed | value text uses a minus sign |
| RA | [RA#4967](https://github.com/adobe/react-spectrum/issues/4967) | pasted "3,000,000.25" in de-DE becomes 3, silently | locale parse | closed (by design) | announce a commit that rewrote the text |
| RA | [RA#1893](https://github.com/adobe/react-spectrum/issues/1893) / [RA#9899](https://github.com/adobe/react-spectrum/issues/9899) | inline `formatOptions` resets typing every render | reference comparison | dup / fixed | compare format options by value |
| RA | [RA#9671](https://github.com/adobe/react-spectrum/issues/9671) | Enter submits stale value with form libraries | commit not flushed before submit | fixed | commit and hidden-input sync complete in the Enter keydown |
| RA | [RA#2802](https://github.com/adobe/react-spectrum/issues/2802) | Enter did not submit the form | Enter prevented | fixed | Enter commits, then implicit submission proceeds |
| RA | [RA#8503](https://github.com/adobe/react-spectrum/issues/8503) | hydration mismatch on iPhone | `inputMode` from UA during render | fixed | platform-dependent attributes applied after mount |
| RA | [RA#5731](https://github.com/adobe/react-spectrum/issues/5731) | iPhone keypad `,` vs `en-US` | device keypad | open | as ark#3500 |
| RA | [RA#2806](https://github.com/adobe/react-spectrum/issues/2806) | unit letters cannot be deleted | deletion validated as partial number | open | deletions and undo are never rejected |
| RA | [RA#5927](https://github.com/adobe/react-spectrum/issues/5927) | cannot delete "1" in "1,337" | ",337" invalid partial | closed | partial validity ignores group separators |
| RA | [RA#3862](https://github.com/adobe/react-spectrum/issues/3862) | "," alone shows garbage | parsed as Arabic numbering | fixed | unparseable commit restores the last value's text |
| RA | [RA#6861](https://github.com/adobe/react-spectrum/issues/6861) | `ar` locale breaks below 3 (plural unit literals) | literal set missed plural forms | closed; NumberParser now builds literals from plural forms | parser built from formatter parts incl. plurals |
| RA | [RA#6623](https://github.com/adobe/react-spectrum/issues/6623) | Hindi/Bengali digits ignored | numbering systems list | fixed (deva, beng) | test every numbering system we accept; Persian (arabext) too (BU#4718) |
| RA | [RA#6678](https://github.com/adobe/react-spectrum/issues/6678) | macOS Japanese IME input blocked | composition text filtered | closed (unclear) | no filtering during composition; parse full-width digits at commit |
| RA | [RA#8472](https://github.com/adobe/react-spectrum/issues/8472) | touch scroll on a stepper changes the value | step on press start | fixed | touch steps on release; `pointercancel` cancels |
| RA | [RA#2119](https://github.com/adobe/react-spectrum/issues/2119) | mobile focus stuck when a stepper becomes disabled | disabled button mid-press | fixed | `aria-disabled` at bounds |
| RA | [RA#4196](https://github.com/adobe/react-spectrum/issues/4196) / [RA#1792](https://github.com/adobe/react-spectrum/issues/1792) | wheel inverted on Windows; horizontal swipes step | `deltaY>0` increments; no axis check | partly | wheel up increases; dominant vertical axis only; opt-in |
| RA | [RA#9444](https://github.com/adobe/react-spectrum/issues/9444) | blur always clears server error | blur commit counted as change | closed | a commit that does not change the value reports nothing |
| RA | [RA#9946](https://github.com/adobe/react-spectrum/issues/9946) / [RA#9994](https://github.com/adobe/react-spectrum/issues/9994) | stepper click handlers/`data-pressed` lost at the bound | button disabled during the press (RA#9946 closed as intended: shadows the native rocker; RA#9994 fixed) | closed | bounds use `aria-disabled`; press ends normally |
| RA | [RA#6359](https://github.com/adobe/react-spectrum/issues/6359) | `min` 0.001 + step 1 adds 0.001 | grid based on min with min's precision | open | grid base and decimals as Slider (`min + k×step`, decimals of step and min) — documented |
| Base UI | [BU#5424](https://github.com/mui/base-ui/issues/5424) | shows "1.2.3", submits 12.3 | permissive own parser | open | one parser for filtering, parsing and display; text resyncs on commit |
| Base UI | [BU#4718](https://github.com/mui/base-ui/issues/4718) | Persian digits blocked | own parser | fixed | accept `arabext` digits |
| Base UI | [BU#5107](https://github.com/mui/base-ui/issues/5107) | `R$` currency not editable | per-character allow list | fixed | partial validity from the formatter's literals |
| Base UI | [BU#5420](https://github.com/mui/base-ui/issues/5420) | values with > 3 decimals rounded | Intl default `maximumFractionDigits: 3` | fixed | default display never rounds the value; explicit options do |
| Base UI | [BU#3887](https://github.com/mui/base-ui/issues/3887) | hold at max keeps calling `onValueChange` | tick did not detect no-op | fixed | spinning stops at the bound; no-op steps report nothing |
| Base UI | [BU#5434](https://github.com/mui/base-ui/issues/5434) | hold continues after disable | timer outlived the state | fixed | spinning is a state; disable exits it (`$sync:disabled`) |
| Base UI | [BU#2588](https://github.com/mui/base-ui/issues/2588) | `onValueChange` twice per click | pointerdown + click both stepped | fixed | exactly one step per activation (mouse steps on START, trailing click ignored) |
| Base UI | [BU#3574](https://github.com/mui/base-ui/issues/3574) | focus on `aria-hidden` hidden input blocked submit | validation focused the hidden input | fixed | hidden-form-input focus redirect to the visible input |
| Base UI | [BU#1528](https://github.com/mui/base-ui/issues/1528) | stylus press toggles iPad keyboard | pen treated as mouse | fixed | pen/touch/virtual presses never focus the input |
| Base UI | [BU#1845](https://github.com/mui/base-ui/issues/1845) | out-of-range money should be invalid, not clamped | clamping only | `allowOutOfRange` | `commitBehavior: "validate"` with native range validity |
| Base UI | [BU#5576](https://github.com/mui/base-ui/issues/5576) | first Tab places caret, later Tab selects all | programmatic caret | fixed | keyboard focus keeps native selection behaviour |
| Reka | [Reka#1385](https://github.com/unovue/reka-ui/issues/1385) | Enter submits previous value | commit only on blur | fixed | as RA#9671 |
| Reka | [Reka#2758](https://github.com/unovue/reka-ui/issues/2758) / [KB#451](https://github.com/kobaltedev/kobalte/issues/451) | off-grid value overshoots; decimal step jumps to integer | add-then-round | fixed | step to the next grid line in the step's direction |
| Reka | [Reka#2947](https://github.com/unovue/reka-ui/issues/2947) / [Reka#2315](https://github.com/unovue/reka-ui/issues/2315) | touch scroll steps; tap opens keyboard | press start + focusOnChange | fixed | as RA#8472 / BU#1528 |
| Reka | [Reka#2200](https://github.com/unovue/reka-ui/issues/2200) | iOS edge taps lost at bound | `disabled` set between down and up | open | as RA#9946 |

## Known pitfalls

- **Two values.** The text and the number diverge while typing; every library that rewrote the
  text on each keystroke broke the caret (ZG#2712) and every one that synced the number on each
  keystroke broke controlled refusal (ZG#3444) or emitted surprising clamped values (Base UI
  needs `allowOutOfRange` for typing). One model: the text is free while typing (filtered),
  the number changes at commit points.
- **Commit before submit**: Enter (RA#9671, Reka#1385) and `form.requestSubmit()` from
  `onValueCommit` must see the new hidden-input value.
- **Parser bugs are endless** (Base UI's list; RA's ~15 NumberParser issues). Do not write a
  parser twice.
- **Steppers mid-press at a bound** (RA#2119, RA#9946, Reka#2200): never native-disable.
- **Touch**: scroll vs press (RA#8472), keyboard popping (Reka#2315), stylus (BU#1528),
  context menu during hold.
- **Inline `formatOptions`** (RA#1893): compare by value.
- **SSR**: platform `inputMode` (RA#8503); server and client locales may differ (Base UI
  suppresses the input's hydration warning).

## Testing notes

- jsdom lacks `beforeinput`-driven editing, IME and wheel; the parser and every step rule are
  node tests over the machine; filtering is a pure function tested per locale (en-US, de-DE,
  fr-FR, de-CH, ar-EG `arab`, fa-IR `arabext`, hi-IN `deva`, bn-BD, ja-JP full-width,
  pt-BR `R$`, percent, units incl. plural forms, accounting).
- Press-and-hold uses fake timers (scheduler delays); touch cancel uses a `pointercancel` step.
- Driver needs: `type`, `fill` + commit, `step`, `toEdge`, `pressStepper`, `holdStepper(ms)`
  (pointer, with the time-advance of the adapter; keyboard twin = repeated ArrowUp), `wheel`
  (pointer; twin ArrowUp), queries `value`, `text`, `valueText`, `formValue`, `canIncrement`.
- Invariants: `aria-valuenow` = oracle value; hidden input value = `String(value)` or "";
  stepper `aria-disabled` ⇔ at bound; no focus move on touch presses; one `onValueChange` per
  activation; announcements only where specified.

## Decisions

- **Parts**: `Root` (a Field when not inside one, as Text Field), `Label`, `Description`,
  `ErrorMessage`, `Control` (styling wrapper, no role), `Input`, `IncrementTrigger`,
  `DecrementTrigger`; hidden `<input type="number">` rendered automatically
  (`hidden-form-input`). No ScrubArea, no ValueText (non-goals).
- **Value**: `value: number | null` controllable; `onValueChange` for each applied change
  (steps, edges, wheel ticks, commits, paste-replace, reset); `onValueCommit` once at the end
  of each interaction (key press, stepper release, wheel tick, blur/Enter commit that
  changed something); `onInputValueChange(text)` while typing. Typing never changes `value`.
- **Commit**: blur and Enter parse the text with the locale; empty → `null`; unparseable →
  the last value's text is restored; `commitBehavior: "snap"` (default: clamp + snap) or
  `"validate"` (keep, let Field show range/step errors). Steps always clamp and snap.
- **Machine states**: `idle`, `composing`, `pressing` (a stepper held, before spinning),
  `spinning`; delayed transitions `spinDelay` (400 ms mouse/pen, 600 ms touch) and
  `spinInterval` (60 ms) through the scheduler. Focus, dirty text and the pressed trigger in
  context.
- **Parsing/formatting**: `@internationalized/number` (`NumberParser`, `NumberFormatter`),
  the library React Aria, Zag, Reka and Kobalte all use — new runtime dependency, needs a
  decision record (0009) before implementation; `arabext` normalisation added on top.
- **`data-*`**: `data-disabled`, `data-readonly`, Field validation attributes,
  `data-focus`, `data-focus-visible`, `data-spinning`, `data-composing`; triggers add
  `data-disabled` at a bound and `data-pressed`.
- **Contract**: locate by role `spinbutton` (textbox under the iOS quirk) + name; traits
  `valued`, `form-associated`, `field-associated`.
- **Deliberately different**: spinbutton role without roledescription (APG; RA/Base UI drop
  it); no announcement on keys (RA's assertive flood); value changes only at commit points
  (RA) but with Base UI's live `onInputValueChange`; wheel opt-in and "up increases" (Base
  UI/Zag; RA/Reka default on); `aria-disabled` steppers at bounds (APG), never `disabled`.

## Open questions

- Does iOS VoiceOver focus and edit an `<input role="spinbutton">` (iOS 27)? If yes, drop the
  `ios-vo-spinbutton-input` quirk.
- Should the device-locale decimal mapping also apply on desktop when the field locale's
  group separator equals the device's decimal (a German user in an `en-US` field typing
  "1,5")? Left out: ambiguous (RA#5731 discussion).
- A scrub area (Base UI, Zag) — later, with a keyboard twin.
