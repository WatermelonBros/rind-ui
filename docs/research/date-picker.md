# Date Picker — research

Status: done · Wave: 3 (React Aria `DatePicker`, Ark/Zag `DatePicker`, Reka UI `DatePicker`, Bits UI `DatePicker`)

A Date Picker = a [Date Field](date-field.md) + a trigger + a [Calendar](calendar.md) in a
[popover](popover.md). Nothing here re-decides those; this note decides how they are composed:
who owns the value, the popover's modality and focus, selecting and closing, typing while the
calendar is open, touch behaviour, form and validation. The same shell serves the
[Date Range Picker](date-range-picker.md), so the shared part is decided here once
(`picker-popover`).

Cross-cutting: [accessibility.md](accessibility.md) §2, §4, §7; [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
§1.4 "Dialog" and "Date fields / calendar", causes A, C, D, E, J, L (Safari 26 VO silent
dialogs: RA#10641); [native-platform.md](native-platform.md) §8;
[overlay-infrastructure.md](overlay-infrastructure.md), [floating-positioning.md](floating-positioning.md),
[field.md](field.md), [form.md](form.md).

## Pattern

- WAI-ARIA APG [Date Picker Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/):
  a text input with a "Choose Date" button; the button opens a **modal dialog** holding the calendar
  grid; focus moves to the selected date (else today); Escape closes and returns focus to the
  button; selecting a date closes the dialog, writes the value and returns focus to the button;
  Prev/Next month/year buttons and a grid with the Calendar's keys. APG's input is a plain text
  field, and the dialog is modal.
- Roles: button `aria-haspopup="dialog"`, `aria-expanded`; `role="dialog"` named (APG:
  "Choose Date"); the grid per Calendar. Native `<input type=date>` opens Alt+ArrowDown
  (RA#3118 notes the precedent: the picker opens from the field with Alt+ArrowDown/Up while the
  button also stays a tab stop).
- WCAG 2.1.1, 2.4.3 (the calendar follows the trigger in the Tab sequence), 2.4.7, 3.2.1 (focus
  alone never opens), 3.3.1/3.3.3, 4.1.2, 4.1.3.

## How the others built it

### React Aria (`react-aria/src/datepicker/useDatePicker.ts`, `useDatePickerGroup.ts`, `react-stately/src/datepicker/useDatePickerState.ts`, RAC `DatePicker.tsx`)

- Parts: `DatePicker` (a `group`), `Label`, `Group`, `DateInput`/`DateSegment`, `Button` (the trigger),
  `Popover`, `Dialog`, `Calendar`, `Text slot=description|errorMessage`, `FieldError`.
- **Value** controllable `DateValue | null`; `useOverlayTriggerState` for `isOpen`. `setValue`, `setDateValue`
  (Calendar), `setTimeValue`. With a time granularity the date picked in the calendar is held
  as `selectedDate` until a time exists, then committed together — or committed with a placeholder
  time when the popover closes (`shouldCloseOnSelect`, default `true`). Issues: RA#6957/#7688
  (`shouldCloseOnSelect=false` + minute granularity: the field never fills, because the placeholder time
  is only applied when the popover would close), RA#4750 (a ZonedDateTime picker does not close on
  re-selecting the selected date because closing hangs off `onChange`).
- **Group + button**: the field's own group is `role=presentation`; the outer group is named by the
  label; the button has `aria-label` "Calendar" **and** `aria-labelledby="<button> <label>"`,
  `aria-haspopup="dialog"`, `aria-expanded`, `aria-describedby` = the value description ("Selected Date: …");
  the dialog is `aria-labelledby` the same pair. `Alt+ArrowDown/Up` on the group opens (`useKeyboard`
  shortcuts). Arrow Left/Right move across segments and the button (RTL by position).
- **Validation**: the picker owns the validation state and hands it to the field
  (`privateValidationStateProp`); the calendar receives `isInvalid` and the error text.
- Popover: modal by default with an underlay; `ariaHideOutside`; `FocusScope` contain + restore;
  Escape through `useOverlay`. `Calendar` gets `autoFocus` and `defaultFocusedValue`
  (placeholder when no value).
- Problems: RA#3118 (calendar button had `tabindex=-1`: keyboard users could not open it),
  RA#3164/#7325/#10672 (clicking near or below a `contenteditable` segment focuses it; fixed by
  `user-select: none` on the group), RA#9296 (the Clear button cannot clear a partially filled field:
  the date is `null` already), RA#4142 (a partial entry and an empty field are both `null`),
  RA#8339 (the trigger keeps `data-pressed` while the popover is open), RA#3272 (`onBlur`/`onFocus` never
  fired: focus moves into the popover), RA#5208 (two pickers constraining each other with min > max
  loop forever), RA#10641 (Safari 26 + VoiceOver: dialog silent; Safari bug), RA#7006 (open on field focus
  requested; the maintainers' own comment: focus would need to stay in the segment, so non-modal).

### Ark UI / Zag (`machines/date-picker/src/date-picker.machine.ts`, `date-picker.connect.ts`)

- One machine `idle` / `focused` / `open` with `inline`; **a text `<input>` per value** (`format`/`parse`,
  `fixOnBlur`), `Trigger`, `ClearTrigger`, `Content` (popover via `trackDismissableElement` with the
  inputs and trigger excluded), `PositionerEl`, view switching (`day`/`month`/`year`). `closeOnSelect`
  default `true`; `modal` accepted by Ark but **never implemented in Zag** (ARK#3106; ZG#2851 "trap focus"
  closed as by design — "implement a focus trap yourself").
- Escape → `focusTriggerElement`; outside press → trigger if the press was not on a focusable element,
  else leave focus. `CELL.CLICK` selects, closes, focuses the *input* (not the trigger).
- Problems: ZG#3186 (blur path skips range normalization and accepts unavailable dates), ZG#3188 (day view
  flashes when closing from month/year view: view reset on exit), ZG#2173/ARK#2173 (clearing the text does
  not clear the value), ARK#1124 (cannot re-select a date after clearing), ARK#3112 (a custom `format`
  re-parsed on blur changes the date), ARK#2509 (range: hovering quickly closed the content), ARK#3107 / #3268 /
  ZG#2084 (picking a date inside a Dialog/Drawer, with the picker portalled outside it, closes the dialog,
  on touch and in Safari), ARK#2265 (outside press did not close with `lazyMount` + `unmountOnExit`).

### Reka UI (`DatePicker/DatePickerRoot.vue`, `DatePickerField.vue`, `DatePickerCalendar.vue`, `DatePickerContent.vue`)

- Radix `Popover` + `DateField` + `Calendar` glued by a context: `Root` (Popover root, `modal` default
  `false`, `closeOnSelect` default **false**), `Field`, `Input`, `Trigger` (`PopoverTrigger`), `Content`
  (handles `openAutoFocus`: focuses `[data-selected]`, else `[data-today]`, else the first enabled day),
  `Calendar`, `Anchor`, `Close`. The model and a `placeholder` (focused date) are shared; `onDateChange`
  deselects when the same date is pressed again (unless `preventDeselect`).
- Problems: RK#736 (editing the field did not update the calendar; fixed), RK#1195 (deleting the year
  digits left the model stuck at 0002), RK#1618 (selecting the same date twice threw), RK#2398 (hidden
  `type=date` input with a full ISO date-time string blocked form submission at minute granularity),
  RK#2075 (no auto-close; added as `closeOnSelect`), RK#2891 (touch scroll outside then tap inside dismissed:
  stale deferred click listener in the dismiss layer), RK#2416 (ignored the global locale), RK#2366 (hard-coded
  segment labels), RK#1851/#2144 (portal not optional).

### Bits UI (`bits/date-picker/date-picker.svelte.ts`)

- Same as Reka (Melt heritage): `Root`, `Input`, `Segment`, `Trigger`, `Content`, `Calendar` parts, `closeOnDateSelect`
  (default true). Problems: BITS#2118 (the consumer's `onOpenAutoFocus` cannot prevent the picker's own
  focus: callbacks merged with `executeCallbacks`, ignoring `defaultPrevented`), BITS#2169 / #650 / #974
  (`open` not bindable or `onOpenChange` not called for programmatic changes), BITS#604 (portal option ignored),
  BITS#1678 (months skipped when paging).

### Kobalte, Base UI, Radix, Headless UI, Ariakit

None ship a date picker (KB#306 open, BU#1709 open "Calendar and Date Fields primitives", RX#1503
closed as a request). Radix users report that any calendar inside a Radix Dialog closes it
(RX#3480, closed as a duplicate of the dialog/popover nesting issues): the same nesting bug as ARK#3107.

## Accessibility

- **Dialog, not a combobox popup.** The calendar is a `role=dialog` (APG), non-modal by default in
  rind-ui (below). The trigger carries `aria-haspopup="dialog"`, `aria-expanded`; `aria-controls`
  only while mounted (Popover).
- **Names.** Trigger: `messages.trigger` ("Choose date") + the Label, via `aria-labelledby` ("Choose date
  Birthday"), as RA. The dialog is named by the same pair. The `Control` group is named by the Label and
  described by the Field's ids + the value description; the embedded Date Field's own group is
  `role=presentation` (RA) so no nested groups. Segment names are Date Field's.
- **Focus.** Open: focus enters the dialog on the Calendar's tab stop (selected date, else today clamped
  to min/max) after first placement. Select or Escape: closes, focus on the trigger (APG, RA). Zag returns
  to the input; the trigger is better for keyboard users who then Tab on (the input is *before* it).
  Tab in a non-modal dialog follows the popover's logical order (after the trigger); in `modal` it wraps.
- **Typing while open** (non-modal): segments stay operable; a committed value moves the Calendar's
  focused date; a typed month+year (day not yet typed) also moves the visible month, so what the user
  types is what the calendar shows (Zag `focusParsedDate`, RK#736).
- **Announcements.** No component live region. Selecting closes and focuses the trigger, whose description
  carries "Selected date: …" (RA); month paging announcements are the Calendar's.
- **AT regressions**: Safari 26 VoiceOver does not follow `focus()` into a newly added dialog
  (RA#10641, webkit 311125, fixed in 27): tier-1 manual pass; no workaround in code.
- **Touch**: the segments are text inputs (`inputMode=numeric`) so tapping the field raises the
  keyboard; tapping the trigger while a segment is focused moves focus into the dialog, which dismisses
  the soft keyboard on iOS and Android. Select acts on press release; the dialog unmounts after the
  press completes so the synthesized click cannot land on what is beneath.
- **Forced colours, target size, reduced motion**: Calendar's and Date Field's; the trigger ≥ 24×24
  with a visible boundary.
- **Native primitive**: `<input type=date>` cannot be embedded, constrained per date or localised
  by the app; we use a hidden typed input for form/validity only (Date Field).

## Bug history

Searched (2026-10-14) adobe/react-spectrum (DatePicker, DateRangePicker, focus, keyboard, Escape,
shouldCloseOnSelect, dialog, time granularity, mobile), chakra-ui/zag and ark (date picker; ~120 hits),
unovue/reka-ui and huntabyte/bits-ui (DatePicker, DateRangePicker, close/focus/popover/form), kobalte,
base-ui, radix. About 480 hits; 45 read in full. Range-specific entries are in
[date-range-picker.md](date-range-picker.md); field-level ones in [date-field.md](date-field.md).

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| RA | [#3118](https://github.com/adobe/react-spectrum/issues/3118) | the calendar button cannot be reached by keyboard | `tabindex=-1` on the button; Alt+ArrowDown was the only way | closed | the trigger is a normal tab stop **and** Alt+ArrowDown/Up opens from the field; scenarios |
| RA | [#3164](https://github.com/adobe/react-spectrum/issues/3164) | clicking outside the picker focuses a segment | Chrome focuses a `contenteditable` near the click; `user-select: none` on the parent | open | segments are native inputs (date-segments); a press outside the group never moves focus into it; scenario |
| RA | [#8339](https://github.com/adobe/react-spectrum/issues/8339) | trigger keeps `data-pressed` while the popover is open | press state tied to the open state | open | `data-pressed` only during a press; `data-state="open"` styles the open trigger; scenario |
| RA | [#9296](https://github.com/adobe/react-spectrum/issues/9296) | Clear does not clear a partially filled field | clearing sets the value to `null`, already `null` | open (awaiting PartialDate) | `ClearTrigger` clears drafts too (Date Field `CLEAR_ALL`) and focuses the first segment; scenario |
| RA | [#4142](https://github.com/adobe/react-spectrum/issues/4142) | cannot tell a partially cleared date from an empty one | both `null` | open | `data-placeholder-shown` / `data-complete` on the root and `isComplete()`; the partial entry is `badInput` |
| RA | [#3272](https://github.com/adobe/react-spectrum/issues/3272) | `onBlur` / `onFocus` / `onFocusChange` never fire | not stated in the issue (likely focus moving into the popover) | closed | focus inside the Control **or** the Content counts as inside the picker; opening the popover does not mark the Field touched; scenario |
| RA | [#6957](https://github.com/adobe/react-spectrum/issues/6957) | with `shouldCloseOnSelect=false` and minute granularity the field stays empty after picking a date | the date waits in `selectedDate` for a time; placeholder time applied only on close | closed | a picked date always commits immediately (time from the value, else `placeholderValue`, else 00:00); no pending-date state; scenario |
| RA | [#4750](https://github.com/adobe/react-spectrum/issues/4750) | picking the already selected date with a `ZonedDateTime` does not close the popover | closing hangs off the value's `onChange`, which does not fire for an equal value | open | close on the *selection event*, not on a value change; scenario with an equal value |
| RA | [#5208](https://github.com/adobe/react-spectrum/issues/5208) | two pickers constraining each other via min/max loop forever | `minValue > maxValue` made the focused date oscillate | closed (invalid input) | `minValue > maxValue` is a development warning and the machine's constraint step terminates; scenario |
| RA | [#10641](https://github.com/adobe/react-spectrum/issues/10641) | Safari 26 + VO: dialog not announced after opening | Safari did not follow `focus()` into new content; fixed in Safari 27 | closed (external) | manual tier-1 check, dated entry in the AT matrix; no code workaround |
| RA | [#7006](https://github.com/adobe/react-spectrum/issues/7006) | open the calendar when a segment gains focus | request; maintainers: focus must stay in the segment, hence non-modal | open | non-goal (`openOnFocus`); the non-modal design keeps it possible later without a break |
| ZG | [#3186](https://github.com/chakra-ui/zag/issues/3186) | blur path skips normalization and accepts unavailable dates | two commit paths | closed | one commit path for field, calendar, clear and reset |
| ZG | [#3188](https://github.com/chakra-ui/zag/issues/3188) | day view flashes on close from month/year view | not stated | closed | the content keeps its state until exit completes (presence); reset on open only |
| ZG | [#2851](https://github.com/chakra-ui/zag/issues/2851) / ARK [#3106](https://github.com/chakra-ui/ark/issues/3106) | focus escapes the open calendar; `modal` prop did nothing | not implemented; "implement a trap yourself" | closed (by design / prop removed) | `modal` is real (overlay infrastructure: inert, scroll lock, Tab wrap) and tested; a prop that cannot work is not shipped |
| ZG | [#2173](https://github.com/chakra-ui/zag/issues/2173) | clearing the input text does not clear the value | not stated (zag fix with an e2e test) | closed | select-all + Backspace clears every segment and the value becomes `null`; the calendar deselects; scenario |
| ARK | [#1124](https://github.com/chakra-ui/ark/issues/1124) | after Clear the same date cannot be selected again | not stated (zag-js fix) | closed | after clearing, selecting the previous date works; scenario |
| ARK | [#3112](https://github.com/chakra-ui/ark/issues/3112) | custom `format` re-parsed on blur changes the date | text round trip | closed (`fixOnBlur=false`) | no text parse: segments hold numbers; nothing re-derives the value on blur; test with a long-format locale |
| ARK | [#2509](https://github.com/chakra-ui/ark/issues/2509) | range: moving the pointer quickly closes the content | hover event treated as a selection/close | closed | hover never commits or closes (Range Calendar); scenario in the range picker |
| ARK | [#3107](https://github.com/chakra-ui/ark/issues/3107) / [#3268](https://github.com/chakra-ui/ark/issues/3268) / ZG [#2084](https://github.com/chakra-ui/zag/issues/2084) | picking a date inside a Dialog/Drawer closes the dialog (touch, Safari) | picker content portalled outside the dialog counts as an outside press | closed (advice: portal into the dialog) | the popover is a child layer of the dialog by layer context, whatever the DOM position (Popover "Nesting"); touch scenario |
| RX | [#3480](https://github.com/radix-ui/primitives/issues/3480) | a calendar inside a Radix Dialog closes it on click | `pointer-events: none` / outside detection | closed (dupe) | same scenario, mouse |
| ARK | [#2265](https://github.com/chakra-ui/ark/issues/2265) | outside press does not close with `lazyMount` + `unmountOnExit` | not stated; fixed upstream in a zag commit | closed | dismiss registration belongs to the layer on open, not to content mount (overlay-infrastructure); scenario with `keepMounted` false |
| RK | [#736](https://github.com/unovue/reka-ui/issues/736) | editing the field does not update the calendar, and picking resets it | two models | closed | one value owned by the picker, passed to both; scenario both directions |
| RK | [#1195](https://github.com/unovue/reka-ui/issues/1195) | deleting the year digits leaves the model at 0002 | incomplete segment kept the last valid date | closed | a partial entry makes the value `null` (commit points), calendar deselects |
| RK | [#1618](https://github.com/unovue/reka-ui/issues/1618) | selecting the same date twice throws | deselect path | closed | re-selecting keeps the value and closes; no deselect |
| RK | [#2398](https://github.com/unovue/reka-ui/issues/2398) | the form cannot be submitted at minute granularity | hidden `type=date` given an ISO date-time string | closed | hidden input type by value type and granularity (Date Field); scenario at minute granularity |
| RK | [#2075](https://github.com/unovue/reka-ui/issues/2075) | no way to close on selection | Reka default stays open | closed (`closeOnSelect` added) | `closeOnSelect` default true (APG, RA, Zag, Bits) |
| RK | [#2891](https://github.com/unovue/reka-ui/issues/2891) | after a cancelled touch outside, the next tap inside dismisses | stale deferred click listener | closed | overlay-infrastructure rule; touch scenario in the picker: scroll outside, tap a date |
| RK | [#2416](https://github.com/unovue/reka-ui/issues/2416) / [#2366](https://github.com/unovue/reka-ui/issues/2366) | ignores the global locale; labels hard-coded | locale and strings outside the provider | closed | locale from the i18n provider; trigger/dialog names through `messages` |
| BITS | [#2118](https://github.com/huntabyte/bits-ui/issues/2118) | the consumer cannot prevent the picker's initial focus | callbacks merged ignoring `defaultPrevented` | open | one `initialFocus` prop whose `false` skips and whose function wins; scenario |
| BITS | [#2169](https://github.com/huntabyte/bits-ui/issues/2169) / [#650](https://github.com/huntabyte/bits-ui/issues/650) | `onOpenChange` not called for programmatic opens / missing | callback in the setter half of a bindable | open / closed | controlled `open` follows the Popover rule: requests call `onOpenChange`, programmatic changes do not; scenario |
| BITS | [#604](https://github.com/huntabyte/bits-ui/issues/604) / RK [#1851](https://github.com/unovue/reka-ui/issues/1851) | portal option ignored / not optional | wrapper forced a portal | closed / open | the portal is optional (Popover), behaviour identical |

## Known pitfalls

- **Dialog nesting**: three libraries closed the host dialog when a date was picked (ARK#3107,
  ARK#3268, RX#3480). Parent layer comes from the layer context, never from DOM position.
- **Two value owners** (RK#736, ARK#2173): one value, three views (field, calendar, hidden input).
- **Pending state for time granularity** (RA#6957, RA#4750): never hold a date aside.
- **Text round trips** (ARK#3112, RK#1195): no parse of displayed text; segments are the source.
- **Focus accounting**: focus moving into the popover is not "leaving" (RA#3272); Escape and select
  return to the trigger; a focus ring only for keyboard (RA#8339-style pressed state aside).
- **Hidden input type vs granularity** (RK#2398).
- **Safari 26 VoiceOver** silent dialogs (RA#10641): an AT regression, not ours.

## Testing notes

- Node: the picker coordinator (value, open, focusedValue, close reasons, `closeOnSelect`, draft hints,
  clear/reset) with a fake clock; Calendar and Date Field machines are the real ones.
- Browser: open by trigger press, Enter/Space, Alt+ArrowDown from a segment; focus into the grid and
  back; Escape; outside press; Tab forward/backward from the content; select inside a Dialog on mouse and
  touch emulation; typing while open; `modal` true; shadow root; form submit/reset; `lazy` mount.
- Driver: `open()`, `close()`, `selectDate(date)`, `fill(date)`, `clear()`, `calendar()`, `field()`;
  queries `value()`, `isOpen()`, `closeReason()`, `focusedElement()`.
- AT matrix (manual): VO macOS/iOS Safari 26 and 27, NVDA + Chrome/Firefox, JAWS, TalkBack.

## Decisions

- **Composition** (design): `DatePicker.Root` is a Field host and a small coordinator machine owning
  `value`, `open` and `focusedValue`; it renders an embedded Date Field, a controlled Popover and a bound
  Calendar. `picker-popover` (this change) is the shared shell used by Date Range Picker.
- **Parts**: `Root`, `Label`, `Description`, `ErrorMessage`, `Control` (group, Popover anchor),
  `Input` (embedded Date Field group, `role=presentation`), `Segment`, `Trigger`, `ClearTrigger`,
  `Positioner`, `Content`, `Calendar` (a Calendar `Root` bound to the picker; Calendar's other parts are
  used inside it), `Portal`, hidden input.
- **Machine**: states `closed` / `open`; events `TRIGGER.PRESS`, `OPEN`, `CLOSE {reason}`,
  `FIELD.CHANGE`, `FIELD.DRAFT`, `CALENDAR.SELECT`, `CLEAR.PRESS`, `$sync:value|open|focusedValue`,
  prop steps. Close reasons: Popover's plus `"select"`.
- **Modal**: `modal` false by default (Popover default; the field stays operable while open, which is what
  typing-while-open needs); `true` = the overlay infrastructure's modal layer. Recommended for small
  screens in the docs. Not APG's "modal dialog" default — recorded as the main deliberate difference.
- **Select** closes by default (`closeOnSelect`), commits first, keeps the value's time else
  `placeholderValue` time else 00:00; granularity ≥ hour with no value/placeholder emits a
  `CalendarDateTime`.
- **Focus**: initial focus = the Calendar's tab stop; restore to the trigger (Popover rule); focus-within
  the Control or Content is "inside" (Field touched/blur).
- **Form/validation**: one hidden input (Date Field's mapping) owned by the Root; the embedded field
  reports validity to the Root; invalid is passed to the Calendar.
- **`data-*` / contract**: Date Field's on Control/Input/Segment, Popover's on Trigger/Positioner/Content
  (re-scoped `date-picker`), `data-state` on Trigger/Content, `data-empty` on ClearTrigger.
- **Deliberately different**: non-modal default, trigger-and-Alt+Down both open, one commit path, no text
  parse, focus restore to the trigger, no pending date for time granularity, `ClearTrigger` clears
  drafts.

## Open questions

- `openOnFocus` / `calendarTrigger` (RA#7006): later, non-modal makes it feasible.
- A time field inside the popover (React Spectrum) — the segments of the field edit the time.
- Month/year drill-down in the Calendar header: the Month/Year Picker change's recipe.
