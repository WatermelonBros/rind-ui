/** @jsxImportSource solid-js */
import { Combobox } from "../../src/combobox"
import { Menu } from "../../src/menu"
import { Select } from "../../src/select"

const ITEMS = [
  { key: "apple", label: "Apple" },
  { key: "pear", label: "Pear" },
]

export function App() {
  return (
    <div>
      <Menu.Root>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.Item value="copy">Copy</Menu.Item>
              <Menu.Item value="paste">Paste</Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <Select.Root items={ITEMS} placeholder="Pick one" defaultValue="pear" name="fruit">
        <Select.Label>Fruit</Select.Label>
        <Select.Trigger>
          <Select.ValueText />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Content>
              <Select.List>
                <Select.Items />
              </Select.List>
            </Select.Content>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
      <Combobox.Root items={ITEMS} defaultValue="apple" name="city">
        <Combobox.Label>City</Combobox.Label>
        <Combobox.Control>
          <Combobox.Input />
          <Combobox.Trigger />
        </Combobox.Control>
        <Combobox.Positioner>
          <Combobox.Popup>
            <Combobox.List>
              <Combobox.Items />
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Root>
    </div>
  )
}
