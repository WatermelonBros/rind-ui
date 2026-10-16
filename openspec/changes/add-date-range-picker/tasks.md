## 0. Prerequisites

- [ ] 0.1 Confirm `add-date-picker` (`picker-popover`), `add-date-range-field` (`paired-fields`), `add-range-calendar`, `add-popover` and their prerequisites are merged, and that the requests in design.md (controllable Range Calendar anchor, exported range helpers, Popover scope, embedded Date Field, theme family rows) are applied or answered

## 1. Range adapter (pure)

- [ ] 1.1 `date-range-picker.adapter.ts`: `toEmittedRange` (per end time/zone/placeholder, granularity), equality by `compare()` of both ends, `resumeAnchor`
- [ ] 1.2 Node tests: time kept per end, placeholder time, one-day range, resume with start only, inverted draft not resumed

## 2. Machine

- [ ] 2.1 Wire the `picker-popover` coordinator with the range adapter and `paired-fields` as the embedded input; `OPEN` resume; commit-only close; leave routes through the Range Calendar's `LEAVE`
- [ ] 2.2 Node tests with a fake clock: first press keeps open, commit closes with `"select"`, Escape twice, outside press and Tab out reset, header layer inside, controlled `null` in every state, reasons

## 3. Connect

- [ ] 3.1 `date-range-picker.connect.ts` and `.props.ts`: names ("Choose dates"), Range Calendar binding (incl. `anchor`, `commitOnBlur`), shared props type, messages
- [ ] 3.2 jsdom tests: names, no nested groups, description on the trigger after a commit, two hidden inputs

## 4. React parts

- [ ] 4.1 `DateRangePicker.Root` … `Calendar` per design §1; `render` on every part; presence for the content
- [ ] 4.2 React tests: Strict Mode, SSR with `defaultOpen`, streaming hydration, shadow root (react-spectrum#10330 via the Range Calendar)

## 5. Field integration

- [ ] 5.1 `field-control` binding via `paired-fields` (one registration, first invalid part as focus target), control message, focus-within the Control or content as inside

## 6. Contract and driver

- [ ] 6.1 `date-range-picker.contract.ts` with the picker and pair invariants plus "anchor cleared on close"; broken-variant fixtures (hover commits, outside press commits, closes on first press)
- [ ] 6.2 `getDateRangePicker` exported; same driver test in browser mode, jsdom and Playwright

## 7. Model-based tests

- [ ] 7.1 `testMachine(dateRangePickerContract, …)` with the configurations of design §4, three modalities, touch preset
- [ ] 7.2 Browser scenarios outside the model: inside a dismissible Dialog with an anchor (react-spectrum#9469), header Select (react-spectrum#9430), fast pointer sweep (ark#2509), scroll-then-tap on a two-month calendar, `modal` Tab wrap, resume after typing

## 8. Theme

- [ ] 8.1 `packages/theme/src/date-range-picker.css` per design §5 (`@layer rind.components`, `:where()`, `--rind-date-range-picker-*` tokens with fallbacks, `field` and `panel` families, forced colors, RTL); imported from `index.css`

## 9. Site examples

- [ ] 9.1 Site examples (apps/site/examples/date-range-picker.tsx, state examples for every contract state): default, with time, non-contiguous, unavailable weekends, two months, modal, inside a Dialog, clear trigger, required in a form with reset, read-only, disabled, invalid, RTL, driver example; state examples (`closed`, `open`, `anchored`) with ARIA snapshots; axe clean

## 10. Docs

- [ ] 10.1 Docs page (generated API facts): composition, commit and leave rules, resume, two form values, names, `commitOnBlur`, nested in Dialogs, known AT notes, driver example; `llms.txt` entry

## 11. Proof

- [ ] 11.1 Manual AT pass (VO macOS/iOS on Safari 26 and 27, NVDA, JAWS, TalkBack) and touch scroll/tap check on a two-month calendar
- [ ] 11.2 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green
