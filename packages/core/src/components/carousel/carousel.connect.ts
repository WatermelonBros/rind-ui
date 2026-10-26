// Carousel parts (add-carousel design §5–§7): a named region; slides are groups, the ones off
// the current page inert and hidden (Tab never reaches them); indicators a roving tablist; the
// autoplay control a button named by what it does. No live region: the machine announces.

import { focusAttrs } from "../../a11y/focus"
import type { KeyDescription } from "../../a11y/keys"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import type { LinkEnv } from "../../dom/link"
import { buttonLikeProps } from "../shared/button-like"
import type { CarouselEvent, CarouselState } from "./carousel.machine"
import type { CarouselMessages } from "./carousel.messages"
import { type CarouselLayout, firstSlideOf, slideOnPage } from "./carousel.pages"

export type CarouselPart =
  | "root"
  | "viewport"
  | "slide"
  | "control"
  | "prev-trigger"
  | "next-trigger"
  | "indicator-group"
  | "indicator"
  | "autoplay-trigger"
  | "status"

/** An indicator key: arrows move and select (wrapping), Home and End the ends. */
export function carouselIndicatorKeyEvent(
  k: KeyDescription,
  options: {
    readonly page: number
    readonly pages: number
    readonly orientation: "horizontal" | "vertical"
    readonly dir: "ltr" | "rtl"
  },
): CarouselEvent | null {
  if (k.composing || k.alt || k.ctrl || k.meta || options.pages < 1) return null
  const rtl = options.orientation === "horizontal" && options.dir === "rtl"
  const nextKey =
    options.orientation === "vertical" ? "ArrowDown" : rtl ? "ArrowLeft" : "ArrowRight"
  const prevKey = options.orientation === "vertical" ? "ArrowUp" : rtl ? "ArrowRight" : "ArrowLeft"
  const go = (page: number): CarouselEvent => ({ type: "GO", page, reason: "keyboard" })
  if (k.key === nextKey) return go((options.page + 1) % options.pages)
  if (k.key === prevKey) return go((options.page - 1 + options.pages) % options.pages)
  if (k.key === "Home") return go(0)
  if (k.key === "End") return go(options.pages - 1)
  return null
}

export interface CarouselButtonInput {
  readonly tag: string
  readonly focused: boolean
  readonly modality: Modality
}

export interface CarouselConnectInput {
  readonly instance: string
  readonly state: CarouselState
  readonly page: number
  readonly pages: number
  readonly slides: number
  readonly slidesPerPage: number
  readonly slidesPerMove: "page" | number
  readonly loop: boolean
  readonly orientation: "horizontal" | "vertical"
  readonly spacing: string
  readonly delay: number
  readonly scrolling: boolean
  readonly messages: CarouselMessages
  readonly ariaLabel?: string | undefined
  readonly ariaLabelledBy?: string | undefined
  readonly ids: { readonly viewport: string; readonly slide: (index: number) => string }
}

export function carouselConnect(input: CarouselConnectInput, env: LinkEnv) {
  const m = input.messages
  const layout: CarouselLayout = {
    slides: input.slides,
    perPage: input.slidesPerPage,
    perMove: input.slidesPerMove,
  }
  const autoplay = input.state === "stopped" ? "off" : input.state
  const atStart = !input.loop && input.page <= 0
  const atEnd = !input.loop && input.page >= input.pages - 1
  const base = (part: CarouselPart): PartProps => ({
    ...scopeAttrs("carousel", part, input.instance),
    "data-orientation": input.orientation,
  })
  const button = (
    part: CarouselPart,
    name: string,
    disabled: boolean,
    b: CarouselButtonInput,
  ): PartProps => ({
    ...buttonLikeProps(
      { role: "button", tag: b.tag, type: "button", disabled, focusableWhenDisabled: true },
      env,
    ),
    ...base(part),
    ...focusAttrs(b.focused, b.modality),
    "aria-label": name,
    "aria-controls": input.ids.viewport,
    "data-disabled": dataFlag(disabled),
  })
  return {
    page: input.page,
    pages: input.pages,
    statusText: m.status(input.page + 1, input.pages),
    root: (): PartProps => ({
      ...base("root"),
      role: "region",
      "aria-roledescription": m.roleDescription,
      "aria-label": input.ariaLabel,
      "aria-labelledby": input.ariaLabelledBy,
      "data-autoplay": autoplay,
      style: {
        "--rind-carousel-slides-per-page": String(input.slidesPerPage),
        "--rind-carousel-spacing": input.spacing,
        "--rind-carousel-delay": `${input.delay}ms`,
        "--rind-carousel-page": String(input.page),
        "--rind-carousel-pages": String(input.pages),
      },
      [CRITICAL]: ["role"],
    }),
    viewport: (): PartProps => ({
      ...base("viewport"),
      id: input.ids.viewport,
      "data-scrolling": dataFlag(input.scrolling),
      style: {
        display: "flex",
        "flex-direction": input.orientation === "vertical" ? "column" : "row",
        [input.orientation === "vertical" ? "overflow-y" : "overflow-x"]: "auto",
        "scroll-snap-type": `${input.orientation === "vertical" ? "y" : "x"} mandatory`,
        "overscroll-behavior-inline": "contain",
      },
    }),
    slide: (index: number, own: { readonly inView?: boolean | undefined } = {}): PartProps => {
      const onPage = slideOnPage(layout, index, input.page)
      const snaps = Array.from({ length: input.pages }, (_, p) => firstSlideOf(layout, p))
      return {
        ...base("slide"),
        id: input.ids.slide(index),
        role: "group",
        "aria-roledescription": m.slideRoleDescription,
        "aria-label": m.slideLabel(index + 1, input.slides),
        "aria-hidden": onPage ? undefined : "true",
        inert: onPage ? undefined : true,
        "data-index": String(index),
        "data-current": dataFlag(onPage),
        "data-inview": dataFlag(own.inView ?? onPage),
        style: {
          "scroll-snap-align": snaps.includes(index) ? "start" : undefined,
          "flex-shrink": "0",
        },
        [CRITICAL]: ["role"],
      }
    },
    control: (): PartProps => base("control"),
    prevTrigger: (b: CarouselButtonInput): PartProps => button("prev-trigger", m.prev, atStart, b),
    nextTrigger: (b: CarouselButtonInput): PartProps => button("next-trigger", m.next, atEnd, b),
    indicatorGroup: (): PartProps => ({
      ...base("indicator-group"),
      role: "tablist",
      "aria-label": m.indicatorGroupLabel,
      "aria-orientation": input.orientation,
      [CRITICAL]: ["role"],
    }),
    indicator: (page: number, b: CarouselButtonInput): PartProps => {
      const current = page === input.page
      return {
        ...base("indicator"),
        ...focusAttrs(b.focused, b.modality),
        type: b.tag === "button" ? "button" : undefined,
        role: "tab",
        "aria-selected": current ? "true" : "false",
        "aria-controls": input.ids.slide(firstSlideOf(layout, page)),
        "aria-label": m.indicatorLabel(page + 1, input.pages),
        tabindex: current ? 0 : -1,
        "data-index": String(page),
        "data-current": dataFlag(current),
        [CRITICAL]: ["role"],
      }
    },
    autoplayTrigger: (b: CarouselButtonInput): PartProps => ({
      ...buttonLikeProps(
        {
          role: "button",
          tag: b.tag,
          type: "button",
          disabled: false,
          focusableWhenDisabled: false,
        },
        env,
      ),
      ...base("autoplay-trigger"),
      ...focusAttrs(b.focused, b.modality),
      "aria-label": autoplay === "off" ? m.play : m.stop,
      "data-autoplay": autoplay,
    }),
    status: (): PartProps => ({ ...base("status"), "aria-hidden": "true" }),
  }
}

export type CarouselApi = ReturnType<typeof carouselConnect>
