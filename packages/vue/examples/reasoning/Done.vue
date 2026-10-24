<script setup lang="ts">
import { Reasoning } from "@rind-ui/vue"

const TRACE =
  "The user asks why the sea has tides. The moon's gravity pulls the near side of the ocean more than the far side, so the water bulges on both sides. The Earth turns under the two bulges, which gives two high tides a day. The sun adds a smaller pull: spring tides when they line up, neap tides when they are at right angles."
</script>

<template>
  <Reasoning.Root :thinking="false" :duration="12">
    <Reasoning.Trigger />
    <Reasoning.Content>{{ TRACE }}</Reasoning.Content>
  </Reasoning.Root>
</template>
