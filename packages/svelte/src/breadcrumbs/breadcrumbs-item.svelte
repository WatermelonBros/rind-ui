<script lang="ts">
import { breadcrumbsItemState, warnCurrentWithoutAria } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useRegisterItem } from "../use-collection-items.svelte"
import { breadcrumbsContext, breadcrumbsItem, type ItemMeta } from "./context"
import type { BreadcrumbsItemProps } from "./types"

const {
  value,
  current,
  disabled = false,
  textValue,
  child,
  children,
  ...rest
}: BreadcrumbsItemProps = $props()
const root = breadcrumbsContext.get()
const el = elementRef("li")
useRegisterItem(
  root.registry,
  () => ({ key: value, textValue, disabled }),
  () => el.current,
)
const itemState = $derived(breadcrumbsItemState(root.trail(), value, disabled, root.currentValue()))
let linkMeta: ItemMeta = $state({})
// After the Link's effect (children run first): the Item's own `current` with its Link's.
$effect(() => {
  const next = { ...linkMeta, current, text: textValue ?? linkMeta.text }
  const key = value
  untrack(() => root.setMeta(key, next))
})
$effect(() => {
  if (itemState.current && el.current instanceof HTMLElement) {
    const node = el.current
    untrack(() => warnCurrentWithoutAria(node))
  }
})
breadcrumbsItem.set({
  state: () => itemState,
  reportLink: (meta) => {
    linkMeta = meta
  },
})
const merged = $derived(
  stripMarker(mergeProps({ ...normalizeProps(root.connect().item(itemState)), ...el.props }, rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: itemState })}
{:else}
  <li {...attrs(merged)}>{@render children?.(itemState)}</li>
{/if}
