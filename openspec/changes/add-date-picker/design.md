## Context

[date-picker.md](../../../docs/research/date-picker.md) holds the comparison and the bug history. The Date Picker
composes components that are specified elsewhere and does not re-specify them:

| Change | What the picker uses |
|---|---|
| `add-date-field` | an **embedded** Date Field (segments, typing, commit points, validity, hidden input type mapping) — requests below |
| `add-calendar` | `calendar` bound to the picker (selection, focused date, visible range, names, keyboard, announcements), `date-values`, `calendar-navigation` |
| `add-popover` | the Popover machine as a controlled child (`open`, close reasons, `non-modal-tab-order`, `initialFocus`, `persistentElements`, positioning, presence, `modal`) |
| `add-overlay-infrastructure` | layer stack and logical parents, dismissal (one request per gesture), focus containment and restore, outside inert, presence, portal — used through Popover, never edited here |
| `add-field`, `add-text-field`, `add-checkbox` | `field-control` (one control), `field-validation` (control validity message), Root-as-Field, `hidden-form-input` |
| `add-button` | `button-like-element` for the triggers |
| `openspec/specs` (archived foundations) | machine runtime (`controllable`, `$sync`, effects), contracts, drivers, `testMachine`, `press-interactions`, `interaction-modality`, `keyboard-interactions` (Alt-combinations are not value keys, so they bubble), `announcer`, `i18n-messages`, `element-ids`, `hidden-content` |

## Goals / Non-Goals

**Goals:** one coordinator owning the value, open state and focused date; the shell reusable by the Date Range
Picker; every close path restores focus and none commits more than the user chose.

**Non-Goals:** opening on focus, time UI in the popover, drill-down views (proposal).

## Decisions

### 1. Layout

```
packages/core/src/components/picker-popover/
├─ picker.machine.ts       coordinator (below), generic over the value shape (single date | range) via an adapter
├─ picker.value.ts         pure: toEmittedSingle(date, current, placeholder, granularity), followDraft(draft, focused)
├─ picker.connect.ts       Control/Trigger/ClearTrigger/Content naming, value description, focus bridge, hidden-input wiring
├─ picker.contract.ts      contract fragment + pickerInvariants
└─ picker.messages.ts      trigger ("Choose date"), calendarDialog, clear ("Clear"), valueDescription
packages/core/src/components/date-picker/
├─ date-picker.props.ts    props → embedded Date Field props, Popover props, Calendar props (single shared props type)
└─ date-picker.contract.ts
packages/react/src/date-picker/   Root, Label, Description, ErrorMessage, Control, Input, Segment, Trigger, ClearTrigger,
                                  Portal, Positioner, Content, Calendar
packages/theme/src/date-picker.css
```

### 2. Machine

The Root creates the picker coordinator and renders the three children as ordinary services it drives
(as the Menubar drives its menus): the embedded Date Field (`value` controlled by the picker), a Popover (`open`
controlled by the picker) and a Calendar (`value`, `focusedValue` controlled). Their callbacks are events to the
coordinator.

```ts
type PickerEvent =
  | { type: "TRIGGER.PRESS"; modality: Modality }
  | { type: "OPEN"; modality: Modality }                                   // Alt+ArrowDown/Up on the Control, api
  | { type: "CLOSE"; reason: "trigger" | "select" | "escape-key" | "outside-press" | "outside-focus" | "parent-dismissed" | "api" }
  | { type: "FIELD.CHANGE"; value: DateValue | null; details: ChangeDetails }
  | { type: "FIELD.DRAFT"; year: number | null; month: number | null; day: number | null }
  | { type: "CALENDAR.SELECT"; date: DateValue; modality: Modality }
  | { type: "CLEAR.PRESS" } | { type: "RESET" } | { type: "INPUT.ADOPT"; value: string }
  // props: $sync:value | $sync:open | $sync:focusedValue | $props:minValue|maxValue|isDateUnavailable|disabled|readOnly|granularity|…

states:
  closed ── TRIGGER.PRESS | OPEN [!disabled, !readOnly] ──► open / recordModality, resetFocusedToValueOrToday
  open   ── TRIGGER.PRESS ──► closed / reason "trigger"
         ── CLOSE ──► closed / reason
         ── CALENDAR.SELECT / commit(date), [closeOnSelect] CLOSE "select"
  global FIELD.CHANGE / setValue, followValue · FIELD.DRAFT [open] / followDraft
         CLEAR.PRESS / clearValueAndDrafts, focusFirstSegment · RESET / restoreDefault · INPUT.ADOPT / adopt
values: value: controllable (DateValue | null, equal by compare); open: controllable; focusedValue: controllable
effects: popover (child service wiring: open ↔ open, onOpenChange(false, reason) → CLOSE), focusInitial (Calendar tab stop
         after first placement), controlValidity, announcePrepared
```

- **One commit path**: `setValue` is the only writer; field commits, calendar selections, clear, reset and adoption all pass through
  it with `details.reason` `FIELD`, `CALENDAR`, `CLEAR`, `RESET`, `ADOPT`, so `onValueChange` runs once per change and can
  `cancel()`.
- **Select**: `commit(date)` = `toEmittedSingle(date, value, placeholderValue, granularity)` (keeps the value's time and zone; no
  value: placeholder's time, else 00:00; a `CalendarDateTime` when granularity ≥ hour). Close happens on the selection event, whether
  or not the value changed (react-spectrum#4750). Focus restore is the Popover's (trigger).
- **Follow**: on value change the Calendar's `focusedValue` becomes the value; on `FIELD.DRAFT` with a known year and month while
  open, the focused date moves to that month (day kept, clamped) — the visible month follows what is typed.
- **Initial focus**: the Popover's `initialFocus` is `() => focusTabStop(content)` (the roving tab-stop cell of the bound Calendar);
  a consumer `initialFocus` replaces it (`false` skips).
- **State kept until exit**: the Calendar and the focused date are reset on opening, never on closing, so the exiting content does not
  flash another state (zag#3188).

### 3. Connect

| Part | Attributes / handlers |
|---|---|
| Root | Field host, `dir`, `lang`, `data-*` |
| Control | `role="group"`, `aria-labelledby` Label, `aria-describedby` = Field ids + value description node, Popover Anchor (positioning + counts as inside), `onKeyDown` bubble handler: Alt+ArrowDown/Up → `OPEN` when not `defaultPrevented` |
| Input / Segment | embedded Date Field's, `Input` `role="presentation"` |
| Trigger | `button-like-element`; Popover trigger props re-scoped (`aria-haspopup="dialog"`, `aria-expanded`, `aria-controls` while mounted); name `aria-labelledby="<self> <label>"` with `aria-label` `messages.trigger`; `aria-describedby` value description; `aria-disabled` (focusable) when `readOnly`; `data-state`, `data-pressed` only while pressed |
| ClearTrigger | button, name `messages.clear`; press → `CLEAR.PRESS`; `data-empty` when no value and no draft |
| Positioner / Content | Popover's props re-scoped; `role="dialog"`, `aria-labelledby="<trigger> <label>"` unless a Title/consumer name is given; no `aria-modal` unless `modal` |
| Calendar | Calendar Root props with `value`, `focusedValue`, `minValue`, `maxValue`, `isDateUnavailable`, `disabled`, `readOnly`, `invalid`, `locale`, `timeZone`, `firstDayOfWeek` from the picker; `onValueChange` → `CALENDAR.SELECT` |
| hidden input | `hidden-form-input` owned by the Root (Date Field's type mapping), validity element |

### 4. Contract and model-based tests

`datePickerContract` locates by role `group` + name. Actions: `open()` (pointer: press the trigger; keyboard: focus it, Enter;
`openFromField()`: Alt+ArrowDown on a segment), `close()` (Escape), `selectDate(date)` (opens when closed, then the Calendar
contract's `select`), `fill(date)` (the field's), `clear()`, `pressOutside()`, `tab()`, `shiftTab()`; queries `value()`,
`isOpen()`, `isModal()`, `closeReason()`, `focusedElement()`, `calendar()` and `field()` (their drivers, scoped). Traits
`form-associated`, `field-associated`, `layer`, `restores-focus`, `presence`, `anchored`, `modal` (prop). Configurations: `en-US`
day; `en-GB` day; minute granularity with and without a value; `ZonedDateTime`; `modal` true; inside a Dialog; `visibleMonths=2`
(calendar prop); `ar-EG` RTL; required in a form with reset; read-only; disabled by prop step; touch preset.

### 5. Theme

`date-picker.css`, family `field` for the Control/Input/Segment (Date Field's tokens as fallbacks through
`--rind-date-picker-*`), the trigger on the `toggle item` ghost look with the `calendar` icon via `mask-image:
var(--rind-icon-calendar)` on the Trigger (children replace it), the Content as `panel` (`--rind-date-picker-content-*`
defaulting to the popover tokens), `@starting-style` entry and `[data-state=closed]` exit, small screens: Content max-height from
`--rind-available-height`, forced-colors rules, `data-tone="danger"`.

## Requests to other changes

- **add-date-field** — APPLIED (coordinator, 2026-10-15) — embedded mode, boundary events with layout scope, draft hint (see add-date-range-field design §Requests; the
  picker uses embedded mode and the draft hint).
- **add-popover** (`popover` connect) — APPLIED (coordinator, 2026-10-15): accept a `scope` option so composites render the Popover's trigger, positioner and content
  props with their own `data-scope` (`date-picker`, `date-range-picker`), and document that `open` may be controlled by a parent
  coordinator. `Anchor` as an inside element for dismissal is already specified.
- **add-theme-system** (`theme-variants`) — APPLIED (coordinator, 2026-10-15): list Date Picker and Date Range Picker in family `field` (control) and their Content in
  family `panel`.
- **add-calendar** — none required; optional `autoFocus` would replace the picker's DOM tab-stop lookup.
- **add-overlay-infrastructure** — none (this change relies on its logical-parent rule and one-close-per-gesture rule as written).

## Risks / Trade-offs

- [Non-modal default differs from APG's modal dialog] → typing while open and a usable field need non-modal; `modal` is real;
  the docs recommend it on small screens; device pass on iOS VoiceOver for portalled non-modal content (Popover's open question).
- [Three child services driven by one coordinator] → every child callback is an event, so the model-based tests cover the
  interleavings (field edit while open, select while a draft exists).
- [Focus restore to the trigger, not the field] → APG and React Aria; keyboard users Tab onward from the trigger.

## Open Questions

- `openOnFocus` and a time field inside the popover — later, additive.
