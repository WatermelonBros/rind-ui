// Collapsible parts (design §2): the APG Disclosure. `aria-expanded` follows the value at
// the transition (never the exit animation), `aria-controls` only while the content is in
// the document, no role and no `aria-hidden` on the content.

import { focusAttrs } from "../../a11y/focus"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import type { LinkEnv } from "../../dom/link"
import { buttonLikeProps } from "../shared/button-like"
import type { CollapsibleReveal } from "./collapsible.machine"

export type CollapsiblePart = "root" | "trigger" | "content" | "indicator"
export type ClosedContent = "until-found" | "hidden" | "unmount"

export interface CollapsibleConnectInput {
  /** `data-scope` (an Accordion item's parts are "accordion"); default "collapsible". */
  readonly scope?: string
  readonly instance: string
  readonly open: boolean
  readonly reveal: CollapsibleReveal
  readonly disabled: boolean
  readonly focusableWhenDisabled: boolean
  readonly closedContent: ClosedContent
  /** The trigger's rendered tag (a span gets role button and tabIndex). */
  readonly triggerTag: string
  readonly triggerFocused: boolean
  readonly modality: Modality
  readonly pressed: boolean
  readonly hovered: boolean
  /** Ids of the trigger and content; `contentRendered`: the content is in the document. */
  readonly triggerId: string
  readonly contentId: string
  readonly contentRendered: boolean
}

export function collapsibleConnect(input: CollapsibleConnectInput, env: LinkEnv) {
  const state = input.open ? "open" : "closed"
  const base = (part: CollapsiblePart) => ({
    ...scopeAttrs(input.scope ?? "collapsible", part, input.instance),
    "data-state": state,
    "data-disabled": dataFlag(input.disabled),
  })
  return {
    open: input.open,
    root: (): PartProps => base("root"),
    trigger: (): PartProps => ({
      ...buttonLikeProps(
        {
          role: "button",
          tag: input.triggerTag,
          disabled: input.disabled,
          focusableWhenDisabled: input.focusableWhenDisabled,
        },
        env,
      ),
      ...base("trigger"),
      id: input.triggerId,
      "aria-expanded": String(input.open),
      "aria-controls": input.contentRendered ? input.contentId : undefined,
      ...focusAttrs(input.triggerFocused, input.modality),
      "data-pressed": dataFlag(input.pressed),
      "data-hover": dataFlag(input.hovered),
      [CRITICAL]: ["aria-expanded", "aria-controls"],
    }),
    /**
     * `hidden`: the closed, settled content's attribute. until-found is upgraded after
     * commit by the until-found module (React serialises `hidden` as a boolean); a disabled
     * collapsible degrades it to plain `hidden`, so find-in-page cannot open it.
     */
    content: (hidden: boolean): PartProps => ({
      ...base("content"),
      id: input.contentId,
      hidden: hidden ? true : undefined,
      "data-reveal": input.reveal ?? undefined,
    }),
    indicator: (): PartProps => ({ ...base("indicator"), "aria-hidden": "true" }),
  }
}
