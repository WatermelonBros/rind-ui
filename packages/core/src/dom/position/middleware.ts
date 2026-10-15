// Our options as a Floating UI middleware list, in order: offset → flip/shift
// (flip first for aligned popups, shift first for centred ones) → size → arrow →
// transform origin → hide. The 1 px preferred-side bias applies to flip only.

import {
  arrow,
  type Placement as FloatingPlacement,
  flip,
  hide,
  limitShift,
  type Middleware,
  offset,
  shift,
  size,
} from "@floating-ui/dom"
import type { Align, PositioningOptions, Side } from "../../env/position"
import { paddingOf } from "./options"

export interface SizeReport {
  readonly availableWidth: number
  readonly availableHeight: number
  readonly anchorWidth: number
  readonly anchorHeight: number
}

/** Splits Floating UI's placement into side and align. */
export function splitPlacement(p: FloatingPlacement): { side: Side; align: Align } {
  const [side, align] = p.split("-") as [Side, "start" | "end" | undefined]
  return { side, align: align ?? "center" }
}

/**
 * `--rind-transform-origin`: the arrow tip; else, without an arrow, the aligned edge on
 * the anchor-facing side; for a point anchor, the point itself.
 */
export function transformOrigin(input: {
  readonly side: Side
  readonly align: Align
  readonly rtl: boolean
  readonly floating: {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
  }
  readonly arrow?:
    | {
        readonly x?: number | undefined
        readonly y?: number | undefined
        readonly width: number
        readonly height: number
      }
    | undefined
  readonly point?: { readonly x: number; readonly y: number } | undefined
}): string {
  const { side, align, floating: f } = input
  if (input.point) return `${input.point.x - f.x}px ${input.point.y - f.y}px`
  // The anchor-facing edge: the popup below the anchor faces it with its top edge.
  const facing = { top: "100%", bottom: "0%", left: "100%", right: "0%" }[side]
  const vertical = side === "top" || side === "bottom"
  if (input.arrow) {
    const a = input.arrow
    if (vertical) {
      const tip = side === "bottom" ? -a.height : f.height + a.height
      return `${(a.x ?? 0) + a.width / 2}px ${tip}px`
    }
    const tip = side === "right" ? -a.width : f.width + a.width
    return `${tip}px ${(a.y ?? 0) + a.height / 2}px`
  }
  // start/end on the horizontal axis follow the reading direction.
  const along =
    align === "center"
      ? "50%"
      : vertical
        ? (align === "start") !== input.rtl
          ? "0%"
          : "100%"
        : align === "start"
          ? "0%"
          : "100%"
  return vertical ? `${along} ${facing}` : `${facing} ${along}`
}

export function middlewareFor(
  o: PositioningOptions,
  side: Side,
  elements: {
    readonly arrow: HTMLElement | null
    readonly boundary: Element | null
    readonly onSize: (report: SizeReport) => void
  },
  lock: FloatingPlacement | null,
): Middleware[] {
  const padding = paddingOf(o.collisionPadding)
  // The preferred side fits when it overflows by at most 1 px (iOS keyboard centring).
  const flipPadding = { ...padding, [side]: padding[side] - 1 }
  const boundary = elements.boundary ? { boundary: elements.boundary } : {}
  // A centred popup cannot flip its alignment: it slides instead, or it would hang off-screen.
  const c =
    o.align === "center" && o.collisionAvoidance.align === "flip"
      ? { ...o.collisionAvoidance, align: "shift" as const }
      : o.collisionAvoidance
  const flipM =
    lock === null && (c.side === "flip" || c.align === "flip")
      ? flip({
          mainAxis: c.side === "flip",
          crossAxis: c.align === "flip" ? "alignment" : false,
          fallbackAxisSideDirection: c.fallbackAxis,
          padding: flipPadding,
          ...boundary,
        })
      : null
  const shiftM =
    c.side === "shift" || c.align === "shift"
      ? shift({
          // Floating UI's main axis for shift is the alignment axis.
          mainAxis: c.align === "shift",
          crossAxis: c.side === "shift",
          padding,
          // Shifting never moves it onto the anchor on the side axis, unless sticky.
          ...(o.sticky ? {} : { limiter: limitShift() }),
          // Pinch-zoom must not drag an open popup across the page.
          rootBoundary: "layoutViewport",
          ...boundary,
        })
      : null
  const collision = o.align === "center" ? [shiftM, flipM] : [flipM, shiftM]
  return [
    offset({ mainAxis: o.sideOffset, crossAxis: o.alignOffset }),
    ...collision,
    size({
      padding,
      ...boundary,
      apply: ({ availableWidth, availableHeight, rects }) =>
        elements.onSize({
          availableWidth,
          availableHeight,
          anchorWidth: rects.reference.width,
          anchorHeight: rects.reference.height,
        }),
    }),
    elements.arrow ? arrow({ element: elements.arrow, padding: o.arrowPadding }) : null,
    hide({ strategy: "referenceHidden" }),
  ].filter((m): m is Middleware => m !== null && m !== undefined)
}
