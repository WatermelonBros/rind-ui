<script lang="ts">
import { type CheckedState, platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { Checkbox, RindProvider, Switch } from "../../src/index"

const {
  kind = "checkbox",
  root = {},
  applying = false,
  provider = true,
}: {
  kind?: "checkbox" | "switch"
  root?: Record<string, unknown>
  applying?: boolean
  provider?: boolean
} = $props()
// Controlled by a parent that applies every proposal (the oracle runs it uncontrolled).
let checked = $state<CheckedState>(false)
</script>

{#snippet terms()}
  <form>
    {#if kind === "checkbox"}
      {#if applying}
        <Checkbox.Root name="tos" bind:checked>
          <Checkbox.Control><Checkbox.Indicator>✓</Checkbox.Indicator></Checkbox.Control>
          <Checkbox.Label>Accept terms</Checkbox.Label>
          <Checkbox.Description>Required to continue</Checkbox.Description>
        </Checkbox.Root>
      {:else}
        <Checkbox.Root name="tos" {...root}>
          <Checkbox.Control><Checkbox.Indicator>✓</Checkbox.Indicator></Checkbox.Control>
          <Checkbox.Label>Accept terms</Checkbox.Label>
          <Checkbox.Description>Required to continue</Checkbox.Description>
        </Checkbox.Root>
      {/if}
    {:else if applying}
      <Switch.Root name="wifi" bind:checked={() => checked === true, (v) => (checked = v)}>
        <Switch.Control><Switch.Thumb /></Switch.Control>
        <Switch.Label>Wi-Fi</Switch.Label>
      </Switch.Root>
    {:else}
      <Switch.Root name="wifi" {...root}>
        <Switch.Control><Switch.Thumb /></Switch.Control>
        <Switch.Label>Wi-Fi</Switch.Label>
      </Switch.Root>
    {/if}
    <button type="reset">Reset</button>
  </form>
{/snippet}

{#if provider}
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>{@render terms()}</RindProvider>
{:else}
  {@render terms()}
{/if}
