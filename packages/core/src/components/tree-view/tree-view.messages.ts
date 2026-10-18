// Tree View's strings (spec "Messages"): the lazy-loading announcements and the empty
// text. The tree's own name has no default: it comes from the Label or the consumer.

import { plural } from "../../i18n/messages"

export interface TreeViewMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** Spoken when a branch starts loading its children. */
  readonly loadingAnnouncement: (name: string) => string
  /** Spoken when they arrive. */
  readonly loadedAnnouncement: (name: string, count: number) => string
  /** Spoken when loading fails. */
  readonly loadFailedAnnouncement: (name: string) => string
  /** The Empty part's default text. */
  readonly emptyLabel: string
  /** The Loading part's default text. */
  readonly loadingLabel: string
}

export const treeViewMessages: TreeViewMessages = {
  loadingAnnouncement: (name) => `Loading ${name}`,
  // English plural rules: a translation supplies its own forms.
  loadedAnnouncement: (name, count) =>
    plural("en", count, { one: `# item loaded in ${name}`, other: `# items loaded in ${name}` }),
  loadFailedAnnouncement: (name) => `${name} could not be loaded`,
  emptyLabel: "No items",
  loadingLabel: "Loading…",
}
