# text-field Specification

## Purpose
Defines rind-ui's Text Field: a native `<input>` or `<textarea>` with a controllable value,
correct IME handling, a clear trigger, a character count, autosize, and the Field's label,
description, error and validation through `field-control`. Introduced by `add-text-field`.
## Requirements
### Requirement: Anatomy

The Text Field SHALL consist of a `root` part (`div`), the Field parts `label`,
`description` and `error-message`, exactly one of `input` (`<input>`) or `textarea`
(`<textarea>`), and optional `clear-trigger` (`<button>`) and `character-count`
(`<span>`) parts. When the Root is not inside a Field, it SHALL act as one (its Label,
Description and ErrorMessage are a Field's, with the Field's props on the Root). When it
is inside a Field, it SHALL register with that Field as its control, and its own Label,
Description and ErrorMessage parts SHALL NOT be rendered (development warning). Rendering
both an Input and a Textarea, or neither, SHALL be a development error. This create-or-join
logic SHALL be one shared React helper (`react/src/field/use-field-host.ts`), parameterised
by scope, that Text Field, Number Input, Pin Input, Password Input and Search Field Roots
all use, so standalone and nested behaviour is identical across them.

#### Scenario: Standalone

- **WHEN** a Text Field with a Label "Name" and an Input is rendered
- **THEN** the input's accessible name is "Name" through a native `<label for>`

#### Scenario: Inside a Field

- **WHEN** a Text Field's Input is rendered inside a Field with a Label "Email"
- **THEN** the input is named "Email" and is the Field's registered control

#### Scenario: Shared Field host

- **WHEN** a Search Field Root built on the shared Field host helper is rendered standalone
  with a Label "Search", and another is rendered inside a Field with a Label "Query"
- **THEN** the first input is named "Search" through a native `<label for>` and its Label
  carries `data-scope="search-field"`; the second is named "Query", is the Field's
  registered control, and renders no Label of its own

### Requirement: Value

The Text Field SHALL have a controllable `value` (`value` / `defaultValue` /
`onValueChange(value, details)`), where `details.reason` is `INPUT`, `CLEAR`, `RESET`, or
the reason a preset passes to the clear action (see Machine Builder),
`details.event` is the native event, and `details.isComposing` tells whether a composition
is in progress. Uncontrolled, the input SHALL be rendered with `defaultValue` and the DOM
SHALL own its value: the component SHALL never write the value except for a Clear, and
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

The Text Field SHALL export `buildTextFieldMachine(preset)`, which builds the Text Field
machine from static data evaluated once at module load, so the graph stays complete. A
preset MAY add controllable values, global events (accepted in both `idle` and `composing`)
with their guards and actions, service effects, and a `scope`. The empty preset SHALL build
the Text Field machine itself (scope `text-field`). The Text Field connect, parts and
contract SHALL accept the scope as a parameter, so a preset's parts carry its scope in
`data-scope` and its contract has that scope. Password Input and Search Field SHALL be built
as presets, never as copies, so value, IME, Field and ClearTrigger behaviour cannot drift.

#### Scenario: Empty preset is Text Field

- **WHEN** `buildTextFieldMachine({})` is built
- **THEN** it has the states `idle` and `composing` and the same events, guards and
  actions as the exported Text Field machine, and its scope is `text-field`

#### Scenario: Preset adds a global event

- **WHEN** a preset with scope `password-input` adds the event `VISIBILITY.TOGGLE` and a
  controllable `visible`, and the event is sent while composing
- **THEN** the event is accepted, `visible` changes, the state stays `composing`, and every
  part carries `data-scope="password-input"`

### Requirement: Data Attributes

Every part SHALL carry `data-scope="text-field"` (or a preset's scope), its `data-part` (`root`, `label`,
`description`, `error-message`, `input`, `textarea`, `clear-trigger`,
`character-count`) and `data-instance`, and the Field state attributes (`data-disabled`,
`data-readonly`, `data-required`, `data-valid` / `data-invalid`, `data-validating`,
`data-touched`, `data-dirty`, `data-filled`). The Root and the Input or Textarea SHALL
carry `data-focus` and `data-focus-visible`, and `data-composing` while composing. The
CharacterCount SHALL carry `data-over-limit` when the count exceeds the limit. The
consumer's `data-variant` and `data-size` SHALL be passed through untouched.

#### Scenario: Focus seeded on mount (base-ui#3172)

- **WHEN** a Text Field's Input is rendered with `autoFocus`
- **THEN** on first paint the Root carries `data-focus`

### Requirement: Contract

The Text Field SHALL ship a contract with scope `text-field` (a preset's contract takes its
scope), anatomy `root`, `label`,
`description`, `error-message`, `input`, `textarea`, `clear-trigger`, `character-count`,
located by role `textbox` and exact accessible name, with:

- actions:
  - `type(text)`: keyboard typing into the control (focusing it first). Pointer: click the
    control, then type.
  - `fill(text)`: select all and type `text`.
  - `clear`: pointer click on the ClearTrigger; keyboard: select all and Backspace.
    Postcondition: `value` is `""`.
  - `compose(text, committed)`: an IME composition through the adapter's composing keys,
    committing `committed`. Pointer declared as none, with the reason "composition is
    keyboard input".
  - `blur`: Tab away.
- queries: `value`, `name`, `description`, `isInvalid`, `isDisabled`, `isReadOnly`,
  `isRequired`, `errors`, `characterCount` (the CharacterCount's text, or `null`),
  `isClearable` (the ClearTrigger is rendered);
- states: `idle`, `composing`;
- events: `INPUT` → `type`, `CLEAR` → `clear`, `COMPOSITION.START` → `compose`,
  `COMPOSITION.END` → `compose`, `RESET` → the story's reset button, `FOCUS`/`BLUR`
  `skip` ("covered by every action"), prop steps `$sync:value`;
- traits: `field-associated`.

#### Scenario: Same test in both environments

- **WHEN** a test runs `getTextField(screen, { name: "Email" }).fill("a@b.co")` and the
  same code with a Playwright `page`
- **THEN** both resolve once `value()` is `"a@b.co"`

### Requirement: Text Field Invariants

The Text Field contract SHALL ship invariants, always on: the component renders exactly
one element with role `textbox`; the ClearTrigger is rendered only when the value is
non-empty and the field is enabled and editable. `@rind-ui/testing` SHALL export, as
consumer invariants usable with `testMachine(textFieldContract, { invariants })`
(`textFieldStepInvariants({ composedText })`), the invariants that need the page's
announcement log or the story's text: no announcement is made during a composition; no
step inside a composition changes the value except through the composition itself. The
value after each action SHALL be checked by the actions' postconditions (`fill`, `clear`:
`value`), because the oracle does not see the text a user types.

#### Scenario: Broken variant writes value while composing

- **WHEN** a broken variant writes the input's value on every `input` event during
  composition
- **THEN** the `compose` step fails, naming the invariant

### Requirement: Theme

`@rind-ui/theme` SHALL style the Text Field in `text-field.css` through its `data-*`
attributes only, as family `field` of the theme-variants matrix (`outline` default,
`soft`; `sm`/`md`/`lg`). The input's boundary SHALL be at least 3:1 against its background
and visible in forced colors. The focus ring follows `theme-accessibility`, and the
invalid state adds a non-colour cue. The ClearTrigger's target SHALL be at least
24×24 CSS px, and the CharacterCount over the limit uses the danger role. It SHALL read
only `--rind-text-field-*` tokens with semantic fallbacks.

#### Scenario: Soft variant

- **WHEN** a Text Field has `data-variant="soft"`
- **THEN** it renders with the soft background and a boundary of at least 3:1

