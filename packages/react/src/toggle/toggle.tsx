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
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { useFieldsetDisabled } from "../fieldset/fieldset"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { useHover, usePress } from "../use-press"
import { useRenderedTag } from "../use-rendered-tag"

declare const process: { env: { NODE_ENV?: string } }

export interface ToggleState {
  readonly pressed: boolean
  readonly disabled: boolean
}

type Api = ReturnType<typeof toggleConnect>
const ToggleContext = createContext<{ api: Api; state: ToggleState } | null>(null)

export type ToggleRootProps = Omit<ComponentPropsWithRef<"button">, "type"> & {
  readonly pressed?: boolean
  readonly defaultPressed?: boolean
  readonly onPressedChange?: (pressed: boolean, details: ChangeDetails<ToggleEvent>) => void
  readonly disabled?: boolean
  /** Stays in the tab order while disabled (`aria-disabled`), e.g. for a tooltip. */
  readonly focusableWhenDisabled?: boolean
  readonly render?: RenderProp<ToggleState>
}

function Root({
  pressed,
  defaultPressed,
  onPressedChange,
  disabled = false,
  focusableWhenDisabled = false,
  render,
  id,
  ref,
  children,
  ...rest
}: ToggleRootProps) {
  const env = useEnvironment()
  const instance = useRootId(id)
  const el = useRef<HTMLElement | null>(null)
  const tag = useRenderedTag("button", render, el)
  const { view, send } = useMachine(toggleMachine, { pressed, defaultPressed, onPressedChange })
  // A rind-ui Fieldset's context reaches portalled parts; the DOM tracker native fieldsets.
  const fieldsetContext = useFieldsetDisabled()
  const [fieldsetDom, setFieldsetDom] = useState(false)
  const effectiveDisabled = disabled || fieldsetContext || fieldsetDom
  // The modality tracker must see the pointerdown that comes before focus.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  useEffect(() => {
    const node = el.current
    if (!node) return
    const watch = watchFieldsetDisabled(node, setFieldsetDom)
    setFieldsetDom(watch.disabled)
    return watch.stop
  }, [])
  const on = view.matches("on")
  // Development: the name must not follow the state (APG Button).
  const named = useRef<{ name: string; on: boolean } | undefined>(undefined)
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !el.current) return
    const current = { name: accessibleNameOf(el.current), on }
    checkStableName(named.current, current)
    named.current = current
  }, [on])
  const press = usePress({
    env,
    // Only the activation toggles; disabled sends nothing (no guard in the machine).
    send: (e) => {
      // A PressEvent's `type` is the PressEventType union; this one is checked to be "PRESS".
      if (e.type === "PRESS") send(e as Extract<typeof e, { type: "PRESS" }>)
    },
    disabled: () => effectiveDisabled,
  })
  const hover = useHover({ env, send: () => {}, disabled: () => effectiveDisabled })
  const focused = view.context.focused
  const modality = useModality(env.modality, focused)
  const api = toggleConnect(
    {
      instance,
      tag,
      on,
      disabled: effectiveDisabled,
      focusableWhenDisabled,
      focused,
      modality,
      pressed: press.pressed,
      hovered: hover.hovered,
    },
    env,
  )
  const own = normalizeProps(api.root())
  const props = mergeProps(
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
  const state: ToggleState = { pressed: on, disabled: effectiveDisabled }
  return (
    <ToggleContext value={{ api, state }}>
      {renderPart("button", { ...props, children }, render, state)}
    </ToggleContext>
  )
}

export type ToggleIndicatorProps = ComponentPropsWithRef<"span"> & {
  /** Rendered while the toggle is off (the children while it is on). */
  readonly fallback?: ReactNode
  readonly render?: RenderProp<ToggleState>
}

function Indicator({ fallback, render, children, ...rest }: ToggleIndicatorProps) {
  const ctx = useContext(ToggleContext)
  if (!ctx) throw new Error("ToggleGroup.ItemIndicator must be inside ToggleGroup.Item")
  const props = mergeProps(normalizeProps(ctx.api.indicator()), rest)
  return renderPart(
    "span",
    { ...props, children: ctx.state.pressed ? children : fallback },
    render,
    ctx.state,
  )
}

export const Toggle = { Root, Indicator }
