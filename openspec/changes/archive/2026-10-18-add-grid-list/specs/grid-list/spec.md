## Purpose

Defines rind-ui's Grid List: a list (or wrapped grid of cards) of selectable, actionable
rows that may contain controls — its parts, ARIA shape, selection versus action rules,
checkboxes, controls, links, empty and loading states, announcements, attributes and the
contract its driver and model-based tests are generated from. Keys, selection rules,
navigation, typeahead, repair, set metadata and virtualization are those of the
`add-collections` capabilities; focus between a row and its controls and spatial moves are
`collection-grid`; neither is restated.

## ADDED Requirements

### Requirement: Anatomy

The Grid List SHALL consist of: `root` (no element), `label` (`span`), `list` (`div`),
`item` (`div`, the row), `item-cell` (`div`, created by `item`), `item-text` (`span`),
`item-description` (`span`), `item-checkbox` (`input type="checkbox"`), `item-control`
(any element, by `render`), `empty` (`div`) and `load-more` (`div`). Only `root`, `list`
and `item` SHALL be required. Items SHALL be authored as static parts or rendered from a
data collection, producing the same collection model. Every part SHALL accept the props of
the element it renders and SHALL support element substitution without a change in
behaviour.

#### Scenario: Minimal list

- **WHEN** a consumer renders a list named "Candidates" with three rows
- **THEN** a `grid` named "Candidates" with three `row`s each containing one `gridcell` is
  rendered, and it is one Tab stop

#### Scenario: Data and static items agree

- **WHEN** the same rows are rendered statically and from a collection
- **THEN** roles, names, keys and keyboard behaviour are identical

### Requirement: Roles And Names

The list SHALL have role `grid`, a name from the Label part, `aria-label` or
`aria-labelledby` (a development warning when missing), `aria-multiselectable="true"` in
multiple mode, and, when virtualized, `aria-rowcount` and `aria-colcount="1"`. Each item
SHALL have role `row` with `aria-selected` explicit when selectable (never when the mode is
`none`), `aria-disabled` when disabled, `aria-rowindex` when virtualized, and each
`item-cell` role `gridcell`. An empty list SHALL render the list with role `group`, keep its
name and contain the Empty part; it SHALL never be an empty `grid`. The list SHALL be the
Tab stop only while empty and only when the Empty part holds no tabbable element.

#### Scenario: Empty list (react-spectrum#8354 pattern)

- **WHEN** the last row is removed by the consumer
- **THEN** the list has role `group`, keeps its name, shows the Empty content, and axe
  reports no `aria-required-children` violation

#### Scenario: Virtualized metadata

- **WHEN** a 10,000-row list is virtualized and 20 rows are mounted
- **THEN** the list has `aria-rowcount="10000"` and each mounted row its `aria-rowindex`,
  `aria-posinset` and `aria-setsize`

### Requirement: Controls

An `item-control` SHALL be an element of the row the component manages: it SHALL have
`tabIndex` by `collection-grid`, SHALL inherit its row's disabled state (disabled
natively or `aria-disabled`, not pressable, not tabbable), and SHALL register for child
navigation. A press that begins on a control SHALL NOT select or act the row. Plain
focusable elements inside a row that are not `item-control` SHALL produce a development
warning naming them (a link needs `render` through `item-control`).

#### Scenario: Disabled row disables its buttons (react-spectrum#6323)

- **WHEN** a disabled row contains a button control
- **THEN** the button is disabled, not tabbable and a press does nothing

#### Scenario: Foreign focusable

- **WHEN** a row contains a bare `<a href>` that is not an `item-control`
- **THEN** a development warning names it

### Requirement: Selection Checkbox

An `item-checkbox` SHALL be a native checkbox that is an `item-control`, `checked` while
its row is selected, named "Select" plus the row's name (`aria-labelledby` to the checkbox's
own id and the row's text id), toggling its row on change in every selection mode and
every behaviour (a checkbox always toggles; it overrides `replace`, as a documented
difference from keyboard rows). While a row has an `item-checkbox`, a press on the row body
SHALL NOT change the selection; Space on the row still toggles it. A list in `multiple`
mode with a checkbox SHALL also expose a select-all control only when the consumer renders
`item-checkbox` with `all` on the root (checked, `mixed` or unchecked from the selection).

#### Scenario: Row press does not select (react-spectrum#9610)

- **WHEN** a row with a checkbox and no `onAction` is clicked on its text
- **THEN** the selection does not change and the text can be selected with the pointer

#### Scenario: Checkbox override

- **WHEN** the list is `replace` and the user checks a second row's checkbox
- **THEN** both rows are selected

#### Scenario: Name

- **WHEN** the checkbox of the row "Ada" receives focus
- **THEN** its accessible name is "Select Ada"

### Requirement: Selection And Action

The list SHALL support `selectionMode` `none`, `single` and `multiple` (default `none`),
`selectionBehavior` `toggle` (default) or `replace`, `disallowEmptySelection` and
`disabledBehavior` (`all` default | `selection`) with the rules of `selection-model`. It
SHALL accept `onAction(key, details)` and `onRowAction` per item. For a row without a
checkbox: in `toggle`, a press toggles the row, and with `onAction` a press runs the
action instead when nothing is selected, else toggles; in `replace`, a press selects, and
Enter, a double press, or any press with no selection mode runs the action; touch and
virtual presses follow the collections toggle rule. Enter on a row SHALL run the action
when one exists, else (selectable) select. Space SHALL toggle selection and SHALL NOT run
the action. With a checkbox: the row press runs the action only. `selectOnPressUp` (default
false: a mouse press commits on pointer down) SHALL make presses commit on pointer up, for lists inside popups (react-spectrum#7887,
#9572). The `value` shapes are `string[]` for `multiple` and `string | null` for `single`.
Escape SHALL NOT clear the selection.

#### Scenario: Action stays available in selection mode (react-spectrum#7962)

- **WHEN** a row has a checkbox, one row is selected, and another row's body is pressed
- **THEN** `onAction` runs for it and the selection is unchanged

#### Scenario: Press-up in a popover (react-spectrum#7887)

- **WHEN** a list with `selectOnPressUp` inside a modal popover is pressed on a row
- **THEN** the selection commits on pointer up and the containing modal stays open

#### Scenario: Shift range with a controlled value (collections)

- **WHEN** a parent controls the value and the user presses row "b" then Shift+presses "e"
  in a `replace` list
- **THEN** rows b to e are selected with one `onValueChange`

### Requirement: Links

A row with `href` SHALL activate on Enter and press through the shared link activation of
`link-navigation` (router, modifier keys, `target`), keeping role `row`; the tree of
controls MAY include a native `<a href>` rendered through `item-control`, which is the
recommended way to get context-menu and middle-click behaviour. `current` SHALL emit
`aria-current` and `data-current`. A link row is activated, not selected, by press and
Enter.

#### Scenario: Modified activation

- **WHEN** a link row is ⌘-clicked
- **THEN** it opens in a new tab and the row is not selected

### Requirement: Focus, Keyboard And Typeahead

The list SHALL be one Tab group over rows (`roving`), moving per the `collection-grid` and
`collection-navigation` capabilities: ArrowDown/ArrowUp, Home/End, PageUp/PageDown, Shift
extension and Ctrl/⌘+A in `multiple` mode, typeahead over the rows' text values only while
the row is the event target, `loop` default `false`. Every key the list acts on SHALL have
its default prevented; unmapped keys SHALL NOT. `autoFocus` SHALL focus the selected row,
else the first row. `disallowTypeAhead` SHALL disable typeahead.

#### Scenario: Page keys do not scroll the page (react-spectrum#10720)

- **WHEN** End is pressed on a row of a long page
- **THEN** the last row is highlighted and the page does not scroll

#### Scenario: Typeahead off (react-spectrum#9120)

- **WHEN** `disallowTypeAhead` is set and "b" is typed
- **THEN** the highlight does not move

#### Scenario: Keys 0 and empty (react-spectrum#7076, #7083)

- **WHEN** a row has key `"0"` and Shift+click and Ctrl+A are used
- **THEN** ranges and select all include it

### Requirement: Loading, Virtualization And Collection Changes

The collections async and virtualization contracts apply: `load-more` SHALL render a
`row` containing a `gridcell` (so the grid stays valid), SHALL NOT be an item or counted in
set size, SHALL have a measurable height inside virtualizers, and its observer SHALL use
the nearest scroll container or the viewport, never the `<html>` element as an explicit
root, calling the loader once per collection instance (react-spectrum#9617, #10627).
Navigation and select all SHALL cover the whole collection (react-spectrum#5067). Focus
via Tab into a virtualized list SHALL NOT scroll when the row is in view
(react-spectrum#7041).

#### Scenario: Sentinel in a page-scrolling list

- **WHEN** a list with `load-more` scrolls with the page
- **THEN** the loader is called once, not once per page

#### Scenario: Select all in a virtualized list

- **WHEN** Ctrl+A is pressed in a virtualized `multiple` list
- **THEN** `onValueChange` reports all rows, not only the mounted ones

### Requirement: Announcements

Selection changes SHALL be announced through the announcer, polite: "{name} selected",
"{name} not selected", and "{n} rows selected" when one action changes several, only while
the quirk entry `webkit-grid-selection-not-announced` is active (Apple, WebKit engine;
WebKit bug 235068) so the workaround has a bug link and test; nothing is announced on other
platforms. Navigation SHALL announce nothing.

#### Scenario: Safari on macOS

- **WHEN** a row is selected with Space on an Apple WebKit platform with a recording announcer
- **THEN** the announcer receives "{name} selected" once

#### Scenario: Chrome on Windows

- **WHEN** the same happens on a non-Apple platform
- **THEN** no announcement is made

### Requirement: Hover And Pressed State

`data-hover` and `data-pressed` SHALL be emitted on every row regardless of selection
mode or actions (react-spectrum#8988).

#### Scenario: Hover without selection

- **WHEN** the pointer is over a row of a `selectionMode="none"` list without actions
- **THEN** the row carries `data-hover`

### Requirement: Nesting

A Tag Group, Listbox or another Grid List rendered inside a row SHALL work: the outer list
SHALL handle no key from inside it (collection-grid "Key Ownership") and SHALL NOT crash.

#### Scenario: Tag Group in a row (react-spectrum#6757)

- **WHEN** a row contains a Tag Group
- **THEN** it renders and both lists navigate independently

### Requirement: Grid List Data Attributes

Every part SHALL carry `data-scope="grid-list"`, `data-part` and `data-instance`. Beyond the
collection part attributes:

- `list`: `data-layout` (`stack` | `grid`), `data-selection-mode`, `data-child-navigation`
  (`arrow` | `tab`), `data-empty`, `data-loading`, `data-focus`, `data-focus-visible`,
  `data-disabled`.
- `item`: `data-key`, `data-highlighted`, `data-selected`, `data-disabled`,
  `data-focus-visible`, `data-focus-visible-within`, `data-child-focused`, `data-hover`,
  `data-pressed`, `data-current`, `data-state` (`selected` | `unselected`, absent without
  selection).
- `item-checkbox`: `data-state` (`checked` | `unchecked` | `indeterminate`), `data-disabled`.
- `item`: `data-action-count` (how often the row's action ran; drivers check that a control's press left it unchanged).
- `item-control`: `data-disabled`, `data-focus-visible`.
- `item-cell`, `item-text`, `item-description`, `empty`, `load-more`, `label`: scoping
  attributes only.

#### Scenario: Styling a selected focused row

- **WHEN** a row is selected and a control inside it has keyboard focus
- **THEN** the row has `data-selected`, `data-child-focused` and `data-focus-visible-within`

### Requirement: Grid List Contract

The `grid-list` contract SHALL locate an instance by role `grid` or `group` and exact
accessible name (role set, as Tag Group), include the collection contract fragment with
item role `row`, strategy `roving`, and declare the traits `composite-roving`,
`row-children`, `selectable` (unless `none`), `directional` (grid layout), `set-metadata`
(virtualized). It SHALL declare the actions `act(row)`, `select(row)`, `check(row)`,
`focusControl(row, control)` and `pressControl(row, control)` and the queries `rows()`,
`controls(row)`, `isEmpty()` and `selectionMode()`. The `row-children` trait SHALL assert
that in `arrow` mode no control is tabbable; in `tab` mode only the highlighted row's
controls are; a disabled row's controls are disabled and not tabbable; and a row's name
never contains a control's name. `pressControl` SHALL assert the row's selection and action
were not triggered. Programmatic changes map to `{ skip: reason }`; `$sync:value` to a prop
step.

#### Scenario: Driver round trip

- **WHEN** a test runs `const g = getGridList(screen, { name: "Candidates" })`,
  `await g.check("Ada")`, `await g.pressControl("Grace", "Archive")`
- **THEN** "Ada" is selected and only the Archive handler of "Grace" ran

#### Scenario: Same test in Playwright

- **WHEN** the same test runs with `page`
- **THEN** it passes unchanged

### Requirement: Model-Based Coverage

`testMachine` over the grid-list contract SHALL cover every transition in every modality
including `virtual`, with props classes stack and grid layout, `arrow` and `tab` child
navigation, single/multiple with `toggle` and `replace`, checkbox and no checkbox, actions,
links, disabled rows with controls, empty and `dir="rtl"`, combined with the collection
argument classes, and pass every generic, accessibility and collection invariant and the
`row-children` trait.

#### Scenario: Broken variant is caught

- **WHEN** a wrapper leaves a control of a non-highlighted row tabbable in `tab` mode
- **THEN** the first step fails naming the control

### Requirement: Theme

The Grid List stylesheet SHALL follow the theme-system convention (`@layer
rind.components`, `:where()` on `data-*`, tier-3 `--rind-grid-list-*` tokens with semantic
fallbacks never declared, family `collection item`, inherited `data-size`,
`data-tone="danger"`). It SHALL NEVER use `display: contents` on the list, the row or any
element that is a focus target (the cell MAY), give rows at least 24px height and controls
at least 24 by 24 px, draw focus as an `outline` on the row, show `data-focus-visible-within`
distinctly, lay out `data-layout="grid"` through custom properties for the column
template, and keep a non-colour selection and focus cue under `forced-colors`.

#### Scenario: Forced colors

- **WHEN** a selected, focused row is captured with `forced-colors: active`
- **THEN** selection and focus are distinguishable without author colours
