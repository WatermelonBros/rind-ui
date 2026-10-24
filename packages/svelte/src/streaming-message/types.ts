import type {
  MessageOverrides,
  StreamingAnnounce,
  StreamingMessageMessages,
  StreamingMessageState,
  StreamingSmooth,
  StreamingStatus,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    "streaming-message": StreamingMessageMessages
  }
}

/** What every part's children receive. */
export interface StreamingMessageRenderState {
  readonly state: StreamingMessageState
  /** The displayed text (a prefix of `text` while the reveal catches up). */
  readonly text: string
  readonly busy: boolean
}

type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<StreamingMessageRenderState>]> | undefined
  readonly children?: Snippet<[StreamingMessageRenderState]> | undefined
}

export type StreamingMessageRootProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** Everything received so far. */
  readonly text: string
  /** The response's status, from your chat runtime. */
  readonly status: StreamingStatus
  /** Reveal bursty chunks evenly (default true); off under reduced motion. */
  readonly smooth?: boolean | StreamingSmooth | undefined
  /** What is announced (default "status": the lifecycle only). */
  readonly announce?: StreamingAnnounce | undefined
  readonly messages?: MessageOverrides<StreamingMessageMessages> | undefined
  /** Default: the provider's locale (sentence splitting). */
  readonly locale?: string | undefined
}
/** Content's children: your renderer (markdown), given the state's `text`; default: plain text. */
export type StreamingMessagePartProps = Part<HTMLAttributes<HTMLElement>>
