# Pin Input — research

Status: done · Wave: 2 (Pin Input in Ark/Zag, Reka, Bits UI; OTP Field in Radix and Base UI;
`input-otp`, which shadcn's InputOTP wraps, studied as the single-input reference)

Read [text-field.md](text-field.md) and [field.md](field.md) first: Pin Input is a
`field-control` whose Root acts as a Field. Cross-cutting: [accessibility.md](accessibility.md)
§1.1 (3.3.8 Accessible Authentication: paste and password managers must work), §6 (IME guard),
§10 (visually hidden); [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
(no pattern-specific entry; causes A and J apply to slot focus moves);
[native-platform.md](native-platform.md) §14 (hidden native inputs). Reado does not use it today.

## Pattern

- No APG pattern (accessibility.md §1.5: "group of textboxes"). The relevant platform
  features: `autocomplete="one-time-code"` (iOS/macOS Safari "From Messages" suggestion, Chrome
  on Android SMS suggestion, password-manager TOTP fill), `inputmode="numeric"`, the WebOTP API
  (Chromium Android; consumer-side), `maxlength`/`pattern` constraints, native paste, undo,
  IME and caret editing — all of which exist **for one input**.
- WCAG 3.3.8 (AA): the code must be pasteable and fillable; 2.2.1 (codes that expire are the
  consumer's); 1.3.5 (purpose `one-time-code`); 4.1.2 (one control, one name).

## How the others built it

### Ark UI / Zag (`zag/packages/machines/pin-input/src/*`)

- One `<input>` per slot (`tel` for numeric, `password` with `mask`), roving `tabIndex`
  (focusable index = first empty), hidden `<input>` with `name`, `minLength`/`maxLength`
  and a `pattern` ("`minLength` is skipped for script-set values, so `pattern` enforces
  completeness"). Each slot `aria-label` = `translations.inputLabel(i, n)`; `autoComplete`
  `one-time-code` only with `otp`; `placeholder` "○". Machine `idle`/`focused`, events
  `INPUT.CHANGE`, `INPUT.PASTE`, `INPUT.BACKSPACE` (shifts later chars left), arrows,
  `INPUT.ENTER` → `requestSubmit`; `onValueComplete`, `autoSubmit`, `blurOnComplete`,
  `selectOnFocus`, `sanitizeValue`; a slot change with more than two characters is treated as
  a paste (autofill into one slot).
- Problems: ZG#2118 / ZG#2315 (iOS SMS autofill wrote the wrong digits into the last slot),
  ZG#3381 (Enter swallowed when incomplete, blocking native validation), ZG#908/ZG#512/ZG#84
  (two characters in one slot), ZG#470 (paste into a non-empty slot truncated), ZG#2999 (tap
  on any empty slot should focus the first empty one), ZG#2722 (⌘⌫ wrote "undefined"),
  ZG#3020 (same character twice crashed), ZG#294 (mobile IME/autocorrect left slots empty),
  ZG#1507 (full-width digits from a Japanese IME), ark#3573 (controlled `undefined` kept the
  old value).

### Radix (`one-time-password-field/src/one-time-password-field.tsx`)

- One input per slot inside a `role="group"` with roving focus; slots beyond the first empty
  one are not focusable (no holes); `autoComplete="one-time-code"` and `maxLength = size`
  **only on the current tab stop**, every other slot gets `autoComplete="off"` plus
  `data-1p-ignore`, `data-lpignore`, `data-protonpass-ignore`, `data-bwignore`; a value longer
  than one character in a slot is handled as a paste ("Password managers may try to insert
  the code into a single input"); hidden `type=hidden` input for the form; `validationType`
  numeric/alpha/alphanumeric/none; `autoSubmit` → `requestSubmit`; slot name
  "Character N of M" (hard-coded English); select-on-focus; Enter submits.
- Problems: radix#3641 (Chrome on iOS fills only the first character), radix#3550 (paste
  beyond length not truncated), radix#3545 (`disabled` not applied to slots), radix#3493
  (`type="password"` ignored), radix#3709 (values lost, Backspace/Tab broken).

### Base UI (`otp-field/root/OTPFieldRoot.tsx`, `input/OTPFieldInput.tsx`)

- One input per slot (`CompositeList`), `role="group"` root labelled by the Field label; the
  first slot is labelled by the label, later slots only by a consumer `aria-label` (dev
  warning when the first gets one); `autoComplete` and `maxLength = length` on the first slot
  only ("to avoid password manager bubbles appearing after later inputs"); `enterKeyHint`
  next/done; a hidden validation input with `autoComplete`, `minLength`/`maxLength`/`pattern`,
  that also receives autofill. Composition buffered (BU#5091: Safari IME duplicated
  characters). `onValueComplete` also for a paste replacing a complete value (BU#4679);
  `onValueInvalid` for rejected characters; `normalizeValue` (BU#4608 uppercase).
- Problems: BU#5088 (autoSubmit's pending focus overrode Form's focus on the first invalid
  field), BU#4805 / BU#4828 (hidden input accepted autofill while read-only/disabled), BU#5301
  (VO did not read the root's description — an old macOS).

### Reka UI (`PinInput/PinInputRoot.vue`, `PinInputInput.vue`)

- Multiple inputs, `aria-label` "pin input N of M", `otp` → `one-time-code`, `mask`,
  `type` text/number. Problems: Reka#2943 (OTP mode trapped Tab), Reka#2210 (password
  manager autofill does not fill — works on shadcn's single-input version), Reka#743
  (Android clipboard paste wrong), Reka#2355 (holes: typing into a later empty slot; asks for
  sequential fill), Reka#2375/#2266/#1516 (placeholders after clear/reset), Reka#1960
  (`type=number` slots).

### Bits UI (`pin-input/pin-input.svelte.ts`, `usePasswordManager.svelte.ts`) and `input-otp`

- A port of `input-otp`: **one** real `<input>` overlaying presentational cells
  (`pointer-events: none` on the cells, the input `position:absolute; inset:0`, transparent
  text and caret, `letter-spacing:-.5em`, monospace, injected `<style>` for `::selection` and
  `:autofill`), selection mirrored from `selectionchange` into `isActive`/`hasFakeCaret` per
  cell, a single-character selection forced so typing replaces, `onComplete`,
  `pushPasswordManagerStrategy` widening the input so a password-manager badge does not
  cover the last cell, `pattern` regex (`REGEXP_ONLY_DIGITS`), `pasteTransformer`.
- Problems: bits-ui#1053 (Safari SMS autofill ignored the *hidden* input — fixed by making
  the real input the visible one), bits-ui#826 (pattern hid instead of rejecting keys),
  bits-ui#867 (Ctrl+V ignored), bits-ui#1869 (arrow/overwrite broken after 3 characters).
  `input-otp`'s own tracker: input-otp#32 (open, "limitations caused by core
  implementation": iOS selection always visible, no per-slot click, letter-spacing hacks),
  input-otp#31 and #62 (clicking a slot puts the caret at a relative x position; cannot edit
  the middle on Android), input-otp#110/#75 (iOS gray bar), input-otp#30 (1Password button
  over the last digit), input-otp#152 (open: Bitwarden inline TOTP fill does nothing),
  input-otp#92 (Dashlane cannot fill), input-otp#53/#99 ("XXX-XXX" and spaces in pastes),
  input-otp#6 (mobile paste).

## Accessibility

- **One field vs N fields.** With N inputs a screen reader announces N edit fields ("Character
  1 of 6, edit text" × 6, names hard-coded in English in Radix, consumer-supplied or missing
  in Base UI), focus jumps after every character (each jump re-announces), Tab order needs
  roving fixes (Reka#2943), and a user who leaves focus in a later slot creates holes
  (Reka#2355). With one input the SR announces "Verification code, edit text", reads the
  code back as text, and every native editing command works. Decision: **one native input**
  (input-otp/Bits model); the slots are `aria-hidden` presentation.
- **Autofill and paste (3.3.8).** Multi-input implementations needed per-slot heuristics and
  still broke: ZG#2118/#2315 (iOS SMS), radix#3641 (Chrome iOS), Reka#2210 (password
  managers), bits-ui#1053 (a hidden autofill input is ignored by Safari). One visible,
  focused input with `autocomplete="one-time-code"` and `maxlength` is what platforms expect.
  Script fills that set `.value` and dispatch `input` (Bitwarden, input-otp#152) must be read
  from the native `input` event, not from React's value tracker (which swallows them).
- **Name/description**: the Field Label names the input (`<label for>`), Description and
  ErrorMessage describe it; no per-slot names; no `role="group"`.
- **Masked**: `type="password"` (SR speaks "dot"/"bullet" per character).
- **IME**: no filtering during composition; full-width digits normalised (NFKC) at
  `compositionend` (ZG#1507, BU#5091).
- **Direction**: codes are left-to-right; Root and Input default to `dir="ltr"` so slot `i`
  shows character `i` in RTL pages (a flex row of slots would otherwise run right to left).
- **Forced colors / target**: slots draw borders in `CanvasText`, the active slot an outline
  in `Highlight`; the whole control is the hit target (≥ 24 px tall).
- **Visual focus**: the fake caret and active slot come from `data-*`; the real caret and
  selection highlight are transparent (injected style, CSP nonce).

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Zag | [ZG#2118](https://github.com/chakra-ui/zag/issues/2118) | iOS SMS fill writes 534415 for 534418 | code inserted into one slot, redistributed | closed | one input receives the whole code |
| Zag | [ZG#2315](https://github.com/chakra-ui/zag/issues/2315) | SMS autofill misses the last slot | same | closed | same |
| Zag | [ZG#3381](https://github.com/chakra-ui/zag/issues/3381) | Enter does nothing when incomplete | `preventDefault` on Enter | closed | Enter is native implicit submission; validity blocks |
| Zag | [ZG#908](https://github.com/chakra-ui/zag/issues/908) / [ZG#512](https://github.com/chakra-ui/zag/issues/512) | two characters in one slot | fast keys across slot focus moves | fixed | no per-slot inputs; `maxlength` on one input |
| Zag | [ZG#470](https://github.com/chakra-ui/zag/issues/470) | paste into a filled slot truncates | paste anchored at the slot | fixed | a paste of ≥ length characters replaces the whole value |
| Zag | [ZG#2999](https://github.com/chakra-ui/zag/issues/2999) | tapping an empty slot should go to the first empty | focus followed the tap | fixed | a press past the value puts the caret at the end of the value |
| Zag | [ZG#2722](https://github.com/chakra-ui/zag/issues/2722) | ⌘⌫ writes "undefined" | unhandled delete inputTypes | fixed | native deletion on one input; never reject deletions |
| Zag | [ZG#3020](https://github.com/chakra-ui/zag/issues/3020) | same digit twice crashes | diff of old/new slot text | fixed | typing the character already at the caret advances the caret |
| Zag | [ZG#1507](https://github.com/chakra-ui/zag/issues/1507) | full-width digits accepted | IME text not filtered | closed (retracted) | sanitise at `compositionend`, normalise to ASCII |
| Zag | [ZG#294](https://github.com/chakra-ui/zag/issues/294) | mobile keyboard leaves slots empty | autocorrect/composition in slots | closed | `autocorrect=off`, composition-aware |
| Ark | [ark#3573](https://github.com/chakra-ui/ark/issues/3573) | controlled `undefined` keeps old value; `[]` shows "undefined" | array value model | closed | string value; `null`/`undefined` → "" |
| Radix | [radix#3641](https://github.com/radix-ui/primitives/issues/3641) | Chrome iOS fills only the first character | `maxLength=1` on the filled slot | closed | one input with `maxlength=length` |
| Radix | [radix#3550](https://github.com/radix-ui/primitives/issues/3550) | paste beyond length kept | no truncation | closed | truncate to `length` after sanitising |
| Radix | [radix#3545](https://github.com/radix-ui/primitives/issues/3545) | `disabled` does not disable slots | prop not passed | closed | Field state reaches the one input (`field-control`) |
| Radix | [radix#3493](https://github.com/radix-ui/primitives/issues/3493) | `type="password"` ignored | prop on root not input | closed | `mask` sets the input's `type` |
| Radix | [radix#3709](https://github.com/radix-ui/primitives/issues/3709) | values lost, Tab/Backspace broken | multi-input sync | closed (unanswered) | native editing |
| Base UI | [BU#5091](https://github.com/mui/base-ui/issues/5091) | Safari IME types "dddddd" for "ddd" | accumulating composition text committed per input | fixed | do nothing until `compositionend` |
| Base UI | [BU#4679](https://github.com/mui/base-ui/issues/4679) | no `onValueComplete` for a paste replacing a complete value | "became complete" diff | fixed | complete fires for every user change that leaves the value complete and different, and for any complete paste |
| Base UI | [BU#5088](https://github.com/mui/base-ui/issues/5088) | autoSubmit keeps focus on the last slot when the form is invalid | slot focus after `requestSubmit` | fixed | after `requestSubmit` the component never moves focus |
| Base UI | [BU#4805](https://github.com/mui/base-ui/issues/4805) / [BU#4828](https://github.com/mui/base-ui/issues/4828) | read-only/disabled field changed by autofill | hidden input accepted changes | fixed | read-only and disabled are native attributes on the one input |
| Base UI | [BU#4608](https://github.com/mui/base-ui/issues/4608) | uppercase-only codes | no normaliser | `normalizeValue` | `sanitize(text)` hook |
| Reka | [Reka#2943](https://github.com/unovue/reka-ui/issues/2943) | Tab trapped in OTP mode | slot focus logic | closed | one tab stop |
| Reka | [Reka#2210](https://github.com/unovue/reka-ui/issues/2210) | password manager fills nothing | multi-input | closed (works with single-input shadcn) | single input |
| Reka | [Reka#2355](https://github.com/unovue/reka-ui/issues/2355) | holes like `_ _ 3 4` | free slot focus | feature | contiguous value by construction |
| Reka | [Reka#743](https://github.com/unovue/reka-ui/issues/743) | Android clipboard pastes wrong | paste distribution | closed | native paste + sanitise |
| Reka | [Reka#1516](https://github.com/unovue/reka-ui/issues/1516) | placeholders gone after reset | per-slot placeholder state | closed | placeholder is slot rendering from `data-*` |
| Bits | [bits-ui#1053](https://github.com/huntabyte/bits-ui/issues/1053) | Safari SMS fill ignored | autofill target was a hidden input | fixed (real input visible) | the autofill target is the focused, visible input |
| Bits | [bits-ui#826](https://github.com/huntabyte/bits-ui/issues/826) | disallowed keys typed then hidden | filter after input | closed | reject in `beforeinput` |
| Bits | [bits-ui#867](https://github.com/huntabyte/bits-ui/issues/867) | Ctrl+V ignored | key filter ignored Ctrl | fixed | never filter keydown; filter insertions |
| Bits | [bits-ui#1869](https://github.com/huntabyte/bits-ui/issues/1869) | overwrite inserts and shifts | selection normalisation | closed | replace-at-caret computed by one pure function |
| input-otp | [input-otp#32](https://github.com/guilhermerodz/input-otp/issues/32) | iOS selection visible, no per-slot click | transparent text with letter-spacing hacks | open (by design) | map presses to slots by slot geometry; collapsed caret only |
| input-otp | [input-otp#31](https://github.com/guilhermerodz/input-otp/issues/31) / [#62](https://github.com/guilhermerodz/input-otp/issues/62) | clicking a slot moves the caret elsewhere; cannot edit the middle on Android | caret from x position in squeezed text | closed (wontfix) | caret set to the pressed slot index |
| input-otp | [input-otp#152](https://github.com/guilhermerodz/input-otp/issues/152) | Bitwarden inline TOTP fill does nothing | script `.value` + `input` swallowed by React tracker | open | listen to the native `input` event |
| input-otp | [input-otp#30](https://github.com/guilhermerodz/input-otp/issues/30) | 1Password button covers the last digit | badge inside the input box | fixed (push strategy) | theme reserves inline-end space (`--rind-pin-input-badge-space`) |
| input-otp | [input-otp#53](https://github.com/guilhermerodz/input-otp/issues/53) / [#99](https://github.com/guilhermerodz/input-otp/issues/99) | "123-456", " 123456 " rejected | pattern tested on raw paste | fixed | strip whitespace and `-`/`.` before validating |

## Known pitfalls

- Every multi-input implementation re-implements paste, autofill, Backspace across slots,
  focus advance, select-on-focus and holes, and each has bugs in each.
- The single-input overlay has visual costs (input-otp#32): iOS may still draw selection
  handles and a caret line; mitigated by never creating a non-collapsed selection
  programmatically and by transparent caret colour; documented.
- `minlength` is not checked for script-set values (Zag comment) → completeness through
  `pattern`.
- React value tracker swallows script fills (input-otp#152) → native listener.
- Autofill background (`:-webkit-autofill`) paints over the overlay → injected rule.
- autoSubmit and Form focus order (BU#5088).

## Testing notes

- Model tests drive one textbox: type, paste (adapter clipboard), Backspace, Delete, Home/End
  and arrows (caret), `compose`, `pressSlot` (needs layout: pointer step on a slot's box;
  jsdom rejects; keyboard twin: arrow keys to the index), script fill (`fill` via setter +
  `input` event, the password-manager path).
- Invariants: input value = oracle value; `data-filled` on exactly the first `value.length`
  slots; exactly one `data-active` slot while focused; `aria-hidden` on every slot; one
  textbox; `onValueComplete` count = oracle's complete transitions.

## Decisions

- **Parts**: `Root` (a Field when not inside one), `Label`, `Description`, `ErrorMessage`,
  `Control` (positioning context for the overlay), `Input` (the one native input, overlay),
  `Slot` (`index`, `aria-hidden`, shows the character, a mask character or nothing).
- **Value**: string, controllable; `onValueChange`, `onValueComplete(value)`, `autoSubmit`.
  Contiguous by construction; at most `length` characters.
- **Filtering**: `validationType` `"numeric"` (default) | `"alphanumeric"` | `"alpha"`, or a
  `pattern` RegExp for one character; `sanitize(text)` before validation; insertions
  rejected in `beforeinput`, deletions never; pastes stripped of whitespace, `-` and `.`
  then truncated.
- **Caret model**: collapsed caret only; typing at a caret before a filled slot replaces
  that character (handled in `beforeinput`); a press on slot `i` sets the caret to
  `min(i, value.length)`.
- **Machine**: states `idle`, `composing`; events `INPUT`, `CARET`, `SLOT.PRESS`,
  `COMPOSITION.START/END`, `FOCUS`, `BLUR`, `RESET`, `$sync:value`, `$reverted`.
- **Form**: the input is the form control (`name`, `required`, `maxlength`, anchored
  `pattern` with the length); no hidden input.
- **`data-*`**: root `data-complete`, `data-focus`, `data-focus-visible`, Field
  attributes; slot `data-index`, `data-filled`, `data-active`, `data-caret`, `data-masked`.
- **Contract**: role `textbox` + name; traits `field-associated`.
- **Deliberately different**: one input (input-otp/Bits) rather than N (Zag, Radix, Base UI,
  Reka), but slots are pressed by geometry (fixes input-otp#31/#62) and no letter-spacing
  hacks; Enter never prevented; `dir="ltr"` default.

## Open questions

- WebOTP (`navigator.credentials.get({ otp })`) helper: a docs recipe for now.
- Does iOS 27 still draw the selection handles over a transparent input with a collapsed
  caret? Device check in the manual protocol.
