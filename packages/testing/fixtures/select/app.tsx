// The page select.pw.test.ts drives: themed Selects on a page long enough to scroll, bundled by
// the test itself.
import { Select } from "@rind-ui/react"
import { useState } from "react"
import { createRoot } from "react-dom/client"

const FRUITS = ["Apple", "Banana", "Cherry"].map((f) => ({ key: f.toLowerCase(), label: f }))
const MANY = Array.from({ length: 40 }, (_, i) => ({ key: `n${i}`, label: `Item ${i}` }))

function Picker(props: {
  label: string
  items: readonly { key: string; label: string }[]
  name?: string
  listStyle?: React.CSSProperties
}) {
  return (
    <Select.Root
      items={props.items}
      placeholder="Pick one"
      {...(props.name && { name: props.name })}
    >
      <Select.Label>{props.label}</Select.Label>
      <Select.Trigger>
        <Select.ValueText />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner>
          <Select.Content>
            <Select.List {...(props.listStyle && { style: props.listStyle })}>
              {props.items.map((i) => (
                <Select.Item key={i.key} value={i.key}>
                  <Select.ItemText>{i.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Content>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}

function App() {
  const [clicks, setClicks] = useState(0)
  return (
    <div style={{ padding: 24, minHeight: 3000 }}>
      <Picker label="Fruit" items={FRUITS} name="fruit" />
      <button
        type="button"
        onClick={() => setClicks((c) => c + 1)}
        style={{ display: "block", width: 320, height: 240 }}
      >
        Under
      </button>
      <output aria-label="Clicks">{clicks}</output>
      <div style={{ marginTop: 400 }}>
        <Picker label="Many" items={MANY} listStyle={{ maxHeight: 160, overflowY: "auto" }} />
      </div>
      <div style={{ position: "fixed", right: 24, bottom: 40 }}>
        <Picker label="Low" items={FRUITS} />
      </div>
    </div>
  )
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />)
