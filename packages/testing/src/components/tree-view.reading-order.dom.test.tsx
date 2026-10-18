// add-tree-view 5.4: a screen reader reaches the tree's name, then each row with its role,
// level and position, expanded state and check state, in order; no indicator or checkbox is
// read as a node of its own.
import { TreeView, type TreeViewItemData } from "@rind-ui/react"
import { render } from "@testing-library/react"
import { expect, it } from "vitest"
import { spokenLog } from "../index"

const FILES: readonly TreeViewItemData[] = [
  { key: "src", label: "src", children: [{ key: "a.ts", label: "a.ts" }] },
  { key: "docs", label: "docs" },
]

it("the tree name, then rows with level, position, expanded and checked state", async () => {
  const { container } = render(
    <TreeView.Root items={FILES} checkable selectionMode="none" defaultExpandedValue={["src"]}>
      <TreeView.Label>Files</TreeView.Label>
      <TreeView.Tree>
        {(node) => (
          <TreeView.Item value={node.key}>
            {node.isBranch ? <TreeView.ItemIndicator>▸</TreeView.ItemIndicator> : null}
            <TreeView.ItemCheckbox>☐</TreeView.ItemCheckbox>
            <TreeView.ItemText>{node.label}</TreeView.ItemText>
          </TreeView.Item>
        )}
      </TreeView.Tree>
    </TreeView.Root>,
  )
  const log = await spokenLog(container, async (virtual) => {
    for (let i = 0; i < 12; i++) await virtual.next()
  })
  const at = (re: RegExp, from = 0) => log.findIndex((p, i) => i >= from && re.test(p))
  const tree = at(/tree.*Files|Files.*tree/)
  const src = at(/src/, tree)
  const file = at(/a\.ts/, src)
  const docs = at(/docs/, file)
  const order = [tree, src, file, docs]
  expect(
    order.every((i) => i >= 0),
    JSON.stringify({ order, log }),
  ).toBe(true)
  expect(log[src]).toMatch(/treeitem/)
  expect(log[src]).toMatch(/expanded/)
  expect(log[src]).toMatch(/level 1/)
  expect(log[file]).toMatch(/level 2/)
  expect(log[file]).toMatch(/position 1, set size 1|1 of 1/)
  expect(log[docs]).not.toMatch(/expanded/)
  // The decorative marks are not read.
  expect(log.some((p) => /[▸☐]/.test(p))).toBe(false)
})
