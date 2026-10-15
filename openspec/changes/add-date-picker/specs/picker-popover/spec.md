## Purpose

Defines the shell shared by pickers made of a segmented field, a trigger and a calendar in a popover: who owns the value, how
the popover opens, closes and moves focus, what counts as inside, how selecting commits, how the shell is named and takes part
in Fields and forms. Used by the Date Picker and the Date Range Picker. Introduced by `add-date-picker`.

## ADDED Requirements

### Requirement: One Value Owner

The picker SHALL own one controllable value; the embedded field, the calendar and the hidden input SHALL be views of it. A
change from any source (field commit, calendar selection, clear, reset, autofill adoption) SHALL pass through one commit path
that calls `onValueChange(value, details)` once per change, with `details.reason` (`FIELD`, `CALENDAR`, `CLEAR`, `RESET`,
`ADOPT`), `modality` and `cancel()`. A controlled change SHALL update all views and SHALL NOT call `onValueChange`.

#### Scenario: Field edit reaches the calendar (reka-ui#736)

- **WHEN** the popover is open and the user types a complete date into the field
- **THEN** the calendar shows that date as selected and its month visible, and `onValueChange` was called once

#### Scenario: Calendar pick reaches the field and back

- **WHEN** the user picks 20 October in the calendar and then edits the field's day to 21
- **THEN** the field shows 20 then 21 October, and the calendar's selected cell follows

#### Scenario: Cancel keeps all views

- **WHEN** `onValueChange` calls `details.cancel()` for a calendar pick
- **THEN** field, calendar and hidden input keep the previous value and the popover stays open

### Requirement: Open State And Reasons

The open state SHALL be controllable (`open`, `defaultOpen`, `onOpenChange(open, details)`) with `details.reason` `"trigger"` when
opening and, when closing, one of `"trigger"`, `"select"`, `"escape-key"`, `"outside-press"`, `"outside-focus"`,
`"parent-dismissed"`, `"api"`. A request SHALL call `onOpenChange`; the state changes when the prop changes in controlled mode;
`details.cancel()` keeps the state; a programmatic change of `open` SHALL NOT call `onOpenChange`.

#### Scenario: Controlled refusal

- **WHEN** a controlled picker with `open={false}` has its trigger pressed and the parent does not change `open`
- **THEN** `onOpenChange(true, …)` was called once and the content is not rendered

#### Scenario: Reason on select

- **WHEN** the user picks a date with `closeOnSelect`
- **THEN** `onOpenChange(false, …)` has reason `"select"` once

### Requirement: Opening

The trigger SHALL be a normal tab stop that opens the popover on press, Enter and Space. `Alt+ArrowDown` and `Alt+ArrowUp` on any
segment of the field (when the event is not default-prevented) SHALL open it. Focus entering the field SHALL NOT open it. When
`disabled` the trigger SHALL be disabled; when `readOnly` it SHALL stay focusable with `aria-disabled="true"` and not open. The
trigger SHALL have `data-pressed` only while a press is in progress and `data-state="open"` while the popover is open.

#### Scenario: Keyboard reaches the trigger (react-spectrum#3118)

- **WHEN** the user tabs from the last segment
- **THEN** the trigger is focused, and Enter opens the popover

#### Scenario: Alt+ArrowDown from a segment

- **WHEN** focus is on a day segment and Alt+ArrowDown is pressed
- **THEN** the popover opens, the segment's value did not change

#### Scenario: Pressed styling does not stay (react-spectrum#8339)

- **WHEN** the popover is open after a mouse press on the trigger
- **THEN** the trigger has `data-state="open"` and no `data-pressed`

#### Scenario: Read-only does not open

- **WHEN** a read-only picker's trigger is activated
- **THEN** the popover stays closed and the trigger keeps focus

### Requirement: Modality

The popover SHALL be non-modal by default: the field stays operable, nothing is made inert, scroll is not locked and Tab follows
`non-modal-tab-order` (content right after the trigger; leaving closes with reason `"outside-focus"`). With `modal` the picker
SHALL use the overlay infrastructure's modal layer (outside inert, scroll locked, Tab wraps, `aria-modal="true"` and `data-modal`
on the content). The prop SHALL never be accepted without effect.

#### Scenario: Field operable while open

- **WHEN** the popover is open and the user types in a segment
- **THEN** the popover stays open and the segment changes

#### Scenario: Modal wraps Tab (zag#2851, ark#3106)

- **WHEN** `modal` is set, the popover is open and focus is on the last tabbable element of the content and Tab is pressed
- **THEN** focus moves to the first tabbable element of the content, and the field is inert

#### Scenario: Tab leaves non-modal content

- **WHEN** focus is on the last tabbable element of the content and Tab is pressed
- **THEN** focus moves to the element after the trigger and the popover closes with reason `"outside-focus"`

### Requirement: Initial Focus And Restore

When the popover opens, focus SHALL move after its first placement to the calendar's tab stop (the selected date, else today
constrained to `minValue`/`maxValue`), in every modality; a consumer `initialFocus` replaces this (`false` skips; a function wins).
When the popover closes by any reason, focus SHALL return to the trigger (or `finalFocus`) if it was inside the content or on `body`, and
SHALL stay where it is if the user moved it to another focusable element or into the field.

#### Scenario: Focus on the selected date

- **WHEN** the value is 14 October 2026 and the popover is opened with the keyboard
- **THEN** the cell of 14 October is focused

#### Scenario: Consumer prevents the focus (bits-ui#2118)

- **WHEN** `initialFocus` returns `false`
- **THEN** focus stays on the trigger

#### Scenario: Escape

- **WHEN** focus is in the calendar and Escape is pressed
- **THEN** the popover closes with reason `"escape-key"` and focus is on the trigger

#### Scenario: Select returns focus to the trigger

- **WHEN** the user picks a date with the keyboard
- **THEN** the popover closes and the trigger is focused with `data-focus-visible`

#### Scenario: Focus in the field stays

- **WHEN** the popover is open and the user clicks a segment, then presses Escape
- **THEN** the popover closes and the segment keeps focus

### Requirement: Dismissal And Nesting

The Control (field, trigger, clear trigger) and the content SHALL count as inside the picker for dismissal and for the Field's
focus accounting: focus or a press within them SHALL NOT close the popover or mark the Field touched, and a press on the field
SHALL NOT dismiss. A picker opened from inside another layer (a Dialog or Drawer) SHALL be that layer's child by the layer
context whatever its DOM position; one user gesture SHALL close at most one layer; selecting a date SHALL never close the host layer;
layers opened from the calendar's header (a Select) are inside.

#### Scenario: Pick a date inside a Dialog (ark#3107, ark#3268, radix#3480)

- **WHEN** a picker whose content is portalled to the end of `body` is open inside a modal Dialog and the user clicks a date
- **THEN** the date is selected, the picker closes and the Dialog stays open

#### Scenario: Touch inside a Drawer (zag#2084)

- **WHEN** the same happens with touch pointer events
- **THEN** the same result

#### Scenario: Scroll outside then tap inside (reka-ui#2891)

- **WHEN** on touch the user scrolls the page starting outside the popover, then taps a date inside it
- **THEN** the date is selected and the popover closes only because of the selection

#### Scenario: Opening does not touch the Field (react-spectrum#3272)

- **WHEN** in a Field with `blur` validation mode the user opens the popover from the keyboard
- **THEN** focus moved into the content and the Field is not touched

### Requirement: Select And Close

Selecting a date in the calendar (press or Enter/Space) SHALL commit it through the commit path and, with `closeOnSelect`
(default `true`), close the popover with reason `"select"`, also when the date equals the current value. The new value SHALL keep the
current value's type, calendar, time of day and zone; with no value it SHALL use `placeholderValue`'s type and time, else a
`CalendarDate` at granularity `day` and a `CalendarDateTime` at 00:00 at granularity `hour`, `minute` or `second`. A picked date
SHALL commit at once; no date SHALL be held aside awaiting a time. Pressing the selected date SHALL NOT deselect it.

#### Scenario: Same date closes (react-spectrum#4750)

- **WHEN** the value is a `ZonedDateTime` on 14 October and the user picks 14 October again
- **THEN** the popover closes and the value is unchanged

#### Scenario: Time kept

- **WHEN** the value is `CalendarDateTime(2026, 10, 14, 9, 30)` and the user picks 20 October
- **THEN** the value is `CalendarDateTime(2026, 10, 20, 9, 30)`

#### Scenario: No value at minute granularity (react-spectrum#6957)

- **WHEN** no value is set, `granularity="minute"`, `closeOnSelect={false}` and the user picks 20 October
- **THEN** the field shows 20 October at 12:00 AM and the value is `CalendarDateTime(2026, 10, 20, 0, 0)`

#### Scenario: Stay open

- **WHEN** `closeOnSelect={false}` and a date is picked
- **THEN** the popover stays open with the picked date selected

### Requirement: Typing While Open

While the popover is open, a committed field value SHALL set the calendar's focused date to the value; a field draft with a known
year and month but no complete date SHALL show that month in the calendar (the focused date's day kept, clamped). A partial or
impossible entry SHALL make the value `null` and deselect the calendar without closing it. Select-all + Backspace in the field
SHALL clear the value and the calendar's selection.

#### Scenario: Month follows the typing

- **WHEN** the popover is open and the user types month 03 and year 2027 without a day
- **THEN** March 2027 is visible in the calendar and nothing is selected

#### Scenario: Clearing the text clears the value (zag#2173, reka-ui#1195)

- **WHEN** the field shows 14 October 2026 and the user selects all and presses Backspace
- **THEN** the value is `null`, the calendar has no selected cell and `onValueChange(null)` was called once

#### Scenario: Reselect after clear (ark#1124)

- **WHEN** the value is cleared and the user picks the previously selected date again
- **THEN** the value is that date

### Requirement: Names And Description

The Control SHALL be a `group` named by the Label and described by the Field's ids and a visually hidden value description
`messages.valueDescription({ formatted })` (default "Selected date: {formatted}", absent when the value is `null`). The embedded
field's `Input` SHALL have `role="presentation"` so no nested group is announced. The trigger SHALL be named by
`messages.trigger` and the Label (`aria-labelledby` its own id and the Label's) and described by the value description. The content
SHALL be a `dialog` named by the trigger name and the Label unless a Title or consumer name is given. No string reaching assistive technology SHALL be
hard-coded outside `messages`.

#### Scenario: Names

- **WHEN** an `en-US` picker labelled "Birthday" is rendered
- **THEN** the group is named "Birthday", the trigger "Choose date Birthday" and, once open, the dialog "Choose date Birthday"

#### Scenario: Value spoken on the trigger

- **WHEN** a date is picked and the popover closes
- **THEN** the focused trigger's accessible description contains "Selected date: Wednesday, October 14, 2026"

#### Scenario: Custom names (reka-ui#2366)

- **WHEN** `messages={{ trigger: "Datum wählen" }}` is set
- **THEN** the trigger is named "Datum wählen Birthday"

### Requirement: Clear

The `ClearTrigger` SHALL clear the value and every partial segment through the commit path (reason `CLEAR`) and focus the
field's first segment, also when the field is partially filled; it SHALL carry `data-empty` when there is no value and no draft and
SHALL be named by `messages.clear`.

#### Scenario: Partial field cleared (react-spectrum#9296)

- **WHEN** only the month is typed and the Clear trigger is pressed
- **THEN** every segment shows its placeholder and the first segment is focused

#### Scenario: Controlled null in every state (react-spectrum#9180)

- **WHEN** the parent sets `value={null}` while the popover is open
- **THEN** field, calendar and hidden input are empty and the popover stays open

### Requirement: Field And Form Participation

The Root SHALL act as a Field when not inside one, or register as one control inside a Field (the Control group as the labelled
element, the first segment as the focus target, the hidden input as the validity element), taking `disabled`, `readOnly`, `required`
and `invalid` from the Field; the embedded field SHALL NOT register. Focus within the Control or the content SHALL be "inside" for
touched and validation timing. The embedded field's validity (incomplete, impossible, out of range, unavailable) SHALL be the control's
own validity on the hidden input, and the effective invalid state SHALL be passed to the calendar. The hidden input SHALL follow the
Date Field's type mapping by value type and granularity, with `name`, `form`, `required`, `disabled`, `autoComplete`.

#### Scenario: Minute granularity submits (reka-ui#2398)

- **WHEN** a picker with `granularity="minute"` holds a `CalendarDateTime` inside a form and the form is submitted
- **THEN** the hidden input is `type="datetime-local"` with `step="60"`, no validation error is raised and the value is submitted

#### Scenario: Required empty

- **WHEN** a required picker is empty and the form is submitted
- **THEN** submission is cancelled and focus is on the first segment

#### Scenario: Invalid reaches the calendar

- **WHEN** the typed date is unavailable and the popover is opened
- **THEN** the calendar root has `data-invalid`

### Requirement: State Kept Until Exit

The calendar's focused date, visible range and view state SHALL be reset only when the popover opens; while the content is
exiting (presence) it SHALL keep the state it had.

#### Scenario: No flash on close (zag#3188)

- **WHEN** the user pages to another month and closes the popover with an exit animation
- **THEN** the exiting content keeps showing that month until it unmounts

### Requirement: Touch

Selecting SHALL act on press release; the popover SHALL unmount only after the press completed so the synthesised click cannot reach
elements beneath; opening with a focused segment SHALL move focus into the content, dismissing the soft keyboard; segments SHALL be
`inputMode="numeric"` text inputs (date-segments); the trigger and cells SHALL be at least 24 × 24 CSS px.

#### Scenario: Soft keyboard dismissed

- **WHEN** on a touch device a segment is focused and the trigger is tapped
- **THEN** focus moves to the calendar and the segment is blurred

### Requirement: Data Attributes

Root, Control, Input and Segment SHALL carry Date Field's attributes; Trigger, Positioner and Content SHALL carry the Popover's
attributes with `data-scope` of the picker (`data-state`, `data-side`, `data-align`, `data-modal`, `data-nested`, `data-close-reason`);
Trigger and ClearTrigger SHALL carry `data-disabled`, `data-pressed` and focus attributes; every part SHALL carry `data-part` and
`data-instance`. `data-variant` and `data-size` SHALL pass through untouched.

#### Scenario: Re-scoped popover parts

- **WHEN** a Date Picker is open
- **THEN** the positioner and content carry `data-scope="date-picker"` and the same `data-instance` as the trigger

### Requirement: Picker Invariants

The contract fragment SHALL ship invariants checked after every model step: field, calendar (when mounted) and hidden input agree on the
value (calendar by date, hidden input by ISO string or `""`); the trigger's `aria-expanded` equals the open state; open content is a `dialog`
with a non-empty name; `onValueChange` was called exactly as often as the value changed; `onOpenChange` exactly as often as the open state
changed by request; after a close, focus is on the trigger or on an element the user moved focus to, never on `body`; no pending date exists.

#### Scenario: Broken variant holds a date aside

- **WHEN** a broken variant keeps a picked date out of the value until a time is typed
- **THEN** the pick step fails naming the "views agree" invariant
