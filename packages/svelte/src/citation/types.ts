import type { CitationMessages, CitationSource, MessageOverrides } from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAnchorAttributes, HTMLAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    citation: CitationMessages
  }
}

/** What every part's snippets receive. */
export interface CitationRenderState {
  readonly open: boolean
  readonly pinned: boolean
  readonly kind: "link" | "button" | "pending"
}

type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<CitationRenderState>]> | undefined
  readonly children?: Snippet<[CitationRenderState]> | undefined
}

export interface CitationRootProps {
  /** The source; absent while it streams (the marker is pending text). */
  readonly source?: CitationSource | undefined
  /** Required. The number the marker shows. */
  readonly index: number
  /** Where the link opens. Default "_self". */
  readonly target?: "_self" | "_blank" | undefined
  /** Hover delay before opening (ms). Default 300. */
  readonly openDelay?: number | undefined
  /** Delay before closing (ms). Default 200. */
  readonly closeDelay?: number | undefined
  /** A button marker was pressed. */
  readonly onPinnedChange?: ((pinned: boolean) => void) | undefined
  readonly messages?: MessageOverrides<CitationMessages> | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
  /** Base for the ids of the card's parts. Default: generated. */
  readonly id?: string | undefined
  readonly children?: Snippet | undefined
}
export type CitationTriggerProps = Part<HTMLAnchorAttributes>
export type CitationPartProps = Part<HTMLAttributes<HTMLElement>>
