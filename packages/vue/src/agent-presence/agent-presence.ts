// Agent Presence (add-agent-presence): a voice agent's state in words and as a visual. The
// audio level is never state: `startLevelLoop` writes it to the Root each frame (custom
// properties and a coarse `data-level`) while listening or speaking, motion allowed.

import {
  type AgentPresenceMessages,
  type AgentState,
  agentPresenceConnect,
  agentPresenceMachine,
  agentPresenceMessages,
  announcerCapability,
  type LevelChannel,
  type MessageOverrides,
  type PartProps,
  partId,
  startLevelLoop,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import {
  computed,
  defineComponent,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"

declare module "../provider" {
  interface RindMessageScopes {
    "agent-presence": AgentPresenceMessages
  }
}

/** What every part's slot receives. */
export interface AgentPresenceRenderState {
  readonly state: AgentState
  readonly previous: AgentState | null
  readonly stale: boolean
  readonly muted: boolean
  readonly motion: "full" | "reduced" | "off"
}

type Api = ReturnType<typeof agentPresenceConnect>

interface Ctx {
  readonly api: () => Api
  readonly state: () => AgentPresenceRenderState
  readonly registry: PartRegistry<"status">
  readonly statusId: () => string
}
const AgentPresenceKey: InjectionKey<Ctx> = Symbol("rind-ui.agent-presence")
function useAgentPresence(part: string): Ctx {
  const ctx = inject(AgentPresenceKey, null)
  if (!ctx) throw new Error(`AgentPresence.${part} must be inside AgentPresence.Root`)
  return ctx
}
type Slots = SlotsType<{ default?: (state: AgentPresenceRenderState) => VNodeChild }>

const Root = defineComponent({
  name: "AgentPresenceRoot",
  inheritAttrs: false,
  props: {
    /** Required. Map it from your voice runtime. */
    state: { type: String as PropType<AgentState>, required: true },
    /** Why, for `error`. */
    reason: String,
    /** The microphone is muted. */
    muted: Boolean,
    /** The audio level 0–1, read each frame while listening (input) or speaking (output). */
    getLevel: Function as PropType<(channel: LevelChannel) => number>,
    /** Announce the first listening, a long think, the end and errors (assertive). */
    announce: String as PropType<"off" | "polite">,
    /** A think is announced after this (ms). Default 1500. */
    thinkingDelay: Number,
    /** A state lasting longer is stale (`data-stale`, `stale` event). */
    staleAfter: Object as PropType<Partial<Record<AgentState, number>>>,
    /** "off" stops the level loop; "auto" follows the reduced-motion preference. Default "auto". */
    motion: { type: String as PropType<"auto" | "off">, default: "auto" },
    messages: Object as PropType<MessageOverrides<AgentPresenceMessages>>,
    /** Default: the provider's locale. */
    locale: String,
    id: String,
    ...asChildProp,
  },
  emits: {
    /** Each change. */
    stateChange: (_state: AgentState, _details: { from: AgentState }) => true,
    /** A state became stale. */
    stale: (_state: AgentState) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const instance = useRootId(() => props.id)
    const env = useEnvironment(announcerCapability)
    const messages = useMessages("agent-presence", agentPresenceMessages, () => props.messages)
    const locale = useLocale(() => props.locale)
    const registry = usePartRegistry<"status">({ scope: "agent-presence", root: instance() })
    const composed = useRenderedId(registry, "status")
    const reduced = shallowRef(env.motion.reducedMotion())
    onMounted(() => {
      reduced.value = env.motion.reducedMotion()
      onBeforeUnmount(env.motion.subscribeReducedMotion((r) => (reduced.value = r)))
    })
    const motion = () => (props.motion === "off" ? "off" : reduced.value ? "reduced" : "full")
    const { view } = useMachine(
      agentPresenceMachine,
      () => ({
        state: props.state,
        reason: props.reason,
        muted: props.muted,
        announce: props.announce,
        thinkingDelay: props.thinkingDelay,
        staleAfter: props.staleAfter,
        onStale: (s: AgentState) => emit("stale", s),
        onStateChange: (s: AgentState, d: { from: AgentState }) => emit("stateChange", s, d),
        messages: messages.value,
        id: instance(),
        lang: locale.value.locale,
      }),
      env,
    )
    const api = computed(() =>
      agentPresenceConnect({
        instance: instance(),
        state: view.value.context.current,
        previous: view.value.context.previous,
        stale: view.value.context.stale,
        muted: props.muted,
        motion: motion(),
        reason: props.reason,
        messages: messages.value,
      }),
    )
    // The level is written to the Root each frame, outside rendering (design §4).
    const rootEl = shallowRef<Element | null>(null)
    onMounted(() => {
      let stop: (() => void) | undefined
      const restart = (channel: LevelChannel | null) => {
        stop?.()
        stop = undefined
        const el = rootEl.value
        if (!(el instanceof HTMLElement) || channel === null || !props.getLevel) return
        stop = startLevelLoop(el, {
          channel,
          getLevel: (c) => props.getLevel?.(c) ?? 0,
          scheduler: env.scheduler,
          now: () => env.clock.now(),
        })
      }
      watch(
        () => (props.getLevel ? api.value.levelChannel : null),
        (channel) => restart(channel),
        { immediate: true },
      )
      onBeforeUnmount(() => stop?.())
    })
    const state = (): AgentPresenceRenderState => ({
      state: view.value.context.current,
      previous: view.value.context.previous,
      stale: view.value.context.stale,
      muted: props.muted,
      motion: motion(),
    })
    provide(AgentPresenceKey, {
      api: () => api.value,
      state,
      registry,
      statusId: () => partId("agent-presence", instance(), "status"),
    })
    return () =>
      renderPart(
        "div",
        mergeProps(
          {
            ...normalizeProps(api.value.root()),
            ...(props.id === undefined ? {} : { id: props.id }),
            ref: refTo(rootEl),
          },
          attrs,
        ),
        [
          slots.default?.(state()),
          composed.value === undefined
            ? h("span", normalizeProps(api.value.hiddenStatus()), api.value.statusText)
            : null,
        ],
        props.asChild,
      )
  },
})

function simplePart(name: string, tag: "div" | "span", own: (api: Api) => PartProps) {
  return defineComponent({
    name: `AgentPresence${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    slots: Object as Slots,
    setup(props, { attrs, slots }) {
      const ctx = useAgentPresence(name)
      return () =>
        renderPart(
          tag,
          mergeProps(normalizeProps(own(ctx.api())), attrs),
          slots.default?.(ctx.state()),
          props.asChild,
        )
    },
  })
}

/** `aria-hidden`: put your orb, bars or canvas here. */
const Visual = simplePart("Visual", "div", (a) => a.visual())
/** The agent's name. */
const Label = simplePart("Label", "span", (a) => a.label())
/** An extra line: the error's reason, "still thinking". */
const Detail = simplePart("Detail", "span", (a) => a.detail())

/** The state in words ("Listening"); not a live region. Rendered hidden when not composed. */
const Status = defineComponent({
  name: "AgentPresenceStatus",
  inheritAttrs: false,
  props: { id: String, ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useAgentPresence("Status")
    const own = () => props.id ?? ctx.statusId()
    useRegisterPart(ctx.registry, "status", own)
    return () =>
      renderPart(
        "span",
        mergeProps({ ...normalizeProps(ctx.api().status()), id: own() }, attrs),
        slots.default?.(ctx.state()) ?? ctx.api().statusText,
        props.asChild,
      )
  },
})

/** The parts, by name: `agent-presence.parts.ts` re-exports them as the `AgentPresence` namespace. */
export { Detail, Label, Root, Status, Visual }
