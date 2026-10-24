import type { Collection, CollectionKey, ItemRegistry, ListboxParts } from "@rind-ui/core"
import { createContext } from "../context"

/** What a host (Listbox, Select, Combobox) gives its listbox parts; getters stay reactive. */
export interface ListboxHost {
  /** The component name in errors and warnings ("Listbox", "Select"). */
  readonly name: string
  readonly parts: () => ListboxParts
  readonly collection: () => Collection<unknown>
  /** Static items register here (null: data or a given collection). */
  readonly registry: ItemRegistry | null
  readonly mount: (part: "label" | "empty", on: boolean) => void
  readonly mountDescription: (key: CollectionKey, on: boolean) => void
  /** The sentinel came into view (deduplicated per collection by the host). */
  readonly requestLoadMore: () => void
  /** The host lists a subset of the registered items (Combobox filtering): the others stay mounted, hidden. */
  readonly listed?: ((key: CollectionKey) => boolean) | undefined
}
export const listboxHost = createContext<ListboxHost>("listbox-host")
export const listboxSection = createContext<{ key: string; label: string }>("listbox-section")
export const listboxItem = createContext<() => CollectionKey>("listbox-item")
