<script lang="ts">
import type { ContextMeterLevel } from "@rind-ui/core"
import { ContextMeter, RindProvider } from "../../src/index"

const {
  used,
  max,
  resetKey,
  label = true,
  provider,
  onThreshold,
}: {
  used: number
  max: number | null
  resetKey?: string
  label?: boolean
  provider?: Record<string, unknown>
  onThreshold?: (l: ContextMeterLevel) => void
} = $props()
</script>

{#snippet meter()}
  <ContextMeter.Root {used} {max} {resetKey} {onThreshold}>
    {#if label}<ContextMeter.Label>Context</ContextMeter.Label>{/if}
    <ContextMeter.ValueText />
    <ContextMeter.Track><ContextMeter.Indicator /></ContextMeter.Track>
    <ContextMeter.Breakdown><ContextMeter.BreakdownItem itemKey="system" label="System prompt" amount="2K" /></ContextMeter.Breakdown>
  </ContextMeter.Root>
{/snippet}

{#if provider}
  <RindProvider {...(provider as { announcer?: never })}>{@render meter()}</RindProvider>
{:else}
  <RindProvider locale="en-US">{@render meter()}</RindProvider>
{/if}
