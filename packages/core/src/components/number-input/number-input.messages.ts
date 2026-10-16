// The Number Input's strings (spec "Messages"): every text that reaches assistive technology.

export interface NumberInputValueTextArgs {
  readonly value: number
  /** The number-parsing value text (U+2212 minus, accounting as a minus). */
  readonly text: string
}

export interface NumberInputMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** The increment trigger's name, followed by the Label's text. */
  readonly increment: string
  readonly decrement: string
  /** aria-valuetext of an empty field. */
  readonly empty: string
  readonly valueText: (args: NumberInputValueTextArgs) => string
  /** Announced after a commit that rewrote the typed text. */
  readonly committed: (text: string) => string
}

export const numberInputMessages: NumberInputMessages = {
  increment: "Increase",
  decrement: "Decrease",
  empty: "Empty",
  valueText: ({ text }) => text,
  committed: (text) => text,
}
