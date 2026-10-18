// Range mode parts (date-field spec "Range Mode — Names And Description", "Hidden Inputs And
// Form", "Data Attributes"): the one group of both ends, the ends and the separator, the ends'
// hidden names, the value description and the two hidden native inputs. The segments are the
// embedded fields' own.

import { type Calendar, type DateValue, Time } from "@internationalized/date"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import { hiddenFormInputStyle } from "../../dom/hidden-input"
import { visuallyHiddenStyle } from "../../dom/visually-hidden"
import { dateFormatter } from "../../i18n/date"
import type { DateGranularity } from "../date-segments"
import type { FieldControlProps } from "../shared/field-control"
import { valueKind } from "./date-field.connect"
import { formValueOf } from "./date-field.machine"
import type { DateFieldMessages } from "./date-field.messages"
import type { DateRangeEdge, DateRangeState } from "./date-range"

export interface DateRangeConnectInput {
  readonly instance: string
  readonly state: DateRangeState
  /** The ends' committed values (what they show). */
  readonly start: DateValue | null
  readonly end: DateValue | null
  readonly granularity: DateGranularity
  readonly locale: string
  readonly calendar: Calendar
  readonly messages: DateFieldMessages
  readonly field: FieldControlProps
  readonly labelledBy: string | undefined
  readonly startName?: string | undefined
  readonly endName?: string | undefined
  readonly form?: string | undefined
  readonly minValue?: DateValue | null | undefined
  readonly maxValue?: DateValue | null | undefined
  readonly focusWithin: boolean
}

const ids = (instance: string) => ({
  input: `date-field-${instance}-input`.replace(/:/g, ""),
  startName: `date-field-${instance}-start-name`.replace(/:/g, ""),
  endName: `date-field-${instance}-end-name`.replace(/:/g, ""),
  description: `date-field-${instance}-range-description`.replace(/:/g, ""),
  hidden: (edge: DateRangeEdge) => `date-field-${instance}-hidden-${edge}`.replace(/:/g, ""),
})

/** A full spoken date ("Wednesday, October 14, 2026"; with the time at a time granularity). */
function spoken(value: DateValue | Time, input: DateRangeConnectInput): string {
  if (value instanceof Time) {
    return dateFormatter(input.locale, {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2000, 0, 1, value.hour, value.minute, value.second)))
  }
  const time = input.granularity !== "day" && "hour" in value
  const date = value.toDate("timeZone" in value ? value.timeZone : "UTC")
  return dateFormatter(input.locale, {
    calendar: input.calendar.identifier,
    timeZone: "timeZone" in value ? value.timeZone : "UTC",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(time ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date)
}

export function dateRangeConnect(input: DateRangeConnectInput) {
  const id = ids(input.instance)
  const { state, field } = input
  const scope = (part: string) => scopeAttrs("date-field", part, input.instance)
  const invalid = field.invalid === true || state.message !== ""
  const complete = input.start !== null && input.end !== null
  const value = state.value
  const description = value
    ? input.messages.rangeDescription({
        start: spoken(value.start as DateValue, input),
        end: state.overnight
          ? input.messages.overnight({ end: spoken(value.end as DateValue, input) })
          : spoken(value.end as DateValue, input),
      })
    : null
  const iso = (edge: DateRangeEdge) => {
    const v = value?.[edge]
    return v ? formValueOf(v as DateValue, input.granularity) : ""
  }
  const kindOf = () => {
    const v = input.start ?? input.end ?? input.minValue ?? null
    return v ? valueKind(v) : "date"
  }
<<<<<<< HEAD
  return {
    ids: id,
    description,
=======
  const fieldIds = field["aria-describedby"]?.split(" ") ?? []
  return {
    ids: id,
    description,
    /** The pair is invalid (each end's segments carry it). */
    invalid,
    /**
     * The ids an end's embedded field is described by: the Field's description (and error
     * while invalid) on the start; the end only while invalid (its segments then name the error).
     */
    endDescribedBy: (edge: DateRangeEdge): readonly string[] =>
      edge === "start" || invalid ? fieldIds : [],
>>>>>>> date-field-range
    root: (): PartProps => ({
      "data-range": "",
      "data-invalid": dataFlag(invalid),
      "data-invalid-edge": state.invalidEdge ?? undefined,
      "data-complete": dataFlag(complete),
      "data-placeholder-shown": dataFlag(input.start === null && input.end === null),
      "data-focus": dataFlag(input.focusWithin),
    }),
    /** The one group of both ends (spec "Group Semantics And Value Description"). */
    input: (): PartProps => ({
      ...scope("input"),
      id: id.input,
      role: "group",
      "aria-labelledby": input.labelledBy,
      "aria-describedby":
        [field["aria-describedby"], description ? id.description : undefined]
          .filter(Boolean)
          .join(" ") || undefined,
      "aria-disabled": field.disabled ? "true" : undefined,
      "aria-invalid": invalid ? "true" : undefined,
      "data-range": "",
      "data-invalid": dataFlag(invalid),
      "data-complete": dataFlag(complete),
      "data-focus": dataFlag(input.focusWithin),
      style: { "unicode-bidi": "isolate" },
    }),
    /** `start` / `end`: no role; their segments are the embedded fields'. */
    edge: (edge: DateRangeEdge): PartProps => ({
      ...scope(edge),
      "data-edge": edge,
      "data-invalid": dataFlag(state.invalidEdge === edge),
    }),
    separator: (): PartProps => ({
      ...scope("separator"),
      "aria-hidden": "true",
      children: input.messages.separator,
    }),
    /** The end's name, read after each segment's name (visually hidden). */
    edgeName: (edge: DateRangeEdge): PartProps => ({
      id: edge === "start" ? id.startName : id.endName,
      "aria-hidden": "true",
      style: visuallyHiddenStyle,
      children: edge === "start" ? input.messages.startDate : input.messages.endDate,
    }),
    valueDescription: (): PartProps | null =>
      description
        ? {
            ...scope("value-description"),
            id: id.description,
            "aria-hidden": "true",
            style: visuallyHiddenStyle,
            children: description,
          }
        : null,
    /** Each end's hidden input: its ISO value only while the pair is a valid range. */
    hiddenInput: (edge: DateRangeEdge): PartProps => {
      const kind = kindOf()
      const native = kind !== "zoned"
      const bound = (v: DateValue | null | undefined) =>
        v && native ? formValueOf(v, input.granularity) : undefined
      return {
        ...scope("hidden-input"),
        "data-edge": edge,
        id: id.hidden(edge),
        type: kind === "date" ? "date" : kind === "datetime" ? "datetime-local" : "text",
        "aria-hidden": "true",
        tabindex: -1,
        name: edge === "start" ? input.startName : input.endName,
        form: input.form,
        min: bound(input.minValue),
        max: bound(input.maxValue),
        required: field.required || undefined,
        disabled: field.disabled || undefined,
        defaultValue: iso(edge),
        "data-validity": edge === "start" && state.message ? "custom" : undefined,
        style: hiddenFormInputStyle,
      }
    },
    /** The current ISO value of each hidden input ("" unless the pair is a valid range). */
    formValue: iso,
  }
}
