// Streaming Message's API facts for the generated docs (scripts/docs-gen.ts). Data only;
// checked against the code in streaming-message.connect.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"streaming-message"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-state": '"pending", "streaming", "settling", "complete", "cancelled" or "error".',
  "data-busy": "While streaming or catching up (`streaming`, `settling`).",
})

export const streamingMessageMeta = {
  scope: "streaming-message",
  name: "StreamingMessage",
  stateless: false,
  parts: [
    {
      name: "StreamingMessage.Root",
      part: "root",
      element: "div",
      description:
        'Holds the state; no role of its own (give it `role="article"` and a name in a thread).',
    },
    {
      name: "StreamingMessage.Content",
      part: "content",
      element: "div",
      description:
        "The displayed text: `children(text, state)` for your renderer (markdown), else plain text. `aria-busy` while busy; never a live region.",
    },
    {
      name: "StreamingMessage.Caret",
      part: "caret",
      element: "span",
      description:
        "`aria-hidden`; rendered only while busy. Empty, the theme draws a blinking bar.",
    },
  ],
  props: {
    text: { type: "string", description: "Everything received so far." },
    status: {
      type: '"pending" | "streaming" | "complete" | "cancelled" | "error"',
      description: "The response's status, from your chat runtime.",
    },
    smooth: {
      type: "boolean | { drainMs?, maxCharIntervalMs? }",
      default: "true",
      description:
        "Reveal bursty chunks evenly (drain a chunk in `drainMs`, default 250). Off under reduced motion and for text present at mount.",
    },
    announce: {
      type: '"status" | "text" | "sentences" | "none"',
      default: '"status"',
      description:
        "What is announced: the lifecycle (start, complete, cancelled, failed), the complete text once, its sentences as they complete, or nothing.",
    },
    messages: {
      type: "Partial<StreamingMessageMessages>",
      description: "Overrides the announcements.",
    },
    locale: { type: "string", description: "Default: the provider's locale (sentence splitting)." },
    render: {
      type: "RenderProp",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: base("root"),
    content: base("content"),
    caret: base("caret"),
  },
  keyboard: [],
  states: {
    pending: "No text yet.",
    streaming: "Text is arriving.",
    settling: "The stream ended; the smooth reveal is catching up.",
    complete: "Everything is shown.",
    cancelled: "Stopped; everything received is shown.",
    error: "Failed; everything received is shown.",
  },
  contract: {
    actions: { waitForReveal: ["pointer", "keyboard", "virtual"] },
    queries: ["state", "text", "isBusy", "hasCaret"],
    traits: [],
  },
} as const satisfies ComponentMeta
