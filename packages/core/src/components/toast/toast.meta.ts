// The Toast's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in toast.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"toast"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id (a toast's own, derived from the region's).",
})

const button = {
  "data-focus": "While it has focus.",
  "data-focus-visible": "While it has focus and the last input was not a pointer or touch.",
  "data-pressed": "While it is pressed.",
}

export const toastMeta = {
  scope: "toast",
  name: "Toast",
  stateless: false,
  exports: ["Toast", "Toaster"],
  parts: [
    {
      name: "Toaster",
      part: "region",
      element: "section",
      description:
        'The region of one store (`toaster` prop), rendered only while it shows toasts. A named landmark ("Notifications (F6)"), never a live region: toasts are announced through the announcer. `tabindex="-1"`; the hotkey moves focus into it.',
    },
    {
      name: "Toaster (list)",
      part: "list",
      element: "ol",
      description: "The list of toasts, newest first. Rendered by `Toaster`.",
    },
    {
      name: "Toast.Root",
      part: "root",
      element: "li",
      description:
        "One toast, named by its title and described by its description. Focusable (`tabindex=0`), no role. Escape on it dismisses that toast only. Carries the stack position as `--rind-toast-index` / `-offset` / `-height` and the swipe as `--rind-toast-swipe-x` / `-y`.",
    },
    {
      name: "Toast.Title",
      part: "title",
      element: "div",
      description: "Defaults to the toast's `title`; names the toast while rendered.",
    },
    {
      name: "Toast.Description",
      part: "description",
      element: "div",
      description: "Defaults to the toast's `description`; describes the toast while rendered.",
    },
    {
      name: "Toast.ActionTrigger",
      part: "action-trigger",
      element: "button",
      description:
        "Runs the toast's `action.onAction`; dismisses with reason `action` unless `closes: false`. Defaults to the action's label.",
    },
    {
      name: "Toast.CloseTrigger",
      part: "close-trigger",
      element: "button",
      description:
        "Dismisses with reason `close-trigger`; named by `messages.close` when it has no text. Disabled when the toast is not dismissible. The non-gesture way out.",
    },
  ],
  props: {
    toaster: { type: "Toaster", description: "On `Toaster`: the store this region shows." },
    children: {
      type: "(toast: ToastSnapshot) => ReactNode",
      description: "On `Toaster`: one toast's markup, called per toast (newest first).",
    },
    portal: {
      type: "boolean",
      default: "true",
      description: "On `Toaster`: renders the region in the shared portal.",
    },
    messages: {
      type: "{ regionLabel?; close?; actionHint?; hotkeyLabel? }",
      default: '{ regionLabel: "Notifications (F6)", close: "Dismiss notification", … }',
      description: "On `Toaster`: the assistive-technology strings.",
    },
    "*.render": {
      type: "element | (props, toast) => element",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  options: {
    placement: {
      type: '"top" | "bottom" + "-start" | "-center" | "-end"',
      default: '"bottom-end"',
      description: "On `createToaster`: the corner or edge of the viewport.",
    },
    limit: {
      type: "number",
      default: "3",
      description:
        "On `createToaster`: toasts presented at once; older ones are held, never dropped.",
    },
    duration: {
      type: "number",
      default: "5000",
      description: "On `createToaster` and a toast: ms before it dismisses; `Infinity` never.",
    },
    gap: { type: "number", default: "14", description: "On `createToaster`: px between toasts." },
    expand: {
      type: "boolean",
      default: "false",
      description: "On `createToaster`: the stack is always expanded.",
    },
    hotkey: {
      type: "string",
      default: '"F6"',
      description: "On `createToaster`: moves focus into the region while toasts exist.",
    },
    swipeDirections: {
      type: "SwipeDirection[]",
      default: "the placement's edge and the inline end",
      description: "On `createToaster`: the directions a swipe can dismiss.",
    },
    action: {
      type: "{ label: string; onAction: () => void; closes?: boolean }",
      description:
        "On a toast: an action. Without an explicit `duration` the toast persists (WCAG 2.2.1).",
    },
    dismissible: {
      type: "boolean",
      default: "true",
      description: "On a toast: `false` ignores the close trigger, Escape and swipe.",
    },
    onDismiss: {
      type: "(reason: ToastDismissReason) => void",
      description:
        "On a toast: `reason` is `close-trigger`, `action`, `escape-key`, `swipe`, `timeout` or `api`.",
    },
  },
  dataAttributes: {
    region: {
      ...base("region"),
      "data-rind-top-layer": "Always: presses inside it are not outside presses of any layer.",
      "data-placement": 'The placement, e.g. "bottom-end".',
      "data-side": '"top" or "bottom".',
      "data-align": '"start", "center" or "end".',
      "data-expanded": "While the stack is expanded (hover, focus or the `expand` option).",
      "data-paused": "While the pointer or focus holds the timers.",
    },
    list: base("list"),
    root: {
      ...base("root"),
      "data-state": '"open" or "closed" (while it exits).',
      "data-type": '"info", "success", "warning", "error" or "loading".',
      "data-index": "Position in the stack, 0 for the newest.",
      "data-front": "The newest toast.",
      "data-expanded": "While the stack is expanded.",
      "data-limited": "Held beyond the limit: inert and hidden.",
      "data-paused": "While a pause reason holds its timer.",
      "data-swiping": "While it is dragged.",
      "data-swipe-direction": "The direction of the last swipe release.",
      "data-swipe-out": "While it exits after a swipe.",
      "data-dismiss-reason": "The dismissal reason, while it exits.",
      "data-focus": "The toast itself has focus.",
      "data-focus-visible": "Focus came by keyboard (the hotkey, Tab).",
    },
    title: base("title"),
    description: base("description"),
    "action-trigger": { ...base("action-trigger"), ...button },
    "close-trigger": {
      ...base("close-trigger"),
      "data-disabled": "While the toast is not dismissible.",
      ...button,
    },
  },
  keyboard: [
    ["F6 (`hotkey`)", "Moves focus to the newest toast; again, back to where it was."],
    ["Escape", "Dismisses the focused toast only."],
    ["Tab / Shift+Tab", "Moves between the toasts and their buttons."],
    ["Enter / Space on a button", "Runs the action or dismisses."],
  ],
  states: {
    idle: "Created; no region has started it yet.",
    timing: "Its timer runs.",
    paused: "A pause reason holds its timer (hover, focus, swipe, hidden tab, limit, api).",
    persistent: "No timer: loading, `duration: Infinity`, or an action without a `duration`.",
    dismissed: "Final: exiting, then removed.",
  },
  contract: {
    actions: {
      enter: ["pointer", "keyboard", "virtual"],
      leave: ["pointer", "keyboard", "virtual"],
      waitForAll: ["keyboard"],
      appear: ["pointer", "keyboard", "virtual"],
      dismiss: ["pointer", "touch", "keyboard", "virtual"],
      swipe: ["pointer", "touch", "virtual"],
      act: ["pointer", "keyboard", "virtual"],
      hover: ["pointer", "keyboard", "virtual"],
      unhover: ["pointer", "keyboard", "virtual"],
      waitForTimeout: ["keyboard"],
    },
    queries: [
      "titles",
      "count",
      "isExpanded",
      "isPaused",
      "hasFocus",
      "isShown",
      "type",
      "title",
      "description",
      "isLimited",
      "dismissReason",
    ],
    traits: ["timed", "presence"],
  },
} as const satisfies ComponentMeta
