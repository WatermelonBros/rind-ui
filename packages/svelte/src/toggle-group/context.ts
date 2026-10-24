import type { ItemRegistry, ToggleGroupEvent, toggleGroupConnect } from "@rind-ui/core"
import { createContext } from "../context"
import type { declaredStop } from "../use-collection-items.svelte"
import type { ToggleGroupItemState } from "./types"

export const groupContext = createContext<{
  /** The connect output; `pendingStop` for an item still unregistered (server, hydration). */
  readonly api: (pendingStop?: string | null) => ReturnType<typeof toggleGroupConnect>
  readonly send: (event: ToggleGroupEvent) => void
  readonly registry: ItemRegistry
  readonly value: () => readonly string[]
  readonly disabled: () => boolean
  readonly focusableWhenDisabled: () => boolean
  readonly stop: ReturnType<typeof declaredStop>
}>("toggle-group")

export const itemContext = createContext<{
  readonly state: () => ToggleGroupItemState
  readonly indicator: () => Record<string | symbol, unknown>
}>("toggle-group-item")
