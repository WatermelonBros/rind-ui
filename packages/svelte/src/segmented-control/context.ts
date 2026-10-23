import type {
  ItemRegistry,
  RadioGroupEvent,
  segmentedControlConnect,
  segmentedControlIds,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { createContext } from "../context"
import type { declaredStop } from "../use-collection-items.svelte"

export const segmentedContext = createContext<{
  readonly instance: () => string
  readonly api: (pendingStop?: string | null) => ReturnType<typeof segmentedControlConnect>
  readonly send: (event: RadioGroupEvent) => void
  readonly registry: ItemRegistry
  readonly collection: () => unknown
  readonly parts: PartRegistry<"label">
  readonly ids: () => ReturnType<typeof segmentedControlIds>
  readonly value: () => string | null
  readonly disabled: () => boolean
  /** A user change waiting for its commit: that segment's input dispatches input + change. */
  readonly pending: { current: string | null }
  readonly stop: ReturnType<typeof declaredStop>
}>("segmented-control")
