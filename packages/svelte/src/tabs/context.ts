import type { InactivePanels, ItemRegistry, TabsEvent, tabsConnect } from "@rind-ui/core"
import { createContext } from "../context"

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
  /** This tab's view of the server tab stop, read once per tab in document order. */
  readonly stop: (value: string, disabled: boolean) => string | null
}>("tabs")
