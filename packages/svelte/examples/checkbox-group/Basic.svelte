<script lang="ts">
import { CheckboxGroup } from "@rind-ui/svelte"

const toppings = ["Ham", "Cheese", "Olives"]
</script>

<CheckboxGroup.Root allValues={toppings} defaultValue={["Ham"]}>
  <CheckboxGroup.Label>Toppings</CheckboxGroup.Label>
  <CheckboxGroup.Parent>
    <CheckboxGroup.ItemControl>
      <CheckboxGroup.ItemIndicator>
        {#snippet children({ indeterminate })}{indeterminate ? "–" : "✓"}{/snippet}
      </CheckboxGroup.ItemIndicator>
    </CheckboxGroup.ItemControl>
    <CheckboxGroup.ItemLabel>All toppings</CheckboxGroup.ItemLabel>
  </CheckboxGroup.Parent>
  {#each toppings as value (value)}
    <CheckboxGroup.Item {value}>
      <CheckboxGroup.ItemControl>
        <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
      </CheckboxGroup.ItemControl>
      <CheckboxGroup.ItemLabel>{value}</CheckboxGroup.ItemLabel>
    </CheckboxGroup.Item>
  {/each}
</CheckboxGroup.Root>
