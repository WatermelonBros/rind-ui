// The Tooltip's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in tooltip.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"tooltip"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})

const placement = {
  "data-side": "The physical side it is placed on (`top`, `right`, `bottom`, `left`).",
  "data-anchor-hidden": "While the anchor is scrolled out of view.",
  "data-placing": "Until the first placement of an open.",
}

const instant = {
  "data-instant":
    "While it opened or closed through the delay group: no delay, no animation (style it without a transition).",
}

export const tooltipMeta = {
  scope: "tooltip",
  name: "Tooltip",
  stateless: false,
  parts: [
    {
      name: "Tooltip.Root",
      part: "root",
      element: "none",
      description:
        "Renders no element: owns the open state, the delays, the delay group and positioning. `actionsRef` exposes `open()` and `close()`.",
    },
    {
      name: "Tooltip.Trigger",
      part: "trigger",
      element: "button",
      description:
        'The element the tooltip describes (or labels). `aria-describedby` (`type="description"`) or `aria-labelledby` (`type="label"`) point at the content as soon as it is mounted, open or not; your own references are kept first.',
    },
    {
      name: "Tooltip.Portal",
      part: "portal",
      element: "none",
      description: "Optional: renders its children in the shared `Portal`.",
    },
    {
      name: "Tooltip.Positioner",
      part: "positioner",
      element: "div",
      description: "Holds the coordinates written by positioning.",
    },
    {
      name: "Tooltip.Content",
      part: "content",
      element: "div",
      description:
        '`role="tooltip"` for a description. Always mounted: `hidden` while closed so it is still referenced. Never focusable.',
    },
    {
      name: "Tooltip.Arrow",
      part: "arrow",
      element: "div",
      description: "Decorative (`aria-hidden`) arrow pointing at the trigger.",
    },
  ],
  props: {
    open: { type: "boolean", description: "Controlled open state." },
    defaultOpen: { type: "boolean", default: "false", description: "Initial open state." },
    onOpenChange: {
      type: "(open: boolean, details: TooltipChangeDetails) => void",
      description:
        "Every change request, with `details.reason` (`hover`, `focus`, `api`, `pointer-leave`, `blur`, `escape-key`, `outside-press`, `trigger-press`, `group`, `disabled`) and `details.cancel()`.",
    },
    openDelay: {
      type: "number",
      default: "700",
      description: "Milliseconds the pointer rests on the trigger before it opens.",
    },
    closeDelay: {
      type: "number",
      default: "300",
      description: "Milliseconds after the pointer leaves the hover zone before it closes.",
    },
    skipDelay: {
      type: "number",
      default: "300",
      description:
        "Milliseconds after it closes during which a neighbouring tooltip opens at once (the delay group); 0 turns it off.",
    },
    closeOnPress: {
      type: "boolean",
      default: "true",
      description: "Pressing the trigger closes it.",
    },
    disabled: {
      type: "boolean",
      default: "false",
      description: "Never opens; setting it closes an open tooltip.",
    },
    type: {
      type: '"description" | "label"',
      default: '"description"',
      description:
        '`description`: the content describes the trigger (`role="tooltip"`, `aria-describedby`). `label`: it names the trigger (`aria-labelledby`), for icon-only controls.',
    },
    positioning: {
      type: "PositioningProps",
      default: "popup preset, side top, sideOffset 8",
      description:
        "Side, align, offsets, flip, shift, size, arrow and mode (`manual` for CSS anchor positioning).",
    },
    actionsRef: {
      type: "Ref<{ open(): void; close(): void }>",
      description: "Programmatic open and close.",
    },
    "*.render": {
      type: "element | (props, state) => element",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    trigger: {
      ...base("trigger"),
      "data-state": '"open" or "closed".',
      "data-hover": "While the pointer is on it.",
      "data-focus": "While it has focus.",
      "data-focus-visible": "While it has focus and the last input was not a pointer or touch.",
    },
    positioner: {
      ...base("positioner"),
      "data-state": '"open" or "closed".',
      ...placement,
      "data-align": "The alignment on that side (`start`, `center`, `end`).",
      ...instant,
      "data-rind-top-layer":
        "Always: keeps the (closed) description exposed while its trigger is inside a modal layer.",
    },
    content: {
      ...base("content"),
      "data-state": '"open" or "closed" (while it exits).',
      "data-type": '"description" or "label".',
      ...placement,
      "data-align": "The alignment on that side (`start`, `center`, `end`).",
      ...instant,
    },
    arrow: {
      ...base("arrow"),
      "data-side": placement["data-side"],
      "data-anchor-hidden": placement["data-anchor-hidden"],
    },
  },
  keyboard: [
    ["Tab onto the trigger", "Opens it at once (keyboard focus); Tab away closes it."],
    ["Escape", "Closes it; focus stays on the trigger."],
    [
      "Enter / Space on the trigger",
      "Presses the trigger and closes the tooltip (`closeOnPress`).",
    ],
  ],
  states: {
    closed: "Content hidden, still referenced by the trigger.",
    opening: "The pointer rests on the trigger; the open delay is running.",
    open: "A layer of kind `tooltip`: placed against the trigger.",
    closing: "The pointer left the hover zone; the close delay is running (still shown).",
  },
  contract: {
    actions: {
      show: ["pointer", "keyboard"],
      hide: ["pointer", "keyboard"],
      hoverTrigger: ["pointer"],
      hoverContent: ["pointer"],
      pressTrigger: ["pointer", "touch", "keyboard"],
      pressEscape: ["keyboard"],
    },
    queries: [
      "side",
      "align",
      "isAnchorHidden",
      "isPlaced",
      "isOpen",
      "text",
      "description",
      "label",
      "isInstant",
    ],
    traits: ["layer", "anchored", "timed"],
  },
} as const satisfies ComponentMeta
