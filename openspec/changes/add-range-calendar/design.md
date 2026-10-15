## Context

[range-calendar.md](../../../docs/research/range-calendar.md) has the comparison and the bug
history. This change builds on, and does not re-specify:

| Change | What Range Calendar uses |
|---|---|
| `add-calendar` | `calendar` (parts, keyboard, names, triggers, announcements, theme base), `calendar-navigation`, `date-values`; `calendar.pieces.ts` (context fields, navigation actions, `focusCell`/`prepareAnnouncer` effects), `calendar.grid.ts`, `calendar.connect.ts` helpers |
| `add-a11y-foundations` | `press-interactions` (`PRESS.START`/`PRESS`/`PRESS.CANCEL` with `pointerType`, touch scroll cancel, virtual clicks as one press, hover from mouse/pen), `keyboard-interactions` (Escape → `DISMISS`), `announcer`, `i18n-messages`, `hidden-content` (visually hidden prompt node), `interaction-modality` |
| `add-overlay-infrastructure` | `layer-stack`'s logical-inside query (a portalled Select or Menu opened from the header is inside); `dismissable-layer` rule that a consumed Escape stops there |
| `add-foundations`, `add-collections` | runtime, controllables, contracts, `selectable`/`composite-roving` traits |
| `add-theme-system` | stylesheet convention; families as Calendar (request in `add-calendar`) |

## Goals / Non-Goals

**Goals:**
- No duplicated navigation: Range Calendar composes Calendar's pieces; only selection differs.
- Every range path (click-click, Enter-Enter, drag, touch hold-drag, virtual) drivable by the
  model.

**Non-Goals:**
- Endpoint resizing, `minDays`/`maxDays` (proposal Non-goals).

## Decisions

### 1. Layout

```
packages/core/src/components/range-calendar/
├─ range-calendar.machine.ts    composes calendar.pieces
├─ range-calendar.range.ts      pure, public, generic over period starts (day | month | year): makeRange, availableBounds(anchor, isUnavailable, visibleMonths), crossesUnavailable
├─ range-calendar.connect.ts    Calendar connect helpers + range attributes, prompt node, inside test
├─ range-calendar.contract.ts   contract + rangeCalendarInvariants
└─ range-calendar.messages.ts   Calendar messages + startPrompt, endPrompt, anchorSet, rangeSelected (exported pieces)
packages/react/src/range-calendar/   same parts as Calendar (re-exported from Calendar's part implementations with scope range-calendar)
packages/theme/src/range-calendar.css
```

`availableBounds` searches at most `visibleMonths + 1` months on each side of the anchor (React
Aria searches one visible duration); beyond that, dates are not bounded (documented).

### 2. Machine

```ts
type RangeCalendarEvent =
  | CalendarNavigationEvent                                       // NAVIGATE, CELL.FOCUS, PAGE, GRID.FOCUS/BLUR (calendar.pieces)
  | { type: "CELL.PRESS_START"; date: CalendarDate; pointerType: PointerType }
  | { type: "CELL.PRESS"; date: CalendarDate; modality: Modality }
  | { type: "CELL.PRESS_CANCEL" }
  | { type: "CELL.HOVER"; date: CalendarDate } | { type: "GRID.HOVER_END" }
  | { type: "SELECT_FOCUSED"; modality: "keyboard" }
  | { type: "CANCEL" }                                            // Escape (DISMISS) while anchored
  | { type: "LEAVE" }                                             // focus/press outside per the inside rule

states:
  idle      ── CELL.PRESS_START [mouse|pen, selectable] ──► dragging / setAnchor, announceAnchor
            ── CELL.PRESS_START [touch, selectable] / armTouchDrag     (after dragDelay ──► dragging / setAnchor)
            ── CELL.PRESS [selectable, !anchorSetByThisPress] ──► anchored / setAnchor, announceAnchor
            ── SELECT_FOCUSED [selectable, !readOnly] ──► anchored / setAnchor, announceAnchor
  anchored  ── CELL.PRESS [selectableEnd] ──► idle / commit, announceRange
            ── SELECT_FOCUSED [selectableEnd] ──► idle / commit, announceRange
            ── CELL.PRESS_START [mouse|pen, selectableEnd] ──► dragging
            ── CELL.HOVER / setHovered · GRID.HOVER_END / clearHovered
            ── CANCEL ──► idle / clearAnchor (consumed)
            ── LEAVE ──► idle / applyCommitOnBlur
  dragging  ── CELL.HOVER / setHovered (moved = true)
            ── CELL.PRESS [date ≠ anchor, moved, selectableEnd] ──► idle / commit, announceRange
            ── CELL.PRESS [date = anchor or !moved] ──► anchored
            ── CELL.PRESS_CANCEL ──► anchored if the anchor came from this press after the delay, else idle
            ── LEAVE ──► idle / applyCommitOnBlur
  global    Calendar navigation events (pieces) · $sync:value / clearAnchor · $sync:anchor / setAnchor|clearAnchor (no commit, no callback)
values:     value: controllable("value", { fallback: null, equal: sameRange })
            anchor: controllable("anchor", { fallback: null, equal: sameDate })   (`anchor`, `defaultAnchor`, `onAnchorChange`)
            disabled, readOnly: bindProp
effects:    preventTouchScroll (while dragging with touch: non-passive touchmove preventDefault on the root),
            insideWatch (exported as a piece; while anchored: focusout + document pointerdown, composedPath containment
            + layer-stack logical parent) → LEAVE
```

- **Why these states.** `anchored` changes what a press means (end vs start), enables preview,
  Escape and leave; `dragging` changes what release and hover mean and owns the touch-scroll
  lock. Hover, focused date, `moved` and the pending touch timer are context.
- **Press start vs press**: mouse/pen act on `PRESS.START` (drag needs it), like Number Input's
  steppers; touch and keyboard and virtual act on `PRESS` (release), so scrolling cancels
  (`PRESS.CANCEL`) and an AT click is one press. The anchor set on press start is remembered so
  the trailing `PRESS` of the same click does not toggle it (`anchorSetByThisPress`).
- **`selectableEnd`**: selectable, not unavailable, inside `availableBounds` unless
  `allowsNonContiguousRanges`, inside min/max.
- **Leave** is not a blur listener on the grid: Paging triggers, header controls and portalled
  layers are inside; `focusout` with a `null` `relatedTarget` (window blur) is ignored, as in
  `dismissable-layer`.

### 3. Connect

Calendar's part props plus: cells `data-in-range`, `data-selection-start/end`, `data-anchor`,
`data-preview*` (computed from `(value, anchor, hovered ?? focused)` by date comparison, never
for placeholders), `aria-describedby` → one hidden prompt node per instance (`hidden-content`)
on the focused cell only; press handlers expose `PRESS.START` with `pointerType` for cells;
`pointerdown` on cells releases implicit touch pointer capture so `pointerenter` reaches other
cells while dragging (React Aria's technique, already done by `press-interactions` for touch).

### 4. Contract and model-based tests

- `selectRange` per modality as in the spec; `dragRange` uses the adapter's pointer steps
  (down, move over cells, up) and, for touch, waits `dragDelay` through the adapter's time.
- Configurations: one and two months; `allowsNonContiguousRanges` false/true with unavailable
  15 October; anchor-aware `isDateUnavailable` (max 7 days); `commitOnBlur` each value; inside a
  dialog (Escape bubbling); header with a native `<select>` and with a rind Select; shadow-root
  host fixture; RTL; read-only.

### 5. Theme

`range-calendar.css` imports nothing; it repeats Calendar's selectors with scope
`range-calendar` through shared custom properties (`--rind-range-calendar-*` defaulting to the
semantic tokens Calendar uses), adds `--rind-range-calendar-range-bg`, cap radii,
`--rind-range-calendar-preview-border` (dashed), anchor ring; forced colors: range days
`Highlight`, preview `outline: 1px dashed CanvasText`.

## Requests to other changes

None beyond add-calendar's (grid orientation in `keyboard-interactions`, theme family rows).

Requested of this change by add-date-range-picker and add-month-year-picker (applied): the controllable anchor
(`anchor`, `defaultAnchor`, `$sync:anchor`, to resume a half-typed range); public `availableBounds` and `crossesUnavailable`
(also used by add-date-range-field), generic over period starts so the Month/Year Pickers can pass first-of-period dates;
`insideWatch` and the prompt messages exported as pieces. All additive; no behaviour change for Range Calendar itself.

## Risks / Trade-offs

- [Cancel on leave differs from React Aria's commit] → five RA issues ask for it; `"select"`
  keeps RA's behaviour one prop away; the end-prompt and the anchor announcement tell AT users a
  second press is needed.
- [Mouse acts on press start] → required for drag; 2.5.2 is met: releasing on the anchor only
  sets the anchor (undoable with Escape), commits happen on release.
- [Bounded search for `availableBounds`] → documented limit (`visibleMonths + 1` months each
  side).

## Open Questions

None that change the specs.
</content>
</invoke>
