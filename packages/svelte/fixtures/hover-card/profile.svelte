<script lang="ts">
import type { Scheduler } from "@rind-ui/core"
import { HoverCard, RindProvider } from "../../src/index"

const {
  root = {},
  scheduler,
  portal = true,
}: { root?: Record<string, unknown>; scheduler?: Scheduler; portal?: boolean } = $props()
</script>

{#snippet positioner()}
  <HoverCard.Positioner>
    <HoverCard.Content
      ><HoverCard.Arrow /><p>Designer in Lisbon.</p><button type="button">Follow</button
      ></HoverCard.Content>
  </HoverCard.Positioner>
{/snippet}

{#snippet tree()}
  <!-- No whitespace between the links: React's markup has none (the trigger's position). -->
  <div id="app">
    <a href="/before">Before</a><HoverCard.Root openDelay={200} closeDelay={100} {...root}
      ><HoverCard.Trigger href="/u/jane">Jane Doe</HoverCard.Trigger
      >{#if portal}<HoverCard.Portal>{@render positioner()}</HoverCard.Portal
        >{:else}{@render positioner()}{/if}</HoverCard.Root
    ><a href="/after">After</a>
  </div>
{/snippet}

{#if scheduler}
  <RindProvider environment={{ scheduler }}>{@render tree()}</RindProvider>
{:else}
  {@render tree()}
{/if}
