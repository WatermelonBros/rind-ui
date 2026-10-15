"use client"

import { ToggleGroup } from "@rind-ui/react"
import { useState } from "react"
import type { Variants } from "./types"

export function Basic() {
  return (
    <ToggleGroup.Root aria-label="Alignment" defaultValue={["left"]}>
      <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
      <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
      <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
    </ToggleGroup.Root>
  )
}

export function Multiple() {
  return (
    <ToggleGroup.Root aria-label="Format" selectionMode="multiple" defaultValue={["bold"]}>
      <ToggleGroup.Item value="bold">Bold</ToggleGroup.Item>
      <ToggleGroup.Item value="italic">Italic</ToggleGroup.Item>
      <ToggleGroup.Item value="underline">Underline</ToggleGroup.Item>
    </ToggleGroup.Root>
  )
}

export function NeverEmpty() {
  return (
    <ToggleGroup.Root aria-label="View" defaultValue={["grid"]} disallowEmptySelection>
      <ToggleGroup.Item value="grid">Grid</ToggleGroup.Item>
      <ToggleGroup.Item value="list">List</ToggleGroup.Item>
      <ToggleGroup.Item value="board">Board</ToggleGroup.Item>
    </ToggleGroup.Root>
  )
}

export function Vertical() {
  return (
    <ToggleGroup.Root aria-label="Panel" orientation="vertical" defaultValue={["files"]}>
      <ToggleGroup.Item value="files">Files</ToggleGroup.Item>
      <ToggleGroup.Item value="search">Search</ToggleGroup.Item>
      <ToggleGroup.Item value="git">Source control</ToggleGroup.Item>
    </ToggleGroup.Root>
  )
}

export function Controlled() {
  const [value, setValue] = useState<readonly string[]>(["day"])
  return (
    <div className="stack">
      <ToggleGroup.Root aria-label="Range" value={value} onValueChange={setValue}>
        <ToggleGroup.Item value="day">Day</ToggleGroup.Item>
        <ToggleGroup.Item value="week">Week</ToggleGroup.Item>
        <ToggleGroup.Item value="month">Month</ToggleGroup.Item>
      </ToggleGroup.Root>
      <span className="note">value: [{value.join(", ")}]</span>
    </div>
  )
}

export function DisabledItem() {
  return (
    <ToggleGroup.Root aria-label="Export" selectionMode="multiple" defaultValue={["png"]}>
      <ToggleGroup.Item value="png">PNG</ToggleGroup.Item>
      <ToggleGroup.Item value="svg">SVG</ToggleGroup.Item>
      <ToggleGroup.Item value="pdf" disabled>
        PDF
      </ToggleGroup.Item>
    </ToggleGroup.Root>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Basic",
    description: "Single selection; pressing the pressed item releases it.",
  },
  Multiple: { title: "Multiple", description: '`selectionMode="multiple"` keeps several pressed.' },
  NeverEmpty: {
    title: "Never empty",
    description: "`disallowEmptySelection` keeps the last pressed item from being released.",
  },
  Vertical: {
    title: "Vertical",
    description:
      "`orientation` decides which arrows move focus. Arrows move focus only, never select.",
  },
  Controlled: { title: "Controlled", description: "`value` and `onValueChange`." },
  DisabledItem: { title: "Disabled item", description: "Arrow keys skip a `disabled` item." },
}
