# Date Field

A date, or a date and time, typed segment by segment: month, day, year, hour, minute and the rest, in the order and with the digits of the user's locale. Each segment is a native input with the `spinbutton` role, so the keyboard steps it, a screen reader names it, and the whole group submits a real date through a hidden native input. The Root is a Field, so labelling, description and validation work like any Field.

## When to use

Use a Date Field when the user knows the date and typing it is the fastest way: a birth date, a deadline, an arrival, a meeting time. It is also the input of a date picker (a Calendar in a popup).

What it adds over a native `<input type="date">`:

- The segment order and the digits of the locale, including non-Latin digits and right-to-left layouts.
- Calendar systems other than the Gregorian one (Japanese eras, Buddhist, Islamic, and so on) and the era as a segment.
- Time zones: a zoned value shows its zone name, and the value keeps its zone.
- A typed value (`CalendarDate`, `CalendarDateTime`, `ZonedDateTime`), not a string.
- The same behaviour and styling in every browser.
- Form participation and validation through a hidden native input, with messages you can translate.

When not to use it:

- **The user picks from a calendar** (a day in a schedule, a booking window): use [Calendar](calendar.md) or Date Picker.
- **Free text** such as "next Friday": use [Text Field](text-field.md) and parse it yourself.
- **A single number** such as a year or an age: use [Number Input](number-input.md).

```tsx
import { CalendarDate } from "@internationalized/date"
import { DateField } from "@rind-ui/react"

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

The value is always ISO and Gregorian, whatever the calendar shown. Nothing is submitted when empty, and a cleared field never leaves a stale value. `minValue` and `maxValue` are mirrored as `min` and `max` on the native types. A form reset restores the current `defaultValue`.

## Segments and messages

Segments are `era`, `year`, `month`, `day`, `hour`, `minute`, `second`, `dayPeriod` and `timeZoneName`; `granularity` sets the smallest one. A segment is named by its type ("month", or the locale's word: "Monat") followed by the Label's text, and its `aria-valuetext` is the spoken value ("10 – October"). An empty segment reads "Empty" and shows a placeholder ("mm", "dd", "yyyy"). The group is described by the whole value ("Selected date: October 14, 2026"). `hourCycle`, `hideTimeZone` and `shouldForceLeadingZeros` change the display. Segment names, placeholders, value texts and validity messages are all in `messages`.

For a calendar system other than Gregorian pass `createCalendar` from `@internationalized/date` together with a locale that selects it:

```tsx
import { createCalendar } from "@internationalized/date"

<DateField.Root locale="ja-JP-u-ca-japanese" createCalendar={createCalendar}>
```

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

`getDateField(screen, { name })` locates the group by its role and accessible name. Actions: `fill`, `enter`, `typeSegment`, `typeFocused`, `step`, `toEdge`, `move`, `backspace`, `clearSegment`, `clear`, `paste`, `leave`, `composeOpen`, `composeEnd`, `resetForm`. Queries: `value`, `segments`, `focusedSegment`, `isInvalid`, `validity`, `isComplete`, `isFocused`, `isComposing`, `isDisabled`, `isReadOnly`.

```tsx
import { getDateField } from "@rind-ui/testing"

render(<BirthdayField />)
const birthday = getDateField(screen, { name: "Birthday" })
await birthday.fill("1990-12-01")
expect(await birthday.value()).toBe("1990-12-01")
```

## Tested with

<!-- tested-with:date-field -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
