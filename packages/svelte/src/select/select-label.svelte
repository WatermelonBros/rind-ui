<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { api, selectHost } from "./context.svelte"
import type { SelectLabelProps } from "./types"

const { child, children, ...rest }: SelectLabelProps = $props()
const ctx = selectHost.get()
const env = useEnvironment()
$effect(() => {
  ctx.setMounted("label", true)
  return () => ctx.setMounted("label", false)
})
const el = elementRef("span")
$effect(() => {
  const node = el.current
  ctx.shared.label = node instanceof HTMLElement ? node : null
})
const merged = $derived(
  stripMarker(mergeProps({ ...normalizeProps(api(ctx, env).label()), ...el.props }, rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <span {...attrs(merged)}>{@render children?.()}</span>
{/if}
