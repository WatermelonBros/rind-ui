import { type InputChipsMessages, inputChipsMessages } from "../input-chips/input-chips"
import { type PatternMessages, patternMessages } from "./pattern/machine"

/** The pattern's messages (combobox-pattern "Pattern Messages") with English defaults. */
export type ComboboxMessages = InputChipsMessages &
  PatternMessages & {
    readonly triggerLabel: string
    readonly clearLabel: string
    /** Inline: a page change, announced politely. */
    readonly pageAnnouncement: (label: string) => string
  }

export const comboboxMessages: ComboboxMessages = {
  ...inputChipsMessages,
  ...patternMessages,
  chipsLabel: "Selected options",
  triggerLabel: "Show suggestions",
  clearLabel: "Clear",
  pageAnnouncement: (label) => label,
}
