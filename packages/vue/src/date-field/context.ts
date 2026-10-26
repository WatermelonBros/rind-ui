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
import { type ComputedRef, type InjectionKey, inject, type ShallowRef } from "vue"
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
  readonly instance: string
  readonly view: ComputedRef<View>
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
    readonly triggers: ShallowRef<number>
  }
  /** Embedded: select all + Backspace cleared this field (the host clears its pair). */
  readonly onClearAll: () => void
  readonly disabled: () => boolean
  readonly readOnly: () => boolean
  readonly dir: () => "ltr" | "rtl"
  readonly inputEl: ShallowRef<HTMLElement | null>
  readonly hiddenEl: ShallowRef<HTMLInputElement | null>
  readonly formInput: ReturnType<typeof hiddenFormInput>
  readonly selectAll: { current: boolean }
  readonly state: () => DateFieldState
}

export const DateFieldKey: InjectionKey<Ctx> = Symbol("rind-ui.date-field")
export function useDateField(part: string): Ctx {
  const ctx = inject(DateFieldKey, null)
  if (!ctx) throw new Error(`DateField.${part} must be inside DateField.Root`)
  return ctx
}
export const useDateFieldOrNull = () => inject(DateFieldKey, null)

/** The api of a part, with the Field binding merged (none when embedded). Call in setup. */
export function useApi(ctx: Ctx): () => Api {
  const peeked = useFieldBindingPeek()
  return () => {
    const binding = ctx.embedded ? null : (peeked?.value ?? null)
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
  readonly instance: string
  readonly view: ComputedRef<RangeView>
  readonly send: Service<typeof dateRangeFieldMachine>["send"]
  readonly end: () => DateRangeEndProps & {
    readonly disabled: boolean
    readonly readOnly: boolean
    readonly messages?: MessageOverrides<DateFieldMessages> | undefined
  }
  readonly inputEl: ShallowRef<HTMLElement | null>
  readonly hidden: Record<DateRangeEdge, ShallowRef<HTMLInputElement | null>>
  /** The pair's api with the Field binding the part sees (the Root's own Field inside it). */
  readonly api: (binding: FieldControlBinding | null) => ReturnType<typeof dateRangeConnect>
  readonly state: () => ReturnType<typeof rangeStateOf>
  // The picker parts (date-field "Picker — Range: …").
  readonly triggers: ShallowRef<number>
  readonly cancelled: { current: boolean }
  readonly closeOnSelect: () => boolean
  readonly allowsNonContiguousRanges: () => boolean
  readonly firstDayOfWeek: () => DayOfWeek | undefined
  readonly granularity: () => DateGranularity | undefined
  readonly placeholderValue: () => FieldValue | undefined
}

export const RangeKey: InjectionKey<RangeCtx | null> = Symbol("rind-ui.date-range-field")
/** Inside a range Root (and not inside one of its embedded ends). */
export const useDateRange = () => inject(RangeKey, null)

/** A range Root's trigger count, provided to its ends' segments (Alt+ArrowDown opens a picker). */
export const RangeTriggersKey: InjectionKey<ShallowRef<number>> = Symbol(
  "rind-ui.date-range-triggers",
)

/** Inside a Control: the Input is a presentation element (the Control is the group). */
export const InControlKey: InjectionKey<boolean> = Symbol("rind-ui.date-field-control")

/** The single Root's context and connect parts (null in range mode). */
export const SingleKey: InjectionKey<{ readonly ctx: Ctx; readonly api: () => Api } | null> =
  Symbol("rind-ui.date-field-single")
