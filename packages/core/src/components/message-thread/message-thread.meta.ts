// Message Thread's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in message-thread.connect.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"message-thread"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-state": '"following" (the view follows new content) or "detached" (reading back).',
  "data-anchor": '"bottom" or "top".',
})

export const messageThreadMeta = {
  scope: "message-thread",
  name: "MessageThread",
  stateless: false,
  parts: [
    {
      name: "MessageThread.Root",
      part: "root",
      element: "div",
      description: "Holds the follow state; wraps the Viewport and JumpToLatest.",
    },
    {
      name: "MessageThread.Viewport",
      part: "viewport",
      element: "div",
      description:
        'The scroll region: `role="feed"` named "Conversation", focusable, `aria-busy` while older messages load; Page Down / Page Up move between messages.',
    },
    {
      name: "MessageThread.Message",
      part: "message",
      element: "div",
      description:
        '`role="article"` with its position and its speaker as name ("You", "Assistant"); takes `index` and `from`.',
    },
    {
      name: "MessageThread.JumpToLatest",
      part: "jump-to-latest",
      element: "button",
      description:
        'Rendered while reading back; named "3 new messages, jump to latest"; by keyboard, focus goes to the last message.',
    },
  ],
  props: {
    count: { type: "number", description: "Messages in the thread (or loaded)." },
    total: {
      type: "number",
      description: "The thread's full length when larger than what is loaded (`-1`: unknown).",
    },
    lastFromUser: {
      type: "boolean",
      default: "false",
      description: "The newest message is the user's: the view goes back to it.",
    },
    anchor: {
      type: '"bottom" | "top"',
      default: '"bottom"',
      description:
        '"bottom" follows new content; "top" scrolls the user\'s new message to the top and lets the answer grow below.',
    },
    bottomThreshold: {
      type: "number",
      default: "32",
      description: "How near the bottom, in px, counts as at the bottom.",
    },
    loadingOlder: {
      type: "boolean",
      default: "false",
      description: "Older messages are loading (`aria-busy`).",
    },
    onLoadOlder: { type: "() => void", description: "The top was reached: load older messages." },
    messages: { type: "Partial<MessageThreadMessages>", description: "Overrides the names." },
    locale: { type: "string", description: "Default: the provider's locale." },
    render: {
      type: "element | (props, state) => element",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: { ...base("root"), "data-at-bottom": "While scrolled to the bottom." },
    viewport: {
      ...base("viewport"),
      "data-loading": "While older messages load.",
      "data-focus": "Focused.",
      "data-focus-visible": "Keyboard focus.",
    },
    message: {
      ...base("message"),
      "data-from": '"user", "assistant" or "system".',
      "data-index": "The message's index.",
      "data-focus": "Focused.",
      "data-focus-visible": "Keyboard focus.",
    },
    "jump-to-latest": {
      ...base("jump-to-latest"),
      "data-unread": "Messages that arrived while reading back.",
    },
  },
  keyboard: [
    ["Page Down", "Focus the next message."],
    ["Page Up", "Focus the previous message."],
    ["Ctrl+End / ⌘End", "Leave the thread forward (to the prompt)."],
    ["Ctrl+Home / ⌘Home", "Leave the thread backward."],
  ],
  states: {
    following: "At the bottom; new content keeps the view there (bottom layout).",
    detached: "The user is reading back; new messages are counted, not followed.",
  },
  contract: {
    actions: {
      scrollUp: ["pointer", "virtual"],
      scrollToBottom: ["pointer", "virtual"],
      jump: ["pointer", "keyboard", "virtual"],
      nextMessage: ["keyboard"],
      previousMessage: ["keyboard"],
    },
    queries: ["state", "isAtBottom", "unread", "focusedMessage", "messageCount"],
    traits: [],
  },
} as const satisfies ComponentMeta
