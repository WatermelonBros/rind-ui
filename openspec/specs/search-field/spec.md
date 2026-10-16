# search-field Specification

## Purpose
Defines rind-ui's Search Field: a Text Field with search semantics — a `searchbox` input,
Escape to clear, Enter to search, one clear control — that never breaks IME input and never
steals Escape from an enclosing layer when there is nothing to clear. Introduced by
`add-search-field`.
## Requirements
### Requirement: Anatomy

The Search Field SHALL consist of Text Field's `root`, `label`, `description`,
`error-message`, `input` and optional `clear-trigger` parts (no `textarea`), and SHALL behave
as a Text Field in every respect not specified here (value and `details`, IME, Field
integration, ClearTrigger focus rules, CharacterCount when rendered). The input SHALL render
`type="search"` (role `searchbox`) and `enterKeyHint="search"` unless the consumer sets them.

#### Scenario: Searchbox

- **WHEN** a Search Field with a Label "Search books" and an Input is rendered
- **THEN** exactly one element has role `searchbox` and its accessible name is "Search books"

#### Scenario: Icon-only search box

- **WHEN** a Search Field has no Label and its Input has `aria-label="Search"`
- **THEN** the searchbox is named "Search" and no development warning is emitted

### Requirement: Escape Clears

When Escape is pressed in the input, not composing, and the value is non-empty and the field
is neither disabled nor read-only, the Search Field SHALL clear the value through the same
path as the ClearTrigger (`onValueChange("", { reason: "ESCAPE" })`, one bubbling `input`
event, Field validation), keep focus in the input, and call `preventDefault()` and stop the
key, so an enclosing dismissable layer stays open and the browser's own clearing does not run.
When the value is empty, or the field is disabled or read-only, Escape SHALL NOT be handled.

#### Scenario: Clear inside a dialog (dismissable-layer "Inner widget consumes Escape")

- **WHEN** a Search Field holding "tolkien" is inside an open Dialog and Escape is pressed
- **THEN** the value is "", focus is in the input, and the Dialog stays open

#### Scenario: Empty field lets the dialog close (react-spectrum#5480)

- **WHEN** Escape is pressed in an empty Search Field inside an open Dialog
- **THEN** the Dialog closes

#### Scenario: Escape during composition (react-spectrum#10249)

- **WHEN** a user composing Korean text presses Escape to cancel the composition
- **THEN** the composition is cancelled by the IME and the field's value is not cleared

### Requirement: Enter Submits

When Enter is pressed in the input and is not marked `composing`, the Search Field SHALL call
`onSubmit(value, details)` once, with the native event in `details`, and SHALL NOT prevent the
browser's implicit form submission; a consumer that wants to prevent it calls
`details.event.preventDefault()`. Enter SHALL also be reported to the Field as a commit.

#### Scenario: IME commit is not a search (react-spectrum#6421)

- **WHEN** a user composing Chinese text presses Enter to commit "被送出"
- **THEN** the input shows "被送出" and `onSubmit` was not called; a second Enter calls
  `onSubmit("被送出")`

#### Scenario: Search form

- **WHEN** a Search Field `name="q"` inside a form with an `onSubmit` prop receives Enter
- **THEN** `onSubmit` is called once and the form submits with `q` in its data

### Requirement: Clear Trigger

The ClearTrigger SHALL be Text Field's ClearTrigger (rendered only when the value is non-empty
and editable, out of the tab order, press without focus, clearing through the change path with
reason `CLEAR`), named `messages.clear` ("Clear search"). Escape SHALL be its keyboard
equivalent. A clear SHALL re-validate the Field.

#### Scenario: Clear re-validates (react-spectrum#7265)

- **WHEN** a Search Field with `minLength={3}` displays a `tooShort` error for "ab" and the
  ClearTrigger is pressed
- **THEN** the value is "", the Field re-validates, and the stale `tooShort` error is gone

### Requirement: Native Cancel Button

While a ClearTrigger part is mounted, the browser's own search cancel button
(`::-webkit-search-cancel-button`) SHALL be hidden through the injected style, so the field
has one clear control; without a ClearTrigger the native button SHALL be left as the browser
draws it.

#### Scenario: One clear control in Chromium

- **WHEN** a Search Field with a ClearTrigger holds text in Chromium
- **THEN** the native cancel button is not displayed and the ClearTrigger is

### Requirement: Messages

The Search Field SHALL take a typed `messages` object with English defaults, merged with Text
Field's, where `clear` defaults to "Clear search". No string reaching assistive technology
SHALL be hard-coded outside `messages`.

#### Scenario: Localised clear

- **WHEN** `messages={{ clear: "Cancella ricerca" }}` is set and the field holds text
- **THEN** the ClearTrigger is named "Cancella ricerca"

### Requirement: Data Attributes

Every part SHALL carry `data-scope="search-field"`, its `data-part` and `data-instance`, and
Text Field's state attributes. Root and Input SHALL carry `data-empty` while the value is
empty. The Input SHALL carry `data-custom-clear` while a ClearTrigger is mounted.
`data-variant` and `data-size` SHALL pass through untouched.

#### Scenario: Empty attribute

- **WHEN** the user clears the field
- **THEN** Root and Input carry `data-empty`

### Requirement: Contract

The Search Field SHALL ship a contract with scope `search-field`, anatomy `root`, `label`,
`description`, `error-message`, `input`, `clear-trigger`, located by role `searchbox` and
exact accessible name, with:

- actions: Text Field's `type`, `fill`, `compose`, `blur`; `clear` (pointer: the ClearTrigger;
  keyboard: Escape); `escape` (keyboard; pointer declared none with the reason "Escape is a
  key"); `submit` (keyboard Enter; pointer declared none with the reason "submitting is the
  form's button, not the field's");
- queries: `value()`, `isEmpty()`, `isClearable()`, `description()`, `isInvalid()`;
- states: Text Field's `idle`, `composing`;
- events: Text Field's mappings, `ESCAPE` → `escape`, `SUBMIT` → `submit`, prop steps
  `$sync:value`;
- traits: `field-associated`.

#### Scenario: Keyboard twin of clear

- **WHEN** `getSearchField(screen, { name: "Search books" }).via("keyboard").clear()` runs on a
  field holding "a"
- **THEN** Escape is pressed and the action resolves once `value()` is ""

### Requirement: Search Field Invariants

The contract SHALL ship invariants checked after every model step: exactly one `searchbox`;
`data-empty` holds exactly when the input's value is empty (the oracle does not model typed
text). `@rind-ui/testing` SHALL ship `searchFieldStepInvariants` (they read each step's key
events): an Escape on a non-empty editable field left focus in the input and called
`preventDefault()`; an Escape on an empty or non-editable field did not; no key marked
`composing` (the event's or the component's composition) called `onSubmit` or cleared the
value.

#### Scenario: Broken variant always consumes Escape

- **WHEN** a consumer variant prevents every Escape
- **THEN** the Escape step on an empty field inside a Dialog fails, naming the Escape invariant

### Requirement: Theme

`@rind-ui/theme` SHALL style the Search Field in `search-field.css` as family `field` (Text
Field's look; `outline` default, `soft`; `sm`/`md`/`lg`) through its `data-*` attributes and
`--rind-search-field-*` tokens with semantic fallbacks: a leading icon slot, the ClearTrigger
with at least a 24×24 CSS px hit area, a transparent background and a `currentColor` glyph
(react-spectrum#4141), the native search decorations reset, and visibility under forced colors.

#### Scenario: Clear trigger in forced colors (react-spectrum#4141)

- **WHEN** a Search Field holding text is rendered under forced colors
- **THEN** the field boundary and the ClearTrigger glyph are visible and the trigger does not
  cover the boundary

