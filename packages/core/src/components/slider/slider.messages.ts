// The Slider's strings: thumb names and value text. Value text is formatted once, through
// the shared number formatting, so aria-valuetext and ValueText never disagree (RA#6402).

import { format } from "../../i18n/messages"

export interface SliderValueTextArgs {
  readonly value: number
  /** The value formatted for the locale and `formatOptions`. */
  readonly formatted: string
  readonly index: number
  readonly count: number
}

export interface SliderMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** A thumb's name after the Label's; "" for none (the default for a single thumb). */
  readonly thumbLabel: (index: number, count: number) => string
  readonly valueText: (args: SliderValueTextArgs) => string
}

export const sliderMessages: SliderMessages = {
  thumbLabel: (index, count) =>
    count === 1
      ? ""
      : count === 2
        ? index === 0
          ? "Minimum"
          : "Maximum"
        : `Value ${index + 1} of ${count}`,
  valueText: ({ formatted }) => formatted,
}

export interface SliderTextInput {
  readonly values: readonly number[]
  readonly locale: string
  readonly formatOptions?: Intl.NumberFormatOptions | undefined
  readonly messages: SliderMessages
}

/** Each thumb's aria-valuetext. */
export function thumbValueTexts(input: SliderTextInput): string[] {
  const nf = format.number(input.locale, input.formatOptions)
  const count = input.values.length
  return input.values.map((value, index) =>
    input.messages.valueText({ value, formatted: nf.format(value), index, count }),
  )
}

/** ValueText's default content: one value, a range for two, a locale list for more. */
export function sliderValueText(input: SliderTextInput): string {
  const texts = thumbValueTexts(input)
  if (texts.length === 2 && input.messages.valueText === sliderMessages.valueText) {
    const [a = 0, b = 0] = input.values
    // formatRange marks equal ends as approximate ("~20"): one value is shown as one.
    if (a === b) return texts[0] ?? ""
    return format.number(input.locale, input.formatOptions).formatRange(a, b)
  }
  if (texts.length <= 1) return texts[0] ?? ""
  return new Intl.ListFormat(input.locale, { type: "unit", style: "short" }).format(texts)
}
