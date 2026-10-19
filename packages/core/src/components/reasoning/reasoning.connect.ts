// Reasoning parts (add-reasoning design §3): a disclosure (button + region) whose Trigger says
// what is happening; the Content is busy while the model thinks and is never live.

import { focusAttrs } from "../../a11y/focus"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import type { ReasoningMessages } from "./reasoning.messages"

export type ReasoningPart = "root" | "trigger" | "content"

export interface ReasoningConnectInput {
  readonly instance: string
  readonly open: boolean
  readonly thinking: boolean
  /** Seconds, or null when unknown. */
  readonly duration: number | null
  readonly ids: { readonly content: string }
  readonly messages: ReasoningMessages
  readonly locale: string
}

export function reasoningConnect(input: ReasoningConnectInput) {
  const part = (name: ReasoningPart): PartProps => ({
    ...scopeAttrs("reasoning", name, input.instance),
    "data-state": input.open ? "open" : "closed",
    "data-thinking": dataFlag(input.thinking),
  })
  return {
    /** The Trigger's default text. */
    label: input.thinking
      ? input.messages.thinking
      : input.messages.thought(input.duration, input.locale),
    root: (): PartProps => part("root"),
    trigger: (t: { readonly focused: boolean; readonly modality: Modality }): PartProps => ({
      ...part("trigger"),
      ...focusAttrs(t.focused, t.modality),
      type: "button",
      "aria-expanded": input.open ? "true" : "false",
      // Only while the content exists (AI Elements #505).
      "aria-controls": input.open ? input.ids.content : undefined,
    }),
    content: (): PartProps => ({
      ...part("content"),
      id: input.ids.content,
      "aria-busy": input.thinking ? "true" : undefined,
    }),
  }
}
