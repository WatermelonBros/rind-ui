import type {
  Collection,
  CollectionKey,
  TreeCollection,
  TreeViewMessages,
  TreeViewParts,
} from "@rind-ui/core"
import { createContext } from "../context"
import type { useEnvironment } from "../provider"
import type { TreeViewNodeState } from "./types"

export interface TreeViewHost {
  readonly parts: () => TreeViewParts
  readonly tree: () => TreeCollection<unknown>
  readonly visible: () => Collection<unknown>
  readonly focused: () => boolean
  readonly highlightedIndex: () => number | undefined
  readonly node: (key: CollectionKey) => TreeViewNodeState | undefined
  readonly messages: () => TreeViewMessages
  readonly env: ReturnType<typeof useEnvironment>
  readonly mountLabel: (on: boolean) => void
  readonly mountEmpty: (on: boolean) => void
  readonly mountText: (key: CollectionKey, on: boolean) => void
  readonly setHovered: (key: CollectionKey | null) => void
  readonly setPressed: (key: CollectionKey | null) => void
  readonly options: () => {
    readonly checkable: boolean
    readonly selectionMode: string | undefined
  }
  readonly canMove: (key: CollectionKey) => boolean
  readonly startDrag: (key: CollectionKey, event: PointerEvent) => void
  readonly dropAt: () => { readonly top: number; readonly level: number } | null
}
export const treeViewHost = createContext<TreeViewHost>("tree-view")
export const treeViewItem = createContext<() => CollectionKey>("tree-view-item")

/**
 * For a virtualizer inside `TreeView.Root`: the visible row count and the indexes it must keep
 * rendered (the highlighted row, so focus and the keyboard never lose it). Call in a component's
 * script; read the getters in the template or a `$derived`.
 */
export function useVisibleRows(): {
  readonly count: number
  readonly persistedIndexes: readonly number[]
} {
  const host = treeViewHost.get()
  return {
    get count() {
      return host.visible().size
    },
    get persistedIndexes() {
      const index = host.highlightedIndex()
      return index === undefined ? [] : [index]
    },
  }
}
