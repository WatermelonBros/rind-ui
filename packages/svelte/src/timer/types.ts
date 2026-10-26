import type {
  MessageOverrides,
  TimerAction,
  TimerMessages,
  TimerState,
  TimerTickDetails,
  TimerUnit,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    timer: TimerMessages
  }
}

/** What every part's snippets receive. */
export interface TimerRenderState {
  readonly state: TimerState
  /** The value in ms. */
  readonly value: number
  /** 0–1 from start to target; 0 without a target. */
  readonly progress: number
}

/** What an ActionTrigger's snippets receive. */
export interface TimerActionTriggerRenderState extends TimerRenderState {
  readonly action: TimerAction
  /** The toggle's word for the current state ("Start", "Pause", "Resume"). */
  readonly label: string
  /** The action does nothing in the current state. */
  readonly disabled: boolean
}

type Part<A, S = TimerRenderState> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<S>]> | undefined
  readonly children?: Snippet<[S]> | undefined
}
type Typed<A> = Part<A> & {
  /** The unit. ItemValue and ItemLabel take it from their Item when omitted. */
  readonly type?: TimerUnit | undefined
}

export type TimerRootProps = Part<HTMLAttributes<HTMLDivElement>> & {
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
export type TimerAreaProps = Part<HTMLAttributes<HTMLDivElement>>
export type TimerControlProps = Part<HTMLAttributes<HTMLDivElement>>
export type TimerItemProps = Part<HTMLAttributes<HTMLDivElement>> & {
  readonly type: TimerUnit
}
export type TimerItemValueProps = Typed<HTMLAttributes<HTMLSpanElement>>
export type TimerItemLabelProps = Typed<HTMLAttributes<HTMLSpanElement>>
export type TimerSeparatorProps = Part<HTMLAttributes<HTMLSpanElement>>
export type TimerActionTriggerProps = Part<HTMLButtonAttributes, TimerActionTriggerRenderState> & {
  /** What a press does. */
  readonly action: TimerAction
}
