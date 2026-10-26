import { contract } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { type ApprovalState, type ToolCallStatus, toolCallMachine } from "./tool-call.machine"

type P =
  | "root"
  | "header"
  | "name"
  | "status"
  | "duration"
  | "content"
  | "input"
  | "output"
  | "error"
  | "approval"
  | "approval-title"
  | "approval-description"
  | "approve"
  | "deny"
  | "receipt"
type E = Env<P>

const press = (part: P) => ({
  pointer: (env: E) => env.part(part).click(),
  touch: (env: E) => env.part(part).tap(),
  keyboard: async (env: E) => {
    await env.part(part).focus()
    await env.part(part).press("Enter")
  },
  done: async () => true,
})

/** Tool Call's contract (spec "Tool Call Contract"): by the Header's name, else the only one. */
export const toolCallContract = contract("tool-call", {
  machine: toolCallMachine,
  anatomy: [
    "root",
    "header",
    "name",
    "status",
    "duration",
    "content",
    "input",
    "output",
    "error",
    "approval",
    "approval-title",
    "approval-description",
    "approve",
    "deny",
    "receipt",
  ],
  locate: (anchor?: { readonly name: string | RegExp }) =>
    anchor ? { role: "button", name: anchor.name } : { part: "root" },
  actions: {
    toggle: press("header"),
    approve: press("approve"),
    deny: press("deny"),
  },
  queries: {
    status: async (env: E) =>
      ((await env.part("root").attr("data-state")) ?? "pending") as ToolCallStatus,
    isOpen: async (env: E) => (await env.part("header").attr("aria-expanded")) === "true",
    approvalState: async (env: E) =>
      ((await env.part("approval").attr("data-approval")) ?? "idle") as ApprovalState,
    decision: async (env: E) => env.part("approval").attr("data-decision"),
    receiptText: async (env: E) => env.part("receipt").text(),
  },
  states: { live: {} },
  events: { TOGGLE: "toggle", APPROVE: "approve", DENY: "deny" },
  traits: [],
})
