// Color Wheel parts (add-color-wheel): no machine of its own. The parts run the Angle Slider
// machine on the colour's hue and map each hue back to a colour (colorWithHue), keeping the hue
// memory so a grey keeps its hue. A press on the ring sets the hue and drags; a hidden input
// submits the colour as hex.
import {
  type AngleSliderEvent,
  type AngleSliderReason,
  angleSliderKeyEvent,
  angleSliderMachine,
  type ChangeDetails,
  type Color,
  type ColorMemory,
  type ColorWheelMessages,
  colorWheelConnect,
  colorWheelMessages,
  colorWithHue,
  describeKey,
  focusSafely,
  hiddenFormInput,
  hueOf,
  isDragPress,
  type MessageOverrides,
  type Modality,
  makeColor,
  onRing,
  partId,
  pointerAngleSession,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import {
  computed,
  defineComponent,
  Fragment,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  type ShallowRef,
  type SlotsType,
  shallowRef,
  type VNodeChild,
} from "vue"
import { colorProp, useColorProp } from "../color-input"
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
    "color-wheel": ColorWheelMessages
  }
}

const DEFAULT = makeColor("hsl", [0, 100, 50])
/** The ring's width when the theme sets no `--rind-color-wheel-thickness`. */
const THICKNESS = 30

/** What every part's slot receives. */
export interface ColorWheelState {
  readonly color: Color
  /** The hue in degrees, [0, 360). */
  readonly hue: number
  readonly dragging: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

type Api = ReturnType<typeof colorWheelConnect>

interface Ctx {
  readonly api: () => Api
  readonly state: () => ColorWheelState
  readonly send: (e: AngleSliderEvent) => void
  readonly registry: PartRegistry<"label">
  readonly labelId: () => string
  readonly input: ShallowRef<HTMLInputElement | null>
  readonly thumb: ShallowRef<Element | null>
  readonly press: (e: PointerEvent) => void
  readonly focused: ShallowRef<boolean>
  readonly rangeInput: ReturnType<typeof hiddenFormInput>
}

const ColorWheelKey: InjectionKey<Ctx> = Symbol("rind-ui.color-wheel")
function useColorWheel(part: string): Ctx {
  const ctx = inject(ColorWheelKey, null)
  if (!ctx) throw new Error(`ColorWheel.${part} must be inside ColorWheel.Root`)
  return ctx
}

type Slots = SlotsType<{ default?: (state: ColorWheelState) => VNodeChild }>

/** A hue ring: one visually hidden range input of the colour's hue. */
const Root = defineComponent({
  name: "ColorWheelRoot",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    id: String,
    /** The colour (`v-model`). */
    modelValue: colorProp,
    /** Uncontrolled colour. Default `hsl(0 100% 50%)`. */
    defaultValue: colorProp,
    /** The space the colour is emitted in. Default `hsl`. */
    colorSpace: String as PropType<"hsl" | "hsb">,
    /** Degrees per step. Default 1. */
    step: { type: Number, default: 1 },
    /** Shift+Arrow, PageUp and PageDown. Default 15. */
    largeStep: { type: Number, default: undefined },
    /** No change; not submitted. */
    disabled: Boolean,
    /** Submitted and focusable; no change. */
    readOnly: Boolean,
    /** Marks the input invalid. */
    invalid: Boolean,
    /** Submits the colour as hex. */
    name: String,
    /** The form's id, when outside it. */
    form: String,
    /** Default: the provider's locale (the value text). */
    locale: String,
    /** Overrides the hue names and value text (also through the provider). */
    messages: Object as PropType<MessageOverrides<ColorWheelMessages>>,
  },
  emits: {
    /** Every change of the hue, with the colour in `colorSpace`. */
    valueChange: (_value: Color, _details: ChangeDetails<AngleSliderEvent>) => true,
    "update:modelValue": (_value: Color) => true,
    /** Once per interaction: a drag's release, a press, a key. */
    valueCommit: (_value: Color, _details: { readonly reason: AngleSliderReason }) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment()
    const instance = useRootId(() => props.id)
    const loc = useLocale(() => props.locale)
    const messages = useMessages("color-wheel", colorWheelMessages, () => props.messages)
    const registry = usePartRegistry<"label">({ scope: "color-wheel", root: instance() })
    const ownLabel = useRenderedId(registry, "label")
    const value = useColorProp(() => props.modelValue ?? undefined, "value", "color-wheel")
    const defaultProp = useColorProp(
      () => props.defaultValue ?? undefined,
      "defaultValue",
      "color-wheel",
    )
    const defaultColor = () => defaultProp() ?? DEFAULT
    const own = shallowRef(defaultColor())
    const color = () => value() ?? own.value
    // The hue a grey keeps (a grey's own hue is lost in a round trip through hex or rgb).
    let memory: ColorMemory = {}
    const memoryTick = shallowRef(0)
    const hue = () => {
      void memoryTick.value
      return hueOf(color(), props.step, memory)
    }
    let latest = color()
    const input = shallowRef<HTMLInputElement | null>(null)
    const hexInput = shallowRef<HTMLInputElement | null>(null)
    const thumb = shallowRef<Element | null>(null)
    const focused = shallowRef(false)
    const rangeInput = hiddenFormInput({ input: () => input.value }, env)
    const hexForm = hiddenFormInput({ input: () => hexInput.value }, env)
    const drag = pointerAngleSession()
    const machineEnv = {
      drag,
      focusInput: (m: Modality) => {
        if (input.value) void focusSafely(input.value, env, "programmatic", m)
      },
    }
    // The hue is always controlled: the colour is the source, held here when uncontrolled.
    const machineProps = () => ({
      value: hue(),
      step: props.step,
      largeStep: props.largeStep,
      wrap: true,
      disabled: props.disabled,
      readOnly: props.readOnly,
      onValueChange: (h: number, d: ChangeDetails<AngleSliderEvent>) => {
        memory = { ...memory, hue: h }
        memoryTick.value++
        const next = colorWithHue(color(), h, props.colorSpace, memory)
        latest = next
        if (value() === undefined) own.value = next
        emit("valueChange", next, d)
        emit("update:modelValue", next)
      },
      onValueCommit: (_h: number, d: { readonly reason: AngleSliderReason }) =>
        emit("valueCommit", latest, d),
    })
    const { view, send } = useMachine(angleSliderMachine, machineProps, machineEnv)
    const dragging = () => view.value.matches("dragging")
    const modality = useModality(env.modality, () => focused.value)
    const ids = () => ({
      label: partId("color-wheel", instance(), "label"),
      input: partId("color-wheel", instance(), "input"),
    })
    const api = computed(() => {
      void memoryTick.value
      return colorWheelConnect({
        instance: instance(),
        color: color(),
        memory,
        step: props.step,
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
        defaultColor: defaultColor(),
      })
    })
    const hex = () => String(api.value.hiddenInput()["value"])
    // Both inputs show the value (hydration, a drag, a parent's change); no events.
    const sync = () => {
      latest = color()
      rangeInput.sync({ value: String(hue()) }, { dispatch: false })
      hexForm.sync({ value: hex() }, { dispatch: false })
    }
    onMounted(() => {
      sync()
      onBeforeUnmount(
        hexForm.track({
          // The whole colour back to the default (not only its hue), with no callback.
          onReset: () => {
            memory = {}
            memoryTick.value++
            send({ type: "DRAG.CANCEL" })
            own.value = defaultColor()
          },
          current: () => ({ value: hex() }),
        }),
      )
      // The modality tracker must see the pointerdown that comes before the input's focus.
      onBeforeUnmount(env.modality.subscribe(() => {}))
    })
    onUpdated(sync)
    const state = (): ColorWheelState => ({
      color: color(),
      hue: hue(),
      dragging: dragging(),
      disabled: props.disabled,
      readOnly: props.readOnly,
    })
    const press = (e: PointerEvent) => {
      if (!isDragPress(e) || drag.active || props.disabled) return
      const track = e.currentTarget as HTMLElement
      const thickness =
        Number.parseFloat(
          getComputedStyle(track).getPropertyValue("--rind-color-wheel-thickness"),
        ) || THICKNESS
      if (!onRing(track, e, thickness)) return
      const onThumb = thumb.value?.contains(e.target as Node) === true
      const angle = drag.press(track, e, onThumb ? hue() : undefined)
      // Focus goes to the input (the machine moves it): the browser must not blur it.
      e.preventDefault()
      send({
        type: "POINTER.DOWN",
        angle,
        onThumb,
        modality: e.pointerType === "touch" ? "touch" : "pointer",
      })
    }
    provide(ColorWheelKey, {
      api: () => api.value,
      state,
      send,
      registry,
      labelId: () => ids().label,
      input,
      thumb,
      press,
      focused,
      rangeInput,
    })
    return () => {
      const { "aria-label": _l, "aria-labelledby": _lb, ...rest } = attrs
      void [_l, _lb]
      // The hex is written as a property by hiddenFormInput (the same markup as React).
      const { value: _hex, ...hidden } = api.value.hiddenInput()
      void _hex
      return renderPart(
        "div",
        mergeProps(normalizeProps(api.value.root()), rest),
        h(Fragment, null, [
          slots.default?.(state()),
          h("input", { ...normalizeProps(hidden), ref: refTo(hexInput) }),
        ]),
        props.asChild,
      )
    }
  },
})

/** Names the slider. */
const Label = defineComponent({
  name: "ColorWheelLabel",
  inheritAttrs: false,
  props: { id: String, ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useColorWheel("Label")
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

/** The hue ring: a press on the ring sets the hue and drags. */
const Track = defineComponent({
  name: "ColorWheelTrack",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useColorWheel("Track")
    return () =>
      renderPart(
        "div",
        mergeProps(
          joinHandlers(normalizeProps(ctx.api().track()), { onPointerdown: ctx.press }),
          attrs,
        ),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

/** The handle on the ring, rotated by the hue; shows the input's focus. */
const Thumb = defineComponent({
  name: "ColorWheelThumb",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useColorWheel("Thumb")
    return () =>
      renderPart(
        "div",
        mergeProps({ ...normalizeProps(ctx.api().thumb()), ref: refTo(ctx.thumb) }, attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

/** A visually hidden native range input of the hue: the one focusable slider. */
const Input = defineComponent({
  name: "ColorWheelInput",
  inheritAttrs: false,
  setup(_props, { attrs }) {
    const ctx = useColorWheel("Input")
    const env = useEnvironment()
    onMounted(() =>
      onBeforeUnmount(
        ctx.rangeInput.track({
          // The hex input owns the form reset.
          onReset: () => {},
          resetsWithForm: false,
          current: () => ({ value: String(ctx.state().hue) }),
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

/** The formatted hue and a degree sign (hidden from assistive technology). */
const Value = defineComponent({
  name: "ColorWheelValue",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useColorWheel("Value")
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(ctx.api().valuePart()), attrs),
        slots.default?.(ctx.state()) ?? `${ctx.api().hue}°`,
        props.asChild,
      )
  },
})

export { Input, Label, Root, Thumb, Track, Value }
