import type { FileRejectionReason } from "../../dom/file-intake"
import { type InputChipsMessages, inputChipsMessages } from "../input-chips/input-chips"
import { type TextFieldMessages, textFieldMessages } from "../text-field/text-field.messages"

/** Every string the Prompt Input sends to assistive technology (English defaults). */
export type PromptInputMessages = InputChipsMessages &
  Pick<TextFieldMessages, "charactersRemaining" | "charactersOver"> & {
    /** Submit's name while it sends. */
    readonly sendLabel: string
    /** Submit's name while a reply is on its way. */
    readonly stopLabel: string
    /** AttachTrigger's name. */
    readonly attachLabel: string
    readonly stoppedAnnouncement: string
    readonly sendFailedAnnouncement: string
    readonly attachedAnnouncement: (name: string) => string
    readonly attachedCountAnnouncement: (count: number, locale: string) => string
    readonly rejectedAnnouncement: (name: string, reason: FileRejectionReason) => string
    readonly rejectedCountAnnouncement: (count: number, locale: string) => string
  }

const files = (locale: string, n: number) =>
  new Intl.PluralRules(locale).select(n) === "one" ? "file" : "files"

export const promptInputMessages: PromptInputMessages = {
  ...inputChipsMessages,
  charactersRemaining: textFieldMessages.charactersRemaining,
  charactersOver: textFieldMessages.charactersOver,
  chipsLabel: "Attachments",
  tagsSummary: (names, locale = "en") =>
    `${names.length} ${new Intl.PluralRules(locale).select(names.length) === "one" ? "attachment" : "attachments"}: ${names.join(", ")}`,
  sendLabel: "Send message",
  stopLabel: "Stop response",
  attachLabel: "Attach files",
  stoppedAnnouncement: "Response stopped",
  sendFailedAnnouncement: "Message not sent",
  attachedAnnouncement: (name) => `${name} attached`,
  attachedCountAnnouncement: (count, locale) => `${count} ${files(locale, count)} attached`,
  rejectedAnnouncement: (name, reason) =>
    reason === "MAX_SIZE"
      ? `${name} is too large`
      : reason === "ACCEPT"
        ? `${name} is not an accepted file type`
        : `${name} not attached: too many files`,
  rejectedCountAnnouncement: (count, locale) => `${count} ${files(locale, count)} not attached`,
}
