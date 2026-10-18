## 0. Spec

- [ ] 0.1 Draft reviewed by the coordinator; open questions settled (design.md)
- [ ] 0.2 Merge `origin/main` once #113 (add-date-field) lands; re-validate

## 1. Calendar range (PR 1)

- [x] 1.1 Machine: `selectionMode="range"`, anchor, preview, cancel and leave, `minRangeLength` / `maxRangeLength`, unavailable dates in ranges (`allowsNonContiguousRanges`)
- [x] 1.2 Connect: range data attributes (`data-range-start`, `data-range-end`, `data-in-range`, `data-preview`, anchor), prompts, polite announcements, messages
- [x] 1.3 Reusable range helpers exported
- [x] 1.4 Contract range actions and queries, range invariants; model classes: single, range, range with min/max length, range with unavailable dates (contiguous and not), RTL, every modality
- [x] 1.5 React parts and tests (dom, browser, hydrate, reading order) for every range scenario and cited regression
- [x] 1.6 Theme: range band in `calendar.css` (start, end, in-range, preview dashed, forced colors); site skin; examples, state examples, ARIA snapshots; docs section

## 1b. Drag selection (PR 1b)

- [ ] 1b.1 Mouse / pen drag and touch long-press drag (`dragDelay`), no scroll while dragging; browser tests in three engines

## 2. Calendar views (PR 2)

- [ ] 2.1 Month and year views (`period-navigation`), controllable `view`, `minView` / `maxView`, drill-down, cell names, triggers, constraints; contract and model classes per view; theme, examples, snapshots, docs

## 3. Date Field time values and range (PR 3)

- [ ] 3.1 Time values: `Time` type, hour cycles, day period, zones and DST, `type="time"` form value, `setDayPeriod`, the 12-hour "0" rule in `date-segments`
- [x] 3.2a Date ranges (date and date-time ends): coordinator, embedded ends, range validity, focus between ends, names and description, two hidden inputs with autofill, clear / reset / controlled value, contract range variant, pair invariants, model classes (in order, inverted), theme, examples, docs
- [ ] 3.2 Range mode (time ends with 3.1): pair coordinator, derived value, ends never edit each other, range validity, focus between ends, names, two hidden inputs, controlled value / clear / reset, time ends and `allowsOvernight`; contract range variant and pair invariants; model classes (date, date-time, time, overnight, RTL)
- [ ] 3.3 Theme, examples, snapshots, docs

## 4. Picker parts (PR 4)

- [ ] 4.1 Picker parts in single and range mode: one value owner, open state and reasons, opening, modality, focus and restore, dismissal and nesting, select and close, typing while open, names, clear, Field and form participation, state kept until exit, touch, resume and committing a range
- [ ] 4.2 Contract picker variant and picker invariants; model classes (modal / non-modal, single / range, nested in a Dialog)
- [ ] 4.3 Theme (trigger icon, panel content), examples, snapshots, docs

## 5. Close

- [ ] 5.1 Calendar and Date Field `done` in `docs/components.md`; archive once every phase is merged and approved
