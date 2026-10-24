<script lang="ts">
import {
  announcerCapability,
  type Collection,
  type CollectionKey,
  createListCollection,
  type GridListActionDetails,
  type GridListValue,
  gridListConnect,
  gridListIds,
  gridListMachine,
  gridSelectionOf,
  layoutCapability,
  toKey,
} from "@rind-ui/core"
import { untrack } from "svelte"
import { SvelteMap, SvelteSet } from "svelte/reactivity"
import { useEnvironment } from "../provider"
import { useCollectionItems } from "../use-collection-items.svelte"
import { useMachine } from "../use-machine.svelte"
import { useModality } from "../use-modality.svelte"
import { gridListHost } from "./context.svelte"
import type { GridListItemData, GridListRootProps } from "./types"

let {
  id,
  children,
  selectionMode = "none",
  selectionBehavior = "toggle",
  value = $bindable(),
  defaultValue,
  onValueChange,
  disallowEmptySelection,
  disabled = false,
  focusableWhenDisabled,
  disabledBehavior,
  loop = false,
  typeaheadTimeout,
  disallowTypeAhead = false,
  childNavigation = "arrow",
  layout = "stack",
  items,
  collection: given,
  onAction,
  selectOnPressUp = false,
  autoFocus = false,
  onLoadMore,
  messages,
}: GridListRootProps = $props()

const fromData = (list: readonly GridListItemData[]) =>
  createListCollection({
    items: list,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    isDisabled: (i) => i.disabled === true,
  })
const EMPTY = fromData([])
const env = useEnvironment(announcerCapability, layoutCapability)
const uid = $props.id()
const instance = $derived(id ?? uid)
const registered = useCollectionItems()
const data = $derived(items ? fromData(items) : null)
const collection = $derived(given ?? data ?? registered.collection ?? EMPTY)
const ids = $derived(gridListIds(instance))
const staticLinks = new SvelteMap<CollectionKey, string>()
const links = $derived.by(() => {
  const out = new Map(staticLinks)
  for (const i of items ?? []) if (i.href !== undefined) out.set(toKey(i.key), i.href)
  return out
})
const checkboxes = new SvelteSet<CollectionKey>()
// Per-row actions (Item `onAction`): any of them makes the list actionable.
const rowActions = new Map<CollectionKey, (details: GridListActionDetails) => void>()
// Bumped whenever a row gains or loses its action (keys can swap at the same count).
let rowActionVersion = $state(0)
const actionable = $derived.by(() => {
  void rowActionVersion
  return onAction !== undefined || rowActions.size > 0
})
// Only the Item actions: the rows that have one (the Root's acts on every row).
const actionRows = $derived.by(() => {
  void rowActionVersion
  return onAction ? undefined : new Set(rowActions.keys())
})
const machine = useMachine(
  gridListMachine,
  () => ({
    collection,
    ids,
    strategy: "roving" as const,
    selectionMode,
    selectionBehavior,
    disallowEmptySelection,
    disabledBehavior,
    focusableWhenDisabled,
    disabled,
    loop,
    typeaheadTimeout,
    checkboxes: new Set(checkboxes),
    messages,
    ...(value === undefined ? {} : { value: value as GridListValue }),
    defaultValue:
      (defaultValue as GridListValue | undefined) ?? (selectionMode === "multiple" ? [] : null),
    onValueChange: (v: GridListValue, details: { event: unknown }) => {
      const e = details.event as { type: string; key?: string }
      onValueChange?.(v as never, { reason: e.type, key: e.key })
      if (value !== undefined) value = v as never
    },
    actionRows,
    onAction: actionable
      ? (key: string, d: GridListActionDetails) => {
          rowActions.get(toKey(key))?.(d)
          onAction?.(key, d)
        }
      : undefined,
  }),
  env,
)
// autoFocus: the selected row, else the first (the machine's tab stop), once rows exist.
let autoFocused = false
$effect(() => {
  const size = collection.size
  untrack(() => {
    if (!autoFocus || autoFocused || size === 0) return
    autoFocused = true
    machine.send({ type: "FOCUS", modality: env.modality.modality() })
  })
})
let label = $state(false)
const descriptions = new SvelteSet<CollectionKey>()
let hovered = $state<CollectionKey | null>(null)
let pressed = $state<CollectionKey | null>(null)
const focused = $derived(machine.view.matches("focused"))
const modality = useModality(env.modality, () => focused)
let loadedFor: Collection<unknown> | null = null
const parts = $derived(
  gridListConnect(
    {
      instance,
      collection,
      context: machine.view.context,
      selection: gridSelectionOf(machine.view.values.value as GridListValue),
      selectionMode,
      selectionBehavior,
      childNavigation,
      layout,
      actions: (key: CollectionKey) =>
        actionable && (actionRows === undefined || actionRows.has(key)),
      selectOnPressUp,
      links,
      disabled,
      focusableWhenDisabled,
      disabledBehavior,
      disallowTypeAhead,
      pending: !given && !data && registered.collection === null,
      focused,
      modality: modality.current,
      hoveredKey: hovered,
      pressedKey: pressed,
      typingAhead: () => {
        const t = machine.service.getSnapshot().context.typeahead
        return t.buffer !== "" && env.clock.now() - t.at <= (typeaheadTimeout ?? 1000)
      },
      mounted: { label, description: (key: CollectionKey) => descriptions.has(key) },
      messages,
      send: machine.send,
    },
    env,
  ),
)
gridListHost.set({
  parts: () => parts,
  collection: () => collection,
  // Fixed by the mode the Root starts in (data-driven or registered).
  registry: untrack(() => given || items) ? null : registered.registry,
  mountLabel: (on) => {
    label = on
  },
  mountDescription: (key, on) => {
    if (on) descriptions.add(key)
    else descriptions.delete(key)
  },
  mountLink: (key, href) => {
    if (href === null) staticLinks.delete(key)
    else if (untrack(() => staticLinks.get(key)) !== href) staticLinks.set(key, href)
  },
  mountCheckbox: (key, on) => {
    if (on) checkboxes.add(key)
    else checkboxes.delete(key)
  },
  mountRowAction: (key, fn) => {
    const had = rowActions.has(key)
    if (fn) rowActions.set(key, fn)
    else rowActions.delete(key)
    if (had !== (fn !== null)) rowActionVersion++
  },
  hover: (key) => {
    hovered = key
  },
  press: (key) => {
    pressed = key
  },
  requestLoadMore: () => {
    if (loadedFor === collection) return
    loadedFor = collection
    onLoadMore?.()
  },
})
</script>

{@render children?.()}
