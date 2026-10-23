import type { meterConnect } from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { createContext } from "../context"
import type { MeterRenderState } from "./types"

export const meterContext = createContext<{
  readonly api: () => ReturnType<typeof meterConnect>
  readonly registry: PartRegistry<"label">
  readonly instance: () => string
  readonly state: () => MeterRenderState
}>("meter")
