<script lang="ts">
import {
  type BreadcrumbsTrailItem,
  breadcrumbsConnect,
  breadcrumbsMessages,
  deriveTrail,
  warnBreadcrumbsInPopup,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useMessages } from "../provider"
import { useCollectionItems } from "../use-collection-items.svelte"
import { breadcrumbsContext, type ItemMeta } from "./context"
import type { BreadcrumbsRootProps } from "./types"

const {
  maxItems,
  itemsBeforeCollapse,
  itemsAfterCollapse,
  currentValue = "page",
  items: data,
  messages: ownMessages,
  id,
  child,
  children,
  ...rest
}: BreadcrumbsRootProps = $props()

const uid = $props.id()
const instance = $derived(id ?? uid)
const messages = useMessages("breadcrumbs", breadcrumbsMessages, () => ownMessages)
const registered = useCollectionItems()
const meta = new Map<string, ItemMeta>()
let version = $state(0)
const sameMeta = (a: ItemMeta | undefined, b: ItemMeta) =>
  a !== undefined &&
  a.current === b.current &&
  a.href === b.href &&
  a.routerOptions === b.routerOptions &&
  a.text === b.text
const setMeta = (key: string, next: ItemMeta) => {
  if (sameMeta(meta.get(key), next)) return
  meta.set(key, next)
  version++
}
const items: readonly BreadcrumbsTrailItem[] = $derived.by(() => {
  if (data) return data
  void version
  const c = registered.collection
  return Array.from({ length: c?.size ?? 0 }, (_, i) => {
    const it = c?.at(i)?.value
    const m = it ? meta.get(it.key) : undefined
    return {
      key: it?.key ?? "",
      current: m?.current,
      disabled: it?.disabled,
      href: m?.href,
      routerOptions: m?.routerOptions,
      textValue: m?.text ?? it?.textValue ?? "",
    }
  })
})
const trail = $derived(deriveTrail({ items, maxItems, itemsBeforeCollapse, itemsAfterCollapse }))
const connect = $derived(
  breadcrumbsConnect({
    instance,
    trail,
    labelled: rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined,
    label: messages().label,
  }),
)
const el = elementRef("nav")
$effect(() => {
  if (el.current instanceof HTMLElement) warnBreadcrumbsInPopup(el.current)
})
breadcrumbsContext.set({
  instance: () => instance,
  connect: () => connect,
  trail: () => trail,
  items: () => items,
  currentValue: () => currentValue,
  messages,
  // Fixed by the mode the Root starts in (data-driven or registered).
  registry: untrack(() => data) ? null : registered.registry,
  setMeta,
})
const merged = $derived(
  stripMarker(
    mergeProps(
      { ...normalizeProps(connect.root()), ...(id === undefined ? {} : { id }), ...el.props },
      rest,
    ),
  ),
)
const current = $derived({ collapsed: trail.collapsed.length > 0 })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <nav {...attrs(merged)}>{@render children?.(current)}</nav>
{/if}
