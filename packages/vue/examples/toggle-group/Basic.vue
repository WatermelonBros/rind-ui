<script setup lang="ts">
import { ToggleGroup } from "@rind-ui/vue"
</script>

<template>
  <ToggleGroup.Root aria-label="Alignment" :default-value="['left']">
    <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
    <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
    <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
  </ToggleGroup.Root>
</template>
