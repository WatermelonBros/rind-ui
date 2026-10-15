## Purpose

Defines rind-ui's Date Picker: a labelled segmented date field with a trigger that opens a calendar popover, composed from Date
Field, Calendar and Popover through `picker-popover`, with a date value of the `@internationalized/date` types. Introduced by
`add-date-picker`.

## ADDED Requirements

### Requirement: Anatomy

The Date Picker SHALL consist of `root`, the Field parts `label`, `description` and `error-message`, `control` (`div`, the group and
popover anchor), `input` (embedded Date Field group), one `segment` part per segment, `trigger` (`button`), `clear-trigger`
(`button`, optional), `positioner`, `content` (`div`, `role="dialog"`), a `calendar` part (a Calendar root bound to the picker, inside
which the Calendar's own parts are rendered), the shared `Portal` (optional) and an automatic hidden input. Every part SHALL accept
element substitution and forward its element's attributes.

#### Scenario: Standalone picker

- **WHEN** a Date Picker labelled "Birthday" is rendered in `en-US`
- **THEN** there is one `group` named "Birthday" containing three spinbuttons named "month Birthday", "day Birthday" and "year
  Birthday" and a button named "Choose date Birthday"

### Requirement: Value And Callbacks

The value SHALL be controllable (`value`, `defaultValue`, `onValueChange(value, details)`) of type `CalendarDate | CalendarDateTime |
ZonedDateTime | null`, keeping the value's type, calendar and zone (`date-values`). `placeholderValue`, `granularity`, `hourCycle`,
`hideTimeZone`, `shouldForceLeadingZeros`, `minValue`, `maxValue`, `isDateUnavailable`, `disabled`, `readOnly`, `required`, `invalid`,
`name`, `form`, `autoComplete` SHALL behave as Date Field's; `open`, `defaultOpen`, `onOpenChange`, `closeOnSelect`, `modal`,
`initialFocus`, `finalFocus`, `positioning` and `persistentElements` as `picker-popover` and Popover define them.

#### Scenario: Type from the placeholder

- **WHEN** no value is set, `placeholderValue={new CalendarDateTime(2026, 1, 1, 9, 0)}` and the user picks 20 October
- **THEN** `onValueChange` receives `CalendarDateTime(2026, 10, 20, 9, 0)`

#### Scenario: Min greater than max (react-spectrum#5208)

- **WHEN** `minValue` is after `maxValue`
- **THEN** a development warning names both props and opening the calendar does not loop

### Requirement: Calendar Binding

The `calendar` part SHALL be the Calendar bound to the picker: its `value`, `focusedValue`, `minValue`, `maxValue`,
`isDateUnavailable`, `disabled`, `readOnly`, `invalid`, locale, time zone and `firstDayOfWeek` SHALL come from the picker, and its
`selectionMode` SHALL be single; view props (`visibleMonths`, `pageBehavior`, `fixedWeeks`, `weekdayFormat`, `messages`) SHALL be the
part's own. The picker's and the Calendar's data props SHALL be one shared props type so none is dropped (react-spectrum#8557).

#### Scenario: First day of week forwarded (react-spectrum#8557)

- **WHEN** `firstDayOfWeek="mon"` is set on the picker
- **THEN** the calendar inside the popover starts its weeks on Monday

#### Scenario: Constraints reach the calendar

- **WHEN** `maxValue` is 31 October 2026 and the popover opens on that month
- **THEN** 1 November cannot be focused or selected and the next-month trigger is `aria-disabled`

### Requirement: Contract

The Date Picker SHALL ship a contract with scope `date-picker`, located by role `group` and exact accessible name, with: actions
`open()`, `openFromField()`, `close()`, `selectDate(date)`, `fill(date)`, `clear()`, `pressOutside()`, `tab()`, `shiftTab()`; queries
`value()` (the hidden input's value), `isOpen()`, `isModal()`, `closeReason()`, `focusedElement()`, `isInvalid()`, `validity()`, and
`calendar()` and `field()` returning the Calendar and Date Field drivers scoped to the picker; states `closed`, `open` observed through
`data-state` on the trigger; events mapped to those actions with `FIELD.DRAFT` `skip` ("covered by fill"); prop steps `$sync:value`,
`$sync:open`, `$props:disabled`; traits `form-associated`, `field-associated`, `layer`, `restores-focus`, `presence`, `anchored`,
`modal` when the prop is set, plus the picker invariants.

#### Scenario: Same test in both environments

- **WHEN** `getDatePicker(screen, { name: "Departure" }).selectDate("2026-11-03")` runs in jsdom and with a Playwright `page`
- **THEN** both resolve with `value()` equal to "2026-11-03" and the popover closed

### Requirement: Theme

`@rind-ui/theme` SHALL style the Date Picker in `date-picker.css`: the control, input and segments as family `field` (`outline`
default, `soft`; `sm`/`md`/`lg`) through `--rind-date-picker-*` tokens with semantic fallbacks; the trigger as a ghost control with the
`calendar` icon drawn on the part when it has no children; the content as family `panel` with entry and exit transitions honouring reduced
motion; focus, placeholder, invalid (`data-tone="danger"`) and forced-colors rules; a trigger and cells of at least 24 × 24 px.

#### Scenario: Forced colors

- **WHEN** an open, invalid Date Picker is rendered under forced colors
- **THEN** the control boundary, the trigger icon, the content boundary and the selected cell are visible

#### Scenario: Icon replaced

- **WHEN** the consumer renders children inside the trigger
- **THEN** the children are shown and no masked icon is drawn
