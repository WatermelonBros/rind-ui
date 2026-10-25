<script lang="ts">
import { RadioGroup } from "../../src/index"

// A binding with no value yet starts at `null` (Svelte cannot tell an unbound prop from a binding
// that holds `undefined`, which stays an uncontrolled starting value).
let plan = $state<string | null>(null)
</script>

<RadioGroup.Root bind:value={plan}>
  <RadioGroup.Label>Plan</RadioGroup.Label>
  {#each ["free", "pro"] as p (p)}
    <RadioGroup.Item value={p}>
      <RadioGroup.ItemControl><RadioGroup.ItemIndicator /></RadioGroup.ItemControl>
      <RadioGroup.ItemLabel>{p === "free" ? "Free" : "Pro"}</RadioGroup.ItemLabel>
    </RadioGroup.Item>
  {/each}
</RadioGroup.Root>
<output data-testid="bound">{plan ?? "null"}</output>
