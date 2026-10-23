import type {
  CollectionKey,
  ItemRegistry,
  RadioGroupEvent,
  RadioNaming,
  radioGroupConnect,
  radioGroupIds,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { createContext } from "../context"
import type { declaredStop } from "../use-collection-items.svelte"

export const radioGroupContext = createContext<{
  readonly api: (pendingStop?: string | null) => ReturnType<typeof radioGroupConnect>
  readonly send: (event: RadioGroupEvent) => void
  readonly registry: ItemRegistry
  readonly parts: PartRegistry<"label" | "description" | "error-message">
  readonly ids: () => ReturnType<typeof radioGroupIds>
  readonly value: () => string | null
  readonly disabled: () => boolean
  readonly inField: boolean
  readonly invalid: () => boolean
  /** A user change waiting for its commit: that item's input dispatches input + change. */
  readonly pending: { current: string | null }
  readonly focusableWhenDisabled: () => boolean
  /** Hosted by a Toolbar: Enter checks (APG toolbar) and never submits. */
  readonly hosted: boolean
  readonly stop: ReturnType<typeof declaredStop>
}>("radio-group")

/**
 * Internal: set by a component that renders a Radio Group as its part (Color Picker's swatch
 * group): the host's scope and part names.
 */
export const radioGroupNaming = createContext<RadioNaming | null>("radio-naming")

export const radioItemContext = createContext<{
  readonly key: () => CollectionKey
  readonly disabled: () => boolean
  readonly controlTag: () => string
  readonly setControlTag: (tag: string) => void
  readonly labelRendered: () => boolean
  readonly setLabelRendered: (on: boolean) => void
  readonly descriptionRendered: () => boolean
  readonly setDescriptionRendered: (on: boolean) => void
  readonly inputEl: { current: HTMLInputElement | null }
  readonly controlEl: { current: Element | null }
  /** This item's view of the server tab stop (read once, in document order). */
  readonly pendingStop: string | null
}>("radio-item")
