import {
  type CreateCalendar,
  type DateFieldMessages,
  type DateGranularity,
  type DateRangeEdge,
  type DateSegmentType,
  type DayOfWeek,
  dateFieldConnect,
  type dateFieldMachine,
  type dateRangeConnect,
  type dateRangeFieldMachine,
  type FieldControlBinding,
  type FieldValue,
  type hiddenFormInput,
  type MessageOverrides,
  mergeFieldProps,
  type rangeStateOf,
  type Service,
} from "@rind-ui/core"
import { createContext } from "../context"
import { useFieldBindingPeek } from "../field/context.svelte"
import type { DateFieldState, DateRangeEndProps } from "./types"

type Api = ReturnType<typeof dateFieldConnect>
type ConnectInput = Parameters<typeof dateFieldConnect>[0]
export type BaseInput = Omit<ConnectInput, "field" | "fieldData" | "labelledBy">
type View = ReturnType<Service<typeof dateFieldMachine>["view"]>

/** The single field's context; getters stay reactive. */
export interface Ctx {
  readonly instance: string
  readonly view: () => View
  readonly send: Service<typeof dateFieldMachine>["send"]
  /** Everything connect needs except the Field binding (read by each part under the host). */
  readonly base: () => BaseInput
  readonly own: () => {
    readonly disabled: boolean
    readonly readOnly: boolean
    readonly required: boolean
    readonly invalid: boolean | undefined
    readonly describedBy: string | undefined
    readonly labelledBy: string | undefined
  }
  readonly embedded: boolean
  /** The picker parts' options (date-field "Picker Parts"). */
  readonly picker: {
    readonly closeOnSelect: () => boolean
    readonly firstDayOfWeek: () => DayOfWeek | undefined
    /** The field's own locale and calendar system: the bound Calendar shows the same. */
    readonly locale: () => string
    readonly createCalendar: () => CreateCalendar | undefined
    readonly placeholder: FieldValue
    readonly cancelled: { current: boolean }
    readonly triggers: { count: number }
  }
  /** Embedded: select all + Backspace cleared this field (the host clears its pair). */
  readonly onClearAll: () => void
  readonly disabled: () => boolean
  readonly readOnly: () => boolean
  readonly dir: () => "ltr" | "rtl"
  readonly inputEl: { current: HTMLElement | null }
  readonly hiddenEl: { current: HTMLInputElement | null }
  readonly formInput: ReturnType<typeof hiddenFormInput>
  readonly selectAll: { current: boolean }
  readonly state: () => DateFieldState
}
export const dateField = createContext<Ctx | null>("date-field")
export function useDateField(part: string): Ctx {
  const ctx = dateField.maybe() ?? null
  if (!ctx) throw new Error(`DateField.${part} must be inside DateField.Root`)
  return ctx
}

/** The api of a part, with the Field binding merged (none when embedded). Call at init. */
export function useApi(ctx: Ctx): () => Api {
  const peeked = useFieldBindingPeek()
  return () => {
    const binding = ctx.embedded ? null : (peeked?.() ?? null)
    const own = ctx.own()
    const field = mergeFieldProps(
      {
        role: "group",
        labelable: false,
        disabled: own.disabled,
        readOnly: own.readOnly,
        required: own.required,
        ...(own.invalid === undefined ? {} : { invalid: own.invalid }),
        ...(own.describedBy ? { describedBy: own.describedBy } : {}),
      },
      binding,
    )
    return dateFieldConnect({
      ...ctx.base(),
      field,
      fieldData: binding?.data,
      labelledBy: ctx.embedded ? own.labelledBy : binding?.ids.label,
    })
  }
}

type RangeView = ReturnType<Service<typeof dateRangeFieldMachine>["view"]>

/** The range pair's context; getters stay reactive. */
export interface RangeCtx {
  readonly instance: string
  readonly view: () => RangeView
  readonly send: Service<typeof dateRangeFieldMachine>["send"]
  readonly end: () => DateRangeEndProps & {
    readonly disabled: boolean
    readonly readOnly: boolean
    readonly messages?: MessageOverrides<DateFieldMessages> | undefined
  }
  readonly inputEl: { current: HTMLElement | null }
  readonly hidden: Record<DateRangeEdge, { current: HTMLInputElement | null }>
  /** The pair's api with the Field binding the part sees (the Root's own Field inside it). */
  readonly api: (binding: FieldControlBinding | null) => ReturnType<typeof dateRangeConnect>
  readonly state: () => ReturnType<typeof rangeStateOf>
  readonly triggers: { count: number }
  readonly cancelled: { current: boolean }
  readonly closeOnSelect: () => boolean
  readonly allowsNonContiguousRanges: () => boolean
  readonly firstDayOfWeek: () => DayOfWeek | undefined
  readonly granularity: () => DateGranularity | undefined
  readonly placeholderValue: () => FieldValue | undefined
}
export const dateRange = createContext<RangeCtx | null>("date-range-field")
/** Inside a range Root (and not inside one of its embedded ends). */
export const useDateRange = () => dateRange.maybe() ?? null
/** A range's trigger count, read by its ends' segments (Alt+ArrowDown opens a picker). */
export const rangeTriggers = createContext<{ count: number }>("date-range-triggers")
/** Inside a Control: the Input is a presentation element (the Control is the group). */
export const inControl = createContext<boolean>("date-field-control")
/** The single Root's context and connect parts (null in range mode). */
export const single = createContext<{ readonly ctx: Ctx; readonly api: () => Api } | null>(
  "date-field-single",
)
export type { DateSegmentType }
