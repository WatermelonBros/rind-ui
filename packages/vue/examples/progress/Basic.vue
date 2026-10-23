<script setup lang="ts">
import { Progress } from "@rind-ui/vue"
</script>

<template>
  <Progress.Root :value="40">
    <Progress.Label>Uploading</Progress.Label>
    <Progress.ValueText />
    <Progress.Track>
      <Progress.Indicator />
    </Progress.Track>
  </Progress.Root>
</template>
