// The Alert Dialog's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in alert-dialog.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"alert-dialog"',
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

export const alertDialogMeta = {
  scope: "alert-dialog",
  name: "Alert Dialog",
  stateless: false,
  parts: [
    {
      name: "AlertDialog.Root",
      part: "root",
      element: "none",
      description:
        "Renders no element: owns the open state, the layer and the focus rules. Always modal. `actionsRef` exposes `open()` and `close()`.",
    },
    {
      name: "AlertDialog.Trigger",
      part: "trigger",
      element: "button",
      description:
        'Opens the alert dialog. `aria-haspopup="dialog"`, `aria-expanded` only on the trigger that opened it.',
    },
    {
      name: "AlertDialog.Portal",
      part: "portal",
      element: "none",
      description: "Optional: renders its children in the shared `Portal`.",
    },
    {
      name: "AlertDialog.Backdrop",
      part: "backdrop",
      element: "div",
      description: "`aria-hidden`; a press on it does nothing (an outside press never closes it).",
    },
    {
      name: "AlertDialog.Positioner",
      part: "positioner",
      element: "div",
      description: "Optional scroll container around the content; a press on it does nothing.",
    },
    {
      name: "AlertDialog.Content",
      part: "content",
      element: "div",
      description:
        '`role="alertdialog"`, `aria-modal="true"`, `tabindex="-1"`, named by the title and described by the description; wraps its children in a heading level one below the title.',
    },
    {
      name: "AlertDialog.Title",
      part: "title",
      element: "h2",
      description: "`h{level}` (default 2); names the alert dialog while rendered.",
    },
    {
      name: "AlertDialog.Description",
      part: "description",
      element: "p",
      description: "The alert message; describes the alert dialog while rendered.",
    },
    {
      name: "AlertDialog.Cancel",
      part: "cancel",
      element: "button",
      description:
        '`type="button"`; closes it with reason `CANCEL_PRESS`. Takes initial focus by default.',
    },
    {
      name: "AlertDialog.Action",
      part: "action",
      element: "button",
      description:
        'The confirming button; any number. `type="button"`; closes it with reason `ACTION_PRESS` unless `details.cancel()` is called. A `type="submit"` one closes on its form\'s submit.',
    },
  ],
  props: {
    open: { type: "boolean", description: "Controlled open state." },
    defaultOpen: { type: "boolean", default: "false", description: "Initial open state." },
    onOpenChange: {
      type: "(open: boolean, details: ChangeDetails) => void",
      description:
        "Every change request, with `details.reason` (`TRIGGER_PRESS`, `CANCEL_PRESS`, `ACTION_PRESS`, `ESCAPE_KEY`, `OUTSIDE_FOCUS`, `PARENT_DISMISSED`, `OPEN`, `CLOSE`) and `details.cancel()`.",
    },
    closeOnEscape: { type: "boolean", default: "true", description: "Escape closes it." },
    initialFocus: {
      type: '"cancel" | "content" | "title" | (() => element | null) | null | false',
      default: '"cancel"',
      description:
        "Where focus goes on open: the Cancel button (else the content), another part, a function, or nowhere (`false`).",
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
    keepMounted: {
      type: "boolean",
      default: "false",
      description: "Content, backdrop and positioner stay mounted (hidden) while closed.",
    },
    messages: {
      type: "{ close?: string }",
      default: '{ close: "Close" }',
      description: "Shared with the dialog; an alert dialog has no close trigger.",
    },
    actionsRef: {
      type: "Ref<{ open(): void; close(): void }>",
      description: "Programmatic open and close (reasons `OPEN` and `CLOSE`).",
    },
    level: {
      type: "1 | 2 | 3 | 4 | 5 | 6",
      default: "2",
      description:
        "On `AlertDialog.Title`: its heading level; headings in the content are one deeper.",
    },
    render: {
      type: "element | (props, state) => element",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    trigger: {
      ...base("trigger"),
      "data-state": '"open" on the trigger that opened the open alert dialog, else "closed".',
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
      "data-modal": "Always.",
      ...stacking,
    },
    content: {
      ...base("content"),
      "data-state": '"open" or "closed" (while it exits).',
      "data-modal": "Always.",
      "data-close-reason":
        "The last close reason in kebab case (`action-press`), until the next open.",
      "data-focus-within": "While focus is inside it.",
      "data-focus": "While the content itself has focus.",
      "data-focus-visible":
        "While the content itself has focus and the last input was not a pointer.",
      ...stacking,
    },
    title: { ...base("title"), "data-level": "The heading level." },
    description: base("description"),
    cancel: {
      ...base("cancel"),
      ...button,
      "data-disabled": "While disabled.",
    },
    action: {
      ...base("action"),
      ...button,
      "data-disabled": "While disabled.",
    },
  },
  keyboard: [
    ["Enter / Space on the trigger", "Opens the alert dialog."],
    ["Enter / Space on Cancel or an action", "Closes it (reason `CANCEL_PRESS` / `ACTION_PRESS`)."],
    ["Escape", "Closes the topmost alert dialog (`closeOnEscape`)."],
    ["Tab / Shift+Tab", "Moves through the tabbable elements; wraps at the edges."],
  ],
  states: {
    closed: "Nothing is mounted (unless `keepMounted`); no layer, lock or inert.",
    open: "A layer of kind `alertdialog`: Cancel focused, outside inert and scroll locked.",
  },
  contract: {
    actions: {
      open: ["pointer", "touch", "keyboard", "virtual"],
      pressEscape: ["keyboard"],
      pressOutside: ["pointer", "virtual"],
      tab: ["keyboard"],
      shiftTab: ["keyboard"],
      waitForUnmount: ["keyboard"],
      cancel: ["pointer", "touch", "keyboard", "virtual"],
      confirm: ["pointer", "touch", "keyboard", "virtual"],
    },
    queries: ["isOpen", "isModal", "title", "description", "hasFocus", "isTopmost", "closeReason"],
    traits: ["modal", "presence"],
  },
} as const satisfies ComponentMeta
