import {
  type ChangeDetails,
  type MarqueeEvent,
  type MarqueeMessages,
  type MarqueeOrientation,
  type MarqueeState,
  type MessageOverrides,
  marqueeConnect,
  marqueeCopies,
  marqueeDuration,
  marqueeMachine,
  marqueeMessages,
  marqueeSpeed,
  mirror,
  observeMarquee,
  partId,
  retime,
  reveal,
  untabbable,
} from "@rind-ui/core"
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
import { changeEmitter } from "../emit-change"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    marquee: MarqueeMessages
  }
}

// Bundlers replace `process.env.NODE_ENV` and drop the dead branch in production builds.
declare const process: { env: { NODE_ENV?: string } }

/** What every part's slot receives. */
export interface MarqueeRenderState {
  readonly state: MarqueeState
  /** The user pause (a hover pause is `state` "paused" with this false). */
  readonly paused: boolean
  readonly orientation: MarqueeOrientation
  readonly reverse: boolean
}

interface Ctx {
  readonly api: () => ReturnType<typeof marqueeConnect>
  readonly send: (event: MarqueeEvent) => void
  readonly state: () => MarqueeRenderState
  readonly copies: () => number
}
const MarqueeKey: InjectionKey<Ctx> = Symbol("rind-ui.marquee")
function useMarquee(part: string): Ctx {
  const ctx = inject(MarqueeKey, null)
  if (!ctx) throw new Error(`Marquee.${part} must be inside Marquee.Root`)
  return ctx
}
type Slots = SlotsType<{ default?: (state: MarqueeRenderState) => VNodeChild }>

const Root = defineComponent({
  name: "MarqueeRoot",
  inheritAttrs: false,
  props: {
    /** Controlled user pause (`v-model:paused`). */
    paused: { type: Boolean, default: undefined },
    /** Uncontrolled initial user pause. */
    defaultPaused: { type: Boolean, default: undefined },
    /** A mouse or pen over the Viewport pauses until it leaves (never touch). Default true. */
    pauseOnHover: { type: Boolean, default: true },
    /** CSS px per second (default 50); below 1 counts as 1. */
    speed: Number,
    orientation: { type: String as PropType<MarqueeOrientation>, default: "horizontal" },
    /** Moves toward the inline end (or down). */
    reverse: Boolean,
    /** Enough copies to fill the Viewport (at most 32). */
    autoFill: Boolean,
    messages: Object as PropType<MessageOverrides<MarqueeMessages>>,
    id: String,
    ...asChildProp,
  },
  emits: {
    /** `details.reason`: "trigger" or "focus". */
    pausedChange: (_paused: boolean, _details: ChangeDetails<MarqueeEvent>) => true,
    "update:paused": (_paused: boolean) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment()
    const instance = useRootId(() => props.id)
    const messages = useMessages("marquee", marqueeMessages, () => props.messages)
    const onPausedChange = changeEmitter<boolean, MarqueeEvent>(
      (v, d) => emit("pausedChange", v, d),
      (v) => emit("update:paused", v),
    )
    const { view, send } = useMachine(
      marqueeMachine,
      () => ({
        paused: props.paused,
        defaultPaused: props.defaultPaused,
        onPausedChange,
        pauseOnHover: props.pauseOnHover,
      }),
      {},
    )
    // Read after hydration, then followed: the server and the first client render agree.
    onMounted(() => {
      send({ type: "MOTION.CHANGED", reduced: env.motion.reducedMotion() })
      onBeforeUnmount(
        env.motion.subscribeReducedMotion((reduced) => send({ type: "MOTION.CHANGED", reduced })),
      )
      watch(
        () => props.speed,
        (speed) => {
          if (process.env.NODE_ENV === "production" || speed === undefined) return
          if (marqueeSpeed(speed) !== speed)
            console.warn(`[rind-ui] marquee: speed ${speed} is below 1 or not finite; using 1`)
        },
        { immediate: true },
      )
    })
    const api = computed(() =>
      marqueeConnect({
        instance: instance(),
        state: view.value.state as MarqueeState,
        paused: view.value.values.paused,
        orientation: props.orientation,
        reverse: props.reverse,
        autoFill: props.autoFill,
        duration: marqueeDuration(view.value.context.size, props.speed),
        ids: { viewport: partId("marquee", instance(), "viewport") },
        messages: messages.value,
      }),
    )
    const state = (): MarqueeRenderState => ({
      state: view.value.state as MarqueeState,
      paused: view.value.values.paused,
      orientation: props.orientation,
      reverse: props.reverse,
    })
    provide(MarqueeKey, {
      api: () => api.value,
      send,
      state,
      copies: () =>
        marqueeCopies(view.value.state as MarqueeState, view.value.context.size, props.autoFill),
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

const PauseTrigger = defineComponent({
  name: "MarqueePauseTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useMarquee("PauseTrigger")
    const env = useEnvironment()
    // Tracking from mount, so the press that focuses it is already known as a pointer one.
    onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
    const focused = shallowRef(false)
    const modality = useModality(env.modality, () => focused.value)
    return () =>
      renderPart(
        "button",
        mergeProps(
          joinHandlers(
            normalizeProps(
              ctx.api().pauseTrigger({ focused: focused.value, modality: modality.value }),
            ),
            {
              onClick: () => ctx.send({ type: "TRIGGER.PRESS", modality: env.modality.modality() }),
              onFocusin: () => (focused.value = true),
              onFocusout: () => (focused.value = false),
            },
          ),
          attrs,
        ),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

const copiesIn = (viewport: HTMLElement) =>
  Array.from(viewport.querySelectorAll<HTMLElement>(':scope > [data-part="content"]'))

const Viewport = defineComponent({
  name: "MarqueeViewport",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useMarquee("Viewport")
    const env = useEnvironment()
    const el = shallowRef<Element | null>(null)
    const axis = () => (ctx.state().orientation === "horizontal" ? "x" : "y")
    const duration = () => {
      const style = ctx.api().viewport()["style"] as Record<string, string> | undefined
      return Number.parseFloat(style?.["--rind-marquee-duration"] ?? "") * 1000
    }
    onMounted(() => {
      // Measure the viewport and the original copy, once per frame on change.
      watch(
        axis,
        (a, _old, onCleanup) => {
          const viewport = el.value
          const first = viewport?.querySelector<HTMLElement>(':scope > [data-part="content"]')
          if (!(viewport instanceof HTMLElement) || !first) return
          onCleanup(
            observeMarquee(viewport, first, a, env.scheduler, (size) =>
              ctx.send({ type: "MEASURED", ...size }),
            ),
          )
        },
        { immediate: true },
      )
      // Before paint: a new duration keeps the progress, a new direction keeps the position.
      watch(
        () => [duration(), ctx.state().reverse] as const,
        ([d, reverse], prev) => {
          const viewport = el.value
          if (!prev || !(viewport instanceof HTMLElement)) return
          const copies = copiesIn(viewport)
          if (prev[0] !== d) retime(copies, prev[0], d)
          if (prev[1] !== reverse) mirror(copies, d)
        },
        { flush: "pre" },
      )
    })
    return () =>
      renderPart(
        "div",
        mergeProps(
          {
            ...joinHandlers(normalizeProps(ctx.api().viewport()), {
              onPointerenter: (e: PointerEvent) => {
                if (e.pointerType !== "touch") ctx.send({ type: "POINTER.ENTER" })
              },
              onPointerleave: (e: PointerEvent) => {
                if (e.pointerType !== "touch") ctx.send({ type: "POINTER.LEAVE" })
              },
              onFocusin: (e: FocusEvent) => {
                const modality = env.modality.modality()
                ctx.send({ type: "FOCUS.ENTER", modality })
                if (modality !== "keyboard" && modality !== "virtual") return
                const viewport = e.currentTarget
                if (!(viewport instanceof HTMLElement) || !(e.target instanceof Element)) return
                reveal(e.target, viewport, copiesIn(viewport), {
                  axis: axis(),
                  dir: getComputedStyle(viewport).direction === "rtl" ? "rtl" : "ltr",
                  reversed: ctx.state().reverse,
                  durationMs: duration(),
                })
              },
            }),
            ref: refTo(el),
          },
          attrs,
        ),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

/** One hidden copy: same element and children, no tab stop inside (kept as content changes). */
const Copy = defineComponent({
  name: "MarqueeCopy",
  inheritAttrs: false,
  props: { index: { type: Number, required: true }, asChild: Boolean },
  setup(props, { attrs, slots }) {
    const ctx = useMarquee("Content")
    const el = shallowRef<Element | null>(null)
    onMounted(() => {
      if (el.value instanceof HTMLElement) onBeforeUnmount(untabbable(el.value))
    })
    return () =>
      renderPart(
        "div",
        mergeProps({ ...normalizeProps(ctx.api().content(props.index)), ref: refTo(el) }, attrs),
        slots["default"]?.(),
        props.asChild,
      )
  },
})

const Content = defineComponent({
  name: "MarqueeContent",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useMarquee("Content")
    const el = shallowRef<Element | null>(null)
    onMounted(() => {
      if (process.env.NODE_ENV === "production") return
      if (el.value?.querySelector("[id]"))
        console.warn("[rind-ui] marquee: an element with an id is in the Content; copies repeat it")
    })
    return () => {
      // The consumer's id stays on the original only.
      const { id: _id, ...shared } = attrs
      const children = () => slots.default?.(ctx.state())
      return [
        renderPart(
          "div",
          mergeProps({ ...normalizeProps(ctx.api().content(0)), ref: refTo(el) }, attrs),
          children(),
          props.asChild,
        ),
        ...Array.from({ length: ctx.copies() - 1 }, (_, i) =>
          h(
            Copy,
            { key: i + 1, index: i + 1, asChild: props.asChild, ...shared },
            { default: children },
          ),
        ),
      ]
    }
  },
})

/** The parts, by name: `marquee.parts.ts` re-exports them as the `Marquee` namespace. */
export { Content, PauseTrigger, Root, Viewport }
