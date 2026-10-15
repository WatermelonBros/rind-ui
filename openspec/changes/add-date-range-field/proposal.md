## Why

Stays, reports, filters and leave requests need two dates that belong together. Two plain Date
Fields leave the pair's rules to every consumer: a start after the end, a range crossing an
unavailable day, one Field label for two controls, two form names, focus moving across. The
libraries that ship a range field show the failures (14 entries in the research note): partial
ranges as public values that cannot be cleared (reka-ui#1939, #1891, bits-ui#391), `null`
throwing (reka-ui#1769), typing the end year rewriting the start (bits-ui#1348), the end day
limited by the start's month (bits-ui#1445, #2120), a keystroke lost when focus crosses fields
(react-spectrum#10683), a typed range over an unavailable day accepted (react-spectrum#5302) and
one hidden input holding "undefined - undefined" (reka-ui). This change specifies the pairing
once as `paired-fields`, which Time Range Field and the Date Range Picker reuse.

Research: [date-range-field](../../../docs/research/date-range-field.md) ·
[date-field](../../../docs/research/date-field.md) · [range-calendar](../../../docs/research/range-calendar.md) ·
[calendar](../../../docs/research/calendar.md) (`date-values`) · [field](../../../docs/research/field.md) ·
[accessibility](../../../docs/research/accessibility.md) §2, §6, §9 ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) §1.4, causes G, I, J ·
[native-platform](../../../docs/research/native-platform.md) §8, §14

Depends on: `add-date-field` (`date-segments`, the Date Field machine and parts, in the embedded mode
requested in design.md), `add-calendar` (`date-values`), `add-range-calendar` (the range value and
`availableBounds`), `add-field` (`field`, `field-control`, `field-validation`), `add-text-field`
(Root-as-Field), `add-checkbox` (`hidden-form-input`, with the request below), `add-theme-system`;
archived `add-foundations` and `add-a11y-foundations` (specs in `openspec/specs/`).

## What Changes

- **`paired-fields`** (shared): a coordinator over two embedded Date Field instances that owns the two
  committed values and derives the public value `{ start, end } | null` (both complete and ordered, else
  `null`), validates the pair (per end, end before start, an unavailable day inside the range) without
  ever editing an end, moves focus between the ends, renders two hidden native inputs
  (`startName`/`endName`) and registers as one Field control.
- A public **Date Range Field**: `Root` (a Field when not inside one), `Label`, `Description`,
  `ErrorMessage`, `Input` (group), `Start`, `End`, `Separator`, `Segment`, two automatic hidden inputs;
  Date Field's props (`granularity`, `hourCycle`, `hideTimeZone`, `placeholderValue`, `minValue`,
  `maxValue`, `isDateUnavailable`, `disabled`, `readOnly`, `required`, `invalid`, `form`) plus
  `allowsNonContiguousRanges`, `startName`, `endName`.
- Names with the end in every segment name, a range value description, part-specific validity messages.
- Contract and driver (`getDateRangeField`), pair invariants, model-based tests, theme stylesheet
  (family `field`), stories, docs page.

## Capabilities

### New Capabilities

- `paired-fields`: the start/end coordinator shared by Date Range Field, Time Range Field and the Date
  Range Picker's input.
- `date-range-field`: the Date Range Field component — anatomy, value, names, ARIA, form, messages, data
  attributes, contract, theme.

### Modified Capabilities

None. Extensions needed in other changes are listed in design.md under "Requests to other changes".

## Non-goals

- A popup (Date Range Picker), presets, `minDays`/`maxDays` (a recipe on `isDateUnavailable`
  in the picker), a single-tab-stop mode (react-spectrum#9743), partial public values (reka-ui, bits-ui),
  silently swapping an inverted range.
- A provisional start shown while a calendar selection is in progress (the picker).
- Framework adapters other than React; fx.

## Impact

- `packages/core/src/components/paired-fields/` (coordinator machine, pure range validation, connect
  helpers, messages), `components/date-range-field/` (props mapping, connect, contract).
- `packages/react/src/date-range-field/`, `@rind-ui/testing` (`getDateRangeField`),
  `@rind-ui/theme/date-range-field.css`, stories, docs.
- Uses `@internationalized/date`; no new dependency. Reado: not used.
