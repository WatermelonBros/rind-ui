// The page combobox-component.pw.test.ts drives: public Combobox, bundled by the test itself.
import { Combobox } from "@rind-ui/react"
import { createRoot } from "react-dom/client"

const CITIES = [
  { key: "rome", label: "Rome" },
  { key: "paris", label: "Paris" },
  { key: "prague", label: "Prague" },
  { key: "oslo", label: "Oslo", disabled: true },
]

const win = window as unknown as { submits: number }
win.submits = 0

function App() {
  return (
    <div style={{ padding: 24, width: 320 }}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          win.submits += 1
        }}
      >
        <Combobox.Root items={CITIES} name="city">
          <Combobox.Label>City</Combobox.Label>
          <Combobox.Control>
            <Combobox.Input />
            <Combobox.Trigger />
            <Combobox.ClearTrigger />
          </Combobox.Control>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Items />
              </Combobox.List>
              <Combobox.Empty>No results</Combobox.Empty>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Root>
        <button type="submit">Submit</button>
      </form>
      <Combobox.Root items={CITIES} multiple defaultValue={["rome", "paris"]}>
        <Combobox.Label>Cities</Combobox.Label>
        <Combobox.Control>
          <Combobox.Chips />
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
      <div style={{ height: 3000 }} />
      <button type="button">After</button>
    </div>
  )
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />)
