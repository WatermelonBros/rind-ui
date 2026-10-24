<script setup lang="ts">
import { CheckboxGroup } from "@rind-ui/vue"

const toppings = ["Ham", "Cheese", "Olives"]
</script>

<template>
  <CheckboxGroup.Root :all-values="toppings" :default-value="['Ham']">
    <CheckboxGroup.Label>Toppings</CheckboxGroup.Label>
    <CheckboxGroup.Parent>
      <CheckboxGroup.ItemControl>
        <CheckboxGroup.ItemIndicator v-slot="{ indeterminate }">{{
          indeterminate ? "–" : "✓"
        }}</CheckboxGroup.ItemIndicator>
      </CheckboxGroup.ItemControl>
      <CheckboxGroup.ItemLabel>All toppings</CheckboxGroup.ItemLabel>
    </CheckboxGroup.Parent>
    <CheckboxGroup.Item v-for="value in toppings" :key="value" :value="value">
      <CheckboxGroup.ItemControl>
        <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
      </CheckboxGroup.ItemControl>
      <CheckboxGroup.ItemLabel>{{ value }}</CheckboxGroup.ItemLabel>
    </CheckboxGroup.Item>
  </CheckboxGroup.Root>
</template>
