// JSON Tree View's own parts (add-json-tree-view design §5, §8): the text inside a Tree View
// item. The visible text is the item's name (Ark replaces it with an English aria-label): the
// glyph summary and the preview are aria-hidden, the spoken summary is visually hidden.

import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import { visuallyHiddenStyle } from "../../dom/visually-hidden"
import { type JsonNode, jsonEntries, jsonValueText } from "./json-tree"
import type { JsonTreeViewMessages } from "./json-tree-view.messages"

export type JsonTreeViewPart =
  | "key"
  | "separator"
  | "value"
  | "summary"
  | "summary-text"
  | "preview"
  | "copy-trigger"

const GLYPH: Partial<Record<string, [string, string]>> = {
  object: ["{", "}"],
  array: ["[", "]"],
  map: ["Map(", ")"],
  set: ["Set(", ")"],
  error: ["Error {", "}"],
}

export interface JsonItemConnectInput {
  readonly instance: string
  readonly node: JsonNode
  readonly messages: JsonTreeViewMessages
  /** Entries shown in a collapsed container's preview (default 3). */
  readonly maxPreviewItems?: number | undefined
}

export function jsonItemConnect(input: JsonItemConnectInput) {
  const { node, messages } = input
  const base = (part: JsonTreeViewPart): PartProps => ({
    ...scopeAttrs("json-tree-view", part, input.instance),
    "data-type": node.type,
    "data-key": node.key,
  })
  const glyph = GLYPH[node.type]
  /** An object, array, map, set or error (a range is a group, not a value). */
  const container = glyph !== undefined
  const preview =
    container && node.count > 0
      ? jsonEntries(node.value)
          .slice(0, input.maxPreviewItems ?? 3)
          .map(([k]) => k)
          .join(", ") + (node.count > (input.maxPreviewItems ?? 3) ? ", …" : "")
      : ""
  return {
    /** The key's text, or null without one (a range, a primitive top-level value). */
    keyText:
      node.type === "range"
        ? messages.range(node.range?.first ?? 0, node.range?.last ?? 0)
        : node.label,
    /** The value's text for a leaf. */
    valueText: node.type === "circular" ? messages.circular : container ? "" : jsonValueText(node),
    /** `{4}`, `[3]`: the glyph summary (aria-hidden). */
    summaryGlyph: glyph ? `${glyph[0]}${node.count}${glyph[1]}` : "",
    /** "object, 4 entries": the spoken summary (visually hidden). */
    summaryText: container ? messages.summary(node.type, node.count) : "",
    previewText: preview,
    isContainer: container,
    /** Item attributes added to Tree View's. */
    item: (): PartProps => ({
      // Named by its content, not by the item text: the glyph and the preview are visible but
      // aria-hidden, so a name taken from the item text would not contain them (WCAG 2.5.3,
      // axe label-content-name-mismatch). The content's name is the same words.
      "aria-labelledby": null,
      "data-type": node.type,
      "data-key": node.key,
      "data-range": dataFlag(node.type === "range"),
      "data-empty": dataFlag(container && node.count === 0),
    }),
    key: (): PartProps => base("key"),
    /** Read: it keeps the key and the value apart in the name ("name: Ada"). */
    separator: (): PartProps => base("separator"),
    value: (): PartProps => ({
      ...base("value"),
      "data-quoted": dataFlag(node.type === "string"),
    }),
    summary: (): PartProps => ({ ...base("summary"), "aria-hidden": "true" }),
    summaryTextPart: (): PartProps => ({ ...base("summary-text"), style: visuallyHiddenStyle }),
    preview: (): PartProps => ({ ...base("preview"), "aria-hidden": "true" }),
  }
}

export type JsonItemApi = ReturnType<typeof jsonItemConnect>
