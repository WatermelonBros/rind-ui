## Purpose

Defines how a collection component whose items are rows containing controls moves focus:
the two-level (row, children) model, the `arrow` and `tab` child navigation behaviours,
spatial moves over a wrapped layout, and which element owns which key. It extends
`collection-navigation` (roving strategy, exactly one tab stop, logical moves) and is
owned by Grid List; Table and Calendar extend it with a column axis when they are
specified. Full multi-cell navigation is not defined here.

## ADDED Requirements

### Requirement: Row And Child Positions

A grid collection SHALL address focus as a row key plus a child index, where index 0 is
the row itself and 1..n are the row's **controls** in document order. The highlighted key
SHALL stay the row's key while a control inside it has focus. A control is an element
marked as a row control by the component (data part `item-control`); other focusable
elements SHALL NOT be navigated and SHALL produce a development warning. Rows without
controls SHALL have only position 0.

#### Scenario: Control focus keeps the row highlighted

- **WHEN** focus moves from row "b" to the second control inside it
- **THEN** the highlighted key is still "b" and the row carries `data-child-focused`

### Requirement: Navigation Behaviours

A grid component SHALL accept `childNavigation` `arrow` (default) or `tab`.

With `arrow`: every control SHALL have `tabIndex=-1`; ArrowRight on a row (mirrored under
`dir="rtl"`) SHALL focus its first control and on a control the next control; ArrowLeft the
previous control and from the first control the row; at the last control ArrowRight SHALL
do nothing (no wrap). ArrowUp and ArrowDown pressed on a control SHALL move to the row
above or below, as from the row. Escape on a control SHALL return focus to its row.

With `tab`: ArrowLeft and ArrowRight on a row do nothing (they remain free for the
consumer); the controls of the **highlighted row only** SHALL have `tabIndex=0` and all
others `-1`, so Tab and Shift+Tab walk the row, its controls and then leave the grid,
using the DOM order and no custom Tab handler; ArrowUp/Down from a control move to the
adjacent row.

In both behaviours the grid SHALL be one Tab group: exactly one row has `tabIndex=0`
(collections "Exactly One Tab Stop") and, in `tab` mode, that row's controls.

#### Scenario: Arrow into controls

- **WHEN** row "b" is focused (arrow mode) and the user presses ArrowRight twice
- **THEN** its first, then second control is focused; ArrowLeft twice returns to the row

#### Scenario: No wrap at the end

- **WHEN** the last control of a row is focused and ArrowRight is pressed
- **THEN** focus does not move

#### Scenario: Tab mode order

- **WHEN** a tab-mode grid has row 2 highlighted with two controls and focus is on the row
- **THEN** Tab focuses control 1, Tab focuses control 2, Tab leaves the grid; controls of
  rows 1 and 3 are never reached by Tab

#### Scenario: Shift+Tab leaves in one step per stop (react-spectrum#9532)

- **WHEN** focus is on the highlighted row in tab mode and Shift+Tab is pressed
- **THEN** focus moves to the element before the grid, whatever the CSS display of the
  list and cells is

#### Scenario: Escape returns

- **WHEN** a control has focus and Escape is pressed
- **THEN** its row is focused

### Requirement: Key Ownership

For a keyboard event the grid SHALL decide by `event.target`: when the target is the row,
the grid handles every key of the component; when the target is a control, the grid SHALL
handle only ArrowUp and ArrowDown (always), ArrowLeft/ArrowRight (arrow mode), Escape and,
for Home/End/PageUp/PageDown, nothing; when the target is an editable element (`input`,
`textarea`, `select`, contenteditable) or any element inside one, the grid SHALL handle no
key and SHALL NOT call `preventDefault`, except that Escape SHALL return focus to the row
and Tab keeps its native behaviour; when the target is inside a nested composite (an
element with role `grid`, `listbox`, `tree`, `menu` or `toolbar` inside a row), the grid
SHALL handle nothing. Enter, Space and typeahead SHALL be handled only for the row as
target. A press that begins on a control SHALL never select or act the row, whether or not
the control stops propagation.

#### Scenario: Space in a text field (react-spectrum#4674, #8112, #8031)

- **WHEN** a row contains a text input and the user types "a b"
- **THEN** every character including the space reaches the input and the selection does
  not change, with and without drag and drop configured

#### Scenario: Nested composite (react-spectrum#5179)

- **WHEN** a row contains a Tag Group and the user presses ArrowDown inside it
- **THEN** the Tag Group handles the key and the grid's highlight does not move

#### Scenario: Child button that stops propagation (react-spectrum#4928)

- **WHEN** a row is selected and the user presses a control that calls `stopPropagation`
  on `click`
- **THEN** the row stays selected

#### Scenario: Modifier chords (react-spectrum#6904)

- **WHEN** the user presses ⌘+Shift+ArrowDown on a row
- **THEN** the grid does not extend the selection (only Shift+ArrowDown does)

### Requirement: Row Is Focused And Named

DOM focus on a row SHALL be on the row element, not on its cell. The row's accessible name
SHALL be taken from its text part through `aria-labelledby` (a consumer `aria-label` wins)
and its description from description parts through `aria-describedby`, so that the names of
controls, checkboxes and badges inside the row are not part of the row's name.

#### Scenario: Focused row reads its text only (react-spectrum#2946)

- **WHEN** a row containing a checkbox and two buttons is focused
- **THEN** its accessible name is the text part's content only

### Requirement: Spatial Navigation

With `layout="grid"` (rows arranged in a wrapped visual grid), ArrowUp and ArrowDown SHALL
move to the item whose box is nearest above or below the highlighted item's centre
horizontally (clamped to the last short row), and ArrowLeft/ArrowRight SHALL move to the
previous/next item in collection order (mirrored in RTL), wrapping across visual rows.
Spatial targets SHALL come from the `GridLayout` capability injected in the environment
(`targetAbove(key)`, `targetBelow(key)`, measured from item rects by `data-key`); when it
returns null (zero rects, jsdom) ArrowUp/Down SHALL fall back to previous/next in
collection order. Home/End, PageUp/Down and typeahead are those of `collection-navigation`.
Items in a grid layout are still rows with one cell: no column semantics SHALL be exposed.

#### Scenario: Down in a three-column card grid

- **WHEN** seven cards are laid out three per row and card 2 is highlighted
- **THEN** ArrowDown highlights card 5; from card 7 (alone in its row) ArrowUp highlights
  card 4

#### Scenario: No measurement

- **WHEN** the layout cannot be measured
- **THEN** ArrowDown highlights the next item in collection order

#### Scenario: RTL

- **WHEN** ArrowRight is pressed on a card under `dir="rtl"`
- **THEN** the previous card in collection order is highlighted

### Requirement: Machine Pieces

The capability SHALL provide reusable machine pieces: the events `FOCUS_CHILD { key, index }`,
`NAVIGATE_CHILD { direction: "next" | "previous" | "row" }` and `NAVIGATE_SPATIAL
{ direction: "up" | "down" }`, a context field `childIndex` (0 = row), the guards
`isOnControl` and `canMoveSpatially`, and an effect `focusChild` that resolves the
control element through `core/dom` by walking the row's `item-control` parts. Machines
SHALL receive logical events only.

#### Scenario: Pure transitions

- **WHEN** `NAVIGATE_CHILD next` is sent in a node-environment test with a row that has
  two controls registered
- **THEN** `childIndex` becomes 1 and the effect requests focus on the first control
