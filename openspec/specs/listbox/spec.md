# listbox Specification

## Purpose
Defines rind-ui's Listbox: an always-visible list of options with single, multiple or no
selection — its parts, attributes, keyboard and pointer behaviour per selection mode and
behaviour, actions, empty and loading states and the contract its driver and model-based
tests are generated from — and the listbox parts that Select and other popup components
reuse. Keys, navigation, typeahead, selection rules, repair, set metadata and the
virtualization contract are those of the `add-collections` capabilities and are not
restated. Follow-up (not yet delivered, tracked in docs/review-backlog.md): the virtual
screen-reader reading-order test, emulated forced-colors captures, a virtualized site example
and the manual assistive-technology pass.
## Requirements
### Requirement: Anatomy

The Listbox SHALL consist of: `root` (no element), `label` (`span`), `list` (`div`),
`item` (`div`), `item-text` (`span`), `item-description` (`span`), `item-indicator`
(`span`), `section` (`div`), `section-label` (`span`), `separator` (`div`), `empty`
(`div`) and `load-more` (`div`). Only `root`, `list` and `item` SHALL be required. Items
SHALL be authored as static parts or rendered from a data collection, producing the same
collection model. Every part SHALL accept the props of the element it renders and SHALL
support element substitution without a change in behaviour.

#### Scenario: Minimal listbox

- **WHEN** a consumer renders a root with `aria-label="Fruit"` on its list and three items
- **THEN** a list named "Fruit" with three options is rendered and is one Tab stop

#### Scenario: Data and static items agree

- **WHEN** the same three fruits are rendered once as static item parts and once from a
  data collection
- **THEN** both lists expose the same roles, names, keys, ids pattern and keyboard
  behaviour

### Requirement: Reusable Listbox Parts

The parts `list`, `item`, `item-text`, `item-description`, `item-indicator`, `section`,
`section-label`, `separator`, `empty` and `load-more`, their attributes, their keyboard
map and their pointer handling SHALL be provided as reusable listbox parts that another
component (Select first, later Combobox, Autocomplete, Command) renders under its own
`data-scope`. A component reusing them SHALL get every requirement of this capability
that concerns those parts without restating it, and SHALL only add or narrow behaviour
it declares (for example, closing its popup after a selection).

#### Scenario: Select reuses the parts

- **WHEN** Select renders its popup's options with the listbox parts
- **THEN** its options carry `data-scope="select"`, `role="option"`, explicit
  `aria-selected` and every `data-*` attribute this capability defines for `item`

### Requirement: Selection Modes, Behaviours And Value

The Listbox SHALL support `selectionMode` `single` (default), `multiple` and `none`, and
`selectionBehavior` `toggle` (default) and `replace`, with the semantics of the
`selection-model` capability. The selection SHALL be a controllable value (`value`,
`defaultValue`, `onValueChange(value, details)`) whose public shape is `string | null` in
single mode and `string[] | "all"` in multiple mode, `"all"` meaning every selectable
item including unloaded ones. With `selectionMode="none"` there SHALL be no value and no
selection state on items.

#### Scenario: Controlled single value

- **WHEN** a parent passes `value="pear"` and the user selects "Apple"
- **THEN** `onValueChange("apple", details)` is called once with `details.reason` and
  `details.key === "apple"`, and "Pear" stays selected until the parent applies it

#### Scenario: Select all is reported as "all"

- **WHEN** the user presses mod+A in a multiple listbox whose async collection has more
  pages to load
- **THEN** `onValueChange("all", details)` is called once and every loaded option has
  `aria-selected="true"`

### Requirement: Roles, Name And ARIA Attributes

The `list` SHALL have `role="listbox"` and SHALL be named by the `label` part through
`aria-labelledby` while the label is rendered, unless the consumer passes `aria-label`
or `aria-labelledby`; a list without a name SHALL produce a development warning naming
the component. It SHALL carry `aria-multiselectable="true"` only in multiple mode,
`aria-orientation="horizontal"` only when horizontal, and `aria-busy="true"` while
loading. Each `item` SHALL have `role="option"` and carry `aria-selected` as `"true"` or
`"false"` in `single` and `multiple` mode, never absent and never following the
highlight; with `selectionMode="none"` items SHALL carry no `aria-selected`. Disabled
items SHALL carry `aria-disabled="true"`. `item-indicator`, `item-description` and
`load-more` SHALL be `aria-hidden`; `section` SHALL have role `group` named by its
`section-label`; `separator` SHALL have `role="none"` (decorative, since `listbox` allows
only `option` and `group` children), built with add-separator's shared `separatorProps`
helper in the `listbox` context, carrying `data-orientation` and no `aria-orientation`.

#### Scenario: Explicit unselected state (regression: headlessui#1599, radix#1907)

- **WHEN** a single listbox renders "a", "b", "c" with "b" selected
- **THEN** "a" and "c" carry `aria-selected="false"` and "b" `aria-selected="true"`

#### Scenario: Highlight is not selection (regression: zag#2947)

- **WHEN** the user arrows from "b" to "c" in a `toggle` single listbox
- **THEN** "c" is focused, carries `data-highlighted` and keeps `aria-selected="false"`

#### Scenario: Action list has no selection state

- **WHEN** a listbox with `selectionMode="none"` renders search results
- **THEN** no option carries `aria-selected` and the list has no `aria-multiselectable`

#### Scenario: Separator is decorative inside the list (regression: mui/base-ui#5398, ariakit#3315)

- **WHEN** a listbox renders a `separator` between two sections and is checked with axe
- **THEN** the separator has `role="none"`, `data-orientation` and no
  `aria-orientation`, and `aria-required-children` passes

#### Scenario: Unnamed list (regression: mui/base-ui#5569)

- **WHEN** a listbox renders without a label part, `aria-label` or `aria-labelledby`
- **THEN** a development warning names the listbox and `testMachine` fails rule 1 on it

### Requirement: Option Content And Names

An option's accessible name SHALL come from its content and SHALL NOT be set with
`aria-labelledby` or `aria-label` by the component. The `item-text` part SHALL hold the
name and default the item's text value. The `item-description` part SHALL be referenced
from the option's `aria-describedby` while rendered and SHALL be `aria-hidden`, so its
text is the option's description and is not part of its name. Icons and other
decorative content inside an option SHALL NOT change its text value when the item
declares one. The listbox parts SHALL render phrasing elements (`span`) inside options,
and a development warning SHALL fire when an option contains an interactive element.

#### Scenario: Option with a description

- **WHEN** an option renders the text "Pro" and the description "For teams"
- **THEN** its accessible name is "Pro", its accessible description is "For teams", and
  it carries no `aria-labelledby` (regression: webkit 209279)

#### Scenario: Icon in an option

- **WHEN** an option renders an icon and the text "Delete" with text value "Delete"
- **THEN** typeahead for "d" highlights it and its accessible name is "Delete"

#### Scenario: Button inside an option

- **WHEN** a consumer renders a `<button>` inside an item part in development
- **THEN** a warning names the item and the nested interactive element

### Requirement: Focus

The Listbox SHALL use the `roving` focus strategy and SHALL be exactly one Tab stop as
the `collection-navigation` capability defines. When focus enters the list with no
highlighted item, the first selected navigable item SHALL be focused, else the first
navigable item, else the list itself. Leaving the list and coming back SHALL focus the
item that was last highlighted if it still exists.

#### Scenario: Tab into a list with a selection

- **WHEN** the user tabs into a listbox where "c" is selected and nothing was highlighted
- **THEN** "c" is focused and highlighted

#### Scenario: No focus on mount (regression: reka-ui#2056, react-spectrum#9803)

- **WHEN** a listbox mounts, including an empty one, next to a focused input
- **THEN** focus stays in the input

#### Scenario: Return to the last item

- **WHEN** the user arrows to "d", tabs out and shift-tabs back in
- **THEN** "d" is focused

### Requirement: Keyboard In Toggle Behaviour

With `selectionBehavior="toggle"`: arrow keys, Home, End, PageUp, PageDown and typeahead
SHALL move the highlight and focus without changing the selection. In single mode Space
and Enter SHALL select the focused item (replacing the selection). In multiple mode Space
and Enter SHALL toggle the focused item; Shift+ArrowDown and Shift+ArrowUp SHALL move and
extend the range from the anchor; Shift+Space SHALL select the range from the anchor to
the focused item; mod+A SHALL select all. Space SHALL join a typeahead search in progress
instead of selecting. Disabled items SHALL never be selected by any key.

#### Scenario: Navigation keys do not scroll the page (regression: react-spectrum#10720)

- **WHEN** the user presses Space, PageDown, End and Home in a listbox on a long page
- **THEN** the listbox handles each key and the page does not scroll

#### Scenario: Removing the focused option (regression: headlessui#3856)

- **WHEN** the focused option "b" of "a, b, c" is removed and the user presses ArrowDown
- **THEN** "c" was focused after the removal, ArrowDown does nothing, and nothing throws

#### Scenario: Space toggles in multiple mode

- **WHEN** the user presses Space on "a", ArrowDown twice, then Space on "c"
- **THEN** the selection is {"a", "c"} and `onValueChange` was called twice

#### Scenario: Shift+ArrowDown extends

- **WHEN** the user presses Space on "b" and then Shift+ArrowDown twice
- **THEN** the selection is {"b", "c", "d"}, "d" is focused, and each option toggled once

#### Scenario: Shift+Space from the anchor

- **WHEN** the user presses Space on "b", arrows to "e" and presses Shift+Space
- **THEN** the selection is {"b", "c", "d", "e"}

#### Scenario: Ranges with a controlled value (regression: react-spectrum#7947, react-spectrum#10147)

- **WHEN** a parent controls a multiple listbox by passing a new array on every change,
  and the user presses Space on "b" and then Shift+ArrowDown twice
- **THEN** the selection is {"b", "c", "d"}

### Requirement: Keyboard In Replace Behaviour

With `selectionBehavior="replace"`: arrow keys, Home, End, PageUp and PageDown SHALL move
focus and replace the selection with the focused item (selection follows focus); the same
keys with mod held SHALL move focus without selecting; mod+Space SHALL toggle the focused
item in multiple mode; Shift+arrows SHALL extend the range from the anchor; mod+A SHALL
select all in multiple mode. Typeahead SHALL move focus and, in single mode, select the
match. A focus change that no key caused (a screen reader moving its cursor, a
programmatic focus) SHALL NOT change the selection. With `disallowEmptySelection` unset,
mod+Space on the only selected item SHALL clear it.

#### Scenario: Selection follows focus

- **WHEN** "a" is selected in a single `replace` listbox and the user presses ArrowDown
- **THEN** "b" is focused and is the only selected item

#### Scenario: Mod+arrow moves without selecting

- **WHEN** "a" is selected in a multiple `replace` listbox and the user presses
  mod+ArrowDown, then mod+Space
- **THEN** the selection is {"a", "b"}

#### Scenario: Screen reader focus does not select (rule 13)

- **WHEN** a screen reader moves focus to "c" with no key event in a single `replace`
  listbox
- **THEN** the selection is unchanged

### Requirement: Pointer Selection

A press (on release) on an enabled item SHALL focus it and: in single mode select it; in
multiple `toggle` mode toggle it; in multiple `replace` mode replace the selection with
it, toggle it with mod held, and extend the range from the anchor with Shift held. A
touch or virtual press in multiple `replace` mode SHALL toggle, as the `selection-model`
capability defines. A press on a disabled item SHALL do nothing. Pointer movement SHALL
NOT highlight items (the list is not a popup); the highlight follows focus.

#### Scenario: Shift+click range (regression: zag#3347)

- **WHEN** in a multiple `replace` listbox the user clicks "b", moves the mouse over "f"
  and "g", and Shift+clicks "e"
- **THEN** the selection is {"b", "c", "d", "e"}

#### Scenario: Touch toggles

- **WHEN** a touch user taps "a" and then "c" in a multiple `replace` listbox
- **THEN** the selection is {"a", "c"}

#### Scenario: Text is not selected by Shift+click

- **WHEN** the user Shift+clicks an item to extend a range
- **THEN** no page text becomes selected

### Requirement: Actions

The Listbox SHALL accept `onAction(key, details)`. With `selectionMode="none"`, Enter
and a press on an enabled item SHALL call it once. With `selectionBehavior="replace"`,
Enter and a double click SHALL call it once while Space and single presses select. With
`selectionBehavior="toggle"` and a selection mode other than `none`, `onAction` SHALL be
a type error. Disabled items SHALL never call it.

#### Scenario: Result list (Reado SemanticModal)

- **WHEN** a listbox with `selectionMode="none"` lists search hits and the user arrows to
  the third hit and presses Enter
- **THEN** `onAction` is called once with the third hit's key and nothing is selected

#### Scenario: Open on double click in a file list

- **WHEN** in a single `replace` listbox the user double-clicks "notes.md"
- **THEN** "notes.md" is selected and `onAction` is called once with its key

### Requirement: Escape

Escape SHALL NOT change the selection or the highlight of a standalone listbox and SHALL
NOT be prevented, so it reaches the enclosing layer.

#### Scenario: Listbox inside a dialog

- **WHEN** focus is on a selected option of a listbox inside a dialog and the user
  presses Escape
- **THEN** the dialog closes and the selection is unchanged

### Requirement: Disabled

A disabled item SHALL carry `aria-disabled="true"` and `data-disabled`, SHALL be skipped
by navigation unless `focusableWhenDisabled`, and SHALL never be selected or actioned.
A disabled listbox (`disabled`) SHALL NOT be a Tab stop, SHALL ignore every key and press,
and SHALL carry `data-disabled` on every part; with `focusableWhenDisabled` it SHALL stay
reachable with `aria-disabled="true"` on the list.

#### Scenario: Disabled listbox is skipped (regression: react-spectrum#5837)

- **WHEN** a disabled listbox is between two buttons and the user presses Tab from the
  first
- **THEN** focus moves to the second button

### Requirement: Horizontal Orientation

With `orientation="horizontal"` the list SHALL use ArrowLeft and ArrowRight for previous
and next (mirrored in right-to-left), SHALL ignore ArrowUp and ArrowDown, and SHALL carry
`aria-orientation="horizontal"` and `data-orientation="horizontal"`.

#### Scenario: Horizontal attributes and keys (regression: reka-ui#1295, reka-ui#1297)

- **WHEN** a multiple horizontal listbox is rendered and the user presses ArrowRight
- **THEN** the list carries `aria-multiselectable="true"` and
  `aria-orientation="horizontal"`, and the second option is focused

#### Scenario: RTL horizontal list

- **WHEN** `dir="rtl"` and the user presses ArrowLeft on the first option of a horizontal
  listbox
- **THEN** the second option is focused

### Requirement: Empty State

The `empty` part SHALL render only while the collection has no items and not loading, as
a sibling after the `list`, never inside it. While it is rendered the `list` SHALL carry
`data-empty` and reference it with `aria-describedby`, and the list SHALL be the Tab
stop. No non-option element SHALL be rendered inside the `list` by the component.

#### Scenario: No results (regression: mui/base-ui#5443)

- **WHEN** a search listbox has no items and renders "No results"
- **THEN** the list contains no non-option children, focusing the list announces its name
  and the description "No results", and axe reports no `aria-required-children`
  violation

### Requirement: Loading And Virtualization

The Listbox SHALL accept the async status, `onLoadMore`, `virtualized` and
`scrollToIndex` props of the `collection-model` capability and behave as it defines.
The `load-more` part SHALL be the scroll sentinel: an `aria-hidden` element after the
last item that triggers `onLoadMore` when it scrolls into view while the status is
`idle`, and SHALL NOT be counted as an item. Loading text that the consumer renders SHALL
go in the `empty` part or outside the list.

#### Scenario: Infinite scroll

- **WHEN** the sentinel scrolls into view twice before a new collection arrives
- **THEN** `onLoadMore` is called once and the list carries `aria-busy="true"` while
  `loading-more`

### Requirement: Announcements

The Listbox SHALL NOT announce anything through the announcer; focus movement carries
option names and selection state.

#### Scenario: Navigating

- **WHEN** the user arrows through a listbox with a recording announcer
- **THEN** the announcement log is empty

### Requirement: Data Attributes

Every part SHALL carry `data-scope="listbox"` (or the reusing component's scope),
`data-part` (its part name) and `data-instance`. Additionally, beyond the collection part
attributes the `collection-model` capability defines:

- `list`: `data-orientation`, `data-selection-mode` (`single` | `multiple` | `none`),
  `data-focus` and `data-focus-visible` while focus is inside, `data-disabled`,
  `data-loading`, `data-empty`.
- `item`: `data-key`, `data-highlighted`, `data-selected`, `data-disabled`,
  `data-focus-visible`, `data-state` (`selected` | `unselected`, absent in `none` mode).
- `item-indicator`: `data-state`, rendered only while its item is selected unless
  `keepMounted`.
- `label`, `empty`: `data-disabled`.

`item-text`, `item-description`, `section`, `section-label`, `separator` and `load-more`
SHALL carry only the scoping attributes and the collection attributes.

#### Scenario: Styling the selected row

- **WHEN** "b" is selected and focused by keyboard
- **THEN** its element carries `data-selected`, `data-state="selected"`,
  `data-highlighted` and `data-focus-visible`

### Requirement: Listbox Contract

The `listbox` contract SHALL locate an instance by its list's role `listbox` and exact
accessible name, SHALL include the collection contract fragment with item role `option`,
strategy `roving` and selection keys Space and Enter, and SHALL declare the traits
`composite-roving`, `selectable` (except in `none` mode), `set-metadata` when
virtualized and `directional` when horizontal (a contract is static: it declares all four and
exports `listboxTraits(props)`, which a run of one props class swaps in). Beyond the fragment it SHALL declare the
action `act(name)` (pointer press or Enter; postcondition: `onAction` observed through the
fixture's recorder; the model maps `ACTION` to a skip, since a replace list's Enter and double
press are scenario tests) and the queries `isEmpty()` and `selectionMode()`. Programmatic
selection changes SHALL map to `{ skip: reason }` and `$sync:value` to a prop step.

#### Scenario: Driver round trip

- **WHEN** a test runs `const l = getListbox(screen, { name: "Toppings" })`,
  `await l.toggle("Olives")`, `await l.chooseRange("Ham", "Olives")`
- **THEN** each action resolves after its postcondition and `await l.selected()` lists
  the items from "Ham" to "Olives"

#### Scenario: Same test in Playwright

- **WHEN** the same test runs with `page`
- **THEN** it passes unchanged

### Requirement: Model-Based Coverage

`testMachine` over the listbox contract SHALL cover every transition in every declared
modality including `virtual`, with props classes single `toggle`, single `replace`,
multiple `toggle`, multiple `replace`, `none` with `onAction`, and horizontal under
`dir="rtl"`, combined with the collection argument classes, and SHALL pass every generic,
accessibility and collection invariant.

#### Scenario: Wrapper breaks the selection state

- **WHEN** a consumer wrapper drops `aria-selected` from unselected options and runs
  `testMachine`
- **THEN** the first step fails, naming the option and the attribute

