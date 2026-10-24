// The Tree View contract model (React's matrix) against the Svelte parts, and DOM parity.
import {
  createTreeCollection,
  type TreeViewProps,
  treeViewContract,
  treeViewIds,
  treeViewTraits,
} from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import Files from "../../fixtures/tree-view/files.svelte"
import type { TreeViewItemData } from "../index"

const FILES: readonly TreeViewItemData[] = [
  {
    key: "src",
    label: "src",
    children: [
      { key: "a.ts", label: "a.ts" },
      { key: "styles", label: "styles", children: [{ key: "site.css", label: "site.css" }] },
    ],
  },
  { key: "docs", label: "docs", children: [{ key: "readme.md", label: "readme.md" }] },
  { key: "license", label: "license" },
]
const treeOf = (items: readonly TreeViewItemData[]) =>
  createTreeCollection<TreeViewItemData>({
    roots: items,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    getChildren: (i) => i.children,
    hasUnloadedChildren: (i) => i.isBranch === true,
    isDisabled: (i) => i.disabled === true,
  })
type Config = Pick<
  TreeViewProps,
  "selectionMode" | "selectionBehavior" | "checkable" | "checkPropagation" | "focusableWhenDisabled"
> & {
  readonly items?: readonly TreeViewItemData[]
  readonly defaultExpandedValue?: readonly string[]
}
const rootOf = (cfg: Config) => {
  const { items: _items, ...rest } = cfg
  return { ...rest, ...(cfg.selectionMode === "none" ? { onAction: () => {} } : {}) }
}
const reactTree = (cfg: Config) =>
  r(
    R.TreeView.Root,
    { items: cfg.items ?? FILES, ...rootOf(cfg) } as never,
    r(R.TreeView.Label, null, "Files"),
    // The row render function is the Tree's child (a function child, not a node).
    r(R.TreeView.Tree, null, ((node: R.TreeViewNodeState) =>
      r(
        R.TreeView.Item,
        { value: node.key },
        node.isBranch ? r(R.TreeView.ItemIndicator, null, "▸") : null,
        r(R.TreeView.ItemText, null, node.label),
      )) as never),
    r(R.TreeView.Empty),
  )

function config(name: string, cfg: Config) {
  const contract = { ...treeViewContract, traits: treeViewTraits(cfg) } as typeof treeViewContract
  const items = cfg.items ?? FILES
  describe(`svelte tree view model: ${name}`, () => {
    testMachine(contract, {
      test: it,
      setup: () => mount(Files, { items, root: rootOf(cfg) } as never),
      target: () => screen,
      anchor: [{ name: "Files" }],
      props: {
        tree: treeOf(items),
        ids: { list: treeViewIds("oracle").tree, item: treeViewIds("oracle").item },
        selectionMode: cfg.selectionMode ?? "single",
        selectionBehavior: cfg.selectionBehavior,
        checkable: cfg.checkable,
        checkPropagation: cfg.checkPropagation,
        focusableWhenDisabled: cfg.focusableWhenDisabled,
        disabled: false,
        defaultExpandedValue: cfg.defaultExpandedValue ?? [],
        defaultValue: cfg.selectionMode === "multiple" ? [] : null,
        ...(cfg.selectionMode === "none" ? { onAction: () => {} } : {}),
      } as never,
      modalities: ["pointer", "keyboard", "touch", "virtual"],
    } as never)
  })
}
config("single toggle", { selectionMode: "single", defaultExpandedValue: ["src"] })
config("multiple replace", {
  selectionMode: "multiple",
  selectionBehavior: "replace",
  defaultExpandedValue: ["src", "styles"],
})
config("none with onAction", { selectionMode: "none" })
config("checkable, propagation both", {
  checkable: true,
  selectionMode: "none",
  defaultExpandedValue: ["src"],
})
config("checkable, propagation none", {
  checkable: true,
  checkPropagation: "none",
  selectionMode: "none",
})
config("disabled items", {
  selectionMode: "single",
  items: FILES.map((f) => (f.key === "docs" ? { ...f, disabled: true } : f)),
})
config("empty", { selectionMode: "single", items: [] })
config('keys "0" and ""', {
  selectionMode: "single",
  items: [
    { key: "0", label: "zero" },
    { key: "", label: "blank" },
    { key: "s", label: "src", children: [{ key: "1", label: "one" }] },
  ],
})

describe("Svelte Tree View matches React", () => {
  it("expanded, multiple, checkable, empty", async () => {
    for (const cfg of [
      { selectionMode: "single", defaultExpandedValue: ["src"] },
      { selectionMode: "multiple", defaultExpandedValue: ["src", "styles"] },
      { checkable: true, selectionMode: "none", defaultExpandedValue: ["src"] },
      { selectionMode: "single", items: [] },
    ] as Config[]) {
      await clientParity(reactTree(cfg), Files, {
        items: cfg.items ?? FILES,
        root: rootOf(cfg),
        provider: false,
      } as never)
    }
  })
})
