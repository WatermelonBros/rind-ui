<script lang="ts">
import { JsonTreeView, type JsonTreeViewApi, RindProvider, TreeView } from "../../src/index"

const {
  data,
  root = {},
  provider,
  custom = false,
  onApi,
}: {
  data: unknown
  root?: Record<string, unknown>
  provider?: Record<string, unknown>
  custom?: boolean
  onApi?: (api: JsonTreeViewApi) => void
} = $props()
</script>

{#snippet customTree(api: JsonTreeViewApi)}
  {onApi?.(api)}
  <TreeView.Tree aria-label="Response">
    {#snippet children(n)}
      <JsonTreeView.Item value={n.key}><TreeView.ItemText><JsonTreeView.Key /><JsonTreeView.Separator>{" = "}</JsonTreeView.Separator><JsonTreeView.Value /><JsonTreeView.SummaryText /></TreeView.ItemText></JsonTreeView.Item>
    {/snippet}
  </TreeView.Tree>
{/snippet}

{#snippet body()}
  {#if custom}
    <JsonTreeView.Root {data} aria-label="Response" {...root} children={customTree} />
  {:else}
    <JsonTreeView.Root {data} aria-label="Response" {...root} />
  {/if}
{/snippet}

{#if provider}
  <RindProvider {...(provider as { announcer?: never })}>{@render body()}</RindProvider>
{:else}
  {@render body()}
{/if}
