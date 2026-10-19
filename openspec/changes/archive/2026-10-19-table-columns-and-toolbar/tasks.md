## 0. Research and spec

- [x] 0.1 Research: TanStack Table review; columns, filters and header (`docs/research/table.md`)
- [x] 0.2 This change; `openspec validate table-columns-and-toolbar --strict`

## 1. Core

- [x] 1.1 Helpers `filterItems`, `facetValues`, `paginateItems`; `sortItems` `compare` / `empty`; node tests (scenarios)
- [x] 1.2 Machine: `pinnedColumns` value, `rowCount` / `rowRange` announcement (quiet period), `expanded` on a Frame machine (or the Table machine) with the modal layer effect
- [x] 1.3 Metrics: pinned offsets, `data-pinned`, edge flags, pinned widths variables
- [x] 1.4 Connect: `data-column`, header naming with controls, filter trigger, expand trigger, frame; messages `filter`, `filtered`, `expand`, `rowCount`, `rowRange`; meta; tests
- [x] 1.5 Icon set: `caret-up-down`, `funnel`, `funnel-simple`, `arrows-out`, `arrows-in`

## 2. React

- [x] 2.1 `Frame`, `Header`, `Footer`, `ExpandTrigger`, `Filter`, `FilterTrigger`, `FilterContent`, `FilterIndicator`; `SortIndicator` by state; `id` on any ColumnHeader

## 3. Contract and tests

- [x] 3.1 Contract actions `openFilter`, `closeFilter`, `setExpanded`; queries `pinned`, `isExpanded`, `isFilterActive`; invariants
- [x] 3.2 DOM tests (jsdom + 3 browsers) for every scenario; browser tests for pinned offsets (LTR/RTL) and full page

## 4. Theme, site, docs

- [x] 4.1 `table.css`: pinned cells, edge shadows, frame/header/footer, expanded, filter trigger; browser test
- [x] 4.2 Site: a data-table example (search, filters, pinned columns, full page, pagination, custom icons) + skin; ARIA snapshot; audit 0
- [x] 4.3 Docs: sections for each feature and a TanStack recipe; changeset

## 5. Proof

- [x] 5.1 lint, typecheck, docs:check, changed tests in three engines, site audit 0 findings

## 6. Expandable rows

- [x] 6.1 Machine value `expandedRows`, `multiple`, `ROW.TOGGLE`; connect for Row, RowTrigger, RowDetails; messages `rowDetails`; meta
- [x] 6.2 React `RowTrigger`, `RowDetails` (+ `id` on Row); contract `toggleRow(row)`, query `expandedRows`
- [x] 6.3 Tests (DOM, 3 engines), theme (chevron by state, details surface), site example (nested table and a card), docs
