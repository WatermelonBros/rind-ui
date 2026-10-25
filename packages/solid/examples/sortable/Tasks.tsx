/** @jsxImportSource solid-js */
import { Sortable } from "@rind-ui/solid"
import { createSignal, For } from "solid-js"

const TASKS: Record<string, string> = {
  research: "Read the issue trackers",
  spec: "Write the spec",
  machine: "Build the machine",
  tests: "Test through the driver",
  docs: "Write the docs page",
}

export function Tasks() {
  const [items, setItems] = createSignal<readonly string[]>(Object.keys(TASKS))
  return (
    <div style={{ "inline-size": "min(100%, 420px)" }}>
      <Sortable.Root
        aria-label="Tasks"
        items={items()}
        onReorder={(keys) => setItems(keys)}
        style={{ display: "grid", gap: "6px" }}
      >
        <For each={[...items()]}>
          {(key) => (
            <Sortable.Item value={key}>
              <Sortable.Handle />
              <span style={{ flex: 1 }}>{TASKS[key]}</span>
              <Sortable.MoveButton direction="up" />
              <Sortable.MoveButton direction="down" />
            </Sortable.Item>
          )}
        </For>
        <Sortable.Indicator />
      </Sortable.Root>
    </div>
  )
}
