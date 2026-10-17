// Meter's parts (design §4): `role="meter"` exactly (no fallback tokens, RS#6627), every
// attribute from one normalised value and its zone. Never a live region.

import { type PartProps, scopeAttrs } from "../../connect/props"
import {
  type RangeOrientation,
  type RangeValue,
  rangeFillStyle,
  rangeValueAttributes,
} from "../shared/range-value"
import type { MeterZone } from "./meter.zone"

declare const process: { env: { NODE_ENV?: string } }

export interface MeterConnectInput {
  readonly instance: string
  readonly range: RangeValue
  readonly zone: MeterZone | undefined
  readonly text: string | undefined
  readonly orientation: RangeOrientation
  /** The Label's id while it is rendered. */
  readonly labelledBy?: string | undefined
}

export function meterConnect(input: MeterConnectInput) {
  const { range, orientation } = input
  const base = (part: string): PartProps => ({
    ...scopeAttrs("meter", part, input.instance),
    "data-orientation": orientation,
    "data-zone": input.zone,
  })
  return {
    root: (): PartProps => ({
      ...base("root"),
      role: "meter",
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
      style: rangeFillStyle("meter", range, orientation),
    }),
  }
}

/** Development: a Meter always has a value; a missing one renders as `min`. */
export function checkMeterValue(value: number | null | undefined): void {
  if (process.env.NODE_ENV === "production") return
  if (value === null || value === undefined || Number.isNaN(value)) {
    console.error(
      "[rind-ui] meter: value is required (a meter is never indeterminate); rendering min. Use Progress for an unknown amount.",
    )
  }
}
