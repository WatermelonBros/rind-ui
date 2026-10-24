<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { gridListHost, gridListItem } from "./context.svelte"
import type { GridListPartProps } from "./types"

const { child, children, ...rest }: GridListPartProps = $props()
const host = gridListHost.get()
const item = gridListItem.maybe()
if (!item) throw new Error("GridList.ItemDescription must be inside GridList.Item")
$effect(() => {
  const k = item()
  untrack(() => host.mountDescription(k, true))
  return () => untrack(() => host.mountDescription(k, false))
})
const merged = $derived(
  stripMarker(mergeProps(normalizeProps(host.parts().itemDescription(item())), rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <span {...attrs(merged)}>{@render children?.()}</span>
{/if}
