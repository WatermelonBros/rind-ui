// The page tree-view.pw.test.ts drives: a themed file tree, bundled by the test itself.
import { TreeView, type TreeViewItemData } from "@rind-ui/react"
import { createRoot } from "react-dom/client"

const FILES: readonly TreeViewItemData[] = [
  {
    key: "src",
    label: "src",
    children: [
      { key: "a.ts", label: "a.ts" },
      { key: "index.ts", label: "index.ts" },
    ],
  },
  { key: "docs", label: "docs", children: [{ key: "index.ts-docs", label: "index.ts" }] },
]

declare global {
  interface Window {
    actions: string[]
  }
}
window.actions = []

createRoot(document.getElementById("root") as HTMLElement).render(
  <>
    <TreeView.Root items={FILES} selectionMode="none" onAction={(key) => window.actions.push(key)}>
      <TreeView.Label>Files</TreeView.Label>
      <TreeView.Tree>
        {(node) => (
          <TreeView.Item value={node.key}>
            {node.isBranch ? <TreeView.ItemIndicator>▸</TreeView.ItemIndicator> : null}
            <TreeView.ItemText>{node.label}</TreeView.ItemText>
          </TreeView.Item>
        )}
      </TreeView.Tree>
    </TreeView.Root>
    <button type="button">After</button>
  </>,
)
