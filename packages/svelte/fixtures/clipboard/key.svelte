<script lang="ts">
import { Clipboard, RindProvider } from "../../src/index"

const {
  field = false,
  root = {},
  provider,
}: {
  field?: boolean
  root?: Record<string, unknown>
  provider?: Record<string, unknown>
} = $props()
</script>

{#snippet clipboard()}
  <Clipboard.Root value="sk-123" {...root}>
    {#if field}
      <Clipboard.Label>API key</Clipboard.Label>
      <Clipboard.Control><Clipboard.Input /><Clipboard.Trigger><Clipboard.Indicator>⧉</Clipboard.Indicator></Clipboard.Trigger></Clipboard.Control>
    {:else}
      <Clipboard.Trigger />
    {/if}
  </Clipboard.Root>
{/snippet}

{#if provider}
  <RindProvider {...(provider as { announcer?: never })}>{@render clipboard()}</RindProvider>
{:else}
  {@render clipboard()}
{/if}
