// Reasoning's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in reasoning.connect.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"reasoning"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-state": '"open" or "closed".',
  "data-thinking": "While the model thinks.",
})

export const reasoningMeta = {
  scope: "reasoning",
  name: "Reasoning",
  stateless: false,
  parts: [
    {
      name: "Reasoning.Root",
      part: "root",
      element: "div",
      description: "Holds the disclosure and the thinking lifecycle.",
    },
    {
      name: "Reasoning.Trigger",
      part: "trigger",
      element: "button",
      description:
        'Toggles the trace; `aria-expanded`, `aria-controls` while open. Default text: "Thinking…", then "Thought for 12 seconds".',
    },
    {
      name: "Reasoning.Content",
      part: "content",
      element: "div",
      description: "The trace (your renderer); hidden while closed, `aria-busy` while thinking.",
    },
  ],
  props: {
    thinking: {
      type: "boolean",
      description: "The model is thinking (your runtime's streaming flag for the reasoning).",
    },
    open: { type: "boolean", description: "Controlled open state." },
    defaultOpen: {
      type: "boolean",
      default: "false",
      description: "Uncontrolled initial open state.",
    },
    onOpenChange: {
      type: "(open, details) => void",
      description: '`details.reason`: "auto" (the lifecycle) or "trigger" (the user).',
    },
    duration: {
      type: "number",
      description: "Seconds, from your runtime; else measured on the Environment's clock.",
    },
    autoCloseDelay: {
      type: "number",
      default: "1000",
      description: "Milliseconds before the automatic close.",
    },
    announce: {
      type: "boolean",
      default: "true",
      description: 'Announce "Thinking…" and "Thought for N seconds".',
    },
    messages: { type: "Partial<ReasoningMessages>", description: "Overrides the text." },
    locale: { type: "string", description: "Default: the provider's locale." },
    render: {
      type: "element | (props, state) => element",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: base("root"),
    trigger: {
      ...base("trigger"),
      "data-focus": "Focused.",
      "data-focus-visible": "Keyboard focus.",
    },
    content: base("content"),
  },
  keyboard: [["Enter, Space", "On the Trigger: shows or hides the trace."]],
  states: {
    done: "Not thinking.",
    thinking: "The model is thinking; it opened by itself unless the user toggled it.",
    closing: "Thinking ended; the automatic close is pending.",
  },
  contract: {
    actions: { toggle: ["pointer", "keyboard", "virtual"] },
    queries: ["isOpen", "isThinking", "triggerText"],
    traits: ["disclosure"],
  },
} as const satisfies ComponentMeta
