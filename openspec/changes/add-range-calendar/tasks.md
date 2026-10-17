## 0. Prerequisites

- [ ] 0.1 Confirm `add-calendar` is implemented (pieces, navigation, grid, connect helpers, theme base) and `add-overlay-infrastructure`'s `layer-stack` logical-inside query is available

## 1. Machine

- [ ] 1.1 `range-calendar.range.ts`: `makeRange`, `availableBounds`, `crossesUnavailable`; Node tests incl. react-spectrum#8854, #5302, #3311 recipes, backward ranges
- [ ] 1.2 `range-calendar.machine.ts`: states `idle`/`anchored`/`dragging`, events per design §2, Calendar pieces, controllable `value` (`sameRange`), `commitOnBlur`, `dragDelay` through the scheduler, effects `preventTouchScroll`, `insideWatch`
- [ ] 1.3 Node tests: two-step commit, backward, previous start restarts (zag#2388), one change per commit (reka-ui#2396), Escape consumed only when anchored, leave per `commitOnBlur`, paging keeps the anchor (react-spectrum#8889), programmatic `null` (bits-ui#1068), drag commit, press-start + trailing press, touch delay and cancel, layout-shift release (react-spectrum#4007)

## 2. Connect

- [ ] 2.1 `range-calendar.connect.ts`: Calendar helpers + range attributes, prompt node and `aria-describedby` on the focused cell, inside test with `composedPath()` and the layer-stack query; `range-calendar.messages.ts`
- [ ] 2.2 jsdom tests: `aria-selected` only for committed days, preview attributes and backward hover (zag#2660), placeholders without range attributes (reka-ui#2730), lone anchor (react-spectrum#5456), prompt texts

## 3. React parts

- [ ] 3.1 `RangeCalendar.*` parts sharing Calendar's part implementations with scope `range-calendar`; `render` on every part
- [ ] 3.2 React tests: SSR + hydration, shadow-root fixture (react-spectrum#10330), header with a native select and a portalled rind Select (react-spectrum#3738)

## 4. Contract and driver

- [ ] 4.1 `range-calendar.contract.ts`: anatomy, locate, actions per modality, queries, observations, event map, declared announcements, traits
- [ ] 4.2 `rangeCalendarInvariants`; broken-wrapper fixtures prove each fails (preview selected, double commit, anchor lost on paging)
- [ ] 4.3 `getRangeCalendar` exported; the same driver test passes in browser mode, jsdom and Playwright

## 5. Model-based tests

- [ ] 5.1 `testMachine(rangeCalendarContract, …)` with the configurations of design §4, pointer, touch, keyboard and virtual modalities, RTL
- [ ] 5.2 Scenario tests outside the model: touch scroll of a multi-month list (react-spectrum#5975), click outside in each `commitOnBlur` mode (react-spectrum#5709, #8850), Escape inside a dialog

## 6. Theme

- [ ] 6.1 `packages/theme/src/range-calendar.css` per design §5: `@layer rind.components`, `:where()` selectors, `--rind-range-calendar-*` tokens read with fallbacks and never declared, Calendar's families, sizes, `data-tone="danger"` invalid, range caps, dashed preview, forced-colors rules, RTL caps mirrored; imported from `index.css`
- [ ] 6.2 Playwright captures: forced colors with range + preview, RTL, two months

## 7. Site examples

- [ ] 7.1 Site examples (apps/site/examples/range-calendar.tsx, state examples for every contract state): basic, two months, drag, unavailable dates contiguous and non-contiguous, max 7 nights recipe, each `commitOnBlur`, read-only, invalid range, RTL, inside a dialog, driver example; state examples `idle`/`anchored`/`dragging` with ARIA snapshots; axe clean

## 8. Docs

- [ ] 8.1 Docs page (generated API facts): anatomy, props, `data-*` (preview vs range), keyboard table, two-step selection and drag, `commitOnBlur`, unavailable dates in ranges, announcements and prompts, driver example, `llms.txt` entry

## 9. Proof

- [ ] 9.1 Manual AT pass (VO iOS tap-tap with paging, TalkBack, NVDA + Chrome prompt and announcements)
- [ ] 9.2 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green
</content>
</invoke>

## Amendments (from add-date-range-picker, add-date-range-field, add-month-year-picker)

- [ ] A.1 Controllable anchor: `anchor`, `defaultAnchor`, `onAnchorChange`, `$sync:anchor` prop step (set/clear without commit or callback; `value` changes still clear it); contract prop step; tests for the "Resuming a half-typed range" and "Controlled anchor cleared by the parent" scenarios
- [ ] A.2 Export `makeRange`, `availableBounds` and `crossesUnavailable` as public helpers generic over period starts (day, month, year); unit tests for the "Bounds around an anchor" and "Month granularity" scenarios
- [ ] A.3 Export the `insideWatch` effect and the prompt messages as reusable pieces; test for the "Reuse of the inside watch" scenario
