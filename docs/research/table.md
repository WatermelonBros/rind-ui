# Table — research

Status: done · Wave: 3

A Table shows data in rows and columns. It comes in two shapes. A **static table** uses
the native `<table>` element: comparison, pricing and API tables, reference data. Its
cells are not focusable, and the only controls are ordinary tab stops such as sort buttons
or links. An **interactive data grid** is a single composite tab stop with cell focus, row
selection, column resizing and virtualization. Of the libraries in the matrix only React
Aria ships a Table, and it ships only the second shape (`components.md`: RAC only, "Missing
in Ark; data-grid semantics"). TanStack Table is the headless *data model* most React teams
pair with a hand-written `<table>`. MUI X Data Grid is the reference for a full grid and has
the largest accessibility bug history. This note covers both shapes. It records how each
library built them and what went wrong, and it decides the phases: the static table first,
then the grid features.

Builds on [collections.md](collections.md) (keys, selection model, virtualization
contract), [grid-list.md](grid-list.md) (`collection-grid`: row and child focus, key
ownership), [scroll-area.md](scroll-area.md) and `code-block` "Scrollable Content" (when a
scroll container is a tab stop), [splitter.md](splitter.md) and [slider.md](slider.md)
(resizing and native range inputs), and the cross-cutting notes
[accessibility.md](accessibility.md), [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
("Tree / grid / table") and [native-platform.md](native-platform.md).

Sources read (sparse clones, 2026-10-19):

| Library | Files |
|---|---|
| React Aria (`adobe/react-spectrum` @ `2613443`) | `packages/react-aria/src/table/{useTable,useTableColumnHeader,useTableRow,useTableCell,useTableColumnResize,useTableSelectionCheckbox,TableKeyboardDelegate,utils}.ts`, `packages/react-aria/src/grid/{useGrid,useGridCell,useGridRow,GridKeyboardDelegate,useGridSelectionAnnouncement}.ts`, `packages/react-stately/src/table/{useTableState,useTableColumnResizeState,TableCollection,TableColumnLayout,TableUtils}.ts`, `packages/react-aria-components/src/Table.tsx` (2,436 lines) |
| TanStack Table (`TanStack/table` @ `95c4768`) | `packages/table-core/src/features/{row-sorting,column-sizing,column-resizing,row-selection,column-pinning}/*`, `core/*` |
| MUI X Data Grid | not cloned; behaviour from its issue tracker (cited below) |
| APG | [Table pattern](https://www.w3.org/WAI/ARIA/apg/patterns/table/), [Sortable Table example](https://www.w3.org/WAI/ARIA/apg/patterns/table/examples/sortable-table/), [Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) (fetched 2026-10-19) |

Zag/Ark, Radix, Base UI, Headless UI, Reka, Bits UI and Kobalte ship no Table. Base UI has
a Data Grid request ([BU#3328](https://github.com/mui/base-ui/issues/3328), open) and a
standalone virtualizer in progress ([BU#5466](https://github.com/mui/base-ui/issues/5466)).
Ariakit has an open grid request with span navigation
([AK#7355](https://github.com/ariakit/ariakit/issues/7355)); its UI kit styles a plain
`<table>` ([AK#7498](https://github.com/ariakit/ariakit/issues/7498)). Zag's closed treegrid
request ([ZG#3431](https://github.com/chakra-ui/zag/issues/3431)) calls treegrid "one of
the most mistake-prone APG patterns". shadcn's "Data Table" is TanStack Table plus native
table elements.

## Pattern

- **WAI-ARIA APG Table** (static). A table "is not an interactive widget": its cells are
  not focusable or selectable, and there is no keyboard interaction. Roles `table` ›
  `rowgroup` (optional) › `row` › `columnheader` / `rowheader` / `cell`. It is named with
  `aria-labelledby` or `aria-label` (a native `<caption>` names it), and described with
  `aria-describedby`. `aria-sort` goes on the header of the sorted column. `aria-rowcount`,
  `aria-rowindex`, `aria-colcount` and `aria-colindex` are used only when rows or columns
  are missing from the DOM. APG: "use the native HTML `table` element whenever possible".
  Widgets inside a static table are ordinary tab stops. APG says a grid shortens that tab
  sequence.
- **APG Sortable Table example.** Native `table` + `caption`. Each sortable header's text is
  wrapped in a `<button>` that fills the header cell. `aria-sort` (`ascending` or
  `descending`) sits on the `th` of the sorted column **only**: it is removed from the
  previous column. Unsorted sortable columns may show a diamond whose shape differs from the
  arrows by more than colour or size. The arrow glyphs are `aria-hidden` and chosen to
  survive high-contrast inversion. The help text about the buttons sits in the caption, not
  on each button, to avoid repetition. There is no custom keyboard support: native buttons
  only.
- **WAI-ARIA APG Grid** (data grid). One tab stop. Arrows move one cell and **stop at the
  edges** ("wrapping … would be disorienting in data grids"). PageUp/PageDown move an
  author-set number of rows. Home/End go to the first/last cell of the row, Ctrl+Home and
  Ctrl+End to the first/last cell of the grid. Selection keys: Ctrl+Space selects the
  column, Shift+Space the row, Ctrl+A everything, Shift+Arrow extends. Every cell is
  focusable or contains the focus target. Header cells without a function (sort, filter)
  may be skipped. Widgets that need arrows use an editing mode: Enter or F2 enters, Escape
  leaves, and Tab moves between the cell's widgets. `aria-selected` on selected rows or
  cells, `aria-readonly`, `aria-sort`. On an HTML `table`, use native `rowspan`/`colspan`,
  not ARIA.
- **Choice of role.** A static table must not be `role="grid"`. JAWS users testing MUI's
  Data Grid: "described as being a grid, which would imply some kind of interactivity, but
  I can't seem to get it to behave like one" ([MUI-X#4124](https://github.com/mui/mui-x/issues/4124)).
  A grid must not be a static table either: arrow-key cell focus is what makes its single
  tab stop usable.
- ARIA 1.2 `aria-sort`: authors SHOULD set it on one header at a time. `aria-sort` is not
  exposed by TalkBack, so React Aria puts the direction into a description on Android
  (`useTableColumnHeader.ts`: "aria-sort not supported in Android Talkback").

## How the others built it

| | React Aria (RAC `Table`) | TanStack Table | MUI X Data Grid | APG sortable table |
|---|---|---|---|---|
| Markup | native `table`/`thead`/`tbody`/`tr`/`th`/`td` with **`role="grid"`** (always), `gridcell`, `columnheader`, `rowheader`; `div`s with the same roles when virtualized | none (consumer markup; `getAriaSort` helper added in [TS#6506](https://github.com/TanStack/table/pull/6506)) | `div[role=grid]`, `rowgroup`, `row`, `columnheader`, `gridcell`; `rowheader` opt-in since [MUI-X#23340](https://github.com/mui/mui-x/pull/23340) | native table, `role` implicit |
| Static table | no: always a grid | consumer's | no | yes |
| Name | `aria-label`/`aria-labelledby`, `<caption>` ([RA#9015](https://github.com/adobe/react-spectrum/issues/9015)) | consumer | `aria-label` | `<caption>` |
| Row header | required: throws "A table must have at least one Column with the isRowHeader prop" | consumer | `rowHeader` column option | `th scope=row` |
| Sort | `sortDescriptor` + `onSortChange` (controlled; never sorts data); press on the `th` itself; cycle asc ⇄ desc, no "none" ([RA#9375](https://github.com/adobe/react-spectrum/issues/9375), open) | sorts data (`getSortedRowModel`); cycle first → second → none (`enableSortingRemoval`), multi-sort with Shift (`isMultiSortEvent`), `sortDescFirst`, `sortUndefined: 'first'/'last'` | menu + header press | `<button>` in `th` |
| `aria-sort` | `ascending`/`descending` on the sorted column, `none` on other sortable columns; omitted on Android | consumer | on sorted column | sorted column only |
| Sort announcement | `announce(sortDescription, 'assertive', 500)` after the first render | — | — | none |
| Focus | grid: roving `tabIndex` on cells or rows (`focusMode` `row` / `cell`), columns focusable, header arrows **wrap** (`findNextColumnKey`) | — | grid: roving cell focus | native |
| Selection | `selectionMode`, `selectionBehavior`, checkbox column, select-all header checkbox, `useGridSelectionAnnouncement` | `rowSelection` state only | checkbox column | — |
| Resize | `ResizableTableContainer` + `ColumnResizer`: visually hidden **`<input type=range>`**, `aria-valuetext` "N pixels", Enter to start resizing; widths px / % / `fr` with min/max (`TableColumnLayout`), `table-layout: fixed`, `width: min-content` | `columnSizing` + `getResizeHandler` (mouse/touch only, no keyboard), `onChange`/`onEnd` modes, RTL flag | drag handle, no keyboard | — |
| Virtualization | own `Virtualizer` + `TableLayout`; swaps native elements for `div`s with roles, `aria-rowcount`/`aria-rowindex` | consumer (TanStack Virtual) | built in, rows and columns | — |
| Empty | `renderEmptyState` → a row with one cell spanning all columns | consumer | overlay | — |

### React Aria (Components)

- Source: `useTable.ts` wraps `useGrid` and adds the header rows to `aria-rowcount` when
  virtualized. It switches to `role="treegrid"` with a `treeColumn`. It describes the sort
  through `useDescription` and announces it assertively on change. `TableKeyboardDelegate`
  extends `GridKeyboardDelegate`: Down from a column goes to the first row's cell in that
  column; Up from the first row goes to the column header; Left/Right on headers **wrap**.
  `useTableColumnHeader`: a `columnheader` cell made pressable with `usePress` to sort
  (`state.sort(key)`). It gets `aria-sort` and a "sortable" description. Header cells get
  `tabIndex=-1` when the body is empty.
- `useTableState`: `sort(column, direction?)` toggles to the opposite direction for the
  sorted column, else `ascending`. `isKeyboardNavigationDisabled` is true while the
  collection is empty or a resizer is active. `showSelectionCheckboxes` adds a column.
- `useTableColumnResize`: a visually hidden `input[type=range]` (min/max/value in px,
  `aria-valuetext` "{value} pixels", labelled by `<resizer id> <column header id>`). Enter
  toggles a resize mode that disables grid navigation. Arrows step by 10 px; Up/Down map to
  Right/Left. Escape, Space or Tab end it and focus returns to the header. Pointer: `useMove`
  with deltas mirrored in RTL.
- `TableColumnLayout` / `TableUtils.calculateColumnSizes`: widths are static (px, %) or
  dynamic (`fr`, default `1fr`) with min/max. The remaining width goes to `fr` columns.
- RAC `Table.tsx`: `TableElementType` renders `table` unless `isVirtualized`, then `div`.
  `ResizableTableContainer` measures the nearest scrollable ancestor with a
  `ResizeObserver` and sets `table-layout: fixed; width: min-content` (comment: Firefox bug
  1959353 rules out `fit-content`, [RA#9865](https://github.com/adobe/react-spectrum/issues/9865)).
  `renderEmptyState` renders a row with one `rowheader` spanning all columns. It supports
  `TableLoadMoreItem`, drag and drop, `onRowAction`, row `href`, footer (`tfoot`) and
  `colSpan` ([RA#7638](https://github.com/adobe/react-spectrum/pull/7638)).
- Notable: the most complete interactive table. One keyboard delegate shared with Grid
  List. The sort is controlled and data-agnostic. Resizing uses a native range input, which
  TalkBack can adjust (cause J). Selection is announced for WebKit.
- Problems: there is no static mode at all. Every RAC table is a `grid` with roving focus,
  so a docs or pricing table pays for the composite (no native text selection,
  [RA#2585](https://github.com/adobe/react-spectrum/issues/2585), open since 2021). The
  resizer's value leaks into cell names ("Type 75 pixels column 3",
  [RA#9160](https://github.com/adobe/react-spectrum/issues/9160), open). Sortable header text
  needs a hand-added `tabIndex` and role ([RA#8502](https://github.com/adobe/react-spectrum/issues/8502)).
  Rendering, focus, virtualization and SSR bugs follow in Bug history.

### TanStack Table

- Source: `features/row-sorting/rowSortingFeature.utils.ts`. `column_getNextSortingOrder`
  goes first direction → opposite → `false` (removal) unless `enableSortingRemoval: false`.
  `column_getAutoSortDir` picks `asc` for strings and `desc` for anything else, from the
  first 10 rows. `isMultiSortEvent` defaults to `e.shiftKey`. `createSortedRowModel`
  handles `sortUndefined` ('first' / 'last' / ±1) and `invertSorting`.
  `features/column-resizing/*`: `columnResizeMode` `onChange` / `onEnd`,
  `columnResizeDirection` `ltr` / `rtl`, and a mouse/touch-only `getResizeHandler`.
- API shape: a data model (`useReactTable({ data, columns, state })`) that yields header
  groups, rows and cells. The consumer renders everything, including roles and keys.
- Notable: the sort semantics users expect from spreadsheets (removal, empty values last,
  stable order) live in a pure model, testable without a DOM. rind-ui copies the pure parts.
- Problems: accessibility is entirely the consumer's. Sort headers were mouse-only until
  consumers added focus ([TS#842](https://github.com/TanStack/table/issues/842),
  [TS#1855](https://github.com/TanStack/table/issues/1855)). v7 added redundant roles to
  native elements ([TS#2862](https://github.com/TanStack/table/issues/2862)). Height-limited
  tables scroll the page in Chrome when the row count changes
  ([TS#4901](https://github.com/TanStack/table/issues/4901), open). Resizing has no keyboard
  path.

### MUI X Data Grid

- `div` grid with roving cell focus, column header menus, checkbox selection column,
  virtualization of rows and columns.
- Problems (all from its tracker): sortable columns not discoverable by JAWS, and "grid"
  semantics with no grid behaviour ([MUI-X#4124](https://github.com/mui/mui-x/issues/4124),
  open). The column header's accessible name includes its buttons ("ID 1 active filter
  Sort", [MUI-X#19239](https://github.com/mui/mui-x/issues/19239)). Every sort button is
  named "Sort" ([MUI-X#16456](https://github.com/mui/mui-x/issues/16456), open). A button
  in a header breaks grid navigation: Tab walks the buttons
  ([MUI-X#18876](https://github.com/mui/mui-x/issues/18876), open). NVDA users are trapped in
  the checkbox cell ([MUI-X#9097](https://github.com/mui/mui-x/issues/9097), open). The body
  cannot be re-entered by Tab after a page change
  ([MUI-X#11629](https://github.com/mui/mui-x/issues/11629), open). The selection column has
  no label ([MUI-X#14285](https://github.com/mui/mui-x/issues/14285)). There were no row
  headers until 2026 ([MUI-X#23340](https://github.com/mui/mui-x/pull/23340)).

## Accessibility

Apply [accessibility.md](accessibility.md) (§1.5: Table pattern for the static table, Grid
for the interactive one, Treegrid for expandable rows) and
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) §1.4 "Tree / grid /
table".

- **Native first** ([native-platform.md](native-platform.md)): `<table>`, `<caption>`,
  `<thead>`/`<tbody>`/`<tfoot>`, `<th scope>` and `rowspan`/`colspan` give every role,
  header association and span without ARIA. No ARIA role is added to a native element in
  the static table (accessibility rule 4, [TS#2862](https://github.com/TanStack/table/issues/2862)).
  `scope="col"` / `scope="row"` are written out (and `colgroup` / `rowgroup` on spanning
  headers) so that header association does not depend on a browser's heuristics.
- **CSS `display` on table elements.** Changing the `display` of `table`, `tr`, `th` or `td`
  (`block`, `flex`, `grid`, `contents`) has removed table semantics in Chromium and WebKit
  at various times (Adrian Roselli, "Tables, CSS Display Properties, and ARIA", updated
  through 2024). Fixes landed unevenly, and responsive "stacked" tables are the usual cause.
  Decision: the theme never changes the `display` of table parts. Narrow viewports scroll
  the table (WCAG 1.4.10 exempts two-dimensional tables from reflow), and a test checks the
  computed display.
- **Name**: a `<caption>` names the table natively. A visually hidden caption is the same
  `<caption>` styled with `core/dom/visually-hidden`. In development, a table with no
  caption, `aria-label` or `aria-labelledby` gets a warning: it is not required by ARIA for
  `table`, but every table in our docs needs one.
- **Scroll container.** A table wider (or taller) than its box needs a scroll container
  that a keyboard user can reach: axe `scrollable-region-focusable`, WCAG 2.1.1. Firefox
  and Chrome 130+ make scrollers without focusable content keyboard-focusable by
  themselves. Safari does not ([scroll-area.md](scroll-area.md)). We reuse the Scroll Area
  rule: `tabindex="0"` only when measured, overflowing and without tabbable content, never
  before measurement, never removed while focused. While it is a tab stop the container is a
  `group` named by the caption, as code-block's Content is a `group` named by its Title. Not
  a `region`: a page of tables would otherwise fill the landmark list.
- **Sorting**: a `<button>` inside the `th`, named by the column's text only (APG). Never
  a pressable `th` ([TS#1855](https://github.com/TanStack/table/issues/1855),
  [RA#8502](https://github.com/adobe/react-spectrum/issues/8502)), and never "Sort" as the
  name ([MUI-X#16456](https://github.com/mui/mui-x/issues/16456)). `aria-sort` goes on the
  sorted `th` only. Unsorted sortable columns carry no `aria-sort` (APG, ARIA 1.2 "one
  header at a time"); React Aria's `none` is not copied. The direction glyph is
  `aria-hidden`. A change is announced through the injected Announcer, politely: pressing a
  button inside a header does not re-read the header's `aria-sort` in NVDA, JAWS or VO.
  React Aria announces assertively, but accessibility rule 25 keeps assertive for errors.
  On Android, TalkBack ignores `aria-sort`, so the sorted column's trigger gets a
  description with the direction, behind a quirk-registry entry.
- **Focus not obscured** (WCAG 2.4.11): a sticky header hides a focused link or button
  scrolled under it ([RA#5621](https://github.com/adobe/react-spectrum/issues/5621), fixed
  with `scroll-padding`). The container gets the measured head height as a CSS variable,
  and the theme sets `scroll-padding-block-start` from it (`scroll-padding-inline-start`
  for a sticky first column).
- **Interactive grid** (later phases): all of the "Tree / grid / table" list applies. The
  selected-row state is not announced in WebKit (235068, quirk
  `webkit-grid-selection-not-announced` already exists). Header and index are not announced
  (236790). Navigation breaks while a virtualized grid scrolls (236865). VO reads the
  previous cell on fast keys ([RA#7734](https://github.com/adobe/react-spectrum/issues/7734),
  open). Virtualized columns are skipped ([RA#9550](https://github.com/adobe/react-spectrum/issues/9550)).
  NVDA stays in browse mode on checkboxes in cells (RA#7300, MUI-X#9097). The resizer
  leaks into cell names ([RA#9160](https://github.com/adobe/react-spectrum/issues/9160)).
  Firefox `role=presentation` + `tabindex` breaks the table
  ([RA#4382](https://github.com/adobe/react-spectrum/issues/4382)). Each of these becomes a
  scenario or a manual-protocol item of the phase that introduces it.
- **Forced colors**: cell borders use `CanvasText` (backgrounds disappear, borders stay).
  The sort glyph is drawn with a shape that survives inversion, and the unsorted glyph
  differs in shape (APG). The sort trigger's focus ring is an `outline`.
- **Targets**: the sort trigger fills its header cell, at least 24 × 24 CSS px (WCAG 2.5.8).
- **RTL**: logical properties only. The sticky first column sticks at
  `inset-inline-start`. Grid arrows are mirrored in later phases (rule 17).
- **Motion**: none in phase 1. Scroll shadows are static gradients toggled by `data-*`.

## Bug history

"RA" = adobe/react-spectrum, "TS" = TanStack/table, "MUI-X" = mui/mui-x. Searched
2026-10-19 (`gh search issues`: `table in:title`, `tableview in:title`, `aria-sort`,
`column resizer`, `table sticky`, `table screen reader`; TanStack `accessibility`, `aria`,
`sticky header`; MUI X `aria-sort`, `data grid screen reader`, `role grid accessibility`;
Radix, Base UI, Ariakit, Zag `table`). Each cited issue was opened.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| MUI-X | [#4124](https://github.com/mui/mui-x/issues/4124) open | JAWS: sortable columns not discoverable, "described as a grid" but behaves like a static table | Grid role without grid behaviour; sort controls are plain text | Open | Static data is a native `table`; sort is a named `<button>` (scenario) |
| RA | [#2585](https://github.com/adobe/react-spectrum/issues/2585) open | Cannot select text in a table | Every table is a composite; press handlers on cells | Open since 2021 | Phase 1 adds no handler to cells or rows; text selection is native (scenario) |
| TS | [#842](https://github.com/TanStack/table/issues/842), [#1855](https://github.com/TanStack/table/issues/1855) closed | Sort headers not reachable or activatable by keyboard | Click handler on `th` | Consumer adds `tabIndex` | Sort only through a native button (scenario) |
| RA | [#8502](https://github.com/adobe/react-spectrum/issues/8502) open, [#10364](https://github.com/adobe/react-spectrum/pull/10364) | Header text made focusable with `tabIndex` has no role | Docs advise `span tabIndex=-1` next to the resizer | Starters add `role=button` | Sort trigger is a `<button>`; no focusable spans |
| MUI-X | [#16456](https://github.com/mui/mui-x/issues/16456) open | Every sort button named "Sort" | Fixed label | Open | Trigger named by the column's text (scenario) |
| MUI-X | [#19239](https://github.com/mui/mui-x/issues/19239) closed | Column header's name is "ID 1 active filter Sort" | Header name from all content, including buttons | Fixed | Header name is its text; glyphs `aria-hidden`; resizer (phase 3) outside the name |
| RA | [#9160](https://github.com/adobe/react-spectrum/issues/9160) open | NVDA/JAWS read "Type 75 pixels column 3" on every cell | Resizer range input inside the header, part of its name | Open | Phase 3: header named by its text part (`aria-labelledby`), resizer excluded |
| RA | [#9375](https://github.com/adobe/react-spectrum/issues/9375) open | Cannot cycle back to "unsorted" | Two-state toggle only | Open (proposes `allowsUnsorted`) | `allowUnsorted` adds `null` to the cycle (scenario) |
| TS | [#6086](https://github.com/TanStack/table/pull/6086), `sortUndefined` | Empty values interleaved with data, or flip ends with direction | Comparator treats `null` as a value | `sortUndefined` / `sortEmpty` options | `sortItems` puts empty values last in both directions (scenario) |
| RA | [#5621](https://github.com/adobe/react-spectrum/issues/5621) closed | Focused row hidden under a sticky `thead` | No scroll padding | `scroll-padding` | Head height as a variable; theme scroll padding (scenario) |
| RA | [#10182](https://github.com/adobe/react-spectrum/issues/10182), [#10196](https://github.com/adobe/react-spectrum/issues/10196) open | Page jumps when keyboard focus moves under sticky elements | Custom `scrollIntoView` centring | Open | Phase 1 never scrolls programmatically; native focus scrolling + `scroll-padding` |
| RA | [#9865](https://github.com/adobe/react-spectrum/issues/9865) closed | Column widths ignored in Firefox | `table-layout: fixed` + `width: fit-content` (bmo 1959353) | `width: min-content` | Phase 3 layout uses `min-content`; Firefox in the browser suite |
| RA | [#9707](https://github.com/adobe/react-spectrum/issues/9707) open, [#4870](https://github.com/adobe/react-spectrum/issues/4870) closed, [#8239](https://github.com/adobe/react-spectrum/issues/8239) open | Table renders no rows without JS / on the server; not interactive on first click after SSR | Hidden-document collection builder and virtualizer need a client pass | Open | Static table renders fully on the server; hydration test with zero warnings (scenario) |
| RA | [#10121](https://github.com/adobe/react-spectrum/issues/10121) open, [#3422](https://github.com/adobe/react-spectrum/pull/3422) | With no rows, header menus (filters) cannot be reached, so the filter cannot be cleared | Grid disables navigation when empty | Open | Phase 1: header buttons are tab stops whatever the body; phase 2: headers stay focusable when empty |
| RA | [#10235](https://github.com/adobe/react-spectrum/issues/10235) open | Empty state not rendered without a fixed height | Virtualized layout sizes from rows | Open | `Empty` is a normal row in normal flow |
| RA | [#2001](https://github.com/adobe/react-spectrum/issues/2001) closed | TalkBack's "checked" interrupts the selection announcement | Two announcements at once | Fixed | Phase 2: no selection announcement for a checkbox toggle (the checkbox speaks) |
| RA | [#7734](https://github.com/adobe/react-spectrum/issues/7734) open | VO reads the previously focused cell on fast arrows | AT lags behind `focus()` | Open | Phase 2 manual-protocol item; no artificial delay |
| RA | [#9550](https://github.com/adobe/react-spectrum/issues/9550) closed | SR skips cells when columns are virtualized | Columns missing from the DOM | Fixed | Phase 4 virtualizes rows only, never columns |
| RA | [#4382](https://github.com/adobe/react-spectrum/issues/4382) closed | Screen readers do not work in Firefox on TableView | `role=presentation` + `tabindex` wrapper breaks the table tree (bmo 616594) | Fixed (#6465) | No wrapper element between table parts; no presentational focusable nodes |
| RA | [#7300](https://github.com/adobe/react-spectrum/issues/7300) closed, MUI-X [#9097](https://github.com/mui/mui-x/issues/9097) open | NVDA stuck on checkboxes in cells | NVDA focus mode on native checkbox in a grid | Workarounds | Phase 2 manual-protocol item |
| MUI-X | [#18876](https://github.com/mui/mui-x/issues/18876) open | A button in a column header breaks grid navigation; Tab walks every button | Header controls left in the tab order of a composite | Open | Phase 2: header controls are `item-control`s under `collection-grid` key ownership |
| MUI-X | [#11629](https://github.com/mui/mui-x/issues/11629) open | Body cannot be re-entered by Tab after a page change | Roving tab stop pointed at a removed cell | Open | Phase 2: collections repair (the tab stop survives a collection change) |
| MUI-X | [#14285](https://github.com/mui/mui-x/issues/14285) closed, RA [#10529](https://github.com/adobe/react-spectrum/issues/10529) closed | Selection column / select-all checkbox unlabeled or label not translatable | Hard-coded or missing label | Fixed | Phase 2: labels from `messages`, row checkbox named "Select {row header}" |
| RA | [#9863](https://github.com/adobe/react-spectrum/issues/9863) open | Row `href` cannot be opened in a new tab | Row is not an `<a>` (tables cannot nest one around a row) | Open | No row `href` in phase 1; a link in the row header cell is the documented pattern |
| RA | [#10080](https://github.com/adobe/react-spectrum/issues/10080) closed, [#8033](https://github.com/adobe/react-spectrum/issues/8033) closed | No rows after id `0`; duplicate id crashes | Falsy key; no duplicate check | Fixed | Column ids are non-empty strings, `"0"` valid; duplicate column id is a dev error |
| RA | [#10477](https://github.com/adobe/react-spectrum/issues/10477), [#10088](https://github.com/adobe/react-spectrum/issues/10088), [#10759](https://github.com/adobe/react-spectrum/issues/10759) open | Focusing a cell or resizing re-renders every cell | Unstable context identity, `focusedKey` in shared context | Open | Per-key selectors (collections); phase 1 has no per-cell state at all |
| RA | [#10708](https://github.com/adobe/react-spectrum/issues/10708), [#10706](https://github.com/adobe/react-spectrum/issues/10706), [#10518](https://github.com/adobe/react-spectrum/issues/10518) open | Virtualized table: measured heights discarded on resize, scroll cost grows, sticky column cannot stick | Layout engine owns measurement and positioning | Open | Phase 4 keeps native table layout; rind-ui ships no layout engine |
| TS | [#4901](https://github.com/TanStack/table/issues/4901) open | Height-limited table scrolls the page in Chrome when rows change | Scroll anchoring on the outer scroller | Open | Root is the scroll container; `overflow-anchor` checked in the browser suite |
| Radix | [#2783](https://github.com/radix-ui/primitives/issues/2783) closed, [#3646](https://github.com/radix-ui/primitives/issues/3646) open | Sticky headers break inside ScrollArea; layout breaks | Viewport wraps content in a `display: table` div | Partly fixed | Table's own Root is the scroller; no wrapper between it and the `<table>` |
| Ariakit | [#6543](https://github.com/ariakit/ariakit/pull/6543) | Cells shift under the wrong header when a value is null | Cells rendered from each row's own keys | Fixed | Docs: render one `Cell` per column whatever the value |
| RA | [#9015](https://github.com/adobe/react-spectrum/issues/9015) closed | No caption part | — | Added | `Caption` part, names the table and the scroll stop |
| RA | [#7638](https://github.com/adobe/react-spectrum/pull/7638), [#9112](https://github.com/adobe/react-spectrum/issues/9112) open, [#9394](https://github.com/adobe/react-spectrum/issues/9394) | `colSpan` added late; `rowSpan` and multiple header rows requested | Collection model is a strict grid | Partly | Static table: native `colSpan`/`rowSpan` and several head rows pass through |

## Known pitfalls

- **One role for two jobs.** React Aria (always `grid`) and MUI X (always `grid`) give
  static data a composite, which costs text selection, SSR and plain screen-reader table
  navigation. TanStack gives nothing. Two explicit shapes: `table` and, later, `grid`.
- **Sort controls that are not buttons** (pressable `th`, focusable spans) recur in every
  tracker. So do **names polluted by controls** (header names including filters, sort
  labels, resizer values).
- **`display` overrides** strip semantics. **Sticky + `border-collapse: collapse`**: the
  borders of a sticky cell stay behind when it sticks, so the theme uses
  `border-collapse: separate` with `border-spacing: 0`. A sticky cell needs an opaque
  background.
- **Wrappers between table parts** (`div`s, presentational focusable nodes) break the
  table tree in Firefox (RA#4382). Scroll wrappers that change the formatting context
  break sticky positioning (Radix#2783).
- **SSR**: collection builders that need a client pass render empty tables without JS.
- **Measurement on the server**: the overflow tab stop and the head height are client-only.
  Nothing measured may be in the server HTML (Scroll Area decision).

## Testing notes

- Fixtures: an API table (row headers, code in cells, caption), a pricing comparison
  (column groups with `colSpan`, a head of two rows, sticky first column), a wide sortable
  table in a narrow box, an empty sortable table, a table without overflow, a table whose
  cells hold links, RTL.
- Driver: locate by role `table` and accessible name. `columns()` returns name, sortable
  and `aria-sort`. `rows()` returns the cell text matrix of the body (row headers
  included). `cell(row, column)` finds a cell by row header text and column name.
  `sortBy(column)` presses the trigger (pointer, keyboard, virtual click). `sort()` returns
  the descriptor read from `aria-sort`. `isScrollStop()`, `focusScroller()`.
- Invariants: at most one `aria-sort` in the table; it matches the machine's sort; every
  sortable header holds exactly one button named by the header text; the container is a
  tab stop exactly by the rule and is then named; no part of a table has a computed
  `display` other than its native one under the theme; announcements go through the
  Announcer only.
- Hard to test: what NVDA, JAWS and VO say when a sort button is pressed inside a header
  (manual protocol); TalkBack's lack of `aria-sort` (manual, Android).

## Decisions

### Shape and phases

The Table ships in four changes, each complete (machine, connect, parts, contract, driver,
tests, theme, examples, docs):

1. **`add-table` — static table** (this change). Native `<table>`, no composite, no cell
   focus. Caption, head/body/foot, column and row headers, native spans, a scroll container
   that is a tab stop only when it must be, sticky head and first column in the theme,
   sorting through header buttons, an empty row, a loading state. This covers the docs
   site's API, comparison and pricing tables and reado-web's simple tables.
2. **`add-table-grid` — interactive grid.** The same parts. `Table.Table` takes
   `interaction="grid"`, which renders `role="grid"` on the native `<table>`, `gridcell`
   on cells, and roving focus over cells with a column axis. Its keys are APG Grid's: no
   wrap, Home/End in the row, Ctrl+Home/End in the grid, PageUp/Down. `collection-grid`
   gains a column axis (its "Table and Calendar extend it" note): the child index becomes
   a column index, and header cells are a header row. It adds row selection from
   `selection-model` (checkbox column, select-all header checkbox, Shift+Space, Ctrl+A,
   range by Shift+click), row actions, typeahead on the row-header text, and editing mode
   (Enter or F2 into a cell's controls, Escape out; key ownership per `collection-grid`).
   Headers stay focusable when the body is empty (RA#10121). Selection announcements reuse
   `webkit-grid-selection-not-announced`. A row header is required in this mode (dev
   error, as RA). `interaction` changes the role and key handling, which is why it is a
   prop and not composition: the parts stay the same, and accessibility rule 6 holds
   either way.
3. **`add-table-column-resize`.** A `ColumnResizer` part inside a `ColumnHeader`: a
   visually hidden native `input[type=range]` (TalkBack can adjust it, cause J), named
   "Resize {column}" and with `aria-valuetext` "{n} pixels" from messages. The header is
   named by its text part through `aria-labelledby`, so the resizer is outside its name
   (RA#9160). Pointer drag through `core/dom/pointer-drag`. Widths in px, % or `fr` with
   min/max. `table-layout: fixed; width: min-content` (RA#9865). Widths written as CSS
   variables, so a drag does not re-render cells (RA#10490/#10267). Controlled `widths`
   with `onResize` / `onResizeEnd`.
4. **`add-table-virtualization`.** Rows only, never columns (RA#9550). The native
   `<table>` is kept, with spacer rows (`aria-hidden`, no tabindex) above and below the
   rendered window, and `aria-rowcount` / `aria-rowindex` counting the head rows (as RA).
   It uses the collections virtualization contract (`scrollToIndex`, persisted keys, ids
   from keys). rind-ui ships no layout engine (RA#10706/#10708/#10518).

Expandable rows (`treegrid`) and drag-and-drop reordering are not scheduled: they follow
Drag and Drop and a treegrid research pass.

### Phase 1 (`add-table`)

- **Parts** (all accept `render`): `Root` (`div`, the scroll container; owns the machine),
  `Table` (`table`), `Caption` (`caption`), `Head` (`thead`), `Body` (`tbody`), `Foot`
  (`tfoot`), `Row` (`tr`), `ColumnHeader` (`th scope="col"`, or `colgroup` when
  `colSpan > 1`; props `id`, `sortable`, `firstDirection`), `RowHeader` (`th scope="row"`,
  or `rowgroup` when `rowSpan > 1`), `Cell` (`td`), `SortTrigger` (`button type="button"`
  inside a sortable `ColumnHeader`), `SortIndicator` (`span aria-hidden`), `Empty` (`tr`
  with one `td` spanning every column).
- **Machine** `table`: one state `idle`. Context: `sort` (controllable
  `SortDescriptor | null`), `pending` (a controlled proposal not yet applied), `measured`,
  `overflow` (x, y), `tabbableContent`, `focused` (the Root). Events:
  `SORT { column, modality }`, `SORT.SYNCED`, `MEASURED { overflow, tabbable }`,
  `ROOT.FOCUS`, `ROOT.BLUR`. Effects: `announce` (Announcer), and the measurements in
  `core/dom` (`overflow.ts`, `tabbable-content.ts`, the edges of `scroll-metrics.ts`, a
  `ResizeObserver` on the head that writes `--rind-table-head-height` and
  `--rind-table-first-column-width`).
- **Sort cycle**: pressing an unsorted column sorts it by its `firstDirection` (default
  `ascending`). Pressing the sorted column flips the direction. With `allowUnsorted` it
  goes first → opposite → `null`. Multi-column sort is a non-goal (`aria-sort` is one
  header at a time).
- **rind-ui does not sort data.** `onSortChange` hands the descriptor to the consumer. A
  pure helper `sortItems(items, sort, getValue, { locale })` is exported for the common
  case. It is stable, uses `Intl.Collator(locale, { numeric: true })` for strings, compares
  numbers, bigints and dates by value, and puts `null`, `undefined` and `""` last in both
  directions.
- **Announcement**: when a user's sort press changes the effective sort (at once when
  uncontrolled, when the prop arrives when controlled), announce
  `messages.sorted(columnName, direction)` politely ("Sorted by Name, ascending"), or
  `messages.unsorted` ("Sort cleared"). A parent's own change is not announced.
- **Android**: quirk `talkback-aria-sort` (`p.android`). The sorted column's trigger gets
  `aria-describedby` pointing at a visually hidden direction text from messages.
- **Scroll stop**: the Scroll Area "Viewport Tab Stop" rule. While it is a stop, the Root
  has `role="group"` and `aria-labelledby` the Caption (else the Table's `aria-label` is
  copied as its `aria-label`); otherwise no role, no name. `data-overflow-x`,
  `data-overflow-y`, `data-overflow-x-start`, `data-overflow-x-end` for scroll shadows.
  Nothing measured in the server HTML.
- **`data-*`**: every part `data-scope="table"`, `data-part`. Root: `data-overflow-*`,
  `data-sticky-first-column` (prop `stickyFirstColumn`), `data-focus-visible`.
  Table: `data-loading` (+ `aria-busy="true"`), `data-sorted` while sorted, `data-empty`
  while an `Empty` row is rendered. ColumnHeader: `data-sortable`,
  `data-sort="ascending|descending"` (sorted only). SortTrigger and SortIndicator:
  `data-direction="ascending|descending|none"`. Rows and cells: none.
- **Contract** `tableContract`: locate by role `table` + name. Actions `sortBy(column)`,
  `focusScroller()`. Queries `name`, `columns`, `rows`, `cell`, `sort`, `isScrollStop`,
  `isEmpty`, `isLoading`. Traits: none of the existing ones apply. Invariants as in Testing
  notes.
- **Theme** `table.css`, family `decoration` (own tokens `--rind-table-*`, no variant, no
  size). `border-collapse: separate; border-spacing: 0`. The head row is sticky
  (`position: sticky; inset-block-start: 0`) with an opaque background whenever the Root
  scrolls vertically. The first column is sticky with `data-sticky-first-column`. Scroll
  padding comes from the head height. Scroll shadows come from `data-overflow-x-start` /
  `-end`. `font-variant-numeric: tabular-nums` in cells. The sort trigger fills the header
  (≥ 24 px). The indicator draws ▲ / ▼ and a distinct unsorted shape. Forced colors:
  borders `CanvasText`, indicator `CanvasText`, focus `Highlight`. The `display` of table
  parts is never changed.

### Deliberately different from the others, and why

| Others | rind-ui | Why |
|---|---|---|
| Always `role="grid"` (RA, MUI X) | Static native table first; grid is an opt-in phase | APG: a table is not a widget; text selection, SSR, plain SR table reading (MUI-X#4124, RA#2585) |
| Pressable `th` (RA, TanStack examples) | `<button>` inside `th` | APG example; native keyboard and AT activation; no role hacks (RA#8502) |
| `aria-sort="none"` on sortable columns (RA) | Only the sorted header | ARIA 1.2 "one at a time"; APG |
| Assertive sort announcement (RA) | Polite, only for user-initiated changes | Accessibility rule 25 |
| Table sorts the data (TanStack) | Consumer sorts; `sortItems` helper | Headless; server-sorted data works the same |
| Virtualized → `div`s (RA, MUI X) | Native table with spacer rows (phase 4) | Keeps native table semantics and layout |
| Resizer value inside the header name (RA) | Header named by its text part (phase 3) | RA#9160 |

## Open questions

- Is `role="group"` on the scroll container the right exposure, or should it be
  `region`? Code-block uses `group`. The manual protocol (NVDA, VO) decides. The spec says
  `group`, the same as code-block.
- Do NVDA and JAWS read `aria-sort` on the header when the user moves to it in browse mode
  after a sort? If so, the polite announcement may be dropped on Windows. Manual protocol.
- Phase 2: cell focus or row focus by default? Grid List focuses rows. APG's data grid
  focuses cells. RA offers both. The answer goes in `add-table-grid` after a prototype on VO.

## TanStack Table review: what it does better (2026-10-19)

Read again against phase 1, at `TanStack/table` `packages/table-core/src/features/*`
(row-sorting, column-filtering, global-filtering, column-faceting, column-pinning,
column-sizing, column-visibility, column-ordering, row-pagination). TanStack is a data model
with no markup and no accessibility; rind-ui's Table is the accessible view. They do not
compete: the right shape is rind's parts rendering TanStack's state when a team uses it, and
rind's own small helpers when it does not.

| Area | TanStack | rind-ui phase 1 | Verdict |
|---|---|---|---|
| Sort state | `SortingState` is an array: multi-column sort (`isMultiSortEvent`, Shift+click by default; `maxMultiSortColCount`) | one `{ column, direction }` | Adopt as an option later (`multiple`): `aria-sort` stays on the primary column only (APG), the others are described ("sorted second, descending") |
| Comparators | `sortingFn` per column (`alphanumeric`, `text`, `datetime`, `basic`, custom), `sortUndefined: "first" \| "last" \| 1 \| -1`, `invertSorting`, `sortDescFirst` | `sortItems` with one natural comparator; empties last; `firstDirection` | Adopt: `sortItems` options `compare` (per column) and `empty: "last" \| "first"`; `invertSorting` is a comparator |
| Pipeline | row models: filtered → sorted → paginated, memoized; `getFacetedUniqueValues` / min-max for filter UIs; global filter with `filterFns` | the consumer sorts | Adopt as pure helpers next to `sortItems`: `filterItems` (per-column filters + a global query) and `facetValues` (unique values with counts) for filter popovers. No row-model engine in the component |
| Columns as data | `columnHelper.accessor`, `accessorKey` / `accessorFn`, header and cell renderers | JSX per part | Keep JSX parts; document the data-driven pattern (map a column list) and a TanStack recipe |
| Pinning | `columnPinning: { start: string[], end: string[] }`, logical start/end, offsets from column sizes (`getStart`, `getAfter`) | `stickyFirstColumn` only, measured | Adopt the state shape and logical start/end. Keep measuring widths (TanStack needs fixed sizes; native auto layout does not), so any column can be pinned at either edge |
| Visibility / ordering | `columnVisibility` record, `columnOrder` | none | Consumer state; the toolbar recipe shows a "Columns" menu. No component state needed: hidden columns are not rendered |
| Accessibility | none (`getAriaSort` helper only) | native semantics, sort button, one `aria-sort`, announcements, scroll stop, focus not obscured, SSR | rind-ui is ahead; keep it |

Decisions for the next change (`table-columns-and-toolbar`): pinned columns at start/end with
measured offsets; a `FilterTrigger` per column composing Popover, with `filterItems` /
`facetValues`; sort and filter indicators that take any node per state; a table header area
(`Table.Header`, outside the scroll container) for a search field, actions and a full-page
toggle; `sortItems` comparators per column; a TanStack recipe in the docs.

## Columns, filters and the table's header (2026-10-19, for `table-columns-and-toolbar`)

Requested by the user: pinned columns at either edge, a filter icon per column opening a
popover, sort icons that change with the state, a header above the table for controls (a
search field, a full-page view, actions), and pagination. Everything customisable; the site
shows the most the component can do.

**Pinned columns.** TanStack keeps `{ start: string[], end: string[] }` and computes offsets
from fixed column sizes. Native auto layout has no fixed sizes, so offsets are measured: the
leaf header cells (last head row) of pinned columns are measured, and every cell at the same
visual column gets `position: sticky` plus an inline-start (or -end) offset, written by the
measuring module as a CSS variable. RA#10518 (sticky column breaks under virtualization) does
not apply: native layout. Grouped headers spanning a pinned and an unpinned column are not
pinned (documented). The scroll padding includes the pinned widths at each edge, so focus is
never hidden under them (WCAG 2.4.11).

**Filter in a header.** Two lessons: a header's accessible name must stay its text
(MUI-X#19239: "ID 1 active filter Sort"), and filter controls must stay reachable with no rows
(RA#10121). So the column header carries `aria-label` set to its text when it holds controls;
the filter trigger is a separate button named "Filter {column}" (`messages.filter`), with
`aria-haspopup="dialog"`, `aria-expanded`, and, while the column is filtered, a description
("Filtered") and `data-active`. The popover is the Popover component re-scoped to `table`
(as the Date Field picker re-scopes it), so dismissal, focus and nesting come for free.

**Icons by state.** SortIndicator takes a node per direction (`ascending`, `descending`,
`none` props), falls back to the provider's icons (`caret-up`, `caret-down`, a new
`caret-up-down`), then to the theme's CSS shapes. FilterIndicator takes `active` / `children`.

**The table's header and full page.** The Root must stay the scroller with the table as its
only child, so controls live in a new outer part, `Table.Frame`, holding `Table.Header`,
the Root and `Table.Footer`. Full page is a controllable `expanded` on the Frame: the Frame
covers the viewport as a modal layer (the overlay stack: outside inert, scroll locked, Escape
exits, focus stays inside), `role="dialog"` with `aria-modal` named by the caption while
expanded only. `Table.ExpandTrigger` is a toggle button (`aria-pressed`). No Fullscreen API:
it is refused in iframes and on iOS for non-video elements, and it changes the window.

**Search and result counts.** The search field is the consumer's Text Field in the Header;
`filterItems(items, { filters, query, getValue })` does the work. When the number of rows the
consumer passes (`rowCount` on the Root) changes after mount, the count is announced politely
("12 rows", `messages.rowCount`), debounced on the scheduler so typing announces once.

**Pagination.** The Pagination component in the Footer; `paginateItems(items, page,
pageSize)`; the page change keeps focus on the pagination control and the row-count
announcement covers the new page ("Rows 11 to 20 of 87").
