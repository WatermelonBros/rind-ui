import { blurEvent, type DomEnvironment, domEnvironment, focusEvent } from "@rind-ui/core"
import {
  mergeProps,
  normalizeProps,
  renderPart,
  useMachine,
  useModality,
  usePress,
  useRootId,
} from "@rind-ui/react"
import { type ComponentPropsWithRef, type ReactNode, useEffect, useMemo } from "react"
import { connectCounter, connectToggle } from "./press.connect"
import { type CounterProps, counterMachine, type ToggleProps, toggleMachine } from "./press.machine"

type ButtonProps = Omit<ComponentPropsWithRef<"button">, "children" | "onPress" | "disabled"> & {
  readonly children?: ReactNode
  readonly env?: DomEnvironment
}

/** The environment and modality subscription shared by the fixture parts. */
function useEnv(env: DomEnvironment | undefined) {
  const resolved = useMemo(() => env ?? domEnvironment(), [env])
  // Track modality for as long as the part is mounted (the tracker needs a subscriber).
  useEffect(() => resolved.modality.subscribe(() => {}), [resolved])
  return resolved
}

export interface ToggleButtonProps extends ToggleProps, ButtonProps {}

export function ToggleButton({
  pressed,
  defaultPressed,
  onPressedChange,
  disabled,
  env: envProp,
  id,
  ...rest
}: ToggleButtonProps) {
  const env = useEnv(envProp)
  const root = useRootId(id)
  const { view, send } = useMachine(
    toggleMachine,
    { pressed, defaultPressed, onPressedChange, disabled },
    env,
  )
  const press = usePress({ env, send, disabled: () => disabled === true })
  const focused = view.context.focused
  const modality = useModality(env.modality, focused)
  const part = connectToggle(
    {
      on: view.matches("on"),
      focused,
      modality,
      pressing: press.pressed,
      disabled: disabled === true,
    },
    root,
  )
  const props = mergeProps(
    normalizeProps({ ...part, ...press.props }),
    {
      onFocus: (e: { currentTarget: Element }) => send(focusEvent(e.currentTarget, env.modality)),
      onBlur: () => send(blurEvent(env.modality)),
    },
    rest,
  )
  return renderPart("button", props, undefined, undefined)
}

export interface CounterButtonProps extends CounterProps, ButtonProps {
  /** What a click from an associated label does (the press option). */
  readonly labelActivation?: "focus" | "activate"
  /** A stepper held on touch: no context menu, no long press (the press option). */
  readonly suppressTouchContextMenu?: boolean
}

export function CounterButton({
  onPress,
  disabled,
  labelActivation,
  suppressTouchContextMenu,
  env: envProp,
  id,
  ...rest
}: CounterButtonProps) {
  const env = useEnv(envProp)
  const root = useRootId(id)
  const { view, send } = useMachine(counterMachine, { onPress, disabled }, env)
  const press = usePress({
    env,
    send,
    disabled: () => disabled === true,
    ...(labelActivation ? { labelActivation } : {}),
    ...(suppressTouchContextMenu ? { suppressTouchContextMenu } : {}),
  })
  const focused = view.context.focused
  const modality = useModality(env.modality, focused)
  const part = connectCounter(
    {
      count: view.context.count,
      focused,
      modality,
      pressing: press.pressed,
      disabled: disabled === true,
    },
    root,
  )
  const props = mergeProps(
    normalizeProps({ ...part, ...press.props }),
    {
      onFocus: (e: { currentTarget: Element }) => send(focusEvent(e.currentTarget, env.modality)),
      onBlur: () => send(blurEvent(env.modality)),
    },
    rest,
  )
  return renderPart("button", props, undefined, undefined)
}
