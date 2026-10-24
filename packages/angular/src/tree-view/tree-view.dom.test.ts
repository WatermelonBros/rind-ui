// The Tree View contract model (React's matrix) against the Angular parts, and markup parity.
import { Component } from "@angular/core"
import {
  createTreeCollection,
  platforms,
  type TreeViewProps,
  treeViewContract,
  treeViewIds,
  treeViewTraits,
} from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { TreeView, type TreeViewItemData } from "./tree-view"

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
/** The configuration the next fixture renders. */
let current: { cfg: Config; around: boolean } = { cfg: {}, around: false }

const TREE = `<ng-container
      rindTreeViewRoot
      [items]="items"
      [selectionMode]="$any(root).selectionMode ?? 'single'"
      [selectionBehavior]="$any(root).selectionBehavior"
      [checkable]="$any(root).checkable ?? false"
      [checkPropagation]="$any(root).checkPropagation"
      [focusableWhenDisabled]="$any(root).focusableWhenDisabled"
      [defaultExpandedValue]="$any(root).defaultExpandedValue"
      [onAction]="$any(root).onAction"
    >
      <span rindTreeViewLabel>Files</span>
      <div rindTreeViewTree>
        <ng-template rindTreeViewRow let-node>
          <div rindTreeViewItem [value]="node.key">
            @if (node.isBranch) {
              <span rindTreeViewItemIndicator>▸</span>
            }
            <span rindTreeViewItemText>{{ node.label }}</span>
          </div>
        </ng-template>
      </div>
      <div rindTreeViewEmpty></div>
    </ng-container>`

@Component({
  selector: "rind-f",
  imports: [RindProvider, TreeView],
  template: `@if (around) {
      <ng-container rindProvider [environment]="env" [dir]="dir">
        ${TREE}<button type="button">After</button>
      </ng-container>
    } @else {
      ${TREE}
    }`,
})
class Tree {
  readonly env = { platform: currentRun()?.platform ?? platforms.linux }
  readonly dir = currentRun()?.direction === "rtl" ? "rtl" : "ltr"
  readonly items = current.cfg.items ?? FILES
  readonly root = rootOf(current.cfg)
  readonly around = current.around
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
  describe(`angular tree view model: ${name}`, () => {
    testMachine(contract, {
      test: it,
      setup: () => {
        current = { cfg, around: true }
        return mount(Tree)
      },
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

describe("Angular Tree View matches React", () => {
  it("expanded, multiple, checkable, empty", async () => {
    for (const cfg of [
      { selectionMode: "single", defaultExpandedValue: ["src"] },
      { selectionMode: "multiple", defaultExpandedValue: ["src", "styles"] },
      { checkable: true, selectionMode: "none", defaultExpandedValue: ["src"] },
      { selectionMode: "single", items: [] },
    ] as Config[]) {
      current = { cfg, around: false }
      await both(reactTree(cfg), Tree)
    }
  })
})
