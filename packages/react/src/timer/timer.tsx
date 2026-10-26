"use client"

import {
  announcerCapability,
  type MessageOverrides,
  type TimerAction,
  type TimerEvent,
  type TimerMessages,
  type TimerState,
  type TimerTickDetails,
  type TimerUnit,
  timerActionEvent,
  timerConfig,
  timerConnect,
  timerMachine,
  timerMessages,
  visibilityCapability,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { useRenderedTag } from "../use-rendered-tag"

declare module "../provider" {
  interface RindMessageScopes {
    timer: TimerMessages
  }
}

/** What every part's `render` receives. */
export interface TimerRenderState {
  readonly state: TimerState
  /** The value in ms. */
  readonly value: number
  /** 0–1 from start to target; 0 without a target. */
  readonly progress: number
}

/** What an ActionTrigger's `render` receives. */
export interface TimerActionTriggerRenderState extends TimerRenderState {
  readonly action: TimerAction
  /** The toggle's word for the current state ("Start", "Pause", "Resume"). */
  readonly label: string
  /** The action does nothing in the current state. */
  readonly disabled: boolean
}

type Api = ReturnType<typeof timerConnect>

interface Ctx {
  readonly api: Api
  readonly send: (event: TimerEvent) => void
  readonly state: TimerRenderState
  readonly messages: TimerMessages
}
const TimerContext = createContext<Ctx | null>(null)
function useTimer(part: string): Ctx {
  const ctx = useContext(TimerContext)
  if (!ctx) throw new Error(`Timer.${part} must be inside Timer.Root`)
  return ctx
}

const UnitContext = createContext<TimerUnit | null>(null)
function useUnit(part: string, own: TimerUnit | undefined): TimerUnit {
  const inherited = useContext(UnitContext)
  const unit = own ?? inherited
  if (!unit) throw new Error(`Timer.${part} needs a type, or to be inside Timer.Item`)
  return unit
}

export type TimerRootProps = ComponentPropsWithRef<"div"> & {
  /** Count down from `startMs` to `targetMs` instead of up. */
  readonly countdown?: boolean
  /** Where the timer starts (ms). Default 0. */
  readonly startMs?: number
  /** Where it completes (ms). A countdown defaults to 0; a stopwatch without it never completes. */
  readonly targetMs?: number
  /** Runs from mount. */
  readonly autoStart?: boolean
  /** The display step and tick period (ms). Default 1000. */
  readonly interval?: number
  /** Every tick while running. */
  readonly onTick?: (details: TimerTickDetails) => void
  /** Once, when the target is reached. */
  readonly onComplete?: () => void
  readonly onStateChange?: (state: TimerState) => void
  readonly messages?: MessageOverrides<TimerMessages>
  /** Default: the provider's locale (digits and the spoken duration). */
  readonly locale?: string
  readonly render?: RenderProp<TimerRenderState>
}

function Root({
  countdown,
  startMs,
  targetMs,
  autoStart,
  interval,
  onTick,
  onComplete,
  onStateChange,
  messages: ownMessages,
  locale: ownLocale,
  render,
  id,
  ref,
  children,
  ...rest
}: TimerRootProps) {
  const instance = useRootId(id)
  const env = useEnvironment(announcerCapability, visibilityCapability)
  const messages = useMessages("timer", timerMessages, ownMessages)
  const { locale } = useLocale(ownLocale)
  const props = {
    countdown,
    startMs,
    targetMs,
    autoStart,
    interval,
    onTick,
    onComplete,
    onStateChange,
    messages,
    id: instance,
    lang: locale,
  }
  const { view, send } = useMachine(timerMachine, props, env)
  const api = timerConnect(
    {
      instance,
      state: view.state,
      value: view.context.value,
      config: timerConfig(props),
      locale,
      messages,
    },
    env,
  )
  const state: TimerRenderState = {
    state: view.state,
    value: view.context.value,
    progress: api.progress,
  }
  const ctx: Ctx = { api, send, state, messages }
  const merged = mergeProps(
    { ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }), ref },
    rest,
  )
  return (
    <TimerContext value={ctx}>
      {renderPart("div", { ...merged, children }, render, state)}
    </TimerContext>
  )
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the part's state. */
  readonly render?: RenderProp<TimerRenderState>
}

function Area({ render, ...rest }: PartProps<"div">) {
  const ctx = useTimer("Area")
  return renderPart("div", mergeProps(normalizeProps(ctx.api.area()), rest), render, ctx.state)
}

function Control({ render, ...rest }: PartProps<"div">) {
  const ctx = useTimer("Control")
  return renderPart("div", mergeProps(normalizeProps(ctx.api.control()), rest), render, ctx.state)
}

type TypedProps<T extends keyof React.JSX.IntrinsicElements> = PartProps<T> & {
  /** The unit. ItemValue and ItemLabel take it from their Item when omitted. */
  readonly type?: TimerUnit
}

function Item({ render, type, ...rest }: TypedProps<"div"> & { readonly type: TimerUnit }) {
  const ctx = useTimer("Item")
  return (
    <UnitContext value={type}>
      {renderPart("div", mergeProps(normalizeProps(ctx.api.item(type)), rest), render, ctx.state)}
    </UnitContext>
  )
}

function ItemValue({ render, type, children, ...rest }: TypedProps<"span">) {
  const ctx = useTimer("ItemValue")
  const unit = useUnit("ItemValue", type)
  const props = mergeProps(normalizeProps(ctx.api.itemValue(unit)), rest)
  return renderPart(
    "span",
    { ...props, children: children ?? ctx.api.text(unit) },
    render,
    ctx.state,
  )
}

function ItemLabel({ render, type, ...rest }: TypedProps<"span">) {
  const ctx = useTimer("ItemLabel")
  const unit = useUnit("ItemLabel", type)
  return renderPart(
    "span",
    mergeProps(normalizeProps(ctx.api.itemLabel(unit)), rest),
    render,
    ctx.state,
  )
}

function Separator({ render, ...rest }: PartProps<"span">) {
  const ctx = useTimer("Separator")
  return renderPart(
    "span",
    mergeProps(normalizeProps(ctx.api.separator()), rest),
    render,
    ctx.state,
  )
}

export type TimerActionTriggerProps = Omit<ComponentPropsWithRef<"button">, "children"> & {
  /** What a press does. */
  readonly action: TimerAction
  /**
   * The trigger's content, or a function of its state: `{({ label }) => label}` shows
   * "Start", "Pause" or "Resume" for a toggle. Default: the action's word from messages.
   */
  readonly children?: ReactNode | ((state: TimerActionTriggerRenderState) => ReactNode)
  /** Another element or a render function receiving the props and the trigger's state. */
  readonly render?: RenderProp<TimerActionTriggerRenderState>
}

function ActionTrigger({ action, render, ref, children, ...rest }: TimerActionTriggerProps) {
  const ctx = useTimer("ActionTrigger")
  const env = useEnvironment()
  // Tracks the modality from mount, so the first keyboard focus is already visible.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const el = useRef<HTMLElement | null>(null)
  const tag = useRenderedTag("button", render, el)
  const api = normalizeProps(ctx.api.actionTrigger({ action, tag, focused, modality }))
  const label = action === "toggle" ? ctx.api.toggleLabel() : ctx.messages[action]
  const state: TimerActionTriggerRenderState = {
    ...ctx.state,
    action,
    label,
    disabled: !ctx.api.applies(action),
  }
  const native = tag === "button" || tag === "input"
  const props = mergeProps(
    {
      ...joinHandlers(api, {
        // A disabled trigger stays focusable (aria-disabled): the press does nothing.
        onClick: () => {
          if (ctx.api.applies(action)) ctx.send(timerActionEvent(action))
        },
        // A substituted non-button element: Enter and Space click it, as a button would.
        onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
          if (native || e.repeat) return
          if (e.key === "Enter") e.currentTarget.click()
          if (e.key === " ") e.preventDefault()
        },
        onKeyUp: (e: KeyboardEvent<HTMLElement>) => {
          if (!native && e.key === " ") e.currentTarget.click()
        },
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
      }),
      ref: composeRefs(el, ref),
    },
    rest,
  )
  const content = typeof children === "function" ? children(state) : (children ?? label)
  return renderPart("button", { ...props, children: content }, render, state)
}

/** The parts, by name: `timer.parts.ts` re-exports them as the `Timer` namespace. */
export { ActionTrigger, Area, Control, Item, ItemLabel, ItemValue, Root, Separator }
