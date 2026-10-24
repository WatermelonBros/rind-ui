<script setup lang="ts">
import { Slider } from "@rind-ui/vue"
</script>

<template>
  <Slider.Root :default-value="40">
    <Slider.Label>Volume</Slider.Label>
    <Slider.ValueText />
    <Slider.Control>
      <Slider.Track>
        <Slider.Indicator />
      </Slider.Track>
      <Slider.Thumb :index="0" :disabled="false" />
    </Slider.Control>
  </Slider.Root>
</template>
