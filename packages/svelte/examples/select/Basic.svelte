<script lang="ts">
import { Select } from "@rind-ui/svelte"

const fruits = ["Apple", "Banana", "Cherry", "Grape", "Mango", "Peach"].map((f) => ({
  key: f.toLowerCase(),
  label: f,
}))
</script>

<Select.Root items={fruits} placeholder="Pick one" defaultValue="banana">
  <Select.Label>Fruit</Select.Label>
  <Select.Trigger>
    <Select.ValueText />
    <Select.Indicator>▾</Select.Indicator>
  </Select.Trigger>
  <Select.Portal>
    <Select.Positioner>
      <Select.Content>
        <Select.List>
          {#each fruits as f (f.key)}
            <Select.Item value={f.key}>
              <Select.ItemText>{f.label}</Select.ItemText>
              <Select.ItemIndicator>✓</Select.ItemIndicator>
            </Select.Item>
          {/each}
        </Select.List>
      </Select.Content>
    </Select.Positioner>
  </Select.Portal>
</Select.Root>
