<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { DEV } from "../dev"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { tabsContext } from "./context"
import type { TabsListProps } from "./types"

const { child, children, ...rest }: TabsListProps = $props()
const ctx = tabsContext.get()
const el = elementRef("div")
// Development: a tablist needs a name (aria-label or aria-labelledby).
$effect(() => {
  const node = el.current
  void rest["aria-label"]
  if (!DEV || !node) return
  if (!node.getAttribute("aria-label") && !node.getAttribute("aria-labelledby")) {
    console.warn(
      `[rind-ui] tabs: the list #${node.id} has no accessible name; pass aria-label or aria-labelledby`,
    )
  }
})
const merged = $derived(
  stripMarker(mergeProps({ ...normalizeProps(ctx.api().list()), ...el.props }, rest)),
)
const current = $derived({ value: ctx.value(), orientation: ctx.orientation() })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}</div>
{/if}
