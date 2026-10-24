<script lang="ts">
import { platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { RindProvider, TagGroup, type TagGroupItemData } from "../../src/index"

const {
  items = [],
  root = {},
  provider = true,
  fruit = false,
}: {
  items?: readonly TagGroupItemData[]
  root?: Record<string, unknown>
  provider?: boolean
  fruit?: boolean
} = $props()
</script>

{#snippet group()}
  {#if fruit}
    <TagGroup.Root selectionMode="single">
      <TagGroup.Label>Fruit</TagGroup.Label>
      <TagGroup.List>{#each ["Apple", "Pear"] as t (t)}<TagGroup.Tag value={t.toLowerCase()}><TagGroup.TagText>{t}</TagGroup.TagText></TagGroup.Tag>{/each}</TagGroup.List>
    </TagGroup.Root>
  {:else}
    <TagGroup.Root {items} {...root}>
      <TagGroup.Label>Cities</TagGroup.Label>
      <TagGroup.List><TagGroup.Tags /><TagGroup.Empty>No cities</TagGroup.Empty></TagGroup.List>
    </TagGroup.Root>
  {/if}
{/snippet}

{#if provider}
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }} dir={currentRun()?.direction === "rtl" ? "rtl" : "ltr"}>
    {@render group()}
    <button type="button">After</button>
  </RindProvider>
{:else}
  {@render group()}
{/if}
