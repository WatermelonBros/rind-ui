## Context

[date-range-picker.md](../../../docs/research/date-range-picker.md) holds the comparison and bug history. The picker composes, and
does not re-specify:

| Change | What it uses |
|---|---|
| `add-date-picker` | `picker-popover`: coordinator machine, one commit path, open state and reasons, opening, modality, initial focus and restore, dismissal and nesting, names, clear, Field and form, state kept until exit, invariants |
| `add-date-range-field` | `paired-fields` as the embedded input: derived range value, ends never edit each other, range validity, focus between ends, two hidden inputs |
| `add-range-calendar` | `range-calendar` bound to the picker: anchor, preview, commit, Escape and leave rules (`commitOnBlur: "reset"`), drag, unavailable inside ranges, prompts and announcements |
| `add-popover`, `add-overlay-infrastructure` | the controlled Popover and the layer rules, unchanged |
| the rest | as Date Picker |

## Goals / Non-Goals

**Goals:** a range adapter for the picker coordinator, nothing else new; every leave path resets and never commits; resume works.

**Non-Goals:** resize, presets, provisional start (proposal).

## Decisions

### 1. Layout

```
packages/core/src/components/date-range-picker/
├─ date-range-picker.adapter.ts   the value adapter for picker.machine: toEmittedRange(range, current, placeholder, granularity)
│                                  (per end: keep time and zone, else placeholder time), equal by compare of both ends,
│                                  resumeAnchor(value draft) → start | null
├─ date-range-picker.props.ts     props → paired-fields, Popover, Range Calendar (one shared props type)
├─ date-range-picker.connect.ts   names ("Choose dates"), Range Calendar binding, two hidden inputs via paired-fields
└─ date-range-picker.contract.ts
packages/react/src/date-range-picker/   Root, Label, Description, ErrorMessage, Control, Input, Start, End, Separator, Segment,
                                        Trigger, ClearTrigger, Portal, Positioner, Content, Calendar
packages/theme/src/date-range-picker.css
```

### 2. Machine

The `picker-popover` coordinator with the range adapter (add-date-picker design §2); no new states or events beyond:

- `CALENDAR.SELECT` carries `{ start, end }` from the Range Calendar's `onValueChange` (commit only — the Range Calendar's
  `onAnchorChange` does not reach the coordinator except to mirror the anchor for the contract).
- `OPEN` computes `resumeAnchor`: when the embedded pair has a committed start and an empty or invalid end (the public value is
  `null`), the bound Range Calendar's anchor is set to that start (request) and its focused date is the start.
- `CLOSE` reasons are the picker's; closing while anchored is the Range Calendar's `LEAVE` (reset) — it fires from the same
  inside test (Control and content are inside; layers opened from the header are inside). Escape: the Range Calendar consumes the
  first while anchored, so the Popover's dismiss sees only the second.
- `closeOnSelect` applies to the commit only. The first press (anchor) never closes.

### 3. Connect

As Date Picker's with `paired-fields`' group, names and hidden inputs; Trigger name `messages.trigger` default "Choose dates"; the
value description is `paired-fields`'; the Content dialog name as Date Picker; the `Calendar` part binds the Range Calendar:
`value`, `focusedValue`, `anchor` (request), `minValue`, `maxValue`, `isDateUnavailable`, `allowsNonContiguousRanges`,
`commitOnBlur` (default `"reset"`), `disabled`, `readOnly`, `invalid`, locale, zone, `firstDayOfWeek`; `onValueChange` →
`CALENDAR.SELECT`.

### 4. Contract and model-based tests

`dateRangePickerContract`: Date Picker's actions with `selectRange(start, end)` (opens, then the Range Calendar contract's
`selectRange`), `fill({ start, end })`, `fillStart`, `startRange(date)` and `cancel()` (Escape); queries `range()` (two hidden values),
`anchor()`, `isOpen()`, `closeReason()`, `calendar()` and `field()`. Configurations: `en-US` and `en-GB` day; minute granularity with
and without values; `allowsNonContiguousRanges` both ways; start typed then open (resume); typing the end first; inside a Dialog
with Escape and outside press; `modal` true; two visible months; RTL; required in a form with reset; read-only; disabled by prop
step; touch preset.

### 5. Theme

`date-range-picker.css`: as `date-picker.css` with `--rind-date-range-picker-*` tokens; the content's Range Calendar styling comes
from `range-calendar.css` (range, preview, anchor), unchanged.

## Requests to other changes

- **add-range-calendar** (`range-calendar`, "Value And Anchor") — APPLIED (coordinator, 2026-10-15) — make the anchor controllable: `anchor`, `defaultAnchor`,
  `onAnchorChange(date | null)` and a `$sync:anchor` event that sets or clears the anchor without committing; a controlled
  `anchor` is cleared by `value` changes as today. Needed to resume a half-typed range (zag's `resumeRangeSelection`).
- **add-range-calendar** — APPLIED (coordinator, 2026-10-15): export `availableBounds` and `crossesUnavailable` as public pure helpers (also requested by
  add-date-range-field).
- **add-popover** — APPLIED (coordinator, 2026-10-15) — the `scope` option (requested by add-date-picker).
- **add-date-field** — APPLIED (coordinator, 2026-10-15) — embedded mode, boundary events, draft hint (requested by add-date-range-field).
- **add-theme-system** — APPLIED (coordinator, 2026-10-15) — Date Range Picker in families `field` and `panel` (as add-date-picker).

## Risks / Trade-offs

- [Reset on leave differs from React Aria's commit] → five React Aria issues ask for it; Range Calendar's `commitOnBlur` is exposed
  on the `Calendar` part for those who want React Aria's behaviour.
- [Resume depends on a request to Range Calendar] → without it the first press anchors normally; the picker's other behaviour is
  unaffected.
- [No provisional start in the field] → the anchor and preview are visible in the calendar and announced; revisit on feedback.

## Open Questions

- A provisional start in the field while anchored.
