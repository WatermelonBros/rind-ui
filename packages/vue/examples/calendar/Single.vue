<script setup lang="ts">
import { CalendarDate } from "@internationalized/date"
import type { CalendarValue } from "@rind-ui/core"
import { Calendar } from "@rind-ui/vue"
import { ref } from "vue"

const value = ref<CalendarValue>(null)
</script>

<template>
  <div class="stack">
    <!-- A fixed month: the example's markup never depends on today. -->
    <Calendar.Root
      v-model="value"
      aria-label="Departure"
      :visible-months="1"
      :default-focused-value="new CalendarDate(2026, 10, 14)"
    >
      <Calendar.Header>
        <Calendar.PrevTrigger />
        <Calendar.Heading />
        <Calendar.NextTrigger />
      </Calendar.Header>
      <Calendar.Grid :month="0" />
    </Calendar.Root>
    <span class="note">selected: {{ value ? String(value) : "none" }}</span>
  </div>
</template>
