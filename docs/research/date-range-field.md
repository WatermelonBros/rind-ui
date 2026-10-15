# Date Range Field — research

Status: done · Wave: 3 (Reka UI `DateRangeField`, Bits UI `DateRangeField`; React Aria and Ark/Zag have no standalone range field — their Date Range Picker contains two fields)

Read [date-field.md](date-field.md) first: segmented input (`date-segments`: segment list, typing,
commit points, validity, paste, RTL, SSR) and the Field/form binding are the Date Field's and are
reused unchanged. [calendar.md](calendar.md) holds `date-values`; [range-calendar.md](range-calendar.md)
decides what a range value is (`{ start, end } | null`, `start ≤ end`, unavailable dates inside a
range). This note covers what *pairing* two fields adds — and decides it once as the
**`paired-fields`** capability that Time Range Field ([time-range-field.md](time-range-field.md)) and
the Date Range Picker ([date-range-picker.md](date-range-picker.md)) reuse.

Cross-cutting: [accessibility.md](accessibility.md) §2 (groups labelled by the Label, names from
`messages`), §6 (logical keys), §9; [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
§1.4 "Date fields", causes G, I, J (iOS VO and spinbuttons; group names); [native-platform.md](native-platform.md)
§8, §14 (hidden native inputs for forms); [field.md](field.md) (one control per Field, control validity
message), [form.md](form.md).

## Pattern

- No APG pattern for a range field. Closest: two Date Fields (APG Date Picker Spin Button example,
  see date-field.md) inside one labelled `group`. Native `<input type="date">` has no range form;
  a native range is two inputs.
- What a user must perceive without sight: that there are two dates, which is which ("start",
  "end"), the whole range ("Selected range: …"), and why a typed range is invalid (end before
  start, outside min/max, crossing an unavailable date).
- Keyboard: date-segments' keys; moving from the last start segment to the first end segment (typing,
  Tab, ArrowRight) and back (Backspace on an empty first end segment, Shift+Tab, ArrowLeft) must feel
  like one field.

## How the others built it

### React Aria (`react-aria/src/datepicker/useDateRangePicker.ts`, `useDatePickerGroup.ts`, `react-stately/src/datepicker/useDateRangePickerState.ts`)

- Not a field of its own: `useDateRangePicker` returns `startFieldProps`/`endFieldProps` for two
  `DateField`s inside a `group`. Each field has `aria-label` "Start Date"/"End Date" plus
  `aria-labelledby` the shared label; both get `role` `presentation` (`roleSymbol`) so only the
  outer `group` is announced, and one `focusManager` (the button excluded) drives arrow-key moves
  across the two fields (`focusManager.focusNext/Previous`, in RTL by visual position:
  `findNextSegment`).
- **Value** `{ start, end } | null`: `setValue` stores the partial range in a local
  `placeholderValue` state and calls `onChange` **only for a complete range, else with `null`**;
  a controlled `null` resets the placeholder. So a half-typed range is invisible to the consumer —
  the same "both or neither" rule as ours, kept in a hidden state.
- **Validation**: each field reports to the shared state through `privateValidationStateProp`;
  `mergeValidation(start, end)` combines them; `getRangeValidationResult` checks
  min/max on both ends, `end < start` (rangeUnderflow-style message), and unavailable dates
  **at the ends only** (RA#5302: a range crossing an unavailable day was valid when typed).
  `isDateUnavailable(date, anchor)` receives `null` as anchor for fields.
- Form: `startName`/`endName` (two hidden inputs through the two fields), `form`.
- Problems: RA#10683 (a keystroke that completes a field is lost when the field blurs in the
  same event, range picker only: typing 2026-08-05 commits 08-01), RA#5302, RA#7348 (granularity
  changed dynamically: the date is cleared by the first character typed in the time part),
  RA#9743 (open: single tab stop option), RA#9958 (partial clears inconsistent).

### Reka UI (`DateRangeField/DateRangeFieldRoot.vue`, `DateRangeFieldInput.vue`)

- Parts `Root` (`role="group"`), `Input` with `type: "start" | "end"` and `part` (segment). One
  `placeholder` is shared by both ends. Value `{ start, end }` with either end `undefined`:
  **partial ranges are public values**. `isInvalid` = an end unavailable/outside min/max, or
  `end < start`, or an unavailable day anywhere inside the range (`areAllDaysBetweenValid`) —
  so Reka validates inside the range, unlike RA.
- Navigation: segment elements of both ends are collected into one set; Left/Right move by
  DOM order (`useSegmentNavigation`), so the end's first segment follows the start's last.
- **Hidden input**: *one* `VisuallyHidden input` with `value = "${start} - ${end}"` and a single
  `name` — which renders `"undefined - undefined"` when empty and cannot be parsed by a server as
  two dates. `contenteditable` segments as in Date Field.
- Problems: RK#1939 / RK#1891 (setting the model to `{}` or `{ start: undefined, end: undefined }`
  does not clear the field; fixed in #1894), RK#1769 (`null` throws `Cannot read properties of null
  (reading 'start')`), RK#2282 (`isInvalid` missing from the slot), RK#1541 (clicking the root does
  not focus the first segment, only the label does).

### Bits UI (`bits/date-range-field/date-range-field.svelte.ts`, `components/date-range-field-input.svelte`)

- Melt heritage, Reka's anatomy: `Root`, `Label`, `Input type=start|end` (each renders its own
  hidden input with its own `name`: **two names**, which is right), `Segment`. `startValue`/`endValue`
  are separate states; the public value is `{ start, end }` with either undefined.
  Line 106–113 of the source: a start-only value is a valid public value.
- Problems: BITS#1348 (typing the end year makes the range "complete", the start is pushed back
  by the "start ≤ end" rule while the user is still typing), BITS#1445 / BITS#2120 (the end's day
  limit is computed from the *start's* month: 31 August cannot be typed when the start is in a
  30-day month; both reported, the second in 2026 after the first was "fixed").

### Ark UI / Zag (`date-picker` with `selectionMode: "range"`, `date-input`)

- No range field: the date-picker machine has `activeIndex` 0/1 and a *list of inputs* (`getInputProps({
  index })`), parsed from text. Typing the end first crashed it three times (ZG#2809, #2840, #2864);
  `fixOnBlur` skips range normalization (ZG#3186: Enter swaps an inverted range, blur keeps it, and
  blur accepts unavailable dates).
- `date-input` (segments) has no range mode.

### Kobalte, Base UI, Radix, Headless UI, Ariakit

None ship a range field. Kobalte ships a Time Field only; its DatePicker/DateRangePicker issue
(KB#306) is open with `@kobalte/dates` as the plan.

## Accessibility

- **Groups.** One `group` for the range, named by the Label (RA, Reka, Bits). The two ends are
  *not* nested groups: RA makes them `role=presentation` for exactly this reason (nested groups
  read "Stay, group, Start date, group, month, spinbutton"). Each segment's name carries the end:
  "month, Start date, Stay" — `aria-labelledby="<segment-name> <end-name> <label>"`, the same
  composition Date Field uses with the end name inserted. iOS VO does not announce groups (AT note
  cause J), so the end name must be in every segment's name, not on a wrapper.
- **Value description.** A hidden node on the outer group: "Selected range: Wednesday, October 14,
  2026 to Friday, October 16, 2026" (RA `selectedRangeDescription`), absent when the value is `null`.
- **Description once.** The Field's description ids go on the first segment of the *start* only,
  unless invalid (Date Field's rule extended: not on the first segment of every end).
- **Validity messages** distinguish the ends: "Start date: Enter a valid date", "End date must be on
  or after the start date", "The range includes an unavailable date" — so a screen-reader user hears
  *which* part to fix. Error announcements go through the Field (field-validation), not a
  component live region.
- **Auto-advance across the pair.** Moving focus when the last start segment is completed is the
  same behaviour as moving between segments inside one date (date-segments), not a change of
  context: both ends are one control. It never leaves the pair: completing the last end segment stays.
- **Forced colours, target size, RTL:** as Date Field; the separator between the ends is
  `aria-hidden` text, and in RTL the *start* end is on the right — DOM order is start then end, so
  logical order is preserved and ArrowRight/ArrowLeft follow what the user sees (RA's
  `findNextSegment`).
- **Native primitive:** none; two native `date` inputs would be two controls with two tab stops
  and no shared validity.

## Bug history

Searched (2026-10-14) adobe/react-spectrum (DateRangePicker, DatePicker, "DateRangePicker
validation/end date/calendar", "TimeField range", "overnight"), chakra-ui/zag and ark (date picker,
range), unovue/reka-ui (DateRangeField, DateRangePicker, TimeRangeField), huntabyte/bits-ui (date range
picker, DateRangeField, TimeRangeField), kobaltedev/kobalte, mui/base-ui, radix-ui/primitives. About
350 hits; 40 read in full. Date Picker–specific entries are in [date-picker.md](date-picker.md) and
[date-range-picker.md](date-range-picker.md).

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| RK | [#1939](https://github.com/unovue/reka-ui/issues/1939) | `DateRangeField` cannot be cleared from the model: `{}` or `{ start: undefined, end: undefined }` change nothing | segment state copied from the model once; "undefined" treated as "unchanged" | closed (PR #1894) | a controlled `null` (and only `null`) clears both ends and every partial segment; scenario |
| RK | [#1891](https://github.com/unovue/reka-ui/issues/1891) | programmatically clearing the range leaves the field showing the old range | same | closed (#1894) | same scenario in the picker |
| BITS | [#391](https://github.com/huntabyte/bits-ui/issues/391) | clearing the value does not clear the input | same class | closed (#549) | same |
| RK | [#1769](https://github.com/unovue/reka-ui/issues/1769) | `null` model throws `Cannot read properties of null (reading 'start')` | code assumed an object | closed | the value type is exactly `{ start, end } \| null`; `null` is a normal input in every code path; test with `null` first |
| BITS | [#1348](https://github.com/huntabyte/bits-ui/issues/1348) | typing the end year rewrites the start year | the range became "complete" at the first digit of the end year and the "start ≤ end" rule pushed the start back | closed | commit points: the end is committed when its segment is left, not while typing; **the validity rule never edits the other end** — it only reports |
| BITS | [#1445](https://github.com/huntabyte/bits-ui/issues/1445) | day 31 not typeable in the end field (limit taken from the start's month) | one limit calculation shared by both ends | closed; the reporter says it regressed after the first fix | each end has its own draft and its own limits (date-segments "Partial Values And Limits"), never read from the other end |
| BITS | [#2120](https://github.com/huntabyte/bits-ui/issues/2120) | `en-GB`: end day clamped to the *start's* month length (31/08 becomes 30/08) | same, day-first locales hit it because day is typed before month | closed | scenario in a day-first locale; model-based configuration `en-GB` |
| RA | [#10683](https://github.com/adobe/react-spectrum/issues/10683) | in the range picker, the keystroke that completes a field is lost when the field blurs in the same event (08-05 → 08-01) | the cross-field focus move committed before the keystroke was applied; the standalone field is fine | open | focus moves after the keystroke's commit, also across the pair; `ADVANCE` is a follow-up event, scenario |
| RA | [#5302](https://github.com/adobe/react-spectrum/issues/5302) | a typed range that crosses an unavailable day is valid | validation looked at the ends only; checking every day was "too expensive" | closed (docs: validate outside) | check inside the range by *iterating unavailable-aware bounds*: `isDateUnavailable` over the days of the range, capped (design §Validity); Reka does it; invalid unless `allowsNonContiguousRanges` |
| RA | [#7348](https://github.com/adobe/react-spectrum/issues/7348) | changing `granularity` dynamically: the date typed earlier is cleared by the first character of the time part | internal state initialised from the first granularity | open (workaround: `key`) | granularity change recomputes segments and keeps every draft (date-segments), per end; scenario |
| RA | [#9958](https://github.com/adobe/react-spectrum/issues/9958) | partial clears of a required field are inconsistent | month cleared = invalid, day/year cleared = silently valid | open | any partial entry in either end is invalid (`badInput`); scenario for the end |
| RA | [#9743](https://github.com/adobe/react-spectrum/issues/9743) | request: one tab stop for the whole field | six to ten tab stops in a range | open | segment tab stops stay (touch AT reach, native parity); `tabBehavior` deferred (Open questions) |
| ZG | [#3186](https://github.com/chakra-ui/zag/issues/3186) | blur-validated input skips range normalization and accepts an unavailable date | two commit paths (Enter / blur) with different rules | closed | one `commit` for every path; we never swap — an inverted typed range is **invalid** and keeps its text |
| ZG | [#2809](https://github.com/chakra-ui/zag/issues/2809) | crash when the end date is typed before the start | `undefined` start dereferenced (three follow-ups #2840, #2864) | closed | the pair holds two independent committed values; the public value is derived; typing the end first is a normal path in the model |
| RK | [#1541](https://github.com/unovue/reka-ui/issues/1541) | clicking the field's padding does not focus a segment | `select-none` on the root interfered; only the Label focused | closed (advice) | a press on the group outside any segment focuses the last non-empty segment before the press point, else the first (date-segments), across both ends |
| RK | Reka source (`DateRangeFieldRoot.vue`) | one hidden input with `"undefined - undefined"` and one name | design | n/a | two hidden inputs, `startName`/`endName`, empty string when the range is not complete |
| RK | [#2956](https://github.com/unovue/reka-ui/issues/2956) | PM shown as AM for es-ES in a 12-hour field | period detected by string compare | closed | already a date-segments rule; Time Range Field repeats it for the end |
| BITS | [#1985](https://github.com/huntabyte/bits-ui/issues/1985) | Time Range Field always returns AM when the hour is typed | hour edit rebuilt the value without the period | closed | Time Range Field scenario per end |

## Known pitfalls

- **Partial public values** (Reka, Bits) force every consumer to handle half ranges and make
  "clear" ambiguous (RK#1939). Both-or-neither, with drafts kept in the field, is what RA does too.
- **Re-validating the other end while typing** (BITS#1348, BITS#1445/#2120) rewrites or clamps what
  the user is still typing. Validation reports; it never edits.
- **Cross-field focus** moves the caret out of an input while its last keystroke is being processed
  (RA#10683). Focus follows the commit.
- **Two inputs, one name** (Reka) breaks server parsing; **two inputs, one control** (RA, Bits) needs
  one Field registration, not two (field-control "second control warns").
- **Unavailable inside the range** must be checked for typed ranges (RA#5302), with a bounded cost.
- **Shared placeholder** (Reka) makes stepping an empty end start from the start's date; the end
  steps from `placeholderValue` constrained to min/max, *and* not before the start when the start is
  set (Decisions).

## Testing notes

- Node: the pair coordinator over two `date-segments` drafts — every order of typing (start first, end
  first, end then start), inverted ranges, equal ends, crossing an unavailable day, min/max on each
  end, external `null`/range while one end is mid-edit, granularity and locale switches mid-entry,
  `en-US`, `en-GB`, `ja-JP`, `ar-EG` (RTL), `th-TH`.
- Browser: focus crossing (typing, Tab, ArrowRight/Left in LTR/RTL, Backspace on an empty first end
  segment), the focus-after-commit order (RA#10683), form submit/reset with two names, autofill of each
  hidden input, single Field registration (no "two controls" warning), `Label` press.
- Driver: `fill({ start, end })`, `fillStart(date)`, `fillEnd(date)`, `clearEnd()`, queries
  `range()` (two hidden values), `segments(edge)`, `focusedSegment()` with its edge, `validity()` with
  the failing part.

## Decisions

- **`paired-fields` capability** (specified in `add-date-range-field`): a coordinator over two
  embedded Date Field instances (start, end). It owns the two committed values, derives the public
  value `{ start, end } | null` (both complete and ordered, else `null`), keeps each end's partial
  entry in that end's own draft, reports validity as the control's own validity with part-specific
  messages, moves focus between the ends (typing, Tab, arrows, Backspace) after commits, renders the two
  hidden inputs, and registers as **one** Field control. Reused by Time Range Field and the Date
  Range Picker.
- **Parts**: `Root` (a Field when not inside one), `Label`, `Description`, `ErrorMessage`, `Input` (group),
  `Start`, `End` (plain wrappers, no role; they provide the edge to their segments), `Separator`
  (`aria-hidden` literal), `Segment` (the Date Field's, scope `date-range-field`), two automatic hidden
  inputs.
- **Value**: `{ start: DateValue; end: DateValue } | null` controllable; `onValueChange` only when the
  derived value changes (`details.reason` as Date Field, plus `edge`); an invalid range is `null`. Each end keeps its own type/calendar/zone/time (`date-values`).
- **Validity** (control's own, on the start hidden input): per end `badInput`, `rangeUnderflow`,
  `rangeOverflow`, unavailable (Date Field's messages prefixed with the end name); range-level:
  end before start, and a range that contains an unavailable day unless `allowsNonContiguousRanges`
  (checked by iterating the range's days, at most 366 checks; larger ranges check the unavailable
  boundaries returned by `availableBounds` of Range Calendar, requested as reusable). Equal ends are valid.
- **Hidden inputs**: `startName`/`endName`, types by value type as Date Field; both `required`,
  `disabled`, `form` mirrored; native `min`/`max` on each; the start input is the registered validity
  element; the end input's own native flags are mirrored into the start's control message.
- **Focus**: auto-advance from the last start segment to the first end segment (and nowhere else);
  ArrowRight/Left by visual adjacency across both ends; Backspace on an empty first end segment goes to
  the last start segment; the focus operation registered with the Field targets the first invalid part.
- **`data-*`**: Date Field's on Root/Input/Segment, plus `data-edge="start|end"` on `Start`, `End` and
  their segments; Root `data-complete` = both ends complete; `data-invalid-edge` on the end that is
  invalid when the cause is that end alone.
- **Contract**: Date Field's actions/queries per edge (`fill({start,end})`, `fillStart`, `fillEnd`,
  `clear`, `clearEnd`, `step(edge, type, …)`), queries `range()`, `segments(edge)`, `validity()` with
  `part`, traits `field-associated`, `form-associated` (both inputs), segment invariants plus pair
  invariants (public value derivable from the two ends; neither end edited by the other's validity;
  exactly two hidden inputs).
- **Deliberately different**: both-or-neither public value (Reka, Bits: partial); two names (Reka: one);
  validity never edits an end (Bits, Zag swap or push); each end limited by itself; a range containing an
  unavailable day is invalid (RA: ends only); ends are not groups; the end name is in every segment name.

## Open questions

- **`tabBehavior: "field"`** (RA#9743): one tab stop per end or for the pair — wait for the Date Field
  decision.
- **Same-day ranges** are valid (start = end); a `minDays`/`maxDays` pair (Reka `maximumDays`) is a
  recipe on `isDateUnavailable(date, { anchor })` in the picker; revisit if the field needs it.
- **Time Range Field overnight** semantics are decided in [time-range-field.md](time-range-field.md).
