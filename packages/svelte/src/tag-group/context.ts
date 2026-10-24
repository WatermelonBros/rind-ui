import type { Collection, CollectionKey, ItemRegistry, TagGroupParts } from "@rind-ui/core"
import { createContext } from "../context"

export const tagGroupHost = createContext<{
  readonly parts: () => TagGroupParts
  readonly collection: () => Collection<unknown>
  readonly registry: ItemRegistry | null
  readonly mount: (part: "label" | "description", on: boolean) => void
  readonly mountLink: (key: CollectionKey, on: boolean) => void
  readonly hover: (key: CollectionKey | null) => void
  readonly press: (key: CollectionKey | null) => void
  readonly hrefOf: (key: CollectionKey) => string | undefined
  readonly removable: () => boolean
}>("tag-group")
export const tagGroupTag = createContext<{
  readonly key: () => CollectionKey
  readonly href: () => string | undefined
  readonly row: { current: Element | null }
}>("tag-group-tag")
export const tagGroupList = createContext<boolean>("tag-group-list")
