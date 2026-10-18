// The Hover Card's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in hover-card.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"hover-card"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})

const placement = {
  "data-side": "The physical side it is placed on (`top`, `right`, `bottom`, `left`).",
  "data-anchor-hidden": "While the anchor is scrolled out of view.",
  "data-placing": "Until the first placement of an open.",
}

export const hoverCardMeta = {
  scope: "hover-card",
  name: "Hover Card",
  stateless: false,
  parts: [
    {
      name: "HoverCard.Root",
      part: "root",
      element: "none",
      description:
        "Renders no element: owns the open state, the delays, the layer and positioning. `actionsRef` exposes `open()` and `close()`.",
    },
    {
      name: "HoverCard.Trigger",
      part: "trigger",
      element: "a",
      description:
        'The link that is previewed: keeps its role and `href`, never prevents default. `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls` while the content is mounted.',
    },
    {
      name: "HoverCard.Portal",
      part: "portal",
      element: "none",
      description: "Optional: renders its children in the shared `Portal`.",
    },
    {
      name: "HoverCard.Positioner",
      part: "positioner",
      element: "div",
      description:
        "Holds the coordinates written by positioning; stays mounted while the content exits.",
    },
    {
      name: "HoverCard.Content",
      part: "content",
      element: "div",
      description:
        '`role="dialog"`, `tabindex="-1"`, no `aria-modal`; named by the consumer, else by the trigger. Takes no focus on open.',
    },
    {
      name: "HoverCard.Arrow",
      part: "arrow",
      element: "div",
      description: "Decorative (`aria-hidden`) arrow pointing at the trigger.",
    },
  ],
  props: {
    open: { type: "boolean", description: "Controlled open state." },
    defaultOpen: { type: "boolean", default: "false", description: "Initial open state." },
    onOpenChange: {
      type: "(open: boolean, details: HoverCardChangeDetails) => void",
      description:
        "Every change request, with `details.reason` (opening: `hover`, `focus`, `api`; closing: `pointer-leave`, `blur`, `escape-key`, `outside-press`, `outside-focus`, `parent-dismissed`, `disabled`, `api`) and `details.cancel()`.",
    },
    openDelay: {
      type: "number",
      default: "700",
      description:
        "Milliseconds the pointer rests on the trigger, or a keyboard focus stays, before it opens.",
    },
    closeDelay: {
      type: "number",
      default: "300",
      description: "Milliseconds after the pointer or focus leaves before it closes.",
    },
    disabled: {
      type: "boolean",
      default: "false",
      description: "It never opens; setting it closes an open card.",
    },
    positioning: {
      type: "PositioningProps",
      default: "popup preset, bottom, sideOffset 8, collisionPadding 8",
      description:
        "Side, align, offsets, flip, shift, size, arrow and mode (`manual` for CSS anchor positioning).",
    },
    keepMounted: {
      type: "boolean",
      default: "false",
      description: "Positioner and content stay mounted (hidden) while closed.",
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
      "data-hover": "While a mouse or pen pointer is over it.",
      "data-focus": "While it has focus.",
      "data-focus-visible": "While it has focus and the last input was not a pointer or touch.",
    },
    positioner: {
      ...base("positioner"),
      "data-state": '"open" or "closed".',
      ...placement,
      "data-align": "The alignment on that side (`start`, `center`, `end`).",
    },
    content: {
      ...base("content"),
      "data-state": '"open" or "closed" (while it exits).',
      "data-close-reason":
        "The last close reason in kebab case (`escape-key`), until the next open.",
      "data-focus-within": "While focus is inside it.",
      "data-nested": "Inside another open layer.",
      "data-has-nested": "A layer is open inside it.",
      ...placement,
      "data-align": "The alignment on that side (`start`, `center`, `end`).",
    },
    arrow: {
      ...base("arrow"),
      "data-side": placement["data-side"],
      "data-anchor-hidden": placement["data-anchor-hidden"],
    },
  },
  keyboard: [
    ["Tab onto the trigger", "Opens the card after `openDelay`."],
    [
      "Tab",
      "From the trigger, enters the card; past its last control, continues after the trigger.",
    ],
    ["Shift+Tab", "From the card's first control, returns to the trigger."],
    ["Escape", "Closes the topmost layer."],
  ],
  states: {
    closed: "Nothing is mounted (unless `keepMounted`); no layer.",
    opening: "The open delay is running; nothing is shown yet.",
    open: "A layer of kind `popover`: placed against the trigger; focus is not moved.",
    closing: "The close delay is running; the card is still shown and re-entering cancels it.",
  },
  contract: {
    actions: {
      show: ["pointer", "keyboard", "virtual"],
      hoverTrigger: ["pointer", "keyboard", "virtual"],
      hide: ["pointer", "keyboard", "virtual"],
      enter: ["keyboard"],
      pressEscape: ["keyboard"],
      pressOutside: ["pointer", "virtual"],
      tab: ["keyboard"],
      shiftTab: ["keyboard"],
      waitForUnmount: ["keyboard"],
    },
    queries: [
      "side",
      "align",
      "isAnchorHidden",
      "isPlaced",
      "isOpen",
      "hasFocus",
      "isTopmost",
      "closeReason",
    ],
    traits: ["layer", "restores-focus", "presence", "anchored", "timed"],
  },
} as const satisfies ComponentMeta
