// Suggestions parts (add-suggestions design §2, §3): a named group of buttons. While loading or
// disabled the items stay rendered and focusable (aria-disabled): focus never drops.

import { focusAttrs } from "../../a11y/focus"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import type { LinkEnv } from "../../dom/link"
import { buttonLikeProps } from "../shared/button-like"
import type { SuggestionsState } from "./suggestions.machine"
import type { SuggestionsMessages } from "./suggestions.messages"

export type SuggestionsPart = "root" | "item" | "label" | "description"

export interface SuggestionsConnectInput {
  readonly instance: string
  readonly state: SuggestionsState
  readonly count: number
  readonly messages: SuggestionsMessages
  /** The Root has a name of its own (`aria-label` / `aria-labelledby`). */
  readonly named: boolean
}

export interface SuggestionsItemInput {
  readonly key: string
  readonly index: number
  readonly disabled: boolean
  readonly tag: string
  readonly focused: boolean
  readonly modality: Modality
}

export function suggestionsConnect(input: SuggestionsConnectInput, env: LinkEnv) {
  const base = (part: SuggestionsPart): PartProps => ({
    ...scopeAttrs("suggestions", part, input.instance),
    "data-state": input.state,
  })
  return {
    /** Whether a press of this item does anything now. */
    enabled: (itemDisabled: boolean) => input.state === "ready" && !itemDisabled,
    root: (): PartProps => ({
      ...base("root"),
      role: "group",
      "aria-label": input.named ? undefined : input.messages.group,
      "aria-busy": input.state === "loading" ? "true" : undefined,
      "data-count": String(input.count),
    }),
    item: (i: SuggestionsItemInput): PartProps => {
      const disabled = i.disabled || input.state !== "ready"
      return {
        ...buttonLikeProps(
          { role: "button", tag: i.tag, type: "button", disabled, focusableWhenDisabled: true },
          env,
        ),
        ...base("item"),
        ...focusAttrs(i.focused, i.modality),
        "data-key": i.key,
        "data-index": String(i.index),
        "data-disabled": dataFlag(disabled),
      }
    },
    label: (): PartProps => base("label"),
    description: (): PartProps => base("description"),
  }
}

export type SuggestionsApi = ReturnType<typeof suggestionsConnect>
