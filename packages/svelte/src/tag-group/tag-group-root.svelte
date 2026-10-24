<script lang="ts">
import {
  announcerCapability,
  type CollectionKey,
  createListCollection,
  layoutCapability,
  type TagGroupActionDetails,
  type TagGroupRemoveDetails,
  type TagGroupValue,
  tagGroupConnect,
  tagGroupIds,
  tagGroupMachine,
  tagSelectionOf,
  toKey,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { SvelteSet } from "svelte/reactivity"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useCollectionItems } from "../use-collection-items.svelte"
import { useMachine } from "../use-machine.svelte"
import { useModality } from "../use-modality.svelte"
import { tagGroupHost } from "./context"
import type { TagGroupItemData, TagGroupRootProps } from "./types"

let {
  selectionMode = "none",
  value = $bindable(),
  defaultValue,
  onValueChange,
  disallowEmptySelection,
  disabled = false,
  focusableWhenDisabled = true,
  loop = true,
  typeaheadTimeout,
  items,
  collection: given,
  onRemove,
  onAction,
  messages,
  id,
  child,
  children,
  ...rest
}: TagGroupRootProps = $props()

const fromData = (list: readonly TagGroupItemData[]) =>
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
const ids = $derived(tagGroupIds(instance))
const staticLinks = new SvelteSet<CollectionKey>()
const links = $derived.by(() => {
  const out = new Set<CollectionKey>(staticLinks)
  for (const i of items ?? []) if (i.href !== undefined) out.add(toKey(i.key))
  return out
})
const machine = useMachine(
  tagGroupMachine,
  () => ({
    collection,
    ids,
    instance,
    strategy: "roving" as const,
    selectionMode,
    selectionBehavior: "toggle" as const,
    disallowEmptySelection,
    disabled,
    focusableWhenDisabled,
    loop,
    typeaheadTimeout,
    links,
    messages,
    ...(value === undefined ? {} : { value: value as TagGroupValue }),
    defaultValue:
      (defaultValue as TagGroupValue | undefined) ?? (selectionMode === "multiple" ? [] : null),
    onValueChange: (v: TagGroupValue, details: { event: unknown }) => {
      const e = details.event as { type: string; key?: string }
      onValueChange?.(v as never, { reason: e.type, key: e.key })
      if (value !== undefined) value = v as never
    },
    onRemove: onRemove
      ? (keys: readonly string[], d: TagGroupRemoveDetails) => onRemove?.(keys, d)
      : undefined,
    onAction: onAction ? (key: string, d: TagGroupActionDetails) => onAction?.(key, d) : undefined,
  }),
  env,
)
let mounted = $state({ label: false, description: false })
let hovered = $state<CollectionKey | null>(null)
let pressed = $state<CollectionKey | null>(null)
// The hint follows the last interaction anywhere (a virtual cursor arrives from outside).
const modality = useModality(env.modality, () => true)
const parts = $derived(
  tagGroupConnect(
    {
      instance,
      collection,
      context: machine.view.context,
      selection: tagSelectionOf(machine.view.values.value as TagGroupValue),
      selectionMode,
      removable: onRemove !== undefined,
      actions: onAction !== undefined,
      links,
      disabled,
      focusableWhenDisabled,
      pending: !given && !data && registered.collection === null,
      focused: machine.view.matches("focused"),
      modality: modality.current,
      // platform-convention: touch screen readers reach the remove button; no Delete hint there
      touchDevice: env.platform.ios || env.platform.android,
      hoveredKey: hovered,
      pressedKey: pressed,
      typingAhead: () => {
        const t = machine.service.getSnapshot().context.typeahead
        return t.buffer !== "" && env.clock.now() - t.at <= (typeaheadTimeout ?? 1000)
      },
      mounted,
      messages,
      send: machine.send,
    },
    env,
  ),
)
const hrefs = $derived(
  new Map((items ?? []).flatMap((i) => (i.href ? [[toKey(i.key), i.href] as const] : []))),
)
tagGroupHost.set({
  parts: () => parts,
  collection: () => collection,
  // Fixed by the mode the Root starts in (data-driven or registered).
  registry: untrack(() => given || data) ? null : registered.registry,
  mount: (part, on) => {
    if (untrack(() => mounted[part]) !== on) mounted = { ...untrack(() => mounted), [part]: on }
  },
  mountLink: (key, on) => {
    if (on) staticLinks.add(key)
    else staticLinks.delete(key)
  },
  hover: (key) => {
    hovered = key
  },
  press: (key) => {
    pressed = key
  },
  hrefOf: (key) => hrefs.get(key),
  removable: () => onRemove !== undefined,
})
const merged = $derived(stripMarker(mergeProps(normalizeProps(parts.root()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render children?.()}{#if parts.hinted}<span {...attrs(normalizeProps(parts.hint()))}>{parts.hintText}</span>{/if}</div>
{/if}
