## Purpose

Defines the rind-ui Combobox: a text input with a listbox popup whose value is a
selection of one or several options, built on `combobox-pattern` — how the input text
and the selection are reconciled, custom values, clearing, multiple selection with
chips, form participation, parts, `data-*` attributes and the contract.

## ADDED Requirements

### Requirement: Anatomy

The Combobox SHALL consist of: Root (no element of its own is required; it provides the
service), Label, Control (the anchor wrapping chips, input and buttons), Input, Trigger
(optional), ClearTrigger (optional), Positioner, Popup, List, Item, ItemText,
ItemIndicator, Group, GroupLabel, Separator, Empty, and in multiple mode Chips, Chip and
ChipRemove. Every part SHALL carry `data-scope="combobox"` and its `data-part`, and
SHALL accept element substitution (`render`) without changing behaviour.

#### Scenario: Minimal combobox

- **WHEN** a consumer renders Root, Label, Control, Input, Positioner, Popup, List and
  Items
- **THEN** it works with the keyboard and pointer, and a test finds it by role
  `combobox` and the label's text

### Requirement: Values

The Combobox SHALL have three controllable values following the machine runtime's
controllable semantics: `value` (the selected key, `string | null`, or `string[]` with
`multiple`), `inputValue` (the text) and `open`. Each change callback SHALL fire once per
user action with a reason (`item-press`, `enter`, `commit`, `clear`, `chip-remove`,
`reset`, `input-change`, `escape`, …). A parent refusing an `inputValue` proposal SHALL
leave the input showing the parent's text (the input is controlled by the machine, never
written imperatively).

#### Scenario: Consumer state matches the input (tailwindlabs/headlessui#1875)

- **WHEN** an outside press reverts the text of a combobox whose parent mirrors
  `inputValue`
- **THEN** `onInputValueChange` reported the reverted text, so the parent's state and the
  input agree

#### Scenario: Caret survives a controlled round-trip (mui/base-ui#2703)

- **WHEN** a parent controls `inputValue` and the user types in the middle of the text
- **THEN** the caret stays after the typed character

#### Scenario: Controlled text refused

- **WHEN** a parent ignores `onInputValueChange` and the user types "x"
- **THEN** the input keeps showing the parent's `inputValue`, with the caret where it was

### Requirement: Selection Updates The Text

In single mode, choosing an option SHALL set the selection and set the text to the
option's text value, then close (`closeOnSelect`, default true). Choosing the already
selected option SHALL keep it selected (no deselect) and close. In multiple mode,
choosing SHALL toggle the option, SHALL clear the text (`clearInputOnSelect`, default
true) and SHALL keep the popup open (`closeOnSelect` default false). Selection SHALL
follow `selection-model` (explicit `aria-selected`, disabled never selected,
`aria-multiselectable` in multiple mode).

#### Scenario: Choose in single mode

- **WHEN** the user types "ro" and clicks "Rome"
- **THEN** the value is "rome", the input shows "Rome", the popup closes and focus is in
  the input

#### Scenario: Highlight is not selection (chakra-ui/zag#2947)

- **WHEN** "Paris" is selected and the user arrows to "Rome"
- **THEN** "Paris" has `aria-selected="true"`, "Rome" has `aria-selected="false"`

### Requirement: Commit Of Typed Text

Text the user typed and did not resolve by choosing an option is uncommitted. It SHALL
be committed when the popup closes for any reason other than choosing (Escape, an
outside press, Tab, blur, Enter with no highlight), and on blur or Escape while closed,
with these rules
applied in order: text equal (locale-aware, case- and accent-insensitive) to exactly one
option's text value selects that option and takes its text; empty text clears a single
selection (unless `disallowEmptySelection`, then reverts); with `allowCustomValue` the
text is kept and a single selection becomes `null`; otherwise the text reverts to the
selected option's text, or to empty with no selection. A commit SHALL fire each change
callback at most once. In multiple mode, uncommitted text SHALL be cleared on commit
unless `allowCustomValue`.

#### Scenario: Every exit commits the same way (adobe/react-spectrum#4728)

- **WHEN** with `allowCustomValue` the same uncommitted text is left once by Tab, once by
  Shift+Tab, once by an outside press and once by Escape
- **THEN** the value and text after each are identical

#### Scenario: No callback without a change (adobe/react-spectrum#9874)

- **WHEN** a combobox with "Rome" selected and its text unchanged is focused and blurred
- **THEN** no change callback fires

#### Scenario: Multiple selection survives a custom-value commit (adobe/react-spectrum#9837)

- **WHEN** a multiple combobox with `allowCustomValue` has "Rome" and "Paris" selected and
  the user types "x" and presses Escape twice
- **THEN** "Rome" and "Paris" are still selected

#### Scenario: Blur reverts unmatched text (chakra-ui/ark#3526, the "input text reverts" class)

- **WHEN** "Rome" is selected, the user types "Romx" and tabs away without
  `allowCustomValue`
- **THEN** the input shows "Rome", the value is unchanged and no change callback fired

#### Scenario: Clearing the text clears the selection (tailwindlabs/headlessui#1339)

- **WHEN** "Rome" is selected, the user selects all text, deletes it and blurs
- **THEN** the value is `null`, the input is empty and `onValueChange` fired once with
  reason `commit`

#### Scenario: Custom value kept

- **WHEN** with `allowCustomValue` the user types "Atlantis" and presses Enter with nothing
  highlighted
- **THEN** the input keeps "Atlantis", the value is `null`, and the form is submitted
  only if the consumer did not prevent it

#### Scenario: Ambiguous text does not select (adobe/react-spectrum#7387)

- **WHEN** two options have the text "Alex Kim" and the user types "Alex Kim" and blurs
- **THEN** neither is selected, and the commit applies the remaining rules

#### Scenario: Exact text match commits

- **WHEN** the user types "rome" (no option highlighted) and blurs
- **THEN** "Rome" is selected and the input shows "Rome"

### Requirement: Text Follows External Changes Only When Not Dirty

When the selection changes from outside the user's typing (a controlled `value` change,
a form reset, a collection arriving that contains the selected key's text, or the
selected option's text changing), the text SHALL be updated to the selected option's
text only while the text is not uncommitted; uncommitted text SHALL NOT be overwritten
while the user is editing. A value provided before its collection SHALL show its text as
soon as the collection contains it.

#### Scenario: Async label arrives (chakra-ui/zag#1947, chakra-ui/ark#3523, mui/base-ui#3064)

- **WHEN** a combobox has `defaultValue="it"` and its collection arrives 300 ms later
- **THEN** the input shows "Italy" once the collection arrives

#### Scenario: Selection kept when async results drop it (mui/base-ui#3818)

- **WHEN** "Rome" is selected and a new search returns results without "Rome"
- **THEN** the value is still "rome", no change callback fired, and blurring keeps "Rome"
  as the text

#### Scenario: Parent changes the value while the user types (tailwindlabs/headlessui#1735)

- **WHEN** the user has typed "Fr" and the parent sets `value` to "de"
- **THEN** the input keeps "Fr" until the next commit, and `aria-selected` follows "de"

### Requirement: Clear

The ClearTrigger SHALL be a button named by the `clearLabel` message, `tabindex=-1`,
rendered only while there is text or a selection (`data-visible` otherwise absent), and
SHALL NOT take focus on press. Pressing it SHALL clear the text and the selection (all
chips in multiple mode) in one action with reason `clear`, keep focus in the input, and
leave the popup state unchanged.

#### Scenario: Clear with the mouse

- **WHEN** the user clicks the clear button of a combobox showing "Rome"
- **THEN** value and text are empty, `onValueChange` and `onInputValueChange` each fired
  once, and the input has focus

### Requirement: Trigger

The Trigger SHALL be a button (`button-like-element`) with `tabindex=-1`,
`aria-label` from `triggerLabel`, `aria-expanded`, `aria-controls` (while the listbox is
rendered) and `aria-haspopup="listbox"`. It SHALL NOT take focus on press; it SHALL
toggle the popup and move focus to the input (except on touch, where it SHALL NOT raise
the on-screen keyboard unless the input was already focused). It SHALL stay reachable to
the screen-reader cursor, which is how touch screen-reader users open the list.

#### Scenario: VoiceOver iOS opens the list

- **WHEN** a VoiceOver iOS user double-taps the trigger (a bare `click`)
- **THEN** the popup opens with the selected or first option highlighted

### Requirement: Multiple Selection With Chips

With `multiple`, the selected options SHALL be shown as chips through the shared
`input-chips` capability (same change) with scope `combobox`: one chip per selected key,
named by its option's text, inside the Control before the input, with every behaviour,
message and attribute of `input-chips` (toolbar, roving chips, ChipRemove, Backspace
arm-then-remove with `removeOnBackspace` default true, ArrowLeft into the chips, removal
focus, the summary node, `removedAnnouncement` on every platform, chips counting as inside
for the popup). Removing a chip SHALL deselect its option with reason `chip-remove`. The
default `tagsSummary(texts)` for Combobox SHALL list the selected options' text. Chips
SHALL NOT be composed from Tag Group.

#### Scenario: Backspace deselects the last option

- **WHEN** "Rome" and "Paris" are selected, the input is empty and the user presses
  Backspace twice
- **THEN** after the first press the "Paris" chip is highlighted, after the second
  `onValueChange` is called with `["Rome"]` and reason `chip-remove`, and focus is in the
  input

### Requirement: Form Participation

The Combobox SHALL take part in forms through `hidden-form-input`: with `name`, its
selected key is submitted (one entry per selected key in multiple mode); the visible
input SHALL have no `name` unless `inputName` is given, in which case the text is
submitted under that name. `required` SHALL be validated natively: an empty selection is
invalid, the browser's validation message is anchored near the Control, and an `invalid`
event or a focus on the hidden input SHALL move focus to the visible input. A form reset
SHALL restore the default value and its text. Browser autofill of the hidden input SHALL
select the option whose key, else whose text, equals the filled value.

#### Scenario: Key submitted, not text (adobe/react-spectrum#1690)

- **WHEN** a combobox named `country` with "Italy" (key "it") selected is submitted
- **THEN** the form data has `country=it` and no entry for the visible text

#### Scenario: Required multiple (mui/base-ui#2913, adobe/react-spectrum#9788)

- **WHEN** a required multiple combobox with one chip is submitted with an empty input
- **THEN** it is valid, and it is invalid once the chip is removed

#### Scenario: Browser autofill (adobe/react-spectrum#9057)

- **WHEN** the browser autofills the hidden input of a combobox named `country` with
  "Italy"
- **THEN** the option "Italy" is selected and the input shows "Italy"

#### Scenario: Required and empty

- **WHEN** a required combobox with no selection is in a form that the user submits
- **THEN** submission is blocked and focus is in the combobox input

#### Scenario: Reset restores the text (tailwindlabs/headlessui#2851)

- **WHEN** a combobox created with `defaultValue="it"` has "Rome" selected and its form is
  reset
- **THEN** the value is "it" and the input shows "Italy"

#### Scenario: Multiple values submitted (unovue/reka-ui#1861)

- **WHEN** a multiple combobox named `cities` with "rome" and "paris" selected is
  submitted
- **THEN** the form data has two `cities` entries, "rome" and "paris"

### Requirement: Disabled, Read-Only And Invalid

`disabled` SHALL disable the input natively, disable the buttons and make the popup
unopenable. `readOnly` SHALL make the input `readonly`; the popup SHALL still open and be
browsed, but no choice, clear, chip removal or text change SHALL happen. `invalid` SHALL
set `aria-invalid="true"` on the input.

#### Scenario: Read-only browse (mui/base-ui#5584)

- **WHEN** a read-only combobox is opened with ArrowDown and the user presses Enter on an
  option
- **THEN** the value does not change and the popup closes

### Requirement: Combobox Data Attributes

In addition to the pattern's attributes: Root and Control SHALL carry `data-state` (the
machine's open state; the Trigger's follows `aria-expanded`, like the Input's),
`data-focus` (focus anywhere in the component), `data-disabled`, `data-readonly`,
`data-invalid`, `data-empty-value` when nothing is selected; Item and ItemIndicator SHALL
carry `data-state` (`checked` | `unchecked`) and the collection item attributes; Chip
SHALL carry the `input-chips` attributes; ClearTrigger SHALL carry `data-visible` when it
has something to clear. Every part SHALL pass `data-variant` and `data-size` through unchanged.

#### Scenario: Selected item indicator

- **WHEN** "Rome" is selected
- **THEN** its Item and ItemIndicator carry `data-state="checked"` and the others
  `data-state="unchecked"`

### Requirement: Combobox Contract

`comboboxContract` SHALL locate an instance by role `combobox` and exact accessible name,
SHALL include the pattern contract and, with `multiple`, the `input-chips` contract
fragment (`removeChip(name)`, `chips()`), and SHALL add: actions `choose(name)` (collection
fragment, Enter or press), `clear()` (pointer: clear button; keyboard: select all text,
Delete, then blur), `blur()`; queries `value()` (selected option names);
the trait `form-associated`; declared `data-state` for the input, popup and each item;
and its event map with `{ skip }` reasons for programmatic events and `$sync:value`,
`$sync:inputValue` and `$sync:open` prop steps.

#### Scenario: Pick a country by keyboard

- **WHEN** a test runs `type("ita")` and `choose("Italy")` with the keyboard modality
- **THEN** the driver arrows to "Italy", presses Enter, and resolves when `value()` is
  `["Italy"]` and `inputValue()` is "Italy"

#### Scenario: Consumer wrapper drops aria-selected

- **WHEN** `testMachine` runs on a styled wrapper whose options omit `aria-selected` when
  unselected
- **THEN** the `selectable` invariant fails naming the option

### Requirement: Theme

`@rind-ui/theme` SHALL style the Combobox through tier-3 `--rind-combobox-*` tokens that
default to semantic tokens, selecting only on `data-scope`, `data-part`, `data-state` and
the other `data-*` attributes, including `data-variant` (`solid`, `soft`, `outline`,
`ghost`) and `data-size` (`sm`, `md`, `lg`) on Control, Popup, Item and Chip. Highlighted
and selected options SHALL be visible under `forced-colors: active` without relying on
background colour, and the trigger, clear button, options and chip remove buttons SHALL
meet a 24×24 CSS px target.

#### Scenario: Forced colors

- **WHEN** the theme is rendered with `forced-colors: active`
- **THEN** the highlighted option has a visible outline and the selected option a visible
  check glyph

### Requirement: Label Activation Focuses The Input

The Input and the Trigger SHALL declare the press option `labelActivation: "focus"`
(add-a11y-foundations `press-interactions`, following add-label's `label-interaction`
"Labels Focus Popup Triggers"). A click that the browser forwards from any label (the
combobox's Label, a Field's Label, a consumer `<label for>` or a wrapping `<label>`) SHALL
focus the Input and SHALL NOT open the popup, also when `openOnInputPress` is true
(radix#3679, headlessui#3787). A direct press on the Input or Trigger SHALL behave as
specified in Opening.

#### Scenario: Label click focuses the trigger and does not open it (headlessui#3787)

- **WHEN** a closed Combobox with `openOnInputPress` has a Label and the user clicks the
  Label's text
- **THEN** the Input is focused and the popup stays closed

#### Scenario: Wrapping label (radix#3679)

- **WHEN** a Combobox is wrapped in a `<label>`, opened by a press on its Trigger, and an
  option is pressed
- **THEN** the option is selected, the popup closes, and it does not open again

### Requirement: Field Control Binding

The Combobox SHALL implement add-field's `field-control` binding. Its Root SHALL read the
nearest Field's binding and register the Combobox with that Field exactly once (Input id, labelable Input, focus
operation on the Input, its constraint input as validity element, a reader for the value),
unmounting unregisters. A search input rendered inside the popup SHALL NOT receive the
Field's wiring (base-ui#4120).
The Field's ARIA SHALL be applied only to the registered Input: `aria-describedby`
with the Field's Description and, while rendered, ErrorMessage ids; `aria-invalid` (role
`combobox` allows it) while the Field displays invalid; `aria-required` from the Field.
Its `disabled`, `readOnly`, `required` and `invalid` SHALL be OR-merged with the Field's
and an enclosing Fieldset's (field-control "State Propagation"). It SHALL report each
accepted change and each commit (closing the popup is a commit) exactly once (field-control "Reporting Changes"), register a focus
target that focuses the Input, declare the `field-associated` trait, and add the Field prop × control
matrix test.

#### Scenario: Popup input does not inherit (base-ui#4120)

- **WHEN** a Combobox with an input inside its popup is in an invalid Field
- **THEN** only the registered Input carries `aria-invalid` and the Field's
  `aria-describedby` ids

#### Scenario: Disabled Field

- **WHEN** a Combobox is inside a disabled Field
- **THEN** it is disabled exactly as its own `disabled` prop makes it and does not open
