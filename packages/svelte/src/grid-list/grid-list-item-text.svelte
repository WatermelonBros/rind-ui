<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { gridListHost, gridListItem } from "./context.svelte"
import type { GridListPartProps } from "./types"

const { child, children, ...rest }: GridListPartProps = $props()
const host = gridListHost.get()
const item = gridListItem.maybe()
if (!item) throw new Error("GridList.ItemText must be inside GridList.Item")
const merged = $derived(
  stripMarker(mergeProps(normalizeProps(host.parts().itemText(item())), rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <span {...attrs(merged)}>{@render children?.()}</span>
{/if}
