## 0. Prerequisites

- [ ] 0.1 Confirm `add-date-field` is implemented (`date-segments`, parameterised machine and connect, `dateSegmentInvariants`) and its requests are applied or answered

## 1. Machine mapping

- [ ] 1.1 `time-field.props.ts`: props mapping onto the Date Field machine (`maxGranularity: "hour"`, granularity default `minute`), `Time` ↔ `CalendarDateTime` on the 2000-01-01 reference day, date-time values kept, `Time` bounds on the value's day, placeholder 00:00
- [ ] 1.2 Node tests: every Time Field scenario (zag#3187 Rome, reka-ui#1791 null, date kept, 24-hour prop in en-US, 00 hour, "1","1" in 12-hour, nl-NL default, PM kept on hour clear and edit, es-ES "p. m.", DST repeated hour in New York, spring-forward gap)

## 2. Connect

- [ ] 2.1 Date Field connect with scope `time-field`; hidden input `type="time"` with `step`, `min`/`max`; `time-field.messages.ts` (time value description)
- [ ] 2.2 jsdom tests: segment names incl. the day period display name, value texts ("3 PM"), no day period in 24-hour, form value "" when partial (react-spectrum#9801)

## 3. React parts

- [ ] 3.1 `TimeField.Root` (Root-as-Field), `Label`, `Description`, `ErrorMessage`, `Input`, `Segment`; `render` on every part
- [ ] 3.2 React tests: SSR + hydration in WebKit and Firefox with a 12-hour locale (react-spectrum#7169), form submission and reset, native `min` blocking

## 4. Contract and driver

- [ ] 4.1 `time-field.contract.ts`: Date Field contract with scope `time-field`, `fill(time)` with the day period, `setDayPeriod`, time invariants
- [ ] 4.2 Broken-wrapper fixtures prove the time invariants fail (hour edit flips the day period, stale hidden value)
- [ ] 4.3 `getTimeField` exported; the same driver test passes in browser mode, jsdom and Playwright

## 5. Model-based tests

- [ ] 5.1 `testMachine(timeFieldContract, …)` with the configurations of design §4, keyboard, pointer and virtual modalities, composition steps (ko-KR day period, full-width digits)

## 6. Theme

- [ ] 6.1 `packages/theme/src/time-field.css` per design §5: `@layer rind.components`, `:where()` selectors, `--rind-time-field-*` tokens read with fallbacks and never declared, `field` family variants and sizes, `data-tone="danger"`, forced-colors rules; imported from `index.css`
- [ ] 6.2 Playwright capture: Date Field and Time Field side by side (identical metrics), forced colors

## 7. Site examples

- [ ] 7.1 Site examples (apps/site/examples/time-field.tsx, state examples for every contract state): 12-hour, 24-hour, seconds, ja-JP day period first, ko-KR, zoned with and without the zone, DST day, min/max, required in a form, read-only, disabled, inside a Field, driver example; state examples with ARIA snapshots; axe clean

## 8. Docs

- [ ] 8.1 Docs page (generated API facts): anatomy, props, `data-*`, keyboard table, hour cycles and the day period, zones and DST, form value, driver example, known AT quirks, `llms.txt` entry

## 9. Proof

- [ ] 9.1 Manual AT pass (VO iOS day period by typing, TalkBack, NVDA + Chrome)
- [ ] 9.2 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green
</content>
</invoke>
