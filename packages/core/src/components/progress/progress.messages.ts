import type { RangeValueTextArgs } from "../shared/range-value"

/** Progress's strings (English defaults), overridable per instance and through the provider. */
export interface ProgressMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** `aria-valuetext` and ValueText's default content; `formatted` is a percent by default. */
  readonly valueText: (args: RangeValueTextArgs) => string
  /** Announced with `announceCompletion` when the value reaches `max`. */
  readonly complete: string
}

export const progressMessages: ProgressMessages = {
  valueText: ({ formatted }) => formatted,
  complete: "Complete",
}
