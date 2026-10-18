import { describe, expect, it } from "vitest"
import { toKey } from "../../collection/key"
import { createTreeCollection } from "../../collection/tree"
import { platforms } from "../../dom/platform"
import { treeViewConnect } from "./tree-view.connect"
import { treeViewContract } from "./tree-view.contract"
import { treeViewMachine, visibleOf } from "./tree-view.machine"
import { treeViewMeta } from "./tree-view.meta"

describe("tree-view meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(treeViewContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(treeViewMeta.contract.actions).toEqual(actions)
    expect(treeViewMeta.contract.queries).toEqual(Object.keys(treeViewContract.queries))
    expect(treeViewMeta.contract.traits).toEqual(treeViewContract.traits)
    expect(Object.keys(treeViewMeta.states)).toEqual(Object.keys(treeViewMachine.def.states))
  })

  it("every data attribute the item and tree parts can carry is documented", () => {
    const tree = createTreeCollection<{ id: string; kids?: { id: string }[] }>({
      roots: [{ id: "src", kids: [{ id: "a" }] }],
      getKey: (r) => r.id,
      getText: (r) => r.id,
      getChildren: (r) => r.kids,
    })
    const api = treeViewConnect(
      {
        instance: "t",
        tree,
        visible: visibleOf(tree, ["src"]),
        expanded: new Set([toKey("src")]),
        context: {
          highlightedKey: toKey("src"),
          highlightSource: "keyboard",
          loading: new Set(),
          failed: new Set(),
        },
        selection: new Set(),
        selectionMode: "single",
        checkable: false,
        checked: new Set(),
        checkPropagation: "both",
        disabled: false,
        typingAhead: () => false,
        focused: true,
        modality: "keyboard",
        hovered: null,
        pressed: null,
        mounted: { label: false, empty: false, itemText: () => false },
        send: () => {},
      },
      {
        platform: platforms.linux,
        locale: { dir: () => "ltr" },
        modality: { modality: () => "keyboard" },
      } as never,
    )
    const dataKeys = (props: Record<string, unknown>) =>
      Object.keys(props).filter((key) => key.startsWith("data-") && props[key] !== undefined)
    for (const key of dataKeys(api.item(toKey("src")))) {
      expect(Object.keys(treeViewMeta.dataAttributes.item)).toContain(key)
    }
    for (const key of dataKeys(api.tree())) {
      expect(Object.keys(treeViewMeta.dataAttributes.tree)).toContain(key)
    }
  })
})
