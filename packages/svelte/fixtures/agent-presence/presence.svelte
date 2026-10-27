<script lang="ts">
import { AgentPresence, RindProvider } from "../../src/index"

const {
  root = {},
  provider,
  status = true,
  label = true,
}: {
  root?: Record<string, unknown>
  provider?: Record<string, unknown>
  status?: boolean
  label?: boolean
} = $props()
</script>

{#snippet presence()}
  <AgentPresence.Root state="listening" {...root}>
    <AgentPresence.Visual />
    {#if label}<AgentPresence.Label>Ada</AgentPresence.Label>{/if}
    {#if status}<AgentPresence.Status />{/if}
  </AgentPresence.Root>
{/snippet}

{#if provider}
  <RindProvider {...(provider as { announcer?: never })}>{@render presence()}</RindProvider>
{:else}
  {@render presence()}
{/if}
