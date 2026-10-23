import type { progressConnect } from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { createContext } from "../context"
import type { ProgressRenderState } from "./types"

export const progressContext = createContext<{
  readonly api: () => ReturnType<typeof progressConnect>
  readonly registry: PartRegistry<"label">
  readonly instance: () => string
  readonly state: () => ProgressRenderState
}>("progress")
