// Code Block parts (design §4). Content is the `pre`: left-to-right whatever the page, and a
// named tab stop (`role="group"`, so the name is allowed) only while it scrolls; a block that
// fits is no stop and no group. Line numbers are a CSS counter (never text), and highlighted
// lines get a description on Content, so the emphasis does not depend on colour.

import { focusAttrs } from "../../a11y/focus"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import type { LinkEnv } from "../../dom/link"
import { buttonLikeProps } from "../shared/button-like"
import type { CodeTokenType } from "./code-block.highlight"
import type { CodeBlockCopyState } from "./code-block.machine"
import type { CodeBlockMessages } from "./code-block.messages"

export type CodeBlockPart =
  | "root"
  | "header"
  | "title"
  | "copy-trigger"
  | "wrap-trigger"
  | "collapse-trigger"
  | "content"
  | "code"
  | "line"
  | "token"
  | "description"

export interface CodeBlockConnectInput {
  readonly instance: string
  readonly copyState: CodeBlockCopyState
  readonly wrapped: boolean
  readonly expanded: boolean
  readonly collapsible: boolean
  readonly scrollable: boolean
  readonly lineNumbers: boolean
  /** The first line's number (default 1). */
  readonly startLineNumber: number
  readonly maxLines: number | undefined
  readonly highlighted: ReadonlySet<number>
  readonly highlightRuns: readonly (readonly [number, number])[]
  readonly messages: CodeBlockMessages
  /** The rendered Title's id, when there is one. */
  readonly titleId: string | undefined
  readonly contentId: string
  readonly descriptionId: string
}

/** Each trigger's rendered tag and whether it has content (its name; else the message). */
export interface CodeBlockTriggerInput {
  readonly tag: string
  readonly named: boolean
  readonly focused: boolean
  readonly modality: Modality
}

export function codeBlockConnect(input: CodeBlockConnectInput, env: LinkEnv) {
  const base = (part: CodeBlockPart) => scopeAttrs("code-block", part, input.instance)
  const flags = {
    "data-wrapped": dataFlag(input.wrapped),
    "data-expanded": dataFlag(input.expanded),
    "data-collapsible": dataFlag(input.collapsible),
    "data-scrollable": dataFlag(input.scrollable),
  }
  const button = (part: CodeBlockPart, t: CodeBlockTriggerInput, label: string): PartProps => ({
    ...buttonLikeProps(
      { role: "button", tag: t.tag, disabled: false, focusableWhenDisabled: false },
      env,
    ),
    ...base(part),
    ...focusAttrs(t.focused, t.modality),
    "aria-label": t.named ? undefined : label,
  })
  const highlightedAny = input.highlighted.size > 0
  return {
    root: (): PartProps => ({ ...base("root"), "data-copy-state": input.copyState, ...flags }),
    header: (): PartProps => base("header"),
    title: (id: string): PartProps => ({ ...base("title"), id }),
    copyTrigger: (t: CodeBlockTriggerInput): PartProps => ({
      ...button("copy-trigger", t, input.messages.copy),
      "data-state": input.copyState,
    }),
    wrapTrigger: (t: CodeBlockTriggerInput): PartProps => ({
      ...button("wrap-trigger", t, input.messages.wrap),
      "aria-pressed": String(input.wrapped),
      "data-state": input.wrapped ? "on" : "off",
      [CRITICAL]: ["aria-pressed"],
    }),
    collapseTrigger: (t: CodeBlockTriggerInput): PartProps => ({
      ...button("collapse-trigger", t, input.messages.expand),
      "aria-expanded": String(input.expanded),
      "aria-controls": input.contentId,
      hidden: input.collapsible ? undefined : true,
      "data-state": input.expanded ? "open" : "closed",
      [CRITICAL]: ["aria-expanded", "aria-controls"],
    }),
    content: (): PartProps => ({
      ...base("content"),
      ...flags,
      id: input.contentId,
      dir: "ltr",
      role: input.scrollable ? "group" : undefined,
      tabindex: input.scrollable ? 0 : undefined,
      "aria-labelledby": input.scrollable ? input.titleId : undefined,
      "aria-label":
        input.scrollable && input.titleId === undefined ? input.messages.label : undefined,
      "aria-describedby": highlightedAny ? input.descriptionId : undefined,
      "data-line-numbers": dataFlag(input.lineNumbers),
      style:
        input.maxLines === undefined
          ? undefined
          : { "--rind-code-block-max-lines": String(input.maxLines) },
      [CRITICAL]: ["tabindex", "role", "dir"],
    }),
    code: (): PartProps => ({
      ...base("code"),
      style: { "--rind-code-block-start": String(input.startLineNumber - 1) },
    }),
    /** `n`: the 1-based line number. */
    line: (n: number): PartProps => ({
      ...base("line"),
      "data-line": String(n),
      "data-highlighted": dataFlag(input.highlighted.has(n)),
    }),
    /** A highlighted token: only its type, so a 5,000-line block stays light. */
    token: (type: CodeTokenType): PartProps => ({ "data-token": type }),
    description: (): PartProps => ({ ...base("description"), id: input.descriptionId }),
    descriptionText: highlightedAny ? input.messages.highlighted(input.highlightRuns) : "",
  }
}
