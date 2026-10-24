import type {
  MessageFrom,
  MessageOverrides,
  MessageThreadMessages,
  MessageThreadState,
  ThreadAnchor,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    "message-thread": MessageThreadMessages
  }
}

/** What every part's children receive. */
export interface MessageThreadRenderState {
  readonly state: MessageThreadState
  readonly anchor: ThreadAnchor
  readonly unread: number
  readonly atBottom: boolean
}

type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<MessageThreadRenderState>]> | undefined
  readonly children?: Snippet<[MessageThreadRenderState]> | undefined
}

export type MessageThreadRootProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** Messages in the thread (or loaded). */
  readonly count: number
  /** The thread's full length when larger than what is loaded (`-1`: unknown). */
  readonly total?: number | undefined
  /** The newest message is the user's: the view goes back to it. */
  readonly lastFromUser?: boolean | undefined
  /** "bottom" follows new content; "top" scrolls the user's new message to the top. */
  readonly anchor?: ThreadAnchor | undefined
  /** How near the bottom, in px, counts as at the bottom (default 32). */
  readonly bottomThreshold?: number | undefined
  /** Older messages are loading (`aria-busy`). */
  readonly loadingOlder?: boolean | undefined
  /** The top was reached: load older messages. */
  readonly onLoadOlder?: (() => void) | undefined
  readonly messages?: MessageOverrides<MessageThreadMessages> | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
}
export type MessageThreadViewportProps = Part<HTMLAttributes<HTMLDivElement>>
export type MessageThreadMessageProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** The message's index in the whole thread (0 is the oldest). */
  readonly index: number
  /** Who wrote it: names the article ("You", "Assistant"). */
  readonly from: MessageFrom
}
export type MessageThreadJumpToLatestProps = Part<HTMLButtonAttributes>
