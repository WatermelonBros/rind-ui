// The Popover's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in popover.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"popover"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})

const button = {
  "data-focus": "While it has focus.",
  "data-focus-visible": "While it has focus and the last input was not a pointer or touch.",
  "data-pressed": "While it is pressed.",
}

const placement = {
  "data-side": "The physical side it is placed on (`top`, `right`, `bottom`, `left`).",
  "data-anchor-hidden": "While the anchor is scrolled out of view.",
  "data-placing": "Until the first placement of an open.",
}

export const popoverMeta = {
  scope: "popover",
  name: "Popover",
  stateless: false,
  parts: [
    {
      name: "Popover.Root",
      part: "root",
      element: "none",
      description:
        "Renders no element: owns the open state, the layer, positioning and the focus rules. `actionsRef` exposes `open()`, `close()` and `reposition()`.",
    },
    {
      name: "Popover.Trigger",
      part: "trigger",
      element: "button",
      description:
        'Toggles the popover and anchors it unless an `Anchor` is rendered. `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls` while the content is mounted.',
    },
    {
      name: "Popover.Anchor",
      part: "anchor",
      element: "div",
      description: "Optional: positions the content against this element instead of the trigger.",
    },
    {
      name: "Popover.Indicator",
      part: "indicator",
      element: "span",
      description: "Decorative (`aria-hidden`) element carrying `data-state`, e.g. a chevron.",
    },
    {
      name: "Popover.Portal",
      part: "portal",
      element: "none",
      description: "Optional: renders its children in the shared `Portal`.",
    },
    {
      name: "Popover.Positioner",
      part: "positioner",
      element: "div",
      description:
        "Holds the coordinates written by positioning; stays mounted while the content exits.",
    },
    {
      name: "Popover.Content",
      part: "content",
      element: "div",
      description:
        '`role="dialog"`, `tabindex="-1"`, `aria-modal` when modal; named by the title, the consumer, or (non-modal) the trigger. Wraps its children in a heading level one below the title.',
    },
    {
      name: "Popover.Arrow",
      part: "arrow",
      element: "div",
      description: "Decorative (`aria-hidden`) arrow pointing at the anchor.",
    },
    {
      name: "Popover.Title",
      part: "title",
      element: "h2",
      description: "`h{level}` (default 2); names the popover while rendered.",
    },
    {
      name: "Popover.Description",
      part: "description",
      element: "p",
      description: "Describes the popover while rendered; optional.",
    },
    {
      name: "Popover.CloseTrigger",
      part: "close-trigger",
      element: "button",
      description:
        "Closes the popover; named by `messages.close` when it has no content of its own.",
    },
  ],
  props: {
    open: { type: "boolean", description: "Controlled open state." },
    defaultOpen: { type: "boolean", default: "false", description: "Initial open state." },
    onOpenChange: {
      type: "(open: boolean, details: ChangeDetails) => void",
      description:
        "Every change request, with `details.reason` (`trigger`, `close-trigger`, `escape-key`, `outside-press`, `outside-focus`, `parent-dismissed`, `open`, `api`) and `details.cancel()`.",
    },
    modal: {
      type: "boolean",
      default: "false",
      description: "Modal: outside inert, scroll locked, Tab contained, `aria-modal`.",
    },
    disabled: {
      type: "boolean",
      default: "false",
      description: "The trigger is inert; setting it closes an open popover.",
    },
    closeOnEscape: { type: "boolean", default: "true", description: "Escape closes it." },
    closeOnInteractOutside: {
      type: "boolean",
      default: "true",
      description: "A press outside closes it.",
    },
    onEscapeKeyDown: {
      type: "(event) => void",
      description: "`event.preventDefault()` vetoes the Escape dismissal.",
    },
    onInteractOutside: {
      type: "(event) => void",
      description: "`event.preventDefault()` vetoes the outside-press and outside-focus dismissal.",
    },
    persistentElements: {
      type: "() => Element[]",
      description: "Elements whose presses and focus count as inside (a toast region).",
    },
    initialFocus: {
      type: "(() => element | null) | null",
      default: "null",
      description:
        "Where focus goes once the popover is placed: a function, or the overlay's rule (`data-autofocus`, first tabbable, content on touch).",
    },
    finalFocus: {
      type: "((reason) => element | null) | null | false",
      default: "null",
      description: "Where focus goes on close: the trigger (`null`), a function, or nowhere.",
    },
    positioning: {
      type: "PositioningProps",
      default: "popup preset, sideOffset 8",
      description:
        "Side, align, offsets, flip, shift, size, arrow and mode (`manual` for CSS anchor positioning).",
    },
    keepMounted: {
      type: "boolean",
      default: "false",
      description: "Positioner and content stay mounted (hidden) while closed.",
    },
    messages: {
      type: "{ close?: string }",
      default: '{ close: "Close" }',
      description: "The name of a close trigger with no content of its own.",
    },
    actionsRef: {
      type: "Ref<{ open(): void; close(): void; reposition(): void }>",
      description: "Programmatic open, close and a forced reposition.",
    },
    level: {
      type: "1 | 2 | 3 | 4 | 5 | 6",
      default: "2",
      description: "On `Popover.Title`: its heading level; headings in the content are one deeper.",
    },
    render: {
      type: "element | (props, state) => element",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    trigger: {
      ...base("trigger"),
      "data-state": '"open" or "closed".',
      ...button,
      "data-disabled": "While disabled.",
    },
    anchor: base("anchor"),
    indicator: { ...base("indicator"), "data-state": '"open" or "closed".' },
    positioner: {
      ...base("positioner"),
      "data-state": '"open" or "closed".',
      ...placement,
      "data-align": "The alignment on that side (`start`, `center`, `end`).",
    },
    content: {
      ...base("content"),
      "data-state": '"open" or "closed" (while it exits).',
      "data-modal": "While modal.",
      "data-close-reason":
        "The last close reason in kebab case (`escape-key`), until the next open.",
      "data-focus-within": "While focus is inside it.",
      "data-focus": "While the content itself has focus.",
      "data-focus-visible":
        "While the content itself has focus and the last input was not a pointer.",
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
    title: { ...base("title"), "data-level": "The heading level." },
    description: base("description"),
    "close-trigger": {
      ...base("close-trigger"),
      ...button,
    },
  },
  keyboard: [
    ["Enter / Space on the trigger", "Toggles the popover."],
    ["Enter / Space on a close trigger", "Closes the popover."],
    ["Escape", "Closes the topmost layer (`closeOnEscape`)."],
    [
      "Tab / Shift+Tab",
      "Non-modal: the content sits right after its trigger in the Tab order, wherever it is rendered. Modal: wraps inside the content.",
    ],
  ],
  states: {
    closed: "Nothing is mounted (unless `keepMounted`); no layer, lock or inert.",
    open: "A layer of kind `popover`: placed against the anchor, focus moved in after the first placement.",
  },
  contract: {
    actions: {
      open: ["pointer", "touch", "keyboard", "virtual"],
      close: ["pointer", "touch", "keyboard", "virtual"],
      toggle: ["pointer", "touch", "keyboard", "virtual"],
      closeWithButton: ["pointer", "touch", "keyboard", "virtual"],
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
      "isModal",
      "title",
      "description",
      "hasFocus",
      "isTopmost",
      "closeReason",
    ],
    traits: ["layer", "restores-focus", "presence", "anchored"],
  },
} as const satisfies ComponentMeta
