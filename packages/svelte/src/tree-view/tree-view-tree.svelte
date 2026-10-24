<script lang="ts">
import { checkTreeView } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { useKeepFocus } from "../keep-focus.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { treeViewHost } from "./context"
import Loading from "./tree-view-loading.svelte"
import type { TreeViewNodeState, TreeViewTreeProps } from "./types"

/**
 * The tree. `children` renders one visible node (usually a `TreeView.Item`); it is called per
 * visible node, in order, as a flat list. A loading branch is followed by `loading`.
 */
const { child, children, loading, indexes, ...rest }: TreeViewTreeProps = $props()
const host = treeViewHost.get()
const el = elementRef("div")
// After the update a Label's registration causes, not on the first render.
$effect(() => {
  const o = host.options()
  const node = el.current
  queueMicrotask(() => {
    if (node instanceof HTMLElement && node.isConnected) checkTreeView(node, o)
  })
})
const rows = $derived.by(() => {
  const visible = host.visible()
  const out: TreeViewNodeState[] = []
  const add = (index: number) => {
    const n = visible.at(index)
    const state = n ? host.node(n.key) : undefined
    if (state) out.push(state)
  }
  if (indexes) for (const index of indexes) add(index)
  else for (let index = 0; index < visible.size; index++) add(index)
  return out
})
// A moved node keeps its focus (Alt+arrows reorder the rows under it).
useKeepFocus(
  () => el.current,
  () => rows,
)
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...normalizeProps(
          host.parts().tree({
            "aria-label": rest["aria-label"] ?? undefined,
            "aria-labelledby": rest["aria-labelledby"] ?? undefined,
          }),
        ),
        ...el.props,
      },
      rest,
    ),
  ),
)
</script>

{#snippet body()}{#each rows as node (node.key)}{@render children(node)}{#if node.loading}{#if loading}{@render loading(node)}{:else}<Loading
          >{host.messages().loadingLabel}</Loading
        >{/if}{/if}{/each}{/snippet}

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render body()}</div>
{/if}
