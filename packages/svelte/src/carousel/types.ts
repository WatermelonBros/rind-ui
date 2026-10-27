import type {
  AutoplayReason,
  CarouselEvent,
  CarouselMessages,
  ChangeDetails,
  MessageOverrides,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    carousel: CarouselMessages
  }
}

/** What every part's snippets receive. */
export interface CarouselRenderState {
  /** The current page (0-based). */
  readonly page: number
  readonly pages: number
  readonly autoplay: "off" | "playing" | "paused"
}

type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<CarouselRenderState>]> | undefined
  readonly children?: Snippet<[CarouselRenderState]> | undefined
}

export type CarouselRootProps = Part<HTMLAttributes<HTMLElement>> & {
  /** The current page (0-based); `bind:page` controls it. */
  page?: number | undefined
  /** Uncontrolled page. Default 0. */
  readonly defaultPage?: number | undefined
  /** Every change; `details.event.reason` says how. */
  readonly onPageChange?:
    | ((page: number, details: ChangeDetails<CarouselEvent>) => void)
    | undefined
  /** Slides before they register (server-rendered indicators). */
  readonly slideCount?: number | undefined
  /** Slides shown at once. Default 1. */
  readonly slidesPerPage?: number | undefined
  /** Slides a step moves: `"page"` (default) or a number. */
  readonly slidesPerMove?: "page" | number | undefined
  /** Next on the last page goes to the first. */
  readonly loop?: boolean | undefined
  /** The scroll axis. Default horizontal. */
  readonly orientation?: "horizontal" | "vertical" | undefined
  /** The gap between slides (`--rind-carousel-spacing`). Default "0px". */
  readonly spacing?: string | undefined
  /** Advance by itself; needs an AutoplayTrigger. */
  readonly autoplay?: boolean | undefined
  /** Ms per page. Default 5000. */
  readonly autoplayDelay?: number | undefined
  /** Pause while the pointer is over it. Default true. */
  readonly pauseOnHover?: boolean | undefined
  /** Started or stopped. */
  readonly onAutoplayChange?:
    | ((playing: boolean, details: { readonly reason: AutoplayReason }) => void)
    | undefined
  /** Default: the provider's direction (which way is next for the indicators' arrows). */
  readonly dir?: "ltr" | "rtl" | undefined
  /** Overrides the strings (also through the provider). */
  readonly messages?: MessageOverrides<CarouselMessages> | undefined
}

export type CarouselPartProps = Part<HTMLAttributes<HTMLDivElement>>
export type CarouselSlideProps = CarouselPartProps & {
  /** The slide's position (0-based). */
  readonly index: number
}
export type CarouselButtonProps = Part<HTMLButtonAttributes>
export type CarouselIndicatorProps = CarouselButtonProps & {
  /** The page (0-based). */
  readonly index: number
}
export type CarouselStatusProps = Part<HTMLAttributes<HTMLSpanElement>>
