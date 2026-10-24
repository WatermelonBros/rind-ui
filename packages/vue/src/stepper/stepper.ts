import {
  adjacentStep,
  announcerCapability,
  type ChangeDetails,
  focusSafely,
  type MessageOverrides,
  partId,
  type StepperChangeDetails,
  type StepperChangeReason,
  type StepperEvent,
  type StepperMessages,
  type StepperOrientation,
  stepperConnect,
  stepperMachine,
  stepperMessages,
  stepReachable,
  stepStatus,
} from "@rind-ui/core"
import {
  computed,
  defineComponent,
  h,
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
  watch,
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
    stepper: StepperMessages
  }
}

/** What every part's slot receives. */
export interface StepperRenderState {
  readonly step: number
  readonly count: number
  readonly orientation: StepperOrientation
}

interface Registry {
  disabled(index: number, on: boolean): () => void
  completed(index: number, value: boolean | undefined): () => void
  title(index: number, text: string): () => void
}
interface Ctx {
  readonly api: () => ReturnType<typeof stepperConnect>
  readonly state: () => StepperRenderState
  readonly send: (event: StepperEvent) => void
  readonly registry: Registry
  readonly messages: () => StepperMessages
}
const StepperKey: InjectionKey<Ctx> = Symbol("rind-ui.stepper")
function useStepper(part: string): Ctx {
  const ctx = inject(StepperKey, null)
  if (!ctx) throw new Error(`Stepper.${part} must be inside Stepper.Root`)
  return ctx
}
interface ItemCtx {
  readonly index: () => number
  /** A Description is rendered: the Trigger is described by it. */
  readonly described: () => boolean
  readonly setDescribed: (on: boolean) => void
}
const ItemKey: InjectionKey<ItemCtx> = Symbol("rind-ui.stepper-item")
function useItem(part: string): ItemCtx {
  const item = inject(ItemKey, null)
  if (item === null) throw new Error(`Stepper.${part} must be inside Stepper.Item`)
  return item
}

/** A focusable part's own focus, tracked from mount so the focusing press is already known. */
function useFocusState() {
  const env = useEnvironment()
  onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
  const focused = shallowRef(false)
  const modality = useModality(env.modality, () => focused.value)
  return {
    focus: () => ({ focused: focused.value, modality: modality.value }),
    handlers: {
      onFocusin: (e: FocusEvent) => {
        if (e.target === e.currentTarget) focused.value = true
      },
      onFocusout: (e: FocusEvent) => {
        if (e.target === e.currentTarget) focused.value = false
      },
    },
  }
}

/** A map state with per-key register / unregister. */
function useRegistryState<V>() {
  const map = shallowRef<ReadonlyMap<number, V>>(new Map())
  const put = (index: number, value: V | undefined) => {
    const m = map.value
    if (!(value === undefined ? !m.has(index) : m.get(index) === value)) {
      const next = new Map(m)
      if (value === undefined) next.delete(index)
      else next.set(index, value)
      map.value = next
    }
    return () => {
      if (!map.value.has(index)) return
      const next = new Map(map.value)
      next.delete(index)
      map.value = next
    }
  }
  return [map, put] as const
}

type Slots = SlotsType<{ default?: (state: StepperRenderState) => VNodeChild }>

const Root = defineComponent({
  name: "StepperRoot",
  inheritAttrs: false,
  props: {
    /** How many steps. */
    count: { type: Number, required: true },
    /** Controlled current step, 0-based (`v-model:step`). */
    step: Number,
    defaultStep: Number,
    /** Back to any visited step; forward only with NextTrigger (default true). */
    linear: { type: Boolean, default: undefined },
    orientation: { type: String as PropType<StepperOrientation>, default: "horizontal" },
    messages: Object as PropType<MessageOverrides<StepperMessages>>,
    /** Default: the provider's locale. */
    locale: String,
    id: String,
    ...asChildProp,
  },
  emits: {
    /** `details.reason`: "next", "prev" or "select"; `details.cancel()` refuses it. */
    stepChange: (_step: number, _details: StepperChangeDetails) => true,
    "update:step": (_step: number) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment(announcerCapability)
    const instance = useRootId(() => props.id)
    const locale = useLocale(() => props.locale)
    const messages = useMessages("stepper", stepperMessages, () => props.messages)
    const [disabledMap, putDisabled] = useRegistryState<true>()
    const [completedMap, putCompleted] = useRegistryState<boolean>()
    const [titleMap, putTitle] = useRegistryState<string>()
    const contentId = (i: number) => partId("stepper", instance(), `content-${i}`)
    const disabledSteps = computed(() => new Set(disabledMap.value.keys()))
    const machineProps = () => ({
      id: instance(),
      count: props.count,
      step: props.step,
      defaultStep: props.defaultStep,
      onStepChange: (next: number, d: ChangeDetails<StepperEvent>) => {
        let cancelled = false
        // Sound: every step-writing transition declares one of these reasons (machine).
        emit("stepChange", next, {
          ...d,
          reason: d.reason as unknown as StepperChangeReason,
          cancel: () => {
            cancelled = true
            d.cancel()
          },
        })
        if (!cancelled) emit("update:step", next)
      },
      linear: props.linear,
      disabledSteps: disabledSteps.value,
      completedSteps: completedMap.value,
      titles: titleMap.value,
      messages: messages.value,
      lang: locale.value.locale,
    })
    const { view, send } = useMachine(stepperMachine, machineProps, {
      ...env,
      focusContent: (index: number) => {
        // The press's modality, read now: the focus lands a frame later (after the update that
        // shows the step), when the tracker no longer knows what caused it.
        const modality = env.modality.modality()
        env.scheduler.requestAnimationFrame(() => {
          const el = document.getElementById(contentId(index))
          if (el) void focusSafely(el, env, "programmatic", modality)
        })
      },
    })
    const api = computed(() => {
      const p = machineProps()
      const current = view.value.values.step
      return stepperConnect({
        instance: instance(),
        step: current,
        count: props.count,
        orientation: props.orientation,
        status: (i) => stepStatus(p, current, i),
        reachable: (i) => stepReachable(p, view.value.context, current, i),
        disabled: (i) => disabledSteps.value.has(i),
        title: (i) => titleMap.value.get(i) ?? "",
        hasNext: adjacentStep(p, current, 1) !== null,
        hasPrev: adjacentStep(p, current, -1) !== null,
        ids: {
          content: contentId,
          description: (i) => partId("stepper", instance(), `description-${i}`),
        },
        messages: messages.value,
        locale: locale.value.locale,
      })
    })
    const registry: Registry = {
      disabled: (index, on) => putDisabled(index, on ? true : undefined),
      completed: (index, value) => putCompleted(index, value),
      title: (index, text) => putTitle(index, text || undefined),
    }
    const state = (): StepperRenderState => ({
      step: view.value.values.step,
      count: props.count,
      orientation: props.orientation,
    })
    provide(StepperKey, {
      api: () => api.value,
      state,
      send,
      registry,
      messages: () => messages.value,
    })
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

/** A part of `tag` whose props are `own(ctx, index)`; the item's index when inside one. */
function simple(
  name: string,
  tag: string,
  own: (ctx: Ctx, item: ItemCtx | null) => Parameters<typeof normalizeProps>[0],
) {
  return defineComponent({
    name: `Stepper${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    setup(props, { attrs, slots }) {
      const ctx = useStepper(name)
      const item = inject(ItemKey, null)
      return () =>
        renderPart(
          tag,
          mergeProps(normalizeProps(own(ctx, item)), attrs),
          slots["default"]?.(ctx.state()),
          props.asChild,
        )
    },
  })
}

const List = defineComponent({
  name: "StepperList",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useStepper("List")
    return () =>
      renderPart(
        "ol",
        mergeProps(normalizeProps(ctx.api().list()), attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

const Item = defineComponent({
  name: "StepperItem",
  inheritAttrs: false,
  props: {
    /** The step's index (0-based). */
    index: { type: Number, required: true },
    /** The step cannot be visited; Next and Previous skip it. */
    disabled: Boolean,
    /** Overrides the status: completed (true) or not (false) whatever the current step. */
    completed: { type: Boolean, default: undefined },
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useStepper("Item")
    // Registered after mount, as React (docs/review-backlog.md: the server HTML lacks them).
    onMounted(() => {
      watch(
        () => [props.index, props.disabled] as const,
        ([index, disabled], _old, onCleanup) => onCleanup(ctx.registry.disabled(index, disabled)),
        { immediate: true },
      )
      watch(
        () => [props.index, props.completed] as const,
        ([index, completed], _old, onCleanup) =>
          onCleanup(ctx.registry.completed(index, completed)),
        { immediate: true },
      )
    })
    const described = shallowRef(false)
    provide(ItemKey, {
      index: () => props.index,
      described: () => described.value,
      setDescribed: (on) => (described.value = on),
    })
    return () =>
      renderPart(
        "li",
        mergeProps(normalizeProps(ctx.api().item(props.index)), attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

const Trigger = defineComponent({
  name: "StepperTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useStepper("Trigger")
    const item = useItem("Trigger")
    const { focus, handlers } = useFocusState()
    return () => {
      const api = ctx.api()
      const index = item.index()
      const button = api.triggerIsButton(index)
      const merged = mergeProps(
        joinHandlers(normalizeProps(api.trigger(index, item.described(), focus())), {
          ...handlers,
          ...(button ? { onClick: () => ctx.send({ type: "SELECT", index }) } : {}),
        }),
        attrs,
      )
      // A step the user cannot reach is text, not a disabled button (no dead tab stop).
      return renderPart(
        button ? "button" : "span",
        merged,
        [
          slots.default?.(ctx.state()),
          h("span", normalizeProps(api.statusProps()), api.statusText(index)),
        ],
        props.asChild,
      )
    }
  },
})

const Indicator = simple("Indicator", "span", (ctx, item) =>
  ctx.api().indicator(item?.index() ?? 0),
)

const Title = defineComponent({
  name: "StepperTitle",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useStepper("Title")
    const item = useItem("Title")
    const el = shallowRef<Element | null>(null)
    // The title's text names the announcement and the content region (it can change).
    const report = () => ctx.registry.title(item.index(), el.value?.textContent?.trim() ?? "")
    onMounted(report)
    onUpdated(report)
    onBeforeUnmount(() => ctx.registry.title(item.index(), ""))
    return () =>
      renderPart(
        "span",
        mergeProps({ ...normalizeProps(ctx.api().title(item.index())), ref: refTo(el) }, attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

const Description = defineComponent({
  name: "StepperDescription",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useStepper("Description")
    const item = useItem("Description")
    onMounted(() => item.setDescribed(true))
    onBeforeUnmount(() => item.setDescribed(false))
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(ctx.api().description(item.index())), attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

const Separator = simple("Separator", "div", (ctx, item) => ctx.api().separator(item?.index() ?? 0))

const Content = defineComponent({
  name: "StepperContent",
  inheritAttrs: false,
  props: {
    /** The step this content belongs to (0-based). */
    index: { type: Number, required: true },
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useStepper("Content")
    const { focus, handlers } = useFocusState()
    return () =>
      renderPart(
        "div",
        mergeProps(
          joinHandlers(normalizeProps(ctx.api().content(props.index, focus())), handlers),
          attrs,
        ),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

function navTrigger(name: "PrevTrigger" | "NextTrigger") {
  return defineComponent({
    name: `Stepper${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    setup(props, { attrs, slots }) {
      const ctx = useStepper(name)
      const { focus, handlers } = useFocusState()
      const next = name === "NextTrigger"
      return () => {
        const api = ctx.api()
        return renderPart(
          "button",
          mergeProps(
            joinHandlers(
              normalizeProps(next ? api.nextTrigger(focus()) : api.prevTrigger(focus())),
              {
                ...handlers,
                onClick: () => ctx.send({ type: next ? "NEXT" : "PREV" }),
              },
            ),
            attrs,
          ),
          slots["default"]?.(ctx.state()) ??
            (next ? ctx.messages().nextLabel : ctx.messages().prevLabel),
          props.asChild,
        )
      }
    },
  })
}
const PrevTrigger = navTrigger("PrevTrigger")
const NextTrigger = navTrigger("NextTrigger")

const Progress = defineComponent({
  name: "StepperProgress",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useStepper("Progress")
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(ctx.api().progress()), attrs),
        slots.default?.(ctx.state()) ?? ctx.api().progressText,
        props.asChild,
      )
  },
})

/** The parts, by name: `stepper.parts.ts` re-exports them as the `Stepper` namespace. */
export {
  Content,
  Description,
  Indicator,
  Item,
  List,
  NextTrigger,
  PrevTrigger,
  Progress,
  Root,
  Separator,
  Title,
  Trigger,
}
