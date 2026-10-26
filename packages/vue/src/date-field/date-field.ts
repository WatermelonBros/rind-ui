// Date Field parts: wiring only. The machine owns the draft and the value; connect every
// attribute, the key mapping and the insertion plan; core/dom the segment layout. The Root
// is a Field when not inside one (the shared Field host), or a plain element when embedded
// in a host component; the hidden native input carries name, constraints and reset.
import {
  adjacentSegment,
  type CreateCalendar,
  type DateFieldBoundary,
  type DateFieldDraftHint,
  type DateFieldMessages,
  type DateFieldReason,
  type DateGranularity,
  type DateSegmentType,
  type DateValidityFlags,
  type DateValue,
  type DayOfWeek,
  dateClockCapability,
  dateFieldConnect,
  dateFieldKey,
  dateFieldMachine,
  dateFieldMessages,
  defaultPlaceholderValue,
  describeKey,
  type FieldMessages,
  type FieldValue,
  focusSafely,
  formatFor,
  formValueOf,
  hiddenFormInput,
  type MessageOverrides,
  mergeFieldProps,
  planSegmentInput,
  quirkActive,
  resolveCalendar,
  type SegmentPart,
  segmentAtPress,
  segmentId,
  setControlValidity,
  Time,
  today as todayOf,
  todayZone,
  valueKind,
} from "@rind-ui/core"
import {
  computed,
  defineComponent,
  Fragment,
  h,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"
import { fieldRootProps, useFieldBindingPeek, useFieldControl } from "../field/context"
import { FieldHost, HostDescription, HostErrorMessage, HostLabel } from "../field/field-host"
import { useFieldsetDisabled } from "../fieldset/context"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { usePopoverControls } from "../popover/popover"
import * as Popover from "../popover/popover.parts"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import {
  type BaseInput,
  type Ctx,
  DateFieldKey,
  type DateFieldState,
  InControlKey,
  RangeTriggersKey,
  SingleKey,
  useApi,
  useDateField,
  useDateFieldOrNull,
  useDateRange,
} from "./context"
import {
  calendarTabStop,
  controlElement,
  type DatePickerOpenChangeDetails,
  PickerCalendar,
  PickerClearTrigger,
  PickerContent,
  PickerControl,
  PickerTrigger,
  pickerProps,
} from "./date-picker"
import { DateRangeFieldRoot, DateRangeInput } from "./date-range-field"

declare module "../provider" {
  interface RindMessageScopes {
    "date-field": DateFieldMessages
  }
}

// Bundlers replace `process.env.NODE_ENV` and drop the dead branch in production builds.
declare const process: { env: { NODE_ENV?: string } }

/** Machine events → the public reasons (spec "Commit Points"). */
function publicReason(type: string): DateFieldReason {
  switch (type) {
    case "INCREASE":
    case "DECREASE":
    case "PAGE_PREV":
    case "PAGE_NEXT":
    case "FIRST":
    case "LAST":
      return "STEP"
    case "PASTE":
      return "PASTE"
    case "BACKSPACE":
    case "CLEAR_ALL":
    case "CLEAR":
      return "CLEAR"
    case "PICK":
      return "CALENDAR"
    case "RESET":
      return "RESET"
    default:
      return "SEGMENT.COMMIT"
  }
}

export interface DateFieldChangeDetails {
  readonly reason: DateFieldReason
  readonly modality: string | undefined
  cancel(): void
}

const fn = <T>() => Function as unknown as PropType<T>
const valueProp = { type: Object as PropType<FieldValue | null>, default: undefined }

/** The Field props a Root passes to its Field host (the Field's own `messages` excepted). */
const { messages: _fieldMessages, ...fieldProps } = fieldRootProps
void _fieldMessages

/** The single field's own props (an end of a range receives them too). */
export const singleRootProps = {
  ...fieldProps,
  ...pickerProps,
  /** A date, a date-time, a zoned date-time, or a `Time` (a time field); `v-model`. */
  modelValue: valueProp,
  /** Read at creation; a later change only changes what a form reset restores. */
  defaultValue: { type: Object as PropType<FieldValue | null>, default: null },
  /** The value stepping starts from, and the type and zone without a value. */
  placeholderValue: Object as PropType<FieldValue>,
  granularity: String as PropType<DateGranularity>,
  /**
   * `"hour"`: no date segments (a time field). A date-time keeps its date; without a value
   * or placeholder the field holds a `Time`. Default: `"hour"` for a `Time` value, else `"year"`.
   */
  maxGranularity: String as PropType<"year" | "hour">,
  hourCycle: Number as PropType<12 | 24>,
  hideTimeZone: { type: Boolean, default: undefined },
  shouldForceLeadingZeros: { type: Boolean, default: undefined },
  /** A `Time` bound compares with a date-time value on the value's own day. */
  minValue: { type: Object as PropType<FieldValue | null>, default: null },
  maxValue: { type: Object as PropType<FieldValue | null>, default: null },
  isDateUnavailable: fn<(date: DateValue) => boolean>(),
  locale: String,
  /** The Root's `dir` and which way Left/Right move between segments. Default: the locale's. */
  dir: String as PropType<"ltr" | "rtl">,
  /** Calendar systems other than gregorian (`createCalendar` from @internationalized/date). */
  createCalendar: fn<CreateCalendar>(),
  form: String,
  /** On the hidden input only (`bday`, …). */
  autoComplete: String,
  messages: Object as PropType<MessageOverrides<DateFieldMessages>>,
  /** Inside a host component: no Field, no hidden input, no Label (date-field "Embedded Mode"). */
  embedded: Boolean,
  /** Embedded: the ids that name the segments (after each segment's name). */
  labelledBy: Array as PropType<readonly string[]>,
  /** Embedded: the ids that describe the first segment (every segment while invalid). */
  describedBy: Array as PropType<readonly string[]>,
  /** Embedded: the field's own validity, after mount and whenever it changes. */
  onValidityChange: fn<(flags: DateValidityFlags, message: string) => void>(),
  /** Auto-advance, Backspace or an arrow found no segment to move to. */
  onBoundary: fn<(boundary: DateFieldBoundary) => void>(),
  /** The committed year, month and day (a host following the typed date). */
  onDraftChange: fn<(hint: DateFieldDraftHint) => void>(),
  /** Embedded: select all + Backspace cleared the field (a range clears both ends). */
  onClearAll: fn<() => void>(),
  /** Arrows move across every field's segments inside this element (paired fields). */
  segmentScope: Object as PropType<{ readonly value: HTMLElement | null }>,
  /** The Field's messages when the Root is the Field. */
  fieldMessages: Object as PropType<MessageOverrides<FieldMessages>>,
  /** The value changed (also `update:modelValue`). */
  onValueChange: fn<(value: FieldValue | null, details: DateFieldChangeDetails) => void>(),
  "onUpdate:modelValue": fn<(value: FieldValue | null) => void>(),
} as const

type SingleProps = {
  readonly [K in keyof typeof singleRootProps]?: unknown
}

const SingleRoot = defineComponent({
  name: "DateFieldSingleRoot",
  inheritAttrs: false,
  props: singleRootProps,
  setup(props, { attrs, slots }) {
    const env = useEnvironment(dateClockCapability)
    const instance = useRootId(() => props.id)()
    const loc = useLocale(
      () => props.locale,
      () => props.dir,
    )
    const messages = useMessages("date-field", dateFieldMessages, () => props.messages)
    // One calendar object per system: a new one each render would recompute the segments.
    let calendarObj = resolveCalendar(loc.value.locale, props.createCalendar).calendar
    const resolved = computed(() => {
      const r = resolveCalendar(loc.value.locale, props.createCalendar)
      if (calendarObj.identifier !== r.calendar.identifier) calendarObj = r.calendar
      return { calendar: calendarObj, formatLocale: r.formatLocale }
    })
    const peeked = useFieldBindingPeek()
    // Embedded: the host is the field; an enclosing Field is not this control's.
    const enclosing = () => (props.embedded ? null : (peeked?.value ?? null))
    const fieldsetDisabled = useFieldsetDisabled()
    const disabled = () =>
      props.disabled === true || enclosing()?.state.disabled === true || fieldsetDisabled.value
    const readOnly = () => props.readonly === true || enclosing()?.state.readOnly === true
    const required = () => props.required === true || enclosing()?.state.required === true
    const current = props.modelValue === undefined ? props.defaultValue : props.modelValue
    // Today is read once: a placeholder that moved at midnight would rewrite a stepped segment.
    const placeholder =
      props.placeholderValue ??
      defaultPlaceholderValue({
        today: todayOf(
          env.dateClock,
          todayZone(undefined, current instanceof Time ? null : current),
        ),
        granularity: props.granularity,
        maxGranularity: props.maxGranularity,
        timeZone: current && "timeZone" in current ? current.timeZone : undefined,
        minValue: props.minValue,
        maxValue: props.maxValue,
      })
    const inputEl = shallowRef<HTMLElement | null>(null)
    const hiddenEl = shallowRef<HTMLInputElement | null>(null)
    const selectAll = { current: false }
    let pendingFocus: DateSegmentType | null = null
    const formInput = hiddenFormInput(
      {
        input: () => hiddenEl.value,
        control: () =>
          inputEl.value?.querySelector<HTMLInputElement>("input[data-editable]") ?? null,
      },
      env,
    )
    // A consumer's details.cancel() of the last change (a refused pick keeps the popover open).
    const cancelled = { current: false }
    // Picker triggers rendered: Alt+ArrowDown opens only a picker.
    const triggers = shallowRef(0)
    const machineEnv = {
      formInput: props.embedded ? undefined : formInput,
      navigation: {
        adjacent: (segment: DateSegmentType, direction: "next" | "previous") => {
          const root = inputEl.value
          const from = root?.ownerDocument.getElementById(segmentId(instance, segment))
          if (!root || !from) return null
          const scope = props.segmentScope?.value ?? null
          const el = adjacentSegment(from, direction, { root, scope, dir: loc.value.dir })
          if (!el) return null
          // Sound: every editable segment input carries its segment type as data-type (connect).
          if (root.contains(el)) return el.getAttribute("data-type") as DateSegmentType
          void focusSafely(el, env, "programmatic", "keyboard")
          return "external" as const
        },
      },
    }
    const machineProps = () => ({
      value: props.modelValue,
      defaultValue: props.defaultValue,
      onValueChange: (
        v: FieldValue | null,
        details: { event: { type: string }; cancel(): void },
      ) => {
        cancelled.current = false
        const d: DateFieldChangeDetails = {
          reason: publicReason(details.event.type),
          modality: (details.event as { modality?: string }).modality,
          cancel: () => {
            cancelled.current = true
            details.cancel()
          },
        }
        props.onValueChange?.(v, d)
        props["onUpdate:modelValue"]?.(v)
      },
      placeholderValue: placeholder,
      locale: resolved.value.formatLocale,
      calendar: resolved.value.calendar,
      granularity: props.granularity,
      maxGranularity: props.maxGranularity,
      hourCycle: props.hourCycle,
      hideTimeZone: props.hideTimeZone,
      shouldForceLeadingZeros: props.shouldForceLeadingZeros,
      disabled: disabled(),
      readOnly: readOnly(),
      onBoundary: (b: DateFieldBoundary) => props.onBoundary?.(b),
      onDraftChange: (hint: DateFieldDraftHint) => props.onDraftChange?.(hint),
      focusSegment: (t: DateSegmentType) => {
        pendingFocus = t
      },
      id: instance,
    })
    const { view, send } = useMachine(dateFieldMachine, machineProps as never, machineEnv)
    // A requested focus move, once the step that asked for it is rendered (react-spectrum#10683).
    onMounted(() =>
      watch(
        () => view.value,
        () => {
          const t = pendingFocus
          if (t === null) return
          pendingFocus = null
          const el = inputEl.value?.ownerDocument.getElementById(segmentId(instance, t))
          if (el && el.ownerDocument.activeElement !== el) {
            void focusSafely(el, env, "programmatic", env.modality.modality())
          }
        },
        { flush: "post" },
      ),
    )
    const modality = useModality(env.modality, () => view.value.context.active !== null)
    const mounted = shallowRef(false)
    onMounted(() => (mounted.value = true))
    const base = (): BaseInput => {
      const v = view.value
      const valueNow = v.values.value ?? null
      const format = formatFor(machineProps() as never, valueNow)
      const kindSource = valueNow ?? props.defaultValue ?? placeholder
      return {
        instance,
        format,
        draft: v.context.draft,
        value: valueNow,
        defaultValue: props.defaultValue,
        kind: valueKind(kindSource),
        granularity: format.options.granularity,
        active: v.context.active,
        modality: modality.value,
        composing: v.matches("composing"),
        minValue: props.minValue,
        maxValue: props.maxValue,
        isDateUnavailable: props.isDateUnavailable,
        required: required(),
        messages: messages.value,
        // Platform attributes after mount only (date-segments "Server Rendering").
        plainTextbox: mounted.value && quirkActive("ios-vo-spinbutton-input", env),
        embedded: props.embedded,
        autoComplete: props.autoComplete,
        form: props.form,
        dir: loc.value.dir,
      }
    }
    const own = () => ({
      disabled: disabled(),
      readOnly: readOnly(),
      required: required(),
      invalid: props.invalid,
      describedBy: props.embedded ? props.describedBy?.join(" ") : undefined,
      labelledBy: props.embedded ? props.labelledBy?.join(" ") : undefined,
    })
    // The Root's own attributes and the validity need no Field binding.
    const rootApi = computed(() =>
      dateFieldConnect({
        ...base(),
        field: mergeFieldProps(
          {
            role: "group",
            labelable: false,
            disabled: disabled(),
            readOnly: readOnly(),
            required: required(),
          },
          null,
        ),
        labelledBy: own().labelledBy,
      }),
    )
    // The control's own validity: on the validity element, or to the embedding host.
    let reported: string | null = null
    const reportValidity = () => {
      const validity = rootApi.value.validity
      const key = `${validity.reason}|${validity.message}`
      if (reported === key) return
      reported = key
      if (props.embedded) props.onValidityChange?.(validity.flags, validity.message)
      else if (hiddenEl.value) setControlValidity(hiddenEl.value, validity.message)
    }
    onMounted(() => {
      reportValidity()
      watch(() => rootApi.value.validity, reportValidity, { flush: "post" })
    })
    const state = (): DateFieldState => ({
      value: view.value.values.value ?? null,
      segments: rootApi.value.segments(),
      focusedSegment: view.value.context.active,
      composing: view.value.matches("composing"),
      disabled: disabled(),
      readOnly: readOnly(),
    })
    const ctx: Ctx = {
      instance,
      view,
      send,
      base,
      own,
      embedded: props.embedded,
      onClearAll: () => props.onClearAll?.(),
      disabled,
      readOnly,
      dir: () => loc.value.dir,
      inputEl,
      hiddenEl,
      formInput,
      selectAll,
      state,
      picker: {
        closeOnSelect: () => props.closeOnSelect,
        firstDayOfWeek: () => props.firstDayOfWeek as DayOfWeek | undefined,
        placeholder,
        cancelled,
        triggers,
      },
    }
    provide(DateFieldKey, ctx)
    // Below a range's end, the picker parts are the range's.
    if (props.embedded) provide(SingleKey, null)
    // Below a range's end, the range parts are not this field's.
    if (props.embedded) provide(InControlKey, false)
    return () => {
      const rootData = normalizeProps(rootApi.value.root())
      if (props.embedded) {
        // An embedded Root forwards only plain element props (no Field props).
        return h(
          "div",
          {
            "data-scope": "date-field",
            "data-part": "root",
            "data-instance": instance,
            ...rootData,
            ...attrs,
          },
          slots["default"]?.(),
        )
      }
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
          ...rootData,
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
                // Read-only: the trigger stays focusable but never opens.
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
              // The Control (field and triggers) is inside the picker for dismissal.
              persistentElements: () => {
                const control = controlElement(instance)
                return [...(control ? [control] : []), ...(props.persistentElements?.() ?? [])]
              },
            },
            () => [h(SinglePicker, null, slots), h(HiddenInput)],
          ),
      )
    }
  },
})

/** The single Root's parts for the picker parts, read under its Field (the binding's label). */
const SinglePicker = defineComponent({
  name: "DateFieldSinglePicker",
  setup(_, { slots }) {
    const ctx = useDateField("Root")
    provide(SingleKey, { ctx, api: useApi(ctx) })
    return () => slots["default"]?.()
  },
})

/** The hidden native input: name, ISO value, constraints, validity, reset, autofill. */
const HiddenInput = defineComponent({
  name: "DateFieldHiddenInput",
  setup() {
    const ctx = useDateField("Root")
    const api = useApi(ctx)
    const mirror = () => ({
      value: formValueOf(ctx.view.value.values.value ?? null, ctx.base().granularity),
    })
    const sync = () => ctx.formInput.sync(mirror(), { dispatch: false })
    onMounted(() => {
      sync()
      onBeforeUnmount(
        ctx.formInput.track({
          onReset: () => ctx.send({ type: "RESET" }),
          current: mirror,
          onNativeInput: (input) => {
            ctx.send({ type: "INPUT.ADOPT", value: input.value })
            return true
          },
        }),
      )
      watch(() => mirror().value, sync, { flush: "post" })
    })
    onUpdated(sync)
    return () =>
      h("input", {
        ...normalizeProps(api().hiddenInput()),
        ref: refTo(ctx.hiddenEl as never),
      })
  },
})

/** Single mode (default), or a range of two ends with `selection-mode="range"`. */
const Root = defineComponent({
  name: "DateFieldRoot",
  inheritAttrs: false,
  props: { selectionMode: String as PropType<"single" | "range"> },
  setup(props, { attrs, slots }) {
    return () =>
      props.selectionMode === "range"
        ? h(DateRangeFieldRoot, attrs, slots)
        : h(SingleRoot, attrs, slots)
  },
})

type InputSlots = SlotsType<{
  /** Segments in order; without a slot every segment renders automatically. */
  default?: (segments: readonly SegmentPart[]) => VNodeChild
}>

/** The group: one field's segments, or in range mode both ends with a separator. */
const Input = defineComponent({
  name: "DateFieldInput",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as InputSlots,
  setup(props, { attrs, slots }) {
    const single = useDateFieldOrNull()
    const range = useDateRange()
    return () =>
      !single && range
        ? h(DateRangeInput, {
            ...attrs,
            renderEnd: (edge: "start" | "end") => h(RangeEnd, { edge }),
          })
        : h(SingleInput, { ...attrs, asChild: props.asChild }, slots)
  },
})

/** One end of a range: an embedded field named by the end and the Label. */
const RangeEnd = defineComponent({
  name: "DateFieldRangeEnd",
  inheritAttrs: false,
  props: { ...asChildProp, edge: { type: String as PropType<"start" | "end">, required: true } },
  setup(props, { attrs }) {
    const ctx = useDateRange()
    if (!ctx) throw new Error("DateField.Start / End must be inside a range DateField.Root")
    // The group registers with the Field; an end only reads its label's id.
    const binding = useFieldBindingPeek()
    const env = useEnvironment()
    const editable = (which: "start" | "end") =>
      Array.from(
        ctx.inputEl.value?.querySelectorAll<HTMLElement>(
          `[data-edge="${which}"] input[data-editable]`,
        ) ?? [],
      )
    return () => {
      const api = ctx.api(binding?.value ?? null)
      const edge = props.edge
      const EDGE = edge === "start" ? "START" : "END"
      const value =
        edge === "start" ? ctx.view.value.context.startValue : ctx.view.value.context.endValue
      const labelledBy = [
        edge === "start" ? api.ids.startName : api.ids.endName,
        binding?.value.ids.label,
      ].filter((x): x is string => x !== undefined)
      return renderPart(
        "div",
        mergeProps(normalizeProps(api.edge(edge)), attrs),
        h(
          SingleRoot,
          {
            // The Vue Field's prop is `readonly`.
            ...(({ readOnly, ...end }) => ({ ...end, readonly: readOnly }))(ctx.end()),
            embedded: true,
            modelValue: value,
            onValueChange: (v: FieldValue | null, details: DateFieldChangeDetails) =>
              ctx.send({ type: `${EDGE}.COMMIT`, value: v, reason: details.reason }),
            // Select all + Backspace in either end clears the pair (both ends).
            onClearAll: () => ctx.send({ type: "CLEAR" }),
            onValidityChange: (flags: DateValidityFlags, message: string) =>
              ctx.send({ type: `${EDGE}.VALIDITY`, flags, message }),
            labelledBy,
            // The pair's validity and the Field's description reach the ends' segments.
            invalid: api.invalid,
            describedBy: api.endDescribedBy(edge),
            segmentScope: ctx.inputEl,
            // Focus between ends (spec "Range Mode — Focus Between Ends").
            onBoundary: (b: DateFieldBoundary) => {
              const target =
                edge === "start" && b.direction === "next" && b.reason === "advance"
                  ? editable("end")[0]
                  : edge === "end" && b.direction === "previous" && b.reason === "backspace"
                    ? editable("start").at(-1)
                    : undefined
              if (target) void focusSafely(target, env, "programmatic", "keyboard")
            },
          } as SingleProps as never,
          () => h(SingleInput),
        ),
        props.asChild,
      )
    }
  },
})

const Start = defineComponent({
  name: "DateFieldStart",
  inheritAttrs: false,
  setup(_, { attrs }) {
    return () => h(RangeEnd, { ...attrs, edge: "start" })
  },
})
const End = defineComponent({
  name: "DateFieldEnd",
  inheritAttrs: false,
  setup(_, { attrs }) {
    return () => h(RangeEnd, { ...attrs, edge: "end" })
  },
})
const Separator = defineComponent({
  name: "DateFieldSeparator",
  inheritAttrs: false,
  setup(_, { attrs }) {
    const ctx = useDateRange()
    if (!ctx) throw new Error("DateField.Separator must be inside a range DateField.Root")
    return () =>
      renderPart("span", mergeProps(normalizeProps(ctx.api(null).separator()), attrs), undefined)
  },
})

/** The group of segments, its hidden segment names and value description. */
const SingleInput = defineComponent({
  name: "DateFieldSingleInput",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as InputSlots,
  setup(props, { attrs, slots }) {
    const ctx = useDateField("Input")
    const env = useEnvironment()
    // An embedded field is not the Field's control (its host is): it claims nothing.
    const binding = useFieldControl({ skip: ctx.embedded })
    const api = useApi(ctx)
    const inControl = inject(InControlKey, false)
    const firstId = () => {
      const first = api()
        .segments()
        .find((s) => s.editable)
      return first ? segmentId(ctx.instance, first.type as DateSegmentType) : undefined
    }
    if (binding && !ctx.embedded) {
      onMounted(() =>
        watch(
          firstId,
          (id, _, onCleanup) => {
            if (!id) return
            onCleanup(
              binding.value.register(
                {
                  id,
                  labelable: false,
                  focus: (m) => {
                    const el = ctx.inputEl.value?.ownerDocument.getElementById(id)
                    if (el) void focusSafely(el, env, "programmatic", m)
                  },
                  validityElement: () => ctx.hiddenEl.value,
                  value: () => ctx.view.value.values.value ?? null,
                },
                id,
              ),
            )
          },
          { immediate: true },
        ),
      )
      // Each commit that changed the value or the field's own validity is reported to the
      // Field once (date-field "Field Integration"): an impossible date leaves the value null
      // but must still be validated when the user leaves.
      onMounted(() =>
        watch([() => ctx.view.value.values.value ?? null, () => api().validity.reason], ([value]) =>
          binding.value.report({ type: "change", value, user: true, composing: false }),
        ),
      )
    }
    const handlers = {
      // A press on the group outside a segment: the last filled segment before it (pointer only).
      onPointerdown: (e: PointerEvent) => {
        const root = ctx.inputEl.value
        if (!root || ctx.disabled() || (e.target as Element).closest("input")) return
        const el = segmentAtPress(root, e.clientX, ctx.dir())
        if (!el) return
        e.preventDefault()
        void focusSafely(el, env, "programmatic", "pointer")
      },
      // The press's mousedown would move focus to the body (the group is not focusable).
      onMousedown: (e: MouseEvent) => {
        if (!(e.target as Element).closest("input")) e.preventDefault()
      },
    }
    return () => {
      const a = api()
      const segments = ctx.state().segments
      const content = slots.default
        ? slots.default(segments)
        : segments.map((s) => h(Segment, { key: s.key, segment: s }))
      const description = a.valueDescription()
      return renderPart(
        "div",
        mergeProps(
          {
            ...joinHandlers(normalizeProps(a.input({ inControl })), handlers),
            ref: refTo(ctx.inputEl as never),
          },
          attrs,
        ),
        h(Fragment, [
          content,
          ...a
            .segmentNames()
            .map((n) =>
              h("span", { key: n.key, ...normalizeProps(n.props), "aria-hidden": "true" }, n.text),
            ),
          description
            ? h(
                "span",
                { ...normalizeProps(description.props), "aria-hidden": "true" },
                description.text,
              )
            : null,
        ]),
        props.asChild,
      )
    }
  },
})

/** One segment: an input for an editable segment or the zone, a hidden span for a literal. */
const Segment = defineComponent({
  name: "DateFieldSegment",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    /** The segment to render, one of those Input's slot receives. */
    segment: { type: Object as PropType<SegmentPart>, required: true },
  },
  setup(props, { attrs }) {
    const ctx = useDateField("Segment")
    const api = useApi(ctx)
    const env = useEnvironment()
    const popover = usePopoverControls()
    // A range's triggers, provided above its embedded ends (Alt+ArrowDown).
    const rangeTriggers = inject(RangeTriggersKey, null)
    const el = shallowRef<Element | null>(null)
    const type = () => props.segment.type as DateSegmentType
    // `beforeinput`: insertions are planned before they apply.
    onMounted(() =>
      watch(
        el,
        (input, _, onCleanup) => {
          if (!input || props.segment.type === "literal") return
          const onBeforeInput = (e: Event) => {
            const ie = e as InputEvent
            if (ctx.view.value.matches("composing") || ie.isComposing) return
            const plan = planSegmentInput({ data: ie.data, inputType: ie.inputType }, type())
            if (plan.cancel) e.preventDefault()
            if (plan.event) ctx.send(plan.event)
          }
          input.addEventListener("beforeinput", onBeforeInput)
          onCleanup(() => input.removeEventListener("beforeinput", onBeforeInput))
        },
        { immediate: true },
      ),
    )
    // A literal: the server's formatter may differ from the browser's in a literal only (a
    // space before AM/PM): corrected to the browser's text after mount.
    const fixLiteral = () => {
      if (props.segment.type !== "literal") return
      if (el.value && el.value.textContent !== props.segment.text)
        el.value.textContent = props.segment.text
    }
    onMounted(fixLiteral)
    onUpdated(fixLiteral)
    const handlers = {
      onFocus: (e: FocusEvent) => {
        ctx.selectAll.current = false
        ctx.send({ type: "SEGMENT.FOCUS", segment: type(), modality: env.modality.modality() })
        // The whole text selected, as the native control highlights its sub-field.
        ;(e.currentTarget as HTMLInputElement).select()
      },
      onBlur: (e: FocusEvent) => {
        const next = e.relatedTarget as Node | null
        const inside = next !== null && ctx.inputEl.value?.contains(next) === true
        ctx.send({ type: "SEGMENT.BLUR", related: inside ? "segment" : "outside" })
      },
      onKeydown: (e: KeyboardEvent) => {
        if (e.defaultPrevented) return
        const event = dateFieldKey(describeKey(e, env), type(), {
          dir: ctx.dir(),
          platform: env.platform,
          selectAll: ctx.selectAll.current,
        })
        if (event === "select-all") {
          ctx.selectAll.current = true
          return
        }
        if (event === "settle") {
          // Not prevented: the form's implicit submission follows, with the value committed.
          ctx.send({ type: "SETTLE" })
          return
        }
        if (event === "open-picker") {
          // Only a picker opens; otherwise the key is the browser's. A range's ends are
          // embedded: their host's triggers count.
          const count = ctx.embedded ? (rangeTriggers?.value ?? 0) : ctx.picker.triggers.value
          if (count === 0 || !popover || popover.open()) return
          e.preventDefault()
          popover.send({ type: "trigger", modality: "keyboard" })
          return
        }
        ctx.selectAll.current = false
        if (!event) return
        e.preventDefault()
        // Embedded: select all + Backspace clears the host's pair, even when this field's own
        // value does not change (a partial end).
        if (typeof event === "object" && event.type === "CLEAR_ALL") ctx.onClearAll()
        ctx.send(event)
      },
      onCompositionstart: () => ctx.send({ type: "COMPOSITION.START" }),
      onCompositionend: (e: CompositionEvent) =>
        ctx.send({ type: "COMPOSITION.END", segment: type(), text: e.data }),
      onPaste: (e: ClipboardEvent) => {
        e.preventDefault()
        if (ctx.disabled() || ctx.readOnly()) return
        ctx.send({ type: "PASTE", text: e.clipboardData?.getData("text") ?? "" })
      },
      onCopy: (e: ClipboardEvent) => {
        e.preventDefault()
        e.clipboardData?.setData("text/plain", api().copyText(type()))
      },
    }
    return () => {
      const own = normalizeProps(api().segment(props.segment))
      if (props.segment.type === "literal") {
        const { children: _c, ...span } = own
        void _c
        return renderPart(
          "span",
          mergeProps({ ...span, ref: refTo(el) }, attrs),
          props.segment.text,
          props.asChild,
        )
      }
      if (props.segment.type === "timeZoneName") {
        return renderPart(
          "input",
          mergeProps({ ...own, ref: refTo(el) }, attrs),
          undefined,
          props.asChild,
        )
      }
      return renderPart(
        "input",
        mergeProps({ ...joinHandlers(own, handlers), ref: refTo(el) }, attrs),
        undefined,
        props.asChild,
      )
    }
  },
})

function warnEmbedded(part: string) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[rind-ui] date-field: an embedded field renders no ${part}; the host names it.`)
  }
}

/** A Label-like part: nothing inside an embedded field (its host names it). */
function hostPart(name: "Label" | "Description" | "ErrorMessage", part: typeof HostLabel) {
  return defineComponent({
    name: `DateField${name}`,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      // A range Root is the Field: its Label is the Field's (no single-field context there).
      const single = useDateFieldOrNull()
      const range = useDateRange()
      if (!single && !range) throw new Error(`DateField.${name} must be inside DateField.Root`)
      const embedded = single?.embedded === true
      onMounted(() => {
        if (embedded) warnEmbedded(name)
      })
      return () => (embedded ? null : h(part, attrs, slots))
    },
  })
}

const Label = hostPart("Label", HostLabel)
const Description = hostPart("Description", HostDescription as typeof HostLabel)
const ErrorMessage = hostPart("ErrorMessage", HostErrorMessage as typeof HostLabel)

export type { DateFieldState }
/** The parts, by name: `date-field.parts.ts` re-exports them as the `DateField` namespace. */
export {
  Description,
  End,
  ErrorMessage,
  Input,
  Label,
  PickerCalendar as Calendar,
  PickerClearTrigger as ClearTrigger,
  PickerContent as Content,
  PickerControl as Control,
  PickerTrigger as Trigger,
  Root,
  Segment,
  Separator,
  SingleRoot,
  Start,
}
