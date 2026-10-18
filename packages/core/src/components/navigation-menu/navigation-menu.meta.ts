// The Navigation Menu's API facts for the generated docs (scripts/docs-gen.ts). Data only;
// checked against the code in navigation-menu.meta.test.ts.

import type { ComponentMeta } from "../meta"

export const navigationMenuMeta = {
  scope: "navigation-menu",
  name: "Navigation Menu",
  stateless: false,
  parts: [
    {
      name: "NavigationMenu.Root",
      part: "root",
      element: "nav",
      description:
        'The `navigation` landmark, named "Main" (`messages.label`) unless `aria-label` or `aria-labelledby` is given; one open-item `value` per level.',
    },
    {
      name: "NavigationMenu.List",
      part: "list",
      element: "ul",
      description: "The level's items. No `aria-orientation`: orientation is `data-orientation`.",
    },
    {
      name: "NavigationMenu.Item",
      part: "item",
      element: "li",
      description:
        "One item: a `Link` alone, a `Trigger` with its `Content`, or a split item (`Link` and `Trigger`). `value` is its key.",
    },
    {
      name: "NavigationMenu.Trigger",
      part: "trigger",
      element: "button",
      description:
        "A disclosure button: `aria-expanded`, `aria-controls` while its content is mounted, no `aria-haspopup`. Toggles on press; opens on hover with `openOnHover`.",
    },
    {
      name: "NavigationMenu.Content",
      part: "content",
      element: "div",
      description:
        "The item's panel, no role. Rendered in place, or inside the level's `Viewport` when one is rendered. Closed: `hidden` (default) or unmounted.",
    },
    {
      name: "NavigationMenu.Link",
      part: "link",
      element: "a",
      description:
        "A Link (link-navigation): `current` sets `aria-current`; a same-tab activation closes every open level.",
    },
    {
      name: "NavigationMenu.Indicator",
      part: "indicator",
      element: "div",
      description: "Decorative, inside `List`: the open trigger's box as `--rind-indicator-*`.",
    },
    {
      name: "NavigationMenu.Viewport",
      part: "viewport",
      element: "div",
      description:
        "Optional shared panel the open content renders into, sized by `--rind-navigation-menu-viewport-width` / `-height`.",
    },
    {
      name: "NavigationMenu.Positioner",
      part: "positioner",
      element: "div",
      description:
        "Optional: places the `Viewport` (or a `Content`) next to the open trigger (`anchor=\"list\"`: the list).",
    },
    {
      name: "NavigationMenu.Sub",
      part: "sub",
      element: "div",
      description:
        "A nested level inside a `Content`: its own `List`, items and `value`; not a landmark.",
    },
  ],
  props: {
    value: {
      type: "string | null",
      description: "The open item's `value` (controlled); `null` when none is open.",
    },
    defaultValue: { type: "string | null", default: "null", description: "Uncontrolled value." },
    onValueChange: {
      type: "(value, details) => void",
      description:
        "`details.reason`: trigger-press, trigger-key, trigger-hover, pointer-leave, escape-key, outside-press, outside-focus, link-activate, parent-close or api.",
    },
    openOnHover: {
      type: "boolean",
      default: "true",
      description: "A mouse or pen resting on a trigger opens it; press and keys always work.",
    },
    openDelay: { type: "number", default: "200", description: "Hover time before opening (ms)." },
    closeDelay: {
      type: "number",
      default: "300",
      description: "Time before a hover-opened panel closes after the pointer left (ms).",
    },
    skipDelay: {
      type: "number",
      default: "300",
      description: "After a close, hovering a trigger within this time opens with no delay (ms).",
    },
    patientClick: {
      type: "number",
      default: "500",
      description: "A press this soon after a hover open keeps the panel open (ms).",
    },
    orientation: {
      type: '"horizontal" | "vertical"',
      default: '"horizontal"',
      description: "Which arrows move along the bar and which one enters an open panel.",
    },
    closedContent: {
      type: '"hidden" | "unmount"',
      default: '"hidden"',
      description:
        "Closed panels stay in the document with `hidden` (their links are crawlable and indexed), or are removed after their exit animation.",
    },
    disabled: { type: "boolean", default: "false", description: "Disables every trigger." },
    messages: {
      type: "{ label?: string }",
      description: 'The landmark\'s default name ("Main").',
    },
    render: {
      type: "element | (props, state) => element",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: {
      "data-orientation": '"horizontal" or "vertical".',
      "data-state": '"open" while an item of the root level is open, else "closed".',
    },
    item: { "data-state": '"open" or "closed".', "data-value": "The item's key." },
    trigger: {
      "data-state": '"open" or "closed".',
      "data-current": "Its panel holds the current page's link.",
      "data-disabled": "While disabled.",
      "data-hover": "While a mouse or pen is over it.",
      "data-pressed": "While pressed.",
      "data-focus-visible": "Keyboard focus.",
    },
    content: {
      "data-state": '"open" or "closed", in every mode.',
      "data-motion":
        '"from-start", "from-end", "to-start" or "to-end" after a switch between items (logical: mirrored in RTL).',
      "data-value": "The item's key.",
    },
    viewport: {
      "data-state": '"open" or "closed".',
      "data-instant": "The open skipped the open delay (a switch or a warm open).",
    },
    indicator: { "data-state": '"visible" or "hidden".' },
  },
  keyboard: [
    ["Tab / Shift+Tab", "Every top-level trigger and link is a tab stop; an open panel follows its trigger."],
    ["Enter / Space", "On a trigger: toggles its panel; focus stays."],
    ["Escape", "Closes the innermost open panel; focus returns to its trigger if it was inside."],
    [
      "ArrowRight / ArrowLeft",
      "In a horizontal bar: next / previous trigger or link, no wrap (mirrored in RTL).",
    ],
    ["ArrowDown", "On an open trigger of a horizontal bar: its panel's first link."],
    ["ArrowDown / ArrowUp", "In a panel: next / previous link or nested trigger."],
    ["Home / End", "First / last item of the same set."],
  ],
  states: {
    closed: "No item is open.",
    warm: "Just closed: hovering a trigger opens it with no delay.",
    opening: "A trigger is hovered: its open delay runs.",
    open: "One item is open.",
    closing: "The pointer left a hover-opened panel: its close delay runs.",
  },
  contract: {
    actions: {
      open: ["pointer", "keyboard", "virtual"],
      close: ["pointer", "keyboard", "virtual"],
      toggle: ["pointer", "touch", "keyboard", "virtual"],
      hover: ["pointer", "keyboard", "virtual"],
      hoverTrigger: ["pointer", "virtual"],
      followLink: ["pointer", "keyboard", "virtual"],
      pressEscape: ["keyboard"],
      pressOutside: ["pointer", "virtual"],
      enterContent: ["keyboard"],
    },
    queries: ["openItem", "isOpen", "links", "currentLink", "contentText"],
    traits: ["layer", "presence", "timed"],
  },
} as const satisfies ComponentMeta
