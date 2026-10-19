// Date Field (design §3): `idle` / `editing` / `composing`. The draft (each segment's value
// and text) is context and is what the segments show; the controllable `value` changes only
// at commit points (date-segments "Commit Points"): auto-advance, leaving a segment, a
// separator, a step, a name match, paste, a segment cleared. Focus moves are requested from
// the adapter, which applies them after the step is rendered (react-spectrum#10683).

import type { Calendar, DateValue } from "@internationalized/date"
import {
  type CalendarDate,
  CalendarDateTime,
  Time,
  toCalendarDate,
  toCalendarDateTime,
  toZoned,
  ZonedDateTime,
} from "@internationalized/date"
import type { Modality } from "../../contract/env"
import type { FormInputCapability } from "../../dom/hidden-input"
import { setup, type } from "../../machine/setup"
import type { ActionArgs, ChangeDetails } from "../../machine/types"
import {
  type DateGranularity,
  type DateSegmentType,
  type Draft,
  digitOf,
  digitsText,
  draftHint,
  draftOf,
  edgeEntry,
  type FieldValue,
  isSeparator,
  limits,
  PAGE_STEP,
  parsePaste,
  partOf,
  planDigit,
  planName,
  reformat,
  type SegmentEntry,
  type SegmentFormat,
  segmentFormat,
  segmentText,
  shapeOf,
  stepEntry,
  stepZonedHour,
  toValue,
  type ValueShape,
} from "../date-segments"

export type DateFieldStepKey =
  | "INCREASE"
  | "DECREASE"
  | "PAGE_PREV"
  | "PAGE_NEXT"
  | "FIRST"
  | "LAST"

export type DateFieldEvent =
  | {
      readonly type: "SEGMENT.FOCUS"
      readonly segment: DateSegmentType
      readonly modality: Modality
    }
  /** Focus left a segment: to another of this field's segments, or out of the field. */
  | { readonly type: "SEGMENT.BLUR"; readonly related: "segment" | "outside" }
  /** Text the insertion plan accepted (digits, letters or a separator), one or more characters. */
  | { readonly type: "INPUT"; readonly segment: DateSegmentType; readonly data: string }
  | { readonly type: "COMPOSITION.START" }
  | {
      readonly type: "COMPOSITION.END"
      readonly segment: DateSegmentType
      readonly text: string
    }
  | {
      readonly type: DateFieldStepKey
      readonly segment: DateSegmentType
      readonly modality: Modality
    }
  /** ArrowRight / ArrowLeft (already mirrored): the visually adjacent segment. */
  | { readonly type: "NEXT" | "PREV"; readonly segment: DateSegmentType }
  | { readonly type: "BACKSPACE"; readonly segment: DateSegmentType }
  /** Select all, then Backspace or Delete. */
  | { readonly type: "CLEAR_ALL" }
  | { readonly type: "PASTE"; readonly text: string }
  | { readonly type: "RESET" }
  /** A picker's calendar picked a value (already of the field's type: `pickedValue`). */
  | { readonly type: "PICK"; readonly value: DateValue; readonly modality: Modality }
  /** A picker's Clear trigger: the value and every draft segment cleared. */
  | { readonly type: "CLEAR" }
  /** The hidden input changed behind the component (autofill): its ISO text. */
  | { readonly type: "INPUT.ADOPT"; readonly value: string }
  /** The controlled value changed (onProps). */
  | { readonly type: "VALUE.SYNCED" }
  /** Locale, calendar, granularity, hour cycle or zone display changed (onProps). */
  | { readonly type: "FORMAT.CHANGED" }

/** Public change reasons (spec "Commit Points"). */
export type DateFieldReason = "SEGMENT.COMMIT" | "STEP" | "PASTE" | "CLEAR" | "RESET" | "CALENDAR"

export type DateFieldBoundary = {
  readonly direction: "next" | "previous"
  readonly reason: "advance" | "backspace" | "arrow"
}

export interface DateFieldDraftHint {
  readonly year: number | null
  readonly month: number | null
  readonly day: number | null
}

export interface DateFieldProps {
  readonly value?: FieldValue | null | undefined
  readonly defaultValue?: FieldValue | null | undefined
  readonly onValueChange?:
    | ((value: FieldValue | null, details: ChangeDetails<DateFieldEvent>) => void)
    | undefined
  /** Resolved by the adapter: the prop, else today within the bounds at 00:00 (or a `Time`). */
  readonly placeholderValue: FieldValue
  /** The format locale (`date-values`: forced to gregorian when a calendar is missing). */
  readonly locale: string
  /** The display calendar. */
  readonly calendar: Calendar
  readonly granularity?: DateGranularity | undefined
  /** `hour`: no date segments (a time field; default for a `Time` value). */
  readonly maxGranularity?: "year" | "hour" | undefined
  readonly hourCycle?: 12 | 24 | undefined
  readonly hideTimeZone?: boolean | undefined
  readonly shouldForceLeadingZeros?: boolean | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  readonly onBoundary?: ((boundary: DateFieldBoundary) => void) | undefined
  readonly onDraftChange?: ((hint: DateFieldDraftHint) => void) | undefined
  /** Moves DOM focus to a segment once the step is rendered (adapter). */
  readonly focusSegment?: ((segment: DateSegmentType) => void) | undefined
  readonly id: string
}

/** The visual neighbour of a segment (core/dom `segmentLayout`); format order without one. */
export interface SegmentNavigation {
  /**
   * The segment next to `segment` on screen: one of this field's, `"external"` (a segment of
   * another field in the layout's scope, which the layout focused), or null.
   */
  adjacent(
    segment: DateSegmentType,
    direction: "next" | "previous",
  ): DateSegmentType | "external" | null
}

export interface DateFieldEnv {
  /** Absent where there is no DOM (a model test's oracle). */
  readonly formInput?: FormInputCapability | undefined
  readonly navigation?: SegmentNavigation | undefined
}

export interface DateFieldContext {
  draft: Draft
  /** The focused segment, while one is. */
  active: DateSegmentType | null
  /** The focused segment's typed text since focus (Latin digits or typed letters). */
  buffer: string
  /** The last draft hint reported (called only when it changes). */
  hint: DateFieldDraftHint
  /** The value this field proposed and the parent has not answered yet (controlled). */
  proposed: { readonly value: FieldValue | null } | null
  /** The format the draft's texts are in (a prop change reformats from it). */
  format: SegmentFormat
}

type Types = {
  props: DateFieldProps
  events: DateFieldEvent
  env: DateFieldEnv
  context: DateFieldContext
  values: "value"
}
type Args = ActionArgs<Types>

/** null as the runtime's fallback: the empty value (a controlled null is a value). */
const EMPTY = null as unknown as FieldValue

/** The same value: equal by `compare()` for its type, never a day-level check (zag#3117). */
export function sameDateValue(a: FieldValue | null, b: FieldValue | null): boolean {
  if (a === null || b === null) return a === b
  if (a.constructor !== b.constructor) return false
  if (a instanceof Time || b instanceof Time) {
    return a instanceof Time && b instanceof Time && a.compare(b) === 0
  }
  if (a instanceof ZonedDateTime && b instanceof ZonedDateTime) {
    return a.compare(b) === 0 && a.timeZone === b.timeZone
  }
  // Sound: both are the same class (checked above), so `compare` takes the other.
  return a.calendar.identifier === b.calendar.identifier && a.compare(b as never) === 0
}

const isBc = (v: FieldValue | null | undefined) =>
  v != null && !(v instanceof Time) && v.calendar.identifier === "gregory" && v.era === "BC"

/** The value's kind and zone: the value, else the default, else the placeholder. */
export function shapeFor(props: DateFieldProps, current: FieldValue | null): ValueShape {
  return shapeOf(current ?? props.defaultValue ?? props.placeholderValue)
}

/** The field's segment format now (cached by value). */
export function formatFor(props: DateFieldProps, current: FieldValue | null): SegmentFormat {
  const base = current ?? props.defaultValue ?? props.placeholderValue
  const zoned = base instanceof ZonedDateTime
  const time = base instanceof Time
  const granularity =
    props.granularity ??
    (time || base instanceof CalendarDateTime || base instanceof ZonedDateTime ? "minute" : "day")
  return segmentFormat({
    locale: props.locale,
    calendar: props.calendar,
    // A time of day has no date to show (spec "Time Values").
    granularity: time && granularity === "day" ? "minute" : granularity,
    maxGranularity: props.maxGranularity ?? (time ? "hour" : undefined),
    hourCycle: props.hourCycle,
    timeZone: zoned ? base.timeZone : "UTC",
    showTimeZone: zoned && props.hideTimeZone !== true,
    forceLeadingZeros: props.shouldForceLeadingZeros === true,
    bc: isBc(base),
  })
}

const current = (args: Pick<Args, "values">): FieldValue | null => args.values.value ?? null
const controlled = (props: DateFieldProps) => props.value !== undefined
const fmt = (args: Args) => formatFor(args.props, current(args))
const editable = (props: DateFieldProps) => props.disabled !== true && props.readOnly !== true

/** The value the draft stands for now, with where it stands. */
export function draftValue(draft: Draft, props: DateFieldProps, value: FieldValue | null) {
  const f = formatFor(props, value)
  return toValue(draft, f, shapeFor(props, value), value ?? props.placeholderValue, value)
}

/**
 * The one form-value normaliser (hidden input value, `min`, `max`): ISO text, a date-time or a
 * time truncated to the field's granularity so it never fails the input's `step`, and written
 * as the native `datetime-local` / `time` inputs normalise it (no zero seconds, no fractions).
 * A date bound of a date-time field is its midnight.
 */
export function formValueOf(
  v: FieldValue | null | undefined,
  granularity: DateGranularity = "second",
  kind?: "date" | "datetime" | "zoned" | "time",
): string {
  if (v === null || v === undefined) return ""
  if (v instanceof ZonedDateTime) return v.toString()
  const time = v instanceof CalendarDateTime || v instanceof Time ? v : null
  const two = (n: number) => String(n).padStart(2, "0")
  const hour = two(time?.hour ?? 0)
  const minute = granularity === "hour" ? "00" : two(time?.minute ?? 0)
  const second = granularity === "second" ? (time?.second ?? 0) : 0
  const clock = `${hour}:${minute}${second === 0 ? "" : `:${two(second)}`}`
  if (v instanceof Time) return clock
  if (!time && kind !== "datetime") return v.toString()
  return `${v.toString().slice(0, 10)}T${clock}`
}
/** The value as the hidden input holds it, at the field's granularity. */
const iso = (args: Args, v: FieldValue | null) =>
  formValueOf(v, formatFor(args.props, v).options.granularity)

function syncHidden(args: Args, v: FieldValue | null, dispatch: boolean) {
  args.env.formInput?.sync({ value: iso(args, v) }, { dispatch })
}

function reportHint(args: Args) {
  const hint = draftHint(args.context.draft)
  const last = args.context.hint
  if (hint.year === last.year && hint.month === last.month && hint.day === last.day) return
  args.set("hint", hint)
  args.props.onDraftChange?.(hint)
}

/**
 * A commit point: the draft becomes the value (a real date, or null) when it differs
 * (`onValueChange` once per change). The draft keeps its text.
 */
function commit(args: Args) {
  const { props, set, context } = args
  const next = draftValue(context.draft, props, current(args)).value
  const before = context.proposed ? context.proposed.value : current(args)
  reportHint(args)
  if (sameDateValue(before, next)) return
  set("value", next ?? EMPTY)
  if (controlled(props)) {
    set("proposed", { value: next })
    return
  }
  // Refused through details.cancel(): the draft shows the value again.
  if (!sameDateValue(current(args), next)) {
    set("draft", draftOf(current(args), fmt(args)))
    return
  }
  syncHidden(args, next, true)
}

function setEntry(args: Args, type: DateSegmentType, e: SegmentEntry | null) {
  const { [type]: _, ...rest } = args.context.draft
  args.set("draft", e === null ? rest : { ...rest, [type]: e })
}

/** The next or previous editable segment in format order. */
function neighbour(f: SegmentFormat, type: DateSegmentType, step: 1 | -1) {
  return f.editable[f.editable.indexOf(type) + step] ?? null
}

/** Moves to a segment: the one left is settled first (its text formatted). */
function focusSegment(args: Args, type: DateSegmentType) {
  settleActive(args)
  args.set("active", type)
  args.set("buffer", "")
  args.props.focusSegment?.(type)
}

/** Auto-advance after a commit: the next segment in format order, else the boundary. */
function advance(args: Args, from: DateSegmentType) {
  const next = neighbour(fmt(args), from, 1)
  if (next) focusSegment(args, next)
  else args.props.onBoundary?.({ direction: "next", reason: "advance" })
}

/** Typed text into a segment: digits, a separator, or a day period / era name. */
function typeText(args: Args, segment: DateSegmentType, text: string) {
  let type = segment
  for (const char of text) {
    const f = fmt(args)
    const { context } = args
    if (type === "dayPeriod" || type === "era") {
      const plan = planName(type, context.buffer + char, f)
      if (plan.kind === "reject") {
        if (isSeparator(char, f) && context.draft[type]) {
          commit(args)
          advance(args, type)
          type = args.context.active ?? type
        }
        continue
      }
      if (plan.kind === "partial") {
        args.set("buffer", plan.buffer)
        continue
      }
      setEntry(args, type, entryOf(type, plan.value, f))
      commit(args)
      advance(args, type)
      type = args.context.active ?? type
      continue
    }
    if (digitOf(char, f) === null) {
      // A separator in a non-empty segment advances (react-spectrum#5364).
      if (isSeparator(char, f) && (context.buffer !== "" || context.draft[type])) {
        commit(args)
        advance(args, type)
        type = args.context.active ?? type
      }
      continue
    }
    const plan = planDigit(type, char, context.buffer, context.draft, f)
    if (plan.kind !== "accept") continue
    setEntry(args, type, plan.entry)
    args.set("buffer", plan.buffer)
    if (!plan.advance) continue
    commit(args)
    const next = neighbour(f, type, 1)
    advance(args, type)
    // Further characters of one insertion go on into the next segment.
    if (next) type = next
  }
}

const entryOf = (type: DateSegmentType, n: number, f: SegmentFormat): SegmentEntry => ({
  value: n,
  text: segmentText(type, n, f),
})

/** A step key on a segment; an empty segment first takes the placeholder's part. */
function stepSegment(args: Args, type: DateSegmentType, key: DateFieldStepKey) {
  const { context, props } = args
  const f = fmt(args)
  const existing = context.draft[type]
  if (!existing || existing.value === null) {
    setEntry(args, type, partOf(type, props.placeholderValue, f))
  } else if (key === "FIRST" || key === "LAST") {
    setEntry(args, type, edgeEntry(type, context.draft, key === "FIRST" ? "min" : "max", f))
  } else {
    const amount =
      (key === "INCREASE" || key === "PAGE_PREV" ? 1 : -1) *
      (key === "PAGE_PREV" || key === "PAGE_NEXT" ? PAGE_STEP[type] : 1)
    const now = draftValue(context.draft, props, current(args)).value
    if (type === "hour" && now instanceof ZonedDateTime) {
      // Zoned arithmetic: a repeated hour is reachable twice, a skipped one is skipped.
      const next = stepZonedHour(now, amount, f)
      args.set("draft", draftOf(next, f))
      args.set("buffer", "")
      commitZoned(args, next)
      return
    }
    setEntry(args, type, stepEntry(type, context.draft, amount, f))
  }
  args.set("buffer", "")
  commit(args)
}

/** A zoned step whose occurrence (offset) the draft alone cannot tell. */
function commitZoned(args: Args, next: ZonedDateTime) {
  const { props, set, context } = args
  reportHint(args)
  const before = context.proposed ? context.proposed.value : current(args)
  if (sameDateValue(before, next)) return
  set("value", next)
  if (controlled(props)) set("proposed", { value: next })
  else if (sameDateValue(current(args), next)) syncHidden(args, next, true)
}

/** Backspace: the last typed digit (a name segment: all of it); an empty segment goes back. */
function backspace(args: Args, type: DateSegmentType) {
  const { context } = args
  const f = fmt(args)
  const e = context.draft[type]
  if (!e) {
    const previous = neighbour(f, type, -1)
    if (previous) focusSegment(args, previous)
    else args.props.onBoundary?.({ direction: "previous", reason: "backspace" })
    return
  }
  const digits = [...e.text].map((c) => digitOf(c, f))
  if (type === "era" || type === "dayPeriod" || digits.some((d) => d === null)) {
    setEntry(args, type, null)
  } else {
    const rest = digits.slice(0, -1).join("")
    if (rest === "") setEntry(args, type, null)
    else {
      const n = Number(rest)
      const { min } = limits(type, context.draft, f)
      const value = type === "hour" && f.hour12 ? n % 12 : n < min ? null : n
      setEntry(args, type, { value, text: digitsText(rest, f) })
    }
    args.set("buffer", rest)
  }
  // A cleared segment is a commit point (the form value follows: react-spectrum#9801).
  if (!args.context.draft[type]) {
    args.set("buffer", "")
    commit(args)
  }
}

/** Leaving a segment: its typed text is shown formatted, keeping typed leading zeros. */
function settleActive(args: Args) {
  const type = args.context.active
  if (type === null) return
  const e = args.context.draft[type]
  if (e && e.value !== null) {
    const formatted = entryOf(type, e.value, fmt(args))
    const keep = e.text.length > formatted.text.length
    if (!keep && formatted.text !== e.text) setEntry(args, type, formatted)
  }
  if (e && e.value === null) setEntry(args, type, null)
}

/** ISO text of the hidden input as a value of the field's kind (null when not one). */
function parseAdopted(text: string, props: DateFieldProps, value: FieldValue | null) {
  if (text === "") return null
  const f = formatFor(props, value)
  // The hidden input's ISO text is the field's own value format.
  return parsePaste(text, f, shapeFor(props, value), value ?? props.placeholderValue)
}

export const dateFieldMachine = setup({
  types: type<Types>(),
  guards: {
    editable: ({ props }) => editable(props),
    /** Focus left the field (not another of its segments). */
    leaves: ({ event }) => event.type === "SEGMENT.BLUR" && event.related === "outside",
  },
  actions: {
    setActive: ({ event, set, context }) => {
      // The focus this field requested arriving: the segment's typing goes on.
      if (event.type !== "SEGMENT.FOCUS" || event.segment === context.active) return
      set("active", event.segment)
      set("buffer", "")
    },
    /** Focus moved to another segment: the one left commits. */
    commitPrevious: (args) => {
      if (args.event.type !== "SEGMENT.FOCUS" || args.event.segment === args.context.active) return
      settleActive(args)
      commit(args)
    },
    leave: (args) => {
      settleActive(args)
      args.set("active", null)
      args.set("buffer", "")
      commit(args)
    },
    type: (args) => {
      const { event } = args
      if (event.type === "INPUT") typeText(args, event.segment, event.data)
      if (event.type === "COMPOSITION.END") {
        args.set("buffer", "")
        typeText(args, event.segment, event.text)
      }
    },
    step: (args) => {
      const { event } = args
      if (!("modality" in event) || event.type === "SEGMENT.FOCUS" || event.type === "PICK") return
      stepSegment(args, event.segment, event.type)
    },
    moveVisual: (args) => {
      const { event, env } = args
      if (event.type !== "NEXT" && event.type !== "PREV") return
      const direction = event.type === "NEXT" ? "next" : "previous"
      const f = fmt(args)
      const target =
        env.navigation?.adjacent(event.segment, direction) ??
        // No layout (a model test's oracle): format order.
        (env.navigation ? null : neighbour(f, event.segment, event.type === "NEXT" ? 1 : -1))
      if (target === "external") return
      if (target === null) args.props.onBoundary?.({ direction, reason: "arrow" })
      else focusSegment(args, target)
    },
    backspace: (args) => {
      if (args.event.type === "BACKSPACE") backspace(args, args.event.segment)
    },
    clearAll: (args) => {
      args.set("draft", {})
      args.set("buffer", "")
      commit(args)
    },
    paste: (args) => {
      if (args.event.type !== "PASTE") return
      const { props } = args
      const value = current(args)
      const f = formatFor(props, value)
      const parsed = parsePaste(
        args.event.text,
        f,
        shapeFor(props, value),
        value ?? props.placeholderValue,
      )
      if (parsed === null) return
      args.set("draft", draftOf(parsed, f))
      args.set("buffer", "")
      commit(args)
    },
    restoreDefault: (args) => {
      const { props, set } = args
      const v = props.defaultValue ?? null
      set("draft", draftOf(v, formatFor(props, v)))
      set("buffer", "")
      reportHint(args)
      if (sameDateValue(current(args), v)) return
      set("value", v ?? EMPTY)
      if (controlled(props)) set("proposed", { value: v })
    },
    pick: (args) => {
      if (args.event.type !== "PICK") return
      args.set("draft", draftOf(args.event.value, formatFor(args.props, args.event.value)))
      args.set("buffer", "")
      commit(args)
    },
    adopt: (args) => {
      if (args.event.type !== "INPUT.ADOPT") return
      const v = parseAdopted(args.event.value, args.props, current(args))
      args.set("draft", draftOf(v, formatFor(args.props, v)))
      args.set("buffer", "")
      commit(args)
    },
    resyncHidden: (args) => syncHidden(args, current(args), false),
    /**
     * The controlled value arrived: the draft follows a value it does not already stand
     * for (a parent's own change, null included, even while a segment is focused: bits-ui#2174).
     */
    applySynced: (args) => {
      const { context, props, set } = args
      const v = current(args)
      const met = context.proposed !== null && sameDateValue(context.proposed.value, v)
      set("proposed", null)
      syncHidden(args, v, met)
      if (!sameDateValue(draftValue(context.draft, props, v).value, v)) {
        set("draft", draftOf(v, formatFor(props, v)))
        set("buffer", "")
        reportHint(args)
      }
    },
    /** A refused proposal: the draft shows the value again. */
    revert: (args) => {
      const v = current(args)
      args.set("proposed", null)
      args.set("draft", draftOf(v, formatFor(args.props, v)))
      args.set("buffer", "")
      syncHidden(args, v, false)
    },
    /** The segments recomputed: values kept, focus kept on the same type (reka-ui#1127). */
    reformat: (args) => {
      const { props, context, set } = args
      const v = current(args)
      const to = formatFor(props, v)
      const base = v ?? props.placeholderValue
      set("draft", reformat(context.draft, context.format, to, shapeFor(props, v), base))
      set("format", to)
      if (context.active && to.editable.includes(context.active)) {
        props.focusSegment?.(context.active)
      }
    },
  },
}).machine({
  id: "date-field",
  initial: "idle",
  context: (props) => {
    const v = props.value ?? props.defaultValue ?? null
    const draft = draftOf(v, formatFor(props, v))
    return {
      draft,
      active: null,
      buffer: "",
      hint: draftHint(draft),
      proposed: null,
      format: formatFor(props, v),
    }
  },
  values: { value: { fallback: EMPTY, equal: sameDateValue } },
  onProps: {
    value: "VALUE.SYNCED",
    locale: "FORMAT.CHANGED",
    calendar: "FORMAT.CHANGED",
    granularity: "FORMAT.CHANGED",
    hourCycle: "FORMAT.CHANGED",
    hideTimeZone: "FORMAT.CHANGED",
    shouldForceLeadingZeros: "FORMAT.CHANGED",
  },
  on: {
    RESET: { actions: ["restoreDefault"] },
    PICK: { guard: "editable", actions: ["pick"] },
    CLEAR: { guard: "editable", actions: ["clearAll"] },
    "INPUT.ADOPT": [{ guard: "editable", actions: ["adopt"] }, { actions: ["resyncHidden"] }],
    "VALUE.SYNCED": { actions: ["applySynced"] },
    "FORMAT.CHANGED": { actions: ["reformat"] },
    $reverted: { actions: ["revert"] },
  },
  states: {
    idle: {
      on: {
        "SEGMENT.FOCUS": { target: "editing", actions: ["setActive"] },
      },
    },
    editing: {
      on: {
        "SEGMENT.FOCUS": { actions: ["commitPrevious", "setActive"] },
        "SEGMENT.BLUR": { guard: "leaves", target: "idle", actions: ["leave"] },
        INPUT: { guard: "editable", actions: ["type"] },
        INCREASE: { guard: "editable", actions: ["step"] },
        DECREASE: { guard: "editable", actions: ["step"] },
        PAGE_PREV: { guard: "editable", actions: ["step"] },
        PAGE_NEXT: { guard: "editable", actions: ["step"] },
        FIRST: { guard: "editable", actions: ["step"] },
        LAST: { guard: "editable", actions: ["step"] },
        NEXT: { actions: ["moveVisual"] },
        PREV: { actions: ["moveVisual"] },
        BACKSPACE: { guard: "editable", actions: ["backspace"] },
        CLEAR_ALL: { guard: "editable", actions: ["clearAll"] },
        PASTE: { guard: "editable", actions: ["paste"] },
        "COMPOSITION.START": { guard: "editable", target: "composing" },
      },
    },
    // Keys and filtering are off while an IME composes; its text arrives at the end.
    composing: {
      on: {
        "COMPOSITION.END": [
          { guard: "editable", target: "editing", actions: ["type"] },
          { target: "editing" },
        ],
        "SEGMENT.BLUR": { guard: "leaves", target: "idle", actions: ["leave"] },
      },
    },
  },
})

export type DateFieldMachine = typeof dateFieldMachine

/**
 * The default `placeholderValue` (spec "Placeholders"): today, inside the bounds, at 00:00,
 * of the field's kind — a date-time when the granularity shows a time, zoned in `timeZone`;
 * a `Time` (00:00) for a time field with no zone (`maxGranularity: "hour"`).
 */
export function defaultPlaceholderValue(o: {
  readonly today: CalendarDate
  readonly granularity?: DateGranularity | undefined
  readonly maxGranularity?: "year" | "hour" | undefined
  readonly timeZone?: string | undefined
  readonly minValue?: FieldValue | null | undefined
  readonly maxValue?: FieldValue | null | undefined
}): FieldValue {
  if (o.maxGranularity === "hour" && !o.timeZone) return new Time()
  let day = o.today
  const min = o.minValue instanceof Time ? null : o.minValue
  const max = o.maxValue instanceof Time ? null : o.maxValue
  if (min && day.compare(toCalendarDate(min)) < 0) day = toCalendarDate(min)
  if (max && day.compare(toCalendarDate(max)) > 0) day = toCalendarDate(max)
  if (o.timeZone) return toZoned(toCalendarDateTime(day), o.timeZone)
  if (o.granularity && o.granularity !== "day") return toCalendarDateTime(day)
  return day
}
