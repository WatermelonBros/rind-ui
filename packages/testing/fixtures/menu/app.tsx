// The page menu.pw.test.ts drives: themed Menus, bundled by the test itself.
import { Menu } from "@rind-ui/react"
import { useState } from "react"
import { createRoot } from "react-dom/client"

function App() {
  const [last, setLast] = useState("none")
  const [mode, setMode] = useState<string | null>("list")
  return (
    <div style={{ display: "flex", gap: 16, padding: 24 }}>
      <Menu.Root>
        <Menu.Trigger>Encoding</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.Item onSelect={() => setLast("save")}>Save with encoding</Menu.Item>
              <Menu.Submenu>
                <Menu.SubmenuTrigger>Reopen with</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Content>
                      <Menu.Item onSelect={() => setLast("UTF-8")}>UTF-8</Menu.Item>
                      <Menu.Item onSelect={() => setLast("UTF-16")}>UTF-16</Menu.Item>
                    </Menu.Content>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Submenu>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <Menu.Root>
        <Menu.Trigger>View</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.CheckboxItem onCheckedChange={(c) => setLast(`Minimap:${c}`)}>
                <Menu.ItemIndicator>✓</Menu.ItemIndicator>
                Minimap
              </Menu.CheckboxItem>
              <Menu.Separator />
              <Menu.Group>
                <Menu.GroupLabel>Layout</Menu.GroupLabel>
                <Menu.RadioGroup value={mode} onValueChange={setMode}>
                  <Menu.RadioItem value="list">
                    <Menu.ItemIndicator>●</Menu.ItemIndicator>List
                  </Menu.RadioItem>
                  <Menu.RadioItem value="grid">
                    <Menu.ItemIndicator>●</Menu.ItemIndicator>Grid
                  </Menu.RadioItem>
                </Menu.RadioGroup>
              </Menu.Group>
              <Menu.Separator />
              <Menu.Item disabled onSelect={() => setLast("Reset")}>
                Reset
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <output aria-label="Last">{last}</output>
    </div>
  )
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />)
