// The Dialog's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in dialog.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"dialog"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})

const stacking = {
  "data-nested": "Inside an open dialog or alert dialog.",
  "data-has-nested": "A dialog or alert dialog is open inside it.",
}

const button = {
  "data-focus": "While it has focus.",
  "data-focus-visible": "While it has focus and the last input was not a pointer or touch.",
  "data-pressed": "While it is pressed.",
}

export const dialogMeta = {
  scope: "dialog",
  name: "Dialog",
  stateless: false,
  parts: [
    {
      name: "Dialog.Root",
      part: "root",
      element: "none",
      description:
        "Renders no element: owns the open state, the layer and the focus rules. `actionsRef` exposes `open()` and `close()`.",
    },
    {
      name: "Dialog.Trigger",
      part: "trigger",
      element: "button",
      description:
        'Opens the dialog; toggles it when non-modal. `aria-haspopup="dialog"`, `aria-expanded` only on the trigger that opened it.',
    },
    {
      name: "Dialog.Portal",
      part: "portal",
      element: "none",
      description: "Optional: renders its children in the shared `Portal`.",
    },
    {
      name: "Dialog.Backdrop",
      part: "backdrop",
      element: "div",
      description:
        "`aria-hidden`; a press on it is an outside press. Renders nothing when non-modal.",
    },
    {
      name: "Dialog.Positioner",
      part: "positioner",
      element: "div",
      description:
        "Optional scroll container around the content; a press on it beside the content is an outside press. Lets pointer events through when non-modal.",
    },
    {
      name: "Dialog.Content",
      part: "content",
      element: "div",
      description:
        '`role="dialog"`, `tabindex="-1"`, `aria-modal` when modal, named by the title or `aria-label`; wraps its children in a heading level one below the title.',
    },
    {
      name: "Dialog.Title",
      part: "title",
      element: "h2",
      description: "`h{level}` (default 2); names the dialog while rendered.",
    },
    {
      name: "Dialog.Description",
      part: "description",
      element: "p",
      description: "Describes the dialog while rendered; optional.",
    },
    {
      name: "Dialog.CloseTrigger",
      part: "close-trigger",
      element: "button",
      description:
        'Closes the dialog; named by `messages.close` when it has no content of its own. A `type="submit"` one closes on its form\'s submit.',
    },
    {
      name: "Dialog.Cancel",
      part: "cancel",
      element: "button",
      description:
        'Closes with reason `cancel`; the initial focus of a `role="alertdialog"` dialog.',
    },
    {
      name: "Dialog.Action",
      part: "action",
      element: "button",
      description:
        "Closes with reason `action` (`details.cancel()` keeps it open for an async confirm); several may be rendered.",
    },
  ],
  props: {
    role: {
      type: '"dialog" | "alertdialog"',
      default: '"dialog"',
      description:
        "`alertdialog`: a confirmation. Always modal, an outside press never closes it, focus starts on Cancel, a missing description warns.",
    },
    open: { type: "boolean", description: "Controlled open state." },
    defaultOpen: { type: "boolean", default: "false", description: "Initial open state." },
    onOpenChange: {
      type: "(open: boolean, details: ChangeDetails) => void",
      description:
        "Every change request, with `details.reason` (`trigger`, `close-trigger`, `cancel`, `action`, `escape-key`, `outside-press`, `outside-focus`, `parent-dismissed`, `api`) and `details.cancel()`.",
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
      type: "{ close?: string }",
      default: '{ close: "Close" }',
      description: "The name of a close trigger with no content of its own.",
    },
    actionsRef: {
      type: "Ref<{ open(): void; close(): void }>",
      description: "Programmatic open and close (reason `api`).",
    },
    "*.level": {
      type: "1 | 2 | 3 | 4 | 5 | 6",
      default: "2",
      description: "On `Dialog.Title`: its heading level; headings in the content are one deeper.",
    },
    "*.render": {
      type: "element | (props, state) => element",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    trigger: {
      ...base("trigger"),
      "data-state": '"open" on the trigger that opened the open dialog, else "closed".',
      "data-close-reason": "The last close reason in kebab case, after close.",
      ...button,
      "data-disabled": "While disabled.",
    },
    backdrop: {
      ...base("backdrop"),
      "data-state": '"open" or "closed".',
      ...stacking,
    },
    positioner: {
      ...base("positioner"),
      "data-state": '"open" or "closed".',
      "data-modal": "While modal.",
      ...stacking,
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
    cancel: { ...base("cancel"), ...button, "data-disabled": "While disabled." },
    action: { ...base("action"), ...button, "data-disabled": "While disabled." },
  },
  keyboard: [
    ["Enter / Space on the trigger", "Opens the dialog (closes it when non-modal and open)."],
    [
      "Enter / Space on a close trigger, Cancel or an Action",
      "Closes the dialog with that reason.",
    ],
    ["Escape", "Closes the topmost dialog (`closeOnEscape`)."],
    ["Tab / Shift+Tab", "Moves through the tabbable elements; wraps at the edges while modal."],
    ["Enter in a form field", "Submits the form natively; the dialog does not handle Enter."],
  ],
  states: {
    closed: "Nothing is mounted (unless `keepMounted`); no layer, lock or inert.",
    open: "A layer of kind `dialog`: focus moved in, outside inert and scroll locked when modal.",
  },
  contract: {
    actions: {
      open: ["pointer", "touch", "keyboard", "virtual"],
      close: ["pointer", "touch", "keyboard", "virtual"],
      cancel: ["pointer", "touch", "keyboard", "virtual"],
      confirm: ["pointer", "touch", "keyboard", "virtual"],
      pressEscape: ["keyboard"],
      pressOutside: ["pointer", "virtual"],
      tab: ["keyboard"],
      shiftTab: ["keyboard"],
      waitForUnmount: ["keyboard"],
    },
    queries: ["isOpen", "isModal", "title", "description", "hasFocus", "isTopmost", "closeReason"],
    traits: ["modal", "presence"],
  },
} as const satisfies ComponentMeta
