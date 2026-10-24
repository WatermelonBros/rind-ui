/** @jsxImportSource solid-js */
import { Listbox } from "../../src/listbox"
import { TagGroup } from "../../src/tag-group"
import { TreeView } from "../../src/tree-view"

const FRUITS = ["Apple", "Banana", "Cherry"].map((label) => ({ key: label.toLowerCase(), label }))
const FILES = [
  { key: "src", label: "src", children: [{ key: "a.ts", label: "a.ts" }] },
  { key: "license", label: "license" },
]

export function App() {
  return (
    <div>
      <Listbox.Root items={FRUITS} defaultValue="banana">
        <Listbox.Label>Fruit</Listbox.Label>
        <Listbox.List>
          <Listbox.Items />
        </Listbox.List>
      </Listbox.Root>
      <TagGroup.Root
        items={FRUITS}
        selectionMode="multiple"
        defaultValue={["apple"]}
        onRemove={() => {}}
      >
        <TagGroup.Label>Tags</TagGroup.Label>
        <TagGroup.List>
          <TagGroup.Tags />
        </TagGroup.List>
      </TagGroup.Root>
      <TreeView.Root items={FILES} defaultExpandedValue={["src"]}>
        <TreeView.Label>Files</TreeView.Label>
        <TreeView.Tree>
          {(node) => (
            <TreeView.Item value={node.key}>
              <TreeView.ItemText>{node.label}</TreeView.ItemText>
            </TreeView.Item>
          )}
        </TreeView.Tree>
      </TreeView.Root>
    </div>
  )
}
