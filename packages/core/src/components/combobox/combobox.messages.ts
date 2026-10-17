import { type InputChipsMessages, inputChipsMessages } from "../input-chips/input-chips"

/** The pattern's messages (combobox-pattern "Pattern Messages") with English defaults. */
export type ComboboxMessages = InputChipsMessages & {
  /** The listbox's name when no Label part is rendered. */
  readonly listboxLabel: string
  readonly triggerLabel: string
  readonly clearLabel: string
  readonly count: (n: number) => string
  readonly noResults: string
  readonly loading: string
  readonly focusAnnouncement: (item: string, selected: boolean, section?: string) => string
  readonly selectedAnnouncement: (item: string) => string
}

export const comboboxMessages: ComboboxMessages = {
  ...inputChipsMessages,
  chipsLabel: "Selected options",
  listboxLabel: "Suggestions",
  triggerLabel: "Show suggestions",
  clearLabel: "Clear",
  count: (n) => `${n} ${n === 1 ? "result" : "results"}`,
  noResults: "No results",
  loading: "Loading…",
  focusAnnouncement: (item, selected, section) =>
    [section, item, selected ? "selected" : undefined].filter(Boolean).join(", "),
  selectedAnnouncement: (item) => `${item}, selected`,
}
