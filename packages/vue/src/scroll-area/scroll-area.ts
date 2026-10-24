import {
  domScrollMetrics,
  type ScrollAreaState as ScrollAreaActivity,
  type ScrollAreaConnectInput,
  type ScrollAreaType,
  scrollAreaConnect,
  scrollAreaMachine,
  warnUnnamedTabStop,
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
  type SlotsType,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

export interface ScrollAreaState {
  readonly state: ScrollAreaActivity
}

/** What the Root exposes (a template ref on it). */
export interface ScrollAreaActions {
  /** Re-measures after a change the observers cannot see (a deep descendant resized). */
  measure(): void
}

type Orientation = "vertical" | "horizontal"
type Connect = ReturnType<typeof scrollAreaConnect>

interface Ctx {
  readonly connect: () => Connect
  readonly send: Parameters<Connect["root"]>[0]
  readonly input: () => ScrollAreaConnectInput
  readonly register: (o: Orientation) => () => void
  readonly bars: () => ReadonlySet<Orientation>
}
const ScrollAreaKey: InjectionKey<Ctx> = Symbol("rind-ui.scroll-area")
const ScrollbarKey: InjectionKey<() => Orientation> = Symbol("rind-ui.scroll-area-scrollbar")
function useScrollArea(part: string): Ctx {
  const ctx = inject(ScrollAreaKey, null)
  if (!ctx) throw new Error(`ScrollArea.${part} must be inside ScrollArea.Root`)
  return ctx
}
type Slots = SlotsType<{ default?: (state: ScrollAreaState) => VNodeChild }>

const Root = defineComponent({
  name: "ScrollAreaRoot",
  inheritAttrs: false,
  props: {
    /** Default `hover`. */
    type: { type: String as PropType<ScrollAreaType>, default: "hover" },
    /** Default 600 ms. */
    hideDelay: Number,
    /** Default `page`. */
    trackPress: String as PropType<"page" | "jump">,
    id: String,
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, expose }) {
    const instance = useRootId(() => props.id)
    const env = useEnvironment()
    let handle: { measure(): void } | null = null
    const { view, send } = useMachine(
      scrollAreaMachine,
      () => ({
        root: instance(),
        type: props.type,
        hideDelay: props.hideDelay,
        trackPress: props.trackPress,
        onTrack: (h: { measure(): void } | null) => {
          handle = h
        },
      }),
      { ...env, scrollMetrics: domScrollMetrics(env) },
    )
    expose({ measure: () => handle?.measure() } satisfies ScrollAreaActions)
    const bars = shallowRef<ReadonlySet<Orientation>>(new Set())
    const register = (o: Orientation) => {
      bars.value = new Set([...bars.value, o])
      return () => {
        const next = new Set(bars.value)
        next.delete(o)
        bars.value = next
      }
    }
    // The window's tracker installed while mounted (it records the pointer before a focus).
    onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
    const modality = useModality(env.modality, () => view.value.context.viewportFocused)
    const input = computed(
      (): ScrollAreaConnectInput => ({
        instance: instance(),
        state: view.value.state as ScrollAreaActivity,
        context: view.value.context,
        type: props.type,
        modality: modality.value,
      }),
    )
    const connect = computed(() => scrollAreaConnect(input.value))
    provide(ScrollAreaKey, {
      connect: () => connect.value,
      send,
      input: () => input.value,
      register,
      bars: () => bars.value,
    })
    // The Root's id is the instance's: a consumer id names the instance, the part id stays ours.
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(connect.value.root(send)), attrs),
        slots.default?.({ state: input.value.state }),
        props.asChild,
      )
  },
})

/** The native scroll container. */
const Viewport = defineComponent({
  name: "ScrollAreaViewport",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useScrollArea("Viewport")
    const named = () => attrs["aria-label"] !== undefined || attrs["aria-labelledby"] !== undefined
    onMounted(() =>
      watch(
        () => [ctx.input().context.tabStop && attrs["tabindex"] === undefined, named()] as const,
        ([tabStop, isNamed]) => warnUnnamedTabStop(tabStop, isNamed),
        { immediate: true },
      ),
    )
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(ctx.connect().viewport(ctx.send, named())), attrs),
        slots.default?.({ state: ctx.input().state }),
        props.asChild,
      )
  },
})

/** Your content, measured; the only element between the Viewport and your children. */
const Content = defineComponent({
  name: "ScrollAreaContent",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useScrollArea("Content")
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(ctx.connect().content()), attrs),
        slots.default?.({ state: ctx.input().state }),
        props.asChild,
      )
  },
})

const Scrollbar = defineComponent({
  name: "ScrollAreaScrollbar",
  inheritAttrs: false,
  props: {
    /** Default `vertical`. */
    orientation: { type: String as PropType<Orientation>, default: "vertical" },
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useScrollArea("Scrollbar")
    onMounted(() =>
      watch(
        () => props.orientation,
        (o, _old, onCleanup) => onCleanup(ctx.register(o)),
        { immediate: true },
      ),
    )
    provide(ScrollbarKey, () => props.orientation)
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(ctx.connect().scrollbar(ctx.send, props.orientation)), attrs),
        slots.default?.({ state: ctx.input().state }),
        props.asChild,
      )
  },
})

const Thumb = defineComponent({
  name: "ScrollAreaThumb",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useScrollArea("Thumb")
    const orientation = inject(ScrollbarKey, () => "vertical" as const)
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(ctx.connect().thumb(orientation())), attrs),
        slots.default?.({ state: ctx.input().state }),
        props.asChild,
      )
  },
})

/** Rendered only when both Scrollbars are. */
const Corner = defineComponent({
  name: "ScrollAreaCorner",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useScrollArea("Corner")
    return () => {
      const bars = ctx.bars()
      if (!bars.has("vertical") || !bars.has("horizontal")) return null
      return renderPart(
        "div",
        mergeProps(normalizeProps(ctx.connect().corner()), attrs),
        slots.default?.({ state: ctx.input().state }),
        props.asChild,
      )
    }
  },
})

/** A native scroll container with custom-drawn scrollbars (native scrolling kept). */
/** The parts, by name: `scroll-area.parts.ts` re-exports them as the `ScrollArea` namespace. */
export { Content, Corner, Root, Scrollbar, Thumb, Viewport }
