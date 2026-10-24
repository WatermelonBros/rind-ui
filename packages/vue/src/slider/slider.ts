// Slider parts: wiring only. The machine owns the value (always an array), connect every
// attribute. Here the consumer's shape (`number` or array) is converted at the boundary, the
// thumb inputs are reached for property sync, reset and native adoption, and the Control's
// press is measured once by pointer-drag.
import {
  blurEvent,
  type ChangeDetails,
  describeKey,
  focusEvent,
  focusSafely,
  fractionOf,
  hiddenFormInput,
  isDragPress,
  labelInteraction,
  type Modality,
  mergeFieldProps,
  normalizeValues,
  type PartNaming,
  partId,
  pointerDragSession,
  resolveSlider,
  type SliderCommitDetails,
  type SliderEvent,
  type SliderMessages,
  type SliderOrientation,
  type SliderPart,
  type SliderReason,
  sameNumbers,
  sliderConnect,
  sliderDragAxis,
  sliderKeyEvent,
  sliderMachine,
  sliderMessages,
  sliderRange,
  type ThumbAlignment,
  type ThumbCollision,
  textSelection,
  thumbValueTexts,
  warnOwnLabelInField,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import {
  computed,
  defineComponent,
  h,
  type InjectionKey,
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
import { useFieldControl } from "../field/field"
import { useFieldsetDisabled } from "../fieldset/context"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    slider: SliderMessages
  }
}

/** A single value, or one value per thumb. */
export type SliderValue = number | readonly number[]

export interface SliderChangeDetails {
  readonly reason: SliderReason
  /** The thumb whose value changed (the first, when several did). */
  readonly index: number
  readonly event: ChangeDetails<SliderEvent>["event"]
  /** Prevents the change (uncontrolled) or refuses it (controlled). */
  cancel(): void
}

export interface SliderState {
  readonly values: readonly number[]
  readonly dragging: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly orientation: SliderOrientation
}

type FormInput = ReturnType<typeof hiddenFormInput>

interface Ctx {
  readonly instance: () => string
  readonly api: () => ReturnType<typeof sliderConnect>
  readonly state: () => SliderState
  readonly send: (e: SliderEvent) => void
  readonly registry: ReturnType<typeof usePartRegistry<"label" | "description">>
  readonly inputs: (HTMLInputElement | null)[]
  readonly thumbs: (Element | null)[]
  readonly control: { value: Element | null }
  readonly values: () => readonly number[]
  readonly formInput: (index: number) => FormInput
  readonly setThumbDisabled: (index: number, disabled: boolean | undefined) => void
  readonly press: (e: PointerEvent) => void
  readonly inField: boolean
  readonly orientation: () => SliderOrientation
  readonly dir: () => "ltr" | "rtl"
}
const SliderKey: InjectionKey<Ctx> = Symbol("rind-ui.slider")
/**
 * Internal (not exported from the package): set by Color Slider, whose Root is the pointer
 * surface when there is no Control. A plain Slider's Root never starts a drag.
 */
export const SliderRootSurfaceKey: InjectionKey<boolean> = Symbol("rind-ui.slider-root-surface")
/**
 * Internal (not exported from the package): set by a component that renders a Slider as its
 * part (Color Picker's channel slider): the host's scope and part names.
 */
export const SliderNamingKey: InjectionKey<PartNaming<SliderPart>> = Symbol("rind-ui.slider-naming")
function useSlider(part: string): Ctx {
  const ctx = inject(SliderKey, null)
  if (!ctx) throw new Error(`Slider.${part} must be inside Slider.Root`)
  return ctx
}

const toArray = (v: SliderValue | undefined): readonly number[] | undefined =>
  v === undefined ? undefined : typeof v === "number" ? [v] : v

type Slots = SlotsType<{ default?: (state: SliderState) => VNodeChild }>
const valueType = [Number, Array] as PropType<SliderValue>

/** A slider with one native range input per thumb (APG Slider, Multi-Thumb Slider). */
const Root = defineComponent({
  name: "SliderRoot",
  inheritAttrs: false,
  props: {
    /** Controlled value (`v-model`): a number, or one number per thumb. */
    modelValue: { type: valueType, default: undefined },
    /** Read at creation (default `min`); a later change only changes what a form reset restores. */
    defaultValue: { type: valueType, default: undefined },
    min: Number,
    max: Number,
    step: Number,
    /** Shift + arrow and PageUp / PageDown (default one tenth of the range). */
    largeStep: Number,
    minStepsBetweenThumbs: Number,
    thumbCollision: String as PropType<ThumbCollision>,
    /** `contain` keeps thumbs inside the track; set `--rind-slider-thumb-size` to the thumb size. Default: `center`. */
    thumbAlignment: { type: String as PropType<ThumbAlignment>, default: "center" },
    /** The axis. Default: `horizontal`. */
    orientation: { type: String as PropType<SliderOrientation>, default: "horizontal" },
    /** Ignores all input; thumbs leave the tab order. */
    disabled: Boolean,
    /** Keeps focus and value, ignores changes. */
    readonly: Boolean,
    /** `data-required` only: a range input always has a value. */
    required: Boolean,
    /** Sets `aria-invalid` and `data-invalid`. */
    invalid: Boolean,
    /** The submitted field name of every thumb. */
    name: String,
    /** The id of the form the inputs belong to. */
    form: String,
    formatOptions: Object as PropType<Intl.NumberFormatOptions>,
    /** Locale for formatting. Default: the provider's. */
    locale: String,
    /** Reading direction; mirrors a horizontal Slider. Default: the provider's. */
    dir: String as PropType<"ltr" | "rtl">,
    messages: Object as PropType<Partial<SliderMessages>>,
    id: String,
    ...asChildProp,
  },
  emits: {
    valueChange: (_value: SliderValue, _details: SliderChangeDetails) => true,
    "update:modelValue": (_value: SliderValue) => true,
    /** Once at the end of each interaction that changed the value (release, key, adjustment). */
    valueCommit: (_value: SliderValue, _details: SliderCommitDetails) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment()
    const instance = useRootId(() => props.id)
    const locale = useLocale(
      () => props.locale,
      () => props.dir,
    )
    const messages = useMessages("slider", sliderMessages, () => props.messages)
    const binding = useFieldControl()
    const fieldsetContext = useFieldsetDisabled()
    const fieldsetDom = shallowRef(false)
    const registry = usePartRegistry<"label" | "description">({ scope: "slider", root: instance() })
    const ownLabel = useRenderedId(registry, "label")
    const ownDescription = useRenderedId(registry, "description")
    const scalar = () => !Array.isArray(props.modelValue ?? props.defaultValue)
    const rangeProps = () => ({
      min: props.min,
      max: props.max,
      step: props.step,
      largeStep: props.largeStep,
      minStepsBetweenThumbs: props.minStepsBetweenThumbs,
    })
    const range = computed(() => sliderRange(rangeProps()))
    // Normalised once, at creation (grid, order, gap: ZG#2488); later defaults change a reset only.
    const creationDefault = normalizeValues(
      toArray(props.defaultValue) ?? [range.value.min],
      range.value,
      "defaultValue",
    )
    const inputs: (HTMLInputElement | null)[] = []
    const thumbs: (Element | null)[] = []
    const control = shallowRef<Element | null>(null)
    const rootSurface = inject(SliderRootSurfaceKey, false)
    const naming = inject(SliderNamingKey, null)
    // Its parts under a host's names when the Slider is another component's part.
    const scopeName = naming?.scope ?? "slider"
    const partNamed = (part: SliderPart) => naming?.part(part) ?? part
    let latest: readonly number[] = creationDefault
    const thumbDisabled = shallowRef<readonly boolean[]>([])
    const setThumbDisabled = (index: number, off: boolean | undefined) => {
      const prev = thumbDisabled.value
      if ((prev[index] === true) === (off === true)) return
      const next = [...prev]
      next[index] = off === true
      thumbDisabled.value = next
    }
    const field = computed(() =>
      mergeFieldProps(
        {
          role: "slider",
          labelable: false,
          disabled: props.disabled || fieldsetContext.value || fieldsetDom.value,
          readOnly: props.readonly,
          required: props.required,
          invalid: props.invalid,
          name: props.name,
          describedBy: ownDescription.value,
        },
        binding?.value ?? null,
      ),
    )
    // One hidden-form-input per thumb input (sync, reset, adoption); created on first use.
    const formInputs = new Map<number, FormInput>()
    const formInput = (index: number) => {
      let cap = formInputs.get(index)
      if (!cap) {
        cap = hiddenFormInput({ input: () => inputs[index] ?? null }, env)
        formInputs.set(index, cap)
      }
      return cap
    }
    const focusThumb = (index: number, modality: Modality) => {
      const el = inputs[index]
      if (el) void focusSafely(el, env, "programmatic", modality)
    }
    const drag = pointerDragSession()
    const texts = (vs: readonly number[]) =>
      thumbValueTexts({
        values: vs,
        locale: locale.value.locale,
        formatOptions: props.formatOptions,
        messages: messages.value,
      })
    const shape = (v: readonly number[]): SliderValue => (scalar() ? (v[0] ?? range.value.min) : v)
    let lastReason: SliderReason | null = null
    const machineProps = () => {
      const valueArray = toArray(props.modelValue)
      if (valueArray) normalizeValues(valueArray, range.value, "value") // development warning only
      return {
        value: valueArray,
        defaultValue: toArray(props.defaultValue) ?? creationDefault,
        ...rangeProps(),
        thumbCollision: props.thumbCollision,
        disabled: field.value.disabled,
        readOnly: field.value.readOnly,
        thumbDisabled: thumbDisabled.value,
        onValueChange: (next: readonly number[], details: ChangeDetails<SliderEvent>) => {
          lastReason = details.reason
          const before = latest
          if (props.modelValue === undefined) {
            // Uncontrolled: the inputs already show the value when the consumer runs (a
            // requestSubmit() there submits it); a cancel re-syncs them ($reverted).
            const t = texts(next)
            next.forEach((v, i) => {
              formInput(i).sync({ value: String(v) }, { dispatch: false })
              inputs[i]?.setAttribute("aria-valuenow", String(v))
              const text = t[i]
              if (text !== undefined) inputs[i]?.setAttribute("aria-valuetext", text)
            })
          }
          let cancelled = false
          emit("valueChange", shape(next), {
            reason: details.reason,
            index: Math.max(
              0,
              next.findIndex((v, i) => v !== before[i]),
            ),
            event: details.event,
            cancel: () => {
              cancelled = true
              details.cancel()
            },
          })
          if (!cancelled) emit("update:modelValue", shape(next))
        },
        onValueCommit: (next: readonly number[], details: SliderCommitDetails) => {
          binding?.value.report({ type: "commit" })
          emit("valueCommit", shape(next), details)
        },
      }
    }
    const { view, send } = useMachine(sliderMachine, machineProps, {
      inputs: {
        sync: (values: readonly number[], dispatch: readonly boolean[]) =>
          values.forEach((v, i) => {
            formInput(i).sync({ value: String(v) }, { dispatch: dispatch[i] === true })
          }),
      },
      drag,
      focusThumb,
    })
    const values = computed(() => resolveSlider(machineProps(), view.value.values.value).values)
    const focused = () => view.value.context.focused
    const modality = useModality(env.modality, () => focused() !== null)
    const dragging = () => view.value.matches("dragging")
    const api = computed(() => {
      const i = instance()
      return sliderConnect({
        instance: i,
        ...(naming ? { naming } : {}),
        values: values.value,
        range: range.value,
        orientation: props.orientation,
        dir: locale.value.dir,
        alignment: props.thumbAlignment,
        field: field.value,
        fieldData: binding?.value.data,
        thumbDisabled: thumbDisabled.value,
        focused: focused(),
        modality: modality.value,
        active: view.value.context.active,
        draggingThumb: view.value.context.dragging,
        dragging: dragging(),
        ids: {
          root: i,
          label: partId("slider", i, "label"),
          description: partId("slider", i, "description"),
          input: (n: number) => partId("slider", i, `input-${n}`),
        },
        labelledBy: binding?.value.ids.label ?? ownLabel.value,
        locale: locale.value.locale,
        formatOptions: props.formatOptions,
        messages: messages.value,
        form: props.form,
        defaultValues: normalizeValues(toArray(props.defaultValue) ?? creationDefault, range.value),
      })
    })
    // After every update: each input shows the value (hydration, a parent's change); no events.
    const show = () => {
      latest = values.value
      for (const [i, v] of latest.entries())
        formInput(i).sync({ value: String(v) }, { dispatch: false })
    }
    // A touch drag (iOS): no text selection or callout while it lasts (BU#1295).
    let selection: (() => void) | null = null
    onMounted(() => {
      show()
      const node = control.value ?? inputs[0] ?? null
      if (node) {
        const w = watchFieldsetDisabled(node, (d) => (fieldsetDom.value = d))
        fieldsetDom.value = w.disabled
        onBeforeUnmount(w.stop)
      }
      // field-control: one control; the first thumb input is its validity element.
      if (binding) {
        const first = partId("slider", instance(), "input-0")
        onBeforeUnmount(
          binding.value.register(
            {
              id: first,
              labelable: false,
              focus: (m) => focusThumb(0, m),
              validityElement: () => inputs[0] ?? null,
              value: () => values.value,
            },
            first,
          ),
        )
      }
      let reported = values.value
      watch(values, (now) => {
        if (sameNumbers(reported, now)) return
        reported = now
        const user = lastReason !== null && lastReason !== "RESET"
        lastReason = null
        binding?.value.report({ type: "change", value: now, user, composing: false })
      })
      watch(dragging, (d) => {
        if (d) return
        selection?.()
        selection = null
      })
    })
    onUpdated(show)
    const state = (): SliderState => ({
      values: values.value,
      dragging: dragging(),
      disabled: field.value.disabled,
      readOnly: field.value.readOnly,
      orientation: props.orientation,
    })
    const press = (e: PointerEvent) => {
      const f = field.value
      if (!isDragPress(e) || drag.active || f.disabled || f.readOnly) return
      const surface = e.currentTarget
      if (!(surface instanceof HTMLElement)) return
      const thumb = (e.target as Element | null)?.closest?.(
        `[data-scope="${scopeName}"][data-part="${partNamed("thumb")}"]`,
      )
      // A disabled thumb is no target: the press is a track press there.
      const index =
        thumb &&
        thumb.getAttribute("data-instance") === instance() &&
        !thumb.hasAttribute("data-disabled")
          ? Number(thumb.getAttribute("data-index"))
          : null
      const vs = values.value
      const anchor =
        index === null ? undefined : fractionOf(vs[index] ?? range.value.min, range.value)
      const contain = props.thumbAlignment === "contain" ? (thumbs[index ?? 0] ?? null) : null
      const fraction = drag.press(surface, e, {
        ...sliderDragAxis(
          { orientation: props.orientation, dir: locale.value.dir },
          contain instanceof HTMLElement ? contain : null,
        ),
        anchor,
      })
      // Focus goes to the thumb input (the machine moves it): the browser must not blur it.
      e.preventDefault()
      const touch = e.pointerType === "touch"
      if (touch) selection = textSelection(surface, env, true)
      send({ type: "POINTER.DOWN", fraction, thumb: index, modality: touch ? "touch" : "pointer" })
    }
    // Color Slider only: without a Control part its Root is the pointer surface; presses that
    // start on the Label or the ValueText do not start a drag.
    const rootPress = (e: PointerEvent) => {
      if (!rootSurface || control.value) return
      const from = (e.target as Element | null)?.closest?.(`[data-scope="${scopeName}"][data-part]`)
      const partName = from?.getAttribute("data-part")
      if (
        partName === partNamed("label") ||
        partName === partNamed("value-text") ||
        partName === partNamed("description")
      )
        return
      press(e)
    }
    provide(SliderKey, {
      instance,
      api: () => api.value,
      state,
      send,
      registry,
      inputs,
      thumbs,
      control,
      values: () => values.value,
      formInput,
      setThumbDisabled,
      press,
      inField: binding !== null,
      orientation: () => props.orientation,
      dir: () => locale.value.dir,
    })
    return () =>
      renderPart(
        "div",
        mergeProps(
          joinHandlers(normalizeProps(api.value.root()), { onPointerdown: rootPress }),
          attrs,
        ),
        slots.default?.(state()),
        props.asChild,
      )
  },
})

const part = (name: string, tag: string, own: (ctx: Ctx) => Parameters<typeof normalizeProps>[0]) =>
  defineComponent({
    name: `Slider${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    setup(props, { attrs, slots }) {
      const ctx = useSlider(name)
      return () =>
        renderPart(
          tag,
          mergeProps(normalizeProps(own(ctx)), attrs),
          slots["default"]?.(ctx.state()),
          props.asChild,
        )
    },
  })

/** The visible name; a press focuses the first enabled thumb (Safari does not, from a label). */
const Label = defineComponent({
  name: "SliderLabel",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useSlider("Label")
    const env = useEnvironment()
    useRegisterPart(ctx.registry, "label", () => partId("slider", ctx.instance(), "label"))
    onMounted(() => {
      if (ctx.inField) warnOwnLabelInField("slider")
    })
    const firstEnabled = () => ctx.inputs.find((el) => el && !el.disabled) ?? null
    const interaction = normalizeProps(
      labelInteraction(env, {
        target: firstEnabled,
        forwardsFocus: () => true,
        // A pointer press: no focus ring.
        focusTarget: () => {
          const el = firstEnabled()
          if (el) void focusSafely(el, env, "programmatic", "pointer")
        },
      }),
    )
    return () =>
      renderPart(
        "label",
        mergeProps({ ...normalizeProps(ctx.api().label()), ...interaction }, attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

/** The formatted value (a range for two thumbs). Not a live region. */
const ValueText = defineComponent({
  name: "SliderValueText",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useSlider("ValueText")
    return () => {
      const { text, ...own } = ctx.api().valueText()
      return renderPart(
        "div",
        mergeProps(normalizeProps(own), attrs),
        slots.default?.(ctx.state()) ?? text,
        props.asChild,
      )
    }
  },
})

/** The pointer surface: a press moves the nearest thumb there and starts a drag. */
const Control = defineComponent({
  name: "SliderControl",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useSlider("Control")
    const env = useEnvironment()
    // The modality tracker must see the pointerdown that comes before the thumb's focus.
    onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
    return () =>
      renderPart(
        "div",
        mergeProps(
          {
            ...joinHandlers(normalizeProps(ctx.api().control()), { onPointerdown: ctx.press }),
            ref: refTo(ctx.control),
          },
          attrs,
        ),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

const Track = part("Track", "div", (ctx) => ctx.api().track())
/** The filled range: from the start (one thumb) or between the outer thumbs. */
const Indicator = part("Indicator", "div", (ctx) => ctx.api().indicator())
/** Decorative tick marks (`aria-hidden`). */
const MarkerGroup = part("MarkerGroup", "div", (ctx) => ctx.api().markerGroup())

/** One thumb and its native range input (the focusable `slider`). */
const Thumb = defineComponent({
  name: "SliderThumb",
  inheritAttrs: false,
  props: {
    /** The thumb's value index (known on the server). */
    index: { type: Number, required: true },
    /** Disables this thumb only. */
    disabled: { type: Boolean, default: undefined },
    /** Submitted under this name instead of the Root's. */
    name: String,
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useSlider("Thumb")
    const env = useEnvironment()
    onMounted(() => {
      watch(
        () => [props.index, props.disabled] as const,
        ([index, disabled], old) => {
          if (old && old[0] !== index) ctx.setThumbDisabled(old[0], false)
          ctx.setThumbDisabled(index, disabled)
        },
        { immediate: true },
      )
      // Reset (once, on the first input), re-sync after it, and native adoption (AT adjusting).
      watch(
        () => props.index,
        (index, _old, onCleanup) =>
          onCleanup(
            ctx.formInput(index).track({
              onReset: () => ctx.send({ type: "RESET" }),
              resetsWithForm: index === 0,
              current: () => ({ value: String(ctx.values()[index] ?? "") }),
              onNativeInput: (input) => {
                ctx.send({ type: "INPUT.CHANGE", thumb: index, value: Number(input.value) })
                return true
              },
            }),
          ),
        { immediate: true },
      )
    })
    onBeforeUnmount(() => ctx.setThumbDisabled(props.index, false))
    const setThumb = (node: unknown) => {
      ctx.thumbs[props.index] = node instanceof Element ? node : null
    }
    const setInput = (node: unknown) => {
      ctx.inputs[props.index] = node instanceof HTMLInputElement ? node : null
    }
    return () => {
      const {
        "aria-label": ariaLabel,
        "aria-labelledby": ariaLabelledBy,
        ...rest
      } = attrs as Record<string, unknown>
      const own = {
        disabled: props.disabled,
        ariaLabel: ariaLabel as string | undefined,
        ariaLabelledBy: ariaLabelledBy as string | undefined,
        name: props.name,
      }
      const index = props.index
      const api = ctx.api()
      const inputProps = joinHandlers(normalizeProps(api.input(index, own)), {
        onKeydown: (e: KeyboardEvent) => {
          const event = sliderKeyEvent(describeKey(e, env), index, {
            orientation: ctx.orientation(),
            dir: ctx.dir(),
            platform: env.platform,
            dragging: ctx.state().dragging,
          })
          if (!event || e.defaultPrevented) return
          // Neither the native input nor the page reacts (RX#1054, KB#293).
          e.preventDefault()
          // Escape ends the drag only: a surrounding layer stays open.
          if (event.type === "DRAG.CANCEL") e.stopPropagation()
          ctx.send(event)
        },
        onFocusin: (e: FocusEvent) => {
          if (e.currentTarget instanceof Element)
            ctx.send({ ...focusEvent(e.currentTarget, env.modality), thumb: index })
        },
        onFocusout: () => ctx.send({ ...blurEvent(env.modality), thumb: index }),
      })
      return renderPart(
        "div",
        mergeProps({ ...normalizeProps(api.thumb(index, own)), ref: setThumb }, rest),
        [slots.default?.(ctx.state()), h("input", { ...inputProps, ref: setInput })],
        props.asChild,
      )
    }
  },
})

/** A tick at `value`: `data-state` under-value, at-value or over-value. */
const Marker = defineComponent({
  name: "SliderMarker",
  inheritAttrs: false,
  props: {
    /** The value the tick marks. */
    value: { type: Number, required: true },
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useSlider("Marker")
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(ctx.api().marker(props.value)), attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

/** Help text, referenced by every thumb input's `aria-describedby`. */
const Description = defineComponent({
  name: "SliderDescription",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useSlider("Description")
    useRegisterPart(ctx.registry, "description", () =>
      partId("slider", ctx.instance(), "description"),
    )
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(ctx.api().description()), attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

/** The parts, by name: `slider.parts.ts` re-exports them as the `Slider` namespace. */
export {
  Control,
  Description,
  Indicator,
  Label,
  Marker,
  MarkerGroup,
  Root,
  Thumb,
  Track,
  ValueText,
}
