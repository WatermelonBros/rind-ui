// Progress's parts (design §4): every attribute from one normalised value (range-value), so
// the ARIA value, the value text, the fill and the ring cannot drift. The role is on Root,
// never on the Track or the svg; nothing is a live region.

import { type PartProps, scopeAttrs } from "../../connect/props"
import {
  type RangeOrientation,
  type RangeValue,
  rangeFillStyle,
  rangeValueAttributes,
} from "../shared/range-value"
import { type ProgressState, progressState } from "./progress.machine"

export interface ProgressConnectInput {
  readonly instance: string
  readonly range: RangeValue
  /** The value text (`undefined` when indeterminate). */
  readonly text: string | undefined
  readonly orientation: RangeOrientation
  /** The Label's id while it is rendered. */
  readonly labelledBy?: string | undefined
}

export function progressConnect(input: ProgressConnectInput) {
  const { range, orientation } = input
  const state: ProgressState = progressState(range)
  const base = (part: string): PartProps => ({
    ...scopeAttrs("progress", part, input.instance),
    "data-state": state,
    "data-orientation": orientation,
  })
  const percent = range.value === null ? undefined : range.percent
  return {
    state,
    root: (): PartProps => ({
      ...base("root"),
      role: "progressbar",
      ...rangeValueAttributes(range, input.text),
      "aria-labelledby": input.labelledBy,
      "data-value": range.value === null ? undefined : String(range.value),
      "data-min": String(range.min),
      "data-max": String(range.max),
    }),
    label: (id: string): PartProps => ({ ...base("label"), id }),
    valueText: (): PartProps => ({ ...base("value-text"), "aria-hidden": "true" }),
    track: (): PartProps => base("track"),
    indicator: (): PartProps => ({
      ...base("indicator"),
      style: rangeFillStyle("progress", range, orientation),
    }),
    circle: (): PartProps => ({
      ...base("circle"),
      "aria-hidden": "true",
      viewBox: "0 0 100 100",
      style: percent === undefined ? undefined : { "--rind-progress-percent": String(percent) },
    }),
    circleTrack: (): PartProps => ({
      ...base("circle-track"),
      cx: "50",
      cy: "50",
      r: "45",
      pathLength: "100",
    }),
    circleIndicator: (): PartProps => ({
      ...base("circle-indicator"),
      cx: "50",
      cy: "50",
      r: "45",
      pathLength: "100",
      "stroke-dasharray": "100",
      "stroke-dashoffset": percent === undefined ? undefined : String(100 - percent),
    }),
  }
}
