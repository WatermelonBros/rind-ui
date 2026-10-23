<script setup lang="ts">
import { SegmentedControl } from "@rind-ui/vue"
</script>

<template>
  <SegmentedControl.Root aria-label="Range" default-value="week">
    <SegmentedControl.Item value="day">Day</SegmentedControl.Item>
    <SegmentedControl.Item value="week">Week</SegmentedControl.Item>
    <SegmentedControl.Item value="month">Month</SegmentedControl.Item>
    <SegmentedControl.Indicator />
  </SegmentedControl.Root>
</template>
