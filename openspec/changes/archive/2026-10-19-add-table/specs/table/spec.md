## ADDED Requirements

### Requirement: Anatomy

A Table SHALL consist of `Root` (a `div`, the scroll container), `Table` (a `table`, the
Root's only child), and optionally `Caption` (`caption`), `Head` (`thead`), `Body`
(`tbody`), `Foot` (`tfoot`), `Row` (`tr`), `ColumnHeader` (`th`), `RowHeader` (`th`), `Cell`
(`td`), `SortTrigger` (`button`), `SortIndicator` (`span`) and `Empty` (`tr`). No element
SHALL be rendered between `Root` and `Table`, or between table parts other than those the
consumer renders. Every part SHALL accept the `render` prop and forward the props of the
element it renders. A `SortTrigger` outside a sortable `ColumnHeader` SHALL be a development
error.

#### Scenario: Plain API table

- **WHEN** a Table with a Caption "Props", a Head of three ColumnHeaders and a Body of two
  Rows (a RowHeader and two Cells each) is rendered
- **THEN** the DOM is `div > table > caption, thead > tr > th×3, tbody > tr×2 > th, td, td`
  and nothing else

### Requirement: Native Semantics

No part SHALL add an ARIA `role` to a table element (`table`, `caption`, `thead`, `tbody`,
`tfoot`, `tr`, `th`, `td`). `ColumnHeader` SHALL render `scope="col"`, or `scope="colgroup"`
when its `colSpan` is greater than 1. `RowHeader` SHALL render `scope="row"`, or
`scope="rowgroup"` when its `rowSpan` is greater than 1. `colSpan` and `rowSpan` SHALL be
passed to the native attributes. A Head MAY hold several Rows. No part SHALL attach an
event handler to `tr`, `th` or `td`, so text in the table can be selected with the pointer.

#### Scenario: Header association (TanStack/table#2862)

- **WHEN** an API table is rendered
- **THEN** the accessibility tree has role `table`, `columnheader` for each head cell,
  `rowheader` for each body `th`, `cell` for each `td`, and no element carries a `role`
  attribute

#### Scenario: Grouped columns in a pricing table

- **WHEN** a Head has a first Row with a ColumnHeader "Plans" spanning three columns and a
  second Row with "Free", "Pro" and "Team"
- **THEN** "Plans" has `colspan="3"` and `scope="colgroup"`, and the cell under "Pro" in
  the body has the column headers "Plans" and "Pro"

#### Scenario: Text can be selected (react-spectrum#2585)

- **WHEN** the user drags the pointer across the text of two cells
- **THEN** the text is selected and no Table state changes

### Requirement: Name

The table SHALL be named by its `Caption` when one is rendered (native caption), else by
`aria-label` or `aria-labelledby` given to `Table`. A table with none of these SHALL produce
a development warning through the injected logger. A visually hidden caption SHALL still be
a `caption` element.

#### Scenario: Caption names the table

- **WHEN** a Table has a Caption "Pricing"
- **THEN** the element with role `table` has the accessible name "Pricing"

### Requirement: Scroll Container

The Root SHALL be the table's scroll container. It SHALL have `tabindex="0"` exactly when it
has been measured, it overflows on an axis the user can scroll, and it contains no element
in the sequential focus order. The `tabindex` SHALL NOT be present before the first
measurement or in the server HTML, and SHALL NOT be removed while the Root itself has focus
(it is removed on the next blur). A `tabIndex` given by the consumer SHALL override the
rule. While it is a tab stop the Root SHALL have `role="group"` and be named by the Caption
(`aria-labelledby`), else by the Table's `aria-label`; otherwise it SHALL have no `role` and
no name. Overflow SHALL be re-measured when the Root or the table resizes and when its
content changes.

#### Scenario: Wide table on a phone (axe scrollable-region-focusable)

- **WHEN** a Table with a Caption "Comparison" and no controls is twice as wide as its Root
- **THEN** Tab reaches the Root, which is a group named "Comparison", and ArrowRight
  scrolls it

#### Scenario: Sort buttons are the way in

- **WHEN** an overflowing Table has sortable columns
- **THEN** the Root is not in the sequential focus order (`tabindex="-1"`: Firefox would
  otherwise make the scroll container a tab stop), and Tab goes directly to the first sort
  button

#### Scenario: Fits, no stop

- **WHEN** the Table fits its Root
- **THEN** the Root has no `tabindex` and no `role`

#### Scenario: Overflow ends while focused (mui/base-ui#4205)

- **WHEN** the Root has focus and its Root grows so the table no longer overflows
- **THEN** the Root keeps its `tabindex` and focus until it is blurred, then loses both the
  `tabindex` and the `role`

### Requirement: Scroll Metrics

The Root SHALL carry `data-overflow-x` and `data-overflow-y` while the table overflows on
that axis, and `data-overflow-x-start` and `data-overflow-x-end` while content is hidden
before or after the visible part in the inline direction (mirrored in right-to-left). The
Root SHALL set the CSS variables `--rind-table-head-height` (the Head's height) and
`--rind-table-first-column-width` (the first header cell's width), updated when they
resize. None of these SHALL be in the server HTML.

#### Scenario: Scroll shadows follow the position

- **WHEN** an overflowing Table is scrolled to the inline start, then to the middle, then
  to the end
- **THEN** the Root carries `data-overflow-x-end` only, then both flags, then
  `data-overflow-x-start` only

#### Scenario: Focus is not hidden under the sticky head (react-spectrum#5621)

- **WHEN** a vertically scrolling themed Table holds a link in its last row and the user
  tabs to it from above
- **THEN** the link's box is entirely below the sticky Head inside the Root

### Requirement: Sorting

A `ColumnHeader` with `sortable` SHALL take an `id` (non-empty, unique in the table; a
duplicate is a development error) and SHALL contain exactly one `SortTrigger`, a
`button type="button"` whose accessible name is the column's text. The Table SHALL expose a
controllable `sort` (`{ column, direction: "ascending" | "descending" } | null`, default
`defaultSort`, default null) with `onSortChange(sort, details)`, where `details` carries
`column`, `event` and `cancel()`. Activating a trigger SHALL propose the next sort: for a
column that is not sorted, that column with its `firstDirection` (default `ascending`); for
the sorted column, the opposite direction; with `allowUnsorted` on the Table, null when the
sorted column's direction is already the opposite of its `firstDirection`. The Table SHALL
NOT reorder rows.

#### Scenario: First press, second press

- **WHEN** an unsorted Table's "Name" trigger is pressed twice
- **THEN** `onSortChange` receives `{ column: "name", direction: "ascending" }`, then
  `{ column: "name", direction: "descending" }`

#### Scenario: Descending first

- **WHEN** a column "Price" with `firstDirection="descending"` is pressed while "Name" is
  sorted
- **THEN** the sort becomes `{ column: "price", direction: "descending" }`

#### Scenario: Back to unsorted (react-spectrum#9375)

- **WHEN** a Table with `allowUnsorted` is sorted descending by "Name" (first direction
  ascending) and "Name" is pressed
- **THEN** the sort becomes null and no header carries `aria-sort`

#### Scenario: Controlled refusal

- **WHEN** a controlled Table sorted by "Name" ascending has a trigger pressed and the
  parent does not apply the proposal
- **THEN** `aria-sort` stays `ascending` on "Name" and nothing is announced

#### Scenario: Every activation path (cause A)

- **WHEN** a trigger is activated by a pointer, by Enter, by Space and by a bare `click`
  with no pointer or key events
- **THEN** each activation proposes the next sort exactly once

### Requirement: Sort Semantics

The sorted column's `ColumnHeader` SHALL carry `aria-sort` set to its direction. No other
header SHALL carry `aria-sort`. The `SortIndicator` SHALL be `aria-hidden="true"`, so that
the trigger's name is the column's text only. Sortable headers SHALL be ordinary tab stops
in phase 1, whether the body has rows or not.

#### Scenario: One header at a time

- **WHEN** the sort moves from "Name" to "Price"
- **THEN** "Price" has `aria-sort="ascending"` and "Name" has no `aria-sort`

#### Scenario: Unique trigger names (mui/mui-x#16456, #19239)

- **WHEN** a Table has sortable columns "Name" and "Price" with arrow indicators
- **THEN** their triggers are buttons named "Name" and "Price", and the column headers'
  names are "Name" and "Price"

#### Scenario: Filters reachable when empty (react-spectrum#10121)

- **WHEN** a sortable Table renders an `Empty` row
- **THEN** every sort trigger is reachable by Tab

### Requirement: Sort Announcement

When a user's activation of a trigger changes the effective sort, the Table SHALL announce,
through the injected Announcer with polite priority, `messages.sorted(columnName,
direction)` (default "Sorted by {column}, ascending" / "descending"), or
`messages.unsorted(columnName)` (default "Sort cleared") when the sort becomes null.
Uncontrolled, the announcement SHALL follow the change. Controlled, it SHALL be made when
the `sort` prop arrives with the proposed value. A `sort` change the user did not propose
SHALL NOT be announced. The Table SHALL render no `aria-live` region of its own.

#### Scenario: Announced once

- **WHEN** "Name" is pressed in an uncontrolled Table
- **THEN** the Announcer receives "Sorted by Name, ascending" exactly once, politely

#### Scenario: Parent changes are silent

- **WHEN** the parent of a controlled Table sets `sort` to "Price" descending without a
  press
- **THEN** `aria-sort` moves to "Price" and nothing is announced

### Requirement: TalkBack Sort State

While the quirk `talkback-aria-sort` is active, the sorted column's `SortTrigger` SHALL
carry `aria-describedby` pointing at a visually hidden element it renders, holding
`messages.sortState(direction)` (default "sorted ascending" / "sorted descending"). While
the quirk is inactive, no trigger SHALL carry that description.

#### Scenario: Android

- **WHEN** a Table sorted by "Name" descending renders on an Android platform
- **THEN** the "Name" trigger's accessible description is "sorted descending"; on macOS it
  has no description

### Requirement: Sort Helper

`@rind-ui/core` SHALL export `sortItems(items, sort, getValue, options?)`. It SHALL return a
new array and leave `items` unchanged, and it SHALL be stable. Strings SHALL compare with
`Intl.Collator(options.locale, { numeric: true, sensitivity: "base" })`. Numbers and bigints
SHALL compare by value, dates by time, and booleans false before true. `null`, `undefined`,
`NaN` and `""` SHALL be placed last in both directions. A null `sort` SHALL return a copy in
the original order.

#### Scenario: Natural order and empty values last (TanStack/table#6086)

- **WHEN** `["item 10", null, "item 2", "", "Item 1"]` is sorted ascending, then descending
- **THEN** the results are `["Item 1", "item 2", "item 10", null, ""]` and
  `["item 10", "item 2", "Item 1", null, ""]`

#### Scenario: Stable

- **WHEN** rows with equal values are sorted
- **THEN** they keep their original relative order

### Requirement: Empty And Loading

`Empty` SHALL render a `tr` holding one `td` that spans every leaf column: the `colSpan`
prop when given, else the number of leaf columns registered after mount. While an `Empty`
row is mounted the Table SHALL carry `data-empty`. With `loading` on the Table, the
`table` SHALL carry `aria-busy="true"` and `data-loading`.

#### Scenario: Empty spans the columns

- **WHEN** a Table with four leaf columns renders `Empty` with the text "No results"
- **THEN** one cell with `colspan="4"` contains "No results", in normal flow, whatever the
  Root's height (react-spectrum#10235)

### Requirement: Server Rendering

The Table SHALL render all of its rows, headers and cells on the server, with the sort
state applied (`aria-sort`, `data-sort`, `data-direction`), and hydrate with no warnings.
No measured attribute (`tabindex`, `role`, `data-overflow-*`, CSS variables) SHALL be in the
server HTML.

#### Scenario: Works without JavaScript (react-spectrum#9707)

- **WHEN** a sorted Table is rendered on the server and the HTML is read before hydration
- **THEN** every row is present and the sorted header carries `aria-sort`

### Requirement: Table Data Attributes

Every part SHALL carry `data-scope="table"` and `data-part` (`root`, `table`, `caption`,
`head`, `body`, `foot`, `row`, `column-header`, `row-header`, `cell`, `sort-trigger`,
`sort-indicator`, `empty`). The Root SHALL carry the scroll-metric attributes,
`data-sticky-first-column` when `stickyFirstColumn` is set, and `data-focus-visible` while
it has keyboard focus. The Table SHALL carry `data-sorted` while sorted, `data-empty` and
`data-loading`. A sortable ColumnHeader SHALL carry `data-sortable`, and `data-sort` with
the direction while sorted. SortTrigger and SortIndicator SHALL carry `data-direction`
(`ascending`, `descending` or `none`).

#### Scenario: Direction on the indicator

- **WHEN** "Name" is sorted descending and "Price" is sortable but not sorted
- **THEN** the "Name" indicator has `data-direction="descending"` and the "Price" indicator
  `data-direction="none"`

### Requirement: Table Contract

The Table SHALL ship `tableContract`, located by role `table` and accessible name, with
actions `sortBy` and `focusScroller`, queries `name`, `columns`, `rows`, `cell`, `sort`,
`isScrollStop`, `isEmpty` and `isLoading`, and a `getTable` driver. `sortBy` SHALL press the
trigger in the requested modality (pointer, keyboard Enter or Space, or virtual click).
`focusScroller` SHALL fail with a clear error when the Root is not a tab stop.

#### Scenario: Same driver test in jsdom and a browser

- **WHEN** `getTable(screen, { name: "Props" }).sortBy("Name")` runs in jsdom and in
  Chromium on an uncontrolled Table
- **THEN** both report `sort()` as `{ column: "Name", direction: "ascending" }`

### Requirement: Table Invariants

After every model step: at most one header SHALL carry `aria-sort`, and it SHALL equal the
machine's sort; every sortable header SHALL contain exactly one button, named by the
header's text; no table element SHALL carry a `role` attribute; the Root SHALL be a tab stop
exactly when the scroll rule says so, and SHALL then have a non-empty name; every
announcement SHALL have gone through the Announcer.

#### Scenario: Model walk

- **WHEN** `testMachine(tableContract, …)` walks every transition in every modality, in
  left-to-right and right-to-left
- **THEN** every invariant holds after every step

### Requirement: Theme

`@rind-ui/theme` SHALL ship `table.css` in `@layer rind.components` with `:where()`
selectors, family `decoration` (tokens `--rind-table-*`, no variant, no size). It SHALL use
`border-collapse: separate` with `border-spacing: 0`. It SHALL make the Head's cells sticky
at the block start with an opaque background, and, with `data-sticky-first-column`, the
first cell of every row sticky at the inline start. It SHALL set the Root's scroll padding
from `--rind-table-head-height` (and `--rind-table-first-column-width` with a sticky first
column). It SHALL draw scroll shadows from `data-overflow-x-start` and `-end`, and make the
sort trigger fill its header cell, at least 24 × 24 CSS px, with an outline focus ring. The
indicator for `none` SHALL differ in shape from the ascending and descending ones. Under
forced colors, borders and indicators SHALL use `CanvasText` and focus `Highlight`. The
sheet SHALL use logical directions only and SHALL NOT change the `display` of `table`,
`caption`, `thead`, `tbody`, `tfoot`, `tr`, `th` or `td`.

#### Scenario: Semantics survive the theme

- **WHEN** a themed Table is rendered at 320 px wide in Chromium, Firefox and WebKit
- **THEN** every table part keeps its native computed `display`, the table scrolls inside
  the Root, and the accessibility tree still has role `table` with its headers

#### Scenario: Sticky first column in right to left

- **WHEN** a themed Table with `stickyFirstColumn` and `dir="rtl"` is scrolled to its end
- **THEN** the row headers stay at the right edge of the Root
