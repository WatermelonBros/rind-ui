<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { gridListHost } from "./context.svelte"
import type { GridListPartProps } from "./types"

/** A `row` sentinel: `onLoadMore` once per collection when it scrolls into view. */
const { child, children, ...rest }: GridListPartProps = $props()
const host = gridListHost.get()
const el = elementRef("div")
$effect(() => {
  const node = el.current
  if (!node || typeof IntersectionObserver === "undefined") return
  // The nearest scroll container, else the viewport (never <html> as an explicit root).
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) host.requestLoadMore()
  })
  observer.observe(node)
  return () => observer.disconnect()
})
const merged = $derived(
  stripMarker(mergeProps({ ...normalizeProps(host.parts().loadMore()), ...el.props }, rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <!-- The row's one cell (a row holds cells); the row itself is the focus target. -->
  <div {...attrs(merged)}><div role="gridcell">{@render children?.()}</div></div>
{/if}
