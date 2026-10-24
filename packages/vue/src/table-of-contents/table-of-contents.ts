import {
  type ChangeDetails,
  type MessageOverrides,
  partId,
  readingPosition,
  type TableOfContentsChangeReason,
  type TableOfContentsEvent,
  type TableOfContentsItem,
  type TableOfContentsMessages,
  tableOfContentsConnect,
  tableOfContentsMachine,
  tableOfContentsMessages,
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
  watch,
} from "vue"
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
    "table-of-contents": TableOfContentsMessages
  }
}

/** What every part's slot receives. */
export interface TableOfContentsRenderState {
  /** The current section's id ("" for none). */
  readonly value: string
}

/** What `valueChange` receives. */
export interface TableOfContentsChangeDetails {
  readonly reason: TableOfContentsChangeReason
  readonly event: ChangeDetails<TableOfContentsEvent>["event"]
}

type Marker = { readonly top: number; readonly height: number } | null

interface Ctx {
  readonly api: () => ReturnType<typeof tableOfContentsConnect>
  readonly state: () => TableOfContentsRenderState
  readonly navigate: (id: string) => void
  readonly setTitled: (on: boolean) => void
  readonly setMarker: (marker: Marker) => void
}
const TocKey: InjectionKey<Ctx> = Symbol("rind-ui.table-of-contents")
function useToc(part: string): Ctx {
  const ctx = inject(TocKey, null)
  if (!ctx) throw new Error(`TableOfContents.${part} must be inside TableOfContents.Root`)
  return ctx
}
const ItemKey: InjectionKey<() => TableOfContentsItem> = Symbol("rind-ui.table-of-contents-item")
type Slots = SlotsType<{ default?: (state: TableOfContentsRenderState) => VNodeChild }>

const Root = defineComponent({
  name: "TableOfContentsRoot",
  inheritAttrs: false,
  props: {
    /** The sections, in document order (`collectHeadings(root)` reads them from headings). */
    items: { type: Array as PropType<readonly TableOfContentsItem[]>, required: true },
    /** Controlled current section id (`v-model`). */
    modelValue: String,
    defaultValue: String,
    /** The scrolling container (default: the window). */
    scrollRoot: { type: null as unknown as PropType<HTMLElement | null>, default: null },
    /** Pixels hidden at the top by a sticky header (default 0). */
    offset: Number,
    /** The reading line, as a fraction of the scroll root below the offset (default 1/3). */
    ratio: Number,
    messages: Object as PropType<MessageOverrides<TableOfContentsMessages>>,
    id: String,
    ...asChildProp,
  },
  emits: {
    /** `details.reason`: "scroll" (the reading position) or "navigate" (a followed link). */
    valueChange: (_value: string, _details: TableOfContentsChangeDetails) => true,
    "update:modelValue": (_value: string) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment()
    const instance = useRootId(() => props.id)
    const messages = useMessages("table-of-contents", tableOfContentsMessages, () => props.messages)
    const titled = shallowRef(false)
    const marker = shallowRef<Marker>(null)
    const { view, send } = useMachine(
      tableOfContentsMachine,
      () => ({
        id: instance(),
        value: props.modelValue,
        defaultValue: props.defaultValue,
        onValueChange: (next: string, d: ChangeDetails<TableOfContentsEvent>) => {
          // Sound: every value-writing transition declares one of these reasons (machine).
          emit("valueChange", next, {
            reason: d.reason as unknown as TableOfContentsChangeReason,
            event: d.event,
          })
          emit("update:modelValue", next)
        },
      }),
      env,
    )
    onMounted(() =>
      watch(
        () => [props.scrollRoot, props.offset, props.ratio] as const,
        ([scrollRoot, offset, ratio], _old, onCleanup) =>
          onCleanup(
            readingPosition(document, {
              ids: () => props.items.map((i) => i.id),
              scrollRoot,
              offset,
              ratio,
              onPosition: (p) => send({ type: "POSITION", current: p.current, visible: p.visible }),
              onUserScroll: () => send({ type: "USER.SCROLL" }),
            }),
          ),
        { immediate: true },
      ),
    )
    const api = computed(() =>
      tableOfContentsConnect({
        instance: instance(),
        value: view.value.values.value,
        visible: view.value.context.visible,
        titled: titled.value,
        ids: { title: partId("table-of-contents", instance(), "title") },
        marker: marker.value,
        messages: messages.value,
      }),
    )
    const state = (): TableOfContentsRenderState => ({ value: view.value.values.value })
    const navigate = (target: string) => {
      // The activation's modality, read now: the focus moves after the browser's jump.
      const modality = env.modality.modality()
      send({ type: "NAVIGATE", id: target })
      if (modality !== "keyboard" && modality !== "virtual") return
      env.scheduler.requestAnimationFrame(() => {
        const heading = document.getElementById(target)
        if (!heading) return
        if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1")
        env.modality.markFocus(heading, "navigation", modality)
        // No scroll: the jump already placed the heading (and may still be scrolling smoothly).
        heading.focus({ preventScroll: true })
      })
    }
    provide(TocKey, {
      api: () => api.value,
      state,
      navigate,
      setTitled: (on) => (titled.value = on),
      setMarker: (m) => {
        const prev = marker.value
        if (prev?.top !== m?.top || prev?.height !== m?.height) marker.value = m
      },
    })
    return () =>
      renderPart(
        "nav",
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

const Title = defineComponent({
  name: "TableOfContentsTitle",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useToc("Title")
    onMounted(() => ctx.setTitled(true))
    onBeforeUnmount(() => ctx.setTitled(false))
    return () =>
      renderPart(
        "h2",
        mergeProps(normalizeProps(ctx.api().title()), attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

const List = defineComponent({
  name: "TableOfContentsList",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useToc("List")
    const el = shallowRef<Element | null>(null)
    // The current link: the Indicator's box, and kept in view when the List scrolls (Starlight
    // #3617), by the List's own scrollTop only (scrollIntoView would move the page too).
    let placed: string | null = null
    const place = () => {
      const current = ctx.state().value
      if (placed === current) return
      placed = current
      const list = el.value
      const link = list?.querySelector<HTMLElement>('[aria-current="location"]')
      if (!(list instanceof HTMLElement) || !link) {
        ctx.setMarker(null)
        return
      }
      const box = list.getBoundingClientRect()
      const own = link.getBoundingClientRect()
      const top = own.top - box.top + list.scrollTop
      const height = own.height
      ctx.setMarker({ top, height })
      if (list.scrollHeight > list.clientHeight) {
        if (top < list.scrollTop) list.scrollTop = top
        else if (top + height > list.scrollTop + list.clientHeight)
          list.scrollTop = top + height - list.clientHeight
      }
    }
    onMounted(place)
    onUpdated(place)
    return () =>
      renderPart(
        "ol",
        mergeProps({ ...normalizeProps(ctx.api().list()), ref: refTo(el) }, attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

const Item = defineComponent({
  name: "TableOfContentsItem",
  inheritAttrs: false,
  props: {
    /** The section this item lists. */
    item: { type: Object as PropType<TableOfContentsItem>, required: true },
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useToc("Item")
    provide(ItemKey, () => props.item)
    return () =>
      renderPart(
        "li",
        mergeProps(normalizeProps(ctx.api().item(props.item)), attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

const Link = defineComponent({
  name: "TableOfContentsLink",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useToc("Link")
    const item = inject(ItemKey, null)
    if (!item) throw new Error("TableOfContents.Link must be inside TableOfContents.Item")
    const env = useEnvironment()
    // The link's own focus, tracked from mount so the focusing key is already known.
    onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
    const focused = shallowRef(false)
    const modality = useModality(env.modality, () => focused.value)
    return () => {
      const it = item()
      return renderPart(
        "a",
        mergeProps(
          joinHandlers(
            normalizeProps(
              ctx.api().link(it, { focused: focused.value, modality: modality.value }),
            ),
            {
              onFocusin: (e: FocusEvent) => {
                if (e.target === e.currentTarget) focused.value = true
              },
              onFocusout: (e: FocusEvent) => {
                if (e.target === e.currentTarget) focused.value = false
              },
              onClick: (e: MouseEvent) => {
                // New tab, new window, download: the browser's, not a jump on this page.
                if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
                ctx.navigate(it.id)
              },
            },
          ),
          attrs,
        ),
        slots.default?.(ctx.state()) ?? it.label,
        props.asChild,
      )
    }
  },
})

const Indicator = defineComponent({
  name: "TableOfContentsIndicator",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useToc("Indicator")
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(ctx.api().indicator()), attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

/** The parts, by name: `table-of-contents.parts.ts` re-exports them as the `TableOfContents` namespace. */
export { Indicator, Item, Link, List, Root, Title }
