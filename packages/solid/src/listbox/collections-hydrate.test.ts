// @vitest-environment jsdom
// Node project with a DOM: fixtures/ssr.ts bundles with Node APIs, so not in the browser.
// Listbox, Tag Group and Tree View on the server: the HTML is React's, hydrates with no
// warning, and the collections stay live (a key moves the highlight).
import * as R from "@rind-ui/react"
import { canonicalHtml } from "@rind-ui/testing"
import { createElement as r } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { bootstrap, build, withoutHydrationKeys } from "../../fixtures/ssr"

afterEach(() => vi.restoreAllMocks())

const FRUITS = ["Apple", "Banana", "Cherry"].map((label) => ({ key: label.toLowerCase(), label }))
const FILES = [
  { key: "src", label: "src", children: [{ key: "a.ts", label: "a.ts" }] },
  { key: "license", label: "license" },
]

describe("Solid Listbox, Tag Group and Tree View server render and hydration", () => {
  it("server HTML matches React; hydrates with zero warnings; collections stay live", async () => {
    const server = await build("collections/hydrate.tsx", "ssr")
    const client = await build("collections/hydrate.tsx", "dom")
    const html = server.renderToString(() => server.createComponent(server.App, {}))
    const react = renderToString(
      r(
        "div",
        null,
        r(
          R.Listbox.Root,
          { items: FRUITS, defaultValue: "banana" } as never,
          r(R.Listbox.Label, null, "Fruit"),
          r(R.Listbox.List, null, r(R.Listbox.Items)),
        ),
        r(
          R.TagGroup.Root,
          {
            items: FRUITS,
            selectionMode: "multiple",
            defaultValue: ["apple"],
            onRemove: () => {},
          } as never,
          r(R.TagGroup.Label, null, "Tags"),
          r(R.TagGroup.List, null, r(R.TagGroup.Tags)),
        ),
        r(
          R.TreeView.Root,
          { items: FILES, defaultExpandedValue: ["src"] } as never,
          r(R.TreeView.Label, null, "Files"),
          r(R.TreeView.Tree, null, ((node: R.TreeViewNodeState) =>
            r(
              R.TreeView.Item,
              { value: node.key },
              r(R.TreeView.ItemText, null, node.label),
            )) as never),
        ),
      ),
    )
    expect(canonicalHtml(withoutHydrationKeys(html))).toBe(canonicalHtml(react))

    bootstrap(server)
    const container = document.body.appendChild(document.createElement("div"))
    container.innerHTML = html
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const dispose = client.hydrate(() => client.createComponent(client.App, {}), container)
    expect([...warn.mock.calls, ...error.mock.calls]).toEqual([])
    const option = container.querySelector("[role='option']") as HTMLElement
    option.focus()
    option.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    await vi.waitFor(() => expect(option.getAttribute("aria-selected")).toBe("true"))
    const row = container.querySelector("[role='treeitem']") as HTMLElement
    row.focus()
    row.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }))
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(container.querySelectorAll("[role='treeitem']")[1]),
    )
    dispose()
    container.remove()
  })
})
