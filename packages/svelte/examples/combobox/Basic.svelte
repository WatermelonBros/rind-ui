<script lang="ts">
import { Combobox } from "@rind-ui/svelte"

const cities = [
  { key: "rome", label: "Rome" },
  { key: "paris", label: "Paris" },
  { key: "prague", label: "Prague" },
  { key: "oslo", label: "Oslo" },
  { key: "lisbon", label: "Lisbon" },
]
</script>

<Combobox.Root items={cities} defaultValue="paris" defaultInputValue="Paris">
  <Combobox.Label>City</Combobox.Label>
  <Combobox.Control data-variant="outline">
    <Combobox.Input />
    <Combobox.ClearTrigger />
    <Combobox.Trigger />
  </Combobox.Control>
  <Combobox.Positioner>
    <Combobox.Popup>
      <Combobox.List>
        <Combobox.Items>
          {#snippet children({ label })}
            <Combobox.ItemText>{label}</Combobox.ItemText>
            <Combobox.ItemIndicator />
          {/snippet}
        </Combobox.Items>
      </Combobox.List>
      <Combobox.Empty>No results</Combobox.Empty>
    </Combobox.Popup>
  </Combobox.Positioner>
</Combobox.Root>
