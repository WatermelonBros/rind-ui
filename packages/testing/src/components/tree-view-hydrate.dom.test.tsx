// Server markup hydrates without a mismatch in Strict Mode, and the server's Tab stop is the
// visible row of a selection hidden under a collapsed parent (task 3.2).
import { TreeView, type TreeViewItemData } from "@rind-ui/react"
import { act } from "@testing-library/react"
import { type ReactNode, StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

const FILES: readonly TreeViewItemData[] = [
  { key: "src", label: "src", children: [{ key: "a.ts", label: "a.ts" }] },
  { key: "docs", label: "docs" },
]

const stopOf = (root: ParentNode) =>
  [...root.querySelectorAll('[role="treeitem"]')]
    .filter((o) => (o as HTMLElement).tabIndex === 0)
    .map((o) => o.getAttribute("data-key"))

async function hydrate(tree: ReactNode) {
  const container = document.createElement("div")
  container.innerHTML = renderToString(tree)
  const serverStops = stopOf(container)
  document.body.append(container)
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  let root: ReturnType<typeof hydrateRoot> | undefined
  await act(async () => {
    root = hydrateRoot(container, <StrictMode>{tree}</StrictMode>, {
      onRecoverableError: (e) => error(String(e)),
    })
  })
  const out = { calls: error.mock.calls, serverStops, clientStops: stopOf(container) }
  await act(async () => root?.unmount())
  container.remove()
  return out
}

describe("Tree View hydration", () => {
  it("no mismatch; the hidden selection's visible ancestor is the Tab stop on both sides", async () => {
    const r = await hydrate(
      <TreeView.Root items={FILES} defaultValue="a.ts">
        <TreeView.Tree aria-label="Files">
          {(n) => (
            <TreeView.Item value={n.key}>
              <TreeView.ItemText>{n.label}</TreeView.ItemText>
            </TreeView.Item>
          )}
        </TreeView.Tree>
      </TreeView.Root>,
    )
    expect(r.calls).toEqual([])
    expect(r.serverStops).toEqual(["src"])
    expect(r.clientStops).toEqual(["src"])
  })
})
