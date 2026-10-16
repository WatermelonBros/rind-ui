// Connect helpers for anchored parts: the first-frame style (fixed at the viewport origin,
// transparent, no pointer events, still focusable), the seeded size variables as constant
// keys (the DOM module overwrites them imperatively; a framework style diff never wipes
// them), placement attributes, `dir`, and the CSS anchor names for manual mode.

import { dataFlag, type PartProps } from "../../connect/props"
import type { Align, Placement, Side } from "../../env/position"
import { encodeKey } from "../../ids"

/** What a component keeps in context about its placement (set by `setPlacement`). */
export interface PlacementState {
  readonly placed: boolean
  readonly side: Side
  readonly align: Align
  readonly anchorHidden: boolean
}

/** The placement before the first report of an open. */
export const unplaced = (side: Side, align: Align): PlacementState => ({
  placed: false,
  side,
  align,
  anchorHidden: false,
})

/** The shared action body: a POSITION.PLACED event → the new placement state. */
export const placementFrom = ({ side, align, anchorHidden }: Placement): PlacementState => ({
  placed: true,
  side,
  align,
  anchorHidden,
})

const anchorName = (id: string) => `--rind-anchor-${encodeKey(id)}`

export interface PositionerIds {
  /** The positioner's own id (positioning finds it by id). */
  readonly positioner: string
  /** The anchor's id, for the CSS anchor name. */
  readonly anchor: string
}

export function positionerProps(
  s: PlacementState,
  ids: PositionerIds,
  options: { readonly dir?: "ltr" | "rtl" | undefined; readonly manual?: boolean } = {},
): PartProps {
  const placing = !s.placed
  const style: Record<string, string> = {
    // Seeded: consumer rules using them are valid while the popup is measured.
    "--rind-available-width": "100vw",
    "--rind-available-height": "100vh",
    "position-anchor": anchorName(ids.anchor),
  }
  if (!options.manual) {
    Object.assign(
      style,
      placing
        ? { position: "fixed", top: "0", left: "0", opacity: "0", "pointer-events": "none" }
        : {
            position: "var(--rind-position, absolute)",
            top: "0",
            left: "0",
            transform: "translate(var(--rind-x, 0px), var(--rind-y, 0px))",
          },
    )
  }
  return {
    id: ids.positioner,
    dir: options.dir,
    "data-side": s.side,
    "data-align": s.align,
    "data-anchor-hidden": dataFlag(s.placed && s.anchorHidden),
    "data-placing": dataFlag(placing),
    style,
  }
}

/** The content: placement attributes, and no animation until placed (theme or not). */
export function contentPlacementProps(s: PlacementState): PartProps {
  return {
    "data-side": s.side,
    "data-align": s.align,
    "data-anchor-hidden": dataFlag(s.placed && s.anchorHidden),
    "data-placing": dataFlag(!s.placed),
    ...(s.placed ? {} : { style: { "animation-name": "none" } }),
  }
}

export function arrowProps(s: PlacementState, id: string): PartProps {
  return {
    id,
    "aria-hidden": "true",
    "data-side": s.side,
    "data-anchor-hidden": dataFlag(s.placed && s.anchorHidden),
    // Only the cross axis inline: the main-axis offset (the arrow sticking out of the edge)
    // is the stylesheet's, and an inline `top: var(--rind-arrow-y)` (empty on that axis)
    // would override it with the static position.
    style:
      s.side === "top" || s.side === "bottom"
        ? { position: "absolute", left: "var(--rind-arrow-x)" }
        : { position: "absolute", top: "var(--rind-arrow-y)" },
  }
}

/** The anchor's CSS anchor name (manual mode, consumer CSS anchor positioning). */
export const anchorProps = (anchorId: string): PartProps => ({
  style: { "anchor-name": anchorName(anchorId) },
})
