"use client"

// Tool Call (add-tool-call): a disclosure Header (the tool and its status in words) over the
// details, and an Approval whose Approve and Deny exist only with `onDecision`. The machine
// owns the disclosure, the decision attempt, the focus after it and the measured duration.

import {
  type ApprovalState,
  announcerCapability,
  type PartProps as CorePartProps,
  focusSafely,
  type MessageOverrides,
  partId,
  type ToolCallDecision,
  type ToolCallEvent,
  type ToolCallMessages,
  type ToolCallStatus,
  toolCallConnect,
  toolCallMachine,
  toolCallMessages,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type KeyboardEvent,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { useRenderedTag } from "../use-rendered-tag"

declare module "../provider" {
  interface RindMessageScopes {
    "tool-call": ToolCallMessages
  }
}

/** What every part's `render` receives. */
export interface ToolCallRenderState {
  readonly status: ToolCallStatus
  readonly open: boolean
  readonly approval: ApprovalState
  readonly decision: "approved" | "denied" | null
  /** Seconds: the prop, else the measured time; null when unknown. */
  readonly duration: number | null
}

type Api = ReturnType<typeof toolCallConnect>

interface Ctx {
  readonly api: Api
  readonly send: (event: ToolCallEvent) => void
  readonly state: ToolCallRenderState
  readonly name: string
  readonly approvalEl: { current: HTMLElement | null }
  readonly receiptEl: { current: HTMLElement | null }
  readonly approveEl: { current: HTMLElement | null }
}
const ToolCallContext = createContext<Ctx | null>(null)
function useToolCall(part: string): Ctx {
  const ctx = useContext(ToolCallContext)
  if (!ctx) throw new Error(`ToolCall.${part} must be inside ToolCall.Root`)
  return ctx
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the part's state. */
  readonly render?: RenderProp<ToolCallRenderState>
}

export type ToolCallRootProps = Omit<PartProps<"div">, "id"> & {
  /** Required. The call's identity, sent with the decision. */
  readonly id: string
  /** Required. The tool's name. */
  readonly name: string
  /** Required. Map it from your runtime. */
  readonly status: ToolCallStatus
  /** Controlled open state. */
  readonly open?: boolean
  /** Uncontrolled open state. Default false. */
  readonly defaultOpen?: boolean
  /** The Header was pressed. */
  readonly onOpenChange?: (open: boolean) => void
  /** The human's decision; without it no buttons are rendered. */
  readonly onDecision?: (decision: ToolCallDecision) => void | Promise<void>
  /** Focus Approve when a request arrives (only when the user expects it). Default "none". */
  readonly focusOnRequest?: "none" | "approval"
  /** Announce a request for approval and a failure. Default "polite". */
  readonly announce?: "off" | "polite"
  /** A high-risk request (the theme uses the danger tone). Default "normal". */
  readonly risk?: "normal" | "high"
  /** Seconds; else measured from the first live status. */
  readonly duration?: number
  /** Overrides the strings (also through the provider). */
  readonly messages?: MessageOverrides<ToolCallMessages>
  /** Default: the provider's locale. */
  readonly locale?: string
}

function Root({
  id,
  name,
  status,
  open,
  defaultOpen,
  onOpenChange,
  onDecision,
  focusOnRequest,
  announce,
  risk = "normal",
  duration,
  messages: ownMessages,
  locale: ownLocale,
  render,
  ref,
  children,
  ...rest
}: ToolCallRootProps) {
  // The parts' ids come from a generated root id: `id` is the call's, not the element's.
  const instance = useRootId(undefined)
  const env = useEnvironment(announcerCapability)
  const messages = useMessages("tool-call", toolCallMessages, ownMessages)
  const { locale } = useLocale(ownLocale)
  const approvalEl = useRef<HTMLElement | null>(null)
  const receiptEl = useRef<HTMLElement | null>(null)
  const approveEl = useRef<HTMLElement | null>(null)
  const [machineEnv] = useState(() => ({
    ...env,
    focusInside: () => {
      const el = approvalEl.current
      return el?.contains(el.ownerDocument.activeElement) === true
    },
    // After the re-render that shows the Receipt.
    focusReceipt: () =>
      queueMicrotask(() => {
        if (receiptEl.current)
          void focusSafely(receiptEl.current, env, "programmatic", env.modality.modality())
      }),
    focusApprove: () =>
      queueMicrotask(() => {
        if (approveEl.current) void focusSafely(approveEl.current, env, "programmatic", "keyboard")
      }),
  }))
  const { view, send } = useMachine(
    toolCallMachine,
    {
      id,
      name,
      status,
      ...(open === undefined ? {} : { open }),
      defaultOpen,
      onOpenChange: (o: boolean) => onOpenChange?.(o),
      ...(onDecision === undefined ? {} : { onDecision }),
      focusOnRequest,
      announce,
      duration,
      messages,
      lang: locale,
    },
    machineEnv,
  )
  const seconds = duration ?? view.context.measured
  const api = toolCallConnect(
    {
      instance,
      name,
      status,
      open: view.values.open === true,
      approval: view.context.approval,
      decision: view.context.decision,
      duration: seconds,
      risk,
      decides: onDecision !== undefined,
      messages,
      ids: {
        header: partId("tool-call", instance, "header"),
        content: partId("tool-call", instance, "content"),
      },
    },
    env,
  )
  const state: ToolCallRenderState = {
    status,
    open: view.values.open === true,
    approval: view.context.approval,
    decision: view.context.decision,
    duration: seconds,
  }
  const ctx: Ctx = { api, send, state, name, approvalEl, receiptEl, approveEl }
  const props = mergeProps({ ...normalizeProps(api.root()), ref }, rest)
  return (
    <ToolCallContext value={ctx}>
      {renderPart("div", { ...props, children }, render, state)}
    </ToolCallContext>
  )
}

/** A button part: modality-aware focus, Enter and Space on a substituted element. */
function useButton(
  part: string,
  own: (ctx: Ctx, b: Parameters<Api["header"]>[0]) => CorePartProps,
  press: (ctx: Ctx) => void,
  render: RenderProp<ToolCallRenderState> | undefined,
) {
  const ctx = useToolCall(part)
  const env = useEnvironment()
  // Tracks the modality from mount, so the first keyboard focus is already visible.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const el = useRef<HTMLElement | null>(null)
  const tag = useRenderedTag("button", render, el)
  const native = tag === "button" || tag === "input"
  const props = joinHandlers(normalizeProps(own(ctx, { tag, focused, modality })), {
    onClick: () => press(ctx),
    // A substituted non-button element: Enter and Space click it, as a button would.
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (native || e.repeat) return
      if (e.key === "Enter") e.currentTarget.click()
      if (e.key === " ") e.preventDefault()
    },
    onKeyUp: (e: KeyboardEvent<HTMLElement>) => {
      if (!native && e.key === " ") e.currentTarget.click()
    },
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  })
  return { ctx, props, el }
}

/** Opens and closes the details; named by the tool and the status in words. */
function Header({ render, ref, ...rest }: PartProps<"button">) {
  const { ctx, props, el } = useButton(
    "Header",
    (c, b) => c.api.header(b),
    (c) => c.send({ type: "TOGGLE" }),
    render,
  )
  return renderPart(
    "button",
    mergeProps({ ...props, ref: composeRefs(el, ref) }, rest),
    render,
    ctx.state,
  )
}

/** Sends `onDecision({ id, approved: true })`; one decision, focusable while submitting. */
function Approve({ render, ref, children, ...rest }: PartProps<"button">) {
  const { ctx, props, el } = useButton(
    "Approve",
    (c, b) => c.api.approve(b),
    (c) => c.send({ type: "APPROVE" }),
    render,
  )
  if (!ctx.api.decides) return null
  return renderPart(
    "button",
    {
      ...mergeProps({ ...props, ref: composeRefs(composeRefs(el, ctx.approveEl), ref) }, rest),
      children: children ?? ctx.api.approveText,
    },
    render,
    ctx.state,
  )
}

/** Sends `onDecision({ id, approved: false })`. */
function Deny({ render, ref, children, ...rest }: PartProps<"button">) {
  const { ctx, props, el } = useButton(
    "Deny",
    (c, b) => c.api.deny(b),
    (c) => c.send({ type: "DENY" }),
    render,
  )
  if (!ctx.api.decides) return null
  return renderPart(
    "button",
    {
      ...mergeProps({ ...props, ref: composeRefs(el, ref) }, rest),
      children: children ?? ctx.api.denyText,
    },
    render,
    ctx.state,
  )
}

/** A text part whose default content comes from the call. */
function textPart(
  part: string,
  tag: "span" | "div",
  own: (api: Api) => CorePartProps,
  text: (ctx: Ctx) => string | null,
) {
  return function TextPart({ render, children, ...rest }: PartProps<"span">) {
    const ctx = useToolCall(part)
    const props = mergeProps(normalizeProps(own(ctx.api)), rest)
    return renderPart(tag, { ...props, children: children ?? text(ctx) }, render, ctx.state)
  }
}

/** The tool's name. */
const Name = textPart(
  "Name",
  "span",
  (a) => a.name(),
  (c) => c.name,
)
/** The status in words; `aria-hidden` (it is in the Header's name). */
const Status = textPart(
  "Status",
  "span",
  (a) => a.status(),
  (c) => c.api.statusText,
)
/** How long it ran. */
const Duration = textPart(
  "Duration",
  "span",
  (a) => a.duration(),
  (c) => c.api.durationText,
)
/** The details region: Input, Output, Error, Approval. */
const Content = textPart(
  "Content",
  "div",
  (a) => a.content(),
  () => null,
)
/** The arguments (a Code Block or a JSON Tree View). */
const Input = textPart(
  "Input",
  "div",
  (a) => a.input(),
  () => null,
)
/** The result. */
const Output = textPart(
  "Output",
  "div",
  (a) => a.output(),
  () => null,
)
/** The error. */
const ErrorPart = textPart(
  "Error",
  "div",
  (a) => a.error(),
  () => null,
)
/** What is asked. */
const ApprovalTitle = textPart(
  "ApprovalTitle",
  "div",
  (a) => a.approvalTitle(),
  () => null,
)
/** Why, or what it will do. */
const ApprovalDescription = textPart(
  "ApprovalDescription",
  "div",
  (a) => a.approvalDescription(),
  () => null,
)

/** A group asking for a decision; shows its outcome after. Rendered once one is asked. */
function Approval({ render, ref, ...rest }: PartProps<"div">) {
  const ctx = useToolCall("Approval")
  if (!ctx.api.showsApproval) return null
  return renderPart(
    "div",
    mergeProps(
      { ...normalizeProps(ctx.api.approval()), ref: composeRefs(ctx.approvalEl, ref) },
      rest,
    ),
    render,
    ctx.state,
  )
}

/** `role="status"`: "Approved", "Denied" or "Request expired"; takes the focus after a decision. */
function Receipt({ render, ref, children, ...rest }: PartProps<"div">) {
  const ctx = useToolCall("Receipt")
  const props = mergeProps(
    { ...normalizeProps(ctx.api.receipt()), ref: composeRefs(ctx.receiptEl, ref) },
    rest,
  )
  return renderPart(
    "div",
    { ...props, children: children ?? ctx.api.receiptText },
    render,
    ctx.state,
  )
}

/** The parts, by name: `tool-call.parts.ts` re-exports them as the `ToolCall` namespace. */
export {
  Approval,
  ApprovalDescription,
  ApprovalTitle,
  Approve,
  Content,
  Deny,
  Duration,
  ErrorPart as Error,
  Header,
  Input,
  Name,
  Output,
  Receipt,
  Root,
  Status,
}
