// Tag Group's strings: every text that reaches assistive technology (spec "Messages"). The
// remove label and the removal announcement share their keys with Combobox's input chips.

import { plural } from "../../i18n/messages"
import { inputChipsMessages } from "../input-chips/input-chips"

export interface TagGroupMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** TagRemove's name: "Remove Rome". */
  readonly removeLabel: (text: string) => string
  /** The hidden description of a removable tag in keyboard and virtual modality. */
  readonly removeHint: string
  /** One tag left the collection: "Rome removed". */
  readonly removedAnnouncement: (text: string) => string
  /** Several tags left at once: "3 tags removed". */
  readonly removedCountAnnouncement: (count: number) => string
}

export const tagGroupMessages: TagGroupMessages = {
  // Shared with the input chips (Combobox, Tags Input): one translation for both.
  removeLabel: inputChipsMessages.removeLabel,
  removeHint: "Press Delete to remove",
  removedAnnouncement: inputChipsMessages.removedAnnouncement,
  // English plural rules: a translation supplies its own forms.
  removedCountAnnouncement: (count) =>
    plural("en", count, { one: "# tag removed", other: "# tags removed" }),
}
