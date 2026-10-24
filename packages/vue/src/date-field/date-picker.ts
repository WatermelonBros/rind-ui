// Date Field picker parts (date-field spec "Picker Parts", "Picker — …"): wiring only. The
// field's machine owns the one value; the Popover (re-scoped to `date-field`) owns the open
// state; the Calendar is a bound view whose pick commits through the field (`PICK`).
import {
  CalendarDate,
  type DateValue,
  type DayOfWeek,
  dateClockCapability,
  dayOf,
  draftFocus,
  draftHint,
  type FieldValue,
  type FocusTarget,
  focusSafely,
  type Modality,
  type PositioningProps,
  partId,
  pickedValue,
  Time,
  today as todayOf,
  todayZone,
} from "@rind-ui/core"
import {
  defineComponent,
  h,
  inject,
  onBeforeUnmount,
  onMounted,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"
import * as Calendar from "../calendar/calendar.parts"
import { useFieldBindingPeek } from "../field/field"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { usePopoverControls } from "../popover/popover"
import * as Popover from "../popover/popover.parts"
import { useEnvironment } from "../provider"
import { asChildProp, renderPart } from "../render"
import { InControlKey, SingleKey, useDateField, useDateRange } from "./context"

export type DatePickerCloseReason =
  | "trigger"
  | "close-trigger"
  | "select"
  | "escape-key"
  | "outside-press"
  | "outside-focus"
  | "parent-dismissed"
  | "api"

export interface DatePickerOpenChangeDetails {
  readonly reason: "trigger" | DatePickerCloseReason
  /** Keeps the open state (uncontrolled) or refuses the change (controlled). */
  cancel(): void
}

const fn = <T>() => Function as unknown as PropType<T>

/**
 * The picker's Root props (spec "Picker Parts"): the Popover's open state and layer options,
 * and the Calendar data props a picker forwards.
 */
export const pickerProps = {
  /** Controlled open state of the calendar popover (`v-model:open`). */
  open: { type: Boolean, default: undefined },
  /** Initial open state of the calendar popover. Default: false. */
  defaultOpen: { type: Boolean, default: undefined },
  /** Every open or close request, with `details.reason` and `details.cancel()`. */
  onOpenChange: fn<(open: boolean, details: DatePickerOpenChangeDetails) => void>(),
  "onUpdate:open": fn<(open: boolean) => void>(),
  /** A pick closes the popover (default true). */
  closeOnSelect: { type: Boolean, default: true },
  /** The calendar's first day of the week. */
  firstDayOfWeek: String as PropType<DayOfWeek>,
  modal: { type: Boolean, default: undefined },
  initialFocus: {
    type: [Function, null] as PropType<(() => FocusTarget) | null>,
    default: undefined,
  },
  finalFocus: {
    type: [Function, Boolean, null] as PropType<(() => FocusTarget) | false | null>,
    default: undefined,
  },
  positioning: Object as PropType<PositioningProps>,
  persistentElements: fn<() => readonly Element[]>(),
} as const

/** The calendar's tab stop in the open content: the initial focus (spec "Initial Focus"). */
export const calendarTabStop = (instance: string) => (): HTMLElement | null =>
  (typeof document === "undefined"
    ? null
    : document
        .getElementById(partId("date-field", instance, "content"))
        ?.querySelector<HTMLElement>('[data-scope="calendar"][data-part="cell"][tabindex="0"]')) ??
  null

/** The picker's Control is the anchor and dismissal-inside element (spec "Dismissal"). */
export const controlElement = (instance: string): HTMLElement | null =>
  typeof document === "undefined"
    ? null
    : document.getElementById(partId("date-field", instance, "anchor"))

type Slots = SlotsType<{ default?: () => VNodeChild }>

/** The group around the Input and the triggers; the popover is placed against it. */
export const PickerControl = defineComponent({
  name: "DateFieldControl",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const range = useDateRange()
    const single = inject(SingleKey, null)
    // Range: the pair's group is the Input itself; the Control only anchors and holds triggers.
    provide(InControlKey, !range)
    return () => {
      const own = range ? {} : normalizeProps(single?.api().control() ?? {})
      const { id: _id, ...rest } = own as Record<string, unknown>
      void _id
      return h(
        Popover.Anchor,
        { ...(mergeProps(rest, attrs) as object), asChild: props.asChild },
        slots,
      )
    }
  },
})

/** Opens the popover; counted so Alt+ArrowDown opens only a picker. */
export const PickerTrigger = defineComponent({
  name: "DateFieldTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const range = useDateRange()
    const binding = useFieldBindingPeek()
    const single = inject(SingleKey, null)
    const count = range?.triggers ?? single?.ctx.picker.triggers ?? null
    if (count) {
      onMounted(() => count.value++)
      onBeforeUnmount(() => count.value--)
    }
    const own = () =>
      range
        ? range.api(binding?.value ?? null).trigger({ range: true })
        : (single?.api().trigger() ?? {})
    return () =>
      h(
        Popover.Trigger,
        { ...(mergeProps(normalizeProps(own()), attrs) as object), asChild: props.asChild },
        slots,
      )
  },
})

/** Clears the value and every draft segment, then focuses the first segment. */
export const PickerClearTrigger = defineComponent({
  name: "DateFieldClearTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const range = useDateRange()
    const binding = useFieldBindingPeek()
    const single = inject(SingleKey, null)
    const env = useEnvironment()
    const clear = () => {
      if (range) range.send({ type: "CLEAR" })
      else single?.ctx.send({ type: "CLEAR" })
      const scope = range ? range.inputEl : single?.ctx.inputEl
      const first = scope?.value?.querySelector<HTMLElement>("input[data-editable]")
      if (first) void focusSafely(first, env, "programmatic", env.modality.modality())
    }
    return () => {
      const own = range
        ? range.api(binding?.value ?? null).clearTrigger()
        : (single?.api().clearTrigger() ?? {})
      return renderPart(
        "button",
        mergeProps({ ...normalizeProps(own), onClick: clear }, attrs),
        slots.default?.(),
        props.asChild,
      )
    }
  },
})

/** The popover's dialog, named by the trigger's name and the Label unless named otherwise. */
export const PickerContent = defineComponent({
  name: "DateFieldContent",
  inheritAttrs: false,
  slots: Object as Slots,
  setup(_, { attrs, slots }) {
    const range = useDateRange()
    const binding = useFieldBindingPeek()
    const single = inject(SingleKey, null)
    return () => {
      const {
        "aria-label": label,
        "aria-labelledby": labelledBy,
        ...rest
      } = attrs as Record<string, unknown>
      const ownName = range
        ? range.api(binding?.value ?? null).contentLabelledBy()
        : single?.api().contentLabelledBy()
      const name =
        label !== undefined || labelledBy !== undefined
          ? { "aria-label": label, "aria-labelledby": labelledBy }
          : { "aria-labelledby": ownName }
      return h(Popover.Content, { ...rest, ...name }, slots)
    }
  },
})

/** A value the calendar can show: a time of day has no day (a time field has no picker). */
const onCalendar = (v: FieldValue | null | undefined): DateValue | null =>
  v == null || v instanceof Time ? null : v

/** The Calendar bound to the picker: its data come from the field, its view props are its own. */
export const PickerCalendar = defineComponent({
  name: "DateFieldCalendar",
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    const range = useDateRange()
    return () => (range ? h(RangeCalendar, attrs, slots) : h(SingleCalendar, attrs, slots))
  },
})

const SingleCalendar = defineComponent({
  name: "DateFieldSingleCalendar",
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    const ctx = useDateField("Calendar")
    const single = inject(SingleKey, null)
    const popover = usePopoverControls()
    const value = () => onCalendar(ctx.view.value.values.value)
    const placeholder = onCalendar(ctx.picker.placeholder)
    const focused = shallowRef<CalendarDate>(
      dayOf(value() ?? placeholder ?? new CalendarDate(2001, 1, 1)),
    )
    // Typing while open: the value, or a draft's year and month, moves the calendar.
    watch(
      [
        () => value()?.toString() ?? "",
        () => draftHint(ctx.view.value.context.draft).year,
        () => draftHint(ctx.view.value.context.draft).month,
      ],
      () => {
        const v = value()
        if (v) {
          focused.value = dayOf(v)
          return
        }
        const hint = draftHint(ctx.view.value.context.draft)
        focused.value = draftFocus(hint, focused.value) ?? focused.value
      },
    )
    // A pick that changed nothing (the selected date again) never ran onValueChange: an
    // earlier refusal must not keep the popover open.
    let changed = false
    const close = (modality: Modality) => {
      if (!changed) ctx.picker.cancelled.current = false
      changed = false
      // After the field's onValueChange ran: a refused pick keeps the popover open.
      queueMicrotask(() => {
        if (!ctx.picker.cancelled.current && ctx.picker.closeOnSelect()) {
          popover?.send({ type: "select", modality })
        }
      })
    }
    return () => {
      const base = ctx.base()
      const api = single?.api()
      const firstDay = ctx.picker.firstDayOfWeek()
      return h(
        Calendar.Root,
        {
          ...attrs,
          modelValue: value(),
          onValueChange: (v: unknown, details: { modality: string | undefined }) => {
            if (
              v === null ||
              Array.isArray(v) ||
              !("calendar" in (v as object)) ||
              "start" in (v as object)
            )
              return
            changed = true
            ctx.send({
              type: "PICK",
              value: pickedValue(dayOf(v as DateValue), value(), placeholder, base.granularity),
              modality: details.modality as Modality,
            })
          },
          onDateSelect: (_d: unknown, d: { modality: Modality }) => close(d.modality),
          focusedValue: focused.value,
          onFocusChange: (d: CalendarDate) => (focused.value = d),
          minValue: onCalendar(base.minValue),
          maxValue: onCalendar(base.maxValue),
          ...(base.isDateUnavailable ? { isDateUnavailable: base.isDateUnavailable } : {}),
          disabled: ctx.disabled(),
          readOnly: ctx.readOnly(),
          invalid: (api?.validity.message ?? "") !== "" || ctx.own().invalid === true,
          ...(firstDay ? { firstDayOfWeek: firstDay } : {}),
        },
        slots,
      )
    }
  },
})

const RangeCalendar = defineComponent({
  name: "DateFieldRangeCalendar",
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    const range = useDateRange()
    if (!range) throw new Error("unreachable: RangeCalendar outside a range Root")
    const ctx = range
    const popover = usePopoverControls()
    const env = useEnvironment(dateClockCapability)
    const start = () => (ctx.view.value.context.startValue as DateValue | null) ?? null
    const end = () => (ctx.view.value.context.endValue as DateValue | null) ?? null
    const value = () => ctx.view.value.values.value ?? null
    // Resume (spec "Picker — Range: Resume"): a committed start without a valid end is the
    // anchor when the popover opens (the content mounts per open), so a press sets the end.
    const s0 = start()
    const anchor =
      s0 !== null && (end() === null || ctx.state().invalidEdge === "end") ? dayOf(s0) : null
    // Typing while open (spec "Picker — Range: Typing And Clearing"): the calendar shows the
    // range's start, else the end last typed.
    const initial = (): CalendarDate => {
      const v = value()
      if (v) return dayOf(v.start as DateValue)
      const s = start()
      if (s) return dayOf(s)
      // Today (or the placeholder), within minValue / maxValue.
      const today = dayOf(
        onCalendar(ctx.placeholderValue()) ?? todayOf(env.dateClock, todayZone(undefined, null)),
      )
      const [lo, hi] = [onCalendar(ctx.end().minValue), onCalendar(ctx.end().maxValue)]
      const min = lo ? dayOf(lo) : null
      const max = hi ? dayOf(hi) : null
      return min && today.compare(min) < 0 ? min : max && today.compare(max) > 0 ? max : today
    }
    const focused = shallowRef<CalendarDate>(initial())
    watch([() => value(), start, end], ([v, s, e], [, ps, pe]) => {
      const moved = v ? (v.start as DateValue) : e && e !== pe ? e : s && s !== ps ? s : null
      if (moved) focused.value = dayOf(moved)
    })
    let changed = false
    return () => {
      const firstDay = ctx.firstDayOfWeek()
      const endProps = ctx.end()
      return h(
        Calendar.Root,
        {
          ...attrs,
          selectionMode: "range",
          modelValue: value() as never,
          ...(anchor ? { defaultAnchor: anchor } : {}),
          focusedValue: focused.value,
          onFocusChange: (d: CalendarDate) => (focused.value = d),
          onValueChange: (v: unknown) => {
            if (v === null || !("start" in (v as object))) return
            changed = true
            const r = v as { start: DateValue; end: DateValue }
            // Each end keeps its own type, time of day and zone (spec "Picker — Select").
            const pick = (day: DateValue, current: unknown) =>
              pickedValue(
                dayOf(day),
                (current as DateValue | null) ?? null,
                onCalendar(ctx.placeholderValue()),
                ctx.granularity() ?? "day",
              )
            ctx.send({
              type: "PICK",
              start: pick(r.start, ctx.view.value.context.startValue),
              end: pick(r.end, ctx.view.value.context.endValue),
            })
          },
          onDateSelect: (_d: unknown, d: { modality: Modality }) => {
            if (!changed) ctx.cancelled.current = false
            changed = false
            queueMicrotask(() => {
              if (!ctx.cancelled.current && ctx.closeOnSelect()) {
                popover?.send({ type: "select", modality: d.modality })
              }
            })
          },
          // The picker forces "reset": leaving the calendar never commits half a range.
          commitOnBlur: "reset",
          minValue: onCalendar(endProps.minValue),
          maxValue: onCalendar(endProps.maxValue),
          ...(endProps.isDateUnavailable ? { isDateUnavailable: endProps.isDateUnavailable } : {}),
          allowsNonContiguousRanges: ctx.allowsNonContiguousRanges(),
          disabled: endProps.disabled,
          readOnly: endProps.readOnly,
          invalid: ctx.state().message !== "",
          ...(firstDay ? { firstDayOfWeek: firstDay } : {}),
        },
        slots,
      )
    }
  },
})
