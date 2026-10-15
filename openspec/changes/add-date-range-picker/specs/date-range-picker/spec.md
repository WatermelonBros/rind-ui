## Purpose

Defines rind-ui's Date Range Picker: a labelled pair of segmented date fields with a trigger that opens a range calendar popover,
composed from `paired-fields`, Range Calendar and `picker-popover`, whose value is a range of `@internationalized/date` values.
Introduced by `add-date-range-picker`.

## ADDED Requirements

### Requirement: Composition

The Date Range Picker SHALL have the Date Picker's anatomy, `picker-popover` behaviour (one value owner, open state and reasons,
opening, modality, initial focus and restore, dismissal and nesting, names, clear, Field and form participation, state kept until exit,
touch, data attributes) with the embedded input being `paired-fields` (parts `input`, `start`, `end`, `separator`, `segment`, two
hidden inputs) and the calendar being the Range Calendar bound to the picker, except where this specification differs. The Trigger's
name SHALL be `messages.trigger` (default "Choose dates") followed by the Label.

#### Scenario: Standalone range picker

- **WHEN** a Date Range Picker labelled "Stay" is rendered in `en-US`
- **THEN** there is one `group` named "Stay" containing six spinbuttons (the first named "month Start date Stay") and a button named
  "Choose dates Stay"

### Requirement: Value And Callbacks

The value SHALL be controllable (`value`, `defaultValue`, `onValueChange(value, details)`) of type `{ start: DateValue; end:
DateValue } | null` as `paired-fields` defines, each end keeping its own type, calendar, zone and time of day. `startName`, `endName`,
`form`, `allowsNonContiguousRanges`, `isDateUnavailable`, `minValue`, `maxValue`, `granularity`, `hourCycle`, `placeholderValue`,
`firstDayOfWeek`, `required`, `disabled`, `readOnly`, `invalid`, `open`, `defaultOpen`, `onOpenChange`, `closeOnSelect`, `modal`,
`initialFocus`, `finalFocus`, `positioning` and `persistentElements` SHALL behave as `paired-fields`, Range Calendar and
`picker-popover` define them, in one shared props type; the Range Calendar's `commitOnBlur` SHALL be a prop of the `calendar` part.
`null` SHALL be accepted in every state.

#### Scenario: Null never throws (reka-ui#1769)

- **WHEN** the value is `null` at mount, after a selection and while the popover is open
- **THEN** nothing throws

#### Scenario: Controlled open (bits-ui#650, bits-ui#974)

- **WHEN** the picker is rendered with `open` and `onOpenChange`
- **THEN** pressing the trigger calls `onOpenChange(true, …)` and the popover follows the prop

### Requirement: Committing A Range

Pressing a first date in the calendar SHALL set the Range Calendar's anchor and SHALL NOT change the value or close the popover;
pressing a second date SHALL commit `{ start, end }` through the commit path and, with `closeOnSelect` (default `true`), close the
popover with reason `"select"`. Each end of the committed range SHALL keep the current value's time and zone for that end, else
`placeholderValue`'s time, else 00:00 at granularity ≥ hour; the commit SHALL be immediate with no date held aside. Hovering or moving the
pointer SHALL never commit or close. After a commit, the next press on any date, including the previous end, SHALL start a new
anchor. Two presses on the same date SHALL commit a one-day range.

#### Scenario: First press keeps it open

- **WHEN** the popover is open and the user presses 12 October
- **THEN** the popover is open, the value is unchanged and the anchor is 12 October

#### Scenario: Range commits and closes

- **WHEN** the user presses 12 October and then 16 October
- **THEN** `onValueChange` is called once with 12–16 October, the fields show both dates, the popover closes with reason `"select"`
  and the trigger is focused

#### Scenario: Time granularity fills the fields (react-spectrum#7688, react-spectrum#6957)

- **WHEN** no value is set, `granularity="minute"`, `closeOnSelect={false}` and the user presses 12 and 16 October
- **THEN** both ends show their date at 12:00 AM and the value holds two `CalendarDateTime`s

#### Scenario: Quick pointer moves do not close (ark#2509)

- **WHEN** after the first press the pointer sweeps quickly over many dates
- **THEN** the popover is open and the value unchanged

#### Scenario: Press on the old end (reka-ui#2242)

- **WHEN** the value is 12–16 October and the user opens the popover and presses 16 October
- **THEN** 16 October is the anchor, the value is unchanged and the popover is open

#### Scenario: One-day range (reka-ui#1020)

- **WHEN** the user presses 14 October twice
- **THEN** the value is 14–14 October

### Requirement: Cancel And Leave

While the Range Calendar is anchored, the first Escape SHALL clear the anchor and be consumed (the popover stays open); a second
Escape SHALL close the popover with reason `"escape-key"`. Closing the popover by an outside press, by Tab leaving, by the trigger or
by the API while anchored SHALL reset the anchor and keep the previous value; it SHALL NOT commit a preview. The Control and the content
SHALL be inside; a layer opened from the calendar's header SHALL be inside and SHALL keep the anchor. One press SHALL close at most one
layer, including a host Dialog.

#### Scenario: Escape twice

- **WHEN** the anchor is set and Escape is pressed twice
- **THEN** after the first the popover is open without an anchor, after the second it is closed

#### Scenario: Outside press resets (react-spectrum#5709, react-spectrum#8850)

- **WHEN** the value is 1–5 October, the user sets the anchor on 12 October and presses outside the popover
- **THEN** the popover closes, the value is still 1–5 October and no anchor remains

#### Scenario: Host dialog survives (react-spectrum#9469)

- **WHEN** the picker is open inside a dismissible Dialog with an anchor set and the user presses on the Dialog's backdrop area
- **THEN** only the picker closes (reason `"outside-press"`) and the Dialog stays open

#### Scenario: Header select is inside (react-spectrum#9430)

- **WHEN** a Select in the calendar's header is opened while anchored and an option is chosen
- **THEN** the picker stays open and the anchor is kept

### Requirement: Resume

When the popover opens while the pair has a committed start and an empty or invalid end, the Range Calendar's anchor SHALL be that start
and its focused date the start, so the next press sets the end. Otherwise it SHALL open with no anchor and focus the start of the value, else
today constrained to `minValue`/`maxValue`.

#### Scenario: Start typed, then open

- **WHEN** the user types a start of 12 October, leaves the end empty and opens the popover
- **THEN** 12 October is the anchor and pressing 16 October commits 12–16 October

#### Scenario: Complete value

- **WHEN** the value is 12–16 October and the popover opens
- **THEN** there is no anchor and 12 October is focused

### Requirement: Typing And Clearing

While the popover is open, committed field changes SHALL update the calendar's range and focused date; an incomplete or invalid pair SHALL
make the value `null` and clear the calendar's range without closing. The `ClearTrigger` and a controlled `null` SHALL clear both ends,
every partial segment, the calendar's range and anchor, in every state.

#### Scenario: Reset button inside the popover (react-spectrum#9180)

- **WHEN** a consumer button inside the content sets the picker's value to `null`
- **THEN** both ends of the field and the calendar are empty

#### Scenario: Programmatic clear (reka-ui#1891)

- **WHEN** a range is shown and the parent sets `value={null}`
- **THEN** every segment of both ends shows its placeholder

### Requirement: Names, Announcements And Form

The dialog SHALL be named by the Trigger's name and the Label; the Range Calendar's prompts and polite announcements (anchor set,
range selected) SHALL be spoken while the popover is open; after a commit the focused Trigger's description SHALL read
`paired-fields`' range description. The two hidden inputs SHALL carry `startName`/`endName` ISO values only for a valid range, else `""`.

#### Scenario: Range spoken on the trigger

- **WHEN** a range is committed and the popover closes
- **THEN** the trigger's description contains "Selected range: Monday, October 12, 2026 to Friday, October 16, 2026"

#### Scenario: Two names

- **WHEN** the value is 12–16 October with `startName="from"` and `endName="to"` in a form
- **THEN** the form data has `from=2026-10-12` and `to=2026-10-16`

### Requirement: Range Validity

Range validity SHALL be `paired-fields`' (per end, end before start, an unavailable day inside the range unless
`allowsNonContiguousRanges`); the effective invalid state SHALL be passed to the Range Calendar; a range chosen in the calendar SHALL never
be invalid by those rules because the Range Calendar already bounds it.

#### Scenario: Calendar and field agree (react-spectrum#5302)

- **WHEN** weekends are unavailable and a range crossing one is typed
- **THEN** the field is invalid and the open calendar root has `data-invalid`; the same range cannot be selected in the calendar

### Requirement: Contract

The Date Range Picker SHALL ship a contract with scope `date-range-picker`, located by role `group` and exact accessible name, with
the Date Picker's actions, `selectRange(start, end)` (opens when closed, then the Range Calendar's `selectRange`), `fill({ start, end })`,
`fillStart(date)`, `startRange(date)` and `cancel()`; queries `range()`, `anchor()`, `isOpen()`, `isModal()`, `closeReason()`,
`focusedElement()`, `isInvalid()`, `validity()`, `calendar()` and `field()`; states `closed`, `open`; events mapped to actions;
traits as the Date Picker's; plus the picker and pair invariants and: the anchor is cleared whenever the popover is closed.

#### Scenario: Same test in both environments

- **WHEN** `getDateRangePicker(screen, { name: "Stay" }).selectRange("2026-10-12", "2026-10-16")` runs in jsdom and with a Playwright
  `page`
- **THEN** both resolve with `range()` equal to the two ISO dates and the popover closed

### Requirement: Theme

`@rind-ui/theme` SHALL style the Date Range Picker in `date-range-picker.css` as `date-picker.css` does (families `field` and `panel`) through
`--rind-date-range-picker-*` tokens with semantic fallbacks, leaving the range, preview and anchor look to `range-calendar.css`, with
forced-colors rules and a trigger of at least 24 × 24 px.

#### Scenario: Forced colors

- **WHEN** an open Date Range Picker with an anchor and a preview is rendered under forced colors
- **THEN** the control, trigger, content boundary, the range and the dashed preview are all visible
