## 0. Prerequisites

- [ ] 0.1 Confirm `add-date-field` (`date-segments`, Date Field machine), `add-calendar`, `add-range-calendar`, `add-field`, `add-text-field`, `add-checkbox` and `add-theme-system` are merged, and that the requests in design.md (embedded mode, boundary events and layout scope, draft hint, second hidden input, exported range helpers, theme family rows) are applied or answered

## 1. Pair logic (pure, `paired-fields/pair.ts`)

- [ ] 1.1 `derive`, `compareEnds`, `rangeIssues` (per end, order, unavailable inside ≤ 366 days then `availableBounds`), part-specific message keys
- [ ] 1.2 Node tests: every `paired-fields` scenario (react-spectrum#5302/#10683, bits-ui#1348/#1445/#2120, zag#2809/#3186, reka-ui#1769) across en-US, en-GB, ja-JP, ar-EG, th-TH

## 2. Machine

- [ ] 2.1 `paired-fields.machine.ts`: two embedded Date Field services, events per design §2, derived controllable `value`, `bindProp` flags, effects `focusEdge` (after commit), `controlValidity`, `hiddenInputs`
- [ ] 2.2 Node tests: typing orders, boundary focus, `$sync:value` null/range mid-edit, reset, granularity and locale switches keeping drafts (react-spectrum#7348), clear

## 3. Connect

- [ ] 3.1 `paired-fields.connect.ts`: group, names (segment + end + label), value description node, description ids on the first start segment, `Start`/`End`/`Separator`, press and focus-within handling, hidden input props; `date-range-field.props.ts`; messages
- [ ] 3.2 jsdom tests: names, no nested group, description once, hidden inputs, ids resolve

## 4. React parts

- [ ] 4.1 `DateRangeField.Root` (Root-as-Field), `Label`, `Description`, `ErrorMessage`, `Input`, `Start`, `End`, `Separator`, `Segment` (render function or automatic); `render` on every part
- [ ] 4.2 React tests: SSR + streaming hydration, form data and reset with two names, autofill adoption, Strict Mode, single Field registration

## 5. Field integration

- [ ] 5.1 `field-control` binding for the pair (one registration, focus target = first invalid part), control validity message on the start hidden input, `field-associated` trait; Field prop × control matrix

## 6. Contract and driver

- [ ] 6.1 `date-range-field.contract.ts` and `pairInvariants` with broken-variant fixtures (pushes the start back, stale hidden values, extra registration)
- [ ] 6.2 `getDateRangeField` exported; same driver test in browser mode, jsdom and Playwright

## 7. Model-based tests

- [ ] 7.1 `testMachine(dateRangeFieldContract, …)` with the configurations of design §4, keyboard/pointer/virtual modalities, RTL, quirk presets
- [ ] 7.2 Scenario tests outside the model: focus after commit across ends, RTL arrows, IME in the end field

## 8. Theme

- [ ] 8.1 `packages/theme/src/date-range-field.css` per design §5 (`@layer rind.components`, `:where()` selectors, `--rind-date-range-field-*` tokens read with fallbacks, `field` family variants/sizes, `data-tone="danger"`, forced colors, RTL); imported from `index.css`

## 9. Stories

- [ ] 9.1 Stories (themed): default, date-time, min/max, unavailable with and without non-contiguous, RTL, required in a form with reset, read-only, disabled, invalid causes, inside a Field, driver example; state stories with ARIA snapshots; axe clean

## 10. Docs

- [ ] 10.1 Docs page (generated API facts): anatomy, value rules (both or neither), validity causes, names, two form values, focus rules, driver example, known AT notes, `llms.txt` entry

## 11. Proof

- [ ] 11.1 Manual AT pass (VO iOS with the quirk, TalkBack, NVDA + Firefox, VO macOS, JAWS)
- [ ] 11.2 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green
