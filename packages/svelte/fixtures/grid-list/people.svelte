<script lang="ts">
import { platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { GridList, RindProvider } from "../../src/index"

type Row = { readonly key: string; readonly disabled?: boolean; readonly href?: string }
const {
  rows,
  root = {},
  checkboxes = false,
  controls = false,
  value,
  provider = true,
}: {
  rows: readonly Row[]
  root?: Record<string, unknown>
  checkboxes?: boolean
  controls?: boolean
  value?: unknown
  provider?: boolean
} = $props()
</script>

{#snippet list()}
  {#if value === undefined}
    <GridList.Root {...root}>{@render body()}</GridList.Root>
  {:else}
    <!-- Controlled by a parent that keeps its value: a function binding, never a local write. -->
    <GridList.Root {...root} bind:value={() => value as never, () => {}}>{@render body()}</GridList.Root>
  {/if}
{/snippet}

{#snippet body()}
    <GridList.Label>People</GridList.Label>
    <GridList.List
      >{#each rows as r (r.key)}<GridList.Item value={r.key} disabled={r.disabled} href={r.href}
          >{#if checkboxes}<GridList.ItemCheckbox />{/if}<GridList.ItemText>{r.key}</GridList.ItemText>{#if controls}<GridList.ItemControl
              >Edit</GridList.ItemControl
            ><GridList.ItemControl>Delete</GridList.ItemControl>{/if}</GridList.Item
        >{/each}<GridList.Empty>No people</GridList.Empty></GridList.List
    >
{/snippet}

{#if provider}
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }} dir={currentRun()?.direction === "rtl" ? "rtl" : "ltr"}>
    <button type="button">Before</button>
    {@render list()}
    <button type="button">After</button>
  </RindProvider>
{:else}
  {@render list()}
{/if}
