// Date Field range mode (date-field spec "Range Mode"): wiring only. The coordinator machine
// derives the pair's value and validity; each end is an embedded Date Field; connect owns the
// group, the ends, the separator and the two hidden inputs.
import {
  type DateFieldMessages,
  type DateGranularity,
  type DateRangeEdge,
  type DateRangeFieldValue,
  type DateValue,
  dateFieldMessages,
  dateRangeConnect,
  dateRangeFieldMachine,
  type FieldControlBinding,
  type FieldMessages,
  type FieldValue,
  focusSafely,
  hiddenFormInput,
  type MessageOverrides,
  mergeFieldProps,
  parseEndValue,
  rangeStateOf,
  resolveCalendar,
  setControlValidity,
  Time,
} from "@rind-ui/core"
import {
  defineComponent,
  Fragment,
  h,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"
import { fieldRootProps, useFieldBindingPeek, useFieldControl } from "../field/field"
import { FieldHost } from "../field/field-host"
import { useFieldsetDisabled } from "../fieldset/context"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import * as Popover from "../popover/popover.parts"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { DateFieldKey, type RangeCtx, RangeKey, RangeTriggersKey, SingleKey } from "./context"
import {
  calendarTabStop,
  controlElement,
  type DatePickerOpenChangeDetails,
  pickerProps,
} from "./date-picker"

export interface DateRangeFieldChangeDetails {
  readonly reason: string
  cancel(): void
}

const fn = <T>() => Function as unknown as PropType<T>
const { messages: _fieldMessages, ...fieldProps } = fieldRootProps
void _fieldMessages

/** A range Root's props (`selection-mode="range"`). */
export const rangeRootProps = {
  ...fieldProps,
  ...pickerProps,
  selectionMode: String as PropType<"range">,
  /** The pair (`v-model`): `{ start, end }` or null. */
  modelValue: { type: Object as PropType<DateRangeFieldValue>, default: undefined },
  defaultValue: { type: Object as PropType<DateRangeFieldValue>, default: undefined },
  /** A range may contain unavailable dates (default false). */
  allowsNonContiguousRanges: Boolean,
  /** `Time` ends: an end before the start is the next day (default false). */
  allowsOvernight: Boolean,
  /** The hidden inputs' names. */
  startName: String,
  /** The end date's hidden input name. */
  endName: String,
  form: String,
  messages: Object as PropType<MessageOverrides<DateFieldMessages>>,
  /** The Field's messages when the Root is the Field. */
  fieldMessages: Object as PropType<MessageOverrides<FieldMessages>>,
  // The props both ends share.
  placeholderValue: Object as PropType<FieldValue>,
  granularity: String as PropType<DateGranularity>,
  /** `"hour"`: time ends (no date segments). Default: `"hour"` for `Time` ends. */
  maxGranularity: String as PropType<"year" | "hour">,
  hourCycle: Number as PropType<12 | 24>,
  hideTimeZone: { type: Boolean, default: undefined },
  shouldForceLeadingZeros: { type: Boolean, default: undefined },
  minValue: { type: Object as PropType<FieldValue | null>, default: undefined },
  maxValue: { type: Object as PropType<FieldValue | null>, default: undefined },
  isDateUnavailable: fn<(date: DateValue) => boolean>(),
  locale: String,
  dir: String as PropType<"ltr" | "rtl">,
  onValueChange: fn<(value: DateRangeFieldValue, details: DateRangeFieldChangeDetails) => void>(),
  "onUpdate:modelValue": fn<(value: DateRangeFieldValue) => void>(),
} as const

export const DateRangeFieldRoot = defineComponent({
  name: "DateFieldRangeRoot",
  inheritAttrs: false,
  props: rangeRootProps,
  setup(props, { attrs, slots }) {
    const env = useEnvironment()
    const instance = useRootId(() => props.id)()
    const loc = useLocale(
      () => props.locale,
      () => props.dir,
    )
    const allMessages = useMessages("date-field", dateFieldMessages, () => props.messages)
    // Time ends: a time field per end, named "Start time" / "End time" (spec "Range Mode").
    const sample = () =>
      props.modelValue?.start ?? props.defaultValue?.start ?? props.placeholderValue ?? null
    const timeEnds = () => props.maxGranularity === "hour" || sample() instanceof Time
    const messages = () =>
      timeEnds()
        ? {
            ...allMessages.value,
            startDate: allMessages.value.startTime,
            endDate: allMessages.value.endTime,
          }
        : allMessages.value
    const enclosing = useFieldBindingPeek()
    const fieldsetDisabled = useFieldsetDisabled()
    const disabled = () =>
      props.disabled === true || enclosing?.value.state.disabled === true || fieldsetDisabled.value
    const readOnly = () => props.readonly === true || enclosing?.value.state.readOnly === true
    const required = () => props.required === true || enclosing?.value.state.required === true
    // A consumer's details.cancel() of the last change (a refused pick keeps the popover open).
    const cancelled = { current: false }
    const triggers = shallowRef(0)
    const machineProps = () => ({
      value: props.modelValue,
      defaultValue: props.defaultValue,
      onValueChange: (
        v: DateRangeFieldValue,
        details: { event: { type: string }; cancel(): void },
      ) => {
        cancelled.current = false
        props.onValueChange?.(v, {
          reason: details.event.type,
          cancel: () => {
            cancelled.current = true
            details.cancel()
          },
        })
        props["onUpdate:modelValue"]?.(v)
      },
      isDateUnavailable: props.isDateUnavailable,
      allowsNonContiguousRanges: props.allowsNonContiguousRanges,
      allowsOvernight: props.allowsOvernight,
      required: required(),
      messages: messages(),
    })
    const { view, send } = useMachine(dateRangeFieldMachine, machineProps as never)
    const state = () => rangeStateOf(view.value.context, machineProps() as never)
    const inputEl = shallowRef<HTMLElement | null>(null)
    const startHidden = shallowRef<HTMLInputElement | null>(null)
    const endHidden = shallowRef<HTMLInputElement | null>(null)
    const focusWithin = shallowRef(false)
    const api = (binding: FieldControlBinding | null) => {
      const { calendar, formatLocale } = resolveCalendar(loc.value.locale)
      const s = sample()
      return dateRangeConnect({
        instance,
        state: state(),
        start: view.value.context.start.value,
        end: view.value.context.end.value,
        // The ends' own default: minutes for a time or a date-time, else days.
        granularity:
          props.granularity ?? (timeEnds() || (s !== null && "hour" in s) ? "minute" : "day"),
        ...(s === null && timeEnds() ? { kind: "time" as const } : {}),
        locale: formatLocale,
        calendar,
        messages: messages(),
        field: mergeFieldProps(
          {
            role: "group",
            labelable: false,
            disabled: disabled(),
            readOnly: readOnly(),
            required: required(),
          },
          binding ?? enclosing?.value ?? null,
        ),
        labelledBy: binding?.ids.label,
        startName: props.startName,
        endName: props.endName,
        form: props.form,
        minValue: props.minValue,
        maxValue: props.maxValue,
        focusWithin: focusWithin.value,
      })
    }
    // Both hidden inputs: their values, a form reset, nothing adopted from autofill yet.
    const forms = {
      start: hiddenFormInput({ input: () => startHidden.value, control: () => null }, env),
      end: hiddenFormInput({ input: () => endHidden.value, control: () => null }, env),
    }
    const sync = () => {
      const own = api(null)
      // The pair's own validity on the start hidden input (the registered validity element).
      if (startHidden.value) setControlValidity(startHidden.value, state().message)
      forms.start.sync({ value: own.formValue("start") }, { dispatch: false })
      forms.end.sync({ value: own.formValue("end") }, { dispatch: false })
    }
    onMounted(() => {
      sync()
      const stops = (["start", "end"] as const).map((edge) =>
        forms[edge].track({
          onReset: () => send({ type: "RESET" }),
          current: () => ({ value: api(null).formValue(edge) }),
          // A browser autofill of a valid ISO string is adopted into that end.
          onNativeInput: (input) => {
            const v = parseEndValue(input.value, input.type)
            if (v === null) return false
            send({
              type: edge === "start" ? "START.COMMIT" : "END.COMMIT",
              value: v,
              reason: "ADOPT",
            })
            return true
          },
        }),
      )
      onBeforeUnmount(() => {
        for (const stop of stops) stop()
      })
      watch(() => view.value, sync, { flush: "post" })
    })
    onUpdated(sync)
    const ctx: RangeCtx = {
      instance,
      view,
      send,
      end: () => ({
        ...(props.placeholderValue ? { placeholderValue: props.placeholderValue } : {}),
        ...(props.granularity ? { granularity: props.granularity } : {}),
        ...(props.maxGranularity ? { maxGranularity: props.maxGranularity } : {}),
        ...(props.hourCycle ? { hourCycle: props.hourCycle } : {}),
        ...(props.hideTimeZone !== undefined ? { hideTimeZone: props.hideTimeZone } : {}),
        ...(props.shouldForceLeadingZeros !== undefined
          ? { shouldForceLeadingZeros: props.shouldForceLeadingZeros }
          : {}),
        ...(props.minValue !== undefined ? { minValue: props.minValue } : {}),
        ...(props.maxValue !== undefined ? { maxValue: props.maxValue } : {}),
        ...(props.isDateUnavailable ? { isDateUnavailable: props.isDateUnavailable } : {}),
        locale: loc.value.locale,
        dir: loc.value.dir,
        disabled: disabled(),
        readOnly: readOnly(),
        ...(props.messages ? { messages: props.messages } : {}),
      }),
      inputEl,
      hidden: { start: startHidden, end: endHidden },
      api,
      state,
      triggers,
      cancelled,
      closeOnSelect: () => props.closeOnSelect,
      allowsNonContiguousRanges: () => props.allowsNonContiguousRanges,
      firstDayOfWeek: () => props.firstDayOfWeek,
      granularity: () => props.granularity,
      placeholderValue: () => props.placeholderValue,
    }
    provide(RangeKey, ctx)
    provide(RangeTriggersKey, triggers)
    // Below the range: no single field (the ends provide their own).
    provide(DateFieldKey, null as never)
    provide(SingleKey, null)
    return () => {
      const own = api(null)
      const field = Object.fromEntries(
        Object.keys(fieldProps)
          .filter((k) => k !== "id")
          .map((k) => [k, (props as Record<string, unknown>)[k]]),
      )
      return h(
        FieldHost,
        {
          ...attrs,
          ...field,
          scope: "date-field",
          id: instance,
          ...(props.fieldMessages ? { messages: props.fieldMessages } : {}),
          ...normalizeProps(own.root()),
          onFocusin: () => (focusWithin.value = true),
          onFocusout: (e: FocusEvent) => {
            const root = e.currentTarget as Element
            if (!root.contains(e.relatedTarget as Node | null)) focusWithin.value = false
          },
        },
        () =>
          h(
            Popover.Root,
            {
              id: instance,
              scope: "date-field",
              disabled: disabled(),
              ...(props.open === undefined ? {} : { open: props.open }),
              ...(props.defaultOpen === undefined ? {} : { defaultOpen: props.defaultOpen }),
              onOpenChange: (next: boolean, details: { reason: string; cancel(): void }) => {
                if (next && readOnly()) return details.cancel()
                const d: DatePickerOpenChangeDetails = {
                  reason: next
                    ? "trigger"
                    : (details.reason as DatePickerOpenChangeDetails["reason"]),
                  cancel: details.cancel,
                }
                props.onOpenChange?.(next, d)
                props["onUpdate:open"]?.(next)
              },
              ...(props.modal === undefined ? {} : { modal: props.modal }),
              initialFocus:
                props.initialFocus === undefined ? calendarTabStop(instance) : props.initialFocus,
              ...(props.finalFocus === undefined ? {} : { finalFocus: props.finalFocus }),
              ...(props.positioning === undefined ? {} : { positioning: props.positioning }),
              persistentElements: () => {
                const control = controlElement(instance)
                return [...(control ? [control] : []), ...(props.persistentElements?.() ?? [])]
              },
            },
            () => [
              slots["default"]?.(),
              h("input", {
                ...normalizeProps(own.hiddenInput("start")),
                ref: refTo(startHidden as never),
              }),
              h("input", {
                ...normalizeProps(own.hiddenInput("end")),
                ref: refTo(endHidden as never),
              }),
            ],
          ),
      )
    }
  },
})

/** The one group of both ends; without a slot: Start, Separator, End. */
export const DateRangeInput = defineComponent({
  name: "DateFieldRangeInput",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    renderEnd: { type: Function as PropType<(edge: DateRangeEdge) => VNodeChild>, required: true },
  },
  setup(props, { attrs, slots }) {
    const ctx = inject_()
    const env = useEnvironment()
    const binding = useFieldControl()
    const firstSegment = () =>
      ctx.inputEl.value?.querySelector<HTMLElement>('[data-edge="start"] input[data-editable]') ??
      null
    if (binding) {
      onMounted(() => {
        const api = ctx.api(binding.value)
        const id = firstSegment()?.id ?? `${api.ids.input}-first`
        onBeforeUnmount(
          binding.value.register(
            {
              id,
              labelable: false,
              focus: (m) => {
                const el = firstSegment()
                if (el) void focusSafely(el, env, "programmatic", m)
              },
              validityElement: () => ctx.hidden.start.value,
              value: () => ctx.view.value.values.value ?? null,
            },
            id,
          ),
        )
        // Each change of the pair's value or validity is reported to the Field once.
        watch(
          [() => JSON.stringify(ctx.view.value.values.value ?? null), () => ctx.state().message],
          () =>
            binding.value.report({
              type: "change",
              value: ctx.view.value.values.value ?? null,
              user: true,
              composing: false,
            }),
        )
      })
    }
    return () => {
      const api = ctx.api(binding?.value ?? null)
      const description = api.valueDescription()
      const content = slots["default"]
        ? slots["default"]()
        : [
            props.renderEnd("start"),
            renderPart("span", normalizeProps(api.separator()), undefined),
            props.renderEnd("end"),
          ]
      return renderPart(
        "div",
        mergeProps({ ...normalizeProps(api.input()), ref: refTo(ctx.inputEl as never) }, attrs),
        h(Fragment, [
          content,
          renderPart("span", normalizeProps(api.edgeName("start")), undefined),
          renderPart("span", normalizeProps(api.edgeName("end")), undefined),
          description ? renderPart("span", normalizeProps(description), undefined) : null,
        ]),
        props.asChild,
      )
    }
  },
})

function inject_(): RangeCtx {
  const ctx = inject(RangeKey, null)
  if (!ctx) throw new Error("DateField.Input must be inside DateField.Root")
  return ctx
}
