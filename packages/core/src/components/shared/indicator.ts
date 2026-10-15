// The selection indicator part (openspec selection-indicator "Visibility And Semantics"):
// decorative, hidden until measured or while nothing is selected, the measured box as six
// custom properties, data-resizing for a move that is not a selection change.

import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { MeasuredIndicator } from "../../dom/selection-indicator"

export function indicatorProps(input: {
  readonly scope: string
  readonly instance: string
  readonly orientation: "horizontal" | "vertical"
  readonly selected: boolean
  readonly indicator: MeasuredIndicator | null
}): PartProps {
  const box = input.selected ? input.indicator?.box : undefined
  return {
    ...scopeAttrs(input.scope, "indicator", input.instance),
    "data-orientation": input.orientation,
    "aria-hidden": "true",
    hidden: box ? undefined : true,
    "data-state": box ? "visible" : "hidden",
    "data-resizing": dataFlag(box !== undefined && input.indicator?.cause === "layout"),
    style: box
      ? {
          "--rind-indicator-left": `${box.left}px`,
          "--rind-indicator-right": `${box.right}px`,
          "--rind-indicator-top": `${box.top}px`,
          "--rind-indicator-bottom": `${box.bottom}px`,
          "--rind-indicator-width": `${box.width}px`,
          "--rind-indicator-height": `${box.height}px`,
        }
      : undefined,
  }
}
