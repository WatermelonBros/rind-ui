<script lang="ts">
import { RindProvider, ToolCall } from "../../src/index"

const {
  root = {},
  provider,
  full = true,
}: {
  root?: Record<string, unknown>
  provider?: Record<string, unknown>
  full?: boolean
} = $props()
</script>

{#snippet call()}
  <ToolCall.Root id="call-1" name="search_flights" status="running" {...root}>
    <ToolCall.Header><ToolCall.Name /></ToolCall.Header>
    <ToolCall.Content>
      {#if full}
        <ToolCall.Duration />
        <ToolCall.Approval>
          <ToolCall.ApprovalTitle>Book this flight?</ToolCall.ApprovalTitle>
          <!-- No children: the buttons show their default labels. -->
          <ToolCall.Approve />
          <ToolCall.Deny />
          <ToolCall.Receipt />
        </ToolCall.Approval>
      {:else}
        <ToolCall.Output>ok</ToolCall.Output>
      {/if}
    </ToolCall.Content>
  </ToolCall.Root>
{/snippet}

{#if provider}
  <RindProvider {...(provider as { announcer?: never })}>{@render call()}</RindProvider>
{:else}
  {@render call()}
{/if}
