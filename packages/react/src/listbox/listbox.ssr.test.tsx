// Server render: the selected item is the tab stop before any client code runs.
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Listbox } from "../index"

describe("Listbox server render", () => {
  it("data items: roles, explicit aria-selected, the selected item is the tab stop", () => {
    const out = renderToString(
      <Listbox.Root items={["a", "b", "c"].map((k) => ({ key: k, label: k }))} defaultValue="b">
        <Listbox.List aria-label="Fruit">
          <Listbox.Items />
        </Listbox.List>
      </Listbox.Root>,
    )
    expect(out).toContain('role="listbox"')
    expect((out.match(/role="option"/g) ?? []).length).toBe(3)
    const b = /<div[^>]*data-key="b"[^>]*>/.exec(out)?.[0] ?? ""
    expect(b).toContain('aria-selected="true"')
    expect(b).toMatch(/tabindex="0"/i)
  })
})
