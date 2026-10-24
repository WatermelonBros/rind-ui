<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { navItem, navLevel } from "./context.svelte"
import type { NavigationMenuItemProps } from "./types"

// One item: a Link, a Trigger with its Content, or both (a split item).
const { value, child, children, ...rest }: NavigationMenuItemProps = $props()
const ctx = navLevel.get()
const uid = $props.id()
const key = untrack(() => value ?? uid)
const el = elementRef("li")
$effect(() => {
  const node = el.current
  if (!(node instanceof HTMLElement)) return
  untrack(() => {
    ctx.items.set(key, node)
    ctx.shared.itemsVersion++
  })
  return () => {
    ctx.items.delete(key)
    ctx.shared.itemsVersion++
  }
})
const shared = $state({ contentMounted: false })
navItem.set({ root: untrack(() => ctx.root()), key, shared })
const merged = $derived(
  stripMarker(mergeProps({ ...normalizeProps(ctx.api().item(key)), ...el.props }, rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <li {...attrs(merged)}>{@render children?.()}</li>
{/if}
