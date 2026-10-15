## Purpose

Defines rind-ui's Number Input: a text input with the `spinbutton` role whose value is a
number, typed in the user's locale, stepped with keys, steppers and (optionally) the wheel,
committed on blur and Enter, and wired into Field and forms. Introduced by `add-number-input`.

## ADDED Requirements

### Requirement: Anatomy

The Number Input SHALL consist of a `root` part (`div`), the Field parts `label`,
`description` and `error-message`, a `control` part (`div`, no role) grouping the input and
the steppers, an `input` part (`<input type="text">`), optional `increment-trigger` and
`decrement-trigger` parts (`<button>`), and a hidden native `<input type="number">` that the
root renders automatically (`hidden-form-input`, part `hidden-input`). When the Root is not
inside a Field it SHALL act as one, exactly as Text Field's Root does; inside a Field it
SHALL register as that Field's control and its own Label, Description and ErrorMessage SHALL
NOT be rendered (development warning). Every part SHALL accept element substitution and
forward its element's attributes.

#### Scenario: Standalone with steppers

- **WHEN** a Number Input with a Label "Quantity", an Input and both triggers is rendered
- **THEN** exactly one element has role `spinbutton`, its accessible name is "Quantity", and
  the two buttons are named "Increase Quantity" and "Decrease Quantity"

### Requirement: Value And Callbacks

The Number Input SHALL have a controllable `value` of type `number | null` (`value`,
`defaultValue` default `null`, `onValueChange(value, details)`), where `null` means empty and
`NaN` is never exposed. `details.reason` SHALL name the cause (`INPUT.COMMIT`, `STEP`,
`EDGE`, `WHEEL`, `PASTE`, `SPIN`, `RESET`) and carry `modality` and `cancel()`.
`onValueChange` SHALL be called once for each change the component applies, and never when
the resulting value equals the current one. `onValueCommit(value, details)` SHALL be called
once at the end of each interaction that changed the value: each key press (each key repeat
included), each stepper press or hold (on release), each wheel tick, and each blur or Enter
commit that changed the value. `onInputValueChange(text)` SHALL be called for each accepted
edit of the text. Typing SHALL NOT change `value`.

#### Scenario: Typing then blur

- **WHEN** the user types "42" into an empty Number Input and tabs away
- **THEN** `onInputValueChange` was called with "4" and "42", and `onValueChange(42)` and
  `onValueCommit(42)` were each called once, on blur

#### Scenario: One change per click (base-ui#2588)

- **WHEN** the increment trigger is clicked once with a mouse
- **THEN** `onValueChange` and `onValueCommit` are each called exactly once

#### Scenario: Blur without change commits nothing (react-spectrum#9444)

- **WHEN** a Number Input showing a server error is focused and blurred without editing
- **THEN** no callback runs, nothing is reported to the Field, and the error stays

### Requirement: Typing And Commit

While the input is focused the text SHALL be free: the component SHALL NOT reformat it,
move the caret or change the value on an edit. An insertion (typing, paste, drop) whose
resulting text is not acceptable partial input (`number-parsing`) SHALL be rejected before
it is applied, leaving text and caret unchanged; deletions, cuts, undo and redo SHALL never
be rejected. On blur and on Enter (not composing) the component SHALL commit: empty text
commits `null`; text that does not parse restores the formatted current value; otherwise
the parsed value is, with `commitBehavior: "snap"` (default), clamped to `[min, max]` and
snapped to the step grid, or, with `commitBehavior: "validate"`, kept as typed; then the text
is replaced by the formatted committed value.

#### Scenario: Caret stays while editing (zag#2712)

- **WHEN** the user moves the caret into the middle of "1,234" and types "5"
- **THEN** the text is "1,2354" with the caret after "5", and nothing was reformatted

#### Scenario: Units can be deleted (react-spectrum#2806)

- **WHEN** a field formatted with `{ style: "unit", unit: "milliliter" }` shows "5 mL" and the
  user presses Backspace three times
- **THEN** each deletion is applied

#### Scenario: Garbage restores (react-spectrum#3862)

- **WHEN** a field whose value is 10 has its text replaced by "," and is blurred
- **THEN** the text is "10" and the value is still 10

#### Scenario: Snap on commit

- **WHEN** a field with `min={0}`, `max={100}` and `step={5}` commits the typed text "103"
- **THEN** the value is 100

#### Scenario: Validate keeps the typed value (base-ui#1845)

- **WHEN** a field with `max={100}` and `commitBehavior="validate"` inside a Field commits "150"
  and the form is submitted
- **THEN** the value is 150, the submission is blocked with a `rangeOverflow` error, and the
  Field shows the browser's range message

### Requirement: Controlled Value

In controlled mode every change SHALL be a proposal. When the parent refuses it (`$reverted`)
or applies a different value (`$sync`), the input's text SHALL immediately show the formatted
controlled value. When the parent changes the value on its own, the text SHALL show it, also
while the input is focused.

#### Scenario: Parent clamps (zag#3444)

- **WHEN** a controlled Number Input whose parent caps values at 10 commits the typed text "100"
- **THEN** the input shows "10" and `aria-valuenow` is 10 right after the commit

#### Scenario: Parent refuses a step

- **WHEN** a controlled Number Input at 5 is incremented and the parent keeps 5
- **THEN** the input shows "5" and `onValueCommit` is not called

### Requirement: Range, Step And Rounding

`min` and `max` SHALL be optional bounds (no default bound is exposed); `step` SHALL default
to 1, or to 0.01 for `style: "percent"`; `largeStep` SHALL default to 10 × `step`. The step
grid SHALL be `min + k × step` (`0 + k × step` without `min`), with values rounded to the
decimals of `step` and `min` through the shared step math of `add-slider`, so no float drift
occurs. A step SHALL move from the current value (the committed value, or the parsed text when
the text was edited) to the next grid line in the step's direction, then clamp; from an empty
value a step SHALL land on 0 clamped into the range. A step that would not change the value
SHALL report nothing.

#### Scenario: Decimal steps (kobalte#451)

- **WHEN** a field at 40 with `step={0.1}` is incremented twice
- **THEN** the values are 40.1 and 40.2

#### Scenario: Off-grid value (reka-ui#2758)

- **WHEN** a field with `step={1}` holds 18.98 and is incremented
- **THEN** the value is 19, not 19.98 or 20

#### Scenario: Step from edited text (ark#1838)

- **WHEN** a `fr-FR` currency field shows the typed text "10,50" and the increment trigger is pressed
- **THEN** the value is 11.5 and the text "11,50 €"

#### Scenario: Empty field with a minimum

- **WHEN** an empty field with `min={18}` and `max={120}` receives ArrowDown
- **THEN** the value is 18

### Requirement: Keyboard Interaction

On the focused input, the component SHALL handle, through the logical keys and the IME guard
of `keyboard-interactions`: ArrowUp/ArrowDown step by `step`; Shift+ArrowUp/ArrowDown and
PageUp/PageDown step by `largeStep`; Home and End set the value to `min` and `max` only when
that bound is set (otherwise the browser moves the caret); Enter commits and then lets the
browser's implicit submission proceed. Each handled key SHALL call `preventDefault`; key
repeats SHALL each step. All other keys SHALL keep their native text-editing behaviour.
Keys marked `composing` SHALL do nothing.

#### Scenario: Home without a minimum

- **WHEN** Home is pressed in a field with no `min`
- **THEN** the caret moves to the start of the text and the value does not change

#### Scenario: Enter submits the new value (react-spectrum#9671, reka-ui#1385, react-spectrum#2802)

- **WHEN** the user types "7" into a field in a form with a submit button and presses Enter
- **THEN** the form submits once and its data contains the field's name with "7"

#### Scenario: Keys keep working after Enter (zag#1710)

- **WHEN** the user presses Enter and then ArrowUp
- **THEN** the value increases by one step

#### Scenario: IME (react-spectrum#6678)

- **WHEN** a user composing full-width digits with a Japanese IME presses Enter to commit "１２"
- **THEN** the composition commits, the field is not committed by that Enter, and a later
  blur commits 12

### Requirement: Steppers

Each trigger SHALL be a button-like part (`type="button"`) with `tabIndex=-1`, not
`aria-hidden`, `aria-controls` pointing at the input, and a name made of
`messages.increment` / `messages.decrement` followed by the Label's text
(`aria-labelledby` = its own id and the Label's id; `aria-label` text alone when no Label).
When the value is at the bound in its direction, or the field is disabled or read-only, a
trigger SHALL carry `aria-disabled="true"` and `data-disabled` and ignore presses, and SHALL
NOT use the native `disabled` attribute. A press SHALL NOT take focus (`press-interactions`
press without focus): with a mouse or pen, focus SHALL move to the input if it was elsewhere;
with touch or assistive technology, focus SHALL stay where it was.

#### Scenario: Tap does not open the keyboard (reka-ui#2315, base-ui#1528)

- **WHEN** the increment trigger is tapped with a finger or a stylus while nothing is focused
- **THEN** the value increases by one step and no element gains focus

#### Scenario: Last press at the bound (react-spectrum#2119, react-spectrum#9994, reka-ui#2200)

- **WHEN** a field one step below `max` has its increment trigger pressed and released
- **THEN** the value reaches `max`, the trigger loses `data-pressed` on release, now has
  `aria-disabled="true"`, keeps no native `disabled`, and focus did not move

### Requirement: Press And Hold

With `spinOnPress` (default `true`), holding a trigger SHALL repeat the step: with a mouse or
pen, one step on press start, then after `spinDelay` (default 400 ms) one step every
`spinInterval` (default 60 ms); with touch, no step on press start, one step on release if no
repeat happened, and repeats after 600 ms. Repeats SHALL stop at release, when the pointer
leaves the trigger, at a bound, on `pointercancel`, and when the field becomes disabled or
read-only. A touch press that turns into a scroll SHALL not step. The platform context menu
SHALL be suppressed while a trigger is held. A held press SHALL commit once, on release. All
delays SHALL use the injected scheduler.

#### Scenario: Hold with fake timers

- **WHEN** with fake timers the increment trigger of a field at 0 is held with a mouse for
  400 + 3 × 60 ms and released
- **THEN** the value is 4, `onValueChange` was called 4 times and `onValueCommit` once with 4

#### Scenario: Hold stops at max (base-ui#3887)

- **WHEN** the increment trigger is held past `max`
- **THEN** repeats stop at `max` and `onValueChange` is not called again

#### Scenario: Disabled mid-hold (base-ui#5434)

- **WHEN** the field becomes disabled while a trigger is held
- **THEN** no further step happens

#### Scenario: Touch scroll (react-spectrum#8472, reka-ui#2947)

- **WHEN** a finger starts on a trigger and the gesture becomes a page scroll (`pointercancel`)
- **THEN** the value does not change

#### Scenario: No hold

- **WHEN** `spinOnPress={false}` and a trigger is held for a second
- **THEN** the value changed by exactly one step

### Requirement: Wheel

With `allowWheel` (default `false`), a wheel gesture over the focused input SHALL step: a
gesture whose vertical delta dominates its horizontal delta, upward (negative `deltaY`)
increments and downward decrements, Shift uses `largeStep`; each tick SHALL commit; the page
SHALL NOT scroll for a handled tick (non-passive listener). Gestures with Ctrl (pinch-zoom),
mostly-horizontal gestures, and any gesture while the input is not focused, disabled or
read-only SHALL be left to the page.

#### Scenario: Horizontal swipe (react-spectrum#1792)

- **WHEN** a trackpad swipe with `deltaX` 30 and `deltaY` 4 happens over the focused input
- **THEN** the value does not change and the page may scroll

#### Scenario: Not focused

- **WHEN** the user scrolls the page with the wheel while the pointer is over an unfocused field
- **THEN** the value does not change

### Requirement: Paste

A paste that replaces the whole text SHALL be parsed and committed immediately (reason
`PASTE`) when it parses; a paste that does not parse SHALL be rejected. A paste into part of
the text SHALL be treated as an insertion.

#### Scenario: Paste a formatted amount

- **WHEN** "$1,234.50" is pasted over the selected text of a `USD` currency field
- **THEN** the value is 1234.5 and the text "$1,234.50"

### Requirement: ARIA Semantics

The input SHALL have `role="spinbutton"`, `aria-valuenow` equal to the value (absent when
empty), `aria-valuemin`/`aria-valuemax` only for the bounds the consumer set, and
`aria-valuetext` from `messages.valueText` applied to the `number-parsing` value text (or
`messages.empty` when empty), updated in the same task as the change that caused it. It
SHALL NOT carry `aria-roledescription`. `required` SHALL be exposed as `aria-required` on the
input (the native constraint lives on the hidden input). On iOS a quirk entry
(`ios-vo-spinbutton-input`) SHALL render the input without the `spinbutton` role and value
attributes, until device testing shows VoiceOver focuses and edits a spinbutton input.

#### Scenario: Value attributes after a key (cause G)

- **WHEN** ArrowUp is pressed on a field at 9 formatted as `EUR` in `de-DE`
- **THEN** within the keydown task `aria-valuenow` is 10 and `aria-valuetext` is "10,00 €",
  and no `blur` or `focus` event fired on the input

#### Scenario: No invented bounds

- **WHEN** a field has no `min` and no `max`
- **THEN** the input has neither `aria-valuemin` nor `aria-valuemax`

#### Scenario: Empty

- **WHEN** the field is empty
- **THEN** the input has no `aria-valuenow` and its `aria-valuetext` is "Empty"

### Requirement: Mobile Keyboard

The input SHALL carry `type="text"`, `autoComplete="off"`, `autoCorrect="off"`,
`spellCheck="false"` and an `inputMode`: `decimal` when fractions are allowed, else
`numeric`; on iPhone `text` when negative values are allowed (its numeric keypads have no
minus); on Android `numeric` when negative values are allowed. The server render and the
hydration render SHALL use the platform-independent value, refined after mount, so hydration
reports no mismatch. A consumer `inputMode` SHALL win.

#### Scenario: iPhone hydration (react-spectrum#8503)

- **WHEN** a field allowing negative decimals is server-rendered and hydrated on an iPhone
- **THEN** hydration logs no mismatch and after mount the input's `inputMode` is `text`

### Requirement: Announcements

The Number Input SHALL make no announcement for key steps on the focused input. It SHALL
announce through the Announcer, politely and keyed per field so a burst collapses to the
last message: the new value text after a stepper press whose modality was `touch` or
`virtual` (focus is not on the input), and `messages.committed(valueText)` after a commit
that replaced the typed text with a different text (clamped, snapped or re-parsed).
Announcements SHALL never be assertive.

#### Scenario: Held key does not flood (react-spectrum#4157)

- **WHEN** ArrowUp is held for 20 repeats while a recording announcer is installed
- **THEN** no announcement was made

#### Scenario: Screen reader stepper press

- **WHEN** the increment trigger receives three bare clicks (virtual modality) in a row
- **THEN** one polite announcement with the final value text is made after the key debounce

#### Scenario: Silent rewrite is announced (react-spectrum#4967)

- **WHEN** a field with `max={100}` commits the typed text "150" on blur, so its text becomes
  "100"
- **THEN** one polite announcement says "100"; committing "42" in the same field announces
  nothing

### Requirement: Disabled And Read-Only

A disabled field SHALL render the native `disabled` on the input and hidden input, ignore
every key, press, wheel and paste, and stop any repeat. A read-only field SHALL render native
`readOnly`, keep focus and selection working, and ignore every change.

#### Scenario: Read-only keys

- **WHEN** ArrowUp is pressed in a read-only field
- **THEN** the value does not change and the caret does not move

### Requirement: Form Participation

The hidden `<input type="number">` SHALL carry `name`, `form`, `min`, `max` and `step` (when
`min` is set; otherwise `step="any"`), `required`, `disabled`, and SHALL mirror the value as
its `value` property (`String(value)`, or "" when empty) following `hidden-form-input`. The
visible input SHALL carry no `name`. A commit SHALL update the hidden input within the same
task, before an implicit submission or a `requestSubmit()` from a callback runs. A form reset
SHALL restore the current `defaultValue` with reason `RESET` and no commit. A native change
on the hidden input that the component did not make (autofill) SHALL be adopted as a commit
unless the field is disabled or read-only, in which case the hidden input is re-synced.

#### Scenario: Raw number submitted

- **WHEN** a form contains a Number Input `name="price"` formatted as `USD` showing "$1,234.50"
- **THEN** the form data contains `price=1234.5`

#### Scenario: Validation focus (base-ui#3574)

- **WHEN** a required, empty Number Input in a form is submitted
- **THEN** submission is blocked, focus is on the visible input with `data-focus-visible`, and
  no "aria-hidden element retained focus" warning is logged

### Requirement: Field Integration

The Number Input SHALL implement `field-control` with the visible input as its focusable,
labelable element and the hidden number input as its validity element, so `required`, range
and step errors use the browser's messages. It SHALL report each applied value change as a
change and Enter as a commit. Its contract SHALL declare the `field-associated` trait.

#### Scenario: Field disabled

- **WHEN** a Number Input inside a disabled Field is rendered
- **THEN** the input, the hidden input and both triggers are disabled and carry `data-disabled`

### Requirement: Messages

The Number Input SHALL take a typed `messages` object with English defaults: `increment`
("Increase"), `decrement` ("Decrease"), `empty` ("Empty"), `valueText({ value, text })`
(default: `text`), `committed(text)` (default: `text`). No string reaching assistive
technology SHALL be hard-coded outside `messages`.

#### Scenario: Italian triggers

- **WHEN** `messages={{ increment: "Aumenta" }}` and a Label "Quantità" are set
- **THEN** the increment trigger is named "Aumenta Quantità"

### Requirement: Data Attributes

Every part SHALL carry `data-scope="number-input"`, its `data-part` and `data-instance`, and
the Field state attributes. Root, Control and Input SHALL carry `data-focus` and
`data-focus-visible` (focus of the input), `data-spinning` while a trigger repeats, and
`data-composing` during a composition. Each trigger SHALL carry `data-disabled` when it
cannot step and `data-pressed` while pressed. `data-variant` and `data-size` SHALL pass
through untouched.

#### Scenario: Spinning attribute

- **WHEN** a trigger is held past `spinDelay`
- **THEN** the Root carries `data-spinning` until release

### Requirement: Contract

The Number Input SHALL ship a contract with scope `number-input`, anatomy `root`, `label`,
`description`, `error-message`, `control`, `input`, `increment-trigger`,
`decrement-trigger`, `hidden-input`, located by role `spinbutton` (or `textbox` under the iOS
quirk) and exact accessible name, with:

- actions: `type(text)`; `fill(text)` (select all, type, then Tab to commit); `commit`
  (Enter); `step("increase" | "decrease", { large? })` (keyboard: Arrow/Shift+Arrow; pointer:
  click the trigger, for `large` declared none with the reason "large steps are keyboard
  only"); `toEdge("min" | "max")` (keyboard Home/End; pointer declared none); `holdStepper(
  "increase" | "decrease", ms)` (pointer and touch, advancing the adapter's time; keyboard:
  repeated ArrowUp/ArrowDown); `wheel(direction)` (pointer; keyboard: one Arrow); `paste(text)`;
  `resetForm()`;
- queries: `value()` (from `aria-valuenow`, `null` when absent), `text()`, `valueText()`,
  `formValue()` (the hidden input's value), `canIncrement()`, `canDecrement()`, `isInvalid()`,
  `isDisabled()`, `isReadOnly()`;
- states: `idle`, `composing`, `pressing`, `spinning`, observed through `data-composing` and
  `data-spinning`;
- events: input and commit events map to `type`/`commit`, key steps to `step`/`toEdge`,
  `PRESS.*` to `step`/`holdStepper`, `WHEEL` to `wheel`, `RESET` to `resetForm`, delays to
  `holdStepper`, `FOCUS`/`BLUR` `skip` ("covered by every action"), prop steps `$sync:value`,
  `$props:disabled`;
- traits: `valued` (expected value from the oracle, value text from `messages.valueText`),
  `form-associated` (compared property: the hidden input's `value`), `field-associated`.

#### Scenario: Same test in both environments

- **WHEN** `getNumberInput(screen, { name: "Quantity" }).step("increase")` runs in jsdom and
  the same call runs with a Playwright `page`
- **THEN** both resolve with `value()` equal to 1 from 0

### Requirement: Number Input Invariants

The contract SHALL ship invariants checked after every model step: exactly one `spinbutton`
(or `textbox` under the quirk) and no other focusable part in the tab order;
`aria-valuenow` equals the oracle value; the hidden input's `value` equals `String(value)` or
""; when focus is not in the input, its text equals the formatted value; each trigger's
`aria-disabled` holds exactly when it cannot step; no trigger ever has native `disabled`
while the field is enabled; a step with touch or virtual modality did not move focus;
`onValueChange` was called exactly as often as the oracle applied changes.

#### Scenario: Broken wrapper re-enables the native rocker

- **WHEN** a consumer wrapper sets native `disabled` on the increment trigger at `max`
- **THEN** the step that reaches `max` fails, naming the trigger invariant

### Requirement: Theme

`@rind-ui/theme` SHALL style the Number Input in `number-input.css` as family `field`
(`outline` default, `soft`; `sm`/`md`/`lg`) through its `data-*` attributes and
`--rind-number-input-*` tokens with semantic fallbacks: the control boundary at least 3:1, a
focus ring on the control while the input has `data-focus-visible`, triggers with at least a
24×24 CSS px hit area and glyphs in `currentColor`, the at-bound state not shown by colour
alone, tabular numerals, and visibility under forced colors.

#### Scenario: Forced colors

- **WHEN** a Number Input with triggers is rendered under forced colors
- **THEN** the boundary, both glyphs and the focus ring are visible, and a trigger at its
  bound is shown with `GrayText`
