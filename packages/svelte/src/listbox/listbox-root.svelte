<script lang="ts">
import {
  announcerCapability,
  type Collection,
  type CollectionKey,
  createListCollection,
  type ListboxActionDetails,
  type ListboxValue,
  layoutCapability,
  listboxConnect,
  listboxIds,
  listboxMachine,
  selectionOf,
} from "@rind-ui/core"
import { untrack } from "svelte"
import { useEnvironment } from "../provider"
import { useCollectionItems } from "../use-collection-items.svelte"
import { useMachine } from "../use-machine.svelte"
import { useModality } from "../use-modality.svelte"
import { listboxHost } from "./context"
import type { ListboxItemData, ListboxRootProps } from "./types"

let {
  id,
  children,
  selectionMode = "single",
  selectionBehavior = "toggle",
  value = $bindable(),
  defaultValue,
  onValueChange,
  disallowEmptySelection,
  orientation = "vertical",
  disabled = false,
  focusableWhenDisabled,
  disabledBehavior,
  loop,
  typeaheadTimeout,
  items,
  collection: given,
  loading,
  onLoadMore,
  virtualized,
  scrollToIndex,
  strategy = "roving",
  onAction,
}: ListboxRootProps = $props()

const fromData = (list: readonly ListboxItemData[]) =>
  createListCollection({
    items: list,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    isDisabled: (i) => i.disabled === true,
    getSection: (i) => i.section,
  })
const EMPTY = fromData([])
const env = useEnvironment(announcerCapability, layoutCapability)
const uid = $props.id()
const instance = $derived(id ?? uid)
const registered = useCollectionItems()
const data = $derived(items ? fromData(items) : null)
const collection = $derived(given ?? data ?? registered.collection ?? EMPTY)
const ids = $derived(listboxIds("listbox", instance))
const machine = useMachine(
  listboxMachine,
  () => ({
    collection,
    ids,
    strategy,
    orientation,
    selectionMode,
    selectionBehavior,
    disabled,
    disallowEmptySelection,
    disabledBehavior,
    focusableWhenDisabled,
    loop,
    typeaheadTimeout,
    loading,
    onLoadMore,
    virtualized,
    scrollToIndex,
    ...(value === undefined ? {} : { value: value as ListboxValue }),
    defaultValue:
      (defaultValue as ListboxValue | undefined) ?? (selectionMode === "multiple" ? [] : null),
    onValueChange: (v: ListboxValue, details: { event: unknown }) => {
      const e = details.event as { type: string; key?: string }
      onValueChange?.(v as never, { reason: e.type, key: e.key })
      if (value !== undefined) value = v as never
    },
    onAction: onAction ? (key: string, d: ListboxActionDetails) => onAction?.(key, d) : undefined,
  }),
  env,
)
let mounted = $state.raw<{
  label: boolean
  empty: boolean
  descriptions: ReadonlySet<CollectionKey>
}>({
  label: false,
  empty: false,
  descriptions: new Set(),
})
const focused = $derived(machine.view.matches("focused"))
const modality = useModality(env.modality, () => focused)
let loadedFor: Collection<unknown> | null = null
const parts = $derived(
  listboxConnect(
    {
      instance,
      collection,
      context: machine.view.context,
      selection: selectionOf(machine.view.values.value),
      selectionMode,
      selectionBehavior,
      orientation,
      strategy,
      disabled,
      focusableWhenDisabled,
      disabledBehavior,
      loading,
      pending: !given && !data && registered.collection === null,
      typingAhead: () => {
        const t = machine.service.getSnapshot().context.typeahead
        return t.buffer !== "" && env.clock.now() - t.at <= (typeaheadTimeout ?? 1000)
      },
      actions: onAction !== undefined,
      focused,
      modality: modality.current,
      mounted: {
        label: mounted.label,
        empty: mounted.empty,
        description: (key: CollectionKey) => mounted.descriptions.has(key),
      },
      send: machine.send,
    },
    env,
  ),
)
listboxHost.set({
  name: "Listbox",
  parts: () => parts,
  collection: () => collection,
  // Fixed by the mode the Root starts in (data-driven or registered).
  registry: untrack(() => given || items) ? null : registered.registry,
  mount: (part, on) => {
    const m = untrack(() => mounted)
    if (m[part] !== on) mounted = { ...m, [part]: on }
  },
  mountDescription: (key, on) => {
    const m = untrack(() => mounted)
    if (m.descriptions.has(key) === on) return
    const next = new Set(m.descriptions)
    if (on) next.add(key)
    else next.delete(key)
    mounted = { ...m, descriptions: next }
  },
  requestLoadMore: () => {
    if ((loading ?? "idle") !== "idle" || loadedFor === collection) return
    loadedFor = collection
    onLoadMore?.()
  },
})
</script>

<!-- The Root renders no element: the List is the listbox. -->
{@render children?.()}
