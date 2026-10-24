<script setup lang="ts">
import { Meter } from "@rind-ui/vue"
</script>

<template>
  <Meter.Root :value="75">
    <Meter.Label>Storage</Meter.Label>
    <Meter.ValueText />
    <Meter.Track>
      <Meter.Indicator />
    </Meter.Track>
  </Meter.Root>
</template>
