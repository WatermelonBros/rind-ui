# password-input Specification

## Purpose
Defines rind-ui's Password Input: a Text Field for secrets with a visibility toggle that every
input method can operate, that never changes its name, keeps the caret where the user left it,
and never leaves a password revealed after the form is submitted or reset. Introduced by
`add-password-input`.
## Requirements
### Requirement: Anatomy

The Password Input SHALL consist of Text Field's `root`, `label`, `description`,
`error-message` and `input` parts (no `textarea`), an optional `visibility-trigger` part
(`<button>`) and an optional `indicator` part (`span`, `aria-hidden="true"`) rendered inside
the trigger or anywhere in the root. It SHALL behave as a Text Field in every respect not
specified here (value, IME, Field integration, ClearTrigger and CharacterCount when rendered).

#### Scenario: Named input

- **WHEN** a Password Input with a Label "Password", an Input and a VisibilityTrigger is rendered
- **THEN** the input's accessible name is "Password", its `type` is `password`, and the
  trigger is a button named "Show password"

### Requirement: Visibility

The Password Input SHALL have a controllable boolean `visible` (`visible`, `defaultVisible`
default `false`, `onVisibleChange(visible, details)` with reasons `PRESS`, `SUBMIT`, `RESET`).
The input's `type` SHALL be `text` while visible and `password` otherwise. When the input's
form fires `submit` (whether or not it is prevented), and when it fires a `reset` that is not
prevented, the Password Input SHALL hide: uncontrolled it becomes hidden, controlled it
proposes `false`. A disabled Password Input SHALL NOT change visibility through its trigger; a
read-only one SHALL.

#### Scenario: Hidden after submit (GOV.UK)

- **WHEN** a revealed Password Input's form is submitted
- **THEN** the input's `type` is `password` before the browser stores form data, and
  `onVisibleChange(false, { reason: "SUBMIT" })` was called

#### Scenario: Controlled reset (radix#4157)

- **WHEN** a controlled, revealed Password Input whose parent applies every proposal is inside
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

### Requirement: Focus And Caret

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

### Requirement: Input Attributes

The input SHALL carry `autoComplete="current-password"` by default (the consumer may set
`new-password` or any value), `autoCapitalize="none"`, `autoCorrect="off"` and
`spellCheck="false"`, in both states, so revealed text is never sent to spellcheck services.
`passwordrules`, `minLength`, `maxLength`, `pattern` and `name` SHALL pass through. While a
VisibilityTrigger is mounted, the browser's own reveal control (Edge's `::-ms-reveal`) SHALL be
hidden through the injected style, so one control reveals the password.

#### Scenario: Spellcheck stays off when revealed

- **WHEN** a Password Input is revealed
- **THEN** the input has `type="text"`, `spellcheck="false"`, `autocorrect="off"` and
  `autocapitalize="none"`

### Requirement: Announcements

When the trigger toggles visibility while focus is in the input (a pointer press), the
Password Input SHALL announce `messages.visibilityAnnouncement(visible)` ("Password shown" /
"Password hidden") politely through the Announcer. When the trigger has focus, it SHALL NOT
announce (the pressed state is spoken). It SHALL never announce the password.

#### Scenario: Pointer toggle with focus in the input

- **WHEN** the user types into the input and clicks the trigger with a mouse
- **THEN** one polite announcement "Password shown" is made

#### Scenario: Keyboard toggle is silent

- **WHEN** the trigger is focused and toggled with Enter
- **THEN** no announcement is made

### Requirement: Messages

The Password Input SHALL take a typed `messages` object with English defaults, merged with
Text Field's: `toggleLabel` ("Show password") and `visibilityAnnouncement(visible)`
("Password shown" / "Password hidden"). No string reaching assistive technology SHALL be
hard-coded outside `messages`.

#### Scenario: Localised trigger

- **WHEN** `messages={{ toggleLabel: "Mostra password" }}` is set
- **THEN** the trigger is named "Mostra password" in both states

### Requirement: Field Integration

The Password Input SHALL implement `field-control` exactly as Text Field does (the input is
focusable, labelable and the validity element), so Field's `disabled`, `readOnly`, `required`
and `invalid` reach the input and the trigger, and its contract SHALL declare the
`field-associated` trait.

#### Scenario: Field state reaches the parts (ark#3930)

- **WHEN** a Password Input inside a Field with `invalid` is rendered
- **THEN** the input has `aria-invalid="true"`, and the input and the indicator carry
  `data-invalid` (the trigger is a toggle button: the Field's invalid flag is not its state)
- **WHEN** a Password Input inside a Field with `disabled` is rendered
- **THEN** the input and the trigger are disabled and every part carries `data-disabled` (a
  disabled Field displays no error, `field` "never while disabled")

### Requirement: Data Attributes

Every part SHALL carry `data-scope="password-input"`, its `data-part` and `data-instance`, and
Text Field's state attributes. Root, Input, VisibilityTrigger and Indicator SHALL carry
`data-state="visible"` or `data-state="hidden"`. The trigger SHALL carry the
`button-like-element` attributes (`data-pressed` keeps its press-in-progress meaning).

#### Scenario: Indicator state

- **WHEN** the password is revealed
- **THEN** the Indicator carries `data-state="visible"` and `aria-hidden="true"`

### Requirement: Contract

The Password Input SHALL ship a contract with scope `password-input`, anatomy `root`, `label`,
`description`, `error-message`, `input`, `visibility-trigger`, `indicator`, located by the
exact accessible name of its `input` part (a password input has no ARIA role: the contract
locator `{ label }`), with:

- actions: `type(text)`, `fill(text)`, `clear`, `blur` (as Text Field's);
  `toggleVisibility` (pointer: click the trigger; keyboard: focus the trigger and press Space);
  `submitForm` and `resetForm` (the story's buttons);
- queries: `value()`, `isVisible()` (the trigger's `aria-pressed`), `inputType()`,
  `toggleName()`, `isInvalid()`, `isDisabled()`;
- states: Text Field's `idle`, `composing`; visibility observed through `data-state`;
- events: Text Field's mappings, `VISIBILITY.TOGGLE` → `toggleVisibility`, `VISIBILITY.HIDE` →
  `submitForm`, `RESET` → `resetForm` (no `$sync` prop steps: `visible` is not state-bound);
- traits: `field-associated`.

#### Scenario: Driver toggles

- **WHEN** `getPasswordInput(screen, { name: "Password" }).toggleVisibility()` runs
- **THEN** it resolves once `isVisible()` is `true` and `inputType()` is `"text"`

### Requirement: Password Input Invariants

The contract SHALL ship invariants checked after every model step: the input's `type` is
`text` exactly when the oracle is visible (so `type="password"` after a submit step); the
trigger's `aria-pressed` equals the oracle's `visible`; the trigger's accessible name is the
same after every step; the trigger is in the Tab order; `spellcheck` is `false` on the input.

#### Scenario: Broken variant swaps the label

- **WHEN** a consumer variant names the trigger "Hide password" while revealed
- **THEN** the toggle step fails, naming the stable-name invariant

### Requirement: Theme

`@rind-ui/theme` SHALL style the Password Input in `password-input.css` as family `field`
(Text Field's look; `outline` default, `soft`; `sm`/`md`/`lg`) through its `data-*`
attributes and `--rind-password-input-*` tokens with semantic fallbacks: the trigger inside
the control's inline end with at least a 24×24 CSS px hit area, its icon in `currentColor`,
inline-end space for password-manager badges (`--rind-password-input-trigger-space`), a focus
ring on the trigger when focus-visible, and visibility under forced colors.

#### Scenario: Forced colors

- **WHEN** a revealed Password Input is rendered under forced colors
- **THEN** the boundary, the text and the trigger's icon are visible, and the pressed trigger
  is distinguishable from the unpressed one without colour

