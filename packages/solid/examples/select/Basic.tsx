/** @jsxImportSource solid-js */
import { Select } from "@rind-ui/solid"
import { For } from "solid-js"

const fruits = ["Apple", "Banana", "Cherry", "Grape", "Mango", "Peach"].map((f) => ({
  key: f.toLowerCase(),
  label: f,
}))

export function Basic() {
  return (
    <Select.Root items={fruits} placeholder="Pick one" defaultValue="banana">
      <Select.Label>Fruit</Select.Label>
      <Select.Trigger>
        <Select.ValueText />
        <Select.Indicator>▾</Select.Indicator>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner>
          <Select.Content>
            <Select.List>
              <For each={fruits}>
                {(f) => (
                  <Select.Item value={f.key}>
                    <Select.ItemText>{f.label}</Select.ItemText>
                    <Select.ItemIndicator>✓</Select.ItemIndicator>
                  </Select.Item>
                )}
              </For>
            </Select.List>
          </Select.Content>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}
