## Why

Booking, reporting and filtering UIs ask for two dates at once. On top of the Date Picker's problems the range version adds
its own (research note, 22 entries): an outside click after the start date committing a range and closing the host modal too
(react-spectrum#9469), a header select closing the picker and inventing an end (react-spectrum#9430), a Reset button that clears
the calendar but not the picker (react-spectrum#9180), a picked range that never fills the field at minute granularity
(react-spectrum#7688, #6957), the content closing when the pointer moves quickly after the first click (ark#2509), one hidden input
holding "undefined - undefined" (reka-ui), `null` throwing (reka-ui#1769). The pieces already exist — `paired-fields`, Range
Calendar, `picker-popover` — so this change specifies only how they compose.

Research: [date-range-picker](../../../docs/research/date-range-picker.md) · [date-picker](../../../docs/research/date-picker.md) ·
[date-range-field](../../../docs/research/date-range-field.md) · [range-calendar](../../../docs/research/range-calendar.md) ·
[accessibility](../../../docs/research/accessibility.md) §5, §7 ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) causes A, C, E, J, L

Depends on: `add-date-picker` (`picker-popover`), `add-date-range-field` (`paired-fields`), `add-range-calendar`
(`range-calendar`; request below), `add-date-field`, `add-calendar`, `add-popover`, `add-overlay-infrastructure` (used unchanged),
`add-field`, `add-checkbox`, `add-theme-system`; archived foundations in `openspec/specs/`.

## What Changes

- A public **Date Range Picker**: `Root`, `Label`, `Description`, `ErrorMessage`, `Control`, `Input`, `Start`, `End`, `Separator`,
  `Segment`, `Trigger`, `ClearTrigger`, `Portal`, `Positioner`, `Content`, `Calendar` (a Range Calendar bound to the picker), two
  automatic hidden inputs; value `{ start, end } | null`, `startName`/`endName`, `allowsNonContiguousRanges`, the Date Picker's
  open/modal/close props.
- Closing only on a committed range (`"select"`); the first press never closes; Escape cancels the anchor first; any other
  leave resets the anchor and keeps the previous value; header controls are inside.
- Resuming: with a committed start and an empty end, opening anchors the calendar at the start.
- Each end of a picked range keeps its own time and zone, or the placeholder time; commit is immediate.
- Contract and driver (`getDateRangePicker`), model-based tests, theme stylesheet, stories, docs page.

## Capabilities

### New Capabilities

- `date-range-picker`: the Date Range Picker — composition, close and leave rules, resume, value commit, names, form, contract, theme.

### Modified Capabilities

None. `picker-popover` and `paired-fields` are reused unchanged.

## Non-goals

- Dragging an endpoint to resize, presets and quick ranges (consumers set the value), `minDays`/`maxDays` (a recipe on
  `isDateUnavailable(date, { anchor })`), a provisional start shown in the field while anchored (react-spectrum / reka-ui#1995),
  time pickers inside the popover.
- Framework adapters other than React; fx.

## Impact

- `packages/core/src/components/date-range-picker/` (props mapping, range adapter for the picker coordinator, connect, contract),
  `packages/react/src/date-range-picker/`, `@rind-ui/testing` (`getDateRangePicker`), `@rind-ui/theme/date-range-picker.css`,
  stories, docs.
- No new dependency. Reado: not used.
