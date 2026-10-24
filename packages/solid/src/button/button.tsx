/** @jsxImportSource solid-js */
import {
  announcerCapability,
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
import { createMemo, createSignal, type JSX, onCleanup, splitProps } from "solid-js"
import { useFieldsetDisabled } from "../fieldset/context"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
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

export type ButtonProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "disabled" | "children"
> & {
  /** Default "button": never submits a form by accident. */
  readonly type?: "button" | "submit" | "reset" | undefined
  /** Ignores activation: native `disabled` on a `<button>`, `aria-disabled` elsewhere or with `focusableWhenDisabled`. */
  readonly disabled?: boolean | undefined
  /** Keeps a disabled Button in the Tab order (`aria-disabled` instead of `disabled`). */
  readonly focusableWhenDisabled?: boolean | undefined
  /** Ignores activation, keeps focus, announces `messages.pending` when focused. */
  readonly pending?: boolean | undefined
  /**
   * `false`: a press activates without moving focus (press-interactions "Press Without
   * Focus": an editor toolbar's Bold keeps the editor focused).
   */
  readonly focusOnPress?: boolean | undefined
  /** Renders an `<a href>` with link semantics (resolved, removed while disabled). */
  readonly href?: string | undefined
  /** Once per activation, with `modality` and the modifier keys. */
  readonly onPress?: ((details: ButtonPressDetails) => void) | undefined
  /** A press starts. */
  readonly onPressStart?: ((details: ButtonPressDetails) => void) | undefined
  /** A press ends, also when cancelled or released outside. */
  readonly onPressEnd?: ((details: ButtonPressDetails) => void) | undefined
  /** Overrides the announced texts. Default: `pending: "Loading"`. */
  readonly messages?: MessageOverrides<ButtonMessages> | undefined
  /** Renders another element with the part's props (spread them on it). */
  readonly render?: RenderProp<ButtonState> | undefined
  readonly children?: JSX.Element | ((state: ButtonState) => JSX.Element)
}

export function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, [
    "type",
    "disabled",
    "focusableWhenDisabled",
    "pending",
    "focusOnPress",
    "href",
    "onPress",
    "onPressStart",
    "onPressEnd",
    "messages",
    "render",
    "id",
    "children",
  ])
  const env = useEnvironment(announcerCapability)
  const instance = useRootId(() => local.id)
  const messages = useMessages("button", buttonMessages, () => local.messages)
  const [el, setEl] = createSignal<HTMLElement | null>(null)
  const fallbackTag = () => (local.href === undefined ? "button" : "a")
  const tag = () => (local.render ? (el()?.tagName.toLowerCase() ?? fallbackTag()) : fallbackTag())
  // A rind-ui Fieldset's context reaches portalled parts; the DOM tracker native fieldsets.
  const fieldsetContext = useFieldsetDisabled()
  const pending = () => local.pending === true
  const { view, send } = useMachine(
    buttonMachine,
    () => ({
      // The machine guards activation on it as on the prop.
      disabled: local.disabled === true || fieldsetContext(),
      pending: pending(),
      onPress: local.onPress,
      onPressStart: local.onPressStart,
      onPressEnd: local.onPressEnd,
      messages: messages(),
      id: instance(),
    }),
    env,
  )
  const disabled = () =>
    local.disabled === true || view().context.fieldsetDisabled || fieldsetContext()
  afterMount(() => {
    // The modality tracker must see the pointerdown that comes before focus.
    const offModality = env.modality.subscribe(() => {})
    const node = el()
    const watch = node
      ? watchFieldsetDisabled(node, (d) => send({ type: "FIELDSET.CHANGE", disabled: d }))
      : null
    if (node) warnInteractiveContent(node, "button")
    if (watch?.disabled) send({ type: "FIELDSET.CHANGE", disabled: true })
    onCleanup(() => {
      offModality()
      watch?.stop()
    })
  })
  const press = usePress({
    env,
    // Button opts into neither long press nor a context menu of its own.
    send: (e) => {
      if (e.type !== "CONTEXT_MENU" && e.type !== "LONG_PRESS") send(e)
    },
    disabled: () => disabled() || pending(),
    ...(props.focusOnPress === undefined ? {} : { focusOnPress: props.focusOnPress }),
  })
  const hover = useHover({ env, send: () => {}, disabled })
  const focused = () => view().context.focused
  const modality = useModality(env.modality, focused)
  // Server and hydration: no origin (an absolute href stays as written); the page's after.
  const [origin, setOrigin] = createSignal<string | undefined>(undefined)
  afterMount(() => setOrigin(globalThis.location?.origin))
  const own = createMemo(() =>
    normalizeProps(
      buttonConnect(
        {
          instance: instance(),
          tag: tag(),
          href: local.href,
          origin: origin(),
          disabled: disabled(),
          focusableWhenDisabled: local.focusableWhenDisabled === true,
          pending: pending(),
          type: local.type,
          focused: focused(),
          modality: modality(),
          pressed: press.pressed(),
          hovered: hover.hovered(),
        },
        env,
      ),
    ),
  )
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(own(), press.props, hover.props, {
          onFocusIn: (e: FocusEvent) => send(focusEvent(e.currentTarget as Element, env.modality)),
          onFocusOut: () => send(blurEvent(env.modality)),
        }),
        ...(local.id === undefined ? {} : { id: local.id }),
        ref: setEl,
      },
      rest,
    ),
  )
  const state = reactive<ButtonState>(() => ({
    pending: pending(),
    disabled: disabled(),
    pressed: press.pressed(),
    hovered: hover.hovered(),
    focusVisible: own()["data-focus-visible"] !== undefined,
  }))
  const children = () => resolveChildren(local.children, state)
  return renderPart(local.render, merged, state, children, (p) =>
    local.href === undefined ? <button {...p}>{children()}</button> : <a {...p}>{children()}</a>,
  )
}
