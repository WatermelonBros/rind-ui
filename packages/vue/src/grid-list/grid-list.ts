// Grid List: the Root hosting the parts (design §3). Wiring only: the machine owns the
// highlight, the child position, selection and actions; connect owns every attribute and
// the key-ownership rule. Rows come from `items` data or from static Item parts.
import {
  announcerCapability,
  type Collection,
  type CollectionKey,
  createListCollection,
  type GridListActionDetails,
  type GridListItemOptions,
  type GridListLayout,
  type GridListMessages,
  type GridListParts,
  type GridListValue,
  gridListConnect,
  gridListIds,
  gridListMachine,
  gridSelectionOf,
  layoutCapability,
  toKey,
  warnForeignFocusables,
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
import { useEnvironment } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useCollectionItems, useRegisterItem } from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare const process: { env: { NODE_ENV?: string } }

/** One row of a data-driven list. */
export interface GridListItemData {
  readonly key: string
  readonly label: string
  readonly disabled?: boolean
  /** A link row: Enter and a press follow it. */
  readonly href?: string
}
const fromData = (items: readonly GridListItemData[]) =>
  createListCollection({
    items,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    isDisabled: (i) => i.disabled === true,
  })
const EMPTY = fromData([])

export interface GridListChangeDetails {
  readonly reason: string
  readonly key: string | undefined
}

interface Host {
  readonly parts: () => GridListParts
  readonly collection: () => Collection<unknown>
  readonly registry: ReturnType<typeof useCollectionItems>["registry"] | null
  readonly mountLabel: (on: boolean) => void
  readonly mountDescription: (key: CollectionKey, on: boolean) => void
  readonly mountLink: (key: CollectionKey, href: string | null) => void
  readonly mountCheckbox: (key: CollectionKey, on: boolean) => void
  readonly mountRowAction: (
    key: CollectionKey,
    fn: ((details: GridListActionDetails) => void) | null,
  ) => void
  readonly hover: (key: CollectionKey | null) => void
  readonly press: (key: CollectionKey | null) => void
  readonly requestLoadMore: () => void
}
const HostKey: InjectionKey<Host> = Symbol("rind-ui.grid-list")
const useHost = (part: string): Host => {
  const host = inject(HostKey, null)
  if (!host) throw new Error(`GridList.${part} must be inside GridList.Root`)
  return host
}
const ItemKey: InjectionKey<() => CollectionKey> = Symbol("rind-ui.grid-list-item")
const useItemKey = (part: string) => {
  const key = inject(ItemKey, null)
  if (key === null) throw new Error(`GridList.${part} must be inside GridList.Item`)
  return key
}
const ListKey: InjectionKey<boolean> = Symbol("rind-ui.grid-list-list")
type Slots = SlotsType<{ default?: () => VNodeChild }>

const Root = defineComponent({
  name: "GridListRoot",
  props: {
    /** The base the parts' ids derive from. Default: generated. */
    id: String,
    /** `none` (default), `single` or `multiple`. */
    selectionMode: { type: String as PropType<"none" | "single" | "multiple">, default: "none" },
    selectionBehavior: { type: String as PropType<"toggle" | "replace">, default: "toggle" },
    /** Controlled selection (`v-model`). */
    modelValue: {
      type: [String, Array, null] as PropType<string | readonly string[] | null>,
      default: undefined,
    },
    defaultValue: {
      type: [String, Array, null] as PropType<string | readonly string[] | null>,
      default: undefined,
    },
    /** No user action leaves the selection empty. */
    disallowEmptySelection: { type: Boolean, default: undefined },
    disabled: Boolean,
    /** Disabled rows stay navigable, and a disabled list keeps its Tab stop. */
    focusableWhenDisabled: { type: Boolean, default: undefined },
    /** "selection": a disabled row is not selectable but still acts. Default: "all". */
    disabledBehavior: String as PropType<"all" | "selection">,
    /** Arrow keys wrap around. Default false. */
    loop: Boolean,
    /** Milliseconds of idle time that end a typeahead search. Default: 1000. */
    typeaheadTimeout: Number,
    disallowTypeAhead: Boolean,
    childNavigation: { type: String as PropType<"arrow" | "tab">, default: "arrow" },
    layout: { type: String as PropType<GridListLayout>, default: "stack" },
    items: Array as PropType<readonly GridListItemData[]>,
    /** A collection built by the consumer (wins over `items` and Item parts). */
    collection: Object as PropType<Collection<unknown>>,
    onAction: Function as PropType<(key: string, details: GridListActionDetails) => void>,
    /** Presses select on pointer up (for lists inside popups). Default false. */
    selectOnPressUp: Boolean,
    /** Focus the selected row (else the first) on mount. */
    autoFocus: Boolean,
    onLoadMore: Function as PropType<() => void>,
    /** Selection announcements and the checkboxes' names. */
    messages: Object as PropType<Partial<GridListMessages>>,
  },
  emits: {
    valueChange: (_value: string | readonly string[] | null, _details: GridListChangeDetails) =>
      true,
    "update:modelValue": (_value: string | readonly string[] | null) => true,
  },
  slots: Object as Slots,
  setup(props, { slots, emit }) {
    const env = useEnvironment(announcerCapability, layoutCapability)
    const instance = useRootId(() => props.id)
    const { collection: registered, registry } = useCollectionItems()
    const data = computed(() => (props.items ? fromData(props.items) : null))
    const collection = computed(() => props.collection ?? data.value ?? registered.value ?? EMPTY)
    const ids = computed(() => gridListIds(instance()))
    const staticLinks = shallowRef<ReadonlyMap<CollectionKey, string>>(new Map())
    const links = computed(() => {
      const out = new Map(staticLinks.value)
      for (const i of props.items ?? []) if (i.href !== undefined) out.set(toKey(i.key), i.href)
      return out
    })
    const checkboxes = shallowRef<ReadonlySet<CollectionKey>>(new Set())
    // Per-row actions (Item `onAction`): any of them makes the list actionable.
    const rowActions = new Map<CollectionKey, (details: GridListActionDetails) => void>()
    // Bumped whenever a row gains or loses its action (keys can swap at the same count).
    const rowActionVersion = shallowRef(0)
    const actionable = () => {
      void rowActionVersion.value
      return props.onAction !== undefined || rowActions.size > 0
    }
    // Only the Item actions: the rows that have one (the Root's acts on every row).
    const actionRows = computed(() => {
      void rowActionVersion.value
      return props.onAction ? undefined : new Set(rowActions.keys())
    })
    const { view, send, service } = useMachine(
      gridListMachine,
      () => ({
        collection: collection.value,
        ids: ids.value,
        strategy: "roving" as const,
        selectionMode: props.selectionMode,
        selectionBehavior: props.selectionBehavior,
        disallowEmptySelection: props.disallowEmptySelection,
        disabledBehavior: props.disabledBehavior,
        focusableWhenDisabled: props.focusableWhenDisabled,
        disabled: props.disabled,
        loop: props.loop,
        typeaheadTimeout: props.typeaheadTimeout,
        checkboxes: checkboxes.value,
        messages: props.messages,
        ...(props.modelValue === undefined ? {} : { value: props.modelValue as GridListValue }),
        defaultValue:
          (props.defaultValue as GridListValue | undefined) ??
          (props.selectionMode === "multiple" ? [] : null),
        onValueChange: (v: GridListValue, details: { event: unknown }) => {
          const e = details.event as { type: string; key?: string }
          emit("valueChange", v as never, { reason: e.type, key: e.key })
          emit("update:modelValue", v as never)
        },
        actionRows: actionRows.value,
        onAction: actionable()
          ? (key: string, d: GridListActionDetails) => {
              rowActions.get(toKey(key))?.(d)
              props.onAction?.(key, d)
            }
          : undefined,
      }),
      env,
    )
    // autoFocus: the selected row, else the first (the machine's tab stop), once rows exist.
    let autoFocused = false
    onMounted(() =>
      watch(
        collection,
        (c) => {
          if (!props.autoFocus || autoFocused || c.size === 0) return
          autoFocused = true
          send({ type: "FOCUS", modality: env.modality.modality() })
        },
        { immediate: true },
      ),
    )
    const label = shallowRef(false)
    const descriptions = shallowRef<ReadonlySet<CollectionKey>>(new Set())
    const hovered = shallowRef<CollectionKey | null>(null)
    const pressed = shallowRef<CollectionKey | null>(null)
    const focused = () => view.value.matches("focused")
    const modality = useModality(env.modality, focused)
    let loadedFor: Collection<unknown> | null = null
    const toggle = <T>(set: ReadonlySet<T>, key: T, on: boolean): ReadonlySet<T> => {
      if (set.has(key) === on) return set
      const next = new Set(set)
      if (on) next.add(key)
      else next.delete(key)
      return next
    }
    const parts = computed(() =>
      gridListConnect(
        {
          instance: instance(),
          collection: collection.value,
          context: view.value.context,
          selection: gridSelectionOf(view.value.values.value as GridListValue),
          selectionMode: props.selectionMode,
          selectionBehavior: props.selectionBehavior,
          childNavigation: props.childNavigation,
          layout: props.layout,
          actions: (key: CollectionKey) =>
            actionable() && (actionRows.value === undefined || actionRows.value.has(key)),
          selectOnPressUp: props.selectOnPressUp,
          links: links.value,
          disabled: props.disabled,
          focusableWhenDisabled: props.focusableWhenDisabled,
          disabledBehavior: props.disabledBehavior,
          disallowTypeAhead: props.disallowTypeAhead,
          pending: !props.collection && !data.value && registered.value === null,
          focused: focused(),
          modality: modality.value,
          hoveredKey: hovered.value,
          pressedKey: pressed.value,
          typingAhead: () => {
            const t = service.getSnapshot().context.typeahead
            return t.buffer !== "" && env.clock.now() - t.at <= (props.typeaheadTimeout ?? 1000)
          },
          mounted: {
            label: label.value,
            description: (key: CollectionKey) => descriptions.value.has(key),
          },
          messages: props.messages,
          send,
        },
        env,
      ),
    )
    provide(HostKey, {
      parts: () => parts.value,
      collection: () => collection.value,
      registry: props.collection || props.items ? null : registry,
      mountLabel: (on) => (label.value = on),
      mountDescription: (key, on) => (descriptions.value = toggle(descriptions.value, key, on)),
      mountLink: (key, href) => {
        const m = staticLinks.value
        if ((m.get(key) ?? null) === href) return
        const next = new Map(m)
        if (href === null) next.delete(key)
        else next.set(key, href)
        staticLinks.value = next
      },
      mountCheckbox: (key, on) => (checkboxes.value = toggle(checkboxes.value, key, on)),
      mountRowAction: (key, fn) => {
        const had = rowActions.has(key)
        if (fn) rowActions.set(key, fn)
        else rowActions.delete(key)
        if (had !== (fn !== null)) rowActionVersion.value++
      },
      hover: (key) => (hovered.value = key),
      press: (key) => (pressed.value = key),
      requestLoadMore: () => {
        if (loadedFor === collection.value) return
        loadedFor = collection.value
        props.onLoadMore?.()
      },
    })
    return () => slots.default?.()
  },
})

const Label = defineComponent({
  name: "GridListLabel",
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

const List = defineComponent({
  name: "GridListList",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const host = useHost("List")
    const env = useEnvironment()
    // The modality is tracked from mount: the first press on a row is seen as a pointer press.
    onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
    const el = shallowRef<Element | null>(null)
    provide(ListKey, true)
    onMounted(() => {
      const node = el.value
      if (process.env.NODE_ENV === "production" || !node) return
      queueMicrotask(() => {
        if (!node.isConnected) return
        if (!node.hasAttribute("aria-label") && !node.hasAttribute("aria-labelledby")) {
          console.warn(
            "[rind-ui] GridList: the list has no accessible name; render a Label or pass aria-label / aria-labelledby.",
          )
        }
      })
    })
    return () => {
      const naming = {
        "aria-label": attrs["aria-label"] as string | undefined,
        "aria-labelledby": attrs["aria-labelledby"] as string | undefined,
      }
      return renderPart(
        "div",
        mergeProps({ ...normalizeProps(host.parts().list(naming)), ref: refTo(el) }, attrs),
        slots.default?.(),
        props.asChild,
      )
    }
  },
})

const Item = defineComponent({
  name: "GridListItem",
  inheritAttrs: false,
  props: {
    /** The row key. */
    value: { type: String, required: true },
    /** The row's text for typeahead and announcements. Default: its ItemText's text. */
    textValue: String,
    /** Disables this row: it cannot be selected and, unless the Root's `disabledBehavior` is `"selection"`, it does not act. */
    disabled: { type: Boolean, default: undefined },
    /** A link row: Enter and a press follow it (role stays `row`). */
    href: String,
    /** Marks the row current (`aria-current`, `data-current`), e.g. a link row for the current page. */
    current: {
      type: [Boolean, String] as PropType<GridListItemOptions["current"]>,
      default: undefined,
    },
    /** This row's action (with the Root's `onAction`, both run). */
    onAction: Function as PropType<(details: GridListActionDetails) => void>,
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const host = useHost("Item")
    const key = () => toKey(props.value)
    const row = shallowRef<Element | null>(null)
    // The row's text is its ItemText, not its controls' labels (typeahead, announcements).
    const ownText = shallowRef<string | undefined>(undefined)
    const readText = () => {
      const text = row.value
        ?.querySelector('[data-scope="grid-list"][data-part="item-text"]')
        ?.textContent?.trim()
      if (text !== ownText.value) ownText.value = text
      // Development: a focusable the grid cannot reach (not an ItemControl) is named.
      if (row.value instanceof HTMLElement) warnForeignFocusables(row.value, "GridList")
    }
    onMounted(readText)
    onUpdated(readText)
    useRegisterItem(
      host.registry,
      () => ({
        key: props.value,
        textValue: props.textValue ?? ownText.value,
        disabled: props.disabled,
      }),
      row,
    )
    onMounted(() => {
      watch(
        () => [key(), props.onAction !== undefined] as const,
        ([k, has], _old, onCleanup) => {
          if (!has) return
          host.mountRowAction(k, (d) => props.onAction?.(d))
          onCleanup(() => host.mountRowAction(k, null))
        },
        { immediate: true },
      )
      watch(
        () => [key(), props.href] as const,
        ([k, href], _old, onCleanup) => {
          if (href === undefined) return
          host.mountLink(k, href)
          onCleanup(() => host.mountLink(k, null))
        },
        { immediate: true },
      )
    })
    provide(ItemKey, key)
    return () => {
      const k = key()
      const own = host.parts().item(k, {
        "aria-label": attrs["aria-label"] as string | undefined,
        "aria-labelledby": attrs["aria-labelledby"] as string | undefined,
        current: props.current,
      })
      return renderPart(
        "div",
        mergeProps(
          {
            // Connect's own pointer-down (the press commit) runs with the pressed-state tracking.
            ...joinHandlers(normalizeProps(own), {
              onPointerenter: () => host.hover(k),
              onPointerleave: () => host.hover(null),
              onPointerdown: () => host.press(k),
              onPointerup: () => host.press(null),
              onPointercancel: () => host.press(null),
            }),
            ref: refTo(row),
          },
          attrs,
        ),
        h("div", normalizeProps(host.parts().itemCell()), slots.default?.() as never),
        props.asChild,
      )
    }
  },
})

const ItemText = defineComponent({
  name: "GridListItemText",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const host = useHost("ItemText")
    const key = useItemKey("ItemText")
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(host.parts().itemText(key())), attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

const ItemDescription = defineComponent({
  name: "GridListItemDescription",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const host = useHost("ItemDescription")
    const key = useItemKey("ItemDescription")
    onMounted(() =>
      watch(
        key,
        (k, _old, onCleanup) => {
          host.mountDescription(k, true)
          onCleanup(() => host.mountDescription(k, false))
        },
        { immediate: true },
      ),
    )
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(host.parts().itemDescription(key())), attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

/** A control's focus and modality (its ring). Call in setup. */
function useControlFocus() {
  const env = useEnvironment()
  const focused = shallowRef(false)
  const modality = useModality(env.modality, () => focused.value)
  return {
    state: () => ({ focused: focused.value, modality: modality.value }),
    handlers: {
      onFocusin: () => (focused.value = true),
      onFocusout: () => (focused.value = false),
    },
  }
}

/**
 * The row's selection checkbox; with `all` (outside the rows, multiple mode) the select-all
 * checkbox: checked, mixed or unchecked from the selection.
 */
const ItemCheckbox = defineComponent({
  name: "GridListItemCheckbox",
  inheritAttrs: false,
  props: {
    /** The select-all checkbox (outside the rows, multiple mode) instead of a row's. */
    all: Boolean,
    ...asChildProp,
  },
  setup(props, { attrs }) {
    const host = useHost("ItemCheckbox")
    const key = props.all ? null : useItemKey("ItemCheckbox")
    const focus = useControlFocus()
    const el = shallowRef<Element | null>(null)
    if (key) {
      onMounted(() =>
        watch(
          key,
          (k, _old, onCleanup) => {
            host.mountCheckbox(k, true)
            onCleanup(() => host.mountCheckbox(k, false))
          },
          { immediate: true },
        ),
      )
    }
    // `indeterminate` is a DOM property, not an attribute.
    const syncMixed = () => {
      if (!props.all || !(el.value instanceof HTMLInputElement)) return
      el.value.indeterminate = host.parts().selectAllCheckbox()["aria-checked"] === "mixed"
    }
    onMounted(syncMixed)
    onUpdated(syncMixed)
    return () =>
      key
        ? renderPart(
            "input",
            mergeProps(
              {
                ...normalizeProps(host.parts().itemCheckbox(key(), focus.state())),
                ...focus.handlers,
              },
              attrs,
            ),
            undefined,
            props.asChild,
          )
        : renderPart(
            "input",
            mergeProps(
              { ...normalizeProps(host.parts().selectAllCheckbox()), ref: refTo(el) },
              attrs,
            ),
            undefined,
            props.asChild,
          )
  },
})

/** A control of the row: your button, link or field (its single child, with `asChild`). */
const ItemControl = defineComponent({
  name: "GridListItemControl",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const host = useHost("ItemControl")
    const key = useItemKey("ItemControl")
    const focus = useControlFocus()
    return () =>
      renderPart(
        "button",
        // `type="button"` only for the default element: a substituted field keeps its own type.
        mergeProps(
          {
            ...(props.asChild ? {} : { type: "button" }),
            ...normalizeProps(host.parts().itemControl(key(), focus.state())),
            ...focus.handlers,
          },
          attrs,
        ),
        slots.default?.(),
        props.asChild,
      )
  },
})

const Empty = defineComponent({
  name: "GridListEmpty",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const host = useHost("Empty")
    const inList = inject(ListKey, false)
    onMounted(() => {
      if (process.env.NODE_ENV !== "production" && !inList)
        console.warn("[rind-ui] GridList: Empty is outside List; render it inside GridList.List.")
    })
    return () =>
      host.parts().isEmpty
        ? renderPart(
            "div",
            mergeProps(normalizeProps(host.parts().empty()), attrs),
            slots.default?.(),
            props.asChild,
          )
        : null
  },
})

/** A `row` sentinel: `onLoadMore` once per collection when it scrolls into view. */
const LoadMore = defineComponent({
  name: "GridListLoadMore",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const host = useHost("LoadMore")
    const el = shallowRef<Element | null>(null)
    onMounted(() => {
      const node = el.value
      if (!node || typeof IntersectionObserver === "undefined") return
      // The nearest scroll container, else the viewport (never <html> as an explicit root).
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) host.requestLoadMore()
      })
      observer.observe(node)
      onBeforeUnmount(() => observer.disconnect())
    })
    return () =>
      renderPart(
        "div",
        mergeProps({ ...normalizeProps(host.parts().loadMore()), ref: refTo(el) }, attrs),
        // The row's one cell (a row holds cells); the row itself is the focus target.
        h("div", { role: "gridcell" }, slots.default?.() as never),
        props.asChild,
      )
  },
})

/** Data mode: every row of `items`, with its text. */
const Items = defineComponent({
  name: "GridListItems",
  /** The default slot renders a row's content from `{ label, key }`; default: an ItemText. */
  slots: Object as SlotsType<{ default?: (row: { label: string; key: string }) => VNodeChild }>,
  setup(_props, { slots }) {
    const host = useHost("Items")
    return () => {
      const out = []
      for (const node of host.collection()) {
        if (node.type !== "item") continue
        out.push(
          h(
            Item,
            { key: node.key, value: node.key, textValue: node.textValue, disabled: node.disabled },
            () =>
              slots.default
                ? slots.default({ label: node.textValue, key: node.key })
                : h(ItemText, null, () => node.textValue),
          ),
        )
      }
      return out
    }
  },
})

/** Rows that are selected, acted on or followed, and may hold buttons, links and fields. */
/** The parts, by name: `grid-list.parts.ts` re-exports them as the `GridList` namespace. */
export {
  Empty,
  Item,
  ItemCheckbox,
  ItemControl,
  ItemDescription,
  Items,
  ItemText,
  Label,
  List,
  LoadMore,
  Root,
}
