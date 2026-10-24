/** @jsxImportSource solid-js */
import {
  accessibleNameOf,
  blurEvent,
  type ChangeDetails,
  checkStableName,
  focusEvent,
  type ToggleEvent,
  toggleConnect,
  toggleMachine,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  splitProps,
  useContext,
} from "solid-js"
import { useFieldsetDisabled } from "../fieldset/context"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { useHover, usePress } from "../use-press"

declare const process: { env: { NODE_ENV?: string } }

export interface ToggleState {
  readonly pressed: boolean
  readonly disabled: boolean
}

type Api = ReturnType<typeof toggleConnect>
const ToggleContext = createContext<{ api: () => Api; state: ToggleState }>()

export type ToggleRootProps = Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  /** Controlled pressed state. */
  readonly pressed?: boolean | undefined
  /** Uncontrolled initial state. Default: false. */
  readonly defaultPressed?: boolean | undefined
  /** Every activation proposes the opposite value; `details.cancel()` vetoes it. */
  readonly onPressedChange?:
    | ((pressed: boolean, details: ChangeDetails<ToggleEvent>) => void)
    | undefined
  readonly disabled?: boolean | undefined
  /** Stays in the tab order while disabled (`aria-disabled`), e.g. for a tooltip. */
  readonly focusableWhenDisabled?: boolean | undefined
  /** Renders another element with the part's props (spread them on it). */
  readonly render?: RenderProp<ToggleState> | undefined
  readonly children?: JSX.Element | ((state: ToggleState) => JSX.Element)
}

function Root(props: ToggleRootProps) {
  const [local, rest] = splitProps(props, [
    "pressed",
    "defaultPressed",
    "onPressedChange",
    "disabled",
    "focusableWhenDisabled",
    "id",
    "render",
    "children",
  ])
  const env = useEnvironment()
  const instance = useRootId(() => local.id)
  const [el, setEl] = createSignal<Element | null>(null)
  const onPressedChange = (value: boolean, details: ChangeDetails<ToggleEvent>) =>
    local.onPressedChange?.(value, details)
  const { view, send } = useMachine(toggleMachine, () => ({
    pressed: local.pressed,
    defaultPressed: local.defaultPressed,
    onPressedChange,
  }))
  // A rind-ui Fieldset's context reaches portalled parts; the DOM tracker native fieldsets.
  const fieldsetContext = useFieldsetDisabled()
  const [fieldsetDom, setFieldsetDom] = createSignal(false)
  const disabled = () => local.disabled === true || fieldsetContext() || fieldsetDom()
  const on = () => view().matches("on")
  afterMount(() => {
    // The modality tracker must see the pointerdown that comes before focus.
    const offModality = env.modality.subscribe(() => {})
    const node = el()
    const watcher = node ? watchFieldsetDisabled(node, setFieldsetDom) : null
    if (watcher) setFieldsetDom(watcher.disabled)
    onCleanup(() => {
      offModality()
      watcher?.stop()
    })
    if (process.env.NODE_ENV === "production") return
    let named: { name: string; on: boolean } | undefined
    createEffect(() => {
      const node = el()
      const current = on()
      if (!node || named?.on === current) return
      const next = { name: accessibleNameOf(node), on: current }
      checkStableName(named, next)
      named = next
    })
  })
  const press = usePress({
    env,
    // Only the activation toggles; disabled sends nothing (no guard in the machine).
    send: (e) => {
      // A PressEvent's `type` is the PressEventType union; this one is checked to be "PRESS".
      if (e.type === "PRESS") send(e as Extract<typeof e, { type: "PRESS" }>)
    },
    disabled,
  })
  const hover = useHover({ env, send: () => {}, disabled })
  const focused = () => view().context.focused
  const modality = useModality(env.modality, focused)
  const state = reactive(() => ({ pressed: on(), disabled: disabled() }))
  // The rendered tag: a substituted element is measured once mounted.
  const tag = () => (local.render ? (el()?.tagName.toLowerCase() ?? "button") : "button")
  const api = createMemo(() =>
    toggleConnect(
      {
        instance: instance(),
        tag: tag(),
        on: on(),
        disabled: disabled(),
        focusableWhenDisabled: local.focusableWhenDisabled === true,
        focused: focused(),
        modality: modality(),
        pressed: press.pressed(),
        hovered: hover.hovered(),
      },
      env,
    ),
  )
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(normalizeProps(api().root()), press.props, hover.props, {
          onFocusIn: (e: FocusEvent) => send(focusEvent(e.currentTarget as Element, env.modality)),
          onFocusOut: () => send(blurEvent(env.modality)),
        }),
        ...(local.id === undefined ? {} : { id: local.id }),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, state)
  return (
    <ToggleContext.Provider value={{ api, state }}>
      {renderPart(local.render, merged, state, children, (p) => (
        <button {...p}>{children()}</button>
      ))}
    </ToggleContext.Provider>
  )
}

export type ToggleIndicatorProps = Omit<JSX.HTMLAttributes<HTMLSpanElement>, "children"> & {
  /** Rendered while the toggle is off (the children while it is on). */
  readonly fallback?: JSX.Element
  readonly render?: RenderProp<ToggleState> | undefined
  readonly children?: JSX.Element | ((state: ToggleState) => JSX.Element)
}

function Indicator(props: ToggleIndicatorProps) {
  const ctx = useContext(ToggleContext)
  if (!ctx) throw new Error("Toggle.Indicator must be inside Toggle.Root")
  const [local, rest] = splitProps(props, ["fallback", "render", "children"])
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().indicator()), rest))
  const children = () =>
    ctx.state.pressed ? resolveChildren(local.children, ctx.state) : local.fallback
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

/** The parts, by name: `toggle.parts.ts` re-exports them as the `Toggle` namespace. */
export { Indicator, Root }
