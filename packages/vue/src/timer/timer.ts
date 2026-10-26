import {
  announcerCapability,
  type MessageOverrides,
  type PartProps,
  type TimerAction,
  type TimerEvent,
  type TimerMessages,
  type TimerState,
  type TimerTickDetails,
  type TimerUnit,
  timerActionEvent,
  timerConfig,
  timerConnect,
  timerMachine,
  timerMessages,
  visibilityCapability,
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
    timer: TimerMessages
  }
}

/** What every part's slot receives. */
export interface TimerRenderState {
  readonly state: TimerState
  /** The value in ms. */
  readonly value: number
  /** 0–1 from start to target; 0 without a target. */
  readonly progress: number
}

/** What an ActionTrigger's slot receives. */
export interface TimerActionTriggerRenderState extends TimerRenderState {
  readonly action: TimerAction
  /** The toggle's word for the current state ("Start", "Pause", "Resume"). */
  readonly label: string
  /** The action does nothing in the current state. */
  readonly disabled: boolean
}

interface Ctx {
  readonly api: () => ReturnType<typeof timerConnect>
  readonly send: (event: TimerEvent) => void
  readonly state: () => TimerRenderState
  readonly messages: () => TimerMessages
}
const TimerKey: InjectionKey<Ctx> = Symbol("rind-ui.timer")
function useTimer(part: string): Ctx {
  const ctx = inject(TimerKey, null)
  if (!ctx) throw new Error(`Timer.${part} must be inside Timer.Root`)
  return ctx
}
const UnitKey: InjectionKey<() => TimerUnit> = Symbol("rind-ui.timer-unit")
function useUnit(part: string, own: () => TimerUnit | undefined): () => TimerUnit {
  const inherited = inject(UnitKey, null)
  return () => {
    const unit = own() ?? inherited?.()
    if (!unit) throw new Error(`Timer.${part} needs a type, or to be inside Timer.Item`)
    return unit
  }
}
type Slots = SlotsType<{ default?: (state: TimerRenderState) => VNodeChild }>

const Root = defineComponent({
  name: "TimerRoot",
  inheritAttrs: false,
  props: {
    /** Count down from `startMs` to `targetMs` instead of up. */
    countdown: Boolean,
    /** Where the timer starts (ms). Default 0. */
    startMs: Number,
    /** Where it completes (ms). A countdown defaults to 0; a stopwatch without it never completes. */
    targetMs: Number,
    /** Runs from mount. */
    autoStart: Boolean,
    /** The display step and tick period (ms). Default 1000. */
    interval: Number,
    messages: Object as PropType<MessageOverrides<TimerMessages>>,
    /** Default: the provider's locale (digits and the spoken duration). */
    locale: String,
    id: String,
    ...asChildProp,
  },
  emits: {
    /** Every tick while running. */
    tick: (_details: TimerTickDetails) => true,
    /** Once, when the target is reached. */
    complete: () => true,
    stateChange: (_state: TimerState) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const instance = useRootId(() => props.id)
    const env = useEnvironment(announcerCapability, visibilityCapability)
    const messages = useMessages("timer", timerMessages, () => props.messages)
    const locale = useLocale(() => props.locale)
    const machineProps = () => ({
      countdown: props.countdown,
      startMs: props.startMs,
      targetMs: props.targetMs,
      autoStart: props.autoStart,
      interval: props.interval,
      messages: messages.value,
      id: instance(),
      lang: locale.value.locale,
      onTick: (d: TimerTickDetails) => emit("tick", d),
      onComplete: () => emit("complete"),
      onStateChange: (s: TimerState) => emit("stateChange", s),
    })
    const { view, send } = useMachine(timerMachine, machineProps, env)
    const api = computed(() =>
      timerConnect(
        {
          instance: instance(),
          state: view.value.state,
          value: view.value.context.value,
          config: timerConfig(machineProps()),
          locale: locale.value.locale,
          messages: messages.value,
        },
        env,
      ),
    )
    const state = (): TimerRenderState => ({
      state: view.value.state,
      value: view.value.context.value,
      progress: api.value.progress,
    })
    provide(TimerKey, { api: () => api.value, send, state, messages: () => messages.value })
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

/** A part with no props of its own: `div` or `span`, its attributes from `part`. */
function simplePart(name: string, tag: "div" | "span", part: (api: Ctx["api"]) => PartProps) {
  return defineComponent({
    name: `Timer${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    slots: Object as Slots,
    setup(props, { attrs, slots }) {
      const ctx = useTimer(name)
      return () =>
        renderPart(
          tag,
          mergeProps(normalizeProps(part(ctx.api)), attrs),
          slots.default?.(ctx.state()),
          props.asChild,
        )
    },
  })
}

const Area = simplePart("Area", "div", (api) => api().area())
const Control = simplePart("Control", "div", (api) => api().control())
const Separator = simplePart("Separator", "span", (api) => api().separator())

const unitProp = {
  /** The unit. ItemValue and ItemLabel take it from their Item when omitted. */
  type: String as PropType<TimerUnit>,
}

const Item = defineComponent({
  name: "TimerItem",
  inheritAttrs: false,
  props: { type: { type: String as PropType<TimerUnit>, required: true }, ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useTimer("Item")
    provide(UnitKey, () => props.type)
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(ctx.api().item(props.type)), attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

const ItemValue = defineComponent({
  name: "TimerItemValue",
  inheritAttrs: false,
  props: { ...unitProp, ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useTimer("ItemValue")
    const unit = useUnit("ItemValue", () => props.type)
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(ctx.api().itemValue(unit())), attrs),
        slots.default?.(ctx.state()) ?? ctx.api().text(unit()),
        props.asChild,
      )
  },
})

const ItemLabel = defineComponent({
  name: "TimerItemLabel",
  inheritAttrs: false,
  props: { ...unitProp, ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useTimer("ItemLabel")
    const unit = useUnit("ItemLabel", () => props.type)
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(ctx.api().itemLabel(unit())), attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

const ActionTrigger = defineComponent({
  name: "TimerActionTrigger",
  inheritAttrs: false,
  props: {
    /** What a press does. */
    action: { type: String as PropType<TimerAction>, required: true },
    ...asChildProp,
  },
  /** The default slot receives the trigger's state: `#default="{ label }"` → Start / Pause / Resume. */
  slots: Object as SlotsType<{
    default?: (state: TimerActionTriggerRenderState) => VNodeChild
  }>,
  setup(props, { attrs, slots }) {
    const ctx = useTimer("ActionTrigger")
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
    return () => {
      const action = props.action
      const api = ctx.api()
      const label = action === "toggle" ? api.toggleLabel() : ctx.messages()[action]
      const state: TimerActionTriggerRenderState = {
        ...ctx.state(),
        action,
        label,
        disabled: !api.applies(action),
      }
      const children = slots.default?.(state) ?? label
      const tag = renderedTag("button", children, props.asChild, measured.value)
      const native = tag === "button" || tag === "input"
      return renderPart(
        "button",
        mergeProps(
          {
            ...joinHandlers(
              normalizeProps(
                api.actionTrigger({
                  action,
                  tag,
                  focused: focused.value,
                  modality: modality.value,
                }),
              ),
              {
                // A disabled trigger stays focusable (aria-disabled): the press does nothing.
                onClick: () => {
                  if (ctx.api().applies(action)) ctx.send(timerActionEvent(action))
                },
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
            ref: refTo(el),
          },
          attrs,
        ),
        children,
        props.asChild,
      )
    }
  },
})

/** The parts, by name: `timer.parts.ts` re-exports them as the `Timer` namespace. */
export { ActionTrigger, Area, Control, Item, ItemLabel, ItemValue, Root, Separator }
