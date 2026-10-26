// Mentions parts (add-mentions design §6–§7): the textarea is a plain textbox until the list
// opens, then a combobox with the listbox under it (combobox semantics only while open); one
// description names the triggers; the Highlighter paints the ranges and is hidden from
// assistive technology (the text is the textarea's).

import type { CollectionKey } from "../../collection/key"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import {
  type PatternConnectEnv,
  type PatternConnectView,
  patternConnect,
} from "../combobox/pattern/connect"
import type { MentionsEvent } from "./mentions.machine"
import { mentionsIds } from "./mentions.machine"
import type { MentionsMessages } from "./mentions.messages"
import type { MentionRange, TriggerMatch } from "./mentions.text"

export type MentionsPart =
  | "root"
  | "textarea"
  | "description"
  | "highlighter"
  | "mention"
  | "positioner"
  | "popup"
  | "list"
  | "group"
  | "group-label"
  | "item"
  | "item-text"
  | "empty"
  | "loading"

export interface MentionsConnectInput
  extends Omit<
    PatternConnectView,
    | "scope"
    | "common"
    | "exposed"
    | "present"
    | "autoComplete"
    | "messages"
    | "selection"
    | "selectionMode"
    | "send"
    | "choose"
  > {
  readonly value: string
  readonly mentions: readonly MentionRange[]
  readonly match: TriggerMatch | null
  readonly triggers: readonly string[]
  readonly readOnly: boolean
  readonly composing: boolean
  readonly messages: MentionsMessages
  readonly send: (event: MentionsEvent) => void
}

/** A segment of the Highlighter: plain text, or a mention's label. */
export type HighlightSegment =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "mention"; readonly text: string; readonly mention: MentionRange }

/** The value cut into text and mention segments, for the Highlighter. */
export function highlightSegments(
  value: string,
  mentions: readonly MentionRange[],
): HighlightSegment[] {
  const out: HighlightSegment[] = []
  let at = 0
  for (const m of [...mentions].sort((a, b) => a.start - b.start)) {
    if (m.start < at || m.end > value.length) continue
    if (m.start > at) out.push({ kind: "text", text: value.slice(at, m.start) })
    out.push({ kind: "mention", text: value.slice(m.start, m.end), mention: m })
    at = m.end
  }
  // A trailing newline needs a character after it to take a line in the mirror.
  out.push({ kind: "text", text: `${value.slice(at)}​` })
  return out
}

export function mentionsConnect(input: MentionsConnectInput, env: PatternConnectEnv) {
  const ids = mentionsIds(input.instance)
  const open = input.open
  const state = open ? "open" : "closed"
  const common = (part: string): PartProps => ({
    ...scopeAttrs("mentions", part, input.instance),
    "data-state": state,
    "data-trigger": input.match?.trigger,
    "data-disabled": dataFlag(input.disabled),
    "data-readonly": dataFlag(input.readOnly),
  })
  const pattern = patternConnect(
    {
      ...input,
      scope: "mentions",
      exposed: open && !input.empty,
      present: open,
      autoComplete: "list",
      selection: new Set(),
      selectionMode: "none",
      messages: input.messages,
      common,
      choose: (key: CollectionKey) => input.send({ type: "ITEM.CHOOSE", key }),
      send: input.send,
    },
    env,
  )
  const description = input.messages.description(input.triggers)
  return {
    ...pattern,
    description,
    root: (): PartProps => ({ ...common("root"), "data-composing": dataFlag(input.composing) }),
    textarea: (): PartProps => ({
      ...common("textarea"),
      ...(open ? pattern.input() : { "aria-expanded": undefined }),
      id: ids.input,
      value: input.value,
      readonly: input.readOnly || undefined,
      disabled: input.disabled || undefined,
      "aria-describedby": description ? `${ids.input}-description` : undefined,
      "data-composing": dataFlag(input.composing),
      [CRITICAL]: open ? ["aria-expanded", "aria-activedescendant"] : [],
    }),
    descriptionPart: (): PartProps => ({
      ...common("description"),
      id: `${ids.input}-description`,
    }),
    highlighter: (): PartProps => ({
      ...common("highlighter"),
      "aria-hidden": "true",
      style: { "pointer-events": "none", "white-space": "pre-wrap", "overflow-wrap": "break-word" },
    }),
    segments: highlightSegments(input.value, input.mentions),
    mention: (m: MentionRange): PartProps => ({
      ...common("mention"),
      "data-trigger": m.trigger,
      "data-id": m.id,
    }),
    group: pattern.section,
    groupLabel: pattern.sectionLabel,
  }
}

export type MentionsApi = ReturnType<typeof mentionsConnect>
