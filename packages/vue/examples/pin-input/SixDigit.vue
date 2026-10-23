<script setup lang="ts">
import { PinInput } from "@rind-ui/vue"
</script>

<template>
  <PinInput.Root :length="6">
    <PinInput.Label>Verification code</PinInput.Label>
    <PinInput.Control>
      <PinInput.Input />
      <PinInput.Slot v-for="i in 6" :key="i" :index="i - 1" />
    </PinInput.Control>
  </PinInput.Root>
</template>
