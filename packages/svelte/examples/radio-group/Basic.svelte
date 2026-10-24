<script lang="ts">
import { RadioGroup } from "@rind-ui/svelte"
</script>

<RadioGroup.Root defaultValue="Medium">
  <RadioGroup.Label>Size</RadioGroup.Label>
  {#each ["Small", "Medium", "Large"] as value (value)}
    <RadioGroup.Item {value}>
      <RadioGroup.ItemControl>
        <RadioGroup.ItemIndicator />
      </RadioGroup.ItemControl>
      <RadioGroup.ItemLabel>{value}</RadioGroup.ItemLabel>
    </RadioGroup.Item>
  {/each}
</RadioGroup.Root>
