// Context Meter's strings (spec "Context Meter Messages").

export interface ContextMeterMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** The meter's name without a Label. */
  readonly label: string
  /** The value in words: numbers and percent already formatted for the locale. */
  readonly valueText: (v: { used: string; max: string; percent: string }) => string
  /** Without a known window size. */
  readonly unknown: (v: { used: string }) => string
  readonly warning: string
  readonly full: string
  readonly over: string
}

export const contextMeterMessages: ContextMeterMessages = {
  label: "Context used",
  valueText: ({ used, max, percent }) => `${used} of ${max} tokens, ${percent}`,
  unknown: ({ used }) => `${used} tokens used`,
  warning: "Context almost full",
  full: "Context full",
  over: "Context limit exceeded",
}
