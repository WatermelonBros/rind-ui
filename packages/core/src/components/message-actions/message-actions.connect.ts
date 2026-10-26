// Message Actions parts (add-message-actions design §2, §3): the Root is a Toolbar host (the
// adapter composes Toolbar for roving focus); Copy and Feedback are Clipboard and Toggle Group
// (the adapter composes them, named from these messages). The parts here are the new ones.

import { focusAttrs } from "../../a11y/focus"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import type { LinkEnv } from "../../dom/link"
import { buttonLikeProps } from "../shared/button-like"
import { type RegenerateState, versionTarget } from "./message-actions.machine"
import type { MessageActionsMessages } from "./message-actions.messages"

export type MessageActionsPart =
  | "root"
  | "item"
  | "copy"
  | "regenerate"
  | "edit"
  | "feedback"
  | "feedback-item"
  | "versions"
  | "version-previous"
  | "version-next"
  | "version-status"

export interface MessageActionsConnectInput {
  readonly instance: string
  readonly active: boolean
  readonly editing: boolean
  readonly regenerate: RegenerateState
  readonly count: number
  readonly index: number
  readonly loop: boolean
  readonly messages: MessageActionsMessages
  /** The Root has a name of its own. */
  readonly named: boolean
}

export interface MessageActionsButtonInput {
  readonly tag: string
  readonly focused: boolean
  readonly modality: Modality
}

export function messageActionsConnect(input: MessageActionsConnectInput, env: LinkEnv) {
  const m = input.messages
  const base = (part: MessageActionsPart): PartProps =>
    scopeAttrs("message-actions", part, input.instance)
  const button = (
    part: MessageActionsPart,
    b: MessageActionsButtonInput,
    disabled: boolean,
    name: string,
  ): PartProps => ({
    ...buttonLikeProps(
      { role: "button", tag: b.tag, type: "button", disabled, focusableWhenDisabled: true },
      env,
    ),
    ...base(part),
    ...focusAttrs(b.focused, b.modality),
    "aria-label": name,
    "data-disabled": dataFlag(disabled),
  })
  const prevDisabled = versionTarget(input.index, input.count, -1, input.loop) === null
  const nextDisabled = versionTarget(input.index, input.count, 1, input.loop) === null
  return {
    /** Versions renders only from two versions. */
    hasVersions: input.count >= 2,
    /** "2 / 3". */
    versionText: `${input.index + 1} / ${input.count}`,
    names: { copy: m.copy, feedback: m.feedback, up: m.up, down: m.down },
    root: (): PartProps => ({
      ...base("root"),
      "aria-label": input.named ? undefined : m.label,
      "data-active": dataFlag(input.active),
      "data-editing": dataFlag(input.editing),
    }),
    item: (): PartProps => base("item"),
    copy: (): PartProps => base("copy"),
    regenerate: (b: MessageActionsButtonInput): PartProps => ({
      ...button("regenerate", b, input.regenerate === "pending", m.regenerate),
      "aria-busy": input.regenerate === "pending" ? "true" : undefined,
      "data-state": input.regenerate,
    }),
    edit: (b: MessageActionsButtonInput): PartProps => ({
      ...button("edit", b, false, m.edit),
      "aria-pressed": input.editing ? "true" : "false",
      "data-state": input.editing ? "on" : "off",
    }),
    feedback: (): PartProps => base("feedback"),
    feedbackItem: (value: "up" | "down"): PartProps => ({
      ...base("feedback-item"),
      "data-value": value,
    }),
    versions: (): PartProps => ({
      ...base("versions"),
      role: "group",
      "aria-label": m.versions,
      "data-count": String(input.count),
      "data-index": String(input.index),
    }),
    versionPrevious: (b: MessageActionsButtonInput): PartProps =>
      button("version-previous", b, prevDisabled, m.previous),
    versionNext: (b: MessageActionsButtonInput): PartProps =>
      button("version-next", b, nextDisabled, m.next),
    versionStatus: (): PartProps => ({ ...base("version-status"), "aria-hidden": "true" }),
  }
}

export type MessageActionsApi = ReturnType<typeof messageActionsConnect>
