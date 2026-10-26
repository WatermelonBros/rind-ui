// Message Actions' API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in message-actions.test.ts. (`.pending` until the React parts land.)

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"message-actions"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})
const key = (part: string) => ({
  ...base(part),
  "data-disabled": "While it does nothing.",
  "data-focus": "Focused.",
  "data-focus-visible": "Keyboard focus.",
})

export const messageActionsMeta = {
  scope: "message-actions",
  name: "Message Actions",
  stateless: false,
  parts: [
    {
      name: "MessageActions.Root",
      part: "root",
      element: "div",
      description:
        'A toolbar ("Message actions"): one Tab stop, arrows between items. Hidden by style when inactive, never unmounted.',
    },
    {
      name: "MessageActions.Item",
      part: "item",
      element: "button",
      description: "Your own action (a Toolbar item).",
    },
    {
      name: "MessageActions.Copy",
      part: "copy",
      element: "button",
      description: "Copies `value` (read at press time) with Clipboard's states and announcements.",
    },
    {
      name: "MessageActions.Regenerate",
      part: "regenerate",
      element: "button",
      description: "Calls `onRegenerate`; disabled and busy until its promise settles.",
    },
    {
      name: "MessageActions.Edit",
      part: "edit",
      element: "button",
      description:
        "Toggles `editing` (`aria-pressed`); takes the focus back when the editor closes.",
    },
    {
      name: "MessageActions.Feedback",
      part: "feedback",
      element: "div",
      description: "Thumbs up/down: a single, deselectable Toggle Group.",
    },
    {
      name: "MessageActions.FeedbackItem",
      part: "feedback-item",
      element: "button",
      description: '`value="up"` or `"down"` ("Good response", "Bad response").',
    },
    {
      name: "MessageActions.Versions",
      part: "versions",
      element: "div",
      description: 'A group ("Versions"); rendered from two versions.',
    },
    {
      name: "MessageActions.VersionPrevious",
      part: "version-previous",
      element: "button",
      description: "The previous version; disabled but focusable on the first (unless `loop`).",
    },
    {
      name: "MessageActions.VersionNext",
      part: "version-next",
      element: "button",
      description: "The next version; disabled but focusable on the last (unless `loop`).",
    },
    {
      name: "MessageActions.VersionStatus",
      part: "version-status",
      element: "span",
      description: '"2 / 3", `aria-hidden` (a move announces "Version 2 of 3").',
    },
  ],
  props: {
    active: { type: "boolean", description: "Forces the row visible." },
    onRegenerate: { type: "() => void | Promise<void>", description: "Regenerate the message." },
    editing: { type: "boolean", description: "Controlled editing." },
    defaultEditing: { type: "boolean", default: "false", description: "Uncontrolled editing." },
    onEditingChange: { type: "(editing: boolean) => void", description: "Edit was toggled." },
    count: { type: "number", default: "0", description: "How many versions the message has." },
    index: { type: "number", description: "Controlled version index (0-based)." },
    defaultIndex: { type: "number", default: "0", description: "Uncontrolled version index." },
    onIndexChange: { type: "(index: number) => void", description: "A move between versions." },
    loop: { type: "boolean", default: "false", description: "The version buttons wrap around." },
    messages: {
      type: "Partial<MessageActionsMessages>",
      description: "Overrides the strings (also through the provider).",
    },
    locale: { type: "string", description: "Default: the provider's locale." },
    render: {
      type: "RenderProp",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: { ...base("root"), "data-active": "Shown.", "data-editing": "While editing." },
    regenerate: { ...key("regenerate"), "data-state": '"idle", "pending", "done" or "error".' },
    edit: {
      ...base("edit"),
      "data-focus": "Focused.",
      "data-focus-visible": "Keyboard focus.",
      "data-state": '"on" or "off".',
    },
    versions: {
      ...base("versions"),
      "data-count": "Versions.",
      "data-index": "The current one (0-based).",
    },
    "version-previous": key("version-previous"),
    "version-next": key("version-next"),
    "version-status": base("version-status"),
  },
  keyboard: [
    ["Tab", "Into the row (one stop), out of it."],
    ["Arrow keys, Home, End", "Between the actions."],
    ["Enter, Space", "Runs the focused action."],
  ],
  states: {
    live: "Ready.",
    settling: "Regenerate just finished: done or error shows for 2 s.",
  },
  contract: {
    actions: {
      copy: ["pointer", "keyboard", "touch", "virtual"],
      regenerate: ["pointer", "keyboard", "touch", "virtual"],
      edit: ["pointer", "keyboard", "touch", "virtual"],
      rate: ["pointer", "keyboard", "touch", "virtual"],
      previousVersion: ["pointer", "keyboard", "touch", "virtual"],
      nextVersion: ["pointer", "keyboard", "touch", "virtual"],
    },
    queries: ["isActive", "regenerateState", "rating", "version", "isEditing"],
    traits: [],
  },
} as const satisfies ComponentMeta
