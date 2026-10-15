## Purpose

Defines the rind-ui Autocomplete: a text input whose value is its text, offering
suggestions in a listbox popup built on `combobox-pattern` — choosing a suggestion fills
the input, nothing is selected and any text is valid — with its modes, Enter and form
behaviour, parts, `data-*` attributes and contract.

## ADDED Requirements

### Requirement: Built On The Combobox Pattern

The Autocomplete SHALL implement every requirement of `combobox-pattern` (roles, focus,
opening, highlight while typing, inline completion, IME, Enter/Escape/Tab, filtering,
results while closing, async and stale results, empty state, set metadata,
announcements, popup placement, virtualization, pointer highlight, option activation,
data attributes, messages and contract) with the differences stated below, and SHALL use
the Combobox machine with no selection (`selectionMode: "none"`), not a machine of its
own.

#### Scenario: No announcer gap (adobe/react-spectrum#10326)

- **WHEN** on Safari on macOS the user arrows to a suggestion
- **THEN** the same focus announcement as Combobox is made

#### Scenario: Same IME rule as Combobox

- **WHEN** a user composing Japanese presses Enter to accept a candidate while a
  suggestion is highlighted
- **THEN** the input contains the composed text, no suggestion fills it and no form is
  submitted

### Requirement: Anatomy

The Autocomplete SHALL consist of Root, Label, Control, Input, Trigger (optional),
ClearTrigger (optional), Positioner, Popup, List, Item, ItemText, Group, GroupLabel,
Separator and Empty, each carrying `data-scope="autocomplete"` and its `data-part`, and
accepting element substitution without changing behaviour. The Separator SHALL have
`role="none"` (decorative), built with add-separator's shared `separatorProps` helper in
the `listbox` context.

#### Scenario: Minimal autocomplete

- **WHEN** a consumer renders Root, Label, Input, Positioner, Popup, List and Items
- **THEN** a test finds it by role `combobox` and the label's text and can type and choose

#### Scenario: Separator between suggestion groups (regression: mui/base-ui#5398)

- **WHEN** an open popup shows a Separator between two groups and is checked with axe
- **THEN** the separator has `role="none"` and `aria-required-children` passes

### Requirement: The Value Is The Text

The Autocomplete SHALL have the controllable values `value` (the input text, a string)
and `open`. Every text change by the user SHALL propose a new `value` with reason
`input-change`. There SHALL be no selection: options SHALL carry
`aria-selected="false"`, the listbox SHALL NOT carry `aria-multiselectable`, and no
option SHALL carry `data-selected`. Blur, Tab, an outside press, closing the popup and a
change of the suggestions SHALL NOT change the value.

#### Scenario: Free text survives blur (unovue/reka-ui#779)

- **WHEN** the user types "Atlantis", which matches no suggestion, and tabs away
- **THEN** the value is "Atlantis" and no change callback fired on blur

#### Scenario: Options never read as selected (tailwindlabs/headlessui#1599)

- **WHEN** the popup lists three suggestions
- **THEN** each has `aria-selected="false"`

### Requirement: Choosing Fills The Input

Choosing a suggestion (Enter on the highlighted one, or a press) SHALL set `value` to the
suggestion's text value with reason `item-press` or `enter`, place the caret at the end,
close the popup (`closeOnChoose`, default true) and keep focus in the input. It SHALL
report the chosen key in the change details. A suggestion rendered as a link SHALL
navigate natively instead of filling.

#### Scenario: Pick a suggestion

- **WHEN** the user types "ro" and presses Enter on the highlighted "Rome"
- **THEN** the value is "Rome", the details carry the key of "Rome", the popup closes and
  the caret is after "Rome"

### Requirement: Modes

The `mode` prop SHALL set filtering and inline completion together and SHALL be mirrored
in `aria-autocomplete`: `list` (default; suggestions filtered by the text, no completion,
`aria-autocomplete="list"`), `both` (filtered and completed, `"both"`), `inline`
(suggestions not filtered, completed, `"inline"`), `none` (neither, `"none"`). With
completion, the completed text SHALL be shown but SHALL NOT be proposed as `value` until
the user accepts it (Enter, Tab with `selectOnTab`, or blur, which accepts a shown
completion) or types on; filtering SHALL use the typed text.

#### Scenario: Static suggestions

- **WHEN** `mode` is `none` and the user types "zz"
- **THEN** every suggestion is still listed and the input has `aria-autocomplete="none"`

#### Scenario: Completion is not the value until accepted

- **WHEN** in mode `both` the user types "ca" and the input shows "canada" with "nada"
  selected
- **THEN** `value` is "ca", and after Enter `value` is "Canada"

### Requirement: Enter And Forms

The visible input SHALL be the form control: it SHALL carry `name`, `form`, `required`,
`disabled`, `readOnly` and the `formAutoComplete` value as its native `autocomplete`
attribute when given (`off` otherwise), and SHALL take part in submission, constraint
validation, reset and implicit submission natively, with no hidden input. Enter with a
highlighted suggestion SHALL fill and SHALL prevent submission unless `submitOnChoose` is
set, in which case the form SHALL be submitted after the value is updated; Enter with no
highlight SHALL close the popup and SHALL NOT prevent submission. A form reset SHALL
restore the default value.

#### Scenario: Search on Enter (chakra-ui/zag#2521, adobe/react-spectrum#6228)

- **WHEN** the user types "rust" in a search form and presses Enter with nothing
  highlighted
- **THEN** the form is submitted with the input's name and "rust"

#### Scenario: Submit on choose

- **WHEN** with `submitOnChoose` the user presses Enter on the highlighted "Rome"
- **THEN** the form is submitted once and the submitted text is "Rome"

#### Scenario: Value in the form data (mui/base-ui#4724)

- **WHEN** an autocomplete named `q` whose popup has never opened is submitted with "rust"
- **THEN** the form data has `q=rust`

#### Scenario: One control for assistive technology

- **WHEN** a test locates the autocomplete by role `combobox` and its name
- **THEN** exactly one element matches and it has the `name` attribute

### Requirement: Escape And Clear

Escape SHALL follow `combobox-pattern` except that a closed autocomplete has nothing to
revert: with `clearOnEscape` (default false) Escape on a closed autocomplete with text
SHALL clear it (reason `escape`) and SHALL be handled; otherwise it SHALL be left
unhandled. The ClearTrigger SHALL clear the text with reason `clear`, keep focus in the
input, and SHALL be rendered with `data-visible` only while there is text.

#### Scenario: Escape keeps free text (mui/base-ui#4245)

- **WHEN** a closed autocomplete without `clearOnEscape` shows "Atlantis" and the user
  presses Escape
- **THEN** the value is still "Atlantis"

#### Scenario: Escape in a dialog

- **WHEN** a closed autocomplete with text, without `clearOnEscape`, is inside a modal
  dialog and the user presses Escape
- **THEN** the dialog closes and the text is unchanged

### Requirement: Autocomplete Data Attributes

In addition to the pattern's attributes, Root and Control SHALL carry `data-state`,
`data-focus`, `data-disabled`, `data-readonly`, `data-invalid` and `data-empty-value`
while the text is empty; every part SHALL pass `data-variant` and `data-size` through
unchanged.

#### Scenario: Empty value

- **WHEN** the input is empty
- **THEN** Root and Control carry `data-empty-value`, and typing removes it

### Requirement: Autocomplete Contract

`autocompleteContract` SHALL locate an instance by role `combobox` and exact accessible
name, include the `combobox-pattern` contract, and add the actions `choose(name)` and
`clear()` and the query `value()` (the text); its traits SHALL be
`composite-activedescendant` (with the three announcement declarations), `set-metadata`,
`layer`, `presence` and `anchored`, plus a per-component invariant that every option
carries `aria-selected="false"`. That invariant SHALL be `optionsNeverSelected` imported
from the `combobox-pattern` module, not declared by Autocomplete. Its event map SHALL map
`$sync:value` and `$sync:open` to prop steps, and SHALL skip every `input-chips` event of
the shared combobox machine, `CHIP.TYPE` included (`{ skip: "no chips in autocomplete" }`).

#### Scenario: Driver test

- **WHEN** a test runs `type("ro")`, `choose("Rome")` and reads `value()`
- **THEN** `value()` is "Rome" and `isOpen()` is false

#### Scenario: Chip events are skipped

- **WHEN** `testMachine` walks `autocompleteContract` against the shared combobox machine
  with `selectionMode: "none"`
- **THEN** `CHIP.NAVIGATE`, `CHIP.REMOVE`, `CHIP.TYPE` and `BACKSPACE_EMPTY` are reported
  as skipped, no step fails for a missing chip action, and the never-selected invariant
  is the `combobox-pattern` module's `optionsNeverSelected`

### Requirement: Theme

`@rind-ui/theme` SHALL style the Autocomplete through tier-3 `--rind-autocomplete-*`
tokens defaulting to semantic tokens (sharing the Combobox token defaults), selecting
only on `data-*` attributes including `data-variant` and `data-size`, with highlight
visible under `forced-colors: active` and 24×24 CSS px targets for the trigger, clear
button and options.

#### Scenario: Forced colors

- **WHEN** the theme is rendered with `forced-colors: active`
- **THEN** the highlighted suggestion has a visible outline

### Requirement: Field Control Binding

The Autocomplete SHALL implement add-field's `field-control` binding. Its Root SHALL read the
nearest Field's binding and register the Autocomplete with that Field exactly once (Input id, labelable Input, focus
operation on the Input, the Input itself as validity element, a reader for the text),
unregistering on unmount.
The Field's ARIA SHALL be applied only to the registered Input: `aria-describedby`
with the Field's Description and, while rendered, ErrorMessage ids; `aria-invalid` (role
`combobox` allows it) while the Field displays invalid; `required` from the Field.
Its `disabled`, `readOnly`, `required` and `invalid` SHALL be OR-merged with the Field's
and an enclosing Fieldset's (field-control "State Propagation"). It SHALL report each
accepted change (with whether it is composing) and each commit (Enter, closing the popup) exactly once (field-control "Reporting Changes"), register a focus
target that focuses the Input, declare the `field-associated` trait, and add the Field prop × control
matrix test.

#### Scenario: Autocomplete in an invalid, required Field

- **WHEN** an Autocomplete with no props of its own is inside a required Field that
  displays an error
- **THEN** its Input is `required`, has `aria-invalid="true"`, and its
  `aria-describedby` contains the ErrorMessage id

#### Scenario: Composition is reported as composing

- **WHEN** the user types with an IME inside an Autocomplete in a Field in `change` mode
- **THEN** the changes during composition are reported as composing and the Field does
  not validate until the composition ends
