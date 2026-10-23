<script lang="ts">
import { platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { untrack } from "svelte"
import { Field, NumberInput, RindProvider } from "../../src/index"

const {
  root = {},
  mode = "plain",
  scheduler,
  provider = true,
}: {
  root?: Record<string, unknown>
  mode?: "plain" | "applying" | "field"
  scheduler?: unknown
  provider?: boolean
} = $props()
// Controlled by a parent that applies every proposal.
let value: number | null = $state(
  untrack(() => (root["defaultValue"] as number | undefined) ?? null),
)
</script>

{#snippet parts()}
  <NumberInput.Control>
    <NumberInput.DecrementTrigger>−</NumberInput.DecrementTrigger>
    <NumberInput.Input />
    <NumberInput.IncrementTrigger>+</NumberInput.IncrementTrigger>
  </NumberInput.Control>
{/snippet}

{#snippet body()}
  {#if mode === "field"}
    <Field.Root validationMode="change">
      <Field.Label>Quantity</Field.Label>
      <NumberInput.Root name="q" {...root}>{@render parts()}</NumberInput.Root>
      <button type="button">Reset</button>
    </Field.Root>
  {:else if mode === "applying"}
    <form>
      <NumberInput.Root name="q" {...root} bind:value>
        <NumberInput.Label>Quantity</NumberInput.Label>
        {@render parts()}
      </NumberInput.Root>
      <button type="reset">Reset</button>
    </form>
  {:else}
    <NumberInput.Root name="q" {...root}>
      <NumberInput.Label>Quantity</NumberInput.Label>
      {@render parts()}
    </NumberInput.Root>
    {#if provider}<button type="reset">Reset</button>{/if}
  {/if}
{/snippet}

{#if provider}
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux, ...(scheduler ? { scheduler } : {}) } as never}>
    {#if mode === "plain"}<form>{@render body()}</form>{:else}{@render body()}{/if}
  </RindProvider>
{:else}
  {@render body()}
{/if}
