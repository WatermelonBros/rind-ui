<script lang="ts">
import { platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { Listbox, type ListboxItemData, RindProvider } from "../../src/index"

const {
  items = [],
  root = {},
  provider = true,
  letters = false,
}: {
  items?: readonly ListboxItemData[]
  root?: Record<string, unknown>
  provider?: boolean
  letters?: boolean
} = $props()
</script>

{#snippet list()}
  {#if letters}
    <Listbox.Root defaultValue="a">
      <Listbox.Label>Letters</Listbox.Label>
      <Listbox.List
        >{#each ["a", "b"] as k (k)}<Listbox.Item value={k}
            ><Listbox.ItemText>{k.toUpperCase()}</Listbox.ItemText><Listbox.ItemDescription>The letter {k}</Listbox.ItemDescription
            ><Listbox.ItemIndicator>✓</Listbox.ItemIndicator></Listbox.Item
          >{/each}</Listbox.List
      >
      <Listbox.Empty>Nothing</Listbox.Empty>
    </Listbox.Root>
  {:else}
    <Listbox.Root {items} {...root}>
      <Listbox.Label>Fruit</Listbox.Label>
      <Listbox.List><Listbox.Items /></Listbox.List>
    </Listbox.Root>
  {/if}
{/snippet}

{#if provider}
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }} dir={currentRun()?.direction === "rtl" ? "rtl" : "ltr"}>
    {@render list()}
    <button type="button">After</button>
  </RindProvider>
{:else}
  {@render list()}
{/if}
