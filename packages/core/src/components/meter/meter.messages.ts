import type { RangeValueTextArgs } from "../shared/range-value"
import type { MeterZone } from "./meter.zone"

export interface MeterValueTextArgs extends RangeValueTextArgs {
  /** The region, when `low`, `high` or `optimum` is set: say it, colour alone is not enough. */
  readonly zone: MeterZone | undefined
}

/** Meter's strings (English defaults), overridable per instance and through the provider. */
export interface MeterMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** `aria-valuetext` and ValueText's default content; `formatted` is a percent by default. */
  readonly valueText: (args: MeterValueTextArgs) => string
}

export const meterMessages: MeterMessages = {
  valueText: ({ formatted }) => formatted,
}
