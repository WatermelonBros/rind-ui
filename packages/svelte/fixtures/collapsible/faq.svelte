<script lang="ts">
import { platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { Accordion, RindProvider } from "../../src/index"

const ITEMS = [
  { item: "a", label: "Shipping" },
  { item: "b", label: "Returns" },
  { item: "c", label: "Payment" },
]
const {
  root = {},
  disabledItem = false,
  onValue,
  provider = true,
}: {
  root?: Record<string, unknown>
  disabledItem?: boolean
  onValue?: (v: readonly string[]) => void
  provider?: boolean
} = $props()
</script>

{#snippet tree()}
  <Accordion.Root {...root} onValueChange={(v) => onValue?.(v)}>
    {#each ITEMS as { item, label } (item)}
      <Accordion.Item value={item} disabled={disabledItem && item === "c"}>
        <Accordion.Header><Accordion.Trigger>{label} <Accordion.Indicator /></Accordion.Trigger></Accordion.Header>
        <Accordion.Content><p>{label} details</p></Accordion.Content>
      </Accordion.Item>
    {/each}
  </Accordion.Root>
{/snippet}

{#if provider}
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>{@render tree()}</RindProvider>
{:else}
  {@render tree()}
{/if}
