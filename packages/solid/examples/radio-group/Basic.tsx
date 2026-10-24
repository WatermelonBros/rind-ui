/** @jsxImportSource solid-js */
import { RadioGroup } from "@rind-ui/solid"
import { For } from "solid-js"

export function Basic() {
  return (
    <RadioGroup.Root defaultValue="Medium">
      <RadioGroup.Label>Size</RadioGroup.Label>
      <For each={["Small", "Medium", "Large"]}>
        {(value) => (
          <RadioGroup.Item value={value}>
            <RadioGroup.ItemControl>
              <RadioGroup.ItemIndicator />
            </RadioGroup.ItemControl>
            <RadioGroup.ItemLabel>{value}</RadioGroup.ItemLabel>
          </RadioGroup.Item>
        )}
      </For>
    </RadioGroup.Root>
  )
}
