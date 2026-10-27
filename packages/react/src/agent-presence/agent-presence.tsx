"use client"

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
import {
  type ComponentPropsWithRef,
  createContext,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import {
  type PartRegistry,
  usePartRegistry,
  useRegisterPart,
  useRenderedId,
  useRootId,
} from "../use-ids"
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
  readonly api: Api
  readonly state: AgentPresenceRenderState
  readonly registry: PartRegistry<"status">
  readonly statusId: string
}
const AgentPresenceContext = createContext<Ctx | null>(null)
function useAgentPresence(part: string): Ctx {
  const ctx = useContext(AgentPresenceContext)
  if (!ctx) throw new Error(`AgentPresence.${part} must be inside AgentPresence.Root`)
  return ctx
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the part's state. */
  readonly render?: RenderProp<AgentPresenceRenderState>
}

export type AgentPresenceRootProps = PartProps<"div"> & {
  /** Required. Map it from your voice runtime. */
  readonly state: AgentState
  /** Why, for `error`. */
  readonly reason?: string
  /** The microphone is muted. */
  readonly muted?: boolean
  /** The audio level 0–1, read each frame while listening (input) or speaking (output). */
  readonly getLevel?: (channel: LevelChannel) => number
  /** Announce the first listening, a long think, the end and errors (assertive). */
  readonly announce?: "off" | "polite"
  /** A think is announced after this (ms). Default 1500. */
  readonly thinkingDelay?: number
  /** A state lasting longer is stale (`data-stale`, `onStale`). */
  readonly staleAfter?: Partial<Record<AgentState, number>>
  /** "off" stops the level loop; "auto" follows the reduced-motion preference. Default "auto". */
  readonly motion?: "auto" | "off"
  /** Each change. */
  readonly onStateChange?: (state: AgentState, details: { from: AgentState }) => void
  /** A state became stale. */
  readonly onStale?: (state: AgentState) => void
  /** Overrides the strings (also through the provider). */
  readonly messages?: MessageOverrides<AgentPresenceMessages>
  /** Default: the provider's locale. */
  readonly locale?: string
}

function Root({
  state,
  reason,
  muted = false,
  getLevel,
  announce,
  thinkingDelay,
  staleAfter,
  motion: motionProp = "auto",
  onStateChange,
  onStale,
  messages: ownMessages,
  locale: ownLocale,
  render,
  id,
  ref,
  children,
  ...rest
}: AgentPresenceRootProps) {
  const instance = useRootId(id)
  const env = useEnvironment(announcerCapability)
  const messages = useMessages("agent-presence", agentPresenceMessages, ownMessages)
  const { locale } = useLocale(ownLocale)
  const registry = usePartRegistry<"status">({ scope: "agent-presence", root: instance })
  const composed = useRenderedId(registry, "status")
  const reduced = useSyncExternalStore(
    env.motion.subscribeReducedMotion,
    () => env.motion.reducedMotion(),
    () => false,
  )
  const motion = motionProp === "off" ? "off" : reduced ? "reduced" : "full"
  const { view } = useMachine(
    agentPresenceMachine,
    {
      state,
      reason,
      muted,
      announce,
      thinkingDelay,
      staleAfter,
      onStale: (s: AgentState) => onStale?.(s),
      onStateChange: (s: AgentState, d: { from: AgentState }) => onStateChange?.(s, d),
      messages,
      id: instance,
      lang: locale,
    },
    env,
  )
  const api = agentPresenceConnect({
    instance,
    state: view.context.current,
    previous: view.context.previous,
    stale: view.context.stale,
    muted,
    motion,
    reason,
    messages,
  })
  // The level is written to the Root each frame, outside rendering (design §4).
  const rootEl = useRef<HTMLElement | null>(null)
  const levelRef = useRef(getLevel)
  levelRef.current = getLevel
  const channel = getLevel ? api.levelChannel : null
  useEffect(() => {
    const el = rootEl.current
    if (!el || channel === null) return
    return startLevelLoop(el, {
      channel,
      getLevel: (c) => levelRef.current?.(c) ?? 0,
      scheduler: env.scheduler,
      now: () => env.clock.now(),
    })
  }, [channel, env])
  const renderState: AgentPresenceRenderState = {
    state: view.context.current,
    previous: view.context.previous,
    stale: view.context.stale,
    muted,
    motion,
  }
  const ctx: Ctx = {
    api,
    state: renderState,
    registry,
    statusId: partId("agent-presence", instance, "status"),
  }
  const props = mergeProps(
    {
      ...normalizeProps(api.root()),
      ...(id === undefined ? {} : { id }),
      ref: composeRefs(rootEl, ref),
    },
    rest,
  )
  return (
    <AgentPresenceContext value={ctx}>
      {renderPart(
        "div",
        {
          ...props,
          children: (
            <>
              {children}
              {composed === undefined ? (
                <span {...normalizeProps(api.hiddenStatus())}>{api.statusText}</span>
              ) : null}
            </>
          ),
        },
        render,
        renderState,
      )}
    </AgentPresenceContext>
  )
}

/** `aria-hidden`: put your orb, bars or canvas here. */
function Visual({ render, ...rest }: PartProps<"div">) {
  const ctx = useAgentPresence("Visual")
  return renderPart("div", mergeProps(normalizeProps(ctx.api.visual()), rest), render, ctx.state)
}

/** The state in words ("Listening"); not a live region. Rendered hidden when not composed. */
function Status({ render, id, children, ...rest }: PartProps<"span">) {
  const ctx = useAgentPresence("Status")
  const own = id ?? ctx.statusId
  useRegisterPart(ctx.registry, "status", own)
  const props = mergeProps({ ...normalizeProps(ctx.api.status()), id: own }, rest)
  return renderPart(
    "span",
    { ...props, children: children ?? ctx.api.statusText },
    render,
    ctx.state,
  )
}

/** The agent's name or a caption. */
function Label({ render, ...rest }: PartProps<"span">) {
  const ctx = useAgentPresence("Label")
  return renderPart("span", mergeProps(normalizeProps(ctx.api.label()), rest), render, ctx.state)
}

/** More about the state (an error's `reason` in `data-reason`). */
function Detail({ render, ...rest }: PartProps<"span">) {
  const ctx = useAgentPresence("Detail")
  return renderPart("span", mergeProps(normalizeProps(ctx.api.detail()), rest), render, ctx.state)
}

/** The parts, by name: `agent-presence.parts.ts` re-exports them as the `AgentPresence` namespace. */
export { Detail, Label, Root, Status, Visual }
