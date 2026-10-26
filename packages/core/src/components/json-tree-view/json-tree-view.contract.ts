// JSON Tree View's contract (add-json-tree-view design §10): it is a Tree View, so it is Tree
// View's contract (scope, items, keys, expansion), plus the JSON queries and copy. The JSON
// parts carry the `json-tree-view` scope and the item's pointer in `data-key`.

import { contract } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { treeViewContract } from "../tree-view/tree-view.contract"

type P = (typeof treeViewContract.anatomy)[number]
type E = Env<P>

const JSON_SCOPE = "json-tree-view"

/** The visible item whose `data-key` is `pointer`. */
async function itemAt(env: E, pointer: string) {
  for (const item of await env.part("item").all()) {
    if ((await item.attr("data-key")) === pointer) return item
  }
  throw new Error(`json-tree-view: no visible item at "${pointer}"`)
}

/** The text of a JSON part of the item at `pointer` ("" when it has none). */
async function textOf(env: E, pointer: string, part: "value" | "summary-text") {
  for (const el of await env.part("tree").scoped(JSON_SCOPE, part).all()) {
    if ((await el.attr("data-key")) === pointer) return el.text()
  }
  return ""
}

export const jsonTreeViewContract = contract("tree-view", {
  ...treeViewContract,
  queries: {
    ...treeViewContract.queries,
    /** The accessible name of the item at a JSON Pointer. */
    nodeAt: async (env: E, pointer: string) => (await itemAt(env, pointer)).accessibleName(),
    /** The Value text of the leaf at a JSON Pointer. */
    valueText: (env: E, pointer: string) => textOf(env, pointer, "value"),
    /** The spoken summary of the container at a JSON Pointer. */
    summaryOf: (env: E, pointer: string) => textOf(env, pointer, "summary-text"),
    /** The copy feedback, from the Root's `data-copy-state`. */
    copyState: async (env: E) => (await env.part("root").attr("data-copy-state")) ?? "idle",
  },
  actions: {
    ...treeViewContract.actions,
    /** Copies the focused item: Mod+C on the tree, or a press of the CopyTrigger. */
    copy: {
      keyboard: async (env: E) => {
        await env.part("tree").copySelection()
      },
      pointer: (env: E) => env.part("root").scoped(JSON_SCOPE, "copy-trigger").click(),
      touch: (env: E) => env.part("root").scoped(JSON_SCOPE, "copy-trigger").tap(),
      done: async () => true,
    },
  },
})
