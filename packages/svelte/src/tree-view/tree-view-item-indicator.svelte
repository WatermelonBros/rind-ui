<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { treeViewHost, treeViewItem } from "./context"
import type { TreeViewPartProps } from "./types"

const { child, children, ...rest }: TreeViewPartProps = $props()
const host = treeViewHost.get()
const item = treeViewItem.maybe()
if (!item) throw new Error("TreeView.ItemIndicator must be inside TreeView.Item")
const merged = $derived(
  stripMarker(mergeProps(normalizeProps(host.parts().itemIndicator(item())), rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <span {...attrs(merged)}>{@render children?.()}</span>
{/if}
