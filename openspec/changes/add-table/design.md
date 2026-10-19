## Context

The research note ([table.md](../../../docs/research/table.md)) compares React Aria (the
only library in the matrix with a Table), TanStack Table, MUI X Data Grid and APG's Table,
Sortable Table and Grid. It records the bug history behind each scenario. It splits the
Table into four changes. This is the first one: a static native table. Its parts are the
parts the later phases extend, so nothing here is thrown away.

## Goals / Non-Goals

**Goals:**
- A native `<table>` that renders completely on the server, with no ARIA roles added and
  no handlers on rows or cells. Text selection and screen-reader table navigation stay
  native.
- Sorting that is correct for every assistive technology: a real button, `aria-sort` on
  one header, and an announcement.
- A scroll container that needs no consumer setup to pass axe `scrollable-region-focusable`
  and WCAG 2.4.11 (focus not hidden by the sticky head).

**Non-Goals:**
- Grid behaviour, selection, resizing, virtualization (later changes, see the proposal).
- Sorting the consumer's data inside the component.

## Decisions

### 1. Shape: a native table, the Root is the scroller

`Root` is a `div` and the scroll container. It owns the machine, so the scroll state and
the sort state live in one place and every other part reads them from context. `Table`
renders the `<table>` as the Root's only child. There is no wrapper between the scroller and
the table (sticky positioning, Radix#2783) and none between table parts (Firefox table tree,
RA#4382). `ColumnHeader` renders `th scope="col"` (`colgroup` when `colSpan > 1`).
`RowHeader` renders `th scope="row"` (`rowgroup` when `rowSpan > 1`). `Cell` renders `td`.
All of them pass `colSpan` and `rowSpan` through. `Head`, `Body` and `Foot` render the
row groups.

Why not React Aria's model (a collection builder and a grid): a static table needs neither.
The collection would only be needed for focus, and phase 2 adds it.

### 2. Machine

```ts
type TableEvent =
  | { type: "SORT"; column: string; modality: Modality }
  | { type: "SORT.SYNCED" }                                  // controlled prop arrived
  | { type: "MEASURED"; overflow: AxisFlags; edges: EdgeFlags; tabbable: boolean }
  | { type: "ROOT.FOCUS" } | { type: "ROOT.BLUR" }
```

- One state, `idle`. Context: `sort` (controllable `SortDescriptor | null`), `pending`,
  `measured`, `overflow`, `edges`, `tabbableContent`, `focused`.
- Columns are not in context. Sortable `ColumnHeader`s register `{ id, textValue,
  firstDirection }` through `core/dom/item-registry` at commit. `SORT` reads the
  registration for the column's name and first direction, and the `Empty` row reads the
  registered leaf column count. A duplicate column `id` is a development error.
- `nextSort(current, column, firstDirection, allowUnsorted)`, a pure function: another
  column → `{ column, firstDirection }`; the sorted column → the opposite direction, or,
  with `allowUnsorted`, `null` when the current direction is the opposite of
  `firstDirection`.
- One write path as in Rating. Uncontrolled: `sort` is updated and `onSortChange` is
  called. Controlled: the proposal waits in `pending` and is announced when the prop
  arrives with that value (`SORT.SYNCED`). A prop change that was not proposed is not
  announced.
- Tab stop: `measured && (overflow.x || overflow.y) && !tabbableContent`. It is kept while
  `focused`, and re-evaluated on `ROOT.BLUR` (Scroll Area rule).
- Effects: `announce` through the injected Announcer (polite), and `measure`. `measure`
  starts `watchOverflow` and `observeTabbable` on the Root, the edge flags from
  `scroll-metrics` (on scroll), and a `ResizeObserver` on the `thead` and its first header
  cell that writes `--rind-table-head-height` and `--rind-table-first-column-width` on the
  Root. It returns its teardown.

### 3. Connect

- Root: `data-scope="table"`, `data-part="root"`. While it is a tab stop: `tabindex="0"`,
  `role="group"`, and `aria-labelledby` set to the Caption id. With no Caption, the
  Table's `aria-label` is copied to the Root, and with neither, a development warning.
  Otherwise none of these attributes. Also `data-overflow-x`, `data-overflow-y`,
  `data-overflow-x-start`, `data-overflow-x-end`, `data-sticky-first-column`, and
  `data-focus-visible` while it has keyboard focus.
- Table: `aria-busy="true"` and `data-loading` while `loading`. `data-sorted` while sorted,
  `data-empty` while an `Empty` row is mounted. `aria-describedby` and `aria-label` pass
  through. With no caption, no `aria-label` and no `aria-labelledby`, a development warning.
- ColumnHeader: `scope`, `data-sortable`, and `aria-sort` and `data-sort` (the direction)
  on the sorted column only.
- SortTrigger: `type="button"`, `data-direction` (`ascending`, `descending`, `none`). On
  the sorted column while `talkback-aria-sort` is active, `aria-describedby` points at a
  visually hidden span the trigger renders after its children, holding
  `messages.sortState(direction)`. Its name is its content: the column's text plus the
  `aria-hidden` SortIndicator.
- SortIndicator: `aria-hidden="true"`, `data-direction`.
- Empty: a `tr` with one `td`. Its `colSpan` is the consumer's `colSpan` prop when given,
  else the registered leaf column count after mount. The server HTML omits it unless the
  prop is given, so the server output matches the hydrated output.
- Messages: `sorted(column, direction)` "Sorted by {column}, {ascending|descending}",
  `unsorted(column)` "Sort cleared", `sortState(direction)` "sorted ascending" /
  "sorted descending".

### 4. `sortItems`

`sortItems<T>(items: readonly T[], sort: SortDescriptor | null, getValue: (item: T, column:
string) => unknown, options?: { locale?: string }): T[]` returns a new array (the input is
untouched) and is stable. Strings compare with `Intl.Collator(locale, { numeric: true,
sensitivity: "base" })`. Numbers and bigints compare by value, `Date`s by time, booleans
with false first. `null`, `undefined`, `NaN` and `""` go last in both directions. Mixed
types compare by type name, then value, so the order is total. `sort` null returns a copy.

### 5. React

`Table.Root` creates the machine, provides context, and runs `measure` in a layout effect
(client only). `Table.ColumnHeader` registers when `sortable` and provides the column to
`SortTrigger`. A `SortTrigger` outside a sortable header is a development error.
`SortTrigger` sends `SORT` on `click`. A native button covers keyboard, pointer and the
bare click of assistive technology (cause A), so no press machinery is added. No part adds
an event handler to `tr`, `th` (other than through the trigger) or `td`.

### 6. Contract

`tableContract`: anatomy (the parts above), locate by role `table` and accessible name.
Actions: `sortBy(column)` (press the trigger by pointer, keyboard Enter, keyboard Space, or
virtual click), `focusScroller()` (Tab until the Root has focus; fails when it is not a tab
stop). Queries: `name`, `columns` (`{ name, sortable, sort }[]`), `rows` (text matrix of the
body, row headers included), `cell(rowHeader, column)`, `sort` (from `aria-sort`),
`isScrollStop`, `isEmpty`, `isLoading`. Traits: none. Invariants: see the spec's
"Table Invariants".

### 7. Model configurations

Uncontrolled sortable (3 columns, one with `firstDirection="descending"`),
`allowUnsorted`, controlled applying, controlled refusing, overflowing without controls,
overflowing with sort buttons. Every modality in browser mode, keyboard and virtual in
jsdom. Overflow states are reached in browser mode only (no layout in jsdom). `dir="rtl"`
runs.

### 8. Theme

`table.css` in `@layer rind.components`, `:where()` selectors, family `decoration` (tokens
`--rind-table-*`: border, header background, cell padding, stripe off by default).
`border-collapse: separate; border-spacing: 0`. Head cells are sticky at
`inset-block-start: 0` with an opaque background. With `data-sticky-first-column`, the
first `th`/`td` of each row is sticky at `inset-inline-start: 0`. Root: `overflow: auto`,
`scroll-padding-block-start: var(--rind-table-head-height, 0)`, and, with
`data-sticky-first-column`, `scroll-padding-inline-start:
var(--rind-table-first-column-width, 0)`. Scroll shadows are background gradients on the
Root, keyed on `data-overflow-x-start` and `-end`. Cells use
`font-variant-numeric: tabular-nums`. The trigger fills the header cell, with a minimum of
24 × 24 px and an outline focus ring. The SortIndicator draws ▲, ▼ and a two-headed shape
for `none` (different in shape, not only colour). Forced colors: borders and indicator
`CanvasText`, focus `Highlight`. No rule changes the `display` of `table`, `thead`,
`tbody`, `tfoot`, `tr`, `th`, `td` or `caption`.

## Risks / Trade-offs

- `role="group"` on the scroll stop is a choice to keep landmarks clean. The research note
  leaves `region` versus `group` to the manual protocol, and the theme does not depend on it.
- The polite sort announcement may be read twice where a screen reader also re-reads
  `aria-sort`. The manual protocol checks NVDA, JAWS and VO, and the open question in the
  research note tracks it.
- `Empty`'s span is known only after mount without the `colSpan` prop. The server row is
  one column wide until hydration. The docs page recommends the prop for server-rendered
  empty tables.
- Phase 2 adds `interaction="grid"` to `Table.Table`. Phase 1 parts must not take
  decisions that a grid would contradict: no row or cell handlers, ids derived from the
  root id and column id.
