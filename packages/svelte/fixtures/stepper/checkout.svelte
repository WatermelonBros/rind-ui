<script lang="ts">
import { RindProvider, Stepper } from "../../src/index"

const {
  root = {},
  extras = false,
  provider = true,
}: { root?: Record<string, unknown>; extras?: boolean; provider?: boolean } = $props()
const TITLES = ["Cart", "Shipping", "Payment"]
</script>

{#snippet stepper()}
  <Stepper.Root aria-label="Checkout" count={3} {...root}>
    <Stepper.List>
      {#each TITLES as t, i (t)}<Stepper.Item index={i} disabled={extras && i === 2}><Stepper.Trigger>{#if extras}<Stepper.Indicator>{i + 1}</Stepper.Indicator>{/if}<Stepper.Title>{t}</Stepper.Title></Stepper.Trigger>{#if extras}<Stepper.Description>{t} step</Stepper.Description><Stepper.Separator />{/if}</Stepper.Item>{/each}
    </Stepper.List>
    {#each TITLES as t, i (t)}<Stepper.Content index={i}>{t} details</Stepper.Content>{/each}
    <Stepper.PrevTrigger />
    <Stepper.NextTrigger />
    {#if extras}<Stepper.Progress />{/if}
  </Stepper.Root>
{/snippet}

{#if provider}
  <RindProvider>{@render stepper()}</RindProvider>
{:else}
  {@render stepper()}
{/if}
