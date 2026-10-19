## Context

Phase 1 (archived `add-table`) gave the parts, the sort, the scroll container and its
measurements. This change extends the same machine and metrics module; the research note's
sections "TanStack Table review" and "Columns, filters and the table's header" record why.

## Decisions

### 1. Pinned columns

- Root props: `pinnedColumns` / `defaultPinnedColumns` / `onPinnedColumnsChange`,
  `{ start: readonly string[]; end: readonly string[] }` of column ids (the ColumnHeader's
  `id`, now accepted on any column, not only sortable ones). A controllable value of the
  machine, wrapped like the sort (never null).
- The metrics module finds the last head row's header cells carrying `data-column` ids,
  measures their widths in visual order, and for each pinned column writes on every cell at that
  visual column (row by row, colspan aware): `data-pinned="start" | "end"` and the style
  variable `--rind-table-pin-offset` (sum of the widths of the pinned columns before it, at its
  edge). The last pinned cell at each edge gets `data-pinned-edge` (for a divider shadow). The
  Root gets `--rind-table-pinned-start-width` / `-end-width` for scroll padding.
- Connect only adds `data-column` on headers; the per-cell writes are the metrics module's
  (like Scroll Area's thumbs): rows are consumer markup the component never iterates.
- `stickyFirstColumn` stays (phase 1 API) and is equivalent to pinning the first column.

### 2. Filters

- Parts: `Table.Filter` (Popover.Root re-scoped, as the Date Field picker), `Table.FilterTrigger`
  (a button inside a ColumnHeader), `Table.FilterContent` (Popover Positioner + Content, named
  "Filter {column}"), `Table.FilterIndicator`.
- `FilterTrigger` name: `messages.filter(column)` ("Filter Name"), `aria-haspopup="dialog"`,
  `aria-expanded`; prop `active` → `data-active` and, while active, `aria-describedby` a hidden
  "Filtered" (`messages.filtered`).
- A ColumnHeader holding controls besides one SortTrigger gets `aria-label` = its column text
  (the SortTrigger's visible text, else `textValue`), so the header's name never includes
  "Filter Name" (MUI-X#19239).
- Filter state is the consumer's (what a "filter" means is data). `filterItems` applies it.

### 3. Indicators by state

`SortIndicator` props `ascending`, `descending`, `none` (nodes); else the provider's
`caret-up` / `caret-down` / `caret-up-down`; else empty (the theme draws the shapes).
`FilterIndicator` props `active`, `children`; else the provider's `funnel` / `funnel-simple`;
else the theme's shape. New icons in the theme's icon set: `caret-up-down`, `funnel`,
`funnel-simple`, `arrows-out`, `arrows-in`.

### 4. Frame, Header, Footer, full page

- `Table.Frame` (div) wraps `Table.Header`, `Table.Root` and `Table.Footer` (both divs, free
  content). It owns `expanded` / `defaultExpanded` / `onExpandedChange`. While expanded:
  `data-expanded`, `role="dialog"`, `aria-modal="true"`, `aria-labelledby` the Caption, and a
  modal layer (the overlay stack: outside inert, scroll locked, Escape collapses with reason
  `escape-key`). Focus stays where it is (the trigger), and returns to the ExpandTrigger when
  Escape collapses it.
- `Table.ExpandTrigger`: `type="button"`, `aria-pressed`, named `messages.expand` ("Full page")
  unless it has content; children by state via `expanded` / `collapsed` props like the
  indicators (provider icons `arrows-out` / `arrows-in`).
- Without a Frame the Table works as in phase 1.

### 5. Row count

Root prop `rowCount`. When it changes after mount, the Announcer (polite, keyed per instance)
says `messages.rowCount(count)` ("12 rows"), after a 400 ms quiet period on the injected
Scheduler (typing in a search field announces once). Optional `messages.rowRange(from, to,
total)` when the consumer passes `rowRange` (pagination: "Rows 11 to 20 of 87").

### 6. Helpers (pure, core)

- `sortItems(items, sort, getValue, { locale, compare?: Record<column, (a, b) => number>,
  empty?: "last" | "first" })`.
- `filterItems(items, { filters?: Record<column, (value, item) => boolean>, query?: string,
  getValue, searchColumns?: readonly string[], locale })`: a row passes every column filter and,
  with a query, has a searched column whose value contains it (case- and accent-insensitive
  through `Intl.Collator` sensitivity `base`).
- `facetValues(items, column, getValue)`: `{ value, count }[]` in first-seen order.
- `paginateItems(items, page, pageSize)`: `{ items, pageCount, from, to, total }` with page
  clamped to `1..pageCount`.

### 7. Contract

Pinning is state, not a user action. The contract gains `openFilter(column)`, `closeFilter()`, `setExpanded(on)`; queries `pinned` (`{ start, end }`
read from `data-pinned` headers), `isExpanded`, `isFilterActive(column)`. Invariants: a pinned
cell is sticky; a header with controls is named by its text; the expanded Frame is a named
modal dialog.

### 8. Theme

`table.css`: `[data-pinned="start"]` / `"end"` sticky at `inset-inline-start` / `-end:
var(--rind-table-pin-offset)` with an opaque background; `data-pinned-edge` draws a divider
shadow on the inner side while the matching overflow edge flag is set; the Root's scroll
padding adds the pinned widths. Frame, Header and Footer: a column layout; expanded: fixed,
inset 0, the page background, the Root fills the remaining height. Filter trigger: a 24 px
icon button; active uses the accent tone and the filled funnel shape.
