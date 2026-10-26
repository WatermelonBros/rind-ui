import type {
  ClipboardMessages,
  CollectionKey,
  JsonNode,
  JsonTreeViewMessages,
} from "@rind-ui/core"
import { createContext } from "../context"
import { treeViewItem } from "../tree-view/context"
import type { JsonTreeViewApi } from "./types"

export const jsonContext = createContext<{
  readonly instance: () => string
  readonly node: (key: CollectionKey) => JsonNode | undefined
  readonly expanded: () => ReadonlySet<string>
  readonly messages: () => JsonTreeViewMessages
  readonly clipboardMessages: () => ClipboardMessages
  readonly maxPreviewItems: () => number | undefined
  readonly api: JsonTreeViewApi
  readonly copyFrom: (near: Element) => void
}>("json-tree-view")

/** The JSON node of the enclosing tree item. */
export function useNode(part: string) {
  const ctx = jsonContext.get()
  const key = treeViewItem.maybe()
  if (!key) throw new Error(`[rind-ui] JsonTreeView.${part} must be inside an item`)
  return { ctx, node: () => ctx.node(key()) }
}
