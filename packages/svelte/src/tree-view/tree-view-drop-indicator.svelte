<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { treeViewHost } from "./context"
import type { TreeViewPartProps } from "./types"

/** The drop line of a pointer drag: render it beside `TreeView.Tree` in a positioned wrapper. */
const { child, children, ...rest }: TreeViewPartProps = $props()
const host = treeViewHost.get()
const merged = $derived(
  stripMarker(mergeProps(normalizeProps(host.parts().dropIndicator(host.dropAt())), rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render children?.()}</div>
{/if}
