<script setup lang="ts">
import { Combobox } from "@rind-ui/vue"

const cities = [
  { key: "rome", label: "Rome" },
  { key: "paris", label: "Paris" },
  { key: "prague", label: "Prague" },
  { key: "oslo", label: "Oslo" },
  { key: "lisbon", label: "Lisbon" },
]
</script>

<template>
  <Combobox.Root :items="cities" default-value="paris" default-input-value="Paris">
    <Combobox.Label>City</Combobox.Label>
    <Combobox.Control data-variant="outline">
      <Combobox.Input />
      <Combobox.ClearTrigger />
      <Combobox.Trigger />
    </Combobox.Control>
    <Combobox.Positioner>
      <Combobox.Popup>
        <Combobox.List>
          <Combobox.Items v-slot="{ label }">
            <Combobox.ItemText>{{ label }}</Combobox.ItemText>
            <Combobox.ItemIndicator />
          </Combobox.Items>
        </Combobox.List>
        <Combobox.Empty>No results</Combobox.Empty>
      </Combobox.Popup>
    </Combobox.Positioner>
  </Combobox.Root>
</template>
