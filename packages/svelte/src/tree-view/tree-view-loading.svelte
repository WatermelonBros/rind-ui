<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { treeViewHost } from "./context"
import type { TreeViewPartProps } from "./types"

const { child, children, ...rest }: TreeViewPartProps = $props()
const host = treeViewHost.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(host.parts().loading()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <span {...attrs(merged)}>{@render children?.()}</span>
{/if}
