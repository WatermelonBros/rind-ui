<script setup lang="ts">
import { CalendarDate } from "@internationalized/date"
import { DateField } from "@rind-ui/vue"

// A fixed date: the example's output never depends on today.
const fixed = new CalendarDate(2026, 10, 14)
</script>

<template>
  <DateField.Root name="birthday" :default-value="fixed">
    <DateField.Label>Birthday</DateField.Label>
    <DateField.Input />
  </DateField.Root>
</template>
