<script setup lang="ts">
import { Select } from "@rind-ui/vue"

const fruits = ["Apple", "Banana", "Cherry", "Grape", "Mango", "Peach"].map((f) => ({
  key: f.toLowerCase(),
  label: f,
}))
</script>

<template>
  <Select.Root :items="fruits" placeholder="Pick one" default-value="banana">
    <Select.Label>Fruit</Select.Label>
    <Select.Trigger>
      <Select.ValueText />
      <Select.Indicator>▾</Select.Indicator>
    </Select.Trigger>
    <Select.Portal>
      <Select.Positioner>
        <Select.Content>
          <Select.List>
            <Select.Item v-for="f in fruits" :key="f.key" :value="f.key">
              <Select.ItemText>{{ f.label }}</Select.ItemText>
              <Select.ItemIndicator>✓</Select.ItemIndicator>
            </Select.Item>
          </Select.List>
        </Select.Content>
      </Select.Positioner>
    </Select.Portal>
  </Select.Root>
</template>
