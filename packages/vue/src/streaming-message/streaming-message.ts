// Streaming Message parts: wiring only. The machine owns the reveal and the announcements,
// connect every attribute.
import {
  announcerCapability,
  displayedText,
  type MessageOverrides,
  type StreamingAnnounce,
  type StreamingMessageMessages,
  type StreamingMessageState,
  type StreamingSmooth,
  type StreamingStatus,
  streamingMessageConnect,
  streamingMessageMachine,
  streamingMessageMessages,
} from "@rind-ui/core"
import {
  defineComponent,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  type PropType,
  provide,
  type SlotsType,
  type VNodeChild,
} from "vue"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"

declare module "../provider" {
  interface RindMessageScopes {
    "streaming-message": StreamingMessageMessages
  }
}

/** What every part's slot receives. */
export interface StreamingMessageRenderState {
  readonly state: StreamingMessageState
  /** The displayed text (a prefix of `text` while the reveal catches up). */
  readonly text: string
  readonly busy: boolean
}

interface Ctx {
  readonly state: () => StreamingMessageRenderState
  readonly instance: () => string
}
const StreamingKey: InjectionKey<Ctx> = Symbol("rind-ui.streaming-message")
function useStreamingMessage(part: string): Ctx {
  const ctx = inject(StreamingKey, null)
  if (!ctx) throw new Error(`StreamingMessage.${part} must be inside StreamingMessage.Root`)
  return ctx
}

type Slots = SlotsType<{ default?: (state: StreamingMessageRenderState) => VNodeChild }>

const Root = defineComponent({
  name: "StreamingMessageRoot",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    id: String,
    /** Everything received so far. */
    text: { type: String, required: true },
    /** The response's status, from your chat runtime. */
    status: { type: String as PropType<StreamingStatus>, required: true },
    /** Reveal bursty chunks evenly (default true); off under reduced motion. */
    smooth: { type: [Boolean, Object] as PropType<boolean | StreamingSmooth>, default: undefined },
    /** What is announced (default "status": the lifecycle only). */
    announce: String as PropType<StreamingAnnounce>,
    messages: Object as PropType<MessageOverrides<StreamingMessageMessages>>,
    /** Default: the provider's locale (sentence splitting). */
    locale: String,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const env = useEnvironment(announcerCapability)
    const instance = useRootId(() => props.id)
    const loc = useLocale(() => props.locale)
    const messages = useMessages(
      "streaming-message",
      streamingMessageMessages,
      () => props.messages,
    )
    const machineProps = () => ({
      id: instance(),
      text: props.text,
      status: props.status,
      smooth: props.smooth,
      announce: props.announce,
      messages: messages.value,
      lang: loc.value.locale,
    })
    const { view, send } = useMachine(streamingMessageMachine, machineProps, env)
    // Read after hydration, then followed: the server and the first client render agree.
    onMounted(() => {
      send({ type: "MOTION.CHANGED", reduced: env.motion.reducedMotion() })
      onBeforeUnmount(
        env.motion.subscribeReducedMotion((reduced) => send({ type: "MOTION.CHANGED", reduced })),
      )
    })
    const api = () =>
      streamingMessageConnect({
        instance: instance(),
        state: view.value.state as StreamingMessageState,
        plain: false,
      })
    const state = (): StreamingMessageRenderState => {
      const s = view.value.state as StreamingMessageState
      return {
        state: s,
        text: displayedText(s, machineProps(), view.value.context),
        busy: api().busy,
      }
    }
    provide(StreamingKey, { state, instance })
    return () =>
      renderPart(
        "div",
        mergeProps(
          { ...normalizeProps(api().root()), ...(props.id === undefined ? {} : { id: props.id }) },
          attrs,
        ),
        slots.default?.(state()),
        props.asChild,
      )
  },
})

/** The displayed text, plain; or your renderer (markdown) in the slot, given the state's `text`. */
const Content = defineComponent({
  name: "StreamingMessageContent",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useStreamingMessage("Content")
    return () => {
      const state = ctx.state()
      const plain = slots.default === undefined
      const api = streamingMessageConnect({ instance: ctx.instance(), state: state.state, plain })
      return renderPart(
        "div",
        mergeProps(normalizeProps(api.content()), attrs),
        plain ? state.text : slots.default?.(state),
        props.asChild,
      )
    }
  },
})

const Caret = defineComponent({
  name: "StreamingMessageCaret",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useStreamingMessage("Caret")
    return () => {
      const state = ctx.state()
      if (!state.busy) return null
      const api = streamingMessageConnect({
        instance: ctx.instance(),
        state: state.state,
        plain: false,
      })
      return renderPart(
        "span",
        mergeProps(normalizeProps(api.caret()), attrs),
        slots.default?.(state),
        props.asChild,
      )
    }
  },
})

/** The parts, by name: `streaming-message.parts.ts` re-exports them as the `StreamingMessage` namespace. */
export { Caret, Content, Root }
