<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { listboxHost, listboxItem } from "./context"
import type { ListboxPartProps } from "./types"

const { child, children, ...rest }: ListboxPartProps = $props()
const host = listboxHost.get()
const item = listboxItem.maybe()
if (!item) throw new Error("ItemDescription must be inside an Item")
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
