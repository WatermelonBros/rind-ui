// JSON Tree View's API facts for the generated docs (scripts/docs-gen.ts). Its items, keys and
// states are Tree View's (see tree-view.meta.ts); these are the JSON parts and props.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"json-tree-view"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-type":
    "The value's type: string, number, bigint, boolean, null, undefined, object, array, map, set, date, regexp, error, function, symbol, instance, circular or range.",
  "data-key": "The item's JSON Pointer.",
})

export const jsonTreeViewMeta = {
  scope: "json-tree-view",
  name: "JSON Tree View",
  stateless: false,
  parts: [
    {
      name: "JsonTreeView.Root",
      part: "root",
      element: "div",
      description:
        "A Tree View of `data`: renders the tree, its items and their text. Every Tree View prop applies.",
    },
    {
      name: "JsonTreeView.Item",
      part: "item",
      element: "div",
      description:
        "Tree View's Item with the JSON attributes (`data-key`, `data-type`, `data-range`, `data-empty`): use it in your own markup.",
    },
    {
      name: "JsonTreeView.Key",
      part: "key",
      element: "span",
      description: "The property name or index (a range: its bounds).",
    },
    {
      name: "JsonTreeView.Separator",
      part: "separator",
      element: "span",
      description: '":", read between the key and the value.',
    },
    {
      name: "JsonTreeView.Value",
      part: "value",
      element: "span",
      description:
        "A leaf's value: strings escaped, never cut in the DOM (`data-quoted` for strings).",
    },
    {
      name: "JsonTreeView.Summary",
      part: "summary",
      element: "span",
      description: '`aria-hidden`; a container\'s glyph summary ("{4}", "[3]").',
    },
    {
      name: "JsonTreeView.SummaryText",
      part: "summary-text",
      element: "span",
      description: 'Visually hidden; the spoken summary ("object, 4 entries").',
    },
    {
      name: "JsonTreeView.Preview",
      part: "preview",
      element: "span",
      description: "`aria-hidden`; a collapsed container's first keys.",
    },
    {
      name: "JsonTreeView.CopyTrigger",
      part: "copy-trigger",
      element: "button",
      description: "Copies the highlighted item in `copyFormat`; the result is announced.",
    },
  ],
  props: {
    data: { type: "unknown", description: "Required. The value to show." },
    defaultExpandedDepth: {
      type: "number",
      default: "1",
      description: "Levels open on the first value; a new `data` keeps the user's expansion.",
    },
    groupSize: {
      type: "number",
      default: "100",
      description: "More children than this are grouped in ranges.",
    },
    maxPreviewItems: {
      type: "number",
      default: "3",
      description: "Keys previewed after a collapsed container.",
    },
    copyFormat: {
      type: '"json" | "value" | "pointer"',
      default: '"json"',
      description: "What a copy writes: the subtree as JSON, a leaf's raw value, or the pointer.",
    },
    messages: {
      type: "Partial<JsonTreeViewMessages>",
      description: "Overrides the strings (also through the provider).",
    },
  },
  dataAttributes: {
    key: base("key"),
    separator: base("separator"),
    value: { ...base("value"), "data-quoted": "A string value." },
    summary: base("summary"),
    "summary-text": base("summary-text"),
    preview: base("preview"),
  },
  keyboard: [
    ["Ctrl+C / ⌘C", "Copies the focused item."],
    ["Arrows, Home, End, *, typing", "Tree View's keys."],
  ],
  states: {},
  contract: {
    actions: { copy: ["pointer", "keyboard", "touch", "virtual"] },
    queries: ["nodeAt", "valueText", "summaryOf", "copyState"],
    traits: [],
  },
} as const satisfies ComponentMeta
