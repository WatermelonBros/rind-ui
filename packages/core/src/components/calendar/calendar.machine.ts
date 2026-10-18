// Calendar (design §3): `idle` / `focused` (only "is the grid focused" changes behaviour), a
// controllable value (by day) and focused date; the visible start is context, the grids are
// derived. Dates in context are in the display calendar; emitted values keep the caller's type,
// calendar and time (toEmitted). Runs in Node: "today" comes from the injected date clock.

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
import { fullDate, toEmitted } from "../../i18n/date"
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
  announceVisibleRange,
  focusedValueControllable,
  prepareAnnouncer,
  requestCellFocus,
} from "./calendar.pieces"
import { canEndRange, type DateRange, makeRange } from "./calendar.range"

export type CalendarSelectionMode = "single" | "multiple" | "range"
/** A committed range: `start ≤ end`, each end keeping its own type, calendar and time. */
export type CalendarRangeValue = DateRange<DateValue>
export type CalendarValue = DateValue | readonly DateValue[] | CalendarRangeValue | null
/** What leaving the Calendar while anchored does (spec "Range Cancel And Leave"). */
export type CalendarCommitOnBlur = "reset" | "select" | "clear"

export type CalendarEvent =
  | { readonly type: "NAVIGATE"; readonly move: CalendarMove; readonly composing: boolean }
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

export interface CalendarProps extends NavigationOptions {
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
  /** Range length bounds in days, both ends included. */
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
  /** The first day of the first visible month (display calendar). */
  visibleStart: CalendarDate
  hovered: CalendarDate | null
}

type Types = {
  props: CalendarProps
  events: CalendarEvent
  env: AnnouncerEnv
  context: CalendarContext
  values: "value" | "focusedValue" | "anchor"
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

/** The consumer's availability, told the current anchor. */
export const unavailable = (
  props: Pick<CalendarProps, "isDateUnavailable">,
  date: CalendarDate,
  anchor: CalendarDate | null = null,
) => props.isDateUnavailable?.(date, { anchor }) === true

/**
 * Whether a date can be chosen: enabled, inside the constraints, available; while anchored
 * (range mode) also a valid end for the anchor (length bounds, no unavailable date inside).
 */
export function isSelectable(
  date: CalendarDate,
  props: CalendarProps,
  anchor: CalendarDate | null = null,
): boolean {
  if (props.disabled || props.readOnly) return false
  if (!isSameDay(clamp(date, props), date)) return false
  if (unavailable(props, date, anchor)) return false
  if (props.selectionMode !== "range" || anchor === null) return true
  return canEndRange(anchor, date, {
    minRangeLength: props.minRangeLength,
    maxRangeLength: props.maxRangeLength,
    isUnavailable: (d) => unavailable(props, d, anchor),
    allowsNonContiguousRanges: props.allowsNonContiguousRanges,
  })
}

/** The anchor in the display calendar, or null. */
const anchorOf = (args: Pick<Args, "values" | "props">): CalendarDate | null =>
  args.values.anchor ? toCalendar(args.values.anchor, args.props.calendar) : null

/** null as the runtime's fallback: no selection (a controlled null is a value). */
const EMPTY = null as unknown as DateValue
/** null as the anchor's fallback: no range in progress. */
const NO_ANCHOR = null as unknown as CalendarDate
/** The adapter always passes `defaultFocusedValue` (initialFocus with the clock's today). */
const EPOCH = new CalendarDate(1970, 1, 1)

const focusedOf = (args: Pick<Args, "values" | "props">) =>
  toCalendar(args.values.focusedValue, args.props.calendar)

/** Moves the focus (and the visible range with it). */
function focus(args: Args, date: CalendarDate, visibleStart: CalendarDate) {
  args.set("focusedValue", date)
  args.set("visibleStart", visibleStart)
}

/** One step of a range selection: the first sets the anchor, the second commits. */
function rangeStep(args: Args, date: CalendarDate) {
  const { props, values, env } = args
  const anchor = anchorOf(args)
  if (anchor === null) {
    args.set("anchor", date)
    env.announcer.announce({
      message: props.messages.anchorSet({
        anchor: fullDate(date, props.formatLocale, props.calendar),
      }),
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
      start: fullDate(start, props.formatLocale, props.calendar),
      end: fullDate(end, props.formatLocale, props.calendar),
    }),
    priority: "polite",
    key: `calendar-${props.id}-range`,
  })
}

function select(args: Args, date: CalendarDate) {
  const { props, values } = args
  if (props.selectionMode === "range") {
    rangeStep(args, date)
    return
  }
  const current = valuesOf(values.value)
  const base = current[0] ?? valuesOf(props.defaultValue)[0] ?? null
  const emitted = toEmitted(date, base)
  if (props.selectionMode === "multiple") {
    const without = current.filter((d) => !isSameDay(d, date))
    const next =
      without.length < current.length
        ? without
        : [...current, emitted].sort((a, b) => toCalendarDate(a).compare(toCalendarDate(b)))
    args.set("value", next)
    return
  }
  // Pressing the selected date again keeps it selected.
  if (current[0] && isSameDay(current[0], date)) return
  args.set("value", emitted)
}

export const calendarMachine = setup({
  types: type<Types>(),
  guards: {
    interactive: ({ props }) => props.disabled !== true,
    notComposing: ({ event }) =>
      !((event.type === "NAVIGATE" || event.type === "SELECT_FOCUSED") && event.composing),
    focusedSelectable: (args) => isSelectable(focusedOf(args), args.props, anchorOf(args)),
    anchored: (args) => anchorOf(args) !== null,
    // A press (pointer, touch, or a key on the focused trigger) has moved focus to the
    // trigger; a screen reader's click (virtual) has not, so the grid keeps focus and
    // repairs it after paging.
    pagedByPress: ({ event }) => event.type === "PAGE" && event.modality !== "virtual",
    canPage: ({ event, context, props }) =>
      event.type === "PAGE" &&
      props.disabled !== true &&
      canPage(context.visibleStart, event.direction, props),
  },
  actions: {
    move: (args) => {
      if (args.event.type !== "NAVIGATE") return
      const next = move(
        { focused: focusedOf(args), visibleStart: args.context.visibleStart },
        args.event.move,
        args.props,
      )
      focus(args, next.focused, next.visibleStart)
      // The arrows move the preview even while the pointer rests on a cell.
      if (args.context.hovered !== null) args.set("hovered", null)
      requestCellFocus(args.props, next.focused)
    },
    page: (args) => {
      if (args.event.type !== "PAGE") return
      const next = page(
        { focused: focusedOf(args), visibleStart: args.context.visibleStart },
        args.event.direction,
        args.props,
      )
      if (next) focus(args, next.focused, next.visibleStart)
    },
    /** Keyboard paging in the grid: the focus follows into the new month's cell. */
    focusAfterPage: (args) => requestCellFocus(args.props, focusedOf(args)),
    /** Paging from outside the grid announces the range (the focused cell's name carries it inside). */
    announceRange: (args) =>
      announceVisibleRange(args.env, args.context.visibleStart, args.props, "calendar"),
    setFocused: (args) => {
      if (args.event.type !== "CELL.FOCUS" && args.event.type !== "CELL.PRESS") return
      const date = clamp(args.event.date, args.props)
      focus(args, date, align(date, args.context.visibleStart, args.props))
    },
    pressFocus: (args) => {
      if (args.event.type !== "CELL.PRESS") return
      // A pointer press focuses the cell without a focus ring.
      requestCellFocus(args.props, args.event.date, args.event.modality)
    },
    selectPressed: (args) => {
      if (
        args.event.type === "CELL.PRESS" &&
        isSelectable(args.event.date, args.props, anchorOf(args))
      ) {
        select(args, args.event.date)
      }
    },
    selectFocused: (args) => select(args, focusedOf(args)),
    setHovered: ({ event, set }) => {
      if (event.type === "CELL.HOVER") set("hovered", event.date)
    },
    clearHovered: ({ set }) => set("hovered", null),
    /** Escape, a parent's value, or leaving with "reset": the range in progress is dropped. */
    clearAnchor: (args) => {
      if (anchorOf(args) !== null) args.set("anchor", NO_ANCHOR)
      args.set("hovered", null)
    },
    /** Leaving while anchored: `commitOnBlur`. */
    leave: (args) => {
      const anchor = anchorOf(args)
      if (anchor === null) return
      const mode = args.props.commitOnBlur ?? "reset"
      if (mode === "select") {
        const end = args.context.hovered ?? focusedOf(args)
        if (isSelectable(end, args.props, anchor)) {
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
      const date = clamp(focusedOf(args), args.props)
      const visibleStart = align(date, args.context.visibleStart, args.props)
      if (!isSameDay(date, focusedOf(args))) args.set("focusedValue", date)
      if (!isSameDay(visibleStart, args.context.visibleStart)) {
        args.set("visibleStart", visibleStart)
        announceVisibleRange(args.env, visibleStart, args.props, "calendar")
      }
    },
    constrain: (args) => {
      const date = clamp(focusedOf(args), args.props)
      if (!isSameDay(date, focusedOf(args)))
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
    return { visibleStart: align(clamped, clamped.set({ day: 1 }), props), hovered: null }
  },
  values: {
    value: { fallback: EMPTY, equal: sameDays },
    focusedValue: focusedValueControllable(EPOCH),
    anchor: { fallback: NO_ANCHOR, equal: sameAnchor },
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
    "GRID.HOVER_END": { actions: ["clearHovered"] },
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
        // The triggers page (keys move the focus instead): announced from outside the grid.
        PAGE: { guard: "canPage", actions: ["page", "announceRange"] },
        // A pointer press focuses the cell too; it selects only a selectable date.
        "CELL.PRESS": {
          guard: "interactive",
          target: "focused",
          actions: ["setFocused", "pressFocus", "selectPressed"],
        },
      },
    },
    focused: {
      on: {
        "GRID.BLUR": "idle",
        NAVIGATE: { guard: "notComposing", actions: ["move"] },
        // Focus alone never selects (cause C).
        "CELL.FOCUS": { actions: ["setFocused"] },
        "CELL.PRESS": { actions: ["setFocused", "selectPressed"] },
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
        ],
      },
    },
  },
})
export type CalendarMachine = typeof calendarMachine
