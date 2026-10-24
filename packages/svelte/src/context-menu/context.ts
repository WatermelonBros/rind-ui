import type { ContextMenuMessages } from "@rind-ui/core"
import { createContext } from "../context"

export const contextMenuRegion = createContext<{
  readonly disabled: () => boolean
  readonly longPress: () => boolean
  readonly longPressDelay: () => number
  readonly messages: () => ContextMenuMessages
}>("context-menu")
