// Model-based tests (task 5.2): the Tree View contract over props classes: single toggle,
// multiple replace, none with onAction, checkable (both and none), disabled items, empty,
// keys "0" and "", under ltr and rtl; every modality.
import {
  createTreeCollection,
  platforms,
  type TreeViewProps,
  treeViewContract,
  treeViewIds,
  treeViewTraits,
} from "@rind-ui/core"
import {
  RindProvider,
  TreeView,
  type TreeViewItemData,
  type TreeViewRootProps,
} from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { describe, it } from "vitest"
import { currentRun, testMachine } from "../index"

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

function config(name: string, cfg: Config) {
  const contract = { ...treeViewContract, traits: treeViewTraits(cfg) } as typeof treeViewContract
  const { items = FILES, ...rest } = cfg
  const root = {
    ...rest,
    ...(cfg.selectionMode === "none" ? { onAction: () => {} } : {}),
  } as TreeViewRootProps
  describe(`tree view model: ${name}`, () => {
    testMachine(contract, {
      test: it,
      setup: () =>
        render(
          <RindProvider
            environment={{ platform: currentRun()?.platform ?? platforms.linux }}
            dir={currentRun()?.direction === "rtl" ? "rtl" : "ltr"}
          >
            <TreeView.Root items={items} {...root}>
              <TreeView.Label>Files</TreeView.Label>
              <TreeView.Tree>
                {(node) => (
                  <TreeView.Item value={node.key}>
                    {node.isBranch ? <TreeView.ItemIndicator>▸</TreeView.ItemIndicator> : null}
                    <TreeView.ItemText>{node.label}</TreeView.ItemText>
                  </TreeView.Item>
                )}
              </TreeView.Tree>
              <TreeView.Empty />
            </TreeView.Root>
            <button type="button">After</button>
          </RindProvider>,
        ),
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
