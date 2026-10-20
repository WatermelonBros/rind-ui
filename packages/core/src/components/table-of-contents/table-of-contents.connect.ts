// Table of Contents parts (add-table-of-contents design §3): a named navigation landmark with
// a list of anchor links; exactly one link is the current location. Ids come from the
// instance, so no two parts share one (zag#3378).

import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { TableOfContentsMessages } from "./table-of-contents.messages"

export type TableOfContentsPart = "root" | "title" | "list" | "item" | "link" | "indicator"

/** A section listed by the Table of Contents. */
export interface TableOfContentsItem {
  /** The heading's id (the link's fragment). */
  readonly id: string
  readonly label: string
  /** Nesting under the shallowest heading (0, 1, …). */
  readonly depth: number
}

export interface TableOfContentsConnectInput {
  readonly instance: string
  /** The current section's id ("" for none). */
  readonly value: string
  readonly visible: readonly string[]
  /** A Title is rendered: it names the landmark. */
  readonly titled: boolean
  readonly ids: { readonly title: string }
  /** The current link's box within the List, for the Indicator. */
  readonly marker: { readonly top: number; readonly height: number } | null
  readonly messages: TableOfContentsMessages
}

export function tableOfContentsConnect(input: TableOfContentsConnectInput) {
  const part = (name: TableOfContentsPart): PartProps =>
    scopeAttrs("table-of-contents", name, input.instance)
  const sectionPart = (name: TableOfContentsPart, item: TableOfContentsItem): PartProps => ({
    ...part(name),
    "data-value": item.id,
    "data-depth": String(item.depth),
    "data-current": dataFlag(item.id === input.value),
    "data-visible": dataFlag(input.visible.includes(item.id)),
  })
  return {
    root: (): PartProps => ({
      ...part("root"),
      ...(input.titled
        ? { "aria-labelledby": input.ids.title }
        : { "aria-label": input.messages.label }),
    }),
    title: (): PartProps => ({ ...part("title"), id: input.ids.title }),
    list: (): PartProps => ({ ...part("list"), style: { position: "relative" } }),
    item: (item: TableOfContentsItem): PartProps => sectionPart("item", item),
    link: (item: TableOfContentsItem): PartProps => ({
      ...sectionPart("link", item),
      href: `#${item.id}`,
      "aria-current": item.id === input.value ? "location" : undefined,
    }),
    indicator: (): PartProps => ({
      ...part("indicator"),
      "aria-hidden": "true",
      "data-hidden": dataFlag(input.marker === null),
      style: {
        position: "absolute",
        "--rind-toc-indicator-top": `${input.marker?.top ?? 0}px`,
        "--rind-toc-indicator-height": `${input.marker?.height ?? 0}px`,
      },
    }),
  }
}
