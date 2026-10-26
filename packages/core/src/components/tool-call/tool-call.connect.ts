// Tool Call parts (add-tool-call design §1–§7): the Header is a disclosure named by the tool and
// the status in words (assistant-ui#7957); the Approval's buttons stay focusable while the
// decision is submitting (aria-disabled); the Receipt is a status the focus can land on.

import { focusAttrs } from "../../a11y/focus"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import type { LinkEnv } from "../../dom/link"
import { buttonLikeProps } from "../shared/button-like"
import type { ApprovalState, ToolCallStatus } from "./tool-call.machine"
import type { ToolCallMessages } from "./tool-call.messages"

export type ToolCallPart =
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

export interface ToolCallConnectInput {
  readonly instance: string
  readonly name: string
  readonly status: ToolCallStatus
  readonly open: boolean
  readonly approval: ApprovalState
  readonly decision: "approved" | "denied" | null
  /** Seconds: the prop, else the measured time; null when unknown. */
  readonly duration: number | null
  readonly risk: "normal" | "high"
  /** `onDecision` given: the Approve and Deny buttons exist. */
  readonly decides: boolean
  readonly messages: ToolCallMessages
  readonly ids: { readonly header: string; readonly content: string }
}

export interface ToolCallButtonInput {
  readonly tag: string
  readonly focused: boolean
  readonly modality: Modality
}

export function toolCallConnect(input: ToolCallConnectInput, env: LinkEnv) {
  const m = input.messages
  const statusText = m.status(input.status)
  const base = (part: ToolCallPart): PartProps => ({
    ...scopeAttrs("tool-call", part, input.instance),
    "data-state": input.status,
    "data-open": dataFlag(input.open),
  })
  const busy = input.approval === "submitting"
  const canDecide = input.approval === "awaiting" || input.approval === "failed"
  const key = (part: "approve" | "deny", b: ToolCallButtonInput, name: string): PartProps => ({
    ...buttonLikeProps(
      {
        role: "button",
        tag: b.tag,
        type: "button",
        disabled: !canDecide,
        focusableWhenDisabled: true,
      },
      env,
    ),
    ...base(part),
    ...focusAttrs(b.focused, b.modality),
    "aria-label": name,
    "aria-busy": busy ? "true" : undefined,
    "data-disabled": dataFlag(!canDecide),
  })
  const receiptText =
    input.approval === "expired"
      ? m.expired
      : input.decision === "approved"
        ? m.approved
        : input.decision === "denied"
          ? m.denied
          : ""
  return {
    statusText,
    durationText: input.duration === null ? "" : m.duration(input.duration),
    receiptText,
    /** The Approval's buttons are rendered (an `onDecision` was given). */
    decides: input.decides,
    /** The Approval is shown: a request or its outcome. */
    showsApproval: input.approval !== "idle",
    root: (): PartProps => base("root"),
    header: (b: ToolCallButtonInput): PartProps => ({
      ...buttonLikeProps(
        {
          role: "button",
          tag: b.tag,
          type: "button",
          disabled: false,
          focusableWhenDisabled: false,
        },
        env,
      ),
      ...base("header"),
      ...focusAttrs(b.focused, b.modality),
      id: input.ids.header,
      "aria-expanded": input.open ? "true" : "false",
      "aria-controls": input.ids.content,
      "aria-label": `${input.name}, ${statusText}`,
    }),
    name: (): PartProps => base("name"),
    status: (): PartProps => ({ ...base("status"), "aria-hidden": "true" }),
    duration: (): PartProps => base("duration"),
    content: (): PartProps => ({
      ...base("content"),
      id: input.ids.content,
      role: "region",
      "aria-labelledby": input.ids.header,
      hidden: input.open ? undefined : true,
    }),
    input: (): PartProps => base("input"),
    output: (): PartProps => base("output"),
    error: (): PartProps => base("error"),
    approval: (): PartProps => ({
      ...base("approval"),
      role: "group",
      "aria-labelledby": undefined,
      "data-approval": input.approval,
      "data-risk": input.risk,
      "data-decision": input.decision ?? undefined,
    }),
    approvalTitle: (): PartProps => base("approval-title"),
    approvalDescription: (): PartProps => base("approval-description"),
    approve: (b: ToolCallButtonInput): PartProps => key("approve", b, m.approve),
    deny: (b: ToolCallButtonInput): PartProps => key("deny", b, m.deny),
    receipt: (): PartProps => ({ ...base("receipt"), role: "status", tabindex: -1 }),
  }
}

export type ToolCallApi = ReturnType<typeof toolCallConnect>
