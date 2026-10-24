// Tree View (design §2): wiring only. The machine owns highlight, expansion, selection,
// checking and lazy loads; the core connect owns every attribute and key.
import {
  announcerCapability,
  type Collection,
  type CollectionKey,
  checkTreeView,
  createTreeCollection,
  expansionReason,
  type Href,
  isMovable,
  keySetOf,
  type LinkCurrent,
  layoutCapability,
  linkProps,
  pointerTarget,
  type RouterOptions,
  type ScrollToIndexDetails,
  type TreeCollection,
  type TreeDropZone,
  type TreeViewActionDetails,
  type TreeViewMessages,
  type TreeViewMoveDetails,
  type TreeViewParts,
  type TreeViewValue,
  toKey,
  treeDrag,
  treeSelectionOf,
  treeViewConnect,
  treeViewIds,
  treeViewMachine,
  treeViewMessages,
  visibleOf,
} from "@rind-ui/core"
import {
  type ComputedRef,
  computed,
  defineComponent,
  Fragment,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  type VNode,
  type VNodeChild,
  watch,
} from "vue"
import { useKeepFocus } from "../keep-focus"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

/** One node of a data-driven tree. */
export interface TreeViewItemData {
  readonly key: string
  readonly label: string
  /** Loaded children (empty or absent for a leaf or an unloaded branch). */
  readonly children?: readonly TreeViewItemData[]
  /** A branch even with no loaded children (lazy, or loaded and empty). */
  readonly isBranch?: boolean
  readonly disabled?: boolean
}
const fromData = (items: readonly TreeViewItemData[]) =>
  createTreeCollection<TreeViewItemData>({
    roots: items,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    getChildren: (i) => i.children,
    hasUnloadedChildren: (i) => i.isBranch === true,
    isDisabled: (i) => i.disabled === true,
  })
const EMPTY_TREE = fromData([])

export interface TreeViewChangeDetails {
  readonly reason: string
  readonly key: string | undefined
}
export interface TreeViewExpandedDetails {
  readonly reason: "key" | "press" | "api" | "siblings" | "all"
}

/** What a node's slot receives (design §2). */
export interface TreeViewNodeState {
  readonly key: string
  /** The row's position in the visible list (what a virtualizer positions by). */
  readonly index: number
  /** The node's data (a `TreeViewItemData` with `items`). */
  readonly value: unknown
  readonly label: string
  /** 1 for roots. */
  readonly level: number
  readonly posInSet: number
  readonly setSize: number
  readonly isLast: boolean
  readonly parentKey: string | null
  readonly isBranch: boolean
  readonly expanded: boolean
  readonly selected: boolean
  readonly checked: "true" | "false" | "mixed" | undefined
  readonly loading: boolean
  readonly disabled: boolean
}

interface Host {
  readonly parts: () => TreeViewParts
  readonly tree: () => TreeCollection<unknown>
  readonly visible: () => Collection<unknown>
  readonly focused: () => boolean
  readonly highlightedIndex: () => number | undefined
  readonly node: (key: CollectionKey) => TreeViewNodeState | undefined
  readonly messages: () => TreeViewMessages
  readonly env: ReturnType<typeof useEnvironment>
  readonly mountLabel: (on: boolean) => void
  readonly mountEmpty: (on: boolean) => void
  readonly mountText: (key: CollectionKey, on: boolean) => void
  readonly setHovered: (key: CollectionKey | null) => void
  readonly setPressed: (key: CollectionKey | null) => void
  readonly options: () => {
    readonly checkable: boolean
    readonly selectionMode: string | undefined
  }
  readonly canMove: (key: CollectionKey) => boolean
  readonly startDrag: (key: CollectionKey, event: PointerEvent) => void
  readonly dropAt: () => { readonly top: number; readonly level: number } | null
}
const HostKey: InjectionKey<Host> = Symbol("rind-ui.tree-view")
const useHost = (part: string): Host => {
  const host = inject(HostKey, null)
  if (!host) throw new Error(`TreeView.${part} must be inside TreeView.Root`)
  return host
}
const ItemKey: InjectionKey<() => CollectionKey> = Symbol("rind-ui.tree-view-item")
const useItemKey = (part: string) => {
  const key = inject(ItemKey, null)
  if (key === null) throw new Error(`TreeView.${part} must be inside TreeView.Item`)
  return key
}
type Slots = SlotsType<{ default?: () => VNodeChild }>
type Value = string | readonly string[] | null

const Root = defineComponent({
  name: "TreeViewRoot",
  props: {
    /** Base of the parts' generated ids (default: generated). */
    id: String,
    /** The tree's data; or `collection`, a tree collection you built. */
    items: Array as PropType<readonly TreeViewItemData[]>,
    /** A tree collection you built, used instead of `items`. */
    collection: Object as PropType<TreeCollection<unknown>>,
    /** `single` (default), `multiple` or `none`. */
    selectionMode: { type: String as PropType<"single" | "multiple" | "none">, default: "single" },
    selectionBehavior: String as PropType<"toggle" | "replace">,
    /** Multiple mode: the last selected item cannot be deselected. */
    disallowEmptySelection: { type: Boolean, default: undefined },
    /** Controlled selection (`v-model`). */
    modelValue: { type: [String, Array, null] as PropType<Value>, default: undefined },
    defaultValue: { type: [String, Array, null] as PropType<Value>, default: undefined },
    /** Controlled expansion (`v-model:expandedValue`). */
    expandedValue: Array as PropType<readonly string[]>,
    defaultExpandedValue: Array as PropType<readonly string[]>,
    checkable: Boolean,
    /** Controlled checks (`v-model:checkedValue`). */
    checkedValue: Array as PropType<readonly string[]>,
    defaultCheckedValue: Array as PropType<readonly string[]>,
    checkPropagation: String as PropType<"both" | "none">,
    expandOnClick: { type: Boolean, default: undefined },
    onAction: Function as PropType<(key: string, details: TreeViewActionDetails) => void>,
    onLoadChildren: Function as PropType<
      (key: string, options: { readonly signal: AbortSignal }) => Promise<unknown> | undefined
    >,
    disabled: Boolean,
    /** Disabled items (and a disabled tree) stay focusable and reachable by arrows; nothing toggles. */
    focusableWhenDisabled: { type: Boolean, default: undefined },
    /** Arrow moves wrap at both ends. Default: false. */
    loop: { type: Boolean, default: undefined },
    /** Typeahead reset delay in ms. Default: 1000. */
    typeaheadTimeout: Number,
    /** Overrides for the loading announcements and the Empty and Loading default texts. */
    messages: Object as PropType<Partial<TreeViewMessages>>,
    /** Rows are windowed by the consumer (`TreeView.Tree` `indexes`): keyboard moves call `scrollToIndex`. */
    virtualized: { type: Boolean, default: undefined },
    /** Scrolls the highlighted row into view; `index` is its position in the visible list. */
    scrollToIndex: Function as PropType<(details: ScrollToIndexDetails) => void>,
    /** Nodes can be moved (Alt+arrows, pointer drags): all, or those the predicate allows. */
    movable: {
      type: [Boolean, Function] as PropType<boolean | ((key: string) => boolean)>,
      default: undefined,
    },
    /** A node moved: apply it to `items` with `moveNode(items, key, details)`. */
    onMove: Function as PropType<(key: string, details: TreeViewMoveDetails) => void>,
  },
  emits: {
    valueChange: (_value: Value, _details: TreeViewChangeDetails) => true,
    "update:modelValue": (_value: Value) => true,
    expandedChange: (_keys: readonly string[], _details: TreeViewExpandedDetails) => true,
    "update:expandedValue": (_keys: readonly string[]) => true,
    checkedChange: (_keys: readonly string[], _details: TreeViewChangeDetails) => true,
    "update:checkedValue": (_keys: readonly string[]) => true,
  },
  slots: Object as Slots,
  setup(props, { slots, emit }) {
    const env = useEnvironment(announcerCapability, layoutCapability)
    const instance = useRootId(() => props.id)
    const data = computed(() => (props.items ? fromData(props.items) : null))
    const tree = computed(() => props.collection ?? data.value ?? EMPTY_TREE)
    const ids = computed(() => treeViewIds(instance()))
    // Sound: every key of the defaults is present; a partial override only replaces some.
    const messages = computed(
      () => ({ ...treeViewMessages, ...props.messages }) as TreeViewMessages,
    )
    const { view, send, service } = useMachine(
      treeViewMachine,
      () => ({
        tree: tree.value,
        ids: { list: ids.value.tree, item: ids.value.item },
        selectionMode: props.selectionMode,
        selectionBehavior: props.selectionBehavior,
        disallowEmptySelection:
          props.selectionMode === "multiple" ? props.disallowEmptySelection : undefined,
        focusableWhenDisabled: props.focusableWhenDisabled,
        loop: props.loop,
        typeaheadTimeout: props.typeaheadTimeout,
        checkable: props.checkable,
        checkPropagation: props.checkPropagation,
        expandOnClick: props.expandOnClick,
        disabled: props.disabled,
        messages: messages.value,
        ...(props.modelValue === undefined ? {} : { value: props.modelValue as TreeViewValue }),
        defaultValue:
          (props.defaultValue as TreeViewValue | undefined) ??
          (props.selectionMode === "multiple" ? [] : null),
        onValueChange: (v: TreeViewValue, details: { event: unknown }) => {
          const e = details.event as { type: string; key?: string }
          emit("valueChange", v as Value, { reason: e.type, key: e.key })
          emit("update:modelValue", v as Value)
        },
        ...(props.expandedValue !== undefined ? { expandedValue: props.expandedValue } : {}),
        defaultExpandedValue: props.defaultExpandedValue ?? [],
        onExpandedValueChange: (keys: readonly string[], details: { event: { type: string } }) => {
          emit("expandedChange", keys, { reason: expansionReason(details.event.type as never) })
          emit("update:expandedValue", keys)
        },
        ...(props.checkedValue !== undefined ? { checkedValue: props.checkedValue } : {}),
        defaultCheckedValue: props.defaultCheckedValue ?? [],
        onCheckedValueChange: (keys: readonly string[], details: { event: unknown }) => {
          const e = details.event as { type: string; key?: string }
          emit("checkedChange", keys, { reason: e.type, key: e.key })
          emit("update:checkedValue", keys)
        },
        onAction: props.onAction
          ? (key: string, d: TreeViewActionDetails) => props.onAction?.(key, d)
          : undefined,
        onLoadChildren: props.onLoadChildren
          ? (key: string, o: { readonly signal: AbortSignal }) => props.onLoadChildren?.(key, o)
          : undefined,
        virtualized: props.virtualized,
        scrollToIndex: props.scrollToIndex
          ? (d: ScrollToIndexDetails) => props.scrollToIndex?.(d)
          : undefined,
        movable: props.movable,
        onMove: props.onMove
          ? (key: string, d: TreeViewMoveDetails) => props.onMove?.(key, d)
          : undefined,
      }),
      env,
    )
    const label = shallowRef(false)
    const empty = shallowRef(false)
    const texts = shallowRef<ReadonlySet<CollectionKey>>(new Set())
    const hovered = shallowRef<CollectionKey | null>(null)
    const pressed = shallowRef<CollectionKey | null>(null)
    const dropAt = shallowRef<{ top: number; level: number } | null>(null)
    const canMove = (key: CollectionKey) =>
      isMovable({ movable: props.movable, disabled: props.disabled }, key)
    const focused = () => view.value.matches("focused")
    const modality = useModality(env.modality, focused)
    const expandedKeys = computed(
      () => view.value.values.expandedValue as readonly string[] | undefined,
    )
    const visible = computed(() => visibleOf(tree.value, expandedKeys.value))
    const parts = computed(() => {
      const ctx = view.value.context
      const selectionMode = props.checkable ? "none" : props.selectionMode
      return treeViewConnect(
        {
          instance: instance(),
          tree: tree.value,
          visible: visible.value,
          expanded: keySetOf(expandedKeys.value),
          context: {
            highlightedKey: ctx.highlightedKey,
            highlightSource: ctx.highlightSource,
            loading: ctx.loading,
            failed: ctx.failed,
          },
          selection: treeSelectionOf(
            view.value.values.value as TreeViewValue | undefined,
            selectionMode,
          ),
          selectionMode,
          checkable: props.checkable,
          checked: keySetOf(view.value.values.checkedValue as readonly string[] | undefined),
          checkPropagation: props.checkPropagation ?? "both",
          disabled: props.disabled,
          focusableWhenDisabled: props.focusableWhenDisabled,
          typingAhead: () => {
            const t = service.getSnapshot().context.typeahead
            return t.buffer !== "" && env.clock.now() - t.at <= (props.typeaheadTimeout ?? 1000)
          },
          focused: focused(),
          modality: modality.value,
          hovered: hovered.value,
          pressed: pressed.value,
          mounted: {
            label: label.value,
            empty: empty.value,
            itemText: (key: CollectionKey) => texts.value.has(key),
          },
          send,
          canMove,
          movable: props.movable !== undefined && props.movable !== false,
          drag: ctx.drag,
          moveInstructions: messages.value.moveInstructions,
        },
        env,
      )
    })
    const node = (key: CollectionKey): TreeViewNodeState | undefined => {
      const n = tree.value.get(key)
      if (!n) return undefined
      const item = parts.value.item(key)
      return {
        key,
        index: visible.value.get(key)?.index ?? -1,
        value: n.value,
        label: n.textValue,
        level: n.level + 1,
        posInSet: n.setIndex + 1,
        setSize: n.setSize,
        isLast: n.setIndex === n.setSize - 1,
        parentKey: n.parentKey,
        isBranch: n.hasChildren,
        expanded: n.hasChildren && keySetOf(expandedKeys.value).has(key),
        selected: item["aria-selected"] === "true",
        checked: item["aria-checked"] as "true" | "false" | "mixed" | undefined,
        loading: view.value.context.loading.has(key),
        disabled: n.disabled,
      }
    }
    const host: Host = {
      parts: () => parts.value,
      tree: () => tree.value,
      visible: () => visible.value,
      focused,
      highlightedIndex: () => {
        const k = view.value.context.highlightedKey
        return k === null ? undefined : visible.value.get(k)?.index
      },
      node,
      messages: () => messages.value,
      env,
      mountLabel: (on) => (label.value = on),
      mountEmpty: (on) => (empty.value = on),
      mountText: (key, on) => {
        if (texts.value.has(key) === on) return
        const next = new Set(texts.value)
        if (on) next.add(key)
        else next.delete(key)
        texts.value = next
      },
      setHovered: (key) => (hovered.value = key),
      setPressed: (key) => (pressed.value = key),
      options: () => ({ checkable: props.checkable, selectionMode: props.selectionMode }),
      canMove,
      dropAt: () => dropAt.value,
      startDrag: (key, event) => {
        const treeEl = (event.currentTarget as HTMLElement).closest<HTMLElement>('[role="tree"]')
        if (!treeEl || (event.pointerType === "mouse" && event.button !== 0)) return
        let auto: {
          key: CollectionKey
          timer: ReturnType<typeof env.scheduler.setTimeout>
        } | null = null
        const stopAuto = () => {
          if (auto) env.scheduler.clearTimeout(auto.timer)
          auto = null
        }
        treeDrag(event, {
          tree: treeEl,
          onStart: () => send({ type: "DRAG.START", key }),
          onOver: (row, fraction) => {
            // The latest tree and expansion: a branch may have opened during the drag.
            const raw = row?.getAttribute("data-key")
            const over = raw ? toKey(raw) : null
            const n = over === null ? undefined : node(over)
            if (over === null || !n || !row) {
              stopAuto()
              dropAt.value = null
              send({ type: "DRAG.OVER", over: null, zone: null, target: null })
              return
            }
            const zone: TreeDropZone =
              fraction < 0.25
                ? "before"
                : fraction > 0.75
                  ? "after"
                  : n.isBranch
                    ? "inside"
                    : fraction < 0.5
                      ? "before"
                      : "after"
            const target = pointerTarget(tree.value, key, over, zone, n.expanded)
            send({ type: "DRAG.OVER", over, zone, target })
            // A collapsed branch held over its middle opens (a drop inside it can then be aimed).
            if (zone === "inside" && n.isBranch && !n.expanded && target) {
              if (auto?.key !== over) {
                stopAuto()
                auto = {
                  key: over,
                  timer: env.scheduler.setTimeout(() => send({ type: "EXPAND", key: over }), 700),
                }
              }
            } else stopAuto()
            if (!target || zone === "inside") {
              dropAt.value = null
              return
            }
            const box = row.getBoundingClientRect()
            const parent = target.parent === null ? undefined : node(toKey(target.parent))
            dropAt.value = {
              top: (zone === "before" ? box.top : box.bottom) - treeEl.getBoundingClientRect().top,
              level: parent ? parent.level + 1 : 1,
            }
          },
          onEnd: (drop) => {
            stopAuto()
            dropAt.value = null
            send(drop ? { type: "DRAG.END" } : { type: "DRAG.CANCEL" })
          },
        })
      },
    }
    provide(HostKey, host)
    return () => [
      slots.default?.(),
      props.movable
        ? h(
            "span",
            normalizeProps(parts.value.moveInstructions()),
            parts.value.moveInstructionsText,
          )
        : null,
    ]
  },
})

const Label = defineComponent({
  name: "TreeViewLabel",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const host = useHost("Label")
    onMounted(() => host.mountLabel(true))
    onBeforeUnmount(() => host.mountLabel(false))
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(host.parts().label()), attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

const Loading = defineComponent({
  name: "TreeViewLoading",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const host = useHost("Loading")
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(host.parts().loading()), attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

/** One visible node: its row from the Tree's slot, then the loading row of a loading branch. */
const Row = defineComponent({
  name: "TreeViewRow",
  props: {
    // A branded string key (CollectionKey).
    nodeKey: { type: String as unknown as PropType<CollectionKey>, required: true },
    row: { type: Function as PropType<(node: TreeViewNodeState) => VNodeChild>, required: true },
    loading: Function as PropType<(node: TreeViewNodeState) => VNodeChild>,
  },
  setup(props) {
    const host = useHost("Tree")
    return () => {
      const node = host.node(props.nodeKey)
      if (!node) return null
      return h(Fragment, [
        props.row(node) as never,
        node.loading
          ? props.loading
            ? (props.loading(node) as never)
            : h(Loading, null, () => host.messages().loadingLabel)
          : null,
      ])
    }
  },
})

/**
 * The tree. The default slot renders one visible node (usually a `TreeView.Item`); it is called
 * per visible node, in order, as a flat list. A loading branch is followed by the `loading` slot.
 */
const Tree = defineComponent({
  name: "TreeViewTree",
  inheritAttrs: false,
  props: {
    /**
     * Virtualized: the visible-list indexes to render (a virtualizer's window plus
     * `TreeView.useVisibleRows().persistedIndexes`). Default: every visible node.
     */
    indexes: Array as PropType<readonly number[]>,
    ...asChildProp,
  },
  slots: Object as SlotsType<{
    default: (node: TreeViewNodeState) => VNodeChild
    loading?: (node: TreeViewNodeState) => VNodeChild
  }>,
  setup(props, { attrs, slots }) {
    const host = useHost("Tree")
    const el = shallowRef<Element | null>(null)
    // A moved node keeps its focus (Alt+arrows reorder the rows under it).
    useKeepFocus(el)
    // After the re-render a Label's registration causes, not on the first commit.
    onMounted(() =>
      watch(
        host.options,
        (o) => {
          const node = el.value
          queueMicrotask(() => {
            if (node instanceof HTMLElement && node.isConnected) checkTreeView(node, o)
          })
        },
        { immediate: true, deep: true },
      ),
    )
    return () => {
      const naming = {
        "aria-label": attrs["aria-label"] as string | undefined,
        "aria-labelledby": attrs["aria-labelledby"] as string | undefined,
      }
      const visible = host.visible()
      const rows: VNode[] = []
      const add = (index: number) => {
        const node = visible.at(index)
        if (node && slots.default)
          rows.push(
            h(Row, {
              key: node.key,
              nodeKey: node.key,
              row: slots.default,
              ...(slots.loading ? { loading: slots.loading } : {}),
            }),
          )
      }
      if (props.indexes) for (const index of props.indexes) add(index)
      else for (let index = 0; index < visible.size; index++) add(index)
      return renderPart(
        "div",
        mergeProps({ ...normalizeProps(host.parts().tree(naming)), ref: refTo(el) }, attrs),
        rows,
        props.asChild,
      )
    }
  },
})

/**
 * For a virtualizer inside `TreeView.Root`: the visible row count and the indexes it must keep
 * rendered (the highlighted row, so focus and the keyboard never lose it). Call in setup.
 */
function useVisibleRows(): ComputedRef<{
  readonly count: number
  readonly persistedIndexes: readonly number[]
}> {
  const host = useHost("useVisibleRows")
  return computed(() => {
    const index = host.highlightedIndex()
    return { count: host.visible().size, persistedIndexes: index === undefined ? [] : [index] }
  })
}

const Item = defineComponent({
  name: "TreeViewItem",
  inheritAttrs: false,
  props: {
    /** The node key. */
    value: { type: String, required: true },
    /** Renders a native `<a role="treeitem">` (link navigation). */
    href: [String, Object] as PropType<Href>,
    /** With `href`: passed to the anchor; not `_self` opens elsewhere. */
    target: String,
    /** With `href`: passed to the anchor. */
    rel: String,
    /** With `href`: sets `aria-current` and `data-current`; the link still navigates. */
    current: { type: [Boolean, String] as PropType<LinkCurrent>, default: undefined },
    /** With `href`: passed unchanged to the router's `navigate`. */
    // Any value: RouterOptions is `never` until the app augments RouterConfig.
    routerOptions: null as unknown as PropType<RouterOptions>,
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const host = useHost("Item")
    const key = () => toKey(props.value)
    const el = shallowRef<Element | null>(null)
    provide(ItemKey, key)
    // Virtualized: a row highlighted by a key press mounts after the scroll. Focus left on the
    // tree, on the previous row, or dropped to the body when that row unmounted moves to it.
    onMounted(() =>
      watch(
        () => host.parts().item(key())["data-highlighted"] !== undefined,
        (highlighted) => {
          const node = el.value
          if (!(node instanceof HTMLElement) || !highlighted || !host.focused()) return
          const doc = node.ownerDocument
          const active = doc.activeElement
          if (active === node) return
          const treeEl = node.closest('[role="tree"]')
          const dropped = active === null || active === doc.body
          const inTree =
            active !== null &&
            treeEl !== null &&
            (active === treeEl ||
              (active.getAttribute("role") === "treeitem" &&
                active.closest('[role="tree"]') === treeEl))
          if (dropped || inTree) node.focus({ preventScroll: true })
        },
        { immediate: true, flush: "post" },
      ),
    )
    return () => {
      const k = key()
      const own = normalizeProps(host.parts().item(k))
      const wiring = {
        onPointerenter: () => host.setHovered(k),
        onPointerleave: () => host.setHovered(null),
        onPointerdown: (e: PointerEvent) => {
          host.setPressed(k)
          if (host.canMove(k)) host.startDrag(k, e)
        },
        onPointerup: () => host.setPressed(null),
        onPointercancel: () => host.setPressed(null),
      }
      if (props.href !== undefined) {
        const link = normalizeProps(
          linkProps(
            {
              href: props.href,
              target: props.target,
              rel: props.rel,
              current: props.current,
              routerOptions: props.routerOptions,
              tag: "a",
              origin: typeof location === "undefined" ? undefined : location.origin,
            },
            host.env,
          ),
        )
        // The tree's roving tabindex and role win over the link's.
        return renderPart(
          "a",
          mergeProps(link, { ...own, ref: refTo(el) }, wiring, attrs),
          slots.default?.(),
          props.asChild,
        )
      }
      return renderPart(
        "div",
        mergeProps({ ...own, ref: refTo(el) }, wiring, attrs),
        slots.default?.(),
        props.asChild,
      )
    }
  },
})

/** The drop line of a pointer drag: render it beside `TreeView.Tree` in a positioned wrapper. */
const DropIndicator = defineComponent({
  name: "TreeViewDropIndicator",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const host = useHost("DropIndicator")
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(host.parts().dropIndicator(host.dropAt())), attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

const ItemText = defineComponent({
  name: "TreeViewItemText",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const key = useItemKey("ItemText")
    const host = useHost("ItemText")
    onMounted(() =>
      watch(
        key,
        (k, _old, onCleanup) => {
          host.mountText(k, true)
          onCleanup(() => host.mountText(k, false))
        },
        { immediate: true },
      ),
    )
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(host.parts().itemText(key())), attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

const ItemIndicator = defineComponent({
  name: "TreeViewItemIndicator",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const key = useItemKey("ItemIndicator")
    const host = useHost("ItemIndicator")
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(host.parts().itemIndicator(key())), attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

const ItemCheckbox = defineComponent({
  name: "TreeViewItemCheckbox",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const key = useItemKey("ItemCheckbox")
    const host = useHost("ItemCheckbox")
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(host.parts().itemCheckbox(key())), attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

const Empty = defineComponent({
  name: "TreeViewEmpty",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const host = useHost("Empty")
    onMounted(() =>
      watch(
        () => host.parts().isEmpty,
        (shown, _old, onCleanup) => {
          if (!shown) return
          host.mountEmpty(true)
          onCleanup(() => host.mountEmpty(false))
        },
        { immediate: true },
      ),
    )
    return () =>
      host.parts().isEmpty
        ? renderPart(
            "div",
            mergeProps(normalizeProps(host.parts().empty()), attrs),
            slots.default ? slots.default() : host.messages().emptyLabel,
            props.asChild,
          )
        : null
  },
})

/** A hierarchy the user expands, navigates and selects or checks (openspec tree-view). */
/** The parts, by name: `tree-view.parts.ts` re-exports them as the `TreeView` namespace. */
export {
  DropIndicator,
  Empty,
  Item,
  ItemCheckbox,
  ItemIndicator,
  ItemText,
  Label,
  Loading,
  Root,
  Tree,
  useVisibleRows,
}
