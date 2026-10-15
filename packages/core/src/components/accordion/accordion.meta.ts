// The Accordion's API facts for the generated docs (scripts/docs-gen.ts). Data only;
// checked against the code in accordion.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"accordion"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-orientation": '"vertical" or "horizontal".',
})
const state = '"open" or "closed", in every state.'

export const accordionMeta = {
  scope: "accordion",
  name: "Accordion",
  stateless: false,
  parts: [
    { name: "Accordion.Root", part: "root", element: "div", description: "Owns the open items." },
    { name: "Accordion.Item", part: "item", element: "div", description: "One section." },
    {
      name: "Accordion.Header",
      part: "header",
      element: "h3",
      description:
        'The heading around the trigger; the level is `headingLevel`, else the surrounding `Heading.Level`, else 3. A substituted element gets `role="heading"` and `aria-level`.',
    },
    {
      name: "Accordion.Trigger",
      part: "trigger",
      element: "button",
      description:
        'The disclosure button (`type="button"`), the header\'s only element child. The open trigger of a non-collapsible single accordion is `aria-disabled`.',
    },
    {
      name: "Accordion.Content",
      part: "content",
      element: "div",
      description:
        'The panel; `role="region"` labelled by its trigger while open, per the region rule. Carries `--rind-accordion-content-height` and `--rind-accordion-content-width`.',
    },
    {
      name: "Accordion.Indicator",
      part: "indicator",
      element: "span",
      description: 'A decorative chevron or icon slot; `aria-hidden="true"`.',
    },
  ],
  props: {
    value: { type: "string[]", description: "Controlled open items." },
    defaultValue: { type: "string[]", default: "[]", description: "Uncontrolled initial items." },
    onValueChange: {
      type: "(value, { event }) => void",
      description:
        "Every user-caused change, with its event. Not called when the parent changes `value`.",
    },
    multiple: { type: "boolean", default: "false", description: "Several items open at once." },
    collapsible: {
      type: "boolean",
      default: "true",
      description: "Single mode: the open item can be closed. Ignored when `multiple`.",
    },
    disabled: { type: "boolean", default: "false", description: "Disables every item." },
    focusableWhenDisabled: {
      type: "boolean",
      default: "false",
      description:
        "Disabled triggers stay focusable: `aria-disabled` instead of native `disabled`.",
    },
    keyboardNavigation: {
      type: "boolean",
      default: "false",
      description: "Arrow keys, Home and End move focus between triggers.",
    },
    orientation: {
      type: '"vertical" | "horizontal"',
      default: '"vertical"',
      description: "The axis of the arrow navigation.",
    },
    dir: { type: '"ltr" | "rtl"', default: '"ltr"', description: "Mirrors horizontal arrows." },
    headingLevel: {
      type: "2 | 3 | 4 | 5 | 6",
      description: "The headers' level; default the surrounding `Heading.Level`, else 3.",
    },
    closedContent: {
      type: '"until-found" | "hidden" | "unmount"',
      default: '"until-found"',
      description: "How closed, settled content is kept; an item can override it.",
    },
    contentRole: {
      type: '"region" | "none"',
      description: "Overrides the region rule (region unless `multiple` with more than six items).",
    },

    "item.value": { type: "string", description: "The item's non-empty, unique value." },
    "item.disabled": { type: "boolean", default: "false", description: "Disables this item." },
    "item.closedContent": {
      type: '"until-found" | "hidden" | "unmount"',
      description: "Overrides the root's `closedContent` for this item.",
    },
  },
  dataAttributes: {
    root: { ...base("root"), "data-disabled": "While the root is disabled." },
    item: { ...base("item"), "data-state": state, "data-disabled": "While the item is disabled." },
    header: {
      ...base("header"),
      "data-state": state,
      "data-disabled": "While the item is disabled.",
    },
    trigger: {
      ...base("trigger"),
      "data-state": state,
      "data-disabled": "While disabled, or locked (the open item of a non-collapsible accordion).",
      "data-focus": "Focused.",
      "data-focus-visible": "Keyboard focus.",
      "data-pressed": "While pressed.",
      "data-hover": "While hovered.",
    },
    content: {
      ...base("content"),
      "data-state": state,
      "data-disabled": "While the item is disabled.",
      "data-reveal":
        '"mount" from the first render, or "find-in-page" after a search reveal, until the next transition.',
    },
    indicator: {
      ...base("indicator"),
      "data-state": state,
      "data-disabled": "While the item is disabled.",
    },
  },
  keyboard: [
    ["Enter, Space", "On a trigger: toggles its item. Key repeats are ignored."],
    [
      "ArrowDown, ArrowUp",
      "With `keyboardNavigation`, vertical: next or previous trigger, wrapping.",
    ],
    [
      "ArrowRight, ArrowLeft",
      "With `keyboardNavigation`, horizontal: next or previous trigger, mirrored in rtl.",
    ],
    ["Home, End", "With `keyboardNavigation`: first or last trigger."],
  ],
  states: {
    idle: "The only state: the open items are the value; edges are internal.",
  },
  contract: {
    actions: {
      expand: ["pointer", "keyboard", "virtual"],
      collapse: ["pointer", "keyboard", "virtual"],
      toggle: ["pointer", "keyboard", "virtual"],
      focusNext: ["keyboard"],
      focusPrev: ["keyboard"],
      focusFirst: ["keyboard"],
      focusLast: ["keyboard"],
    },
    queries: ["expanded", "items", "isDisabled", "contentText"],
    traits: ["disclosure", "presence", "directional"],
  },
} as const satisfies ComponentMeta
