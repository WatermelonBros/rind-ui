// Context Meter parts (add-context-meter design §3–§5): a meter whose value text is the usage
// in words; no meter role without a known window size; the zone never by colour alone.

import { type PartProps, scopeAttrs } from "../../connect/props"
import { type ContextMeterState, contextMeterState } from "./context-meter.machine"
import type { ContextMeterMessages } from "./context-meter.messages"

export type ContextMeterPart =
  | "root"
  | "label"
  | "value-text"
  | "track"
  | "indicator"
  | "breakdown"
  | "breakdown-item"

export interface ContextMeterConnectInput {
  readonly instance: string
  readonly used: number
  readonly max: number | null
  readonly warnAt?: number | undefined
  readonly fullAt?: number | undefined
  readonly locale: string
  readonly formatOptions?: Intl.NumberFormatOptions | undefined
  readonly messages: ContextMeterMessages
  readonly ids: { readonly label: string }
  readonly rendered: { readonly label: boolean }
}

const zoneOf = (s: ContextMeterState) =>
  s === "over" || s === "full" ? "full" : s === "warning" ? "warning" : "ok"

export function contextMeterConnect(input: ContextMeterConnectInput) {
  const state = contextMeterState(input)
  const known = state !== "unknown"
  const max = known ? (input.max as number) : 0
  const used = Math.max(0, input.used)
  const fraction = known ? Math.min(1, used / max) : 0
  const percent = Math.round(fraction * 1000) / 10
  const number = new Intl.NumberFormat(input.locale, input.formatOptions ?? { notation: "compact" })
  const pct = new Intl.NumberFormat(input.locale, { style: "percent", maximumFractionDigits: 0 })
  const percentText = pct.format(known ? used / max : 0)
  const valueText = known
    ? input.messages.valueText({
        used: number.format(used),
        max: number.format(max),
        percent: percentText,
      })
    : input.messages.unknown({ used: number.format(used) })
  const base = (part: ContextMeterPart): PartProps => ({
    ...scopeAttrs("context-meter", part, input.instance),
    "data-state": state,
  })
  return {
    state,
    percent,
    valueText,
    /** The short visible value ("17%", or the usage when the size is unknown). */
    shortText: known ? percentText : valueText,
    root: (): PartProps => ({
      ...base("root"),
      ...(known
        ? {
            role: "meter",
            "aria-valuemin": "0",
            "aria-valuemax": String(max),
            "aria-valuenow": String(Math.min(used, max)),
            "aria-valuetext": valueText,
            "aria-labelledby": input.rendered.label ? input.ids.label : undefined,
            "aria-label": input.rendered.label ? undefined : input.messages.label,
          }
        : {}),
      "data-zone": zoneOf(state),
      "data-percent": String(percent),
      style: { "--rind-context-meter-percent": String(percent) },
    }),
    label: (): PartProps => ({ ...base("label"), id: input.ids.label }),
    valueTextPart: (): PartProps => ({
      ...base("value-text"),
      "aria-hidden": known ? "true" : undefined,
    }),
    track: (): PartProps => ({ ...base("track"), "aria-hidden": "true" }),
    indicator: (): PartProps => ({
      ...base("indicator"),
      "aria-hidden": "true",
      "data-zone": zoneOf(state),
    }),
    breakdown: (): PartProps => base("breakdown"),
    breakdownItem: (key: string): PartProps => ({ ...base("breakdown-item"), "data-key": key }),
  }
}

export type ContextMeterApi = ReturnType<typeof contextMeterConnect>
