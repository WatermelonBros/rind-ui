// Calendar (design §3): `idle` / `focused` (only "is the grid focused" changes behaviour), a
// controllable value (by day), focused date and view; the visible start is context, the grids
// are derived. Dates in context are in the display calendar; emitted values keep the caller's
// type, calendar and time (toEmitted). Runs in Node: "today" comes from the injected date clock.
// In the month and year views (spec "Month And Year Views") the unit is the period: the focused
// period is the focused date's, and the page is derived from it (period-navigation).

import {
  type Calendar,
  CalendarDate,
  type DateValue,
  isSameDay,
  toCalendar,
  toCalendarDate,
} from "@internationalized/date"
import type { Modality } from "../../contract/env"
import type { AnnouncerEnv } from "../../env/capabilities"
import { fullDate, periodName, toEmitted } from "../../i18n/date"
import { setup, type } from "../../machine/setup"
import type { ActionArgs } from "../../machine/types"
import type { CalendarMessages } from "./calendar.messages"
import {
  align,
  type CalendarMove,
  canPage,
  clamp,
  move,
  type NavigationOptions,
  page,
} from "./calendar.navigation"
import {
  type CalendarView,
  canPagePeriod,
  clampView,
  movePeriod,
  type PeriodMove,
  type PeriodOptions,
  type PeriodView,
  periodAllowed,
  periodStart,
  viewRank,
  viewStep,
} from "./calendar.period"
import {
  announceHeading,
  announceVisibleRange,
  focusedValueControllable,
  prepareAnnouncer,
  requestCellFocus,
  viewHeadingText,
} from "./calendar.pieces"
import { canEndRange, type DateRange, makeRange } from "./calendar.range"

export type CalendarSelectionMode = "single" | "multiple" | "range"
/** A committed range: `start ≤ end`, each end keeping its own type, calendar and time. */
export type CalendarRangeValue = DateRange<DateValue>
export type CalendarValue = DateValue | readonly DateValue[] | CalendarRangeValue | null
/** What leaving the Calendar while anchored does (spec "Range Cancel And Leave"). */
export type CalendarCommitOnBlur = "reset" | "select" | "clear"

export type CalendarEvent =
  | {
      readonly type: "NAVIGATE"
      readonly move: CalendarMove | PeriodMove
      readonly composing: boolean
    }
  | { readonly type: "CELL.FOCUS"; readonly date: CalendarDate; readonly modality: Modality }
  | { readonly type: "CELL.PRESS"; readonly date: CalendarDate; readonly modality: Modality }
  | { readonly type: "CELL.HOVER"; readonly date: CalendarDate }
  | { readonly type: "GRID.HOVER_END" }
  | { readonly type: "SELECT_FOCUSED"; readonly composing: boolean }
  | { readonly type: "PAGE"; readonly direction: 1 | -1; readonly modality: Modality }
  | { readonly type: "GRID.FOCUS"; readonly modality: Modality }
  | { readonly type: "GRID.BLUR" }
  /** The parent changed `focusedValue` (onProps). */
  | { readonly type: "FOCUS.SYNC" }
  /** `minValue` / `maxValue` changed (onProps): the focus is clamped. */
  | { readonly type: "CONSTRAINTS" }
  /** Escape while anchored (range mode): the anchor and preview go, the value stays. */
  | { readonly type: "CANCEL" }
  /** Focus or a press left the Calendar while anchored: `commitOnBlur` applies. */
  | { readonly type: "LEAVE" }
  /** The parent changed `value` (onProps): a range in progress is dropped. */
  | { readonly type: "VALUE.SYNC" }
  /** A press (or a held touch) on a selectable date starts a drag: the anchor (range mode). */
  | { readonly type: "DRAG.START"; readonly date: CalendarDate; readonly modality: Modality }
  /** The dragging pointer moved onto another date: the preview follows. */
  | { readonly type: "DRAG.MOVE"; readonly date: CalendarDate }
  /** Released: `date` is the last date moved onto (null: none, the press stays an anchor). */
  | {
      readonly type: "DRAG.END"
      readonly date: CalendarDate | null
      readonly modality: Modality
    }
  /** The browser took the pointer (pointercancel, a hidden page): the range in progress goes. */
  | { readonly type: "DRAG.CANCEL" }
  /** The heading button: one view up (days → months → years). */
  | { readonly type: "VIEW.UP"; readonly modality: Modality }
  /** Escape in a view above `minView`: one view down. */
  | { readonly type: "VIEW.DOWN" }

export interface CalendarProps extends NavigationOptions, PeriodOptions {
  /** The shown view (controllable): days, the months of a year, or a page of years. */
  readonly view?: CalendarView | undefined
  readonly defaultView?: CalendarView | undefined
  /** Translated by the adapter into `(view, { reason })`. */
  readonly onViewChange?: ((view: CalendarView, details: unknown) => void) | undefined
  /** The lowest and highest view (default "days" / "years"); the value is chosen in `minView`. */
  readonly minView?: CalendarView | undefined
  readonly maxView?: CalendarView | undefined
  /** The month view's availability, told the month's first day (never derived from its days). */
  readonly isMonthUnavailable?: ((month: CalendarDate) => boolean) | undefined
  /** The year view's availability, told the year's first day. */
  readonly isYearUnavailable?: ((year: CalendarDate) => boolean) | undefined
  /** Shown invalid whatever the value (a host field's own validity). */
  readonly invalid?: boolean | undefined
  /**
   * A date was chosen (single mode) or a range completed (range mode), also when the value
   * did not change: a picker closes on it. Not called for a refused or unselectable date.
   */
  readonly onDateSelect?:
    | ((date: CalendarDate, details: { readonly modality: Modality }) => void)
    | undefined
  readonly value?: CalendarValue | undefined
  readonly defaultValue?: CalendarValue | undefined
  /** Translated by the adapter into `(value, { reason, modality, cancel })`. */
  readonly onValueChange?: ((value: CalendarValue, details: unknown) => void) | undefined
  readonly focusedValue?: CalendarDate | undefined
  readonly defaultFocusedValue?: CalendarDate | undefined
  readonly onFocusedValueChange?: ((date: CalendarDate, details: unknown) => void) | undefined
  readonly selectionMode: CalendarSelectionMode
  /** `anchor`: the range's first end while one is being selected (range mode), else null. */
  readonly isDateUnavailable?:
    | ((date: CalendarDate, details: { readonly anchor: CalendarDate | null }) => boolean)
    | undefined
  readonly anchor?: CalendarDate | null | undefined
  readonly defaultAnchor?: CalendarDate | null | undefined
  readonly onAnchorChange?: ((anchor: CalendarDate | null, details: unknown) => void) | undefined
  /** Range length bounds in periods (days in the days view), both ends included. */
  readonly minRangeLength?: number | undefined
  readonly maxRangeLength?: number | undefined
  /** A range may contain unavailable dates (default false). */
  readonly allowsNonContiguousRanges?: boolean | undefined
  /** Default "reset". */
  readonly commitOnBlur?: CalendarCommitOnBlur | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  readonly calendar: Calendar
  readonly formatLocale: string
  readonly messages: CalendarMessages
  readonly id: string
  /** Moves DOM focus to the focused date's cell once the step is rendered (adapter). */
  readonly focusCell?: ((date: CalendarDate, modality?: Modality) => void) | undefined
}

export interface CalendarContext {
  /** The first day of the first visible month. */
  visibleStart: CalendarDate
  hovered: CalendarDate | null
  /** A drag selection is in progress (range mode, days view). */
  dragging: boolean
}

type Types = {
  props: CalendarProps
  events: CalendarEvent
  env: AnnouncerEnv
  context: CalendarContext
  values: "value" | "focusedValue" | "anchor" | "view"
}
type Args = ActionArgs<Types>

/** A committed range value (range mode), else null. */
export const rangeOf = (value: CalendarValue | undefined): CalendarRangeValue | null =>
  value != null && !Array.isArray(value) && "start" in (value as object)
    ? (value as CalendarRangeValue)
    : null

/** Values as a list (single: zero or one; range: its two ends). */
export const valuesOf = (value: CalendarValue | undefined): readonly DateValue[] => {
  if (value == null) return []
  if (Array.isArray(value)) return value
  const range = rangeOf(value)
  return range ? [range.start, range.end] : [value as DateValue]
}

/** Anchors equal by day (null equals null). */
const sameAnchor = (a: CalendarDate | null, b: CalendarDate | null) =>
  a === null || b === null ? a === b : isSameDay(a, b)

/** Same days in the same order: a new object for the same day is equal (reka-ui#2960). */
export function sameDays(a: CalendarValue, b: CalendarValue): boolean {
  const x = valuesOf(a)
  const y = valuesOf(b)
  return (
    x.length === y.length &&
    x.every((d, i) => {
      const other = y[i]
      return other !== undefined && isSameDay(d, other)
    })
  )
}

/** A date in the display calendar. */
export const display = (date: DateValue, calendar: Calendar): CalendarDate =>
  toCalendar(toCalendarDate(date), calendar)

/** The shown view: the value inside [minView, maxView]. */
export const viewIn = (
  view: CalendarView | undefined,
  props: Pick<CalendarProps, "minView" | "maxView">,
): CalendarView => clampView(view ?? "days", props.minView ?? "days", props.maxView ?? "years")

/** The consumer's availability, told the current anchor (days) or the period (months, years). */
export const unavailable = (
  props: Pick<CalendarProps, "isDateUnavailable" | "isMonthUnavailable" | "isYearUnavailable">,
  date: CalendarDate,
  anchor: CalendarDate | null = null,
  view: CalendarView = "days",
) =>
  (view === "days"
    ? props.isDateUnavailable?.(date, { anchor })
    : view === "months"
      ? props.isMonthUnavailable?.(date)
      : props.isYearUnavailable?.(date)) === true

/** The range module's period for a view. */
export const rangePeriod = (view: CalendarView) =>
  view === "days" ? "day" : view === "months" ? "month" : "year"

/**
 * Whether a date (a period's first day in the month and year views) can be chosen: enabled,
 * inside the constraints, available; while anchored (range mode) also a valid end for the
 * anchor (length bounds, no unavailable period inside).
 */
export function isSelectable(
  date: CalendarDate,
  props: CalendarProps,
  anchor: CalendarDate | null = null,
  view: CalendarView = "days",
): boolean {
  if (props.disabled || props.readOnly) return false
  if (view === "days" ? !isSameDay(clamp(date, props), date) : !periodAllowed(date, view, props))
    return false
  if (unavailable(props, date, anchor, view)) return false
  if (props.selectionMode !== "range" || anchor === null) return true
  return canEndRange(anchor, date, {
    minRangeLength: props.minRangeLength,
    maxRangeLength: props.maxRangeLength,
    isUnavailable: (d) => unavailable(props, d, anchor, view),
    allowsNonContiguousRanges: props.allowsNonContiguousRanges,
    period: rangePeriod(view),
  })
}

/**
 * Whether a press on `date` starts a drag selection (spec "Drag Selection"): range mode, the days
 * view, no anchor yet (a press while anchored ends the range by click), a selectable date.
 */
export const canStartDrag = (
  date: CalendarDate,
  props: CalendarProps,
  anchor: CalendarDate | null,
  view: CalendarView,
) =>
  props.selectionMode === "range" &&
  view === "days" &&
  anchor === null &&
  isSelectable(date, props, null, view)

/** The anchor in the display calendar, or null. */
const anchorOf = (args: Pick<Args, "values" | "props">): CalendarDate | null =>
  args.values.anchor ? toCalendar(args.values.anchor, args.props.calendar) : null

/** null as the runtime's fallback: no selection (a controlled null is a value). */
const EMPTY = null as unknown as DateValue
/** null as the anchor's fallback: no range in progress. */
const NO_ANCHOR = null as unknown as CalendarDate
/** The adapter always passes `defaultFocusedValue` (initialFocus with the clock's today). */
const EPOCH = new CalendarDate(1970, 1, 1)

const viewOf = (args: Pick<Args, "values" | "props">) => viewIn(args.values.view, args.props)

/** The focused date, or in the month and year views the focused period's first day. */
const focusedOf = (args: Pick<Args, "values" | "props">) =>
  periodStart(toCalendar(args.values.focusedValue, args.props.calendar), viewOf(args))

/** A view above `minView` drills down when a period is chosen (spec "View Drill-Down"). */
const drills = (args: Pick<Args, "values" | "props">) =>
  viewRank(viewOf(args)) > viewRank(args.props.minView ?? "days")

/** Whether pressing `date` does something: drills down, or selects it. */
function canChoose(args: Pick<Args, "values" | "props">, date: CalendarDate) {
  const view = viewOf(args)
  if (!drills(args)) return isSelectable(date, args.props, anchorOf(args), view)
  // Drilling is navigation: read-only and unavailable periods can be opened.
  return args.props.disabled !== true && periodAllowed(date, view, args.props)
}

/** Moves the focus (and the visible range with it). */
function focus(args: Args, date: CalendarDate, visibleStart: CalendarDate) {
  args.set("focusedValue", date)
  args.set("visibleStart", visibleStart)
}

/** A date's name in announcements: the full date, or the period ("March 2026"). */
const nameIn = (date: CalendarDate, view: CalendarView, props: CalendarProps) =>
  view === "days"
    ? fullDate(date, props.formatLocale, props.calendar)
    : periodName(date, view, props.formatLocale, props.calendar)

/** One step of a range selection: the first sets the anchor, the second commits. */
function rangeStep(args: Args, date: CalendarDate) {
  const { props, values, env } = args
  const view = viewOf(args)
  const anchor = anchorOf(args)
  if (anchor === null) {
    args.set("anchor", date)
    env.announcer.announce({
      message: props.messages.anchorSet({ anchor: nameIn(date, view, props) }),
      priority: "polite",
      key: `calendar-${props.id}-range`,
    })
    return
  }
  const { start, end } = makeRange(anchor, date)
  const current = rangeOf(values.value)
  const fallback = rangeOf(props.defaultValue)
  args.set("value", {
    start: toEmitted(start, current?.start ?? fallback?.start ?? null),
    end: toEmitted(end, current?.end ?? fallback?.end ?? null),
  })
  args.set("anchor", NO_ANCHOR)
  env.announcer.announce({
    message: props.messages.rangeSelected({
      start: nameIn(start, view, props),
      end: nameIn(end, view, props),
    }),
    priority: "polite",
    key: `calendar-${props.id}-range`,
  })
}

/**
 * The date a period choice emits (display calendar): the base with only its month, or only its
 * era and year, changed (the day clamped, 29 February to 28 February); else the period's first
 * day.
 */
function atPeriod(base: CalendarDate | null, period: CalendarDate, view: PeriodView) {
  if (base === null) return period
  return view === "months"
    ? period.set({ day: base.day })
    : base.set({ era: period.era, year: period.year })
}

function select(args: Args, date: CalendarDate) {
  const { props, values } = args
  const view = viewOf(args)
  const e = args.event
  const modality: Modality =
    e.type === "CELL.PRESS" || e.type === "DRAG.END" ? e.modality : "keyboard"
  if (props.selectionMode === "range") {
    const anchored = anchorOf(args) !== null
    rangeStep(args, date)
    // The second end closed a range (its value may equal the current one).
    if (anchored && anchorOf(args) === null) props.onDateSelect?.(date, { modality })
    return
  }
  const current = valuesOf(values.value)
  const base = current[0] ?? valuesOf(props.defaultValue)[0] ?? null
  const samePeriod = (d: DateValue) =>
    isSameDay(periodStart(display(d, props.calendar), view), date)
  const emitted =
    view === "days"
      ? toEmitted(date, base)
      : toEmitted(
          atPeriod(current[0] ? display(current[0], props.calendar) : null, date, view),
          base,
        )
  if (props.selectionMode === "multiple") {
    const without = current.filter((d) => !samePeriod(d))
    const next =
      without.length < current.length
        ? without
        : [...current, emitted].sort((a, b) => toCalendarDate(a).compare(toCalendarDate(b)))
    args.set("value", next)
    return
  }
  // Pressing the selected date (period) again keeps it selected (a host still sees the choice).
  if (!(current[0] && samePeriod(current[0]))) args.set("value", emitted)
  props.onDateSelect?.(date, { modality })
}

/** Shows `view` with the focus kept, its tab stop focused and its heading announced. */
function showView(args: Args, view: CalendarView, date: CalendarDate) {
  const focused = clamp(date, args.props)
  const shown = periodStart(focused, view)
  const visibleStart = align(focused, args.context.visibleStart, args.props)
  focus(args, focused, visibleStart)
  args.set("view", view)
  announceHeading(
    args.env,
    viewHeadingText(view, visibleStart, shown, args.props),
    args.props,
    "calendar",
  )
  requestCellFocus(args.props, shown)
}

/** One view down onto the chosen period, focused on its first day (or month). */
function drillDown(args: Args, date: CalendarDate) {
  const below = viewStep(viewOf(args), -1)
  if (below) showView(args, below, clamp(date, args.props))
}

export const calendarMachine = setup({
  types: type<Types>(),
  guards: {
    interactive: ({ props }) => props.disabled !== true,
    notComposing: ({ event }) =>
      !((event.type === "NAVIGATE" || event.type === "SELECT_FOCUSED") && event.composing),
    focusedSelectable: (args) => canChoose(args, focusedOf(args)),
    anchored: (args) => anchorOf(args) !== null,
    canDrag: (args) =>
      args.event.type === "DRAG.START" &&
      canStartDrag(args.event.date, args.props, anchorOf(args), viewOf(args)),
    dragging: ({ context }) => context.dragging,
    notDragging: ({ context }) => !context.dragging,
    // A press (pointer, touch, or a key on the focused trigger) has moved focus to the
    // trigger; a screen reader's click (virtual) has not, so the grid keeps focus and
    // repairs it after paging.
    pagedByPress: ({ event }) => event.type === "PAGE" && event.modality !== "virtual",
    canPage: (args) => {
      const { event, context, props } = args
      if (event.type !== "PAGE" || props.disabled === true) return false
      const view = viewOf(args)
      return view === "days"
        ? canPage(context.visibleStart, event.direction, props)
        : canPagePeriod(focusedOf(args), view, event.direction, props)
    },
    canViewUp: (args) => {
      const max = args.props.maxView ?? "years"
      return args.props.disabled !== true && viewRank(viewOf(args)) < viewRank(max)
    },
    canViewDown: (args) => drills(args),
  },
  actions: {
    move: (args) => {
      if (args.event.type !== "NAVIGATE") return
      const view = viewOf(args)
      const m = args.event.move
      const focused =
        view === "days"
          ? isPeriodMove(m)
            ? null
            : move(
                { focused: focusedOf(args), visibleStart: args.context.visibleStart },
                m,
                args.props,
              ).focused
          : isPeriodMove(m)
            ? clamp(movePeriod(focusedOf(args), view, m, args.props), args.props)
            : null
      if (focused === null) return
      focus(args, focused, align(focused, args.context.visibleStart, args.props))
      // The arrows move the preview even while the pointer rests on a cell.
      if (args.context.hovered !== null) args.set("hovered", null)
      requestCellFocus(args.props, focused)
    },
    page: (args) => {
      if (args.event.type !== "PAGE") return
      const view = viewOf(args)
      if (view !== "days") {
        const m = args.event.direction > 0 ? "next-page" : "previous-page"
        const focused = clamp(movePeriod(focusedOf(args), view, m, args.props), args.props)
        focus(args, focused, align(focused, args.context.visibleStart, args.props))
        return
      }
      const next = page(
        { focused: focusedOf(args), visibleStart: args.context.visibleStart },
        args.event.direction,
        args.props,
      )
      if (next) focus(args, next.focused, next.visibleStart)
    },
    /** Keyboard paging in the grid: the focus follows into the new month's cell. */
    focusAfterPage: (args) => requestCellFocus(args.props, focusedOf(args)),
    /** Paging from outside the grid announces the heading (the focused cell's name carries it inside). */
    announceRange: (args) => {
      const view = viewOf(args)
      if (view === "days")
        announceVisibleRange(args.env, args.context.visibleStart, args.props, "calendar")
      else
        announceHeading(
          args.env,
          viewHeadingText(view, args.context.visibleStart, focusedOf(args), args.props),
          args.props,
          "calendar",
        )
    },
    setFocused: (args) => {
      const t = args.event.type
      if (t !== "CELL.FOCUS" && t !== "CELL.PRESS" && t !== "DRAG.START") return
      const date = clamp(args.event.date, args.props)
      // A period's cell keeps the focused date when it is already inside that period.
      const same = isSameDay(periodStart(date, viewOf(args)), focusedOf(args))
      if (same) return
      focus(args, date, align(date, args.context.visibleStart, args.props))
    },
    pressFocus: (args) => {
      if (args.event.type !== "CELL.PRESS" && args.event.type !== "DRAG.START") return
      // A pointer press focuses the cell without a focus ring.
      requestCellFocus(args.props, args.event.date, args.event.modality)
    },
    selectPressed: (args) => {
      if (args.event.type !== "CELL.PRESS") return
      const date = periodStart(args.event.date, viewOf(args))
      if (!canChoose(args, date)) return
      if (drills(args)) drillDown(args, date)
      else select(args, date)
    },
    selectFocused: (args) => {
      if (drills(args)) drillDown(args, focusedOf(args))
      else select(args, focusedOf(args))
    },
    viewUp: (args) => {
      const above = viewStep(viewOf(args), 1)
      if (above) showView(args, above, toCalendar(args.values.focusedValue, args.props.calendar))
    },
    viewDown: (args) => {
      const below = viewStep(viewOf(args), -1)
      if (below) showView(args, below, toCalendar(args.values.focusedValue, args.props.calendar))
    },
    setHovered: ({ event, set }) => {
      if (event.type === "CELL.HOVER") set("hovered", event.date)
    },
    clearHovered: ({ set }) => set("hovered", null),
    /** The press sets the anchor; the preview starts on it. */
    dragStart: (args) => {
      if (args.event.type !== "DRAG.START") return
      args.set("dragging", true)
      args.set("hovered", args.event.date)
      rangeStep(args, args.event.date)
    },
    dragMove: ({ event, set }) => {
      if (event.type === "DRAG.MOVE") set("hovered", event.date)
    },
    /** A release on another valid end commits; on the anchor (or nowhere new) it stays. */
    dragEnd: (args) => {
      if (args.event.type !== "DRAG.END") return
      args.set("dragging", false)
      const date = args.event.date
      const anchor = anchorOf(args)
      if (date === null || anchor === null || isSameDay(date, anchor)) return
      if (isSelectable(date, args.props, anchor, viewOf(args))) select(args, date)
    },
    /** Escape, a parent's value, or leaving with "reset": the range in progress is dropped. */
    clearAnchor: (args) => {
      if (anchorOf(args) !== null) args.set("anchor", NO_ANCHOR)
      args.set("hovered", null)
      args.set("dragging", false)
    },
    /** Leaving while anchored: `commitOnBlur`. */
    leave: (args) => {
      const anchor = anchorOf(args)
      if (anchor === null) return
      args.set("dragging", false)
      const mode = args.props.commitOnBlur ?? "reset"
      if (mode === "select") {
        const end = args.context.hovered ?? focusedOf(args)
        if (isSelectable(end, args.props, anchor, viewOf(args))) {
          rangeStep(args, end)
          return
        }
      }
      if (mode === "clear") args.set("value", null as unknown as DateValue)
      args.set("anchor", NO_ANCHOR)
      args.set("hovered", null)
    },
    /** A parent's focusedValue: clamped, the range realigned, announced from outside the grid. */
    syncFocus: (args) => {
      const focused = toCalendar(args.values.focusedValue, args.props.calendar)
      const date = clamp(focused, args.props)
      const visibleStart = align(date, args.context.visibleStart, args.props)
      const view = viewOf(args)
      const before = viewHeadingText(view, args.context.visibleStart, focusedOf(args), args.props)
      if (!isSameDay(date, focused)) args.set("focusedValue", date)
      if (!isSameDay(visibleStart, args.context.visibleStart))
        args.set("visibleStart", visibleStart)
      const after = viewHeadingText(view, visibleStart, periodStart(date, view), args.props)
      if (after !== before) announceHeading(args.env, after, args.props, "calendar")
    },
    constrain: (args) => {
      const focused = toCalendar(args.values.focusedValue, args.props.calendar)
      const date = clamp(focused, args.props)
      if (!isSameDay(date, focused))
        focus(args, date, align(date, args.context.visibleStart, args.props))
    },
  },
  effects: {
    prepareAnnouncer,
  },
}).machine({
  id: "calendar",
  initial: "idle",
  context: (props) => {
    const focused = toCalendar(
      props.focusedValue ??
        props.defaultFocusedValue ??
        props.minValue ??
        props.calendar.fromJulianDay(0),
      props.calendar,
    )
    // The initial focus is clamped like every later one (a controlled value may be outside).
    const clamped = clamp(focused, props)
    return {
      visibleStart: align(clamped, clamped.set({ day: 1 }), props),
      hovered: null,
      dragging: false,
    }
  },
  values: {
    value: { fallback: EMPTY, equal: sameDays },
    focusedValue: focusedValueControllable(EPOCH),
    anchor: { fallback: NO_ANCHOR, equal: sameAnchor },
    view: { fallback: "days" },
  },
  effects: ["prepareAnnouncer"],
  onProps: {
    focusedValue: "FOCUS.SYNC",
    minValue: "CONSTRAINTS",
    maxValue: "CONSTRAINTS",
    // A new object with the same days (an inline value={{ start, end }}) is no change.
    value: { event: "VALUE.SYNC", equal: (a, b) => sameDays(a ?? null, b ?? null) },
  },
  on: {
    "CELL.HOVER": { actions: ["setHovered"] },
    // A drag out of the grid keeps the last date (spec "Drag Selection").
    "GRID.HOVER_END": { guard: "notDragging", actions: ["clearHovered"] },
    "DRAG.MOVE": { guard: "dragging", actions: ["dragMove"] },
    "DRAG.END": { guard: "dragging", actions: ["dragEnd"] },
    "DRAG.CANCEL": { guard: "dragging", actions: ["clearAnchor"] },
    "FOCUS.SYNC": { actions: ["syncFocus"] },
    CONSTRAINTS: { actions: ["constrain"] },
    // A parent's value (including null) drops a range in progress.
    "VALUE.SYNC": { guard: "anchored", actions: ["clearAnchor"] },
    // Consumed only while anchored (the connect sends it then); no anchor: it bubbles.
    CANCEL: { guard: "anchored", actions: ["clearAnchor"] },
    LEAVE: { guard: "anchored", actions: ["leave"] },
  },
  states: {
    idle: {
      on: {
        "GRID.FOCUS": { target: "focused", guard: "interactive" },
        // The heading button has focus; the new view's tab stop takes it.
        "VIEW.UP": { guard: "canViewUp", target: "focused", actions: ["viewUp"] },
        "VIEW.DOWN": { guard: "canViewDown", target: "focused", actions: ["viewDown"] },
        // The triggers page (keys move the focus instead): announced from outside the grid.
        PAGE: { guard: "canPage", actions: ["page", "announceRange"] },
        // A pointer press focuses the cell too; it selects only a selectable date.
        "CELL.PRESS": {
          guard: "interactive",
          target: "focused",
          actions: ["setFocused", "pressFocus", "selectPressed"],
        },
        "DRAG.START": {
          guard: "canDrag",
          target: "focused",
          actions: ["setFocused", "pressFocus", "dragStart"],
        },
      },
    },
    focused: {
      on: {
        "GRID.BLUR": "idle",
        "VIEW.UP": { guard: "canViewUp", actions: ["viewUp"] },
        "VIEW.DOWN": { guard: "canViewDown", actions: ["viewDown"] },
        NAVIGATE: { guard: "notComposing", actions: ["move"] },
        // Focus alone never selects (cause C).
        "CELL.FOCUS": { actions: ["setFocused"] },
        "CELL.PRESS": { actions: ["setFocused", "selectPressed"] },
        "DRAG.START": { guard: "canDrag", actions: ["setFocused", "dragStart"] },
        SELECT_FOCUSED: {
          guard: { and: ["notComposing", "focusedSelectable"] },
          actions: ["selectFocused"],
        },
        // No announcement: the focused cell's name carries the month.
        // A trigger press moves focus to the trigger: the grid is left.
        PAGE: [
          {
            guard: { and: ["canPage", "pagedByPress"] },
            target: "idle",
            actions: ["page", "announceRange"],
          },
          { guard: "canPage", actions: ["page", "focusAfterPage"] },
          // A press on a trigger at a bound (aria-disabled, still focusable) leaves the grid.
          { guard: "pagedByPress", target: "idle" },
        ],
      },
    },
  },
})
export type CalendarMachine = typeof calendarMachine

const PERIOD_MOVES: ReadonlySet<string> = new Set<PeriodMove>([
  "next",
  "previous",
  "next-row",
  "previous-row",
  "first",
  "last",
  "next-page",
  "previous-page",
])
function isPeriodMove(m: CalendarMove | PeriodMove): m is PeriodMove {
  return PERIOD_MOVES.has(m)
}
