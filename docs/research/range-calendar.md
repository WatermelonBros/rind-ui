# Range Calendar — research

Status: done · Wave: 3 (React Aria, Reka UI, Bits UI; Ark/Zag as `selectionMode: "range"` of the Date Picker)

Read [calendar.md](calendar.md) first: the grid, cells, keyboard, date infrastructure
(`date-values`) and date-grid navigation (`calendar-navigation`) are the Calendar's and are
reused unchanged. This note covers what a range adds: the anchor, the hover/keyboard
preview, committing, drag selection, unavailable dates inside a range, and blur.

Cross-cutting: [accessibility.md](accessibility.md) §5 (press semantics, 2.5.7 dragging
alternative), §7 (Announcer); [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
causes A (screen-reader clicks: zero-size pointer events on iOS VO, webkit 222627/223202),
C (virtual focus), J (mobile ATs); [overlay-infrastructure.md](overlay-infrastructure.md)
(logical "inside" for layers opened from the calendar).

## Pattern

- No APG pattern for range selection. Closest: the calendar grid (calendar.md) with
  `aria-multiselectable="true"` and `aria-selected` on every day in the range.
- What the user must perceive without sight: that a selection is in progress (anchor set),
  where it starts, what the end would be, and the committed range.
- WCAG 2.5.7 Dragging Movements: drag-to-select must have a single-pointer alternative
  (click start, click end) — every library has it.

## How the others built it

### React Aria (`react-stately/src/calendar/useRangeCalendarState.ts`, `react-aria/src/calendar/{useRangeCalendar,useCalendarCell}.ts`, RAC `RangeCalendar`)

- Value `{ start, end } | null` controllable; internal `anchorDate` (not controllable) and
  `isDragging`. `highlightedRange` = anchor..focused while selecting, else the value; every
  cell inside it is `isSelected`. First press sets the anchor; second press commits
  `makeRange(anchor, date)` (swapped when reversed) and clears the anchor. Hover (`onPointer
  Enter`, not touch unless dragging) moves the focused date, so the preview follows the
  pointer; keyboard moves preview the same way.
- **`allowsNonContiguousRanges`** (default false): with an anchor set, the first unavailable
  date before and after the anchor bound the selectable range (`nextUnavailableDate` within
  ± one visible duration), so dates beyond become invalid; true lets a range span
  unavailable dates. `isDateUnavailable(date, anchorDate)` receives the anchor (RA#3311).
- **Commit on blur / outside press** (`commitBehavior: "select"` default, also `"clear"`,
  `"reset"`): a window `pointerup` outside the calendar body (or not on a button) and a
  blur leaving the calendar commit the preview as the range. Contested: RA#5709, RA#8850,
  RA#8287, RA#3738 all report an unintended range from leaving the calendar.
- **Drag**: mouse press on a date starts selection on press start and commits on release on
  another date; pressing an endpoint of an existing range drags that endpoint; touch waits
  200 ms before dragging (scroll vs drag), `touchmove` prevented while dragging, implicit
  pointer capture released so `pointerenter` fires on other cells. VO zero-size pointer
  events are ignored to match `usePress` (webkit bugs above).
- Keyboard: Enter on the anchor date auto-advances focus one day ("gives an indication that
  you're selecting a range"); screen readers get a hidden description "Click to start/finish
  selecting date range"; the first and last selected dates' labels include the whole range
  ("Selected Range: … to …") — RA#6043 finds it confusing; Escape clears the anchor.
- Data attributes: `data-selected`, `data-selection-start`, `data-selection-end`
  (RA#5456: a single anchor cell is marked as end), `data-invalid`.
- Problems: RA#10330 (shadow DOM: window listener reads a retargeted `e.target`, every
  click commits start = end), RA#4007 (popover moved during press → treated as a drag),
  RA#8889 (iOS 16: paging clears the anchor), RA#9214 (preview stays visible after paging on
  mobile — intentional), RA#3285 (preview indistinguishable from the selection), RA#5975
  (touch scroll of a multi-month list commits), RA#5302 (range typed in fields crosses an
  unavailable date without being invalid), RA#4168 (click on dialog whitespace closes and
  commits).

### Ark UI / Zag (`date-picker` with `selectionMode: "range"`)

- Value `[start, end]`; `activeIndex` 0/1 says which end the next click sets;
  `hoveredValue` drives `data-in-hover-range`, `data-hover-range-start/end`; `data-in-range`,
  `data-range-start/end` for the committed range. Typing into the start/end inputs also sets
  the range.
- Problems: ZG#2660 (hover range end attribute follows value order on a backward hover, and
  stays after the selection completes), ZG#3084 (hovering an outside day switches months
  with `outsideDaySelectable`), ZG#2388 (re-selecting the previous start date did not reset
  the range), ZG#3126 (hover preview only computed in range mode), ZG#2556 (range in month
  view: runtime error, no `data-in-range` on middle months), ZG#2809/#2840/#2864 (crash when
  the end is typed first).

### Reka UI (`RangeCalendar/*`)

- `modelValue: { start, end }`, `startValue` emitted on first click, `placeholder` (focused
  date), `allowNonContiguousRanges`, `maximumDays`, `isDateUnavailable`, `preventDeselect`,
  `fixedDate: "start" | "end"`. Escape resets the in-progress selection (RK#1536). Cells
  carry `data-selection-start`, `data-selection-end`, `data-highlighted` (preview),
  `data-highlighted-start/end` (RK#1130).
- Problems: RK#1455 (`max-value` date not selectable — exclusive comparison), RK#1611 /
  RK#1272 (programmatic clear or set not reflected in the view), RK#2730 (range shown twice
  with two months, once in an outside-month preview), RK#2396 (`update:modelValue` emitted
  twice on start).

### Bits UI (`range-calendar`)

- Same anatomy as its Calendar; `value: { start, end }`, `onStartValueChange`,
  `onEndValueChange`, `minDays`/`maxDays`, `excludeDisabled`.
- Problems: BITS#1068 (cannot programmatically clear a range), BITS#838 (prop change not
  reflected: start/end copied into local state once), BITS#1445 / BITS#2120 (end day
  constrained by the start's month in the range fields).

### Kobalte, Base UI, Radix, Headless UI, Ariakit

None ship a range calendar (KB#305 open request).

## Accessibility

- Grid `aria-multiselectable="true"`; every committed-range day `aria-selected="true"`, every
  other selectable day `aria-selected="false"` (explicit, collections invariant 9).
- **Preview is not selection.** While an anchor is set, the preview days are styled
  (`data-preview`) but `aria-selected` stays the committed value: announcing every preview
  day as "selected" lies to the user and makes the in-progress state undetectable
  (RA#3285/RA#9214 show sighted users cannot tell them apart either). The anchor and the
  preview reach AT through the focused cell's description instead.
- **Prompts**: the focused cell's `aria-describedby` points at a hidden description that
  depends on the phase: "Press Enter to start a range" (no anchor), "Press Enter to end the
  range starting {date}" (anchor) — through `messages`. Shorter than RA's per-cell range
  labels (RA#6043).
- **Announcements** (Announcer, polite): when the anchor is set ("Range starts {date}") and
  when the range is committed ("Selected {start} to {end}"); keyed so a fast second press
  replaces the first. A screen-reader user on iOS cannot see the preview; the announcement
  is the only feedback that the first tap did something.
- **Virtual clicks** (cause A): an AT press arrives as a bare `click`; it must act as one
  press (anchor or commit), never as a drag start + end on the same cell (RA's VO pointer
  workaround). Press semantics from `press-interactions` already give us one `PRESS` per
  activation.
- **Dragging (2.5.7)**: drag is an accelerator; click-click and Enter-Enter always work.
- **Touch**: a tap is a press; a scroll (`pointercancel`) never sets or commits; drag on touch
  only after a hold without movement.
- Forced colours: the range needs a non-colour cue (border for start/end, background +
  `Highlight` system colour for middle days, a dashed border for the preview).

## Bug history

Same searches as calendar.md (RangeCalendar, Range Calendar, range date picker,
allowsNonContiguousRanges, RangeCalendar drag) — 160 hits, 45 read in full.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| RA | [#5709](https://github.com/adobe/react-spectrum/issues/5709) | interacting outside the calendar commits the in-progress range | `commitBehavior: "select"` on outside press / blur | closed (PR declined) | default `commitOnBlur: "reset"`: leaving cancels the anchor and keeps the old value |
| RA | [#8850](https://github.com/adobe/react-spectrum/issues/8850) | closing the popover commits the hovered date | same; intended so hover users "see" a commit | closed (by design) | commit only on an explicit second press; opt-in `"select"` for RA's behaviour |
| RA | [#8287](https://github.com/adobe/react-spectrum/issues/8287) | end date set without clicking it | same | closed | same |
| RA | [#3738](https://github.com/adobe/react-spectrum/issues/3738) | a month `<select>` in the header commits the range | "outside" = not a button / focus left the body | open | inside = the Root subtree plus layers whose logical parent is inside (layer-stack query) |
| RA | [#4168](https://github.com/adobe/react-spectrum/issues/4168) | clicking dialog whitespace during selection closes and commits | outside press inside the picker's dialog | open | presses on non-cell parts of the Root never commit or cancel |
| RA | [#5975](https://github.com/adobe/react-spectrum/issues/5975) | touch-scrolling a multi-month calendar commits | pointerup after scroll treated as release outside | closed | scroll = `PRESS.CANCEL`; never a commit |
| RA | [#10330](https://github.com/adobe/react-spectrum/issues/10330) | in shadow DOM every click commits start = end | window listener reads a retargeted `e.target` | closed (`getEventTarget`) | no window-level target checks; containment via `composedPath()` in `core/dom` |
| RA | [#4007](https://github.com/adobe/react-spectrum/issues/4007) | moving the popover on anchor treated as a drag | press start and release on different cells after a layout shift | closed (advice) | drag only after pointer movement across cells while pressed; release on another cell after a reposition with no move is a click |
| RA | [#8889](https://github.com/adobe/react-spectrum/issues/8889) | iOS 16: paging after the start date clears it | trigger press treated as outside commit/clear | open | paging never touches the anchor; scenario on touch |
| RA | [#9214](https://github.com/adobe/react-spectrum/issues/9214) | after paging, a range appears filled from the anchor | preview = anchor..focused even off-screen | open (intended) | preview only while the pointer/keyboard target is a visible date; attribute distinct from selection |
| RA | [#3285](https://github.com/adobe/react-spectrum/issues/3285) | in-progress range looks committed | preview shares `isSelected` | closed (by design) | `data-preview` ≠ `data-selected`; `aria-selected` only for committed |
| RA | [#5456](https://github.com/adobe/react-spectrum/issues/5456) | a lone anchor cell styled as range end | anchor marked `selection-end` | closed | anchor gets `data-anchor` only until a range exists |
| RA | [#6043](https://github.com/adobe/react-spectrum/issues/6043) | first/last cell labels repeat the whole range | range text prepended to labels | closed (kept) | range only in announcements and the prompt description, not in names |
| RA | [#3311](https://github.com/adobe/react-spectrum/issues/3311) | availability cannot depend on the anchor | `isDateUnavailable(date)` only | closed: anchor argument added | `isDateUnavailable(date, { anchor })` |
| RA | [#6677](https://github.com/adobe/react-spectrum/issues/6677) | limit the range length from the start date | no API | closed (use #3311) | max length is a recipe on `isDateUnavailable(date, { anchor })` |
| RA | [#8854](https://github.com/adobe/react-spectrum/issues/8854) | "unavailable dates change" after the first click | contiguous ranges bound by the nearest unavailable dates | closed (by design) | document `allowsNonContiguousRanges`; mark bounded cells `data-disabled` with a reason in the prompt |
| RA | [#5302](https://github.com/adobe/react-spectrum/issues/5302) | range crossing an unavailable date is valid when typed | validation checks endpoints only | closed | a committed range crossing an unavailable date is invalid unless non-contiguous ranges are allowed |
| ZG | [#2660](https://github.com/chakra-ui/zag/issues/2660) | hover-range attributes wrong on backward hover and linger | value order vs visual order; not cleared after commit | closed (partly) | preview start/end are the visual (earlier/later) dates; cleared on commit and pointer leave |
| ZG | [#3084](https://github.com/chakra-ui/zag/issues/3084) | hovering an outside day switches the month | hover moved the focused date across the visible range | closed | pointer hover never pages |
| ZG | [#2388](https://github.com/chakra-ui/zag/issues/2388) | pressing the previous start date does not start a new range | equality short-circuit | closed | after a commit, the next press always starts a new anchor |
| ZG | [#3126](https://github.com/chakra-ui/zag/issues/3126) | hover preview missing in single mode | preview gated by range mode | closed | preview is a Range Calendar concept only; Calendar has hover via `data-hover` |
| ZG | [#2556](https://github.com/chakra-ui/zag/issues/2556) | middle months of a month range lack `data-in-range`; crash on third selection | range state computed for endpoints only | closed | per-cell `in-range` computed from (start, end) by comparison, for any view |
| ZG | [#2809](https://github.com/chakra-ui/zag/issues/2809) | crash when the end is typed before the start | `undefined` start dereferenced | closed (three follow-ups #2840, #2864) | value is `{ start, end } | null` — both or neither; partial only inside the anchor |
| RK | [#1455](https://github.com/unovue/reka-ui/issues/1455) | the `max-value` date cannot be picked | exclusive comparison | closed | min/max inclusive (date-values) |
| RK | [#1536](https://github.com/unovue/reka-ui/issues/1536) | no way to cancel a selection | — | closed: Escape resets | Escape cancels the anchor; a second Escape is not consumed (bubbles to the layer) |
| RK | [#1611](https://github.com/unovue/reka-ui/issues/1611) | programmatic clear not reflected | local copies of start/end | closed | one controllable value; `$sync` resets the anchor |
| RK | [#1272](https://github.com/unovue/reka-ui/issues/1272) | programmatic set not reflected until interaction | same | closed | same scenario |
| RK | [#2730](https://github.com/unovue/reka-ui/issues/2730) | range drawn twice with two months | outside-month preview days styled | closed | outside-month cells never get range attributes |
| RK | [#2396](https://github.com/unovue/reka-ui/issues/2396) | value emitted twice on the first click | start and model emitted separately | closed | `onValueChange` only on commit; `onAnchorChange` for the start |
| BITS | [#1068](https://github.com/huntabyte/bits-ui/issues/1068) | cannot clear the range programmatically | effect ignored `undefined` start | closed | controlled `null` clears; scenario |
| BITS | [#838](https://github.com/huntabyte/bits-ui/issues/838) | prop change not reflected | start/end copied once into state | closed | same |
| BITS | [#1445](https://github.com/huntabyte/bits-ui/issues/1445) | end limited by the start's month length | shared segment limits | closed | each end validated on its own (Date Range Field later) |

## Known pitfalls

- **Commit on leave** is the most-reported range behaviour across RA (five issues): make
  leaving cancel by default.
- **What is "outside"**: menus, selects and popovers opened from the header are inside
  (RA#3738); whitespace inside the Root is inside (RA#4168); shadow roots retarget events
  (RA#10330).
- **Touch**: scroll vs drag vs tap (RA#5975); VO touch sends zero-size pointer events.
- **Preview vs selection** must be separate states (RA#3285, RA#5456, ZG#2660).
- **Unavailable inside a range**: contiguous by default; validation must look inside the
  range, not only at its ends (RA#5302).
- **Paging keeps the anchor** (RA#8889) and hover never pages (ZG#3084).

## Testing notes

- Model paths: idle → anchor (press, Enter) → commit (press, Enter) / cancel (Escape, blur
  with `reset`) / commit (blur with `select`); drag paths (mouse, touch after hold) in browser
  mode; virtual click paths (each AT press = one `PRESS`).
- Invariants: `aria-selected="true"` exactly on committed-range days that are selectable;
  `data-preview` only while an anchor is set; `onValueChange` count = commits; anchor kept
  across `PAGE`; the value is null or has `start ≤ end`.
- Shadow-root fixture (RA#10330); a header select fixture (RA#3738).
- Contract: `selectRange(start, end)` (pointer: click, click; keyboard: navigate + Enter
  twice; touch: tap, tap), `dragRange(start, end)` (pointer only — keyboard twin
  `selectRange`), `cancel()` (Escape).

## Decisions

- **Reuse**: Calendar's machine pieces, connect helpers, parts, `calendar-navigation` and
  `date-values`; the Range Calendar machine is its own (states differ), sharing the
  Calendar's context fields, navigation actions and effects through exported pieces (as
  `collection/machine.ts` does for lists).
- **Machine**: states `idle`, `anchored` (anchor set, preview follows the focused or hovered
  date), `dragging` (pointer pressed on a date and moved onto another; release commits).
  Events: Calendar's navigation events, `CELL.PRESS_START {date, pointerType}`, `CELL.PRESS
  {date, modality}`, `CELL.HOVER {date}` / `GRID.HOVER_END`, `CANCEL` (Escape),
  `LEAVE` (focus or press outside, per the inside rule), `$sync:value`. A touch press starts
  a drag only after `dragDelay` (200 ms, scheduler) without movement.
- **Value**: controllable `value: { start, end } | null`; `onValueChange` only at commit;
  `onAnchorChange(date | null)` for the start of a selection; `commitOnBlur: "reset"`
  (default) | `"select"` | `"clear"`.
- **Unavailable**: `isDateUnavailable(date, { anchor })`; `allowsNonContiguousRanges`
  (default false: dates past the first unavailable date on each side of the anchor become
  disabled while anchored; true: a range may contain unavailable dates and stays valid);
  committed ranges containing unavailable dates when not allowed are invalid (RA#5302).
- **`data-*`** on cells (beyond Calendar's): `data-selection-start`, `data-selection-end`,
  `data-in-range`, `data-anchor`, `data-preview`, `data-preview-start`, `data-preview-end`;
  Root/Grid `data-anchored`, `data-dragging`.
- **Contract**: Calendar's plus `selectRange`, `dragRange`, `startRange(date)`, `cancel()`;
  queries `range()`, `anchor()`, `preview()`; announcements declared.
- **Deliberately different**: cancel on leave by default (RA commits); preview is not
  `aria-selected`; no auto-advance after Enter on the anchor (RA) — the prompt and the
  announcement say what happened; dragging an existing endpoint to resize is not in this
  change.

## Open questions

- Endpoint drag-to-resize (RA): add when asked; the `dragging` state already exists.
- `minDays`/`maxDays` props (Reka, Bits) vs the `isDateUnavailable(date, { anchor })`
  recipe: revisit if the recipe proves awkward in the Date Range Picker.
</content>
</invoke>
