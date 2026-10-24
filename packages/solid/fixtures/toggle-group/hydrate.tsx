/** @jsxImportSource solid-js */
import { ToggleGroup } from "../../src/toggle-group"

export function App() {
  return (
    <ToggleGroup.Root aria-label="Alignment" defaultValue={["center"]}>
      <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
      <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
      <ToggleGroup.Item value="right" disabled>
        Right
      </ToggleGroup.Item>
    </ToggleGroup.Root>
  )
}
