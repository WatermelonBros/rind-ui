// The Rating's strings: its value text, formatted once through the shared number formatting,
// so aria-valuetext reads "3.5 of 5 stars" in the locale's digits and separators.

import { format } from "../../i18n/messages"

export interface RatingValueTextArgs {
  readonly value: number
  /** The value formatted for the locale. */
  readonly formatted: string
  readonly count: number
}

export interface RatingMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** `aria-valuetext`: "3 of 5 stars", "No rating" for 0. */
  readonly valueText: (args: RatingValueTextArgs) => string
}

export const ratingMessages: RatingMessages = {
  valueText: ({ value, formatted, count }) =>
    value === 0 ? "No rating" : `${formatted} of ${count} stars`,
}

/** The Rating's aria-valuetext. */
export function ratingValueText(input: {
  readonly value: number
  readonly count: number
  readonly locale: string
  readonly messages: RatingMessages
}): string {
  const formatted = format.number(input.locale).format(input.value)
  return input.messages.valueText({ value: input.value, formatted, count: input.count })
}
