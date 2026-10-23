<script lang="ts">
import { platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { CheckboxGroup, RindProvider } from "../../src/index"

const ALL = ["a", "b", "c"] as const
const LABELS: Record<string, string> = { a: "Olives", b: "Basil", c: "Chili" }
const {
  parent = false,
  disabledItem,
  root = {},
  applying = false,
  provider = true,
}: {
  parent?: boolean
  disabledItem?: string
  root?: Record<string, unknown>
  applying?: boolean
  provider?: boolean
} = $props()
// Controlled by a parent that applies every proposal (the oracle runs it uncontrolled).
let value = $state<readonly string[]>([])
</script>

{#snippet items()}
  <CheckboxGroup.Label>Toppings</CheckboxGroup.Label>
  {#if parent}
    <CheckboxGroup.Parent>
      <CheckboxGroup.ItemControl />
      <CheckboxGroup.ItemLabel>All toppings</CheckboxGroup.ItemLabel>
    </CheckboxGroup.Parent>
  {/if}
  {#each ALL as v (v)}
    <CheckboxGroup.Item value={v} disabled={disabledItem === v}>
      <CheckboxGroup.ItemControl />
      <CheckboxGroup.ItemLabel>{LABELS[v]}</CheckboxGroup.ItemLabel>
    </CheckboxGroup.Item>
  {/each}
{/snippet}

{#snippet form()}
  <form>
    {#if applying}
      <CheckboxGroup.Root name="toppings" allValues={parent ? ALL : undefined} {...root} bind:value>
        {@render items()}
      </CheckboxGroup.Root>
    {:else}
      <CheckboxGroup.Root name="toppings" allValues={parent ? ALL : undefined} {...root}>{@render items()}</CheckboxGroup.Root>
    {/if}
  </form>
{/snippet}

{#if provider}
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>{@render form()}</RindProvider>
{:else}
  {@render form()}
{/if}
