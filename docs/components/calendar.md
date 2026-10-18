# Calendar

## When to use

Use a Calendar when the user has to see a month (or several) and pick one or more days from it: choosing a day in a schedule, a booking window shown as a grid, the days off in a rota, or the visible part of a date picker. It is a grid of dates with a focused date, paging between months, and a selection.

What it adds over a native `<input type="date">`: several visible months side by side, selecting more than one date, dates that cannot be picked (`isDateUnavailable`) and a range limit (`minValue`, `maxValue`) that you draw the way you want, a first day of the week you choose, calendar systems other than the Gregorian one, a layout and look that is entirely yours, and the same behaviour in every browser.

When not to use it:

- **The user types a date.** A date field or a date picker (a field with a Calendar in a popup) is the control for that. The Calendar is only the grid.
- **A single date and the platform picker is enough.** Use `<input type="date">`: it is free, accessible and familiar on touch devices.
- **A time, or a date far in the past** such as a birth date. Typing is faster than paging; use a field.

```tsx
import { Calendar } from "@rind-ui/react"

<Calendar.Root aria-label="Departure" onValueChange={(value) => save(value)}>
  <Calendar.Header>
    <Calendar.PrevTrigger />
    <Calendar.Heading />
    <Calendar.NextTrigger />
  </Calendar.Header>
  <Calendar.Grid />
</Calendar.Root>
```

`Calendar.Grid` renders the weekday row and the weeks by itself. For several months render one Grid per month and set `visibleMonths` on the Root:

```tsx
<Calendar.Root aria-label="Trip" visibleMonths={2}>
  <Calendar.Header>
    <Calendar.PrevTrigger />
    <Calendar.Heading />
    <Calendar.NextTrigger />
  </Calendar.Header>
  <Calendar.Grid month={0} />
  <Calendar.Grid month={1} />
</Calendar.Root>
```

Give the Root an accessible name with `aria-label` or `aria-labelledby`; without one the heading (for example "October 2026") names it.

## API

<!-- api:calendar -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `Calendar.Root` | `root` | `<div role="group">`; owns the state. |
| `Calendar.Header` | `header` | `<div>` around the heading and the triggers. |
| `Calendar.Heading` | `heading` | `<h2>` with the visible range ("October 2026", "2026", "2016 – 2027"). |
| (inside `Calendar.Heading`) | `view-trigger` | `<button>` one view up, while a higher view exists and `view` is not fixed. |
| `Calendar.PrevTrigger` / `NextTrigger` | `prev-trigger`, `next-trigger` | `<button>` that pages; stays focusable at a bound. |
| `Calendar.Grid` | `grid` | `<table role="grid">`; `month` is the offset from the first visible month. |
| `Calendar.GridHeader` | `grid-header` | `<thead>` with the weekday names, hidden from assistive technology (each cell's name has its weekday). |
| `Calendar.HeaderCell` | `header-cell` | `<th>` for one weekday; `day` is 0 to 6 from the first day of the week. |
| `Calendar.GridBody` | `grid-body` | `<tbody>`. |
| `Calendar.Row` | `row` | `<tr>`, one week. |
| `Calendar.Cell` | `cell` | `<td role="gridcell">`; `date` is the day. It is the focusable element. |

`Calendar.Grid` takes a render function when you need your own cells: it receives `{ weeks, month }`.

```tsx
<Calendar.Root aria-label="Departure">
  <Calendar.Header>
    <Calendar.PrevTrigger />
    <Calendar.Heading />
    <Calendar.NextTrigger />
  </Calendar.Header>
  <Calendar.Grid>
    {({ weeks }) => (
      <Calendar.GridBody>
        {weeks.map((week) => (
          <Calendar.Row key={week[0]?.toString()}>
            {week.map((date) => (
              <Calendar.Cell key={date.toString()} date={date} />
            ))}
          </Calendar.Row>
        ))}
      </Calendar.GridBody>
    )}
  </Calendar.Grid>
</Calendar.Root>
```

State is on the parts. The Root and the Grids carry `data-disabled`, `data-readonly`, `data-invalid`, and `data-focus` / `data-focus-visible` while focus is inside a grid. A cell carries `data-value` (the ISO date, always Gregorian), and when they apply `data-selected`, `data-today`, `data-weekend`, `data-outside-month`, `data-disabled`, `data-unavailable`, `data-invalid`, `data-hover`, `data-pressed`, `data-focus` and `data-focus-visible`. A trigger carries `data-disabled` at a bound.

## Value and selection

The value is a date from `@internationalized/date` (`CalendarDate`, or a `CalendarDateTime` or `ZonedDateTime`, shown as a day), or `null`. With `selectionMode="multiple"` it is an array that stays sorted. `value`, `defaultValue` and `onValueChange(value, { reason, modality, cancel })` follow the usual controlled and uncontrolled rules; `reason` is `CELL.PRESS` or `KEY`, and `cancel()` refuses the change.

```tsx
import { CalendarDate } from "@internationalized/date"

const [value, setValue] = useState<CalendarValue>(new CalendarDate(2026, 10, 14))

<Calendar.Root aria-label="Departure" value={value} onValueChange={(v) => setValue(v)}>
```

- Moving focus onto a date never selects it. Only a press, or Enter or Space, does.
- In single mode, selecting the selected date again keeps it selected. In multiple mode it removes it.
- A cell selects when the press is released on it, so a touch that turns into a scroll selects nothing.
- Passing a new date object equal to the current value does not move the visible month.

`focusedValue`, `defaultFocusedValue` and `onFocusChange(date)` control which date holds focus and therefore which month is visible. `onVisibleRangeChange({ start, end })` reports every change of the visible range.

## Date ranges

`selectionMode="range"` selects a range in two steps. The first press (or Enter or Space) sets the **anchor**; the second ends the range and calls `onValueChange` once with `{ start, end }` in date order. Pressing the same date twice gives a one-day range, and after a commit the next press always starts a new anchor. Each end keeps its own type and time of day.

```tsx
const [stay, setStay] = useState<CalendarValue>(null)

<Calendar.Root aria-label="Stay" selectionMode="range" value={stay} onValueChange={setStay}>
```

- **Preview.** While anchored, the days from the anchor to the hovered date (or the focused date, so the arrow keys move it) carry `data-preview`. They are not selected: `aria-selected` stays on the committed range.
- **Cancel and leave.** Escape drops the range in progress and is consumed; with no anchor it reaches an enclosing dialog. Leaving the Calendar while anchored, by focus or a press outside, applies `commitOnBlur`: `"reset"` (default) keeps the value, `"select"` commits the preview, `"clear"` clears the value. Header controls, and popups opened from inside, count as inside. Paging keeps the anchor.
- **Length.** `minRangeLength` and `maxRangeLength` (in days, ends included) disable the dates no range from the anchor may end on.
- **Unavailable dates.** A range never crosses an unavailable date, unless `allowsNonContiguousRanges`. `isDateUnavailable(date, { anchor })` is told the anchor, so availability can depend on it (for example "at most a week after the start"). A committed range that crosses an unavailable date, or breaks the length rules, marks the Calendar invalid.
- **Controlled anchor.** `anchor`, `defaultAnchor` and `onAnchorChange(date | null)` control the range in progress: setting `anchor` to a half-entered range's start lets the next press complete it. A new `value` from the parent drops the anchor.
- **Screen readers.** The focused cell is described by "Press Enter to start a range", then "Press Enter to end the range starting {date}"; cell names stay the plain date. "Range starts {date}" and "Selected {start} to {end}" are announced politely. All four strings are in `messages` (`startPrompt`, `endPrompt`, `anchorSet`, `rangeSelected`).

The range is drawn with `data-in-range`, `data-range-start`, `data-range-end`, `data-anchor`, `data-preview`, `data-preview-start` and `data-preview-end` on the cells, and `data-anchored` on the root. `calendar.css` draws it as one band per week row, with a dashed preview. The helpers it uses, `makeRange`, `rangeLength`, `availableBounds`, `lengthBounds`, `crossesUnavailable` and `canEndRange`, are exported for your own range logic.

## Month and year views

`view` is `"days"` (default), `"months"` (the months of one year) or `"years"` (a page of `yearsPerPage` years, default 12), in rows of `columns` cells (default 4). It is controllable: `view`, `defaultView` and `onViewChange(view, { reason })`, with the reasons `heading`, `select`, `escape-key` and `api`. `minView` and `maxView` (default `"days"` and `"years"`) bound it.

- **Drill-down.** While a higher view exists, the heading is a button ("October 2026, Choose month", from `messages.viewUp`) that goes up one view: days, months, years, keeping the focused period. Picking a period in a view above `minView` goes back down one view onto its first day (or month) without changing the value; Escape there goes down one view and is consumed. Each view change moves focus to the new view's tab stop and announces its heading. With `view` controlled and no `onViewChange` the heading is plain text.
- **A month or year picker.** Set `minView="months"` (or `"years"`): the value is chosen there. Choosing a month changes only the value's month (the day clamped, 31 March to 28 February); choosing a year changes only its year (29 February to 28 February in a common year). The type, calendar, time of day and zone are kept; with no value the period's first day is emitted. Choosing the month that is already selected changes nothing.
- **Pages.** A month page is one year of the display calendar (13 months in a Hebrew leap year). Year pages are fixed blocks (2016–2027, 2028–2039 with 12 per page), so paging never drifts, and stop at an era's first and last year. ArrowUp and ArrowDown keep the column; PageUp and PageDown keep the position on the next page.
- **Constraints.** A month or year is allowed when any of its days is inside `minValue` / `maxValue`. `isMonthUnavailable(month)` and `isYearUnavailable(year)` decide availability for the period (never from its days); unavailable cells stay focusable.
- **Names.** Month cells show the locale's full month name ("October", "gennaio") and year cells the year as the display calendar writes it (2569 in the Buddhist calendar), with its era when one is needed ("3 BC"). They have no `aria-label`: the name is the visible text, and the year comes from the grid, which is named by the heading. `data-value` is the period's first day. The triggers are "Previous year" / "Next year" and "Previous years" / "Next years": `messages.previous` and `messages.next` take a string or a function of the view.
- **Ranges.** `selectionMode="range"` works at the period: the band, the preview and `minRangeLength` / `maxRangeLength` are in months or years. Commits are announced as "Selected March 2026 to June 2026".

```tsx
<Calendar.Root aria-label="Billing month" minView="months" onValueChange={setMonth}>
  <Calendar.Header>
    <Calendar.PrevTrigger />
    <Calendar.Heading />
    <Calendar.NextTrigger />
  </Calendar.Header>
  <Calendar.Grid />
</Calendar.Root>
```

The grid of a month or year view has no weekday row and carries `data-view`, like the Root.

## Calendar systems and locale

`locale` and `dir` default to the provider's. The Calendar shows the locale's calendar system. For a system other than Gregorian pass `createCalendar` from `@internationalized/date`; without it a non-Gregorian locale falls back to Gregorian with a warning in development.

```tsx
import { createCalendar } from "@internationalized/date"

<Calendar.Root aria-label="วันที่" locale="th-TH" createCalendar={createCalendar}>
```

Values you pass in any system are converted for display, and `data-value` stays ISO. `firstDayOfWeek` (`"sun"` to `"sat"`) overrides the locale's first day; `fixedWeeks` always shows six rows so the height does not change between months. `dir="rtl"` mirrors the layout and the horizontal arrow keys.

## Today and the clock

Today is read from the environment's date clock, in the zone of the value (then `timeZone`, then the viewer's). The cell of today has `aria-current="date"` and `data-today`. In tests, provide a fixed clock so the page does not depend on the real date:

```tsx
<RindProvider environment={{ dateClock: { now: () => Date.parse("2026-10-14T12:00:00Z"), timeZone: () => "UTC" } }}>
```

## Disabled and unavailable dates

These are different and both are announced as disabled:

- **Disabled** dates are outside `minValue` / `maxValue`, outside the month of their grid (the days of a neighbouring month shown to fill the week), or the whole Calendar is `disabled`. They cannot take focus and cannot be selected. They carry `data-disabled`.
- **Unavailable** dates come from `isDateUnavailable(date)`. They can take focus, so a keyboard user reads their name and finds out why, but they cannot be selected. They carry `data-unavailable`, and not `data-disabled`.

If the value is unavailable or out of range the Calendar is invalid: `data-invalid` on the Root and on that cell, `aria-invalid="true"` on the cell. The previous and next triggers become `aria-disabled` when paging would leave the range, and stay focusable so focus is never lost.

`readOnly` keeps navigation and focus but refuses every change; the grid carries `aria-readonly="true"`. `disabled` removes every part from the tab order and keeps the selection visible (`aria-selected`, `data-selected`).

## Multiple months

`visibleMonths` shows that many grids. `pageBehavior="visible"` (default) pages by the number of visible months; `pageBehavior="single"` pages by one month. Each grid is named by its month. Keyboard navigation moves across the grids as one.

## Keyboard

Inside the grid, which follows the WAI-ARIA grid pattern. The grid is one tab stop on the focused date; Tab leaves it.

| Key | Behaviour |
|---|---|
| Arrow Right / Left | Next / previous day (swapped under `dir="rtl"`). |
| Arrow Down / Up | Next / previous week. |
| Home / End | First / last day of the week. |
| Page Down / Page Up | Next / previous month. |
| Shift + Page Down / Page Up | Next / previous year. |
| Enter / Space | Select the focused date, when it is selectable. |
| Escape | Range mode: cancel the range in progress. Above `minView`: one view down. Else it bubbles. |

In the month and year views the arrows move by one period (Up and Down by a row), Home and End go to the page's first and last period, and Page Down / Page Up keep the position on the next or previous page.

A move past the visible range pages to the date. Keys are ignored while an IME composes. The triggers are buttons: Enter and Space page.

## Announcements

The focused cell's name is the full date ("Wednesday, October 14, 2026"), so moving in the grid is announced by the browser. Its state is in attributes (`aria-selected`, `aria-disabled`, `aria-current`), not in the name. When the month changes while focus is outside the grid (a trigger press, a controlled `focusedValue`), the visible range is announced politely through the Announcer; quick paging announces only the last range. Paging with the keyboard inside the grid is not announced twice. All texts, including the trigger names, the cell name, the month name and the range, come from `messages`:

```tsx
<Calendar.Root aria-label="Abreise" locale="de-DE" messages={{ next: "Nächster Monat", previous: "Voriger Monat" }}>
```

## Accessibility notes

- **Roles.** `group` for the Root, `grid` for each month, `gridcell` for each day. The weekday row is hidden because every cell name has its weekday.
- **Focus.** The cell itself is the focusable element: there is no inner button and no `role="application"`. One cell is the tab stop; disabled cells have no `tabindex`.
- **Target size.** Cells and triggers are at least 24 by 24 CSS pixels in the theme.
- **Not colour alone.** The theme gives the selected date a background, a heavier weight and an edge; today a border; an unavailable date a strike-through; days of other months a muted tone. Under forced colors each of these states has its own rule.

## Styling

Style the `data-*` attributes above. The theme reads `--rind-calendar-*` tokens (`bg`, `border`, `radius`, `cell-size`, `selected-bg`, `selected-text`, `today-border`, and others) and falls back to the semantic tokens; `data-size` (`sm`, `md`, `lg`) changes the cell size. Under `dir="rtl"` the layout uses logical properties and the paging chevrons mirror.

## Testing

`getCalendar(screen, { name })` locates the Calendar by its group role and accessible name. Actions: `select` (pages to the month if needed; by pointer or keyboard), `focusDate`, `nextPage`, `previousPage`, `press` (a key in the grid). Queries: `value`, `focusedDate`, `heading`, `visibleMonths`, `isSelected`, `isUnavailable`, `isDisabled`, `today`, `isInvalid`, `isFocused`, `view`. `viewUp()` presses the heading button and `viewDown()` presses Escape in the grid. In the month and year views the same actions take a period: `select("2027-03")`, `select("2031")`. In range mode, the actions `selectRange(start, end)`, `startRange(date)` and `cancel()`, and the queries `range()` (the committed range's visible ends), `anchor()`, `preview()` and `isAnchored()`. Dates are ISO strings (`"2026-10-20"`).

```tsx
import { getCalendar } from "@rind-ui/testing"

render(<DeparturePicker />)
const departure = getCalendar(screen, { name: "Departure" })
await departure.select("2026-11-03")
expect(await departure.value()).toEqual(["2026-11-03"])
await departure.via("keyboard").focusDate("2026-11-10")
await departure.press("Enter")
expect(await departure.isSelected("2026-11-10")).toBe(true)
expect(await departure.isUnavailable("2026-11-14")).toBe(true)

const stay = getCalendar(screen, { name: "Stay" })
await stay.selectRange("2026-10-10", "2026-10-14")
expect(await stay.range()).toEqual({ start: "2026-10-10", end: "2026-10-14" })
```

To test the machine without a DOM, `testMachine(calendarMachine, props)` from `@rind-ui/testing` walks the state graph against the contract's oracle.

## Tested with

<!-- tested-with:calendar -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
