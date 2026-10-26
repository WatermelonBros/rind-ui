// Tool Call's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked against
// the code in tool-call.test.ts. (`.pending` until the React parts land.)

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"tool-call"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-state": '"pending", "running", "awaiting", "done", "error", "denied" or "cancelled".',
  "data-open": "While open.",
})
const key = (part: string) => ({
  ...base(part),
  "data-disabled": "While a decision cannot be made.",
  "data-focus": "Focused.",
  "data-focus-visible": "Keyboard focus.",
})
const part = (name: string, p: string, element: string, description: string) => ({
  name,
  part: p,
  element,
  description,
})

export const toolCallMeta = {
  scope: "tool-call",
  name: "Tool Call",
  stateless: false,
  parts: [
    part("ToolCall.Root", "root", "div", "Holds the call (`id`, `name`, `status`)."),
    part(
      "ToolCall.Header",
      "header",
      "button",
      'Opens and closes the details; named by the tool and the status in words ("search_flights, running").',
    ),
    part("ToolCall.Name", "name", "span", "The tool's name."),
    part(
      "ToolCall.Status",
      "status",
      "span",
      "The status in words; `aria-hidden` (it is in the Header's name).",
    ),
    part("ToolCall.Duration", "duration", "span", "How long it ran."),
    part(
      "ToolCall.Content",
      "content",
      "div",
      "The details region: Input, Output, Error, Approval.",
    ),
    part("ToolCall.Input", "input", "div", "The arguments (a Code Block or a JSON Tree View)."),
    part("ToolCall.Output", "output", "div", "The result."),
    part("ToolCall.Error", "error", "div", "The error."),
    part(
      "ToolCall.Approval",
      "approval",
      "div",
      "A group asking for a decision; shows its outcome after.",
    ),
    part("ToolCall.ApprovalTitle", "approval-title", "div", "What is asked."),
    part("ToolCall.ApprovalDescription", "approval-description", "div", "Why, or what it will do."),
    part(
      "ToolCall.Approve",
      "approve",
      "button",
      "Sends `onDecision({ id, approved: true })`; one decision, focusable while submitting.",
    ),
    part("ToolCall.Deny", "deny", "button", "Sends `onDecision({ id, approved: false })`."),
    part(
      "ToolCall.Receipt",
      "receipt",
      "div",
      '`role="status"`: "Approved", "Denied" or "Request expired"; takes the focus after a decision made from inside.',
    ),
  ],
  props: {
    id: { type: "string", description: "Required. The call's identity, sent with the decision." },
    name: { type: "string", description: "Required. The tool's name." },
    status: {
      type: '"pending" | "running" | "awaiting" | "done" | "error" | "denied" | "cancelled"',
      description: "Required. Map it from your runtime.",
    },
    open: { type: "boolean", description: "Controlled open state." },
    defaultOpen: { type: "boolean", default: "false", description: "Uncontrolled open state." },
    onOpenChange: { type: "(open: boolean) => void", description: "The Header was pressed." },
    onDecision: {
      type: "({ id, approved, reason? }) => void | Promise<void>",
      description: "The human's decision; without it no buttons are rendered.",
    },
    focusOnRequest: {
      type: '"none" | "approval"',
      default: '"none"',
      description: "Focus Approve when a request arrives (only when the user expects it).",
    },
    announce: {
      type: '"off" | "polite"',
      default: '"polite"',
      description: "Announce a request for approval and a failure.",
    },
    risk: {
      type: '"normal" | "high"',
      default: '"normal"',
      description: "A high-risk request (the theme uses the danger tone).",
    },
    duration: { type: "number", description: "Seconds; else measured from the first live status." },
    messages: {
      type: "Partial<ToolCallMessages>",
      description: "Overrides the strings (also through the provider).",
    },
    locale: { type: "string", description: "Default: the provider's locale." },
    render: {
      type: "RenderProp",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: base("root"),
    header: {
      ...base("header"),
      "data-focus": "Focused.",
      "data-focus-visible": "Keyboard focus.",
    },
    name: base("name"),
    status: base("status"),
    duration: base("duration"),
    content: base("content"),
    input: base("input"),
    output: base("output"),
    error: base("error"),
    approval: {
      ...base("approval"),
      "data-approval": '"idle", "awaiting", "submitting", "settled", "failed" or "expired".',
      "data-risk": '"normal" or "high".',
      "data-decision": '"approved" or "denied", once decided.',
    },
    "approval-title": base("approval-title"),
    "approval-description": base("approval-description"),
    approve: key("approve"),
    deny: key("deny"),
    receipt: base("receipt"),
  },
  keyboard: [["Enter, Space", "On the Header: opens or closes; on Approve or Deny: decides."]],
  states: { live: "The status is the consumer's prop; see data-state." },
  contract: {
    actions: {
      toggle: ["pointer", "keyboard", "touch", "virtual"],
      approve: ["pointer", "keyboard", "touch", "virtual"],
      deny: ["pointer", "keyboard", "touch", "virtual"],
    },
    queries: ["status", "isOpen", "approvalState", "decision", "receiptText"],
    traits: [],
  },
} as const satisfies ComponentMeta
