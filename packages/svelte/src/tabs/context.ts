import type { InactivePanels, ItemRegistry, TabsEvent, tabsConnect } from "@rind-ui/core"
import { createContext } from "../context"
import type { declaredStop } from "../use-collection-items.svelte"

export const tabsContext = createContext<{
  readonly api: (pendingStop?: string | null) => ReturnType<typeof tabsConnect>
  readonly send: (event: TabsEvent) => void
  readonly registry: ItemRegistry
  readonly instance: () => string
  readonly value: () => string | null
  readonly disabled: () => boolean
  readonly inactivePanels: () => InactivePanels
  readonly orientation: () => "horizontal" | "vertical"
  readonly collection: () => unknown
  /** A panel element is rendered for `key` (aria-controls). */
  readonly registerPanel: (key: string) => () => void
  /** The tabs set up so far, in document order (the server render's panels follow them). */
  readonly declared: string[]
  readonly stop: ReturnType<typeof declaredStop>
}>("tabs")
