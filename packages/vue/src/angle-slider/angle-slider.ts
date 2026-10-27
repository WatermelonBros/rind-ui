// Angle Slider parts (add-angle-slider): wiring only. The machine owns the angle, connect every
// attribute; here the Control's press is measured by pointer-angle and the one native range
// input is reached for property sync, reset and native adoption.
import {
  type AngleSliderEvent,
  type AngleSliderMessages,
  type AngleSliderReason,
  angleSliderConnect,
  angleSliderKeyEvent,
  angleSliderMachine,
  angleSliderMessages,
  angleValueOf,
  type ChangeDetails,
  describeKey,
  focusSafely,
  hiddenFormInput,
  isDragPress,
  type MessageOverrides,
  type Modality,
  partId,
  pointerAngleSession,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import {
  computed,
  defineComponent,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  provide,
  type ShallowRef,
  type SlotsType,
  shallowRef,
  type VNodeChild,
} from "vue"
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
    "angle-slider": AngleSliderMessages
  }
}

/** What every part's slot receives. */
export interface AngleSliderState {
  /** The angle in degrees, [0, 360). */
  readonly value: number
  readonly dragging: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

type Api = ReturnType<typeof angleSliderConnect>

interface Ctx {
  readonly api: () => Api
  readonly state: () => AngleSliderState
  readonly send: (e: AngleSliderEvent) => void
  readonly registry: PartRegistry<"label">
  readonly labelId: () => string
  readonly input: ShallowRef<HTMLInputElement | null>
  readonly thumb: ShallowRef<Element | null>
  readonly press: (e: PointerEvent) => void
  readonly focused: ShallowRef<boolean>
  readonly formInput: ReturnType<typeof hiddenFormInput>
}

const AngleSliderKey: InjectionKey<Ctx> = Symbol("rind-ui.angle-slider")
function useAngleSlider(part: string): Ctx {
  const ctx = inject(AngleSliderKey, null)
  if (!ctx) throw new Error(`AngleSlider.${part} must be inside AngleSlider.Root`)
  return ctx
}

type Slots = SlotsType<{ default?: (state: AngleSliderState) => VNodeChild }>

/** A dial for an angle in degrees: a round Control and one visually hidden range input. */
const Root = defineComponent({
  name: "AngleSliderRoot",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    id: String,
    /** Controlled angle in degrees, [0, 360) (`v-model`). */
    modelValue: { type: Number, default: undefined },
    /** Uncontrolled angle. Default 0. */
    defaultValue: { type: Number, default: undefined },
    /** Degrees per step; values snap to the nearest. Default 1. */
    step: { type: Number, default: undefined },
    /** Shift+Arrow, PageUp and PageDown. Default 15. */
    largeStep: { type: Number, default: undefined },
    /** A step past an end wraps around. Default true. */
    wrap: { type: Boolean, default: undefined },
    /** No change; not submitted. */
    disabled: Boolean,
    /** Submitted and focusable; no change. */
    readOnly: Boolean,
    /** Marks the input invalid. */
    invalid: Boolean,
    /** The form field's name. */
    name: String,
    /** The form's id, when outside it. */
    form: String,
    /** Default: the provider's locale (the formatted angle). */
    locale: String,
    /** Overrides `valueText` (also through the provider). */
    messages: Object as () => MessageOverrides<AngleSliderMessages>,
  },
  emits: {
    /** Every change. */
    valueChange: (_value: number, _details: ChangeDetails<AngleSliderEvent>) => true,
    "update:modelValue": (_value: number) => true,
    /** Once per interaction: a drag's release, a key, a native change. */
    valueCommit: (_value: number, _details: { readonly reason: AngleSliderReason }) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment()
    const instance = useRootId(() => props.id)
    const loc = useLocale(() => props.locale)
    const messages = useMessages("angle-slider", angleSliderMessages, () => props.messages)
    const registry = usePartRegistry<"label">({ scope: "angle-slider", root: instance() })
    const ownLabel = useRenderedId(registry, "label")
    const input = shallowRef<HTMLInputElement | null>(null)
    const thumb = shallowRef<Element | null>(null)
    const focused = shallowRef(false)
    const formInput = hiddenFormInput({ input: () => input.value }, env)
    const drag = pointerAngleSession()
    const machineEnv = {
      drag,
      focusInput: (m: Modality) => {
        if (input.value) void focusSafely(input.value, env, "programmatic", m)
      },
    }
    const machineProps = () => ({
      value: props.modelValue,
      defaultValue: props.defaultValue,
      step: props.step,
      largeStep: props.largeStep,
      wrap: props.wrap,
      disabled: props.disabled,
      readOnly: props.readOnly,
      onValueChange: (v: number, d: ChangeDetails<AngleSliderEvent>) => {
        emit("valueChange", v, d)
        emit("update:modelValue", v)
      },
      onValueCommit: (v: number, d: { readonly reason: AngleSliderReason }) =>
        emit("valueCommit", v, d),
    })
    const { view, send } = useMachine(angleSliderMachine, machineProps, machineEnv)
    const current = () => angleValueOf(machineProps(), view.value.values.value)
    const dragging = () => view.value.matches("dragging")
    const modality = useModality(env.modality, () => focused.value)
    const ids = () => ({
      label: partId("angle-slider", instance(), "label"),
      input: partId("angle-slider", instance(), "input"),
    })
    const api = computed(() =>
      angleSliderConnect({
        instance: instance(),
        value: current(),
        defaultValue: angleValueOf({ ...machineProps(), value: undefined }, undefined),
        step: props.step ?? 1,
        dragging: dragging(),
        disabled: props.disabled,
        readOnly: props.readOnly,
        invalid: props.invalid,
        focused: focused.value,
        modality: modality.value,
        locale: loc.value.locale,
        messages: messages.value,
        ariaLabel: attrs["aria-label"] as string | undefined,
        ariaLabelledBy: attrs["aria-labelledby"] as string | undefined,
        ids: { ...ids(), label: ownLabel.value ?? ids().label },
        rendered: { label: ownLabel.value !== undefined },
        name: props.name,
        form: props.form,
      }),
    )
    // The input shows the value (hydration, a drag, a parent's change); no events.
    const sync = () => formInput.sync({ value: String(current()) }, { dispatch: false })
    onMounted(() => {
      sync()
      // The modality tracker must see the pointerdown that comes before the input's focus.
      onBeforeUnmount(env.modality.subscribe(() => {}))
    })
    onUpdated(sync)
    const state = (): AngleSliderState => ({
      value: current(),
      dragging: dragging(),
      disabled: props.disabled,
      readOnly: props.readOnly,
    })
    const press = (e: PointerEvent) => {
      if (!isDragPress(e) || drag.active || props.disabled) return
      const onThumb = thumb.value?.contains(e.target as Node) === true
      const angle = drag.press(e.currentTarget as Element, e, onThumb ? current() : undefined)
      // Focus goes to the input (the machine moves it): the browser must not blur it.
      e.preventDefault()
      send({
        type: "POINTER.DOWN",
        angle,
        onThumb,
        modality: e.pointerType === "touch" ? "touch" : "pointer",
      })
    }
    provide(AngleSliderKey, {
      api: () => api.value,
      state,
      send,
      registry,
      labelId: () => ids().label,
      input,
      thumb,
      press,
      focused,
      formInput,
    })
    return () => {
      const { "aria-label": _l, "aria-labelledby": _lb, ...rest } = attrs
      void [_l, _lb]
      return renderPart(
        "div",
        mergeProps(normalizeProps(api.value.root()), rest),
        slots.default?.(state()),
        props.asChild,
      )
    }
  },
})

/** Names the input. */
const Label = defineComponent({
  name: "AngleSliderLabel",
  inheritAttrs: false,
  props: { id: String, ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useAngleSlider("Label")
    const own = () => props.id ?? ctx.labelId()
    useRegisterPart(ctx.registry, "label", own)
    return () =>
      renderPart(
        "label",
        mergeProps({ ...normalizeProps(ctx.api().label()), id: own() }, attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

/** The round surface: a press sets the angle around its centre and drags. */
const Control = defineComponent({
  name: "AngleSliderControl",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useAngleSlider("Control")
    return () =>
      renderPart(
        "div",
        mergeProps(
          joinHandlers(normalizeProps(ctx.api().control()), { onPointerdown: ctx.press }),
          attrs,
        ),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

/** The handle, rotated by the angle; shows the input's focus. */
const Thumb = defineComponent({
  name: "AngleSliderThumb",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useAngleSlider("Thumb")
    return () =>
      renderPart(
        "div",
        mergeProps({ ...normalizeProps(ctx.api().thumb()), ref: refTo(ctx.thumb) }, attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

/** A visually hidden native range input: the one focusable, announced slider. */
const Input = defineComponent({
  name: "AngleSliderInput",
  inheritAttrs: false,
  setup(_props, { attrs }) {
    const ctx = useAngleSlider("Input")
    const env = useEnvironment()
    onMounted(() =>
      onBeforeUnmount(
        ctx.formInput.track({
          onReset: () => ctx.send({ type: "RESET" }),
          current: () => ({ value: String(ctx.state().value) }),
          // The native range input's own change (assistive technology, a click on it).
          onNativeInput: (el) => {
            ctx.send({ type: "INPUT.CHANGE", value: Number(el.value) })
            return true
          },
        }),
      ),
    )
    return () => {
      // The value is written as a property by hiddenFormInput (the same markup as React).
      const { value: _value, ...raw } = ctx.api().input()
      void _value
      return renderPart(
        "input",
        mergeProps(
          {
            ...joinHandlers(normalizeProps(raw), {
              onKeydown: (e: KeyboardEvent) => {
                const event = angleSliderKeyEvent(describeKey(e, env), {
                  dragging: ctx.state().dragging,
                })
                if (!event || e.defaultPrevented) return
                e.preventDefault()
                // Escape ends the drag only: a surrounding layer stays open.
                if (event.type === "DRAG.CANCEL") e.stopPropagation()
                ctx.send(event)
              },
              onFocus: () => (ctx.focused.value = true),
              onBlur: () => (ctx.focused.value = false),
            }),
            ref: refTo(ctx.input),
          },
          attrs,
        ),
        undefined,
        false,
      )
    }
  },
})

/** The formatted angle and a degree sign (hidden from assistive technology). */
const Value = defineComponent({
  name: "AngleSliderValue",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useAngleSlider("Value")
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(ctx.api().valuePart()), attrs),
        slots.default?.(ctx.state()) ?? `${ctx.api().formatted}°`,
        props.asChild,
      )
  },
})

/** Holds the markers. */
const MarkerGroup = defineComponent({
  name: "AngleSliderMarkerGroup",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useAngleSlider("MarkerGroup")
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(ctx.api().markerGroup()), attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

/** A tick at `value` degrees, placed by `--rind-angle-slider-marker-angle`. */
const Marker = defineComponent({
  name: "AngleSliderMarker",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    /** Where the tick sits, in degrees. */
    value: { type: Number, required: true },
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useAngleSlider("Marker")
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(ctx.api().marker(props.value)), attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

export { Control, Input, Label, Marker, MarkerGroup, Root, Thumb, Value }
