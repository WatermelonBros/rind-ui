<script lang="ts">
import { platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { untrack } from "svelte"
import { Field, PinInput, RindProvider } from "../../src/index"

const { cfg = {}, parity }: { cfg?: Record<string, unknown>; parity?: Record<string, unknown> } =
  $props()
const { controlled, inField, rtl, ...own } = untrack(() => cfg) as Record<string, unknown> & {
  controlled?: boolean
  inField?: boolean
  rtl?: boolean
}
const length = (own["length"] as number | undefined) ?? 6
let value = $state(untrack(() => (own["defaultValue"] as string | undefined) ?? "12"))
const root = {
  ...own,
  length,
  ...(controlled ? {} : { defaultValue: (own["defaultValue"] as string | undefined) ?? "12" }),
}
</script>

{#snippet control()}
  <PinInput.Control style="display: flex; gap: 4px; width: {length * 44}px">
    <PinInput.Input />
    {#each Array.from({ length }, (_, i) => i) as i (i)}<PinInput.Slot index={i} style="width: 40px; height: 40px" />{/each}
  </PinInput.Control>
{/snippet}

{#if parity}
  <PinInput.Root length={4} {...parity}><PinInput.Label>Code</PinInput.Label><PinInput.Control><PinInput.Input />{#each [0, 1, 2, 3] as i (i)}<PinInput.Slot index={i} />{/each}</PinInput.Control></PinInput.Root>
{:else}
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
    <form onsubmit={(e) => e.preventDefault()} dir={rtl ? "rtl" : undefined}>
      {#if inField}
        <Field.Root>
          <Field.Label>Verification code</Field.Label>
          {#if controlled}
            <PinInput.Root {...root} bind:value>{@render control()}<button type="reset">Reset</button></PinInput.Root>
          {:else}
            <PinInput.Root {...root}>{@render control()}<button type="reset">Reset</button></PinInput.Root>
          {/if}
          <Field.ErrorMessage />
        </Field.Root>
      {:else if controlled}
        <PinInput.Root {...root} bind:value><PinInput.Label>Verification code</PinInput.Label>{@render control()}<button type="reset">Reset</button></PinInput.Root>
      {:else}
        <PinInput.Root {...root}><PinInput.Label>Verification code</PinInput.Label>{@render control()}<button type="reset">Reset</button></PinInput.Root>
      {/if}
    </form>
  </RindProvider>
{/if}
