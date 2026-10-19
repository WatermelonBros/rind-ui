// File Upload's strings: every text that reaches assistive technology. The rejection keys are
// Prompt Input's, with defaults for the reasons only File Upload produces.

import type { FileRejectionReason } from "../shared/file-validation"

export interface FileUploadMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** The selection summary the Trigger is described by. */
  readonly summary: (
    state: { readonly count: number; readonly names: readonly string[] },
    locale: string,
  ) => string
  /** The Item list's name. */
  readonly itemGroupLabel: string
  /** An Item's Remove button. */
  readonly removeLabel: (name: string) => string
  /** The ClearTrigger's name. */
  readonly clearLabel: string
  readonly addedAnnouncement: (name: string) => string
  readonly addedCountAnnouncement: (count: number, locale: string) => string
  readonly rejectedAnnouncement: (name: string, reason: FileRejectionReason) => string
  readonly rejectedCountAnnouncement: (count: number, locale: string) => string
  readonly removedAnnouncement: (name: string) => string
  readonly clearedAnnouncement: string
}

const files = (locale: string, n: number) =>
  new Intl.PluralRules(locale).select(n) === "one" ? "file" : "files"

export const fileUploadMessages: FileUploadMessages = {
  summary: ({ count, names }, locale) =>
    count === 0
      ? "No file chosen"
      : count === 1
        ? (names[0] ?? "")
        : `${new Intl.NumberFormat(locale).format(count)} ${files(locale, count)}`,
  itemGroupLabel: "Selected files",
  removeLabel: (name) => `Remove ${name}`,
  clearLabel: "Remove all files",
  addedAnnouncement: (name) => `${name} added`,
  addedCountAnnouncement: (count, locale) => `${count} ${files(locale, count)} added`,
  rejectedAnnouncement: (name, reason) => {
    switch (reason) {
      case "MAX_SIZE":
        return `${name} is too large`
      case "MIN_SIZE":
        return `${name} is too small`
      case "ACCEPT":
        return `${name} is not an accepted file type`
      case "DUPLICATE":
        return `${name} is already added`
      case "DIRECTORY":
        return `${name} is a folder`
      case "CUSTOM":
        return `${name} was not accepted`
      default:
        return `${name} not added: too many files`
    }
  },
  rejectedCountAnnouncement: (count, locale) => `${count} ${files(locale, count)} not added`,
  removedAnnouncement: (name) => `${name} removed`,
  clearedAnnouncement: "All files removed",
}
