## 0. Prerequisites

- [ ] 0.1 Confirm `add-calendar` (`date-values`, `calendar.pieces.ts`), `add-range-calendar` (`range-calendar.range.ts`, leave rule), `add-a11y-foundations`, `add-collections` (traits), `add-button` and `add-theme-system` are merged, and that the requests in design.md (reusable pieces, generic range helpers, theme family rows) and the `"grid"` orientation of `keyboard-interactions` are applied or answered

## 1. Period navigation (`period-navigation`)

- [ ] 1.1 `period-navigation.ts`: `pageOf`, `periods(page)` rows by `columns`, `move` (next/previous, next-row/previous-row by (row, column), first/last, next-page/previous-page), `canPage`, `initialFocus`; fixed year partitions per era; month counts from the display calendar
- [ ] 1.2 Constraints at the unit (`compareAt`): clamping, unreachable pages, unavailable reachable
- [ ] 1.3 Node tests: every scenario (3×4 and 4×3 and `columns` 3, December → January, down from last row, hebrew 13 months, fixed pages, japanese era boundary, 3 BC, zag#2153 min/max, bits-ui#1873 initial focus, arrow past minimum), plus buddhist, persian and ethiopic

## 2. Value rules (`period-picker.value.ts`)

- [ ] 2.1 `emit(value, period, unit)` via `toEmitted` with day clamping (31 Mar → 28 Feb, 29 Feb → 28 Feb), type/calendar/time/zone kept, day-1 fallback; `samePeriod`; range helpers on period starts over `range-calendar.range.ts`
- [ ] 2.2 Node tests: reka-ui#2587/#2588 cases, `ZonedDateTime` across DST, no value, placeholder type, range order

## 3. Machine

- [ ] 3.1 `period-picker.machine.ts`: `unit` and `selectionMode` parameters, states `idle`/`anchored`, `gridFocused` flag, controllable `value` (`samePeriodOrRange`) and `focusedValue`, `bindProp` for `disabled`/`readOnly`, effects `focusCell` (only while the grid is focused), `prepareAnnouncer`, `insideWatch` (range)
- [ ] 3.2 Node tests: single and range paths, focus never selects, unavailable no-op, same-period controlled value does not repage, controlled focus does not call `focus()` (react-spectrum#9427), announcements only while the grid is unfocused, anchor kept across `PAGE`, hover never pages, Escape consumed only when anchored, `commitOnBlur` values, read-only, disabled keeps selection

## 4. Connect

- [ ] 4.1 `period-picker.connect.ts`: parts and attributes per design §5 and the specs; key mapping (`toLogicalKeyEvent` grid orientation, PageUp/PageDown, Home/End); press and hover handlers; prompt node; messages for both units
- [ ] 4.2 jsdom tests: names (en-US, de-DE), explicit `aria-selected`, `aria-current`, heading formats, no `application` role, header never `aria-hidden` (bits-ui#902), triggers `aria-disabled` at bounds, `columns` and `yearsPerPage` layouts

## 5. React parts

- [ ] 5.1 `MonthPicker` and `YearPicker`: `Root`, `Header`, `Heading`, `PrevTrigger`, `NextTrigger`, `Grid` (render function with rows), `Body`, `Row`, `Cell`; `render` on every part; repeated triggers
- [ ] 5.2 React tests: SSR + hydration with a fixed clock, keyboard focus moves and pointer paging does not, header `<select>` fixture, Calendar drill-down composition fixture, RTL, StrictMode

## 6. Contract and drivers

- [ ] 6.1 `month-picker.contract.ts` and `year-picker.contract.ts`: anatomy, locate, actions (keyboard path via `period-navigation`), queries, observations, event map, traits `selectable`/`composite-roving`
- [ ] 6.2 Period invariants with broken-wrapper fixtures (inner focusable button, two focus rings, `aria-selected` missing, preview without anchor, announcement on keyboard paging)
- [ ] 6.3 `getMonthPicker` and `getYearPicker` exported; the same driver tests pass in browser mode, jsdom and Playwright

## 7. Model-based tests

- [ ] 7.1 `testMachine` over both contracts with the configurations of design §6, keyboard, pointer, touch and virtual modalities, `dir="rtl"` runs
- [ ] 7.2 Scenario tests outside the model: inside a modal dialog (Announcer, Escape bubbling), touch scroll over cells, ten-year keyboard paging focus-ring check, shadow-root range leave, hebrew leap year

## 8. Theme

- [ ] 8.1 `packages/theme/src/month-picker.css` and `year-picker.css` per design §7: `@layer rind.components`, `:where()` selectors, `--rind-month-picker-*` / `--rind-year-picker-*` tokens read with fallbacks and never declared, `panel` / `collection item` families, sizes, `data-tone="danger"`, hit area ≥ 24×24, 4 columns fit 320 px, forced-colors rules per state, RTL; imported from `index.css`
- [ ] 8.2 Playwright captures: forced colors, RTL, 320 px, reduced motion

## 9. Stories

- [ ] 9.1 Stories (themed): month single/range, year single/range, `columns` 3, `yearsPerPage` 10, min/max, unavailable months, `th-TH` and hebrew with `createCalendar`, japanese eras, read-only, disabled, controlled `focusedValue` with a header select, Calendar drill-down recipe, driver example; state stories `idle`/`anchored` with ARIA snapshots; axe clean

## 10. Docs

- [ ] 10.1 Docs page (generated API facts): anatomy, props, `data-*`, keyboard table, the value rule, constraints at the unit, calendar systems, ranges, drill-down and header-select recipes, driver example, known AT quirks (shared with Calendar), `llms.txt` entry

## 11. Proof

- [ ] 11.1 Manual AT pass with the Calendar's (NVDA focus mode on the cell, VO macOS and iOS, TalkBack); outcome recorded
- [ ] 11.2 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green
