<script setup lang="ts">
import { RadioGroup } from "@rind-ui/vue"
</script>

<template>
  <RadioGroup.Root default-value="Medium">
    <RadioGroup.Label>Size</RadioGroup.Label>
    <RadioGroup.Item v-for="value in ['Small', 'Medium', 'Large']" :key="value" :value="value">
      <RadioGroup.ItemControl>
        <RadioGroup.ItemIndicator />
      </RadioGroup.ItemControl>
      <RadioGroup.ItemLabel>{{ value }}</RadioGroup.ItemLabel>
    </RadioGroup.Item>
  </RadioGroup.Root>
</template>
