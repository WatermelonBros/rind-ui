import {
  announcerCapability,
  type ButtonMessages,
  type ButtonPressDetails,
  blurEvent,
  buttonConnect,
  buttonMachine,
  buttonMessages,
  focusAttrs,
  focusEvent,
  type MessageOverrides,
  warnInteractiveContent,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  type PropType,
  type SlotsType,
  shallowRef,
  type VNode,
  type VNodeChild,
} from "vue"
import { useFieldsetDisabled } from "../fieldset/context"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { asChildProp, elements, renderedTag, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { useHover, usePress } from "../use-press"

declare module "../provider" {
  interface RindMessageScopes {
    button: ButtonMessages
  }
}

export interface ButtonState {
  readonly pending: boolean
  readonly disabled: boolean
  readonly pressed: boolean
  readonly hovered: boolean
  readonly focusVisible: boolean
}

/**
 * With `asChild` and an `<a href>` child, the href goes to connect (link semantics; resolved,
 * or none while disabled) and the anchor renders without its own.
 */
function anchorOf(children: VNodeChild, asChild: boolean) {
  if (!asChild) return { children, href: undefined }
  const child = elements(children)[0]
  const href = (child?.props as { href?: unknown } | null | undefined)?.href
  if (!child || typeof href !== "string") return { children, href: undefined }
  const { href: _, ...props } = child.props ?? {}
  const stripped: VNode = { ...child, props }
  return { children: stripped, href }
}

export const Button = defineComponent({
  name: "RindButton",
  inheritAttrs: false,
  props: {
    /** Default "button": never submits a form by accident. */
    type: String as PropType<"button" | "submit" | "reset">,
    /** Ignores activation: native `disabled` on a `<button>`, `aria-disabled` elsewhere. */
    disabled: Boolean,
    /** Keeps a disabled Button in the Tab order (`aria-disabled` instead of `disabled`). */
    focusableWhenDisabled: Boolean,
    /** Ignores activation, keeps focus, announces `messages.pending` when focused. */
    pending: Boolean,
    /** `false`: a press activates without moving focus. */
    focusOnPress: { type: Boolean, default: undefined },
    /** Overrides the announced texts. Default: `pending: "Loading"`. */
    messages: Object as PropType<MessageOverrides<ButtonMessages>>,
    id: String,
    ...asChildProp,
  },
  emits: {
    /** Once per activation, with `modality` and the modifier keys. */
    press: (_details: ButtonPressDetails) => true,
    /** A press starts. */
    pressStart: (_details: ButtonPressDetails) => true,
    /** A press ends, also when cancelled or released outside. */
    pressEnd: (_details: ButtonPressDetails) => true,
  },
  slots: Object as SlotsType<{ default?: (state: ButtonState) => VNodeChild }>,
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment(announcerCapability)
    const instance = useRootId(() => props.id)
    const messages = useMessages("button", buttonMessages, () => props.messages)
    const el = shallowRef<Element | null>(null)
    const measured = shallowRef<string | null>(null)
    // A rind-ui Fieldset's injection reaches teleported parts; the DOM tracker native fieldsets.
    const fieldsetContext = useFieldsetDisabled()
    const { view, send } = useMachine(
      buttonMachine,
      () => ({
        // The machine guards activation on it as on the prop.
        disabled: props.disabled || fieldsetContext.value,
        pending: props.pending,
        onPress: (d: ButtonPressDetails) => emit("press", d),
        onPressStart: (d: ButtonPressDetails) => emit("pressStart", d),
        onPressEnd: (d: ButtonPressDetails) => emit("pressEnd", d),
        messages: messages.value,
        id: instance(),
      }),
      env,
    )
    const disabled = computed(
      () => props.disabled || view.value.context.fieldsetDisabled || fieldsetContext.value,
    )
    // Server and hydration render without it, like React's server snapshot.
    const origin = shallowRef<string | undefined>(undefined)
    onMounted(() => {
      origin.value = globalThis.location?.origin
      // The modality tracker must see the pointerdown that comes before focus.
      const offModality = env.modality.subscribe(() => {})
      const node = el.value
      measured.value = node?.tagName.toLowerCase() ?? null
      let stop = () => {}
      if (node) {
        warnInteractiveContent(node, "button")
        const watch = watchFieldsetDisabled(node, (d) =>
          send({ type: "FIELDSET.CHANGE", disabled: d }),
        )
        if (watch.disabled) send({ type: "FIELDSET.CHANGE", disabled: true })
        stop = watch.stop
      }
      onBeforeUnmount(() => {
        offModality()
        stop()
      })
    })
    onUpdated(() => (measured.value = el.value?.tagName.toLowerCase() ?? null))
    const press = usePress({
      env,
      // Button opts into neither long press nor a context menu of its own.
      send: (e) => {
        if (e.type !== "CONTEXT_MENU" && e.type !== "LONG_PRESS") send(e)
      },
      disabled: () => disabled.value || props.pending,
      ...(props.focusOnPress === undefined ? {} : { focusOnPress: props.focusOnPress }),
    })
    const hover = useHover({ env, send: () => {}, disabled: () => disabled.value })
    const focused = computed(() => view.value.context.focused)
    const modality = useModality(env.modality, () => focused.value)
    return () => {
      const state: ButtonState = {
        pending: props.pending,
        disabled: disabled.value,
        pressed: press.pressed.value,
        hovered: hover.hovered.value,
        focusVisible: focusAttrs(focused.value, modality.value)["data-focus-visible"] !== undefined,
      }
      const part = (tag: string, href: string | undefined) =>
        buttonConnect(
          {
            instance: instance(),
            tag,
            href,
            origin: origin.value,
            disabled: disabled.value,
            focusableWhenDisabled: props.focusableWhenDisabled,
            pending: props.pending,
            type: props.type,
            focused: focused.value,
            modality: modality.value,
            pressed: press.pressed.value,
            hovered: hover.hovered.value,
          },
          env,
        )
      const { children, href } = anchorOf(slots.default?.(state), props.asChild)
      const tag = renderedTag("button", children, props.asChild, measured.value)
      const own = normalizeProps(part(tag, href))
      const merged = mergeProps(
        {
          ...joinHandlers(own, press.props, hover.props, {
            onFocusin: (e: FocusEvent) =>
              send(focusEvent(e.currentTarget as Element, env.modality)),
            onFocusout: () => send(blurEvent(env.modality)),
          }),
          ...(props.id === undefined ? {} : { id: props.id }),
          ref: refTo(el),
        },
        attrs,
      )
      return renderPart("button", merged, children, props.asChild)
    }
  },
})
