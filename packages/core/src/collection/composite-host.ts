// A composite that hosts other composites' items (a Toolbar hosting a Toggle Group or a
// Radio Group: openspec composite-host). The hosted component keeps its own registry,
// machine and value; it also registers its items here, and takes the host's roving props
// (tab stop, highlight, focus) instead of its own.

import type { PartProps } from "../connect/props"
import type { ItemRegistration } from "../dom/item-registry"

export interface CompositeHost {
  readonly kind: "toolbar"
  readonly orientation: "horizontal" | "vertical"
  readonly disabled: boolean
  readonly focusableWhenDisabled: boolean
  /** Adds a hosted item (key: its element id); it joins in document order. */
  register(item: ItemRegistration): () => void
  /**
   * The roving props of a hosted item (tabIndex, data-highlighted, data-disabled, focus →
   * the host); `first`: the item claimed the server tab stop (`claimFirst`).
   */
  itemProps(item: {
    readonly id: string
    readonly disabled: boolean
    readonly first: boolean
  }): PartProps
  /**
   * Server render and first paint: whether this item (its id) is the first rendered
   * control. Idempotent per id, so a double render (StrictMode) gets the same answer.
   */
  claimFirst(id: string): boolean
}
