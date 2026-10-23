// The Drawer's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in drawer.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"drawer"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})

const stacking = {
  "data-nested": "Inside an open dialog, alert dialog or drawer.",
  "data-has-nested": "A dialog, alert dialog or drawer is open inside it.",
}

const button = {
  "data-focus": "While it has focus.",
  "data-focus-visible": "While it has focus and the last input was not a pointer or touch.",
  "data-pressed": "While it is pressed.",
}

const side = { "data-side": 'The physical side: "top", "bottom", "left" or "right".' }

export const drawerMeta = {
  scope: "drawer",
  name: "Drawer",
  stateless: false,
  parts: [
    {
      name: "Drawer.Root",
      part: "root",
      element: "none",
      description:
        "Renders no element: owns the open state, the side, the snap point and the layer. `actionsRef` exposes `open()` and `close()`.",
    },
    {
      name: "Drawer.Trigger",
      part: "trigger",
      element: "button",
      description:
        'Opens the drawer; toggles it when non-modal. `aria-haspopup="dialog"`, `aria-expanded` only on the trigger that opened it.',
    },
    {
      name: "Drawer.Portal",
      part: "portal",
      element: "none",
      description: "Optional: renders its children in the shared `Portal`.",
    },
    {
      name: "Drawer.Backdrop",
      part: "backdrop",
      element: "div",
      description:
        "`aria-hidden`; a press on it is an outside press. Fades with the swipe through `--rind-drawer-swipe-progress`. Renders nothing when non-modal.",
    },
    {
      name: "Drawer.Positioner",
      part: "positioner",
      element: "div",
      description:
        "Docks the content to the side; carries `--rind-drawer-keyboard-inset` (top and bottom). A press on it beside the content is an outside press.",
    },
    {
      name: "Drawer.Content",
      part: "content",
      element: "div",
      description:
        '`role="dialog"`, `tabindex="-1"`, `aria-modal` when modal, named by the title or `aria-label`. The swipe moves it through `--rind-drawer-swipe-x` / `-y`.',
    },
    {
      name: "Drawer.Title",
      part: "title",
      element: "h2",
      description: "`h{level}` (default 2); names the drawer while rendered.",
    },
    {
      name: "Drawer.Description",
      part: "description",
      element: "p",
      description: "Describes the drawer while rendered; optional.",
    },
    {
      name: "Drawer.CloseTrigger",
      part: "close-trigger",
      element: "button",
      description:
        "Closes the drawer; named by `messages.close` when it has no content of its own. The non-gesture way out.",
    },
    {
      name: "Drawer.Handle",
      part: "handle",
      element: "div",
      description:
        "The grip. A button with two or more snap points (each press moves to the next, named by `messages.expand` / `messages.collapse`), else decorative (`aria-hidden`). A swipe always starts from it.",
    },
    {
      name: "Drawer.Indent",
      part: "indent",
      element: "div",
      description:
        "Optional wrapper of the page: scales down while a modal drawer is open (`data-active`), following the swipe through `--rind-drawer-swipe-progress`.",
    },
    {
      name: "Drawer.IndentBackground",
      part: "indent-background",
      element: "div",
      description: "Optional: the surface shown around the indent (`data-active`).",
    },
  ],
  props: {
    open: { type: "boolean", description: "Controlled open state." },
    defaultOpen: { type: "boolean", default: "false", description: "Initial open state." },
    onOpenChange: {
      type: "(open: boolean, details: ChangeDetails) => void",
      description:
        "Every change request, with `details.reason` (`trigger`, `close-trigger`, `escape-key`, `outside-press`, `swipe`, `parent-dismissed`, `api`) and `details.cancel()`.",
    },
    side: {
      type: '"top" | "bottom" | "left" | "right" | "inline-start" | "inline-end"',
      default: '"bottom"',
      description: "The edge it docks to; logical sides resolve from the direction.",
    },
    modal: {
      type: "boolean",
      default: "true",
      description: "Modal: outside inert, scroll locked, Tab contained, `aria-modal`.",
    },
    closeOnEscape: { type: "boolean", default: "true", description: "Escape closes it." },
    closeOnInteractOutside: {
      type: "boolean",
      default: "modal",
      description: "A press outside closes it (the backdrop and positioner count as outside).",
    },
    closeOnSwipe: {
      type: "boolean",
      default: "true",
      description:
        "A swipe toward the edge can dismiss; `false` keeps the gesture for snap points.",
    },
    swipeThreshold: {
      type: "number",
      default: "0.5",
      description: "Fraction of the content's size a release must reach to dismiss.",
    },
    swipeVelocityThreshold: {
      type: "number",
      default: "0.5",
      description: "Speed (px/ms) toward the edge that dismisses regardless of distance.",
    },
    snapPoints: {
      type: "(number | string)[]",
      description:
        "Resting sizes: a fraction of the viewport (0 to 1) or a length in `px` / `rem`. Two or more make the handle a button.",
    },
    snapPoint: { type: "number | string", description: "Controlled snap point." },
    defaultSnapPoint: {
      type: "number | string",
      default: "first snap point",
      description: "Initial snap point.",
    },
    onSnapPointChange: {
      type: "(value, details: ChangeDetails) => void",
      description: "Every snap point change request.",
    },
    snapToSequentialPoints: {
      type: "boolean",
      default: "false",
      description: "A release moves at most to the neighbouring snap point.",
    },
    initialFocus: {
      type: '"content" | "title" | (() => element | null) | null | false',
      default: "null",
      description:
        "Where focus goes on open: the overlay's rule (`data-autofocus`, first tabbable, content on touch), a part, a function, or nowhere (`false`).",
    },
    finalFocus: {
      type: "((reason) => element | null) | null | false",
      default: "null",
      description: "Where focus goes on close: the opener (`null`), a function, or nowhere.",
    },
    onEscapeKeyDown: {
      type: "(event) => void",
      description: "`event.preventDefault()` vetoes the Escape dismissal.",
    },
    onInteractOutside: {
      type: "(event) => void",
      description: "`event.preventDefault()` vetoes the outside-press dismissal.",
    },
    keepMounted: {
      type: "boolean",
      default: "false",
      description: "Content, backdrop and positioner stay mounted (hidden) while closed.",
    },
    messages: {
      type: "{ close?: string; expand?: string; collapse?: string }",
      default: '{ close: "Close", expand: "Expand drawer", collapse: "Collapse drawer" }',
      description: "The names of a close trigger with no content and of the handle button.",
    },
    actionsRef: {
      type: "Ref<{ open(): void; close(): void }>",
      description: "Programmatic open and close (reason `api`).",
    },
    "*.level": {
      type: "1 | 2 | 3 | 4 | 5 | 6",
      default: "2",
      description: "On `Drawer.Title`: its heading level.",
    },
    "*.render": {
      type: "RenderProp",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    trigger: {
      ...base("trigger"),
      "data-state": '"open" on the trigger that opened the open drawer, else "closed".',
      "data-close-reason": "The last close reason in kebab case, after close.",
      ...button,
      "data-disabled": "While disabled.",
    },
    backdrop: {
      ...base("backdrop"),
      "data-state": '"open" or "closed".',
      "data-swiping": "While the content is dragged.",
      ...stacking,
    },
    positioner: {
      ...base("positioner"),
      "data-state": '"open" or "closed".',
      "data-modal": "While modal.",
      ...side,
      ...stacking,
    },
    content: {
      ...base("content"),
      "data-state": '"open" or "closed" (while it exits).',
      "data-modal": "While modal.",
      "data-close-reason": "The last close reason in kebab case (`swipe`), until the next open.",
      "data-focus-within": "While focus is inside it.",
      "data-focus": "While the content itself has focus.",
      "data-focus-visible":
        "While the content itself has focus and the last input was not a pointer.",
      ...side,
      "data-swiping": "While it is dragged.",
      "data-swipe-dismiss": "From a dismissing release until the next open.",
      "data-expanded": "At the largest snap point (always without snap points).",
      "data-snap-point": "The index of the current snap point (with snap points).",
      "data-nested-swiping": "A drawer inside it is being dragged.",
      ...stacking,
    },
    title: { ...base("title"), "data-level": "The heading level." },
    description: base("description"),
    "close-trigger": {
      ...base("close-trigger"),
      "data-focus": button["data-focus"],
      "data-focus-visible": button["data-focus-visible"],
      "data-pressed": button["data-pressed"],
    },
    handle: {
      ...base("handle"),
      "data-snap-point": "The index of the current snap point (with snap points).",
      ...button,
    },
    indent: {
      "data-scope": '"drawer"',
      "data-part": '"indent"',
      "data-active": "While a modal drawer is open.",
    },
    "indent-background": {
      "data-scope": '"drawer"',
      "data-part": '"indent-background"',
      "data-active": "While a modal drawer is open.",
    },
  },
  keyboard: [
    ["Enter / Space on the trigger", "Opens the drawer (closes it when non-modal and open)."],
    ["Enter / Space on a close trigger", "Closes the drawer."],
    [
      "Enter / Space on the handle",
      "With snap points: moves to the next one (the last wraps to the first).",
    ],
    ["Escape", "Closes the topmost drawer (`closeOnEscape`)."],
    ["Tab / Shift+Tab", "Moves through the tabbable elements; wraps at the edges while modal."],
  ],
  states: {
    closed: "Nothing is mounted (unless `keepMounted`); no layer, lock or inert.",
    open: "A layer of kind `drawer`: focus moved in, outside inert and scroll locked when modal.",
  },
  contract: {
    actions: {
      open: ["pointer", "touch", "keyboard", "virtual"],
      close: ["pointer", "touch", "keyboard", "virtual"],
      pressEscape: ["keyboard"],
      pressOutside: ["pointer", "virtual"],
      tab: ["keyboard"],
      shiftTab: ["keyboard"],
      waitForUnmount: ["keyboard"],
      swipe: ["pointer", "touch", "virtual"],
      pressHandle: ["pointer", "touch", "keyboard", "virtual"],
    },
    queries: [
      "isOpen",
      "isModal",
      "title",
      "description",
      "hasFocus",
      "isTopmost",
      "closeReason",
      "snapPoint",
      "side",
      "isSwiping",
    ],
    traits: ["layer", "restores-focus", "presence", "modal"],
  },
} as const satisfies ComponentMeta
