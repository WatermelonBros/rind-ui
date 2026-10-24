<script lang="ts">
import { Sortable } from "@rind-ui/svelte"

const TASKS: Record<string, string> = {
  research: "Read the issue trackers",
  spec: "Write the spec",
  machine: "Build the machine",
  tests: "Test through the driver",
  docs: "Write the docs page",
}
let items = $state.raw<readonly string[]>(Object.keys(TASKS))
</script>

<div style="inline-size: min(100%, 420px)">
  <Sortable.Root
    aria-label="Tasks"
    {items}
    onReorder={(keys) => (items = keys)}
    style="display: grid; gap: 6px"
  >
    {#each items as key (key)}
      <Sortable.Item value={key}>
        <Sortable.Handle />
        <span style="flex: 1">{TASKS[key]}</span>
        <Sortable.MoveButton direction="up" />
        <Sortable.MoveButton direction="down" />
      </Sortable.Item>
    {/each}
    <Sortable.Indicator />
  </Sortable.Root>
</div>
