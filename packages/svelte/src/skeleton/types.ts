import type { MessageOverrides, SkeletonMessages } from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    skeleton: SkeletonMessages
  }
}

export interface SkeletonState {
  readonly loading: boolean
}

type Part<E extends HTMLElement> = Omit<HTMLAttributes<E>, "children"> & {
  readonly child?: Snippet<[ChildArgs<SkeletonState>]> | undefined
  readonly children?: Snippet<[SkeletonState]> | undefined
}

export type SkeletonRootProps = Part<HTMLDivElement> & {
  /** Default `true`: the whole area is loading. */
  readonly loading?: boolean | undefined
  /** Announce politely on `loading → loaded`: `true` for `messages.loaded`, or the text. */
  readonly announceOnLoad?: boolean | string | undefined
  /** Default `true`: Items carry `data-animate` while loading. */
  readonly animate?: boolean | undefined
  readonly messages?: MessageOverrides<SkeletonMessages> | undefined
}
export type SkeletonStatusProps = Part<HTMLSpanElement>
export type SkeletonContentProps = Part<HTMLDivElement>
export type SkeletonItemProps = Part<HTMLSpanElement> & {
  /** Overrides the Root's state for this Item. */
  readonly loading?: boolean | undefined
  /** Overrides the Root's `animate`. */
  readonly animate?: boolean | undefined
}
