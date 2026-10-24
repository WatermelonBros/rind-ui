<script lang="ts">
import type { Announcer } from "@rind-ui/core"
import { moveNode } from "@rind-ui/core"
import { untrack } from "svelte"
import { RindProvider, TreeView, type TreeViewItemData } from "../../src/index"

const {
  items: start,
  movable = true,
  announcer,
}: {
  items: TreeViewItemData[]
  movable?: boolean | ((key: string) => boolean)
  announcer: Announcer
} = $props()
let items = $state.raw(untrack(() => start))
</script>

<RindProvider {announcer}>
  <TreeView.Root {items} defaultExpandedValue={["docs"]} {movable} onMove={(key, target) => (items = moveNode(items, key, target))}>
    <div style="position: relative">
      <TreeView.Tree aria-label="Files">
        {#snippet children(node)}<TreeView.Item value={node.key} style="height: 32px; display: flex; align-items: center"
            ><TreeView.ItemText>{node.label}</TreeView.ItemText></TreeView.Item
          >{/snippet}
      </TreeView.Tree>
      <TreeView.DropIndicator />
    </div>
  </TreeView.Root>
</RindProvider>
