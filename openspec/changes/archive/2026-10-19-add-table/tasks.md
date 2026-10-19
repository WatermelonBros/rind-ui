## 0. Research and spec

- [x] 0.1 Research note `docs/research/table.md` (React Aria, TanStack Table, MUI X, APG Table / Sortable Table / Grid; bug history; a11y; phases)
- [x] 0.2 This change: proposal, design, `specs/table/spec.md`, `specs/a11y-quirks/spec.md`; `openspec validate add-table --strict`

## 1. Machine

- [x] 1.1 `table.machine.ts`: state `idle`, events per design §2, `nextSort` (first direction, flip, `allowUnsorted`), one write path with controlled `pending` and `SORT.SYNCED`, tab-stop rule kept while focused, `announce` and `measure` effects
- [x] 1.2 `table.sort.ts`: `sortItems` per design §4
- [x] 1.3 Node tests: sort cycle, controlled refusal and arrival, announcements only for user proposals, tab-stop rule (measured, overflow, tabbable, focus kept), `sortItems` (natural order, empty values last both ways, stability, mixed types, input untouched)

## 2. Connect

- [x] 2.1 `table.connect.ts`: parts and attributes per design §3 (scopes, `aria-sort` on the sorted header only, Root group and name while a tab stop, scroll-metric attributes, Empty `colSpan`, development warnings for a missing name and duplicate column ids)
- [x] 2.2 `table.messages.ts`: `sorted`, `unsorted`, `sortState`
- [x] 2.3 Quirk entry `talkback-aria-sort` in `core/dom/quirks.ts` with its reproducing test
- [x] 2.4 Connect and meta tests (`table.meta.ts` checked against the code)

## 3. React parts

- [x] 3.1 `Table.Root`, `Table`, `Caption`, `Head`, `Body`, `Foot`, `Row`, `ColumnHeader`, `RowHeader`, `Cell`, `SortTrigger`, `SortIndicator`, `Empty`; column registration through `item-registry`; measurement in a client layout effect; no handlers on rows or cells

## 4. Contract and driver

- [x] 4.1 `table.contract.ts`: anatomy, locate, actions, queries, invariants per design §6
- [x] 4.2 `getTable` exported from `@rind-ui/testing`

## 5. Tests

- [x] 5.1 DOM tests (jsdom and browser): native roles and scopes, spans and grouped headers, name from caption, sort by every modality including a bare click, `allowUnsorted`, controlled, announcements, TalkBack description per platform preset, Empty and loading, text selection, SSR + hydration with zero warnings and no measured attributes
- [x] 5.2 Browser tests (Chromium, Firefox, WebKit): scroll stop rule (overflow, sort buttons, fits, overflow ends while focused), scroll-metric attributes and CSS variables, axe `scrollable-region-focusable`
- [x] 5.3 Model-based tests over the configurations of design §7

## 6. Theme

- [x] 6.1 `packages/theme/src/table.css` per design §8, imported from `index.css`, `table` added to the `decoration` row of `families.ts`
- [x] 6.2 Browser test: native `display` of every part at 320 px, sticky head with focus not obscured, sticky first column in LTR and RTL, scroll shadows, trigger ≥ 24 px, indicator shapes, forced colors

## 7. Site and docs

- [x] 7.1 Site example `apps/site/examples/table.tsx` (API table, pricing comparison with grouped headers and sticky first column, wide sortable table with `sortItems`, empty, loading, RTL) and skin `apps/site/skins/table.css`, registered; axe clean in both skins, light and dark
- [x] 7.2 Docs page `docs/components/table.md` with "When to use" (static table versus the later grid; Grid List for rows of controls); `docs/components.md` status
- [x] 7.3 Changeset

## 8. Proof

- [x] 8.1 `pnpm lint`, `pnpm typecheck`, changed tests (node, jsdom, browser in three engines), site audit 0 findings
