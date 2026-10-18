// Range mode's coordinator (date-field spec "Range Mode — …"): two embedded Date Fields are the
// ends; this machine holds what each committed and its own validity, derives the pair's public
// value (`onValueChange` once per derived change) and pushes a parent's value or a clear back
// to the ends. It never edits an end on its own (spec "Ends Never Edit Each Other").

import type { DateValue } from "@internationalized/date"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"
import { type DateValidityFlags, validityFlags } from "../date-segments"
import type { DateFieldMessages } from "./date-field.messages"
import {
  type DateRangeEdge,
  type DateRangeEnd,
  type DateRangeEndValue,
  type DateRangeRules,
  type DateRangeState,
  type DateRangeValue,
  deriveRange,
  sameRange,
} from "./date-range"

export type DateRangeFieldValue = DateRangeValue<DateRangeEndValue> | null

export type DateRangeFieldEvent =
  /** An end committed a new value (its own commit points). */
  | {
      readonly type: "START.COMMIT" | "END.COMMIT"
      readonly value: DateRangeEndValue | null
      readonly reason: string
    }
  /** An end's own validity (embedded fields report it after mount and on change). */
  | {
      readonly type: "START.VALIDITY" | "END.VALIDITY"
      readonly message: string
      readonly flags: DateValidityFlags
    }
  /** The parent changed `value` (onProps). */
  | { readonly type: "VALUE.SYNC" }
  /** Select all + Backspace, or the clear trigger: both ends. */
  | { readonly type: "CLEAR" }
  /** A picker's calendar completed a range (each end already of the field's type). */
  | { readonly type: "PICK"; readonly start: DateValue; readonly end: DateValue }
  /** A form reset: the default range. */
  | { readonly type: "RESET" }

export interface DateRangeFieldProps extends DateRangeRules {
  readonly value?: DateRangeFieldValue | undefined
  readonly defaultValue?: DateRangeFieldValue | undefined
  readonly onValueChange?:
    | ((value: DateRangeFieldValue, details: ChangeDetails<DateRangeFieldEvent>) => void)
    | undefined
  readonly messages: DateFieldMessages
}

export interface DateRangeFieldContext {
  readonly start: DateRangeEnd
  readonly end: DateRangeEnd
  /** What each embedded end is told to show (its controlled value). */
  readonly startValue: DateRangeEndValue | null
  readonly endValue: DateRangeEndValue | null
  /** The last value this pair emitted: a parent applying it is not a new value. */
  readonly emitted: DateRangeFieldValue
}

const VALID = validityFlags(null)
const endOf = (value: DateRangeEndValue | null): DateRangeEnd => ({
  value,
  message: "",
  flags: VALID,
})
/** null as the runtime's fallback: no range (a controlled null is a value). */
const NONE = null as unknown as DateRangeValue<DateRangeEndValue>

type Types = {
  props: DateRangeFieldProps
  events: DateRangeFieldEvent
  env: Record<string, never>
  context: DateRangeFieldContext
  values: "value"
}

/** The pair's state from the context (value, message, flags, the invalid end). */
export const rangeStateOf = (
  context: Pick<DateRangeFieldContext, "start" | "end">,
  props: DateRangeFieldProps,
): DateRangeState => deriveRange(context.start, context.end, props, props.messages)

export const dateRangeFieldMachine = setup({
  types: type<Types>(),
  guards: {
    /** A parent's value that is not the one this pair just emitted. */
    newFromParent: ({ values, context }) => !sameRange(values.value ?? null, context.emitted),
  },
  actions: {
    commitEnd: ({ event, set }) => {
      if (event.type === "START.COMMIT") {
        set("start", { value: event.value, message: "", flags: VALID })
        set("startValue", event.value)
      } else if (event.type === "END.COMMIT") {
        set("end", { value: event.value, message: "", flags: VALID })
        set("endValue", event.value)
      }
    },
    validityOfEnd: ({ event, context, set }) => {
      if (event.type === "START.VALIDITY") {
        set("start", { ...context.start, message: event.message, flags: event.flags })
      } else if (event.type === "END.VALIDITY") {
        set("end", { ...context.end, message: event.message, flags: event.flags })
      }
    },
    /** The derived value, emitted once when it changes. */
    derive: ({ context, props, values, set }) => {
      const next = rangeStateOf(context, props).value
      if (sameRange(next, values.value ?? null)) return
      set("emitted", next)
      set("value", next ?? NONE)
    },
    /** A parent's value (or a clear, or a reset) replaces both ends and their partial text. */
    pushValue: ({ event, values, props, set }) => {
      const v: DateRangeFieldValue =
        event.type === "CLEAR"
          ? null
          : event.type === "PICK"
            ? { start: event.start, end: event.end }
            : event.type === "RESET"
              ? (props.defaultValue ?? null)
              : (values.value ?? null)
      set("start", endOf(v?.start ?? null))
      set("end", endOf(v?.end ?? null))
      set("startValue", v?.start ?? null)
      set("endValue", v?.end ?? null)
      set("emitted", v)
    },
  },
}).machine({
  id: "date-range-field",
  initial: "idle",
  context: (props) => {
    const v = props.value ?? props.defaultValue ?? null
    return {
      start: endOf(v?.start ?? null),
      end: endOf(v?.end ?? null),
      startValue: v?.start ?? null,
      endValue: v?.end ?? null,
      emitted: v,
    }
  },
  values: { value: { fallback: NONE, equal: (a, b) => sameRange(a ?? null, b ?? null) } },
  onProps: { value: "VALUE.SYNC" },
  states: {
    idle: {
      on: {
        "START.COMMIT": { actions: ["commitEnd", "derive"] },
        "END.COMMIT": { actions: ["commitEnd", "derive"] },
        "START.VALIDITY": { actions: ["validityOfEnd"] },
        "END.VALIDITY": { actions: ["validityOfEnd"] },
        "VALUE.SYNC": { guard: "newFromParent", actions: ["pushValue"] },
        CLEAR: { reason: "CLEAR", actions: ["pushValue", "derive"] },
        PICK: { reason: "CALENDAR", actions: ["pushValue", "derive"] },
        RESET: { reason: "RESET", actions: ["pushValue", "derive"] },
      },
    },
  },
})
export type DateRangeFieldMachine = typeof dateRangeFieldMachine
export type { DateRangeEdge, DateValue }
