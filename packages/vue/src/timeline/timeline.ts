import {
  type MessageOverrides,
  type TimelineAlign,
  type TimelineItemInput,
  type TimelineMessages,
  type TimelineOrientation,
  type TimelineStatus,
  timelineConnect,
  timelineMessages,
} from "@rind-ui/core"
import {
  computed,
  defineComponent,
  h,
  type InjectionKey,
  inject,
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
import { useLocale, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useRootId } from "../use-ids"

declare module "../provider" {
  interface RindMessageScopes {
    timeline: TimelineMessages
  }
}

/** What every part's slot receives. */
export interface TimelineRenderState {
  readonly orientation: TimelineOrientation
  readonly align: TimelineAlign
  /** The Item's status (Item parts only). */
  readonly status?: TimelineStatus | undefined
}

interface Ctx {
  readonly api: () => ReturnType<typeof timelineConnect>
  readonly state: () => TimelineRenderState
  readonly register: (index: number) => () => void
  readonly locale: () => string
}
const TimelineKey: InjectionKey<Ctx> = Symbol("rind-ui.timeline")
function useTimeline(part: string): Ctx {
  const ctx = inject(TimelineKey, null)
  if (!ctx) throw new Error(`Timeline.${part} must be inside Timeline.Root`)
  return ctx
}
const ItemKey: InjectionKey<() => TimelineItemInput> = Symbol("rind-ui.timeline-item")
function useItem(part: string): () => TimelineItemInput {
  const item = inject(ItemKey, null)
  if (!item) throw new Error(`Timeline.${part} must be inside Timeline.Item`)
  return item
}
type Slots = SlotsType<{ default?: (state: TimelineRenderState) => VNodeChild }>

const Root = defineComponent({
  name: "TimelineRoot",
  inheritAttrs: false,
  props: {
    /** The current event's index: earlier events are completed, later ones upcoming. */
    current: Number,
    orientation: { type: String as PropType<TimelineOrientation>, default: "vertical" },
    /** Which side of the rail the content sits on; alternate switches per item. */
    align: { type: String as PropType<TimelineAlign>, default: "start" },
    messages: Object as PropType<MessageOverrides<TimelineMessages>>,
    /** Default: the provider's locale (Time's format). */
    locale: String,
    id: String,
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const instance = useRootId(() => props.id)
    const locale = useLocale(() => props.locale)
    const messages = useMessages("timeline", timelineMessages, () => props.messages)
    const indexes = shallowRef<ReadonlySet<number>>(new Set())
    const register = (index: number) => {
      if (!indexes.value.has(index)) indexes.value = new Set(indexes.value).add(index)
      return () => {
        const next = new Set(indexes.value)
        next.delete(index)
        indexes.value = next
      }
    }
    const api = computed(() =>
      timelineConnect({
        instance: instance(),
        orientation: props.orientation,
        align: props.align,
        current: props.current,
        count: indexes.value.size === 0 ? 0 : Math.max(...indexes.value) + 1,
        messages: messages.value,
      }),
    )
    const state = (): TimelineRenderState => ({
      orientation: props.orientation,
      align: props.align,
    })
    provide(TimelineKey, {
      api: () => api.value,
      state,
      register,
      locale: () => locale.value.locale,
    })
    return () =>
      renderPart(
        "ol",
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

const Item = defineComponent({
  name: "TimelineItem",
  inheritAttrs: false,
  props: {
    /** The event's index (0-based). */
    index: { type: Number, required: true },
    /** Its own status; wins over the Root's `current`. */
    status: String as PropType<TimelineStatus>,
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useTimeline("Item")
    // After mount, as React (the count is known once the items registered).
    onMounted(() =>
      watch(
        () => props.index,
        (index, _old, onCleanup) => onCleanup(ctx.register(index)),
        { immediate: true },
      ),
    )
    const item = (): TimelineItemInput => ({ index: props.index, status: props.status })
    provide(ItemKey, item)
    return () =>
      renderPart(
        "li",
        mergeProps(normalizeProps(ctx.api().item(item())), attrs),
        slots.default?.({ ...ctx.state(), status: ctx.api().statusOf(item()) }),
        props.asChild,
      )
  },
})

/** An Item part: its props from connect, its status in the slot state. */
function itemPart(
  name: "indicator" | "connector" | "content" | "description" | "opposite",
  label: string,
) {
  return defineComponent({
    name: `Timeline${label}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    setup(props, { attrs, slots }) {
      const ctx = useTimeline(label)
      const item = useItem(label)
      return () =>
        renderPart(
          "div",
          mergeProps(normalizeProps(ctx.api()[name](item())), attrs),
          slots["default"]?.({ ...ctx.state(), status: ctx.api().statusOf(item()) }),
          props.asChild,
        )
    },
  })
}

const Title = defineComponent({
  name: "TimelineTitle",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useTimeline("Title")
    const item = useItem("Title")
    return () => {
      const api = ctx.api()
      const text = api.statusText(item())
      return renderPart(
        "div",
        mergeProps(normalizeProps(api.title(item())), attrs),
        [
          slots.default?.({ ...ctx.state(), status: api.statusOf(item()) }),
          text ? h("span", normalizeProps(api.statusProps()), text) : null,
        ],
        props.asChild,
      )
    }
  },
})

const Time = defineComponent({
  name: "TimelineTime",
  inheritAttrs: false,
  props: {
    /** The machine-readable date. */
    datetime: { type: [Date, String] as PropType<Date | string>, required: true },
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useTimeline("Time")
    return () => {
      const d = props.datetime
      const iso = typeof d === "string" ? d : d.toISOString()
      return renderPart(
        "time",
        mergeProps(normalizeProps(ctx.api().time(iso)), attrs),
        slots.default?.(ctx.state()) ??
          new Intl.DateTimeFormat(ctx.locale(), { dateStyle: "medium" }).format(
            typeof d === "string" ? new Date(d) : d,
          ),
        props.asChild,
      )
    }
  },
})

const Indicator = itemPart("indicator", "Indicator")
const Connector = itemPart("connector", "Connector")
const Content = itemPart("content", "Content")
const Description = itemPart("description", "Description")
const Opposite = itemPart("opposite", "Opposite")

/** The parts, by name: `timeline.parts.ts` re-exports them as the `Timeline` namespace. */
export { Connector, Content, Description, Indicator, Item, Opposite, Root, Time, Title }
