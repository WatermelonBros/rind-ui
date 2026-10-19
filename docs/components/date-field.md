# Date Field

A date, a date and time, or a time of day, typed segment by segment: month, day, year, hour, minute and the rest, in the order and with the digits of the user's locale. Each segment is a native input with the `spinbutton` role, so the keyboard steps it, a screen reader names it, and the whole group submits a real date through a hidden native input. The Root is a Field, so labelling, description and validation work like any Field.

## When to use

Use a Date Field when the user knows the date and typing it is the fastest way: a birth date, a deadline, an arrival, a meeting time. Add the picker parts when the user may also want to see the month and pick from a calendar: the same component becomes a date picker, or a date range picker with `selectionMode="range"`.

What it adds over a native `<input type="date">`:

- The segment order and the digits of the locale, including non-Latin digits and right-to-left layouts.
- Calendar systems other than the Gregorian one (Japanese eras, Buddhist, Islamic, and so on) and the era as a segment.
- Time zones: a zoned value shows its zone name, and the value keeps its zone.
- A typed value (`CalendarDate`, `CalendarDateTime`, `ZonedDateTime`, `Time`), not a string.
- The same behaviour and styling in every browser.
- Form participation and validation through a hidden native input, with messages you can translate.

When not to use it:

- **The user only picks from a calendar always on screen** (a day in a schedule): use [Calendar](calendar.md).
- **Free text** such as "next Friday": use [Text Field](text-field.md) and parse it yourself.
- **A single number** such as a year or an age: use [Number Input](number-input.md).

```tsx
import { CalendarDate } from "@internationalized/date"
import { Calendar, DateField } from "@rind-ui/react"

<DateField.Root name="departure" defaultValue={new CalendarDate(2026, 10, 14)}>
  <DateField.Label>Departure</DateField.Label>
  <DateField.Control>
    <DateField.Input />
    <DateField.Trigger>
      <CalendarIcon aria-hidden="true" />
    </DateField.Trigger>
  </DateField.Control>
  <DateField.Portal>
    <DateField.Positioner>
      <DateField.Content>
        <DateField.Calendar>
          <Calendar.Header>
            <Calendar.PrevTrigger />
            <Calendar.Heading />
            <Calendar.NextTrigger />
          </Calendar.Header>
          <Calendar.Grid />
        </DateField.Calendar>
      </DateField.Content>
    </DateField.Positioner>
  </DateField.Portal>
  <DateField.ErrorMessage />
</DateField.Root>
```

Without the picker parts it is a typed field only:

```tsx
<DateField.Root name="birthday" defaultValue={new CalendarDate(1990, 12, 1)}>
  <DateField.Label>Birthday</DateField.Label>
  <DateField.Input />
  <DateField.Description>As on your passport.</DateField.Description>
  <DateField.ErrorMessage />
</DateField.Root>
```

`DateField.Input` renders the segments by itself. For your own markup give it a render function over the segments:

```tsx
<DateField.Root>
  <DateField.Label>Birthday</DateField.Label>
  <DateField.Input>
    {(segments) => segments.map((s) => <DateField.Segment key={s.key} segment={s} />)}
  </DateField.Input>
</DateField.Root>
```

## API

<!-- api:date-field -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `DateField.Root` | `root` | `<div>`; holds the state. A Field when alone. |
| `DateField.Label` | `label` | `<label>`; names the group. A press on it focuses the first segment. |
| `DateField.Description` | `description` | `<div>`; describes the first segment (every segment while invalid). |
| `DateField.ErrorMessage` | `error-message` | `<div>`; the error, shown per the validation mode. |
| `DateField.Input` | `input` | `<div role="group">` named by the Label and described by the whole value. |
| `DateField.Segment` | `segment` | An editable segment is `<input role="spinbutton">`; a literal ("/", ",") is an `aria-hidden` span. |
| `DateField.Control` | `control` | Picker: `<div role="group">` around the Input and the triggers (the Input is then `role="presentation"`); the popover is placed against it. |
| `DateField.Trigger` | `trigger` | Picker: `<button aria-haspopup="dialog">` named "Choose date" and the Label, with `aria-expanded` and `aria-controls`. |
| `DateField.ClearTrigger` | `clear-trigger` | Picker: `<button>` named "Clear" and the Label; `data-empty` with no value and no draft. |
| `DateField.Portal`, `DateField.Positioner` | `positioner` | Picker: the popover's portal and placement. |
| `DateField.Content` | `content` | Picker: `<div role="dialog">` named like the trigger. |
| `DateField.Calendar` | — | Picker: the Calendar bound to the field; render the Calendar's own parts inside. |

State is on the parts: `data-disabled`, `data-readonly`, `data-required`, `data-invalid`, `data-focus`, `data-focus-visible` on the Root, the Input and the segments, plus `data-placeholder-shown`, `data-complete` and `data-composing` on the Root and the Input. A segment carries `data-type`, `data-editable` and `data-placeholder` while empty.

## Keyboard

Inside a segment (the API block lists the same keys):

| Key | Behaviour |
|---|---|
| Digits | Type the segment; focus moves on when no further digit fits. |
| `/` `-` `.` `:` Space | Move to the next segment. |
| Arrow Up / Down | Step the segment (wraps, never carries into the next). |
| Page Up / Page Down | Larger step (year 5, month 2, day 7, hour 2, minute 15). |
| Home / End | The segment's minimum / maximum. |
| Arrow Left / Right | Previous / next segment as shown (visual order under `dir="rtl"`). |
| Tab / Shift + Tab | Next / previous segment, then out of the field. |
| Backspace / Delete | Remove a digit; in an empty segment go back. |
| Cmd/Ctrl + A, then Backspace | Clear every segment. |
| Enter | Submit the form; never changes a segment. |

Keys are ignored while an IME composes.

## Picker

Rendering `DateField.Trigger` and the popover parts makes the field a date picker; with `selectionMode="range"` a date range picker. There is no separate picker component: the field owns the one value, the calendar is a view of it.

- **Opening.** The trigger opens on press, Enter or Space; Alt+ArrowDown or Alt+ArrowUp opens from any segment. Focus moves to the calendar's selected date (else today, within `minValue`/`maxValue`). Focus entering the field never opens it.
- **Picking.** A pick commits through the field (`onValueChange` reason `"CALENDAR"`), closes the popover (`closeOnSelect`, default `true`) and returns focus to the trigger. The value keeps its type, time of day and zone; with no value, a `CalendarDate` (or midnight at a time granularity). Picking the selected date again closes without a change. A pick refused with `details.cancel()` keeps every view and the popover open.
- **Typing while open.** The field stays operable: a typed date moves the calendar's selection, and a typed month and year show that month.
- **Range.** The first pick starts the range, the second ends it and commits both ends at once. The calendar leaves a half range unpicked when focus leaves (`commitOnBlur` is always `"reset"` in a picker).
- **Rules.** `minValue`, `maxValue`, `isDateUnavailable` and, in range mode, `allowsNonContiguousRanges` reach the calendar, so it never offers a date the field would refuse. `firstDayOfWeek` is forwarded; view props (`visibleMonths`, `pageBehavior`, `fixedWeeks`) go on `DateField.Calendar`.
- **Open state.** `open`, `defaultOpen` and `onOpenChange(open, { reason, cancel })` with reasons `"trigger"`, `"select"`, `"escape-key"`, `"outside-press"`, `"outside-focus"`, `"parent-dismissed"`, `"api"`. `modal` makes the popover modal; `initialFocus`, `finalFocus`, `positioning` and `persistentElements` work as on Popover.
- **Read-only and disabled.** A read-only picker's trigger stays focusable with `aria-disabled="true"` and never opens; a disabled one is disabled.
- **Dialogs.** Inside a Dialog or Drawer, a pick closes the picker only.

The strings are in `messages`: `trigger` ("Choose date"), `rangeTrigger` ("Choose dates") and `clear` ("Clear").

## Typing and commit rules

Typing inside a segment never changes the value. The value changes at a commit point only, and `onValueChange(value, { reason })` reports it once:

- **Auto-advance**: the digits typed fill the segment and no further digit fits (a month typed "2" waits for a possible "12"; "3" moves on at once). Reason `SEGMENT.COMMIT`.
- **Leaving a segment** by Tab, a click elsewhere or an arrow key. `SEGMENT.COMMIT`.
- **A separator** (`/`, `-`, `.`, `:` or a space). `SEGMENT.COMMIT`.
- **A step** (arrows, Page Up and Down, Home and End). `STEP`.
- **Paste** of an ISO date or a date in the field's own format ("2026-10-14"). `PASTE`.
- **Clearing** a segment with Backspace or Delete, or every segment with Select All and Backspace. `CLEAR`.
- **Form reset** restores the current `defaultValue`. `RESET`.

The value is `null` until every editable segment has a value. An incomplete or impossible entry (February 31) makes the value `null` (the form submits an empty value) and the field invalid; its segments keep what was typed, and no other date is invented. Stepping an empty segment starts from `placeholderValue`, which also sets the value's type and zone when there is no value (default: today at 00:00).

## Validity

The field is invalid when:

| Reason | When | Default message |
|---|---|---|
| `incomplete` | `required` and a segment is empty (or only some are) | "Enter a complete date" |
| `impossible` | The segments name a day that does not exist | "Enter a valid date" |
| `rangeUnderflow` | The value is before `minValue` | "Value must be {min} or later" |
| `rangeOverflow` | The value is after `maxValue` | "Value must be {max} or earlier" |
| `unavailable` | `isDateUnavailable(date)` is true | "This date is unavailable" |

The reason is on the hidden input as `data-validity`. The error shows per the Field's `validationMode`: moving from one segment to another is not leaving the field, so `blur` validates only when focus leaves the whole group. All messages come from `messages`:

```tsx
<DateField.Root messages={{ impossible: "Questa data non esiste" }} locale="it-IT">
```

## Form value

The hidden native input carries `name`, `form`, `required`, `disabled`, `autoComplete` and the custom validity. Its type depends on the value:

| Value | Input type | Submitted value |
|---|---|---|
| `CalendarDate` | `date` | `2026-10-14` |
| `CalendarDateTime` | `datetime-local` | `2026-10-14T15:30` (with `step` for second granularity, so seconds do not mismatch) |
| `ZonedDateTime` | `text` | `2026-10-14T15:30:00+02:00[Europe/Rome]` |
| `Time` | `time` | `14:30`, or `14:30:15` at second granularity (`step` 3600, 60 or 1) |

The value is always ISO and Gregorian, whatever the calendar shown. Nothing is submitted when empty, and a cleared field never leaves a stale value. `minValue` and `maxValue` are mirrored as `min` and `max` on the native types. A form reset restores the current `defaultValue`.

## Segments and messages

Segments are `era`, `year`, `month`, `day`, `hour`, `minute`, `second`, `dayPeriod` and `timeZoneName`; `granularity` sets the smallest one. A segment is named by its type ("month", or the locale's word: "Monat") followed by the Label's text, and its `aria-valuetext` is the spoken value ("10 – October"). An empty segment reads "Empty" and shows a placeholder ("mm", "dd", "yyyy"). The group is described by the whole value ("Selected date: October 14, 2026"). `hourCycle`, `hideTimeZone` and `shouldForceLeadingZeros` change the display. Segment names, placeholders, value texts and validity messages are all in `messages`.

For a calendar system other than Gregorian pass `createCalendar` from `@internationalized/date` together with a locale that selects it:

```tsx
import { createCalendar } from "@internationalized/date"

<DateField.Root locale="ja-JP-u-ca-japanese" createCalendar={createCalendar}>
```

## Times

There is no separate time field: a Date Field with no date segments is one. A `Time` value (from `@internationalized/date`) shows only the hour, the minute and, in a 12-hour locale, the day period; `maxGranularity="hour"` does the same for a date-time, whose date is then kept as it is.

```tsx
import { Time } from "@internationalized/date"

<DateField.Root name="alarm" defaultValue={new Time(7, 30)}>
  <DateField.Label>Alarm</DateField.Label>
  <DateField.Input />
</DateField.Root>
```

- **Hour cycle.** `hourCycle={12}` or `{24}` always wins over the locale; without it the locale's cycle is used (24-hour in `nl-NL`). In 12-hour, "0" or "1" waits for a second digit, and a "0" left alone means 12.
- **Day period.** AM/PM is its own segment. Editing, stepping or clearing the hour never changes it (stepping from 11 to 12 stays in the same half of the day). Type "a" or "p" in any locale, or the locale's own names.
- **Zones.** A `ZonedDateTime` steps its hour in its zone: on a fall-back day both 1:30 AMs are reached in order, and a spring-forward hour that does not exist resolves to the later time.
- **Bounds.** `minValue` and `maxValue` can be `Time`s; for a date-time they compare on the value's own day.
- **Never a `Date`.** The value never passes through the viewer's time zone: typing 00:00 in Rome gives `Time(0, 0)`. A `null` value shows placeholders, never 12:00 AM.

The group is described by "Selected time: 9:30 PM" (`messages.valueDescription` receives `time: true`).

## Date ranges

`selectionMode="range"` makes one field of two ends: a `start` and an `end` group of segments with a separator, inside one group named by the Label. The value is `{ start, end }` or `null`.

```tsx
<DateField.Root selectionMode="range" startName="from" endName="to">
  <DateField.Label>Stay</DateField.Label>
  <DateField.Input />
  <DateField.ErrorMessage />
</DateField.Root>
```

- **One value, once.** The value is the range only while both ends are complete, in order and valid. A partial range is `null`. `onValueChange` is called once each time the range changes, never while one end is half-typed.
- **The ends never edit each other.** An end typed before the start is kept as typed and reported invalid ("End date must be on or after the start date"); nothing is moved or clamped. Each end's own problem is named after it ("Start date: Enter a valid date").
- **Unavailable dates.** With `isDateUnavailable`, a range containing an unavailable day is invalid ("The range includes an unavailable date"), unless `allowsNonContiguousRanges`.
- **Focus.** Typing past the start's last segment moves to the end; Backspace in an empty first end segment goes back to the start; the arrows move across both ends as they are shown (mirrored in right-to-left).
- **Names.** Each segment is named by its segment name, the end ("Start date", "End date") and the Label. The group is described by "Selected range: … to …".
- **Forms.** Two hidden inputs, `startName` and `endName`, hold the ends' ISO values only while the range is valid, else empty strings. A form reset restores the default range; select all and Backspace clears both ends; a browser autofill of either input is adopted.
- **Parts.** Render `DateField.Start`, `DateField.Separator` and `DateField.End` inside `DateField.Input` to lay them out yourself.

- **Time ranges.** With `Time` ends (or `maxGranularity="hour"`) each end is a time field named "Start time" and "End time", and the hidden inputs are `type="time"`. An end before the start is invalid ("End time must be after the start time"), an equal end is valid. With `allowsOvernight` an end before the start is the next day: the value is the two times and the description says so ("6:00 AM the next day"). Each end keeps its own day period. Date-time and zoned ends are ordered by `compare()` (instants for zoned values) and ignore `allowsOvernight`.

```tsx
<DateField.Root selectionMode="range" allowsOvernight startName="from" endName="to"
  defaultValue={{ start: new Time(22), end: new Time(6) }}>
  <DateField.Label>Night shift</DateField.Label>
  <DateField.Input />
</DateField.Root>
```

The strings are in `messages`: `startDate`, `endDate`, `startTime`, `endTime`, `separator`, `rangeDescription`, `endProblem`, `endBeforeStart`, `endBeforeStartTime`, `containsUnavailable`, `overnight`.

## Field integration

The Root is a Field when alone and joins the enclosing Field or [Fieldset](fieldset.md) otherwise: `disabled`, `required`, `invalid`, `errors`, `validate`, `validationMode` and `fieldMessages` work as on [Text Field](text-field.md). Inside a Field, use that Field's Label, Description and ErrorMessage.

## Accessibility notes

- **Roles.** `group` for the Input, `spinbutton` for each editable segment, with `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and `aria-valuetext`.
- **Read-only** segments stay focusable and copyable; **disabled** ones leave the tab order.
- **Digits and order** follow the locale, including right-to-left.
- **iOS VoiceOver** treats the segments as text inputs: the contract locates them as `textbox` there.
- **VoiceOver on macOS**: its stepper commands do not step a segment. The arrow keys do.

## Styling

Style the `data-*` attributes above, or import `@rind-ui/theme/date-field.css`. Mute placeholders by colour, never by opacity, so the contrast stays measurable.

## Testing

`getDateField(screen, { name })` locates the group by its role and accessible name. Actions: `fill`, `enter`, `typeSegment`, `typeFocused`, `step`, `toEdge`, `move`, `backspace`, `clearSegment`, `clear`, `paste`, `setDayPeriod`, `leave`, `composeOpen`, `composeEnd`, `resetForm`. `fill` takes an ISO date, date-time or time (`fill("21:05")` types 9, 05, p in `en-US`); `setDayPeriod("am" | "pm")` types the period's letter. Queries: `value`, `segments`, `focusedSegment`, `isInvalid`, `validity`, `isComplete`, `isFocused`, `isComposing`, `isDisabled`, `isReadOnly`.

```tsx
import { getDateField } from "@rind-ui/testing"

render(<BirthdayField />)
const birthday = getDateField(screen, { name: "Birthday" })
await birthday.fill("1990-12-01")
expect(await birthday.value()).toBe("1990-12-01")
```

In range mode, `getDateField(screen, { name: "Stay", selectionMode: "range" })` returns a driver with `fill({ start, end })`, `fillStart(date)`, `fillEnd(date)`, `typeSegment(edge, type, text)`, `step(edge, type, direction)`, `paste(edge, text)`, `setDayPeriod(edge, period)`, `clear()`, `clearEnd()` and `resetForm()`, and the queries `range()` (both hidden inputs), `segments(edge)`, `isInvalid()`, `invalidEdge()` and `isComplete()`.

## Tested with

<!-- tested-with:date-field -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
