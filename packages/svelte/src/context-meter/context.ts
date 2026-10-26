import type { contextMeterConnect } from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { createContext } from "../context"
import type { ContextMeterRenderState } from "./types"

export const contextMeterContext = createContext<{
  readonly api: () => ReturnType<typeof contextMeterConnect>
  readonly state: () => ContextMeterRenderState
  readonly registry: PartRegistry<"label">
  readonly labelId: () => string
}>("context-meter")
