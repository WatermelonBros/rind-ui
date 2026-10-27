// Angle Slider's strings (spec "Angle Slider Messages").

export interface AngleSliderMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** `aria-valuetext`: the formatted number, e.g. "90 degrees". */
  readonly valueText: (args: { readonly value: number; readonly formatted: string }) => string
}

export const angleSliderMessages: AngleSliderMessages = {
  valueText: ({ formatted }) => `${formatted} degrees`,
}
