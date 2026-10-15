## Why

Booking, reporting and filtering UIs choose a span of dates, and the Date Range Picker will be
built on a range calendar. A range adds state a plain calendar lacks — an anchor, a preview
that follows the pointer or the keyboard, commit, cancel, drag — and the libraries' bug history
(32 entries in the research note) shows it is where they break most: leaving the calendar
commits a range nobody chose (react-spectrum#5709, #8850, #8287, #3738), touch scrolling
commits (react-spectrum#5975), paging clears the start on iOS (react-spectrum#8889), shadow
roots commit on the first click (react-spectrum#10330), and the in-progress preview is
indistinguishable from the selection, visually and for screen readers (react-spectrum#3285).

Research: [range-calendar](../../../docs/research/range-calendar.md) ·
[calendar](../../../docs/research/calendar.md) ·
[accessibility](../../../docs/research/accessibility.md) §5, §7 ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) causes A, C, J

Depends on: `add-calendar` (`calendar`, `calendar-navigation`, `date-values`; parts and machine
pieces), `add-a11y-foundations` (`press-interactions` incl. hover and touch cancel,
`keyboard-interactions`, `announcer`, `i18n-messages`, `hidden-content` for the prompt node),
`add-overlay-infrastructure` (`layer-stack` logical-inside query), `add-foundations`,
`add-collections` (traits), `add-theme-system`.

## What Changes

- A public **Range Calendar** component with the Calendar's parts and keyboard; value
  `{ start, end } | null`; select a start (the anchor) then an end by press, Enter/Space or
  drag; a preview from the anchor to the hovered or focused date; Escape cancels; leaving the
  calendar cancels by default (`commitOnBlur: "reset" | "select" | "clear"`).
- `isDateUnavailable(date, { anchor })` and `allowsNonContiguousRanges`: by default a range
  cannot cross an unavailable date (dates beyond the nearest unavailable date on each side of
  the anchor become disabled while anchored); a committed range crossing one is invalid.
- Drag selection with mouse and pen; on touch only after a hold (`dragDelay`), never from a
  scroll; a click-click and an Enter-Enter path always exist (WCAG 2.5.7).
- Preview separate from selection: `data-preview*` attributes, `aria-selected` only for the
  committed range; prompts in the focused cell's description and polite announcements for the
  anchor and the commit.
- Contract and driver (`getRangeCalendar`), range invariants, model-based tests, theme
  stylesheet, stories, docs page.

## Capabilities

### New Capabilities

- `range-calendar`: the Range Calendar component — value and anchor, preview, commit and
  cancel, drag and touch, unavailable dates inside ranges, ARIA, prompts and announcements,
  data attributes, contract, theme.

### Modified Capabilities

None (Calendar's capabilities are reused unchanged).

## Non-goals

- Dragging an existing range's endpoint to resize it (React Aria) — the `dragging` state
  leaves room for it.
- `minDays`/`maxDays` props (Reka, Bits): expressed with `isDateUnavailable(date, { anchor })`.
- Typing a range (Date Range Field), the picker popover (Date Range Picker), presets.
- Auto-advancing the focus after Enter on the anchor (React Aria).

## Impact

- `packages/core/src/components/range-calendar/` (machine, connect, contract, messages) reusing
  `components/calendar/calendar.pieces.ts`, `calendar.navigation.ts`, `calendar.grid.ts`.
- `packages/react/src/range-calendar/`, `@rind-ui/testing` (`getRangeCalendar`),
  `@rind-ui/theme/range-calendar.css`, stories, docs.
- No new dependency. Reado: not used.
</content>
</invoke>
