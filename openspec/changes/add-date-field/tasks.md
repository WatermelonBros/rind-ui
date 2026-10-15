## 0. Prerequisites

- [ ] 0.1 Confirm `add-calendar` (`date-values`), `add-field`, `add-text-field` (Root-as-Field helper), `add-checkbox` (`hidden-form-input`), `add-number-input` (`number-parsing`, `ios-vo-spinbutton-input`) and `add-theme-system` are merged, and that the requests in design.md (vertical value keys, control validity message in `hidden-form-input` and `field-validation`, the quirk covering date segments) are applied or answered

## 1. Segment model (`date-segments`, pure)

- [ ] 1.1 `segments.ts`: segment list per locale/calendar/granularity/cycle/zone, era rule, `relatedYear` mapping, `hideTimeZone` literal trimming, isolates for the time run, cached formatters
- [ ] 1.2 `draft.ts`: per-segment values and texts, limits (calendar maxima while incomplete), `cycle` with zoned hour arithmetic and wall-clock-preserving date steps, hour-cycle conversion, `toValue` (real date or null)
- [ ] 1.3 `typing.ts`, `paste.ts`, `validity.ts`, `names.ts`: digit planning with `number-parsing` (locale and full-width digits), auto-advance, last-segment overflow, separators, day-period and era matching via collator, paste of ISO and own format, validity flags and message keys, `Intl.DisplayNames` names
- [ ] 1.4 Node tests: every `date-segments` scenario (react-spectrum#3256/#9586/#5965/#6004/#8637/#9952/#8366/#5223/#3739/#5364/#9624/#9958/#4848/#10776, zag#3070/#3154/#3117, reka-ui#2002/#2356/#1639, bits-ui#1899) across en-US, en-GB, de-DE, ja-JP(-u-ca-japanese), ko-KR, th-TH, fa-IR, ar-EG, sr-Latn-RS

## 2. Machine

- [ ] 2.1 `date-field.machine.ts`: states `idle`/`editing`/`composing`, events per design §3, controllable `value` (`sameInstantOrDay`), `bindProp` flags, effects `focusSegment` (after commit), `selectOnFocus`, `controlValidity`
- [ ] 2.2 Node tests: commit points (typing a year emits once), controlled `null` while editing (bits-ui#2174), reset of a partial entry (react-spectrum#9366), recompute on locale change keeping the active type (reka-ui#1127), Enter never steps (reka-ui#1993), keystroke not lost on advance (react-spectrum#10683)

## 3. Connect

- [ ] 3.1 `date-field.connect.ts`: parts per design §4, `beforeinput` planning, key mapping with vertical value keys, composition, paste/copy, focus classification, value description node, segment-name nodes; `core/dom` `SegmentLayout` (visual adjacency with jsdom fallback); `date-field.messages.ts`
- [ ] 3.2 jsdom tests: names ("month Birthday"), value text "10 – October", description only on the first segment unless invalid, no `aria-roledescription`, no `contenteditable`, literals hidden

## 4. React parts

- [ ] 4.1 `DateField.Root` (Root-as-Field), `Label`, `Description`, `ErrorMessage`, `Input`, `Segment` (render function over segments or automatic); `render` on every part; hidden input via `hidden-form-input`
- [ ] 4.2 React tests: SSR + streaming hydration (ids resolve, react-spectrum#9675), literal hydration difference (react-spectrum#7169), Firefox focus (react-spectrum#10259, browser mode), form data and reset, autofill adoption, `required`, `min`/`max` native blocking (reka-ui#2275), `step` for seconds (reka-ui#3000)

## 5. Field integration

- [ ] 5.1 `field-control` binding: register once (group labelled, first segment focus target, hidden input validity element), OR-merged flags with Field and Fieldset, commit reports, control validity through the requested helper, `field-associated` trait; Field prop × control matrix test

## 6. Contract and driver

- [ ] 6.1 `date-field.contract.ts`: anatomy, locate, actions (`fill` in segment order per locale), queries, observations, event map, traits
- [ ] 6.2 `dateSegmentInvariants` (exported for Time Field); broken-wrapper fixtures prove each fails (contenteditable segment, clamped day, stale hidden value, unresolved IDREF, extra focusable)
- [ ] 6.3 `getDateField` exported; the same driver test passes in browser mode, jsdom and Playwright

## 7. Model-based tests

- [ ] 7.1 `testMachine(dateFieldContract, …)` with the configurations of design §6, keyboard, pointer and virtual modalities, composition steps, `dir="rtl"`
- [ ] 7.2 Scenario tests outside the model: Japanese full-width digits and Korean day period through IME in Chromium, Firefox and WebKit; DST month step in `Europe/Lisbon`; paste ISO and locale formats

## 8. Theme

- [ ] 8.1 `packages/theme/src/date-field.css` per design §7: `@layer rind.components`, `:where()` selectors, `--rind-date-field-*` tokens read with fallbacks and never declared, `field` family variants and sizes, `data-tone="danger"`, focused-segment ring, placeholders, forced-colors rules, RTL; imported from `index.css`
- [ ] 8.2 Playwright captures: forced colors, RTL `ar-AE`, invalid, placeholder state

## 9. Stories

- [ ] 9.1 Stories (themed): date, date-time 12/24-hour, zoned with and without the zone, japanese eras, buddhist, `ar-EG` RTL, min/max, unavailable dates, required in a form with reset, read-only, disabled, invalid states (incomplete, impossible), paste, inside a Field, driver example; state stories `idle`/`editing`/`composing` with ARIA snapshots; axe clean

## 10. Docs

- [ ] 10.1 Docs page (generated API facts): anatomy, props, `data-*`, keyboard table, typing and commit rules, validity states, form value per type, segment names and messages, driver example, known AT quirks (iOS textbox segments, VO macOS stepper commands), `llms.txt` entry

## 11. Proof

- [ ] 11.1 Manual AT pass (VO iOS with the quirk, TalkBack + Gboard/Samsung, NVDA + Firefox current, VO macOS, JAWS + Chrome)
- [ ] 11.2 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green
</content>
</invoke>

## Amendments (from coordinator, archived-capability deltas)

- [ ] A.1 Implement the `keyboard-interactions` delta (`specs/keyboard-interactions/spec.md`): `value: "vertical"` mode and its RTL mapping, with unit tests for the Node mapping
- [ ] A.2 Extend `ios-vo-spinbutton-input` to date/time segments (`specs/a11y-quirks/spec.md`): gate the segment rendering by it and add the date-segment case to its reproducing test
- [ ] A.3 `date-field` "Embedded Mode": `embedded`, `labelledBy`, `describedBy`, `onValidityChange` on Root; skip Field registration, hidden input and Label/Description/ErrorMessage; `role="presentation"` on `input`; tests for the "Embedded field has no Field or form footprint" and "Validity goes to the host" scenarios
- [ ] A.4 `date-segments` boundary events and layout scope: `onBoundary({ direction, reason })` from advance, Backspace and arrows when no adjacent segment exists; optional `scope` on `SegmentLayout.adjacent`; tests for the "Boundary event at the last segment", "Backspace in the first empty segment" and "Adjacency across a scope" scenarios
- [ ] A.5 `date-field` "Draft Hint": `onDraftChange({ year, month, day })` watch on committed segments, once per change, never while typing inside a segment; test for the "Calendar follows the typed month and year" scenario
