import type {
  Collection,
  CollectionKey,
  GridListActionDetails,
  GridListParts,
  ItemRegistry,
} from "@rind-ui/core"
import { createContext } from "../context"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"

export const gridListHost = createContext<{
  readonly parts: () => GridListParts
  readonly collection: () => Collection<unknown>
  readonly registry: ItemRegistry | null
  readonly mountLabel: (on: boolean) => void
  readonly mountDescription: (key: CollectionKey, on: boolean) => void
  readonly mountLink: (key: CollectionKey, href: string | null) => void
  readonly mountCheckbox: (key: CollectionKey, on: boolean) => void
  readonly mountRowAction: (
    key: CollectionKey,
    fn: ((details: GridListActionDetails) => void) | null,
  ) => void
  readonly hover: (key: CollectionKey | null) => void
  readonly press: (key: CollectionKey | null) => void
  readonly requestLoadMore: () => void
}>("grid-list")
export const gridListItem = createContext<() => CollectionKey>("grid-list-item")
export const gridListList = createContext<boolean>("grid-list-list")

/** A control's focus and modality (its ring). */
export function useControlFocus() {
  const env = useEnvironment()
  let focused = $state(false)
  const modality = useModality(env.modality, () => focused)
  return {
    state: () => ({ focused, modality: modality.current }),
    handlers: {
      onfocus: () => {
        focused = true
      },
      onblur: () => {
        focused = false
      },
    },
  }
}
