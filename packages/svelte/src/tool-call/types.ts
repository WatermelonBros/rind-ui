import type {
  ApprovalState,
  MessageOverrides,
  ToolCallDecision,
  ToolCallMessages,
  ToolCallStatus,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    "tool-call": ToolCallMessages
  }
}

/** What every part's snippets receive. */
export interface ToolCallRenderState {
  readonly status: ToolCallStatus
  readonly open: boolean
  readonly approval: ApprovalState
  readonly decision: "approved" | "denied" | null
  /** Seconds: the prop, else the measured time; null when unknown. */
  readonly duration: number | null
}

type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<ToolCallRenderState>]> | undefined
  readonly children?: Snippet<[ToolCallRenderState]> | undefined
}

export type ToolCallRootProps = Omit<Part<HTMLAttributes<HTMLDivElement>>, "id"> & {
  /** Required. The call's identity, sent with the decision. */
  readonly id: string
  /** Required. The tool's name. */
  readonly name: string
  /** Required. Map it from your runtime. */
  readonly status: ToolCallStatus
  /** Open state; `bind:open` controls it. */
  open?: boolean | undefined
  /** Uncontrolled open state. Default false. */
  readonly defaultOpen?: boolean | undefined
  /** The Header was pressed. */
  readonly onOpenChange?: ((open: boolean) => void) | undefined
  /** The human's decision; without it no buttons are rendered. */
  readonly onDecision?: ((decision: ToolCallDecision) => void | Promise<void>) | undefined
  /** Focus Approve when a request arrives (only when the user expects it). Default "none". */
  readonly focusOnRequest?: "none" | "approval" | undefined
  /** Announce a request for approval and a failure. Default "polite". */
  readonly announce?: "off" | "polite" | undefined
  /** A high-risk request (the theme uses the danger tone). Default "normal". */
  readonly risk?: "normal" | "high" | undefined
  /** Seconds; else measured from the first live status. */
  readonly duration?: number | undefined
  readonly messages?: MessageOverrides<ToolCallMessages> | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
}
export type ToolCallButtonProps = Part<HTMLButtonAttributes>
export type ToolCallPartProps = Part<HTMLAttributes<HTMLElement>>
