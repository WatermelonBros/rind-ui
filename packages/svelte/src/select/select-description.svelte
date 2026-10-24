<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { api, selectHost } from "./context.svelte"
import type { SelectDescriptionProps } from "./types"

const { child, children, ...rest }: SelectDescriptionProps = $props()
const ctx = selectHost.get()
const env = useEnvironment()
$effect(() => {
  ctx.setMounted("description", true)
  return () => ctx.setMounted("description", false)
})
const merged = $derived(stripMarker(mergeProps(normalizeProps(api(ctx, env).description()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render children?.()}</div>
{/if}
