import type {
  AgentPresenceMessages,
  AgentState,
  LevelChannel,
  MessageOverrides,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    "agent-presence": AgentPresenceMessages
  }
}

/** What every part's snippets receive. */
export interface AgentPresenceRenderState {
  readonly state: AgentState
  readonly previous: AgentState | null
  readonly stale: boolean
  readonly muted: boolean
  readonly motion: "full" | "reduced" | "off"
}

type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<AgentPresenceRenderState>]> | undefined
  readonly children?: Snippet<[AgentPresenceRenderState]> | undefined
}

export type AgentPresenceRootProps = Part<HTMLAttributes<HTMLDivElement>> & {
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
export type AgentPresenceDivProps = Part<HTMLAttributes<HTMLDivElement>>
export type AgentPresenceSpanProps = Part<HTMLAttributes<HTMLSpanElement>>
