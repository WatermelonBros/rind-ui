<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { treeViewHost } from "./context"
import type { TreeViewPartProps } from "./types"

const { child, children, ...rest }: TreeViewPartProps = $props()
const host = treeViewHost.get()
const shown = $derived(host.parts().isEmpty)
$effect(() => {
  if (!shown) return
  untrack(() => host.mountEmpty(true))
  return () => untrack(() => host.mountEmpty(false))
})
const merged = $derived(stripMarker(mergeProps(normalizeProps(host.parts().empty()), rest)))
</script>

{#if shown}
  {#if child}
    {@render child({ props: merged, state: undefined })}
  {:else}
    <div {...attrs(merged)}>{#if children}{@render children()}{:else}{host.messages().emptyLabel}{/if}</div>
  {/if}
{/if}
