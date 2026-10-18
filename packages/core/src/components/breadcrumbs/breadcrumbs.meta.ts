// Breadcrumbs' API facts for the generated docs (scripts/docs-gen.ts). Data only, type-only
// imports; checked against the code in breadcrumbs.meta.test.ts.

import type { ComponentMeta } from "../meta"

export const breadcrumbsMeta = {
  scope: "breadcrumbs",
  name: "Breadcrumbs",
  stateless: true,
  parts: [
    {
      name: "Breadcrumbs.Root",
      part: "root",
      element: "nav",
      description:
        'The `navigation` landmark, named "Breadcrumbs" unless labelled. May hold other controls.',
    },
    { name: "Breadcrumbs.List", part: "list", element: "ol", description: "The ordered trail." },
    {
      name: "Breadcrumbs.Item",
      part: "item",
      element: "li",
      description:
        "One crumb, keyed by `value`. Its `render` state (or a children function) gives `{ current, currentValue, collapsed, disabled }`.",
    },
    {
      name: "Breadcrumbs.Link",
      part: "link",
      element: "a",
      description:
        'The crumb\'s link (`link-navigation`). The current item without `href` renders `<span aria-current tabindex="-1">` instead.',
    },
    {
      name: "Breadcrumbs.Separator",
      part: "separator",
      element: "span",
      description: "A glyph after the crumb, `aria-hidden`. No default content.",
    },
    {
      name: "Breadcrumbs.Ellipsis",
      part: "ellipsis",
      element: "li",
      description:
        "Only while items are collapsed. Its children function gets `{ items, label, count }`: render a Menu (or Popover) there.",
    },
  ],
  props: {
    maxItems: {
      type: "number",
      description: "Collapse the middle items past this many (Root).",
    },
    itemsBeforeCollapse: {
      type: "number",
      default: "1",
      description: "Items always shown before the collapsed range (Root).",
    },
    itemsAfterCollapse: {
      type: "number",
      default: "1",
      description: "Items always shown after the collapsed range (Root).",
    },
    currentValue: {
      type: '"page" | "location" | "date" | "time" | true',
      default: '"page"',
      description: "The current item's `aria-current` value (Root).",
    },
    items: {
      type: "readonly BreadcrumbsTrailItem[]",
      description:
        "The trail as data (Root): collapse is known while rendering, so the server render collapses too. Items still render with the same `value`s.",
    },
    messages: {
      type: "Partial<BreadcrumbsMessages>",
      description: "`label` and `showCollapsed(count)` (Root).",
    },
    "*.value": { type: "string", description: "The Item's key, stable across renders (Item)." },
    "*.current": {
      type: "boolean",
      description:
        "`true` makes the Item current; `false` on the last Item opts out of the default (Item).",
    },
    "*.disabled": {
      type: "boolean",
      default: "false",
      description: "Disables the Item's Link (Item).",
    },
    "*.textValue": {
      type: "string",
      description: "The Item's text in the ellipsis menu; default its Link's text (Item).",
    },
    "*.href": { type: "Href", description: "Where the crumb goes (Link)." },
    "*.routerOptions": {
      type: "RouterOptions",
      description: "Passed unchanged to the router's `navigate` (Link).",
    },
    "*.render": {
      type: "ReactElement | (props, state) => ReactNode",
      description: "Another element, on every part.",
    },
  },
  dataAttributes: {
    root: {
      "data-scope": '"breadcrumbs"',
      "data-part": '"root"',
      "data-instance": "The instance id.",
      "data-collapsed": "While items are collapsed.",
    },
    list: {
      "data-scope": '"breadcrumbs"',
      "data-part": '"list"',
      "data-instance": "The instance id.",
    },
    item: {
      "data-scope": '"breadcrumbs"',
      "data-part": '"item"',
      "data-instance": "The instance id.",
      "data-current": "On the current Item.",
      "data-disabled": "On a disabled Item.",
      "data-collapsed": "While collapsed (the Item is also `hidden`).",
    },
    link: {
      "data-scope": '"breadcrumbs"',
      "data-part": '"link"',
      "data-instance": "The instance id.",
      "data-current": "On the current item's link or text.",
    },
    separator: {
      "data-scope": '"breadcrumbs"',
      "data-part": '"separator"',
      "data-instance": "The instance id.",
      "data-last": "In the last visible Item: themes hide it.",
    },
    ellipsis: {
      "data-scope": '"breadcrumbs"',
      "data-part": '"ellipsis"',
      "data-instance": "The instance id.",
      "data-count": "The number of collapsed items.",
      "data-label": "Its trigger's accessible name (`messages.showCollapsed(count)`).",
    },
  },
  keyboard: [
    ["Tab", "Moves through the crumb links and the ellipsis trigger; the current text is skipped."],
    ["Enter", "Follows the focused link."],
  ],
  contract: {
    actions: {
      follow: ["pointer", "keyboard"],
      openCollapsed: ["pointer", "keyboard"],
      followCollapsed: ["pointer", "keyboard"],
    },
    queries: ["items", "current", "collapsedCount", "href"],
    traits: [],
  },
} as const satisfies ComponentMeta
