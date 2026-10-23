import type {
  ChangeDetails,
  MarqueeEvent,
  MarqueeMessages,
  MarqueeOrientation,
  MarqueeState,
  MessageOverrides,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    marquee: MarqueeMessages
  }
}

/** What every part's snippets receive. */
export interface MarqueeRenderState {
  readonly state: MarqueeState
  /** The user pause (a hover pause is `state` "paused" with this false). */
  readonly paused: boolean
  readonly orientation: MarqueeOrientation
  readonly reverse: boolean
}
type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<MarqueeRenderState>]> | undefined
  readonly children?: Snippet<[MarqueeRenderState]> | undefined
}
export type MarqueeRootProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** The user pause; `bind:paused` controls it. */
  paused?: boolean | undefined
  /** Uncontrolled initial user pause. */
  readonly defaultPaused?: boolean | undefined
  /** `details.reason`: "trigger" or "focus". */
  readonly onPausedChange?:
    | ((paused: boolean, details: ChangeDetails<MarqueeEvent>) => void)
    | undefined
  /** A mouse or pen over the Viewport pauses until it leaves (never touch). Default true. */
  readonly pauseOnHover?: boolean | undefined
  /** CSS px per second (default 50); below 1 counts as 1. */
  readonly speed?: number | undefined
  readonly orientation?: MarqueeOrientation | undefined
  /** Moves toward the inline end (or down). */
  readonly reverse?: boolean | undefined
  /** Enough copies to fill the Viewport (at most 32). */
  readonly autoFill?: boolean | undefined
  readonly messages?: MessageOverrides<MarqueeMessages> | undefined
}
export type MarqueePauseTriggerProps = Part<HTMLButtonAttributes>
export type MarqueePartProps = Part<HTMLAttributes<HTMLDivElement>>
