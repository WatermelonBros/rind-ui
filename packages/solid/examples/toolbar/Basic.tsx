/** @jsxImportSource solid-js */
import { RadioGroup, ToggleGroup, Toolbar } from "@rind-ui/solid"
import { For } from "solid-js"

export function Basic() {
  return (
    <Toolbar.Root aria-label="Formatting">
      <ToggleGroup.Root aria-label="Text style" selectionMode="multiple" defaultValue={["bold"]}>
        <ToggleGroup.Item value="bold">Bold</ToggleGroup.Item>
        <ToggleGroup.Item value="italic">Italic</ToggleGroup.Item>
      </ToggleGroup.Root>
      <Toolbar.Separator />
      <RadioGroup.Root aria-label="Alignment" orientation="horizontal" defaultValue="left">
        <For each={["left", "center", "right"]}>
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
      <Toolbar.Separator />
      <Toolbar.Button>Share</Toolbar.Button>
    </Toolbar.Root>
  )
}
