/** @jsxImportSource solid-js */
import { CheckboxGroup } from "@rind-ui/solid"
import { For } from "solid-js"

const toppings = ["Ham", "Cheese", "Olives"]

export function Basic() {
  return (
    <CheckboxGroup.Root allValues={toppings} defaultValue={["Ham"]}>
      <CheckboxGroup.Label>Toppings</CheckboxGroup.Label>
      <CheckboxGroup.Parent>
        <CheckboxGroup.ItemControl>
          <CheckboxGroup.ItemIndicator>
            {({ indeterminate }) => (indeterminate ? "–" : "✓")}
          </CheckboxGroup.ItemIndicator>
        </CheckboxGroup.ItemControl>
        <CheckboxGroup.ItemLabel>All toppings</CheckboxGroup.ItemLabel>
      </CheckboxGroup.Parent>
      <For each={toppings}>
        {(value) => (
          <CheckboxGroup.Item value={value}>
            <CheckboxGroup.ItemControl>
              <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
            </CheckboxGroup.ItemControl>
            <CheckboxGroup.ItemLabel>{value}</CheckboxGroup.ItemLabel>
          </CheckboxGroup.Item>
        )}
      </For>
    </CheckboxGroup.Root>
  )
}
