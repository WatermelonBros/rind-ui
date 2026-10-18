# text-field Specification

## Purpose
Defines rind-ui's Text Field: a native `<input>` or `<textarea>` with a controllable value,
correct IME handling, a clear trigger, a character count, autosize, and the Field's label,
description, error and validation through `field-control`. Introduced by `add-text-field`.
## Requirements
### Requirement: Anatomy

The Text Field SHALL consist of a `root` part (`div`), the Field parts `label`,
`description` and `error-message`, exactly one of `input` (`<input>`) or `textarea`
(`<textarea>`), and optional `clear-trigger` (`<button>`), `character-count` (`<span>`),
`visibility-trigger` (`<button>`) and `visibility-indicator` (`<span>`, `aria-hidden="true"`,
inside the trigger or anywhere in the root) parts; the visibility parts apply with
`type="password"`. When the Root is not inside a Field, it SHALL act as one (its Label,
Description and ErrorMessage are a Field's, with the Field's props on the Root). When it
is inside a Field, it SHALL register with that Field as its control, and its own Label,
Description and ErrorMessage parts SHALL NOT be rendered (development warning). Rendering
both an Input and a Textarea, or neither, SHALL be a development error. This create-or-join
logic SHALL be one shared React helper (`react/src/field/use-field-host.ts`), parameterised
by scope, that Text Field, Number Input and Pin Input Roots use, so standalone and nested
behaviour is identical across them.

#### Scenario: Standalone

- **WHEN** a Text Field with a Label "Name" and an Input is rendered
- **THEN** the input's accessible name is "Name" through a native `<label for>`

#### Scenario: Inside a Field

- **WHEN** a Text Field's Input is rendered inside a Field with a Label "Email"
- **THEN** the input is named "Email" and is the Field's registered control

#### Scenario: Shared Field host

- **WHEN** a search Text Field is rendered standalone with a Label "Search", and another
  inside a Field with a Label "Query"
- **THEN** the first input is named "Search" through a native `<label for>` and its Label
  carries `data-scope="text-field"`; the second is named "Query", is the Field's registered
  control, and renders no Label of its own

### Requirement: Value

The Text Field SHALL have a controllable `value` (`value` / `defaultValue` /
`onValueChange(value, details)`), where `details.reason` is `INPUT`, `CLEAR`, `RESET`, or
the reason a preset passes to the clear action (see Machine Builder),
`details.event` is the native event, and `details.isComposing` tells whether a composition
is in progress. Uncontrolled, the input SHALL be rendered with `defaultValue` (as a native
input, it becomes the `value` attribute of the server HTML; a typed value is never reflected
into the attribute) and the DOM SHALL own its value: the component SHALL never write the value except for a Clear, and
SHALL read it from `input` events and after a form `reset`. Controlled, the input SHALL
show the `value` prop, with `null` and `undefined` rendered as an empty string.
`onValueChange` SHALL be distinct from the native `onChange`, which is forwarded untouched.

#### Scenario: Tab restore and autofill (react-spectrum#6601)

- **WHEN** an uncontrolled Text Field is filled by the browser's autofill
- **THEN** `onValueChange` reports the value with reason `INPUT`, and `data-filled` is set

#### Scenario: React action reset (react-spectrum#8995)

- **WHEN** an uncontrolled Textarea in a form with a React 19 action is reset by React
  after the action
- **THEN** it shows its `defaultValue` with no flash of another value, and the Field is no
  longer filled if that default is empty

#### Scenario: Latest default on reset (base-ui#5880)

- **WHEN** an uncontrolled Text Field's `defaultValue` prop changes and its form is reset
- **THEN** the input shows the new default, and no warning is emitted

#### Scenario: Controlled undefined (kobalte#413, kobalte#627, ark#3727)

- **WHEN** a controlled Text Field's value goes from "abc" to `null`
- **THEN** the input is empty, not "null" or a leftover character

#### Scenario: Native onChange untouched (kobalte#459)

- **WHEN** a consumer passes both `onChange` and `onValueChange`
- **THEN** `onChange` receives the native event and `onValueChange` the string

### Requirement: Native Attributes

The Input and Textarea SHALL forward every attribute of their element, including `type`
(for the Input: `text`, `email`, `url`, `tel`, `password`; others are other components),
`name`, `autoComplete`, `inputMode`, `enterKeyHint`, `maxLength`, `minLength`, `pattern`,
`placeholder`, `spellCheck`, `rows`, `cols`, `wrap` and `form`. The placeholder SHALL never
be used as the accessible name, and a Text Field with no name source SHALL produce a
development warning.

#### Scenario: Textarea attributes (react-spectrum#1178)

- **WHEN** a Textarea is rendered with `rows={4}` and `wrap="hard"`
- **THEN** the `<textarea>` carries both

### Requirement: IME Composition

While a composition is in progress, the Text Field SHALL NOT write the input's value or
selection, SHALL NOT validate, count or announce, and every key handler it owns SHALL apply
the `keyboard-interactions` IME guard. It SHALL still call `onValueChange` for each `input`
event, with `details.isComposing: true`. After `compositionend` it SHALL validate and
count once with the committed value.

#### Scenario: Japanese input (kobalte#737)

- **WHEN** a user types "tesuto" with a Japanese IME into an uncontrolled Text Field and
  commits "テスト"
- **THEN** the input's value is "テスト", and the Field validated once, after the commit

#### Scenario: Controlled with composition flag (react-spectrum#8506)

- **WHEN** a controlled Text Field receives composition updates
- **THEN** `onValueChange` is called for each update with `isComposing: true`, and the
  composition is not interrupted when the parent applies each value

#### Scenario: Korean syllable (ariakit#6663)

- **WHEN** a user composes "사과" with a Korean IME in a Text Field showing a
  CharacterCount
- **THEN** no syllable is split, and the count updates after each syllable is committed

### Requirement: Clear Trigger

The ClearTrigger SHALL be a button-like part (`type="button"`) named by `messages.clear`
(default "Clear"), with `tabIndex=-1`. It SHALL be rendered only while the value is
non-empty and the Text Field is neither disabled nor read-only. A press SHALL NOT move
focus away from the input. If the input did not have focus, focus SHALL move to it. The
value SHALL become empty through the same path as user input: the input's value is set
through its property setter, one bubbling `input` event is dispatched, `onValueChange` is
called with the clear action's reason, and the Field validates. In controlled mode the
clear SHALL be a proposal like any other change. The reason SHALL be a parameter of the
clear action: the ClearTrigger clears with `CLEAR`, and a preset MAY clear through the same
path with its own reason (Search Field's Escape clears with `ESCAPE`).

#### Scenario: Clear keeps focus (base-ui#4643)

- **WHEN** the user types "abc" and presses the ClearTrigger with the mouse
- **THEN** the input is empty and focused, `onValueChange("", { reason: "CLEAR" })` was
  called once, and a native `input` listener on the form ran once

#### Scenario: Clear reason from a preset

- **WHEN** a preset clears a field holding "abc" with reason `ESCAPE`
- **THEN** the input is empty, `onValueChange("", { reason: "ESCAPE" })` was called once,
  one native `input` event was dispatched, and the Field validated

#### Scenario: Hidden when empty

- **WHEN** the value is empty, or the Text Field is read-only
- **THEN** no ClearTrigger element is rendered

### Requirement: Character Count

The CharacterCount SHALL show the current count against a limit: the Input's or
Textarea's `maxLength` (a hard limit, enforced by the browser) or its own `max` (a soft
limit). By default it SHALL count UTF-16 code units with each line break counted as one,
which is what `maxLength` enforces. A `count(value)` function SHALL replace the counter.
With a soft limit, a value over the limit SHALL make the Field report a `tooLong` error
through `field-validation` (custom validity), displayed per the validation mode. The
CharacterCount SHALL be referenced from the control's `aria-describedby` and SHALL NOT be a
live region. While the control is focused and not composing, the Text Field SHALL
announce through the Announcer, politely and keyed per field (so only the count after a
typing pause is spoken), `messages.charactersRemaining(n)` or
`messages.charactersOver(n)`. It SHALL do so only when the remaining count is at or below
the threshold (default: the larger of 10 and 20% of the limit), or over the limit.

#### Scenario: Newlines count once (react-spectrum#1907)

- **WHEN** a Textarea with `maxLength={10}` contains "abc\ndef"
- **THEN** the CharacterCount shows 7 of 10, and the browser lets the user type 3 more
  characters

#### Scenario: Announced near the limit

- **WHEN** a focused Text Field with `max={100}` reaches 85 characters and the user pauses
- **THEN** one polite announcement "15 characters remaining" is made; at 50 characters
  none was made

#### Scenario: Soft limit exceeded

- **WHEN** the user pastes 120 characters into a field with `max={100}`, and the form is
  submitted
- **THEN** the text is kept, the submission is blocked with a `tooLong` error, and
  "20 characters too many" was announced while focused

### Requirement: Disabled And Read-Only

A disabled Text Field SHALL render the native `disabled` attribute. With
`focusableWhenDisabled` it SHALL render `readOnly` plus `aria-disabled="true"` instead,
so no keyboard, paste or IME input changes the value. Read-only SHALL render the native
`readOnly`. Neither SHALL accept a value change from the ClearTrigger.

#### Scenario: Focusable when disabled ignores IME (base-ui#5366)

- **WHEN** a Text Field with `disabled` and `focusableWhenDisabled` is focused and the user
  composes text with an IME
- **THEN** the value does not change

### Requirement: Field Integration

The Text Field SHALL implement `field-control` with the native input or textarea as its
focusable element (labelable) and its native validity element. It SHALL report each
`input` event as a change (`composing` set while composing). It SHALL report Enter in a
single-line Input, when not composing, as a commit. Native constraints (`required`,
`minLength`, `maxLength`, `pattern`, `type`) SHALL be the Field's native validity. Its
contract SHALL declare the `field-associated` trait.

#### Scenario: Required email

- **WHEN** a required `type="email"` Text Field with an ErrorMessage holds "abc" and the
  form is submitted
- **THEN** the input is focused with `data-focus-visible`, `aria-invalid="true"`, and its
  description contains the browser's type-mismatch message

### Requirement: Autosize

A Textarea with `autosize` SHALL follow `autosize-textarea`. Without `autosize` its
height SHALL be left to `rows` and the consumer's styles.

#### Scenario: Autosize on a Textarea

- **WHEN** a Textarea has `autosize` and the user types six lines
- **THEN** it shows six lines without a scrollbar

### Requirement: Machine Builder

The Text Field machine SHALL be built by an internal `buildTextFieldMachine(preset)` from
static data evaluated once at module load, so the graph stays complete: states `idle` and
`composing`, plus a preset's controllable values and global events (accepted in both
states) with their guards, actions and service effects. The exported Text Field machine SHALL
be the base with one preset holding visibility (`visible`, `VISIBILITY.TOGGLE`,
`VISIBILITY.HIDE`) and the keys (`ESCAPE`, `SUBMIT`). There SHALL be one Text Field machine,
connect, parts and contract, with scope `text-field`.

#### Scenario: Empty preset is Text Field

- **WHEN** `buildTextFieldMachine({})` is built
- **THEN** it has the states `idle` and `composing` and Text Field's base events, guards and
  actions, and its scope is `text-field`

#### Scenario: Preset adds a global event

- **WHEN** the exported machine receives `VISIBILITY.TOGGLE` while composing
- **THEN** the event is accepted, `visible` changes, the state stays `composing`, and every
  part carries `data-scope="text-field"`

### Requirement: Data Attributes

Every part SHALL carry `data-scope="text-field"`, its `data-part` (`root`, `label`,
`description`, `error-message`, `input`, `textarea`, `clear-trigger`, `character-count`,
`visibility-trigger`, `visibility-indicator`) and `data-instance`, and the Field state
attributes (`data-disabled`, `data-readonly`, `data-required`, `data-valid` /
`data-invalid`, `data-validating`, `data-touched`, `data-dirty`, `data-filled`). The Root and
the Input or Textarea SHALL carry `data-focus` and `data-focus-visible`, `data-composing`
while composing, and `data-empty` while the value is empty. With `type="password"`, Root,
Input, VisibilityTrigger and VisibilityIndicator SHALL carry `data-state="visible"` or
`data-state="hidden"`. With `type="search"`, the Input SHALL carry `data-custom-clear` while a
ClearTrigger is mounted. The CharacterCount SHALL carry `data-over-limit` when the count
exceeds the limit. The consumer's `data-variant` and `data-size` SHALL be passed through
untouched.

#### Scenario: Focus seeded on mount (base-ui#3172)

- **WHEN** a Text Field's Input is rendered with `autoFocus`
- **THEN** on first paint the Root carries `data-focus`

#### Scenario: Indicator state

- **WHEN** a password Text Field is revealed
- **THEN** the VisibilityIndicator carries `data-state="visible"` and `aria-hidden="true"`

#### Scenario: Empty attribute

- **WHEN** the user clears the field
- **THEN** Root and Input carry `data-empty`

### Requirement: Contract

The Text Field SHALL ship a contract with scope `text-field`, anatomy `root`, `label`,
`description`, `error-message`, `input`, `textarea`, `clear-trigger`, `character-count`,
`visibility-trigger`, `visibility-indicator`, located by the exact accessible name of its
control (the locator `{ label }`: a password input has no ARIA role), with:

- actions: `type(text)` (pointer: click, then type); `fill(text)`; `clear` (pointer: the
  ClearTrigger; keyboard: select all and Backspace; postcondition `value` is `""`);
  `compose(text, committed)` (pointer none: "composition is keyboard input"); `blur`;
  `escape` and `submit` (keyboard Escape / Enter; pointer none: "a key"); `toggleVisibility`
  (pointer: click the trigger; keyboard: focus the trigger and press Space); `submitForm` and
  `resetForm` (the story's buttons);
- queries: `value`, `name`, `description`, `isInvalid`, `isDisabled`, `isReadOnly`,
  `isRequired`, `errors`, `characterCount`, `isClearable`, `isEmpty`, `isVisible` (the
  trigger's `aria-pressed`), `inputType`, `toggleName`;
- states: `idle`, `composing`;
- events: `INPUT` → `type`, `CLEAR` → `clear`, `COMPOSITION.START` / `COMPOSITION.END` →
  `compose`, `RESET` → the story's reset button, `ESCAPE` → `escape`, `SUBMIT` → `submit`,
  `VISIBILITY.TOGGLE` → `toggleVisibility`, `VISIBILITY.HIDE` → `submitForm`, `FOCUS`/`BLUR`
  `skip` ("covered by every action"), prop steps `$sync:value`; a test of a type without a
  VisibilityTrigger maps the visibility events to `skip`;
- traits: `field-associated`.

#### Scenario: Same test in both environments

- **WHEN** a test runs `getTextField(screen, { name: "Email" }).fill("a@b.co")` and the
  same code with a Playwright `page`
- **THEN** both resolve once `value()` is `"a@b.co"`

#### Scenario: Driver toggles

- **WHEN** `getTextField(screen, { name: "Password" }).toggleVisibility()` runs
- **THEN** it resolves once `isVisible()` is `true` and `inputType()` is `"text"`

#### Scenario: Keyboard twin of clear

- **WHEN** `getTextField(screen, { name: "Search books" }).via("keyboard").escape()` runs on a
  search field holding "a"
- **THEN** Escape is pressed and `value()` is ""

### Requirement: Text Field Invariants

The Text Field contract SHALL ship invariants, always on: the component renders exactly one
control (`input` or `textarea`), and with `type="search"` exactly one `searchbox`; the
ClearTrigger is rendered only when the value is non-empty and the field is enabled and
editable; `data-empty` holds exactly when the value is empty. With `type="password"`: the
input's `type` is `text` exactly when the oracle is visible; the VisibilityTrigger's
`aria-pressed` equals the oracle's `visible`; its accessible name is the same after every
step; it is in the Tab order; `spellcheck` is `false` on the input. `@rind-ui/testing` SHALL
export consumer invariants for what needs the page's announcement log, the story's text or
each step's key events: `textFieldStepInvariants({ composedText })`, no announcement is made
during a composition and no step inside a composition changes the value except through the
composition itself; `textFieldKeyStepInvariants()`, an Escape with `escapeClears` on a
non-empty editable field left focus in the input and called `preventDefault()`, an Escape on
an empty or non-editable field did not, and no key marked `composing` called `onSubmit` or
cleared the value.

#### Scenario: Broken variant writes value while composing

- **WHEN** a broken variant writes the input's value on every `input` event during
  composition
- **THEN** the `compose` step fails, naming the invariant

#### Scenario: Broken variant swaps the label

- **WHEN** a consumer variant names the VisibilityTrigger "Hide password" while revealed
- **THEN** the toggle step fails, naming the stable-name invariant

#### Scenario: Broken variant always consumes Escape

- **WHEN** a consumer variant prevents every Escape
- **THEN** the Escape step on an empty field inside a Dialog fails, naming the Escape invariant

### Requirement: Theme

`@rind-ui/theme` SHALL style the Text Field in `text-field.css` through its `data-*`
attributes only, as family `field` of the theme-variants matrix (`outline` default,
`soft`; `sm`/`md`/`lg`). The input's boundary SHALL be at least 3:1 against its background
and visible in forced colors. The focus ring follows `theme-accessibility`, and the
invalid state adds a non-colour cue. The ClearTrigger and the VisibilityTrigger SHALL have
targets of at least 24×24 CSS px with a transparent background and a `currentColor` glyph,
the VisibilityTrigger at the control's inline end with space for password-manager badges and
a focus ring when focus-visible, the pressed trigger distinguishable without colour under
forced colors; search inputs reset the native decorations and offer a leading icon slot; the
CharacterCount over the limit uses the danger role. It SHALL read only `--rind-text-field-*`
tokens with semantic fallbacks.

#### Scenario: Soft variant

- **WHEN** a Text Field has `data-variant="soft"`
- **THEN** it renders with the soft background and a boundary of at least 3:1

#### Scenario: Forced colors

- **WHEN** a revealed password Text Field and a search Text Field holding text are rendered
  under forced colors
- **THEN** the boundaries, the text, the ClearTrigger glyph and the trigger's icon are
  visible, and the pressed trigger is distinguishable from the unpressed one without colour

### Requirement: Input Type

The Text Field Root SHALL take `type`, rendered as the Input's native `type` (default
`text`; the Textarea ignores it). `type="password"` SHALL add the behaviour of the
requirements "Password Visibility" to "Password Field Integration"; `type="search"` SHALL
add search semantics: the Input renders `type="search"` (role `searchbox`) and
`enterKeyHint="search"` unless the consumer sets them, the ClearTrigger is named
`messages.clearSearch` ("Clear search"), and `escapeClears` defaults to `true`. Every other
type SHALL behave as `text`.

#### Scenario: Searchbox

- **WHEN** a Text Field with `type="search"`, a Label "Search books" and an Input is rendered
- **THEN** exactly one element has role `searchbox` and its accessible name is "Search books"

#### Scenario: Icon-only search box

- **WHEN** a Text Field with `type="search"` has no Label and its Input has `aria-label="Search"`
- **THEN** the searchbox is named "Search" and no development warning is emitted

#### Scenario: Password input

- **WHEN** a Text Field with `type="password"`, a Label "Password", an Input and a
  VisibilityTrigger is rendered
- **THEN** the input's accessible name is "Password", its `type` is `password`, and the
  trigger is a button named "Show password"

### Requirement: Password Visibility

The Text Field SHALL have a controllable boolean `visible` (`visible`, `defaultVisible`
default `false`, `onVisibleChange(visible, details)` with reasons `PRESS`, `SUBMIT`, `RESET`).
The input's `type` SHALL be `text` while visible and `password` otherwise. When the input's
form fires `submit` (whether or not it is prevented), and when it fires a `reset` that is not
prevented, the Text Field SHALL hide: uncontrolled it becomes hidden, controlled it
proposes `false`. A disabled Text Field SHALL NOT change visibility through its trigger; a
read-only one SHALL.

#### Scenario: Hidden after submit (GOV.UK)

- **WHEN** a revealed Text Field's form is submitted
- **THEN** the input's `type` is `password` before the browser stores form data, and
  `onVisibleChange(false, { reason: "SUBMIT" })` was called

#### Scenario: Controlled reset (radix#4157)

- **WHEN** a controlled, revealed Text Field whose parent applies every proposal is inside
  a form that is reset
- **THEN** `onVisibleChange(false, { reason: "RESET" })` is called and the input becomes
  `type="password"`

#### Scenario: Prevented reset

- **WHEN** a consumer prevents the form's `reset` event
- **THEN** visibility does not change

### Requirement: Visibility Trigger

The VisibilityTrigger SHALL be a button-like part (`type="button"`), in the tab order, with
`aria-pressed` equal to `visible` (always `"true"` or `"false"`), `aria-controls` pointing at
the input, and a name that does not change with the state: `messages.toggleLabel` ("Show
password") unless the consumer names it. It SHALL toggle `visible` on every activation of
`press-interactions` (pointer, touch, Enter, Space, a bare assistive-technology click),
exactly once per activation.

#### Scenario: Keyboard toggle

- **WHEN** the user tabs from the input to the trigger and presses Space
- **THEN** the input becomes `type="text"`, the trigger has `aria-pressed="true"` and the same
  name "Show password", and focus stays on the trigger

#### Scenario: Screen reader activation (cause A)

- **WHEN** the trigger receives a bare `click` (`detail: 0`, no pointer or key events)
- **THEN** visibility toggles once

### Requirement: Visibility Focus And Caret

A mouse or pen press on the trigger SHALL NOT take focus from the input (`press-interactions`
press without focus); if the input was not focused, focus SHALL move to it. A touch press SHALL
NOT move focus. After any toggle while the input has focus, the input's selection SHALL be
the same as before the `type` change, restored in the same frame.

#### Scenario: Caret kept

- **WHEN** the input holds "hunter2" with the caret after "hunt" and the user clicks the
  trigger with a mouse
- **THEN** the input keeps focus, shows "hunter2" as text, and the caret is still after "hunt"

#### Scenario: Touch keeps the keyboard state

- **WHEN** the trigger is tapped while nothing is focused
- **THEN** visibility toggles and no element gains focus

### Requirement: Password Input Attributes

The input SHALL carry `autoComplete="current-password"` by default (the consumer may set
`new-password` or any value), `autoCapitalize="none"`, `autoCorrect="off"` and
`spellCheck="false"`, in both states, so revealed text is never sent to spellcheck services.
`passwordrules`, `minLength`, `maxLength`, `pattern` and `name` SHALL pass through. While a
VisibilityTrigger is mounted, the browser's own reveal control (Edge's `::-ms-reveal`) SHALL be
hidden through the injected style, so one control reveals the password.

#### Scenario: Spellcheck stays off when revealed

- **WHEN** a Text Field is revealed
- **THEN** the input has `type="text"`, `spellcheck="false"`, `autocorrect="off"` and
  `autocapitalize="none"`

### Requirement: Visibility Announcements

When the trigger toggles visibility while focus is in the input (a pointer press), the
Text Field SHALL announce `messages.visibilityAnnouncement(visible)` ("Password shown" /
"Password hidden") politely through the Announcer. When the trigger has focus, it SHALL NOT
announce (the pressed state is spoken). It SHALL never announce the password.

#### Scenario: Pointer toggle with focus in the input

- **WHEN** the user types into the input and clicks the trigger with a mouse
- **THEN** one polite announcement "Password shown" is made

#### Scenario: Keyboard toggle is silent

- **WHEN** the trigger is focused and toggled with Enter
- **THEN** no announcement is made

### Requirement: Password Field Integration

The Text Field SHALL implement `field-control` exactly as Text Field does (the input is
focusable, labelable and the validity element), so Field's `disabled`, `readOnly`, `required`
and `invalid` reach the input and the trigger, and its contract SHALL declare the
`field-associated` trait.

#### Scenario: Field state reaches the parts (ark#3930)

- **WHEN** a Text Field inside a Field with `invalid` is rendered
- **THEN** the input has `aria-invalid="true"`, and the input and the indicator carry
  `data-invalid` (the trigger is a toggle button: the Field's invalid flag is not its state)
- **WHEN** a Text Field inside a Field with `disabled` is rendered
- **THEN** the input and the trigger are disabled and every part carries `data-disabled` (a
  disabled Field displays no error, `field` "never while disabled")

### Requirement: Escape Clears

With `escapeClears` (default `true` for `type="search"`, else `false`), when Escape is pressed in the input, not composing, and the value is non-empty and the field
is neither disabled nor read-only, the Text Field SHALL clear the value through the same
path as the ClearTrigger (`onValueChange("", { reason: "ESCAPE" })`, one bubbling `input`
event, Field validation), keep focus in the input, and call `preventDefault()` and stop the
key, so an enclosing dismissable layer stays open and the browser's own clearing does not run.
When the value is empty, the field is disabled or read-only, or `escapeClears` is `false`, Escape SHALL NOT be handled.

#### Scenario: Clear inside a dialog (dismissable-layer "Inner widget consumes Escape")

- **WHEN** a Text Field holding "tolkien" is inside an open Dialog and Escape is pressed
- **THEN** the value is "", focus is in the input, and the Dialog stays open

#### Scenario: Empty field lets the dialog close (react-spectrum#5480)

- **WHEN** Escape is pressed in an empty Text Field inside an open Dialog
- **THEN** the Dialog closes

#### Scenario: Escape during composition (react-spectrum#10249)

- **WHEN** a user composing Korean text presses Escape to cancel the composition
- **THEN** the composition is cancelled by the IME and the field's value is not cleared

### Requirement: Enter Submits

When Enter is pressed in the input and is not marked `composing`, the Text Field (every `type`) SHALL call
`onSubmit(value, details)` once, with the native event in `details`, and SHALL NOT prevent the
browser's implicit form submission; a consumer that wants to prevent it calls
`details.event.preventDefault()`. Enter SHALL also be reported to the Field as a commit.

#### Scenario: IME commit is not a search (react-spectrum#6421)

- **WHEN** a user composing Chinese text presses Enter to commit "被送出"
- **THEN** the input shows "被送出" and `onSubmit` was not called; a second Enter calls
  `onSubmit("被送出")`

#### Scenario: Search form

- **WHEN** a Text Field `name="q"` inside a form with an `onSubmit` prop receives Enter
- **THEN** `onSubmit` is called once and the form submits with `q` in its data

### Requirement: Native Search Cancel Button

With `type="search"`, while a ClearTrigger part is mounted, the browser's own search cancel button
(`::-webkit-search-cancel-button`) SHALL be hidden through the injected style, so the field
has one clear control; without a ClearTrigger the native button SHALL be left as the browser
draws it.

#### Scenario: One clear control in Chromium

- **WHEN** a Text Field with a ClearTrigger holds text in Chromium
- **THEN** the native cancel button is not displayed and the ClearTrigger is

### Requirement: Visibility And Search Messages

The Text Field messages SHALL add, with English defaults: `toggleLabel` ("Show password"),
`visibilityAnnouncement(visible)` ("Password shown" / "Password hidden") and `clearSearch`
("Clear search", the ClearTrigger's name with `type="search"`). No string reaching assistive
technology SHALL be hard-coded outside `messages`.

#### Scenario: Localised trigger

- **WHEN** `messages={{ toggleLabel: "Mostra password" }}` is set on a password Text Field
- **THEN** the trigger is named "Mostra password" in both states

#### Scenario: Localised clear

- **WHEN** `messages={{ clearSearch: "Cancella ricerca" }}` is set on a search Text Field
  holding text
- **THEN** the ClearTrigger is named "Cancella ricerca"

