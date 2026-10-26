/** @jsxImportSource solid-js */
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
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  Show,
  splitProps,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

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
  readonly api: Accessor<Api>
  readonly send: (event: ToolCallEvent) => void
  readonly state: ToolCallRenderState
  readonly name: Accessor<string>
  readonly approvalEl: { current: HTMLElement | null }
  readonly receiptEl: { current: HTMLElement | null }
  readonly approveEl: { current: HTMLElement | null }
}
const ToolCallContext = createContext<Ctx>()
function useToolCall(part: string): Ctx {
  const ctx = useContext(ToolCallContext)
  if (!ctx) throw new Error(`ToolCall.${part} must be inside ToolCall.Root`)
  return ctx
}

type PartProps<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the part's state. */
  readonly render?: RenderProp<ToolCallRenderState> | undefined
  readonly children?: JSX.Element | ((state: ToolCallRenderState) => JSX.Element)
}

export type ToolCallRootProps = Omit<PartProps<JSX.HTMLAttributes<HTMLDivElement>>, "id"> & {
  /** Required. The call's identity, sent with the decision. */
  readonly id: string
  /** Required. The tool's name. */
  readonly name: string
  /** Required. Map it from your runtime. */
  readonly status: ToolCallStatus
  /** Controlled open state. */
  readonly open?: boolean | undefined
  /** Uncontrolled open state. Default false. */
  readonly defaultOpen?: boolean | undefined
  /** The Header was pressed. */
  readonly onOpenChange?: ((open: boolean) => void) | undefined
  /** The human's decision; without it no buttons are rendered. */
  readonly onDecision?: ((decision: ToolCallDecision) => void | Promise<void>) | undefined
  /** Focus Approve when a request arrives (only when the user expects it). Default "none". */
  readonly focusOnRequest?: "none" | "approval" | undefined
  /** Announce a request for approval and a failure. Default "polite". */
  readonly announce?: "off" | "polite" | undefined
  /** A high-risk request (the theme uses the danger tone). Default "normal". */
  readonly risk?: "normal" | "high" | undefined
  /** Seconds; else measured from the first live status. */
  readonly duration?: number | undefined
  readonly messages?: MessageOverrides<ToolCallMessages> | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
}

function Root(props: ToolCallRootProps) {
  const [own, rest] = splitProps(props, [
    "id",
    "name",
    "status",
    "open",
    "defaultOpen",
    "onOpenChange",
    "onDecision",
    "focusOnRequest",
    "announce",
    "risk",
    "duration",
    "messages",
    "locale",
    "render",
    "children",
  ])
  // The parts' ids come from a generated root id: `id` is the call's, not the element's.
  const instance = useRootId(() => undefined)
  const env = useEnvironment(announcerCapability)
  const messages = useMessages("tool-call", toolCallMessages, () => own.messages)
  const locale = useLocale(() => own.locale)
  const approvalEl = { current: null as HTMLElement | null }
  const receiptEl = { current: null as HTMLElement | null }
  const approveEl = { current: null as HTMLElement | null }
  const { view, send } = useMachine(
    toolCallMachine,
    () => ({
      id: own.id,
      name: own.name,
      status: own.status,
      ...(own.open === undefined ? {} : { open: own.open }),
      defaultOpen: own.defaultOpen,
      onOpenChange: (o: boolean) => own.onOpenChange?.(o),
      ...(own.onDecision === undefined
        ? {}
        : { onDecision: (d: ToolCallDecision) => own.onDecision?.(d) }),
      focusOnRequest: own.focusOnRequest,
      announce: own.announce,
      duration: own.duration,
      messages: messages(),
      lang: locale().locale,
    }),
    {
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
          if (approveEl.current)
            void focusSafely(approveEl.current, env, "programmatic", "keyboard")
        }),
    },
  )
  const seconds = () => own.duration ?? view().context.measured
  const api = createMemo(() =>
    toolCallConnect(
      {
        instance: instance(),
        name: own.name,
        status: own.status,
        open: view().values.open === true,
        approval: view().context.approval,
        decision: view().context.decision,
        duration: seconds(),
        risk: own.risk ?? "normal",
        decides: own.onDecision !== undefined,
        messages: messages(),
        ids: {
          header: partId("tool-call", instance(), "header"),
          content: partId("tool-call", instance(), "content"),
        },
      },
      env,
    ),
  )
  const state = reactive<ToolCallRenderState>(() => ({
    status: own.status,
    open: view().values.open === true,
    approval: view().context.approval,
    decision: view().context.decision,
    duration: seconds(),
  }))
  const ctx: Ctx = {
    api,
    send,
    state,
    name: () => own.name,
    approvalEl,
    receiptEl,
    approveEl,
  }
  const merged = createMemo(() => mergeProps(normalizeProps(api().root()), rest))
  const children = () => resolveChildren(own.children, state)
  return (
    <ToolCallContext.Provider value={ctx}>
      {renderPart(own.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </ToolCallContext.Provider>
  )
}

type ButtonProps = PartProps<JSX.ButtonHTMLAttributes<HTMLButtonElement>>

/** A button part: modality-aware focus, Enter and Space on a substituted element. */
function button(
  part: string,
  own: (api: Api, b: Parameters<Api["header"]>[0]) => CorePartProps,
  press: (ctx: Ctx) => void,
  setEl?: (ctx: Ctx, el: HTMLElement | null) => void,
) {
  return (props: ButtonProps) => {
    const [local, rest] = splitProps(props, ["render", "children"])
    const ctx = useToolCall(part)
    const env = useEnvironment()
    // Tracks the modality from mount, so the first keyboard focus is already visible.
    afterMount(() => onCleanup(env.modality.subscribe(() => {})))
    const [focused, setFocused] = createSignal(false)
    const modality = useModality(env.modality, focused)
    const [el, setElement] = createSignal<HTMLElement | null>(null)
    const [measured, setMeasured] = createSignal<string | undefined>()
    afterMount(() => {
      const node = el()
      if (local.render && node) setMeasured(node.tagName.toLowerCase())
    })
    const tag = () => (local.render ? (measured() ?? "button") : "button")
    const native = () => tag() === "button" || tag() === "input"
    const merged = createMemo(() =>
      mergeProps(
        {
          ...joinHandlers(
            normalizeProps(
              own(ctx.api(), { tag: tag(), focused: focused(), modality: modality() }),
            ),
            {
              onClick: () => press(ctx),
              // A substituted non-button element: Enter and Space click it, as a button would.
              onKeyDown: (e: KeyboardEvent) => {
                if (native() || e.repeat) return
                if (e.key === "Enter") (e.currentTarget as HTMLElement).click()
                if (e.key === " ") e.preventDefault()
              },
              onKeyUp: (e: KeyboardEvent) => {
                if (!native() && e.key === " ") (e.currentTarget as HTMLElement).click()
              },
              onFocusIn: () => setFocused(true),
              onFocusOut: () => setFocused(false),
            },
          ),
          ref: (node: HTMLElement) => {
            setElement(node)
            setEl?.(ctx, node)
          },
        },
        rest,
      ),
    )
    const children = () => resolveChildren(local.children, ctx.state)
    return renderPart(local.render, merged, ctx.state, children, (p) => (
      <button {...p}>{children()}</button>
    ))
  }
}

/** Opens and closes the details; named by the tool and the status in words. */
const Header = button(
  "Header",
  (api, b) => api.header(b),
  (ctx) => ctx.send({ type: "TOGGLE" }),
)

const ApproveButton = button(
  "Approve",
  (api, b) => api.approve(b),
  (ctx) => ctx.send({ type: "APPROVE" }),
  (ctx, el) => {
    ctx.approveEl.current = el
  },
)
/** Sends `onDecision({ id, approved: true })`; one decision, focusable while submitting. */
function Approve(props: ButtonProps) {
  const ctx = useToolCall("Approve")
  return (
    <Show when={ctx.api().decides}>
      <ApproveButton {...props} />
    </Show>
  )
}

const DenyButton = button(
  "Deny",
  (api, b) => api.deny(b),
  (ctx) => ctx.send({ type: "DENY" }),
)
/** Sends `onDecision({ id, approved: false })`. */
function Deny(props: ButtonProps) {
  const ctx = useToolCall("Deny")
  return (
    <Show when={ctx.api().decides}>
      <DenyButton {...props} />
    </Show>
  )
}

type DivProps = PartProps<JSX.HTMLAttributes<HTMLElement>>

/** A text part whose default content comes from the call. */
function textPart(
  part: string,
  tag: "span" | "div",
  own: (api: Api) => CorePartProps,
  text: (ctx: Ctx) => string | null,
) {
  return (props: DivProps) => {
    const [local, rest] = splitProps(props, ["render", "children"])
    const ctx = useToolCall(part)
    const merged = createMemo(() => mergeProps(normalizeProps(own(ctx.api())), rest))
    const children = () => resolveChildren(local.children, ctx.state) ?? text(ctx)
    return renderPart(local.render, merged, ctx.state, children, (p) =>
      tag === "span" ? <span {...p}>{children()}</span> : <div {...p}>{children()}</div>,
    )
  }
}

/** The tool's name. */
const Name = textPart(
  "Name",
  "span",
  (a) => a.name(),
  (c) => c.name(),
)
/** The status in words; `aria-hidden` (it is in the Header's name). */
const Status = textPart(
  "Status",
  "span",
  (a) => a.status(),
  (c) => c.api().statusText,
)
/** How long it ran. */
const Duration = textPart(
  "Duration",
  "span",
  (a) => a.duration(),
  (c) => c.api().durationText,
)
/** The details region (`hidden` while closed): Input, Output, Error, Approval. */
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
function Approval(props: DivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useToolCall("Approval")
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(ctx.api().approval()),
        ref: (el: HTMLElement) => {
          ctx.approvalEl.current = el
        },
      },
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return (
    <Show when={ctx.api().showsApproval}>
      {renderPart(local.render, merged, ctx.state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </Show>
  )
}

/** `role="status"`: "Approved", "Denied" or "Request expired"; takes the focus after a decision. */
function Receipt(props: DivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useToolCall("Receipt")
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(ctx.api().receipt()),
        ref: (el: HTMLElement) => {
          ctx.receiptEl.current = el
        },
      },
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, ctx.state) ?? ctx.api().receiptText
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
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
