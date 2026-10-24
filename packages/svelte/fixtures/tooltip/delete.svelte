<script lang="ts">
import type { Scheduler } from "@rind-ui/core"
import { RindProvider, Tooltip } from "../../src/index"

const {
  root = {},
  scheduler,
  portal = true,
}: { root?: Record<string, unknown>; scheduler?: Scheduler; portal?: boolean } = $props()
</script>

{#snippet positioner()}
  <Tooltip.Positioner>
    <Tooltip.Content><Tooltip.Arrow />Delete permanently</Tooltip.Content>
  </Tooltip.Positioner>
{/snippet}

{#snippet tree()}
  <div id="app">
    <!-- No whitespace between the buttons: React's markup has none (the trigger's position). -->
    <button type="button">Before</button><Tooltip.Root openDelay={200} closeDelay={100} {...root}
      ><Tooltip.Trigger>Delete</Tooltip.Trigger>
      {#if portal}
        <Tooltip.Portal>{@render positioner()}</Tooltip.Portal>
      {:else}
        {@render positioner()}
      {/if}
    </Tooltip.Root>
  </div>
{/snippet}

{#if scheduler}
  <RindProvider environment={{ scheduler }}>{@render tree()}</RindProvider>
{:else}
  {@render tree()}
{/if}
