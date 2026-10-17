## 0. Prerequisites

- [ ] 0.1 Confirm `add-date-range-field` (`paired-fields`), `add-time-field` and their prerequisites are merged

## 1. Ordering and props (pure)

- [ ] 1.1 `time-range-field.props.ts`: props → `paired-fields` options with Time Field end machines, `timeOrder(allowsOvernight)`, overnight detection; messages with time defaults
- [ ] 1.2 Node tests: strict/overnight/equal for `Time`, date-time and zoned ordering across DST, 12-hour typing per end (bits-ui#1985, reka-ui#2956), types export

## 2. Machine and connect

- [ ] 2.1 No new machine: wire `paired-fields` with the Time Field end; hidden `type="time"` inputs with `step` and native `min`/`max`
- [ ] 2.2 jsdom tests: names ("hour Start time Shift"), description including "the next day", two form values

## 3. React parts

- [ ] 3.1 `TimeRangeField.Root`, `Label`, `Description`, `ErrorMessage`, `Input`, `Start`, `End`, `Separator`, `Segment`; `render` on every part
- [ ] 3.2 React tests: SSR literal hydration (react-spectrum#7169), form data/reset, Strict Mode

## 4. Contract and driver

- [ ] 4.1 `time-range-field.contract.ts` (Date Range Field's plus `setDayPeriod(edge, …)` and time invariants); `getTimeRangeField` exported; same driver test in browser, jsdom and Playwright

## 5. Model-based tests

- [ ] 5.1 `testMachine(timeRangeFieldContract, …)` with the configurations of design §4, three modalities, `dir="rtl"`

## 6. Theme

- [ ] 6.1 `packages/theme/src/time-range-field.css` per design §5 (`@layer rind.components`, `:where()`, `--rind-time-range-field-*` tokens with fallbacks, `field` family, `data-tone="danger"`, forced colors); imported from `index.css`

## 7. Site examples

- [ ] 7.1 Site examples (apps/site/examples/time-range-field.tsx, state examples for every contract state): 12/24-hour, seconds, overnight, zoned, min/max, required in a form, read-only, disabled, invalid, inside a Field, RTL; state examples with ARIA snapshots; axe clean

## 8. Docs

- [ ] 8.1 Docs page (generated API facts): value and ordering, overnight, form values, names, driver example; `llms.txt` entry

## 9. Proof

- [ ] 9.1 Manual AT pass as Time Field; `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green
