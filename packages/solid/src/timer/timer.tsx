/** @jsxImportSource solid-js */
import {
  announcerCapability,
  type MessageOverrides,
  type TimerAction,
  type TimerMessages,
  type TimerState,
  type TimerTickDetails,
  type TimerTime,
  type TimerUnit,
  timerActionEvent,
  timerConfig,
  timerConnect,
  timerMachine,
  timerMessages,
  visibilityCapability,
} from "@rind-ui/core"
import {
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  splitProps,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    timer: TimerMessages
  }
}

/** What every part's `render` receives (ActionTrigger: `TimerActionTriggerRenderState`). */
export interface TimerRenderState {
  readonly state: TimerState
  /** The displayed units. */
  readonly time: TimerTime
  /** 0–1 from start to target (0 without a target). */
  readonly progress: number
}

/** What an ActionTrigger's `render` and `children` receive. */
export interface TimerActionTriggerRenderState {
  readonly action: TimerAction
  /** The toggle's word for the current state ("Start", "Pause", "Resume"). */
  readonly label: string
  /** The action does nothing in the current state. */
  readonly disabled: boolean
}

type Api = ReturnType<typeof timerConnect>

interface Ctx {
  readonly api: Accessor<Api>
  readonly send: (action: TimerAction) => void
  readonly state: TimerRenderState
}
const TimerContext = createContext<Ctx>()
function useTimer(part: string): Ctx {
  const ctx = useContext(TimerContext)
  if (!ctx) throw new Error(`Timer.${part} must be inside Timer.Root`)
  return ctx
}

type PartProps<A, S = TimerRenderState> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the part's state. */
  readonly render?: RenderProp<S> | undefined
  readonly children?: JSX.Element | ((state: S) => JSX.Element)
}

export type TimerRootProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>> & {
  /** Count down from `startMs` to `targetMs` instead of up. */
  readonly countdown?: boolean | undefined
  /** Where the timer starts (ms). Default 0. */
  readonly startMs?: number | undefined
  /** Where it completes (ms). A countdown defaults to 0; a stopwatch without it never completes. */
  readonly targetMs?: number | undefined
  /** Runs from mount. */
  readonly autoStart?: boolean | undefined
  /** The display step and tick period (ms). Default 1000. */
  readonly interval?: number | undefined
  /** Every tick while running. */
  readonly onTick?: ((details: TimerTickDetails) => void) | undefined
  /** Once, when the target is reached. */
  readonly onComplete?: (() => void) | undefined
  readonly onStateChange?: ((state: TimerState) => void) | undefined
  readonly messages?: MessageOverrides<TimerMessages> | undefined
  /** Default: the provider's locale (digits and the spoken duration). */
  readonly locale?: string | undefined
}

function Root(props: TimerRootProps) {
  const [own, rest] = splitProps(props, [
    "countdown",
    "startMs",
    "targetMs",
    "autoStart",
    "interval",
    "onTick",
    "onComplete",
    "onStateChange",
    "messages",
    "locale",
    "render",
    "children",
  ])
  const instance = useRootId(() => rest.id)
  const env = useEnvironment(announcerCapability, visibilityCapability)
  const messages = useMessages("timer", timerMessages, () => own.messages)
  const locale = useLocale(() => own.locale)
  const machineProps = createMemo(() => ({
    countdown: own.countdown,
    startMs: own.startMs,
    targetMs: own.targetMs,
    autoStart: own.autoStart,
    interval: own.interval,
    messages: messages(),
    id: instance(),
    lang: locale().locale,
    onTick: (d: TimerTickDetails) => own.onTick?.(d),
    onComplete: () => own.onComplete?.(),
    onStateChange: (s: TimerState) => own.onStateChange?.(s),
  }))
  const { view, send } = useMachine(timerMachine, machineProps, env)
  const api = createMemo(() =>
    timerConnect(
      {
        instance: instance(),
        state: view().state as TimerState,
        value: view().context.value,
        config: timerConfig(machineProps()),
        locale: locale().locale,
        messages: messages(),
      },
      env,
    ),
  )
  const state = reactive<TimerRenderState>(() => ({
    state: view().state as TimerState,
    time: api().time,
    progress: api().progress,
  }))
  const ctx: Ctx = {
    api,
    send: (action) => {
      if (api().applies(action)) send(timerActionEvent(action))
    },
    state,
  }
  const merged = createMemo(() =>
    mergeProps(
      { ...normalizeProps(api().root()), ...(rest.id === undefined ? {} : { id: rest.id }) },
      rest,
    ),
  )
  const children = () => resolveChildren(own.children, state)
  return (
    <TimerContext.Provider value={ctx}>
      {renderPart(own.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </TimerContext.Provider>
  )
}

export type TimerAreaProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>>

function Area(props: TimerAreaProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useTimer("Area")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().area()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type TimerControlProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>>

function Control(props: TimerControlProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useTimer("Control")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().control()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

type Typed<A> = PartProps<A> & {
  /** The unit: days, hours, minutes, seconds or milliseconds. */
  readonly type: TimerUnit
}

export type TimerItemProps = Typed<JSX.HTMLAttributes<HTMLDivElement>>

function Item(props: TimerItemProps) {
  const [local, rest] = splitProps(props, ["type", "render", "children"])
  const ctx = useTimer("Item")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().item(local.type)), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type TimerItemValueProps = Typed<JSX.HTMLAttributes<HTMLSpanElement>>

function ItemValue(props: TimerItemValueProps) {
  const [local, rest] = splitProps(props, ["type", "render", "children"])
  const ctx = useTimer("ItemValue")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().itemValue(local.type)), rest))
  const children = () => resolveChildren(local.children, ctx.state) ?? ctx.api().text(local.type)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

export type TimerItemLabelProps = Typed<JSX.HTMLAttributes<HTMLSpanElement>>

function ItemLabel(props: TimerItemLabelProps) {
  const [local, rest] = splitProps(props, ["type", "render", "children"])
  const ctx = useTimer("ItemLabel")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().itemLabel(local.type)), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

export type TimerSeparatorProps = PartProps<JSX.HTMLAttributes<HTMLSpanElement>>

function Separator(props: TimerSeparatorProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useTimer("Separator")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().separator()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

export type TimerActionTriggerProps = PartProps<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  TimerActionTriggerRenderState
> & {
  /** What a press does: start, pause, resume, reset, restart or toggle. */
  readonly action: TimerAction
}

function ActionTrigger(props: TimerActionTriggerProps) {
  const [local, rest] = splitProps(props, ["action", "render", "children"])
  const ctx = useTimer("ActionTrigger")
  const env = useEnvironment()
  // Tracks the modality from mount, so the first keyboard focus is already visible.
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const [el, setEl] = createSignal<Element | null>(null)
  // The rendered tag: the element's own once mounted when `render` substitutes it.
  const [measured, setMeasured] = createSignal<string | undefined>()
  afterMount(() => {
    const node = el()
    if (local.render && node) setMeasured(node.tagName.toLowerCase())
  })
  const tag = () => (local.render ? (measured() ?? "button") : "button")
  const native = () => tag() === "button" || tag() === "input"
  const state = reactive<TimerActionTriggerRenderState>(() => ({
    action: local.action,
    label: ctx.api().toggleLabel(),
    disabled: !ctx.api().applies(local.action),
  }))
  const merged = createMemo(() => {
    const api = normalizeProps(
      ctx.api().actionTrigger({
        action: local.action,
        tag: tag(),
        focused: focused(),
        modality: modality(),
      }),
    )
    return mergeProps(
      {
        ...joinHandlers(api, {
          // A disabled action stays focusable (aria-disabled): the press is ignored, focus stays.
          onClick: () => ctx.send(local.action),
          // A substituted non-button element: Enter and Space click it, as a button would.
          onKeyDown: (e: KeyboardEvent) => {
            if (native() || e.repeat) return
            if (e.key === "Enter") (e.currentTarget as HTMLElement).click()
            if (e.key === " ") e.preventDefault()
          },
          onKeyUp: (e: KeyboardEvent) => {
            if (!native() && e.key === " ") (e.currentTarget as HTMLElement).click()
          },
          onFocusIn: () => setFocused(true),
          onFocusOut: () => setFocused(false),
        }),
        ref: setEl,
      },
      rest,
    )
  })
  const children = () => resolveChildren(local.children, state)
  return renderPart(local.render, merged, state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

/** The parts, by name: `timer.parts.ts` re-exports them as the `Timer` namespace. */
export { ActionTrigger, Area, Control, Item, ItemLabel, ItemValue, Root, Separator }
