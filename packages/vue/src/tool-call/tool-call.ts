// Tool Call (add-tool-call): a disclosure Header (the tool and its status in words) over the
// details, and an Approval whose Approve and Deny exist only with `onDecision`. The machine
// owns the disclosure, the decision attempt, the focus after it and the measured duration.

import {
  type ApprovalState,
  announcerCapability,
  focusSafely,
  type MessageOverrides,
  type PartProps,
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
  computed,
  defineComponent,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  type VNodeChild,
} from "vue"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { asChildProp, renderedTag, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    "tool-call": ToolCallMessages
  }
}

/** What every part's slot receives. */
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
  readonly api: () => Api
  readonly send: (event: ToolCallEvent) => void
  readonly state: () => ToolCallRenderState
  readonly name: () => string
  readonly approvalEl: { value: Element | null }
  readonly receiptEl: { value: Element | null }
  readonly approveEl: { value: Element | null }
}
const ToolCallKey: InjectionKey<Ctx> = Symbol("rind-ui.tool-call")
function useToolCall(part: string): Ctx {
  const ctx = inject(ToolCallKey, null)
  if (!ctx) throw new Error(`ToolCall.${part} must be inside ToolCall.Root`)
  return ctx
}
type Slots = SlotsType<{ default?: (state: ToolCallRenderState) => VNodeChild }>
const asElement = (el: Element | null) => (el instanceof HTMLElement ? el : null)

const Root = defineComponent({
  name: "ToolCallRoot",
  inheritAttrs: false,
  props: {
    /** Required. The call's identity, sent with the decision. */
    id: { type: String, required: true },
    /** Required. The tool's name. */
    name: { type: String, required: true },
    /** Required. Map it from your runtime. */
    status: { type: String as PropType<ToolCallStatus>, required: true },
    /** Controlled open state (`v-model:open`). */
    open: { type: Boolean, default: undefined },
    /** Uncontrolled open state. Default false. */
    defaultOpen: { type: Boolean, default: undefined },
    /** The human's decision; without it no buttons are rendered. */
    onDecision: Function as PropType<(decision: ToolCallDecision) => void | Promise<void>>,
    /** Focus Approve when a request arrives (only when the user expects it). Default "none". */
    focusOnRequest: String as PropType<"none" | "approval">,
    /** Announce a request for approval and a failure. Default "polite". */
    announce: String as PropType<"off" | "polite">,
    /** A high-risk request (the theme uses the danger tone). Default "normal". */
    risk: { type: String as PropType<"normal" | "high">, default: "normal" },
    /** Seconds; else measured from the first live status. */
    duration: Number,
    messages: Object as PropType<MessageOverrides<ToolCallMessages>>,
    /** Default: the provider's locale. */
    locale: String,
    ...asChildProp,
  },
  emits: {
    /** The Header was pressed. */
    openChange: (_open: boolean) => true,
    "update:open": (_open: boolean) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    // The parts' ids come from a generated root id: `id` is the call's, not the element's.
    const instance = useRootId(() => undefined)
    const env = useEnvironment(announcerCapability)
    const messages = useMessages("tool-call", toolCallMessages, () => props.messages)
    const locale = useLocale(() => props.locale)
    const approvalEl = shallowRef<Element | null>(null)
    const receiptEl = shallowRef<Element | null>(null)
    const approveEl = shallowRef<Element | null>(null)
    const { view, send } = useMachine(
      toolCallMachine,
      () => ({
        id: props.id,
        name: props.name,
        status: props.status,
        ...(props.open === undefined ? {} : { open: props.open }),
        defaultOpen: props.defaultOpen,
        onOpenChange: (o: boolean) => {
          emit("openChange", o)
          emit("update:open", o)
        },
        ...(props.onDecision === undefined ? {} : { onDecision: props.onDecision }),
        focusOnRequest: props.focusOnRequest,
        announce: props.announce,
        duration: props.duration,
        messages: messages.value,
        lang: locale.value.locale,
      }),
      {
        ...env,
        focusInside: () => {
          const el = approvalEl.value
          return el?.contains(el.ownerDocument.activeElement) === true
        },
        // After the re-render that shows the Receipt.
        focusReceipt: () =>
          queueMicrotask(() => {
            const el = asElement(receiptEl.value)
            if (el) void focusSafely(el, env, "programmatic", env.modality.modality())
          }),
        focusApprove: () =>
          queueMicrotask(() => {
            const el = asElement(approveEl.value)
            if (el) void focusSafely(el, env, "programmatic", "keyboard")
          }),
      },
    )
    const seconds = () => props.duration ?? view.value.context.measured
    const api = computed(() => {
      const i = instance()
      return toolCallConnect(
        {
          instance: i,
          name: props.name,
          status: props.status,
          open: view.value.values.open === true,
          approval: view.value.context.approval,
          decision: view.value.context.decision,
          duration: seconds(),
          risk: props.risk,
          decides: props.onDecision !== undefined,
          messages: messages.value,
          ids: {
            header: partId("tool-call", i, "header"),
            content: partId("tool-call", i, "content"),
          },
        },
        env,
      )
    })
    const state = (): ToolCallRenderState => ({
      status: props.status,
      open: view.value.values.open === true,
      approval: view.value.context.approval,
      decision: view.value.context.decision,
      duration: seconds(),
    })
    provide(ToolCallKey, {
      api: () => api.value,
      send,
      state,
      name: () => props.name,
      approvalEl,
      receiptEl,
      approveEl,
    })
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(api.value.root()), attrs),
        slots.default?.(state()),
        props.asChild,
      )
  },
})

/** A button part: modality-aware focus, Enter and Space on a substituted element. */
function buttonPart(
  name: string,
  own: (api: Api, b: Parameters<Api["header"]>[0]) => PartProps,
  event: ToolCallEvent,
  options: { readonly decision?: boolean; readonly approve?: boolean } = {},
) {
  return defineComponent({
    name: `ToolCall${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    slots: Object as Slots,
    setup(props, { attrs, slots }) {
      const ctx = useToolCall(name)
      const env = useEnvironment()
      // Tracks the modality from mount, so the first keyboard focus is already visible.
      onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
      const focused = shallowRef(false)
      const modality = useModality(env.modality, () => focused.value)
      const el = shallowRef<Element | null>(null)
      const measured = shallowRef<string | null>(null)
      const measure = () => (measured.value = el.value?.tagName.toLowerCase() ?? null)
      onMounted(measure)
      onUpdated(measure)
      const setEl = (node: unknown) => {
        refTo(el)(node)
        if (options.approve) ctx.approveEl.value = el.value
      }
      return () => {
        if (options.decision && !ctx.api().decides) return null
        const children = slots.default?.(ctx.state())
        const tag = renderedTag("button", children, props.asChild, measured.value)
        const native = tag === "button" || tag === "input"
        return renderPart(
          "button",
          mergeProps(
            {
              ...joinHandlers(
                normalizeProps(
                  own(ctx.api(), { tag, focused: focused.value, modality: modality.value }),
                ),
                {
                  onClick: () => ctx.send(event),
                  // A substituted non-button element: Enter and Space click it, as a button would.
                  onKeydown: (e: KeyboardEvent) => {
                    if (native || e.repeat) return
                    if (e.key === "Enter") (e.currentTarget as HTMLElement).click()
                    if (e.key === " ") e.preventDefault()
                  },
                  onKeyup: (e: KeyboardEvent) => {
                    if (!native && e.key === " ") (e.currentTarget as HTMLElement).click()
                  },
                  onFocusin: () => (focused.value = true),
                  onFocusout: () => (focused.value = false),
                },
              ),
              ref: setEl,
            },
            attrs,
          ),
          children,
          props.asChild,
        )
      }
    },
  })
}

/** Opens and closes the details; named by the tool and the status in words. */
const Header = buttonPart("Header", (api, b) => api.header(b), { type: "TOGGLE" })
/** Sends `onDecision({ id, approved: true })`; one decision, focusable while submitting. */
const Approve = buttonPart(
  "Approve",
  (api, b) => api.approve(b),
  { type: "APPROVE" },
  { decision: true, approve: true },
)
/** Sends `onDecision({ id, approved: false })`. */
const Deny = buttonPart("Deny", (api, b) => api.deny(b), { type: "DENY" }, { decision: true })

/** A part whose default content comes from the call. */
function textPart(
  name: string,
  tag: "span" | "div",
  own: (api: Api) => PartProps,
  text: (ctx: Ctx) => string | null,
) {
  return defineComponent({
    name: `ToolCall${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    slots: Object as Slots,
    setup(props, { attrs, slots }) {
      const ctx = useToolCall(name)
      return () =>
        renderPart(
          tag,
          mergeProps(normalizeProps(own(ctx.api())), attrs),
          slots.default?.(ctx.state()) ?? text(ctx),
          props.asChild,
        )
    },
  })
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
const Approval = defineComponent({
  name: "ToolCallApproval",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useToolCall("Approval")
    return () =>
      ctx.api().showsApproval
        ? renderPart(
            "div",
            mergeProps(
              { ...normalizeProps(ctx.api().approval()), ref: refTo(ctx.approvalEl) },
              attrs,
            ),
            slots.default?.(ctx.state()),
            props.asChild,
          )
        : null
  },
})

/** `role="status"`: "Approved", "Denied" or "Request expired"; takes the focus after a decision. */
const Receipt = defineComponent({
  name: "ToolCallReceipt",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useToolCall("Receipt")
    return () =>
      renderPart(
        "div",
        mergeProps({ ...normalizeProps(ctx.api().receipt()), ref: refTo(ctx.receiptEl) }, attrs),
        slots.default?.(ctx.state()) ?? ctx.api().receiptText,
        props.asChild,
      )
  },
})

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
