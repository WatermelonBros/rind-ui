# Table

A native `<table>` for data people read: API references, plan comparisons, lists of records. It adds what tables usually miss — a scroll container that keyboard users can reach when it overflows, sorting that every screen reader hears, and server rendering of every row — without adding any ARIA role or event handler to the table itself, so screen-reader table navigation and text selection stay native.

## When to use

- **Use it for** reading data in rows and columns: a props table, a pricing comparison, a sortable list of records.
- **Over a plain `<table>`**: the Root is the scroll container and becomes a named tab stop only when it overflows with nothing focusable inside (axe `scrollable-region-focusable`), the head sticks without hiding focused cells (scroll padding from the measured head height), scroll edges are exposed for shadows, and sorting has a real button per column, `aria-sort` on the sorted header only, and a polite announcement.
- **Don't use it for** rows of controls you move between with the arrow keys (selection, editing): that is the grid interaction of a later phase, or a [Grid List](grid-list.md) for one-column rows. Don't use it for layout.

```tsx
import { type SortDescriptor, sortItems } from "@rind-ui/core"
import { Table } from "@rind-ui/react"

const [sort, setSort] = useState<SortDescriptor | null>(null)
const rows = sortItems(people, sort, (p, column) => p[column])

<Table.Root sort={sort} onSortChange={setSort}>
  <Table.Table>
    <Table.Caption>People</Table.Caption>
    <Table.Head>
      <Table.Row>
        <Table.ColumnHeader sortable id="name">
          <Table.SortTrigger>
            Name <Table.SortIndicator />
          </Table.SortTrigger>
        </Table.ColumnHeader>
        <Table.ColumnHeader sortable id="age" firstDirection="descending">
          <Table.SortTrigger>
            Age <Table.SortIndicator />
          </Table.SortTrigger>
        </Table.ColumnHeader>
      </Table.Row>
    </Table.Head>
    <Table.Body>
      {rows.map((p) => (
        <Table.Row key={p.id}>
          <Table.RowHeader>{p.name}</Table.RowHeader>
          <Table.Cell>{p.age}</Table.Cell>
        </Table.Row>
      ))}
    </Table.Body>
  </Table.Table>
</Table.Root>
```

## API

<!-- api:table -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `Table.Root` | `root` | `<div>`; the scroll container, holding only the table. |
| `Table.Table` | `table` | `<table>`; `loading` sets `aria-busy`. |
| `Table.Caption` | `caption` | `<caption>`; names the table (visually hidden is fine, it stays a caption). |
| `Table.Head` / `Body` / `Foot` | `head` / `body` / `foot` | `<thead>` / `<tbody>` / `<tfoot>`; a Head may hold several rows. |
| `Table.Row` | `row` | `<tr>`. |
| `Table.ColumnHeader` | `column-header` | `<th scope="col">` (`colgroup` when `colSpan > 1`). |
| `Table.RowHeader` | `row-header` | `<th scope="row">` (`rowgroup` when `rowSpan > 1`). |
| `Table.Cell` | `cell` | `<td>`. |
| `Table.SortTrigger` | `sort-trigger` | `<button type="button">` inside a sortable ColumnHeader. |
| `Table.SortIndicator` | `sort-indicator` | `<span aria-hidden="true">`; `data-direction` for the theme. |
| `Table.Empty` | `empty` | `<tr>` with one cell spanning every column. |

No role is added to any table element and no handler to any row or cell.

## Naming

Render a `Caption`, or give `Table.Table` an `aria-label` or `aria-labelledby`. A table with no name warns in development. While the Root is a tab stop it is a `group` named by the same caption.

## Sorting

A sortable `ColumnHeader` takes `sortable` and an `id` (unique in the table: what `sort.column` holds), and holds one `SortTrigger`, named by its content. A press proposes:

- another column: that column at its `firstDirection` (default `ascending`);
- the sorted column: the other direction;
- with `allowUnsorted` on the Root: no sort, after the column's second direction.

`sort` / `defaultSort` / `onSortChange(sort, details)` make it controllable; `details.cancel()` refuses a proposal. **The Table never reorders rows:** sort your data, with `sortItems(items, sort, getValue, { locale })` (natural string order, numbers, dates and booleans by value, empty values last in both directions, stable) or your own.

The sorted header alone carries `aria-sort`. A press that changes the sort is announced politely ("Sorted by Name, ascending", or "Sort cleared"); a sort the parent sets without a press is not. On Android, where TalkBack does not read `aria-sort`, the sorted trigger is also described by "sorted ascending".

## Scrolling

The Root scrolls the table. It becomes a tab stop (`tabindex="0"`, `role="group"`) only when it overflows and holds nothing focusable — sort buttons and links are the way in otherwise — and keeps it while focused. It exposes `data-overflow-x`, `data-overflow-y`, `data-overflow-x-start` and `data-overflow-x-end` (reading order) for scroll shadows, and sets `--rind-table-head-height` and `--rind-table-first-column-width` so a sticky head or first column (`stickyFirstColumn`) never hides a focused cell. None of this is in the server HTML.

## Pinned columns

Give any column an `id` and pin it at either edge: `pinnedColumns={{ start: ["name"], end: ["actions"] }}` (controllable, with `defaultPinnedColumns` and `onPinnedColumnsChange`). Every cell of a pinned column sticks at the Root's inline start or end, offset by the pinned columns before it; the widths are measured on the client (native table layout, no fixed sizes needed) and right to left mirrors both edges. Pinned cells carry `data-pinned="start" | "end"`, the innermost at each edge `data-pinned-edge` (for a divider while content scrolls under it), and the Root `--rind-table-pinned-start-width` / `-end-width`, so scroll padding keeps a focused cell clear of them. A header spanning a pinned and an unpinned column is not pinned.

## Filters

Put a `Table.Filter` in a ColumnHeader with an `id`: a Popover scoped to the table, so dismissal, focus and nesting are the Popover's.

```tsx
<Table.Root>
  <Table.Table>
    <Table.Caption>Components</Table.Caption>
    <Table.Head>
      <Table.Row>
        <Table.ColumnHeader sortable id="status">
          <Table.SortTrigger>
            Status <Table.SortIndicator />
          </Table.SortTrigger>
          <Table.Filter active={statuses.length > 0}>
            <Table.FilterTrigger>
              <Table.FilterIndicator />
            </Table.FilterTrigger>
            <Table.FilterContent>{/* any controls: a Checkbox Group, a range, a search */}</Table.FilterContent>
          </Table.Filter>
        </Table.ColumnHeader>
      </Table.Row>
    </Table.Head>
  </Table.Table>
</Table.Root>
```

The trigger is named "Filter Status" (`messages.filter`), has `aria-haspopup="dialog"` and `aria-expanded`, and while `active` carries `data-active` and the description "Filtered". The header keeps its text as its name ("Status", not "Status Filter Status"). Filter triggers stay reachable when the body is empty, so a filter can always be cleared. What a filter means is your data: `filterItems` and `facetValues` (below) do the usual work.

## Icons by state

Every indicator takes any node, per state, then falls back to the provider's icons (`RindProvider icons`), then to the theme's shapes:

- `SortIndicator`: `ascending`, `descending`, `none` (icons `caret-up`, `caret-down`, `caret-up-down`).
- `FilterIndicator`: `active`, `children` (icons `funnel`, `funnel-simple`).
- `ExpandTrigger`: `expanded`, `collapsed` (icons `arrows-in`, `arrows-out`).

## Frame, Header, Footer and full page

`Table.Frame` wraps `Table.Header` (the title at the start, a search field and actions at the end), the Root and `Table.Footer` (pagination, a row range). The theme draws the Frame as the card: the Header and Footer are its rows, the table inside is flat, and the card's rounded corners land on the last row, the Footer when there is one. `Table.Title` in the Header names the table and the full-page view when there is no Caption. `expanded` (controllable, `Table.ExpandTrigger`) shows the Frame full page: a modal dialog named by the Caption that covers the viewport, with the page inert and its scroll locked; Escape returns it and focus goes back to the trigger. It is not the Fullscreen API (refused in iframes and on iOS).

## Expandable rows

Give a Row an `id`, put a `Table.RowTrigger` in one of its cells and a `Table.RowDetails rowId` right after it: the details are a row with one cell spanning every column, holding anything (another table, a card, a form).

```tsx
<Table.Root multiple={false}>
  <Table.Table>
    <Table.Caption>Users</Table.Caption>
    <Table.Body>
      {users.flatMap((user) => [
        <Table.Row key={user.id} id={user.id}>
          <Table.Cell>
            <Table.RowTrigger />
          </Table.Cell>
          <Table.RowHeader>{user.name}</Table.RowHeader>
          <Table.Cell>{user.role}</Table.Cell>
        </Table.Row>,
        <Table.RowDetails key={`${user.id}-details`} rowId={user.id}>
          <UserCard user={user} />
        </Table.RowDetails>,
      ])}
    </Table.Body>
  </Table.Table>
</Table.Root>
```

The trigger is a button with `aria-expanded` and `aria-controls`, named "Show details {row}" (its RowHeader's text; `messages.rowDetails`). Collapsed details stay in the DOM with `hidden`, so the reference always resolves. `expandedRows` / `defaultExpandedRows` / `onExpandedRowsChange` make it controllable; `multiple={false}` keeps one row open at a time (accordion). The theme keeps the details' content inside the visible width while a wide table scrolls sideways (`--rind-table-viewport-width`).

## Row count

Pass `rowCount` (the rows shown after filters) or, with pagination, `rowRange={{ from, to, total }}`: when it changes the Table announces "12 rows" or "Rows 11 to 20 of 87" politely, once after a 400 ms quiet period, so typing in a search field announces the last result only. The first render is silent.

## Data helpers

All pure, all return new arrays:

- `sortItems(items, sort, getValue, { locale, compare, empty })`: natural order, a comparator per column, empty values last (or first).
- `filterItems(items, { filters, query, getValue, searchColumns, locale })`: every column predicate, then the query (case- and accent-insensitive).
- `facetValues(items, column, getValue)`: each value with its count, for filter options.
- `paginateItems(items, page, pageSize)`: the page's rows with `from`, `to`, `total`, `pageCount`; the page is clamped.

## With TanStack Table

TanStack Table is a data model with no markup; rind's Table is the accessible view. Render TanStack's state with rind's parts:

```tsx
const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), state: { sorting }, onSortingChange: setSorting })
const sort = sorting[0] ? { column: sorting[0].id, direction: sorting[0].desc ? "descending" : "ascending" } : null

<Table.Root sort={sort} onSortChange={(s) => setSorting(s ? [{ id: s.column, desc: s.direction === "descending" }] : [])}>
  <Table.Table>
    <Table.Head>
      {table.getHeaderGroups().map((g) => (
        <Table.Row key={g.id}>
          {g.headers.map((h) => (
            <Table.ColumnHeader key={h.id} id={h.column.id} sortable={h.column.getCanSort()} colSpan={h.colSpan}>
              <Table.SortTrigger>{flexRender(h.column.columnDef.header, h.getContext())}<Table.SortIndicator /></Table.SortTrigger>
            </Table.ColumnHeader>
          ))}
        </Table.Row>
      ))}
    </Table.Head>
    <Table.Body>
      {table.getRowModel().rows.map((r) => (
        <Table.Row key={r.id}>
          {r.getVisibleCells().map((c) => <Table.Cell key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</Table.Cell>)}
        </Table.Row>
      ))}
    </Table.Body>
  </Table.Table>
</Table.Root>
```

## Empty and loading

`Table.Empty` renders one cell spanning every column: give it `colSpan` when the table is server rendered (the count is otherwise known after mount). `loading` on `Table.Table` sets `aria-busy="true"`.

## Keyboard

| Key | Action |
|---|---|
| Tab | Each sort button; the scroll container only when it overflows and holds no control. |
| Enter, Space | On a sort button: sorts by that column (again: the other direction). |
| Arrow keys, Page Up / Down | On the scroll container: scroll the table. |

## Accessibility notes

- **Native table.** Column and row headers are `th` with `scope`, so every cell is announced with its headers; spans use `colgroup` / `rowgroup`.
- **One `aria-sort`.** Only the sorted header carries it; the trigger's name is the column's text only (the indicator is hidden).
- **Never hidden by the sticky head.** The theme's scroll padding comes from the measured head height (WCAG 2.4.11).
- **Shape, not colour.** The theme's indicator draws up, down or both.

## Testing

```tsx
import { getTable } from "@rind-ui/testing"

render(<People />)
const people = getTable(screen, { name: "People" })
await people.sortBy("Name")
expect(await people.sort()).toEqual({ column: "Name", direction: "ascending" })
expect((await people.rows())[0]).toEqual(["Ada", "36"])
```

Contract actions: `sortBy(column)` (pointer, touch, keyboard, virtual), `openFilter(column)`, `closeFilter()`, `setExpanded(on)`, `toggleRow(row)`, `focusScroller()` (fails when the Root is not a tab stop). Queries: `name`, `columns`, `rows`, `sort`, `pinned`, `isExpanded`, `expandedRows`, `isFilterActive(column)`, `isScrollStop`, `isEmpty`, `isLoading`.

## Tested with

<!-- tested-with:table -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
