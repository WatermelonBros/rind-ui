## 0. Prerequisites

- [ ] 0.1 Confirm `add-date-field`, `add-calendar`, `add-popover` (with the `scope` request), `add-overlay-infrastructure`, `add-floating-positioning`, `add-field`, `add-text-field`, `add-checkbox`, `add-button` and `add-theme-system` are merged, and that the requests in design.md (embedded Date Field, draft hint, Popover scope option, theme family rows) are applied or answered

## 1. Pure value logic

- [ ] 1.1 `picker.value.ts`: `toEmittedSingle` (type, calendar, time, zone, placeholder, granularity), `followDraft`
- [ ] 1.2 Node tests: time kept, no value at each granularity, `CalendarDateTime` default at 00:00, draft follow clamping, min > max warning

## 2. Machine

- [ ] 2.1 `picker.machine.ts`: states `closed`/`open`, events per design §2, controllable `value`/`open`/`focusedValue`, one commit path with reasons and `cancel()`, effects `popover`, `focusInitial`, `controlValidity`
- [ ] 2.2 Node tests with a fake clock and fake positioning: every transition, controlled proposals and `$reverted`, select closing on an equal value, clear with drafts, reset, controlled `null` in every state, reasons

## 3. Connect

- [ ] 3.1 `picker.connect.ts`: Control group and Alt+Arrow handler, Trigger names and states, ClearTrigger, Content naming, value description node, re-scoped Popover props, Calendar binding props, hidden input wiring; `date-picker.props.ts` (one shared props type); messages
- [ ] 3.2 jsdom tests: names ("Choose date Birthday"), no nested group, `aria-haspopup`/`aria-expanded`, description on the trigger, `aria-disabled` when read-only

## 4. React parts

- [ ] 4.1 `DatePicker.Root` (Root-as-Field, three child services, `LayerProvider`), `Label`, `Description`, `ErrorMessage`, `Control`, `Input`, `Segment`, `Trigger`, `ClearTrigger`, `Portal`, `Positioner`, `Content`, `Calendar`; `render` on every part; presence for the content
- [ ] 4.2 React tests: Strict Mode, SSR with `defaultOpen`, streaming hydration, `keepMounted` false with outside press (ark#2265), shadow root

## 5. Field integration

- [ ] 5.1 `field-control` binding: one registration, focus target = first segment, hidden input as validity element, control message from the embedded field, focus-within the Control or content as inside, `field-associated` trait

## 6. Contract and driver

- [ ] 6.1 `date-picker.contract.ts` and `pickerInvariants` with broken-variant fixtures (date held aside, `aria-expanded` stale, focus on body after close)
- [ ] 6.2 `getDatePicker` exported; same driver test in browser mode, jsdom and Playwright

## 7. Model-based tests

- [ ] 7.1 `testMachine(datePickerContract, …)` with the configurations of design §4, keyboard/pointer/virtual modalities, touch preset
- [ ] 7.2 Browser scenarios outside the model: inside a Dialog and a Drawer (mouse and touch), scroll-then-tap (reka-ui#2891), `modal` Tab wrap, non-modal Tab leave, Alt+ArrowDown, typing while open, soft-keyboard dismissal, exit animation without flash

## 8. Theme

- [ ] 8.1 `packages/theme/src/date-picker.css` per design §5 (`@layer rind.components`, `:where()`, `--rind-date-picker-*` tokens read with fallbacks, `field` and `panel` families, icon mask on the trigger, `data-tone="danger"`, forced colors, reduced motion, RTL); imported from `index.css`

## 9. Site examples

- [ ] 9.1 Site examples (apps/site/examples/date-picker.tsx, state examples for every contract state): default, with time (minute), zoned, min/max, unavailable weekends, modal, inside a Dialog, two visible months, clear trigger, required in a form with reset, read-only, disabled, invalid, RTL, driver example; state examples (`closed`, `open`) with ARIA snapshots; axe clean

## 10. Docs

- [ ] 10.1 Docs page (generated API facts): anatomy, composition, modal vs non-modal, focus rules, close reasons, value types, form value, names and messages, nested in Dialogs, touch notes, known AT notes (Safari 26 VoiceOver), driver example; `llms.txt` entry

## 11. Proof

- [ ] 11.1 Manual AT pass (VO macOS/iOS on Safari 26 and 27, NVDA + Chrome/Firefox, JAWS, TalkBack) and iOS/Android soft-keyboard check
- [ ] 11.2 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green
