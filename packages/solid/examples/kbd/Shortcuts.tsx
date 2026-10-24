/** @jsxImportSource solid-js */
import { Kbd } from "@rind-ui/solid"
import { For } from "solid-js"

const LIST = {
  display: "grid",
  "grid-template-columns": "max-content max-content",
  gap: "10px 24px",
  "align-items": "center",
  margin: "0",
}

const SHORTCUTS = [
  { action: "Command palette", keys: "mod+k" },
  { action: "Save", keys: "mod+s" },
  { action: "Find in files", keys: "mod+shift+f" },
  { action: "Go to inbox", keys: "g i" },
  { action: "Close", keys: "escape" },
]

export function Shortcuts() {
  return (
    <dl style={LIST}>
      <For each={SHORTCUTS}>
        {(s) => (
          <div style={{ display: "contents" }}>
            <dt>{s.action}</dt>
            <dd style={{ margin: "0" }}>
              <Kbd.Root keys={s.keys} />
            </dd>
          </div>
        )}
      </For>
    </dl>
  )
}
