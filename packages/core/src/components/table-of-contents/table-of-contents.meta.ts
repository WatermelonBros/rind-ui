// Table of Contents' API facts for the generated docs (scripts/docs-gen.ts). Data only;
// checked against the code in table-of-contents.connect.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"table-of-contents"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})
const section = (part: string) => ({
  ...base(part),
  "data-value": "The section's id.",
  "data-depth": "Nesting under the shallowest heading (0, 1, …).",
  "data-current": "The section being read.",
  "data-visible": "The section is in view.",
})

export const tableOfContentsMeta = {
  scope: "table-of-contents",
  name: "Table of Contents",
  stateless: false,
  parts: [
    {
      name: "TableOfContents.Root",
      part: "root",
      element: "nav",
      description: 'A navigation landmark, named by the Title or "On this page".',
    },
    {
      name: "TableOfContents.Title",
      part: "title",
      element: "h2",
      description: "Names the landmark when rendered.",
    },
    {
      name: "TableOfContents.List",
      part: "list",
      element: "ol",
      description: "The sections; keeps the current one in view when it scrolls.",
    },
    {
      name: "TableOfContents.Item",
      part: "item",
      element: "li",
      description: "One section; takes `item` ({ id, label, depth }).",
    },
    {
      name: "TableOfContents.Link",
      part: "link",
      element: "a",
      description:
        '`href="#id"`; `aria-current="location"` on the section being read; moves focus to the heading for keyboard and screen-reader users.',
    },
    {
      name: "TableOfContents.Indicator",
      part: "indicator",
      element: "span",
      description:
        "`aria-hidden` marker at the current link (`--rind-toc-indicator-top`, `--rind-toc-indicator-height`).",
    },
  ],
  props: {
    items: {
      type: "TableOfContentsItem[]",
      description:
        "The sections ({ id, label, depth }); `collectHeadings(root)` reads them from headings.",
    },
    value: { type: "string", description: "Controlled current section id." },
    defaultValue: { type: "string", description: "Uncontrolled initial section id." },
    onValueChange: {
      type: "(value, details) => void",
      description:
        '`details.reason`: "scroll" (the reading position) or "navigate" (a followed link).',
    },
    scrollRoot: {
      type: "RefObject<HTMLElement | null>",
      description: "The scrolling container (default: the window).",
    },
    offset: {
      type: "number",
      default: "0",
      description: "Pixels hidden at the top by a sticky header.",
    },
    ratio: {
      type: "number",
      default: "1/3",
      description: "The reading line, as a fraction of the scroll root below the offset.",
    },
    messages: {
      type: "Partial<TableOfContentsMessages>",
      description: "Overrides the landmark's name.",
    },
    render: {
      type: "RenderProp",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: base("root"),
    title: base("title"),
    list: base("list"),
    item: section("item"),
    link: { ...section("link"), "data-focus": "Focused.", "data-focus-visible": "Keyboard focus." },
    indicator: { ...base("indicator"), "data-hidden": "No section is current." },
  },
  keyboard: [
    ["Tab", "Through the links."],
    ["Enter", "Follows the link; focus moves to the section's heading."],
  ],
  states: {
    tracking: "The reading position drives the current section.",
    navigating: "A followed link's section is held while its jump scrolls.",
  },
  contract: {
    actions: { follow: ["pointer", "keyboard", "virtual"] },
    queries: ["current", "visible", "focusedHeading"],
    traits: [],
  },
} as const satisfies ComponentMeta
