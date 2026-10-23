<script lang="ts">
import { platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { Collapsible, RindProvider } from "../../src/index"

const {
  root = {},
  controlled = false,
  open,
  provider = true,
}: {
  root?: Record<string, unknown>
  controlled?: boolean
  open?: boolean
  provider?: boolean
} = $props()
</script>

{#snippet tree()}
  {#if controlled}
    <Collapsible.Root bind:open={() => open, () => {}}>
      <Collapsible.Trigger>Details <Collapsible.Indicator /></Collapsible.Trigger>
      <Collapsible.Content><a href="#more">More</a></Collapsible.Content>
    </Collapsible.Root>
  {:else}
    <Collapsible.Root {...root}>
      <Collapsible.Trigger>Details <Collapsible.Indicator /></Collapsible.Trigger>
      <Collapsible.Content><a href="#more">More</a></Collapsible.Content>
    </Collapsible.Root>
  {/if}
{/snippet}

{#if provider}
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>{@render tree()}</RindProvider>
{:else}
  {@render tree()}
{/if}
