<script setup lang="ts">
import { NumberInput } from "@rind-ui/vue"
</script>

<template>
  <NumberInput.Root :default-value="2">
    <NumberInput.Label>Quantity</NumberInput.Label>
    <NumberInput.Control>
      <NumberInput.DecrementTrigger>−</NumberInput.DecrementTrigger>
      <NumberInput.Input />
      <NumberInput.IncrementTrigger>+</NumberInput.IncrementTrigger>
    </NumberInput.Control>
  </NumberInput.Root>
</template>
