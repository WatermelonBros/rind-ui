## Purpose

Defines how items in a rind-ui collection are selected — modes, behaviours, ranges,
select all, disabled rules and persistence across collection changes — and how the
selection is exposed to assistive technology, once for every collection component.

## ADDED Requirements

### Requirement: Selection Modes And Behaviours

A collection component SHALL support `selectionMode` `none`, `single` or `multiple`, and
`selectionBehavior` `toggle` (each press adds or removes the item) or `replace` (a press
replaces the selection; mod+press toggles; Shift+press extends). With `none`, no
operation SHALL change the selection. With `single`, the selection SHALL contain at most
one key. `disallowEmptySelection` SHALL prevent any user action from leaving the
selection empty. "mod" SHALL be ⌘ on Apple platforms and Ctrl elsewhere, as reported by
the environment.

#### Scenario: Single replaces

- **WHEN** item "b" is pressed in single mode while "a" is selected
- **THEN** the selection is exactly {"b"}

#### Scenario: Replace behaviour with modifier

- **WHEN** in multiple mode with `replace` behaviour the user presses "a", then
  mod+presses "c"
- **THEN** the selection is {"a", "c"}

#### Scenario: Empty selection disallowed

- **WHEN** the only selected item is pressed again with `disallowEmptySelection`
- **THEN** it stays selected

### Requirement: Touch And Screen Reader Presses Toggle

In multiple mode with `replace` behaviour, a press whose modality is touch or virtual
(an assistive-technology activation with no pointer or key events) SHALL toggle the item
instead of replacing the selection, because those users have no modifier keys.

#### Scenario: VoiceOver selects a second item

- **WHEN** a screen reader activates "b" while "a" is selected in a multiple `replace`
  list
- **THEN** the selection is {"a", "b"}

### Requirement: Ranges From An Internal Anchor

The anchor for range selection SHALL be machine state, set by the last press or toggle
that did not extend, and SHALL NOT be stored on or derived from the controlled selection
value or from the highlighted key. Shift+press or Shift+navigation SHALL select every
selectable item between the anchor and the target in collection order, replacing the
range made by the previous extension rather than accumulating it.

#### Scenario: Controlled selection keeps ranges working

- **WHEN** a parent controls the selection by passing a new array on every change, the
  user presses "b", then Shift+presses "e"
- **THEN** the selection is {"b", "c", "d", "e"}

#### Scenario: Range shrinks

- **WHEN** after selecting "b" to "e" with Shift the user Shift+presses "c"
- **THEN** the selection is {"b", "c"}

#### Scenario: Hover does not move the anchor

- **WHEN** the pointer moves over "d" and "e" after the user pressed "b", then
  Shift+presses "c"
- **THEN** the selection is {"b", "c"}

### Requirement: Select All

In multiple mode, mod+A and a select-all action SHALL select every selectable item,
including items that are filtered out or not yet loaded, and SHALL be represented so
that it does not require enumerating unloaded items. Toggling select all when everything
is selected SHALL clear the selection unless `disallowEmptySelection` holds. A
Shift-extension that starts from a select-all state SHALL replace it with the range.

#### Scenario: Select all with unloaded pages

- **WHEN** the user presses mod+A in an async list with more pages to load
- **THEN** every item is reported selected, including items loaded afterwards

### Requirement: Disabled Items Are Never Selected By The User

No user action — press, toggle, range, select all, Space or Enter, or typeahead that
selects — SHALL add a disabled item to the selection. `disabledBehavior` `all` SHALL
make disabled items non-selectable and non-actionable; `selection` SHALL make them
non-selectable but focusable and actionable. A controlled selection that contains a
disabled key SHALL be rendered as given.

#### Scenario: Range across a disabled item

- **WHEN** "c" is disabled and the user selects the range "b" to "d"
- **THEN** the selection is {"b", "d"}

#### Scenario: Typeahead on a closed single select

- **WHEN** the user types the first letter of a disabled item on a closed select
  trigger
- **THEN** the selection does not change to that item

### Requirement: Selection Survives Collection Changes

A collection change SHALL NOT remove keys from the selection, so items that are
filtered out, not yet loaded or paged away stay selected, and their last known text
values SHALL remain available for labels. Removing an item on purpose (for example
deleting a tag) SHALL deselect it through an explicit operation. When a value is
provided before the collection that contains it arrives, the selected label SHALL appear
as soon as the collection does.

#### Scenario: Filtered out and back

- **WHEN** a selected item is filtered out and the filter is then cleared
- **THEN** the item is still selected and no change callback fired

#### Scenario: Value before data

- **WHEN** a select has `defaultValue="it"` and its collection arrives later
- **THEN** the trigger shows "Italy" once the collection arrives

### Requirement: Controlled Selection And Change Details

The selection SHALL be a controllable value (`value`, `defaultValue`,
`onValueChange(value, details)` in the component's own value shape) following the
machine runtime's controllable semantics. Details SHALL carry the reason (the event
type) and the key that triggered the change. A selection change SHALL fire the callback
once per user action, never for collection changes.

#### Scenario: One callback for a range

- **WHEN** a Shift+press selects five items
- **THEN** `onValueChange` is called once with all five keys

### Requirement: Selection State For Assistive Technology

In a selectable listbox, tree or grid, every selectable item SHALL carry
`aria-selected="true"` or `aria-selected="false"`, never absent; it SHALL reflect the
selection, never the highlight. Multiple-selection lists SHALL carry
`aria-multiselectable="true"` and SHALL NOT use `aria-checked` on `option` elements.
Items with a checked semantics (menu checkbox and radio items, radios, toggles) SHALL
use `aria-checked` or `aria-pressed` as their role requires. Disabled items SHALL carry
`aria-disabled="true"`.

#### Scenario: Unselected options

- **WHEN** a single-select listbox renders three options with "b" selected
- **THEN** "a" and "c" carry `aria-selected="false"` and "b" `aria-selected="true"`

#### Scenario: Highlight is not selection

- **WHEN** the highlight moves to "c" without selecting it
- **THEN** "c" keeps `aria-selected="false"`
