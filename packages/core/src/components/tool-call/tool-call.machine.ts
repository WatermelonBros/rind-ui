// Tool Call (add-tool-call design §1–§6): the status is the consumer's; the machine owns the
// disclosure (opens on awaiting, never auto-closes), the approval attempt (one decision, a
// double press ignored, abandonment is expired: CopilotKit#5554), the focus after a decision
// (to the Receipt only when it was inside: assistant-ui#8704) and the measured duration.

import type { AnnouncerEnv, ClockEnv, LocaleEnv } from "../../env/capabilities"
import { setup, type } from "../../machine/setup"
import type { ActionArgs } from "../../machine/types"
import { type ToolCallMessages, toolCallMessages } from "./tool-call.messages"

export type ToolCallStatus =
  | "pending"
  | "running"
  | "awaiting"
  | "done"
  | "error"
  | "denied"
  | "cancelled"

export type ApprovalState = "idle" | "awaiting" | "submitting" | "settled" | "failed" | "expired"

export interface ToolCallDecision {
  readonly id: string
  readonly approved: boolean
  readonly reason?: string | undefined
}

export type ToolCallEvent =
  | { readonly type: "STATUS" }
  /** The service started: a call mounted live starts its clock. */
  | { readonly type: "MOUNT" }
  | { readonly type: "TOGGLE" }
  | { readonly type: "APPROVE" }
  | { readonly type: "DENY"; readonly reason?: string | undefined }
  | { readonly type: "DECISION.DONE" }
  | { readonly type: "DECISION.FAILED"; readonly error?: unknown }

export interface ToolCallProps {
  /** The call's identity (never its name: Open WebUI#29293). */
  readonly id: string
  readonly name: string
  readonly status: ToolCallStatus
  readonly open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?: ((open: boolean) => void) | undefined
  /** Absent: no Approve or Deny (assistant-ui#6094: no fabricated result). */
  readonly onDecision?: ((decision: ToolCallDecision) => void | Promise<void>) | undefined
  /** Default "none": the focus is never taken unasked (assistant-ui#8223). */
  readonly focusOnRequest?: "none" | "approval" | undefined
  readonly announce?: "off" | "polite" | undefined
  /** Seconds; else measured on the clock between live and final statuses. */
  readonly duration?: number | undefined
  readonly messages?: ToolCallMessages | undefined
  readonly lang?: string | undefined
}

export interface ToolCallEnv extends AnnouncerEnv, ClockEnv, LocaleEnv {
  /** The focus is inside the Approval group. */
  readonly focusInside?: (() => boolean) | undefined
  readonly focusReceipt?: (() => void) | undefined
  readonly focusApprove?: (() => void) | undefined
}

export interface ToolCallContext {
  readonly approval: ApprovalState
  readonly decision: "approved" | "denied" | null
  /** The last status seen (to detect transitions). */
  readonly status: ToolCallStatus
  /** Clock time of the first live status; null before. */
  readonly startedAt: number | null
  /** Measured seconds, once final. */
  readonly measured: number | null
}

type Types = {
  props: ToolCallProps
  events: ToolCallEvent
  env: ToolCallEnv
  context: ToolCallContext
  values: "open"
}
type Args = ActionArgs<Types>

const LIVE = new Set<ToolCallStatus>(["pending", "running", "awaiting"])
const FINAL = new Set<ToolCallStatus>(["done", "error", "denied", "cancelled"])
const messagesOf = (p: ToolCallProps) => p.messages ?? toolCallMessages

function say(args: Args, message: string) {
  if (args.props.announce === "off") return
  args.env.announcer.announce({
    message,
    priority: "polite",
    key: `tool-call-${args.props.id}`,
    lang: args.props.lang ?? args.env.locale.locale(),
  })
}

/** After a settle or an expiry: to the Receipt, only when the focus was inside. */
function receiptFocus(args: Args) {
  if (args.env.focusInside?.()) args.env.focusReceipt?.()
}

function decide(args: Args, approved: boolean, reason?: string) {
  const { props, send, set } = args
  set("approval", "submitting")
  set("decision", approved ? "approved" : "denied")
  let result: void | Promise<void>
  try {
    result = props.onDecision?.({ id: props.id, approved, ...(reason ? { reason } : {}) })
  } catch (error) {
    send({ type: "DECISION.FAILED", error })
    return
  }
  if (result && typeof (result as Promise<void>).then === "function") {
    ;(result as Promise<void>).then(
      () => send({ type: "DECISION.DONE" }),
      (error: unknown) => send({ type: "DECISION.FAILED", error }),
    )
  } else {
    send({ type: "DECISION.DONE" })
  }
}

export const toolCallMachine = /* @__PURE__ */ setup({
  types: type<Types>(),
  guards: {
    canDecide: ({ context, props }) =>
      props.onDecision !== undefined &&
      (context.approval === "awaiting" || context.approval === "failed"),
  },
  actions: {
    toggle: ({ set, values }) => set("open", values.open !== true),
    markStart: ({ context, env, set }) => {
      if (LIVE.has(context.status) && context.startedAt === null) set("startedAt", env.clock.now())
      if (context.status === "awaiting") set("open", true)
    },
    approve: (args) => decide(args, true),
    deny: (args) => decide(args, false, args.event.type === "DENY" ? args.event.reason : undefined),
    settled: (args) => {
      if (args.context.approval !== "submitting") return
      args.set("approval", "settled")
      receiptFocus(args)
    },
    failed: ({ context, set }) => {
      if (context.approval !== "submitting") return
      set("approval", "failed")
      set("decision", null)
    },
    /** A status change: approval, disclosure, announcements, duration. */
    status: (args) => {
      const { context, env, props, set } = args
      const was = context.status
      const now = props.status
      if (now === was) return
      set("status", now)
      if (LIVE.has(now) && context.startedAt === null) set("startedAt", env.clock.now())
      if (FINAL.has(now) && context.startedAt !== null && context.measured === null) {
        set("measured", (env.clock.now() - context.startedAt) / 1000)
      }
      if (now === "awaiting") {
        set("approval", "awaiting")
        set("decision", null)
        set("open", true)
        say(args, messagesOf(props).awaiting(props.name))
        if (props.focusOnRequest === "approval") env.focusApprove?.()
        return
      }
      if (now === "error") say(args, messagesOf(props).failed(props.name))
      if (context.approval === "awaiting" || context.approval === "failed") {
        set("approval", now === "cancelled" ? "expired" : "settled")
        if (now === "denied") set("decision", "denied")
        receiptFocus(args)
      }
    },
  },
  effects: {
    prepareAnnouncer: ({ env }) => env.announcer.prepare(),
    /** A call mounted live starts its clock (a call mounted final shows no measured time). */
    mountStatus: ({ send }) => {
      send({ type: "MOUNT" })
      return undefined
    },
  },
}).machine({
  id: "tool-call",
  initial: "live",
  context: (props) => ({
    approval: props.status === "awaiting" ? "awaiting" : "idle",
    decision: null,
    status: props.status,
    startedAt: null,
    measured: null,
  }),
  values: { open: { fallback: false } },
  onProps: { status: "STATUS" },
  effects: ["prepareAnnouncer", "mountStatus"],
  on: {
    STATUS: { actions: ["status"] },
    MOUNT: { actions: ["markStart"] },
    TOGGLE: { actions: ["toggle"] },
    APPROVE: { guard: "canDecide", actions: ["approve"] },
    DENY: { guard: "canDecide", actions: ["deny"] },
    "DECISION.DONE": { actions: ["settled"] },
    "DECISION.FAILED": { actions: ["failed"] },
  },
  states: { live: {} },
})

export type ToolCallMachine = typeof toolCallMachine
