## Why

Table phase 1 renders and sorts a native table. Real data tables also need pinned columns,
per-column filters, icons that show each column's state, controls above the table (search,
actions, a full-page view) and pagination. The user asked for all of them, customisable, and
for the site to show the most the component can do. The TanStack Table review in the research
note decides what to borrow (pinning state shape, comparators, filter and pagination helpers).

## What Changes

- **Pinned columns**: a controllable `pinnedColumns` (`{ start, end }` column ids) on the Root;
  cells of pinned columns stick at the inline start or end with measured offsets; scroll padding
  covers them.
- **Filters**: `Table.Filter` (a Popover re-scoped to the table), `Table.FilterTrigger` named
  "Filter {column}" with an active state, `Table.FilterContent`; the header keeps its text as
  its name.
- **Icons by state**: `SortIndicator` takes a node per direction, then provider icons, then the
  theme; `FilterIndicator` likewise for active / inactive. New icon `caret-up-down`.
- **Frame, Header, Footer**: `Table.Frame` wraps `Table.Header`, the Root and `Table.Footer`;
  `expanded` (controllable) shows the Frame as a full-page modal layer; `Table.ExpandTrigger`.
- **Row count announcement**: `rowCount` on the Root, announced politely when it changes.
- **Helpers**: `filterItems`, `facetValues`, `paginateItems`; `sortItems` gains per-column
  `compare` and `empty: "first" | "last"`.
- **Site**: a "data table" example using all of it (search, filters, pins, expand,
  pagination), plus a TanStack recipe in the docs.

## Capabilities

### Modified Capabilities

- `table`: pinned columns, filters, indicators by state, Frame / Header / Footer and the
  full-page view, row-count announcements, data helpers.

## Impact

core table machine, connect, contract, metrics and helpers; react parts; theme `table.css` and
the icon set; testing driver; site example and docs. Reuses Popover, the overlay layer stack,
Pagination. No new dependency.
