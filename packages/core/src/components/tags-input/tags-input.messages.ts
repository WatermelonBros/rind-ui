import { type PatternMessages, patternMessages } from "../combobox/pattern/machine"
import { type InputChipsMessages, inputChipsMessages } from "../input-chips/input-chips"

/** Why a candidate tag was refused: a built-in check, or the consumer's `validate` reason. */
export type TagRefusalReason = "duplicate" | "max" | "invalid" | (string & {})

/**
 * Every string the Tags Input sends to assistive technology (English defaults), with the
 * pattern's for the suggestions.
 */
export type TagsInputMessages = InputChipsMessages &
  PatternMessages & {
    readonly editLabel: (tag: string) => string
    readonly clearLabel: string
    readonly addedAnnouncement: (tag: string) => string
    readonly addedManyAnnouncement: (count: number, locale: string) => string
    readonly updatedAnnouncement: (tag: string) => string
    readonly refusedAnnouncement: (reason: TagRefusalReason, text: string) => string
    readonly clearedAnnouncement: string
  }

const plural = (locale: string, n: number) => new Intl.PluralRules(locale).select(n)

export const tagsInputMessages: TagsInputMessages = {
  ...inputChipsMessages,
  ...patternMessages,
  chipsLabel: "Tags",
  tagsSummary: (tags, locale = "en") =>
    tags.length === 0
      ? "No tags"
      : `${tags.length} ${plural(locale, tags.length) === "one" ? "tag" : "tags"}: ${tags.join(", ")}`,
  editLabel: (tag) => `Edit ${tag}`,
  clearLabel: "Clear all tags",
  addedAnnouncement: (tag) => `${tag} added`,
  addedManyAnnouncement: (count, locale) =>
    `${count} ${plural(locale, count) === "one" ? "tag" : "tags"} added`,
  updatedAnnouncement: (tag) => `${tag} updated`,
  refusedAnnouncement: (reason, text) =>
    reason === "duplicate"
      ? `${text} is already a tag`
      : reason === "max"
        ? `${text} not added: the maximum is reached`
        : reason === "invalid"
          ? `${text} is not valid`
          : `${text} not added: ${reason}`,
  clearedAnnouncement: "All tags removed",
}
