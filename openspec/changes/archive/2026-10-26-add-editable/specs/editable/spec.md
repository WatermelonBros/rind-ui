## ADDED Requirements

### Requirement: Editable Anatomy

An Editable SHALL consist of `Root`, `Preview` (a native `<button type="button">`) and `Input`,
with optional `Label`, `Area`, `Control`, `EditTrigger`, `SubmitTrigger` and `CancelTrigger`
(buttons). The Preview SHALL be named by the Label and its shown value; the Input SHALL be
labelled by the Label. A hidden form input SHALL carry the committed value.

#### Scenario: Preview named by its value (regression: Zag's "edit")

- **WHEN** an Editable labelled "Title" with value "Q3 plan" is in preview
- **THEN** a button named "Title Q3 plan" is rendered

### Requirement: Editable States

The Editable SHALL be in `preview` or `edit` (controllable `edit`). Entering edit SHALL save the
committed value and start the draft from it. Submit SHALL commit the draft as the value and
return to preview; cancel SHALL restore the saved value to the draft and return to preview.
Disabled and read-only SHALL never enter edit. `onEditChange` and `onValueChange` SHALL carry the
reason; a cancelled `onEditChange` SHALL keep the current state.

#### Scenario: Escape restores the value at entry (regression: zag#3510)

- **WHEN** the value is "A", edit begins, "B" is typed, and Escape is pressed
- **THEN** the state is `preview` and the value is "A"

#### Scenario: Veto keeps editing

- **WHEN** `onEditChange` cancels the change for reason `enter-key`
- **THEN** the state stays `edit`

### Requirement: Editable Activation

`activationMode` SHALL default to `click` (a press on the Preview enters edit); `dblclick`,
`focus` and `none` SHALL be supported. Enter and Space on the Preview SHALL enter edit in every
mode except `none`.

#### Scenario: No edit on focus by default (regression: reka#1016, WCAG 3.2.1)

- **WHEN** the Preview receives focus with Tab
- **THEN** the state is still `preview`

### Requirement: Editable Keys

On the Input, Enter SHALL submit (Ctrl or ⌘+Enter in a textarea, where Enter is a newline),
Escape SHALL cancel, and no key SHALL act while composing. Space SHALL never submit.

#### Scenario: Space types (regression: reka#1008)

- **WHEN** Space is pressed in the Input
- **THEN** a space is typed and the state stays `edit`

### Requirement: Editable Outside Press

An outside press, or the focus moving outside the Root, SHALL be tracked only while editing; with `submitMode` `both` (default) or
`blur` it SHALL submit, with `enter` or `none` it SHALL cancel. A press on the Submit or Cancel
trigger SHALL NOT count as outside; the window losing focus SHALL NOT count.

#### Scenario: Tab out submits

- **WHEN** "B" is typed and Tab moves the focus out of the Editable
- **THEN** the value is "B" and the state is `preview`

#### Scenario: Blur submits by default

- **WHEN** "B" is typed and the pointer presses outside
- **THEN** the value is "B" and the state is `preview`

### Requirement: Editable Focus

Entering edit SHALL focus the Input and select its text (`selectOnFocus`, default true); leaving
edit by a key or a trigger SHALL focus the Preview.

#### Scenario: Back to the preview

- **WHEN** Enter submits
- **THEN** the Preview has the focus

### Requirement: Editable Data Attributes

Every part SHALL carry `data-scope="editable"`, `data-part`, `data-instance`, `data-state`
(`preview`, `edit`), and when they apply `data-empty`, `data-disabled`, `data-readonly`,
`data-invalid`; Preview and Input SHALL carry the focus attributes.

#### Scenario: Empty

- **WHEN** the value is ""
- **THEN** the Preview has `data-empty` and shows the placeholder

### Requirement: Editable Messages

The strings SHALL come from `messages`: `edit`, `submit`, `cancel` (the triggers' names before
the Label), with English defaults.

#### Scenario: Localised trigger

- **WHEN** `messages.edit` is "Modifica"
- **THEN** the EditTrigger is named "Modifica Title"

### Requirement: Editable Contract

The contract SHALL locate by the Label's text and provide the actions `edit`, `type`, `submit`,
`cancel` and the queries `isEditing`, `value`, `draft`, `previewText`.

#### Scenario: Driver

- **WHEN** a test calls `edit()`, `type("New")` and `submit()`
- **THEN** `value()` is "New" and `isEditing()` is false

### Requirement: Editable Theme

`@rind-ui/theme` SHALL style the Editable in the `field` family: the Preview and the Input share
one cell so the layout does not jump, the Preview shows a hover hint, and the placeholder meets
4.5:1.

#### Scenario: No jump

- **WHEN** the state switches from preview to edit
- **THEN** the Area's height does not change
