<script lang="ts">
import { platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { RindProvider, TreeView, type TreeViewItemData } from "../../src/index"

const {
  items,
  root = {},
  provider = true,
}: {
  items: readonly TreeViewItemData[]
  root?: Record<string, unknown>
  provider?: boolean
} = $props()
</script>

{#snippet tree()}
  <TreeView.Root {items} {...root}>
    <TreeView.Label>Files</TreeView.Label>
    <TreeView.Tree>
      {#snippet children(node)}<TreeView.Item value={node.key}
          >{#if node.isBranch}<TreeView.ItemIndicator>▸</TreeView.ItemIndicator>{/if}<TreeView.ItemText>{node.label}</TreeView.ItemText></TreeView.Item
        >{/snippet}
    </TreeView.Tree>
    <TreeView.Empty />
  </TreeView.Root>
{/snippet}

{#if provider}
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }} dir={currentRun()?.direction === "rtl" ? "rtl" : "ltr"}>
    {@render tree()}
    <button type="button">After</button>
  </RindProvider>
{:else}
  {@render tree()}
{/if}
