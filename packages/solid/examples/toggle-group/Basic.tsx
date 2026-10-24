/** @jsxImportSource solid-js */
import { ToggleGroup } from "@rind-ui/solid"

export function Basic() {
  return (
    <ToggleGroup.Root aria-label="Alignment" defaultValue={["left"]}>
      <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
      <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
      <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
    </ToggleGroup.Root>
  )
}
