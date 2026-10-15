# Date Range Picker — research

Status: done · Wave: 3 (React Aria `DateRangePicker`, Ark/Zag `DatePicker` range mode, Reka UI `DateRangePicker`, Bits UI `DateRangePicker`)

A Date Range Picker = a [Date Range Field](date-range-field.md) (two embedded Date Fields, the
`paired-fields` capability) + a trigger + a [Range Calendar](range-calendar.md) in a popover. The shell
(`picker-popover`: Control group, trigger, popover, focus, close, form/validation mirroring) is
decided in [date-picker.md](date-picker.md) and reused unchanged. This note covers what a range adds
to a picker: when the popover closes, what leaving the popover means for an in-progress range,
resuming a half-typed range, two names, and range validity.

Cross-cutting: [accessibility.md](accessibility.md) §5, §7; [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
causes A, C, E, J, L; [overlay-infrastructure.md](overlay-infrastructure.md) (logical parents, one close per gesture).

## Pattern

No APG pattern; the Date Picker Dialog example with a range calendar. Perceivable without sight: that
the first selection started a range (Range Calendar's prompt and announcement), the committed range
("Selected range: …") on the trigger after the dialog closes, and invalid ranges.

## How the others built it

### React Aria (`useDateRangePicker.ts`, `useDateRangePickerState.ts`)

- State: `setDateRange` from the RangeCalendar; with a time granularity the dates wait in `dateRange`
  until times exist (same issue as the Date Picker: RA#6957, RA#7688). `shouldCloseOnSelect` closes
  when the range is complete; `setOpen(false)` with a complete date range and no times commits with
  placeholder times. The popover is modal with an underlay.
- Group: two fields `role=presentation` named "Start Date"/"End Date" + the label; the button excluded
  from the arrow-key focus manager (`accept: id !== buttonId`) so ArrowRight from the end field does not
  jump to the button; `startName`/`endName`; validation merged from both fields; the calendar gets
  `allowsNonContiguousRanges`, `isDateUnavailable`, `isInvalid`, and the *dialog* props are the same as the
  Date Picker's.
- Problems: RA#9469 (inside a dismissible Modal: after the start date, an outside click commits the
  focused date in a `pointerup` handler, the picker closes, and the modal's own outside handler then closes
  the modal too), RA#9430 (month/year `Select` in the calendar header while a start is set closes the picker
  and sets an end nobody picked), RA#9180 (a Reset button inside the popover cleared the calendar's state, not
  the picker's), RA#7688/#6957 (field not filled with a time granularity), RA#7348 (granularity switch clears
  the date), RA#10683 (completing keystroke lost across fields), RA#5302 (typed range over an unavailable
  day valid), RA#5709/#8850/#8287 (leaving commits; in range-calendar.md).

### Ark UI / Zag (`date-picker` with `selectionMode: "range"`)

- `activeIndex` (0/1), two inputs; `closeOnSelect` closes when the end is selected; reopening with one
  value resumes at the end (`resumeRangeSelection` on entering `open`). Problems: ZG#2809/#2840/#2864 (typing
  the end first crashes), ZG#3186 (blur path accepts unavailable dates, no normalization), ARK#2509 (quick hover
  closes the content), ARK#2491 (`clearValue()` leaves the picker broken).

### Reka UI (`DateRangePicker/*`) and Bits UI (`date-range-picker`)

- Popover + `DateRangeField` + `RangeCalendar`; Reka has no auto-close by default (`closeOnSelect` added after
  RK#2075), `fixedDate`, `allowNonContiguousRanges`, `maximumDays`. **One hidden input, one name** in Reka;
  Bits two names. Problems: RK#1891 (programmatic clear leaves the field showing the range), RK#1769 (`null`
  throws), RK#1995 (selecting the start in the calendar does not fill the field — answered: the start is unknown
  until two dates exist), RK#2242 (clicking the end date of a committed range resets everything without a new
  start), RK#1020 (single-day range requires `preventDeselect`), RK#1455 (max not inclusive), BITS#650 / #974
  (`open`/`onOpenChange` missing or not bindable), BITS#2120 / #1445 (end day limited by the start's month).

### Kobalte, Base UI, Radix, Headless UI, Ariakit

None (KB#306 open, BU#1709 open).

## Accessibility

- Everything in date-picker.md, plus the Range Calendar's prompts and announcements (anchor set,
  range selected) — spoken while the dialog is open. After the range commits and the dialog closes,
  focus is on the trigger whose description reads "Selected range: … to …".
- **Names**: trigger "Choose dates" + Label; dialog named the same; the end name sits in each segment's
  name (Date Range Field).
- **Escape**: while anchored the first Escape cancels the anchor and is consumed by the Range Calendar;
  the second reaches the popover and closes it (Range Calendar "Cancel And Leave"). Closing by any other
  route while anchored (outside press, Tab out) resets the anchor and keeps the old value
  (`commitOnBlur: "reset"`), never commits a hover.
- **Header controls** (month/year `Select`) are inside (Range Calendar rule via the layer stack).
- **Touch**: scrolling a multi-month calendar never commits (Range Calendar); tap-tap works; the soft
  keyboard dismisses on open as in Date Picker.

## Bug history

Same searches as date-picker.md plus "DateRangePicker validation/end date/calendar", "range"; 40 read in
full. Field-level and pairing entries: [date-range-field.md](date-range-field.md); calendar-level range
entries: [range-calendar.md](range-calendar.md); shell entries: [date-picker.md](date-picker.md).

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| RA | [#9469](https://github.com/adobe/react-spectrum/issues/9469) | in a dismissible Modal, an outside click after the start date closes the picker **and** the modal | the range calendar committed the focused date on `pointerup`, closing the picker; then the modal saw an outside press with the picker gone | closed | one gesture closes at most one layer; an outside press while anchored resets, never commits; scenario with a Dialog parent |
| RA | [#9430](https://github.com/adobe/react-spectrum/issues/9430) | opening a month/year Select in the calendar while a start is set closes the picker and sets an end | the nested popover counted as outside | open | the header's nested layer is inside; the anchor survives; scenario |
| RA | [#9180](https://github.com/adobe/react-spectrum/issues/9180) | a Reset button in the popover only closes it | it cleared the calendar state, not the picker state | closed (use the picker context) | clearing acts on the picker's value; `ClearTrigger` and an `onValueChange(null)` from a controlled parent both clear field and calendar |
| RA | [#7688](https://github.com/adobe/react-spectrum/issues/7688) / [#6957](https://github.com/adobe/react-spectrum/issues/6957) | with minute/second granularity the picked range does not fill the field | the range waits for times; placeholder times only on close | open / closed | a picked range commits at once with each end's time kept or the placeholder time; scenario |
| RA | [#7348](https://github.com/adobe/react-spectrum/issues/7348) | granularity changed dynamically clears the typed date on the first time keystroke | state initialised once | open | drafts survive a granularity change (date-segments), per end |
| RA | [#3118](https://github.com/adobe/react-spectrum/issues/3118) | the range picker's calendar button cannot be tabbed to | `tabindex=-1` | closed | trigger is a tab stop after the end field; ArrowRight from the end field does not jump to it (RA's `accept` filter) |
| RA | [#10683](https://github.com/adobe/react-spectrum/issues/10683) | the keystroke completing a field is lost when focus crosses fields | commit order | open | `paired-fields` scenario reused through the picker |
| RA | [#5302](https://github.com/adobe/react-spectrum/issues/5302) | typed range over an unavailable day is valid | ends-only validation | closed | range validity inside the range; the picker shows the same error as the field |
| ARK | [#2491](https://github.com/chakra-ui/ark/issues/2491) | `clearValue()` leaves the picker broken | not stated in the title; fixed upstream | closed | controlled `null` after interaction leaves every part consistent; model step `$sync:value null` in every state |
| ARK | [#2509](https://github.com/chakra-ui/ark/issues/2509) | selecting the start then hovering fast closes the content | hover handled as a selection | closed (3.1) | hover only previews (Range Calendar); close only on commit; scenario with rapid pointer moves |
| ZG | [#3186](https://github.com/chakra-ui/zag/issues/3186) | blur path accepts an unavailable date and skips normalization | two commit paths | closed | one commit path; inverted typed range is invalid, not swapped |
| ZG | [#2809](https://github.com/chakra-ui/zag/issues/2809) | typing the end first crashes | `undefined` start | closed | typing order is free in the model |
| RK | [#2242](https://github.com/unovue/reka-ui/issues/2242) | clicking the end date of the committed range clears everything with no new start | press on an endpoint treated as deselect | closed (not reproduced by the maintainer) | after a commit the next press always starts an anchor (Range Calendar); scenario at picker level: reopen, press the old end |
| RK | [#1995](https://github.com/unovue/reka-ui/issues/1995) | selecting the start in the calendar does not fill the start field | "unknown which is start until two dates" | closed (not a bug) | agreed: the fields show the committed range only; sighted feedback is the calendar's anchor/preview, AT feedback the announcement; open question for a provisional display |
| RK | [#1020](https://github.com/unovue/reka-ui/issues/1020) | selecting the same day as start and end needs `preventDeselect` | deselect semantics | closed | no deselect; two presses on the same date make a one-day range; scenario |
| RK | [#1769](https://github.com/unovue/reka-ui/issues/1769) | `null` model throws | object assumed | closed | value is exactly `{start,end} \| null`; `null` first in the tests |
| RK | [#1891](https://github.com/unovue/reka-ui/issues/1891) / BITS [#391](https://github.com/huntabyte/bits-ui/issues/391) | programmatic clear leaves the field showing the range | local copies | closed | scenario: controlled `null` while open and while closed |
| RK | [#1455](https://github.com/unovue/reka-ui/issues/1455) | `maxValue` date not selectable | exclusive compare | closed | inclusive (date-values) |
| BITS | [#650](https://github.com/huntabyte/bits-ui/issues/650) / [#974](https://github.com/huntabyte/bits-ui/issues/974) | `open`/`onOpenChange` missing or not bindable on the range picker | API gap | closed | controllable `open` identical to Date Picker; one prop surface (`DatePickerProps` shared type, answering RA#8557 too) |
| BITS | [#2120](https://github.com/huntabyte/bits-ui/issues/2120) | end day clamped by the start's month | shared limits | closed | each end validated on its own (date-range-field) |
| RA | [#8557](https://github.com/adobe/react-spectrum/issues/8557) | `firstDayOfWeek` not forwarded by the pickers | prop plumbing | closed | one shared props type for calendar data props, bound by the picker |
| RA | [#6427](https://github.com/adobe/react-spectrum/issues/6427) | `undefined` unavailable-date message crashes the range picker with server-optimised strings | message lookup | open | `messages` typed with defaults; unavailable message needs no runtime lookup; SSR test |
| RA | [#10641](https://github.com/adobe/react-spectrum/issues/10641) | Safari 26 VO silent dialog | Safari | closed (external) | tier-1 manual check, as Date Picker |

## Known pitfalls

- **Leaving while anchored** commits in RA by design (five issues): ours resets (Range Calendar) and
  the picker adds nothing on top; closing via Escape/outside/Tab never commits.
- **One gesture, one layer** (RA#9469): the picker's popover and a host dialog must not both close from
  the same press.
- **Resume**: reopening with the start typed but no end must continue at the end (Zag does; RA does not).
- **Two writers of the range**: field and calendar; one coordinator, one commit path.
- **Touch scrolling a multi-month calendar** (Range Calendar's rule) must survive the popover's own
  dismiss logic (RK#2891).

## Testing notes

Date Picker's, plus: model paths open → anchor → commit (closes, focus on trigger) / Escape ×2 / outside
reset / Tab out; typing start then opening (anchor resumes); typing end first; granularity minute with a
placeholder time; `allowsNonContiguousRanges` both ways; inside a Dialog with Escape and outside press;
controlled `null` in every state; two hidden inputs; RTL; shadow root. Driver: `selectRange(start, end)`,
`fill({ start, end })`, `open()`, `close()`, `clear()`; queries `range()`, `isOpen()`, `calendar()`,
`field()`.

## Decisions

- **Composition**: `picker-popover` (add-date-picker) + `paired-fields` (add-date-range-field) +
  Range Calendar bound to the picker; scope `date-range-picker`.
- **Value** `{ start, end } | null`, `startName`/`endName`, validity as Date Range Field; range
  commits from the calendar keep each end's time else the placeholder time.
- **Close**: on commit (`closeOnSelect`, default true) with reason `"select"`; never on the first
  press. Escape (consumed while anchored), outside press, Tab out reset the anchor.
- **Resume**: when the start is committed and the end is empty, opening anchors the calendar at the start
  (requires a controllable anchor on Range Calendar — request).
- **Calendar data props** (min/max, unavailable, `allowsNonContiguousRanges`, `firstDayOfWeek`) are the
  picker's; view props (visible months, paging) are on the bound calendar part.
- **Deliberately different**: reset on leave (RA commits), two names (Reka one), both-or-neither value
  (Reka/Bits partial), close only on commit, trigger focus restore, non-modal default.

## Open questions

- A provisional start in the field while anchored (RK#1995): a sighted-user nicety; not now.
- `minDays`/`maxDays` presets and quick ranges ("last 7 days"): consumers compose buttons that set the value.
