"use client"

import { Sortable } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

/** `moving` and `dragging` last while the user moves an item: reached by any example. */
export const states: States = { sortable: { idle: "Tasks" } }

const TASKS: Record<string, string> = {
  research: "Read the issue trackers",
  spec: "Write the spec",
  machine: "Build the machine",
  tests: "Test through the driver",
  docs: "Write the docs page",
}

/** Inline layout only: theme pages do not load the site's helper classes. */
const LIST = { display: "grid", gap: 6 } as const

export function Tasks() {
  const [items, setItems] = useState<readonly string[]>(Object.keys(TASKS))
  return (
    <div style={{ inlineSize: "min(100%, 420px)" }}>
      <Sortable.Root
        aria-label="Tasks"
        items={items}
        onReorder={(keys) => setItems(keys)}
        style={LIST}
      >
        {items.map((key) => (
          <Sortable.Item key={key} value={key}>
            <Sortable.Handle />
            <span style={{ flex: 1 }}>{TASKS[key]}</span>
            <Sortable.MoveButton direction="up" />
            <Sortable.MoveButton direction="down" />
          </Sortable.Item>
        ))}
        <Sortable.Indicator />
      </Sortable.Root>
    </div>
  )
}

const COLUMNS: Record<string, string> = {
  todo: "To do",
  doing: "Doing",
  review: "Review",
  done: "Done",
}

export function Columns() {
  const [items, setItems] = useState<readonly string[]>(Object.keys(COLUMNS))
  return (
    <Sortable.Root
      aria-label="Board columns"
      orientation="horizontal"
      items={items}
      onReorder={(keys) => setItems(keys)}
      style={{ display: "flex", gap: 8 }}
    >
      {items.map((key) => (
        <Sortable.Item key={key} value={key}>
          <Sortable.Handle />
          <span>{COLUMNS[key]}</span>
        </Sortable.Item>
      ))}
      <Sortable.Indicator />
    </Sortable.Root>
  )
}

export const variants: Variants = {
  Tasks: {
    title: "Tasks",
    description:
      "Drag a handle, or focus it: Space picks up, arrows move, Space drops, Escape cancels; Alt+arrow moves one place. The arrow buttons are the single-pointer alternative to dragging.",
  },
  Columns: {
    title: "Horizontal",
    description: '`orientation="horizontal"`: Left / Right move, and the drag follows the row.',
  },
}
