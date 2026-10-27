/** @jsxImportSource solid-js */
// Agent Presence (add-agent-presence): a voice agent's state in words and as a visual. The
// audio level is never state: `startLevelLoop` writes it to the Root each frame (custom
// properties and a coarse `data-level`) while listening or speaking, motion allowed.
import {
  type AgentPresenceMessages,
  type AgentState,
  agentPresenceConnect,
  agentPresenceMachine,
  agentPresenceMessages,
  announcerCapability,
  type LevelChannel,
  type MessageOverrides,
  partId,
  startLevelLoop,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  Show,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"

declare module "../provider" {
  interface RindMessageScopes {
    "agent-presence": AgentPresenceMessages
  }
}

/** What every part's `render` receives. */
export interface AgentPresenceRenderState {
  readonly state: AgentState
  readonly previous: AgentState | null
  readonly stale: boolean
  readonly muted: boolean
  readonly motion: "full" | "reduced" | "off"
}

type Api = ReturnType<typeof agentPresenceConnect>

interface Ctx {
  readonly api: Accessor<Api>
  readonly state: AgentPresenceRenderState
  readonly registry: PartRegistry<"status">
  readonly statusId: Accessor<string>
}
const AgentPresenceContext = createContext<Ctx>()
function useAgentPresence(part: string): Ctx {
  const ctx = useContext(AgentPresenceContext)
  if (!ctx) throw new Error(`AgentPresence.${part} must be inside AgentPresence.Root`)
  return ctx
}

type PartProps<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the part's state. */
  readonly render?: RenderProp<AgentPresenceRenderState> | undefined
  readonly children?: JSX.Element | ((state: AgentPresenceRenderState) => JSX.Element)
}

export type AgentPresenceRootProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>> & {
  /** Required. Map it from your voice runtime. */
  readonly state: AgentState
  /** Why, for `error`. */
  readonly reason?: string | undefined
  /** The microphone is muted. */
  readonly muted?: boolean | undefined
  /** The audio level 0–1, read each frame while listening (input) or speaking (output). */
  readonly getLevel?: ((channel: LevelChannel) => number) | undefined
  /** Announce the first listening, a long think, the end and errors (assertive). */
  readonly announce?: "off" | "polite" | undefined
  /** A think is announced after this (ms). Default 1500. */
  readonly thinkingDelay?: number | undefined
  /** A state lasting longer is stale (`data-stale`, `onStale`). */
  readonly staleAfter?: Partial<Record<AgentState, number>> | undefined
  /** "off" stops the level loop; "auto" follows the reduced-motion preference. Default "auto". */
  readonly motion?: "auto" | "off" | undefined
  /** Each change. */
  readonly onStateChange?: ((state: AgentState, details: { from: AgentState }) => void) | undefined
  /** A state became stale. */
  readonly onStale?: ((state: AgentState) => void) | undefined
  readonly messages?: MessageOverrides<AgentPresenceMessages> | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
}

function Root(props: AgentPresenceRootProps) {
  const [own, rest] = splitProps(props, [
    "state",
    "reason",
    "muted",
    "getLevel",
    "announce",
    "thinkingDelay",
    "staleAfter",
    "motion",
    "onStateChange",
    "onStale",
    "messages",
    "locale",
    "render",
    "children",
  ])
  const instance = useRootId(() => rest.id)
  const env = useEnvironment(announcerCapability)
  const messages = useMessages("agent-presence", agentPresenceMessages, () => own.messages)
  const locale = useLocale(() => own.locale)
  const registry = usePartRegistry<"status">({ scope: "agent-presence", root: instance() })
  const composed = useRenderedId(registry, "status")
  const [reduced, setReduced] = createSignal(env.motion.reducedMotion())
  onCleanup(env.motion.subscribeReducedMotion(() => setReduced(env.motion.reducedMotion())))
  const motion = () => (own.motion === "off" ? "off" : reduced() ? "reduced" : "full")
  const muted = () => own.muted === true
  const { view } = useMachine(
    agentPresenceMachine,
    () => ({
      state: own.state,
      reason: own.reason,
      muted: muted(),
      announce: own.announce,
      thinkingDelay: own.thinkingDelay,
      staleAfter: own.staleAfter,
      onStale: (s: AgentState) => own.onStale?.(s),
      onStateChange: (s: AgentState, d: { from: AgentState }) => own.onStateChange?.(s, d),
      messages: messages(),
      id: instance(),
      lang: locale().locale,
    }),
    env,
  )
  const api = createMemo(() =>
    agentPresenceConnect({
      instance: instance(),
      state: view().context.current,
      previous: view().context.previous,
      stale: view().context.stale,
      muted: muted(),
      motion: motion(),
      reason: own.reason,
      messages: messages(),
    }),
  )
  // The level is written to the Root each frame, outside rendering (design §4).
  const [rootEl, setRootEl] = createSignal<HTMLElement | null>(null)
  const channel = createMemo(() => (own.getLevel ? api().levelChannel : null))
  afterMount(() => {
    createEffect(() => {
      const el = rootEl()
      const c = channel()
      if (!el || c === null) return
      onCleanup(
        untrack(() =>
          startLevelLoop(el, {
            channel: c,
            getLevel: (ch) => own.getLevel?.(ch) ?? 0,
            scheduler: env.scheduler,
            now: () => env.clock.now(),
          }),
        ),
      )
    })
  })
  const state = reactive<AgentPresenceRenderState>(() => ({
    state: view().context.current,
    previous: view().context.previous,
    stale: view().context.stale,
    muted: muted(),
    motion: motion(),
  }))
  const ctx: Ctx = {
    api,
    state,
    registry,
    statusId: () => partId("agent-presence", instance(), "status"),
  }
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(api().root()),
        ...(rest.id === undefined ? {} : { id: rest.id }),
        ref: setRootEl,
      },
      rest,
    ),
  )
  const children = () => (
    <>
      {resolveChildren(own.children, state)}
      <Show when={composed() === undefined}>
        <span {...normalizeProps(api().hiddenStatus())}>{api().statusText}</span>
      </Show>
    </>
  )
  return (
    <AgentPresenceContext.Provider value={ctx}>
      {renderPart(own.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </AgentPresenceContext.Provider>
  )
}

type SpanProps = PartProps<JSX.HTMLAttributes<HTMLSpanElement>>

/** `aria-hidden`: put your orb, bars or canvas here. */
function Visual(props: PartProps<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useAgentPresence("Visual")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().visual()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

/** The state in words ("Listening"); not a live region. Rendered hidden when not composed. */
function Status(props: SpanProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useAgentPresence("Status")
  const id = () => rest.id ?? ctx.statusId()
  useRegisterPart(ctx.registry, "status", id)
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(ctx.api().status()), id: id() }, rest),
  )
  const children = () => resolveChildren(local.children, ctx.state) ?? ctx.api().statusText
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

/** The agent's name or a caption. */
function Label(props: SpanProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useAgentPresence("Label")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().label()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

/** More about the state (an error's `reason` in `data-reason`). */
function Detail(props: SpanProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useAgentPresence("Detail")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().detail()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

/** The parts, by name: `agent-presence.parts.ts` re-exports them as the `AgentPresence` namespace. */
export { Detail, Label, Root, Status, Visual }
