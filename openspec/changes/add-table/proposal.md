## Why

The docs site and reado-web need simple, accessible tables: API references, comparison and
pricing tables, reference data. These tables must scroll on a phone without losing keyboard
access. No headless library ships that table. React Aria and MUI X render every table as a
`grid` composite. That costs text selection and server rendering, and screen-reader users
are told it is a grid when it does not behave like one (MUI-X#4124, RA#2585, RA#9707).
TanStack Table leaves all semantics to the consumer, and its bug history repeats the same
mistakes: sort headers that are not buttons, header names polluted by controls, focus
hidden under sticky headers, scroll containers that keyboards cannot reach.

This change ships the **static table**: phase 1 of the Table plan in the research note. The
interactive grid, column resizing and virtualization follow as separate changes, built on
the same parts.

Research: [table](../../../docs/research/table.md) ·
[accessibility](../../../docs/research/accessibility.md) §1.5, §2, §7, rules 4, 23, 25, 28 ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md)
§1.4 "Tree / grid / table", cause I ·
[scroll-area](../../../docs/research/scroll-area.md) (tab-stop rule) ·
[native-platform](../../../docs/research/native-platform.md)

Depends on: `add-foundations`, `add-a11y-foundations` (Announcer, quirks registry,
`visually-hidden`, modality), `add-scroll-area` (`overflow`, `tabbable-content`,
`scroll-metrics` in `core/dom`; the Viewport tab-stop rule), `add-collections`
(`item-registry` for column registration), `add-theme-system`.

## What Changes

- A public **Table** in `@rind-ui/core` (machine, connect, contract, messages, meta,
  `sortItems`) and `@rind-ui/react` (parts `Root`, `Table`, `Caption`, `Head`, `Body`,
  `Foot`, `Row`, `ColumnHeader`, `RowHeader`, `Cell`, `SortTrigger`, `SortIndicator`,
  `Empty`).
- Native table semantics with no ARIA roles added. Column and row headers carry an explicit
  `scope`, and `colSpan` / `rowSpan` and several head rows pass through.
- Sorting: a controllable `sort` descriptor with `onSortChange`. A `<button>` in each
  sortable header, `aria-sort` on the sorted header only, an optional unsorted step, a
  polite announcement of user sorts, and a TalkBack fallback behind a quirk entry. The
  consumer sorts its data. The pure `sortItems` helper covers the common case.
- A scroll container that is a keyboard tab stop only when it overflows and holds nothing
  focusable. It is then a group named by the caption, and it exposes the overflow edges for
  scroll shadows and the head height for scroll padding.
- An `Empty` row spanning every column, and a `loading` state (`aria-busy`).
- `getTable` driver, model-based tests, `table.css` (sticky head, optional sticky first
  column, scroll shadows, sort indicator, forced colors), site example and skin, docs page.
- Quirk entry `talkback-aria-sort`.

## Capabilities

### New Capabilities

- `table`: the static Table: anatomy, native semantics, naming, scroll container, sorting,
  `sortItems`, empty and loading, server rendering, data attributes, contract, invariants,
  theme.

### Modified Capabilities

- `a11y-quirks`: adds the `talkback-aria-sort` entry.

## Non-goals (later changes, decided in the research note)

- **`add-table-grid`**: `role="grid"`, cell focus and keyboard navigation, row selection,
  row actions, editing mode, typeahead.
- **`add-table-column-resize`**: the `ColumnResizer` part and column width layout.
- **`add-table-virtualization`**: row virtualization with spacer rows.
- Multi-column sort, expandable rows (treegrid), drag-and-drop reordering, row `href`,
  responsive "stacked" layouts (they change `display` and strip table semantics).
- Framework adapters other than React; fx.

## Impact

- New: `packages/core/src/components/table/`, `packages/react/src/table/`, `getTable` in
  `@rind-ui/testing`, `packages/theme/src/table.css` (family `decoration`), a quirk entry in
  `core/dom/quirks.ts`, site example and skin, `docs/components/table.md`.
- No new dependency.
