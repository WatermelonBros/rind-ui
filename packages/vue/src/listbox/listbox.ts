// Listbox: the Root hosting the listbox parts. Wiring only: the machine owns highlight,
// selection and typeahead; the core parts own every attribute.
import {
  announcerCapability,
  type Collection,
  type CollectionKey,
  createListCollection,
  type FocusStrategy,
  type ListboxActionDetails,
  type ListboxValue,
  type LoadingStatus,
  layoutCapability,
  listboxConnect,
  listboxIds,
  listboxMachine,
  type ScrollToIndexDetails,
  selectionOf,
} from "@rind-ui/core"
import {
  computed,
  defineComponent,
  type InjectionKey,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  type VNodeChild,
} from "vue"
import { useEnvironment } from "../provider"
import { useCollectionItems } from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { createListboxParts, type ListboxHost } from "./parts"

/** One item of a data-driven listbox. */
export interface ListboxItemData {
  readonly key: string
  readonly label: string
  readonly disabled?: boolean
  readonly section?: { readonly key: string; readonly label: string }
}
const fromData = (items: readonly ListboxItemData[]) =>
  createListCollection({
    items,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    isDisabled: (i) => i.disabled === true,
    getSection: (i) => i.section,
  })
const EMPTY = fromData([])

export interface ListboxChangeDetails {
  readonly reason: string
  readonly key: string | undefined
}

export const ListboxHostKey: InjectionKey<ListboxHost> = Symbol("rind-ui.listbox")

const Root = defineComponent({
  name: "ListboxRoot",
  props: {
    /** The base of the generated part ids. Default: a generated id. */
    id: String,
    /** `single` (default), `multiple` or `none` (actions only). */
    selectionMode: { type: String as PropType<"single" | "multiple" | "none">, default: "single" },
    /** `toggle` (default) or `replace` (a press selects only that item; actions are allowed). */
    selectionBehavior: { type: String as PropType<"toggle" | "replace">, default: "toggle" },
    /** Controlled selection (`v-model`): a key or null (single), keys or "all" (multiple). */
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
    orientation: { type: String as PropType<"vertical" | "horizontal">, default: "vertical" },
    disabled: Boolean,
    /** A disabled list keeps its Tab stop and disabled items stay reachable (not selectable). */
    focusableWhenDisabled: { type: Boolean, default: undefined },
    /** `all`: disabled items are skipped and not actionable; `selection`: reachable, only not selectable. Default: `"all"`. */
    disabledBehavior: String as PropType<"all" | "selection">,
    /** Arrow keys wrap from the last item to the first and back. Default: `false`. */
    loop: { type: Boolean, default: undefined },
    /** How long typed characters build one typeahead search (ms). Default: 1000. */
    typeaheadTimeout: Number,
    /** Data items. Without them (and without `collection`), item parts register themselves. */
    items: Array as PropType<readonly ListboxItemData[]>,
    /** A collection built by the consumer (virtualized lists). */
    collection: Object as PropType<Collection<unknown>>,
    loading: String as PropType<LoadingStatus>,
    onLoadMore: Function as PropType<() => void>,
    /** Items are not all rendered: the highlighted item is scrolled through `scrollToIndex`, never `scrollIntoView`. */
    virtualized: { type: Boolean, default: undefined },
    /** Scrolls the highlighted item into view on navigation, typeahead and open (replaces `scrollIntoView`). */
    scrollToIndex: Function as PropType<(details: ScrollToIndexDetails) => void>,
    /** `roving`: DOM focus moves to the item; `active-descendant`: focus stays on the list. Default: `"roving"`. */
    strategy: { type: String as PropType<FocusStrategy>, default: "roving" },
    onAction: Function as PropType<(key: string, details: ListboxActionDetails) => void>,
  },
  emits: {
    valueChange: (_value: string | readonly string[] | null, _details: ListboxChangeDetails) =>
      true,
    "update:modelValue": (_value: string | readonly string[] | null) => true,
  },
  slots: Object as SlotsType<{ default?: () => VNodeChild }>,
  setup(props, { slots, emit }) {
    const env = useEnvironment(announcerCapability, layoutCapability)
    const instance = useRootId(() => props.id)
    const { collection: registered, registry } = useCollectionItems()
    const data = computed(() => (props.items ? fromData(props.items) : null))
    const collection = computed(() => props.collection ?? data.value ?? registered.value ?? EMPTY)
    const ids = computed(() => listboxIds("listbox", instance()))
    const { view, send, service } = useMachine(
      listboxMachine,
      () => ({
        collection: collection.value,
        ids: ids.value,
        strategy: props.strategy,
        orientation: props.orientation,
        selectionMode: props.selectionMode,
        selectionBehavior: props.selectionBehavior,
        disabled: props.disabled,
        disallowEmptySelection: props.disallowEmptySelection,
        disabledBehavior: props.disabledBehavior,
        focusableWhenDisabled: props.focusableWhenDisabled,
        loop: props.loop,
        typeaheadTimeout: props.typeaheadTimeout,
        loading: props.loading,
        onLoadMore: props.onLoadMore,
        virtualized: props.virtualized,
        scrollToIndex: props.scrollToIndex,
        ...(props.modelValue === undefined ? {} : { value: props.modelValue as ListboxValue }),
        defaultValue:
          (props.defaultValue as ListboxValue | undefined) ??
          (props.selectionMode === "multiple" ? [] : null),
        onValueChange: (v: ListboxValue, details: { event: unknown }) => {
          const e = details.event as { type: string; key?: string }
          emit("valueChange", v as never, { reason: e.type, key: e.key })
          emit("update:modelValue", v as never)
        },
        onAction: props.onAction
          ? (key: string, d: ListboxActionDetails) => props.onAction?.(key, d)
          : undefined,
      }),
      env,
    )
    const mounted = shallowRef<{
      label: boolean
      empty: boolean
      descriptions: ReadonlySet<CollectionKey>
    }>({
      label: false,
      empty: false,
      descriptions: new Set(),
    })
    const focused = () => view.value.matches("focused")
    const modality = useModality(env.modality, focused)
    let loadedFor: Collection<unknown> | null = null
    const parts = computed(() =>
      listboxConnect(
        {
          instance: instance(),
          collection: collection.value,
          context: view.value.context,
          selection: selectionOf(view.value.values.value),
          selectionMode: props.selectionMode,
          selectionBehavior: props.selectionBehavior,
          orientation: props.orientation,
          strategy: props.strategy,
          disabled: props.disabled,
          focusableWhenDisabled: props.focusableWhenDisabled,
          disabledBehavior: props.disabledBehavior,
          loading: props.loading,
          pending: !props.collection && !data.value && registered.value === null,
          typingAhead: () => {
            const t = service.getSnapshot().context.typeahead
            return t.buffer !== "" && env.clock.now() - t.at <= (props.typeaheadTimeout ?? 1000)
          },
          actions: props.onAction !== undefined,
          focused: focused(),
          modality: modality.value,
          mounted: {
            label: mounted.value.label,
            empty: mounted.value.empty,
            description: (key: CollectionKey) => mounted.value.descriptions.has(key),
          },
          send,
        },
        env,
      ),
    )
    provide(ListboxHostKey, {
      name: "Listbox",
      parts: () => parts.value,
      collection: () => collection.value,
      registry: props.collection || props.items ? null : registry,
      mount: (part, on) => {
        if (mounted.value[part] !== on) mounted.value = { ...mounted.value, [part]: on }
      },
      mountDescription: (key, on) => {
        const m = mounted.value
        if (m.descriptions.has(key) === on) return
        const next = new Set(m.descriptions)
        if (on) next.add(key)
        else next.delete(key)
        mounted.value = { ...m, descriptions: next }
      },
      requestLoadMore: () => {
        if ((props.loading ?? "idle") !== "idle" || loadedFor === collection.value) return
        loadedFor = collection.value
        props.onLoadMore?.()
      },
    })
    // The Root renders no element: the List is the listbox.
    return () => slots.default?.()
  },
})

const {
  Label,
  List,
  Item,
  ItemText,
  ItemDescription,
  ItemIndicator,
  Section,
  Separator,
  Empty,
  LoadMore,
  Items,
} = createListboxParts(ListboxHostKey, "Listbox")

/** The parts, by name: `listbox.parts.ts` re-exports them as the `Listbox` namespace. */
export {
  Empty,
  Item,
  ItemDescription,
  ItemIndicator,
  Items,
  ItemText,
  Label,
  List,
  LoadMore,
  Root,
  Section,
  Separator,
}
