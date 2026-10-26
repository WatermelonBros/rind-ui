// Citation parts (add-citation design §2–§6): the marker is a real link or button named "Source
// 1: title" (it contains the visible index: Label in Name); without a source yet it is plain
// text, upgraded in place. The card's own props are Hover Card's (composed by the adapter).

import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import { domainOf, safeHref } from "./citation.helpers"
import type { CitationMessages } from "./citation.messages"

export type CitationPart =
  | "trigger"
  | "source"
  | "source-title"
  | "source-url"
  | "source-snippet"
  | "source-link"
  | "cited-text"

export interface CitationSource {
  readonly id?: string | undefined
  readonly title: string
  readonly url?: string | undefined
  readonly snippet?: string | undefined
}

export interface CitationConnectInput {
  readonly instance: string
  readonly index: number
  readonly source: CitationSource | undefined
  readonly open: boolean
  readonly pinned: boolean
  readonly target?: "_self" | "_blank" | undefined
  readonly messages: CitationMessages
}

export function citationConnect(input: CitationConnectInput) {
  const href = safeHref(input.source?.url)
  const pending = input.source === undefined
  const kind: "link" | "button" | "pending" = pending ? "pending" : href ? "link" : "button"
  const state = pending ? "pending" : input.pinned ? "pinned" : input.open ? "open" : "closed"
  const base = (part: CitationPart): PartProps => ({
    ...scopeAttrs("citation", part, input.instance),
    "data-state": state,
  })
  return {
    /** The marker's visible text: the index (its name says the source). */
    markerText: String(input.index),
    kind,
    href,
    domain: domainOf(input.source?.url),
    /** The element the Trigger renders. */
    triggerTag: kind === "link" ? "a" : kind === "button" ? "button" : "span",
    trigger: (): PartProps => ({
      ...base("trigger"),
      "data-kind": kind,
      "data-pinned": dataFlag(input.pinned),
      ...(kind === "pending"
        ? {}
        : {
            "aria-label": input.messages.name(input.index, input.source?.title ?? ""),
            ...(kind === "link"
              ? {
                  href,
                  target: input.target,
                  rel: input.target === "_blank" ? "noopener noreferrer" : undefined,
                }
              : { type: "button", "aria-expanded": input.open || input.pinned ? "true" : "false" }),
          }),
    }),
    source: (): PartProps => ({ ...base("source"), "data-index": String(input.index) }),
    sourceTitle: (): PartProps => base("source-title"),
    sourceUrl: (): PartProps => base("source-url"),
    sourceSnippet: (): PartProps => base("source-snippet"),
    sourceLink: (): PartProps => ({ ...base("source-link"), href, target: input.target }),
    citedText: (): PartProps => base("cited-text"),
  }
}

export type CitationApi = ReturnType<typeof citationConnect>
