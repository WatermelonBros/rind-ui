## 0. Prerequisites

- [ ] 0.1 Confirm `add-a11y-foundations`, `add-collections` (traits), `add-button` (`button-like-element`) and `add-theme-system` are merged, and that the requests in design.md (`keyboard-interactions` grid orientation with `PREV_ROW`/`NEXT_ROW`, theme family matrix rows) are applied or answered
- [ ] 0.2 Add `@internationalized/date` (pinned exact version, at least two weeks old) as a dependency of `@rind-ui/core` (allowed by decision 0002)

## 1. Shared date infrastructure (`date-values`)

- [ ] 1.1 `core/i18n/date.ts`: re-exports and parse functions, `resolveCalendar(locale, createCalendar)` with the gregorian default and dev warnings (unsupported, missing), `toEmitted(date, base)` (type, calendar, time of day kept), `firstDayOfWeek(locale, prop)`, `isWeekend`, cached `dateFormatter(locale, options)`, `dayText` (the `day` part), `formatVisibleRange`
- [ ] 1.2 `DateClock` capability in `core/env` and `domEnvironment()`; fake clock helper in `@rind-ui/testing`; lint rule or test that no module reads `Date.now()`/`new Date()` at module scope
- [ ] 1.3 Node tests: every `date-values` scenario (zag#3187 Tokyo, bits-ui#768 grid, bits-ui#1358 time kept, th-TH, fa-IR, zh-CN-u-ca-chinese, ja-JP-u-ca-japanese without createCalendar, Auckland today, zoned today, en-US/en-GB/ar-EG week starts, `firstDayOfWeek="mon"` in cs-CZ, ja-JP day text, de-DE reformat, inclusive max, data-value ISO)

## 2. Date-grid navigation (`calendar-navigation`)

- [ ] 2.1 `calendar.navigation.ts`: `move`, `page`, `canPage`, `initialFocus`, alignment of `visibleMonths`, `pageBehavior`; `calendar.grid.ts`: weeks of a month with placeholders and `fixedWeeks`
- [ ] 2.2 Node tests: all spec scenarios (31 Jan → 28 Feb, 29 Feb 2028 → 2029, week start Monday, hebrew Adar I, min/max clamps, unavailable reachable, two visible months, paging blocked, bits-ui#1262), plus buddhist, persian and islamic-umalqura month lengths

## 3. Machine

- [ ] 3.1 `calendar.pieces.ts` and `calendar.machine.ts`: states `idle`/`focused`, events and actions per design §3, controllables `value` (`sameDays`) and `focusedValue`, `bindProp` for `disabled`/`readOnly`, effects `focusCell`, `prepareAnnouncer`; announcement action keyed per instance
- [ ] 3.2 Node tests: selection single/multiple, focus never selects, unavailable no-op (react-spectrum#5692, #7779), same-day controlled value (reka-ui#2960), controlled focus pages, clamped focus, announcements only from `idle`, read-only, disabled keeps selection (react-spectrum#8542)

## 4. Connect

- [ ] 4.1 `calendar.connect.ts`: parts and attributes per design §4 and the spec's data attributes; key mapping through `toLogicalKeyEvent` with the grid orientation and Shift for years; press and hover handlers; `calendar.messages.ts`
- [ ] 4.2 jsdom tests: names (en-US, de-DE), explicit `aria-selected`, `aria-current`, header `aria-hidden` only on the weekday row (bits-ui#902), no `application` role, triggers `aria-disabled` at bounds

## 5. React parts

- [ ] 5.1 `Calendar.Root`, `Header`, `Heading`, `PrevTrigger`, `NextTrigger`, `Grid` (`month` offset, render function with weeks), `GridHeader`, `HeaderCell`, `GridBody`, `Row`, `Cell`; `render` on every part; repeated triggers
- [ ] 5.2 React tests: SSR + hydration with a fixed clock (no mismatch, react-spectrum#9786), focus moves with the keyboard and not on pointer scroll, multiple months, RTL

## 6. Contract and driver

- [ ] 6.1 `calendar.contract.ts`: anatomy, locate, actions (`select` keyboard path computed with `calendar-navigation`), queries, observations, event map, traits `selectable`/`composite-roving`
- [ ] 6.2 `calendarInvariants` per spec; broken-wrapper fixtures prove each fails (inner focusable button, two focus rings, `aria-selected` missing, placeholder focusable, announcement on keyboard paging)
- [ ] 6.3 `getCalendar` exported; the same driver test passes in browser mode, jsdom and Playwright

## 7. Model-based tests

- [ ] 7.1 `testMachine(calendarContract, …)` over all transitions with the configurations of design §5, keyboard, pointer, touch and virtual modalities, `dir="rtl"` runs
- [ ] 7.2 Scenario tests outside the model: Calendar inside a modal dialog (announcer not inert, react-spectrum#3559), touch scroll over cells (no selection), ten-step keyboard paging focus-ring check (react-spectrum#3975), japanese era boundary

## 8. Theme

- [ ] 8.1 `packages/theme/src/calendar.css` per design §6: `@layer rind.components`, `:where()` selectors, `--rind-calendar-*` tokens read with fallbacks and never declared, `panel`/`collection item` families, sizes, `data-tone="danger"` invalid, hit area ≥ 24×24, forced-colors rules per state, RTL; imported from `index.css`
- [ ] 8.2 Playwright captures: forced colors (react-spectrum#3260), RTL, two months, reduced motion

## 9. Stories

- [ ] 9.1 Stories (themed): single, multiple, two and three months with `pageBehavior`, min/max, unavailable weekends, today marker, Monday weeks, `ar-EG` RTL, `th-TH` and `fa-IR` with `createCalendar`, japanese eras, read-only, disabled, invalid value, header with a repeated next trigger after the grid, controlled `focusedValue`, driver example; state stories `idle`/`focused` with ARIA snapshots; axe clean

## 10. Docs

- [ ] 10.1 Docs page (generated API facts): anatomy, props, `data-*`, keyboard table (APG), value types and calendar systems (`createCalendar`), today and the clock, disabled vs unavailable, announcements, driver example, known AT quirks (NVDA focus mode check, iOS grid label), `llms.txt` entry

## 11. Proof

- [ ] 11.1 Manual AT pass per the protocol (NVDA + Chrome/Firefox focus mode, JAWS + Chrome, VO macOS, VO iOS, TalkBack); outcome recorded, quirk `nvda-calendar-focus-mode` enabled only if needed
- [ ] 11.2 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green
</content>
</invoke>

## Amendments (from coordinator, archived-capability deltas)

- [ ] A.1 Implement the `keyboard-interactions` delta (`specs/keyboard-interactions/spec.md`): `"grid"` orientation, `PREV_ROW`/`NEXT_ROW`, RTL rules, with unit tests for the Node mapping
- [ ] A.2 Add the reserved `nvda-calendar-focus-mode` registry entry (`specs/a11y-quirks/spec.md`) with its reproducing test; enable it only if task 11.1 shows NVDA needs it
- [ ] A.3 Export from `calendar.pieces.ts` the focused-value controllable factory, the `focusCell` and `prepareAnnouncer` effects and the announce-on-page action for Month/Year Picker (no behaviour change); test for the "A second machine reuses the pieces" scenario
- DEFERRED (coordinator): optional `ViewTrigger` part / `view` prop for a month or year grid (requested by add-month-year-picker); not scheduled
