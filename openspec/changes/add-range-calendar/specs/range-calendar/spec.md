## Purpose

Defines rind-ui's Range Calendar: Calendar's grids, keyboard and names, with a two-step
selection of a start and an end date, a preview while selecting, drag selection, cancel and
commit rules, and unavailable dates inside ranges. Introduced by `add-range-calendar`.

## ADDED Requirements

### Requirement: Calendar Parity

The Range Calendar SHALL have the Calendar's anatomy (scope `range-calendar`), keyboard
interaction, focused-date and visible-range behaviour, multiple visible months, cell names,
triggers, visible-range announcements, disabled/read-only rules, `date-values` and
`calendar-navigation` behaviour, except where this specification differs. Its grids SHALL carry
`aria-multiselectable="true"`.

#### Scenario: Same keyboard as Calendar

- **WHEN** a cell is focused and Shift+PageDown, Home and ArrowRight are pressed
- **THEN** the focused date moves exactly as in a Calendar with the same props

### Requirement: Value And Anchor

The value SHALL be controllable (`value`, `defaultValue`, `onValueChange(value, details)`) of
type `{ start, end } | null`, with `start ≤ end`, both of the same type as Calendar's single
value (`date-values`: type, calendar and time of day kept for each end). Selecting SHALL take
two steps: the first selection of a selectable date sets the **anchor** (`onAnchorChange(date)`,
value unchanged); the second commits `{ start, end }` from the anchor and the second date in
date order, calls `onValueChange` once, and clears the anchor (`onAnchorChange(null)`). After a
commit, the next selection SHALL always start a new anchor, including on the previous start
date. A controlled value set by the parent (including `null`) SHALL clear the anchor and be
shown immediately. The anchor SHALL be controllable (`anchor`, `defaultAnchor`,
`onAnchorChange(date | null)`): a controlled `anchor` change SHALL set or clear the anchor
(`$sync:anchor`) without committing a value and without calling `onAnchorChange`, and a later
change of `value` clears a controlled anchor as above. A parent that sets `anchor` to the typed
start of a half-entered range thereby lets the next selection complete it.

#### Scenario: Backward range

- **WHEN** the user presses 20 October, then 10 October
- **THEN** `onValueChange` is called once with `{ start: 2026-10-10, end: 2026-10-20 }`

#### Scenario: Previous start starts a new range (zag#2388)

- **WHEN** the value is 10–20 October and the user presses 10 October
- **THEN** 10 October is the anchor and the value is unchanged until a second press

#### Scenario: Programmatic clear (bits-ui#1068, reka-ui#1611)

- **WHEN** the parent sets `value={null}` while 10–20 October is shown
- **THEN** no cell is selected and no anchor is set

#### Scenario: Resuming a half-typed range

- **WHEN** the parent sets `anchor` to 10 October while the value is `null`, and the user
  presses 14 October
- **THEN** `onValueChange` is called once with `{ start: 2026-10-10, end: 2026-10-14 }` and no
  value was committed when the anchor was set

#### Scenario: Controlled anchor cleared by the parent

- **WHEN** a controlled `anchor` of 10 October is changed to `null`
- **THEN** no cell has `data-anchor`, the preview is gone and `onValueChange` was not called

#### Scenario: One change per commit (reka-ui#2396)

- **WHEN** the user selects a start and an end
- **THEN** `onValueChange` was called once and `onAnchorChange` twice (date, then null)

### Requirement: Preview

While an anchor is set, the preview SHALL be the dates from the anchor to the hovered date
(mouse or pen over an enabled cell) or, otherwise, the focused date, in date order. Preview
cells SHALL carry `data-preview` (and `data-preview-start` / `data-preview-end` on its earlier
and later dates) and SHALL NOT change `aria-selected`, which stays the committed value. Hover
SHALL never page or move the visible range. The preview SHALL be cleared on commit, cancel and
when the pointer leaves the grids with no focused cell inside them.

#### Scenario: Preview is not selection (react-spectrum#3285)

- **WHEN** the anchor is 10 October and the mouse hovers 14 October
- **THEN** 10–14 October carry `data-preview`, and only cells of the committed value have
  `aria-selected="true"`

#### Scenario: Backward hover (zag#2660)

- **WHEN** the anchor is 27 June and the mouse hovers 11 June
- **THEN** 11 June carries `data-preview-start` and 27 June `data-preview-end`

#### Scenario: Hover over a placeholder does not page (zag#3084)

- **WHEN** the mouse hovers the placeholder of 1 November inside October's grid while anchored
- **THEN** the visible month stays October and the preview is unchanged

### Requirement: Cancel And Leave

Escape while anchored SHALL clear the anchor and the preview, keep the value, and be consumed;
Escape with no anchor SHALL NOT be consumed (it reaches an enclosing layer). Leaving the Range
Calendar while anchored — focus moving outside it, or a press outside it — SHALL apply
`commitOnBlur`: `"reset"` (default) clears the anchor and keeps the value, `"select"` commits
the preview, `"clear"` clears the anchor and sets the value to `null`. "Inside" SHALL be the
root's subtree, including its non-cell parts (header controls, whitespace), and any layer whose
logical parent is inside it; containment SHALL be computed from the event's composed path so it
holds inside shadow roots. Paging with the triggers, the keyboard or a controlled
`focusedValue` SHALL keep the anchor.

#### Scenario: Clicking outside cancels (react-spectrum#5709, react-spectrum#8850, react-spectrum#8287)

- **WHEN** the value is 1–5 October, the user sets the anchor on 12 October and clicks outside
- **THEN** the value is still 1–5 October and no anchor is set

#### Scenario: Header select is inside (react-spectrum#3738)

- **WHEN** a month `<select>` (or a Select whose popup is portalled) in the header is used while
  anchored
- **THEN** the anchor is kept

#### Scenario: Shadow root (react-spectrum#10330)

- **WHEN** the Range Calendar is rendered inside a shadow root and the user clicks 8 October and
  then 17 October
- **THEN** the value is 8–17 October

#### Scenario: Paging keeps the anchor on touch (react-spectrum#8889)

- **WHEN** on a touch device the user taps 28 October, taps the next trigger and taps
  3 November
- **THEN** the value is 28 October – 3 November

#### Scenario: Escape bubbles without an anchor

- **WHEN** a Range Calendar without an anchor is inside a dialog and Escape is pressed
- **THEN** the dialog closes

### Requirement: Drag Selection

A primary mouse or pen press on a selectable date SHALL set the anchor on press start; moving
the pressed pointer over other cells SHALL update the preview; releasing over another
selectable date SHALL commit; releasing over the anchor SHALL keep the anchor (so a click
starts a range). A touch press SHALL start a drag only after `dragDelay` (default 200 ms)
without movement, and while dragging the page SHALL NOT scroll; a touch that scrolls before the
delay SHALL be cancelled and change nothing; a tap SHALL behave as a press. A release with no
pointer movement over another cell (the calendar moved under a still pointer) SHALL behave as a
click. An assistive-technology activation SHALL act as exactly one press.

#### Scenario: Mouse drag

- **WHEN** the user presses on 10 October, moves over 11–14 October and releases on 14 October
- **THEN** the value is 10–14 October and `onValueChange` was called once

#### Scenario: Touch scroll does not select (react-spectrum#5975)

- **WHEN** a touch starts on a cell of a scrollable multi-month calendar and scrolls the list
- **THEN** no anchor is set and the value is unchanged

#### Scenario: Layout shift is not a drag (react-spectrum#4007)

- **WHEN** setting the anchor repositions the calendar so a different cell is under the still
  pointer at release
- **THEN** only the anchor is set

#### Scenario: Screen-reader press

- **WHEN** a screen reader activates 10 October and then 14 October with bare clicks
- **THEN** the value is 10–14 October

### Requirement: Unavailable Dates In Ranges

`isDateUnavailable(date, { anchor })` SHALL receive the current anchor (`null` when none). With
`allowsNonContiguousRanges` false (default), while anchored, every date beyond the nearest
unavailable date before and after the anchor SHALL be disabled (`data-disabled`, not
selectable) and the prompt SHALL say so; unavailable dates SHALL never be an end. With
`allowsNonContiguousRanges` true, a range MAY contain unavailable dates. A committed value that
contains an unavailable date while non-contiguous ranges are not allowed, or whose start or end
is unavailable or out of range, SHALL make the Range Calendar invalid (`data-invalid`, and
`aria-invalid="true"` on its cells).

#### Scenario: Contiguous by default (react-spectrum#8854)

- **WHEN** 15 October is unavailable and the anchor is 12 October
- **THEN** 16 October and later are disabled until the anchor is cleared

#### Scenario: Range crossing an unavailable date is invalid (react-spectrum#5302)

- **WHEN** a controlled value of 12–18 October is passed while 15 October is unavailable
- **THEN** the root carries `data-invalid`

#### Scenario: Anchor-aware availability (react-spectrum#3311)

- **WHEN** `isDateUnavailable` returns true for dates more than 7 days after the anchor
- **THEN** with the anchor on 1 October, 9 October cannot be pressed

### Requirement: Range ARIA, Prompts And Announcements

Every selectable cell inside the committed range SHALL have `aria-selected="true"`, every other
selectable cell `aria-selected="false"`. The focused cell SHALL be described (through a
visually hidden node referenced by `aria-describedby`) by `messages.startPrompt` with no anchor
(default "Press Enter to start a range") and by `messages.endPrompt({ anchor })` while anchored
(default "Press Enter to end the range starting {anchor}"); cell names SHALL stay the plain date.
The Range Calendar SHALL announce, politely and keyed per instance, `messages.anchorSet({
anchor })` when an anchor is set and `messages.rangeSelected({ start, end })` on commit.

#### Scenario: Prompt follows the phase

- **WHEN** the user focuses 10 October, presses Enter, then focuses 14 October
- **THEN** the description of 14 October's cell is "Press Enter to end the range starting
  Saturday, October 10, 2026", and the announcements were "Range starts Saturday, October 10,
  2026"

#### Scenario: Names stay short (react-spectrum#6043)

- **WHEN** the value is 12–16 March 2024
- **THEN** the name of the 12 March cell is "Tuesday, March 12, 2024"

### Requirement: Reusable Range Helpers

The pure range module SHALL export `makeRange(a, b)`, `availableBounds(anchor, isUnavailable,
visibleMonths)` and `crossesUnavailable(range, isUnavailable)` as public helpers. They SHALL be
generic over comparable period starts: they SHALL work on `CalendarDate`s and take the period
(`day`, `month` or `year`) as an argument or compare through a supplied comparison, so a month
or year picker can pass first-of-period dates and receive bounds and crossings in the same unit.
`availableBounds` SHALL return the nearest unavailable period start before and after the anchor
(`null` when none within its search limit). The `insideWatch` effect and the prompt messages
(`startPrompt`, `endPrompt`, `anchorSet`, `rangeSelected`) SHALL be exported as reusable pieces.

#### Scenario: Bounds around an anchor

- **WHEN** 15 October is unavailable and `availableBounds` is called for the anchor 12 October
  at day granularity
- **THEN** the upper bound is 14 October and the lower bound is `null`

#### Scenario: Month granularity

- **WHEN** `crossesUnavailable` is called for the range September–December 2026 at month
  granularity with November unavailable
- **THEN** it returns true, and for September–October it returns false

#### Scenario: Reuse of the inside watch

- **WHEN** a composite imports `insideWatch` and the prompt messages from the Range Calendar
  pieces
- **THEN** it can build an anchored range selection that leaves on an outside press and speaks
  the same prompts

### Requirement: Range Data Attributes

Beyond Calendar's attributes, cells SHALL carry `data-in-range` (committed), `data-selection-
start`, `data-selection-end`, `data-anchor` (only while anchored), `data-preview`,
`data-preview-start` and `data-preview-end`; the root and grids SHALL carry `data-anchored` and
`data-dragging`. Placeholder cells SHALL carry none of the range attributes. A lone anchor SHALL
carry `data-anchor` and not `data-selection-end`.

#### Scenario: Two months, range shown once (reka-ui#2730)

- **WHEN** October and November are visible and the value is 28 October – 3 November
- **THEN** the placeholders of 1–3 November in October's grid carry no range attribute

#### Scenario: Lone anchor (react-spectrum#5456)

- **WHEN** only an anchor on 10 October is set
- **THEN** that cell has `data-anchor` and neither `data-selection-start` nor
  `data-selection-end`

### Requirement: Contract

The Range Calendar SHALL ship a contract with scope `range-calendar` extending Calendar's
queries, with actions `selectRange(start, end)` (pointer: two clicks; keyboard: navigate and
Enter twice; touch: two taps; virtual: two bare clicks), `startRange(date)`, `dragRange(start,
end)` (pointer and pen; keyboard declared as `selectRange`), `cancel()` (Escape), and queries
`range()`, `anchor()`, `preview()`; states `idle`, `anchored`, `dragging` observed through
`data-anchored` and `data-dragging`; event map for its events; prop step `$sync:anchor` (set,
then clear, without a commit); declared announcements; traits
`selectable` (multiple, oracle from the committed range) and `composite-roving`, plus the range
invariants.

#### Scenario: Driver selects a range

- **WHEN** `getRangeCalendar(screen, { name: "Stay" }).selectRange("2026-10-10", "2026-10-14")`
  runs with each modality
- **THEN** `range()` is `{ start: "2026-10-10", end: "2026-10-14" }` each time

### Requirement: Range Invariants

The contract SHALL ship invariants checked after every model step: the value is `null` or has
`start ≤ end`; `aria-selected="true"` holds exactly on selectable cells inside the committed
range; `data-preview` is present only while anchored; `data-anchor` is on exactly one cell while
anchored and on none otherwise; `onValueChange` was called exactly once per commit; paging never
cleared an anchor.

#### Scenario: Broken variant selects the preview

- **WHEN** a broken variant sets `aria-selected="true"` on preview cells
- **THEN** the first hover step after an anchor fails, naming the selection invariant

### Requirement: Theme

`@rind-ui/theme` SHALL style the Range Calendar in `range-calendar.css` on Calendar's look with
`--rind-range-calendar-*` tokens: range middle days, start and end caps, the anchor, and a
preview distinguishable from the committed range without colour (a dashed edge), all visible
under forced colors, with a `data-tone="danger"` invalid state.

#### Scenario: Preview vs range in forced colors

- **WHEN** a committed range and a preview are shown together under forced colors
- **THEN** the committed days use `Highlight` and the preview a dashed outline, and both are
  distinguishable
</content>
</invoke>
