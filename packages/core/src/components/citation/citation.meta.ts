// Citation's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in citation.test.ts. (`.pending` until the React parts land.)

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"citation"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-state": '"closed", "open", "pinned" or "pending".',
})

export const citationMeta = {
  scope: "citation",
  name: "Citation",
  stateless: false,
  parts: [
    {
      name: "Citation.Root",
      part: "root",
      element: "(none)",
      description: "Holds the source (`source`, `index`) and the card (Hover Card's).",
    },
    {
      name: "Citation.Trigger",
      part: "trigger",
      element: "a | button",
      description:
        'The marker: a link for an http(s) source, else a button that pins the card; named "Source 1: title". Plain text while the source is pending.',
    },
    {
      name: "Citation.Portal",
      part: "portal",
      element: "none",
      description:
        "Hover Card's portal: renders the card outside the paragraph the marker sits in.",
    },
    {
      name: "Citation.Positioner",
      part: "positioner",
      element: "div",
      description: "Hover Card's positioner.",
    },
    {
      name: "Citation.Content",
      part: "content",
      element: "div",
      description: "The card: non-modal, reachable with Tab from the marker.",
    },
    { name: "Citation.Source", part: "source", element: "div", description: "One source." },
    { name: "Citation.SourceTitle", part: "source-title", element: "p", description: "Its title." },
    { name: "Citation.SourceUrl", part: "source-url", element: "span", description: "Its domain." },
    {
      name: "Citation.SourceSnippet",
      part: "source-snippet",
      element: "p",
      description: "The quoted passage.",
    },
    {
      name: "Citation.SourceLink",
      part: "source-link",
      element: "a",
      description: "The link to the source.",
    },
    {
      name: "Citation.CitedText",
      part: "cited-text",
      element: "span",
      description: "The words the citation supports (`data-state` follows the card).",
    },
  ],
  props: {
    source: {
      type: "{ id?, title, url?, snippet? }",
      description: "The source; absent while it streams (the marker is pending text).",
    },
    index: { type: "number", description: "Required. The number the marker shows." },
    target: {
      type: '"_self" | "_blank"',
      default: '"_self"',
      description: "Where the link opens.",
    },
    openDelay: { type: "number", default: "300", description: "Hover delay before opening (ms)." },
    closeDelay: { type: "number", default: "200", description: "Delay before closing (ms)." },
    onPinnedChange: {
      type: "(pinned: boolean) => void",
      description: "A button marker was pressed.",
    },
    messages: {
      type: "Partial<CitationMessages>",
      description: "Overrides the strings (also through the provider).",
    },
    locale: { type: "string", description: "Default: the provider's locale." },
    "*.render": {
      type: "RenderProp",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    trigger: {
      ...base("trigger"),
      "data-kind": '"link", "button" or "pending".',
      "data-pinned": "Pinned open by a press.",
    },
    source: { ...base("source"), "data-index": "The citation's number." },
    "source-title": base("source-title"),
    "source-url": base("source-url"),
    "source-snippet": base("source-snippet"),
    "source-link": base("source-link"),
    "cited-text": base("cited-text"),
  },
  keyboard: [
    ["Tab", "To the marker (opens the card), then into the card."],
    ["Enter", "On a link: follows it; on a button: pins the card."],
    ["Escape", "Closes the card."],
  ],
  states: {
    idle: "Not pinned: the card follows hover and focus.",
    pinned: "Pinned open by a press.",
  },
  contract: {
    actions: {
      show: ["pointer", "keyboard"],
      pin: ["pointer", "keyboard", "touch", "virtual"],
      hide: ["keyboard"],
    },
    queries: ["isOpen", "isPinned", "kind", "href", "sourceTitle"],
    traits: [],
  },
} as const satisfies ComponentMeta
