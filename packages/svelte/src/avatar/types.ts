import type { AvatarMessages, AvatarProps, AvatarStatus } from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLImgAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    avatar: AvatarMessages
  }
}

export interface AvatarState {
  readonly status: AvatarStatus
}

type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<AvatarState>]> | undefined
  readonly children?: Snippet<[AvatarState]> | undefined
}

export type AvatarRootProps = Part<HTMLAttributes<HTMLSpanElement>> & {
  /** Milliseconds the Fallback waits while the image is loading (default 0). Client-only. */
  readonly fallbackDelay?: number | undefined
  /** Every status change (observed, not controlled). */
  readonly onStatusChange?: AvatarProps["onStatusChange"]
}
export type AvatarImageProps = Omit<HTMLImgAttributes, "children"> & {
  readonly child?: Snippet<[ChildArgs<AvatarState>]> | undefined
}
export type AvatarFallbackProps = Part<HTMLAttributes<HTMLSpanElement>>
export type AvatarGroupProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  readonly child?: Snippet<[ChildArgs<undefined>]> | undefined
  readonly children?: Snippet | undefined
}
export type AvatarGroupOverflowProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  /** How many avatars are not shown. */
  readonly count: number
  readonly messages?: Partial<AvatarMessages> | undefined
  readonly child?: Snippet<[ChildArgs<{ readonly count: number }>]> | undefined
}
