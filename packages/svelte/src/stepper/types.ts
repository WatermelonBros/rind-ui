import type {
  MessageOverrides,
  StepperChangeDetails,
  StepperMessages,
  StepperOrientation,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type {
  HTMLAttributes,
  HTMLButtonAttributes,
  HTMLLiAttributes,
  HTMLOlAttributes,
} from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    stepper: StepperMessages
  }
}

/** What every part's snippets receive. */
export interface StepperRenderState {
  readonly step: number
  readonly count: number
  readonly orientation: StepperOrientation
}
type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<StepperRenderState>]> | undefined
  readonly children?: Snippet<[StepperRenderState]> | undefined
}
export type StepperRootProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** How many steps. */
  readonly count: number
  /** The current step (0-based); `bind:step` controls it. */
  step?: number | undefined
  readonly defaultStep?: number | undefined
  /** `details.reason`: "next", "prev" or "select"; `details.cancel()` refuses it. */
  readonly onStepChange?: ((step: number, details: StepperChangeDetails) => void) | undefined
  /** Back to any visited step; forward only with NextTrigger (default true). */
  readonly linear?: boolean | undefined
  readonly orientation?: StepperOrientation | undefined
  readonly messages?: MessageOverrides<StepperMessages> | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
}
export type StepperListProps = Part<HTMLOlAttributes>
export type StepperItemProps = Part<HTMLLiAttributes> & {
  /** The step's index (0-based). */
  readonly index: number
  /** The step cannot be visited; Next and Previous skip it. */
  readonly disabled?: boolean | undefined
  /** Overrides the status: completed (true) or not (false) whatever the current step. */
  readonly completed?: boolean | undefined
}
export type StepperButtonProps = Part<HTMLButtonAttributes>
export type StepperSpanProps = Part<HTMLAttributes<HTMLSpanElement>>
export type StepperDivProps = Part<HTMLAttributes<HTMLDivElement>>
export type StepperContentProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** The step this content belongs to (0-based). */
  readonly index: number
}
