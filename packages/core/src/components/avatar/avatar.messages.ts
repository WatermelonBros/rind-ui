// Avatar's strings: the overflow counter's label ("4 more"), the only text it exposes.

import { plural } from "../../i18n/messages"

export interface AvatarMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** GroupOverflow's visually hidden text for `count` avatars not shown. */
  readonly overflowLabel: (count: number) => string
}

export const avatarMessages: AvatarMessages = {
  // English plural rules: a translation supplies its own forms ("1 altro", "4 altri").
  overflowLabel: (count) => plural("en", count, { one: "# more", other: "# more" }),
}
