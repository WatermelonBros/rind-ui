// Grid List's strings (design §5): the selection announcements made where VoiceOver with
// WebKit stays silent (quirk webkit-grid-selection-not-announced) and the checkbox's name.

import { plural } from "../../i18n/messages"

export interface GridListMessages {
  readonly [key: string]: string | ((...args: never) => string)
  readonly selectedAnnouncement: (name: string) => string
  readonly deselectedAnnouncement: (name: string) => string
  readonly selectedCountAnnouncement: (count: number) => string
  /** The checkbox's name: "Select Ada" (the checkbox's own label part plus the row's text). */
  readonly checkboxLabel: string
  /** The select-all checkbox's name. */
  readonly selectAllLabel: string
}

export const gridListMessages: GridListMessages = {
  selectedAnnouncement: (name) => `${name} selected`,
  deselectedAnnouncement: (name) => `${name} not selected`,
  // English plural rules: a translation supplies its own forms.
  selectedCountAnnouncement: (count) =>
    plural("en", count, { one: "# row selected", other: "# rows selected" }),
  checkboxLabel: "Select",
  selectAllLabel: "Select all",
}
