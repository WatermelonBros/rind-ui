<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { DEV } from "../dev"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { gridListHost, gridListList } from "./context.svelte"
import type { GridListPartProps } from "./types"

const { child, children, ...rest }: GridListPartProps = $props()
const host = gridListHost.get()
const inList = gridListList.maybe() ?? false
$effect(() => {
  if (DEV && !inList)
    console.warn("[rind-ui] GridList: Empty is outside List; render it inside GridList.List.")
})
const merged = $derived(stripMarker(mergeProps(normalizeProps(host.parts().empty()), rest)))
</script>

{#if host.parts().isEmpty}
  {#if child}
    {@render child({ props: merged, state: undefined })}
  {:else}
    <div {...attrs(merged)}>{@render children?.()}</div>
  {/if}
{/if}
