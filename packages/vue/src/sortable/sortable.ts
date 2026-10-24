import {
  announcerCapability,
  type MessageOverrides,
  partId,
  type SortableMessages,
  type SortableOrientation,
  type SortableReorderDetails,
  sortableConnect,
  sortableDrag,
  sortableMachine,
  sortableMessages,
} from "@rind-ui/core"
import {
  computed,
  defineComponent,
  Fragment,
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
    sortable: SortableMessages
  }
}

/** What every part's slot receives. */
export interface SortableRenderState {
  readonly orientation: SortableOrientation
  /** The picked-up or dragged key, or null. */
  readonly active: string | null
  readonly dragging: boolean
}

type Api = ReturnType<typeof sortableConnect>
type Drag = {
  readonly delta: { x: number; y: number }
  readonly indicator: number
  readonly target: number
  readonly room: number
} | null

interface Ctx {
  readonly api: () => Api
  readonly state: () => SortableRenderState
  readonly send: ReturnType<typeof useMachine<typeof sortableMachine>>["send"]
  readonly orientation: () => SortableOrientation
  readonly handleDrags: () => boolean
  readonly register: (key: string, label: string | undefined, disabled: boolean) => void
  readonly startDrag: (key: string, e: PointerEvent) => void
  readonly isMovable: (key: string) => boolean
}
const SortableKey: InjectionKey<Ctx> = Symbol("rind-ui.sortable")
function useSortable(part: string): Ctx {
  const ctx = inject(SortableKey, null)
  if (!ctx) throw new Error(`Sortable.${part} must be inside Sortable.Root`)
  return ctx
}
const ItemKey: InjectionKey<() => string> = Symbol("rind-ui.sortable-item")
function useItemKey(part: string): () => string {
  const key = inject(ItemKey, null)
  if (key === null) throw new Error(`Sortable.${part} must be inside Sortable.Item`)
  return key
}

type Slots = SlotsType<{ default?: (state: SortableRenderState) => VNodeChild }>

const Root = defineComponent({
  name: "SortableRoot",
  inheritAttrs: false,
  props: {
    /** The keys in their current order (controlled: reorder your data on `reorder`). */
    items: { type: Array as PropType<readonly string[]>, required: true },
    orientation: { type: String as PropType<SortableOrientation>, default: "vertical" },
    /** Pointer drags start from the Handle (default), or anywhere on the item. */
    handle: { type: Boolean, default: true },
    messages: Object as PropType<MessageOverrides<SortableMessages>>,
    /** Default: the provider's locale. */
    locale: String,
    id: String,
    ...asChildProp,
  },
  emits: {
    /** The new order: apply it to `items`. */
    reorder: (_keys: readonly string[], _details: SortableReorderDetails) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment(announcerCapability)
    const instance = useRootId(() => props.id)
    const locale = useLocale(() => props.locale)
    const messages = useMessages("sortable", sortableMessages, () => props.messages)
    const rootEl = shallowRef<Element | null>(null)
    const labels = shallowRef<ReadonlyMap<string, string>>(new Map())
    const disabledKeys = shallowRef<ReadonlySet<string>>(new Set())
    const drag = shallowRef<Drag>(null)
    const { view, send } = useMachine(
      sortableMachine,
      () => ({
        id: instance(),
        items: props.items,
        onReorder: (keys: readonly string[], details: SortableReorderDetails) =>
          emit("reorder", keys, details),
        disabledKeys: disabledKeys.value,
        labels: labels.value,
        messages: messages.value,
        lang: locale.value.locale,
      }),
      env,
    )
    const register = (key: string, label: string | undefined, disabled: boolean) => {
      if (label !== undefined && labels.value.get(key) !== label) {
        labels.value = new Map(labels.value).set(key, label)
      }
      if (disabledKeys.value.has(key) !== disabled) {
        const next = new Set(disabledKeys.value)
        if (disabled) next.add(key)
        else next.delete(key)
        disabledKeys.value = next
      }
    }
    const startDrag = (key: string, e: PointerEvent) => {
      const root = rootEl.value
      if (!(root instanceof HTMLElement) || (e.pointerType === "mouse" && e.button !== 0)) return
      const id = instance()
      const els = props.items
        .map((k) =>
          root.querySelector<HTMLElement>(
            `[data-scope="sortable"][data-part="item"][data-instance="${CSS.escape(id)}"][data-value="${CSS.escape(k)}"]`,
          ),
        )
        .filter((el): el is HTMLElement => el !== null)
      const index = props.items.indexOf(key)
      if (index < 0) return
      // the room the picked item leaves: its size along the axis plus the list's gap (layout
      // pixels: the same the others' transforms are written in)
      const horizontal = props.orientation === "horizontal"
      const picked = els[index]
      const cs = getComputedStyle(root)
      const gap = Number.parseFloat(horizontal ? cs.columnGap : cs.rowGap) || 0
      const room = picked ? (horizontal ? picked.offsetWidth : picked.offsetHeight) + gap : 0
      sortableDrag(e, {
        items: els,
        index,
        axis: horizontal ? "x" : "y",
        root,
        onStart: () => send({ type: "DRAG.START", key }),
        onMove: (delta, target, indicator) => {
          drag.value = { delta, indicator, target, room }
          send({ type: "DRAG.OVER", index: target })
        },
        onEnd: (drop) => {
          drag.value = null
          send(drop ? { type: "DRAG.END" } : { type: "CANCEL" })
        },
      })
    }
    const api = computed(() =>
      sortableConnect({
        instance: instance(),
        state: view.value.state as "idle" | "moving" | "dragging",
        items: props.items,
        orientation: props.orientation,
        active: view.value.context.active,
        disabled: (k) => disabledKeys.value.has(k),
        label: (k) => labels.value.get(k) ?? k,
        drag: view.value.state === "dragging" ? drag.value : null,
        ids: { instructions: partId("sortable", instance(), "instructions") },
        messages: messages.value,
      }),
    )
    const state = computed(
      (): SortableRenderState => ({
        orientation: props.orientation,
        active: view.value.context.active,
        dragging: view.value.state === "dragging",
      }),
    )
    provide(SortableKey, {
      api: () => api.value,
      state: () => state.value,
      send,
      orientation: () => props.orientation,
      handleDrags: () => props.handle,
      register,
      startDrag,
      isMovable: (k) => !disabledKeys.value.has(k),
    })
    return () =>
      h(Fragment, [
        renderPart(
          "ul",
          mergeProps(
            {
              ...normalizeProps(api.value.root()),
              ref: refTo(rootEl),
              ...(props.id === undefined ? {} : { id: props.id }),
            },
            attrs,
          ),
          slots.default?.(state.value),
          props.asChild,
        ),
        h("span", normalizeProps(api.value.instructions()), api.value.instructionsText),
      ])
  },
})

const Item = defineComponent({
  name: "SortableItem",
  inheritAttrs: false,
  props: {
    /** The item's key (one of the Root's `items`). */
    value: { type: String, required: true },
    /** The spoken label (default: the item's text). */
    label: String,
    /** Cannot be moved; other items can pass it. */
    disabled: Boolean,
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useSortable("Item")
    const el = shallowRef<Element | null>(null)
    // The label: the prop, else the item's text (read after each update, as it can change).
    const register = () =>
      ctx.register(
        props.value,
        props.label ?? el.value?.textContent?.replace(/\s+/g, " ").trim(),
        props.disabled,
      )
    onMounted(register)
    onUpdated(register)
    provide(ItemKey, () => props.value)
    return () => {
      const own = normalizeProps(ctx.api().item(props.value))
      const merged = mergeProps(
        ctx.handleDrags()
          ? own
          : joinHandlers(own, {
              onPointerdown: (e: PointerEvent) => {
                if (!props.disabled) ctx.startDrag(props.value, e)
              },
            }),
        attrs,
        { ref: refTo(el) },
      )
      return renderPart("li", merged, slots.default?.(ctx.state()), props.asChild)
    }
  },
})

const NEXT = { vertical: "ArrowDown", horizontal: "ArrowRight" } as const
const PREV = { vertical: "ArrowUp", horizontal: "ArrowLeft" } as const

const Handle = defineComponent({
  name: "SortableHandle",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useSortable("Handle")
    const key = useItemKey("Handle")
    const env = useEnvironment()
    const el = shallowRef<Element | null>(null)
    onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
    const focused = shallowRef(false)
    const modality = useModality(env.modality, () => focused.value)
    const picked = () => ctx.state().active === key() && !ctx.state().dragging
    // The item moves in the DOM as the order changes: keep focus on its handle.
    const keepFocus = () => {
      const node = el.value
      if (picked() && node instanceof HTMLElement && node.ownerDocument.activeElement !== node) {
        node.focus({ preventScroll: false })
      }
    }
    onMounted(keepFocus)
    onUpdated(keepFocus)
    // A press elsewhere drops the keyboard session; the listener lives only while picked up.
    onMounted(() =>
      watch(
        picked,
        (on, _, onCleanup) => {
          if (!on) return
          const doc = el.value?.ownerDocument
          const onDown = (e: PointerEvent) => {
            if (!el.value?.contains(e.target as Node)) ctx.send({ type: "DROP" })
          }
          doc?.addEventListener("pointerdown", onDown, true)
          onCleanup(() => doc?.removeEventListener("pointerdown", onDown, true))
        },
        { immediate: true },
      ),
    )
    return () => {
      const k = key()
      const isPicked = picked()
      const orientation = ctx.orientation()
      const merged = mergeProps(
        {
          ...joinHandlers(
            normalizeProps(
              ctx.api().handle(k, { focused: focused.value, modality: modality.value }),
            ),
            {
              onFocus: () => (focused.value = true),
              onBlur: (e: FocusEvent) => {
                focused.value = false
                // Moving focus elsewhere drops where it is (the order has already changed
                // live). A blur with no next target is the item moving in the DOM: its handle
                // is refocused.
                if (isPicked && e.relatedTarget !== null) ctx.send({ type: "DROP" })
              },
              onKeydown: (e: KeyboardEvent) => {
                const next = e.key === NEXT[orientation]
                const prev = e.key === PREV[orientation]
                if (!isPicked) {
                  if ((next || prev) && e.altKey) {
                    e.preventDefault()
                    ctx.send({ type: "QUICK", key: k, by: next ? 1 : -1 })
                  } else if (e.key === " " || e.key === "Enter") {
                    e.preventDefault()
                    ctx.send({ type: "PICK", key: k })
                  }
                  return
                }
                if (next || prev) {
                  e.preventDefault()
                  ctx.send({ type: "MOVE", by: next ? 1 : -1 })
                } else if (e.key === "Home" || e.key === "End") {
                  e.preventDefault()
                  ctx.send({ type: "MOVE.TO", edge: e.key === "Home" ? "first" : "last" })
                } else if (e.key === " " || e.key === "Enter") {
                  e.preventDefault()
                  ctx.send({ type: "DROP" })
                } else if (e.key === "Escape") {
                  e.preventDefault()
                  e.stopPropagation()
                  ctx.send({ type: "CANCEL" })
                } else if (e.key === "Tab") {
                  ctx.send({ type: "DROP" })
                }
              },
              onPointerdown: (e: PointerEvent) => {
                if (isPicked) {
                  ctx.send({ type: "DROP" })
                  return
                }
                if (ctx.isMovable(k)) ctx.startDrag(k, e)
              },
              // A pointer press never picks up (Space / Enter do): the click is the drag's.
              onClick: (e: MouseEvent) => e.preventDefault(),
            },
          ),
          ref: refTo(el),
        },
        attrs,
      )
      return renderPart("button", merged, slots.default?.(ctx.state()), props.asChild)
    }
  },
})

const Indicator = defineComponent({
  name: "SortableIndicator",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useSortable("Indicator")
    return () =>
      renderPart(
        "li",
        mergeProps(normalizeProps(ctx.api().indicator()), attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

const MoveButton = defineComponent({
  name: "SortableMoveButton",
  inheritAttrs: false,
  props: {
    /** Which way it moves its item. */
    direction: { type: String as PropType<"up" | "down">, required: true },
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useSortable("MoveButton")
    const key = useItemKey("MoveButton")
    return () => {
      const own = ctx.api().moveButton(key(), props.direction)
      const merged = mergeProps(
        joinHandlers(normalizeProps(own), {
          onClick: () => {
            if (own["aria-disabled"] !== "true") {
              ctx.send({ type: "QUICK", key: key(), by: props.direction === "up" ? -1 : 1 })
            }
          },
        }),
        attrs,
      )
      return renderPart("button", merged, slots.default?.(ctx.state()), props.asChild)
    }
  },
})

/** The parts, by name: `sortable.parts.ts` re-exports them as the `Sortable` namespace. */
export { Handle, Indicator, Item, MoveButton, Root }
