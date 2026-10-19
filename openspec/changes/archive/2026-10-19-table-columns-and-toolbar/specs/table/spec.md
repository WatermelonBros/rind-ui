## ADDED Requirements

### Requirement: Pinned Columns

The Root SHALL accept a controllable `pinnedColumns` (`{ start: string[], end: string[] }` of
column ids, default both empty) with `onPinnedColumnsChange`. Every cell at the visual column
of a pinned leaf column SHALL stick at the inline start (or end) edge of the Root, offset by the
widths of the pinned columns before it at that edge, measured on the client and updated on
resize. Pinned cells SHALL carry `data-pinned="start" | "end"`, the innermost pinned cell at each
edge `data-pinned-edge`. The Root SHALL expose `--rind-table-pinned-start-width` and
`--rind-table-pinned-end-width` so scroll padding keeps focused cells clear of pinned columns.
None of this SHALL be in the server HTML. Right to left mirrors both edges.

#### Scenario: Pin at both edges

- **WHEN** a wide Table pins "name" at the start and "actions" at the end and is scrolled
  horizontally to its middle
- **THEN** the "name" cells stay at the Root's inline-start edge and the "actions" cells at
  its inline-end edge, in every row

#### Scenario: Two columns at the start

- **WHEN** "select" and "name" are pinned at the start
- **THEN** the "name" cells are offset by the width of the "select" column

#### Scenario: Right to left

- **WHEN** the same Table renders with `dir="rtl"`
- **THEN** start-pinned cells stay at the right edge and end-pinned cells at the left edge

### Requirement: Column Filters

`Table.Filter` inside a ColumnHeader SHALL compose a Popover scoped to the table:
`Table.FilterTrigger` (a `button type="button"` with `aria-haspopup="dialog"` and
`aria-expanded`) opens `Table.FilterContent` (a named dialog). The trigger's name SHALL be
`messages.filter(column)` ("Filter Name") unless it has its own label. With `active`, the
trigger SHALL carry `data-active` and be described by `messages.filtered` ("Filtered"). The
popover SHALL follow the Popover capability (dismissal, focus, nesting). A ColumnHeader holding
any control besides one SortTrigger SHALL be named by its column text only. Filter triggers
SHALL stay reachable by Tab when the body has no rows.

#### Scenario: Header name stays the column (MUI-X#19239)

- **WHEN** a "Name" column holds a SortTrigger and a FilterTrigger
- **THEN** the column header is named "Name" and the filter button "Filter Name"

#### Scenario: Open, filter, close

- **WHEN** the user activates "Filter Name", checks an option in the content and presses Escape
- **THEN** the popover closes, focus returns to "Filter Name", and the trigger carries
  `data-active` and the description "Filtered"

#### Scenario: Reachable with no rows (react-spectrum#10121)

- **WHEN** a filter leaves the body with only an Empty row
- **THEN** the filter trigger is still reachable by Tab and can clear the filter

### Requirement: Indicators By State

`SortIndicator` SHALL render its `ascending`, `descending` or `none` prop for the column's
direction, else the provider's `caret-up`, `caret-down` or `caret-up-down` icon, else nothing
(the theme draws the shape). `FilterIndicator` SHALL render its `active` prop while the filter is
active, else `children`, else the provider's `funnel-simple` / `funnel` icon, else nothing. Both
SHALL stay `aria-hidden`.

#### Scenario: Custom sort icons

- **WHEN** a SortIndicator is given three different nodes and the column goes from unsorted to
  ascending to descending
- **THEN** the rendered node is the `none`, then the `ascending`, then the `descending` one

### Requirement: Frame And Full Page

`Table.Frame` SHALL wrap `Table.Header`, `Table.Root` and `Table.Footer` (free content) without
changing the Root's role as the scroll container. `Table.Title` inside the Frame SHALL name the
table and the expanded Frame when there is no Caption and no label of the table's own. The Frame SHALL own a controllable
`expanded` (default false) with `onExpandedChange`. While expanded the Frame SHALL carry
`data-expanded`, `role="dialog"`, `aria-modal="true"` and be named by the Caption; everything
outside SHALL be inert and page scroll locked; Escape SHALL collapse it (reason `escape-key`)
and return focus to the ExpandTrigger. `Table.ExpandTrigger` SHALL be a toggle button
(`aria-pressed`) named `messages.expand` ("Full page") unless it has content, rendering its
`expanded` / `collapsed` prop or the provider's `arrows-in` / `arrows-out` icon.

#### Scenario: Full page and back

- **WHEN** "Full page" is pressed, then Escape
- **THEN** the Frame is a modal dialog named by the caption covering the viewport, then it is
  back in place, not a dialog, and focus is on "Full page"

### Requirement: Row Count Announcement

The Root SHALL accept `rowCount`. When it changes after mount the Table SHALL announce
`messages.rowCount(count)` ("12 rows") politely through the injected Announcer, once after a
400 ms quiet period of the injected Scheduler; with `rowRange` (`{ from, to, total }`) it SHALL
announce `messages.rowRange(from, to, total)` instead. The first render SHALL NOT announce.

#### Scenario: Typing in a search field

- **WHEN** `rowCount` goes 87 → 40 → 12 within 400 ms
- **THEN** "12 rows" is announced once

### Requirement: Data Helpers

`@rind-ui/core` SHALL export `filterItems`, `facetValues` and `paginateItems`, and `sortItems`
SHALL accept per-column `compare` and `empty: "last" | "first"`. `filterItems` SHALL keep a row
that passes every column filter and, with a non-empty `query`, has a searched column whose
value contains the query ignoring case and accents. `facetValues` SHALL return each distinct
value with its count in first-seen order. `paginateItems` SHALL clamp the page to
`1..pageCount` (at least 1) and return the page's items with `from`, `to` (1-based, 0 when
empty), `total` and `pageCount`. All helpers SHALL return new arrays.

#### Scenario: Search ignores case and accents

- **WHEN** rows "Crème", "creme" and "Cream" are filtered with the query "CREME"
- **THEN** "Crème" and "creme" remain

#### Scenario: Last page clamps

- **WHEN** 23 items are paginated at page 9 with a page size of 10
- **THEN** the result is page 3: items 21 to 23, `from` 21, `to` 23, `pageCount` 3

### Requirement: Expandable Rows

A `Table.Row` with an `id` SHALL be expandable by a `Table.RowTrigger` inside one of its cells
and a `Table.RowDetails` with the same `rowId` rendered right after it. The trigger SHALL be a
`button type="button"` with `aria-expanded` and `aria-controls` pointing at the details row,
named `messages.rowDetails(rowText)` ("Show details {row}") unless it has its own label, where
the row text is its RowHeader's. The details row SHALL be a `tr` holding one `td` spanning every
leaf column (as `Empty`), with any content, and SHALL carry `hidden` while collapsed (it stays
in the DOM so the IDREF resolves). The Root SHALL expose a controllable `expandedRows` (row ids,
default empty) with `onExpandedRowsChange`; with `multiple={false}` opening a row SHALL close
the others. Expanded rows SHALL carry `data-expanded` on the Row, the trigger and the details.

#### Scenario: Open and close details

- **WHEN** the trigger of row "Accordion" is pressed, then pressed again
- **THEN** the details row is shown and the trigger has `aria-expanded="true"`, then it is
  hidden again and `aria-expanded="false"`

#### Scenario: One at a time

- **WHEN** a Table with `multiple={false}` has row "a" expanded and the trigger of "b" is pressed
- **THEN** "b" is expanded and "a" is collapsed

#### Scenario: Nested table in the details

- **WHEN** the details of a row hold another Table
- **THEN** both tables keep their own names, headers and sort, independently
