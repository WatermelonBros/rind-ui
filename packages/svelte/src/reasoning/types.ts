import type {
  ChangeDetails,
  MessageOverrides,
  ReasoningEvent,
  ReasoningMessages,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    reasoning: ReasoningMessages
  }
}

/** What every part's children receive. */
export interface ReasoningRenderState {
  readonly open: boolean
  readonly thinking: boolean
  /** Seconds, or null when unknown. */
  readonly duration: number | null
}

type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<ReasoningRenderState>]> | undefined
  readonly children?: Snippet<[ReasoningRenderState]> | undefined
}

export type ReasoningRootProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** The model is thinking (your runtime's streaming flag for the reasoning). */
  readonly thinking: boolean
  /** Controlled (`bind:open`). */
  open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  /** `details.reason`: "auto" (the lifecycle) or "trigger" (the user). */
  readonly onOpenChange?:
    | ((open: boolean, details: ChangeDetails<ReasoningEvent>) => void)
    | undefined
  /** Seconds, from your runtime; else measured on the Environment's clock. */
  readonly duration?: number | undefined
  /** Milliseconds before the automatic close (default 1000). */
  readonly autoCloseDelay?: number | undefined
  /** Announce "Thinking…" and "Thought for N seconds" (default true). */
  readonly announce?: boolean | undefined
  readonly messages?: MessageOverrides<ReasoningMessages> | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
}
export type ReasoningTriggerProps = Part<HTMLButtonAttributes>
export type ReasoningContentProps = Part<HTMLAttributes<HTMLDivElement>>
