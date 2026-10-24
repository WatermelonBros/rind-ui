<script lang="ts">
import { platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { Popover, RindProvider } from "../../src/index"

const {
  root = {},
  provider = true,
  portal = true,
}: { root?: Record<string, unknown>; provider?: boolean; portal?: boolean } = $props()
</script>

{#snippet positioner()}
    <Popover.Positioner>
      <Popover.Content>
        <Popover.Arrow />
        <Popover.Title>Filters</Popover.Title>
        <Popover.Description>Narrow the list.</Popover.Description>
        <label>Search <input /></label>
        <Popover.CloseTrigger>Done</Popover.CloseTrigger>
      </Popover.Content>
    </Popover.Positioner>
{/snippet}

{#snippet tree()}
  <div id="app">
    <Popover.Root {...root}>
      <Popover.Trigger>Filters</Popover.Trigger>
      {#if portal}
        <Popover.Portal>{@render positioner()}</Popover.Portal>
      {:else}
        {@render positioner()}
      {/if}
    </Popover.Root>
    <button type="button">After</button>
  </div>
{/snippet}

{#if provider}
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
    {@render tree()}
  </RindProvider>
{:else}
  {@render tree()}
{/if}
