<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { listboxHost } from "./context"
import type { ListboxPartProps } from "./types"

const { child, children, ...rest }: ListboxPartProps = $props()
const host = listboxHost.get()
const el = elementRef("div")
$effect(() => {
  const node = el.current
  if (!node || typeof IntersectionObserver === "undefined") return
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
  <div {...attrs(merged)}>{@render children?.()}</div>
{/if}
