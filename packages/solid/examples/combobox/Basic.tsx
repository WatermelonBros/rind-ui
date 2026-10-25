/** @jsxImportSource solid-js */
import { Combobox } from "@rind-ui/solid"

const cities = [
  { key: "rome", label: "Rome" },
  { key: "paris", label: "Paris" },
  { key: "prague", label: "Prague" },
  { key: "oslo", label: "Oslo" },
  { key: "lisbon", label: "Lisbon" },
]

export function Basic() {
  return (
    <Combobox.Root items={cities} defaultValue="paris" defaultInputValue="Paris">
      <Combobox.Label>City</Combobox.Label>
      <Combobox.Control data-variant="outline">
        <Combobox.Input />
        <Combobox.ClearTrigger />
        <Combobox.Trigger />
      </Combobox.Control>
      <Combobox.Positioner>
        <Combobox.Popup>
          <Combobox.List>
            <Combobox.Items>
              {(label) => (
                <>
                  <Combobox.ItemText>{label}</Combobox.ItemText>
                  <Combobox.ItemIndicator />
                </>
              )}
            </Combobox.Items>
          </Combobox.List>
          <Combobox.Empty>No results</Combobox.Empty>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Root>
  )
}
