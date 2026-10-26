// The Date Field contexts: the single field's, the range pair's, and the picker's (whether a
// part is inside a Control, and the single Root's parts). Shared by the three modules.
import {
  type CreateCalendar,
  type DateFieldMessages,
  type DateGranularity,
  type DateRangeEdge,
  type DateSegmentType,
  type DateValue,
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
  type SegmentPart,
  type Service,
} from "@rind-ui/core"
import { type Accessor, createContext, createMemo, useContext } from "solid-js"
import { useFieldBindingPeek } from "../field/context"

export interface DateFieldState {
  readonly value: FieldValue | null
  readonly segments: readonly SegmentPart[]
  readonly focusedSegment: DateSegmentType | null
  readonly composing: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

type Api = ReturnType<typeof dateFieldConnect>
type ConnectInput = Parameters<typeof dateFieldConnect>[0]
export type BaseInput = Omit<ConnectInput, "field" | "fieldData" | "labelledBy">
type View = ReturnType<Service<typeof dateFieldMachine>["view"]>

export interface Ctx {
  readonly instance: Accessor<string>
  readonly view: Accessor<View>
  readonly send: Service<typeof dateFieldMachine>["send"]
  /** Everything connect needs except the Field binding (read by each part under the host). */
  readonly base: Accessor<BaseInput>
  readonly own: Accessor<{
    readonly disabled: boolean
    readonly readOnly: boolean
    readonly required: boolean
    readonly invalid: boolean | undefined
    readonly describedBy: string | undefined
    readonly labelledBy: string | undefined
  }>
  readonly embedded: boolean
  /** The picker parts' options (date-field "Picker Parts"). */
  readonly picker: {
    readonly closeOnSelect: Accessor<boolean>
    readonly firstDayOfWeek: Accessor<DayOfWeek | undefined>
    /** The field's own locale and calendar system: the bound Calendar shows the same. */
    readonly locale: Accessor<string>
    readonly createCalendar: Accessor<CreateCalendar | undefined>
    readonly placeholder: FieldValue
    readonly cancelled: { current: boolean }
    readonly triggers: Accessor<number>
    readonly setTriggers: (update: (n: number) => number) => void
  }
  /** Embedded: select all + Backspace cleared this field (the host clears its pair). */
  readonly onClearAll: () => void
  readonly disabled: Accessor<boolean>
  readonly readOnly: Accessor<boolean>
  readonly dir: Accessor<"ltr" | "rtl">
  readonly inputEl: Accessor<Element | null>
  readonly setInputEl: (el: Element | null) => void
  readonly hiddenEl: Accessor<Element | null>
  readonly setHiddenEl: (el: Element | null) => void
  readonly formInput: ReturnType<typeof hiddenFormInput>
  readonly selectAll: { current: boolean }
  readonly state: Accessor<DateFieldState>
}

/** Null below a range Root (its ends provide their own). */
export const DateFieldContext = createContext<Ctx | null>(null)
export function useDateField(part: string): Ctx {
  const ctx = useContext(DateFieldContext)
  if (!ctx) throw new Error(`DateField.${part} must be inside DateField.Root`)
  return ctx
}
export const useDateFieldOrNull = () => useContext(DateFieldContext)

/** The api of a part, with the Field binding merged (none when embedded). Call in a component. */
export function useApi(ctx: Ctx): Accessor<Api> {
  const peeked = useFieldBindingPeek()
  return createMemo(() => {
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
  })
}

/** The props both ends of a range share (they are passed to each embedded field). */
export interface DateRangeEndProps {
  readonly placeholderValue?: FieldValue | undefined
  readonly granularity?: DateGranularity | undefined
  /** `"hour"`: time ends (no date segments). Default: `"hour"` for `Time` ends. */
  readonly maxGranularity?: "year" | "hour" | undefined
  readonly hourCycle?: 12 | 24 | undefined
  readonly hideTimeZone?: boolean | undefined
  readonly shouldForceLeadingZeros?: boolean | undefined
  readonly minValue?: FieldValue | null | undefined
  readonly maxValue?: FieldValue | null | undefined
  readonly isDateUnavailable?: ((date: DateValue) => boolean) | undefined
  readonly locale?: string | undefined
  readonly dir?: "ltr" | "rtl" | undefined
}

type RangeView = ReturnType<Service<typeof dateRangeFieldMachine>["view"]>

export interface RangeCtx {
  readonly instance: Accessor<string>
  readonly view: Accessor<RangeView>
  readonly send: Service<typeof dateRangeFieldMachine>["send"]
  readonly end: Accessor<
    DateRangeEndProps & {
      readonly disabled: boolean
      readonly readOnly: boolean
      readonly messages?: MessageOverrides<DateFieldMessages> | undefined
    }
  >
  readonly inputEl: Accessor<Element | null>
  readonly setInputEl: (el: Element | null) => void
  readonly hidden: Record<DateRangeEdge, Accessor<Element | null>>
  /** The pair's api with the Field binding the part sees (the Root's own Field inside it). */
  readonly api: (binding: FieldControlBinding | null) => ReturnType<typeof dateRangeConnect>
  readonly state: Accessor<ReturnType<typeof rangeStateOf>>
  // The picker parts (date-field "Picker — Range: …").
  readonly triggers: Accessor<number>
  readonly setTriggers: (update: (n: number) => number) => void
  readonly cancelled: { current: boolean }
  readonly closeOnSelect: Accessor<boolean>
  readonly allowsNonContiguousRanges: Accessor<boolean>
  readonly firstDayOfWeek: Accessor<DayOfWeek | undefined>
  readonly granularity: Accessor<DateGranularity | undefined>
  readonly placeholderValue: Accessor<FieldValue | undefined>
}

export const RangeContext = createContext<RangeCtx | null>(null)
/** Inside a range Root (and not inside one of its embedded ends). */
export const useDateRange = () => useContext(RangeContext)

/** A range Root's trigger count, provided to its ends' segments (Alt+ArrowDown opens a picker). */
export const RangeTriggersContext = createContext<Accessor<number> | null>(null)

/** Inside a Control: the Input is a presentation element (the Control is the group). */
export const InControlContext = createContext(false)

/** The single Root's context and connect parts (null in range mode). */
export const SingleContext = createContext<{
  readonly ctx: Ctx
  readonly api: Accessor<Api>
} | null>(null)
