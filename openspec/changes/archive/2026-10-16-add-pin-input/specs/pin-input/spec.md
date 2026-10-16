## Purpose

Defines rind-ui's Pin Input: a fixed-length code (verification code, PIN) entered in one
native text input rendered over presentational slots, so typing, paste, SMS and
password-manager autofill, IME and screen readers all work as they do for one native field.
Introduced by `add-pin-input`.

## ADDED Requirements

### Requirement: Anatomy

The Pin Input SHALL consist of a `root` part (`div`), the Field parts `label`, `description`
and `error-message`, a `control` part (`div`) that is the positioning context, exactly one
`input` part (`<input>`), and one `slot` part (`div`) per position, each with an `index` from
0 to `length - 1`. The input SHALL cover the control (absolutely positioned over the slots)
and receive every pointer event; slots SHALL have `aria-hidden="true"` and no pointer events.
When the Root is not inside a Field it SHALL act as one, as Text Field's Root does. A `length`
that is not a positive integer, or a number of rendered slots different from `length`, SHALL
produce a development warning naming both numbers.

#### Scenario: One textbox

- **WHEN** a Pin Input with `length={6}`, a Label "Verification code" and six Slots is rendered
- **THEN** exactly one element has role `textbox`, its accessible name is "Verification code",
  no slot is exposed to assistive technology, and the Tab key stops on it once

#### Scenario: Slot count mismatch

- **WHEN** `length={6}` is set and five Slots are rendered
- **THEN** a development warning names 6 and 5

### Requirement: Value

The Pin Input SHALL have a controllable string `value` (`value` / `defaultValue` default "" /
`onValueChange(value, details)`, reasons `INPUT`, `PASTE`, `AUTOFILL`, `RESET`), at most
`length` characters long, always contiguous from the first slot. `null` and `undefined`
SHALL render as an empty value. A controlled value that is longer than `length` or contains
rejected characters SHALL be normalised for rendering with a development warning.

#### Scenario: Controlled clear (ark#3573)

- **WHEN** a controlled Pin Input showing "123" receives `value={undefined}`
- **THEN** the input is empty and every slot is unfilled

#### Scenario: No holes (reka-ui#2355)

- **WHEN** the user presses the fifth slot of an empty Pin Input and types "7"
- **THEN** the value is "7" and it is shown in the first slot

### Requirement: Character Filtering

The accepted characters SHALL be set by `validationType`: `"numeric"` (default, ASCII digits),
`"alphanumeric"` (ASCII letters and digits), `"alpha"` (ASCII letters), or a `pattern` that a
single character must match. Before filtering, text SHALL be normalised with Unicode NFKC (so
full-width digits become ASCII) and passed through the consumer's `sanitize(text)` (for
example uppercasing). An insertion containing a rejected character SHALL be refused before it
is applied (`beforeinput`), leaving the value and caret unchanged, and SHALL call
`onValueInvalid(text)`. Deletions, cuts, undo and redo SHALL never be refused. Keyboard
shortcuts (Ctrl/⌘ combinations) SHALL never be blocked.

#### Scenario: Letters refused (bits-ui#826)

- **WHEN** the user types "&" into a numeric Pin Input
- **THEN** no character is added and `onValueInvalid("&")` is called

#### Scenario: Keyboard paste (bits-ui#867)

- **WHEN** the user presses Ctrl+V with "123456" on the clipboard
- **THEN** the value is "123456"

#### Scenario: Uppercase codes (base-ui#4608)

- **WHEN** `validationType="alphanumeric"` and `sanitize={(t) => t.toUpperCase()}` are set and
  the user types "a"
- **THEN** the value is "A"

### Requirement: Paste And Autofill

A paste, drop, or a value written into the input by the browser or a password manager SHALL
be normalised: whitespace, `-` and `.` removed, characters filtered, then truncated to
`length`. When the normalised text is at least `length` characters long it SHALL replace the
whole value; otherwise it SHALL be inserted at the caret, replacing the selection, and the
result truncated to `length`. A value written by script followed by an `input` event (password
managers) SHALL be read from the native event and applied. The caret SHALL end after the last
filled slot.

#### Scenario: Paste with a separator (input-otp#53)

- **WHEN** "123-456" is pasted into an empty six-character Pin Input
- **THEN** the value is "123456"

#### Scenario: Paste longer than length (radix#3550)

- **WHEN** "12345678" is pasted into a six-character Pin Input
- **THEN** the value is "123456"

#### Scenario: Full paste replaces (zag#470)

- **WHEN** a Pin Input showing "12" with the caret after "1" receives a paste of "987654"
- **THEN** the value is "987654"

#### Scenario: SMS autofill (zag#2118, radix#3641)

- **WHEN** iOS Safari or Chrome on iOS fills "534418" from a message into the focused input
- **THEN** the value is exactly "534418"

#### Scenario: Password manager fills by script (input-otp#152)

- **WHEN** a script sets the input's `value` to "246810" and dispatches a bubbling `input` event
- **THEN** `onValueChange("246810", { reason: "AUTOFILL" })` is called and the slots show it

### Requirement: Caret And Slots

The Pin Input SHALL keep a collapsed caret at an index between 0 and the value's length, and
SHALL NOT create a non-collapsed selection itself. Typing a character with the caret before
a filled slot SHALL replace that slot's character and move the caret forward; typing the
character the slot already holds SHALL only move the caret forward (zag#3020); typing with
the caret at the value's end SHALL append while the value is shorter than `length`. A pointer
or touch press on the input SHALL place the caret at the slot under the press, by slot
geometry, clamped to the value's length; a press past the value SHALL place the caret at its
end (zag#2999). Backspace, Delete, ⌘/Ctrl+Backspace and arrow keys SHALL keep their native
behaviour on the one input. The active slot SHALL be the slot at the caret, or the last slot
when the value is full.

#### Scenario: Press a filled slot (input-otp#31, input-otp#62)

- **WHEN** the value is "12345" and the user presses the second slot and types "9"
- **THEN** the value is "19345" and the active slot is the third

#### Scenario: Two keys at once (zag#908)

- **WHEN** two digit keys are pressed in the same frame into an empty Pin Input
- **THEN** each digit is in its own slot, in order

#### Scenario: Delete to start (zag#2722)

- **WHEN** the value is "1234" with the caret at the end and the user presses ⌘+Backspace on macOS
- **THEN** the value is "" and no slot shows text or carries `data-filled`

### Requirement: Composition

While a composition is in progress the Pin Input SHALL NOT filter, write or complete; at
`compositionend` it SHALL normalise and filter the committed text once and apply it as an
insertion.

#### Scenario: Safari IME (base-ui#5091)

- **WHEN** an alphanumeric Pin Input receives "d" three times through an active IME in Safari
- **THEN** the value is "ddd"

#### Scenario: Full-width digits (zag#1507)

- **WHEN** a numeric Pin Input receives "１２３" from a Japanese IME
- **THEN** the value is "123"

### Requirement: Completion

`onValueComplete(value)` SHALL be called when a user change (typing, paste, autofill)
leaves the value with `length` characters and either the previous value was shorter or the
change was a paste or autofill (base-ui#4679). With `autoSubmit`, the input's form SHALL then
be submitted with `requestSubmit()`; the Pin Input SHALL NOT move focus afterwards, so the
form's own invalid-field focus wins (base-ui#5088). A controlled change by the parent and a
reset SHALL NOT complete.

#### Scenario: Replace a complete code by paste (base-ui#4679)

- **WHEN** a complete "111111" is replaced by pasting "222222"
- **THEN** `onValueComplete("222222")` is called

#### Scenario: Auto submit with another invalid field (base-ui#5088)

- **WHEN** a form has an empty required Email field before an `autoSubmit` Pin Input and the
  user pastes a full code
- **THEN** submission is blocked and focus is on the Email field

### Requirement: Keyboard And Enter

The Pin Input SHALL NOT prevent Enter: in a form, Enter performs implicit submission, so an
incomplete required code shows the native validation message. Enter, Backspace and
characters marked `composing` SHALL follow `keyboard-interactions`' IME guard: a key an IME
owns never moves the active slot. Focus SHALL land on the collapsed caret (a Tab focus does
not leave the native select-all).

#### Scenario: Enter when incomplete (zag#3381)

- **WHEN** a required six-character Pin Input holding "123" in a form with a submit button
  receives Enter
- **THEN** a submit attempt happens, is blocked by validation, and the Field displays the error

### Requirement: Input Attributes

The input SHALL carry `type="text"` (or `"password"` with `mask`), `autoComplete`
(`"one-time-code"` by default, `"off"` or any consumer value), `inputMode` `"numeric"` for
numeric codes and `"text"` otherwise, `maxLength={length}`, an anchored `pattern` requiring
exactly `length` accepted characters, `autoCapitalize="none"` (unless `sanitize` uppercases),
`autoCorrect="off"`, `spellCheck="false"`, `enterKeyHint` as given, and `dir="ltr"` on the Root,
the control and the input unless the consumer sets `dir`. The overlay input's text, caret and
selection highlight SHALL be transparent and its autofill paint suppressed (injected style
with the environment's CSP nonce), so only the slots are visible. The framework SHALL never
rewrite the input's text while an IME composes (it would cancel the composition): the value
is rendered as the default and synced between compositions.

#### Scenario: Right-to-left page

- **WHEN** a Pin Input holding "12" is rendered inside `dir="rtl"`
- **THEN** "1" is shown in the first (leftmost) slot

#### Scenario: Masked

- **WHEN** `mask` is set and the value is "42"
- **THEN** the input's `type` is `password` and the first two slots carry `data-masked`

### Requirement: Disabled And Read-Only

Disabled SHALL render the native `disabled` on the input (no focus, no autofill, no
submission); read-only SHALL render native `readOnly`, keep focus and caret movement, and
refuse every change, including autofill and paste.

#### Scenario: Read-only autofill (base-ui#4805, base-ui#4828)

- **WHEN** a password manager writes "999999" into a read-only Pin Input inside a Field showing
  a server error
- **THEN** the value is unchanged, the input is re-synced to it, and the error is still shown

### Requirement: Form And Field Integration

The input SHALL be the form control: it carries `name`, `form` and `required`, and its native
validity (`valueMissing`, `patternMismatch` when incomplete) is the Field's validity. The Pin
Input SHALL implement `field-control` with the input as the focusable, labelable element and
the validity element, report each applied change, and declare the `field-associated` trait.
A form reset SHALL restore the current `defaultValue` with reason `RESET`.

#### Scenario: Incomplete code on submit

- **WHEN** a required Pin Input holding "123" (length 6) with an ErrorMessage is submitted
- **THEN** submission is blocked, the input is focused with `data-focus-visible`, and the
  ErrorMessage shows the browser's pattern message or `messages.patternMismatch` if overridden

#### Scenario: Disabled through the Field (radix#3545)

- **WHEN** a Pin Input inside a disabled Field is rendered
- **THEN** the input is natively disabled and every slot carries `data-disabled`

### Requirement: Data Attributes

Every part SHALL carry `data-scope="pin-input"`, its `data-part` and `data-instance`, and the
Field state attributes. Root, Control and Input SHALL carry `data-focus`, `data-focus-visible`,
`data-complete` when the value has `length` characters, and `data-composing`. Each slot SHALL
carry `data-index`, `data-filled` when it holds a character, `data-active` when the input is
focused and the slot is the active slot, `data-caret` when it is active and empty,
`data-masked` with `mask`, and `data-disabled`. A slot's content SHALL be its character, or
the mask character (`maskChar`, default "•") with `mask`, or nothing. `data-variant` and
`data-size` SHALL pass through untouched.

#### Scenario: Active slot

- **WHEN** the focused input holds "12" with the caret at the end
- **THEN** slots 0 and 1 carry `data-filled`, slot 2 carries `data-active` and `data-caret`,
  and no other slot carries `data-active`

### Requirement: Messages

The Pin Input SHALL take a typed `messages` object; it sets no accessible strings of its own
(its name comes from the Field Label), and declares overrides per validity key through the
Field (`valueMissing`, `patternMismatch`).

#### Scenario: Localised incomplete message

- **WHEN** the Field's `messages.patternMismatch` is "Inserisci 6 cifre" and an incomplete code is submitted
- **THEN** the ErrorMessage and the input's `validationMessage` are "Inserisci 6 cifre"

### Requirement: Contract

The Pin Input SHALL ship a contract with scope `pin-input`, anatomy `root`, `label`,
`description`, `error-message`, `control`, `input`, `slot`, located by the exact accessible name
of its input (the `{ label }` locator: a masked code is a password input, which has no role),
with:

- actions: `type(text)` (at the caret, one committed single-character composition per
  character: the closed key set has no characters and a click would move the caret; pointer
  first presses the input); `paste(text)` (keyboard only: the adapter's `Part.paste`, the real
  `paste` → `beforeinput` → `input` order); `fill(code)` (clear, then paste); `autofill(code)`
  (sets the value by script and dispatches `input`, the password-manager path; a script write
  has no modality, so its keyboard twin is the same write); `backspace(times)`; `clear` (End,
  then one Backspace per character: a synthetic select-all selects nothing);
  `pressSlot(index)` (pointer: a press on the slot's box; keyboard: Home then ArrowRight
  `index` times); `compose(text, committed)`;
- queries: `value()`, `slots()` (each slot's text), `activeSlot()` (a driver reading, not a
  model snapshot: it exists only while focused), `isComplete()`, `isDisabled()`,
  `isReadOnly()`, `isInvalid()`, `isComposing()`;
- states: `idle`, `composing` (observed through `data-composing`);
- events: `EDIT` → `type`, `paste` and `backspace`, `INPUT` → `autofill`, `SLOT.PRESS` →
  `pressSlot`, `CARET` → `pressSlot` (keyboard), `COMPOSITION.*` → `compose`, `RESET` → the story's reset
  button, `FOCUS`/`BLUR` `skip` ("covered by every action"), prop steps `$sync:value`;
- traits: `field-associated`; `commitsOnFocus` on the input (focus shows the active slot).

Pointer actions SHALL fail with a message saying they need layout when the environment
reports no geometry.

#### Scenario: Same test in both environments

- **WHEN** `getPinInput(screen, { name: "Verification code" }).fill("123456")` runs in jsdom and
  with a Playwright `page`
- **THEN** both resolve with `value()` "123456" and `isComplete()` `true`

### Requirement: Pin Input Invariants

The contract SHALL ship invariants checked after every model step, read from the page (the
oracle cannot model the code without the props that shape it): exactly one textbox (none when
masked) and one input; every slot `aria-hidden` and not focusable; exactly the first
`value.length` slots carry `data-filled` (outside a composition, which owns the text); at
most one slot carries `data-active`, exactly one while the input is focused and none
otherwise. Completion counts, the collapsed caret and Enter are covered by scenario tests.

#### Scenario: Broken variant with per-slot inputs

- **WHEN** a consumer variant renders a focusable input inside each slot
- **THEN** the first step fails, naming the one-textbox invariant

### Requirement: Theme

`@rind-ui/theme` SHALL style the Pin Input in `pin-input.css` as family `field` (`outline`
default, `soft`; `sm`/`md`/`lg`) through its `data-*` attributes and `--rind-pin-input-*`
tokens with semantic fallbacks: slot boxes with a 3:1 boundary, the active slot with the focus
ring while the input has `data-focus-visible`, a fake caret on `data-caret` that respects
reduced motion, inline-end space reserved for password-manager badges
(`--rind-pin-input-badge-space`), and visibility under forced colors.

#### Scenario: Forced colors

- **WHEN** a focused Pin Input is rendered under forced colors
- **THEN** every slot boundary, the characters and the active slot's outline are visible
