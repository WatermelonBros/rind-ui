<script lang="ts">
import { platforms, type SortDescriptor } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { RindProvider, Table } from "../../src/index"

const {
  root = {},
  mode = "uncontrolled",
  provider = true,
}: {
  root?: Record<string, unknown>
  /** applying: the parent takes every proposal; refusing: it keeps name ascending. */
  mode?: "uncontrolled" | "applying" | "refusing"
  provider?: boolean
} = $props()
const COLUMNS = [
  { id: "name", name: "Name", first: "ascending" },
  { id: "price", name: "Price", first: "descending" },
  { id: "stock", name: "Stock", first: "ascending" },
] as const
let sort = $state<SortDescriptor | null>(null)
const refused: SortDescriptor = { column: "name", direction: "ascending" }
</script>

{#snippet body()}
  <Table.Table>
    <Table.Caption>Stock</Table.Caption>
    <Table.Head>
      <Table.Row>
        {#each COLUMNS as c (c.id)}
          <Table.ColumnHeader sortable id={c.id} firstDirection={c.first}>
            <Table.SortTrigger>{c.name}<Table.SortIndicator /></Table.SortTrigger>
          </Table.ColumnHeader>
        {/each}
      </Table.Row>
    </Table.Head>
    <Table.Body>
      <Table.Row>
        <Table.RowHeader>Apple</Table.RowHeader>
        <Table.Cell>3</Table.Cell>
        <Table.Cell>10</Table.Cell>
      </Table.Row>
    </Table.Body>
  </Table.Table>
{/snippet}

{#snippet tree()}
  {#if mode === "applying"}
    <Table.Root bind:sort>{@render body()}</Table.Root>
  {:else if mode === "refusing"}
    <Table.Root bind:sort={() => refused, () => {}}>{@render body()}</Table.Root>
  {:else}
    <Table.Root {...root}>{@render body()}</Table.Root>
  {/if}
{/snippet}

{#if provider}
  <RindProvider
    dir={currentRun()?.direction ?? "ltr"}
    environment={{ platform: currentRun()?.platform ?? platforms.linux }}
  >
    {@render tree()}
  </RindProvider>
{:else}
  {@render tree()}
{/if}
