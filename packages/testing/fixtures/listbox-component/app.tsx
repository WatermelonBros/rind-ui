// The page listbox-component.pw.test.ts drives: public Listbox lists, bundled by the test itself.
import { Listbox, type ListboxRootProps } from "@rind-ui/react"
import { createRoot } from "react-dom/client"

function L({
  label,
  keys,
  ...root
}: Partial<ListboxRootProps> & { label: string; keys: readonly string[] }) {
  return (
    <>
      <Listbox.Root {...(root as ListboxRootProps)}>
        <Listbox.Label>{label}</Listbox.Label>
        <Listbox.List>
          {keys.map((k) => (
            <Listbox.Item key={k} value={k}>
              <Listbox.ItemText>{k}</Listbox.ItemText>
            </Listbox.Item>
          ))}
        </Listbox.List>
      </Listbox.Root>
      <button type="button">After {label}</button>
    </>
  )
}

const record = (key: string) => {
  const el = document.body
  el.dataset["lastAction"] = key
  el.dataset["actions"] = String(Number(el.dataset["actions"] ?? "0") + 1)
}

function App() {
  return (
    <div style={{ padding: 24, width: 320, height: 4000 }}>
      <L
        label="Toppings"
        selectionMode="multiple"
        keys={["ham", "egg", "olives", "kale", "cheese"]}
      />
      <L
        label="Files"
        selectionMode="multiple"
        selectionBehavior="replace"
        onAction={record}
        keys={["a", "b", "c", "d", "e"]}
      />
      <L label="Results" selectionMode="none" onAction={record} keys={["r1", "r2", "r3"]} />
      <div dir="rtl">
        <L label="Tabs" orientation="horizontal" keys={["one", "two", "three"]} />
      </div>
    </div>
  )
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />)
