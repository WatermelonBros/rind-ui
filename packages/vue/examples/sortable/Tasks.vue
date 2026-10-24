<script setup lang="ts">
import { Sortable } from "@rind-ui/vue"
import { ref } from "vue"

const TASKS: Record<string, string> = {
  research: "Read the issue trackers",
  spec: "Write the spec",
  machine: "Build the machine",
  tests: "Test through the driver",
  docs: "Write the docs page",
}
const items = ref<readonly string[]>(Object.keys(TASKS))
</script>

<template>
  <div style="inline-size: min(100%, 420px)">
    <Sortable.Root
      aria-label="Tasks"
      :items="items"
      style="display: grid; gap: 6px"
      @reorder="(keys) => (items = keys)"
    >
      <Sortable.Item v-for="key in items" :key="key" :value="key">
        <Sortable.Handle />
        <span style="flex: 1">{{ TASKS[key] }}</span>
        <Sortable.MoveButton direction="up" />
        <Sortable.MoveButton direction="down" />
      </Sortable.Item>
      <Sortable.Indicator />
    </Sortable.Root>
  </div>
</template>
