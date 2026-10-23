<script lang="ts">
import { PinInput } from "@rind-ui/svelte"
</script>

<PinInput.Root length={6}>
  <PinInput.Label>Verification code</PinInput.Label>
  <PinInput.Control>
    <PinInput.Input />
    {#each [0, 1, 2, 3, 4, 5] as index (index)}
      <PinInput.Slot {index} />
    {/each}
  </PinInput.Control>
</PinInput.Root>
