import type {
  MessageOverrides,
  TimelineAlign,
  TimelineMessages,
  TimelineOrientation,
  TimelineStatus,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type {
  HTMLAttributes,
  HTMLLiAttributes,
  HTMLOlAttributes,
  HTMLTimeAttributes,
} from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    timeline: TimelineMessages
  }
}

/** What every part's snippets receive. */
export interface TimelineRenderState {
  readonly orientation: TimelineOrientation
  readonly align: TimelineAlign
  /** The Item's status (Item parts only). */
  readonly status?: TimelineStatus | undefined
}
type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<TimelineRenderState>]> | undefined
  readonly children?: Snippet<[TimelineRenderState]> | undefined
}
export type TimelineRootProps = Part<HTMLOlAttributes> & {
  /** The current event's index: earlier events are completed, later ones upcoming. */
  readonly current?: number | undefined
  readonly orientation?: TimelineOrientation | undefined
  /** Which side of the rail the content sits on; alternate switches per item. */
  readonly align?: TimelineAlign | undefined
  readonly messages?: MessageOverrides<TimelineMessages> | undefined
  /** Default: the provider's locale (Time's format). */
  readonly locale?: string | undefined
}
export type TimelineItemProps = Part<HTMLLiAttributes> & {
  /** The event's index (0-based). */
  readonly index: number
  /** Its own status; wins over the Root's `current`. */
  readonly status?: TimelineStatus | undefined
}
export type TimelinePartProps = Part<HTMLAttributes<HTMLDivElement>>
export type TimelineTimeProps = Part<Omit<HTMLTimeAttributes, "datetime">> & {
  /** The machine-readable date. */
  readonly datetime: Date | string
}
