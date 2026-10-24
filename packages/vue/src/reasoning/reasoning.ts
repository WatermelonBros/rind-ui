// Reasoning parts: wiring only. The machine owns the thinking lifecycle and the disclosure,
// connect every attribute.
import {
  announcerCapability,
  type ChangeDetails,
  type MessageOverrides,
  partId,
  type ReasoningEvent,
  type ReasoningMessages,
  reasoningConnect,
  reasoningDuration,
  reasoningMachine,
  reasoningMessages,
} from "@rind-ui/core"
import {
  computed,
  defineComponent,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  type PropType,
  provide,
  type ShallowRef,
  type SlotsType,
  shallowRef,
  type VNodeChild,
} from "vue"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    reasoning: ReasoningMessages
  }
}

/** What every part's slot receives. */
export interface ReasoningRenderState {
  readonly open: boolean
  readonly thinking: boolean
  /** Seconds, or null when unknown. */
  readonly duration: number | null
}

type Api = ReturnType<typeof reasoningConnect>

interface Ctx {
  readonly api: () => Api
  readonly state: () => ReasoningRenderState
  readonly send: (event: ReasoningEvent) => void
  readonly content: ShallowRef<Element | null>
}
const ReasoningKey: InjectionKey<Ctx> = Symbol("rind-ui.reasoning")
function useReasoning(part: string): Ctx {
  const ctx = inject(ReasoningKey, null)
  if (!ctx) throw new Error(`Reasoning.${part} must be inside Reasoning.Root`)
  return ctx
}

type Slots = SlotsType<{ default?: (state: ReasoningRenderState) => VNodeChild }>

const Root = defineComponent({
  name: "ReasoningRoot",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    id: String,
    /** The model is thinking (your runtime's streaming flag for the reasoning). */
    thinking: { type: Boolean, required: true },
    /** Controlled (`v-model:open`). */
    open: { type: Boolean, default: undefined },
    defaultOpen: { type: Boolean, default: undefined },
    /** Seconds, from your runtime; else measured on the Environment's clock. */
    duration: Number,
    /** Milliseconds before the automatic close (default 1000). */
    autoCloseDelay: Number,
    /** Announce "Thinking…" and "Thought for N seconds" (default true). */
    announce: { type: Boolean, default: undefined },
    messages: Object as PropType<MessageOverrides<ReasoningMessages>>,
    /** Default: the provider's locale. */
    locale: String,
  },
  emits: {
    /** `details.reason`: "auto" (the lifecycle) or "trigger" (the user). */
    openChange: (_open: boolean, _details: ChangeDetails<ReasoningEvent>) => true,
    "update:open": (_open: boolean) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment(announcerCapability)
    const instance = useRootId(() => props.id)
    const loc = useLocale(() => props.locale)
    const messages = useMessages("reasoning", reasoningMessages, () => props.messages)
    const content = shallowRef<Element | null>(null)
    const machineEnv = {
      ...env,
      focusInside: () => {
        const el = content.value
        return el?.contains(el.ownerDocument.activeElement) === true
      },
    }
    const machineProps = () => ({
      id: instance(),
      thinking: props.thinking,
      open: props.open,
      defaultOpen: props.defaultOpen,
      onOpenChange: (open: boolean, details: ChangeDetails<ReasoningEvent>) => {
        emit("openChange", open, details)
        emit("update:open", open)
      },
      duration: props.duration,
      autoCloseDelay: props.autoCloseDelay,
      announce: props.announce,
      messages: messages.value,
      lang: loc.value.locale,
    })
    const { view, send } = useMachine(reasoningMachine, machineProps, machineEnv)
    const state = (): ReasoningRenderState => ({
      open: view.value.values.open,
      thinking: view.value.state === "thinking",
      duration: reasoningDuration(machineProps(), view.value.context),
    })
    const api = computed(() => {
      const s = state()
      return reasoningConnect({
        instance: instance(),
        open: s.open,
        thinking: s.thinking,
        duration: s.duration,
        ids: { content: partId("reasoning", instance(), "content") },
        messages: messages.value,
        locale: loc.value.locale,
      })
    })
    provide(ReasoningKey, { api: () => api.value, state, send, content })
    return () =>
      renderPart(
        "div",
        mergeProps(
          {
            ...normalizeProps(api.value.root()),
            ...(props.id === undefined ? {} : { id: props.id }),
          },
          attrs,
        ),
        slots.default?.(state()),
        props.asChild,
      )
  },
})

const Trigger = defineComponent({
  name: "ReasoningTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useReasoning("Trigger")
    const env = useEnvironment()
    // Tracking from mount, so the press that focuses it is already known as a pointer one.
    onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
    const focused = shallowRef(false)
    const modality = useModality(env.modality, () => focused.value)
    return () => {
      const api = ctx.api()
      return renderPart(
        "button",
        mergeProps(
          joinHandlers(
            normalizeProps(api.trigger({ focused: focused.value, modality: modality.value })),
            {
              onClick: () => ctx.send({ type: "TOGGLE" }),
              onFocus: () => (focused.value = true),
              onBlur: () => (focused.value = false),
            },
          ),
          attrs,
        ),
        slots.default?.(ctx.state()) ?? api.label,
        props.asChild,
      )
    }
  },
})

const Content = defineComponent({
  name: "ReasoningContent",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useReasoning("Content")
    return () => {
      const state = ctx.state()
      if (!state.open) return null
      return renderPart(
        "div",
        mergeProps(normalizeProps(ctx.api().content()), attrs, { ref: refTo(ctx.content) }),
        slots.default?.(state),
        props.asChild,
      )
    }
  },
})

/** The parts, by name: `reasoning.parts.ts` re-exports them as the `Reasoning` namespace. */
export { Content, Root, Trigger }
