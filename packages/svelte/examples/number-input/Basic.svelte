<script lang="ts">
import { NumberInput } from "@rind-ui/svelte"
</script>

<NumberInput.Root defaultValue={2}>
  <NumberInput.Label>Quantity</NumberInput.Label>
  <NumberInput.Control>
    <NumberInput.DecrementTrigger>−</NumberInput.DecrementTrigger>
    <NumberInput.Input />
    <NumberInput.IncrementTrigger>+</NumberInput.IncrementTrigger>
  </NumberInput.Control>
</NumberInput.Root>
