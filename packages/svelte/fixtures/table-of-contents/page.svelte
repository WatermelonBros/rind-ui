<script lang="ts">
import type { TableOfContentsItem } from "@rind-ui/core"
import { RindProvider, TableOfContents } from "../../src/index"

const {
  items,
  root = {},
  extras = false,
  scheduler,
}: {
  items: TableOfContentsItem[]
  root?: Record<string, unknown>
  extras?: boolean
  scheduler?: unknown
} = $props()
</script>

{#snippet toc()}
  <TableOfContents.Root {items} {...root}>
    {#if extras}<TableOfContents.Title>Contents</TableOfContents.Title>{/if}
    <TableOfContents.List>
      {#each items as item (item.id)}<TableOfContents.Item {item}><TableOfContents.Link /></TableOfContents.Item>{/each}
      {#if extras}<TableOfContents.Indicator />{/if}
    </TableOfContents.List>
  </TableOfContents.Root>
{/snippet}

{#if scheduler}
  <RindProvider environment={{ scheduler } as never}>
    {@render toc()}
    <main>
      {#each items as item (item.id)}<section style="block-size: 400px"><h2 id={item.id}>{item.label}</h2></section>{/each}
    </main>
  </RindProvider>
{:else}
  {@render toc()}
{/if}
