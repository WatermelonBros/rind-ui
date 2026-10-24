<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { listboxHost, listboxItem } from "./context"
import type { ListboxItemIndicatorProps } from "./types"

const { keepMounted = false, child, children, ...rest }: ListboxItemIndicatorProps = $props()
const host = listboxHost.get()
const item = listboxItem.maybe()
if (!item) throw new Error("ItemIndicator must be inside an Item")
const own = $derived(host.parts().itemIndicator(item()))
const merged = $derived(stripMarker(mergeProps(normalizeProps(own), rest)))
</script>

{#if keepMounted || own["data-state"] === "selected"}
  {#if child}
    {@render child({ props: merged, state: undefined })}
  {:else}
    <span {...attrs(merged)}>{@render children?.()}</span>
  {/if}
{/if}
