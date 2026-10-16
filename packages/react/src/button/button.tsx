import {
  type ButtonMessages,
  type ButtonPressDetails,
  blurEvent,
  buttonConnect,
  buttonMachine,
  buttonMessages,
  focusEvent,
  type MessageOverrides,
  warnInteractiveContent,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  cloneElement,
  isValidElement,
  type ReactElement,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react"
import { useFieldsetDisabled } from "../fieldset/fieldset"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { useHover, usePress } from "../use-press"
import { useRenderedTag } from "../use-rendered-tag"

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

export type ButtonProps = Omit<ComponentPropsWithRef<"button">, "type" | "disabled"> & {
  /** Default "button": never submits a form by accident. */
  readonly type?: "button" | "submit" | "reset"
  readonly disabled?: boolean
  /** Keeps a disabled Button in the Tab order (`aria-disabled` instead of `disabled`). */
  readonly focusableWhenDisabled?: boolean
  /** Ignores activation, keeps focus, announces `messages.pending` when focused. */
  readonly pending?: boolean
  /**
   * `false`: a press activates without moving focus (press-interactions "Press Without
   * Focus": an editor toolbar's Bold keeps the editor focused).
   */
  readonly focusOnPress?: boolean
  readonly onPress?: (details: ButtonPressDetails) => void
  readonly onPressStart?: (details: ButtonPressDetails) => void
  readonly onPressEnd?: (details: ButtonPressDetails) => void
  readonly messages?: MessageOverrides<ButtonMessages>
  /** Another element; `<a href>` keeps link semantics and routes like a Link. */
  readonly render?: RenderProp<ButtonState>
}

const noSubscription = () => () => {}
const clientOrigin = () => globalThis.location?.origin
const serverOrigin = () => undefined

/** The href of a `render={<a href>}` element; link-navigation renders it (resolved). */
function anchorOf(render: RenderProp<ButtonState> | undefined) {
  if (!isValidElement(render)) return { render, href: undefined }
  const props = render.props as { href?: string }
  if (props.href === undefined) return { render, href: undefined }
  // Without its own href, so the part's (resolved, or none while disabled) is rendered.
  const element = render as ReactElement<Record<string, unknown>>
  return { render: cloneElement(element, { href: undefined }), href: props.href }
}

export function Button(props: ButtonProps) {
  const {
    type,
    disabled = false,
    focusableWhenDisabled = false,
    pending = false,
    focusOnPress,
    onPress,
    onPressStart,
    onPressEnd,
    messages: ownMessages,
    render: renderProp,
    id,
    ref,
    ...rest
  } = props
  const env = useEnvironment()
  const instance = useRootId(id)
  const messages = useMessages("button", buttonMessages, ownMessages)
  const { render, href } = anchorOf(renderProp)
  const el = useRef<HTMLElement | null>(null)
  const tag = useRenderedTag("button", render, el)
  // A rind-ui Fieldset's context reaches portalled parts; the DOM tracker native fieldsets.
  const fieldsetContext = useFieldsetDisabled()
  const { view, send } = useMachine(buttonMachine, {
    // The machine guards activation on it as on the prop.
    disabled: disabled || fieldsetContext,
    pending,
    onPress,
    onPressStart,
    onPressEnd,
    messages,
    id: instance,
  })
  const fieldsetDisabled = view.context.fieldsetDisabled
  const effectiveDisabled = disabled || fieldsetDisabled || fieldsetContext
  // The modality tracker must see the pointerdown that comes before focus.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  useEffect(() => {
    const node = el.current
    if (!node) return
    warnInteractiveContent(node, "button")
    const watch = watchFieldsetDisabled(node, (d) => send({ type: "FIELDSET.CHANGE", disabled: d }))
    if (watch.disabled) send({ type: "FIELDSET.CHANGE", disabled: true })
    return watch.stop
  }, [send])
  const press = usePress({
    env,
    // Button opts into neither long press nor a context menu of its own.
    send: (e) => {
      if (e.type !== "CONTEXT_MENU" && e.type !== "LONG_PRESS") send(e)
    },
    disabled: () => effectiveDisabled || pending,
    ...(focusOnPress === undefined ? {} : { focusOnPress }),
  })
  const hover = useHover({ env, send: () => {}, disabled: () => effectiveDisabled })
  const focused = view.context.focused
  const modality = useModality(env.modality, focused)
  const origin = useSyncExternalStore(noSubscription, clientOrigin, serverOrigin)
  const part = buttonConnect(
    {
      instance,
      tag,
      href,
      origin,
      disabled: effectiveDisabled,
      focusableWhenDisabled,
      pending,
      type,
      focused,
      modality,
      pressed: press.pressed,
      hovered: hover.hovered,
    },
    env,
  )
  const own = normalizeProps(part)
  const merged = mergeProps(
    {
      ...joinHandlers(own, press.props, hover.props, {
        onFocus: (e: { currentTarget: Element }) => send(focusEvent(e.currentTarget, env.modality)),
        onBlur: () => send(blurEvent(env.modality)),
      }),
      ...(id === undefined ? {} : { id }),
      ref: composeRefs(el, ref),
    },
    rest,
  )
  const state: ButtonState = {
    pending,
    disabled: effectiveDisabled,
    pressed: press.pressed,
    hovered: hover.hovered,
    focusVisible: own["data-focus-visible"] !== undefined,
  }
  return renderPart("button", merged, render, state)
}
