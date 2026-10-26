// Agent Presence's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in agent-presence.test.ts. (`.pending` until the React parts land.)

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"agent-presence"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-state": '"idle", "connecting", "listening", "thinking", "speaking" or "error".',
  "data-previous-state": "The state before.",
  "data-muted": "While muted.",
  "data-stale": "The state lasted longer than `staleAfter`.",
  "data-motion": '"full", "reduced" or "off".',
})

export const agentPresenceMeta = {
  scope: "agent-presence",
  name: "Agent Presence",
  stateless: false,
  parts: [
    {
      name: "AgentPresence.Root",
      part: "root",
      element: "div",
      description:
        "Holds the state; sets `--rind-agent-presence-level` (0–1) each frame while listening or speaking, and `data-level` (0–3).",
    },
    {
      name: "AgentPresence.Visual",
      part: "visual",
      element: "div",
      description: "`aria-hidden`: put your orb, bars or canvas here.",
    },
    {
      name: "AgentPresence.Status",
      part: "status",
      element: "span",
      description:
        'The state in words ("Listening"); not a live region. Rendered hidden when not composed.',
    },
    {
      name: "AgentPresence.Label",
      part: "label",
      element: "span",
      description: "The agent's name.",
    },
    {
      name: "AgentPresence.Detail",
      part: "detail",
      element: "span",
      description: 'An extra line: the error\'s reason, "still thinking".',
    },
  ],
  props: {
    state: {
      type: '"idle" | "connecting" | "listening" | "thinking" | "speaking" | "error"',
      description: "Required. Map it from your voice runtime.",
    },
    reason: { type: "string", description: "Why, for `error`." },
    muted: { type: "boolean", default: "false", description: "The microphone is muted." },
    getLevel: {
      type: '(channel: "input" | "output") => number',
      description:
        "The audio level 0–1, read each frame while listening (input) or speaking (output).",
    },
    announce: {
      type: '"off" | "polite"',
      default: '"polite"',
      description: "Announce the first listening, a long think, the end and errors (assertive).",
    },
    thinkingDelay: {
      type: "number",
      default: "1500",
      description: "A think is announced after this (ms).",
    },
    staleAfter: {
      type: "Partial<Record<state, number>>",
      description: "A state lasting longer is stale (`data-stale`, `onStale`).",
    },
    motion: {
      type: '"auto" | "off"',
      default: '"auto"',
      description: '"off" stops the level loop; "auto" follows the reduced-motion preference.',
    },
    onStateChange: { type: "(state, { from }) => void", description: "Each change." },
    onStale: { type: "(state) => void", description: "A state became stale." },
    messages: {
      type: "Partial<AgentPresenceMessages>",
      description: "Overrides the strings (also through the provider).",
    },
    locale: { type: "string", description: "Default: the provider's locale." },
    render: {
      type: "RenderProp",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: { ...base("root"), "data-level": "The level band, 0 to 3." },
    visual: base("visual"),
    status: base("status"),
    label: base("label"),
    detail: { ...base("detail"), "data-reason": "The error's reason." },
  },
  keyboard: [],
  states: { live: "The state is the `state` prop; see data-state." },
  contract: { actions: {}, queries: ["state", "statusText", "isStale", "level"], traits: [] },
} as const satisfies ComponentMeta
