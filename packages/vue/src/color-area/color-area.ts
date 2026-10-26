// Color Area parts: wiring only. The machine owns the colour, connect every attribute; here
// the two axis inputs are reached for property sync, reset and native adoption, and the
// Root's press is measured once by pointer-drag (2D).
import {
  blurEvent,
  type Color,
  type ColorChangeDetails,
  type ColorChannel,
  type ColorCommitDetails,
  type ColorNameProp,
  type ColorSpace,
  describeKey,
  focusEvent,
  focusSafely,
  hiddenFormInput,
  isDragPress,
  type MessageOverrides,
  type Modality,
  makeColor,
  mergeFieldProps,
  partId,
  pointerDragSession2D,
  textSelection,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import {
  areaAxes,
  areaValueOf,
  areaWorking,
  type ColorAreaEvent,
  type ColorAreaMessages,
  type ColorAreaReason,
  colorAreaConnect,
  colorAreaKeyEvent,
  colorAreaMachine,
  colorAreaMessages,
  thumbPoint,
} from "@rind-ui/core/internal"
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
  watch,
} from "vue"
import { colorProp, useColorProp } from "../color-input"
import { useFieldBindingPeek } from "../field/context"
import { useFieldsetDisabled } from "../fieldset/context"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    "color-area": ColorAreaMessages
  }
}

type Axis = "x" | "y"
type FormInput = ReturnType<typeof hiddenFormInput>

export interface ColorAreaState {
  readonly color: Color
  readonly dragging: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

interface Ctx {
  readonly api: () => ReturnType<typeof colorAreaConnect>
  readonly state: () => ColorAreaState
  readonly send: (e: ColorAreaEvent) => void
  readonly inputs: Record<Axis, HTMLInputElement | null>
  readonly formInput: (axis: Axis) => FormInput
  readonly shown: () => { x: number; y: number }
  readonly thumb: ShallowRef<Element | null>
  readonly dir: () => "ltr" | "rtl"
}

const AreaKey: InjectionKey<Ctx> = Symbol("rind-ui.color-area")
function useArea(part: string): Ctx {
  const ctx = inject(AreaKey, null)
  if (!ctx) throw new Error(`ColorArea.${part} must be inside ColorArea.Root`)
  return ctx
}

const DEFAULT = makeColor("hsb", [0, 0, 100])
type Slots = SlotsType<{ default?: (state: ColorAreaState) => VNodeChild }>

/** A two-dimensional picker for two channels of a colour (two native range inputs). */
const Root = defineComponent({
  name: "ColorAreaRoot",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    id: String,
    /** The colour (`v-model`). */
    modelValue: colorProp,
    /** Default `hsb(0, 0%, 100%)`; a later change only changes what a form reset restores. */
    defaultValue: colorProp,
    /** The space of the axes (default: the first colour's space, else `hsb`). */
    colorSpace: String as PropType<ColorSpace>,
    /** The horizontal channel. Default: saturation (hsb, hsl), red (rgb). */
    xChannel: String as PropType<ColorChannel>,
    /** The vertical channel. Default: brightness (hsb), lightness (hsl), green (rgb). */
    yChannel: String as PropType<ColorChannel>,
    /** Submits the x channel under this name. */
    xName: String,
    /** Submits the y channel under this name. */
    yName: String,
    /** The id of the form the inputs belong to. */
    form: String,
    /** Ignores presses and keys. */
    disabled: Boolean,
    /** Focusable, changes nothing. */
    readOnly: Boolean,
    /** Replaces the colour name in the value text. */
    colorName: [String, Function] as PropType<ColorNameProp>,
    /** Formats the value text. Default: the provider's locale. */
    locale: String,
    /** Mirrors the x axis. Default: the provider's direction. */
    dir: String as PropType<"ltr" | "rtl">,
    /** Names, role description, value text and colour words. */
    messages: Object as PropType<MessageOverrides<ColorAreaMessages>>,
  },
  emits: {
    /** Each applied change, in the space of the colour you passed. */
    valueChange: (_color: Color, _details: ColorChangeDetails<ColorAreaReason>) => true,
    "update:modelValue": (_color: Color) => true,
    /** Once at the end of each interaction that changed the colour. */
    valueCommit: (_color: Color, _details: ColorCommitDetails<ColorAreaReason>) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment()
    const instance = useRootId(() => props.id)
    const loc = useLocale(
      () => props.locale,
      () => props.dir,
    )
    const messages = useMessages("color-area", colorAreaMessages, () => props.messages)
    const value = useColorProp(() => props.modelValue ?? undefined, "value", "color-area")
    const defaultValue = useColorProp(
      () => props.defaultValue ?? undefined,
      "defaultValue",
      "color-area",
    )
    // The space of the axes: the prop, else the first colour's (read once), else hsb.
    const firstSpace: ColorSpace = (value() ?? defaultValue())?.space ?? "hsb"
    const axes = () => areaAxes(props.colorSpace ?? firstSpace, props.xChannel, props.yChannel)
    const inputs: Record<Axis, HTMLInputElement | null> = { x: null, y: null }
    // OR-merged with an enclosing Field, rind's Fieldset and a native <fieldset disabled>.
    const enclosing = useFieldBindingPeek()
    const fieldsetDisabled = useFieldsetDisabled()
    const fieldsetDom = shallowRef(false)
    const merged = computed(() =>
      mergeFieldProps(
        { role: "group", labelable: false, disabled: props.disabled, readOnly: props.readOnly },
        enclosing?.value ?? null,
      ),
    )
    const disabled = () => merged.value.disabled || fieldsetDisabled.value || fieldsetDom.value
    const readOnly = () => merged.value.readOnly
    const thumb = shallowRef<Element | null>(null)
    const formInputs = new Map<Axis, FormInput>()
    const formInput = (axis: Axis) => {
      let cap = formInputs.get(axis)
      if (!cap) {
        cap = hiddenFormInput({ input: () => inputs[axis] }, env)
        formInputs.set(axis, cap)
      }
      return cap
    }
    const drag = pointerDragSession2D()
    const machineEnv = {
      inputs: {
        sync: (x: number, y: number, dispatch: readonly [boolean, boolean]) => {
          formInput("x").sync({ value: String(x) }, { dispatch: dispatch[0] })
          formInput("y").sync({ value: String(y) }, { dispatch: dispatch[1] })
        },
      },
      drag,
      focusAxis: (axis: Axis, modality: Modality) => {
        const el = inputs[axis]
        if (el) void focusSafely(el, env, "programmatic", modality)
      },
    }
    const machineProps = () => ({
      value: value(),
      defaultValue: defaultValue(),
      axes: axes(),
      fallback: DEFAULT,
      disabled: disabled(),
      readOnly: readOnly(),
      onValueChange: (c: Color, d: { reason: string; cancel(): void }) => {
        // A form reset reports nothing (spec "Form Participation").
        if (d.reason === "RESET") return
        emit("valueChange", c, {
          reason: d.reason as ColorAreaReason,
          space: axes().space,
          cancel: d.cancel,
        })
        emit("update:modelValue", c)
      },
      onValueCommit: (c: Color, d: ColorCommitDetails<ColorAreaReason>) =>
        emit("valueCommit", c, d),
    })
    const { view, send } = useMachine(colorAreaMachine, machineProps, machineEnv)
    const color = () => areaWorking(machineProps(), view.value.context, view.value.values.value)
    const modality = useModality(env.modality, () => view.value.context.focused !== null)
    const dragging = () => view.value.matches("dragging")
    const api = computed(() =>
      colorAreaConnect({
        instance: instance(),
        color: color(),
        memory: view.value.context.memory,
        axes: axes(),
        dir: loc.value.dir,
        disabled: disabled(),
        readOnly: readOnly(),
        dragging: dragging(),
        focused: view.value.context.focused,
        tabStop: view.value.context.tabStop,
        changed: view.value.context.changed,
        modality: modality.value,
        messages: messages.value,
        locale: loc.value.locale,
        colorName: props.colorName,
        ariaLabel: attrs["aria-label"] as string | undefined,
        ariaLabelledBy: attrs["aria-labelledby"] as string | undefined,
        ariaDescribedBy: attrs["aria-describedby"] as string | undefined,
        ids: {
          root: instance(),
          input: (axis) => partId("color-area", instance(), `input-${axis}`),
        },
        names: { x: props.xName, y: props.yName },
        form: props.form,
        defaultColor: areaValueOf({ ...machineProps(), value: undefined }, undefined),
      }),
    )
    // The values each input shows (hydration, a parent's change); no events.
    const shown = () => ({
      x: Number(api.value.input("x")["aria-valuenow"]),
      y: Number(api.value.input("y")["aria-valuenow"]),
    })
    const sync = () => {
      const s = shown()
      formInput("x").sync({ value: String(s.x) }, { dispatch: false })
      formInput("y").sync({ value: String(s.y) }, { dispatch: false })
    }
    onMounted(() => {
      sync()
      if (inputs.x) {
        const fieldset = watchFieldsetDisabled(inputs.x, (d) => (fieldsetDom.value = d))
        fieldsetDom.value = fieldset.disabled
        onBeforeUnmount(fieldset.stop)
      }
      watch(() => `${shown().x}|${shown().y}`, sync, { flush: "post" })
      // The modality tracker must see the pointerdown that comes before the input's focus.
      onBeforeUnmount(env.modality.subscribe(() => {}))
    })
    onUpdated(sync)
    let selection: (() => void) | null = null
    watch(dragging, (d) => {
      if (d) return
      selection?.()
      selection = null
    })
    const state = (): ColorAreaState => ({
      color: color(),
      dragging: dragging(),
      disabled: disabled(),
      readOnly: readOnly(),
    })
    provide(AreaKey, {
      api: () => api.value,
      state,
      send,
      inputs,
      formInput,
      shown,
      thumb,
      dir: () => loc.value.dir,
    })
    const press = (e: PointerEvent) => {
      if (!isDragPress(e) || drag.active || disabled()) return
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
      const surface = e.currentTarget as HTMLElement
      const onThumb = thumb.value?.contains(e.target as Node) === true
      const p = thumbPoint(color(), axes(), view.value.context.memory)
      const anchor = onThumb ? { x: Number(p.x), y: Number(p.y) } : undefined
      const point = drag.press(surface, e, { dir: loc.value.dir, anchor })
      // Focus goes to the x input (the machine moves it): the browser must not blur it.
      e.preventDefault()
      const touch = e.pointerType === "touch"
      if (touch && !readOnly()) selection = textSelection(surface, env, true)
      send({ type: "POINTER.DOWN", point, onThumb, modality: touch ? "touch" : "pointer" })
    }
    return () => {
      const {
        "aria-label": _l,
        "aria-labelledby": _lb,
        "aria-describedby": _d,
        ...rest
      } = attrs as Record<string, unknown>
      void [_l, _lb, _d]
      return renderPart(
        "div",
        mergeProps(joinHandlers(normalizeProps(api.value.root()), { onPointerdown: press }), rest),
        slots.default?.(state()),
        props.asChild,
      )
    }
  },
})

/** The gradient: decorative. */
const Background = defineComponent({
  name: "ColorAreaBackground",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useArea("Background")
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(ctx.api().background()), attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

/** One axis input (x or y): the focusable `slider`s, inside the Thumb. */
const AxisInput = defineComponent({
  name: "ColorAreaAxisInput",
  props: { axis: { type: String as PropType<Axis>, required: true } },
  setup(props) {
    const ctx = useArea("Thumb")
    const env = useEnvironment()
    onMounted(() =>
      onBeforeUnmount(
        ctx.formInput(props.axis).track({
          onReset: () => ctx.send({ type: "RESET" }),
          resetsWithForm: props.axis === "x",
          current: () => ({ value: String(ctx.shown()[props.axis]) }),
          onNativeInput: (input) => {
            ctx.send({ type: "INPUT.CHANGE", axis: props.axis, value: Number(input.value) })
            return true
          },
        }),
      ),
    )
    const setEl = (el: unknown) => {
      ctx.inputs[props.axis] = el instanceof HTMLInputElement ? el : null
    }
    return () =>
      h("input", {
        ...joinHandlers(normalizeProps(ctx.api().input(props.axis)), {
          onKeydown: (e: KeyboardEvent) => {
            const event = colorAreaKeyEvent(describeKey(e, env), {
              dir: ctx.dir(),
              dragging: ctx.state().dragging,
            })
            if (!event || e.defaultPrevented) return
            e.preventDefault()
            // Escape ends the drag only: a surrounding layer stays open.
            if (event.type === "DRAG.CANCEL") e.stopPropagation()
            ctx.send(event)
          },
          onFocus: (e: FocusEvent) =>
            ctx.send({ ...focusEvent(e.currentTarget as Element, env.modality), axis: props.axis }),
          onBlur: () => ctx.send({ ...blurEvent(env.modality), axis: props.axis }),
        }),
        ref: setEl,
      })
  },
})

/** The handle: positioned from the value; renders the x and y inputs. */
const Thumb = defineComponent({
  name: "ColorAreaThumb",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useArea("Thumb")
    return () =>
      renderPart(
        "div",
        mergeProps({ ...normalizeProps(ctx.api().thumb()), ref: refTo(ctx.thumb) }, attrs),
        h(Fragment, [
          slots.default?.(ctx.state()),
          h(AxisInput, { axis: "x" }),
          h(AxisInput, { axis: "y" }),
        ]),
        props.asChild,
      )
  },
})

export const ColorArea = { Root, Background, Thumb }
export { Background, Thumb }
